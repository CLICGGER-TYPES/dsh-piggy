import test from 'node:test'
import assert from 'node:assert/strict'

import { decay, hatchEgg, sellSouvenir, startTrip, tripUnlocked } from '../packages/pet-core/src/core.js'
import { ALL_SOUVENIRS, SKINS, TRIPS, rarityByKey, souvenirPrice } from '../packages/pet-core/src/data.js'
import { INCOME_LINES } from '../packages/pet-core/src/data/economy.js'

const T0 = new Date(2026, 9, 9, 9, 0).getTime()
const FOOD_PER_POINT = 10 / 32

test('旅行 15 个地点（J1 第 5 节），纪念品不重名、每件都有故事和卖价', () => {
  assert.equal(TRIPS.length, 15)
  assert.equal(new Set(TRIPS.map(trip => trip.key)).size, 15)
  assert.equal(new Set(ALL_SOUVENIRS.map(entry => entry.key)).size, ALL_SOUVENIRS.length)
  assert.equal(new Set(ALL_SOUVENIRS.map(entry => entry.label)).size, ALL_SOUVENIRS.length, 'no two souvenirs share a name')
  for (const entry of ALL_SOUVENIRS) {
    assert.ok(entry.story.length >= 8, entry.key)
    assert.ok(entry.price > 0 && entry.price <= rarityByKey(entry.rarity).price, `${entry.key} is never dearer than its rarity`)
  }
})

test('经济：来回跑一个地点、回来就卖纪念品，挣得不超过挂机线起步（不能拿旅行刷钱）', () => {
  for (const trip of TRIPS) {
    const average = trip.souvenirs.reduce((sum, entry) => sum + entry.price, 0) / trip.souvenirs.length
    const perHour = (average - trip.cost + trip.satiety * FOOD_PER_POINT) / (trip.minutes / 60)
    assert.ok(perHour <= INCOME_LINES.idle.start[1], `${trip.key} ${perHour.toFixed(0)}/h`)
  }
})

test('太空站要当过宇航员：没解锁宇航员外观去不了、不扣钱', () => {
  const space = TRIPS.find(trip => trip.key === 'spacestation')
  const pig = hatchEgg(T0)
  pig.coins = 10_000
  assert.equal(tripUnlocked(pig, space), false)
  assert.deepEqual(startTrip(pig, 'spacestation', T0), { ok: false, reason: 'trip-locked', need: '当过宇航员' })
  assert.equal(pig.coins, 10_000)
  const astronaut = SKINS.find(skin => 'unlockJob' in skin && skin.unlockJob === 'astronaut')
  pig.dex.skins[astronaut.key] = { at: T0, count: 1 }
  assert.equal(tripUnlocked(pig, space), true)
  assert.equal(startTrip(pig, 'spacestation', T0).ok, true)
  assert.equal(pig.coins, 10_000 - space.cost)
  assert.ok(TRIPS.filter(trip => trip.key !== 'spacestation').every(trip => tripUnlocked(hatchEgg(T0), trip)))
})

test('近处的纪念品按表上的便宜价卖；老存档里表上没有的按稀有度', () => {
  const pig = hatchEgg(T0)
  pig.coins = 100
  startTrip(pig, 'park', T0)
  decay(pig, pig.activity.endsAt)
  const kept = pig.souvenirs[0]
  assert.equal(souvenirPrice(kept), 30)
  assert.equal(sellSouvenir(pig, kept.key, T0).coins, 30)
  assert.equal(souvenirPrice({ key: '贝壳', rarity: 'rare' }), rarityByKey('rare').price)
})
