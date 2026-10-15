import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMeasure } from '../src/client/desktop/measure.js'

function fixture(run) {
  const previousDocument = globalThis.document
  const previousStyle = globalThis.getComputedStyle
  const body = {}
  globalThis.document = { body }
  const state = { idle: 'butterfly', fx: true, spin: false }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: state.spin ? 'dp-spin' : state.idle === 'butterfly' ? 'dp-jump' : 'dp-bob' })
  const node = (x, y, width, height) => ({
    offsetLeft: x, offsetTop: y, offsetWidth: width, offsetHeight: height, offsetParent: body,
    matches: () => false, closest: () => null, getAttribute: () => null,
  })
  const scene = node(100, 150, 66, 66)
  const pig = node(106, 150, 54, 54)
  pig.getAttribute = key => key === 'data-idle' ? state.idle : null
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

test('butterfly keeps its airborne hit area when the 1200ms particle expires', () => fixture((measure, state) => {
  const withParticle = measure()
  state.fx = false
  const afterParticle = measure()
  assert.equal(contains(withParticle.shape, 133, 130), true)
  assert.equal(contains(afterParticle.shape, 133, 130), true)
  assert.deepEqual(afterParticle.content, withParticle.content)
}))

test('ending butterfly releases airborne space without moving or resizing the pig frame', () => fixture((measure, state) => {
  state.fx = false
  const jumping = measure()
  state.idle = null
  const idle = measure()
  assert.equal(contains(jumping.shape, 133, 130), true)
  assert.equal(contains(idle.shape, 133, 130), false)
  assert.deepEqual(idle.content, jumping.content)
  assert.deepEqual(idle.pig, jumping.pig)
}))

test('butterfly leaves distant transparent space outside the native shape', () => fixture((measure, state) => {
  state.fx = false
  const jumping = measure()
  assert.equal(contains(jumping.shape, 0, 0), false)
  assert.equal(contains(jumping.shape, 0, 130), false)
  assert.equal(contains(jumping.shape, 300, 130), false)
}))

test('spin covers the lower arc, keeps the window fixed, and releases that space afterwards', () => fixture((measure, state) => {
  state.fx = false
  state.idle = null
  const resting = measure()
  assert.equal(contains(resting.shape, 133, 240), false)
  state.spin = true
  const spinning = measure()
  assert.equal(contains(spinning.shape, 133, 240), true)
  assert.deepEqual(spinning.content, resting.content)
  assert.deepEqual(spinning.pig, resting.pig)
  const bottom = spinning.content.y + spinning.content.height
  assert.ok(spinning.shape.every(r => r.y + r.height <= bottom))
  state.spin = false
  assert.equal(contains(measure().shape, 133, 240), false)
}))
