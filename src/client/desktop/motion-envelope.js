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
