// @ts-check
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../core.js'
import { startOwnerLanServer, createOwnerLanClient } from '../runtime/owner-lan-server.js'
import { createGameRuntime } from '../runtime/index.js'
import { splitLegacyState } from '../store/legacy-projection.js'

const NOW = Date.now()

function ownerFixture(root) {
  const legacyStatePath = join(root, 'legacy-v15.json')
  const state = hatchEgg(NOW)
  state.name = '甲'
  state.coins = 500
  state.inventory = { apple: 2 }
  writeFileSync(legacyStatePath, JSON.stringify(state))
  return { legacyStatePath, ownerDocumentPath: join(root, 'owner', 'owner-document.json') }
}

test('two paired LAN clients stay bound to separate pigs, share owner resources, and retry one lost response once', async t => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-owner-lan-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const { legacyStatePath, ownerDocumentPath } = ownerFixture(root)
  const runtime = createGameRuntime({ statePath: ownerDocumentPath, ownerDocumentPath, legacyStatePath,
    ownerId: 'owner-lan', pigId: 'pig-a', now: () => Date.now() })
  const bodyB = structuredClone(splitLegacyState(runtime.store.state).body)
  bodyB.name = '乙'
  runtime.addPigTarget('pig-b', bodyB)
  const directory = join(root, 'network')
  let server
  try {
    await assert.rejects(startOwnerLanServer({ runtime, directory: join(root, 'wildcard'), listenAddress: '0.0.0.0' }), /private IPv4/)
    assert.equal(existsSync(join(root, 'wildcard')), false, 'rejected wildcard binding does not make a network directory')
    server = await startOwnerLanServer({ runtime, directory, listenAddress: '127.0.0.1', now: () => NOW })
    const status = server.status()
    assert.deepEqual({ host: status.host, running: status.running, pairedClients: status.pairedClients },
      { host: '127.0.0.1', running: true, pairedClients: 0 })
    const baseUrl = `http://${status.host}:${status.port}`
    assert.equal((await fetch(`${baseUrl}/v1/state`)).status, 401)

    const invitationA = server.createInvitation('pig-a')
    const invitationB = server.createInvitation('pig-b')
    let dropNextCommandResponse = false
    let dropNextPairResponse = true
    let clientAToken = null
    const clientA = createOwnerLanClient({ baseUrl, clientId: 'device-a', fetch: async (input, init) => {
      const response = await fetch(input, init)
      if (dropNextPairResponse && new URL(String(input)).pathname === '/v1/pair') {
        dropNextPairResponse = false
        clientAToken = (await response.clone().json()).clientToken
        await response.arrayBuffer()
        throw new Error('simulated connection loss after pairing')
      }
      if (new URL(String(input)).pathname === '/v1/pair') clientAToken = (await response.clone().json()).clientToken
      if (dropNextCommandResponse && new URL(String(input)).pathname === '/v1/command') {
        dropNextCommandResponse = false
        await response.arrayBuffer()
        throw new Error('simulated connection loss after server commit')
      }
      return response
    } })
    const clientB = createOwnerLanClient({ baseUrl, clientId: 'device-b' })
    await assert.rejects(clientA.pair(invitationA.invitation), /simulated connection loss after pairing/)
    assert.deepEqual(await clientA.pair(invitationA.invitation), { ownerId: 'owner-lan', pigId: 'pig-a', nextSequence: 1 })
    assert.equal(server.status().pairedClients, 1, 'a lost pair response is retried without creating a second session')
    const inviteReuse = await fetch(`${baseUrl}/v1/pair`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: 'device-a-replay', invite: invitationA.invitation, nonce: 'cd'.repeat(16) }) })
    assert.equal(inviteReuse.status, 401, 'one-time invitations cannot create a second pig session')
    assert.deepEqual(await clientB.pair(invitationB.invitation), { ownerId: 'owner-lan', pigId: 'pig-b', nextSequence: 1 })
    const discovery = JSON.parse(readFileSync(join(directory, 'owner-lan.json'), 'utf8'))
    assert.equal(discovery.role, 'piggy-owner-lan')
    assert.equal('token' in discovery, false, 'discovery metadata contains no auth token')

    const stateA = await clientA.state(), stateB = await clientB.state()
    assert.equal(stateA.status, 200)
    assert.equal(stateA.body.pigId, 'pig-a')
    assert.equal(stateA.body.state.pig.name, '甲')
    assert.equal(stateB.body.pigId, 'pig-b')
    assert.equal(stateB.body.state.pig.name, '乙')
    assert.equal(stateA.body.state.pig.coins, stateB.body.state.pig.coins, 'both sessions read one shared owner wallet')

    const concurrent = await Promise.all(['甲一', '甲二'].map((name, index) => fetch(`${baseUrl}/v1/command`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${clientAToken}` },
      body: JSON.stringify({ sequence: 1, requestId: `parallel-${index}`, input: `name ${name}` }),
    }).then(async response => ({ status: response.status, body: await response.json() }))))
    assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 409], 'a session applies only one command for a sequence')
    assert.equal(concurrent.find(result => result.status === 409)?.body.reason, 'sequence-gap')
    assert.ok(['甲一', '甲二'].includes((await clientA.state()).body.state.pig.name))
    assert.equal((await clientA.reconnect()).body.nextSequence, 2)

    const renameA = await clientA.command('name 甲新')
    assert.equal(renameA.status, 200)
    assert.equal(renameA.body.ok, true, JSON.stringify(renameA.body))
    assert.equal((await clientA.state()).body.state.pig.name, '甲新')
    assert.equal((await clientB.state()).body.state.pig.name, '乙', 'client A cannot rename client B target')

    dropNextCommandResponse = true
    await assert.rejects(clientA.command('buy apple', 'request-buy-001'), /simulated connection loss/)
    const resumed = await clientA.reconnect()
    assert.equal(resumed.status, 200)
    const replay = await clientA.retry('request-buy-001')
    assert.equal(replay.status, 200)
    const stateAfterRetryA = await clientA.state(), stateAfterRetryB = await clientB.state()
    assert.equal(stateAfterRetryA.body.state.pig.coins, 494, 'lost-response retry does not apply purchase twice')
    assert.equal(stateAfterRetryB.body.state.pig.coins, 494, 'both targets see shared owner money')
    assert.equal(stateAfterRetryA.body.state.pig.name, '甲新')
    assert.equal(stateAfterRetryB.body.state.pig.name, '乙')
    await clientA.close()
    await assert.rejects(clientA.state(), /not paired/, 'a closed client has discarded its token')
  } finally {
    if (server !== undefined) await server.close().catch(() => {})
    await runtime.dispose().catch(() => {})
  }
})
