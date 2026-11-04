// @ts-check
/** 只在显式启动后提供绑定到一只 OwnerDocument 猪的私有 LAN 会话。 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { isIP } from 'node:net'
import { join } from 'node:path'
import { createSecureContext } from 'node:tls'

import { SESSION_TRANSPORT } from './session-context.js'
import { PAIR_ACTION_SET, PAIR_COMMAND_SET, commandVerb } from './pair-actions.js'
import { isPrivateIpv4 } from './owner-lan-address.js'
import { acquireGameLock } from './owner-lock.js'
import { readWorkJson, removeWorkFile, writeWorkJson } from './work-files.js'
import { secureDirectory } from './local-server.js'
export { createOwnerLanClient } from './owner-lan-client.js'

const CLIENT_ID = /^[A-Za-z0-9_.:-]{1,80}$/u
const REQUEST_ID = /^[A-Za-z0-9_-]{8,80}$/u
const INVITE_TTL_MS = 180_000
const SESSION_IDLE_MS = 30 * 60_000
const MAX_INVITES = 32
const MAX_CLIENTS = 8
const MAX_BODY = 4096
const MAX_REPLAYS = 256
const MAX_TLS_BYTES = 1024 * 1024

function sha256(value) { return createHash('sha256').update(value).digest('hex') }

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  response.end(JSON.stringify(body))
}

function fail(status, reason, detail = {}) { return Object.assign(new Error(reason), { status, code: reason, ...detail }) }

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',')
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
    if (size > MAX_BODY) throw fail(413, 'body-too-large')
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object')
    return value
  } catch { throw fail(400, 'invalid-json') }
}

function authHeader(request) {
  const raw = request.rawHeaders
  let count = 0
  for (let index = 0; index < raw.length; index += 2) if (raw[index].toLowerCase() === 'authorization') count += 1
  if (count !== 1 || typeof request.headers.authorization !== 'string') throw fail(401, 'unauthorized')
  const match = /^Bearer ([a-f0-9]{64})$/u.exec(request.headers.authorization)
  if (match === null) throw fail(401, 'unauthorized')
  return match[1]
}

function bodyFingerprint(path, body) { return sha256(`${path}\n${JSON.stringify(body)}`) }

function normalizeTls(value) {
  if (value === undefined || value === null) return null
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      !(Buffer.isBuffer(value.key) || typeof value.key === 'string') ||
      !(Buffer.isBuffer(value.cert) || typeof value.cert === 'string')) {
    throw new Error('owner network TLS requires both a certificate and private key')
  }
  const key = Buffer.isBuffer(value.key) ? value.key : Buffer.from(value.key)
  const cert = Buffer.isBuffer(value.cert) ? value.cert : Buffer.from(value.cert)
  if (key.length === 0 || cert.length === 0 || key.length > MAX_TLS_BYTES || cert.length > MAX_TLS_BYTES) {
    throw new Error('owner network TLS materials are empty or too large')
  }
  try { createSecureContext({ key, cert }) }
  catch { throw new Error('owner network TLS certificate and key do not form a valid pair') }
  return { key, cert }
}

function validAdvertisedHost(host) {
  return (typeof host === 'string' && (isIP(host) === 4 ||
    (host.length <= 253 && /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/u.test(host) && !host.includes('..'))))
}

/**
 * @param {{runtime:any,directory:string,listenAddress?:string,advertisedHost?:string,tls?:{key:Buffer|string,cert:Buffer|string},now?:()=>number}} options
 */
export async function startOwnerLanServer(options) {
  if (options.runtime?.kind !== 'owner-document-multi-target' ||
      typeof options.runtime.openPigSession !== 'function' || typeof options.runtime.listPigTargets !== 'function') {
    throw new Error('owner LAN transport requires an explicit OwnerDocument runtime')
  }
  const listenAddress = options.listenAddress ?? '127.0.0.1'
  const tls = normalizeTls(options.tls)
  if (isIP(listenAddress) !== 4 || listenAddress === '0.0.0.0' ||
      (!isPrivateIpv4(listenAddress) && tls === null)) {
    throw new Error('owner network listener requires private IPv4 or TLS on a specific public IPv4 address')
  }
  const advertisedHost = options.advertisedHost ?? listenAddress
  if (!validAdvertisedHost(advertisedHost) || (tls === null && advertisedHost !== listenAddress)) {
    throw new Error('owner network advertised host is invalid for this listener')
  }
  const protocol = tls === null ? 'http' : 'https'
  await secureDirectory(options.directory)
  const release = acquireGameLock(join(options.directory, 'owner-lan-server'))
  const discoveryPath = join(options.directory, 'owner-lan.json')
  const now = options.now ?? Date.now
  const serverId = randomUUID()
  /** @type {Map<string,{ownerId:string,pigId:string,expiresAt:number}>} */
  const invitations = new Map()
  /** @type {Map<string,{clientId:string,ownerId:string,pigId:string,session:any,lastSeenAt:number,nextSequence:number,replays:Map<string,any>}>} */
  const clients = new Map()
  /** @type {Map<string,{token:string,clientId:string,ownerId:string,pigId:string,expiresAt:number,client:any}>} */
  const pairResponses = new Map()
  /** @type {Map<string,{windowStarted:number,count:number}>} */
  const pairAttempts = new Map()
  const requests = new Set()
  let closing = false
  let port = 0
  let closePromise
  const expectedHost = () => `${advertisedHost}:${port}`

  function checkEnvelope(request) {
    if (closing) throw fail(503, 'server-closing')
    let hostCount = 0, originCount = 0
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      const name = request.rawHeaders[index].toLowerCase()
      if (name === 'host') hostCount += 1
      if (name === 'origin') originCount += 1
    }
    if (hostCount !== 1 || request.headers.host !== expectedHost() || originCount !== 0) throw fail(403, 'forbidden')
    if (String(request.url ?? '').includes('?') || String(request.url ?? '').includes('#')) throw fail(400, 'query-not-allowed')
  }

  function inviteAttempt(request) {
    const address = request.socket.remoteAddress ?? 'unknown'
    if (pairAttempts.size >= 128 && !pairAttempts.has(address)) pairAttempts.delete(pairAttempts.keys().next().value)
    const current = pairAttempts.get(address) ?? { windowStarted: now(), count: 0 }
    if (now() - current.windowStarted > 60_000) { current.windowStarted = now(); current.count = 0 }
    current.count += 1
    pairAttempts.set(address, current)
    if (current.count > 20) throw fail(429, 'pair-rate-limited')
  }

  function findInvitation(secret) {
    const candidate = Buffer.from(sha256(secret), 'hex')
    for (const [key, value] of invitations) {
      const expected = Buffer.from(key, 'hex')
      if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
        if (value.expiresAt <= now()) { invitations.delete(key); return null }
        return { key, value }
      }
    }
    return null
  }

  function findClient(request) {
    const secret = authHeader(request)
    const candidate = Buffer.from(sha256(secret), 'hex')
    for (const [key, value] of clients) {
      const expected = Buffer.from(key, 'hex')
      if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) continue
      if (now() - value.lastSeenAt > SESSION_IDLE_MS) {
        removeClient(key, value)
        throw fail(401, 'session-expired')
      }
      value.lastSeenAt = now()
      return { key, client: value }
    }
    throw fail(401, 'unauthorized')
  }

  function removeClient(key, client) {
    client.session.dispose()
    clients.delete(key)
    for (const pairKey of client.pairKeys ?? []) pairResponses.delete(pairKey)
  }

  function pair(request, response) {
    inviteAttempt(request)
    return readJson(request).then(body => {
      if (!exactKeys(body, ['clientId', 'invite', 'nonce']) || typeof body.clientId !== 'string' || !CLIENT_ID.test(body.clientId) ||
          typeof body.invite !== 'string' || !/^[a-f0-9]{64}$/u.test(body.invite) ||
          typeof body.nonce !== 'string' || !/^[a-f0-9]{32}$/u.test(body.nonce)) throw fail(400, 'pair-shape-invalid')
      const inviteHash = sha256(body.invite)
      const pairKey = sha256(`${inviteHash}\0${body.clientId}\0${body.nonce}`)
      const previousPair = pairResponses.get(pairKey)
      if (previousPair !== undefined && previousPair.expiresAt > now()) {
        const live = clients.get(sha256(previousPair.token))
        if (live === previousPair.client) {
          return send(response, 200, { ok: true, clientToken: previousPair.token, clientId: previousPair.clientId,
            ownerId: previousPair.ownerId, pigId: previousPair.pigId, nextSequence: live.nextSequence })
        }
        pairResponses.delete(pairKey)
      }
      if (clients.size >= MAX_CLIENTS) throw fail(429, 'session-limit')
      if ([...clients.values()].some(client => client.clientId === body.clientId)) throw fail(409, 'client-already-paired')
      const found = findInvitation(body.invite)
      if (found === null) throw fail(401, 'invitation-invalid-or-expired')
      const roster = options.runtime.listPigTargets()
      if (roster.ownerId !== found.value.ownerId || !roster.pigs.some(pig => pig.pigId === found.value.pigId)) {
        invitations.delete(found.key)
        throw fail(409, 'invited-target-unavailable')
      }
      const session = options.runtime.openPigSession(found.value.pigId, {
        kind: SESSION_TRANSPORT.LAN,
        origin: body.clientId,
      })
      invitations.delete(found.key)
      const token = randomBytes(32).toString('hex')
      const client = { clientId: body.clientId, ownerId: found.value.ownerId, pigId: found.value.pigId,
        session, token, lastSeenAt: now(), nextSequence: 1, replays: new Map(), pairKeys: new Set([pairKey]),
        mutationTail: Promise.resolve() }
      clients.set(sha256(token), client)
      pairResponses.set(pairKey, { token, clientId: body.clientId, ownerId: found.value.ownerId,
        pigId: found.value.pigId, expiresAt: now() + SESSION_IDLE_MS, client })
      return send(response, 200, { ok: true, clientToken: token, clientId: body.clientId,
        ownerId: found.value.ownerId, pigId: found.value.pigId, nextSequence: 1 })
    })
  }

  function enqueueMutation(client, path, body, fingerprint) {
    const task = client.mutationTail.then(async () => {
      const cached = client.replays.get(body.requestId)
      if (cached !== undefined) {
        if (cached.sequence !== body.sequence || cached.fingerprint !== fingerprint) throw fail(409, 'request-id-conflict')
        return cached
      }
      if (body.sequence !== client.nextSequence) throw fail(409, 'sequence-gap', { nextSequence: client.nextSequence })
      let result
      if (path === '/v1/command') {
        if (typeof body.input !== 'string' || [...body.input].length > 256 || !PAIR_COMMAND_SET.has(commandVerb(body.input))) {
          throw fail(403, 'command-not-allowed')
        }
        result = await options.runtime.dispatchCommand('pig', body.input, client.session)
      } else if (path === '/v1/work') {
        result = await options.runtime.acceptWorkEvent(body.event, client.session)
      } else {
        if (typeof body.action !== 'string' || !PAIR_ACTION_SET.has(body.action)) throw fail(403, 'action-not-allowed')
        result = await options.runtime.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: body.action }), client.session)
        if (result.status !== 200) throw fail(result.status, 'action-not-applied')
        try { result = JSON.parse(String(result.body)) } catch { throw fail(503, 'action-response-invalid') }
      }
      const response = { ok: result?.kind !== 'error' && result?.ok !== false, result,
        ownerId: client.ownerId, pigId: client.pigId, nextSequence: body.sequence + 1 }
      const replay = { sequence: body.sequence, fingerprint, status: 200, response }
      client.nextSequence = body.sequence + 1
      client.replays.set(body.requestId, replay)
      if (client.replays.size > MAX_REPLAYS) client.replays.delete(client.replays.keys().next().value)
      return replay
    })
    client.mutationTail = task.then(() => undefined, () => undefined)
    return task
  }

  async function route(request, response) {
    checkEnvelope(request)
    const path = String(request.url ?? '')
    if (request.method === 'POST' && path === '/v1/pair') return pair(request, response)
    const { client } = findClient(request)
    if (request.method === 'GET' && path === '/v1/session') {
      return send(response, 200, { ok: true, ownerId: client.ownerId, pigId: client.pigId,
        nextSequence: client.nextSequence, epoch: options.runtime.epoch?.() ?? null })
    }
    if (request.method === 'GET' && path === '/v1/state') {
      const result = await options.runtime.handle('GET', '/dsh-piggy/state', undefined, client.session)
      if (result.status !== 200 || result.headers['x-dsh-owner-id'] !== client.ownerId || result.headers['x-dsh-pig-id'] !== client.pigId) {
        throw fail(409, 'session-target-mismatch')
      }
      let state
      try { state = JSON.parse(String(result.body)) } catch { throw fail(503, 'state-unavailable') }
      return send(response, 200, { ok: true, ownerId: client.ownerId, pigId: client.pigId,
        epoch: options.runtime.epoch?.() ?? null, state })
    }
    if (request.method === 'POST' && (path === '/v1/command' || path === '/v1/action' || path === '/v1/work')) {
      const body = await readJson(request)
      const expectedKeys = path === '/v1/command' ? ['input', 'requestId', 'sequence'] :
        path === '/v1/action' ? ['action', 'requestId', 'sequence'] : ['event', 'requestId', 'sequence']
      if (!exactKeys(body, expectedKeys) || !Number.isSafeInteger(body.sequence) || body.sequence < 1 ||
          typeof body.requestId !== 'string' || !REQUEST_ID.test(body.requestId)) throw fail(400, 'request-shape-invalid')
      const fingerprint = bodyFingerprint(path, body)
      const reply = await enqueueMutation(client, path, body, fingerprint)
      return send(response, reply.status, reply.response)
    }
    if (request.method === 'POST' && path === '/v1/session/close') {
      if (!exactKeys(await readJson(request), [])) throw fail(400, 'request-shape-invalid')
      for (const [key, value] of clients) if (value === client) removeClient(key, client)
      return send(response, 200, { ok: true })
    }
    throw fail(404, 'not-found')
  }

  const handleRequest = (request, response) => {
    const task = Promise.resolve().then(() => route(request, response)).catch(error => {
      if (!response.headersSent && !response.destroyed) send(response, error?.status ?? 500,
        { ok: false, reason: error?.code ?? 'server-error', ...(Number.isSafeInteger(error?.nextSequence) ? { nextSequence: error.nextSequence } : {}) })
      request.resume()
    }).finally(() => requests.delete(task))
    requests.add(task)
  }
  const server = tls === null
    ? createHttpServer({ maxHeaderSize: 16 * 1024 }, handleRequest)
    : createHttpsServer({ ...tls, maxHeaderSize: 16 * 1024 }, handleRequest)
  server.requestTimeout = 10_000
  server.headersTimeout = 10_000
  server.timeout = 10_000
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, listenAddress, () => { server.off('error', reject); resolve(undefined) })
    })
  } catch (error) { release(); throw error }
  const address = server.address()
  if (!address || typeof address === 'string') { release(); throw new Error('owner LAN listener has no IPv4 address') }
  port = address.port
  try {
    writeWorkJson(discoveryPath, { version: 1, role: 'piggy-owner-lan', host: listenAddress,
      advertisedHost, protocol, port, pid: process.pid, serverId })
  } catch (error) {
    await new Promise(resolve => server.close(resolve)); release(); throw error
  }
  let listenerStopped = false
  return Object.freeze({
    status() { return { running: !closing, host: advertisedHost, listenAddress, protocol, port, pairedClients: clients.size } },
    createInvitation(pigId) {
      if (closing) throw new Error('owner LAN server is closing')
      for (const [key, invite] of invitations) if (invite.expiresAt <= now()) invitations.delete(key)
      if (invitations.size >= MAX_INVITES) throw new Error('owner LAN invitation limit reached')
      if (typeof pigId !== 'string') throw new TypeError('pigId is required')
      const roster = options.runtime.listPigTargets()
      if (!roster.pigs.some(pig => pig.pigId === pigId)) throw fail(404, 'pig-target-not-found')
      const invitation = randomBytes(32).toString('hex')
      const expiresAt = now() + INVITE_TTL_MS
      invitations.set(sha256(invitation), { ownerId: roster.ownerId, pigId, expiresAt })
      return { invitation, ownerId: roster.ownerId, pigId, expiresAt, host: advertisedHost, protocol, port }
    },
    close() {
      if (closePromise !== undefined) return closePromise
      closing = true
      invitations.clear()
      closePromise = (async () => {
        if (!listenerStopped) {
          const stopped = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve(undefined)))
          server.closeIdleConnections()
          await stopped
          listenerStopped = true
        }
        await Promise.allSettled([...requests])
        for (const [key, client] of clients) removeClient(key, client)
        clients.clear()
        pairResponses.clear()
        const marker = readWorkJson(discoveryPath)
        if (marker?.serverId === serverId) removeWorkFile(discoveryPath)
        release()
      })().catch(error => { closePromise = undefined; throw error })
      return closePromise
    },
  })
}
