import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hatchEgg } from '../core.js'
import { createStore } from '../store.js'
import { createExtRuntime } from '../store/ext-runtime.js'
import { makeBundle, officialList, parseBundle } from '../store/ext-import.js'
import { extensionFiles } from '../scripts/extension-files.mjs'
import { farmClassicFiles } from '../scripts/farm-classic-files.mjs'
import farm from '../extensions/farm/server.js'
import { api, renderFarm } from './helpers/farm-ui.js'

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')

/** 把一份扩展文件写成在线目录条目；旧宿主只该读到目录，不该开始下载。 */
function registryEntry(files) {
  const manifest = JSON.parse(files['manifest.json'])
  const listed = Object.fromEntries(Object.entries(files).map(([name, body]) => [name, {
    url: 'https://example.test/farm/' + name, sha256: sha256(body),
  }]))
  return { ...manifest, files: listed }
}

test('classic farm bundles the identical current server and a valid classic client/assets', () => {
  const files = farmClassicFiles()
  assert.equal(files['server.js'], extensionFiles('farm')['server.js'])
  const bundle = parseBundle(makeBundle(files))
  assert.equal(bundle.ok, true)
  assert.equal(bundle.key, 'farm')
  assert.equal(bundle.manifest.version, '3.2.0')
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

test('both farm candidates declare 0.37.2 and are in the official hash list', () => {
  const official = officialList()
  for (const files of [extensionFiles('farm'), farmClassicFiles()]) {
    const manifest = JSON.parse(files['manifest.json'])
    assert.equal(manifest.key, 'farm')
    assert.equal(manifest.minGame, '0.37.2')
    const hashes = Object.fromEntries(Object.entries(files).map(([name, body]) => [name, sha256(body)]))
    assert.deepEqual(official.farm[manifest.version], hashes, manifest.version + ' 的官方文件哈希不是当前候选')
  }
})

test('released hosts below 0.37.2 refuse both v5 farm candidates before saving or replacing files', async () => {
  const candidates = [['modern', extensionFiles('farm')], ['classic', farmClassicFiles()]]
  for (const gameVersion of ['0.37.0', '0.37.1']) {
    for (const [label, files] of candidates) {
      const dir = mkdtempSync(join(tmpdir(), 'piggy-old-host-'))
      const path = join(dir, 'state.json')
      const state = hatchEgg(Date.now())
      state.coins = 777
      state.wallets = { farm: { label: '菜币', emoji: '🥬', rate: 1, balance: 4321 } }
      state.extData = { farm: farm.init() }
      state.extData.farm.unlocked = 12
      state.extData.farm.exp = 1234
      state.extData.farm.onboarding = { step: 'done', rewarded: true, legacy: true, plantedAt: 1, wateredAt: 2 }
      writeFileSync(path, JSON.stringify(state))
      const installed = join(dir, 'extensions', 'farm')
      mkdirSync(installed, { recursive: true })
      writeFileSync(join(installed, 'manifest.json'), JSON.stringify({ key: 'farm', label: '菜园', emoji: '🥬', version: '4.0.10', minGame: '0.37.0' }))
      writeFileSync(join(installed, 'server.js'), 'export default { actions: {} }')
      writeFileSync(join(installed, 'client.js'), '// installed before this import')
      const registryUrl = 'https://example.test/registry.json'
      const requested = []
      const fetch = async url => {
        requested.push(url)
        if (url === registryUrl) return new Response(JSON.stringify({ version: 1, extensions: [registryEntry(files)] }))
        throw new Error('the old host must not download ' + label + ' files')
      }
      const store = createStore(path)
      store.ext = createExtRuntime(store, { gameVersion, fetch, registryUrl, sleep: async () => {} })
      try {
        await store.ext.ready
        const beforeSave = readFileSync(path), beforeManifest = readFileSync(join(installed, 'manifest.json'))
        const local = await store.ext.importBundle(makeBundle(files), true)
        assert.equal(local.ok, false)
        assert.equal(local.reason, 'game-too-old')
        assert.equal(local.need, '0.37.2')
        const online = await store.ext.install('farm')
        assert.equal(online.ok, false)
        assert.equal(online.reason, 'game-too-old')
        assert.equal(online.need, '0.37.2')
        assert.deepEqual(requested, [registryUrl], 'only the catalog is requested; no extension file is downloaded')
        assert.deepEqual(readFileSync(path), beforeSave, 'the save is untouched')
        assert.deepEqual(readFileSync(join(installed, 'manifest.json')), beforeManifest, 'the installed files are untouched')
        assert.equal(store.state.extData.farm.version, 5)
        assert.equal(store.state.wallets.farm.balance, 4321)
      } finally { store.dispose(); rmSync(dir, { recursive: true, force: true }) }
    }
  }
})

test('0.37.2-rc.1 current -> classic -> current preserves farm v5 fields and wallet; unsafe 3.0 is refused before file replacement', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-classic-'))
  const path = join(dir, 'state.json')
  writeFileSync(path, JSON.stringify(hatchEgg(Date.now())))
  const store = createStore(path)
  store.ext = createExtRuntime(store, { gameVersion: '0.37.2-rc.1', fetch: async () => { throw new Error('offline') }, sleep: async () => {} })
  try {
    await store.ext.ready
    assert.equal((await store.ext.importBundle(makeBundle(extensionFiles('farm')), true)).ok, true)
    const data = farm.init()
    data.unlocked = 12; data.exp = 1234; data.seeds.radish = 12; data.harvest.radish = 34
    data.onboarding = { step: 'done', rewarded: true, legacy: true, plantedAt: 111, wateredAt: 222 }
    store.mutate(state => { state.extData.farm = data; state.wallets.farm.balance = 5678; return { ok: true } })
    const progress = structuredClone(store.state.extData.farm), wallet = structuredClone(store.state.wallets.farm)
    for (const files of [farmClassicFiles(), extensionFiles('farm'), farmClassicFiles()]) {
      assert.equal((await store.ext.importBundle(makeBundle(files), true)).ok, true)
      assert.deepEqual(store.state.extData.farm, progress)
      assert.deepEqual(store.state.wallets.farm, wallet)
    }
    assert.equal(store.state.extData.farm.version, 5)
    assert.deepEqual(store.state.extData.farm.onboarding, { step: 'done', rewarded: true, legacy: true, plantedAt: 111, wateredAt: 222 })
    for (const version of ['3.1.0', '4.0.10', '3.0.0']) {
    const unsafe = extensionFiles('farm')
    unsafe['manifest.json'] = JSON.stringify({ ...JSON.parse(unsafe['manifest.json']), version })
    const installed = readFileSync(join(dir, 'extensions/farm/manifest.json'), 'utf8')
    const result = await store.ext.importBundle(makeBundle(unsafe), true)
    assert.equal(result.ok, false)
    assert.match(result.message, /3\.1\.1/)
    assert.equal(readFileSync(join(dir, 'extensions/farm/manifest.json'), 'utf8'), installed)
    assert.deepEqual(store.state.extData.farm, progress)
    assert.deepEqual(store.state.wallets.farm, wallet)
    }
  } finally { store.dispose(); rmSync(dir, { recursive: true, force: true }) }
})
