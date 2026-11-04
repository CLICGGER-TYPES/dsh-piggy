// @ts-check
/**
 * 分段结算：一段长时间的空白要像实时过一样被结算。
 *
 * 以前 decay() 在空白开始时判一次「在不在外面」，然后整段都按那个算：
 * 15 分钟的零工 + 关掉 DSH 一整晚 = 整晚都享受「在外面」的保底、不会生病，
 * 结算消息还盖着「重新打开面板」那一刻的时间。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { decay, hatchEgg, startWork } from '../../../core.js'
import { JOBS } from '../../../data.js'
import { roll } from '../../../packages/pet-core/src/core/random.js'

const T0 = 1_700_000_000_000
const MIN = 60_000
const HOUR = 60 * MIN
const never = { roll: () => 0.99 }
/** Unlucky enough that neglect lands an illness the first step it can (B3 onset is a chance). */
const unlucky = { roll: () => 0.001 }

function workingPig() {
  const pig = hatchEgg(T0)
  pig.satiety = 100
  pig.cleanliness = 100
  pig.happiness = 100
  const job = JOBS[0]
  const result = startWork(pig, job.key, T0)
  assert.equal(result.ok, true, `could not start ${job.key}: ${result.reason}`)
  return { pig, job }
}

test('a job is paid and stamped at the moment it ended, not when someone looked', () => {
  const { pig } = workingPig()
  const endsAt = pig.activity.endsAt
  decay(pig, endsAt + 10 * HOUR, never)
  assert.equal(pig.activity, null)
  assert.equal(pig.lastActiveAt, endsAt, 'the pig came home when the shift ended')
  const workNotice = pig.pending.find(entry => entry.kind === 'work')
  assert.ok(workNotice !== undefined, 'the payout was announced')
  assert.equal(workNotice.at, endsAt)
})

test('time after a short job is time at home: no away floor, and neglect can make it sick', () => {
  const { pig } = workingPig()
  // Long enough at home for the bars to fall far below the away floor and
  // below the sickness thresholds.
  decay(pig, pig.activity.endsAt + 30 * HOUR, unlucky)
  assert.ok(pig.satiety < 15, `satiety ${pig.satiety} was held up by the away floor`)
  assert.notEqual(pig.illness, null, 'a night of neglect at home can make the pig ill')
})

test('an illness caught mid-gap starts when it was caught, and keeps progressing', () => {
  const pig = hatchEgg(T0)
  pig.satiety = 30
  pig.cleanliness = 100
  decay(pig, T0 + 3 * HOUR, unlucky)
  assert.notEqual(pig.illness, null)
  assert.ok(pig.illness.since < T0 + 3 * HOUR, 'it fell ill part-way through the gap')
  assert.ok(pig.illness.progressMs > 0, 'and the rest of the gap already counted toward it')
})

test('a gap settles the same whether it is walked in one call or many', () => {
  const once = hatchEgg(T0)
  const many = hatchEgg(T0)
  decay(once, T0 + 20 * HOUR, never)
  for (let at = T0 + 5 * MIN; at <= T0 + 20 * HOUR; at += 5 * MIN) decay(many, at, never)
  for (const key of ['satiety', 'happiness', 'cleanliness', 'ageMs']) {
    assert.ok(Math.abs(once[key] - many[key]) < 1e-6, `${key}: ${once[key]} vs ${many[key]}`)
  }
  assert.deepEqual(once.illness, many.illness)
})

test('the pig carries its own random sequence: same seed, same rolls', () => {
  const first = { seed: 42 }
  const second = { seed: 42 }
  const a = [roll(first), roll(first), roll(first)]
  const b = [roll(second), roll(second), roll(second)]
  assert.deepEqual(a, b)
  assert.ok(a.every(value => value >= 0 && value < 1))
  assert.notEqual(a[0], a[1], 'and the seed moves on after each roll')
  const unseeded = hatchEgg(T0)
  roll(unseeded)
  assert.ok(Number.isInteger(unseeded.seed), 'a pig without a seed gets one derived from itself')
})
