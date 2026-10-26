import assert from 'node:assert/strict'
import { test } from 'node:test'
import { builtinFrame } from '../src/client/art-framing.js'
import { createMeasure, framedBox } from '../src/client/desktop/measure.js'
import { motionEnvelope, PIG_TRANSFORM_ORIGIN, spinEnvelope } from '../src/client/desktop/motion-envelope.js'

/**
 * Linux desktop pet windows use Electron `setShape(rects)`; the compositor
 * paints nothing outside those rects. `measure.js` only added the swept area of
 * dp-spin / dp-jump / feed / play / squash, so the rest of the real .dp-pig
 * animations (bathe's dp-wobble, look's dp-idle-look, stretch's
 * dp-idle-stretch, ...) could draw outside the native shape at large sizes.
 *
 * These tests measure through the real `boxes()` pipeline with framed artwork,
 * then independently transform an artwork corner using the CSS keyframe.
 */

const PIG_X = 106
const PIG_Y = 150

function fixture({ path, size, animation }, run) {
  const previousDocument = globalThis.document
  const previousStyle = globalThis.getComputedStyle
  const body = {}
  globalThis.document = { body }
  const state = { animation }
  globalThis.getComputedStyle = () => ({
    display: 'block', visibility: 'visible', opacity: '1', animationName: state.animation,
  })
  const node = (x, y, width, height) => ({
    offsetLeft: x, offsetTop: y, offsetWidth: width, offsetHeight: height, offsetParent: body,
    matches: () => false, closest: () => null, getAttribute: () => null,
    style: { getPropertyValue: () => '' },
  })
  const scene = node(100, 150, size + 12, size)
  const pig = node(PIG_X, PIG_Y, size, size)
  pig.closest = selector => selector === '.dp-pig' ? pig : null
  const frame = builtinFrame('/dsh-piggy/art/' + path)
  assert.notEqual(frame, null, path)
  const values = { '--art-zoom': String(frame[0]), '--art-x': frame[1] + '%', '--art-y': frame[2] + '%' }
  const image = node(0, 0, size, size)
  image.offsetParent = pig
  image.matches = selector => selector === '.dp-pig-img,.dp-pig-sleep'
  image.getAttribute = name => name === 'src' ? '/dsh-piggy/art/' + path : null
  image.closest = selector => selector === '.dp-pig' ? pig : null
  image.style = { getPropertyValue: key => values[key] ?? '' }
  const host = node(100, 150, size + 12, size)
  host.querySelectorAll = () => [scene, pig, image]
  host.querySelector = selector => selector === '.dp-pig' ? pig : null
  const measure = createMeasure({ platform: 'linux', geometry: () => null })
  const ink = framedBox(image, { x: PIG_X, y: PIG_Y, width: size, height: size })
  const pivot = {
    x: PIG_X + size * PIG_TRANSFORM_ORIGIN.x,
    y: PIG_Y + size * PIG_TRANSFORM_ORIGIN.y,
  }
  try {
    return run({ state, measure: () => measure.boxes(host), ink, pivot })
  } finally {
    globalThis.document = previousDocument
    globalThis.getComputedStyle = previousStyle
  }
}

/** One CSS transform list: scale, then rotate, then translate (or translate before rotate). */
function keyframePoint(point, pivot, state) {
  const radians = state.rotate * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const sx = (point.x - pivot.x) * state.scaleX
  const sy = (point.y - pivot.y) * state.scaleY
  if (state.translateFirst) {
    const x = sx + state.x
    const y = sy + state.y
    return { x: pivot.x + x * cos - y * sin, y: pivot.y + x * sin + y * cos }
  }
  return {
    x: pivot.x + sx * cos - sy * sin + state.x,
    y: pivot.y + sx * sin + sy * cos + state.y,
  }
}

const contains = (shape, point) => shape.some(rect => point.x >= rect.x && point.x <= rect.x + rect.width
  && point.y >= rect.y && point.y <= rect.y + rect.height)

test('bathe dp-wobble keeps the 14-degree right edge inside the 500% native shape', () => fixture({
  path: 'pigs/base/piglet/bathe.png', size: 340, animation: 'none',
}, ({ state, measure, ink, pivot }) => {
  const resting = measure()
  const corner = keyframePoint({ x: ink.x + ink.width, y: ink.y }, pivot,
    { scaleX: 1, scaleY: 1, rotate: 14, x: 0, y: 0 })
  assert.equal(contains(resting.shape, corner), false, 'static shape must not already cover the wobble pose')
  state.animation = 'dp-wobble'
  const wobbling = measure()
  assert.equal(contains(wobbling.shape, corner), true, 'the bathtub right edge is inside the shape')
  assert.deepEqual(wobbling.content, resting.content, 'shape-only coverage must not resize the window')
  assert.deepEqual(wobbling.pig, resting.pig)
  assert.equal(contains(wobbling.shape, { x: corner.x + 200, y: corner.y }), false, 'not a giant fixed rectangle')
}))

test('idle dp-idle-look keeps the -8-degree left edge inside the 500% native shape', () => fixture({
  path: 'pigs/base/piglet/idle.png', size: 510, animation: 'none',
}, ({ state, measure, ink, pivot }) => {
  const resting = measure()
  const corner = keyframePoint({ x: ink.x, y: ink.y }, pivot,
    { scaleX: 1, scaleY: 1, rotate: -8, x: -3, y: 0, translateFirst: true })
  assert.equal(contains(resting.shape, corner), false)
  state.animation = 'dp-idle-look'
  const looking = measure()
  assert.equal(contains(looking.shape, corner), true)
  assert.deepEqual(looking.content, resting.content)
  assert.equal(contains(looking.shape, { x: corner.x - 200, y: corner.y }), false)
}))

test('idle dp-idle-stretch keeps the 1.16x left edge inside the 500% native shape', () => fixture({
  path: 'pigs/base/piglet/idle.png', size: 510, animation: 'none',
}, ({ state, measure, ink, pivot }) => {
  const resting = measure()
  const corner = keyframePoint({ x: ink.x, y: ink.y }, pivot,
    { scaleX: 1.16, scaleY: .88, rotate: 0, x: 0, y: 0 })
  assert.equal(contains(resting.shape, corner), false)
  state.animation = 'dp-idle-stretch'
  const stretching = measure()
  assert.equal(contains(stretching.shape, corner), true)
  assert.deepEqual(stretching.content, resting.content)
}))

test('dp-wobble envelope is its 14-degree keyframe sweep, not a full-turn reserve', () => fixture({
  path: 'pigs/base/piglet/bathe.png', size: 340, animation: 'dp-wobble',
}, ({ ink, pivot }) => {
  const envelope = motionEnvelope('dp-wobble')
  assert.notEqual(envelope, null)
  const box = envelope(ink, pivot)
  const right = keyframePoint({ x: ink.x + ink.width, y: ink.y }, pivot,
    { scaleX: 1, scaleY: 1, rotate: 14, x: 0, y: 0 })
  assert.ok(Math.abs(box.x + box.width - right.x) < 1e-6, 'right edge is the actual CSS 14-degree pose')
  const spin = spinEnvelope(ink, pivot)
  assert.ok(box.width < spin.width && box.height < spin.height, 'keyframe sweep is tighter than a full turn')
  assert.ok(box.width * box.height < spin.width * spin.height / 2, 'area stays far below a full-turn reserve')
}))
