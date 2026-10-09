import assert from 'node:assert/strict'
import { test } from 'node:test'
import { syncPigArt } from '../src/client/art.js'

test('an imported skin is framed from its transparent pixels after loading', () => {
  const values = new Map()
  const attrs = { 'data-art': 'custom-example', 'data-stage': 'piglet' }
  const pig = {
    getAttribute: key => attrs[key] ?? null,
    setAttribute: (key, value) => { attrs[key] = value },
  }
  const pixels = new Uint8ClampedArray(128 * 128 * 4)
  for (let y = 32; y < 96; y++) for (let x = 32; x < 96; x++) pixels[(y * 128 + x) * 4 + 3] = 255
  let load
  const image = {
    src: '', complete: false, naturalWidth: 0, hidden: false,
    style: { setProperty: (key, value) => values.set(key, value) },
    getAttribute(key) { return key === 'src' ? this.src : null },
    addEventListener: (key, callback) => { if (key === 'load') load = callback },
  }
  const previousDocument = globalThis.document
  globalThis.document = { createElement: () => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: pixels }),
  }) }) }
  try {
    syncPigArt(pig, image)
    assert.equal(values.get('--art-zoom'), '1')
    image.complete = true
    image.naturalWidth = 64
    load()
    assert.ok(Number(values.get('--art-zoom')) > 1.8)
    assert.equal(values.get('--art-x'), '0%')
    assert.equal(values.get('--art-y'), '0%')
  } finally {
    globalThis.document = previousDocument
  }
})
