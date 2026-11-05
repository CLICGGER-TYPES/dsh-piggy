// @ts-check
/**
 * F06 session boundary: explicit runtime/external bindings, stale/disposed
 * rejection before save/ledger mutation, paused-source fingerprint guards and
 * the single-target persistence limit.
 *
 * Author-only in this source handoff: the developer did not execute it.
 * Independent V06/PI-08 should run it on the frozen candidate together with its
 * own critical cases.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg, migrate } from '../../src/host/core.js'
import { createGameRuntime } from '../../runtime/index.js'
import {
  FLAT_PERSISTENCE, SESSION_BOUNDARY, assertLiveSession, createFrozenSourceBinding, createSessionBinding,
  persistenceIssue, sessionOf,
} from '../../runtime/session-context.js'
import { stateFingerprint } from '../../adapters/dsh/external-files.js'
import { preparePausedSource } from '../../adapters/dsh/external-prepare.js'
import { pendingMergeConfig } from '../../adapters/dsh/external-lifecycle.js'

const BASE = 1_800_000_000_000
const event = (id, at = BASE) => ({ version: 1, source: 'dsh', id, type: 'turn', at })
const fresh = () => migrate(hatchEgg(BASE), BASE)
const temp = () => mkdtempSync(join(tmpdir(), 'piggy-session-'))
const read = path => JSON.parse(readFileSync(path, 'utf8'))

function statePathFor(dir, name) {
  const path = join(dir, `${name}.json`)
  writeFileSync(path, JSON.stringify(fresh()))
  return path
}

test('foreign live runtime binding is rejected before ledger/state mutation; own binding applies and replays', () => {
  const dir = temp()
  const pathA = statePathFor(dir, 'a')
  const pathB = statePathFor(dir, 'b')
  const a = createGameRuntime({ statePath: pathA, now: () => BASE })
  const b = createGameRuntime({ statePath: pathB, now: () => BASE })
  try {
    const sessionA = sessionOf(a)
    assert.equal(sessionA.kind, 'session-binding')
    assert.equal(sessionA.scope, 'host-runtime')
    assert.equal(sessionA.transport.kind, 'embedded')
    assert.equal(sessionA.transport.origin, 'in-process')
    assert.equal(typeof sessionA.id, 'string')
    assert.equal(sessionA.owner, sessionA.application.owner)
    assert.equal(sessionA.target, sessionA.application.target)
    assert.equal(sessionA.commandScope, sessionA.commands.scope)

    // Forging a plain object with copied metadata/methods is not an issued session.
    const forged = { ...sessionA, assertLive: () => forged }
    assert.equal(forged.kind, 'session-binding')
    assert.throws(() => assertLiveSession(forged, {}), error => error.code === SESSION_BOUNDARY.FOREIGN)
    assert.throws(
      () => b.acceptWorkEvent(event('turn:forged'), forged),
      error => error.code === SESSION_BOUNDARY.FOREIGN,
    )
    // Even a freshly issued binding that copies A's application/runtime metadata
    // is not A's own runtime handle and must not act on A.
    const minted = createSessionBinding({
      scope: 'host-runtime',
      transport: { kind: 'embedded', origin: 'in-process' },
      application: sessionA.application,
      commands: sessionA.commands,
      runtimeId: sessionA.runtimeId,
      generation: sessionA.generation,
    })
    assert.throws(
      () => a.acceptWorkEvent(event('turn:minted'), minted),
      error => error.code === SESSION_BOUNDARY.FOREIGN,
    )
    const capabilityOnly = createSessionBinding({
      scope: 'external-controller',
      transport: { kind: 'loopback-pair', origin: '127.0.0.1' },
      capability: { kind: 'paused-save' },
    })
    assert.throws(
      () => a.acceptWorkEvent(event('turn:capability'), capabilityOnly),
      error => error.code === SESSION_BOUNDARY.STALE,
    )
    assert.throws(
      () => a.snapshotForWrite(capabilityOnly),
      error => error.code === SESSION_BOUNDARY.STALE,
    )

    const beforeA = readFileSync(pathA, 'utf8')
    assert.throws(() => b.acceptWorkEvent(event('turn:foreign'), sessionA), error => error.code === SESSION_BOUNDARY.STALE)
    assert.equal(readFileSync(pathA, 'utf8'), beforeA, 'foreign binding must not touch A save')
    assert.equal(existsSync(`${pathA}.work-events/receipts.json`), false, 'foreign binding must not write receipts')

    const beforeB = readFileSync(pathB, 'utf8')
    assert.throws(() => b.dispatchCommand('pig', 'name 新名字', sessionA), error => error.code === SESSION_BOUNDARY.STALE)
    assert.equal(readFileSync(pathB, 'utf8'), beforeB, 'foreign binding must not rename B pig')

    assert.equal(a.acceptWorkEvent(event('turn:own'), sessionA).status, 'applied')
    assert.deepEqual(a.acceptWorkEvent(event('turn:own'), sessionA), { ok: true, status: 'duplicate', disposition: 'applied' })
  } finally {
    a.dispose()
    b.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('released target and disposed owner reject before ledger/WAL/state mutation', () => {
  const dir = temp()
  try {
    const statePath = join(dir, 'released.json')
    writeFileSync(statePath, JSON.stringify(fresh()))
    const runtime = createGameRuntime({ statePath, now: () => BASE })
    try {
      const issued = sessionOf(runtime)
      assert.equal(runtime.acceptWorkEvent(event('turn:live-before-release'), issued).status, 'applied')
      const before = readFileSync(statePath)
      const receiptsPath = `${statePath}.work-events/receipts.json`
      const walPath = `${statePath}.work-events/transaction.json`
      const receiptsBefore = existsSync(receiptsPath) ? readFileSync(receiptsPath) : null
      const walBefore = existsSync(walPath) ? readFileSync(walPath) : null
      issued.application.owner.releaseTarget(issued.target)
      const unusable = fn => assert.throws(fn, error => error.code === SESSION_BOUNDARY.TARGET_UNUSABLE)
      unusable(() => runtime.acceptWorkEvent(event('turn:released-explicit'), issued))
      unusable(() => runtime.acceptWorkEvent(event('turn:released-default')))
      unusable(() => runtime.dispatchCommand('pig', 'help', issued))
      unusable(() => runtime.snapshotForWrite(issued))
      unusable(() => runtime.prepareMerge('activity', issued))
      assert.deepEqual(readFileSync(statePath), before, 'released target must not rewrite the save')
      assert.deepEqual(existsSync(receiptsPath) ? readFileSync(receiptsPath) : null, receiptsBefore, 'released target must not write receipts')
      assert.deepEqual(existsSync(walPath) ? readFileSync(walPath) : null, walBefore, 'released target must not write a work WAL')
    } finally { runtime.dispose() }

    const disposedPath = join(dir, 'disposed.json')
    writeFileSync(disposedPath, JSON.stringify(fresh()))
    const second = createGameRuntime({ statePath: disposedPath, now: () => BASE })
    try {
      const issued = sessionOf(second)
      issued.application.owner.dispose()
      const before = readFileSync(disposedPath)
      assert.throws(
        () => second.acceptWorkEvent(event('turn:owner-disposed'), issued),
        error => error.code === SESSION_BOUNDARY.TARGET_UNUSABLE,
      )
      assert.deepEqual(readFileSync(disposedPath), before, 'disposed owner must not rewrite the save')
      assert.equal(existsSync(`${disposedPath}.work-events/receipts.json`), false, 'disposed owner must not write receipts')
    } finally { second.dispose() }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('runtime restart disposes the old generation binding; a closed runtime still reports closed', () => {
  const dir = temp()
  const statePath = statePathFor(dir, 'restart')
  const runtime = createGameRuntime({ statePath, now: () => BASE })
  try {
    const old = sessionOf(runtime)
    runtime.restart()
    const current = sessionOf(runtime)
    assert.notEqual(current.id, old.id)
    assert.notEqual(current.runtimeId, old.runtimeId)
    assert.equal(old.disposed, true)
    assert.equal(current.disposed, false)
    assert.throws(() => old.assertLive(), error => error.code === SESSION_BOUNDARY.DISPOSED)
    assert.throws(() => assertLiveSession(old, {}), error => error.code === SESSION_BOUNDARY.DISPOSED)
    assert.throws(
      () => runtime.acceptWorkEvent(event('turn:stale-after-restart'), old),
      error => error.code === SESSION_BOUNDARY.DISPOSED,
    )
    assert.equal(runtime.acceptWorkEvent(event('turn:current-after-restart'), current).status, 'applied')
    runtime.dispose()
    assert.throws(() => runtime.acceptWorkEvent(event('turn:after-close'), current), /closed/)
    assert.equal(current.disposed, true)
  } finally {
    runtime.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('prepareMerge runs through the owner transaction and rejects a foreign binding before ending the activity', async () => {
  const dir = temp()
  const state = fresh()
  state.activity = { kind: 'work', key: 'bricks', label: '搬砖', startedAt: BASE, endsAt: BASE + 3_600_000, cost: 0 }
  const statePath = join(dir, 'merge.json')
  writeFileSync(statePath, JSON.stringify(state))
  const otherPath = statePathFor(dir, 'other')
  const runtime = createGameRuntime({ statePath, now: () => BASE })
  const other = createGameRuntime({ statePath: otherPath, now: () => BASE })
  try {
    assert.equal(runtime.view(false).activity?.kind, 'work')
    assert.throws(
      () => runtime.prepareMerge('activity', sessionOf(other)),
      error => error.code === SESSION_BOUNDARY.STALE,
    )
    assert.equal(runtime.view(false).activity?.kind, 'work', 'stale binding must not end the activity')

    const ended = await runtime.prepareMerge('activity', sessionOf(runtime))
    assert.equal(ended.ok, true)
    assert.equal(ended.alreadyFinished, false)
    assert.equal(runtime.view(false).activity, null)
    assert.equal(read(statePath).activity, null, 'the owner transaction result is persisted by the existing flush')
  } finally {
    runtime.dispose()
    other.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('frozen source fingerprints and explicit persistence authority are the only capabilities', () => {
  const session = createSessionBinding({
    scope: 'external-controller',
    transport: { kind: 'loopback-pair', origin: '127.0.0.1' },
    capability: { kind: 'test-host', statePath: '/tmp/piggy-test-state.json' },
  })
  const state = fresh()
  const fingerprint = stateFingerprint(state, [])
  const source = createFrozenSourceBinding({
    session, statePath: '/tmp/piggy-test-state.json', stateHash: fingerprint, suspendedAt: BASE, mergeId: null,
  })
  try {
    assert.equal(source.assertMatches({ statePath: '/tmp/piggy-test-state.json', fingerprint }), source)
    assert.throws(
      () => source.assertMatches({ statePath: '/tmp/piggy-test-state.json', fingerprint: 'changed' }),
      error => error.code === SESSION_BOUNDARY.SOURCE_CHANGED,
    )
    assert.throws(
      () => source.assertMatches({ statePath: '/tmp/another.json', fingerprint }),
      error => error.code === SESSION_BOUNDARY.FOREIGN,
    )
    const noPrint = createFrozenSourceBinding({
      session, statePath: '/tmp/piggy-no-print.json', stateHash: null, suspendedAt: BASE, mergeId: null,
    })
    assert.throws(
      () => noPrint.assertMatches({ statePath: '/tmp/piggy-no-print.json', fingerprint }),
      error => error.code === SESSION_BOUNDARY.SOURCE_CHANGED,
    )

    assert.equal(persistenceIssue(null), null)
    assert.equal(persistenceIssue({ kind: FLAT_PERSISTENCE.LEGACY_SINGLE_TARGET }), null)
    assert.equal(persistenceIssue({ kind: 'multi-target' }), SESSION_BOUNDARY.UNSUPPORTED_PERSISTENCE)
    assert.equal(persistenceIssue({ kind: 'future-flat' }), SESSION_BOUNDARY.UNSUPPORTED_PERSISTENCE)

    assert.throws(
      () => createSessionBinding({
        scope: 'external-controller',
        transport: { kind: 'lan', origin: '0.0.0.0' },
        capability: { kind: 'future-lan' },
      }),
      error => error.code === SESSION_BOUNDARY.UNSUPPORTED_PERSISTENCE,
    )
  } finally {
    session.dispose()
    assert.throws(() => source.assertLive(), error => error.code === SESSION_BOUNDARY.DISPOSED)
  }
})

test('pending target merge blocks paused-source termination before write', async () => {
  assert.equal(pendingMergeConfig({ pigState: 'paused', connection: 'merging' }), true)
  assert.equal(pendingMergeConfig({ pigState: 'paused', connection: 'connected' }), false)
  assert.equal(pendingMergeConfig({ pigState: 'merge-unknown' }), true)
  assert.equal(pendingMergeConfig({ pigState: 'rolling-back' }), true)
  assert.equal(pendingMergeConfig(null), false)
  const dir = temp()
  try {
    const statePath = join(dir, 'pending.json')
    const base = migrate({
      ...fresh(),
      activity: { kind: 'work', key: 'bricks', label: '搬砖', startedAt: BASE, endsAt: BASE + 3_600_000, cost: 0 },
    }, BASE)
    const bytes = JSON.stringify(base)
    writeFileSync(statePath, bytes)
    let config = {
      version: 1, pigState: 'paused', connection: 'merging', clientId: 'pending-owner',
      suspendedAt: BASE, mergeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stateHash: stateFingerprint(base, []),
    }
    writeFileSync(`${statePath}.external-pet.json`, JSON.stringify(config))
    const session = createSessionBinding({
      scope: 'external-controller',
      transport: { kind: 'loopback-pair', origin: '127.0.0.1' },
      capability: { kind: 'pending-merge-source', statePath },
    })
    const ctx = {
      statePath,
      now: () => BASE,
      getMode: () => 'external',
      getPreview: () => null,
      getConfig: () => config,
      getSession: () => session,
      saveConfig: next => { config = { ...next, version: 1 }; writeFileSync(`${statePath}.external-pet.json`, JSON.stringify(config)); return config },
      sourceBinding: () => createFrozenSourceBinding({
        session, statePath, stateHash: config.stateHash, suspendedAt: config.suspendedAt, mergeId: config.mergeId,
      }),
    }
    const result = await preparePausedSource(ctx, 'activity')
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'busy')
    assert.equal(readFileSync(statePath, 'utf8'), bytes, 'pending merge must not terminate or rewrite the source')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('paused source prepare rejects foreign config, changed file and explicit non-legacy authority before writing', async () => {
  const dir = temp()
  try {
    const statePath = join(dir, 'state.json')
    const configPath = `${statePath}.external-pet.json`
    const base = migrate({
      ...fresh(),
      activity: { kind: 'work', key: 'bricks', label: '搬砖', startedAt: BASE, endsAt: BASE + 3_600_000, cost: 0 },
    }, BASE)
    const originalBytes = JSON.stringify(base)
    writeFileSync(statePath, originalBytes)
    writeFileSync(configPath, JSON.stringify({
      version: 1, pigState: 'paused', clientId: 'session-owner', suspendedAt: BASE, mergeId: null,
      stateHash: stateFingerprint(base, []),
    }))

    const session = createSessionBinding({
      scope: 'external-controller',
      transport: { kind: 'loopback-pair', origin: '127.0.0.1' },
      capability: { kind: 'test-held-source', statePath },
    })
    let config = read(configPath)
    const ctx = {
      statePath,
      now: () => BASE,
      getMode: () => 'external',
      getPreview: () => null,
      getConfig: () => config,
      getSession: () => session,
      saveConfig: next => { config = { ...next, version: 1 }; writeFileSync(configPath, JSON.stringify(config)); return config },
      sourceBinding: () => createFrozenSourceBinding({
        session, statePath, stateHash: config.stateHash, suspendedAt: config.suspendedAt, mergeId: config.mergeId,
      }),
    }

    // 1) File changed behind the paused session: reject and leave the new bytes alone.
    const changed = { ...base, coins: 777 }
    writeFileSync(statePath, JSON.stringify(changed))
    const refused = await preparePausedSource(ctx, 'activity')
    assert.equal(refused.ok, false)
    assert.equal(refused.reason, SESSION_BOUNDARY.SOURCE_CHANGED)
    assert.equal(readFileSync(statePath, 'utf8'), JSON.stringify(changed), 'changed foreign bytes must not be overwritten')

    // 2) Put the frozen file back: the same context can end the activity once.
    writeFileSync(statePath, originalBytes)
    const ended = await preparePausedSource(ctx, 'activity')
    assert.equal(ended.ok, true, JSON.stringify(ended))
    assert.equal(read(statePath).activity, null)

    // 3) A different config owner must not write this paused file.
    writeFileSync(configPath, JSON.stringify({ ...read(configPath), clientId: 'another-owner' }))
    const foreign = await preparePausedSource(ctx, 'activity')
    assert.equal(foreign.ok, false)
    assert.equal(foreign.reason, SESSION_BOUNDARY.FOREIGN)

    // 4) Unknown legacy fields named like multi-target containers are opaque JSON,
    //    not a persistence authority; a matching frozen fingerprint still passes.
    const opaque = { ...read(statePath), pigs: [], pigTargets: {}, multiTarget: true }
    writeFileSync(statePath, JSON.stringify(opaque))
    config = { ...config, clientId: 'session-owner', stateHash: stateFingerprint(opaque, []) }
    writeFileSync(configPath, JSON.stringify(config))
    const opaqueAllowed = await preparePausedSource(ctx, 'activity')
    assert.equal(opaqueAllowed.ok, true, 'unknown legacy fields are not a reserved multi-target marker')
    assert.deepEqual(read(statePath).pigs, [])
    assert.deepEqual(read(statePath).pigTargets, {})

    // 4b) An explicitly declared non-legacy authority rejects before writing.
    ctx.persistence = () => ({ kind: 'multi-target' })
    const unsupported = await preparePausedSource(ctx, 'activity')
    assert.equal(unsupported.ok, false)
    assert.equal(unsupported.reason, SESSION_BOUNDARY.UNSUPPORTED_PERSISTENCE)
    assert.deepEqual(read(statePath).pigs, [])

    // 5) Disposed controller session cannot write either.
    session.dispose()
    const disposed = await preparePausedSource(ctx, 'activity')
    assert.equal(disposed.ok, false)
    assert.equal(disposed.reason, SESSION_BOUNDARY.DISPOSED)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
