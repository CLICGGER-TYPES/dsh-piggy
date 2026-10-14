// @ts-check
/**
 * B3 疾病：按条件概率发病、五条链、吃错药加重、百草丹、看医生、旧药退款。
 * 数字对照 docs/numbers/B3-illness.md。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { act, adopt, decay, doctorFee, hatchEgg, migrate, onsetRisks, seeDoctor, useItem, awayBlockedReason, startWork } from '../core.js'
import { CHAIN_INDEX, ILLNESS_CHAINS, ILLNESS_ONSET, MAX, REVIVE_ITEM, itemByKey } from '../data.js'
import { finishWork, finishStudy } from '../packages/pet-core/src/core/settlement.js'
import { catchIllness, die, rollForIllness, worsen } from '../packages/pet-core/src/core/illness.js'

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

// ===========================================================================
// 返工5：垂危（无病，健康 1 格）也能看医生；发病 / 加重不把 health 往上抬（P3-2）。
// ===========================================================================

/** 垂危：没病、没死、健康只剩 1 格——`settleStarvation` 落下的那个状态。 */
const dyingPig = () => {
  const pig = wellPig()
  pig.health = 1
  pig.illness = null
  return pig
}

test('返工6：垂危无病看医生按阶梯 0 → 390 → 585 → 780 封顶，计数随次数涨', () => {
  const pig = dyingPig()
  pig.coins = 1_000_000
  const ladder = [0, 390, 585, 780, 780]
  for (let i = 0; i < ladder.length; i += 1) {
    assert.equal(pig.criticalDoctorVisits, i, `看诊前计数应为 ${i}`)
    assert.equal(doctorFee(pig), ladder[i], `第 ${i + 1} 次应收 ${ladder[i]}`)
    const before = pig.coins
    assert.deepEqual(seeDoctor(pig, T0), { ok: true, fee: ladder[i] })
    assert.equal(before - pig.coins, ladder[i], `第 ${i + 1} 次实扣 ${ladder[i]}`)
    assert.equal(pig.criticalDoctorVisits, i + 1, '只有垂危这一支让计数 +1')
    assert.equal(pig.health, MAX.health, '看一次回满')
    assert.equal(pig.illness, null)
    pig.health = 1 // 回到垂危，测下一次
  }
  // 垂危本来没病，措辞不能说「病好了」（这里只钉住不谎报）。
  assert.ok(pig.memories[pig.memories.length - 1].includes('身体恢复了'), pig.memories[pig.memories.length - 1])
})

test('返工6：垂危看诊第 1 次免费（coins 不变、fee 0）；钱不够按 poor 拦下、need / have 语义不变', () => {
  const pig = dyingPig()
  assert.equal(pig.criticalDoctorVisits, 0)
  assert.equal(doctorFee(pig), 0, '第 1 次免费')
  pig.coins = 0
  assert.deepEqual(seeDoctor(pig, T0), { ok: true, fee: 0 }, '免费那次 0 金币也能过')
  assert.equal(pig.coins, 0, '不花钱')
  assert.equal(pig.criticalDoctorVisits, 1)
  pig.health = 1
  assert.equal(doctorFee(pig), 390, '第 2 次 390')
  pig.coins = 389
  assert.deepEqual(seeDoctor(pig, T0), { ok: false, reason: 'poor', need: 390, have: 389 })
  assert.equal(pig.health, 1, '钱不够还是垂危')
  assert.equal(pig.criticalDoctorVisits, 1, '钱不够不计数')
  pig.coins = 390
  assert.deepEqual(seeDoctor(pig, T0), { ok: true, fee: 390 })
  assert.equal(pig.coins, 0)
  assert.equal(pig.criticalDoctorVisits, 2)
})

test('返工6：有具体疾病时照旧药价 ×1.5（止痛片 105），且不动垂危计数', () => {
  const pig = wellPig()
  pig.illness = { chain: CHAIN_INDEX.dizzy, stage: 2, since: T0, progressMs: 0 }
  pig.health = 3
  pig.criticalDoctorVisits = 4
  assert.equal(doctorFee(pig), 105, '止痛片 70 × 1.5')
  pig.coins = 105
  assert.deepEqual(seeDoctor(pig, T0), { ok: true, fee: 105 })
  assert.equal(pig.illness, null)
  assert.equal(pig.criticalDoctorVisits, 4, '有病的看诊不动垂危计数')
})

test('返工6：换新猪（adopt）把垂危看诊次数清零；老存档 / 坏值迁移后为 0', () => {
  const pig = dyingPig()
  pig.criticalDoctorVisits = 3
  adopt(pig, T0 + HOUR)
  assert.equal(pig.criticalDoctorVisits, 0, '领养新猪重新算')

  // 老存档（v13 没有这个字段）：迁移后补 0。
  const old = { ...hatchEgg(T0), version: 13 }
  delete old.criticalDoctorVisits
  assert.equal(migrate(old, T0).criticalDoctorVisits, 0)
  // 手改的坏值（负数 / 非有限）也归 0。
  assert.equal(migrate({ ...hatchEgg(T0), version: 13, criticalDoctorVisits: -5 }, T0).criticalDoctorVisits, 0)
  assert.equal(migrate({ ...hatchEgg(T0), version: 13, criticalDoctorVisits: Number.NaN }, T0).criticalDoctorVisits, 0)
})

test('返工5：没病不垂危 / 已死的猪，看诊行为逐位不变', () => {
  const normal = wellPig()
  assert.equal(doctorFee(normal), null)
  assert.deepEqual(seeDoctor(normal, T0), { ok: false, reason: 'not-sick' })
  const dead = wellPig()
  die(dead, T0, '测试')
  assert.equal(doctorFee(dead), null)
  assert.equal(seeDoctor(dead, T0).reason, 'dead')
})

test('返工5 P3-2：垂危期间发病 / 加重都不抬 health，也不能出门；正常猪取值不变', () => {
  const pig = dyingPig()
  catchIllness(pig, CHAIN_INDEX.cold, T0)
  assert.equal(pig.health, 1, '发病不把垂危抬回 4')
  assert.equal(pig.illness.stage, 1)
  assert.equal(startWork(pig, 'bricks', T0).reason, 'weak', '垂危不能出门打工')
  assert.equal(awayBlockedReason(pig), 'weak')
  worsen(pig, T0 + HOUR, '没能撑过去')
  assert.equal(pig.illness.stage, 2, '病情照常加重')
  assert.equal(pig.health, 1, '加重也不抬，still 垂危')
  assert.equal(awayBlockedReason(pig), 'weak', '不能出门的拦截继续生效')

  // 正常猪：健康高于任何阶段的格数，取 min 后逐位不变。
  const normal = wellPig()
  normal.health = 5
  catchIllness(normal, CHAIN_INDEX.cold, T0)
  assert.equal(normal.health, 4, '正常猪发病照旧到 4')
  worsen(normal, T0 + HOUR, '没能撑过去')
  assert.equal(normal.health, 3, '正常猪加重照旧到 3')
})
