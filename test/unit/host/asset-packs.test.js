// @ts-check
/**
 * 动作包：pack.json 是唯一事实来源，生成模块和运行时描述符必须与它一致。
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

/** @param {Record<string, unknown>} pack */
function withFixture(pack, run) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-assets-'))
  try {
    const packDir = join(dir, 'assets/actions/base')
    mkdirSync(packDir, { recursive: true })
    writeFileSync(join(packDir, 'pack.json'), JSON.stringify(pack, null, 2))
    return run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
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

test('重复 key、坏 trigger、帧序列未接入都会失败', () => withFixture({
  pack: 'base',
  revision: 1,
  actions: [
    action('wag', { trigger: { on: 'dance' } }),
    action('wag'),
    action('run', { frames: { fps: 12 } }),
  ],
}, dir => {
  const report = loadActionPacks(dir)
  const text = report.problems.join('\n')
  assert.match(text, /trigger\.on: 只能是/)
  assert.match(text, /actions\[1\].key: 动作 "base\/wag" 重复/)
  assert.match(text, /actions\[2\]\(run\)\.frames/)
}))

test('checkAssets 能发现过期的生成模块', () => withFixture({ pack: 'base', revision: 1, actions: [action('wag')] }, dir => {
  const generated = join(dir, 'packs.generated.js')
  writeFileSync(generated, 'stale')
  const problems = checkAssets(dir, { generatedPath: generated })
  assert.match(problems.join('\n'), /已过期/)
}))
