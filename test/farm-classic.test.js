import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hatchEgg } from '../core.js'
import { createStore } from '../store.js'
import { createExtRuntime } from '../store/ext-runtime.js'
import { makeBundle, parseBundle } from '../store/ext-import.js'
import { extensionFiles } from '../scripts/extension-files.mjs'
import { farmClassicFiles } from '../scripts/farm-classic-files.mjs'
import farm from '../extensions/farm/server.js'
import { api, renderFarm } from './helpers/farm-ui.js'

test('classic farm bundles the identical current server and a valid classic client/assets', () => {
  const files = farmClassicFiles()
  assert.equal(files['server.js'], extensionFiles('farm')['server.js'])
  const bundle = parseBundle(makeBundle(files))
  assert.equal(bundle.ok, true)
  assert.equal(bundle.key, 'farm')
  assert.equal(bundle.manifest.version, '3.1.0')
  const data = farm.init(), clock = api()
  const view = farm.view(data, clock), before = structuredClone(view)
  const ui = renderFarm(view, 'panel', {}, files['client.js'])
  assert.equal(ui.all('data-farm-plot').length, 18)
  assert.deepEqual(view, before, 'classic rendering must not mutate the source snapshot')
  const plot = view.plots[0]
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(ui.sent[0].op, plot.stubble ? 'clear' : 'care')
  assert.equal(ui.sent[0].payload.plot, 0)
})

test('current -> classic -> current preserves farm v4 data and wallet; unsafe 3.0 is refused before file replacement', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-classic-'))
  const path = join(dir, 'state.json')
  writeFileSync(path, JSON.stringify(hatchEgg(Date.now())))
  const store = createStore(path)
  store.ext = createExtRuntime(store, { gameVersion: '0.37.1', fetch: async () => { throw new Error('offline') }, sleep: async () => {} })
  try {
    await store.ext.ready
    assert.equal((await store.ext.importBundle(makeBundle(extensionFiles('farm')), true)).ok, true)
    const data = farm.init()
    data.unlocked = 12; data.exp = 1234; data.seeds.radish = 12; data.harvest.radish = 34
    store.mutate(state => { state.extData.farm = data; state.wallets.farm.balance = 5678; return { ok: true } })
    const progress = structuredClone(store.state.extData.farm), wallet = structuredClone(store.state.wallets.farm)
    for (const files of [farmClassicFiles(), extensionFiles('farm'), farmClassicFiles()]) {
      assert.equal((await store.ext.importBundle(makeBundle(files), true)).ok, true)
      assert.deepEqual(store.state.extData.farm, progress)
      assert.deepEqual(store.state.wallets.farm, wallet)
    }
    const unsafe = extensionFiles('farm')
    unsafe['manifest.json'] = JSON.stringify({ ...JSON.parse(unsafe['manifest.json']), version: '3.0.0' })
    const installed = readFileSync(join(dir, 'extensions/farm/manifest.json'), 'utf8')
    const result = await store.ext.importBundle(makeBundle(unsafe), true)
    assert.equal(result.ok, false)
    assert.match(result.message, /3\.1\.0/)
    assert.equal(readFileSync(join(dir, 'extensions/farm/manifest.json'), 'utf8'), installed)
    assert.deepEqual(store.state.extData.farm, progress)
    assert.deepEqual(store.state.wallets.farm, wallet)
  } finally { store.dispose(); rmSync(dir, { recursive: true, force: true }) }
})
