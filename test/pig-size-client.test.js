import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findByAttr, hostOf, mount, openPanel } from './helpers/bundle.js'
import { displayedPigSize, pigSize, setPigSize } from '../src/client/pig-size.js'
import { LIFE_STAGES } from '../packages/pet-core/src/data/life.js'

test('continuous size scales every growth stage and rejects invalid preferences', () => {
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value) } }
  assert.equal(pigSize(), 1)
  for (const stage of LIFE_STAGES) assert.equal(displayedPigSize(stage.size), stage.size)
  for (const scale of [.85, 1.3, 1.7, 3, 6.25]) {
    setPigSize(scale)
    assert.equal(pigSize(), scale)
    assert.equal(displayedPigSize(68), 68 * scale)
  }
  for (const invalid of ['invalid', 0, -1, Infinity]) { setPigSize(invalid); assert.equal(pigSize(), 1) }
})

test('previous pixel and named size settings migrate without changing visible scale', () => {
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value) } }
  for (const [old, scale] of [['48', .85], ['56', 1], ['72', 1.3], ['96', 1.7], ['extra', 1.7], ['999', 1]]) {
    storage.set('dsh-piggy:pig-size', old)
    assert.equal(pigSize(), scale)
    assert.equal(storage.get('dsh-piggy:pig-size'), 'scale:' + scale)
  }
})

test('settings minus/plus and direct entry replace the four sizes and update display immediately', async () => {
  const { dom, store } = await mount({ store: { 'dsh-piggy:pig-size': '72' } })
  openPanel(dom, 'settings')
  const host = hostOf(dom)
  assert.equal(host.style.getPropertyValue('--pig-size'), String(62 * 1.3) + 'px')
  assert.equal(findByAttr(host, 'data-pig-size', 'extra'), undefined)
  findByAttr(host, 'data-pig-size-step', 'plus').fire('click')
  assert.equal(store.get('dsh-piggy:pig-size'), 'scale:1.4')
  findByAttr(host, 'data-pig-size-step', 'minus').fire('click')
  assert.equal(store.get('dsh-piggy:pig-size'), 'scale:1.3')
  const input = findByAttr(host, 'data-pig-scale', 'true')
  input.value = '300'
  input.fire('change')
  assert.equal(store.get('dsh-piggy:pig-size'), 'scale:3')
  assert.equal(host.style.getPropertyValue('--pig-size'), '186px')
  input.value = '0'
  input.fire('change')
  assert.equal(store.get('dsh-piggy:pig-size'), 'scale:3')
})

test('desktop pet window applies a continuous scale changed in the settings window immediately', async () => {
  const { dom, store, windowListeners } = await mount()
  const host = hostOf(dom)
  store.set('dsh-piggy:pig-size', 'scale:3')
  for (const listener of windowListeners.storage ?? []) listener({ key: 'dsh-piggy:pig-size' })
  assert.equal(host.style.getPropertyValue('--pig-size'), '186px')
})
