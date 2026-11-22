// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createRoomManager } from '../lib/room-manager.js'

const PROFILE = { name: '猪猪', level: 60, stage: 'piglet', art: '', size: 1 }

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fakeClient(options = {}) {
  const calls = { updates: [], games: [], left: 0, closed: 0 }
  return {
    calls,
    async join() {
      if (options.joinError) throw new Error(options.joinError)
      return {
        ok: true, playerId: 'self', version: 1,
        room: { code: options.code ?? '7K2M', hostId: 'self', version: 1, caps: ['game'], authority: 'host' },
        players: [{ id: 'self', name: '猪猪', level: 60, host: true, x: 0.5, facing: 1, emote: '', emoteTarget: null, emoteAt: 0 }],
      }
    },
    wait() {
      if (options.closedAfter) return wait(options.closedAfter).then(() => ({ status: 410, body: { ok: false, reason: 'host-left' } }))
      return new Promise(() => {})
    },
    async update(payload) {
      calls.updates.push(payload)
      return { status: 200, body: { ok: true, version: 2 } }
    },
    async game(payload) {
      calls.games.push(payload)
      if (options.gameError) return { status: 400, body: { ok: false, reason: options.gameError } }
      return { status: 200, body: { ok: true, version: 7, eventId: 3 } }
    },
    async leave() { calls.left += 1; return { status: 200, body: { ok: true } } },
    async close() { calls.closed += 1 },
  }
}

test('建房：用局域网地址起服务，移动节流上报，离开时关闭服务和发现', async () => {
  const client = fakeClient()
  let serverClosed = null
  let discoveryClosed = 0
  const snapshots = []
  const closed = []
  const manager = createRoomManager({
    networkInterfaces: () => ({ wifi: [{ address: '192.168.1.20', family: 'IPv4', internal: false, netmask: '255.255.255.0' }] }),
    onUpdate: snapshot => snapshots.push(snapshot),
    onClosed: event => closed.push(event.reason),
    startServer: async options => {
      assert.equal(options.listenAddress, '192.168.1.20')
      return { status: () => ({ running: true, port: 51234, code: options.code, listenAddress: options.listenAddress }), close: async reason => { serverClosed = reason } }
    },
    startDiscovery: async options => {
      assert.equal(options.httpPort, 51234)
      assert.equal(options.advertisedHost, '192.168.1.20')
      return { close: () => { discoveryClosed += 1 } }
    },
    createClient: options => {
      assert.equal(options.baseUrl, 'http://192.168.1.20:51234')
      return client
    },
  })
  const hosted = await manager.host(PROFILE)
  assert.equal(hosted.ok, true)
  assert.match(hosted.code, /^[2-9A-HJ-NP-Z]{4}$/)
  assert.equal(manager.status().inRoom, true)
  assert.equal(snapshots.length, 1)
  assert.equal(snapshots[0].players[0].name, '猪猪')

  assert.equal(manager.move(0.72, 0.35, -1).ok, true)
  await wait(90)
  assert.equal(client.calls.updates.length, 1)
  assert.deepEqual(client.calls.updates[0], { x: 0.72, y: 0.35, facing: -1 })

  const emoted = await manager.emote('wave', '', 0.72, 0.35, -1)
  assert.equal(emoted.ok, true)
  assert.equal(client.calls.updates[1].emote, 'wave')

  await manager.leave('test-done')
  assert.equal(serverClosed, 'host-left')
  assert.equal(discoveryClosed, 1)
  assert.equal(client.calls.left, 1)
  assert.deepEqual(closed, ['test-done'])
  assert.equal(manager.status().inRoom, false)
})

test('加入：先广播找房再连；完整邀请串跳过发现', async () => {
  const found = []
  const clients = []
  const manager = createRoomManager({
    findHost: async code => { found.push(code); return { address: '192.168.1.30', port: 5000 } },
    createClient: options => {
      const client = fakeClient({ code: options.code })
      clients.push({ options, client })
      return client
    },
  })
  const joined = await manager.join('7k2m', PROFILE)
  assert.equal(joined.ok, true)
  assert.deepEqual(found, ['7K2M'])
  assert.equal(clients[0].options.baseUrl, 'http://192.168.1.30:5000')
  await manager.leave()

  const second = createRoomManager({
    findHost: async () => { throw new Error('不该走发现') },
    createClient: options => {
      assert.equal(options.baseUrl, 'http://10.0.0.9:51234')
      return fakeClient()
    },
  })
  const linked = await second.join('piggy://10.0.0.9:51234#PIG-7K2M', PROFILE)
  assert.equal(linked.ok, true)
  await second.leave()
})

test('对端关房：轮询收到 host-left 后清理并通知', async () => {
  const closed = []
  const manager = createRoomManager({
    onClosed: event => closed.push(event.reason),
    findHost: async () => ({ address: '192.168.1.30', port: 5000 }),
    createClient: () => fakeClient({ closedAfter: 20 }),
  })
  const joined = await manager.join('7K2M', PROFILE)
  assert.equal(joined.ok, true)
  await wait(120)
  assert.deepEqual(closed, ['room-closed'])
  assert.equal(manager.status().inRoom, false)
})

test('没有局域网地址或没有找到房间时给出可读原因', async () => {
  const noLan = createRoomManager({ networkInterfaces: () => ({ lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '255.0.0.0' }] }) })
  const hosted = await noLan.host(PROFILE)
  assert.equal(hosted.ok, false)
  assert.match(hosted.reason, /局域网地址/)

  const notFound = createRoomManager({ findHost: async () => null })
  const joined = await notFound.join('7K2M', PROFILE)
  assert.equal(joined.ok, false)
  assert.match(joined.reason, /没有找到/)
})

test('公网域名：回环监听 + 反向代理 Host，生成 HTTPS 邀请串，不走局域网发现', async () => {
  let started = null
  let discovery = 0
  const manager = createRoomManager({
    startServer: async options => {
      started = options
      return { status: () => ({ running: true, port: 51234, code: options.code }), close: async () => {} }
    },
    startDiscovery: async () => { discovery += 1; return { close: () => {} } },
    createClient: options => {
      assert.equal(options.baseUrl, 'http://127.0.0.1:51234')
      return fakeClient()
    },
  })
  const hosted = await manager.host(PROFILE, { publicUrl: 'https://piggy.example.com' })
  assert.equal(hosted.ok, true)
  assert.equal(started.listenAddress, '127.0.0.1')
  assert.equal(started.port, 47824)
  assert.equal(started.advertisedHost, 'piggy.example.com')
  assert.equal(started.advertisedPort, 443)
  assert.equal(started.allowPublic, true)
  assert.equal(started.trustProxy, true)
  assert.equal(discovery, 0)
  assert.equal(hosted.publicUrl, 'https://piggy.example.com')
  assert.equal(hosted.invite, `https://piggy.example.com/#PIG-${hosted.code}`)
  assert.equal(hosted.localPort, 51234)
  await manager.leave()
})

test('公网 IPv4 直连：监听所有网卡，邀请串带回公网地址和端口', async () => {
  let started = null
  const manager = createRoomManager({
    startServer: async options => {
      started = options
      return { status: () => ({ running: true, port: 47824, code: options.code }), close: async () => {} }
    },
    createClient: () => fakeClient(),
  })
  const hosted = await manager.host(PROFILE, { publicUrl: 'http://203.0.113.8:47824' })
  assert.equal(hosted.ok, true)
  assert.equal(started.listenAddress, '0.0.0.0')
  assert.equal(started.port, 47824)
  assert.equal(started.advertisedHost, '203.0.113.8')
  assert.equal(started.advertisedPort, 47824)
  assert.equal(started.allowPublic, true)
  assert.equal(started.trustProxy, false)
  assert.equal(hosted.invite, `http://203.0.113.8:47824/#PIG-${hosted.code}`)
  await manager.leave()
})

test('游戏消息转发给房间客户端；房间能力与权威进快照；不在房间时报错', async () => {
  const client = fakeClient()
  const manager = createRoomManager({
    findHost: async () => ({ address: '192.168.1.30', port: 5000 }),
    createClient: () => client,
  })
  const joined = await manager.join('7K2M', PROFILE)
  assert.equal(joined.ok, true)
  assert.deepEqual(joined.caps, ['game'])
  assert.equal(joined.authority, 'host')
  assert.deepEqual(joined.gameEvents, [])

  const sent = await manager.game({ seq: 1, ext: 'roulette', op: 'action', data: { op: 'arm' } })
  assert.deepEqual(sent, { ok: true, duplicate: false, version: 7, eventId: 3 })
  assert.deepEqual(client.calls.games[0], { seq: 1, ext: 'roulette', op: 'action', data: { op: 'arm' } })
  await manager.leave()

  const outside = createRoomManager({})
  const rejected = await outside.game({ seq: 1, ext: 'roulette', op: 'action', data: {} })
  assert.equal(rejected.ok, false)
  assert.match(rejected.reason, /不在房间/)

  const failing = createRoomManager({
    findHost: async () => ({ address: '192.168.1.30', port: 5000 }),
    createClient: () => fakeClient({ gameError: 'game-rate-limited' }),
  })
  await failing.join('7K2M', PROFILE)
  const limited = await failing.game({ seq: 1, ext: 'roulette', op: 'action', data: {} })
  assert.deepEqual(limited, { ok: false, reason: 'game-rate-limited' })
  await failing.leave()
})

test('公网地址格式错误时给出可读原因；HTTPS 邀请串按 https 连接', async () => {
  const manager = createRoomManager({
    startServer: async () => ({ status: () => ({ running: true, port: 5000 }), close: async () => {} }),
    createClient: () => fakeClient(),
  })
  const bad = await manager.host(PROFILE, { publicUrl: 'https://piggy.example.com/path' })
  assert.equal(bad.ok, false)
  assert.match(bad.reason, /公网地址/)

  const joined = createRoomManager({
    findHost: async () => { throw new Error('不该走发现') },
    createClient: options => {
      assert.equal(options.baseUrl, 'https://piggy.example.com:443')
      return fakeClient()
    },
  })
  const result = await joined.join('https://piggy.example.com/#PIG-7K2M', PROFILE)
  assert.equal(result.ok, true)
  await joined.leave()
})
