// @ts-check
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildArtRevisions } from '../scripts/build-art-revisions.mjs'
import { PIG_ART_REVISIONS } from '../packages/pet-core/src/data/art-revisions.js'
import { PIG_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'
import { artSource } from '../src/client/art-path.js'
import { builtinFrame } from '../src/client/art-framing.js'
import { artFile } from '../store/art-route.js'

test('built-in artwork URL versions match the actual approved PNGs and generated data', () => {
  assert.equal(readFileSync(new URL('../packages/pet-core/src/data/art-revisions.js', import.meta.url), 'utf8'), buildArtRevisions())
  assert.deepEqual(Object.keys(PIG_ART_REVISIONS).sort(), Object.keys(PIG_ART_ASSETS).sort())
  for (const [key, path] of Object.entries(PIG_ART_ASSETS)) {
    const bytes = readFileSync(new URL('../assets/' + path, import.meta.url))
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
