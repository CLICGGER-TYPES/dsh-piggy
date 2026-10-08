/**
 * dsh-piggy core tests — the whole game model is pure and timestamp-driven, so
 * every mechanic (growth, decay, work shifts, illness chains, shop, death) is
 * testable here without a timer or a wait.
 *
 * Run: node --test test/*.test.js
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ACTIONS,
  ACTION_ORDER,
  JOBS,
  MAX,
  REVIVE_ITEM,
  SCHOOL_STAGES,
  SHOP,
  LIFE_STAGES,
  STATE_VERSION,
  SUBJECTS,
  THRESHOLDS,
  TRAITS,
  TRIPS,
  act,
  actionCooldownSeconds,
  actionReady,
  bar,
  buy,
  callOffActivity,
  callOffWork,
  canWork,
  courseView,
  currentIllness,
  decay,
  dressView,
  feed,
  grantAll,
  formatWeight,
  hatchEgg,
  hasSoul,
  healthPercent,
  inventoryView,
  layEgg,
  careView,
  migrate,
  mood,
  ageDays,
  reset,
  ageFromNow,
  applyDevPatch,
  adopt,
  daysToNextStage,
  lifeStageFor,
  levelFor,
  rename,
  sellSouvenir,
  startInterest,
  startStudy,
  studyView,
  startTrip,
  startWork,
  traitView,
  useItem,
  wearItem,
  takeOff,
  workSecondsLeft,
} from '../core.js'
import { DEFAULT_TOY, DRESS_SLOTS, ILLNESS_CHAINS, illnessStageMs, illnessAt, interestByKey, INTERESTS, MEDICINES, rarityByKey, subjectByKey, xpForLevel } from '../data.js'

const T0 = 1_700_000_000_000
const MIN = 60_000

/**
 * Push the clock forward by `minutes`, resolving everything that happens.
 * Illnesses never shake themselves off here unless a test asks for it, so
 * nothing depends on which way a die happened to fall.
 */
function advance(state, minutes, roll = () => 0.99) {
  return decay(state, (state.lastSeenAt ?? T0) + minutes * MIN, { roll })
}

/** Stage length converted to the minutes `advance` wants. */
const stageMinutes = stage => illnessStageMs(stage) / MIN

/**
 * Let `days` of pig time pass and report the stage. Age is accumulated through
 * decay(), not read off the wall clock, so time has to actually move.
 */
function lifeStageForAfter(pig, t0, days) {
  const clone = { ...pig, cooldowns: { ...pig.cooldowns }, stats: { ...pig.stats } }
  clone.ageMs = 0
  clone.lastSeenAt = t0
  const HOUR = 3_600_000
  // Hour by hour, topped up each step. A single multi-week decay would starve
  // the pig to death long before the age we are trying to test.
  for (let h = 1; h <= Math.round(days * 24); h += 1) {
    clone.satiety = 100
    clone.cleanliness = 100
    clone.happiness = 100
    clone.illness = null
    decay(clone, t0 + h * HOUR)
  }
  return lifeStageFor(clone, t0 + days * 86_400_000)
}

/** Walk the illness all the way down the chain, one stage per call. */
function worsen(state, times) {
  for (let i = 0; i < times; i += 1) advance(state, stageMinutes(state.illness.stage) + 1)
}

/** Give the pig something without paying for it. */
function give(state, key, count = 1) {
  state.inventory = { ...(state.inventory ?? {}) }
  state.inventory[key] = (state.inventory[key] ?? 0) + count
}

// ===========================================================================
// Creation, growth, migration
// ===========================================================================

test('layEgg produces a complete, sane save', () => {
  const egg = layEgg(T0)
  assert.equal(egg.version, STATE_VERSION)
  assert.equal(egg.name, '猪猪')
  assert.equal(egg.hatched, false)
  assert.equal(egg.dead, false)
  assert.equal(egg.weightG, 1200)
  assert.equal(egg.cleanliness, 90)
  assert.equal(egg.health, MAX.health)
  assert.equal(egg.coins, 500, 'enough to buy medicine on day one')
  assert.deepEqual(egg.inventory, {})
  assert.deepEqual(egg.traits, { intel: 0, charm: 0, strong: 0 })
  assert.deepEqual(egg.lessons, {})
  assert.deepEqual(egg.souvenirs, [])
  assert.equal(egg.illness, null)
  assert.equal(egg.activity, null)
  assert.deepEqual(egg.pending, [])
  assert.equal(egg.stats.jobs, 0)
  assert.equal(egg.stats.lessons, 0)
  assert.equal(egg.stats.trips, 0)
})

test('a fresh pig is a cardboard box, and opening it lets a piglet out', () => {
  const box = layEgg(T0)
  assert.equal(box.hatched, false)
  assert.equal(lifeStageFor(box, T0).key, 'box')

  const piglet = hatchEgg(T0)
  assert.equal(piglet.hatched, true)
  assert.equal(lifeStageFor(piglet, T0).key, 'piglet')
  assert.equal(ageDays(piglet, T0), 0, 'the clock starts when the box opens')
  assert.ok(piglet.memories.some(m => m.includes('纸盒')), 'it remembers the box')
})

test('the body follows the level: 幼年, 青年 from Lv10, 成年 from Lv40', () => {
  const pig = hatchEgg(T0)
  assert.equal(lifeStageFor(pig, T0).key, 'piglet')
  pig.xp = xpForLevel(10) - 1
  assert.equal(lifeStageFor(pig, T0).key, 'piglet')
  pig.xp = xpForLevel(10)
  assert.equal(lifeStageFor(pig, T0).key, 'young')
  pig.xp = xpForLevel(40)
  assert.equal(lifeStageFor(pig, T0).key, 'middle')
  pig.xp = xpForLevel(60) * 10
  assert.equal(lifeStageFor(pig, T0).key, 'middle', 'there is no stage after grown-up')
  assert.equal(LIFE_STAGES.some(stage => stage.key === 'elder'), false, 'no elderly stage any more')
  // Every stage has its own size, so the pig literally grows.
  const sizes = LIFE_STAGES.map(stage => stage.size)
  assert.equal(new Set(sizes).size, sizes.length, 'no two stages share a size')
})

test('daysToNextStage estimates the wait at full care, and stops once grown', () => {
  const pig = hatchEgg(T0)
  // Lv10 needs 122 x 100 = 12200 growth; at 100 an hour that is ~5.08 days.
  assert.ok(Math.abs(daysToNextStage(pig, T0) - 12200 / 100 / 24) < 1e-9)
  pig.xp = xpForLevel(40)
  assert.equal(daysToNextStage(pig, T0), null)
})

test('there is no old age: a well-kept pig lives on past the old eight-month span', () => {
  const DAY = 86_400_000
  const HOUR = 3_600_000
  const pig = hatchEgg(T0)
  pig.lastSeenAt = T0
  for (let h = 1; h <= 250 * 24; h += 1) {
    pig.satiety = 100
    pig.cleanliness = 100
    pig.happiness = 100
    pig.illness = null
    decay(pig, T0 + h * HOUR)
  }
  assert.equal(pig.dead, false, 'time alone never kills it')
  assert.equal(lifeStageFor(pig, T0 + 250 * DAY).key, 'middle')

  // Only accidents do; a grave can still be left for a new pig.
  applyDevPatch(pig, { dead: true }, T0 + 250 * DAY)
  const before = pig.memories.length
  adopt(pig, T0 + 251 * DAY)
  assert.equal(pig.dead, false)
  assert.equal(pig.hatched, false, 'a new pig starts as a box again')
  assert.equal(pig.xp, 0, 'and small: growth is the body, it is not inherited')
  assert.ok(pig.memories.length >= before - 1, 'the old memories are still there')
})

test('a soul settles on a grave nobody came back for', () => {
  const DAY = 86_400_000
  const pig = hatchEgg(T0)
  pig.dead = true
  pig.diedAt = T0
  assert.equal(lifeStageFor(pig, T0).key, 'dead-day', '离世当天仍是小猪')
  assert.equal(lifeStageFor(pig, T0 + DAY - 1).key, 'dead-day', '满一天前不能出现墓碑')
  assert.equal(hasSoul(pig, T0 + 0.5 * DAY), false)
  assert.equal(lifeStageFor(pig, T0 + DAY).key, 'grave', '满一天出现墓碑与幽灵')
  assert.equal(hasSoul(pig, T0 + 1.1 * DAY), true)
})

test('migrate tolerates junk', () => {
  assert.equal(migrate(null, T0), null)
  assert.equal(migrate('nope', T0), null)
  assert.equal(migrate([1, 2], T0), null)
  const repaired = migrate({ xp: 'lots', satiety: Number.NaN, name: '  ', memories: 'x', stats: null, coins: -5 }, T0)
  assert.equal(repaired.xp, 0)
  assert.equal(repaired.name, '猪猪')
  assert.equal(repaired.coins, 0)
  assert.deepEqual(repaired.memories, [])
  assert.deepEqual(repaired.inventory, {})
})

test('migrate upgrades a v1 save all the way to the current version', () => {
  const upgraded = migrate({
    version: 1, name: '大花', bornAt: T0, xp: 200, weightG: 5000,
    satiety: 50, happiness: 50, lastSeenAt: T0,
    // no cleanliness, no health, no coins, no inventory, no traits
  }, T0)
  assert.equal(upgraded.version, STATE_VERSION)
  assert.equal(upgraded.name, '大花')
  // Old xp 200 was Lv3 on the v8 curve; the v9 upgrade keeps the level.
  assert.equal(levelFor(upgraded.xp), 3)
  assert.equal(upgraded.cleanliness, 90)
  assert.equal(upgraded.health, MAX.health)
  assert.equal(upgraded.coins, 500)
  assert.deepEqual(upgraded.inventory, {})
  assert.deepEqual(upgraded.traits, { intel: 0, charm: 0, strong: 0 })
  assert.deepEqual(upgraded.souvenirs, [])
})

test('migrate lifts a v3 "work" record into the v4 activity shape', () => {
  const upgraded = migrate({
    ...layEgg(T0),
    version: 3,
    work: { job: 'site', startedAt: T0, endsAt: T0 + MIN },
  }, T0)
  assert.equal(upgraded.activity.kind, 'work')
  assert.equal(upgraded.activity.key, 'site')
  assert.equal(upgraded.activity.endsAt, T0 + MIN)
})

test('migrate drops unknown inventory keys and bad illness records', () => {
  const upgraded = migrate({
    ...layEgg(T0),
    inventory: { apple: 2, 'not-a-real-item': 9, med1: 'x' },
    illness: { chain: 99, stage: 1, since: T0 },
    activity: { kind: 'work', key: 'nonexistent', endsAt: T0 },
  }, T0)
  assert.deepEqual(upgraded.inventory, { apple: 2 })
  assert.equal(upgraded.illness, null)
  assert.equal(upgraded.activity, null)
})

// ===========================================================================
// Passive diet and care actions
// ===========================================================================

test('passive events feed the pig, and real work adds a little growth', () => {
  const pig = hatchEgg(T0)
  feed(pig, 'turn', T0)
  assert.equal(pig.xp, 3, 'a turn is worth 3 growth (B2)')
  assert.equal(pig.stats.turns, 1)
  const box = layEgg(T0)
  feed(box, 'turn', T0)
  assert.equal(box.xp, 0, 'an unopened box does not grow')
  assert.deepEqual(feed(pig, 'not-a-thing', T0), [])
})

test('care actions apply effects and spend items without cooldowns', () => {
  const pig = hatchEgg(T0)
  pig.cleanliness = 20
  // Washing spends soap; the pig has none until it buys some.
  assert.equal(act(pig, 'bathe', T0).reason, 'no-item')
  pig.inventory = { bubble: 2 }
  assert.equal(act(pig, 'bathe', T0, 'bubble').ok, true)
  assert.ok(pig.cleanliness > 60)
  assert.equal(pig.inventory.bubble, 1, 'one bubble bath was used up')
  const again = act(pig, 'bathe', T0 + 1000, 'bubble')
  assert.equal(again.ok, true)
  assert.equal(pig.inventory.bubble, undefined)

  // Cooldowns are per action, and the free default toy needs no purchase.
  const played = act(pig, 'play', T0 + 1001)
  assert.equal(played.ok, true)
  assert.equal(played.spent, false, 'the scruffy default ball is not consumed')
  assert.deepEqual(act(pig, 'dance', T0), { ok: false, reason: 'unknown' })
})

// ===========================================================================
// Care costs an item — QQ Pet keeps food, sundries and medicine in separate
// inventory categories for exactly this reason.
// ===========================================================================

test('feeding, washing and playing each need something from their own shelf', () => {
  const pig = hatchEgg(T0)
  assert.equal(pig.inventory.apple, undefined)
  for (const [action, kind] of [['feed', 'food'], ['bathe', 'bath'], ['play', 'toy']]) {
    const refused = act(pig, action, T0)
    if (kind === 'toy') {
      // …except playing, where the free default toy is always in the bag.
      assert.equal(refused.ok, true, 'the default toy needs no purchase')
      assert.equal(refused.spent, false, 'and is never used up')
    } else {
      assert.equal(refused.ok, false, `${action} must need an item`)
      assert.equal(refused.reason, 'no-item')
      assert.equal(refused.kind, kind)
    }
  }
})

test('a care item is consumed and its own numbers are the ones applied', () => {
  const pig = hatchEgg(T0)
  pig.satiety = 10
  pig.inventory = { bone: 1, cake: 2 }
  const fed = act(pig, 'feed', T0, 'bone')
  assert.equal(fed.ok, true)
  assert.equal(fed.spent, true)
  assert.equal(pig.inventory.bone, undefined, 'the last bone is gone')
  assert.equal(pig.satiety, 55, '10 + the bone\'s 45, not the 22 of a plain feed')

  // Asking for something the pig does not own is refused, not silently swapped.
  assert.equal(act(pig, 'feed', T0 + 61_000, 'apple').reason, 'no-item')
  // With no pick at all it spends the cheapest thing it actually has.
  const again = act(pig, 'feed', T0 + 61_000)
  assert.equal(again.ok, true)
  assert.equal(again.item, 'cake')
  assert.equal(pig.inventory.cake, 1)
})

test('the toy shelf keeps the free default ball alongside bought toys', () => {
  const pig = hatchEgg(T0)
  pig.inventory = { yoyo: 3 }
  const shelf = careView(pig).play.map(i => i.key)
  assert.deepEqual(shelf, ['ball', 'yoyo'], 'default first, then what was bought')
  const played = act(pig, 'play', T0, 'yoyo')
  assert.equal(played.spent, true)
  assert.equal(pig.inventory.yoyo, 2)
})

// ===========================================================================
// The school ladder
// ===========================================================================

test('long-haul activities really do take hours', () => {
  for (const activity of [...JOBS, ...SCHOOL_STAGES, ...TRIPS]) {
    assert.ok(activity.minutes >= 15, `${activity.label} is at least a quarter hour`)
  }
  assert.ok(Math.max(...JOBS.map(j => j.minutes)) >= 240, 'the longest shift is hours')
  assert.ok(Math.max(...TRIPS.map(t => t.minutes)) >= 1440, 'the longest trip is a day')
})

test('petting has no cooldown', () => {
  const pig = hatchEgg(T0)
  assert.equal(ACTIONS.pet.cooldownMs, 0)
  for (let i = 0; i < 5; i += 1) assert.equal(act(pig, 'pet', T0).ok, true)
  assert.equal(pig.stats.pets, 5)
  assert.equal(actionCooldownSeconds(pig, 'pet', T0), 0)
})

test('the whole care loop is exposed in a stable order', () => {
  assert.deepEqual([...ACTION_ORDER], ['feed', 'bathe', 'play', 'pet'])
  for (const key of ACTION_ORDER) {
    assert.equal(ACTIONS[key].key, key)
    assert.equal(typeof ACTIONS[key].label, 'string')
    assert.equal(typeof ACTIONS[key].emoji, 'string')
  }
})

// ===========================================================================
// Decay
// ===========================================================================

test('attributes decay with wall-clock time', () => {
  const pig = hatchEgg(T0)
  pig.satiety = 100
  pig.happiness = 100
  pig.cleanliness = 100
  advance(pig, 60)
  assert.ok(pig.satiety < 100 && pig.satiety > 80, `satiety=${pig.satiety}`)
  assert.ok(pig.happiness < 100 && pig.happiness > 85, `happiness=${pig.happiness}`)
  assert.ok(pig.cleanliness < 100 && pig.cleanliness > 88, `cleanliness=${pig.cleanliness}`)
})

test('decay never goes below zero', () => {
  const pig = hatchEgg(T0)
  pig.satiety = 5
  pig.happiness = 5
  pig.cleanliness = 5
  advance(pig, 100 * 60)
  assert.equal(Math.round(pig.satiety), 0)
  assert.equal(Math.round(pig.happiness), 0)
  assert.equal(Math.round(pig.cleanliness), 0)
})

test('mood: dead beats sick beats working beats everything else', () => {
  const pig = hatchEgg(T0)
  pig.happiness = 90
  assert.equal(mood(pig, T0).key, 'happy')

  pig.satiety = 10
  assert.equal(mood(pig, T0).key, 'hungry')

  pig.illness = { chain: 0, stage: 1, since: T0 }
  assert.equal(mood(pig, T0).key, 'sick')
  assert.equal(mood(pig, T0).label, '得了感冒')

  pig.illness = null
  pig.activity = { kind: 'work', key: 'bricks', label: '打零工', emoji: '🧹', startedAt: T0, endsAt: T0 + MIN }
  assert.equal(mood(pig, T0).key, 'working')

  pig.activity = { kind: 'study', key: 'chinese', stage: 'primary', label: '小学语文', emoji: '📖', startedAt: T0, endsAt: T0 + MIN }
  assert.equal(mood(pig, T0).key, 'studying')

  pig.activity = { kind: 'trip', key: 'suburb', label: '郊游', emoji: '🏞', startedAt: T0, endsAt: T0 + MIN }
  assert.equal(mood(pig, T0).key, 'traveling')

  // 外出时脏了也要看得出（和生病一样压过外出），饿了仍让位给外出。
  pig.cleanliness = 10
  assert.equal(mood(pig, T0).key, 'dirty')
  pig.cleanliness = 90

  pig.activity = null
  pig.dead = true
  assert.equal(mood(pig, T0).key, 'dead')
})

// ===========================================================================
// Work
// ===========================================================================

test('a shift pays out when the clock passes its end', () => {
  const pig = hatchEgg(T0)
  const before = pig.coins
  const result = startWork(pig, 'bricks', T0)
  assert.equal(result.ok, true)
  assert.equal(pig.activity.kind, 'work')
  assert.equal(pig.activity.key, 'bricks')
  assert.equal(workSecondsLeft(pig, T0), JOBS[0].minutes * 60)

  advance(pig, JOBS[0].minutes + 1)
  assert.equal(pig.activity, null, 'the shift is over')
  assert.equal(pig.coins, before + JOBS[0].coins)
  assert.equal(pig.stats.jobs, 1)
  assert.equal(pig.stats.coinsEarned, JOBS[0].coins)
  assert.ok(pig.memories.some(m => m.includes('金币')))
  assert.ok(pig.pending.some(e => e.kind === 'work'), 'the payout is announced')
})

test('recalling a pig whose shift already ended pays the wages, not a void', () => {
  // The panel's 召回 was the first thing to touch a finished-but-unsettled shift,
  // and it cancelled it: the pay was thrown away and study/trip costs refunded.
  const pig = hatchEgg(T0)
  const before = pig.coins
  assert.equal(startWork(pig, 'bricks', T0).ok, true)
  const endsAt = pig.activity.endsAt

  callOffActivity(pig, endsAt + 60_000)
  assert.equal(pig.activity, null, 'the shift is over either way')
  assert.equal(pig.coins, before + JOBS[0].coins, 'a finished shift still pays')
  assert.equal(pig.stats.jobs, 1)
})

test('a shift drains satiety and cleanliness faster than idling', () => {
  const working = hatchEgg(T0)
  const idle = hatchEgg(T0)
  assert.equal(startWork(working, 'bricks', T0).ok, true)
  advance(working, 5)
  advance(idle, 5)
  assert.ok(working.satiety < idle.satiety, 'working pig gets hungrier')
  assert.ok(working.cleanliness < idle.cleanliness, 'working pig gets dirtier')
})

test('work is refused while away, sick, hungry or dead', () => {
  const pig = hatchEgg(T0)
  startWork(pig, 'bricks', T0)
  assert.equal(startWork(pig, 'bricks', T0).reason, 'away')

  const sick = hatchEgg(T0)
  sick.illness = { chain: 0, stage: 1, since: T0 }
  assert.equal(canWork(sick), true, 'illness alone does not ground the pig')
  // Being ill no longer grounds the pig: that deadlocked the game, because a
  // sick pig with no coins could not buy the medicine it needed.
  assert.equal(startWork(sick, 'bricks', T0).ok, true, 'a sick pig can still go to work')
  const weak = hatchEgg(T0)
  weak.health = 1
  assert.equal(startWork(weak, 'bricks', T0).reason, 'weak', 'death\'s door is another matter')

  const hungry = hatchEgg(T0)
  hungry.satiety = 5
  assert.equal(startWork(hungry, 'bricks', T0).reason, 'hungry')

  const dead = hatchEgg(T0)
  dead.dead = true
  dead.health = 0
  assert.equal(startWork(dead, 'bricks', T0).reason, 'dead')

  assert.equal(startWork(hatchEgg(T0), 'moon', T0).reason, 'unknown')
})

test('care actions are blocked while the pig is away (except petting)', () => {
  const pig = hatchEgg(T0)
  startWork(pig, 'bricks', T0)
  assert.equal(act(pig, 'feed', T0).reason, 'away')
  assert.equal(act(pig, 'bathe', T0).reason, 'away')
  assert.equal(act(pig, 'pet', T0).ok, true, 'you can still pat it')
})

test('calling the pig home early forfeits the pay', () => {
  const pig = hatchEgg(T0)
  const before = pig.coins
  // 打零工 is the ungated job, so this test stays about the recall, not the gate.
  startWork(pig, 'bricks', T0)
  assert.equal(callOffWork(pig, T0).ok, true)
  assert.equal(pig.activity, null)
  assert.equal(pig.coins, before, 'no pay for an unfinished shift')
  assert.equal(callOffWork(pig, T0).reason, 'idle')
})

// ===========================================================================
// Illness chains
// ===========================================================================

test('the illness chains match the QQ Pet reverse engineering', () => {
  assert.equal(ILLNESS_CHAINS.length, 5, 'B3 adds 头晕 and 皮肤')
  assert.deepEqual(ILLNESS_CHAINS[0].stages.map(s => s.name), ['感冒', '发烧', '重感冒', '肺炎'])
  assert.deepEqual(ILLNESS_CHAINS[1].stages.map(s => s.name), ['咳嗽', '支气管炎', '哮喘', '肺结核'])
  assert.deepEqual(ILLNESS_CHAINS[2].stages.map(s => s.name), ['肚子胀', '胃炎', '胃溃疡', '胃癌'])
  assert.equal(illnessAt(0, 1).cure, '板蓝根')
  assert.equal(illnessAt(0, 4).cure, '金色消炎水')
  assert.equal(illnessAt(0, 4).health, 1)
  assert.equal(illnessAt(0, 5), null)
  // B3: five chains, and every stage has a cure of its own on the shelf.
  assert.equal(ILLNESS_CHAINS.length, 5)
  assert.equal(new Set(MEDICINES.map(item => item.key)).size, 21, '20 stage cures + 百草丹')
})

test('neglect makes the pig sick and costs a health point', () => {
  const pig = hatchEgg(T0)
  pig.satiety = 10
  assert.equal(pig.illness, null)
  // Onset is a chance per hour now (B3); a roll of 0 always lands.
  advance(pig, 10, () => 0)
  assert.notEqual(pig.illness, null, 'illness should have struck')
  assert.equal(pig.illness.stage, 1)
  assert.equal(pig.health, 4, 'stage 1 leaves 4 of 5 health')
  assert.ok(pig.pending.some(e => e.kind === 'sick'), 'it is announced')
  assert.ok(currentIllness(pig) !== null)
})

test('being well cared for keeps the pig healthy', () => {
  const pig = hatchEgg(T0)
  pig.satiety = 90
  pig.cleanliness = 90
  advance(pig, 60)
  assert.equal(pig.illness, null)
  assert.equal(pig.health, MAX.health)
})

test('a sick pig earns half, but still earns', () => {
  const ODD = JOBS.find(job => job.key === 'bricks')
  const run = (sick) => {
    const pig = hatchEgg(T0)
    pig.coins = 0
    if (sick) {
      pig.illness = { chain: 0, stage: 1, since: T0, progressMs: 0 }
      pig.health = 4
    }
    startWork(pig, ODD.key, T0)
    decay(pig, pig.activity.endsAt)
    return pig.coins
  }
  const healthy = run(false)
  const ill = run(true)
  assert.equal(healthy, ODD.coins)
  assert.equal(ill, Math.round(ODD.coins / 2), 'half pay')
  assert.ok(ill > 0, 'but never nothing — working while ill is the way out of being broke')
})

test('an untreated illness runs its stages in days, and can shake itself off', () => {
    // --- it gets worse, one stage a day ---------------------------------
    const never = { roll: () => 0.99 } // never self-heal
    const pig = hatchEgg(T0)
    pig.illness = { chain: 0, stage: 1, since: T0, progressMs: 0 }
    pig.health = 4
    pig.satiety = 80
    pig.cleanliness = 80

    advance(pig, stageMinutes(1) - 1)
    assert.equal(pig.illness.stage, 1, 'not yet')

    advance(pig, 2)
    assert.equal(pig.illness.stage, 2)
    assert.equal(pig.health, 3)
    assert.equal(currentIllness(pig).name, '发烧')

    // --- a day really is the unit ---------------------------------------
    const day = hatchEgg(T0)
    day.illness = { chain: 0, stage: 1, since: T0, progressMs: 0 }
    decay(day, T0 + 23 * 60 * 60000, never)
    assert.equal(day.illness.stage, 1, '23 hours is not a day')

    // --- an untreated cold really can just go away ----------------------
    const always = { roll: () => 0.01 } // always self-heal
    const lucky = hatchEgg(T0)
    lucky.illness = { chain: 0, stage: 1, since: T0, progressMs: 0 }
    lucky.health = 4
    decay(lucky, T0 + illnessStageMs(1) + 1000, always)
    assert.equal(lucky.illness, null, 'it shrugged the cold off')
    assert.equal(lucky.health, 5, 'and is back to full health')

    // --- the last stage never heals on its own --------------------------
    const terminal = hatchEgg(T0)
    terminal.illness = { chain: 0, stage: 4, since: T0, progressMs: 0 }
    terminal.health = 1
    decay(terminal, T0 + illnessStageMs(4) + 1000, always)
    assert.equal(terminal.dead, true, 'the last stage is fatal without medicine')
})

test('shaking off an illness restores full health, not one point of it', () => {
  // #7: the self-heal branch only added 1 to health, so a pig that survived a
  // fever (health 3) stayed dented forever — nothing else ever raised it.
  const always = { roll: () => 0.01 }
  const pig = hatchEgg(T0)
  pig.illness = { chain: 0, stage: 2, since: T0, progressMs: 0 }
  pig.health = 3
  decay(pig, T0 + illnessStageMs(2) + 1000, always)
  assert.equal(pig.illness, null, 'the illness is gone')
  assert.equal(pig.health, MAX.health, 'and the pig is properly well again')
})

test('medicine that cures the illness also leaves the pig at full health', () => {
  const pig = hatchEgg(T0)
  pig.illness = { chain: 0, stage: 4, since: T0, progressMs: 0 }
  pig.health = 1
  pig.inventory = { 'jinse-xiaoyan': 1 }
  assert.equal(useItem(pig, 'jinse-xiaoyan', T0).ok, true)
  assert.equal(pig.health, MAX.health)
})

test('being out while ill runs the illness clock faster than resting', () => {
  {
    const never = { roll: () => 0.99 } // never self-heal, so only the rate differs
    const build = () => {
      const pig = hatchEgg(T0)
      pig.illness = { chain: 0, stage: 1, since: T0, progressMs: 0 }
      pig.health = 4
      pig.satiety = 100
      pig.cleanliness = 100
      return pig
    }

    // Half a day at home: still stage 1.
    const home = build()
    decay(home, T0 + 12 * 60 * 60000, never)
    assert.equal(home.illness.stage, 1, 'resting is slow')

    // Half a day out, which counts double: a full stage.
    const out = build()
    out.activity = { kind: 'work', key: 'office', label: '上班', emoji: '💼', startedAt: T0, endsAt: T0 + 12 * 60 * 60000 }
    decay(out, T0 + 12 * 60 * 60000, never)
    assert.equal(out.illness.stage, 2, 'a half day out is a whole day of illness')
  }
})

test('the fourth stage progressing means death, and 还魂丹 brings it back', () => {
  const pig = hatchEgg(T0)
  pig.illness = { chain: 0, stage: 4, since: T0 }
  pig.health = 1
  pig.satiety = 80
  pig.cleanliness = 80
  pig.xp = 500

  worsen(pig, 1)
  assert.equal(pig.dead, true)
  assert.equal(pig.health, 0)
  assert.equal(pig.illness, null)
  assert.ok(pig.pending.some(e => e.kind === 'death'))

  // Nothing works on a dead pig except the revive item.
  assert.equal(act(pig, 'feed', T0).reason, 'dead')
  assert.equal(startWork(pig, 'bricks', T0).reason, 'dead')
  give(pig, 'apple')
  assert.equal(useItem(pig, 'apple', T0).reason, 'dead')
  assert.equal(useItem(pig, REVIVE_ITEM.key, T0).reason, 'empty')

  const growthAtDeath = pig.xp
  give(pig, REVIVE_ITEM.key)
  const revived = useItem(pig, REVIVE_ITEM.key, T0)
  assert.equal(revived.ok, true)
  assert.equal(pig.dead, false)
  assert.equal(pig.health, MAX.health)
  assert.equal(pig.xp, growthAtDeath, 'level and growth survive death')
  assert.equal(pig.stats.revives, 1)
})

test('the revive item is refused on a living pig', () => {
  const pig = hatchEgg(T0)
  give(pig, REVIVE_ITEM.key)
  const result = useItem(pig, REVIVE_ITEM.key, T0)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'not-dead')
  assert.equal(pig.inventory[REVIVE_ITEM.key], 1, 'the item is not consumed')
})

test('only the matching medicine cures; the wrong one is swallowed and makes it worse', () => {
  const pig = hatchEgg(T0)
  pig.illness = { chain: 1, stage: 2, since: T0 }
  pig.health = 3

  give(pig, 'banlangen')
  assert.equal(useItem(pig, 'banlangen', T0).reason, 'wrong-medicine')
  assert.equal(pig.illness.stage, 3, 'one stage worse at once, as in the original')
  assert.equal(pig.health, 2)
  assert.equal(pig.inventory.banlangen, 0, 'the wrong medicine is used up too')

  give(pig, 'dingchuanwan')
  const cured = useItem(pig, 'dingchuanwan', T0)
  assert.equal(cured.ok, true)
  assert.equal(pig.illness, null)
  assert.equal(pig.health, MAX.health)
  assert.equal(pig.inventory.dingchuanwan, 0, 'the medicine is consumed')
  assert.equal(pig.stats.cures, 1)
  assert.ok(pig.pending.some(e => e.kind === 'cured'))
})

test('medicine on a healthy pig is refused', () => {
  const pig = hatchEgg(T0)
  give(pig, 'banlangen')
  assert.equal(useItem(pig, 'banlangen', T0).reason, 'not-sick')
  assert.equal(pig.inventory.banlangen, 1)
})

test('using a care item applies its effects', () => {
  const pig = hatchEgg(T0)
  pig.satiety = 30
  give(pig, 'bone')
  const result = useItem(pig, 'bone', T0)
  assert.equal(result.ok, true)
  assert.ok(pig.satiety > 60, `satiety=${pig.satiety}`)
  assert.equal(pig.inventory.bone ?? 0, 0)
  // 背包里用食物和喂食是同一件事：长体重、记一次喂食、猪会说话。
  assert.ok(pig.weightG > hatchEgg(T0).weightG)
  assert.equal(pig.stats.feeds, 1)
  assert.equal(useItem(pig, 'bone', T0).reason, 'empty')
  assert.equal(useItem(pig, 'nope', T0).reason, 'unknown')
})

// ===========================================================================
// Study — the nine QQ Pet subjects
// ===========================================================================

test('an interest lesson pays straight into one of the three traits', () => {
  const cases = [['photography', 'charm'], ['coding', 'intel'], ['dancing', 'charm'], ['fitness', 'strong']]
  for (const [key, trait] of cases) {
    const pig = hatchEgg(T0)
    pig.coins = 5000
    const interest = INTERESTS.find(entry => entry.key === key)
    assert.equal(startInterest(pig, key, T0).ok, true)
    assert.equal(pig.coins, 5000 - interest.cost, 'the fee is taken up front')
    assert.equal(pig.activity.kind, 'interest')
    decay(pig, pig.activity.endsAt)
    assert.equal(pig.traits[trait], interest.gain, `${interest.label} should feed ${trait}`)
    for (const other of ['intel', 'charm', 'strong']) {
      if (other !== trait) assert.equal(pig.traits[other], 0, `${interest.label} must not feed ${other}`)
    }
    assert.equal(pig.interests[key], 1)
  }
})

test('an unopened box cannot work, study, take a course, travel or be fed', () => {
  // #2: the box is a state, not a pet. It used to accept every action, get sick
  // and even die before anyone had opened it.
  const box = layEgg(T0)
  const cases = [
    ['work', () => startWork(box, 'bricks', T0)],
    ['study', () => startStudy(box, 'chinese', 'primary', T0)],
    ['interest', () => startInterest(box, 'coding', T0)],
    ['trip', () => startTrip(box, 'suburb', T0)],
    ['act', () => act(box, 'pet', T0)],
  ]
  for (const [what, run] of cases) {
    assert.deepEqual(run(), { ok: false, reason: 'box' }, `${what} must be refused with reason box`)
  }
  assert.equal(box.activity, null, 'and nothing may start')
})

test('an unopened box waits without getting hungry, dirty, sick or older', () => {
  const box = layEgg(T0)
  const before = { satiety: box.satiety, happiness: box.happiness, cleanliness: box.cleanliness, health: box.health, ageMs: box.ageMs }
  decay(box, T0 + 3 * 24 * 60 * MIN)
  assert.equal(box.dead, false)
  assert.equal(box.illness, null)
  assert.deepEqual(
    { satiety: box.satiety, happiness: box.happiness, cleanliness: box.cleanliness, health: box.health, ageMs: box.ageMs },
    before,
    'a box does not live, so nothing about it may drift',
  )
})

test('real work only counts the stats while the pig is still a box', () => {
  const box = layEgg(T0)
  const before = { xp: box.xp, satiety: box.satiety, happiness: box.happiness, weightG: box.weightG }
  feed(box, 'turn', T0)
  assert.equal(box.stats.turns, 1, 'the work still happened')
  assert.deepEqual({ xp: box.xp, satiety: box.satiety, happiness: box.happiness, weightG: box.weightG }, before, 'but the box does not eat')
})

test('an interest course survives a restart instead of vanishing with the fee', () => {
  // #4: sanitizeActivity only knew work/study/trip, so a saved interest course
  // was dropped on load — the pig came back idle with the fee already spent.
  const pig = hatchEgg(T0)
  pig.coins = 5000
  assert.equal(startInterest(pig, 'coding', T0).ok, true)
  const fee = 5000 - pig.coins

  const reloaded = migrate(JSON.parse(JSON.stringify(pig)), T0 + 60_000)
  assert.notEqual(reloaded.activity, null, 'the course must still be running after a reload')
  assert.equal(reloaded.activity.kind, 'interest')
  assert.equal(reloaded.activity.key, 'coding')
  assert.equal(reloaded.coins, 5000 - fee, 'and the fee must not be charged twice')

  decay(reloaded, reloaded.activity.endsAt)
  assert.equal(reloaded.traits.intel, 2, 'the lesson still pays out when it ends')
})

test('a collection bigger than 40 keeps everything across a restart', () => {
  // #5: sanitizeSouvenirs sliced to the last 40, so the 41st souvenir pushed the
  // oldest one out of the save — and the museum sold from a truncated list.
  const pig = hatchEgg(T0)
  pig.coins = 5000
  const souvenirs = Array.from({ length: 41 }, (_, index) => ({
    key: 'shell-' + index, emoji: '🐚', label: '贝壳 ' + index, rarity: 'common',
    story: '', from: null, fromLabel: '',
  }))
  pig.souvenirs = souvenirs

  const reloaded = migrate(JSON.parse(JSON.stringify(pig)), T0 + 60_000)
  assert.equal(reloaded.souvenirs.length, 41)
  assert.equal(reloaded.souvenirs[0].key, 'shell-0', 'the oldest keepsake must survive')
  assert.equal(reloaded.souvenirs[40].key, 'shell-40')
})

test('forcing health to zero kills the pig and says so', () => {
  // The debug tab used to leave a pig with health 0 and no death: it just read
  // as a corpse without the grave, the announcement or the stats (B1 小缺口).
  const pig = hatchEgg(T0)
  applyDevPatch(pig, { health: 0 }, T0)
  assert.equal(pig.dead, true)
  assert.equal(pig.health, 0)
  assert.ok(pig.pending.some(entry => entry.kind === 'death'), 'the death is announced')
})

test('interests are repeatable and outside the school ladder', () => {
  const pig = hatchEgg(T0)
  pig.coins = 5000
  // A brand-new pig may take one immediately: no stage gate, no tuition ladder.
  let clock = T0
  for (let i = 0; i < 3; i += 1) {
    pig.satiety = 100
    assert.equal(startInterest(pig, 'fitness', clock).ok, true)
    clock += (interestByKey('fitness').minutes + 1) * MIN
    decay(pig, clock)
  }
  assert.equal(pig.interests.fitness, 3)
  assert.equal(pig.traits.strong, interestByKey('fitness').gain * 3)
  assert.equal(pig.stats.interests, 3)
})

test('an interest is refused when broke, away or unknown, and spends nothing', () => {
  const poor = hatchEgg(T0)
  poor.coins = 1
  assert.equal(startInterest(poor, 'coding', T0).reason, 'poor')
  assert.equal(poor.coins, 1)

  const away = hatchEgg(T0)
  away.coins = 500
  assert.equal(startInterest(away, 'photography', T0).ok, true)
  assert.equal(startInterest(away, 'dancing', T0).reason, 'away')

  assert.equal(startInterest(hatchEgg(T0), 'underwater-basket-weaving', T0).reason, 'unknown')

  const dead = hatchEgg(T0)
  dead.dead = true
  assert.equal(startInterest(dead, 'fitness', T0).reason, 'dead')
})

test('兴趣 counts survive a save, and junk keys are dropped', () => {
  const upgraded = migrate({ ...layEgg(T0), interests: { coding: 4, nope: 9, photography: 0 } }, T0)
  assert.deepEqual(upgraded.interests, { coding: 4 })
})

// ===========================================================================
// Travel — souvenirs for the collection
// ===========================================================================

test('the trip table is well formed and gets dearer with distance', () => {
  assert.ok(TRIPS.length >= 3)
  for (const trip of TRIPS) {
    assert.ok(trip.cost > 0)
    assert.ok(trip.minutes > 0)
    assert.ok(trip.souvenirs.length >= 2)
  }
  const costs = TRIPS.map(t => t.cost)
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b), 'trips should be ordered by cost')
})

test('travelling costs coins up front and brings back a souvenir', () => {
  const pig = hatchEgg(T0)
  pig.coins = 200
  const trip = TRIPS[0]
  const happiness = pig.happiness
  const result = startTrip(pig, trip.key, T0)
  assert.equal(result.ok, true)
  assert.equal(pig.coins, 200 - trip.cost)
  assert.equal(pig.activity.kind, 'trip')

  advance(pig, trip.minutes + 1)
  assert.equal(pig.activity, null)
  assert.equal(pig.souvenirs.length, 1)
  const kept = pig.souvenirs[0]
  assert.ok(trip.souvenirs.some(entry => entry.key === kept.key), 'the souvenir comes from this trip')
  // A souvenir is an object now: the story card needs all of it.
  assert.equal(typeof kept.label, 'string')
  assert.equal(typeof kept.story, 'string')
  assert.ok(kept.story.length > 0, 'and it has something to say')
  assert.ok(['common', 'rare', 'legend'].includes(kept.rarity))
  assert.equal(kept.fromLabel, trip.label)
  assert.ok(pig.happiness > happiness - 5, 'a trip should not leave the pig sad')
  assert.equal(pig.stats.trips, 1)
  assert.ok(pig.pending.some(e => e.kind === 'trip'))
})

test('the souvenir rotation is deterministic, so every keepsake is reachable', () => {
  const pig = hatchEgg(T0)
  pig.coins = 5000
  const trip = TRIPS[0]
  const collected = []
  let clock = T0
  for (let i = 0; i < trip.souvenirs.length + 1; i += 1) {
    pig.satiety = 100
    startTrip(pig, trip.key, clock)
    clock += (trip.minutes + 1) * MIN
    decay(pig, clock)
    collected.push(pig.souvenirs[i])
  }
  assert.deepEqual(collected.slice(0, trip.souvenirs.length).map(entry => entry.key), trip.souvenirs.map(entry => entry.key))
  assert.equal(collected[trip.souvenirs.length].key, trip.souvenirs[0].key, 'it wraps around')
})

test('selling a souvenir pays its rarity price and takes it out of the collection', () => {
  const pig = hatchEgg(T0)
  pig.coins = 5000
  const trip = TRIPS[0]
  startTrip(pig, trip.key, T0)
  decay(pig, pig.activity.endsAt)
  const kept = pig.souvenirs[0]
  const before = pig.coins
  const sold = sellSouvenir(pig, kept.key, T0)
  assert.equal(sold.ok, true)
  assert.equal(sold.coins, rarityByKey(kept.rarity).price)
  assert.equal(pig.coins, before + sold.coins)
  assert.equal(pig.souvenirs.length, 0)
  assert.equal(pig.stats.sales, 1)
  // Selling it twice, or something the pig never owned, is refused honestly.
  assert.equal(sellSouvenir(pig, kept.key, T0).reason, 'not-owned')
  assert.equal(sellSouvenir(pig, 'not-a-souvenir', T0).reason, 'not-owned')
  assert.equal(pig.coins, before + sold.coins, 'a refusal pays nothing')
})

test('a legend souvenir is worth more than a common one', () => {
  const prices = ['common', 'rare', 'legend'].map(key => rarityByKey(key).price)
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b))
  assert.ok(rarityByKey('legend').price >= rarityByKey('rare').price * 3)
})

test('a pre-0.20 save keeps its string souvenirs as objects', () => {
  const upgraded = migrate({ ...layEgg(T0), version: 6, souvenirs: ['贝壳', '松果'] }, T0)
  assert.equal(upgraded.souvenirs.length, 2)
  assert.equal(upgraded.souvenirs[0].label, '贝壳')
  assert.equal(upgraded.souvenirs[0].rarity, 'common')
  // Still sellable, at the common price.
  const before = upgraded.coins
  assert.equal(sellSouvenir(upgraded, '贝壳', T0).ok, true)
  assert.equal(upgraded.coins, before + rarityByKey('common').price)
})

test('a trip is refused when broke, and nothing is spent', () => {
  const pig = hatchEgg(T0)
  pig.coins = 5
  const result = startTrip(pig, 'abroad', T0)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'poor')
  assert.equal(result.price, TRIPS.find(trip => trip.key === 'abroad').cost)
  assert.equal(pig.coins, 5)
  assert.equal(pig.activity, null)
  assert.equal(startTrip(pig, 'mars', T0).reason, 'unknown')
})

test('care is blocked while travelling, and the pig can be recalled', () => {
  const pig = hatchEgg(T0)
  pig.coins = 200
  const trip = TRIPS[0]
  startTrip(pig, trip.key, T0)
  assert.equal(act(pig, 'feed', T0).reason, 'away')
  assert.equal(startWork(pig, 'bricks', T0).reason, 'away')

  const recalled = callOffActivity(pig, T0)
  assert.equal(recalled.ok, true)
  assert.equal(recalled.refunded, trip.cost, 'an unfinished trip is refunded')
  assert.equal(pig.coins, 200, 'coins are back')
  assert.equal(pig.souvenirs.length, 0)
})

test('recalling a study session refunds the tuition; recalling work does not pay', () => {
  const student = hatchEgg(T0)
  student.coins = 5000
  startStudy(student, 'chinese', null, T0)
  const refund = callOffActivity(student, T0)
  assert.equal(refund.refunded, SCHOOL_STAGES[0].tuition)
  assert.equal(student.coins, 5000, 'the tuition comes back whole')

  const worker = hatchEgg(T0)
  const before = worker.coins
  startWork(worker, 'bricks', T0)
  const forfeit = callOffActivity(worker, T0)
  assert.equal(forfeit.refunded, 0)
  assert.equal(worker.coins, before)
})

// ===========================================================================
// Unified activity
// ===========================================================================

test('the three activities are mutually exclusive', () => {
  const pig = hatchEgg(T0)
  pig.coins = 500
  startWork(pig, 'bricks', T0)
  assert.equal(startStudy(pig, 'chinese', 'primary', T0).reason, 'away')
  assert.equal(startTrip(pig, 'suburb', T0).reason, 'away')
  assert.equal(pig.activity.kind, 'work')
})

test('anything away from home drains the pig faster', () => {
  for (const kind of ['work', 'study', 'trip']) {
    const away = hatchEgg(T0)
    const idle = hatchEgg(T0)
    // Same starting bars, so the only difference is being away.
    away.satiety = 100
    idle.satiety = 100
    away.coins = 5000
    if (kind === 'work') startWork(away, 'bricks', T0)
    else if (kind === 'study') {
      away.coins = 5000
      startStudy(away, 'chinese', null, T0)
    }
    else startTrip(away, 'abroad', T0)
    advance(away, 2)
    advance(idle, 2)
    assert.ok(away.satiety < idle.satiety, `${kind} should make the pig hungrier`)
  }
})

test('trait and course views always list everything', () => {
  const pig = hatchEgg(T0)
  assert.deepEqual(Object.keys(traitView(pig)).sort(), ['charm', 'intel', 'strong'])
  assert.equal(Object.keys(courseView(pig)).length, SUBJECTS.length)
  assert.ok(Object.values(courseView(pig)).every(n => n === 0))
  assert.deepEqual(inventoryView(pig).apple, 0)
})

// ===========================================================================
// Shop
// ===========================================================================

test('the shop is well formed: 76 items across eight shelves, every cure stocked', () => {
  assert.equal(SHOP.length, 76, 'the expanded food, bath, toy and dress shelves are available')
  const counts = {}
  for (const item of SHOP) {
    assert.equal(typeof item.key, 'string')
    assert.ok(item.price > 0)
    assert.ok(['food', 'bath', 'toy', 'bait', 'dress', 'medicine', 'revive', 'promotion'].includes(item.kind))
    counts[item.kind] = (counts[item.kind] ?? 0) + 1
  }
  assert.deepEqual(counts, { food: 13, bath: 10, toy: 13, bait: 3, dress: 13, medicine: 21, revive: 1, promotion: 2 })
  // 装扮 is a different economy: level-gated, owned once, never counted.
  for (const item of SHOP.filter(entry => entry.kind === 'dress')) {
    assert.ok(Number.isInteger(item.level) && item.level >= 1, `${item.label} needs a level`)
    assert.ok(item.blurb.length > 0, `${item.label} needs a line`)
  }
  for (let chain = 0; chain < ILLNESS_CHAINS.length; chain += 1) {
    for (let stage = 1; stage <= 4; stage += 1) {
      const cureKey = illnessAt(chain, stage).cureKey
      assert.ok(SHOP.some(item => item.key === cureKey), `${cureKey} must be on the shelf`)
    }
  }
  assert.ok(SHOP.some(i => i.key === REVIVE_ITEM.key), 'the revive item is stocked')
})

test('装扮 is bought once behind a level, then worn', () => {
  const pig = hatchEgg(T0)
  pig.coins = 200_000
  assert.equal(levelFor(pig.xp), 1, 'a fresh pig is level 1')

  assert.equal(buy(pig, 'scarf', T0).ok, true)
  assert.deepEqual(pig.dress, ['scarf'])
  assert.equal(pig.inventory.scarf ?? 0, 0, '家当 is not a consumable')
  assert.equal(buy(pig, 'scarf', T0).reason, 'owned', 'buying it twice is refused')

  const gate = buy(pig, 'wings', T0)
  assert.equal(gate.reason, 'low-level')
  assert.equal(gate.need, 50, 're-spread on the 60-level curve (2026-10-01)')
  assert.equal(gate.have, 1)
  assert.equal(pig.coins, 200_000 - 80, 'a refused purchase spends nothing')

  assert.equal(wearItem(pig, 'wings', T0).reason, 'not-owned')
  assert.equal(wearItem(pig, 'apple', T0).reason, 'unknown', 'only 装扮 can be worn')
  assert.equal(wearItem(pig, 'scarf', T0).ok, true)
  assert.deepEqual(pig.worn, ['scarf'])
  assert.equal(takeOff(pig, 'scarf', T0).ok, true)
  assert.deepEqual(pig.worn, [])
  assert.equal(useItem(pig, 'scarf', T0).reason, 'not-consumable', 'a scarf is worn, not eaten')

  // The level gate is real: growth for Lv.50 opens the wings.
  pig.xp = xpForLevel(50)
  assert.equal(levelFor(pig.xp), 50)
  assert.equal(buy(pig, 'wings', T0).ok, true)
  assert.deepEqual(pig.dress, ['scarf', 'wings'])
})

test('a save cannot dress the pig in medicine, or wear what it does not own', () => {
  const upgraded = migrate({ ...layEgg(T0), dress: ['scarf', 'scarf', 'apple', 'nope'], worn: ['scarf', 'crown'] }, T0)
  assert.deepEqual(upgraded.dress, ['scarf'], 'duplicates and non-dress items are dropped')
  assert.deepEqual(upgraded.worn, ['scarf'], 'only owned 装扮 can be worn')
})

test('every dress item has a real slot, and one piece goes per slot', () => {
  const pig = hatchEgg(T0)
  for (const item of dressView(pig)) {
    assert.ok(DRESS_SLOTS.some(slot => slot.key === item.slot), `${item.label} needs a real slot`)
    assert.ok(item.slotLabel !== '', `${item.label} needs a slot label`)
  }

  pig.coins = 200_000
  pig.xp = xpForLevel(50)
  for (const key of ['strawhat', 'flowercrown', 'tophat', 'scarf']) assert.equal(buy(pig, key, T0).ok, true)
  wearItem(pig, 'strawhat', T0)
  wearItem(pig, 'tophat', T0)
  assert.deepEqual(pig.worn, ['tophat'], 'the 头 slot holds one hat, the new one replaces it')
  wearItem(pig, 'scarf', T0)
  assert.deepEqual([...pig.worn].sort(), ['scarf', 'tophat'], 'a different slot stacks')
})

test('grantAll hands over one of everything, for debugging', () => {
  const pig = hatchEgg(T0)
  pig.coins = 10
  const result = grantAll(pig, T0)
  assert.equal(result.ok, true)
  assert.equal(pig.dress.length, 13)
  assert.equal(pig.coins, 99_999)
  for (const item of SHOP.filter(entry => entry.kind !== 'dress')) {
    assert.equal(pig.inventory[item.key], 20, `${item.label} should be in the bag`)
  }
  assert.equal(grantAll(null, T0).ok, false)
})

test('buying deducts coins and fills the backpack', () => {
  const pig = hatchEgg(T0)
  pig.coins = 50
  const result = buy(pig, 'apple', T0)
  assert.equal(result.ok, true)
  assert.equal(pig.coins, 44)
  assert.equal(pig.inventory.apple, 1)
  assert.equal(pig.stats.purchases, 1)
  assert.deepEqual(inventoryView(pig).apple, 1)
})

test('buying is refused when broke, and for unknown goods', () => {
  const pig = hatchEgg(T0)
  pig.coins = 3
  const poor = buy(pig, 'bone', T0)
  assert.equal(poor.ok, false)
  assert.equal(poor.reason, 'poor')
  assert.equal(pig.coins, 3, 'nothing was spent')
  assert.equal(buy(pig, 'yacht', T0).reason, 'unknown')
})

test('inventoryView lists the consumables and leaves 家当 out of the counts', () => {
  const pig = hatchEgg(T0)
  const view = inventoryView(pig)
  const consumables = SHOP.filter(item => item.kind !== 'dress')
  assert.equal(Object.keys(view).length, consumables.length + 1)
  assert.equal(view[DEFAULT_TOY.key], Infinity, 'the default toy never runs out')
  for (const item of consumables) assert.equal(view[item.key], 0)
  for (const item of SHOP.filter(entry => entry.kind === 'dress')) {
    assert.equal(item.key in view, false, `${item.label} is owned, not counted`)
  }
})

// ===========================================================================
// Housekeeping and display
// ===========================================================================

test('rename validates and cleans', () => {
  const pig = layEgg(T0)
  assert.equal(rename(pig, '  大花  ', T0), '大花')
  assert.equal(rename(pig, '', T0), null)
  assert.equal(rename(pig, '一二三四五六七八九十一二三四五六七', T0), null)
})

test('memories are capped', () => {
  const pig = hatchEgg(T0)
  for (let i = 0; i < 30; i += 1) act(pig, 'feed', T0 + (i + 1) * ACTIONS.feed.cooldownMs)
  assert.ok(pig.memories.length <= 8, `memories=${pig.memories.length}`)
  assert.ok(pig.pending.length <= 6, `pending=${pig.pending.length}`)
})

test('display helpers', () => {
  assert.equal(formatWeight(1200), '1.2 kg')
  assert.equal(healthPercent({ health: 5 }), 100)
  assert.equal(healthPercent({ health: 0 }), 0)
  assert.equal(healthPercent({ health: 3 }), 60)
  assert.equal(bar(0).includes('▓'), false)
  assert.equal(bar(100).includes('░'), false)
  assert.equal([...bar(50, 4)].length, 4)
  assert.equal(THRESHOLDS.hungry, 25)
})

test('developer mode can force any state, but only valid ones', () => {
  {
    const pig = hatchEgg(T0)
    // Numbers are clamped, so dev mode cannot produce a corrupt pig.
    applyDevPatch(pig, { satiety: 999, cleanliness: -50, health: 99, coins: -5 }, T0)
    assert.equal(pig.satiety, 100)
    assert.equal(pig.cleanliness, 0)
    assert.equal(pig.health, MAX.health)
    assert.equal(pig.coins, 0)

    // Illness is set to a real stage.
    applyDevPatch(pig, { illness: { chain: 0, stage: 4 }, health: 1 }, T0)
    assert.equal(pig.illness.stage, 4)
    assert.equal(currentIllness(pig).name, '肺炎')

    // Dying and coming back.
    applyDevPatch(pig, { dead: true }, T0)
    assert.equal(pig.dead, true)
    applyDevPatch(pig, { dead: false, health: 5 }, T0)
    assert.equal(pig.dead, false)

    // Age is jumpable — that is what takes months otherwise.
    // Level is what takes months now, so that is what dev mode jumps.
    applyDevPatch(pig, { level: 40 }, T0)
    assert.equal(lifeStageFor(pig, T0).key, 'middle')
    applyDevPatch(pig, { level: 999 }, T0)
    assert.equal(levelFor(pig.xp), 60, 'clamped to the max level')
    applyDevPatch(pig, { level: 1 }, T0)
    assert.equal(lifeStageFor(pig, T0).key, 'piglet')

    // And the clock can be fast-forwarded.
    const before = hatchEgg(T0)
    before.satiety = 100
    applyDevPatch(before, { __advanceMs: 12 * 3600_000 }, T0)
    assert.ok(before.satiety < 100, 'time moved')
  }
})

test('a forced age is marked, and can be put back on the real clock', () => {
  const pig = hatchEgg(T0)
  assert.equal(pig.ageForced, false, 'hatching is not a forced age')

  applyDevPatch(pig, { ageDays: 100 }, T0)
  assert.equal(pig.ageForced, true, 'the panel has to be able to say so')
  assert.equal(lifeStageFor(pig, T0).key, 'piglet', 'age no longer changes the body')

  ageFromNow(pig, T0)
  assert.equal(pig.ageForced, false)
  assert.equal(pig.bornAt, T0, 'the clock restarts now')

  // And a real birth clears any earlier force.
  const fresh = hatchEgg(T0)
  applyDevPatch(fresh, { ageDays: 9 }, T0)
  assert.equal(fresh.ageForced, true)
  reset(T0)
  const next = layEgg(T0)
  assert.equal(next.ageForced, false)
})


test('feeding has no cooldown: each bite costs food, and a full belly is the brake', () => {
  const pig = hatchEgg(T0)
  pig.satiety = 20
  pig.inventory = { apple: 3 }
  assert.equal(act(pig, 'feed', T0).ok, true)
  assert.equal(act(pig, 'feed', T0 + 1).ok, true, 'straight away, no waiting')
  assert.equal(act(pig, 'bathe', T0).reason === 'no-item', true, 'bathing still spends soap')
})

test('washing and playing can immediately spend another owned item', () => {
  const pig = hatchEgg(T0)
  pig.inventory = { soap: 2, yoyo: 2 }
  assert.equal(act(pig, 'bathe', T0, 'soap').ok, true)
  assert.equal(act(pig, 'bathe', T0 + 1, 'soap').ok, true)
  assert.equal(act(pig, 'play', T0, 'yoyo').ok, true)
  assert.equal(act(pig, 'play', T0 + 1, 'yoyo').ok, true)
  assert.equal(pig.inventory.soap, undefined)
  assert.equal(pig.inventory.yoyo, undefined)
})
