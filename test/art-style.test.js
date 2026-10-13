import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'
import { PIG_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'
import { hostOf, mount, openPanel } from './helpers/bundle.js'

test('manifest covers every built-in PNG at its canonical path', () => {
  const entries = JSON.parse(readFileSync(new URL('../assets/pigs/manifest.json', import.meta.url)))
  assert.deepEqual(entries.map(e => e.key).sort(), Object.keys(PIG_ART_ASSETS).sort())
  for (const entry of entries) {
    assert.equal(entry.path, PIG_ART_ASSETS[entry.key])
    assert.ok(existsSync(new URL('../assets/' + entry.path, import.meta.url)), entry.key)
  }
})

test('settings has no pig artwork style option', async () => {
  const { dom } = await mount()
  openPanel(dom, 'settings')
  const host = hostOf(dom)
  assert.equal(host.querySelector('[data-art-style]'), null)
  assert.ok(!host.textContent.includes('小猪画风'))
})
