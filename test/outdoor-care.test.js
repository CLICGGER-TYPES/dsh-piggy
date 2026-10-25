// @ts-check
/** 用户 2026-10-24：外出时可以喂食 / 清洁，活动、结束时间和奖励都不能被照料打乱。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { act, decay, ensureFishing, hatchEgg, startAutoFishing, startStudy, startTrip, startWork } from '../core.js'
import { JOBS } from '../data.js'

const T0 = 1_700_000_000_000
const MIN = 60_000
const roll = { roll: () => 0.99 }

function pigReady() {
  const pig = hatchEgg(T0)
  pig.satiety = 80
  pig.happiness = 60
  pig.cleanliness = 40
  pig.coins = 5000
  pig.inventory = { apple: 2, soap: 2 }
  return pig
}

const start = {
  work: pig => startWork(pig, 'bricks', T0),
  study: pig => startStudy(pig, 'chinese', 'primary', T0),
  trip: pig => startTrip(pig, 'suburb', T0),
}

test('feeding and cleaning do not cancel or reschedule a work shift, a lesson or a trip', () => {
  for (const kind of ['work', 'study', 'trip']) {
    const pig = pigReady()
    assert.equal(start[kind](pig).ok, true, `${kind}: activity starts`)
    decay(pig, T0 + 5 * MIN, roll)

    const activity = { ...pig.activity }
    const coins = pig.coins
    const jobs = pig.stats.jobs
    const courses = pig.stats.courses
    const trips = pig.stats.trips
    const at = pig.lastSeenAt + MIN

    const fed = act(pig, 'feed', at, 'apple')
    assert.equal(fed.ok, true, `${kind}: feeding is allowed while away`)
    assert.equal(fed.item, 'apple')
    assert.equal(pig.inventory.apple, 1, `${kind}: one apple, spent once`)
    assert.deepEqual(pig.activity, activity, `${kind}: feeding keeps the activity exactly as it was`)

    const bathed = act(pig, 'bathe', at + 1, 'soap')
    assert.equal(bathed.ok, true, `${kind}: cleaning is allowed while away`)
    assert.equal(bathed.item, 'soap')
    assert.equal(pig.inventory.soap, 1, `${kind}: one soap, spent once`)
    assert.deepEqual(pig.activity, activity, `${kind}: cleaning keeps the activity exactly as it was`)

    assert.equal(pig.coins, coins, `${kind}: care does not settle or refund the activity early`)
    assert.equal(pig.stats.jobs, jobs, `${kind}: no early work payout`)
    assert.equal(pig.stats.courses, courses, `${kind}: no early lesson completion`)
    assert.equal(pig.stats.trips, trips, `${kind}: no early trip completion`)
    assert.equal(pig.stats.feeds, 1)
    assert.equal(pig.stats.baths, 1)

    const endsAt = pig.activity.endsAt
    decay(pig, endsAt, roll)
    assert.equal(pig.activity, null, `${kind}: still ends on its original deadline`)

    if (kind === 'work') {
      assert.equal(pig.stats.jobs, 1, 'work pays exactly once')
      assert.equal(pig.coins, coins + JOBS[0].coins)
    } else if (kind === 'study') {
      assert.equal(pig.stats.courses, 1, 'the lesson counts exactly once')
      assert.equal(pig.lessons.chinese, 1)
    } else {
      assert.equal(pig.stats.trips, 1, 'the trip counts exactly once')
      assert.equal(pig.souvenirs.length, 1)
    }

    const after = { coins: pig.coins, jobs: pig.stats.jobs, courses: pig.stats.courses, trips: pig.stats.trips, souvenirs: pig.souvenirs.length }
    decay(pig, endsAt + MIN, roll)
    assert.deepEqual({ coins: pig.coins, jobs: pig.stats.jobs, courses: pig.stats.courses, trips: pig.stats.trips, souvenirs: pig.souvenirs.length }, after,
      `${kind}: settling again must not pay twice`)
  }
})

test('care during automatic fishing leaves the trip and its bait alone until fishing settles them', () => {
  const pig = pigReady()
  pig.inventory = { apple: 2, soap: 2, bait_worm: 5 }
  const fishing = ensureFishing(pig)
  fishing.automation.duration = 1
  fishing.automation.baitBox = 1

  const started = startAutoFishing(pig, 120, T0, 'bait_worm')
  assert.equal(started.ok, true)
  decay(pig, T0 + 1000, roll)

  const activity = { kind: pig.activity.kind, key: pig.activity.key, endsAt: pig.activity.endsAt, baitKey: pig.activity.baitKey, baitCount: pig.activity.baitCount }
  const bait = pig.inventory.bait_worm

  assert.equal(act(pig, 'feed', T0 + 1000, 'apple').ok, true)
  assert.equal(act(pig, 'bathe', T0 + 1000, 'soap').ok, true)
  assert.equal(pig.activity.kind, activity.kind)
  assert.equal(pig.activity.key, activity.key)
  assert.equal(pig.activity.endsAt, activity.endsAt)
  assert.equal(pig.activity.baitKey, activity.baitKey)
  assert.equal(pig.activity.baitCount, activity.baitCount)
  assert.equal(pig.inventory.bait_worm, bait, 'care must not spend fishing bait')
  assert.equal(pig.inventory.apple, 1)
  assert.equal(pig.inventory.soap, 1)

  decay(pig, activity.endsAt, roll)
  assert.equal(pig.activity, null)
  assert.equal(pig.stats.fishingAuto, 1, 'automatic fishing settles once')

  decay(pig, activity.endsAt + MIN, roll)
  assert.equal(pig.stats.fishingAuto, 1, 'and not again on the next tick')
})

test('an item that is missing or belongs on another shelf changes nothing', () => {
  const pig = pigReady()
  pig.inventory = { soap: 1, yoyo: 1 }
  startWork(pig, 'bricks', T0)
  decay(pig, T0 + MIN, roll)
  const activity = { ...pig.activity }

  const noFood = act(pig, 'feed', T0 + MIN, 'apple')
  assert.equal(noFood.ok, false)
  assert.equal(noFood.reason, 'no-item')
  assert.equal(noFood.kind, 'food')

  const wrongShelf = act(pig, 'feed', T0 + MIN, 'soap')
  assert.equal(wrongShelf.ok, false)
  assert.equal(wrongShelf.reason, 'no-item')
  assert.equal(wrongShelf.kind, 'food')

  const wrongBath = act(pig, 'bathe', T0 + MIN, 'yoyo')
  assert.equal(wrongBath.ok, false)
  assert.equal(wrongBath.reason, 'no-item')
  assert.equal(wrongBath.kind, 'bath')

  assert.equal(act(pig, 'play', T0 + MIN, 'yoyo').reason, 'away', 'playing still needs the pig at home')
  assert.deepEqual(pig.activity, activity)
  assert.deepEqual(pig.inventory, { soap: 1, yoyo: 1 })
})

test('a care action at the exact end of an activity lets the activity settle once, then cares', () => {
  const pig = pigReady()
  startWork(pig, 'bricks', T0)
  const endsAt = pig.activity.endsAt
  const coins = pig.coins

  const result = act(pig, 'feed', endsAt + 1000, 'apple')
  assert.equal(result.ok, true)
  assert.equal(pig.activity, null, 'the shift finished before the bite')
  assert.equal(pig.coins, coins + JOBS[0].coins, 'the pay is not lost')
  assert.equal(pig.stats.jobs, 1)
  assert.equal(pig.stats.feeds, 1)
  assert.equal(pig.inventory.apple, 1, 'the apple is still spent once')

  decay(pig, endsAt + 2 * MIN, roll)
  assert.equal(pig.stats.jobs, 1, 'the same shift must not pay twice')
  assert.equal(pig.coins, coins + JOBS[0].coins)
})
