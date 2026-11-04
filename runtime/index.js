// @ts-check
/** 游戏本体的运行时：适配器不持有 Store，不直接调用奖励或存档实现。 */
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { STORE_INTERNALS, createStore } from '../store.js'
import { dispatch } from '../commands.js'
import { snapshot } from '../snapshot.js'
import { MERGE_RULES_VERSION, mergeSummary } from '../core.js'
import { artFile } from '../store/art-route.js'
import { registerGameRoutes } from '../routes.js'
import { openWorkLedger } from './work-ledger.js'
import { acquireGameLock } from './owner-lock.js'
import {
  SESSION_SCOPE, SESSION_TRANSPORT, bindRuntimeSession, createSessionBinding,
} from './session-context.js'
import { recoverSaveImportSync, commitSaveImport } from './save-transaction.js'
import { recoverMergeSync } from './merge-transaction.js'
import { createSaveTransfer } from './save-transfer.js'
import { createOwnerDocumentRuntime } from './owner-document-runtime.js'
import { createRuntimeCloud } from './game-runtime-cloud.js'
import { createRuntimeGuards } from './game-runtime-guards.js'
import { createRuntimeRouter } from './game-runtime-router.js'
import { createRuntimeMerge } from './game-runtime-merge.js'
import { createRuntimeLifecycle } from './game-runtime-lifecycle.js'
export { WORK_EVENT_VERSION, WORK_EVENT_TYPES, WORK_EVENT_WINDOW_MS, validateWorkEvent } from './work-events.js'

/** Explicit marker checked by the desktop before an OwnerDocument path reaches this runtime. */
export const OWNER_ARCHIVE_RUNTIME_API_VERSION = 1
/** Explicit local roster API marker; legacy v15 runtime packages do not implement it. */
export const OWNER_PIG_RUNTIME_API_VERSION = 1
/** Explicit full-owner-archive cloud API marker; legacy flat archives are not accepted by this path. */
export const OWNER_CLOUD_RUNTIME_API_VERSION = 1
/** Explicit authenticated private-LAN owner-session service marker; no server starts by default. */
export const OWNER_LAN_RUNTIME_API_VERSION = 1

/** @param {{statePath:string,fetch?:typeof globalThis.fetch,onSnapshot?:(view:any)=>void,
 * onStateChanged?:()=>void,now?:()=>number,journalHeader?:object,
 * cloudSave?:{enabled?:boolean,remote?:string,branch?:string,provider?:string,device?:string,debounceMs?:number,insecureSkipTlsVerify?:boolean,syncReady?:boolean}|null,
 * ownerDocumentPath?:string,legacyStatePath?:string,ownerId?:string,pigId?:string,
 * transport?:{kind:string,origin:string}}} options */
export function createGameRuntime(options) {
  if (Object.hasOwn(options, 'ownerDocumentPath')) {
    if (typeof options.ownerDocumentPath !== 'string' || options.ownerDocumentPath.trim() === '') {
      throw new TypeError('owner-document opt-in needs an explicit ownerDocumentPath')
    }
    if (typeof options.pigId !== 'string' || options.pigId.trim() === '') {
      throw new TypeError('owner-document opt-in needs an explicit pigId target')
    }
    return createOwnerDocumentRuntime({
      ownerDocumentPath: options.ownerDocumentPath,
      pigId: options.pigId,
      ...(options.legacyStatePath === undefined ? {} : { legacyStatePath: options.legacyStatePath }),
      ...(options.ownerId === undefined ? {} : { ownerId: options.ownerId }),
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      ...(options.onStateChanged === undefined ? {} : { onStateChanged: options.onStateChanged }),
      ...(options.onSnapshot === undefined ? {} : { onSnapshot: options.onSnapshot }),
      ...(options.journalHeader === undefined ? {} : { journalHeader: options.journalHeader }),
      ...(options.transport === undefined ? {} : { transport: options.transport }),
      ...(options.cloudSave === undefined ? {} : { cloudSave: options.cloudSave }),
    })
  }
  mkdirSync(dirname(options.statePath), { recursive: true })
  const release = acquireGameLock(options.statePath)
  let ledger
  /** @type {ReturnType<typeof createStore>} */
  let store
  /** 运行时级状态：守卫、exclusive 和关闭流程共享同一份，避免各自缓存旧值。 */
  /** @type {{closed:boolean,accepting:boolean,busy:boolean,fault:unknown,disposePromise:Promise<any>|null,cleanupDone:boolean}} */
  const state = {
    closed: false, accepting: true, busy: false, fault: null,
    disposePromise: null, cleanupDone: false,
  }
  let generation = 0
  let runtimeId = randomUUID()
  let epoch = 0
  let routes = []
  /** @type {import('./session-context.js').SessionBinding|null} */
  let session = null
  /** @type {any} */
  let api = null
  const mounts = new Set(), active = new Set(), specialActive = new Set(), exclusiveActive = new Set()
  let cloudRoutes = new Set()

  /** 组合根只提供实时读取器；模块不缓存 Store/Session/路由数组。 */
  const runtime = {
    getStore: () => store,
    getLedger: () => ledger,
    getSession: () => session,
    getRuntimeId: () => runtimeId,
    getGeneration: () => generation,
    getRoutes: () => routes,
    getCloudRoutes: () => cloudRoutes,
  }

  const guards = createRuntimeGuards({ state, ...runtime })
  const cloud = createRuntimeCloud({
    options,
    getStore: runtime.getStore,
    getSpecialActive: () => specialActive,
    exclusive: (operation, allowClosing) => exclusive(operation, allowClosing),
    replaceSaveFiles: (files, backup) => replaceSaveFiles(files, backup),
    assertAccepting: guards.assertAccepting,
  })
  const transfer = createSaveTransfer({ statePath: options.statePath, getStore: runtime.getStore,
    now: options.now, exclusive, isBusy: () => state.busy, replace: replaceSaveFiles })
  const router = createRuntimeRouter({ options, state, ...runtime, transfer, mounts, active, specialActive,
    available: guards.available })
  const merge = createRuntimeMerge({ options, state, getStore: runtime.getStore,
    assertAccepting: guards.assertAccepting, selectSession: guards.selectSession, exclusive })
  const lifecycle = createRuntimeLifecycle({ state, ...runtime, cloud, transfer, mounts, active,
    specialActive, exclusiveActive, release })

  /** 显式写操作才 +1；轮询/被动 decay 不改变 epoch（#14 6.6）。 */
  const READ_ONLY = new Set(['state', 'filePath', 'journal', 'freshen', 'drainPending', 'extensionOn',
    'dispose', 'flush', 'installCommittedState'])

  function changed(result) {
    if (result === null || result === false || result === undefined) return false
    if (typeof result === 'object' && result.ok === false) return false
    return true
  }

  function open() {
    const nextLedger = openWorkLedger({ directory: `${options.statePath}.work-events`,
      statePath: options.statePath, now: options.now })
    const nextStore = createStore(options.statePath, { now: options.now })
    const internals = /** @type {any} */ (nextStore)[STORE_INTERNALS]
    if (internals === undefined || internals === null) {
      throw new Error('store internals missing; refusing to open an unbindable runtime')
    }
    ledger = nextLedger
    store = nextStore
    const ownGeneration = ++generation
    runtimeId = randomUUID()
    epoch = 0
    // 同一运行时对象的重开也会换代：旧句柄/旧会话在 dispose 后拒绝，不靠文件名复活。
    if (session !== null) session.dispose()
    session = createSessionBinding({
      scope: SESSION_SCOPE.HOST_RUNTIME,
      transport: { kind: SESSION_TRANSPORT.EMBEDDED, origin: 'in-process' },
      application: internals.application,
      commands: internals.commands,
      runtimeId,
      generation: ownGeneration,
    })
    if (api !== null) bindRuntimeSession(api, session)
    if (options.journalHeader) store.journal?.header?.(options.journalHeader)
    for (const [key, method] of Object.entries(store)) {
      if (typeof method !== 'function' || READ_ONLY.has(key)) continue
      store[key] = (...args) => {
        if (generation !== ownGeneration) throw new Error('save replaced')
        guards.prepare()
        const result = method(...args)
        if (changed(result)) epoch += 1
        return result
      }
    }
    const next = []
    registerGameRoutes({ register(route) { next.push(route); return () => {} } }, store, { fetch: options.fetch })
    cloud.init()
    cloudRoutes = new Set(cloud.routes())
    next.push(...cloudRoutes)
    cloud.startTimer()
    routes = next
  }
  try { recoverSaveImportSync(options.statePath); recoverMergeSync(options.statePath); open() }
  catch (error) { store?.dispose(); release(); throw error }

  function readReceipts() {
    try {
      const parsed = JSON.parse(readFileSync(`${options.statePath}.work-events/receipts.json`, 'utf8'))
      return Array.isArray(parsed?.receipts) ? parsed.receipts : []
    } catch (error) {
      if (error?.code === 'ENOENT') return []
      throw error
    }
  }

  /** 在 exclusive 内重新结算、结清 WAL、flush，并返回可供合并计算的内存快照。 */
  function snapshotForWrite(binding) {
    guards.assertOperational()
    guards.selectSession(binding)
    const current = store.freshen()
    ledger.finish(store)
    store.flush(true)
    return {
      state: current === null ? null : structuredClone(current),
      receipts: structuredClone(readReceipts()),
      runtimeId,
      epoch,
    }
  }

  /** 合并/回滚写完盘后重载运行时；会重新生成 runtimeId。 */
  function restart() {
    if (state.closed) throw new Error('game runtime closed')
    ledger.finish(store)
    // 事务已经写盘；旧 Store 不能再 flush，否则会把合并前的内存状态覆盖回去。
    const old = store
    old.installCommittedState(null)
    old.dispose()
    open()
  }

  async function replaceSaveFiles(files, backup) {
    store.dispose()
    try {
      const result = await commitSaveImport({ statePath: options.statePath, files, backup,
        nowMs: options.now?.() ?? Date.now(), async activate() {
          if (state.closed) throw new Error('game runtime closed')
          if (files.get('state.json')?.toString() === 'null') unlinkSync(options.statePath)
          try {
            open()
            await store.ext?.ready
            if (state.closed) throw new Error('game runtime closed')
            store.flush(true)
          } catch (error) {
            store.installCommittedState(null)
            store.dispose()
            throw error
          }
        } })
      try { options.onStateChanged?.() } catch (error) {
        store.journal?.record?.('error', 'save', '存档已导入，但刷新通知失败', { reason: error.message })
      }
      return result
    } catch (error) {
      // 回滚前先撤掉部分激活的新 Store 的定时器，别让它写回旧档。
      store.installCommittedState(null)
      store.dispose()
      if (error.recoveryError) {
        try { recoverSaveImportSync(options.statePath) }
        catch (recoveryError) { state.fault = recoveryError; throw error }
      }
      try {
        open()
      } catch (reopenError) {
        // 回滚已恢复旧档，但运行时重开失败；不能让旧路由配新 store 继续跑，故障关闭等重启。
        store.installCommittedState(null)
        store.dispose()
        state.fault = reopenError
        throw error
      }
      throw error
    }
  }

  async function exclusive(operation, allowClosing = false) {
    guards.available(allowClosing)
    state.busy = true
    let pending
    pending = (async () => {
      try {
        await Promise.allSettled([...active])
        guards.prepare()
        await store.ext?.ready
        guards.prepare()
        ledger.finish(store)
        store.flush(true)
        return await operation()
      } finally {
        state.busy = false
        if (state.closed && cloud.current() === null) lifecycle.finishDispose()
      }
    })()
    exclusiveActive.add(pending)
    try {
      return await pending
    } finally { exclusiveActive.delete(pending) }
  }

  const created = {
    handle: router.handle, mountRoutes: router.mountRoutes, exclusive, restart, snapshotForWrite,
    configureCloudSave: cloud.configure, testCloudSave: cloud.test,
    statePath: options.statePath,
    view(drain = false) {
      // 合并/导入期间仍要能给面板返回「最后一次快照 + ok:false」。
      if (!state.busy) guards.available()
      else if (state.closed || !state.accepting || state.fault) throw new Error('game runtime unavailable')
      return snapshot(store, { drain })
    },
    gameInfo() {
      const current = store.state
      return {
        busy: state.busy,
        hasPig: current !== null,
        summary: current === null ? null : mergeSummary(current),
        stateVersion: current?.version ?? 0,
        mergeRulesVersion: MERGE_RULES_VERSION,
      }
    },
    art(name) { return artFile({ filePath: options.statePath }, name) },
    prepareMerge: merge.prepareMerge,
    runtimeId: () => runtimeId,
    epoch: () => epoch,
    readReceipts,
    mergeHooks() {
      const ext = store.ext
      if (ext === undefined || typeof ext.mergeStates !== 'function') return {}
      return ext.mergeStates()
    },
    targetInstalled() {
      return store.ext?.installedKeys?.() ?? []
    },
    acceptWorkEvent(event, binding) {
      guards.assertAccepting()
      guards.selectSession(binding)
      try {
        guards.available()
        const result = ledger.receive(store, event)
        if (result.status === 'applied') epoch += 1
        if (result.status !== 'duplicate') options.onStateChanged?.()
        return result
      } catch (error) {
        store.journal?.record?.('error', 'work', '工作事务未确认，保留现场', { reason: error.message })
        throw error
      }
    },
    dispatchCommand(command, input, binding) {
      guards.assertAccepting()
      guards.selectSession(binding)
      guards.available()
      return dispatch(store, command, input)
    },
    record: (...args) => store.journal?.record?.(...args),
    dispose: lifecycle.dispose,
  }
  if (session === null) throw new Error('game runtime has no session')
  api = bindRuntimeSession(created, session)
  return api
}
