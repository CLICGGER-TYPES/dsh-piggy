// @ts-check
/** Offline installer selections pass through the real runtime importer and Worker. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'
import { createGameRuntime } from '../../../runtime/index.js'
import { hatchEgg } from '../../../core.js'
import { createInstallerExtensions } from '../lib/optional-extensions.js'
import { startBackgroundHost } from '../lib/background-host.js'
import { buildOptionalExtensions } from '../scripts/pack-optional-extensions.mjs'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const NOW = Date.UTC(2026, 9, 27, 12)
let packed, built
before(() => {
  packed = mkdtempSync(join(tmpdir(), 'piggy-installer-packs-'))
  built = buildOptionalExtensions({ outDir: join(packed, 'packs'), generatedDir: packed })
})
after(() => rmSync(packed, { recursive: true, force: true }))
const sha = value => createHash('sha256').update(value).digest('hex')
const json = file => JSON.parse(readFileSync(file, 'utf8'))
const post = (runtime, action) => runtime.handle('POST', '/dsh-piggy/act', JSON.stringify({ action }))
function setup(t, keys = ['gacha', 'pig-puzzle'], hatched = false) {
  const directory = mkdtempSync(join(tmpdir(), 'piggy-installer-runtime-'))
  const statePath = join(directory, 'state.json'), packs = join(directory, 'installer')
  mkdirSync(packs)
  writeFileSync(join(packs, 'selection.json'), JSON.stringify({ version: 1, keys }))
  writeFileSync(join(packs, 'catalog.json'), JSON.stringify(built.catalog))
  for (const item of built.catalog.items) writeFileSync(join(packs, item.file), readFileSync(join(packed, 'packs', item.file)))
  let fetches = 0
  const fetch = async () => { fetches++; throw new Error('offline test: no network allowed') }
  if (hatched) {
    const state = hatchEgg(NOW)
    state.coins = 721
    state.inventory.apple = 4
    state.extData = { gacha: { marker: 'existing-progress' } }
    writeFileSync(statePath, JSON.stringify(state))
  }
  const runtime = createGameRuntime({ statePath, now: () => NOW, fetch })
  const installer = () => createInstallerExtensions({ directory: packs, statePath, host: runtime })
  t.after(() => { runtime.dispose(); rmSync(directory, { recursive: true, force: true }) })
  return { directory, statePath, packs, runtime, installer, fetches: () => fetches }
}

test('fresh pig defers; hatch installs only selected official bundles without network access', async t => {
  const f = setup(t), installer = f.installer()
  assert.equal((await installer.apply()).deferred, true)
  assert.equal(JSON.parse((await f.runtime.handle('GET', '/dsh-piggy/state')).body).hatched, false)
  assert.equal(existsSync(join(f.directory, 'installer-extensions.json')), false)
  await post(f.runtime, 'hatch')
  const [first, concurrent] = await Promise.all([installer.apply(true), installer.apply(true)])
  assert.equal(first, concurrent, 'simultaneous requests share one import operation')
  assert.equal(first.ok, true, JSON.stringify(first.failures))
  assert.deepEqual(first.installed, ['gacha', 'pig-puzzle'])
  assert.deepEqual(built.catalog.items.filter(item => existsSync(join(f.directory, 'extensions', item.key, 'manifest.json'))).map(item => item.key).sort(), ['gacha', 'pig-puzzle'])
  assert.equal(f.fetches(), 0)
  assert.equal((await installer.apply()).changed, false)
  assert.deepEqual(json(join(f.directory, 'installer-extensions.json')).done, ['gacha', 'pig-puzzle'])
})

test('empty selection neither hatches nor writes a receipt', async t => {
  const f = setup(t, [])
  assert.equal((await f.installer().apply()).changed, false)
  assert.equal(JSON.parse((await f.runtime.handle('GET', '/dsh-piggy/state')).body).hatched, false)
  assert.equal(existsSync(join(f.directory, 'installer-extensions.json')), false)
})

test('existing extension version and progress remain byte-identical', async t => {
  const f = setup(t, ['gacha'], true)
  const installed = join(f.directory, 'extensions', 'gacha')
  mkdirSync(installed, { recursive: true })
  const manifest = join(installed, 'manifest.json')
  writeFileSync(manifest, '{"key":"gacha","version":"0.0.1","custom":"preserve"}')
  const beforeManifest = readFileSync(manifest), beforeState = readFileSync(f.statePath)
  const result = await f.installer().apply()
  assert.deepEqual(result.preserved, ['gacha'])
  assert.equal(result.changed, false)
  assert.deepEqual(readFileSync(manifest), beforeManifest)
  assert.deepEqual(readFileSync(f.statePath), beforeState)
  assert.equal(f.fetches(), 0)
})

test('same installer batch does not restore an extension removed later by its owner', async t => {
  const f = setup(t, ['gacha'])
  await post(f.runtime, 'hatch')
  assert.equal((await f.installer().apply(true)).ok, true)
  rmSync(join(f.directory, 'extensions', 'gacha'), { recursive: true })
  const result = await f.installer().apply(true)
  assert.notEqual(result.deferred, true)
  assert.equal(result.changed, false)
  assert.equal(existsSync(join(f.directory, 'extensions', 'gacha')), false)
})

test('corrupt bundle is not imported; corrupt receipt is preserved and core still works', async t => {
  const f = setup(t, ['gacha'])
  await post(f.runtime, 'hatch')
  const item = built.catalog.items.find(item => item.key === 'gacha')
  writeFileSync(join(f.packs, item.file), 'corrupt')
  const first = await f.installer().apply(true)
  assert.equal(first.ok, false)
  assert.match(first.failures[0].reason, /SHA256/)
  assert.equal(existsSync(join(f.directory, 'extensions', 'gacha')), false)
  const receipt = join(f.directory, 'installer-extensions.json')
  writeFileSync(receipt, 'not json')
  assert.equal((await f.installer().apply(true)).ok, false)
  assert.equal(readFileSync(receipt, 'utf8'), 'not json')
  assert.equal((await f.runtime.handle('GET', '/dsh-piggy/state')).status, 200)
})

test('real background Worker defers selection, installs after hatch, then preserves it on restart', async t => {
  const f = setup(t, ['gacha'])
  f.runtime.dispose()
  let host
  const options = { optionalExtensionsDirectory: f.packs, fetch: async () => { throw new Error('offline Worker') } }
  try {
    host = await startBackgroundHost(ROOT, f.statePath, options)
    assert.equal(existsSync(join(f.directory, 'extensions', 'gacha')), false)
    assert.equal((await post(host, 'hatch')).status, 200)
    const manifest = join(f.directory, 'extensions', 'gacha', 'manifest.json')
    assert.equal(existsSync(manifest), true)
    const before = sha(readFileSync(manifest)), receipt = sha(readFileSync(join(f.directory, 'installer-extensions.json')))
    await host.dispose()
    host = await startBackgroundHost(ROOT, f.statePath, options)
    assert.equal(sha(readFileSync(manifest)), before)
    assert.equal(sha(readFileSync(join(f.directory, 'installer-extensions.json'))), receipt)
    assert.equal((await host.handle('GET', '/dsh-piggy/state')).status, 200)
  } finally { await host?.dispose() }
})

test('bootstrap import does not consume pending reactions before the UI reads them', async t => {
  const f = setup(t, ['gacha'])
  await post(f.runtime, 'hatch')
  f.runtime.dispatchCommand('pig', 'pet')
  assert.equal((await f.installer().apply(true)).ok, true)
  const view = JSON.parse((await f.runtime.handle('GET', '/dsh-piggy/state')).body)
  assert.equal(view.pending.filter(item => item.kind === 'line' && item.scene === 'pet').length, 1)
})
