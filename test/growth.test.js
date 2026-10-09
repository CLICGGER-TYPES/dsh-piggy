// @ts-check
/**
 * B2 成长：时间自己长、照顾好坏定快慢、陪主人干活有每日上限的加成、升级和换形态。
 * 数字对照 docs/numbers/B2-growth.md。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { careFactor, dayKeyFor, decay, feed, hatchEgg, layEgg, levelFor, lifeStageFor, migrate } from '../core.js'
import { DSH_GROWTH_DAILY_CAP, GROWTH_PER_HOUR, MAX_LEVEL, xpForLevel } from '../data.js'
import { finishWork } from '../packages/pet-core/src/core/settlement.js'
import { JOBS } from '../data.js'

const T0 = Date.parse('2026-10-01T09:00:00')
const HOUR = 3_600_000
const never = { roll: () => 0.99 }

/** A pig kept at full care for `hours`, topped up every hour. */
function keptWell(pig, hours) {
  for (let h = 1; h <= hours; h += 1) {
    pig.satiety = 100
    pig.cleanliness = 100
    pig.happiness = 100
    decay(pig, T0 + h * HOUR, never)
  }
  return pig
}

test('the curve: 122 x L^2, capped at Lv60', () => {
  assert.equal(xpForLevel(1), 0)
  assert.equal(xpForLevel(10), 12_200)
  assert.equal(xpForLevel(40), 195_200)
  assert.equal(xpForLevel(60), 439_200)
  assert.equal(levelFor(xpForLevel(60) * 3), MAX_LEVEL)
  // Six months at the base rate is the whole ladder.
  assert.ok(Math.abs(xpForLevel(60) / GROWTH_PER_HOUR / 24 - 183) < 1)
})

test('a well-kept pig grows 100 an hour, on its own', () => {
  const pig = keptWell(hatchEgg(T0), 24)
  assert.ok(Math.abs(pig.xp - 24 * GROWTH_PER_HOUR) < 1, `grew ${pig.xp}`)
})

test('care sets the pace: mood bands, hunger or dirt, illness', () => {
  const pig = hatchEgg(T0)
  const at = patch => careFactor({ ...pig, satiety: 100, cleanliness: 100, happiness: 100, illness: null, health: 5, ...patch })
  assert.equal(at({}), 1)
  assert.equal(at({ happiness: 60 }), 0.9)
  assert.equal(at({ happiness: 40 }), 0.7)
  assert.equal(at({ happiness: 10 }), 0.5)
  assert.equal(at({ satiety: 10 }), 0.7, 'hungry')
  assert.equal(at({ cleanliness: 10 }), 0.7, 'dirty')
  assert.equal(at({ satiety: 10, cleanliness: 10 }), 0.7, 'hungry and dirty only count once')
  assert.ok(Math.abs(at({ illness: { chain: 0, stage: 2 }, health: 3 }) - 0.7) < 1e-9, 'two health down: -30%')
  // The worked example on the sheet: mood 60% and a bit hungry -> 63 an hour.
  assert.ok(Math.abs(at({ happiness: 60, satiety: 10 }) * GROWTH_PER_HOUR - 63) < 1e-9)
  // The worst a living pig can be: 0.5 x 0.7 x 0.4. The 10% floor is only a guard.
  assert.ok(Math.abs(at({ happiness: 0, satiety: 0, illness: { chain: 0, stage: 4 }, health: 1 }) - 0.14) < 1e-9)
})

test('real work adds growth, up to 300 a day, and the day starts at 06:00', () => {
  const pig = hatchEgg(T0)
  pig.lastSeenAt = T0
  for (let i = 0; i < 200; i += 1) feed(pig, 'turn', T0)
  assert.equal(pig.xp, DSH_GROWTH_DAILY_CAP, 'capped for the day')
  // 05:30 the next morning is still the same day.
  const beforeSix = Date.parse('2026-10-02T05:30:00')
  assert.equal(dayKeyFor(beforeSix), dayKeyFor(T0))
  const afterSix = Date.parse('2026-10-02T06:10:00')
  const grown = pig.xp
  pig.lastSeenAt = afterSix
  feed(pig, 'tool', afterSix)
  assert.equal(pig.xp, grown + 1, 'a new day, a new allowance')
})

test('levelling up is announced once per crossing, with a line, and counted', () => {
  const pig = hatchEgg(T0)
  pig.xp = xpForLevel(2) - 1
  pig.lastSeenAt = T0
  pig.pending = []
  keptWell(pig, 1)
  assert.equal(levelFor(pig.xp), 2)
  assert.equal(pig.stats.levelUps, 1)
  assert.equal(pig.pending.filter(entry => entry.kind === 'levelup').length, 1)
  assert.ok(pig.pending.some(entry => entry.kind === 'line'), 'the pig says something about it')
})

test('reaching Lv10 turns the piglet into a young pig, and says so', () => {
  const pig = hatchEgg(T0)
  pig.xp = xpForLevel(10) - 10
  pig.lastSeenAt = T0
  pig.pending = []
  keptWell(pig, 1)
  assert.equal(pig.stage, 'young')
  assert.equal(lifeStageFor(pig, T0 + HOUR).key, 'young')
  assert.ok(pig.pending.some(entry => entry.kind === 'stage'))
})

test('a shift is worth 25 growth an hour on top of the pay', () => {
  const pig = hatchEgg(T0)
  const job = JOBS.find(entry => entry.minutes === 60) ?? JOBS[0]
  const before = pig.xp
  finishWork(pig, { kind: 'work', key: job.key }, T0)
  assert.equal(pig.xp - before, Math.round((job.minutes / 60) * 25))
})

test('the debug time scale speeds growth up with age', () => {
  const pig = hatchEgg(T0)
  pig.timeScale = 12
  keptWell(pig, 2)
  assert.ok(Math.abs(pig.xp - 2 * 12 * GROWTH_PER_HOUR) < 1)
})

test('an unopened box does not grow, whatever happens around it', () => {
  const box = layEgg(T0)
  decay(box, T0 + 48 * HOUR, never)
  feed(box, 'turn', T0 + 48 * HOUR)
  assert.equal(box.xp, 0)
})

test('every pig gets a sex when it hatches; the panel save keeps it', () => {
  const seen = new Set()
  for (let i = 0; i < 40; i += 1) seen.add(hatchEgg(T0 + i * 7919).sex)
  assert.deepEqual([...seen].sort(), ['boy', 'girl'], 'both come up')
  const pig = hatchEgg(T0)
  assert.equal(migrate(JSON.parse(JSON.stringify(pig)), T0).sex, pig.sex)
})

test('the v9 upgrade: elders become grown pigs, boxes get no sex yet', () => {
  const elder = migrate({ ...hatchEgg(T0), version: 8, stage: 'elder', xp: 20 * 45 * 44 }, T0)
  assert.equal(levelFor(elder.xp), 45)
  assert.equal(elder.stage, 'middle')
  const box = migrate({ ...layEgg(T0), version: 8, xp: 0 }, T0)
  assert.equal(box.sex, undefined)
  assert.equal(box.stage, 'box')
})
