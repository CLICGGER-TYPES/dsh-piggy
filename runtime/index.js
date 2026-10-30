// @ts-check
/** 游戏本体的运行时：适配器不持有 Store，不直接调用奖励或存档实现。 */
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { createStore } from '../store.js'
import { dispatch } from '../commands.js'
import { snapshot } from '../snapshot.js'
import { MERGE_RULES_VERSION, abandonPomodoro, callOffActivity, keepFish, mergeSummary } from '../core.js'
import { artFile } from '../store/art-route.js'
import { registerGameRoutes } from '../routes.js'
import { openWorkLedger } from './work-ledger.js'
import { acquireGameLock } from './owner-lock.js'
import { recoverSaveImportSync, commitSaveImport } from './save-transaction.js'
import { recoverMergeSync } from './merge-transaction.js'
import { createSaveTransfer } from './save-transfer.js'
import { createCloudRoutes } from './cloud-routes.js'
import { createGitSync } from './git-sync.js'
import { createSaveArchive, parseSaveArchive } from './save-archive.js'
export { WORK_EVENT_VERSION, WORK_EVENT_TYPES, WORK_EVENT_WINDOW_MS, validateWorkEvent } from './work-events.js'

/** @param {{statePath:string,fetch?:typeof globalThis.fetch,onSnapshot?:(view:any)=>void,
 * onStateChanged?:()=>void,now?:()=>number,journalHeader?:object}} options */
export function createGameRuntime(options) {
  mkdirSync(dirname(options.statePath), { recursive: true })
  const release = acquireGameLock(options.statePath)
  let ledger
  /** @type {ReturnType<typeof createStore>} */
  let store
  let closed = false, busy = false, generation = 0
  let fault = null
  let runtimeId = randomUUID()
  let epoch = 0
  let routes = []
  const mounts = new Set(), active = new Set()

  /**
   * 云存档：只在配置启用时创建。不做自动拉取——用户已定，拉取只在设置页手动点，
   * 并且可以选分支（见 docs/design/cloud-save-git.md）。
   * @type {{sync:any,remote:string,branch:string,device:string,debounceMs:number,lastPushAt:number}|null}
   */
  let cloud = null
  /** @type {NodeJS.Timeout|null} */
  let cloudTimer = null

  function createCloudSync() {
    const config = options.cloudSave
    if (config === null || typeof config !== 'object' || config.enabled !== true) return null
    const remote = typeof config.remote === 'string' ? config.remote.trim() : ''
    if (remote === '') return null
    const branch = typeof config.branch === 'string' && config.branch !== '' ? config.branch : 'main'
    const device = typeof config.device === 'string' ? config.device : ''
    const debounceMs = Number.isFinite(config.debounceMs) && config.debounceMs > 0 ? config.debounceMs : 10 * 60 * 1000
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
      importFiles: async files => {
        const result = await commitSaveImport({ statePath: options.statePath, files, backup: archive().buffer })
        // 覆盖后必须重开 Store，否则内存里还是旧档；云存档是手动低频操作，直接走 restart。
        restart()
        try { options.onStateChanged?.() } catch { /* 刷新通知失败不影响导入 */ }
        return result
      },
    })
    return { sync, remote, branch, device, debounceMs, lastPushAt: 0 }
  }

  /** 运行中定时推送（防抖窗口），失败只记日志，不影响游戏。 */
  function startCloudTimer() {
    if (cloud === null || cloudTimer !== null) return
    cloudTimer = setInterval(() => {
      void cloud.sync.pushSnapshot()
        .then(() => { if (cloud !== null) cloud.lastPushAt = Date.now() })
        .catch(error => { store?.journal?.record?.('warn', 'cloud', '云存档推送失败', { reason: String(error?.message ?? error) }) })
    }, cloud.debounceMs)
    if (typeof cloudTimer.unref === 'function') cloudTimer.unref()
  }

  function prepare() {
    if (closed) throw new Error('game runtime closed')
    if (fault) throw Object.assign(new Error('存档恢复未完成，请检查磁盘后重新启动'), { status: 503 })
    ledger.finish(store)
  }
  function available() {
    if (busy) throw Object.assign(new Error('正在处理存档，请稍后重试'), { status: 503 })
    prepare()
  }
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
    ledger = nextLedger
    store = nextStore
    const ownGeneration = ++generation
    runtimeId = randomUUID()
    epoch = 0
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
    if (cloud === null) cloud = createCloudSync()
    const next = []
    registerGameRoutes({ register(route) { next.push(route); return () => {} } }, store, { fetch: options.fetch })
    routes = next
    if (cloud !== null) {
      next.push(...createCloudRoutes({
        status: async () => ({ enabled: true, remote: cloud.remote, branch: cloud.branch, device: cloud.device, lastPushAt: cloud.lastPushAt }),
        branches: () => cloud.sync.listBranches(),
        pull: branch => cloud.sync.applyBranch(branch),
        pullCommit: target => cloud.sync.applyCommit(target),
        commit: async () => {
          const result = await cloud.sync.pushSnapshot({ manual: true })
          cloud.lastPushAt = Date.now()
          return result
        },
        history: branch => cloud.sync.history(branch === '' ? cloud.branch : branch),
        push: async () => {
          const result = await cloud.sync.pushSnapshot()
          cloud.lastPushAt = Date.now()
          return result
        },
      }))
      startCloudTimer()
    }
  }
  try { recoverSaveImportSync(options.statePath); recoverMergeSync(options.statePath); open() }
  catch (error) { store?.dispose(); release(); throw error }

  function finishDispose() {
    if (cloudTimer !== null) { clearInterval(cloudTimer); cloudTimer = null }
    if (cloud !== null && !fault) void cloud.sync.pushSnapshot().catch(() => {})
    if (!fault) { ledger.finish(store); store.flush() }
    closed = true
    for (const dispose of mounts) dispose()
    mounts.clear()
    transfer.clear()
    if (!fault) store.dispose()
    release()
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
  function snapshotForWrite() {
    if (closed) throw new Error('game runtime closed')
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

  async function exclusive(operation) {
    available()
    busy = true
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
      if (closed) finishDispose()
    }
  }
  const transfer = createSaveTransfer({ statePath: options.statePath, getStore: () => store,
    now: options.now, exclusive, isBusy: () => busy, async replace(files, backup) {
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
    } })

  async function invoke(routeKey, req, res) {
    const route = [...routes, ...transfer.routes].find(r => r.path === routeKey)
    if (!route) { res.writeHead(404); return res.end('not found') }
    if (transfer.routes.includes(route)) {
      if (closed) throw new Error('game runtime closed')
      return route.handler(req, res)
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

  return {
    handle, mountRoutes, exclusive, restart, snapshotForWrite,
    statePath: options.statePath,
    view(drain = false) {
      // 合并/导入期间仍要能给面板返回「最后一次快照 + ok:false」。
      if (!busy) available()
      else if (closed || fault) throw new Error('game runtime unavailable')
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
    prepareMerge(target) {
      return exclusive(async () => {
        const state = store.state
        if (state === null) return { ok: false, reason: 'absent', alreadyFinished: true }
        const nowMs = options.now?.() ?? Date.now()
        let result
        if (target === 'activity') {
          const had = state.activity !== null && state.activity !== undefined
          const called = callOffActivity(state, nowMs)
          result = { ok: true, alreadyFinished: had && called.ok !== true, summary: { had, result: called } }
        } else if (target === 'pomodoro') {
          const had = state.pomodoro?.startedAt !== null && state.pomodoro?.startedAt !== undefined
          const abandoned = abandonPomodoro(state, nowMs)
          result = { ok: true, alreadyFinished: had && abandoned.ok === true && abandoned.abandoned === false, summary: { had, result: abandoned } }
        } else if (target === 'fishing') {
          const pending = state.fishing?.pending ?? null
          if (pending === null) result = { ok: true, alreadyFinished: true, summary: { kept: false } }
          else if (pending.phase === 'caught') {
            const kept = keepFish(state, nowMs)
            result = { ok: true, alreadyFinished: true, summary: { kept: kept.ok === true, result: kept } }
          } else {
            // 手动钓鱼等待/搏斗：鱼跑掉，抛竿用掉的鱼饵不退。
            state.fishing.pending = null
            result = { ok: true, alreadyFinished: false, summary: { kept: false, escaped: true } }
          }
        } else result = { ok: false, reason: 'unknown-target' }
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
    acceptWorkEvent(event) {
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
    dispatchCommand(command, input) { available(); return dispatch(store, command, input) },
    record: (...args) => store.journal?.record?.(...args),
    dispose() {
      if (closed) return
      if (busy) closed = true
      else finishDispose()
    },
  }
}
