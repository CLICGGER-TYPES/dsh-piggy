// @ts-check
/**
 * 房间生命周期：建房/加入、后台长轮询、节流上报自己的位置、关房与离开。
 * 房间只中继外观和位置；玩家的存档不离开本机。
 */
import { networkInterfaces as systemNetworkInterfaces } from 'node:os'

import { enumerateOwnerNetworkAddresses } from './owner-network-addresses.js'
import { generateRoomCode, normalizeRoomCode } from './room-code.js'
import { createRoomClient } from './room-client.js'
import { startRoomDiscovery } from './room-discovery.js'
import { startRoomServer } from './room-server.js'
import { normalizeEmote, normalizePosition, normalizeProfile, parseRoomInput } from './room-protocol.js'

const MOVE_INTERVAL_MS = 50

function messageOf(error, fallback) {
  return error instanceof Error && error.message !== '' ? error.message : fallback
}

function delay(ms) {
  return new Promise(resolve => { const timer = setTimeout(resolve, ms); timer.unref?.() })
}

/**
 * @param {{
 *   log?: (...parts:any[])=>void,
 *   networkInterfaces?: ()=>any,
 *   onUpdate?: (snapshot:any)=>void,
 *   onClosed?: (event:{reason:string})=>void,
 *   startServer?: typeof startRoomServer,
 *   startDiscovery?: typeof startRoomDiscovery,
 *   findHost?: (code:string)=>Promise<{address:string,port:number}|null>,
 *   createClient?: typeof createRoomClient,
 * }} [deps]
 */
export function createRoomManager(deps = {}) {
  const log = deps.log ?? (() => {})
  const onUpdate = deps.onUpdate ?? (() => {})
  const onClosed = deps.onClosed ?? (() => {})
  const startServer = deps.startServer ?? startRoomServer
  const startDiscovery = deps.startDiscovery ?? startRoomDiscovery
  const createClient = deps.createClient ?? createRoomClient
  const findHost = deps.findHost ?? (async code => {
    const { findRoomHost } = await import('./room-discovery.js')
    return findRoomHost(code, { interfaces: deps.networkInterfaces })
  })

  /** @type {any} */
  let session = null
  /** @type {any} */
  let snapshot = null

  function lanAddress() {
    const list = enumerateOwnerNetworkAddresses((deps.networkInterfaces ?? systemNetworkInterfaces)())
    const usable = list.filter(entry => entry.kind === 'private' || entry.kind === 'link-local')
    // 有虚拟机/容器网桥时优先物理网卡，避免房间建在别人连不进来的网段。
    const physical = usable.find(entry => !/^(?:docker|veth|virbr|br-|vmnet|vboxnet|tailscale|zt)/iu.test(entry.interface))
    return physical ?? usable[0] ?? null
  }

  function publish(body) {
    if (session === null) return
    snapshot = {
      ok: true,
      inRoom: true,
      hosting: session.role === 'host',
      code: session.code,
      selfId: session.selfId,
      version: body.version,
      room: body.room,
      players: body.players,
      careEvents: body.careEvents ?? [],
      careResults: body.careResults ?? [],
      endpoint: { address: session.address, port: session.port },
    }
    onUpdate(snapshot)
  }

  function clearTimers(current) {
    if (current.moveTimer !== null) { clearTimeout(current.moveTimer); current.moveTimer = null }
    if (current.moveBusy === true) current.moveBusy = false
  }

  function publishClosed(reason) {
    snapshot = null
    onClosed({ reason })
  }

  async function pollLoop(current, initialVersion) {
    let since = initialVersion
    let failures = 0
    while (!current.stopped) {
      let result
      try {
        result = await current.client.wait(since)
      } catch (error) {
        if (current.stopped) return
        failures += 1
        if (failures >= 3) {
          await endWith(current, 'connection-lost')
          return
        }
        log('room poll retry', messageOf(error, 'unreachable'))
        await delay(400)
        continue
      }
      if (current.stopped) return
      if (result.status === 200 && result.body?.ok === true) {
        failures = 0
        since = result.body.version
        current.version = result.body.version
        publish(result.body)
        continue
      }
      const reason = typeof result.body?.reason === 'string' ? result.body.reason : ''
      if (reason === 'room-closed' || reason === 'host-left' || result.status === 410) {
        await endWith(current, 'room-closed')
        return
      }
      failures += 1
      if (failures >= 3) {
        await endWith(current, 'connection-lost')
        return
      }
      await delay(400)
    }
  }

  /** 对端已关房或网络断开：不再向服务端发离开请求。 */
  async function endWith(current, reason) {
    if (current.stopped && session !== current) return
    current.stopped = true
    clearTimers(current)
    if (session === current) session = null
    current.discovery?.close()
    if (current.server !== null) { try { await current.server.close(reason) } catch { /* 已关闭 */ } }
    void current.client.close()
    publishClosed(reason)
  }

  function startLoop(current, body) {
    publish(body)
    void pollLoop(current, body.version)
  }

  function startMoves(current) {
    if (current.moveTimer !== null) return
    current.moveTimer = setTimeout(async () => {
      current.moveTimer = null
      if (current.stopped) return
      if (current.pendingMove !== null && current.moveBusy !== true) {
        const pending = current.pendingMove
        current.pendingMove = null
        current.moveBusy = true
        try { await current.client.update({ x: pending.x, y: pending.y, facing: pending.facing }) }
        catch { /* 下一次移动会补上最新位置 */ }
        current.moveBusy = false
      }
      if (current.pendingMove !== null) startMoves(current)
    }, MOVE_INTERVAL_MS)
    current.moveTimer.unref?.()
  }

  async function host(profile) {
    if (session !== null) return { ok: false, reason: '已经在房间里了' }
    let normalized
    try { normalized = normalizeProfile(profile) } catch (error) { return { ok: false, reason: messageOf(error, '小猪资料不完整') } }
    const lan = lanAddress()
    if (lan === null) return { ok: false, reason: '没有找到可用的局域网地址，请先连上 Wi-Fi 或网线' }
    const code = generateRoomCode()
    /** @type {any} */
    let server = null
    /** @type {any} */
    let discovery = null
    /** @type {any} */
    let client = null
    try {
      server = await startServer({ code, listenAddress: lan.address, log })
      const port = server.status().port
      discovery = await startDiscovery({ code, httpPort: port, advertisedHost: lan.address })
      client = createClient({ baseUrl: `http://${lan.address}:${port}`, code, profile: normalized })
      const joined = await client.join()
      session = {
        role: 'host', code, server, discovery, client,
        selfId: joined.playerId, version: joined.version, address: lan.address, port,
        stopped: false, moveTimer: null, moveBusy: false, pendingMove: null,
      }
      startLoop(session, joined)
      log('room hosted', code, lan.address + ':' + port)
      return { ok: true, ...snapshot }
    } catch (error) {
      try { await client?.close() } catch { /* 未加入 */ }
      discovery?.close()
      if (server !== null) { try { await server.close('failed') } catch { /* 未启动 */ } }
      const raw = messageOf(error, '创建房间失败')
      const reason = /EADDRINUSE|address already in use/i.test(raw)
        ? '本机已经有联机房间在运行，或联机端口被占用'
        : raw
      log('room host failed', raw)
      return { ok: false, reason }
    }
  }

  async function join(input, profile) {
    if (session !== null) return { ok: false, reason: '已经在房间里了' }
    const parsed = parseRoomInput(input)
    if (parsed.ok !== true) return { ok: false, reason: parsed.reason }
    let normalized
    try { normalized = normalizeProfile(profile) } catch (error) { return { ok: false, reason: messageOf(error, '小猪资料不完整') } }
    let endpoint
    if (typeof parsed.address === 'string') {
      endpoint = { address: parsed.address, port: parsed.port }
    } else {
      endpoint = await findHost(parsed.code)
      if (endpoint === null) return { ok: false, reason: '没有找到这个房间，确认在同一 Wi-Fi 下，或粘贴完整邀请串' }
    }
    const client = createClient({ baseUrl: `http://${endpoint.address}:${endpoint.port}`, code: parsed.code, profile: normalized })
    try {
      const joined = await client.join()
      session = {
        role: 'guest', code: normalizeRoomCode(parsed.code) ?? parsed.code, server: null, discovery: null, client,
        selfId: joined.playerId, version: joined.version, address: endpoint.address, port: endpoint.port,
        stopped: false, moveTimer: null, moveBusy: false, pendingMove: null,
      }
      startLoop(session, joined)
      log('room joined', parsed.code, endpoint.address + ':' + endpoint.port)
      return { ok: true, ...snapshot }
    } catch (error) {
      try { await client.close() } catch { /* 未加入 */ }
      const reason = messageOf(error, '加入房间失败')
      log('room join failed', reason)
      return { ok: false, reason }
    }
  }

  function move(x, y, facing) {
    const current = session
    if (current === null || current.stopped) return { ok: false, reason: '不在房间里' }
    let position
    try { position = normalizePosition(x, y, facing) } catch (error) { return { ok: false, reason: messageOf(error, '位置无效') } }
    current.pendingMove = position
    startMoves(current)
    return { ok: true }
  }

  async function emote(name, targetId, x, y, facing) {
    const current = session
    if (current === null || current.stopped) return { ok: false, reason: '不在房间里' }
    const emote = normalizeEmote(name)
    if (emote === '') return { ok: false, reason: '表情无效' }
    let position
    try { position = normalizePosition(x, y, facing) } catch (error) { return { ok: false, reason: messageOf(error, '位置无效') } }
    try {
      const result = await current.client.update({
        x: position.x, y: position.y, facing: position.facing, emote,
        targetId: typeof targetId === 'string' ? targetId : '',
      })
      if (result.status !== 200 || result.body?.ok !== true) return { ok: false, reason: typeof result.body?.reason === 'string' ? result.body.reason : '表情没发出去' }
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: messageOf(error, '表情没发出去') }
    }
  }

  async function care({ targetId, itemKey, op, nonce }) {
    const current = session
    if (current === null || current.stopped) return { ok: false, reason: '不在房间里' }
    try {
      const result = await current.client.care({ targetId, itemKey, op, nonce })
      if (result.status !== 200 || result.body?.ok !== true) {
        return { ok: false, reason: typeof result.body?.reason === 'string' ? result.body.reason : '照顾没发出去' }
      }
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: messageOf(error, '照顾没发出去') }
    }
  }

  async function careResult({ targetId, nonce, ok, reason = '', care = null }) {
    const current = session
    if (current === null || current.stopped) return { ok: false, reason: '不在房间里' }
    try {
      const result = await current.client.careResult({ targetId, nonce, ok, reason, care })
      if (result.status !== 200 || result.body?.ok !== true) {
        return { ok: false, reason: typeof result.body?.reason === 'string' ? result.body.reason : '照顾结果没发出去' }
      }
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: messageOf(error, '照顾结果没发出去') }
    }
  }

  async function leave(reason = 'left') {
    const current = session
    if (current === null) return { ok: true }
    session = null
    current.stopped = true
    clearTimers(current)
    if (current.role === 'host') {
      try { await current.client.leave() } catch { /* 房间已经在关 */ }
      try { await current.server.close('host-left') } catch { /* 已关闭 */ }
      current.discovery?.close()
    } else {
      try { await current.client.leave() } catch { /* 对端已断开 */ }
    }
    publishClosed(reason)
    return { ok: true }
  }

  function status() {
    if (snapshot === null) return { ok: true, inRoom: false, desktop: true }
    return { ...snapshot, ok: true }
  }

  return Object.freeze({
    host,
    join,
    move,
    emote,
    care,
    careResult,
    leave,
    status,
    dispose: () => leave('quit'),
  })
}
