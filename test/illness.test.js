// @ts-check
/**
 * B3 疾病：按条件概率发病、五条链、吃错药加重、百草丹、看医生、旧药退款。
 * 数字对照 docs/numbers/B3-illness.md。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { act, decay, doctorFee, hatchEgg, migrate, onsetRisks, seeDoctor, useItem } from '../core.js'
import { CHAIN_INDEX, ILLNESS_CHAINS, ILLNESS_ONSET, REVIVE_ITEM, itemByKey } from '../data.js'
import { finishWork, finishStudy } from '../packages/pet-core/src/core/settlement.js'
import { rollForIllness } from '../packages/pet-core/src/core/illness.js'

const T0 = Date.parse('2026-10-01T09:00:00')
const HOUR = 3_600_000

const wellPig = () => {
  const pig = hatchEgg(T0)
  Object.assign(pig, { satiety: 80, cleanliness: 80, happiness: 80 })
  return pig
}
const chainsAtRisk = pig => onsetRisks(pig).map(risk => risk.chain)

test('each kind of neglect points at its own chain', () => {
  assert.deepEqual(chainsAtRisk(wellPig()), [-1], 'only the small base chance')
  assert.ok(chainsAtRisk({ ...wellPig(), satiety: 10 }).includes(CHAIN_INDEX.cold), 'hungry → 感冒')
  assert.ok(chainsAtRisk({ ...wellPig(), cleanliness: 30 }).includes(CHAIN_INDEX.cough), 'dirty → 咳嗽')
  assert.ok(chainsAtRisk({ ...wellPig(), cleanliness: 10 }).includes(CHAIN_INDEX.skin), 'filthy → 皮肤')
  assert.ok(chainsAtRisk({ ...wellPig(), happiness: 10 }).includes(CHAIN_INDEX.dizzy), 'miserable → 头晕')
  assert.ok(chainsAtRisk({ ...wellPig(), outingStreak: 3 }).includes(CHAIN_INDEX.dizzy), 'overworked → 头晕')
})

test('hungry and dirty: about eleven hours to fall ill (was: 12 minutes, always)', () => {
  // Monte Carlo over a fixed sequence: the median time to fall ill.
  let seed = 7
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const hours = []
  for (let trial = 0; trial < 400; trial += 1) {
    const pig = { ...wellPig(), satiety: 10, cleanliness: 30, illness: null, stats: { illnesses: 0 }, pending: [], memories: [] }
    let minutes = 0
    while (pig.illness === null && minutes < 20 * 24 * 60) {
      minutes += 5
      rollForIllness(pig, { minutes: 5, atMs: T0 + minutes * 60_000 }, next)
    }
    hours.push(minutes / 60)
  }
  hours.sort((a, b) => a - b)
  const median = hours[hours.length / 2]
  // 6.2%/h (slowed on 2026-10-01) → median ln(2)/-ln(1-0.062) ≈ 10.8 h.
  assert.ok(median > 8 && median < 14, `median ${median} h`)
  assert.ok(hours[Math.floor(hours.length * 0.9)] < 48, 'nine in ten within two days')
})

test('the pig does not fall ill while it is out', () => {
  const pig = wellPig()
  Object.assign(pig, { satiety: 5, cleanliness: 5, happiness: 5 })
  pig.activity = { kind: 'trip', key: 'suburb', label: '郊游', emoji: '🏞', startedAt: T0, endsAt: T0 + 6 * HOUR }
  decay(pig, T0 + 6 * HOUR, { roll: () => 0 })
  // It may fall ill the moment it is home, but not during the trip itself.
  assert.ok(pig.illness === null || pig.illness.since >= T0 + 6 * HOUR)
})

test('three outings in a row with no rest count as overwork; an hour at home resets it', () => {
  const pig = wellPig()
  for (let i = 0; i < ILLNESS_ONSET.overworkStreak; i += 1) finishWork(pig, { kind: 'work', key: 'bricks' }, T0)
  assert.equal(pig.outingStreak, 3)
  finishStudy(pig, { kind: 'study', key: 'chinese', stage: 'primary' }, T0)
  assert.equal(pig.outingStreak, 4)
  pig.lastSeenAt = T0
  decay(pig, T0 + 61 * 60_000, { roll: () => 0.99 })
  assert.equal(pig.outingStreak, 0, 'rested')
})

test('feeding a stuffed pig can upset its stomach', () => {
  let upset = 0
  for (let i = 0; i < 200; i += 1) {
    const pig = hatchEgg(T0 + i * 104_729)
    pig.satiety = 100
    pig.inventory = { apple: 1 }
    act(pig, 'feed', T0 + i * 104_729 + 1)
    if (pig.illness !== null) {
      assert.equal(pig.illness.chain, CHAIN_INDEX.stomach)
      upset += 1
    }
  }
  // G2（用户 2026-10-05 确认）：已经 100% 还硬喂才可能胀气，概率 15%。
  assert.ok(upset > 12 && upset < 50, `about 15%: ${upset}/200`)
  const nearlyFull = hatchEgg(T0)
  nearlyFull.satiety = 97
  nearlyFull.inventory = { apple: 1 }
  act(nearlyFull, 'feed', T0 + 1)
  assert.equal(nearlyFull.illness, null, '95～99 正常吃，不会胀气')
  const hungry = hatchEgg(T0)
  hungry.satiety = 50
  hungry.inventory = { apple: 1 }
  act(hungry, 'feed', T0 + 1)
  assert.equal(hungry.illness, null, 'a hungry pig can eat freely')
})

test('the wrong medicine at the last stage is fatal', () => {
  const pig = wellPig()
  pig.illness = { chain: CHAIN_INDEX.skin, stage: 4, since: T0, progressMs: 0 }
  pig.health = 1
  pig.inventory = { banlangen: 1 }
  assert.equal(useItem(pig, 'banlangen', T0).reason, 'wrong-medicine')
  assert.equal(pig.dead, true)
})

test('百草丹 cures any illness at any stage', () => {
  for (const [chain] of ILLNESS_CHAINS.entries()) {
    const pig = wellPig()
    pig.illness = { chain, stage: 3, since: T0, progressMs: 0 }
    pig.health = 2
    pig.inventory = { baicaodan: 1 }
    assert.equal(useItem(pig, 'baicaodan', T0).ok, true)
    assert.equal(pig.illness, null)
    assert.equal(pig.health, 5)
  }
})

test('the doctor cures for 1.5 x the price of the right medicine', () => {
  const pig = wellPig()
  pig.illness = { chain: CHAIN_INDEX.dizzy, stage: 2, since: T0, progressMs: 0 }
  pig.health = 3
  assert.equal(doctorFee(pig), 105, '止痛片 70 × 1.5')
  pig.coins = 100
  assert.equal(seeDoctor(pig, T0).reason, 'poor')
  pig.coins = 200
  assert.deepEqual(seeDoctor(pig, T0), { ok: true, fee: 105 })
  assert.equal(pig.coins, 95)
  assert.equal(pig.illness, null)
  assert.equal(seeDoctor(pig, T0).reason, 'not-sick')
})

test('prices by tier, and the item keys the B5 gifts rely on', () => {
  assert.deepEqual(ILLNESS_CHAINS.map(chain => chain.stages.map(entry => entry.cure.price)), Array(5).fill([30, 70, 140, 260]))
  for (const key of ['banlangen', 'xiaoshipian', 'pipa-syrup', 'baicaodan']) assert.ok(itemByKey(key) !== null, key)
  assert.equal(itemByKey('baicaodan').price, 500)
  assert.equal(REVIVE_ITEM.price, 800)
})

test('the v10 upgrade refunds the retired generic medicines at the new tier prices', () => {
  const old = { ...hatchEgg(T0), version: 9, coins: 100, inventory: { med1: 2, med4: 1, apple: 3 }, riskMinutes: 7 }
  const upgraded = migrate(JSON.parse(JSON.stringify(old)), T0)
  assert.equal(upgraded.coins, 100 + 2 * 30 + 260)
  assert.deepEqual(upgraded.inventory, { apple: 3 })
  assert.equal(upgraded.riskMinutes, undefined)
  assert.equal(upgraded.outingStreak, 0)
})
