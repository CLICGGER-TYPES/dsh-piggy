// @ts-check
/**
 * 公网房间的权威进程：只监听 127.0.0.1，由 Rust 房间服务器转发玩家动作。
 * 对局状态在内存里，进程退出即丢失；不做重连和持久化。
 */
import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'

import { createAuthority } from './authority-core.mjs'

const MAX_BODY = 8 * 1024

function argValue(argv, name, fallback) {
  const index = argv.indexOf(name)
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback
}

function send(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY) throw new Error('body-too-large')
    chunks.push(chunk)
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('bad-json')
  return value
}

export function startAuthority({ listen = '127.0.0.1', port, secret }) {
  if (typeof secret !== 'string' || secret.length < 16) throw new Error('secret must be at least 16 characters')
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw new Error('port is invalid')
  const authority = createAuthority()
  const expected = Buffer.from(secret)

  function authorized(request) {
    const value = request.headers['x-room-authority']
    if (typeof value !== 'string') return false
    const left = Buffer.from(value)
    return left.length === expected.length && timingSafeEqual(left, expected)
  }

  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/game') {
      send(response, 404, { ok: false, reason: 'not-found' })
      return
    }
    if (!authorized(request)) {
      send(response, 401, { ok: false, reason: 'unauthorized' })
      return
    }
    readJson(request).then(body => {
      let result
      try {
        result = authority.handle(body)
      } catch {
        result = { ok: false, reason: 'bad-request' }
      }
      send(response, result.ok ? 200 : 400, result)
    }).catch(error => {
      send(response, error instanceof Error && error.message === 'body-too-large' ? 413 : 400, { ok: false, reason: 'bad-request' })
    })
  })
  const sweeper = setInterval(() => authority.sweep(), 60 * 1000)
  sweeper.unref()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, listen, () => {
      server.off('error', reject)
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close()
        reject(new Error('authority listener has no address'))
        return
      }
      resolve({
        port: address.port,
        close: () => new Promise(done => {
          clearInterval(sweeper)
          server.close(() => done(undefined))
        }),
      })
    })
  })
}

const isMain = process.argv[1] !== undefined && process.argv[1].endsWith('authority.mjs')
if (isMain) {
  const listen = argValue(process.argv, '--listen', '127.0.0.1')
  const port = Number(argValue(process.argv, '--port', '47825'))
  const secret = argValue(process.argv, '--secret', process.env.ROOM_AUTHORITY_SECRET ?? '')
  startAuthority({ listen, port, secret }).then(result => {
    console.log(`room-authority listening on http://${listen}:${result.port}`)
  }).catch(error => {
    console.error(`room-authority: ${error instanceof Error ? error.message : error}`)
    process.exit(2)
  })
}
