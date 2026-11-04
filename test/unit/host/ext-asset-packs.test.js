// M3 第一刀：第三方素材包的安装、校验、列举和卸载（设计见 docs/design/asset-packs-m3.md）。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../../../core.js'
import { createStore } from '../../../store.js'
import { makeBundle, parseBundle } from '../../../store/ext-import.js'
import { MAX_FRAME_BYTES, MAX_SOUND_BYTES } from '../../../store/ext-asset-packs.js'
import { createExtRuntime } from '../../../store/ext-runtime.js'
import { makeZip } from '../../../runtime/save-zip.js'

const KEY = 'assetpack'
const PNG = (() => {
  const body = Buffer.alloc(33)
  body.writeUInt32BE(0x89504e47, 0)
  body.writeUInt32BE(0x0d0a1a0a, 4)
  body.writeUInt32BE(13, 8)
  body.write('IHDR', 12, 'ascii')
  body.writeUInt32BE(2, 16)
  body.writeUInt32BE(2, 20)
  body[24] = 8
  body[25] = 6
  return body
})()
const WAV = Buffer.from('RIFF' + '\0'.repeat(4) + 'WAVEfmt ' + '\0'.repeat(20), 'binary')

/** @param {string} [version] @param {{ actionKey?: string, soundFile?: boolean }} [options] */
function packageFiles(version = '1.0.0', options = {}) {
  const actionKey = options.actionKey ?? 'wave'
  const soundFile = options.soundFile !== false
  return {
    'manifest.json': JSON.stringify({
      key: KEY, label: '素材扩展', emoji: '🎨', version,
      assetPacks: { actions: ['wave'], sounds: ['sfx'] },
    }),
    'server.js': 'export default { init() { return { saved: 0 } }, actions: { ping() { return { ok: true } } } }',
    'client.js': 'window.__assetPackExtension = true',
    'actions/wave/pack.json': JSON.stringify({
      pack: 'wave',
      actions: [{ key: actionKey, kind: 'action', frames: { fps: 10 }, durationMs: 200 }],
    }),
    [`actions/wave/${actionKey}/00.png`]: PNG,
    [`actions/wave/${actionKey}/01.png`]: PNG,
    'sounds/sfx/pack.json': JSON.stringify({
      pack: 'sfx',
      sounds: [{ key: 'beep', ...(soundFile ? { file: 'beep.wav', durationMs: 100 } : { synth: { tones: [{ type: 'sine', from: 440, to: 660, ms: 80, gain: 0.3 }] } }) }],
    }),
    ...(soundFile ? { 'sounds/sfx/beep.wav': WAV } : {}),
  }
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-assetpack-'))
  writeFileSync(join(dir, 'state.json'), JSON.stringify(hatchEgg(Date.now())))
  const store = createStore(join(dir, 'state.json'), { journal: undefined })
  const runtime = createExtRuntime(store, {
    gameVersion: '0.37.2',
    fetch: async () => { throw new Error('offline') },
    registryUrl: 'https://example.test/registry.json',
    sleep: async () => {},
  })
  store.ext = runtime
  const extDir = join(dir, 'extensions')
  return {
    dir, extDir, store, runtime,
    importFiles: (/** @type {any} */ files) => runtime.importBundle(makeBundle(files), true),
    importZip: (/** @type {any} */ files) => runtime.importBundle(makeZip(Object.entries(files).map(([name, body]) => [name, Buffer.from(body)])), true),
    done: () => { store.dispose(); rmSync(dir, { recursive: true, force: true }) },
  }
}

/** @param {any} t @param {any} files @param {RegExp} pattern */
async function refused(t, files, pattern) {
  const result = await t.importFiles(files)
  assert.equal(result.ok, false, JSON.stringify(result))
  assert.equal(result.reason, 'invalid-bundle')
  assert.match(result.message, pattern)
  assert.equal(existsSync(join(t.extDir, KEY)), false, '失败不会留下扩展目录')
}

test('带 actions/sounds 的扩展从 JSON 扩展包装好、列出摘要并随卸载清理', async () => {
  const t = setup()
  try {
    const files = packageFiles()
    assert.equal(parseBundle(makeBundle(files)).ok, true)
    const installed = await t.importFiles(files)
    assert.equal(installed.ok, true, JSON.stringify(installed))
    assert.ok(existsSync(join(t.extDir, KEY, 'actions', 'wave', 'wave', '00.png')))
    assert.ok(existsSync(join(t.extDir, KEY, 'sounds', 'sfx', 'beep.wav')))

    const entry = t.runtime.list(t.store.state).find(item => item.key === KEY)
    assert.ok(entry)
    assert.equal(entry.assetPacks.actions.length, 1)
    assert.deepEqual(entry.assetPacks.actions[0], {
      kind: 'actions', pack: 'wave', namespace: 'ext-' + KEY,
      base: `/dsh-piggy/ext/${KEY}/actions/wave/`,
      entries: 1, frames: 2, files: 3, bytes: entry.assetPacks.actions[0].bytes, available: true,
    })
    assert.equal(entry.assetPacks.sounds[0].namespace, 'ext-' + KEY)
    assert.equal(entry.assetPacks.sounds[0].entries, 1)
    assert.equal(entry.assetPacks.sounds[0].files, 2)

    assert.equal(t.runtime.remove(KEY).ok, true)
    assert.equal(existsSync(join(t.extDir, KEY)), false)
    assert.deepEqual(readdirSync(t.extDir).filter(name => name.startsWith('.')), [], '没有临时目录残留')
  } finally { t.done() }
})

test('同一个扩展可以直接从 ZIP 安装，目录条目按普通文件处理', async () => {
  const t = setup()
  try {
    const files = packageFiles()
    // 压缩工具常会带空目录项；安装器忽略目录项，不把它当成文件。
    files['actions/wave/'] = Buffer.alloc(0)
    const installed = await t.importZip(files)
    assert.equal(installed.ok, true, JSON.stringify(installed))
    assert.ok(existsSync(join(t.extDir, KEY, 'actions', 'wave', 'wave', '01.png')))
    const entry = t.runtime.list(t.store.state).find(item => item.key === KEY)
    assert.equal(entry.assetPacks.actions[0].frames, 2)
  } finally { t.done() }
})

test('在线目录的 bundle 是 ZIP 时只下载一个文件，素材包一起装好', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-assetpack-online-'))
  try {
    writeFileSync(join(dir, 'state.json'), JSON.stringify(hatchEgg(Date.now())))
    const store = createStore(join(dir, 'state.json'), { journal: undefined })
    const zip = makeZip(Object.entries(packageFiles()).map(([name, body]) => [name, Buffer.from(body)]))
    const registry = {
      version: 1,
      extensions: [{
        key: KEY, label: '素材扩展', emoji: '🎨', version: '1.0.0',
        bundle: { url: 'https://example.test/ext.piggyext', sha256: createHash('sha256').update(zip).digest('hex') },
      }],
    }
    let downloads = 0
    const runtime = createExtRuntime(store, {
      gameVersion: '0.37.2',
      registryUrl: 'https://example.test/registry.json',
      sleep: async () => {},
      fetch: async url => {
        if (url === 'https://example.test/registry.json') return { ok: true, status: 200, json: async () => registry }
        downloads += 1
        return { ok: true, status: 200, arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) }
      },
    })
    store.ext = runtime
    const result = await runtime.install(KEY)
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(downloads, 1, '整包只请求一次')
    assert.ok(existsSync(join(dir, 'extensions', KEY, 'sounds', 'sfx', 'beep.wav')))
    assert.equal(runtime.list(store.state)[0].assetPacks.actions[0].frames, 2)
    store.dispose()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('未声明的素材包、声明了却没有 pack.json 都拒绝', async () => {
  const extra = setup()
  try {
    const files = { ...packageFiles(), 'actions/other/pack.json': JSON.stringify({ pack: 'other', actions: [{ key: 'x', kind: 'action', frames: { fps: 10 }, durationMs: 200 }] }) }
    await refused(extra, files, /未在 manifest\.assetPacks\.actions 声明/)
  } finally { extra.done() }

  const missing = setup()
  try {
    const files = packageFiles()
    const manifest = JSON.parse(String(files['manifest.json']))
    manifest.assetPacks.actions.push('missing')
    files['manifest.json'] = JSON.stringify(manifest)
    await refused(missing, files, /没有 actions\/missing\/pack\.json/)
  } finally { missing.done() }
})

test('路径逃逸、绝对路径、大小写和脚本/SVG 文件都不进扩展目录', async () => {
  const escape = setup()
  try {
    await refused(escape, { ...packageFiles(), 'actions/wave/../../evil.png': PNG }, /不允许/)
  } finally { escape.done() }

  const dot = setup()
  try {
    await refused(dot, { ...packageFiles(), 'actions/wave/./00.png': PNG }, /不允许/)
  } finally { dot.done() }

  const upper = setup()
  try {
    await refused(upper, { ...packageFiles(), 'actions/wave/wave/00.PNG': PNG }, /不允许/)
  } finally { upper.done() }

  const script = setup()
  try {
    await refused(script, { ...packageFiles(), 'actions/wave/run.js': 'alert(1)' }, /不允许/)
  } finally { script.done() }

  const svg = setup()
  try {
    await refused(svg, { ...packageFiles(), 'actions/wave/wave/00.svg': '<svg/>' }, /不允许/)
  } finally { svg.done() }
})

test('帧必须连续、同格式、PNG/WebP 有效且不超尺寸/字节上限', async () => {
  const missing = setup()
  try {
    const files = packageFiles()
    delete files['actions/wave/wave/01.png']
    files['actions/wave/wave/02.png'] = PNG
    await refused(missing, files, /帧序号必须从 00 连续/)
  } finally { missing.done() }

  const mixed = setup()
  try {
    const files = packageFiles()
    files['actions/wave/wave/01.webp'] = Buffer.from('RIFF0000WEBPVP8 ', 'binary')
    await refused(mixed, files, /扩展名不一致/)
  } finally { mixed.done() }

  const magic = setup()
  try {
    const files = packageFiles()
    files['actions/wave/wave/00.png'] = Buffer.from('not a png')
    await refused(magic, files, /内容不是有效的 PNG/)
  } finally { magic.done() }

  const big = setup()
  try {
    const files = packageFiles()
    files['actions/wave/wave/01.png'] = Buffer.alloc(MAX_FRAME_BYTES + 1, 1)
    await refused(big, files, /超过单帧上限|太大/)
  } finally { big.done() }

  const edge = setup()
  try {
    const files = packageFiles()
    const wide = Buffer.from(PNG)
    wide.writeUInt32BE(513, 16)
    files['actions/wave/wave/01.png'] = wide
    await refused(edge, files, /长边超过 512/)
  } finally { edge.done() }
})

test('音效文件必须是 ogg/wav、与 key 同名且不超 30KB；合成音效不需要文件', async () => {
  const magic = setup()
  try {
    const files = packageFiles()
    files['sounds/sfx/beep.wav'] = Buffer.from('not a wav')
    await refused(magic, files, /内容不是有效的 WAV/)
  } finally { magic.done() }

  const big = setup()
  try {
    const files = packageFiles()
    files['sounds/sfx/beep.wav'] = Buffer.alloc(MAX_SOUND_BYTES + 1, 1)
    await refused(big, files, /超过上限|太大/)
  } finally { big.done() }

  const name = setup()
  try {
    const files = packageFiles()
    files['sounds/sfx/beep.wav'] = WAV
    const manifest = JSON.parse(String(files['sounds/sfx/pack.json']))
    manifest.sounds[0].file = 'other.wav'
    files['sounds/sfx/pack.json'] = JSON.stringify(manifest)
    await refused(name, files, /必须与 key 同名|找不到 other\.wav/)
  } finally { name.done() }

  const synth = setup()
  try {
    const result = await synth.importFiles(packageFiles('1.0.0', { soundFile: false }))
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(synth.runtime.list(synth.store.state)[0].assetPacks.sounds[0].entries, 1)
  } finally { synth.done() }
})

test('重复动作 key、pack.json 冒充命名空间和覆盖第一方都被拒绝', async () => {
  const duplicate = setup()
  try {
    const files = packageFiles()
    const manifest = JSON.parse(String(files['actions/wave/pack.json']))
    manifest.actions.push({ key: 'wave', kind: 'action', frames: { fps: 10 }, durationMs: 200 })
    files['actions/wave/pack.json'] = JSON.stringify(manifest)
    await refused(duplicate, files, /动作 "wave" 在扩展里重复/)
  } finally { duplicate.done() }

  const namespace = setup()
  try {
    const files = packageFiles()
    const manifest = JSON.parse(String(files['actions/wave/pack.json']))
    manifest.namespace = 'dsh-piggy'
    files['actions/wave/pack.json'] = JSON.stringify(manifest)
    await refused(namespace, files, /不认识的字段/)
  } finally { namespace.done() }

  const packId = setup()
  try {
    const files = packageFiles()
    const manifest = JSON.parse(String(files['actions/wave/pack.json']))
    manifest.pack = 'dsh-piggy'
    files['actions/wave/pack.json'] = JSON.stringify(manifest)
    await refused(packId, files, /必须和目录名一致/)
  } finally { packId.done() }
})

test('ZIP 里的路径逃逸和符号链接在拆包前就被拒绝', () => {
  const traversal = makeZip([
    ['../evil.png', Buffer.from('x')],
    ['manifest.json', Buffer.from('{}')],
  ])
  const escaped = parseBundle(traversal)
  assert.equal(escaped.ok, false)
  assert.match(escaped.message, /路径无效/)

  const absolute = parseBundle(makeZip([
    ['/actions/wave/wave/00.png', PNG],
    ['manifest.json', Buffer.from('{}')],
  ]))
  assert.equal(absolute.ok, false)
  assert.match(absolute.message, /路径无效/)

  const zip = makeZip([
    ['manifest.json', Buffer.from(JSON.stringify(packageFiles()['manifest.json']))],
    ['server.js', Buffer.from(packageFiles()['server.js'])],
    ['client.js', Buffer.from(packageFiles()['client.js'])],
    ['actions/wave/pack.json', Buffer.from(packageFiles()['actions/wave/pack.json'])],
    ['actions/wave/wave/00.png', PNG],
    ['actions/wave/wave/01.png', PNG],
    ['sounds/sfx/pack.json', Buffer.from(packageFiles()['sounds/sfx/pack.json'])],
    ['sounds/sfx/beep.wav', WAV],
  ])
  // 把 central directory 的外部属性改成 Unix 符号链接。
  const linked = Buffer.from(zip)
  let cursor = 0
  while ((cursor = linked.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), cursor)) >= 0) {
    const nameLength = linked.readUInt16LE(cursor + 28)
    const name = linked.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    if (name === 'actions/wave/wave/00.png') {
      linked.writeUInt32LE((0o120777 << 16) >>> 0, cursor + 38)
      break
    }
    cursor += 4
  }
  const symlink = parseBundle(linked)
  assert.equal(symlink.ok, false)
  assert.match(symlink.message, /不安全文件/)
})

test('更新扩展时旧素材包整个换掉，存档数据保留', async () => {
  const t = setup()
  try {
    assert.equal((await t.importFiles(packageFiles('1.0.0', { actionKey: 'old' }))).ok, true)
    t.store.mutate(state => { state.extData[KEY].saved = 7; return { ok: true } })
    assert.ok(existsSync(join(t.extDir, KEY, 'actions', 'wave', 'old', '00.png')))

    assert.equal((await t.importFiles(packageFiles('1.1.0', { actionKey: 'new' }))).ok, true)
    assert.equal(existsSync(join(t.extDir, KEY, 'actions', 'wave', 'old', '00.png')), false, '旧动作目录不残留')
    assert.ok(existsSync(join(t.extDir, KEY, 'actions', 'wave', 'new', '00.png')))
    const entry = t.runtime.list(t.store.state).find(item => item.key === KEY)
    assert.equal(entry.version, '1.1.0')
    assert.equal(entry.assetPacks.actions[0].entries, 1)
    assert.equal(entry.assetPacks.actions[0].frames, 2)
    assert.equal(t.store.state.extData[KEY].saved, 7)
  } finally { t.done() }
})

test('更新时代码加载失败会回滚，旧素材包和旧摘要都保留', async () => {
  const t = setup()
  try {
    assert.equal((await t.importFiles(packageFiles('1.0.0', { actionKey: 'old' }))).ok, true)
    t.store.mutate(state => { state.extData[KEY].saved = 7; return { ok: true } })
    const broken = packageFiles('1.1.0', { actionKey: 'new' })
    broken['server.js'] = "throw new Error('new package should roll back')"
    const result = await t.importFiles(broken)
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'broken-extension')
    assert.match(result.message, /new package should roll back/)
    assert.ok(existsSync(join(t.extDir, KEY, 'actions', 'wave', 'old', '00.png')), '旧帧还在')
    assert.equal(existsSync(join(t.extDir, KEY, 'actions', 'wave', 'new')), false, '新帧没留下')
    const entry = t.runtime.list(t.store.state).find(item => item.key === KEY)
    assert.equal(entry.version, '1.0.0')
    assert.equal(entry.assetPacks.actions[0].frames, 2)
    assert.equal(t.store.state.extData[KEY].saved, 7)
    assert.deepEqual(readdirSync(t.extDir).filter(name => name.startsWith('.')), [])
  } finally { t.done() }
})

test('坏素材包的更新在换文件前就失败，旧版本原样保留', async () => {
  const t = setup()
  try {
    assert.equal((await t.importFiles(packageFiles('1.0.0'))).ok, true)
    const before = readFileSync(join(t.extDir, KEY, 'actions', 'wave', 'wave', '00.png'))
    const broken = packageFiles('1.1.0')
    broken['actions/wave/wave/00.png'] = Buffer.from('broken frame')
    const result = await t.importFiles(broken)
    assert.equal(result.ok, false)
    assert.match(result.message, /素材包校验失败|内容不是有效的 PNG/)
    assert.deepEqual(readFileSync(join(t.extDir, KEY, 'actions', 'wave', 'wave', '00.png')), before)
    assert.equal(t.runtime.list(t.store.state).find(item => item.key === KEY).version, '1.0.0')
  } finally { t.done() }
})

test('单图 source 动作可安装，缺文件、坏图和与 frames 冲突都被拒绝', async t => {
  const setupOne = setup()
  try {
    const files = packageFiles()
    delete files['actions/wave/wave/00.png']
    delete files['actions/wave/wave/01.png']
    files['actions/wave/pack.json'] = JSON.stringify({
      pack: 'wave',
      actions: [{ key: 'wave', kind: 'action', source: 'wave.png', durationMs: 200 }],
    })
    files['actions/wave/wave.png'] = PNG
    const result = await setupOne.importFiles(files)
    assert.equal(result.ok, true, JSON.stringify(result))
    const entry = setupOne.runtime.list(setupOne.store.state)[0]
    assert.equal(entry.assetPacks.actions[0].frames, 1)
    assert.equal(entry.assetPacks.actions[0].entries, 1)
  } finally { setupOne.done() }

  for (const [label, mutate] of [
    ['missing', files => { delete files['actions/wave/wave.png'] }],
    ['bad-magic', files => { files['actions/wave/wave.png'] = Buffer.from('not a png') }],
    ['both', files => {
      const manifest = JSON.parse(String(files['actions/wave/pack.json']))
      manifest.actions[0].frames = { fps: 10 }
      files['actions/wave/pack.json'] = JSON.stringify(manifest)
    }],
  ]) {
    const item = setup()
    try {
      const files = packageFiles()
      delete files['actions/wave/wave/00.png']
      delete files['actions/wave/wave/01.png']
      files['actions/wave/pack.json'] = JSON.stringify({
        pack: 'wave',
        actions: [{ key: 'wave', kind: 'action', source: 'wave.png', durationMs: 200 }],
      })
      files['actions/wave/wave.png'] = PNG
      mutate(files)
      const result = await item.importFiles(files)
      assert.equal(result.ok, false, label + ': ' + JSON.stringify(result))
    } finally { item.done() }
  }
})
