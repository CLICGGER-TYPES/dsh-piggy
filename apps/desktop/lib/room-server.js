// @ts-check
/**
 * 内存房间中继：只保存玩家外观、位置和表情，不读写任何存档。
 * 主机进程持有一份；房间关闭即全部丢弃。
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { isIP } from 'node:net'

import { ownerNetworkAddressKind } from './owner-network-addresses.js'
import { normalizeRoomCode } from './room-code.js'
import {
  ROOM_IDLE_MS, ROOM_MAX_BODY, ROOM_MAX_PLAYERS, ROOM_STATE_HOLD_MS,
  normalizeClientId, normalizeEmote, normalizePosition, normalizeProfile, publicPlayer,
} from './room-protocol.js'

const MAX_JOIN_WINDOW_MS = 60_000
const MAX_JOIN_ATTEMPTS = 20

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function send(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

function fail(status, reason) {
  return Object.assign(new Error(reason), { status, code: reason })
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',')
}

/** 新玩家先站中间，之后左右交替排开，避免所有猪叠在同一个点。 */
function spawnX(index) {
  if (index === 0) return 0.5
  const side = index % 2 === 1 ? 1 : -1
  const step = Math.ceil(index / 2)
  return Math.round(Math.min(0.92, Math.max(0.08, 0.5 + side * step * 0.16)) * 1000) / 1000
}

async function readJson(request) {
  let contentTypes = 0
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index].toLowerCase() === 'content-type') contentTypes += 1
  }
  if (contentTypes !== 1) throw fail(415, 'json-required')
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers['content-type'] ?? '')) throw fail(415, 'json-required')
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > ROOM_MAX_BODY) throw fail(413, 'body-too-large')
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object')
    return value
  } catch { throw fail(400, 'invalid-json') }
}

function authToken(request) {
  const raw = request.rawHeaders
  let count = 0
  for (let index = 0; index < raw.length; index += 2) if (raw[index].toLowerCase() === 'authorization') count += 1
  if (count !== 1 || typeof request.headers.authorization !== 'string') throw fail(401, 'unauthorized')
  const match = /^Bearer ([a-f0-9]{64})$/u.exec(request.headers.authorization)
  if (match === null) throw fail(401, 'unauthorized')
  return match[1]
}

/**
 * @param {{code:string,listenAddress:string,advertisedHost?:string,now?:()=>number,log?:(...parts:any[])=>void}} options
 */
export async function startRoomServer(options) {
  const code = normalizeRoomCode(options.code)
  if (code === null) throw new Error('room code is invalid')
  const listenAddress = options.listenAddress
  const kind = ownerNetworkAddressKind(listenAddress)
  if (isIP(listenAddress) !== 4 || (kind !== 'loopback' && kind !== 'private' && kind !== 'link-local')) {
    throw new Error('room listener requires a private IPv4 address')
  }
  const advertisedHost = options.advertisedHost ?? listenAddress
  if (isIP(advertisedHost) !== 4) throw new Error('room advertised host must be an IPv4 address')

  const now = options.now ?? Date.now
  const log = options.log ?? (() => {})
  const codeHash = Buffer.from(sha256(code), 'hex')
  /** @type {Map<string, any>} */
  const players = new Map()
  /** @type {Set<any>} */
  const polls = new Set()
  /** @type {Map<string,{windowStarted:number,count:number}>} */
  const joinAttempts = new Map()
  const requests = new Set()
  let closing = false
  let closeReason = 'closed'
  let closePromise
  let port = 0
  let version = 1
  let hostId = null
  let notifyTimer = null
  let sweeper = null

  const expectedHosts = () => [`${advertisedHost}:${port}`, `127.0.0.1:${port}`]

  function checkEnvelope(request) {
    if (closing) throw fail(503, 'room-closed')
    let hostCount = 0
    let originCount = 0
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      const name = request.rawHeaders[index].toLowerCase()
      if (name === 'host') hostCount += 1
      if (name === 'origin') originCount += 1
    }
    const hosts = expectedHosts()
    if (hostCount !== 1 || !hosts.includes(String(request.headers.host ?? '')) || originCount !== 0) throw fail(403, 'forbidden')
    const url = String(request.url ?? '')
    if (url.includes('?') || url.includes('#')) throw fail(400, 'query-not-allowed')
  }

  function checkJoinRate(request) {
    const address = request.socket.remoteAddress ?? 'unknown'
    if (joinAttempts.size >= 128 && !joinAttempts.has(address)) joinAttempts.delete(joinAttempts.keys().next().value)
    const current = joinAttempts.get(address) ?? { windowStarted: now(), count: 0 }
    if (now() - current.windowStarted > MAX_JOIN_WINDOW_MS) { current.windowStarted = now(); current.count = 0 }
    current.count += 1
    joinAttempts.set(address, current)
    if (current.count > MAX_JOIN_ATTEMPTS) throw fail(429, 'join-rate-limited')
  }

  function findPlayer(request) {
    const token = authToken(request)
    const key = sha256(token)
    const player = players.get(key)
    if (player === undefined) throw fail(401, 'unauthorized')
    if (now() - player.lastSeenAt > ROOM_IDLE_MS) {
      const removed = removePlayer(key, 'idle')
      if (removed.host) void close('host-left')
      throw fail(401, 'session-expired')
    }
    player.lastSeenAt = now()
    return { key, player }
  }

  function view() {
    return { code, version, hostId }
  }

  function body() {
    return {
      ok: true,
      version,
      room: view(),
      players: [...players.values()]
        .sort((left, right) => left.joinedAt - right.joinedAt)
        .map(publicPlayer),
    }
  }

  function bump() {
    version += 1
    if (notifyTimer !== null) return
    notifyTimer = setTimeout(() => {
      notifyTimer = null
      flushPolls()
    }, 40)
    notifyTimer.unref?.()
  }

  function flushPolls() {
    if (polls.size === 0) return
    const payload = closing
      ? { ok: false, reason: closeReason }
      : body()
    for (const poll of [...polls]) {
      if (!closing && poll.since === payload.version) continue
      clearTimeout(poll.timer)
      polls.delete(poll)
      if (!poll.response.headersSent && !poll.response.destroyed) send(poll.response, closing ? 410 : 200, payload)
    }
  }

  function removePlayer(key, reason) {
    const player = players.get(key)
    if (player === undefined) return { removed: false, host: false }
    players.delete(key)
    const host = player.id === hostId
    if (host) hostId = null
    else bump()
    log('room player left', reason)
    return { removed: true, host }
  }

  function join(request, response) {
    checkJoinRate(request)
    return readJson(request).then(input => {
      if (!exactKeys(input, ['clientId', 'code', 'profile'])) throw fail(400, 'join-shape-invalid')
      const clientId = normalizeClientId(input.clientId)
      if (clientId === null) throw fail(400, 'client-id-invalid')
      const candidate = normalizeRoomCode(input.code)
      if (candidate === null) throw fail(401, 'room-code-invalid')
      const provided = Buffer.from(sha256(candidate), 'hex')
      if (provided.length !== codeHash.length || !timingSafeEqual(provided, codeHash)) throw fail(401, 'room-code-invalid')
      const profile = normalizeProfile(input.profile)
      if (players.size >= ROOM_MAX_PLAYERS) throw fail(429, 'room-full')
      if ([...players.values()].some(player => player.clientId === clientId)) throw fail(409, 'client-already-joined')
      const id = randomUUID()
      const token = randomBytes(32).toString('hex')
      const player = {
        id, clientId, token, ...profile,
        x: spawnX(players.size),
        row: players.size % 3,
        facing: 1,
        emote: '', emoteTarget: null, emoteAt: 0,
        host: players.size === 0,
        joinedAt: now(), lastSeenAt: now(), rev: 0,
      }
      if (player.host) hostId = id
      players.set(sha256(token), player)
      bump()
      return send(response, 200, { ok: true, token, playerId: id, ...body() })
    })
  }

  function state(request, response) {
    const { player } = findPlayer(request)
    return readJson(request).then(input => {
      if (!exactKeys(input, ['since'])) throw fail(400, 'state-shape-invalid')
      if (!Number.isSafeInteger(input.since) || input.since < 0) throw fail(400, 'state-shape-invalid')
      if (input.since !== version) return send(response, 200, body())
      const poll = { player, since: input.since, response, timer: null }
      poll.timer = setTimeout(() => {
        polls.delete(poll)
        if (!response.headersSent && !response.destroyed) send(response, 200, body())
      }, ROOM_STATE_HOLD_MS)
      poll.timer.unref?.()
      polls.add(poll)
      response.once('close', () => {
        polls.delete(poll)
        clearTimeout(poll.timer)
      })
      return undefined
    })
  }

  function update(request, response) {
    const { player } = findPlayer(request)
    return readJson(request).then(input => {
      if (!exactKeys(input, ['rev', 'x', 'facing', 'emote', 'targetId'])) throw fail(400, 'update-shape-invalid')
      if (!Number.isSafeInteger(input.rev) || input.rev < 0) throw fail(400, 'update-shape-invalid')
      if (input.rev <= player.rev) return send(response, 200, { ok: true, version })
      const position = normalizePosition(input.x, input.facing)
      const emote = normalizeEmote(input.emote)
      const targetId = typeof input.targetId === 'string' ? input.targetId : ''
      if (emote !== '' && targetId !== '' && ![...players.values()].some(candidate => candidate.id === targetId)) {
        throw fail(400, 'emote-target-invalid')
      }
      const changed = Math.abs(position.x - player.x) > 0.0005 || position.facing !== player.facing ||
        emote !== '' || player.emote !== ''
      player.rev = input.rev
      player.x = position.x
      player.facing = position.facing
      if (emote !== '') {
        player.emote = emote
        player.emoteTarget = targetId === '' ? player.id : targetId
        player.emoteAt = now()
      } else if (player.emote !== '') {
        player.emote = ''
        player.emoteTarget = null
        player.emoteAt = 0
      }
      if (changed) bump()
      return send(response, 200, { ok: true, version })
    })
  }

  function leave(request, response) {
    const { key } = findPlayer(request)
    return readJson(request).then(input => {
      if (!exactKeys(input, [])) throw fail(400, 'leave-shape-invalid')
      const removed = removePlayer(key, 'left')
      send(response, 200, { ok: true })
      if (removed.host) setImmediate(() => { void close('host-left') })
      return undefined
    })
  }

  async function route(request, response) {
    checkEnvelope(request)
    const path = String(request.url ?? '')
    if (request.method === 'POST' && path === '/v1/room/join') return join(request, response)
    if (request.method === 'POST' && path === '/v1/room/state') return state(request, response)
    if (request.method === 'POST' && path === '/v1/room/update') return update(request, response)
    if (request.method === 'POST' && path === '/v1/room/leave') return leave(request, response)
    throw fail(404, 'not-found')
  }

  const handleRequest = (request, response) => {
    const task = Promise.resolve().then(() => route(request, response)).catch(error => {
      if (!response.headersSent && !response.destroyed) {
        send(response, error?.status ?? 500, { ok: false, reason: error?.code ?? 'server-error' })
      }
      request.resume()
    }).finally(() => requests.delete(task))
    requests.add(task)
  }

  const server = createServer({ maxHeaderSize: 16 * 1024 }, handleRequest)
  server.requestTimeout = 20_000
  server.headersTimeout = 20_000
  server.timeout = 20_000
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, listenAddress, () => { server.off('error', reject); resolve(undefined) })
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('room listener has no IPv4 address')
  }
  port = address.port

  sweeper = setInterval(() => {
    const cutoff = now() - ROOM_IDLE_MS
    for (const [key, player] of players) {
      if (player.lastSeenAt >= cutoff) continue
      const removed = removePlayer(key, 'idle')
      if (removed.host) void close('host-left')
    }
  }, 5_000)
  sweeper.unref?.()

  function close(reason = 'closed') {
    if (closePromise !== undefined) return closePromise
    closing = true
    closeReason = reason
    if (notifyTimer !== null) { clearTimeout(notifyTimer); notifyTimer = null }
    if (sweeper !== null) { clearInterval(sweeper); sweeper = null }
    closePromise = (async () => {
      flushPolls()
      const stopped = new Promise(resolve => server.close(() => resolve(undefined)))
      server.closeAllConnections?.()
      await stopped
      await Promise.allSettled([...requests])
      players.clear()
      joinAttempts.clear()
    })().catch(error => { closePromise = undefined; throw error })
    return closePromise
  }

  return Object.freeze({
    status() {
      return { running: !closing, host: advertisedHost, listenAddress, port, code, players: players.size, reason: closing ? closeReason : '' }
    },
    close,
    /** 只给测试和本机窗口读；不含 token。 */
    snapshot: body,
  })
}
