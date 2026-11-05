// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createRoomManager } from '../lib/room-manager.js'

const PROFILE = { name: '猪猪', level: 60, stage: 'piglet', art: '', size: 1 }

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function fakeClient(options = {}) {
  const calls = { updates: [], left: 0, closed: 0 }
  return {
    calls,
    async join() {
      if (options.joinError) throw new Error(options.joinError)
      return {
        ok: true, playerId: 'self', version: 1,
        room: { code: options.code ?? '7K2M', hostId: 'self', version: 1 },
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

  assert.equal(manager.move(0.72, -1).ok, true)
  await wait(90)
  assert.equal(client.calls.updates.length, 1)
  assert.deepEqual(client.calls.updates[0], { x: 0.72, facing: -1 })

  const emoted = await manager.emote('wave', '', 0.72, -1)
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
