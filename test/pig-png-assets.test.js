import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { inflateSync } from 'node:zlib'
import { PIG_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'

/** 与 tools/prepare-pig-art.py、tools/measure-feedback-framing.py 相同的口径。 */
const ALPHA_THRESHOLD = 16

/**
 * 解一张 8 位、非隔行的 PNG（调色板或 RGBA），返回 alpha>threshold 的可见边界。
 * 右/下都是排他的，和 Pillow 的 getbbox() 一致 —— manifest 里的 bounds 就是它。
 */
function alphaBounds(png, threshold = ALPHA_THRESHOLD) {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20)
  assert.equal(png[24], 8, 'expected 8-bit PNG')
  const color = png[25]
  assert.ok(color === 3 || color === 6, 'expected palette or RGBA PNG')
  let pos = 8, palette = null, trns = null
  const idat = []
  while (pos < png.length) {
    const length = png.readUInt32BE(pos)
    const type = png.subarray(pos + 4, pos + 8).toString('latin1')
    const body = png.subarray(pos + 8, pos + 8 + length)
    if (type === 'IHDR') assert.equal(body[12], 0, 'expected non-interlaced PNG')
    else if (type === 'IDAT') idat.push(body)
    else if (type === 'PLTE') palette = body
    else if (type === 'tRNS') trns = body
    pos += 12 + length
  }
  if (color === 3) assert.ok(palette !== null, 'palette PNG without PLTE')
  const channels = color === 3 ? 1 : 4
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const previous = Buffer.alloc(stride)
  const line = Buffer.alloc(stride)
  let left = width, top = height, right = 0, bottom = 0
  let cursor = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor]; cursor += 1
    raw.copy(line, 0, cursor, cursor + stride); cursor += stride
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? line[i - channels] : 0
      const b = previous[i]
      const c = i >= channels ? previous[i - channels] : 0
      if (filter === 1) line[i] = (line[i] + a) & 255
      else if (filter === 2) line[i] = (line[i] + b) & 255
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
      } else assert.equal(filter, 0, 'unknown PNG filter')
    }
    for (let x = 0; x < width; x += 1) {
      const alpha = color === 6 ? line[x * 4 + 3] : (trns === null || line[x] >= trns.length ? 255 : trns[line[x]])
      if (alpha <= threshold) continue
      if (x < left) left = x
      if (y < top) top = y
      if (x + 1 > right) right = x + 1
      if (y + 1 > bottom) bottom = y + 1
    }
    line.copy(previous)
  }
  assert.ok(right > left && bottom > top, 'artwork is empty')
  return [left, top, right, bottom]
}

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
    // bounds 是素材的溯源自述，也是桌面版量可点区域的输入：必须等于 alpha>16 的真实边界。
    assert.deepEqual(alphaBounds(png), entry.bounds, entry.path + ': bounds 与真实透明边界不符')
    total += png.length
  }
  assert.ok(total < 3_000_000, `pig artwork is ${total} bytes`)
})
