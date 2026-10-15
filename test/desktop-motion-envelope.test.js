import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { ART_BOUNDS, builtinFrame, FRAME_HEIGHT, MAX_ART_ASPECT } from '../src/client/art-framing.js'
import { framedBox } from '../src/client/desktop/measure.js'
import {
  fixedMotionReserve, jumpEnvelope, PIG_MOTION, PIG_TRANSFORM_ORIGIN, spinEnvelope,
} from '../src/client/desktop/motion-envelope.js'

const cssBase = readFileSync(resolve('src/client/css-base.js'), 'utf8')
const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`)

function transformPoint(point, pivot, angle, scale = 1, translateY = 0) {
  const radians = angle * Math.PI / 180
  const x = (point.x - pivot.x) * scale
  const y = (point.y - pivot.y) * scale
  return {
    x: pivot.x + x * Math.cos(radians) - y * Math.sin(radians),
    y: pivot.y + x * Math.sin(radians) + y * Math.cos(radians) + translateY,
  }
}

function contains(box, point) {
  return point.x >= box.x - 1e-9 && point.x <= box.x + box.width + 1e-9
    && point.y >= box.y - 1e-9 && point.y <= box.y + box.height + 1e-9
}

test('spin envelope contains intermediate angles as well as the CSS keyframes', () => {
  const box = { x: 10, y: 20, width: 70, height: 42 }
  const pivot = { x: 45, y: 55.7 }
  const envelope = spinEnvelope(box, pivot)
  for (const angle of [...Array.from({ length: 52 }, (_, i) => i * 7), 360]) {
    for (const point of [
      { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
      { x: box.x, y: box.y + box.height }, { x: box.x + box.width, y: box.y + box.height },
    ]) assert.equal(contains(envelope, transformPoint(point, pivot, angle, PIG_MOTION.spinScale)), true)
  }
  const radius = Math.hypot(35, 35.7) * 1.2
  near(envelope.x, pivot.x - radius)
  near(envelope.y, pivot.y - radius)
  near(envelope.width, radius * 2)
})

test('jump envelope unions the resting, rising peak, and landing boxes around parent pivot', () => {
  const box = { x: 12, y: 20, width: 56, height: 56 }
  const pivot = { x: 40, y: 67.6 }
  const envelope = jumpEnvelope(box, pivot)
  for (const [scale, rise] of [[1, 0], [PIG_MOTION.jumpPeakScale, -PIG_MOTION.jumpRise], [PIG_MOTION.jumpLandingScale, 0]]) {
    for (const point of [
      { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
      { x: box.x, y: box.y + box.height }, { x: box.x + box.width, y: box.y + box.height },
    ]) assert.equal(contains(envelope, { x: pivot.x + (point.x - pivot.x) * scale, y: pivot.y + (point.y - pivot.y) * scale + rise }), true)
  }
  near(envelope.y, pivot.y + (box.y - pivot.y) * PIG_MOTION.jumpPeakScale - PIG_MOTION.jumpRise)
})

test('fixed reserve centers the maximum reviewed art and uses parent 50/85 pivot', () => {
  const pig = { x: 100, y: 80, width: 56, height: 56 }
  const reserve = fixedMotionReserve(pig)
  const artWidth = MAX_ART_ASPECT * FRAME_HEIGHT * pig.width
  const artHeight = FRAME_HEIGHT * pig.width
  const art = {
    x: pig.x + (pig.width - artWidth) / 2,
    y: pig.y + (pig.height - artHeight) / 2,
    width: artWidth,
    height: artHeight,
  }
  const pivot = { x: pig.x + pig.width * 0.5, y: pig.y + pig.height * 0.85 }
  assert.equal(contains(reserve, { x: art.x, y: art.y }), true)
  assert.equal(contains(reserve, { x: art.x + art.width, y: art.y + art.height }), true)
  assert.equal(contains(reserve, { x: pivot.x, y: pivot.y }), true)
  assert.equal(contains(reserve, { x: pig.x, y: pig.y }), true)
  for (let angle = 0; angle <= 360; angle += 5) {
    for (const x of [art.x, art.x + art.width]) {
      for (const y of [art.y, art.y + art.height]) {
        assert.equal(contains(reserve, transformPoint({ x, y }, pivot, angle, 1.2)), true)
      }
    }
  }
  assert.equal(PIG_TRANSFORM_ORIGIN.x, 0.5)
  assert.equal(PIG_TRANSFORM_ORIGIN.y, 0.85)
})

test('geometry constants stay tied to the actual CSS spin/jump and parent transform origin', () => {
  assert.ok(cssBase.includes("'@keyframes dp-spin{0%{transform:rotate(0)}50%{transform:rotate(180deg) scale(1.2)}100%{transform:rotate(360deg)}}',"))
  assert.ok(cssBase.includes("'@keyframes dp-jump{0%{transform:translateY(0)}30%{transform:translateY(-26px) scale(1.12)}60%{transform:translateY(0) scale(.92)}100%{transform:translateY(0)}}',"))
  assert.match(cssBase, /transform-origin:50% 85%/)
  assert.equal(PIG_MOTION.spinScale, 1.2)
  assert.equal(PIG_MOTION.jumpRise, 26)
  assert.equal(PIG_MOTION.jumpPeakScale, 1.12)
  assert.equal(PIG_MOTION.jumpLandingScale, 0.92)
})

test('fixed window reserve covers every reviewed framed sprite through a full turn', () => {
  let checked = 0
  for (const path of Object.keys(ART_BOUNDS)) {
    const frame = builtinFrame('/dsh-piggy/art/' + path)
    if (frame === null) continue
    for (const size of [54, 81, 204]) {
      for (const mirrored of [false, true]) {
        const pig = { x: 100, y: 160, width: size, height: size }
        const asleep = path.endsWith('/sleep.png')
        const layout = { x: pig.x - (asleep ? size * .1 : 0), y: pig.y, width: size * (asleep ? 1.2 : 1), height: size }
        const values = { '--art-zoom': frame[0], '--art-x': frame[1] + '%', '--art-y': frame[2] + '%' }
        const image = { matches: () => true, getAttribute: () => '/dsh-piggy/art/' + path,
          closest: () => ({ getAttribute: () => mirrored ? 'right' : null }), style: { getPropertyValue: key => values[key] } }
        const art = framedBox(image, layout)
        const left = Math.min(pig.x, art.x), top = Math.min(pig.y, art.y)
        const ink = { x: left, y: top, width: Math.max(pig.x + size, art.x + art.width) - left,
          height: Math.max(pig.y + size, art.y + art.height) - top }
        const sweep = spinEnvelope(ink, { x: pig.x + size * .5, y: pig.y + size * .85 })
        const reserve = fixedMotionReserve(pig)
        // Generated frame factors are rounded; the existing window PAD is 16px.
        assert.ok(sweep.x >= reserve.x - 1 && sweep.y >= reserve.y - 1
          && sweep.x + sweep.width <= reserve.x + reserve.width + 1
          && sweep.y + sweep.height <= reserve.y + reserve.height + 1, `${path} at ${size}px`)
        checked += 1
      }
    }
  }
  assert.ok(checked >= 900)
})
