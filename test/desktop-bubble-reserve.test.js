import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMeasure } from '../src/client/desktop/measure.js'
import { artMarginFor } from '../src/client/art-framing.js'

function fixture(pigSize, mode = 'open', platform = 'win32', speechScale = 1) {
  const previousDocument = globalThis.document
  const previousStyle = globalThis.getComputedStyle
  const body = {}
  globalThis.document = { body }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: 'dp-bob' })

  const node = (className, x, y, width, height, parent) => ({
    className, offsetLeft: x, offsetTop: y, offsetWidth: width, offsetHeight: height, offsetParent: parent,
    matches: selector => selector.split(',').some(item => item.trim().slice(1) === className),
    closest: selector => selector === `.${className}` ? nodeRef : null,
    getAttribute: () => null,
  })
  let nodeRef
  const host = {
    style: { getPropertyValue: () => String(speechScale) },
    offsetLeft: 0, offsetTop: 0, offsetWidth: 0, offsetHeight: 0, offsetParent: body,
    getAttribute: () => null,
    closest: () => null,
  }
  const pig = node('dp-pig', 200, 144, pigSize, pigSize, host)
  nodeRef = pig
  const bubble = {
    offsetLeft: mode === 'open' ? 200 - 192 : 200 + pigSize - 272,
    offsetTop: 144, offsetWidth: mode === 'open' ? 180 : 272, offsetHeight: 40, offsetParent: host,
    matches: () => false,
    closest: selector => selector === '.dp-bubble' ? bubble : null,
    getAttribute: () => null,
  }
  host.querySelector = selector => selector === '.dp-pig' ? pig : selector === '.dp-hunger-bubble' && mode === 'hungry' ? pig : null
  host.querySelectorAll = () => [pig, bubble]
  // Simulate a window at the work-area top edge: the height-limited bubble
  // zone is unavailable, leaving the fixed reserve as the clipping safeguard.
  const measure = createMeasure({ platform, geometry: () => ({
    window: { x: 0, y: 0 }, workArea: { x: 0, y: 160 },
  }) })
  try {
    return measure.boxes(host)
  } finally {
    globalThis.document = previousDocument
    globalThis.getComputedStyle = previousStyle
  }
}

test('fixed pet window reserve contains open left-side and collapsed bubbles for growing pigs', () => {
  for (const pigSize of [58, 100, 150, 200]) {
    const measured = fixture(pigSize)
    const bubbleLeft = 200 - 192
    assert.ok(measured.contentBox.left <= bubbleLeft,
      `pig ${pigSize}px: outline left ${measured.contentBox.left} must cover bubble left ${bubbleLeft}`)
    assert.ok(measured.contentBox.left <= 200 + pigSize - 272,
      `pig ${pigSize}px: outline must keep the collapsed 272px reserve`)
  }
})

test('open and collapsed bubble geometry does not resize the fixed pig window', () => {
  for (const pigSize of [58, 100, 150, 200]) {
    const open = fixture(pigSize, 'open')
    const collapsed = fixture(pigSize, 'collapsed')
    assert.deepEqual(open.content, collapsed.content, `pig ${pigSize}px`)
  }
})

test('the approved lower speech position is reserved even while speech is hidden', () => {
  for (const pigSize of [54, 60, 108, 216]) {
    const hidden = fixture(pigSize, 'collapsed')
    assert.ok(hidden.contentBox.bottom >= 144 + pigSize + 10 + 104,
      `pig ${pigSize}px must have room for a full lower bubble without growing its window on speech`)
    assert.deepEqual(hidden.content, fixture(pigSize, 'open').content)
  }
})

test('independent speech enlargement reserves both positions without changing size when opened', () => {
  for (const scale of [1, 1.5, 2, 3]) {
    const measured = fixture(54, 'collapsed', 'linux', scale)
    assert.ok(measured.contentBox.left <= 200 + 54 - 272 * scale)
    assert.ok(measured.contentBox.bottom >= 144 + 54 + 10 + 104 * scale)
    assert.deepEqual(measured.content, fixture(54, 'open', 'linux', scale).content)
  }
})

test('Darwin keeps its left outline and reserves the reviewed right-side hunger cloud', () => {
  for (const pigSize of [58, 100, 150, 200]) {
    const measured = fixture(pigSize, 'open', 'darwin')
    const artMargin = artMarginFor(pigSize)
    const oldLeft = Math.min(200 + pigSize - 272, 200 - artMargin)
    assert.equal(measured.contentBox.left, oldLeft, `pig ${pigSize}px left edge`)
    assert.equal(measured.contentBox.right, Math.max(200 + pigSize + artMargin, 200 + pigSize + 60), `pig ${pigSize}px right edge`)
  }
})

test('the fixed window contains the right-side hunger cloud with breathing slack even while hidden', () => {
  for (const platform of ['linux', 'win32', 'darwin']) {
    for (const pigSize of [58, 86, 100, 150, 200]) {
      const measured = fixture(pigSize, 'collapsed', platform)
      assert.ok(measured.contentBox.right >= 200 + pigSize + 60, `${platform} ${pigSize}px cloud right`)
      assert.ok(measured.contentBox.top <= 144 - 48, `${platform} ${pigSize}px cloud top`)
      const hungry = fixture(pigSize, 'hungry', platform)
      assert.deepEqual(measured.content, hungry.content, 'hunger visibility must not resize the window')
      assert.ok(hungry.shape.some(rect => rect.x <= 200 + pigSize && rect.x + rect.width >= 200 + pigSize + 60
        && rect.y <= 144 - 48 && rect.y + rect.height >= 144 + 53), 'native shape must not clip the visible cloud')
    }
  }
})
