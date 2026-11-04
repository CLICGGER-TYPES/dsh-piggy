// @ts-check
/**
 * 音效配方：pack.json 是唯一事实来源，生成模块与播放器看到的必须一致。
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { buildSoundPacks, loadSoundPacks } from '../../../scripts/asset-packs.mjs'
import { RECIPES, SOUND_FILES, SOUND_KEYS } from '../../../src/client/sounds.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))

/** @param {Record<string, unknown>} manifest */
function withFixture(manifest, run) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-sounds-'))
  try {
    const packDir = join(dir, 'assets/sounds/sfx')
    mkdirSync(packDir, { recursive: true })
    writeFileSync(join(packDir, 'pack.json'), JSON.stringify(manifest, null, 2))
    return run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('sounds.generated.js 与 pack.json 同步', () => {
  const expected = buildSoundPacks(root)
  const actual = readFileSync(new URL('../../../src/client/sounds.generated.js', import.meta.url), 'utf8')
  assert.equal(actual, expected, '运行 npm run assets:sync')
})

test('10 个内置配方数值保持不变', () => {
  assert.deepEqual(SOUND_KEYS, ['tap', 'lift', 'toss', 'bounce', 'land-soft', 'land-hard', 'dizzy', 'purr', 'flip', 'catch'])
  assert.deepEqual(RECIPES, {
    tap: { tones: [{ type: 'sine', from: 660, to: 520, ms: 70, gain: 0.35 }] },
    lift: { tones: [{ type: 'triangle', from: 340, to: 760, ms: 110, gain: 0.4 }] },
    toss: { tones: [{ type: 'sine', from: 240, to: 120, ms: 120, gain: 0.2 }], noise: { from: 900, to: 260, ms: 220, gain: 0.28 } },
    bounce: { tones: [{ type: 'sine', from: 190, to: 105, ms: 110, gain: 0.5 }] },
    'land-soft': { tones: [{ type: 'sine', from: 130, to: 82, ms: 130, gain: 0.5 }] },
    'land-hard': { tones: [{ type: 'sine', from: 105, to: 55, ms: 170, gain: 0.65 }, { type: 'triangle', from: 300, to: 180, ms: 120, gain: 0.18 }], noise: { from: 420, to: 120, ms: 120, gain: 0.22 } },
    dizzy: { tones: [{ type: 'sine', from: 720, to: 560, ms: 150, gain: 0.32 }, { type: 'sine', from: 640, to: 480, ms: 180, gain: 0.3, delay: 130 }] },
    purr: { tones: [{ type: 'sawtooth', from: 72, to: 62, ms: 280, gain: 0.28 }] },
    flip: { tones: [], noise: { from: 2400, to: 700, ms: 90, gain: 0.22, type: 'highpass' } },
    catch: { tones: [{ type: 'square', from: 460, to: 380, ms: 70, gain: 0.28 }] },
  })
})

test('合成配方通过校验', () => withFixture({
  pack: 'sfx',
  revision: 1,
  sounds: [{ key: 'wag', synth: { tones: [{ type: 'sine', from: 440, to: 660, ms: 80, gain: 0.3 }] } }],
}, dir => {
  const report = loadSoundPacks(dir)
  assert.deepEqual(report.problems, [])
  assert.deepEqual(report.recipes, { wag: { tones: [{ type: 'sine', from: 440, to: 660, ms: 80, gain: 0.3 }] } })
}))

test('坏参数、重复 key、坏音频文件都会被指出', () => withFixture({
  pack: 'sfx',
  revision: 1,
  sounds: [
    { key: 'wag', synth: { tones: [{ type: 'sine', from: 440, to: 660, ms: 80, gain: 2 }] } },
    { key: 'wag', synth: { tones: [] } },
    { key: 'yip', file: 'yip.ogg', durationMs: 400 },
    { key: 'bark', file: 'bark.ogg', durationMs: 400 },
  ],
}, dir => {
  const report = loadSoundPacks(dir)
  const text = report.problems.join('\n')
  assert.match(text, /tones\[0\]\.gain: 必须在 0–1 之间/)
  assert.match(text, /音效 "wag" 重复/)
  assert.match(text, /file: 找不到 assets\/sounds\/sfx\/yip\.ogg/)
  assert.match(text, /file: 找不到 assets\/sounds\/sfx\/bark\.ogg/)
}))

test('文件音效生成 URL、大小与哈希，synth 与 file 互斥', () => withFixture({
  pack: 'sfx',
  revision: 1,
  sounds: [
    { key: 'wag', file: 'wag.ogg', durationMs: 420, gain: 0.9, debounceMs: 0, fallback: 'synth:tap' },
  ],
}, dir => {
  const packDir = join(dir, 'assets/sounds/sfx')
  writeFileSync(join(packDir, 'wag.ogg'), Buffer.concat([Buffer.from('OggS'), Buffer.alloc(64)]))
  const report = loadSoundPacks(dir)
  assert.deepEqual(report.problems, [])
  assert.equal(report.files.wag.url.startsWith('sounds/sfx/wag.ogg?v='), true)
  assert.equal(report.files.wag.durationMs, 420)
  assert.equal(report.files.wag.gain, 0.9)
  assert.equal(report.files.wag.fallback, 'synth:tap')
  assert.match(report.files.wag.revision, /^[0-9a-f]{12}$/)
}))

test('内置音效仍只有合成配方', () => {
  assert.deepEqual(SOUND_FILES, {})
})
