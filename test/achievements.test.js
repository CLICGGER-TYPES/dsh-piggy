// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACHIEVEMENTS, FISH } from '../data.js'
import { adopt, hatchEgg, migrate, reset, settleAchievements, achievementsView } from '../core.js'
const NOW = 1_800_000_000_000
const entry = (state, key) => achievementsView(state).find(item => item.key === key)

test('twenty-eight achievements have distinct keys and pig badge art', () => {
  assert.equal(ACHIEVEMENTS.length, 28)
  assert.equal(new Set(ACHIEVEMENTS.map(item => item.key)).size, 28)
  assert.ok(ACHIEVEMENTS.every(item => item.art.startsWith('badge-pig-')))
})
test('first successful care unlocks once and viewing never mutates', () => {
  const state = hatchEgg(NOW)
  settleAchievements(state, NOW)
  state.stats.feeds = 1
  assert.deepEqual(settleAchievements(state, NOW + 1).map(item => item.key), ['first-meal'])
  assert.deepEqual(settleAchievements(state, NOW + 2), [])
  const before = JSON.stringify(state)
  assert.equal(entry(state, 'first-meal').firstAt, NOW + 1)
  assert.equal(entry(state, 'first-meal').acquired, true)
  assert.equal(JSON.stringify(state), before)
  assert.equal(state.pending.filter(item => item.kind === 'achievement').length, 1)
})
test('partial progress accumulates across generations; unlocked badges survive adoption', () => {
  const state = hatchEgg(NOW)
  state.stats.baths = 6
  settleAchievements(state, NOW)
  state.dead = true
  adopt(state, NOW + 10)
  settleAchievements(state, NOW + 10)
  state.hatched = true
  state.stats.baths = 4
  settleAchievements(state, NOW + 11)
  assert.equal(entry(state, 'clean-ten').progress, 10)
  assert.equal(entry(state, 'clean-ten').acquired, true)
  assert.equal(entry(state, 'clean-ten').firstAt, NOW + 11)
  assert.equal(achievementsView(reset(NOW)).some(item => item.acquired), false)
})
test('old saves backfill provable achievements silently without invented dates', () => {
  const state = hatchEgg(NOW)
  state.stats.jobs = 10
  state.stats.plays = 20
  const updated = migrate(state, NOW + 10)
  assert.equal(updated.version, 12)
  assert.equal(entry(updated, 'jobs-ten').acquired, true)
  assert.equal(entry(updated, 'jobs-ten').firstAt, null)
  assert.equal(entry(updated, 'jobs-ten').recovered, true)
  assert.equal(updated.pending.some(item => item.kind === 'achievement'), false)
})
test('fish species and past forms use known catalogue records, not currently selected art', () => {
  const state = hatchEgg(NOW)
  state.dex.fish = Object.fromEntries(FISH.slice(0,5).map((fish,i)=>[fish.key,{firstAt:NOW+i,count:1}]))
  state.dex.forms.king = {firstAt:NOW,count:1}
  state.form = null
  settleAchievements(state, NOW + 5)
  assert.equal(entry(state, 'fish-five').acquired, true)
  assert.equal(entry(state, 'king').acquired, true)
})
test('malformed save records are sanitized, unknown keys never appear', () => {
  const state = hatchEgg(NOW)
  state.stats.feeds = NaN
  state.achievements = { unlocked: { bogus:{firstAt:NOW}, 'first-meal':null }, totals: { baths:-5, jobs:Infinity }, seen: [] }
  settleAchievements(state, NOW)
  assert.equal(entry(state, 'first-meal').acquired, false)
  assert.equal(entry(state, 'clean-ten').progress, 0)
  assert.equal(achievementsView(state).length, 16)
  assert.ok(!('bogus' in state.achievements.unlocked))
})
test('simultaneous unlocks give one combined notice and never change economy', () => {
  const state = hatchEgg(NOW)
  const coins = state.coins
  state.stats.jobs = 100
  const unlocked = settleAchievements(state, NOW)
  assert.equal(unlocked.length, 3)
  assert.equal(state.pending.filter(item => item.kind === 'achievement').length, 1)
  assert.equal(state.coins, coins)
})
