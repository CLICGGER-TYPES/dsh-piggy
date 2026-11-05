import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureSkins, formStageView, hatchEgg, migrate, registerCustomSkin, selectSkin } from '../../../src/host/core.js'
import { SKINS, xpForLevel } from '../../../src/host/data.js'

const NOW = 1_800_000_000_000

test('C6 adds skin fields without raising the save version', () => {
  const state = hatchEgg(NOW)
  const version = state.version
  delete state.skin
  delete state.customSkins
  const loaded = migrate(state, NOW)
  assert.equal(loaded.version, version)
  assert.equal(loaded.skin, 'default')
  assert.deepEqual(loaded.customSkins, [])
})

test('C6 built-in skins can be selected and missing action art falls back to idle', () => {
  const state = hatchEgg(NOW)
  const skin = SKINS[0]
  assert.equal(selectSkin(state, skin.key, NOW).ok, true)
  const stage = formStageView(state, NOW)
  assert.equal(stage.art, skin.art)
  assert.deepEqual(stage.artScenes, skin.scenes)
  assert.equal(state.dex.skins[skin.key].count, 1)
})

test('C6 promotion forms cover a selected skin without forgetting it', () => {
  const state = hatchEgg(NOW)
  const skin = SKINS[0]
  selectSkin(state, skin.key, NOW)
  state.xp = xpForLevel(40)
  state.form = 'king'
  assert.equal(formStageView(state, NOW).art, 'pig-king')
  assert.equal(state.skin, skin.key)
  state.form = null
  assert.equal(formStageView(state, NOW).art, skin.art)
})

test('C6 a validated custom skin becomes selectable and survives ensure', () => {
  const state = hatchEgg(NOW)
  const metadata = {
    key: 'my-blue-pig', label: '蓝莓猪', author: '玩家', description: '自己画的',
    art: 'custom-my-blue-pig', scenes: ['idle', 'eat', 'bathe', 'play', 'pet'], custom: true, emoji: '🎨',
  }
  assert.equal(registerCustomSkin(state, metadata, NOW).ok, true)
  assert.equal(state.skin, 'my-blue-pig')
  ensureSkins(state)
  assert.deepEqual(state.customSkins, [metadata])
  assert.equal(formStageView(state, NOW).art, 'custom-my-blue-pig')
})
