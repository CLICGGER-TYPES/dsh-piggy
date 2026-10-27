// @ts-check
/** 桌面游戏 Store、路由和工作接口共用后台单写者，窗口线程不执行落盘。 */
import { parentPort, workerData } from 'node:worker_threads'
import { startHost } from './host.js'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { createInstallerExtensions } from './optional-extensions.js'

if (!parentPort) throw new Error('game runtime requires a parent port')
const port = parentPort
const fetches = new Map()
const tasks = new Set()
let sequence = 0
let host, endpoint, pairServer
let closing = false
const confirmations = new Map()
let confirmSequence = 0
let gameMetadata = null
let installerExtensions

function metadata() {
  gameMetadata ??= Promise.all([
    readFile(join(workerData.gameDir, 'package.json'), 'utf8'),
    import(pathToFileURL(join(workerData.gameDir, 'packages/pet-core/src/core/constants.js')).href),
  ]).then(([text, core]) => {
    const version = JSON.parse(text).version
    if (typeof version !== 'string' || version.trim() === '') throw new Error('game metadata has no version')
    return { gameVersion: version, stateVersion: core.STATE_VERSION }
  })
  return gameMetadata
}

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

async function startEndpoint(directory = workerData.workEventsDirectory) {
  if (!directory || endpoint) return endpoint
  const { startWorkEventServer } = await import(pathToFileURL(join(workerData.gameDir, 'runtime/local-server.js')).href)
  endpoint = await startWorkEventServer({ directory, runtime: host })
  return endpoint
}

async function stopEndpoint() {
  const current = endpoint
  endpoint = undefined
  await current?.close()
}

function confirmInMain(plan) {
  return new Promise(resolve => {
    const id = ++confirmSequence
    const timer = setTimeout(() => { confirmations.delete(id); resolve(false) }, 65_000)
    timer.unref?.()
    confirmations.set(id, allowed => { clearTimeout(timer); confirmations.delete(id); resolve(allowed === true) })
    port.postMessage({ kind: 'confirm', id, plan })
  })
}

async function externalEnable(message) {
  const directory = typeof message.directory === 'string' && message.directory !== '' ? message.directory : workerData.workEventsDirectory
  if (!directory) throw new Error('external mode needs a work endpoint directory')
  const info = await metadata()
  const existingWork = endpoint !== undefined
  try {
    await startEndpoint(directory)
    if (pairServer === undefined) {
      const { startPairServer } = await import(pathToFileURL(join(workerData.gameDir, 'runtime/pair-server.js')).href)
      pairServer = await startPairServer({ runtime: host, directory, appVersion: message.appVersion ?? '',
        gameVersion: info.gameVersion, confirm: confirmInMain })
    }
  } catch (error) {
    if (!existingWork) await stopEndpoint()
    throw error
  }
  return { ok: true, port: pairServer.port, ...info, workDirectory: directory }
}

async function externalDisable() {
  const current = pairServer
  pairServer = undefined
  await current?.close()
  await stopEndpoint()
  return { ok: true }
}

async function request(message) {
  if (closing) throw new Error('game runtime closed')
  if (message.method === 'dispose') {
    closing = true
    let endpointStopped = !endpoint
    try {
      await pairServer?.close()
      pairServer = undefined
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
    let hatched
    if (String(out.headers['content-type'] ?? '').includes('application/json')) {
      const text = String(out.body)
      const view = JSON.parse(text)
      if (typeof view.hatched === 'boolean') hatched = view.hatched
      // 这份响应已取走 pending；先广播原文，不能另取快照或合并丢掉中间消息。
      if (Array.isArray(view.pending) && view.pending.length > 0) port.postMessage({ kind: 'snapshot', value: text })
    }
    if (message.args[0] === 'POST' && out.status === 200) {
      const addons = await installerExtensions?.apply(hatched)
      if (addons?.changed) port.postMessage({ kind: 'changed' })
    }
    return out
  }
  if (message.method === 'acceptWorkEvent') return host.acceptWorkEvent(...message.args)
  if (message.method === 'record') return host.record(...message.args)
  if (message.method === 'external:enable') return externalEnable(message.args[0] ?? {})
  if (message.method === 'external:disable') return externalDisable()
  if (message.method === 'metadata') {
    return metadata()
  }
  throw new Error('unknown game runtime method')
}

port.on('message', message => {
  if (message.kind === 'confirm-result') {
    const resolve = confirmations.get(message.id)
    if (resolve !== undefined) resolve(message.allowed === true)
    return
  }
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
  installerExtensions = createInstallerExtensions({ directory: workerData.optionalExtensionsDirectory, statePath: workerData.statePath, host,
    onSnapshot: value => port.postMessage({ kind: 'snapshot', value }) })
  await installerExtensions.apply()
  if (workerData.workEventsDirectory && workerData.workEventsAutoStart !== false) await startEndpoint()
  port.postMessage({ kind: 'ready' })
} catch (error) {
  let message = error.message
  try { await host?.dispose() } catch (cleanupError) { message += `；启动清理失败：${cleanupError.message}` }
  port.postMessage({ kind: 'startup-error', error: message })
}
