// @ts-check
/** DSH 只负责宿主事件、服务注册和默认位置；游戏规则与持久化由运行时负责。 */
import { createHash, randomUUID } from 'node:crypto'
import { createGameRuntime } from '../../runtime/index.js'
import { inspectOwnerDocumentFile } from '../../runtime/owner-document-file.js'
import { sessionOf } from '../../runtime/session-context.js'
import { defaultStatePath, dshHome, moveLegacySaveDir } from '../../store/state-file.js'
import { join } from 'node:path'
import { environmentNote } from '../../environment.js'
import { createWorkObserver } from './work-observer.js'
import { createExternalController } from './external-controller.js'
import { registerManagementRoutes, registerPanelRoutes } from './external-routes.js'
import { DEFAULT_CLOUD_SETTINGS, normalizeCloudSaveSettings, readCloudSaveSettings, writeCloudSaveSettings } from '../../runtime/cloud-save-settings.js'
import { testGitRemote } from '../../runtime/git-sync.js'
import { createDshOwnerCloudBridge } from './owner-cloud.js'
import { clearOwnerCloudReady, writeOwnerCloudReady } from './owner-cloud.js'
import { createDshOwnerNetworkService } from './owner-network.js'
import { createDshOwnerRestoreService } from './owner-restore.js'
import { registerDshOwnerControlRoutes } from './owner-control-routes.js'
import { createOwnerArchiveSelectionStore } from '../../runtime/owner-archive-selection.js'

export const name = 'dsh-piggy'
export const inject = []

export function apply(ctx, config = {}) {
  if (Object.hasOwn(config, 'ownerDocumentPath')) {
    if (typeof config.ownerDocumentPath !== 'string' || config.ownerDocumentPath.trim() === '') {
      throw new TypeError('ownerDocumentPath opt-in must be a non-empty explicit path')
    }
    return applyOwnerDocumentOptIn(ctx, config)
  }
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

  // Host callbacks have no durable identity; keep each generated event ID stable across 503 retries.
  // The accept callback names the exact runtime generation whose session owns the save; a
  // replaced/disposed runtime refuses instead of falling back to another pig or file.
  const observer = createWorkObserver({ accept: event => {
    if (controller.mode === 'external') return controller.enqueue(event)
    const runtime = embedded.ensure()
    return runtime.acceptWorkEvent(event, sessionOf(runtime))
  }, source: 'dsh', producer: randomUUID(),
  warn: message => console.warn(message) })
  const observe = type => observer.observe(type)
  ctx.on('agent/inbox/claimed', () => observe('message'))
  ctx.on('agent/turn-stopping', () => observe('turn'))
  ctx.on('agent/error', () => observe('agentError'))
  ctx.on('tools/result', (exec, result) => observe(result?.isError === true ? 'toolError' : 'tool'))

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

/**
 * 隔离候选 opt-in：不装载外部连接/云同步控制器，仍暴露同一单猪 state/act 路由和命令形状。
 * 多 target 只能由显式 OwnerRuntime session 调用，不从公共请求参数猜目标。
 *
 * Cloud restore keeps the configured owner immutable: every remote copy lands in
 * its own root under DSH_HOME, the selection record carries pending/active, and
 * only a copy that reopened successfully becomes active.
 */
function applyOwnerDocumentOptIn(ctx, config) {
  const command = typeof config.command === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(config.command)
    ? config.command : 'pig'
  const configuredPath = config.ownerDocumentPath
  const selectionDirectory = join(dshHome(), 'dsh-piggy')
  const archiveRoot = join(selectionDirectory, 'owner-archives')
  const selectionStore = createOwnerArchiveSelectionStore({ directory: selectionDirectory, archiveRoot })

  function readyDirectoryFor(ownerDocumentPath) {
    return join(selectionDirectory, 'owner-cloud', createHash('sha256').update(ownerDocumentPath).digest('hex'))
  }

  function configuredOwner() {
    const inspected = inspectOwnerDocumentFile(configuredPath)
    return {
      ownerDocumentPath: configuredPath,
      ownerId: typeof config.ownerId === 'string' ? config.ownerId
        : inspected.kind === 'owner-document' ? inspected.document.ownerId : null,
      pigId: typeof config.pigId === 'string' ? config.pigId : null,
      source: 'configured',
    }
  }

  /**
   * Resolve the saved selection before any runtime opens. A corrupt record or a
   * missing active copy fails closed; a pending switch whose copy is missing or
   * does not match its recorded identity rolls back to the prior active owner.
   */
  function resolveStartupSelection() {
    const state = selectionStore.read()
    if (state.pending === null) return { active: state.active, pending: null }
    const next = state.pending.next
    let usable = false
    try {
      const inspected = inspectOwnerDocumentFile(next.ownerDocumentPath)
      usable = inspected.kind === 'owner-document' && inspected.document.ownerId === next.ownerId &&
        inspected.document.pigs.some(pig => pig.pigId === next.pigId)
    } catch { usable = false }
    if (!usable) {
      selectionStore.rollbackPending()
      console.warn('[dsh-piggy] pending owner switch rolled back; the unverified copy was kept')
      return { active: selectionStore.read().active, pending: null }
    }
    return { active: next, pending: state.pending }
  }

  const startup = resolveStartupSelection()
  let active = startup.active !== null ? { ...startup.active, source: 'archive' } : configuredOwner()
  let startupPending = startup.pending
  let runtime = null
  let webServer = null
  let unmountGameRoutes = null
  let mountedRuntime = null
  let unmountOwnerControl = null
  let networkService = null
  let restoreService = null
  let switching = false
  let closed = false

  function cloudBridgeFor(owner) {
    return createDshOwnerCloudBridge({
      readyDirectory: readyDirectoryFor(owner.ownerDocumentPath),
      ownerId: owner.ownerId ?? null,
      config: config.ownerCloud,
      restore: current => getRestoreService().preview(current),
    })
  }

  function createRuntimeFor(owner) {
    return createGameRuntime({
      statePath: owner.ownerDocumentPath,
      ownerDocumentPath: owner.ownerDocumentPath,
      legacyStatePath: config.legacyStatePath,
      ...(typeof owner.ownerId === 'string' ? { ownerId: owner.ownerId } : {}),
      pigId: owner.pigId,
      cloudSave: cloudBridgeFor(owner).runtimeConfig(owner.ownerId ?? null),
      journalHeader: environmentNote({
        运行形态: 'DSH OwnerDocument opt-in',
        存档路径: owner.ownerDocumentPath,
        Node: process.version,
      }),
    })
  }

  function mountGameRoutes(current) {
    unmountGameRoutes?.(); unmountGameRoutes = null
    mountedRuntime = null
    if (webServer === null) return
    unmountGameRoutes = current.mountRoutes(webServer, sessionOf(current))
    mountedRuntime = current
  }

  async function stopRuntime() {
    const stopping = networkService
    networkService = null
    try { await stopping?.close() } catch { /* the owner switch still has to close the runtime */ }
    unmountGameRoutes?.(); unmountGameRoutes = null
    mountedRuntime = null
    const old = runtime
    runtime = null
    await old?.dispose()
  }

  function openRuntime() {
    if (closed) throw new Error('dsh-piggy disposed')
    if (runtime !== null) return runtime
    const target = active
    let opened
    try {
      opened = createRuntimeFor(target)
    } catch (error) {
      if (startupPending === null) throw error
      // The pending copy opened at selection time but the live runtime refused it.
      const pending = startupPending
      startupPending = null
      selectionStore.rollbackPending()
      active = pending.previous === null ? configuredOwner() : { ...pending.previous, source: 'archive' }
      console.warn('[dsh-piggy] pending owner switch could not open; previous owner restored and the new copy kept')
      opened = createRuntimeFor(active)
    }
    if (startupPending !== null) {
      const pending = startupPending
      startupPending = null
      try {
        selectionStore.commitPending()
      } catch (error) {
        void opened.dispose().catch(() => {})
        active = pending.previous === null ? configuredOwner() : { ...pending.previous, source: 'archive' }
        throw error
      }
    }
    runtime = opened
    if (webServer !== null && mountedRuntime !== opened) mountGameRoutes(opened)
    return opened
  }

  function ensureRuntime() {
    if (switching) {
      throw Object.assign(new Error('owner switch in progress'), { code: 'OWNER_SWITCHING', status: 503 })
    }
    return openRuntime()
  }

  async function switchOwner(next) {
    if (switching) return { ok: false, reason: 'Another owner switch is already in progress' }
    switching = true
    const previous = active
    try {
      selectionStore.stage({ ownerDocumentPath: next.ownerDocumentPath, ownerId: next.ownerId, pigId: next.pigId })
      try {
        await stopRuntime()
        const opened = createRuntimeFor({ ...next, source: 'archive' })
        runtime = opened
        active = { ...next, source: 'archive' }
        if (webServer !== null) mountGameRoutes(opened)
        try {
          selectionStore.commitPending()
        } catch (error) {
          await stopRuntime()
          active = previous
          try {
            const reopened = createRuntimeFor(previous)
            runtime = reopened
            if (webServer !== null) mountGameRoutes(reopened)
          } catch { /* the previous owner stays selected for the next attempt */ }
          throw error
        }
        return { ok: true, ownerId: next.ownerId }
      } catch {
        try { if (selectionStore.read().pending !== null) selectionStore.rollbackPending() } catch { /* keep the journal for startup recovery */ }
        if (runtime === null) {
          try {
            const reopened = createRuntimeFor(previous)
            runtime = reopened
            active = previous
            if (webServer !== null) mountGameRoutes(reopened)
          } catch { /* fail closed; the selection still points at the previous owner */ }
        }
        return { ok: false, reason: 'Owner copy could not be activated; the new copy was kept and the previous owner was restored' }
      }
    } finally {
      switching = false
    }
  }

  function getRestoreService() {
    if (restoreService !== null) return restoreService
    restoreService = createDshOwnerRestoreService({
      archiveRoot,
      selectionStore,
      getRuntime: () => ensureRuntime(),
      getActive: () => active,
      getCloudConfig: () => config.ownerCloud,
      switchOwner,
      prepareCloudReady: ({ ownerDocumentPath, ownerId, baseHead }) => writeOwnerCloudReady({
        readyDirectory: readyDirectoryFor(ownerDocumentPath), ownerId, config: config.ownerCloud, baseHead,
      }),
      clearCloudReady: ({ ownerDocumentPath, ownerId }) => clearOwnerCloudReady({
        readyDirectory: readyDirectoryFor(ownerDocumentPath), ownerId, config: config.ownerCloud,
      }),
    })
    return restoreService
  }

  function selectionSummary() {
    const view = selection => selection === null ? null : {
      ownerDocumentPath: selection.ownerDocumentPath, ownerId: selection.ownerId, pigId: selection.pigId,
    }
    try {
      const state = selectionStore.read()
      return {
        source: state.active === null ? 'configured' : 'archive',
        active: view(state.active),
        pending: state.pending === null ? null : { previous: view(state.pending.previous), next: view(state.pending.next) },
        archiveRoot,
      }
    } catch (error) {
      return { source: 'unreadable', active: view(active), pending: null, archiveRoot,
        reason: error instanceof Error ? error.message : 'Owner selection is unreadable' }
    }
  }

  function getNetworkService() {
    if (networkService !== null) return networkService
    const current = ensureRuntime()
    networkService = createDshOwnerNetworkService({ ownerDocumentPath: active.ownerDocumentPath, runtime: current, config })
    return networkService
  }

  const observer = createWorkObserver({ accept: event => {
    const current = ensureRuntime()
    return current.acceptWorkEvent(event, sessionOf(current))
  }, source: 'dsh', producer: randomUUID(), warn: message => console.warn(`[dsh-piggy] ${message}`) })
  const observe = type => observer.observe(type)
  ctx.on('agent/inbox/claimed', () => observe('message'))
  ctx.on('agent/turn-stopping', () => observe('turn'))
  ctx.on('agent/error', () => observe('agentError'))
  ctx.on('tools/result', (_exec, result) => observe(result?.isError === true ? 'toolError' : 'tool'))

  ctx.inject(['webServer'], webCtx => {
    webServer = webCtx.webServer ?? null
    if (webServer === null) return () => {}
    const current = ensureRuntime()
    if (mountedRuntime !== current) mountGameRoutes(current)
    unmountOwnerControl = registerDshOwnerControlRoutes(webServer, {
      getRuntime: ensureRuntime,
      getNetwork: getNetworkService,
      getCloud: () => cloudBridgeFor(active),
      getRestore: getRestoreService,
      getSelection: selectionSummary,
    })
    return () => {
      unmountGameRoutes?.(); unmountGameRoutes = null
      mountedRuntime = null
      unmountOwnerControl?.(); unmountOwnerControl = null
      networkService?.close().catch(() => {})
      networkService = null
    }
  })

  ctx.inject(['commands'], commandCtx => commandCtx.commands.register({
    name: command,
    description: 'your pig 🐖: status · study · work · shop · travel · bag',
    input: { hint: '[hatch|feed|bathe|play|pet|study <科目>|work <job>|trip <目的地>|shop|buy|use|weigh|about]' },
    handler: invocation => {
      try {
        const current = ensureRuntime()
        return current.dispatchCommand(command, String(invocation.rawInput ?? ''), sessionOf(current))
      } catch (error) {
        return { kind: 'error', text: `🐖 猪摔了一跤：${error instanceof Error ? error.message : String(error)}` }
      }
    },
  }))

  ctx.effect(() => async () => {
    closed = true
    observer.dispose()
    restoreService?.clear()
    unmountGameRoutes?.()
    unmountGameRoutes = null
    mountedRuntime = null
    unmountOwnerControl?.()
    unmountOwnerControl = null
    await networkService?.close()
    networkService = null
    const old = runtime
    runtime = null
    await old?.dispose()
  })
}
