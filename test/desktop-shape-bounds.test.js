import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMeasure } from '../src/client/desktop/measure.js'

test('large saved size can request its new window even while the initial layout is outside the old window', () => {
  const previousDocument = globalThis.document, previousStyle = globalThis.getComputedStyle
  const body = {}
  globalThis.document = { body }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: 'none' })
  const host = { offsetLeft: -300, offsetTop: -400, offsetWidth: 0, offsetHeight: 0, offsetParent: body,
    getAttribute: () => null, closest: () => null }
  const pig = { offsetLeft: 0, offsetTop: 0, offsetWidth: 240, offsetHeight: 240, offsetParent: host,
    getAttribute: () => null, matches: () => false,
    closest: selector => selector === '.dp-pig' ? pig : null }
  host.querySelector = selector => selector === '.dp-pig' ? pig : null
  host.querySelectorAll = () => [pig]
  try {
    const next = createMeasure({ platform: 'linux', geometry: () => ({
      window: { x: 364, y: 146, width: 364, height: 332 }, workArea: { x: 0, y: 32, width: 1280, height: 748 },
    }) }).boxes(host)
    assert.ok(next.content.width > 364, 'the new size must reach the native window')
    assert.ok(next.shape.every(rect => rect.width > 0 && rect.height > 0),
      'offscreen rectangles must not create negative dimensions that reject the entire placement request')
  } finally {
    globalThis.document = previousDocument
    globalThis.getComputedStyle = previousStyle
  }
})
