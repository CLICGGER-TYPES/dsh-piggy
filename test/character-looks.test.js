// @ts-check
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { applyDevPatch, decay, formStageView, hatchEgg, migrate, selectSkin, skinView, startWork } from '../core.js'
import { SKINS, xpForLevel } from '../data.js'
import { PIG_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'
import { finishWork } from '../packages/pet-core/src/core/settlement.js'
import { dexView } from '../packages/pet-core/src/core/dex.js'
import { renderDevTab } from '../src/client/tabs/dev.js'
import { PIG, SNAPSHOT, fakeDom, findByAttr } from './helpers/bundle.js'

const NOW = 1_800_000_000_000
const actions = ['', '-relaxed', '-pet', '-eat', '-bathe', '-play', '-work', '-study', '-trip']

test('six supplied characters have nine real action PNGs, with fishing falling back to idle', () => {
  const expected = new Map([
    ['chef', 'chef'], ['astronaut', 'astronaut'],
    ['detective', null], ['angel', null], ['pirate', null], ['wizard', null],
  ])
  for (const [key, job] of expected) {
    const skin = SKINS.find(entry => entry.key === key)
    assert.ok(skin, key)
    assert.equal(skin.unlockJob ?? null, job)
    assert.equal(skin.scenes.includes('fish'), false, 'missing fish art must use idle')
    for (const suffix of actions) {
      const png = readFileSync(new URL('../assets/' + PIG_ART_ASSETS[skin.art + suffix], import.meta.url))
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    }
  }
})

test('career looks require the matching completed shift; other four looks are free', () => {
  const state = hatchEgg(NOW)
  for (const key of ['detective', 'angel', 'pirate', 'wizard']) {
    assert.equal(selectSkin(state, key, NOW).ok, true, key)
  }
  assert.equal(selectSkin(state, 'chef', NOW).reason, 'locked')
  assert.equal(selectSkin(state, 'astronaut', NOW).reason, 'locked')
  assert.equal(skinView(state).entries.find(entry => entry.key === 'chef').unlocked, false)
  assert.equal(dexView(state, null, NOW).skins.find(entry => entry.key === 'chef').acquired, false)

  finishWork(state, { key: 'chef', startedAt: NOW, endsAt: NOW + 120 * 60_000 }, NOW + 120 * 60_000, () => 1)
  assert.equal(state.dex.skins.chef.count, 1)
  assert.equal(dexView(state, null, NOW).skins.find(entry => entry.key === 'chef').acquired, true)
  assert.equal(selectSkin(state, 'chef', NOW + 120 * 60_000).ok, true)
  assert.equal(selectSkin(state, 'chef', NOW + 120 * 60_000).ok, true)
  assert.equal(state.dex.skins.chef.count, 1, 'switching is not a second acquisition')
  assert.equal(formStageView(state, NOW).art, 'career-chef')
  assert.equal(selectSkin(state, 'astronaut', NOW).reason, 'locked')
  finishWork(state, { key: 'astronaut', startedAt: NOW, endsAt: NOW + 480 * 60_000 }, NOW + 480 * 60_000, () => 1)
  assert.equal(selectSkin(state, 'astronaut', NOW).ok, true)
  assert.equal(formStageView(state, NOW).art, 'career-astronaut')
})

test('career unlock happens on actual job completion, not when its shift starts', () => {
  const state = hatchEgg(NOW)
  state.xp = xpForLevel(12)
  state.lessons = { labour: 20, manners: 9 }
  state.satiety = 100
  state.cleanliness = 100
  assert.equal(startWork(state, 'chef', NOW).ok, true)
  assert.equal(state.dex.skins.chef, undefined)
  decay(state, state.activity.endsAt, { roll: () => 1 })
  assert.equal(state.dex.skins.chef.count, 1)
  assert.equal(skinView(state).entries.find(entry => entry.key === 'chef').unlocked, true)
})

test('career unlock and selected look survive old-save loading and forms still take priority', () => {
  const state = hatchEgg(NOW)
  const version = state.version
  finishWork(state, { key: 'chef', startedAt: NOW, endsAt: NOW + 120 * 60_000 }, NOW + 120 * 60_000, () => 1)
  selectSkin(state, 'chef', NOW)
  const loaded = migrate(JSON.parse(JSON.stringify(state)), NOW)
  assert.equal(loaded.version, version)
  assert.equal(loaded.skin, 'chef')
  assert.equal(loaded.dex.skins.chef.count, 1)
  loaded.xp = xpForLevel(40)
  loaded.form = 'king'
  assert.equal(formStageView(loaded, NOW).art, 'pig-king')
  assert.equal(loaded.skin, 'chef')
  loaded.form = null
  assert.equal(formStageView(loaded, NOW).art, 'career-chef')
  const old = hatchEgg(NOW)
  delete old.dex
  const recovered = migrate(old, NOW)
  assert.equal(recovered.version, version)
  assert.equal(selectSkin(recovered, 'chef', NOW).reason, 'locked')
  const malformed = hatchEgg(NOW)
  malformed.skin = 'unknown'
  malformed.customSkins = {}
  assert.equal(migrate(malformed, NOW).skin, 'default')
})

test('developer skin entries can preview a locked career without completing a shift', () => {
  const state = hatchEgg(NOW)
  applyDevPatch(state, { skin: 'astronaut' }, NOW)
  assert.equal(state.skin, 'astronaut')
  assert.equal(state.dex.skins.astronaut.count, 1)
})

test('developer career button unlocks and selects its art in one patch', () => {
  const { document } = fakeDom()
  globalThis.document = document
  const content = document.createElement('div')
  const sent = []
  const state = hatchEgg(NOW)
  renderDevTab({ content, view: {
    ...SNAPSHOT, pig: PIG, skins: skinView(state),
  }, send(action, payload) { sent.push({ action, payload }) }, devOff() {} })
  findByAttr(content, 'data-dev', 'skin:chef').fire('click')
  assert.deepEqual(sent.at(-1), { action: 'dev', payload: { patch: { skin: 'chef' } } })
})
