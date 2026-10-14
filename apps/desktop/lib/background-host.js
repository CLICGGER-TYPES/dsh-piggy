// @ts-check
/** 桌面外壳只保留异步代理；扩展下载仍由 Chromium 网络栈执行。 */
import { Worker } from 'node:worker_threads'

export async function startBackgroundHost(gameDir, statePath, options = {}) {
  const worker = new Worker(new URL('./runtime-worker.js', import.meta.url), {
    workerData: { gameDir, statePath, workEventsDirectory: options.workEventsDirectory },
  })
  const pending = new Map()
  const fetches = new Map()
  let sequence = 0
  let closing, failure
  let closed = false
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

  function request(method, args = []) {
    if (failure) return Promise.reject(failure)
    if (closed || (closing && method !== 'dispose')) return Promise.reject(new Error('game runtime closed'))
    return new Promise((resolve, reject) => {
      const id = ++sequence
      pending.set(id, { resolve, reject })
      try { worker.postMessage({ kind: 'request', id, method, args }) }
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
    else if (message.kind === 'fetch') void forwardFetch(message).catch(error => fail(error))
    else if (message.kind === 'cancel-fetch') fetches.get(message.id)?.abort()
  })
  worker.on('error', fail)
  worker.on('exit', code => { if (!closed) fail(new Error(`game runtime worker exited: ${code}`)) })
  try { await ready } catch (error) { await worker.terminate(); throw error }

  return {
    handle: (method, url, body) => request('handle', [method, url, body]),
    acceptWorkEvent: event => request('acceptWorkEvent', [event]),
    store: { journal: { record: (...args) => { void request('record', args).catch(() => {}) } } },
    dispose() {
      if (closing) return closing
      closing = request('dispose').then(async () => {
        closed = true
        for (const controller of fetches.values()) controller.abort()
        await worker.terminate()
      }).catch(error => { closing = null; throw error })
      return closing
    },
  }
}
