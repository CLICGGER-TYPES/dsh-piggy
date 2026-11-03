// @ts-check
/** 游戏本体的运行时：适配器不持有 Store，不直接调用奖励或存档实现。 */
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { STORE_INTERNALS, createStore } from '../store.js'
import { dispatch } from '../commands.js'
import { snapshot } from '../snapshot.js'
import { MERGE_RULES_VERSION, abandonPomodoro, callOffActivity, keepFish, mergeSummary } from '../core.js'
import { artFile } from '../store/art-route.js'
import { registerGameRoutes } from '../routes.js'
import { openWorkLedger } from './work-ledger.js'
import { acquireGameLock } from './owner-lock.js'
import {
  SESSION_BOUNDARY, SESSION_SCOPE, SESSION_TRANSPORT, SessionBoundaryError, assertApplicationUsable, assertLiveSession,
  bindRuntimeSession, createSessionBinding, persistenceIssue,
} from './session-context.js'
import { recoverSaveImportSync, commitSaveImport } from './save-transaction.js'
import { recoverMergeSync } from './merge-transaction.js'
import { createSaveTransfer } from './save-transfer.js'
import { createCloudRoutes } from './cloud-routes.js'
import { createGitSync, testGitRemote } from './git-sync.js'
import { normalizeCloudSaveSettings } from './cloud-save-settings.js'
import { createSaveArchive, parseSaveArchive } from './save-archive.js'
import { createOwnerDocumentRuntime } from './owner-document-runtime.js'
export { WORK_EVENT_VERSION, WORK_EVENT_TYPES, WORK_EVENT_WINDOW_MS, validateWorkEvent } from './work-events.js'

/** Explicit marker checked by the desktop before an OwnerDocument path reaches this runtime. */
export const OWNER_ARCHIVE_RUNTIME_API_VERSION = 1
/** Explicit local roster API marker; legacy v15 runtime packages do not implement it. */
export const OWNER_PIG_RUNTIME_API_VERSION = 1
/** Explicit full-owner-archive cloud API marker; legacy flat archives are not accepted by this path. */
export const OWNER_CLOUD_RUNTIME_API_VERSION = 1

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
  let closed = false, accepting = true, busy = false, generation = 0
  let disposePromise = null
  let cleanupDone = false
  let fault = null
  let runtimeId = randomUUID()
  let epoch = 0
  let routes = []
  /** @type {import('./session-context.js').SessionBinding|null} */
  let session = null
  /** @type {any} */
  let api = null
  const mounts = new Set(), active = new Set(), specialActive = new Set(), exclusiveActive = new Set()
  let cloudRoutes = new Set()
  let cloud = null
  let cloudTimer = null
  let cloudTransition = false
  let cloudConfig = options.cloudSave ?? null
  let cloudConfigureTail = Promise.resolve()
  let cloudConfigureCount = 0

  /**
   * 纯运行态检查：不碰 ledger/store，也不做 prepare/flush。closed/fault 的
   * 原有 503 优先级必须早于会话 target/owner 探测，但正常运行时不能因此提前
   * 产生任何写入。
   */
  function assertOperational() {
    if (closed) throw new Error('game runtime closed')
    if (fault) throw Object.assign(new Error('存档恢复未完成，请检查磁盘后重新启动'), { status: 503 })
  }
  function assertAccepting() {
    assertOperational()
    if (!accepting) throw Object.assign(new Error('game runtime closing'), { status: 503 })
  }
  function prepare() {
    assertOperational()
    ledger.finish(store)
  }
  function available(allowClosing = false) {
    if (busy) throw Object.assign(new Error('正在处理存档，请稍后重试'), { status: 503 })
    if (allowClosing) assertOperational()
    else assertAccepting()
    prepare()
  }
  /**
   * 显式带来的会话必须就是当前这一代运行时；缺省只使用运行时自己的 embedded
   * 会话，不回退到“同路径的别的猪/别的运行时”。
   * @param {unknown} [binding]
   */
  function selectSession(binding) {
    if (session === null) throw new Error('game runtime has no session')
    /** @type {import('./session-context.js').SessionBinding} */
    const active = /** @type {any} */ (binding === undefined || binding === null ? session : binding)
    if (active !== session) {
      const internals = /** @type {any} */ (store)[STORE_INTERNALS]
      if (internals === undefined || internals === null) throw new Error('store internals missing')
      // 先给出处置/过期/外来的精确原因；再用对象身份拒绝“复制了同样元数据”
      // 的另一个已发放绑定。运行时的能力只认自己的那一份句柄。
      assertLiveSession(active, {
        runtimeId,
        generation,
        application: internals.application,
        commandScope: internals.commands.scope,
        owner: internals.application.owner,
        target: internals.application.target,
      })
      throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'session is not this runtime binding')
    }
    active.assertLive()
    // 会话身份/liveness 还不够：target 可能已被 release，owner 可能已 dispose。
    // 在 ledger/WAL/resource/body/save 之前用 F02 权威能力拒绝。
    assertApplicationUsable(active.assertApplication())
    return active
  }
  /** 显式写操作才 +1；轮询/被动 decay 不改变 epoch（#14 6.6）。 */
  const READ_ONLY = new Set(['state', 'filePath', 'journal', 'freshen', 'drainPending', 'extensionOn',
    'dispose', 'flush', 'installCommittedState'])

  function changed(result) {
    if (result === null || result === false || result === undefined) return false
    if (typeof result === 'object' && result.ok === false) return false
    return true
  }

  function createCloudSync(config = cloudConfig) {
    if (config === null || typeof config !== 'object' || config.enabled !== true || config.syncReady === false) return null
    const remote = typeof config.remote === 'string' ? config.remote.trim() : ''
    if (remote === '') return null
    const branch = typeof config.branch === 'string' && config.branch !== '' ? config.branch : 'main'
    const device = typeof config.device === 'string' ? config.device : ''
    const debounceMs = typeof config.debounceMs === 'number' && Number.isFinite(config.debounceMs) && config.debounceMs > 0
      ? config.debounceMs : 10 * 60 * 1000
    const archive = () => {
      const built = createSaveArchive({ statePath: options.statePath, state: store?.state ?? null })
      return {
        buffer: built.buffer,
        name: built.name,
        summary: built.summary,
        stateVersion: store?.state?.version ?? null,
        lastSeenAt: store?.state?.lastSeenAt ?? null,
        level: built.summary?.level ?? null,
        coins: store?.state?.coins ?? null,
      }
    }
    const sync = createGitSync({
      statePath: options.statePath,
      remote,
      branch,
      device,
      insecureSkipTlsVerify: config.insecureSkipTlsVerify === true,
      archive,
      parse: (_name, buffer) => parseSaveArchive(buffer),
      importFiles: files => replaceSaveFiles(files, archive().buffer),
    })
    return { sync, remote, branch, device, debounceMs, lastPushAt: 0 }
  }

  function startCloudTimer() {
    if (cloud === null || cloudTimer !== null) return
    cloudTimer = setInterval(() => {
      const activeCloud = cloud
      if (cloudTransition || activeCloud === null) return
      void cloudSequence(activeCloud, sync => exclusive(() => sync.pushSnapshot(), true))
        .then(() => { if (cloud === activeCloud) activeCloud.lastPushAt = Date.now() })
        .catch(error => {
          const cause = /** @type {any} */ (error)
          if (cause?.code !== 'CLOUD_DISABLED') store?.journal?.record?.('warn', 'cloud', '云存档推送失败', { reason: String(cause?.message ?? cause) })
        })
    }, cloud.debounceMs)
    cloudTimer.unref?.()
  }

  function activeCloud() {
    if (cloudTransition || cloud === null) throw Object.assign(new Error('云存档尚未启用或配置不完整'), { code: 'CLOUD_DISABLED', status: 409 })
    return cloud
  }

  function cloudSequence(current, operation) {
    return current.sync.sequence(sync => {
      // A queued operation accepted before the user closed or changed settings
      // must not start a new Git command against the previous remote.
      if (cloudTransition || cloud !== current) throw Object.assign(new Error('云存档设置已更改'), { code: 'CLOUD_DISABLED', status: 409 })
      return operation(sync)
    })
  }

  function cloudRouteList() {
    const getCloud = () => activeCloud()
    return createCloudRoutes({
      status: async () => cloud === null
        ? { enabled: false, remoteConfigured: false, lastPushAt: 0 }
        : { enabled: true, remoteConfigured: true, branch: cloud.branch, device: cloud.device, lastPushAt: cloud.lastPushAt },
      branches: () => { const current = getCloud(); return cloudSequence(current, sync => sync.listBranches()) },
      pull: branch => { const current = getCloud(); return cloudSequence(current, sync => exclusive(() => sync.applyBranch(branch), true)) },
      pullCommit: target => { const current = getCloud(); return cloudSequence(current, sync => exclusive(() => sync.applyCommit(target), true)) },
      commit: () => { const current = getCloud(); return cloudSequence(current, async sync => {
        const result = await exclusive(() => sync.pushSnapshot({ manual: true }), true)
        current.lastPushAt = Date.now()
        return result
      }) },
      history: branch => { const current = getCloud(); return cloudSequence(current, sync => sync.history(branch === '' ? current.branch : branch)) },
      push: () => { const current = getCloud(); return cloudSequence(current, async sync => {
        const result = await exclusive(() => sync.pushSnapshot(), true)
        current.lastPushAt = Date.now()
        return result
      }) },
    })
  }

  async function configureCloudSaveNow(value) {
    assertAccepting()
    const normalized = normalizeCloudSaveSettings(value)
    // First-sync/restore requires a separate user-facing decision flow. Until that
    // flow exists, local settings cannot arm automatic pushes or cloud restore routes.
    const nextConfig = { ...normalized, syncReady: value?.syncReady === true }
    const oldCloud = cloud
    const previousConfig = cloudConfig
    cloudTransition = true
    if (cloudTimer !== null) { clearInterval(cloudTimer); cloudTimer = null }
    cloud = null
    try {
      // Prevent new cloud route work first, then let already-owned operations drain.
      await Promise.allSettled([...specialActive])
      await oldCloud?.sync.close({ finalPush: false })
      cloudConfig = nextConfig
      options.cloudSave = nextConfig
      cloud = createCloudSync(nextConfig)
      if (cloud !== null) startCloudTimer()
      return { ok: true, config: nextConfig, enabled: cloud !== null }
    } catch (error) {
      // Configuration changes never leave a half-active service behind. Recreate the
      // previous service without triggering its shutdown final push.
      cloudConfig = previousConfig
      options.cloudSave = previousConfig
      cloud = createCloudSync(previousConfig)
      if (cloud !== null) startCloudTimer()
      return { ok: false, reason: '云存档设置暂时无法应用' }
    } finally { cloudTransition = false }
  }

  function configureCloudSave(value) {
    cloudConfigureCount += 1
    const pending = cloudConfigureTail.then(() => configureCloudSaveNow(value))
    cloudConfigureTail = pending.then(() => { cloudConfigureCount -= 1 }, () => { cloudConfigureCount -= 1 })
    return pending
  }

  async function testCloudSave(value) {
    let config
    try { config = normalizeCloudSaveSettings({ ...value, enabled: value?.enabled === true }) }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '云存档设置无效' } }
    if (!config.remote) return { ok: false, reason: '请先填写仓库地址' }
    // This call is intentionally outside cloud.sync's mutation queue: ls-remote is
    // read-only and must not wait on a queue it is itself trying to inspect.
    return testGitRemote({ remote: config.remote, cwd: dirname(options.statePath) })
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
        prepare()
        const result = method(...args)
        if (changed(result)) epoch += 1
        return result
      }
    }
    const next = []
    registerGameRoutes({ register(route) { next.push(route); return () => {} } }, store, { fetch: options.fetch })
    if (cloud === null) cloud = createCloudSync(cloudConfig)
    cloudRoutes = new Set(cloudRouteList())
    next.push(...cloudRoutes)
    startCloudTimer()
    routes = next
  }
  try { recoverSaveImportSync(options.statePath); recoverMergeSync(options.statePath); open() }
  catch (error) { store?.dispose(); release(); throw error }

  function finishDispose({ flush = true } = {}) {
    if (cleanupDone) return
    // A failed final write must leave the live Store, owner lock and routes intact so
    // the caller can repair the filesystem and retry shutdown. Persist before teardown.
    if (flush && !fault) { ledger.finish(store); store.flush() }
    accepting = false
    if (cloudTimer !== null) { clearInterval(cloudTimer); cloudTimer = null }
    closed = true
    session?.dispose()
    for (const dispose of mounts) dispose()
    mounts.clear()
    transfer.clear()
    try { if (!fault) store.dispose() }
    finally {
      release()
      cleanupDone = true
    }
  }
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
    assertOperational()
    selectSession(binding)
    const state = store.freshen()
    ledger.finish(store)
    store.flush(true)
    return {
      state: state === null ? null : structuredClone(state),
      receipts: structuredClone(readReceipts()),
      runtimeId,
      epoch,
    }
  }

  /** 合并/回滚写完盘后重载运行时；会重新生成 runtimeId。 */
  function restart() {
    if (closed) throw new Error('game runtime closed')
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
          if (closed) throw new Error('game runtime closed')
          if (files.get('state.json')?.toString() === 'null') unlinkSync(options.statePath)
          try {
            open()
            await store.ext?.ready
            if (closed) throw new Error('game runtime closed')
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
        catch (recoveryError) { fault = recoveryError; throw error }
      }
      try {
        open()
      } catch (reopenError) {
        // 回滚已恢复旧档，但运行时重开失败；不能让旧路由配新 store 继续跑，故障关闭等重启。
        store.installCommittedState(null)
        store.dispose()
        fault = reopenError
        throw error
      }
      throw error
    }
  }

  async function exclusive(operation, allowClosing = false) {
    available(allowClosing)
    busy = true
    let pending
    pending = (async () => {
      try {
        await Promise.allSettled([...active])
        prepare()
        await store.ext?.ready
        prepare()
        ledger.finish(store)
        store.flush(true)
        return await operation()
      } finally {
        busy = false
        if (closed && cloud === null) finishDispose()
      }
    })()
    exclusiveActive.add(pending)
    try {
      return await pending
    } finally { exclusiveActive.delete(pending) }
  }
  const transfer = createSaveTransfer({ statePath: options.statePath, getStore: () => store,
    now: options.now, exclusive, isBusy: () => busy, replace: replaceSaveFiles })

  async function invoke(routeKey, req, res) {
    const route = [...routes, ...transfer.routes].find(r => r.path === routeKey)
    if (!route) { res.writeHead(404); return res.end('not found') }
    if (transfer.routes.includes(route) || cloudRoutes.has(route)) {
      if (!accepting) {
        res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        return res.end(JSON.stringify({ ok: false, error: 'game runtime closing' }))
      }
      const pending = Promise.resolve().then(() => route.handler(req, res))
      specialActive.add(pending)
      try { return await pending } finally { specialActive.delete(pending) }
    }
    if (!(closed && route.path === '/dsh-piggy/logs/export')) {
      try { available() } catch (error) {
        res.writeHead(error.status ?? 503, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({ ok: false, error: error.message }))
      }
    }
    const pending = Promise.resolve().then(() => route.handler(req, res))
    active.add(pending)
    try { return await pending } finally { active.delete(pending) }
  }
  function mountRoutes(webServer) {
    available()
    const disposers = [...routes, ...transfer.routes].map(route => webServer.register({ ...route,
      handler: (req, res) => invoke(route.path, req, res) }))
    const dispose = () => { for (const off of disposers) off() }
    mounts.add(dispose)
    return () => { mounts.delete(dispose); dispose() }
  }

  function handle(method, url, body) {
    const path = url.split('?')[0]
    const route = [...routes, ...transfer.routes].find(r => r.kind === 'prefix' ? path.startsWith(r.path + '/') : path === r.path)
    if (!route) return Promise.resolve({ status: 404, headers: {}, body: '' })
    return new Promise((resolve, reject) => {
      let status = 200
      let headers = {}
      const req = { method, url, async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body) } }
      const res = {
        writeHead(code, extra) { status = code; headers = { ...headers, ...(extra ?? {}) }; return res },
        setHeader(name, value) { headers[name.toLowerCase()] = String(value) },
        end(chunk) {
          if (options.onSnapshot && String(headers['content-type'] ?? '').includes('application/json')) {
            const view = JSON.parse(String(chunk))
            if (Array.isArray(view.pending) && view.pending.length > 0) options.onSnapshot(view)
          }
          resolve({ status, headers, body: chunk ?? '' })
        },
      }
      Promise.resolve(invoke(route.path, req, res)).catch(reject)
    })
  }

  const created = {
    handle, mountRoutes, exclusive, restart, snapshotForWrite, configureCloudSave, testCloudSave,
    statePath: options.statePath,
    view(drain = false) {
      // 合并/导入期间仍要能给面板返回「最后一次快照 + ok:false」。
      if (!busy) available()
      else if (closed || !accepting || fault) throw new Error('game runtime unavailable')
      return snapshot(store, { drain })
    },
    gameInfo() {
      const state = store.state
      return {
        busy,
        hasPig: state !== null,
        summary: state === null ? null : mergeSummary(state),
        stateVersion: state?.version ?? 0,
        mergeRulesVersion: MERGE_RULES_VERSION,
      }
    },
    art(name) { return artFile({ filePath: options.statePath }, name) },
    prepareMerge(target, binding) {
      // 在 exclusive 的例行 flush 之前就拒绝故障/过期/外来会话，避免旧句柄碰这份存档。
      assertAccepting()
      selectSession(binding)
      return exclusive(async () => {
        selectSession(binding)
        if (closed) throw new Error('game runtime closed')
        const state = store.state
        if (state === null) return { ok: false, reason: 'absent', alreadyFinished: true }
        const internals = /** @type {any} */ (store)[STORE_INTERNALS]
        if (internals === undefined || internals === null) throw new Error('store internals missing')
        // 只按显式持久化能力判断，不按存档里的 pigs/pigBodies 等旧字段名猜。
        const persistence = persistenceIssue(internals.persistence)
        if (persistence !== null) return { ok: false, reason: persistence }
        const nowMs = options.now?.() ?? Date.now()
        /** @type {{ok:boolean, [key:string]: unknown}|null} */
        let result = null
        const application = internals.application
        // 终结也是 owner 事务：活动/退款/番茄/钓鱼与目标猪 body 一致提交或回滚，
        // 不再直接改 store.state 后 flush。
        application.owner.transact(application.target, live => {
          if (target === 'activity') {
            const had = live.activity !== null && live.activity !== undefined
            const called = callOffActivity(live, nowMs)
            result = { ok: true, alreadyFinished: had && called.ok !== true, summary: { had, result: called } }
          } else if (target === 'pomodoro') {
            const had = live.pomodoro?.startedAt !== null && live.pomodoro?.startedAt !== undefined
            const abandoned = abandonPomodoro(live, nowMs)
            result = { ok: true, alreadyFinished: had && abandoned.ok === true && abandoned.abandoned === false, summary: { had, result: abandoned } }
          } else if (target === 'fishing') {
            const pending = live.fishing?.pending ?? null
            if (pending === null) result = { ok: true, alreadyFinished: true, summary: { kept: false } }
            else if (pending.phase === 'caught') {
              const kept = keepFish(live, nowMs)
              result = { ok: true, alreadyFinished: true, summary: { kept: kept.ok === true, result: kept } }
            } else {
              // 手动钓鱼等待/搏斗：鱼跑掉，抛竿用掉的鱼饵不退。
              live.fishing.pending = null
              result = { ok: true, alreadyFinished: false, summary: { kept: false, escaped: true } }
            }
          } else result = { ok: false, reason: 'unknown-target' }
          return result
        })
        if (result === null) throw new Error('prepareMerge produced no result')
        if (result.ok !== false) store.flush(true)
        return result
      })
    },
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
      assertAccepting()
      selectSession(binding)
      try {
        available()
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
      assertAccepting()
      selectSession(binding)
      available()
      return dispatch(store, command, input)
    },
    record: (...args) => store.journal?.record?.(...args),
    dispose() {
      if (disposePromise !== null) return disposePromise
      if (closed) return Promise.resolve({ alreadyClosed: true })
      accepting = false
      if (cloudConfigureCount > 0) {
        disposePromise = cloudConfigureTail.then(() => {
          disposePromise = null
          return created.dispose()
        })
        return disposePromise
      }
      if (cloud === null) {
        if (busy) {
          closed = true
          disposePromise = Promise.allSettled([...active, ...specialActive, ...exclusiveActive])
            .then(() => {
              try { finishDispose(); return { localPersisted: true, cloudPush: 'disabled' } }
              catch (error) { closed = false; accepting = true; disposePromise = null; throw error }
            })
          return disposePromise
        }
        try { finishDispose() }
        catch (error) { accepting = true; throw error }
        return Promise.resolve({ localPersisted: true, cloudPush: 'disabled' })
      }

      if (cloudTimer !== null) { clearInterval(cloudTimer); cloudTimer = null }
      for (const unmount of mounts) unmount()
      mounts.clear()
      transfer.clear()
      disposePromise = (async () => {
        const pending = [...active, ...specialActive, ...exclusiveActive]
        await Promise.allSettled(pending)
        await cloud.sync.drain()

        let persistenceError = null
        if (!fault) {
          try { ledger.finish(store); store.flush() }
          catch (error) { persistenceError = error }
        }

        /** @type {{ok: false, reason: string, message?: string} | {ok: true, at: number}} */
        let cloudPush = fault
          ? { ok: false, reason: 'runtime-fault' }
          : persistenceError !== null
            ? { ok: false, reason: 'local-persist-failed' }
            : { ok: false, reason: 'not-attempted' }
        try {
          const closeResult = await cloud.sync.close({ finalPush: !fault && persistenceError === null })
          if (closeResult.finalPush === true) {
            cloud.lastPushAt = Date.now()
            cloudPush = { ok: true, at: cloud.lastPushAt }
          }
        } catch (error) {
          cloudPush = { ok: false, reason: 'final-push-failed', message: String(error?.message ?? error) }
          try { store.journal?.record?.('warn', 'cloud', '关闭时最终云推送失败', { reason: cloudPush.message }) } catch { /* the returned close result is still authoritative */ }
          console.warn(`[dsh-piggy] final cloud push failed: ${cloudPush.message}`)
        }

        finishDispose({ flush: false })
        if (persistenceError !== null) throw persistenceError
        return { localPersisted: !fault, cloudPush }
      })()
      return disposePromise
    },
  }
  if (session === null) throw new Error('game runtime has no session')
  api = bindRuntimeSession(created, session)
  return api
}
