// @ts-check
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { request as httpsRequest } from 'node:https'
import { test } from 'node:test'

import { hatchEgg } from '../../core.js'
import { createGameRuntime } from '../../runtime/index.js'
import { splitLegacyState } from '../../store/legacy-projection.js'
import { apply } from '../../adapters/dsh/index.js'
import { createOwnerLanClient } from '../../runtime/owner-lan-client.js'
import { createDshOwnerCloudBridge } from '../../adapters/dsh/owner-cloud.js'

const NOW = Date.now()

function httpsFetch(ca) {
  return (input, init = {}) => new Promise((resolve, reject) => {
    const url = new URL(String(input))
    const request = httpsRequest(url, { method: init.method ?? 'GET', headers: init.headers ?? {}, ca,
      signal: init.signal, agent: false }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.once('end', () => resolve(new Response(Buffer.concat(chunks), {
        status: response.statusCode,
        headers: { 'content-type': response.headers['content-type'] ?? 'application/json' },
      })))
    })
    request.once('error', reject)
    if (init.body !== undefined) request.write(init.body)
    request.end()
  })
}

function createContext() {
  const routes = []
  let cleanup = null
  const webServer = { register(route) { routes.push(route); return () => { const index = routes.indexOf(route); if (index >= 0) routes.splice(index, 1) } } }
  const ctx = {
    on() {},
    inject(services, handler) {
      if (services[0] === 'webServer') handler({ webServer })
      else if (services[0] === 'commands') handler({ commands: { register() { return () => {} } } })
    },
    effect(effect) { cleanup = effect() },
  }
  return { ctx, routes, dispose: async () => { if (typeof cleanup === 'function') await cleanup() } }
}

async function requestRoute(route, method, path, value, address = '127.0.0.1') {
  const request = Readable.from(value === undefined ? [] : [Buffer.from(JSON.stringify(value))])
  request.method = method
  request.url = path
  request.headers = value === undefined ? { host: '127.0.0.1:4100' } : { host: '127.0.0.1:4100', 'content-type': 'application/json' }
  request.socket = { remoteAddress: address }
  const response = {
    headersSent: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true },
    end(text = '') { this.text = String(text) },
  }
  await route.handler(request, response)
  let body = null
  try { body = JSON.parse(response.text) } catch { /* non-json response is surfaced by status */ }
  return { status: response.status, body }
}

test('DSH OwnerDocument routes bind each request to its own pig; TLS pairing is explicit and loopback-controlled', async t => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-dsh-owner-control-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const legacyStatePath = join(root, 'legacy-v15.json')
  const ownerDocumentPath = join(root, 'owner', 'owner-document.json')
  const state = hatchEgg(NOW)
  state.name = '甲'
  state.coins = 900
  writeFileSync(legacyStatePath, JSON.stringify(state))
  let seed = createGameRuntime({ statePath: ownerDocumentPath, ownerDocumentPath, legacyStatePath,
    ownerId: 'owner-dsh', pigId: 'pig-a', now: () => NOW })
  const bodyB = splitLegacyState(seed.stateForSession(seed.session)).body
  bodyB.name = '乙'
  seed.addPigTarget('pig-b', bodyB)
  await seed.dispose()

  const networkDirectory = `${ownerDocumentPath}.network`
  mkdirSync(networkDirectory, { recursive: true, mode: 0o700 })
  writeFileSync(join(networkDirectory, 'tls.key'), readFileSync(new URL('../fixtures/owner-lan-tls/test-only.key', import.meta.url)), { mode: 0o600 })
  writeFileSync(join(networkDirectory, 'tls.crt'), readFileSync(new URL('../fixtures/owner-lan-tls/test-only.crt', import.meta.url)), { mode: 0o600 })
  const fixture = createContext()
  const previousDshHome = process.env.DSH_HOME
  process.env.DSH_HOME = join(root, 'isolated-dsh-home')
  try {
    apply(fixture.ctx, { ownerDocumentPath, legacyStatePath, ownerId: 'owner-dsh', pigId: 'pig-a',
      ownerNetwork: { enabled: true, listenAddress: '127.0.0.1', advertisedHost: '127.0.0.1' } })
  } finally {
    if (previousDshHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousDshHome
  }
  const control = fixture.routes.find(route => route.kind === 'prefix' && route.path === '/dsh-piggy/owner')
  assert.ok(control, 'owner control routes are registered only in explicit OwnerDocument mode')
  assert.equal((await requestRoute(control, 'GET', '/dsh-piggy/owner/pigs', undefined, '192.0.2.8')).status, 403,
    'owner control routes cannot be called from non-loopback clients')

  const [listA, listB] = await Promise.all([
    requestRoute(control, 'GET', '/dsh-piggy/owner/pigs/pig-a/state'),
    requestRoute(control, 'GET', '/dsh-piggy/owner/pigs/pig-b/state'),
  ])
  assert.equal(listA.status, 200)
  assert.equal(listB.status, 200)
  assert.equal(listA.body.pig.name, '甲')
  assert.equal(listB.body.pig.name, '乙')
  assert.equal(listA.body.pig.coins, 900)
  assert.equal(listB.body.pig.coins, 900, 'owner resources remain shared while each request has a fixed pig session')

  const rename = await requestRoute(control, 'POST', '/dsh-piggy/owner/pigs/pig-b/command', { input: 'name 乙新' })
  assert.equal(rename.status, 200)
  const afterA = await requestRoute(control, 'GET', '/dsh-piggy/owner/pigs/pig-a/state')
  const afterB = await requestRoute(control, 'GET', '/dsh-piggy/owner/pigs/pig-b/state')
  assert.equal(afterA.body.pig.name, '甲')
  assert.equal(afterB.body.pig.name, '乙新')

  const initialNetwork = await requestRoute(control, 'GET', '/dsh-piggy/owner/network/status')
  assert.equal(initialNetwork.body.running, false, 'config opt-in does not start a listener by itself')
  const started = await requestRoute(control, 'POST', '/dsh-piggy/owner/network/start')
  assert.equal(started.status, 200)
  assert.equal(started.body.protocol, 'https', 'DSH loads its TLS pair from the owner-network private directory')
  const invited = await requestRoute(control, 'POST', '/dsh-piggy/owner/network/invite', { pigId: 'pig-b' })
  assert.equal(invited.status, 200)
  assert.equal(invited.body.pigId, 'pig-b')
  assert.match(invited.body.invitation, /^[a-f0-9]{64}$/u)
  const client = createOwnerLanClient({ baseUrl: `https://${invited.body.host}:${invited.body.port}`,
    clientId: 'dsh-control-test', fetch: httpsFetch(readFileSync(join(networkDirectory, 'tls.crt'))) })
  try {
    assert.deepEqual(await client.pair(invited.body.invitation), { ownerId: 'owner-dsh', pigId: 'pig-b', nextSequence: 1 })
    const remoteState = await client.state()
    assert.equal(remoteState.status, 200)
    assert.equal(remoteState.body.state.pig.name, '乙新')
  } finally { await client.close() }

  const stopped = await requestRoute(control, 'POST', '/dsh-piggy/owner/network/stop')
  assert.equal(stopped.status, 200)
  assert.equal(stopped.body.running, false)
  await fixture.dispose()
})

test('DSH OwnerDocument cloud bridge delegates cloud-to-local to preview and persists local-to-cloud readiness', async t => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-dsh-owner-cloud-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const ownerDocumentPath = join(root, 'owner-document.json')
  const settings = { enabled: true, provider: 'github', remote: 'https://github.com/example/piggy.git', branch: 'main' }
  const calls = []
  const runtime = {
    metadata: () => ({ ownerId: 'owner-cloud' }),
    ownerCloudStatus: () => ({ enabled: true, ready: false, branch: 'main' }),
    async firstSyncCloud(direction) { calls.push(['first', direction]); return { ok: true, remoteHead: 'a'.repeat(40), created: true } },
    async configureCloudSave(value) { calls.push(['configure', value.syncReady, value.cloudBaseHead]); return { ok: true } },
    async ownerCloudHistory() { return { ok: true, commits: [] } },
  }
  const cloud = createDshOwnerCloudBridge({ readyDirectory: root, ownerId: 'owner-cloud', config: settings,
    restore: async () => ({ ok: true, token: 'restore-preview' }) })
  assert.equal(cloud.runtimeConfig().syncReady, false)
  assert.deepEqual(await cloud.firstSync(runtime, 'cloud-to-local'), { ok: true, token: 'restore-preview' },
    'cloud-to-local delegates to the validated copy-and-switch preview instead of refusing')
  assert.deepEqual(calls, [], 'cloud-to-local never writes a readiness marker or first-syncs in the other direction')
  const synced = await cloud.firstSync(runtime, 'local-to-cloud')
  assert.equal(synced.ok, true)
  assert.deepEqual(calls, [['first', 'local-to-cloud'], ['configure', true, 'a'.repeat(40)]])
  const reopened = createDshOwnerCloudBridge({ readyDirectory: root, ownerId: 'owner-cloud', config: settings })
  assert.equal(reopened.runtimeConfig().syncReady, true)
  assert.equal(reopened.runtimeConfig().cloudBaseHead, 'a'.repeat(40))
  assert.equal((await reopened.history(runtime)).ok, true)
})
