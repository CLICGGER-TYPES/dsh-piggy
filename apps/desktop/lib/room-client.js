// @ts-check
/** 房间客户端：配对、长轮询、位置/表情更新。token 只留在闭包里。 */
import { randomUUID } from 'node:crypto'
import { isIP } from 'node:net'

import { ownerNetworkAddressKind } from './owner-network-addresses.js'
import { normalizeRoomCode } from './room-code.js'
import { normalizeProfile } from './room-protocol.js'

/**
 * @param {{baseUrl:string,code:string,profile:any,clientId?:string,fetch?:typeof globalThis.fetch}} options
 */
export function createRoomClient({ baseUrl, code, profile, clientId = randomUUID(), fetch = globalThis.fetch }) {
  const base = new URL(baseUrl)
  const kind = ownerNetworkAddressKind(base.hostname)
  const valid = base.protocol === 'http:' && isIP(base.hostname) === 4 && (kind === 'loopback' || kind === 'private' || kind === 'link-local')
  if (!valid || base.username !== '' || base.password !== '' || base.search !== '' || base.hash !== '' || base.pathname !== '/') {
    throw new TypeError('room client requires a private IPv4 HTTP endpoint')
  }
  const roomCode = normalizeRoomCode(code)
  if (roomCode === null) throw new TypeError('room client code is invalid')
  const self = normalizeProfile(profile)
  let token = null
  let playerId = null
  let version = 1
  let rev = 0
  let tail = Promise.resolve()

  function serialize(operation) {
    const task = tail.then(operation)
    tail = task.then(() => undefined, () => undefined)
    return task
  }

  async function request(path, body, authenticated) {
    const headers = { 'content-type': 'application/json' }
    if (authenticated) {
      if (token === null) throw new Error('房间连接已断开')
      headers.authorization = `Bearer ${token}`
    }
    const response = await fetch(new URL(path, base), {
      method: 'POST', headers, body: JSON.stringify(body), redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    })
    let payload
    try { payload = await response.json() } catch { payload = null }
    if (payload === null || typeof payload !== 'object') throw new Error('房间服务返回了无法识别的内容')
    return { status: response.status, body: payload }
  }

  /** @returns {Promise<any>} */
  function join() {
    return serialize(async () => {
      if (token !== null) throw new Error('已经在这个房间里')
      const result = await request('/v1/room/join', { clientId, code: roomCode, profile: self }, false)
      if (result.status !== 200 || result.body.ok !== true || typeof result.body.token !== 'string') {
        throw new Error(typeof result.body.reason === 'string' ? result.body.reason : '加入房间失败')
      }
      token = result.body.token
      playerId = typeof result.body.playerId === 'string' ? result.body.playerId : null
      version = Number.isSafeInteger(result.body.version) ? result.body.version : 1
      return result.body
    })
  }

  /** 长轮询：版本没变就等到服务端变化或 15 秒超时。 */
  function wait(since = version) {
    return request('/v1/room/state', { since }, true).then(result => {
      if (result.status === 200 && result.body.ok === true && Number.isSafeInteger(result.body.version)) version = result.body.version
      return result
    })
  }

  /** @param {{x?:number,y?:number,facing?:number,emote?:string,targetId?:string}} [options] */
  function update({ x, y, facing, emote = '', targetId = '' } = {}) {
    return serialize(async () => {
      rev += 1
      const result = await request('/v1/room/update', {
        rev,
        x: Number(x),
        y: Number(y),
        facing: Number(facing) < 0 ? -1 : 1,
        emote: typeof emote === 'string' ? emote : '',
        targetId: typeof targetId === 'string' ? targetId : '',
      }, true)
      if (result.status === 200 && Number.isSafeInteger(result.body.version)) version = result.body.version
      return result
    })
  }

  function leave() {
    return serialize(async () => {
      if (token === null) return { status: 200, body: { ok: true } }
      const result = await request('/v1/room/leave', {}, true)
      token = null
      playerId = null
      return result
    })
  }

  return Object.freeze({
    clientId,
    get playerId() { return playerId },
    get version() { return version },
    join,
    wait,
    update,
    leave,
    close: () => leave().catch(() => ({ status: 0, body: { ok: false } })),
  })
}
