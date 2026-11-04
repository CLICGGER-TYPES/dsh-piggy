// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createOwnerNetworkManager, parseOwnerNetworkInvite } from '../lib/owner-network-manager.js'
import { registerOwnerNetworkIpc } from '../lib/ipc/owner-network.js'

const CODE = 'a'.repeat(64)
const LINK = `piggy://192.168.1.20:53421#${CODE}`

const interfaces = () => ({
  lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  'Wi-Fi': [{ address: '192.168.1.20', family: 'IPv4', internal: false }],
  eth0: [{ address: '10.0.0.5', family: 'IPv4', internal: false }],
})

function owner() {
  return { ownerDocumentPath: '/tmp/owner-document.json', ownerId: 'owner-a', pigId: 'pig-a', source: 'selection' }
}

function makeManager(host, extra = {}) {
  const config = owner()
  return createOwnerNetworkManager({
    getHost: () => host,
    getOwnerConfig: () => extra.config ?? config,
    isSupported: () => extra.isSupported ?? true,
    selectionStore: { read: () => ({ active: extra.config ?? config, pending: null }) },
    isQuitting: () => extra.isQuitting ?? false,
    networkInterfaces: extra.networkInterfaces ?? interfaces,
    log() {},
  })
}

function fakeHost(overrides = {}) {
  const calls = []
  const state = { running: false, address: '', port: 0 }
  const host = {
    calls,
    state,
    async ownerLanStatus() {
      if (overrides.status) return overrides.status(calls, state)
      return state.running
        ? { running: true, host: state.address, listenAddress: state.address, protocol: 'http', port: state.port, pairedClients: 0 }
        : { running: false, pairedClients: 0 }
    },
    async startOwnerLan(options) {
      calls.push(['start', options.listenAddress])
      state.running = true
      state.address = options.listenAddress
      state.port = 53421
      return { running: true, host: options.listenAddress, listenAddress: options.listenAddress,
        protocol: 'http', port: 53421, pairedClients: 0 }
    },
    async listOwnerPigs() { return { ownerId: 'owner-a', pigs: [{ pigId: 'pig-a' }, { pigId: 'pig-b' }] } },
    async createOwnerLanInvitation(pigId) {
      calls.push(['invite', pigId])
      return { invitation: CODE, ownerId: 'owner-a', pigId, expiresAt: Date.now() + 60_000,
        host: state.address, protocol: 'http', port: state.port }
    },
    async stopOwnerLan() {
      calls.push('stop')
      state.running = false
      return { running: false, pairedClients: 0 }
    },
    async ownerLanJoin(options) {
      calls.push(['join', options])
      return { joining: true, connected: true, peer: {
        ownerId: 'owner-b', pigId: 'pig-b', name: '乙', stage: 'middle', hatched: true,
        clientToken: 'must-not-leak',
      } }
    },
    async ownerLanJoinStatus() {
      calls.push('join-status')
      return { joining: true, connected: true, peer: { ownerId: 'owner-b', pigId: 'pig-b', name: '乙', stage: 'middle', hatched: true } }
    },
    async ownerLanLeave() {
      calls.push('join-leave')
      return { joining: false }
    },
  }
  return host
}

test('owner network stays off until explicit start and invites only a pig in the active local owner roster', async () => {
  const host = fakeHost()
  const manager = makeManager(host)
  assert.deepEqual(await manager.status(), { ok: true, available: true, ownerId: 'owner-a', pigId: 'pig-a',
    running: false, pairedClients: 0 })
  assert.deepEqual(await manager.start({ listenAddress: '192.168.1.20' }),
    { ok: true, running: true, host: '192.168.1.20', listenAddress: '192.168.1.20', protocol: 'http', port: 53421, pairedClients: 0 })
  assert.equal((await manager.invite('pig-foreign')).ok, false)
  const invite = await manager.invite('pig-b')
  assert.equal(invite.ok, true)
  assert.equal(invite.invitation, CODE)
  assert.deepEqual(await manager.stop(), { ok: true, running: false, pairedClients: 0 })
  assert.deepEqual(host.calls, [['start', '192.168.1.20'], ['invite', 'pig-b'], 'stop'])
})

test('地址只来自主进程枚举：通配、公网、未枚举地址与对外地址不一致都被拒绝', async () => {
  const host = fakeHost()
  const manager = makeManager(host)
  const addresses = await manager.addresses()
  assert.equal(addresses.ok, true)
  assert.deepEqual(addresses.addresses.map(item => item.address), ['127.0.0.1', '192.168.1.20', '10.0.0.5'])
  assert.equal(addresses.lanAvailable, true)

  for (const listenAddress of ['0.0.0.0', '192.0.2.8', '192.168.1.99', 'example.local']) {
    const result = await manager.start({ listenAddress })
    assert.equal(result.ok, false, `${listenAddress}: ${JSON.stringify(result)}`)
  }
  assert.deepEqual(await manager.start({ listenAddress: '192.168.1.20', advertisedHost: 'evil.example' }),
    { ok: false, reason: '本机未启用加密，对外地址必须与监听地址一致' })
  assert.deepEqual(host.calls, [])

  assert.equal((await manager.start({ listenAddress: '192.168.1.20' })).ok, true)
  assert.deepEqual(await manager.start({ listenAddress: '192.168.1.20', advertisedHost: '192.168.1.20' }),
    { ok: true, running: true, host: '192.168.1.20', listenAddress: '192.168.1.20', protocol: 'http', port: 53421, pairedClients: 0 })
  assert.deepEqual(await manager.start({ listenAddress: '10.0.0.5' }),
    { ok: false, reason: '请先停止当前联机再更换地址' })
  assert.equal(host.calls.filter(call => Array.isArray(call)).length, 1)
})

test('status 只返回白名单字段，邀请码与 token 不随状态外泄', async () => {
  const host = fakeHost({ status: () => ({
    running: true, host: '192.168.1.20', listenAddress: '192.168.1.20', protocol: 'http', port: 53421, pairedClients: 1,
    invitation: CODE, clientToken: 'secret', key: 'private-key',
  }) })
  const manager = makeManager(host)
  const status = await manager.status()
  assert.equal(status.running, true)
  assert.equal(status.port, 53421)
  for (const key of ['invitation', 'clientToken', 'token', 'key', 'private']) {
    assert.equal(Object.hasOwn(status, key), false, key)
  }
  assert.equal(JSON.stringify(status).includes(CODE), false)
})

test('加入只读：解析单条邀请串、拒绝公网/https/坏码、成功后摘要不含 token', async () => {
  const host = fakeHost()
  const manager = makeManager(host)

  assert.deepEqual(parseOwnerNetworkInvite(LINK), {
    ok: true, address: '192.168.1.20', port: 53421, invitation: CODE, baseUrl: 'http://192.168.1.20:53421',
  })
  assert.equal(parseOwnerNetworkInvite(`https://192.168.1.20:53421#${CODE}`).reason, 'join-https-unsupported')
  assert.equal(parseOwnerNetworkInvite(`piggy://example.local:53421#${CODE}`).reason, 'invite-address-invalid')
  assert.equal(parseOwnerNetworkInvite(`piggy://192.0.2.8:53421#${CODE}`).reason, 'invite-address-not-private')
  assert.equal(parseOwnerNetworkInvite(`piggy://192.168.1.20:0#${CODE}`).reason, 'invite-port-invalid')
  assert.equal(parseOwnerNetworkInvite(`piggy://192.168.1.20:70000#${CODE}`).reason, 'invite-port-invalid')
  assert.equal(parseOwnerNetworkInvite(`piggy://192.168.1.20:53421#${'a'.repeat(63)}`).reason, 'invite-code-invalid')
  assert.equal(parseOwnerNetworkInvite(`piggy://192.168.1.20:53421#${'A'.repeat(64)}`).reason, 'invite-code-invalid')
  assert.equal(parseOwnerNetworkInvite('').reason, 'invite-format-invalid')
  assert.equal(parseOwnerNetworkInvite(42).reason, 'invite-format-invalid')

  const joined = await manager.join(LINK)
  assert.equal(joined.ok, true)
  assert.equal(joined.joining, true)
  assert.deepEqual(joined.peer, { ownerId: 'owner-b', pigId: 'pig-b', name: '乙', stage: 'middle', hatched: true })
  assert.deepEqual(joined.endpoint, { address: '192.168.1.20', port: 53421 })
  assert.equal(JSON.stringify(joined).includes('must-not-leak'), false)
  assert.deepEqual(host.calls.find(call => Array.isArray(call) && call[0] === 'join'), ['join',
    { baseUrl: 'http://192.168.1.20:53421', invitation: CODE }])
  assert.deepEqual(await manager.join(LINK), { ok: false, reason: '已经连接到另一台设备的联机，请先断开' })

  assert.deepEqual(await manager.joinStatus(), {
    ok: true, joining: true, connected: true,
    peer: { ownerId: 'owner-b', pigId: 'pig-b', name: '乙', stage: 'middle', hatched: true },
    endpoint: { address: '192.168.1.20', port: 53421 },
  })
  assert.deepEqual(await manager.joinLeave(), { ok: true, joining: false })
  assert.deepEqual(await manager.joinLeave(), { ok: true, joining: false })
  assert.equal(host.calls.filter(call => call === 'join-leave').length, 1)
})

test('加入自己被拒绝，未运行时不影响加入', async () => {
  const host = fakeHost()
  host.state.running = true
  host.state.address = '192.168.1.20'
  host.state.port = 53421
  const manager = makeManager(host)
  assert.deepEqual(await manager.join(LINK), { ok: false, reason: 'join-self' })
  assert.equal(host.calls.some(call => Array.isArray(call) && call[0] === 'join'), false)
})

test('加入状态过期会清掉本地摘要，对端不可达时保留只读摘要并标记断开', async () => {
  const host = fakeHost()
  const manager = makeManager(host)
  await manager.join(LINK)

  host.ownerLanJoinStatus = async () => ({ joining: false, reason: 'session-expired' })
  assert.deepEqual(await manager.joinStatus(), { ok: true, joining: false, reason: 'session-expired' })
  assert.deepEqual(await manager.joinStatus(), { ok: true, joining: false })

  await manager.join(LINK)
  host.ownerLanJoinStatus = async () => { throw new Error('fetch failed') }
  const unreachable = await manager.joinStatus()
  assert.equal(unreachable.ok, true)
  assert.equal(unreachable.joining, true)
  assert.equal(unreachable.connected, false)
  assert.equal(unreachable.reason, 'unreachable')
  assert.equal(unreachable.peer.name, '乙')
  assert.deepEqual(await manager.joinLeave(), { ok: true, joining: false })
})

test('owner network IPC is panel-only for listener, address enumeration and read-only join', async () => {
  const handlers = new Map(), calls = []
  const manager = {
    status: () => ({ ok: true, available: true, running: false }),
    addresses: () => { calls.push('addresses'); return { ok: true, addresses: [] } },
    start: options => { calls.push(['start', options.listenAddress]); return { ok: true } },
    invite: pigId => { calls.push(['invite', pigId]); return { ok: true } },
    stop: () => { calls.push('stop'); return { ok: true } },
    join: link => { calls.push(['join', link]); return { ok: true } },
    joinStatus: () => { calls.push('join-status'); return { ok: true, joining: false } },
    joinLeave: () => { calls.push('join-leave'); return { ok: true, joining: false } },
  }
  registerOwnerNetworkIpc({ ipcMain: { handle(name, handler) { handlers.set(name, handler) } },
    fromPanelOnly: event => event?.panel === true, manager })
  const call = (name, event, ...args) => handlers.get(`piggy:owner-network:${name}`)(event, ...args)

  for (const name of ['addresses', 'join-status', 'join-leave']) {
    assert.deepEqual(await call(name, { panel: false }), { ok: false, reason: '来源不对' })
  }
  assert.deepEqual(await call('join', { panel: false }, LINK), { ok: false, reason: '来源不对' })
  assert.deepEqual(await call('start', { panel: false }, { listenAddress: '192.168.1.20' }), { ok: false, reason: '来源不对' })
  assert.deepEqual(calls, [])

  assert.deepEqual(await call('addresses', { panel: true }), { ok: true, addresses: [] })
  assert.deepEqual(await call('start', { panel: true }, { listenAddress: 42 }), { ok: true })
  assert.deepEqual(await call('join', { panel: true }, 42), { ok: true })
  assert.deepEqual(await call('join', { panel: true }, LINK), { ok: true })
  assert.deepEqual(await call('invite', { panel: true }, 'pig-a'), { ok: true })
  assert.deepEqual(await call('join-status', { panel: true }), { ok: true, joining: false })
  assert.deepEqual(await call('join-leave', { panel: true }), { ok: true, joining: false })
  assert.deepEqual(calls, ['addresses', ['start', ''], ['join', ''], ['join', LINK], ['invite', 'pig-a'], 'join-status', 'join-leave'])
})
