// @ts-check
/** 房间服务器的 HTTP 小工具：JSON 收发、鉴权、错误对象和出生点。 */
import { createHash } from 'node:crypto'

import { ROOM_MAX_BODY } from './room-protocol.js'

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function send(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

export function fail(status, reason) {
  return Object.assign(new Error(reason), { status, code: reason })
}

export function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',')
}

/** 新玩家先站中间，之后左右交替排开，避免所有猪叠在同一个点。 */
export function spawnX(index) {
  if (index === 0) return 0.5
  const side = index % 2 === 1 ? 1 : -1
  const step = Math.ceil(index / 2)
  return Math.round(Math.min(0.92, Math.max(0.08, 0.5 + side * step * 0.16)) * 1000) / 1000
}

export async function readJson(request) {
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

export function authToken(request) {
  const raw = request.rawHeaders
  let count = 0
  for (let index = 0; index < raw.length; index += 2) if (raw[index].toLowerCase() === 'authorization') count += 1
  if (count !== 1 || typeof request.headers.authorization !== 'string') throw fail(401, 'unauthorized')
  const match = /^Bearer ([a-f0-9]{64})$/u.exec(request.headers.authorization)
  if (match === null) throw fail(401, 'unauthorized')
  return match[1]
}
