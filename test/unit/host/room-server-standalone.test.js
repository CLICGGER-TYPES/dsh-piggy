// @ts-check
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { request as httpsRequest } from 'node:https'
import { test } from 'node:test'

import { parseArgs } from '../../../apps/room-server/server.mjs'
import { createRoomClient } from '../../../apps/desktop/lib/room-client.js'
import { startRoomServer } from '../../../apps/desktop/lib/room-server.js'

const PROFILE_A = { name: '甲', level: 60, stage: 'piglet', art: '', size: 1 }
const PROFILE_B = { name: '乙', level: 42, stage: 'piglet', art: '', size: 1 }
const PROFILE_C = { name: '丙', level: 20, stage: 'piglet', art: '', size: 1 }

test('独立服务器默认持久：玩家进出不关房，也没有玩家被标成房主', async () => {
  const server = await startRoomServer({ code: '7K2M', listenAddress: '127.0.0.1', persistent: true })
  const baseUrl = `http://127.0.0.1:${server.status().port}`
  const a = createRoomClient({ baseUrl, code: '7K2M', profile: PROFILE_A, clientId: 'standalone-a' })
  const b = createRoomClient({ baseUrl, code: '7K2M', profile: PROFILE_B, clientId: 'standalone-b' })
  const c = createRoomClient({ baseUrl, code: '7K2M', profile: PROFILE_C, clientId: 'standalone-c' })
  try {
    const joinedA = await a.join()
    assert.equal(joinedA.players.length, 1)
    assert.equal(joinedA.players[0].host, false)
    assert.equal(joinedA.room.hostId, null)

    const joinedB = await b.join()
    assert.equal(joinedB.players.length, 2)
    assert.equal(joinedB.players.every(player => player.host === false), true)

    await a.leave()
    await new Promise(resolve => setTimeout(resolve, 80))
    assert.equal(server.status().running, true, '最后一位玩家不是房主，离开不应关房')

    const joinedC = await c.join()
    assert.equal(joinedC.players.length, 2)
    await b.leave()
    await c.leave()
    assert.equal(server.status().running, true)
    assert.equal(server.status().persistent, true)
  } finally {
    await a.close().catch(() => {})
    await b.close().catch(() => {})
    await c.close().catch(() => {})
    await server.close()
  }
})

test('独立服务器可以直接用 HTTPS，不依赖反向代理', async () => {
  const key = readFileSync(new URL('../../fixtures/owner-lan-tls/test-only.key', import.meta.url))
  const cert = readFileSync(new URL('../../fixtures/owner-lan-tls/test-only.crt', import.meta.url))
  const server = await startRoomServer({
    code: '7K2M', listenAddress: '127.0.0.1', persistent: true,
    advertisedHost: '127.0.0.1', tls: { key, cert },
  })
  const port = server.status().port
  try {
    assert.equal(server.status().protocol, 'https')
    const result = await new Promise((resolve, reject) => {
      const request = httpsRequest({
        host: '127.0.0.1', port, path: '/v1/room/join', method: 'POST', rejectUnauthorized: false,
        headers: { 'content-type': 'application/json' },
      }, response => {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.once('end', () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }))
      })
      request.once('error', reject)
      request.end(JSON.stringify({ clientId: 'tls-standalone', code: '7K2M', profile: PROFILE_A }))
    })
    assert.equal(result.status, 200)
    assert.equal(result.body.ok, true)
    assert.equal(result.body.players[0].host, false)
  } finally {
    await server.close()
  }
})

test('独立服务器 CLI 参数：公网地址、固定码、持久模式和错误参数', () => {
  const args = parseArgs([
    '--public-url', 'https://piggy.example.com',
    '--code', '7k2m', '--listen', '127.0.0.1', '--port', '47824',
  ])
  assert.equal(args.publicUrl, 'https://piggy.example.com')
  assert.equal(args.code, '7k2m')
  assert.equal(args.port, 47824)
  assert.equal(args.persistent, true)

  assert.equal(parseArgs(['--no-persistent']).persistent, false)
  assert.equal(parseArgs(['--help']).help, true)
  assert.throws(() => parseArgs(['--unknown']), /未知参数/)
  assert.throws(() => parseArgs(['--port']), /需要一个值/)
})
