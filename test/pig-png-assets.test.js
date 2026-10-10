import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { PIG_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'

test('every built-in pig PNG has current provenance, bounded dimensions and real alpha', () => {
  const entries = JSON.parse(readFileSync(new URL('../assets/pigs/manifest.json', import.meta.url), 'utf8'))
  assert.equal(new Set(entries.map(e => e.key)).size, Object.keys(PIG_ART_ASSETS).length)
  let total = 0
  for (const entry of entries) {
    assert.equal(PIG_ART_ASSETS[entry.key], entry.path)
    const png = readFileSync(new URL('../assets/' + entry.path, import.meta.url))
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', entry.path)
    assert.ok(png.readUInt32BE(16) <= 256 && png.readUInt32BE(20) <= 256, entry.path)
    assert.ok(png[25] === 6 || (png[25] === 3 && png.includes(Buffer.from('tRNS'))), entry.path)
    assert.equal(createHash('sha256').update(png).digest('hex'), entry.sha256, entry.path + ': stale export metadata')
    assert.ok(entry.bounds[0] > 0 && entry.bounds[1] > 0 && entry.bounds[2] < 256 && entry.bounds[3] < 256, entry.path)
    total += png.length
  }
  assert.ok(total < 3_000_000, `pig artwork is ${total} bytes`)
})
