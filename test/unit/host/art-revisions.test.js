// @ts-check
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildArtRevisions } from '../../../scripts/build-art-revisions.mjs'
import { PIG_ART_REVISIONS } from '../../../packages/pet-core/src/data/art-revisions.js'
import { PIG_ART_ASSETS } from '../../../packages/pet-core/src/data/art-assets.js'
import { artSource } from '../../../src/client/art-path.js'
import { builtinFrame } from '../../../src/client/art-framing.js'
import { artFile } from '../../../store/art-route.js'

test('built-in artwork URL versions match the actual approved PNGs and generated data', () => {
  assert.equal(readFileSync(new URL('../../../packages/pet-core/src/data/art-revisions.js', import.meta.url), 'utf8'), buildArtRevisions())
  assert.deepEqual(Object.keys(PIG_ART_REVISIONS).sort(), Object.keys(PIG_ART_ASSETS).sort())
  for (const [key, path] of Object.entries(PIG_ART_ASSETS)) {
    const bytes = readFileSync(new URL('../../../assets/' + path, import.meta.url))
    assert.equal(PIG_ART_REVISIONS[key], createHash('sha256').update(bytes).digest('hex').slice(0, 12))
    assert.equal(artSource(key), '/dsh-piggy/art/' + path + '?v=' + PIG_ART_REVISIONS[key])
  }
})

test('content-version queries do not change artwork framing or legacy PNG aliases', () => {
  for (const key of ['piglet', 'piglet-blink', 'piglet-shy-pet']) {
    const path = PIG_ART_ASSETS[key]
    assert.deepEqual(builtinFrame(artSource(key)), builtinFrame('/dsh-piggy/art/' + path))
    assert.ok(builtinFrame(artSource(key)))
    assert.deepEqual(artFile({}, key + '.svg').body, artFile({}, path).body)
    assert.equal(artFile({}, key + '.svg').type, 'image/png')
  }
})

test('sound route only accepts sound pack paths', () => {
  assert.equal(artFile({}, 'sounds/sfx/boom.mp3'), null)
  assert.equal(artFile({}, 'sounds/../secret.ogg'), null)
  assert.equal(artFile({}, 'sounds/sfx/missing.ogg'), null)
})

test('action frame route serves generated frame paths and rejects escapes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-frames-'))
  try {
    const frames = join(dir, 'actions/base/wave')
    mkdirSync(frames, { recursive: true })
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    writeFileSync(join(frames, '00.png'), png)
    const file = artFile({}, 'actions/base/wave/00.png', dir)
    assert.deepEqual(file?.body, png)
    assert.equal(file?.type, 'image/png')
    assert.equal(file?.custom, false)
    assert.equal(artFile({}, 'actions/base/wave/01.png', dir), null, '跳号/缺文件不会伪造 200')
    assert.equal(artFile({}, 'actions/base/wave/../secret.png', dir), null)
    assert.equal(artFile({}, 'actions/base/wave/00.svg', dir), null)
    assert.equal(artFile({}, 'actions/base/wave/000.png', dir), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
