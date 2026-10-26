import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMeasure } from '../src/client/desktop/measure.js'

/**
 * Desktop pet windows on Linux are shaped with Electron `setShape(rects)`.
 * Outside those rects the compositor paints nothing, so the shape doubles as
 * the *visible* region. Tall sprites (the wizard hat is 4.4px below the pig
 * box, the closest of all reviewed art) lost their top during dp-feed-hop /
 * dp-play-hop because only dp-spin/dp-jump had their swept envelope added.
 * The `none` animation below is the unanimated baseline: dp-bob itself now has
 * an envelope (see desktop-idle-motion-shape.test.js), so it cannot stand in for it.
 */
function fixture(run) {
  const previousDocument = globalThis.document
  const previousStyle = globalThis.getComputedStyle
  const body = {}
  globalThis.document = { body }
  const state = { animation: 'none', fx: false }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: state.animation })
  const node = (x, y, width, height) => ({
    offsetLeft: x, offsetTop: y, offsetWidth: width, offsetHeight: height, offsetParent: body,
    matches: () => false, closest: () => null, getAttribute: () => null,
  })
  const scene = node(100, 150, 66, 66)
  const pig = node(106, 150, 54, 54)
  pig.getAttribute = () => null
  const host = node(100, 150, 66, 66)
  host.querySelectorAll = () => [scene, pig]
  host.querySelector = selector => selector === '.dp-pig' ? pig : selector === '.dp-fx' && state.fx ? {} : null
  const measure = createMeasure({ platform: 'linux', geometry: () => null })
  try { run(() => measure.boxes(host), state) } finally {
    globalThis.document = previousDocument
    globalThis.getComputedStyle = previousStyle
  }
}

const contains = (shape, x, y) => shape.some(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)

test('feeding keeps the airborne top of a tall hat inside the native shape', () => fixture((measure, state) => {
  const resting = measure()
  // The static shape ends 6px above the pig box (y = 144); the head is at 150.
  assert.equal(contains(resting.shape, 133, 138), false)
  state.animation = 'dp-feed-hop'
  const feeding = measure()
  // 38% keyframe: translateY(-12px) scale(.96, 1.07) around 50%/85%.
  assert.equal(contains(feeding.shape, 133, 138), true)
  assert.deepEqual(feeding.content, resting.content)
  assert.deepEqual(feeding.pig, resting.pig)
  state.animation = 'none'
  assert.equal(contains(measure().shape, 133, 138), false)
}))

test('playing keeps the airborne top of a tall hat inside the native shape', () => fixture((measure, state) => {
  const resting = measure()
  state.animation = 'dp-play-hop'
  const playing = measure()
  // 60% keyframe: translate(4px, -9px) rotate(8deg) scale(.97, 1.06).
  assert.equal(contains(playing.shape, 133, 138), true)
  assert.deepEqual(playing.content, resting.content)
}))

test('squash keeps the lifted top inside the native shape', () => fixture((measure, state) => {
  state.animation = 'dp-squash'
  const squash = measure()
  // 67% keyframe: translateY(-4px) scale(.95, 1.09).
  assert.equal(contains(squash.shape, 133, 140), true)
  state.animation = 'none'
  assert.equal(contains(measure().shape, 133, 140), false)
}))

test('reaction space stays close to the pig and never reaches distant desktop area', () => fixture((measure, state) => {
  state.animation = 'dp-feed-hop'
  const feeding = measure()
  assert.equal(contains(feeding.shape, 0, 0), false)
  assert.equal(contains(feeding.shape, 0, 130), false)
  assert.equal(contains(feeding.shape, 300, 130), false)
  assert.ok(feeding.shape.every(r => r.y >= 120))
}))
