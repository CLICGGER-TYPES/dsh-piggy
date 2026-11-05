// @ts-check
/**
 * DSH 默认（内嵌单猪）模式的组合根。
 *
 * 只负责宿主事件、服务注册和默认存档位置；游戏规则与持久化由 runtime 负责。
 * OwnerDocument opt-in 走另一个模块，这里不装载 owner/云恢复相关控制器。
 */
import { join } from 'node:path'

import { createGameRuntime } from '../../runtime/index.js'
import { sessionOf } from '../../runtime/session-context.js'
import { defaultStatePath, dshHome, moveLegacySaveDir } from '../../store/state-file.js'
import { environmentNote } from '../../src/host/environment.js'
import { createExternalController } from './external-controller.js'
import { registerManagementRoutes, registerPanelRoutes } from './external-routes.js'
import { DEFAULT_CLOUD_SETTINGS, normalizeCloudSaveSettings, readCloudSaveSettings, writeCloudSaveSettings } from '../../runtime/cloud-save-settings.js'
import { testGitRemote } from '../../runtime/git-sync.js'
import { registerDshWorkObserver } from './work-observer-wiring.js'

/** @param {{on:Function,inject:Function,effect:Function}} ctx @param {any} config */
export function applyDefaultMode(ctx, config = {}) {
  const command = typeof config.command === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(config.command)
    ? config.command : 'pig'
  const customPath = typeof config.statePath === 'string' && config.statePath.trim() !== ''
  if (!customPath) moveLegacySaveDir()
  const statePath = customPath ? config.statePath : defaultStatePath()
  const cloudSettingsPath = join(dshHome(), 'dsh-piggy', 'cloud-save-settings.json')
  const loadedCloudSettings = readCloudSaveSettings(cloudSettingsPath)
  let cloudSettings = loadedCloudSettings.ok ? loadedCloudSettings.config : { ...DEFAULT_CLOUD_SETTINGS }
  if (loadedCloudSettings.ok && loadedCloudSettings.missing && config.cloudSave !== undefined) {
    try { cloudSettings = normalizeCloudSaveSettings(config.cloudSave) } catch { /* invalid legacy config stays off */ }
  }
  let cloudSettingsFailure = loadedCloudSettings.ok === true ? '' : loadedCloudSettings.reason

  /** @type {ReturnType<typeof createGameRuntime>|null} */
  let runtime = null
  let webServer = null
  let embeddedRoutes = null
  let panelRoutes = null
  let managementRoutes = null
  let closed = false

  function ensureRuntime() {
    if (runtime !== null) return runtime
    runtime = createGameRuntime({ statePath, cloudSave: { ...cloudSettings, syncReady: false }, journalHeader: environmentNote({
      运行形态: 'DSH 插件', 存档路径: statePath, DSH_HOME: process.env.DSH_HOME ?? '', Node: process.version,
    }) })
    return runtime
  }

  function mountEmbedded() {
    if (webServer === null || embeddedRoutes !== null || closed) return
    embeddedRoutes = ensureRuntime().mountRoutes(webServer)
  }

  function unmountEmbedded() {
    if (embeddedRoutes !== null) {
      const dispose = embeddedRoutes
      embeddedRoutes = null
      try { dispose() } catch (error) {
        console.warn(`[dsh-piggy] embedded route dispose failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  function mountPanel() {
    if (webServer === null || panelRoutes !== null || closed) return
    panelRoutes = registerPanelRoutes(webServer, controller)
  }

  function unmountPanel() {
    if (panelRoutes !== null) {
      const dispose = panelRoutes
      panelRoutes = null
      try { dispose() } catch (error) {
        console.warn(`[dsh-piggy] panel route dispose failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  function mountManagement() {
    if (webServer === null || managementRoutes !== null || closed) return
    managementRoutes = registerManagementRoutes(webServer, controller, {
      cloudSettings: () => cloudSettingsFailure
        ? { ok: false, reason: cloudSettingsFailure }
        : { ok: true, config: { ...cloudSettings } },
      saveCloudSettings: async value => {
        let next
        try { next = normalizeCloudSaveSettings(value) }
        catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '云存档设置无效' } }
        const previous = cloudSettings
        if (runtime !== null) {
          const applied = await runtime.configureCloudSave({ ...next, syncReady: false })
          if (applied?.ok !== true) return { ok: false, reason: applied?.reason ?? '云存档设置暂时无法应用' }
        }
        try {
          cloudSettings = writeCloudSaveSettings(cloudSettingsPath, next)
          cloudSettingsFailure = ''
          return { ok: true, config: { ...cloudSettings } }
        } catch {
          if (runtime !== null) await runtime.configureCloudSave({ ...previous, syncReady: false }).catch(() => {})
          return { ok: false, reason: '云存档设置无法保存到本机' }
        }
      },
      testCloudSettings: async value => {
        let next
        try { next = normalizeCloudSaveSettings({ ...value, enabled: value?.enabled === true }) }
        catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '云存档设置无效' } }
        if (!next.remote) return { ok: false, reason: '请先填写仓库地址' }
        return testGitRemote({ remote: next.remote, cwd: process.cwd() })
      },
    })
  }

  function unmountManagement() {
    if (managementRoutes !== null) {
      const dispose = managementRoutes
      managementRoutes = null
      try { dispose() } catch (error) {
        console.warn(`[dsh-piggy] management route dispose failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /**
   * 路由只有这一套规矩，模式直接从 controller 读，不在插件里另存一份：
   * - 管理路由（/external/*）两个模式都挂：正常模式打开设置也要能读状态、重查。
   * - 面板代理只在外部模式挂：内嵌模式下运行时会注册同路径的 /state、/act、/ext，
   *   两套同时挂上就重复占位；代理是外部猪的唯一入口，切换时必须补上。
   * 幂等：重复调用只会补齐缺的那一组。
   */
  function syncRoutes() {
    if (webServer === null || closed) return
    mountManagement()
    if (controller.mode === 'external') {
      unmountEmbedded()
      mountPanel()
    } else {
      unmountPanel()
      mountEmbedded()
    }
  }

  const embedded = {
    ensure: () => {
      if (closed) throw new Error('dsh-piggy disposed')
      const current = ensureRuntime()
      syncRoutes()
      return current
    },
    stop: async () => {
      unmountEmbedded()
      const old = runtime
      runtime = null
      return old?.dispose()
    },
    runtime: () => runtime,
  }

  const controller = createExternalController({
    statePath, embedded,
    onModeChange: async next => {
      // 离开内嵌模式就把它的运行时交还出去；回内嵌模式时 syncRoutes 会重建。
      let disposalError = null
      if (next === 'external') {
        unmountEmbedded()
        const old = runtime
        runtime = null
        try { await old?.dispose() } catch (error) { disposalError = error }
      }
      syncRoutes()
      if (disposalError !== null) throw disposalError
    },
    warn: message => console.warn(`[dsh-piggy] ${message}`),
  })
  controller.setCommandName(command)

  const observer = registerDshWorkObserver(ctx, {
    accept: event => {
      if (controller.mode === 'external') return controller.enqueue(event)
      const runtime = embedded.ensure()
      return runtime.acceptWorkEvent(event, sessionOf(runtime))
    },
    warn: message => console.warn(message),
  })

  ctx.inject(['webServer'], webCtx => {
    webServer = webCtx.webServer ?? null
    if (webServer === null) return () => {}
    // controller.init() 可能还没跑完，模式以它自己的状态为准；init 结束时还会再同步一次。
    syncRoutes()
    return () => { unmountEmbedded(); unmountPanel(); unmountManagement() }
  })

  ctx.inject(['commands'], commandCtx => commandCtx.commands.register({
    name: command,
    description: 'your pig 🐖: status · study · work · shop · travel · bag',
    input: { hint: '[hatch|feed|bathe|play|pet|study <科目>|work <job>|trip <目的地>|shop|buy|use|weigh|about]' },
    handler: invocation => {
      // 内嵌模式必须保持同步返回（旧宿主与兼容测试按同步结果读 text）；外部模式返回 Promise。
      try {
        if (controller.mode === 'external') return controller.panel.command(String(invocation.rawInput ?? ''))
        const runtime = embedded.ensure()
        return runtime.dispatchCommand(command, String(invocation.rawInput ?? ''), sessionOf(runtime))
      } catch (error) {
        return { kind: 'error', text: `🐖 猪摔了一跤：${error instanceof Error ? error.message : String(error)}` }
      }
    },
  }))

  controller.init().then(() => {
    if (closed) return
    // 模式没变时 onModeChange 不会触发，这里补一次；幂等，不会重复注册。
    syncRoutes()
  }).catch(error => {
    console.warn(`[dsh-piggy] external mode init failed: ${error instanceof Error ? error.message : String(error)}`)
  })

  ctx.effect(() => async () => {
    closed = true
    observer.dispose()
    controller.close()
    unmountEmbedded()
    unmountPanel()
    unmountManagement()
    const old = runtime
    runtime = null
    await old?.dispose()
  })
}
