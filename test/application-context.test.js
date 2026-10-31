// @ts-check
/**
 * F01 应用上下文契约。
 *
 * 开发卡只授权编写回归用例，不授权执行；由独立验收按真实候选重新设计/运行。
 * 这里守住的是边界本身：目标猪/资源主人显式、句柄读 live 状态、不同 store
 * 不串、抛错命令仍回滚且不写盘。它不证明共享资源并发/故障回滚或联机功能。
 */
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createApi } from '../store/api.js'
import { createStore } from '../store.js'
import { createOwnerResources } from '../store/owner-resources.js'
import { createCommandContext } from '../store/command-context.js'
import { OWNER_RESOURCE_PATHS, PIG_BODY_PATHS, createApplicationContext } from '../store/target-context.js'

const NOW = 1_800_000_000_000

/** A minimal live-state holder with the same getter contract as createStore. */
function fakeStore(initial) {
  let state = initial
  return {
    get state() { return state },
    set state(next) { state = next },
  }
}

test('two application contexts keep separate owner, target and state', () => {
  const left = fakeStore({ name: '甲', coins: 10, inventory: { apple: 1 } })
  const right = fakeStore({ name: '乙', coins: 20, inventory: { apple: 2 } })
  const contextLeft = createApplicationContext({ getState: () => left.state, setState: next => { left.state = next }, now: () => NOW })
  const contextRight = createApplicationContext({ getState: () => right.state, setState: next => { right.state = next }, now: () => NOW })

  assert.notEqual(contextLeft.owner, contextRight.owner)
  assert.notEqual(contextLeft.target, contextRight.target)
  assert.notEqual(contextLeft.scope, contextRight.scope)
  assert.equal(contextLeft.owner.state, left.state)
  assert.equal(contextRight.owner.state, right.state)
  assert.notEqual(contextLeft.owner.state, contextRight.owner.state)
  assert.equal(contextLeft.target.owner, contextLeft.owner)
  assert.equal(contextRight.target.owner, contextRight.owner)
})

test('same-owner reads reuse the live state and declared resources without cloning', () => {
  const holder = fakeStore({ name: '甲', coins: 10, wallets: { farm: { balance: 3 } }, inventory: { apple: 1 }, extData: { farm: { plots: [] } } })
  const context = createApplicationContext({ getState: () => holder.state, setState: next => { holder.state = next }, now: () => NOW })
  const commands = createCommandContext({ context, commit: fn => fn(holder.state) })

  assert.equal(context.owner.state, holder.state)
  assert.equal(context.target.state, holder.state)
  assert.equal(context.state, holder.state)
  assert.equal(commands.readFor(context.scope), holder.state)
  for (const path of ['coins', 'wallets', 'inventory', 'extData.farm', 'economy.totals', 'economy.days', 'dress', 'achievements', 'fishing.bag']) {
    assert.ok(OWNER_RESOURCE_PATHS.includes(path), `owner path missing: ${path}`)
  }
  assert.ok(PIG_BODY_PATHS.includes('name'))
  assert.ok(PIG_BODY_PATHS.includes('economy.fatigue'))
  assert.ok(!PIG_BODY_PATHS.includes('coins'))
  assert.ok(!OWNER_RESOURCE_PATHS.includes('name'))

  const result = commands.runFor(context.scope, function (live, command) {
    assert.equal(arguments.length, 2)
    assert.equal(live, holder.state)
    assert.equal(command.scope, context.scope)
    assert.equal(command.now, context.now)
    live.coins += 1
    return { ok: true }
  })
  assert.deepEqual(result, { ok: true })
  assert.equal(holder.state.coins, 11)
  assert.equal(context.owner.state.coins, 11)
  assert.equal(context.target.state.coins, 11)
})

test('another owner/target scope is refused with no state change and no fallback', () => {
  const left = fakeStore({ name: '甲', coins: 10 })
  const right = fakeStore({ name: '乙', coins: 20 })
  const contextLeft = createApplicationContext({ getState: () => left.state, setState: next => { left.state = next }, now: () => NOW })
  const contextRight = createApplicationContext({ getState: () => right.state, setState: next => { right.state = next }, now: () => NOW })
  let commits = 0
  let executions = 0
  const commands = createCommandContext({
    context: contextLeft,
    commit: fn => { commits += 1; return fn(left.state) },
  })

  assert.throws(() => commands.readFor(contextRight.scope), /another pig or owner/)
  assert.throws(() => commands.runFor(contextRight.scope, () => { executions += 1; return { ok: true } }), /another pig or owner/)
  assert.equal(commits, 0)
  assert.equal(executions, 0)
  assert.equal(left.state.coins, 10)
  assert.equal(right.state.coins, 20)
  assert.throws(() => contextLeft.assertScope({ owner: contextLeft.owner, target: contextRight.target }), /another pig or owner/)
})

test('handles follow live replacement and null instead of keeping the old state', () => {
  const holder = fakeStore({ name: '旧', coins: 1 })
  const context = createApplicationContext({ getState: () => holder.state, setState: next => { holder.state = next }, now: () => NOW })
  const first = context.owner.state

  holder.state = { name: '新', coins: 2 }
  assert.notEqual(context.owner.state, first)
  assert.equal(context.owner.state.name, '新')
  assert.equal(context.target.state.coins, 2)
  assert.equal(context.target.present, true)

  holder.state = null
  assert.equal(context.owner.state, null)
  assert.equal(context.target.state, null)
  assert.equal(context.owner.present, false)
  assert.equal(context.target.present, false)
  assert.equal(createCommandContext({ context, commit: fn => fn(holder.state) }).readFor(context.scope), null)
})

test('legacy createApi control keeps working through the same boundary', () => {
  let state = { name: '旧调用', coins: 1 }
  const api = createApi({
    filePath: '',
    now: () => NOW,
    getState: () => state,
    setState: next => { state = next },
    scheduleSave: () => {},
    mutate: fn => {
      const before = structuredClone(state)
      try { return fn(state) } catch { state = before; return { ok: false, reason: 'error' } }
    },
    dispose: () => {},
  })
  assert.equal(api.state, state)
  let legacyArgCount = 0
  assert.equal(api.mutate(function (...args) {
    legacyArgCount = args.length
    args[0].coins = 5
    return { ok: true }
  }).ok, true)
  assert.equal(legacyArgCount, 1)
  assert.equal(state.coins, 5)
  assert.equal(api.state, state)
})

test('kind-less and malformed scopes are refused before any read or commit', () => {
  const holder = fakeStore({ name: '甲', coins: 10 })
  const context = createApplicationContext({ getState: () => holder.state, setState: next => { holder.state = next }, now: () => NOW })
  let commits = 0
  let executions = 0
  const commands = createCommandContext({
    context,
    commit: fn => { commits += 1; return fn(holder.state) },
  })

  const malformed = [
    null,
    { owner: context.owner, target: context.target },
    { kind: 'other-scope', owner: context.owner, target: context.target },
  ]
  for (const candidate of malformed) {
    assert.throws(() => context.assertScope(candidate), /another pig or owner/)
    assert.throws(() => commands.readFor(candidate), /another pig or owner/)
    assert.throws(() => commands.runFor(candidate, () => { executions += 1; return { ok: true } }), /another pig or owner/)
  }
  assert.equal(commits, 0)
  assert.equal(executions, 0)
  assert.equal(holder.state.coins, 10)
})

test('public store.mutate keeps the legacy one-argument callback contract', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pig-app-context-'))
  const statePath = join(dir, 'state.json')
  const store = createStore(statePath, {
    now: () => NOW,
    setTimer: () => ({ unref() {} }),
    clearTimer: () => {},
  })
  try {
    assert.equal(store.hatch(), true)
    const live = store.state
    let calls = 0
    let seen = null
    const result = store.mutate(function (...args) {
      calls += 1
      assert.equal(args.length, 1)
      seen = args[0]
      seen.coins = 9
      return { ok: true }
    })
    assert.equal(calls, 1)
    assert.equal(seen, live)
    assert.equal(store.state, live)
    assert.deepEqual(result, { ok: true })
    assert.equal(store.state.coins, 9)
  } finally {
    store.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('createApi refuses partial pairs and mixed legacy/new controls, ignoring undefined placeholders', () => {
  const holder = fakeStore({ name: '甲', coins: 1 })
  const context = createApplicationContext({ getState: () => holder.state, setState: next => { holder.state = next }, now: () => NOW })
  const commands = createCommandContext({ context, commit: fn => fn(holder.state) })
  const base = { filePath: '', scheduleSave: () => {}, dispose: () => {} }
  const legacy = {
    now: () => NOW,
    getState: () => holder.state,
    setState: next => { holder.state = next },
    mutate: fn => fn(holder.state),
  }

  assert.throws(() => createApi({ ...base, application: context }), TypeError)
  assert.throws(() => createApi({ ...base, commands }), TypeError)

  const otherHolder = fakeStore({ name: '乙', coins: 2 })
  const otherContext = createApplicationContext({ getState: () => otherHolder.state, setState: next => { otherHolder.state = next }, now: () => NOW })
  const otherCommands = createCommandContext({ context: otherContext, commit: fn => fn(otherHolder.state) })
  assert.throws(() => createApi({ ...base, application: context, commands: otherCommands }), /different stores/)

  for (const field of ['now', 'getState', 'setState', 'mutate']) {
    assert.throws(
      () => createApi({ ...base, application: context, commands, [field]: legacy[field] }),
      /legacy/,
    )
  }

  assert.doesNotThrow(() => createApi({
    ...base,
    now: undefined,
    getState: undefined,
    setState: undefined,
    mutate: undefined,
    application: context,
    commands,
  }))
  assert.doesNotThrow(() => createApi({ ...base, ...legacy, application: undefined, commands: undefined }))
})

test('a real store keeps public behavior after hatch, replacement and absent state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pig-app-context-'))
  const statePath = join(dir, 'state.json')
  let scheduled = 0
  const store = createStore(statePath, {
    now: () => NOW,
    setTimer: () => { scheduled += 1; return { unref() {} } },
    clearTimer: () => {},
  })
  try {
    assert.equal(store.hatch(), true)
    const first = store.state
    assert.equal(first.hatched, true)
    assert.equal(scheduled, 1)

    const next = structuredClone(first)
    next.name = '导入后的猪'
    next.coins = 42
    store.installCommittedState(next)
    assert.equal(store.state, next)
    assert.equal(store.state.name, '导入后的猪')
    assert.equal(store.mutate(live => { live.name = '改名'; return { ok: true } }).ok, true)
    assert.equal(next.name, '改名')
    assert.notEqual(first.name, '改名')

    store.installCommittedState(null)
    assert.equal(store.state, null)
    assert.deepEqual(store.act('pet'), { ok: false, reason: 'absent' })
    assert.equal(store.freshen(), null)
    assert.deepEqual(store.feed('message'), [])
  } finally {
    store.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a thrown command rolls back, does not schedule a save, and leaves the file untouched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pig-app-context-'))
  const statePath = join(dir, 'state.json')
  let scheduled = 0
  const store = createStore(statePath, {
    now: () => NOW,
    setTimer: () => { scheduled += 1; return { unref() {} } },
    clearTimer: () => {},
  })
  try {
    store.hatch()
    store.flush()
    const before = structuredClone(store.state)
    const scheduledBefore = scheduled
    const patch = { satiety: 11 }
    Object.defineProperty(patch, 'traits', { get() { throw new Error('boom') }, enumerable: true })

    assert.equal(store.dev(patch), false)
    assert.deepEqual(store.state, before)
    assert.equal(scheduled, scheduledBefore)

    const result = store.mutate(() => { throw new Error('context command failed') })
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'error')
    assert.deepEqual(store.state, before)
    assert.equal(scheduled, scheduledBefore)

    const thenable = store.mutate(() => Promise.resolve({ ok: true }))
    assert.equal(thenable.ok, false)
    assert.equal(thenable.reason, 'error')
    assert.deepEqual(store.state, before)
    assert.equal(scheduled, scheduledBefore)

    const saved = JSON.parse(readFileSync(statePath, 'utf8'))
    assert.equal(saved.satiety, before.satiety)
  } finally {
    store.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})


test('authority contexts share one owner but keep distinct targets and reject mixed legacy inputs', () => {
  const owner = createOwnerResources()
  const targetA = owner.mountLegacyTarget({ version: 15, name: '甲', hatched: true, coins: 10 })
  const bodyB = structuredClone(targetA.body)
  bodyB.name = '乙'
  const targetB = owner.attachPig({ body: bodyB })
  const contextA = createApplicationContext({ owner, target: targetA, now: () => NOW })
  const contextB = createApplicationContext({ owner, target: targetB, now: () => NOW })

  assert.equal(contextA.owner.state.coins, 10)
  assert.equal(contextA.owner.state.name, undefined, 'owner state does not expose the whole pig')
  assert.equal(contextA.target.body.name, '甲')
  assert.equal(contextB.target.body.name, '乙')
  assert.equal(contextA.state.coins, contextB.state.coins)
  assert.throws(
    () => createApplicationContext({ owner, target: targetA, now: () => NOW, getState: () => targetA.state }),
    /refuses legacy/,
  )
  assert.throws(() => contextA.assertScope(contextB.scope), /another pig or owner/)

  owner.releaseTarget(targetA)
  owner.releaseTarget(targetB)
  owner.dispose()
})
