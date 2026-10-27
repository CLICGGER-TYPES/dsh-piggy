// @ts-check
/** 桌面外壳只保留异步代理；扩展下载仍由 Chromium 网络栈执行。 */
import { Worker } from 'node:worker_threads'

export async function startBackgroundHost(gameDir, statePath, options = {}) {
  const worker = new Worker(new URL('./runtime-worker.js', import.meta.url), {
    workerData: { gameDir, statePath, workEventsDirectory: options.workEventsDirectory,
      optionalExtensionsDirectory: options.optionalExtensionsDirectory,
      workEventsAutoStart: options.workEventsAutoStart !== false, gameVersion: options.gameVersion ?? '' },
  })
  const pending = new Map()
  const fetches = new Map()
  let sequence = 0
  let closing, failure
  let closed = false
  let workerDead = false
  let resolveReady, rejectReady
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject })

  function fail(error) {
    failure = error
    rejectReady(error)
    for (const task of pending.values()) task.reject(error)
    pending.clear()
    for (const controller of fetches.values()) controller.abort()
    fetches.clear()
  }

  /** @param {string} method @param {any[]} [args] @param {ArrayBuffer[]} [transfer] */
  function request(method, args = [], transfer = []) {
    if (failure) return Promise.reject(failure)
    if (closed || (closing && method !== 'dispose')) return Promise.reject(new Error('game runtime closed'))
    return new Promise((resolve, reject) => {
      const id = ++sequence
      pending.set(id, { resolve, reject })
      try { worker.postMessage({ kind: 'request', id, method, args }, transfer) }
      catch (error) { pending.delete(id); reject(error) }
    })
  }

  async function forwardFetch(message) {
    const controller = new AbortController()
    fetches.set(message.id, controller)
    try {
      const response = await (options.fetch ?? globalThis.fetch)(message.url, { ...message.init, signal: controller.signal })
      const body = await response.arrayBuffer()
      const headers = []
      response.headers.forEach((value, key) => headers.push([key, value]))
      worker.postMessage({ kind: 'fetch-result', id: message.id, status: response.status, headers, body }, [body])
    } catch (error) {
      worker.postMessage({ kind: 'fetch-result', id: message.id, error: controller.signal.aborted ? 'fetch aborted' : 'fetch failed' })
    } finally { fetches.delete(message.id) }
  }

  worker.on('message', message => {
    if (message.kind === 'ready') resolveReady(undefined)
    else if (message.kind === 'startup-error') fail(new Error(message.error))
    else if (message.kind === 'response') {
      const task = pending.get(message.id)
      if (!task) return
      pending.delete(message.id)
      if (message.error) task.reject(new Error(message.error))
      else task.resolve(message.value)
    } else if (message.kind === 'snapshot') options.onSnapshot?.(message.value)
    else if (message.kind === 'changed') options.onStateChanged?.()
    else if (message.kind === 'confirm') {
      Promise.resolve(options.onConfirm?.(message.plan)).then(
        allowed => worker.postMessage({ kind: 'confirm-result', id: message.id, allowed: allowed === true }),
        () => worker.postMessage({ kind: 'confirm-result', id: message.id, allowed: false }),
      )
    }
    // 网络或回复投递失败不代表 writer 死亡，退出时仍须尝试保存。
    else if (message.kind === 'fetch') void forwardFetch(message).catch(() => {})
    else if (message.kind === 'cancel-fetch') fetches.get(message.id)?.abort()
  })
  worker.on('error', error => { workerDead = true; fail(error) })
  worker.on('exit', code => { workerDead = true; if (!closed) fail(new Error(`game runtime worker exited: ${code}`)) })
  try { await ready } catch (error) { await worker.terminate(); throw error }

  async function terminate() {
    closed = true
    for (const controller of fetches.values()) controller.abort()
    fetches.clear()
    await worker.terminate()
  }

  return {
    /** @param {string} method @param {string} url @param {string | ArrayBuffer} [body] */
    handle: (method, url, body) => request('handle', [method, url, body], body instanceof ArrayBuffer ? [body] : []),
    acceptWorkEvent: event => request('acceptWorkEvent', [event]),
    metadata: () => request('metadata'),
    externalEnable: options => request('external:enable', [options]),
    externalDisable: () => request('external:disable'),
    store: { journal: { record: (...args) => { void request('record', args).catch(() => {}) } } },
    dispose() {
      if (closing) return closing
      closing = (workerDead ? Promise.resolve(false) : request('dispose').then(() => true)).catch(error => {
        // 死亡的 writer 无法补存；只释放资源，保留磁盘上的 WAL 现场。
        if (workerDead) return false
        closing = null
        throw error
      }).then(async saved => {
        await terminate()
        return { saved }
      })
      return closing
    },
  }
}
