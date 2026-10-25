// @ts-check
import test from 'node:test'
import assert from 'node:assert/strict'
import { collectStageShape, pigLayoutBox } from '../stage/overlay-shape.js'
import { bodyVisualBounds } from '../../../src/client/desktop/visual-bounds.js'

// The native Linux shape clips paint as well as input. A settled/landing pose
// must retain the same drawing corridor that split mode uses for its home.
test('stage shape includes the shared body envelope at every supported size and after a slide', () => {
  const originals = ['document', 'getComputedStyle'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  try {
    globalThis.document = { body: {}, querySelectorAll: () => [] }
    globalThis.getComputedStyle = node => node.style
    for (const size of [54, 72, 128, 216]) for (const shift of ['none', '-25px 18px']) {
      const pig = { offsetLeft: 300, offsetTop: 200, offsetWidth: size, offsetHeight: size, offsetParent: null,
        getBoundingClientRect: () => ({left:300,top:200,width:size,height:size}) }
      const host = { style: { translate: shift }, querySelector: selector => selector === '.dp-pig' ? pig : null }
      const expected = bodyVisualBounds(pigLayoutBox(host))
      const report = collectStageShape(host, document, bodyVisualBounds)
      assert.ok(report.shape.some(rect => rect.x <= expected.x && rect.y <= expected.y
        && rect.x + rect.width >= expected.x + expected.width
        && rect.y + rect.height >= expected.y + expected.height), `size ${size}, slide ${shift}`)
    }
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
