// @ts-check
/** 游戏本体的运行时：适配器不持有 Store，不直接调用奖励或存档实现。 */
import { dirname } from 'node:path'
import { mkdirSync, unlinkSync } from 'node:fs'
import { createStore } from '../store.js'
import { dispatch } from '../commands.js'
import { registerGameRoutes } from '../routes.js'
import { openWorkLedger } from './work-ledger.js'
import { acquireGameLock } from './owner-lock.js'
import { recoverSaveImportSync, commitSaveImport } from './save-transaction.js'
import { createSaveTransfer } from './save-transfer.js'
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
  let routes = []
  const mounts = new Set(), active = new Set()

  function prepare() {
    if (closed) throw new Error('game runtime closed')
    if (fault) throw Object.assign(new Error('存档恢复未完成，请检查磁盘后重新启动'), { status: 503 })
    ledger.finish(store)
  }
  function available() {
    if (busy) throw Object.assign(new Error('正在处理存档，请稍后重试'), { status: 503 })
    prepare()
  }
  function open() {
    const nextLedger = openWorkLedger({ directory: `${options.statePath}.work-events`,
      statePath: options.statePath, now: options.now })
    const nextStore = createStore(options.statePath, { now: options.now })
    ledger = nextLedger
    store = nextStore
    const ownGeneration = ++generation
    if (options.journalHeader) store.journal?.header?.(options.journalHeader)
    for (const [key, method] of Object.entries(store)) {
      if (typeof method !== 'function' || ['dispose', 'flush', 'installCommittedState'].includes(key)) continue
      store[key] = (...args) => {
        if (generation !== ownGeneration) throw new Error('save replaced')
        prepare()
        return method(...args)
      }
    }
    const next = []
    registerGameRoutes({ register(route) { next.push(route); return () => {} } }, store, { fetch: options.fetch })
    routes = next
  }
  try { recoverSaveImportSync(options.statePath); open() }
  catch (error) { store?.dispose(); release(); throw error }

  function finishDispose() {
    if (!fault) { ledger.finish(store); store.flush() }
    closed = true
    for (const dispose of mounts) dispose()
    mounts.clear()
    transfer.clear()
    if (!fault) store.dispose()
    release()
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
    handle, mountRoutes,
    acceptWorkEvent(event) {
      try {
        available()
        const result = ledger.receive(store, event)
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
