// @ts-check
/** Parent transform bounds used by the desktop window's stable reserve and animated hit shape. */
import { FRAME_HEIGHT, MAX_ART_ASPECT } from '../art-framing.js'

/** CSS .dp-pig transform-origin; it is not the artwork frame's visual center. */
export const PIG_TRANSFORM_ORIGIN = Object.freeze({ x: 0.5, y: 0.85 })

/** Values taken from dp-spin and dp-jump in css-base.js. */
export const PIG_MOTION = Object.freeze({
  spinScale: 1.2,
  jumpRise: 26,
  jumpPeakScale: 1.12,
  jumpLandingScale: 0.92,
})

/**
 * One keyframe of a `transform` list: scale(sx, sy) rotate(deg) translate(x, y).
 * `translateFirst` marks the rarer CSS order `rotate(...) translateX(...)`, where
 * the translation happens in the rotated frame instead of in page coordinates.
 * @typedef {{scaleX:number, scaleY:number, rotate:number, x:number, y:number, translateFirst?:boolean}} KeyframeState
 */

/**
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {number} rotate
 * @param {number} x
 * @param {number} y
 * @param {boolean} [translateFirst]
 * @returns {KeyframeState}
 */
const keyframe = (scaleX, scaleY, rotate, x, y, translateFirst) => Object.freeze(
  translateFirst ? { scaleX, scaleY, rotate, x, y, translateFirst } : { scaleX, scaleY, rotate, x, y })

/**
 * Every transform animation CSS applies to `.dp-pig` (css-base.js, css-tabs.js).
 * The desktop window's native shape (Linux setShape) clips drawing outside its
 * rects, so every animation that moves the artwork has to contribute its swept
 * area -- not just the care reactions. Generated framing puts every sprite's
 * visible top 4.84px below the box at 62px; at 500% a 14-degree bathe wobble
 * moves the default adult bathtub about 52px beyond the static rects.
 *
 * Values are the actual CSS keyframes, in CSS transform order. Keep them in
 * sync with the stylesheet; desktop-motion-envelope.test.js asserts the source
 * strings and these numbers together.
 */
export const PIG_ANIMATION_MOTION = Object.freeze({
  // Base idle bob and the shared breathing animation.
  'dp-bob': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -2.5, 0, -7),
  ]),
  'dp-breathe': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1.09, 1.09, 0, 0, 1),
  ]),
  // Mood / reaction shakes and the bathe wobble.
  'dp-shake': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -5, -4, 0),
    keyframe(1, 1, 5, 4, 0),
  ]),
  'dp-cough': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -7, -4, 0),
    keyframe(1, 1, 6, 4, 0),
  ]),
  'dp-dizzy': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -6, 0, 0),
    keyframe(1, 1, 5, 0, 0),
    keyframe(1, 1, -4, 0, 0),
    keyframe(1, 1, 3, 0, 0),
    keyframe(1, 1, -2, 0, 0),
  ]),
  'dp-wobble': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -14, 0, 0),
    keyframe(1, 1, 14, 0, 0),
  ]),
  // Idle self-actions from life.js.
  'dp-idle-stretch': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1.16, 0.88, 0, 0, 0),
  ]),
  'dp-idle-look': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -8, -3, 0, true),
  ]),
  'dp-walking': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -4, 0, -6),
    keyframe(1, 1, 4, 0, -6),
  ]),
  'dp-typing': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -1.5, 0, -2),
    keyframe(1, 1, 1.5, 0, -2),
  ]),
  'dp-reading': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -5, 0, 1),
    keyframe(1, 1, -2, 0, 1),
  ]),
  // Crowned forms with their own action sprites.
  'dp-king-work': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, 1, 0, 1),
  ]),
  'dp-king-study': Object.freeze([
    keyframe(1, 1, -2, 0, 0),
    keyframe(1, 1, 2, 0, 0),
  ]),
  'dp-king-walk': Object.freeze([
    keyframe(1, 1, -2, 0, 0),
    keyframe(1, 1, 2, 0, -3),
  ]),
  // Box stage, unhatched glow and poke reaction.
  'dp-box-wobble': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -4, 0, 0),
    keyframe(1, 1, 3, 0, 0),
    keyframe(1, 1, -2, 0, 0),
  ]),
  'dp-box-breathe': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1.06, 1.06, 0, 0, -3),
  ]),
  'dp-poke-shake': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1, 1, -7, 0, 0),
    keyframe(1, 1, 6, 0, 0),
    keyframe(1, 1, -4, 0, 0),
  ]),
  // Care reactions that lift the pig above its layout box.
  'dp-feed-hop': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1.07, 0.91, 0, 0, 2),
    keyframe(0.96, 1.07, 0, 0, -12),
    keyframe(1.1, 0.88, 0, 0, 0),
    keyframe(0.98, 1.03, 0, 0, -4),
  ]),
  'dp-play-hop': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1.02, 1.02, -7, -3, -5),
    keyframe(1.08, 0.92, 3, 0, 0),
    keyframe(0.97, 1.06, 8, 4, -9),
    keyframe(1.05, 0.96, -2, 0, 0),
  ]),
  'dp-squash': Object.freeze([
    keyframe(1, 1, 0, 0, 0),
    keyframe(1.04, 0.95, 0, 0, 1),
    keyframe(1.14, 0.82, 0, 0, 3),
    keyframe(0.95, 1.09, 0, 0, -4),
    keyframe(1.04, 0.97, 0, 0, 0),
  ]),
})

/** Care-reaction subset, kept for callers that reason about reactions specifically. */
export const REACTION_MOTION = Object.freeze({
  'dp-feed-hop': PIG_ANIMATION_MOTION['dp-feed-hop'],
  'dp-play-hop': PIG_ANIMATION_MOTION['dp-play-hop'],
  'dp-squash': PIG_ANIMATION_MOTION['dp-squash'],
})

const corners = box => [
  { x: box.x, y: box.y },
  { x: box.x + box.width, y: box.y },
  { x: box.x, y: box.y + box.height },
  { x: box.x + box.width, y: box.y + box.height },
]

function boundsOf(points) {
  const left = Math.min(...points.map(point => point.x))
  const top = Math.min(...points.map(point => point.y))
  const right = Math.max(...points.map(point => point.x))
  const bottom = Math.max(...points.map(point => point.y))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function scaledCorners(box, pivot, scale, translateY = 0) {
  return corners(box).map(point => ({
    x: pivot.x + (point.x - pivot.x) * scale,
    y: pivot.y + (point.y - pivot.y) * scale + translateY,
  }))
}

function unionBoxes(...boxes) {
  return boundsOf(boxes.flatMap(corners))
}

/**
 * Bounds of a rectangle swept through a full 360-degree rotation, with the
 * largest dp-spin scale. Every point's greatest distance from the pivot is
 * reached at a corner, so this circle encloses all intermediate angles too.
 * @param {{x:number,y:number,width:number,height:number}} box
 * @param {{x:number,y:number}} pivot
 */
export function spinEnvelope(box, pivot) {
  const radius = Math.max(...corners(box).map(point => Math.hypot(point.x - pivot.x, point.y - pivot.y))) * PIG_MOTION.spinScale
  return { x: pivot.x - radius, y: pivot.y - radius, width: radius * 2, height: radius * 2 }
}

/**
 * Bounds of the current dp-jump trajectory: the peak translation/scale, its
 * smaller landing scale, and the original box. The CSS easing has no overshoot.
 * @param {{x:number,y:number,width:number,height:number}} box
 * @param {{x:number,y:number}} pivot
 */
export function jumpEnvelope(box, pivot) {
  return boundsOf([
    ...corners(box),
    ...scaledCorners(box, pivot, PIG_MOTION.jumpPeakScale, -PIG_MOTION.jumpRise),
    ...scaledCorners(box, pivot, PIG_MOTION.jumpLandingScale),
  ])
}

/**
 * Corners after one keyframe's scale → rotate → translate, around the CSS
 * transform-origin pivot (the keyframes are written in that order, unless
 * `translateFirst` marks `rotate(...) translateX(...)`).
 * @param {{x:number,y:number,width:number,height:number}} box
 * @param {{x:number,y:number}} pivot
 * @param {KeyframeState} state
 */
function keyframeCorners(box, pivot, state) {
  const radians = state.rotate * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return corners(box).map(point => {
    const x = (point.x - pivot.x) * state.scaleX
    const y = (point.y - pivot.y) * state.scaleY
    if (state.translateFirst) {
      // `rotate(...) translateX(...)`: translate in the rotated frame, then rotate.
      return {
        x: pivot.x + (x + state.x) * cos - (y + state.y) * sin,
        y: pivot.y + (x + state.x) * sin + (y + state.y) * cos,
      }
    }
    return {
      x: pivot.x + x * cos - y * sin + state.x,
      y: pivot.y + x * sin + y * cos + state.y,
    }
  })
}

/** Union of every keyframe pose of one transform animation. */
export function keyframeEnvelope(states, box, pivot) {
  return boundsOf(states.flatMap(state => keyframeCorners(box, pivot, state)))
}

/** Swung area of a care reaction, so tall sprites stay inside the window shape. */
export function reactionEnvelope(name, box, pivot) {
  const states = Object.hasOwn(REACTION_MOTION, name) ? REACTION_MOTION[name] : undefined
  return states === undefined ? null : keyframeEnvelope(states, box, pivot)
}

/** Envelope lookup for the current CSS animation name; null means the shape is static. */
export function motionEnvelope(name) {
  if (name === 'dp-spin') return spinEnvelope
  if (name === 'dp-jump') return jumpEnvelope
  const states = Object.hasOwn(PIG_ANIMATION_MOTION, name) ? PIG_ANIMATION_MOTION[name] : undefined
  return states === undefined ? null : (box, pivot) => keyframeEnvelope(states, box, pivot)
}

/**
 * Fixed reserve for the widest reviewed centered artwork plus the pig box.
 * The parent pivot remains 50%/85%; artwork framing is centered independently.
 * This result depends only on the pig's layout size, never its current action.
 * @param {{x:number,y:number,width:number,height:number}} pigBox
 */
export function fixedMotionReserve(pigBox) {
  const artWidth = MAX_ART_ASPECT * FRAME_HEIGHT * pigBox.width
  const artHeight = FRAME_HEIGHT * pigBox.width
  const staticBox = unionBoxes(pigBox, {
    x: pigBox.x + (pigBox.width - artWidth) / 2,
    y: pigBox.y + (pigBox.height - artHeight) / 2,
    width: artWidth,
    height: artHeight,
  })
  const pivot = {
    x: pigBox.x + pigBox.width * PIG_TRANSFORM_ORIGIN.x,
    y: pigBox.y + pigBox.height * PIG_TRANSFORM_ORIGIN.y,
  }
  return unionBoxes(staticBox, spinEnvelope(staticBox, pivot), jumpEnvelope(staticBox, pivot))
}
