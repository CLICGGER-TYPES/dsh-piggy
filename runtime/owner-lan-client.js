// @ts-check
/** 绑定单一猪会话的最小 HTTP 客户端，保留明确重连与幂等重试。 */
import { randomBytes, randomUUID } from 'node:crypto'

import { isPrivateIpv4 } from './owner-lan-address.js'

const CLIENT_ID = /^[A-Za-z0-9_.:-]{1,80}$/u

/** @param {{baseUrl:string,clientId?:string,fetch?:typeof globalThis.fetch}} options */
export function createOwnerLanClient({ baseUrl, clientId = randomUUID(), fetch = globalThis.fetch }) {
  const base = new URL(baseUrl)
  if (base.protocol !== 'http:' || base.username !== '' || base.password !== '' || base.search !== '' || base.hash !== '' ||
      base.pathname !== '/' || !isPrivateIpv4(base.hostname)) throw new TypeError('owner LAN client requires an explicit private IPv4 HTTP endpoint')
  if (!CLIENT_ID.test(clientId)) throw new TypeError('owner LAN clientId is invalid')
  let token = null
  let nextSequence = 1
  let pendingPair = null
  let mutationTail = Promise.resolve()
  const pending = new Map()

  function serializeMutation(operation) {
    const task = mutationTail.then(operation)
    mutationTail = task.then(() => undefined, () => undefined)
    return task
  }

  async function request(path, init = {}) {
    return fetch(new URL(path, base), { ...init, signal: AbortSignal.timeout(10_000) })
  }

  async function pair(invitation) {
    if (token !== null) throw new Error('owner LAN client is already paired')
    if (pendingPair !== null && pendingPair.invitation !== invitation) {
      throw new Error('owner LAN pairing response is pending; retry with the same invitation')
    }
    if (pendingPair === null) pendingPair = { invitation, nonce: randomBytes(16).toString('hex') }
    const response = await request('/v1/pair', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId, invite: pendingPair.invitation, nonce: pendingPair.nonce }) })
    const body = await response.json()
    if (response.status !== 200 || body?.ok !== true || typeof body.clientToken !== 'string') {
      pendingPair = null
      throw new Error(body?.reason ?? 'owner LAN pair failed')
    }
    token = body.clientToken
    nextSequence = body.nextSequence
    pendingPair = null
    return { ownerId: body.ownerId, pigId: body.pigId, nextSequence }
  }

  async function authed(path, init = {}) {
    if (token === null) throw new Error('owner LAN client is not paired')
    const response = await request(path, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } })
    const body = await response.json()
    return { status: response.status, body }
  }

  async function session() {
    const result = await authed('/v1/session')
    if (result.status === 200) nextSequence = result.body.nextSequence
    return result
  }

  async function state() { return authed('/v1/state') }

  async function mutate(path, field, value, requestId = randomUUID()) {
    return serializeMutation(async () => {
      if (token === null) throw new Error('owner LAN client is not paired')
      if (pending.size > 0) throw new Error('owner LAN request is pending; reconnect and retry it before sending another')
      const body = { sequence: nextSequence, requestId, [field]: value }
      pending.set(requestId, { path, body })
      const result = await authed(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (result.status === 200) {
        nextSequence = Math.max(nextSequence, result.body.nextSequence)
        pending.delete(requestId)
      } else {
        if (Number.isSafeInteger(result.body.nextSequence)) nextSequence = result.body.nextSequence
        // 明确 4xx 拒绝发生在操作提交前；408/5xx 或无响应仍需保留原请求供幂等重试。
        if (result.status >= 400 && result.status < 500 && result.status !== 408) pending.delete(requestId)
      }
      return { ...result, requestId }
    })
  }

  async function retry(requestId) {
    return serializeMutation(async () => {
      const previous = pending.get(requestId)
      if (previous === undefined) throw new Error('owner LAN request is not pending')
      const result = await authed(previous.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(previous.body) })
      if (result.status === 200) {
        nextSequence = Math.max(nextSequence, result.body.nextSequence)
        pending.delete(requestId)
      }
      return { ...result, requestId }
    })
  }

  async function close() {
    return serializeMutation(async () => {
      if (pending.size > 0) throw new Error('owner LAN request is pending; retry it before closing the session')
      if (token === null) return { status: 200, body: { ok: true } }
      const result = await authed('/v1/session/close', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      token = null
      pending.clear()
      return result
    })
  }

  return Object.freeze({ clientId, pair, session, reconnect: session, state,
    command: (input, requestId) => mutate('/v1/command', 'input', input, requestId),
    action: (action, requestId) => mutate('/v1/action', 'action', action, requestId), retry, close })
}
