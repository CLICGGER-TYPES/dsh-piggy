import { PIG_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'
// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  STATE_VERSION, act, applyDevPatch, bodyWeightClass, bodyWeightView, decay,
  ensureBodyWeight, formStageView, hatchEgg, idealWeightG, migrate,
  reducePlayWeight, reduceWorkWeight, settleWeight,
} from '../core.js'
import { WEIGHT_RULES, xpForLevel } from '../data.js'

const NOW = 1_800_000_000_000
const DAY = 86_400_000

function pig(level = 40, ratio = 1) {
  const state = hatchEgg(NOW)
  state.xp = xpForLevel(level)
  state.weightG = idealWeightG(state) * ratio
  state.lastSeenAt = NOW
  return state
}

test('C7 ideal weight follows the existing feeding and growth rates and caps at Lv60', () => {
  assert.equal(idealWeightG(hatchEgg(NOW)), 1360)
  for (const [level, expected] of [[10, 3756], [20, 10943], [40, 39690], [60, 87603]]) {
    assert.ok(Math.abs(idealWeightG(pig(level)) - expected) <= 2)
  }
  const maxed = pig(60)
  maxed.xp = Number.MAX_SAFE_INTEGER
  assert.equal(idealWeightG(maxed), idealWeightG(pig(60)))
})

test('C7 has exact normal, round and fat boundaries', () => {
  const state = pig()
  const ideal = idealWeightG(state)
  state.weightG = ideal * WEIGHT_RULES.roundRatio - 0.001
  assert.equal(bodyWeightClass(state), 'normal')
  state.weightG = ideal * WEIGHT_RULES.roundRatio
  assert.equal(bodyWeightClass(state), 'round')
  state.weightG = ideal * WEIGHT_RULES.fatRatio - 0.001
  assert.equal(bodyWeightClass(state), 'round')
  state.weightG = ideal * WEIGHT_RULES.fatRatio
  assert.equal(bodyWeightClass(state), 'fat')
})

test('C7 keeps save version v12 and ensures its daily exercise record', () => {
  assert.equal(STATE_VERSION, 12)
  const old = pig(40, 1.7)
  delete old.bodyWeight
  old.version = 12
  const loaded = migrate(JSON.parse(JSON.stringify(old)), NOW)
  assert.equal(loaded.version, 12)
  assert.equal(loaded.weightG, old.weightG)
  assert.deepEqual(loaded.bodyWeight, { playDay: '', plays: 0 })
  loaded.bodyWeight = { playDay: [], plays: Infinity }
  assert.deepEqual(ensureBodyWeight(loaded), { playDay: '', plays: 0 })
})

test('C7 successful play reduces only excess weight by 3%, at most ten times per game day', () => {
  const state = pig(40, 1.6)
  const ideal = idealWeightG(state)
  assert.equal(act(state, 'play', NOW).ok, true)
  assert.ok(Math.abs(state.weightG - (ideal + ideal * 0.6 * 0.97)) < 0.001)
  assert.equal(state.bodyWeight.plays, 1)
  assert.equal(act(state, 'play', NOW).ok, true)
  assert.equal(state.bodyWeight.plays, 2)
  for (let count = 1; count < 10; count += 1) reducePlayWeight(state, NOW)
  const afterTen = state.weightG
  reducePlayWeight(state, NOW)
  assert.equal(state.weightG, afterTen)
  reducePlayWeight(state, NOW + DAY)
  assert.equal(state.bodyWeight.plays, 1)
  assert.ok(state.weightG < afterTen)
})

test('C7 work and natural metabolism reduce only weight above ideal and compound consistently', () => {
  const state = pig(60, 1.6)
  const ideal = idealWeightG(state)
  reduceWorkWeight(state, 30)
  assert.ok(Math.abs(state.weightG - (ideal + ideal * 0.6 * 0.97 ** 0.5)) < 0.001)
  const daily = pig(60, 1.6)
  settleWeight(daily, DAY)
  assert.ok(Math.abs(daily.weightG - (ideal + ideal * 0.6 * 0.98)) < 0.001)
  const split = pig(60, 1.6)
  for (let count = 0; count < 24; count += 1) settleWeight(split, DAY / 24)
  assert.ok(Math.abs(split.weightG - daily.weightG) < 0.001)
  const lean = pig(60, 0.8)
  const before = lean.weightG
  settleWeight(lean, DAY)
  reduceWorkWeight(lean, 240)
  reducePlayWeight(lean, NOW)
  assert.equal(lean.weightG, before)
})

test('C7 round uses the original contributed artwork and fat uses the new larger set', () => {
  const round = pig(40, 1.3)
  assert.equal(formStageView(round, NOW).art, 'pig-round')
  assert.equal(bodyWeightView(round, NOW).visible, true)
  assert.equal(bodyWeightView(round, NOW).class, 'round')
  const fat = pig(40, 1.6)
  assert.equal(formStageView(fat, NOW).art, 'pig-fat')
  assert.equal(formStageView(fat, NOW).actionArt, true)
  assert.equal(bodyWeightView(fat, NOW).visible, true)
  round.skin = 'chocolate'
  assert.notEqual(formStageView(round, NOW).art, 'pig-round')
  for (const [form, art] of [['king', 'pig-king'], ['devil', 'pig-devil']]) {
    fat.form = form
    assert.equal(formStageView(fat, NOW).art, art)
    assert.equal(bodyWeightView(fat, NOW).visible, false)
  }
})

test('both weight tiers ship every action sprite as distinct PNG art', () => {
  for (const suffix of ['', '-relaxed', '-pet', '-eat', '-bathe', '-play', '-work', '-study', '-trip']) {
    const round = readFileSync(new URL('../assets/' + PIG_ART_ASSETS['pig-round' + suffix], import.meta.url))
    const fat = readFileSync(new URL('../assets/' + PIG_ART_ASSETS['pig-fat' + suffix], import.meta.url))
    assert.equal(round.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(fat.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(round.equals(fat), false)
  }
})

test('C7 dev patch sets all three body classes from the current ideal weight', () => {
  const state = pig(40)
  for (const [bodyClass, ratio] of [['normal', 1], ['round', 1.31], ['fat', 1.61]]) {
    applyDevPatch(state, { weightClass: bodyClass }, NOW)
    assert.equal(bodyWeightClass(state), bodyClass)
    assert.equal(state.weightG, Math.round(idealWeightG(state) * ratio))
  }
})

test('C7 debug fat and round presets land safely inside their class after a minute', () => {
  const state = pig(40)
  applyDevPatch(state, { weightClass: 'fat' }, NOW)
  settleWeight(state, 60_000)
  assert.equal(bodyWeightClass(state), 'fat')
  applyDevPatch(state, { weightClass: 'round' }, NOW)
  settleWeight(state, 60_000)
  assert.equal(bodyWeightClass(state), 'round')
})

test('C7 accelerated settlement uses pig time and never changes a box or dead pig', () => {
  const accelerated = pig(60, 1.6)
  accelerated.timeScale = 12
  decay(accelerated, NOW + DAY / 12, { roll: () => 1 })
  const direct = pig(60, 1.6)
  settleWeight(direct, DAY)
  assert.ok(Math.abs(accelerated.weightG - direct.weightG) < 0.01)
  const dead = pig(40, 1.6)
  dead.dead = true
  const before = dead.weightG
  settleWeight(dead, DAY)
  assert.equal(dead.weightG, before)
})
