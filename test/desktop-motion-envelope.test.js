import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { ART_BOUNDS, builtinFrame, FRAME_HEIGHT, MAX_ART_ASPECT } from '../src/client/art-framing.js'
import { framedBox } from '../src/client/desktop/measure.js'
import {
  fixedMotionReserve, jumpEnvelope, motionEnvelope, PIG_MOTION, PIG_TRANSFORM_ORIGIN, REACTION_MOTION, spinEnvelope,
} from '../src/client/desktop/motion-envelope.js'

const cssBase = readFileSync(resolve('src/client/css-base.js'), 'utf8')
const cssTabs = readFileSync(resolve('src/client/css-tabs.js'), 'utf8')
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

const WIZARD_IDLE = 'pigs/skins/skin-wizard/idle.png'

/** Alpha-box of a built-in sprite in page coordinates (untransformed). */
function artBox(path, pig) {
  const frame = builtinFrame('/dsh-piggy/art/' + path)
  if (frame === null) return null
  const values = { '--art-zoom': frame[0], '--art-x': frame[1] + '%', '--art-y': frame[2] + '%' }
  const image = { matches: () => true, getAttribute: () => '/dsh-piggy/art/' + path,
    closest: () => null, style: { getPropertyValue: key => values[key] } }
  return framedBox(image, { x: pig.x, y: pig.y, width: pig.width, height: pig.height })
}

/** Same scale → rotate → translate order as the CSS `transform` list. */
function keyframePoint(point, pivot, state) {
  const radians = state.rotate * Math.PI / 180
  const x = (point.x - pivot.x) * state.scaleX
  const y = (point.y - pivot.y) * state.scaleY
  return {
    x: pivot.x + x * Math.cos(radians) - y * Math.sin(radians) + state.x,
    y: pivot.y + x * Math.sin(radians) + y * Math.cos(radians) + state.y,
  }
}

test('care-reaction envelopes cover every keyframe pose around the parent pivot', () => {
  const pig = { x: 100, y: 160, width: 62, height: 62 }
  const ink = artBox(WIZARD_IDLE, pig)
  assert.notEqual(ink, null)
  const pivot = { x: pig.x + pig.width * PIG_TRANSFORM_ORIGIN.x, y: pig.y + pig.height * PIG_TRANSFORM_ORIGIN.y }
  for (const name of ['dp-feed-hop', 'dp-play-hop', 'dp-squash']) {
    const envelope = motionEnvelope(name)(ink, pivot)
    for (const state of REACTION_MOTION[name]) {
      for (const point of [
        { x: ink.x, y: ink.y }, { x: ink.x + ink.width, y: ink.y },
        { x: ink.x, y: ink.y + ink.height }, { x: ink.x + ink.width, y: ink.y + ink.height },
      ]) assert.equal(contains(envelope, keyframePoint(point, pivot, state)), true, name)
    }
    // The lifted wizard hat must be inside the envelope; the art starts 4.4px
    // below the pig box, so the static 6px slack alone cannot cover the hops.
    assert.ok(envelope.y < ink.y - 6, name)
  }
  assert.equal(motionEnvelope('dp-bob'), null)
  assert.equal(motionEnvelope('dp-unknown'), null)
})

test('reaction envelope numbers stay tied to the actual CSS keyframes', () => {
  assert.ok(cssBase.includes("'@keyframes dp-feed-hop{0%,100%{transform:translateY(0) scale(1)}',"))
  assert.ok(cssBase.includes("'14%{transform:translateY(2px) scale(1.07,.91)}38%{transform:translateY(-12px) scale(.96,1.07)}',"))
  assert.ok(cssBase.includes("'58%{transform:translateY(0) scale(1.1,.88)}76%{transform:translateY(-4px) scale(.98,1.03)}}',"))
  assert.ok(cssBase.includes("'@keyframes dp-play-hop{0%,100%{transform:translate(0,0) rotate(0) scale(1)}',"))
  assert.ok(cssBase.includes("'18%{transform:translate(-3px,-5px) rotate(-7deg) scale(1.02)}',"))
  assert.ok(cssBase.includes("'38%{transform:translate(0,0) rotate(3deg) scale(1.08,.92)}',"))
  assert.ok(cssBase.includes("'60%{transform:translate(4px,-9px) rotate(8deg) scale(.97,1.06)}',"))
  assert.ok(cssBase.includes("'80%{transform:translate(0,0) rotate(-2deg) scale(1.05,.96)}}',"))
  assert.ok(cssTabs.includes("'@keyframes dp-squash{0%,100%{transform:translateY(0) scale(1)}',"))
  assert.ok(cssTabs.includes("'16%{transform:translateY(1px) scale(1.04,.95)}38%{transform:translateY(3px) scale(1.14,.82)}',"))
  assert.ok(cssTabs.includes("'67%{transform:translateY(-4px) scale(.95,1.09)}84%{transform:translateY(0) scale(1.04,.97)}}',"))
  assert.deepEqual(REACTION_MOTION['dp-feed-hop'][2], { scaleX: .96, scaleY: 1.07, rotate: 0, x: 0, y: -12 })
  assert.deepEqual(REACTION_MOTION['dp-play-hop'][3], { scaleX: .97, scaleY: 1.06, rotate: 8, x: 4, y: -9 })
  assert.deepEqual(REACTION_MOTION['dp-squash'][3], { scaleX: .95, scaleY: 1.09, rotate: 0, x: 0, y: -4 })
})

test('every reviewed sprite gets the same care-reaction coverage at the common framed top', () => {
  const pig = { x: 100, y: 160, width: 62, height: 62 }
  const pivot = { x: pig.x + pig.width * PIG_TRANSFORM_ORIGIN.x, y: pig.y + pig.height * PIG_TRANSFORM_ORIGIN.y }
  let checked = 0
  for (const path of Object.keys(ART_BOUNDS)) {
    const ink = artBox(path, pig)
    if (ink === null) continue
    // Generated framing gives every reviewed sprite the same visible height and
    // center, so all of them sit 4.84px below the pig box at 62px.
    for (const name of ['dp-feed-hop', 'dp-play-hop', 'dp-squash']) {
      const envelope = motionEnvelope(name)(ink, pivot)
      for (const state of REACTION_MOTION[name]) {
        for (const point of [
          { x: ink.x, y: ink.y }, { x: ink.x + ink.width, y: ink.y },
          { x: ink.x, y: ink.y + ink.height }, { x: ink.x + ink.width, y: ink.y + ink.height },
        ]) assert.equal(contains(envelope, keyframePoint(point, pivot, state)), true, `${path} ${name}`)
      }
      // Without the envelope the native shape only reached 6px above the box,
      // which is inside the framed art: the top of every sprite was cut.
      if (name !== 'dp-squash') assert.ok(envelope.y < Math.min(ink.y, pig.y) - 6, `${path} ${name}`)
    }
    checked += 1
  }
  assert.ok(checked > 100)
})
