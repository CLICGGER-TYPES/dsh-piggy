// @ts-check
/** 桌面游戏 Store、路由和工作接口共用后台单写者，窗口线程不执行落盘。 */
import { parentPort, workerData } from 'node:worker_threads'
import { randomBytes } from 'node:crypto'
import { startHost } from './host.js'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { createInstallerExtensions } from './optional-extensions.js'

if (!parentPort) throw new Error('game runtime requires a parent port')
const port = parentPort
const fetches = new Map()
const tasks = new Set()
/** @type {Map<string, any>} token -> owner session binding */
const sessions = new Map()
let sequence = 0
let host, endpoint, pairServer, ownerLanServer, ownerLanClient
let ownerLanClientPeer = null
let ownerLanClientStateAt = 0
let ownerLanClientFactory
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
  if (host?.kind === 'owner-document-multi-target') {
    throw new Error('owner-document opt-in does not support external-pair networking')
  }
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

async function startOwnerLan(options = {}) {
  if (host?.kind !== 'owner-document-multi-target' || typeof host.openPigSession !== 'function') {
    throw new Error('owner LAN sessions require an explicit OwnerDocument runtime')
  }
  if (ownerLanServer !== undefined) return ownerLanServer.status()
  if (typeof workerData.ownerNetworkDirectory !== 'string' || workerData.ownerNetworkDirectory === '') {
    throw new Error('owner LAN session directory is unavailable')
  }
  const { startOwnerLanServer } = await import(pathToFileURL(join(workerData.gameDir, 'runtime/owner-lan-server.js')).href)
  const { readOwnerNetworkTls } = await import(pathToFileURL(join(workerData.gameDir, 'runtime/owner-network-tls.js')).href)
  const tls = await readOwnerNetworkTls(workerData.ownerNetworkDirectory)
  ownerLanServer = await startOwnerLanServer({ runtime: host, directory: workerData.ownerNetworkDirectory,
    ...(typeof options.listenAddress === 'string' && options.listenAddress !== '' ? { listenAddress: options.listenAddress } : {}),
    ...(typeof options.advertisedHost === 'string' && options.advertisedHost !== '' ? { advertisedHost: options.advertisedHost } : {}),
    ...(tls === null ? {} : { tls }) })
  return ownerLanServer.status()
}

/** 加入侧：只保留只读客户端；token 只在 client 闭包里，不跨线程返回。 */
async function loadOwnerLanClient() {
  if (ownerLanClientFactory === undefined) {
    const loading = import(pathToFileURL(join(workerData.gameDir, 'runtime/owner-lan-client.js')).href)
      .then(module => module.createOwnerLanClient)
    ownerLanClientFactory = loading
    loading.catch(() => { if (ownerLanClientFactory === loading) ownerLanClientFactory = undefined })
  }
  return ownerLanClientFactory
}

function ownerLanPeer(body) {
  const pig = body?.state?.pig
  return {
    ownerId: typeof body?.ownerId === 'string' ? body.ownerId : '',
    pigId: typeof body?.pigId === 'string' ? body.pigId : '',
    name: typeof pig?.name === 'string' ? pig.name : '',
    stage: typeof pig?.stage === 'string' ? pig.stage : '',
    hatched: body?.state?.hatched === true,
  }
}

async function joinOwnerLanClient(options = {}) {
  if (ownerLanClient !== undefined) throw new Error('owner LAN client is already paired')
  const baseUrl = typeof options.baseUrl === 'string' ? options.baseUrl : ''
  const invitation = typeof options.invitation === 'string' ? options.invitation : ''
  if (baseUrl === '' || invitation === '') throw new Error('owner LAN join requires an endpoint and an invitation')
  const createOwnerLanClient = await loadOwnerLanClient()
  const client = createOwnerLanClient({ baseUrl })
  try {
    const paired = await client.pair(invitation)
    const result = await client.state()
    if (result.status !== 200) throw new Error(result.body?.reason ?? 'owner-lan-state-unavailable')
    ownerLanClient = client
    ownerLanClientPeer = ownerLanPeer({ ...result.body, ownerId: paired.ownerId, pigId: paired.pigId })
    ownerLanClientStateAt = Date.now()
    return { joining: true, connected: true, peer: ownerLanClientPeer }
  } catch (error) {
    try { await client.close() } catch { /* 未配对或对端已断开，本地引用直接丢弃 */ }
    throw error
  }
}

async function ownerLanClientStatus() {
  if (ownerLanClient === undefined) return { joining: false }
  // 面板每 4 秒重绘一次；8 秒内只回缓存，避免把对端打满。
  if (Date.now() - ownerLanClientStateAt < 8_000) return { joining: true, connected: true, peer: ownerLanClientPeer }
  let result
  try {
    result = await ownerLanClient.state()
  } catch {
    return { joining: true, connected: false, peer: ownerLanClientPeer, reason: 'unreachable' }
  }
  if (result.status === 401) {
    const reason = typeof result.body?.reason === 'string' ? result.body.reason : 'session-expired'
    // 服务端已判定会话失效，不必再发一次 close 请求。
    await leaveOwnerLanClient(false)
    return { joining: false, reason }
  }
  if (result.status !== 200) return { joining: true, connected: true, peer: ownerLanClientPeer }
  ownerLanClientPeer = ownerLanPeer(result.body)
  ownerLanClientStateAt = Date.now()
  return { joining: true, connected: true, peer: ownerLanClientPeer }
}

async function leaveOwnerLanClient(notify = true) {
  const client = ownerLanClient
  ownerLanClient = undefined
  ownerLanClientPeer = null
  ownerLanClientStateAt = 0
  if (client === undefined) return { joining: false }
  if (notify) {
    try { await client.close() } catch { /* 对端不可达也要清掉本地 token */ }
  }
  return { joining: false }
}

function newSessionToken() {
  for (;;) {
    const token = randomBytes(32).toString('base64url')
    if (!sessions.has(token)) return token
  }
}

/** @param {unknown} token */
function bindSession(token) {
  if (typeof token !== 'string' || token === '') throw new Error('game session token is invalid')
  const session = sessions.get(token)
  if (session === undefined) throw new Error('unknown or closed game session')
  return session
}

async function request(message) {
  if (closing) throw new Error('game runtime closed')
  if (message.method === 'dispose') {
    closing = true
    // Map 只保存派发给窗口的 token；绑定本身仍由 host.dispose() 统一处置。
    sessions.clear()
    let endpointStopped = !endpoint
    try {
      await ownerLanServer?.close()
      ownerLanServer = undefined
      await leaveOwnerLanClient()
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
    const token = message.args[3]
    const session = token === undefined || token === null ? undefined : bindSession(token)
    const out = await host.handle(message.args[0], message.args[1], message.args[2], session)
    let hatched
    if (String(out.headers['content-type'] ?? '').includes('application/json')) {
      const text = String(out.body)
      const view = JSON.parse(text)
      if (typeof view.hatched === 'boolean') hatched = view.hatched
      // 这份响应已取走 pending；先广播原文，不能另取快照或合并丢掉中间消息。
      // token 决定快照属于哪个窗口；无 token 的默认会话用 null，保持旧行为。
      if (Array.isArray(view.pending) && view.pending.length > 0) {
        port.postMessage({ kind: 'snapshot', value: text, session: token ?? null })
      }
    }
    if (message.args[0] === 'POST' && out.status === 200) {
      const addons = await installerExtensions?.apply(hatched)
      if (addons?.changed) port.postMessage({ kind: 'changed' })
    }
    return out
  }
  if (message.method === 'open-session') {
    if (typeof host?.openPigSession !== 'function') throw new Error('当前游戏版本不支持多猪会话')
    const pigId = message.args[0]
    if (typeof pigId !== 'string' || pigId === '') throw new Error('open-session requires an explicit pigId')
    const session = host.openPigSession(pigId, { kind: 'embedded', origin: 'desktop-window' })
    const token = newSessionToken()
    sessions.set(token, session)
    return { token, pigId }
  }
  if (message.method === 'close-session') {
    const session = bindSession(message.args[0])
    sessions.delete(message.args[0])
    session.dispose()
    return { ok: true }
  }
  if (message.method === 'acceptWorkEvent') return host.acceptWorkEvent(...message.args)
  if (message.method === 'work-event-sources') {
    if (typeof host?.workEventSources !== 'function') return { ok: false, sources: [] }
    return { ok: true, sources: host.workEventSources() }
  }
  if (message.method === 'record') return host.record(...message.args)
  if (message.method === 'owner:list-pigs') {
    if (typeof host?.listPigTargets !== 'function') throw new Error('当前游戏版本不支持多猪管理')
    return host.listPigTargets()
  }
  if (message.method === 'owner:create-pig') {
    if (typeof host?.createPigTarget !== 'function') throw new Error('当前游戏版本不支持新增小猪')
    return host.createPigTarget(...message.args)
  }
  if (message.method === 'owner-lan:status') return ownerLanServer?.status() ?? { running: false, pairedClients: 0 }
  if (message.method === 'owner-lan:start') return startOwnerLan(message.args[0] ?? {})
  if (message.method === 'owner-lan:invite') {
    if (ownerLanServer === undefined) throw new Error('owner LAN listener is not running')
    return ownerLanServer.createInvitation(message.args[0])
  }
  if (message.method === 'owner-lan:stop') {
    const current = ownerLanServer
    ownerLanServer = undefined
    await current?.close()
    return { running: false, pairedClients: 0 }
  }
  if (message.method === 'owner-lan-client:join') return joinOwnerLanClient(message.args[0] ?? {})
  if (message.method === 'owner-lan-client:status') return ownerLanClientStatus()
  if (message.method === 'owner-lan-client:leave') return leaveOwnerLanClient()
  if (message.method === 'external:enable') return externalEnable(message.args[0] ?? {})
  if (message.method === 'external:disable') return externalDisable()
  if (message.method === 'cloud:first-sync') return typeof host.firstSyncCloud === 'function'
    ? host.firstSyncCloud(message.args[0]) : { ok: false, reason: '当前存档模式不支持完整档首次同步' }
  if (message.method === 'cloud:owner-history') return typeof host.ownerCloudHistory === 'function'
    ? host.ownerCloudHistory(message.args[0]) : { ok: false, reason: '当前存档模式没有完整档云端历史' }
  if (message.method === 'cloud:owner-status') return typeof host.ownerCloudStatus === 'function'
    ? host.ownerCloudStatus() : { enabled: false, ready: false, branch: 'main' }
  if (message.method === 'cloud:configure') return typeof host.configureCloudSave === 'function'
    ? host.configureCloudSave(message.args[0]) : { ok: false, reason: '当前游戏包不支持云存档设置' }
  if (message.method === 'cloud:test') return typeof host.testCloudSave === 'function'
    ? host.testCloudSave(message.args[0]) : { ok: false, reason: '当前游戏包不支持云存档设置' }
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
    cloudSave: workerData.cloudSave ?? null,
    ownerDocument: workerData.ownerDocument ?? undefined,
    onStateChanged: () => port.postMessage({ kind: 'changed' }),
  })
  // Installer selections inspect the legacy v15 `hatched` field before choosing
  // when to import. An OwnerDocument envelope is not that flat state; defer this
  // importer until extension ownership is explicitly adapted to owner/pig targets.
  if (workerData.ownerDocument === null) {
    installerExtensions = createInstallerExtensions({ directory: workerData.optionalExtensionsDirectory, statePath: workerData.statePath, host,
      onSnapshot: value => port.postMessage({ kind: 'snapshot', value, session: null }) })
    await installerExtensions.apply()
  }
  if (workerData.workEventsDirectory && workerData.workEventsAutoStart !== false) await startEndpoint()
  port.postMessage({ kind: 'ready' })
} catch (error) {
  let message = error.message
  try { await host?.dispose() } catch (cleanupError) { message += `；启动清理失败：${cleanupError.message}` }
  port.postMessage({ kind: 'startup-error', error: message })
}
