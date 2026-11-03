// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createOwnerNetworkManager } from '../lib/owner-network-manager.js'
import { registerOwnerNetworkIpc } from '../lib/ipc/owner-network.js'

test('owner network stays off until explicit start and invites only a pig in the active local owner roster', async () => {
  const calls = []
  const owner = { ownerDocumentPath: '/tmp/owner-document.json', ownerId: 'owner-a', pigId: 'pig-a', source: 'selection' }
  const host = {
    async ownerLanStatus() { return { running: calls.includes('start'), host: '127.0.0.1', port: 43123, pairedClients: 0 } },
    async startOwnerLan(options) { calls.push('start'); return { running: true, host: options.listenAddress, port: 43123, pairedClients: 0 } },
    async listOwnerPigs() { return { ownerId: 'owner-a', pigs: [{ pigId: 'pig-a' }, { pigId: 'pig-b' }] } },
    async createOwnerLanInvitation(pigId) { calls.push(['invite', pigId]); return { invitation: 'opaque-one-time-token', ownerId: 'owner-a', pigId } },
    async stopOwnerLan() { calls.push('stop'); return { running: false, pairedClients: 0 } },
  }
  const manager = createOwnerNetworkManager({
    getHost: () => host,
    getOwnerConfig: () => owner,
    isSupported: () => true,
    selectionStore: { read: () => ({ active: owner, pending: null }) },
    isQuitting: () => false,
    log() {},
  })
  assert.deepEqual(await manager.status(), { ok: true, available: true, ownerId: 'owner-a', pigId: 'pig-a',
    running: false, host: '127.0.0.1', port: 43123, pairedClients: 0 })
  assert.deepEqual(await manager.start({ listenAddress: '192.168.1.20' }),
    { ok: true, running: true, host: '192.168.1.20', port: 43123, pairedClients: 0 })
  assert.equal((await manager.invite('pig-foreign')).ok, false)
  assert.deepEqual(await manager.invite('pig-b'), { ok: true, invitation: 'opaque-one-time-token', ownerId: 'owner-a', pigId: 'pig-b' })
  assert.deepEqual(await manager.stop(), { ok: true, running: false, pairedClients: 0 })
  assert.deepEqual(calls, ['start', ['invite', 'pig-b'], 'stop'])
})

test('owner network IPC is panel-only for listener start and invitation delivery', async () => {
  const handlers = new Map(), calls = []
  const manager = {
    status: () => ({ ok: true, available: true, running: false }),
    start: options => { calls.push(['start', options.listenAddress]); return { ok: true } },
    invite: pigId => { calls.push(['invite', pigId]); return { ok: true } },
    stop: () => { calls.push(['stop']); return { ok: true } },
  }
  registerOwnerNetworkIpc({ ipcMain: { handle(name, handler) { handlers.set(name, handler) } },
    fromPanelOnly: event => event?.panel === true, manager })
  const call = (name, event, ...args) => handlers.get(`piggy:owner-network:${name}`)(event, ...args)
  assert.deepEqual(await call('start', { panel: false }, { listenAddress: '192.168.1.20' }), { ok: false, reason: '来源不对' })
  assert.deepEqual(await call('start', { panel: true }, { listenAddress: '192.168.1.20' }), { ok: true })
  assert.deepEqual(await call('invite', { panel: true }, 'pig-a'), { ok: true })
  assert.deepEqual(calls, [['start', '192.168.1.20'], ['invite', 'pig-a']])
})
