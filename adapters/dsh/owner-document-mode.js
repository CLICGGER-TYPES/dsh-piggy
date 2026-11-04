// @ts-check
/**
 * DSH 的 OwnerDocument opt-in 模式：多 target、云恢复、局域网和 owner 控制路由。
 *
 * 隔离候选 opt-in：不装载外部连接/云同步控制器，仍暴露同一单猪 state/act 路由和命令形状。
 * 多 target 只能由显式 OwnerRuntime session 调用，不从公共请求参数猜目标。
 *
 * Cloud restore keeps the configured owner immutable: every remote copy lands in
 * its own root under DSH_HOME, the selection record carries pending/active, and
 * only a copy that reopened successfully becomes active.
 */
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { createGameRuntime } from '../../runtime/index.js'
import { inspectOwnerDocumentFile } from '../../runtime/owner-document-file.js'
import { sessionOf } from '../../runtime/session-context.js'
import { dshHome } from '../../store/state-file.js'
import { environmentNote } from '../../environment.js'
import { createDshOwnerCloudBridge } from './owner-cloud.js'
import { clearOwnerCloudReady, writeOwnerCloudReady } from './owner-cloud.js'
import { createDshOwnerNetworkService } from './owner-network.js'
import { createDshOwnerRestoreService } from './owner-restore.js'
import { registerDshOwnerControlRoutes } from './owner-control-routes.js'
import { createOwnerArchiveSelectionStore } from '../../runtime/owner-archive-selection.js'
import { registerDshWorkObserver } from './work-observer-wiring.js'

/**
 * @param {{on:Function,inject:Function,effect:Function}} ctx
 * @param {any} config
 */
export function applyOwnerDocumentOptIn(ctx, config) {
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

  const observer = registerDshWorkObserver(ctx, {
    accept: event => {
      const current = ensureRuntime()
      return current.acceptWorkEvent(event, sessionOf(current))
    },
    warn: message => console.warn(`[dsh-piggy] ${message}`),
  })

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
