// 扩展替换失败要保留原来的文件、模块、资源、存档和钱包（R14 T04-D1）。
// 作者：R14-PI-02 开发执行器；本文件只提交设计，未在开发阶段执行（测试归独立验收）。
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../../../core.js'
import { createStore } from '../../../store.js'
import { createJournal } from '../../../store/journal.js'
import { makeBundle } from '../../../store/ext-import.js'
import { createExtRuntime } from '../../../store/ext-runtime.js'

const KEY = 'rollback'
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex')

/** 一个能正常加载、带图片和扩展币的最小扩展。 */
function working(version = '1.0.0') {
  return {
    'manifest.json': JSON.stringify({
      key: KEY, label: '回滚测试', emoji: '🧪', version, assets: ['icon.png'],
      economy: { currency: { label: '测试币', emoji: '🪙', rate: 2 } },
    }),
    'server.js': `export default {
      init() { return { saved: 7 } },
      actions: {
        ping() { return { ok: true, pong: true } },
        double(data) { data.saved *= 2; return { ok: true } },
        which() { return { ok: true, version: '${version}' } },
      },
    }`,
    'client.js': 'window.__rollbackExtension = true',
    'assets/icon.png': PNG,
  }
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-rollback-'))
  writeFileSync(join(dir, 'state.json'), JSON.stringify(hatchEgg(Date.now())))
  const store = createStore(join(dir, 'state.json'), { journal: createJournal() })
  const runtime = createExtRuntime(store, {
    gameVersion: '0.37.2-rc.5',
    fetch: async () => { throw new Error('offline') },
    registryUrl: 'https://example.test/registry.json',
    sleep: async () => {},
  })
  store.ext = runtime
  const done = () => { store.dispose(); rmSync(dir, { recursive: true, force: true }) }
  const extDir = join(dir, 'extensions')
  const leftovers = () => existsSync(extDir) ? readdirSync(extDir).filter(name => name.startsWith('.')) : []
  return { dir, extDir, store, runtime, leftovers, done }
}

const importFiles = (runtime, files) => runtime.importBundle(makeBundle(files), true)
const readInstalled = (extDir, name) => readFileSync(join(extDir, KEY, name), 'utf8')

test('first install whose server.js throws leaves no half-installed extension', async () => {
  const t = setup()
  try {
    const broken = { ...working(), 'server.js': "throw new Error('T04 intentional unloadable replacement')" }
    const result = await importFiles(t.runtime, broken)
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'broken-extension')
    assert.match(result.message, /T04 intentional unloadable replacement/)
    assert.match(result.message, /没有装上新文件/)
    assert.equal(existsSync(join(t.extDir, KEY)), false, 'no extension directory after a failed first install')
    assert.equal(t.store.state.extData[KEY], undefined, 'no extension data after a failed first install')
    assert.deepEqual(t.runtime.list(t.store.state), [], 'no loaded entry after a failed first install')
    assert.deepEqual(t.leftovers(), [], 'staging is cleaned up')
    assert.equal(t.runtime.act(KEY, 'ping', {}).ok, false)
  } finally { t.done() }
})

test('first install whose init throws also leaves nothing behind', async () => {
  const t = setup()
  try {
    const broken = { ...working(), 'server.js': "export default { init() { throw new Error('init boom') } }" }
    const result = await importFiles(t.runtime, broken)
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'broken-extension')
    assert.match(result.message, /init boom/)
    assert.equal(existsSync(join(t.extDir, KEY)), false)
    assert.equal(t.store.state.extData[KEY], undefined)
    assert.deepEqual(t.runtime.list(t.store.state), [])
    assert.deepEqual(t.leftovers(), [])
  } finally { t.done() }
})

test('a failed update keeps the old files, loaded module, assets, data and wallet', async () => {
  const t = setup()
  try {
    assert.equal((await importFiles(t.runtime, working())).ok, true)
    t.store.mutate(state => { state.extData[KEY].saved = 11; state.wallets[KEY].balance = 5; return { ok: true } })
    const serverBefore = readInstalled(t.extDir, 'server.js')
    const localBefore = readFileSync(join(t.extDir, KEY, 'local.json'), 'utf8')
    const broken = {
      ...working('1.1.0'),
      'manifest.json': JSON.stringify({
        key: KEY, label: '回滚测试', emoji: '🧪', version: '1.1.0', assets: ['icon.png'],
        economy: { currency: { label: '新币', emoji: '🪙', rate: 3 } },
      }),
      'server.js': "throw new Error('T04 intentional unloadable replacement')",
    }
    const result = await importFiles(t.runtime, broken)
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'broken-extension')
    assert.match(result.message, /T04 intentional unloadable replacement/)
    assert.match(result.message, /原来的扩展和存档没有改动/)
    assert.equal(readInstalled(t.extDir, 'server.js'), serverBefore, 'old server.js is back byte for byte')
    assert.equal(readFileSync(join(t.extDir, KEY, 'local.json'), 'utf8'), localBefore, 'local marker is preserved')
    const entry = t.runtime.list(t.store.state).find(item => item.key === KEY)
    assert.equal(entry.version, '1.0.0', 'the loaded extension is the old one')
    assert.equal(entry.error, null)
    assert.equal(t.runtime.act(KEY, 'ping', {}).ok, true, 'old module still runs')
    assert.equal(t.runtime.act(KEY, 'which', {}).version, '1.0.0')
    assert.deepEqual(t.runtime.assetFile(KEY, 'icon.png').body, PNG, 'old asset resolution still works')
    assert.equal(t.store.state.extData[KEY].saved, 11, 'extension data is unchanged')
    assert.equal(t.store.state.wallets[KEY].label, '测试币', 'wallet label is unchanged')
    assert.equal(t.store.state.wallets[KEY].rate, 2, 'wallet rate is unchanged')
    assert.equal(t.store.state.wallets[KEY].balance, 5, 'wallet balance is unchanged')
    assert.deepEqual(t.leftovers(), [], 'staging and backup are cleaned up')
  } finally { t.done() }
})

test('an init that throws during update restores the old files and module', async () => {
  const t = setup()
  try {
    assert.equal((await importFiles(t.runtime, working())).ok, true)
    t.store.mutate(state => { state.extData[KEY].saved = 11; state.wallets[KEY].balance = 5; return { ok: true } })
    const serverBefore = readInstalled(t.extDir, 'server.js')
    const broken = {
      ...working('1.1.0'),
      'manifest.json': JSON.stringify({
        key: KEY, label: '回滚测试', emoji: '🧪', version: '1.1.0', assets: ['icon.png'],
        economy: { currency: { label: '新币', emoji: '🪙', rate: 3 } },
      }),
      'server.js': "export default { init() { throw new Error('init boom') } }",
    }
    const result = await importFiles(t.runtime, broken)
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'broken-extension')
    assert.match(result.message, /init boom/)
    assert.match(result.message, /原来的扩展和存档没有改动/)
    assert.equal(readInstalled(t.extDir, 'server.js'), serverBefore)
    const entry = t.runtime.list(t.store.state).find(item => item.key === KEY)
    assert.equal(entry.version, '1.0.0')
    assert.equal(t.runtime.act(KEY, 'ping', {}).ok, true)
    assert.equal(t.store.state.extData[KEY].saved, 11)
    assert.equal(t.store.state.wallets[KEY].label, '测试币', 'the wallet refresh done before init is rolled back')
    assert.equal(t.store.state.wallets[KEY].rate, 2)
    assert.equal(t.store.state.wallets[KEY].balance, 5)
    assert.deepEqual(t.leftovers(), [])
  } finally { t.done() }
})

test('a successful update replaces the files, keeps the data and drops the backup', async () => {
  const t = setup()
  try {
    assert.equal((await importFiles(t.runtime, working())).ok, true)
    t.store.mutate(state => { state.extData[KEY].saved = 11; state.wallets[KEY].balance = 5; return { ok: true } })
    const updated = {
      ...working('1.1.0'),
      'manifest.json': JSON.stringify({
        key: KEY, label: '回滚测试', emoji: '🧪', version: '1.1.0', assets: ['icon.png'],
        economy: { currency: { label: '新币', emoji: '🪙', rate: 3 } },
      }),
    }
    const result = await importFiles(t.runtime, updated)
    assert.equal(result.ok, true)
    assert.equal(JSON.parse(readInstalled(t.extDir, 'manifest.json')).version, '1.1.0')
    assert.equal(t.runtime.list(t.store.state).find(item => item.key === KEY).version, '1.1.0')
    assert.equal(t.store.state.extData[KEY].saved, 11, 'data survives a valid update')
    assert.equal(t.store.state.wallets[KEY].balance, 5)
    assert.equal(t.store.state.wallets[KEY].label, '新币', 'a valid update refreshes the wallet')
    assert.equal(t.store.state.wallets[KEY].rate, 3)
    assert.equal(t.runtime.act(KEY, 'double', {}).ok, true)
    assert.equal(t.store.state.extData[KEY].saved, 22)
    assert.deepEqual(t.leftovers(), [], 'the old bundle is deleted only after success')
  } finally { t.done() }
})

test('concurrent replacements of the same extension end in one consistent filesystem/module state', async () => {
  const t = setup()
  try {
    assert.equal((await importFiles(t.runtime, working())).ok, true)
    const a = { ...working('2.0.0'), 'server.js': "export default { actions: { which() { return { ok: true, version: 'a' } } } }" }
    const b = { ...working('2.0.1'), 'server.js': "export default { actions: { which() { return { ok: true, version: 'b' } } } }" }
    const [first, second] = await Promise.all([importFiles(t.runtime, a), importFiles(t.runtime, b)])
    assert.equal(first.ok, true)
    assert.equal(second.ok, true)
    const diskVersion = JSON.parse(readInstalled(t.extDir, 'manifest.json')).version
    const entry = t.runtime.list(t.store.state).find(item => item.key === KEY)
    assert.equal(entry.version, diskVersion, 'the loaded manifest matches the files on disk')
    const expected = diskVersion === '2.0.0' ? 'a' : 'b'
    assert.equal(t.runtime.act(KEY, 'which', {}).version, expected, 'the loaded module matches the files on disk')
    assert.deepEqual(t.leftovers(), [], 'no staging/backup directories are left behind')
  } finally { t.done() }
})
