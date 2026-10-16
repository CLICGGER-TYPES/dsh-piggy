// @ts-check
/** 桌面游戏 Store、路由和工作接口共用后台单写者，窗口线程不执行落盘。 */
import { parentPort, workerData } from 'node:worker_threads'
import { startHost } from './host.js'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

if (!parentPort) throw new Error('game runtime requires a parent port')
const port = parentPort
const fetches = new Map()
const tasks = new Set()
let sequence = 0
let host, endpoint
let closing = false

/** @type {typeof globalThis.fetch} */
const fetchFromMain = (input, init = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  const signal = init.signal
  if (signal?.aborted) { reject(new Error('fetch aborted')); return }
  const cancel = () => { fetches.delete(id); signal?.removeEventListener('abort', cancel); port.postMessage({ kind: 'cancel-fetch', id }); reject(new Error('fetch aborted')) }
  fetches.set(id, { resolve, reject, release: () => signal?.removeEventListener('abort', cancel) })
  signal?.addEventListener('abort', cancel, { once: true })
  const { signal: ignored, ...settings } = init
  const headers = []
  new Headers(init.headers).forEach((value, key) => headers.push([key, value]))
  port.postMessage({ kind: 'fetch', id, url: String(input), init: { ...settings, headers } })
})

async function startEndpoint() {
  if (!workerData.workEventsDirectory) return
  const { startWorkEventServer } = await import(pathToFileURL(join(workerData.gameDir, 'runtime/local-server.js')).href)
  endpoint = await startWorkEventServer({ directory: workerData.workEventsDirectory, runtime: host })
}

async function request(message) {
  if (closing) throw new Error('game runtime closed')
  if (message.method === 'dispose') {
    closing = true
    let endpointStopped = !endpoint
    try {
      await endpoint?.close()
      endpointStopped = true
      endpoint = undefined
      await Promise.allSettled([...tasks])
      await host.dispose()
    } catch (error) {
      try {
        if (endpointStopped && workerData.workEventsDirectory) {
          // HEAD 不生成快照或取走 pending；已关闭的运行时会在路由入口拒绝。
          await host.handle('HEAD', '/dsh-piggy/state')
          await startEndpoint()
        }
      } catch (recoveryError) {
        throw new AggregateError([error, recoveryError],
          `${error.message}；工作接口恢复失败：${recoveryError.message}`, { cause: error })
      } finally { closing = false }
      throw error
    }
    return
  }
  if (message.method === 'handle') {
    const out = await host.handle(...message.args)
    if (String(out.headers['content-type'] ?? '').includes('application/json')) {
      const text = String(out.body)
      const view = JSON.parse(text)
      // 这份响应已取走 pending；先广播原文，不能另取快照或合并丢掉中间消息。
      if (Array.isArray(view.pending) && view.pending.length > 0) port.postMessage({ kind: 'snapshot', value: text })
    }
    return out
  }
  if (message.method === 'acceptWorkEvent') return host.acceptWorkEvent(...message.args)
  if (message.method === 'record') return host.record(...message.args)
  throw new Error('unknown game runtime method')
}

port.on('message', message => {
  if (message.kind === 'fetch-result') {
    const task = fetches.get(message.id)
    if (!task) return
    fetches.delete(message.id)
    task.release()
    if (message.error) task.reject(new Error(message.error))
    else task.resolve(new Response([101, 204, 205, 304].includes(message.status) ? null : message.body,
      { status: message.status, headers: message.headers }))
    return
  }
  if (message.kind !== 'request') return
  const task = request(message).then(value => {
    const transfer = []
    if (message.method === 'handle' && ArrayBuffer.isView(value.body)) {
      // 只复制有效字节到独立存储，不能转移可能池化的 Buffer.buffer。
      const body = new Uint8Array(value.body.byteLength)
      body.set(new Uint8Array(value.body.buffer, value.body.byteOffset, value.body.byteLength))
      value = { ...value, body: body.buffer }
      transfer.push(body.buffer)
    }
    port.postMessage({ kind: 'response', id: message.id, value }, transfer)
  },
    error => port.postMessage({ kind: 'response', id: message.id, error: error.message }))
    .finally(() => tasks.delete(task))
  if (message.method !== 'dispose') tasks.add(task)
})

try {
  host = await startHost(workerData.gameDir, workerData.statePath, { fetch: fetchFromMain,
    onStateChanged: () => port.postMessage({ kind: 'changed' }),
  })
  await startEndpoint()
  port.postMessage({ kind: 'ready' })
} catch (error) {
  host?.dispose()
  port.postMessage({ kind: 'startup-error', error: error.message })
}
