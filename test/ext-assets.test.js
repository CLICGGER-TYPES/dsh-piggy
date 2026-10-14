// 扩展自带图片（用户 2026-10-11：扩展界面换成画好的素材，扩展格式要能带图片文件夹）。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../core.js'
import { createStore } from '../store.js'
import { createJournal } from '../store/journal.js'
import { createExtRuntime } from '../store/ext-runtime.js'
import { assetNames, describeAssetList, describeAssetsTooBig, describeFileTooBig, describeTooManyAssets, inBatches } from '../store/ext-files.js'
import { isOfficial, makeBundle, parseBundle } from '../store/ext-import.js'

const sha = body => createHash('sha256').update(Buffer.from(body)).digest('hex')
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const WEBP = Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'binary')

function pkg(assets = ['bg.webp', 'carrot.png']) {
  return {
    'manifest.json': JSON.stringify({ key: 'garden', label: '小园子', version: '1.0.0', assets }),
    'server.js': 'export default { init() { return { n: 0 } }, view(data) { return data } }',
    'client.js': 'window.dshPiggyExtensions && window.dshPiggyExtensions.register("garden", { render: function () {} })',
    'assets/bg.webp': WEBP,
    'assets/carrot.png': PNG,
  }
}

/** 断网宿主 + 一个只认 example.test 的假目录；`registryFiles` 改目录里那条的文件清单。 */
function setup(files = pkg(), registryFiles = names => names, bundleBody = null) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-assets-'))
  writeFileSync(join(dir, 'state.json'), JSON.stringify(hatchEgg(Date.now())))
  const store = createStore(join(dir, 'state.json'), { journal: createJournal() })
  const listed = registryFiles(Object.keys(files))
  const entry = { key: 'garden', label: '小园子', version: '1.0.0', files: Object.fromEntries(listed.map(name => [name, { url: 'https://example.test/' + name.replace(/^assets\//, ''), sha256: sha(files[name] ?? '') }])) }
  const fetched = []
  if (bundleBody !== null) entry.bundle = { url: 'https://example.test/ext-garden-1.0.0.piggyext', sha256: sha(bundleBody) }
  const fetch = async url => {
    fetched.push(url)
    if (url === entry.bundle?.url) return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(Buffer.from(bundleBody)).buffer }
    if (url === 'https://example.test/registry.json') return { ok: true, status: 200, json: async () => ({ version: 1, extensions: [entry] }) }
    const name = url.replace('https://example.test/', '')
    const body = files[name] ?? files['assets/' + name]
    if (body === undefined) return { ok: false, status: 404 }
    return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(Buffer.from(body)).buffer }
  }
  store.ext = createExtRuntime(store, { gameVersion: '0.36.0', fetch, registryUrl: 'https://example.test/registry.json', sleep: async () => {} })
  return { dir, store, fetched, runtime: store.ext, done: () => { store.dispose(); rmSync(dir, { recursive: true, force: true }) } }
}

test('图片名单：只认小写名字加 webp/png，不许重复、不许带路径', () => {
  assert.deepEqual(assetNames({}), [])
  assert.deepEqual(assetNames({ assets: ['bg.webp', 'a-1.png'] }), ['bg.webp', 'a-1.png'])
  for (const bad of [['../x.png'], ['A.png'], ['x.gif'], ['x.png', 'x.png'], 'x.png', ['sub/x.png']]) assert.equal(assetNames({ assets: bad }), null, JSON.stringify(bad))
})

test('素材超限的报错说清真因和超了多少：张数 / 合计字节 / 单张', () => {
  const count = n => Array.from({ length: n }, (_, index) => 'img-' + index + '.webp')
  // 名单本身：张数超、名字不对、重复各说各的；没问题的名单不报。
  assert.equal(describeAssetList({}), '')
  assert.equal(describeAssetList({ assets: count(256) }), '')
  assert.equal(describeAssetList({ assets: count(257) }), '图片太多：257 张，最多 256 张，多了 1 张')
  assert.equal(describeAssetList({ assets: ['a.webp', 'a.webp'] }), '图片清单里有重复的名字')
  assert.match(describeAssetList({ assets: ['../x.png'] }), /^第 1 张图片名不对：\.\.\/x\.png/)
  // 上限和超出量都写出来，不用自己去算字节数。
  assert.equal(describeTooManyAssets(300), '图片太多：300 张，最多 256 张，多了 44 张')
  assert.equal(describeAssetsTooBig(4.5 * 1024 * 1024), '图片合计太大：4.5MB，最多 4.0MB，多了 512.0KB')
  assert.equal(describeFileTooBig('bg.webp', 600 * 1024), 'bg.webp 太大：600.0KB，上限 512.0KB，多了 88.0KB')
})

test('张数超 / 合计字节超：扩展包和在线目录都报出真因，不再只说「太大」', async () => {
  const many = Array.from({ length: 257 }, (_, index) => 'img-' + index + '.webp')
  const tooMany = { ...pkg(), 'manifest.json': JSON.stringify({ key: 'garden', label: '小园子', version: '1.0.0', assets: many }) }
  const why = /图片清单不对（图片太多：257 张，最多 256 张，多了 1 张）/
  assert.match(parseBundle(makeBundle(tooMany)).message, why)
  const packaged = setup(pkg(), names => names, makeBundle(tooMany))
  try { assert.match((await packaged.runtime.install('garden')).message, why) } finally { packaged.done() }
  const legacy = setup(tooMany)
  try { assert.match((await legacy.runtime.install('garden')).message, /manifest 图片清单不对（图片太多：257 张/) } finally { legacy.done() }

  // 合计字节：9 张 500KB = 4,500KB ≈ 4.4MB（单张都合规，超的是合计）。
  const names = Array.from({ length: 9 }, (_, index) => 'big-' + index + '.webp')
  const heavy = { ...pkg(), 'manifest.json': JSON.stringify({ key: 'garden', version: '1.0.0', assets: names }) }
  delete heavy['assets/bg.webp']; delete heavy['assets/carrot.png']
  for (const name of names) heavy['assets/' + name] = Buffer.alloc(500 * 1024)
  assert.match(parseBundle(makeBundle(heavy)).message, /图片合计太大：4\.4MB，最多 4\.0MB，多了 404\.0KB/)

  // 单张超 512KB：指出是哪个文件、多大、超了多少。
  assert.match(parseBundle(makeBundle({ ...pkg(), 'assets/bg.webp': Buffer.alloc(600 * 1024) })).message,
    /bg\.webp 太大：600\.0KB，上限 512\.0KB，多了 88\.0KB/)
})

test('分批下载：结果按原顺序，同时跑的不超过上限', async () => {
  let running = 0
  let peak = 0
  const jobs = Array.from({ length: 10 }, (_, index) => async () => { running += 1; peak = Math.max(peak, running); await new Promise(resolve => setTimeout(resolve, 2)); running -= 1; return index })
  assert.deepEqual(await inBatches(jobs, 3), [...Array(10).keys()])
  assert.ok(peak <= 3)
})

test('在线安装：图片跟代码一起下载核对，放在 assets/ 里，只给名单里的', async () => {
  const { dir, runtime, done } = setup()
  try {
    const result = await runtime.install('garden')
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.ok(existsSync(join(dir, 'extensions', 'garden', 'assets', 'bg.webp')))
    const carrot = runtime.assetFile('garden', 'carrot.png')
    assert.equal(carrot.type, 'image/png')
    assert.deepEqual(carrot.body, PNG)
    assert.equal(runtime.assetFile('garden', 'bg.webp').type, 'image/webp')
    assert.equal(runtime.assetFile('garden', 'manifest.json'), null)
    assert.equal(runtime.assetFile('garden', '..%2fserver.js'), null)
    assert.equal(runtime.assetFile('garden', 'other.png'), null, 'only files the manifest lists')
    assert.equal(runtime.assetFile('nope', 'bg.webp'), null)
  } finally { done() }
})

test('目录里的图片和 manifest 对不上、或者图片坏了，都不装', async () => {
  const missing = setup(pkg(), names => names.filter(name => name !== 'assets/carrot.png'))
  try {
    const result = await missing.runtime.install('garden')
    assert.equal(result.ok, false)
    assert.match(result.message, /图片清单/)
    assert.equal(existsSync(join(missing.dir, 'extensions', 'garden')), false)
  } finally { missing.done() }
  const corrupt = pkg()
  const broken = setup(corrupt)
  try {
    corrupt['assets/bg.webp'] = Buffer.from('changed after publishing')
    const result = await broken.runtime.install('garden')
    assert.equal(result.ok, false)
    assert.match(result.message, /bg\.webp 校验不对/)
  } finally { broken.done() }
})

test('扩展包带图片：读回来内容不变；图片少了、多了、名单不对都拒绝', () => {
  const bundle = parseBundle(makeBundle(pkg()))
  assert.equal(bundle.ok, true)
  assert.deepEqual(bundle.files.get('assets/carrot.png'), PNG)
  assert.equal(bundle.hashes['assets/bg.webp'], sha(WEBP))
  const parsed = JSON.parse(makeBundle(pkg()))
  delete parsed.assets['carrot.png']
  assert.match(parseBundle(JSON.stringify(parsed)).message, /图片和 manifest 对不上/)
  parsed.assets['carrot.png'] = PNG.toString('base64')
  parsed.assets['extra.png'] = PNG.toString('base64')
  assert.match(parseBundle(JSON.stringify(parsed)).message, /图片和 manifest 对不上/)
  assert.match(parseBundle(makeBundle({ ...pkg(), 'manifest.json': JSON.stringify({ key: 'garden', assets: ['../x.png'] }) })).message, /图片清单不对/)
})

test('认官方要连图片一起对上：换了一张图就不是官方的', () => {
  const files = pkg()
  const official = { garden: { '1.0.0': Object.fromEntries(Object.entries(files).map(([name, body]) => [name, sha(body)])) } }
  const same = parseBundle(makeBundle(files))
  assert.equal(isOfficial(same.hashes, 'garden', official, []), true)
  const swapped = parseBundle(makeBundle({ ...files, 'assets/bg.webp': Buffer.from('another picture') }))
  assert.equal(isOfficial(swapped.hashes, 'garden', official, []), false)
  const codeOnly = { garden: { '1.0.0': { 'manifest.json': sha(files['manifest.json']), 'server.js': sha(files['server.js']), 'client.js': sha(files['client.js']) } } }
  assert.equal(isOfficial(same.hashes, 'garden', codeOnly, []), false, 'images the official list does not know about do not pass')
})

test('本地导入带图片的扩展包：跟在线目录那条对得上就是官方的，直接装，图片也放好', async () => {
  const { dir, runtime, done } = setup()
  try {
    const result = await runtime.importBundle(makeBundle(pkg()), false)
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.equal(result.official, true)
    assert.ok(existsSync(join(dir, 'extensions', 'garden', 'assets', 'carrot.png')))
    assert.deepEqual(runtime.assetFile('garden', 'carrot.png').body, PNG)
  } finally { done() }
})

test('目录带整包（0.36.1 起）：只下一个 .piggyext，拆开放好，不再逐个下图片', async () => {
  const { dir, runtime, fetched, done } = setup(pkg(), names => names, makeBundle(pkg()))
  try {
    const result = await runtime.install('garden')
    assert.equal(result.ok, true, JSON.stringify(result))
    assert.deepEqual(fetched.filter(url => !url.endsWith('registry.json')), ['https://example.test/ext-garden-1.0.0.piggyext'])
    assert.ok(existsSync(join(dir, 'extensions', 'garden', 'server.js')))
    assert.deepEqual(runtime.assetFile('garden', 'carrot.png').body, PNG)
  } finally { done() }
})

test('整包坏了、版本对不上、名字不对，都不装', async () => {
  const cases = [
    [Buffer.from('not a bundle'), /打不开/],
    [makeBundle({ ...pkg(), 'manifest.json': JSON.stringify({ key: 'garden', version: '2.0.0', assets: ['bg.webp', 'carrot.png'] }) }), /版本对不上/],
    [makeBundle({ ...pkg(), 'manifest.json': JSON.stringify({ key: 'other', version: '1.0.0', assets: ['bg.webp', 'carrot.png'] }) }), /版本对不上/],
  ]
  for (const [body, message] of cases) {
    const { dir, runtime, done } = setup(pkg(), names => names, body)
    try {
      const result = await runtime.install('garden')
      assert.equal(result.ok, false)
      assert.match(result.message, message)
      assert.equal(existsSync(join(dir, 'extensions', 'garden')), false)
    } finally { done() }
  }
})
