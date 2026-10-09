import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findByAttr, hostOf, mount, openPanel } from './helpers/bundle.js'
import { PIG_SIZES, displayedPigSize, pigSize, setPigSize } from '../src/client/pig-size.js'
import { LIFE_STAGES } from '../packages/pet-core/src/data/life.js'

test('F12 size tiers multiply every growth stage; standard retains original size', () => {
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value) } }
  assert.equal(pigSize(), 'standard')
  for (const stage of LIFE_STAGES) {
    assert.equal(displayedPigSize(stage.size), stage.size, stage.key)
  }
  const scales = { small: .85, standard: 1, large: 1.3, extra: 1.7 }
  assert.deepEqual(PIG_SIZES, Object.keys(scales))
  for (const [tier, scale] of Object.entries(scales)) {
    setPigSize(tier)
    assert.equal(pigSize(), tier)
    assert.equal(displayedPigSize(68), 68 * scale)
  }
  setPigSize('invalid')
  assert.equal(pigSize(), 'standard')
  assert.equal(storage.get('dsh-piggy:pig-size'), 'standard')
})

test('F12 migrates the four local pixel preferences to tiers', () => {
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value) } }
  for (const [old, tier] of [['48', 'small'], ['56', 'standard'], ['72', 'large'], ['96', 'extra'], ['999', 'standard']]) {
    storage.set('dsh-piggy:pig-size', old)
    assert.equal(pigSize(), tier)
    assert.equal(storage.get('dsh-piggy:pig-size'), tier)
  }
})

test('F12 settings exposes four sizes and saves selection locally', async () => {
  const { dom, store } = await mount({ store: { 'dsh-piggy:pig-size': '72' } })
  openPanel(dom, 'settings')
  const host = hostOf(dom)
  assert.equal(host.style.getPropertyValue('--pig-size'), String(62 * 1.3) + 'px')
  for (const tier of PIG_SIZES) assert.ok(findByAttr(host, 'data-pig-size', tier))
  assert.equal(findByAttr(host, 'data-pig-size', 'large').disabled, true)
  findByAttr(host, 'data-pig-size', 'extra').fire('click')
  assert.equal(store.get('dsh-piggy:pig-size'), 'extra')
  assert.equal(host.style.getPropertyValue('--pig-size'), String(62 * 1.7) + 'px')
  assert.equal(findByAttr(host, 'data-pig-size', 'extra').disabled, true)
  assert.doesNotMatch(host.allText(), /(?:48|56|72|96)px/)
})

test('F12 desktop pet window applies a size changed in the settings window immediately', async () => {
  const { dom, store, windowListeners } = await mount()
  const host = hostOf(dom)
  assert.equal(host.style.getPropertyValue('--pig-size'), '62px')
  store.set('dsh-piggy:pig-size', 'extra')
  for (const listener of windowListeners.storage ?? []) listener({ key: 'dsh-piggy:pig-size' })
  assert.equal(host.style.getPropertyValue('--pig-size'), String(62 * 1.7) + 'px')
})
