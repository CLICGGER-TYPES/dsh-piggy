// 本地导入扩展（用户 2026-10-10：「官方的直接导入，其他的警告后也能导」）。
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../core.js'
import { createStore } from '../store.js'
import { createJournal } from '../store/journal.js'
import { BUNDLE_FILES, LOCAL_MARK, makeBundle, officialList, parseBundle } from '../store/ext-import.js'
import { createExtRuntime } from '../store/ext-runtime.js'

const files = key => Object.fromEntries(BUNDLE_FILES.map(name => [name, readFileSync(new URL(`../extensions/${key}/${name}`, import.meta.url), 'utf8')]))

/** 断网的宿主：在线目录读不到，只能靠游戏自带的官方清单认官方扩展。 */
function setup(gameVersion = '0.35.0') {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-import-'))
  writeFileSync(join(dir, 'state.json'), JSON.stringify(hatchEgg(Date.now())))
  const store = createStore(join(dir, 'state.json'), { journal: createJournal() })
  const fetch = async () => { throw new Error('offline') }
  store.ext = createExtRuntime(store, { gameVersion, fetch, registryUrl: 'https://example.test/registry.json', sleep: async () => {} })
  return { dir, store, done: () => { store.dispose(); rmSync(dir, { recursive: true, force: true }) } }
}

test('官方清单收着扩展目录里每个下载扩展的当前版本（漏了就跑 node scripts/official-extensions.mjs）', () => {
  const official = officialList()
  const registry = JSON.parse(readFileSync(new URL('../extensions/registry.json', import.meta.url), 'utf8'))
  for (const entry of registry.extensions.filter(entry => !entry.builtin)) {
    const listed = official[entry.key]?.[entry.version]
    assert.ok(listed, `${entry.key} ${entry.version} 不在官方清单里`)
    for (const name of BUNDLE_FILES) assert.equal(listed[name], entry.files[name].sha256, `${entry.key} ${entry.version} ${name}`)
  }
})

test('扩展包：三个文件原样打包，读回来校验值不变；乱写的、缺文件的、名字对不上的都拒绝', () => {
  const bundle = parseBundle(makeBundle(files('farm')))
  assert.equal(bundle.ok, true)
  assert.equal(bundle.key, 'farm')
  assert.equal(parseBundle('not json').reason, 'invalid-bundle')
  assert.equal(parseBundle(JSON.stringify({ format: 'dsh-piggy-extension', files: { 'manifest.json': '{"key":"farm"}' } })).message, '扩展包里缺少 server.js')
  const renamed = JSON.parse(makeBundle(files('farm')))
  renamed.key = 'mine'
  assert.match(parseBundle(JSON.stringify(renamed)).message, /对不上/)
  const evil = { ...files('farm'), 'manifest.json': JSON.stringify({ key: '../etc' }) }
  assert.equal(parseBundle(JSON.stringify({ format: 'dsh-piggy-extension', files: evil })).ok, false, 'a key cannot climb out of the extensions folder')
})

test('断网也能导入官方扩展：直接装好，跟在线下载的一样（不标本地导入）', async () => {
  const { dir, store, done } = setup()
  try {
    const result = await store.ext.importBundle(makeBundle(files('farm')), false)
    assert.equal(result.ok, true)
    assert.equal(result.official, true)
    assert.notEqual(store.state.extData.farm, undefined, 'its data is created from init()')
    assert.equal(existsSync(join(dir, 'extensions', 'farm', LOCAL_MARK)), false)
    assert.equal(store.ext.list(store.state).find(entry => entry.key === 'farm').local, false)
    assert.ok(store.state.wallets.farm, 'the wallet opens like an online install')
  } finally { done() }
})

test('不是官方的：先说明、不装；确认后才装，标「本地导入」，在线目录不提示更新', async () => {
  const { dir, store, done } = setup()
  try {
    const changed = { ...files('farm'), 'client.js': files('farm')['client.js'] + '\n// 改过一行\n' }
    const first = await store.ext.importBundle(makeBundle(changed), false)
    assert.deepEqual({ ok: first.ok, reason: first.reason, key: first.key, label: first.label }, { ok: false, reason: 'unofficial', key: 'farm', label: '菜园' })
    assert.equal(existsSync(join(dir, 'extensions', 'farm')), false, 'nothing is written before the player agrees')
    assert.equal(store.state.extData?.farm, undefined)
    const second = await store.ext.importBundle(makeBundle(changed), true)
    assert.equal(second.ok, true)
    assert.equal(second.official, false)
    assert.equal(existsSync(join(dir, 'extensions', 'farm', LOCAL_MARK)), true)
    assert.equal(store.ext.list(store.state).find(entry => entry.key === 'farm').local, true)
  } finally { done() }
})

test('要更新的游戏才能装的扩展包，导入时也照样拒绝', async () => {
  const { store, done } = setup('0.34.0')
  try {
    const result = await store.ext.importBundle(makeBundle(files('farm')), true)
    assert.equal(result.reason, 'game-too-old')
    assert.equal(result.need, '0.35.0')
  } finally { done() }
})
