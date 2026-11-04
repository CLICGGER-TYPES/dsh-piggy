// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { adopt, applyDevPatch, buy, hatchEgg, migrate, useItem } from '../../../core.js'
import { xpForLevel } from '../../../data.js'
import { dexView } from '../../../packages/pet-core/src/core/dex.js'

const NOW = 1_800_000_000_000

function readyKing() {
  const state = hatchEgg(NOW)
  state.xp = xpForLevel(40)
  state.traits = { intel: 20, charm: 20, strong: 20 }
  state.stats.jobs = 10
  state.coins = 99_999
  return state
}

test('C4 a new pig starts with an empty dex without a save-version bump', () => {
  const state = hatchEgg(NOW)
  assert.deepEqual(state.dex, { forms: {}, skins: {}, fish: {}, items: {}, souvenirs: {} })
  const before = state.version
  const loaded = migrate({ ...state, dex: undefined }, NOW)
  assert.equal(loaded.version, before)
  assert.deepEqual(loaded.dex, { forms: {}, skins: {}, fish: {}, items: {}, souvenirs: {} })
})

test('C4 buying an item records first acquisition time and acquisition count', () => {
  const state = readyKing()
  assert.equal(buy(state, 'apple', NOW).ok, true)
  assert.deepEqual(state.dex.items.apple, { firstAt: NOW, count: 1 })
  assert.equal(buy(state, 'apple', NOW + 1_000).ok, true)
  assert.deepEqual(state.dex.items.apple, { firstAt: NOW, count: 2 })
})

test('C4 changing form records it, including the developer shortcut', () => {
  const state = readyKing()
  state.inventory.crown = 1
  assert.equal(useItem(state, 'crown', NOW).ok, true)
  assert.deepEqual(state.dex.forms.king, { firstAt: NOW, count: 1 })
  applyDevPatch(state, { form: 'devil' }, NOW + 1_000)
  assert.deepEqual(state.dex.forms.devil, { firstAt: NOW + 1_000, count: 1 })
})

test('C4 an old save seeds owned things and keeps discoveries after they leave the bag', () => {
  const old = readyKing()
  const version = old.version
  delete old.dex
  old.form = 'king'
  old.inventory.apple = 2
  old.souvenirs = [
    { key: 'shell', gotAt: NOW - 2_000 },
    { key: 'shell', gotAt: NOW - 1_000 },
  ]
  const loaded = migrate(old, NOW)
  assert.equal(loaded.version, version)
  assert.deepEqual(loaded.dex.forms.king, { firstAt: NOW, count: 1 })
  assert.deepEqual(loaded.dex.items.apple, { firstAt: NOW, count: 2 })
  assert.deepEqual(loaded.dex.souvenirs.shell, { firstAt: NOW - 2_000, count: 2 })
  loaded.inventory.apple = 0
  loaded.souvenirs = []
  assert.deepEqual(loaded.dex.items.apple, { firstAt: NOW, count: 2 })
  assert.deepEqual(loaded.dex.souvenirs.shell, { firstAt: NOW - 2_000, count: 2 })
})

test('C4 the collection follows the owner when a dead pig is adopted', () => {
  const state = readyKing()
  buy(state, 'apple', NOW)
  state.dead = true
  state.health = 0
  adopt(state, NOW + 1_000)
  assert.deepEqual(state.dex.items.apple, { firstAt: NOW, count: 1 })
})

test('C4 form catalogue carries its SVG, story and a riddle instead of exposing the recipe', () => {
  const state = readyKing()
  const formView = {
    forms: [{ key: 'king', requirements: [{ key: 'level', label: '等级', have: 40, need: 40, met: true }] }],
  }
  const [king] = dexView(state, formView, NOW).forms
  assert.equal(king.art, 'pig-king')
  assert.match(king.description, /王冠/)
  assert.match(king.hint, /金色/)
  assert.notEqual(king.hint, king.condition)
})
