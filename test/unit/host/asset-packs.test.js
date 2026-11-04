// @ts-check
/**
 * 动作包：pack.json 是唯一事实来源，生成模块和运行时描述符必须与它一致。
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { buildAssetPacks, checkAssets, loadActionPacks } from '../../../scripts/asset-packs.mjs'
import { ACTION_PACKS } from '../../../src/client/packs.generated.js'
import { defaultArtResources } from '../../../src/client/art-path.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))

/** @param {string} key @param {Record<string, unknown>} [overrides] */
function action(key, overrides = {}) {
  return {
    key,
    kind: 'action',
    source: { scheme: 'builtin', key: 'piglet-blink' },
    durationMs: 100,
    eligibility: { art: 'piglet' },
    ...overrides,
  }
}

/** A header-only PNG; validation only needs the signature, IHDR width/height. */
function png(width = 32, height = 32, extra = 0) {
  const body = Buffer.alloc(33 + extra)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(body, 0)
  body.writeUInt32BE(13, 8)
  body.write('IHDR', 12, 'ascii')
  body.writeUInt32BE(width, 16)
  body.writeUInt32BE(height, 20)
  body[24] = 8
  body[25] = 6
  return body
}

/** @param {Record<string, string | Buffer>} files */
function withFiles(pack, files, run) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-assets-'))
  try {
    const packDir = join(dir, 'assets/actions/base')
    mkdirSync(packDir, { recursive: true })
    writeFileSync(join(packDir, 'pack.json'), JSON.stringify(pack, null, 2))
    for (const [name, body] of Object.entries(files)) {
      const path = join(packDir, name)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, body)
    }
    return run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** @param {Record<string, unknown>} pack */
function withFixture(pack, run) {
  return withFiles(pack, {}, run)
}

test('packs.generated.js 与 pack.json 同步', () => {
  const expected = buildAssetPacks(root)
  const actual = readFileSync(new URL('../../../src/client/packs.generated.js', import.meta.url), 'utf8')
  assert.equal(actual, expected, '运行 npm run assets:sync')
})

test('内置动作来自 pack.json，blink/shy-pet 保持原描述符', () => {
  assert.equal(ACTION_PACKS.length, 1)
  assert.equal(ACTION_PACKS[0].pack, 'actions')
  assert.deepEqual(ACTION_PACKS[0].resources.map(resource => resource.key), ['blink', 'shy-pet'])
  const list = defaultArtResources.list({ kind: 'action' })
  assert.deepEqual(list.map(entry => entry.descriptor.key), ['blink', 'shy-pet'])
  const blink = list[0]
  assert.equal(blink.descriptor.duration, 100)
  assert.equal(blink.descriptor.source.scheme, 'builtin')
  assert.match(blink.url, /^\/dsh-piggy\/art\/pigs\/base\/piglet\/blink\.png\?v=/)
  assert.deepEqual(blink.descriptor.eligibility, {
    art: 'piglet',
    stageNot: ['box', 'grave', 'dead-day'],
    absent: ['activity', 'idle', 'illness'],
    moodNot: ['sick', 'dirty', 'sleepy', 'dead', 'hungry', 'lonely'],
    react: [],
    party: false,
  })
  const shy = list[1]
  assert.equal(shy.descriptor.duration, 420)
  assert.deepEqual(shy.descriptor.eligibility?.react, ['', 'pet'])
  assert.equal(shy.descriptor.fallback, null)
})

test('合法 pack 通过校验', () => withFixture({ pack: 'base', revision: 1, actions: [action('wag')] }, dir => {
  const report = loadActionPacks(dir)
  assert.deepEqual(report.problems, [])
  assert.equal(report.packs[0].pack, 'base')
  assert.equal(report.packs[0].resources[0].duration, 100)
  assert.deepEqual(report.triggers, {})
}))

test('缺内置素材、坏时长、未知字段都会被指出', () => withFixture({
  pack: 'base',
  revision: 1,
  actions: [
    action('wag', { source: { scheme: 'builtin', key: 'not-there' }, durationMs: 0, extra: true }),
  ],
}, dir => {
  const report = loadActionPacks(dir)
  const text = report.problems.join('\n')
  assert.match(text, /source\.key: 内置素材表里没有/)
  assert.match(text, /durationMs: 必须是正整数/)
  assert.match(text, /actions\[0\].extra: 不认识的字段/)
}))

test('重复 key、坏 trigger、帧序列缺目录都会失败', () => withFixture({
  pack: 'base',
  revision: 1,
  actions: [
    action('wag', { trigger: { on: 'dance' } }),
    action('wag'),
    { key: 'run', kind: 'action', frames: { fps: 12 }, durationMs: 100 },
  ],
}, dir => {
  const report = loadActionPacks(dir)
  const text = report.problems.join('\n')
  assert.match(text, /trigger\.on: 只能是/)
  assert.match(text, /actions\[1\].key: 动作 "base\/wag" 重复/)
  assert.match(text, /actions\[2\]\(run\)\.frames: 找不到帧目录/)
}))

test('三帧 fps 帧序列通过并生成长度/顺序/内容版本', () => withFiles({
  pack: 'base',
  revision: 1,
  actions: [
    { key: 'wave', kind: 'action', frames: { fps: 12 }, durationMs: 250, eligibility: { art: 'piglet' } },
    { key: 'nod', kind: 'action', frames: { durationsMs: [40, 50, 60] }, durationMs: 150 },
  ],
}, {
  'wave/00.png': png(),
  'wave/01.png': png(40, 40),
  'wave/02.png': png(48, 24),
  'nod/00.png': png(),
  'nod/01.png': png(),
  'nod/02.png': png(),
}, dir => {
  const report = loadActionPacks(dir)
  assert.deepEqual(report.problems, [])
  const [wave, nod] = report.packs[0].resources
  assert.equal(wave.source, undefined, 'frames 动作不生成单图 source')
  assert.deepEqual(wave.frames.map(frame => frame.path), [
    'actions/base/wave/00.png',
    'actions/base/wave/01.png',
    'actions/base/wave/02.png',
  ])
  assert.deepEqual(wave.frames.map(frame => frame.durationMs), [83, 84, 83])
  assert.equal(wave.duration, 250)
  assert.equal(wave.eligibility.art, 'piglet')
  for (const frame of wave.frames) assert.match(frame.revision, /^[0-9a-f]{12}$/)
  assert.deepEqual(nod.frames.map(frame => frame.durationMs), [40, 50, 60])
  assert.equal(nod.duration, 150)
}))

test('缺帧/跳号会被拒绝', () => withFiles({
  pack: 'base',
  revision: 1,
  actions: [{ key: 'wave', kind: 'action', frames: { fps: 12 }, durationMs: 250 }],
}, {
  'wave/00.png': png(),
  'wave/02.png': png(),
}, dir => {
  const text = loadActionPacks(dir).problems.join('\n')
  assert.match(text, /帧序号必须从 00 连续，缺少 01\.png/)
}))

test('总时长与 durationMs 不一致会被拒绝', () => withFiles({
  pack: 'base',
  revision: 1,
  actions: [{ key: 'wave', kind: 'action', frames: { fps: 12 }, durationMs: 200 }],
}, {
  'wave/00.png': png(),
  'wave/01.png': png(),
  'wave/02.png': png(),
}, dir => {
  const text = loadActionPacks(dir).problems.join('\n')
  assert.match(text, /durationMs: 是 200ms，但 3 帧总时长为 250ms/)
}))

test('超大帧、超大文件、坏 magic 都会被拒绝', () => withFiles({
  pack: 'base',
  revision: 1,
  actions: [{ key: 'wave', kind: 'action', frames: { fps: 12 }, durationMs: 333 }],
}, {
  'wave/00.png': png(513, 32),
  'wave/01.png': png(32, 32, 140 * 1024),
  'wave/02.png': Buffer.from('not a png'),
  'wave/03.png': png(),
}, dir => {
  const text = loadActionPacks(dir).problems.join('\n')
  assert.match(text, /frames: 00\.png 是 513×32，长边超过 512/)
  assert.match(text, /frames: 01\.png 有 \d+ B，超过单帧上限 131072 B/)
  assert.match(text, /frames: 02\.png 内容不是有效的 PNG/)
}))

test('source 与 frames 二选一，motion 与 frames 二选一', () => withFiles({
  pack: 'base',
  revision: 1,
  actions: [
    action('both', { frames: { fps: 12 }, durationMs: 250 }),
    { key: 'motion', kind: 'action', frames: { fps: 12 }, durationMs: 250, motion: 'dp-bob' },
  ],
}, {
  'both/00.png': png(),
  'both/01.png': png(),
  'both/02.png': png(),
  'motion/00.png': png(),
  'motion/01.png': png(),
  'motion/02.png': png(),
}, dir => {
  const text = loadActionPacks(dir).problems.join('\n')
  assert.match(text, /\(both\): source 与 frames 只能二选一/)
  assert.match(text, /\(motion\): motion 与 frames 只能二选一/)
}))

test('checkAssets 能发现过期的生成模块', () => withFixture({ pack: 'base', revision: 1, actions: [action('wag')] }, dir => {
  const generated = join(dir, 'packs.generated.js')
  writeFileSync(generated, 'stale')
  const problems = checkAssets(dir, { generatedPath: generated })
  assert.match(problems.join('\n'), /已过期/)
}))
