// @ts-check
/** M2 opt-in integration contracts: a persisted owner, target-bound legacy APIs, and work receipts. */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { hatchEgg } from '../../../core.js'
import { createGameRuntime } from '../../../runtime/index.js'
import { inspectOwnerDocumentFile, writeOwnerDocumentFile } from '../../../runtime/owner-document-file.js'
import { writeWorkJson } from '../../../runtime/work-files.js'
import { splitLegacyState } from '../../../store/legacy-projection.js'
import { serializeOwnerDocument } from '../../../store/owner-document.js'
import { apply as applyDsh } from '../../../adapters/dsh/index.js'
import { startHost } from '../../../apps/desktop/lib/host.js'

const NOW = Date.now()
const ROOT = fileURLToPath(new URL('../../..', import.meta.url))

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-piggy-m2-owner-'))
  const legacyPath = join(directory, 'legacy-v15.json')
  const ownerDocumentPath = join(directory, 'owner-document.json')
  const state = hatchEgg(NOW)
  state.name = '甲'
  state.coins = 500
  state.inventory = { apple: 0 }
  state.extData = { farm: { version: 5, plots: [], seeds: {}, harvest: {} } }
  state.economy = { ...(state.economy ?? {}), fatigue: 0.2 }
  writeFileSync(legacyPath, JSON.stringify(state))
  return { directory, legacyPath, ownerDocumentPath, sourceBytes: readFileSync(legacyPath) }
}

function open(f, pigId = 'pig-a') {
  return createGameRuntime({
    statePath: f.ownerDocumentPath,
    ownerDocumentPath: f.ownerDocumentPath,
    legacyStatePath: f.legacyPath,
    ownerId: 'owner-local',
    pigId,
    now: () => Date.now(),
  })
}

test('opt-in migration preserves v15 bytes; bound sessions share owner commands but isolate pig body across restart', async t => {
  const f = fixture()
  t.after(() => rmSync(f.directory, { recursive: true, force: true }))
  const first = open(f)
  try {
    assert.deepEqual(readFileSync(f.legacyPath), f.sourceBytes, 'migration must leave the v15 source byte-for-byte unchanged')
    const sessionA = first.session
    const bodyB = structuredClone(splitLegacyState(first.store.state).body)
    bodyB.name = '乙'
    bodyB.ageMs = 1234
    const sessionB = first.addPigTarget('pig-b', bodyB)
    assert.equal(first.dispatchCommand('pig', 'name 甲新', sessionA).kind, 'success')
    assert.equal(first.dispatchCommand('pig', 'buy apple', sessionA).kind, 'success')

    const storeA = first.storeForSession(sessionA)
    const storeB = first.storeForSession(sessionB)
    assert.equal(storeA.state.name, '甲新')
    assert.equal(storeB.state.name, '乙')
    assert.equal(storeB.state.ageMs, 1234)
    assert.equal(storeA.state.coins, storeB.state.coins)
    assert.equal(storeA.state.inventory.apple, storeB.state.inventory.apple)
    assert.deepEqual(storeA.state.extData.farm, storeB.state.extData.farm)

    const stateResponseA = await first.handle('GET', '/dsh-piggy/state', undefined, sessionA)
    const stateResponse = await first.handle('GET', '/dsh-piggy/state', undefined, sessionB)
    assert.equal(stateResponse.status, 200)
    assert.equal(stateResponseA.headers['x-dsh-pig-id'], 'pig-a')
    assert.equal(stateResponse.headers['x-dsh-owner-id'], 'owner-local')
    assert.equal(stateResponse.headers['x-dsh-pig-id'], 'pig-b', 'the response carries this request binding, not a process-global target')
    const stateView = JSON.parse(String(stateResponse.body))
    assert.equal(Object.hasOwn(stateView, 'ownerId'), false, 'identity metadata does not change the legacy state body')
    assert.equal(stateView.pig.name, '乙', 'legacy /state route is bound to the supplied target session')
    const actResponse = await first.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'feed' }), sessionB)
    assert.equal(actResponse.status, 200)
    assert.equal(JSON.parse(String(actResponse.body)).pig.name, '乙', 'legacy /act request and snapshot shape remain unchanged')

    storeA.reset()
    assert.equal(storeA.state.coins, storeB.state.coins, 'reset changes this body, not owner coins')
    assert.deepEqual(storeA.state.inventory, storeB.state.inventory, 'reset keeps the shared inventory')
    assert.deepEqual(storeA.state.extData.farm, storeB.state.extData.farm, 'reset keeps shared farm data')
    assert.equal(storeB.state.name, '乙', 'reset cannot replace a sibling body')

    const coinsBeforeAdopt = storeA.state.coins
    const inventoryBeforeAdopt = structuredClone(storeA.state.inventory)
    const farmBeforeAdopt = structuredClone(storeA.state.extData.farm)
    storeA.mutate(live => { live.dead = true; return { ok: true } })
    assert.equal(storeA.adopt(), true)
    assert.equal(storeA.state.coins, coinsBeforeAdopt, 'adopt keeps owner coins')
    assert.deepEqual(storeA.state.inventory, inventoryBeforeAdopt, 'adopt keeps owner inventory')
    assert.deepEqual(storeA.state.extData.farm, farmBeforeAdopt, 'adopt keeps the owner farm')
    assert.equal(storeB.state.name, '乙', 'adopt cannot replace a sibling body')
  } finally {
    await first.dispose().catch(() => {})
  }

  const reopened = createGameRuntime({ statePath: f.ownerDocumentPath, ownerDocumentPath: f.ownerDocumentPath, pigId: 'pig-b', now: () => Date.now() })
  try {
    const sessionA = reopened.openPigSession('pig-a', { kind: 'embedded', origin: 'test-a' })
    const storeA = reopened.storeForSession(sessionA)
    const storeB = reopened.store
    assert.equal(storeB.state.name, '乙')
    assert.equal(storeA.state.coins, storeB.state.coins)
    assert.equal(storeA.state.inventory.apple, storeB.state.inventory.apple)
    assert.deepEqual(storeA.state.extData.farm, storeB.state.extData.farm)
    const inspected = inspectOwnerDocumentFile(f.ownerDocumentPath)
    assert.equal(inspected.kind, 'owner-document')
    if (inspected.kind === 'owner-document') assert.deepEqual(inspected.document.pigs.map(pig => pig.pigId), ['pig-a', 'pig-b'])
  } finally {
    await reopened.dispose()
  }
})

test('owner pig creation projects only a fresh pig body and persists shared resources once', async t => {
  const f = fixture()
  t.after(() => rmSync(f.directory, { recursive: true, force: true }))
  const runtime = open(f, 'pig-a')
  let pigB
  try {
    runtime.store.mutate(live => {
      live.coins = 1234
      live.inventory = { apple: 3 }
      live.extData = { farm: { version: 6, plots: [{ plantedAt: NOW, crop: 'apple' }], seeds: { apple: 4 }, harvest: {} } }
      return { ok: true }
    })
    const before = structuredClone(runtime.store.state)
    assert.deepEqual(runtime.listPigTargets().pigs.map(pig => pig.pigId), ['pig-a'])
    assert.throws(() => runtime.createPigTarget('pig-a'), /new pigId must be explicit and unused/)
    assert.deepEqual(runtime.listPigTargets().pigs.map(pig => pig.pigId), ['pig-a'], 'a duplicate identity cannot append or replace a target')

    const created = runtime.createPigTarget('pig-b')
    assert.equal(created.ownerId, 'owner-local')
    assert.deepEqual(created.pig, {
      pigId: 'pig-b', name: '猪猪', hatched: false, dead: false, stage: 'box', activity: null,
    })
    const sessionB = runtime.openPigSession('pig-b', { kind: 'embedded', origin: 'new-pig-test' })
    pigB = runtime.storeForSession(sessionB)
    assert.equal(pigB.state.name, '猪猪')
    assert.equal(pigB.state.hatched, false)
    assert.equal(pigB.state.coins, 1234)
    assert.deepEqual(pigB.state.inventory, { apple: 3 })
    assert.deepEqual(pigB.state.extData.farm, before.extData.farm)
    assert.equal(runtime.store.state.name, '甲', 'creating a sibling must not alter the current body')

    pigB.mutate(live => { live.name = '乙'; live.ageMs = 987; return { ok: true } })
    assert.equal(runtime.store.state.name, '甲')
    assert.equal(pigB.state.name, '乙')
    assert.equal(pigB.state.ageMs, 987)
    assert.equal(runtime.store.state.coins, 1234)
    assert.equal(pigB.state.coins, 1234)

    const saved = inspectOwnerDocumentFile(f.ownerDocumentPath)
    assert.equal(saved.kind, 'owner-document')
    if (saved.kind !== 'owner-document') throw new Error('expected owner document')
    const savedPig = saved.document.pigs.find(pig => pig.pigId === 'pig-b')
    assert.ok(savedPig)
    assert.equal(Object.hasOwn(savedPig.body, 'coins'), false)
    assert.equal(Object.hasOwn(savedPig.body, 'inventory'), false)
    assert.equal(Object.hasOwn(savedPig.body, 'extData'), false)
    assert.deepEqual(saved.document.resources.inventory, { apple: 3 })
    assert.equal(saved.document.resources.coins, 1234)
    assert.deepEqual(saved.document.resources.extData.farm, before.extData.farm)
  } finally {
    await runtime.dispose()
  }

  const reopened = open(f, 'pig-b')
  try {
    assert.equal(reopened.store.state.name, '乙')
    assert.equal(reopened.store.state.ageMs, 987)
    assert.equal(reopened.store.state.coins, 1234)
    assert.deepEqual(reopened.store.state.inventory, { apple: 3 })
    assert.deepEqual(reopened.listPigTargets().pigs.map(pig => pig.pigId), ['pig-a', 'pig-b'])
  } finally { await reopened.dispose() }
})

test('hatch of an explicit box target cannot award shared starting resources again', async t => {
  const f = fixture()
  t.after(() => rmSync(f.directory, { recursive: true, force: true }))
  const legacy = JSON.parse(readFileSync(f.legacyPath, 'utf8'))
  legacy.hatched = false
  legacy.coins = 765
  legacy.inventory.apple = 4
  writeFileSync(f.legacyPath, JSON.stringify(legacy))
  const runtime = open(f)
  try {
    const coins = runtime.store.state.coins
    const inventory = structuredClone(runtime.store.state.inventory)
    assert.equal(runtime.store.hatch(), true)
    assert.equal(runtime.store.state.hatched, true)
    assert.equal(runtime.store.state.coins, coins)
    assert.deepEqual(runtime.store.state.inventory, inventory)
  } finally {
    await runtime.dispose()
  }
})

test('owner work receipt dedupe is target-scoped and flat archive/cloud routes fail closed', async t => {
  const f = fixture()
  t.after(() => rmSync(f.directory, { recursive: true, force: true }))
  const runtime = open(f)
  try {
    const bodyB = structuredClone(splitLegacyState(runtime.store.state).body)
    bodyB.name = '乙'
    const sessionB = runtime.addPigTarget('pig-b', bodyB)
    const sessionA = runtime.session
    const event = { version: 1, source: 'dsh', id: 'same-event', type: 'message', at: NOW }
    assert.equal(runtime.acceptWorkEvent(event, sessionA).status, 'applied')
    assert.equal(runtime.acceptWorkEvent(event, sessionB).status, 'applied', 'same source/id on another pig has its own receipt partition')
    assert.equal(runtime.acceptWorkEvent(event, sessionA).status, 'duplicate')

    const response = await runtime.handle('GET', '/dsh-piggy/save/export')
    assert.equal(response.status, 409)
    assert.deepEqual(JSON.parse(String(response.body)), {
      ok: false,
      error: 'owner-document mode does not support flat archive or cloud operations',
    })
  } finally {
    await runtime.dispose()
  }
})

test('work WAL replays from before-document and finalizes a receipt after document commit', async t => {
  const f = fixture()
  t.after(() => rmSync(f.directory, { recursive: true, force: true }))
  const first = open(f)
  const event = { version: 1, source: 'dsh', id: 'recover-me', type: 'message', at: NOW }
  const beforeStatus = inspectOwnerDocumentFile(f.ownerDocumentPath)
  assert.equal(beforeStatus.kind, 'owner-document')
  if (beforeStatus.kind !== 'owner-document') throw new Error('expected initial owner document')
  assert.equal(first.acceptWorkEvent(event, first.session).status, 'applied')
  const nextStatus = inspectOwnerDocumentFile(f.ownerDocumentPath)
  assert.equal(nextStatus.kind, 'owner-document')
  if (nextStatus.kind !== 'owner-document') throw new Error('expected committed owner document')
  const sessionId = first.session.id
  const generation = first.session.generation
  await first.dispose()

  const workDirectory = `${f.ownerDocumentPath}.work-events`
  const receiptPath = join(workDirectory, 'receipts.json')
  const walPath = join(workDirectory, 'transaction.json')
  const nextRevision = nextStatus.revision
  const wal = {
    version: 1,
    ownerId: 'owner-local',
    pigId: 'pig-a',
    sessionId,
    generation,
    event,
    receipt: { ...event, ownerId: 'owner-local', pigId: 'pig-a', disposition: 'applied' },
    beforeRevision: beforeStatus.revision,
    nextRevision,
    beforeDocument: beforeStatus.document,
    nextDocument: nextStatus.document,
  }

  writeOwnerDocumentFile({ filePath: f.ownerDocumentPath, document: beforeStatus.document, expectedRevision: nextRevision })
  try { unlinkSync(receiptPath) } catch (error) { if (error.code !== 'ENOENT') throw error }
  writeWorkJson(walPath, wal)
  const replayed = createGameRuntime({ statePath: f.ownerDocumentPath, ownerDocumentPath: f.ownerDocumentPath, pigId: 'pig-a', now: () => Date.now() })
  try {
    assert.equal(replayed.acceptWorkEvent(event, replayed.session).status, 'duplicate')
    const replayedStatus = inspectOwnerDocumentFile(f.ownerDocumentPath)
    assert.equal(replayedStatus.kind, 'owner-document')
    if (replayedStatus.kind !== 'owner-document') throw new Error('expected replayed owner document')
    assert.equal(replayedStatus.revision, nextRevision, 'before-document recovery commits exactly the recorded next document')
  } finally {
    await replayed.dispose()
  }

  try { unlinkSync(receiptPath) } catch (error) { if (error.code !== 'ENOENT') throw error }
  writeWorkJson(walPath, wal)
  const finalized = createGameRuntime({ statePath: f.ownerDocumentPath, ownerDocumentPath: f.ownerDocumentPath, pigId: 'pig-a', now: () => Date.now() })
  try {
    assert.equal(finalized.acceptWorkEvent(event, finalized.session).status, 'duplicate')
    const finalizedStatus = inspectOwnerDocumentFile(f.ownerDocumentPath)
    assert.equal(finalizedStatus.kind, 'owner-document')
    if (finalizedStatus.kind !== 'owner-document') throw new Error('expected finalized owner document')
    assert.equal(finalizedStatus.revision, nextRevision, 'after-document recovery only finalizes its target receipt')
  } finally {
    await finalized.dispose()
  }
})

test('foreign/stale sessions and a concurrent revision conflict cannot write a different owner', async t => {
  const left = fixture()
  const right = fixture()
  t.after(() => {
    rmSync(left.directory, { recursive: true, force: true })
    rmSync(right.directory, { recursive: true, force: true })
  })
  const leftRuntime = open(left)
  const rightRuntime = open(right)
  try {
    assert.throws(() => leftRuntime.dispatchCommand('pig', 'feed', rightRuntime.session), /session|runtime|owner/i)
    const external = inspectOwnerDocumentFile(left.ownerDocumentPath)
    assert.equal(external.kind, 'owner-document')
    if (external.kind !== 'owner-document') throw new Error('expected owner document')
    const changed = structuredClone(external.document)
    if (typeof changed.resources.coins !== 'number') throw new Error('expected numeric owner coins')
    changed.resources.coins += 1
    const { writeOwnerDocumentFile } = await import('../../../runtime/owner-document-file.js')
    writeOwnerDocumentFile({ filePath: left.ownerDocumentPath, document: changed, expectedRevision: external.revision })
    const before = readFileSync(left.ownerDocumentPath)
    const result = leftRuntime.store.buy('apple')
    assert.equal(result.ok, false, 'CAS failure must refuse the in-memory command')
    assert.deepEqual(readFileSync(left.ownerDocumentPath), before, 'stale in-memory runtime cannot overwrite the newer document')
    assert.throws(() => leftRuntime.dispatchCommand('pig', 'feed'), /faulted|closing|closed/i)
  } finally {
    await leftRuntime.dispose().catch(() => {})
    await rightRuntime.dispose()
  }
})

test('two opened owner runtimes share no stale mutable slot; only the winner of one revision may commit', async t => {
  const f = fixture()
  t.after(() => rmSync(f.directory, { recursive: true, force: true }))
  const first = open(f)
  const second = createGameRuntime({ statePath: f.ownerDocumentPath, ownerDocumentPath: f.ownerDocumentPath, pigId: 'pig-a', now: () => Date.now() })
  try {
    assert.equal(first.store.state.name, second.store.state.name)
    assert.equal(first.dispatchCommand('pig', 'name 甲先写入').kind, 'success')
    const committed = readFileSync(f.ownerDocumentPath)
    assert.throws(() => second.dispatchCommand('pig', 'name 乙陈旧写入'), /revision conflict/)
    assert.deepEqual(readFileSync(f.ownerDocumentPath), committed, 'stale runtime cannot overwrite the winning document revision')
    assert.throws(() => second.dispatchCommand('pig', 'feed'), /faulted|closing|closed/i)
  } finally {
    await first.dispose()
    await second.dispose()
  }
})

test('legacy v15 state route does not publish owner identity headers', async t => {
  const f = fixture()
  t.after(() => rmSync(f.directory, { recursive: true, force: true }))
  const runtime = createGameRuntime({ statePath: f.legacyPath, now: () => Date.now() })
  try {
    const response = await runtime.handle('GET', '/dsh-piggy/state')
    assert.equal(response.status, 200)
    assert.equal(response.headers['x-dsh-owner-id'], undefined)
    assert.equal(response.headers['x-dsh-pig-id'], undefined)
    assert.equal(JSON.parse(String(response.body)).pig.name, '甲')
  } finally { await runtime.dispose() }
})

test('DSH and Desktop explicit adapters retain the old state/act host contract', async t => {
  const dshFixture = fixture()
  const desktopFixture = fixture()
  t.after(() => {
    rmSync(dshFixture.directory, { recursive: true, force: true })
    rmSync(desktopFixture.directory, { recursive: true, force: true })
  })

  const injections = new Map()
  const handlers = []
  let effectFactory = null
  const dshContext = {
    on: (_event, handler) => handlers.push(handler),
    inject: (services, handler) => injections.set(services[0], handler),
    effect: handler => { effectFactory = handler },
  }
  applyDsh(dshContext, {
    ownerDocumentPath: join(dshFixture.directory, 'dsh-owner.json'),
    legacyStatePath: dshFixture.legacyPath,
    ownerId: 'dsh-owner',
    pigId: 'dsh-pig',
  })

  let registeredCommand = null
  injections.get('commands')({ commands: { register(definition) { registeredCommand = definition; return () => {} } } })
  const commandDefinition = registeredCommand
  if (commandDefinition === null) throw new Error('DSH owner opt-in did not register its legacy command')
  const routes = []
  const webServer = { register(route) { routes.push(route); return () => {} } }
  injections.get('webServer')({ webServer })
  assert.equal(commandDefinition.handler({ rawInput: 'name DSH猪' }).kind, 'success')

  async function request(route, method) {
    let status = 200
    let headers = {}
    let responseBody = ''
    const req = { method, url: '/dsh-piggy/state', async *[Symbol.asyncIterator]() {} }
    const res = {
      writeHead(code, extra) { status = code; headers = { ...headers, ...(extra ?? {}) } },
      setHeader(key, value) { headers[key.toLowerCase()] = String(value) },
      end(value) { responseBody = String(value ?? '') },
    }
    await route.handler(req, res)
    return { status, headers, body: responseBody }
  }
  const dshState = await request(routes.find(route => route.path === '/dsh-piggy/state'), 'GET')
  assert.equal(dshState.status, 200)
  assert.equal(dshState.headers['x-dsh-owner-id'], 'dsh-owner')
  assert.equal(dshState.headers['x-dsh-pig-id'], 'dsh-pig')
  assert.equal(JSON.parse(dshState.body).pig.name, 'DSH猪')
  const cleanupFactory = effectFactory
  if (cleanupFactory === null) throw new Error('DSH owner opt-in did not register cleanup')
  await cleanupFactory()()

  const desktopHost = await startHost(ROOT, desktopFixture.legacyPath, {
    ownerDocument: {
      ownerDocumentPath: join(desktopFixture.directory, 'desktop-owner.json'),
      legacyStatePath: desktopFixture.legacyPath,
      ownerId: 'desktop-owner',
      pigId: 'desktop-pig',
    },
  })
  try {
    const desktopState = await desktopHost.handle('GET', '/dsh-piggy/state')
    assert.equal(desktopState.status, 200)
    assert.equal(desktopState.headers['x-dsh-owner-id'], 'desktop-owner')
    assert.equal(desktopState.headers['x-dsh-pig-id'], 'desktop-pig')
    assert.equal(JSON.parse(String(desktopState.body)).pig.name, '甲')
  } finally {
    await desktopHost.dispose()
  }
})
