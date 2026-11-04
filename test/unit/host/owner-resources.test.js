// @ts-check
/**
 * F02 owner-resource / pig-body / legacy-adapter contract.
 *
 * 开发卡只授权编写，不授权执行。这些用例是给独立 V02 的设计说明，不是验收
 * 证据；它们不启动产品、不跑 typecheck/build，也不声称多猪 UI/联机完成。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { ensureEconomy } from '../../../core.js'
import { createStore } from '../../../store.js'
import { createApi } from '../../../store/api.js'
import { createApplicationContext } from '../../../store/target-context.js'
import { createCommandContext } from '../../../store/command-context.js'
import { createOwnerResources } from '../../../store/owner-resources.js'
import { composeLegacyState, splitLegacyState } from '../../../store/legacy-state.js'
import { OWNER_RESOURCE_PATHS, PIG_BODY_PATHS } from '../../../store/state-ownership.js'

const NOW = 1_800_000_000_000

/** A valid-enough v15-shaped single-pig save: every current top-level path plus unknown data. */
function legacyState() {
  return {
    version: 15,
    name: '甲',
    bornAt: NOW,
    hatched: true,
    dead: false,
    diedAt: null,
    stage: 'piglet',
    form: null,
    skin: 'default',
    customSkins: [{ key: 'custom-a', name: 'A' }],
    bodyWeight: { playDay: '', plays: 0 },
    ageMs: 0,
    timeScale: 1,
    ageForced: false,
    xp: 10,
    weightG: 1300,
    satiety: 70,
    happiness: 70,
    cleanliness: 90,
    health: 5,
    criticalDoctorVisits: 0,
    coins: 500,
    inventory: { apple: 2 },
    isOfflineFeedEnabled: true,
    dress: ['hat'],
    worn: ['hat'],
    dex: { forms: {}, skins: {}, fish: {}, items: {}, souvenirs: {} },
    fishing: {
      pending: null,
      bag: [],
      seq: 0,
      autoDay: '',
      autoTrips: 0,
      rod: 1,
      spots: ['river'],
      spot: 'river',
      automation: { basket: 0, duration: 0, baitBox: 0, usedMs: 0, stock: [] },
      futureFishField: 'keep-me',
    },
    traits: { intel: 1, charm: 0, strong: 0 },
    lessons: {},
    interests: {},
    souvenirs: [],
    illness: null,
    activity: null,
    outingStreak: 0,
    restMinutes: 0,
    lastFedAt: 0,
    lastActiveAt: NOW,
    lastSeenAt: NOW,
    settledUpTo: null,
    cooldowns: {},
    pending: [],
    pendingSeq: 0,
    dialogue: { ownerName: '主人', quiet: false, lastByScene: {}, open: null, greetedAt: 0, talk: {}, petTimes: [], petAnnoyed: [] },
    memories: [],
    stats: { feeds: 1 },
    economy: { totals: { work: { in: 1, out: 0 } }, days: [], fatigue: 0.25, futureEconomyField: 'keep-economy' },
    wallets: { farm: { label: '菜币', emoji: '🥬', rate: 1, buyable: true, balance: 3 } },
    extensions: {},
    extensionsRemoved: [],
    extData: { farm: { version: 5, plots: [], seeds: {}, harvest: {} }, mine: { ore: 3 } },
    achievements: { unlocked: {}, totals: {}, seen: {}, events: {} },
    daily: { signIn: { lastDay: null, index: 0, total: 0, cycle7: true }, online: { day: null, onlineMs: 0, given: 0, unclaimed: 0 } },
    diary: { entries: [], today: { day: null, counts: {} } },
    pomodoro: { startedAt: null, minutes: null, todayDone: 0, day: null, restUntil: null, finishedAt: null, quietBefore: null },
    personality: 'gentle',
    catchphrase: '你好',
    motto: '慢慢来',
    birthday: null,
    profileEdits: 0,
    realWorkGrowth: { day: '', amount: 0 },
    seed: 123,
    legacyExtraTop: { keep: true },
  }
}

function oneOwner() {
  const owner = createOwnerResources()
  const target = owner.mountLegacyTarget(legacyState())
  return { owner, target }
}

function apiFor(owner, target, clock) {
  const context = createApplicationContext({ owner, target, now: () => clock.now })
  const commands = createCommandContext({
    context,
    commit: fn => owner.transact(target, fn),
  })
  return createApi({
    filePath: '',
    application: context,
    commands,
    scheduleSave: () => {},
    dispose: () => {},
  })
}

test('split/compose is lossless and keeps owner resources out of the pig body', () => {
  const original = legacyState()
  const parts = splitLegacyState(original)

  assert.equal(parts.resources.coins, 500)
  assert.equal(parts.resources.inventory.apple, 2)
  assert.equal(parts.resources.extData.farm.version, 5)
  assert.equal(parts.resources.extData.mine, undefined, 'unknown extData is not claimed as a shared resource')
  assert.equal(parts.opaque.extData.mine.ore, 3, 'unknown extData stays once in the owner legacy namespace')
  assert.equal(parts.resources.economy.totals.work.in, 1)
  assert.equal(parts.resources.fishing.bag.length, 0)
  assert.equal(parts.body.name, '甲')
  assert.equal(parts.body.economy.fatigue, 0.25)
  assert.equal(parts.body.fishing.pending, null)
  assert.equal(parts.body.fishing.spot, 'river')
  assert.equal(parts.body.coins, undefined)
  assert.equal(parts.body.inventory, undefined)
  assert.equal(parts.body.extData, undefined)
  assert.equal(parts.body.dress, undefined)
  assert.equal(parts.opaque.legacyExtraTop.keep, true)
  assert.equal(parts.opaque.economy.futureEconomyField, 'keep-economy')
  assert.equal(parts.opaque.fishing.futureFishField, 'keep-me')
  assert.deepEqual(composeLegacyState(parts), original)
  assert.deepEqual(OWNER_RESOURCE_PATHS.includes('coins'), true)
  assert.deepEqual(PIG_BODY_PATHS.includes('economy.fatigue'), true)
})

test('one owner shares resources while each pig keeps a separate body', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  bodyB.name = '乙'
  bodyB.economy.fatigue = 0.9
  const b = owner.attachPig({ body: bodyB })

  assert.equal(owner.state.coins, 500)
  assert.equal(a.state.coins, b.state.coins)
  assert.equal(a.state.inventory, b.state.inventory, 'both facades read one canonical inventory object')
  assert.notEqual(a.body, b.body)
  assert.equal(a.body.name, '甲')
  assert.equal(b.body.name, '乙')
  assert.equal(a.body.economy.fatigue, 0.25)
  assert.equal(b.body.economy.fatigue, 0.9)
  assert.equal(b.body.coins, undefined)
  assert.equal(b.state.extData.farm.version, 5)
  assert.equal(a.state.extData.mine.ore, 3, 'unknown extData remains visible through the legacy facade')
  assert.equal(owner.state.extData.mine, undefined, 'unknown extData is not exposed as owner resources')
})

test('a different owner is isolated', () => {
  const left = oneOwner()
  const right = oneOwner()
  left.target.state.coins = 111
  right.target.state.coins = 222
  assert.equal(left.owner.state.coins, 111)
  assert.equal(right.owner.state.coins, 222)
  assert.throws(() => left.owner.transact(right.target, live => { live.coins = 1; return { ok: true } }), /owner/)
  assert.equal(right.owner.state.coins, 222)
})

test('one transaction commits shared spend and pig body together; other pig body is untouched', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  bodyB.name = '乙'
  const b = owner.attachPig({ body: bodyB })

  const result = owner.transact(a, live => {
    live.coins -= 100
    live.name = '甲改'
    live.satiety = 33
    return { ok: true }
  })

  assert.deepEqual(result, { ok: true })
  assert.equal(a.state.coins, 400)
  assert.equal(b.state.coins, 400, 'B sees the same owner resources without a copy')
  assert.equal(a.state.name, '甲改')
  assert.equal(a.state.satiety, 33)
  assert.equal(b.state.name, '乙')
  assert.equal(b.state.satiety, 70)
})

test('owner-document body replacement preserves owner resources and sibling bodies, and rolls back on persistence failure', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  bodyB.name = '乙'
  bodyB.economy.fatigue = 0.9
  const b = owner.attachPig({ body: bodyB })
  const beforeA = structuredClone(a.body)
  const beforeB = structuredClone(b.body)
  const beforeCoins = owner.state.coins
  const beforeInventory = structuredClone(owner.state.inventory)

  const replacement = structuredClone(a.body)
  replacement.name = '甲重置'
  replacement.satiety = 12
  owner.replacePigBody(a, replacement)

  assert.equal(a.body.name, '甲重置')
  assert.equal(b.body.name, '乙')
  assert.equal(b.body.economy.fatigue, 0.9)
  assert.equal(owner.state.coins, beforeCoins)
  assert.deepEqual(owner.state.inventory, beforeInventory)

  const failedReplacement = structuredClone(a.body)
  failedReplacement.name = '不应提交'
  assert.throws(() => owner.replacePigBody(a, failedReplacement, () => { throw new Error('disk conflict') }), /disk conflict/)
  assert.deepEqual(a.body, { ...beforeA, name: '甲重置', satiety: 12 })
  assert.deepEqual(b.body, beforeB)
  assert.equal(owner.state.coins, beforeCoins)
  assert.deepEqual(owner.state.inventory, beforeInventory)
})

test('sequential operations cannot overspend one shared balance', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  const b = owner.attachPig({ body: bodyB })
  owner.transact(a, live => { live.coins = 700; return { ok: true } })

  const first = owner.transact(a, live => {
    if (live.coins < 600) return { ok: false, reason: 'poor' }
    live.coins -= 600
    return { ok: true }
  })
  const second = owner.transact(b, live => {
    if (live.coins < 600) return { ok: false, reason: 'poor' }
    live.coins -= 600
    return { ok: true }
  })

  assert.deepEqual(first, { ok: true })
  assert.deepEqual(second, { ok: false, reason: 'poor' })
  assert.equal(owner.state.coins, 100)
})

test('throw, thenable, foreign, reentrant and absent work never half-applies', async () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  bodyB.name = '乙'
  const b = owner.attachPig({ body: bodyB })
  const before = composeLegacyState(splitLegacyState(a.state))
  assert.equal(b.state.coins, 500)

  assert.throws(() => owner.transact(a, live => {
    live.coins += 10
    live.satiety = 1
    throw new Error('boom')
  }), /boom/)
  assert.deepEqual(composeLegacyState(splitLegacyState(a.state)), before)
  assert.equal(b.state.coins, 500)
  assert.equal(b.state.satiety, 70)

  assert.throws(() => owner.transact(a, live => {
    live.coins += 7
    return Promise.resolve({ ok: true })
  }), /thenable/)
  assert.deepEqual(composeLegacyState(splitLegacyState(a.state)), before)

  assert.throws(() => owner.transact(a, live => {
    owner.transact(a, inner => { inner.coins += 1; return { ok: true } })
    return { ok: true }
  }), /reentrant/)
  assert.deepEqual(composeLegacyState(splitLegacyState(a.state)), before)

  const empty = createOwnerResources()
  const absent = empty.mountLegacyTarget(null)
  assert.deepEqual(empty.transact(absent, () => { throw new Error('must not run') }), { ok: false, reason: 'absent' })

  const other = createOwnerResources()
  const otherTarget = other.mountLegacyTarget(legacyState())
  assert.throws(() => owner.transact(otherTarget, live => { live.coins = 0; return { ok: true } }), /owner/)
  assert.equal(other.state.coins, 500)

  await Promise.resolve()
})

test('release A does not destroy owner/B; owner dispose ends the explicit lifetime', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  bodyB.name = '乙'
  const b = owner.attachPig({ body: bodyB })

  a.release()
  a.release()
  assert.equal(a.present, false)
  assert.equal(b.present, true)
  assert.equal(owner.present, true)
  assert.equal(b.state.coins, 500)
  assert.throws(() => owner.transact(a, live => { live.coins = 0; return { ok: true } }), /released/)

  owner.dispose()
  assert.equal(owner.present, false)
  assert.equal(b.state, null)
  assert.throws(() => owner.transact(b, live => { live.coins = 0; return { ok: true } }), /disposed/)
})

test('attachPig does not reinitialize, copy or award shared resources', () => {
  const { owner, target: a } = oneOwner()
  const beforeCoins = owner.state.coins
  const beforeInventory = structuredClone(owner.state.inventory)
  const bodyB = structuredClone(a.body)
  bodyB.name = '乙'
  const b = owner.attachPig({ body: bodyB })

  assert.equal(owner.state.coins, beforeCoins, 'no second initial 500 coins')
  assert.deepEqual(owner.state.inventory, beforeInventory, 'no second starting inventory')
  assert.equal(b.body.coins, undefined)
  assert.equal(b.state.coins, beforeCoins)
  assert.equal(b.state.inventory, a.state.inventory)
  assert.throws(() => owner.attachPig({ body: legacyState() }), /only classified pig-body/)
})

test('legacy facade writes route to the canonical owner/body/mixed objects', () => {
  const { owner, target: a } = oneOwner()
  a.state.coins = 250
  a.state.name = '新名字'
  a.state.economy.fatigue = 0.5
  assert.equal(owner.state.coins, 250)
  assert.equal(a.body.name, '新名字')
  assert.equal(a.body.economy.fatigue, 0.5)

  a.state.economy = { totals: { shop: { in: 0, out: 2 } }, days: [], fatigue: 0.4, future: 'opaque' }
  assert.equal(owner.state.economy.totals.shop.out, 2)
  assert.equal(a.body.economy.fatigue, 0.4)
  assert.equal(a.state.economy.future, 'opaque')
  assert.equal(owner.state.economy.future, undefined)

  a.state.fishing = {
    pending: null,
    bag: [{ id: 'catch-1', key: 'crucian', sizeCm: 10, price: 5, caughtAt: NOW }],
    seq: 1,
    autoDay: '',
    autoTrips: 0,
    rod: 2,
    spots: ['river'],
    spot: 'river',
    automation: { basket: 0, duration: 0, baitBox: 0, usedMs: 0, stock: [] },
    future: 'opaque-fish',
  }
  assert.equal(owner.state.fishing.bag.length, 1)
  assert.equal(a.body.fishing.pending, null)
  assert.equal(a.state.fishing.future, 'opaque-fish')
  assert.equal(owner.state.fishing.future, undefined)
})

test('direct unknown facade fields are preserved as legacy-opaque, not guessed or cloned', () => {
  const { owner, target: a } = oneOwner()
  a.state.legacyTop = { keep: true }
  a.state.fishing.futureFishField2 = 'opaque-2'
  const live = a.state
  assert.deepEqual(live.legacyTop, { keep: true })
  assert.equal(live.fishing.futureFishField2, 'opaque-2')
  const parts = splitLegacyState(live)
  assert.deepEqual(parts.opaque.legacyTop, { keep: true })
  assert.equal(parts.opaque.fishing.futureFishField2, 'opaque-2')
  assert.equal(parts.body.coins, undefined)
  assert.equal(owner.state.legacyTop, undefined)
})

test('application contexts can share one owner authority and reject foreign scopes', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  bodyB.name = '乙'
  const b = owner.attachPig({ body: bodyB })
  const contextA = createApplicationContext({ owner, target: a, now: () => NOW })
  const contextB = createApplicationContext({ owner, target: b, now: () => NOW })
  let commits = 0
  const commands = createCommandContext({
    context: contextA,
    commit: fn => { commits += 1; return owner.transact(a, live => fn(live)) },
  })

  assert.equal(contextA.owner.state.coins, 500)
  assert.notEqual(contextA.target.body, contextB.target.body)
  const result = commands.runFor(contextA.scope, (live, command) => {
    assert.equal(command.scope, contextA.scope)
    live.coins -= 50
    live.name = '甲命令'
    return { ok: true }
  })
  assert.deepEqual(result, { ok: true })
  assert.equal(commits, 1)
  assert.equal(b.state.coins, 450)
  assert.equal(b.state.name, '乙')
  assert.equal(a.state.name, '甲命令')
  assert.throws(() => commands.readFor(contextB.scope), /another pig or owner/)
  assert.equal(commits, 1)
})

test('shared owner online cursor counts interleaved A/B polling once and rejects no cursor field', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  bodyB.name = '乙'
  const b = owner.attachPig({ body: bodyB })
  const clock = { now: NOW }
  const apiA = apiFor(owner, a, clock)
  const apiB = apiFor(owner, b, clock)
  const online = () => owner.state.daily.online

  clock.now = NOW
  apiA.freshen()
  apiB.freshen()
  assert.equal(online().onlineMs, 0, 'same-time first polls do not credit')

  clock.now = NOW + 10_000
  apiA.freshen()
  assert.equal(online().onlineMs, 10_000)
  apiB.freshen()
  assert.equal(online().onlineMs, 10_000, 'B at the same timestamp does not add the interval again')

  clock.now = NOW + 20_000
  apiB.freshen()
  assert.equal(online().onlineMs, 20_000)
  apiA.freshen()
  assert.equal(online().onlineMs, 20_000)

  clock.now = NOW + 30_000
  apiA.freshen()
  assert.equal(online().onlineMs, 30_000)
  clock.now = NOW + 100_000
  apiA.freshen()
  assert.equal(online().onlineMs, 30_000, 'gap over pollGapMaxMs is ignored')
  clock.now = NOW + 110_000
  apiB.freshen()
  assert.equal(online().onlineMs, 40_000, 'B continues from the shared owner cursor')
  apiA.freshen()
  assert.equal(online().onlineMs, 40_000)
  apiA.dispose()
  clock.now = NOW + 120_000
  apiB.freshen()
  assert.equal(online().onlineMs, 50_000, 'disposing A leaves the owner/B cursor')
  assert.deepEqual(Object.keys(online()).sort(), ['day', 'given', 'onlineMs', 'unclaimed'], 'cursor is not persisted')

  // A failed freshen rolls back the owner cursor with the daily/body state.
  const failed = oneOwner()
  const failedApi = apiFor(failed.owner, failed.target, clock)
  clock.now = NOW
  failedApi.freshen()
  clock.now = NOW + 10_000
  failed.owner.transact(failed.target, live => { live.satiety = 1n; return { ok: true } })
  failedApi.freshen()
  assert.equal(failed.owner.state.daily.online.onlineMs, 0, 'failed freshen rolls back online credit and cursor')
  failed.owner.transact(failed.target, live => { live.satiety = 50; return { ok: true } })
  failedApi.freshen()
  assert.equal(failed.owner.state.daily.online.onlineMs, 10_000, 'retry credits the interval once')
})

test('explicit structured refusal restores owner resources and target body, preserving its result', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  const b = owner.attachPig({ body: bodyB })
  owner.transact(a, live => {
    live.coins = 100
    live.inventory = { apple: 1 }
    live.satiety = 50
    return { ok: true }
  })
  const before = {
    coins: owner.state.coins,
    inventory: structuredClone(owner.state.inventory),
    aSatiety: a.body.satiety,
    bSatiety: b.body.satiety,
  }
  const refusal = { ok: false, reason: 'synthetic-refusal' }
  const returned = owner.transact(a, live => {
    live.coins -= 10
    live.inventory.apple = 0
    live.satiety = 1
    return refusal
  })
  assert.equal(returned, refusal, 'the exact refusal object is returned')
  assert.deepEqual({
    coins: owner.state.coins,
    inventory: structuredClone(owner.state.inventory),
    aSatiety: a.body.satiety,
    bSatiety: b.body.satiety,
  }, before, 'refusal restores shared resources and the selected body')
})

test('new attached targets cannot write undeclared legacy namespaces', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  const b = owner.attachPig({ body: bodyB })

  owner.transact(a, live => {
    live.legacyExtraTop = { aOnly: true }
    live.extData.legacyExtra = { value: 2 }
    return { ok: true }
  })
  assert.deepEqual(a.state.legacyExtraTop, { aOnly: true })
  assert.deepEqual(a.state.extData.legacyExtra, { value: 2 })
  assert.deepEqual(b.state.legacyExtraTop, { aOnly: true }, 'B has a read-only projection')
  assert.deepEqual(b.state.extData.legacyExtra, { value: 2 })
  assert.throws(() => { b.state.extData.legacyExtra.value = 3 })

  assert.throws(
    () => owner.transact(b, live => { live.unknownTopB = { fromB: true }; return { ok: true } }),
    /undeclared owner namespace/,
  )
  assert.throws(
    () => owner.transact(b, live => { live.extData.bOnly = { fromB: true }; return { ok: true } }),
    /undeclared owner namespace/,
  )
  assert.deepEqual(a.state.legacyExtraTop, { aOnly: true }, 'A legacy namespace is unchanged')
  assert.deepEqual(a.state.extData.legacyExtra, { value: 2 })
  assert.equal(a.state.unknownTopB, undefined)
  assert.equal(b.state.unknownTopB, undefined)
  assert.equal(a.state.extData.bOnly, undefined)
  assert.equal(b.state.extData.bOnly, undefined)

  owner.transact(b, live => { live.coins += 1; live.satiety += 1; return { ok: true } })
  assert.equal(owner.state.coins, 501, 'declared owner resources remain writable for B')
  assert.equal(b.body.satiety, 71, 'declared pig body remains writable for B')
})

test('legacy A explicit economy replacement/deletion stays explicit while B normalization preserves unknown data', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  const b = owner.attachPig({ body: bodyB })
  assert.equal(a.state.economy.futureEconomyField, 'keep-economy')

  owner.transact(b, live => {
    ensureEconomy(live)
    live.coins -= 1
    return { ok: true }
  })
  assert.equal(owner.state.coins, 499, 'B can perform a declared ledger/coin action')
  assert.equal(a.state.economy.futureEconomyField, 'keep-economy', 'B normalization does not drop legacy unknown economy data')
  assert.equal(b.state.economy.futureEconomyField, 'keep-economy')
  assert.equal(owner.state.economy.futureEconomyField, undefined, 'unknown economy stays out of owner.state')

  assert.throws(
    () => owner.transact(b, live => { live.economy.futureEconomyField = 'changed-by-B'; return { ok: true } }),
    /undeclared owner namespace/,
  )
  assert.equal(a.state.economy.futureEconomyField, 'keep-economy')

  owner.transact(a, live => {
    live.economy = { totals: {}, days: [], fatigue: 0 }
    return { ok: true }
  })
  assert.equal(a.state.economy.futureEconomyField, undefined, 'A explicit whole replacement drops omitted opaque fields')

  owner.transact(a, live => {
    live.economy = { totals: {}, days: [], fatigue: 0, deletedByA: { keep: true } }
    return { ok: true }
  })
  delete a.state.economy.deletedByA
  owner.transact(a, live => {
    ensureEconomy(live)
    live.coins += 1
    return { ok: true }
  })
  assert.equal(a.state.economy.deletedByA, undefined, 'A explicit deletion is not resurrected by normalization')
})

test('whole-state null replacement excludes the actual target holder and leaves B intact', () => {
  const { owner, target: a } = oneOwner()
  const bodyB = structuredClone(a.body)
  const b = owner.attachPig({ body: bodyB })
  a.state.pendingUnknownA = { mustNotLeakToB: true }
  owner.replaceLegacyState(a, null)
  assert.equal(a.state, null)
  assert.equal(a.present, false)
  assert.equal(b.present, true)
  assert.equal(b.state.pendingUnknownA, undefined, 'A pending opaque projection is not synced into B before replacement')
  owner.transact(b, live => { live.coins += 1; return { ok: true } })
  assert.equal(owner.state.coins, 501)
})

test('store preserves unknown economy subpaths on read and across live transactions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pig-owner-economy-'))
  const statePath = join(dir, 'state.json')
  writeFileSync(statePath, JSON.stringify(legacyState()))
  const store = createStore(statePath, {
    now: () => NOW,
    setTimer: () => ({ unref() {} }),
    clearTimer: () => {},
  })
  try {
    assert.equal(store.buy('apple').ok, true)
    store.freshen()
    store.flush(true)
    const saved = JSON.parse(readFileSync(statePath, 'utf8'))
    assert.equal(saved.economy.futureEconomyField, 'keep-economy', 'unknown economy.* survives migrate and a live ledger write')
    assert.equal(saved.fishing.futureFishField, 'keep-me', 'unknown fishing.* survives')
    assert.equal(saved.extData.mine.ore, 3, 'unknown extData survives')
    assert.equal(saved.legacyExtraTop.keep, true, 'unknown top-level field survives')
  } finally {
    store.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('createStore legacy adapter keeps public mutate/install/save behavior', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pig-owner-resources-'))
  const statePath = join(dir, 'state.json')
  let timers = 0
  const store = createStore(statePath, {
    now: () => NOW,
    setTimer: () => { timers += 1; return { unref() {} } },
    clearTimer: () => {},
  })
  try {
    const next = legacyState()
    store.installCommittedState(next)
    assert.equal(store.state, next, 'installCommittedState keeps the supplied object identity')
    assert.equal(store.state.coins, 500)

    let argCount = 0
    const result = store.mutate(function (...args) {
      argCount = args.length
      assert.equal(args[0], store.state)
      args[0].coins = 321
      args[0].name = '契约'
      return { ok: true }
    })
    assert.deepEqual(result, { ok: true })
    assert.equal(argCount, 1)
    assert.equal(store.state.coins, 321)
    assert.equal(store.state.name, '契约')
    assert.equal(timers, 1)

    const beforeRefusal = structuredClone(store.state)
    const timersBeforeRefusal = timers
    const refusal = store.mutate(live => {
      live.coins -= 3
      live.name = '拒绝'
      return { ok: false, reason: 'store-refusal' }
    })
    assert.deepEqual(refusal, { ok: false, reason: 'store-refusal' })
    assert.deepEqual(store.state, beforeRefusal)
    assert.equal(timers, timersBeforeRefusal, 'explicit refusal does not schedule a save')

    const beforeThrow = structuredClone(store.state)
    const failed = store.mutate(() => { throw new Error('contract-boom') })
    assert.equal(failed.ok, false)
    assert.equal(failed.reason, 'error')
    assert.deepEqual(store.state, beforeThrow)
    assert.equal(timers, 1, 'a thrown command does not schedule another save')

    const liveSnapshot = structuredClone(store.state)
    store.flush(true)
    const saved = JSON.parse(readFileSync(statePath, 'utf8'))
    assert.deepEqual(saved, liveSnapshot)
    assert.equal(saved.version, 15)
    assert.equal(saved.extData.farm.version, 5)
    assert.equal(saved.wallets.farm.balance, 3)
    assert.equal(saved.economy.fatigue, 0.25)
    assert.equal(saved.legacyExtraTop.keep, true)
  } finally {
    store.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})
