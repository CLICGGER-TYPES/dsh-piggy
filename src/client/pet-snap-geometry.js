// @ts-check
/** Reviewed 9% compression, anchored at the visible feet; no position accumulation. */
export const PET_PRESSURE = Object.freeze([0, .5, 1, -.30, .10])
export const HAND_POSES = Object.freeze([
  { wrist: 300, y: 41, angle: -6, sink: 0 },
  { wrist: 293.5, y: 49, angle: 0, sink: 1.2 },
  { wrist: 301.5, y: 51, angle: 4, sink: 2.2 },
  { wrist: 278, y: 47, angle: 0, sink: 1.2 },
  { wrist: 272, y: 44, angle: -6, sink: .2 },
])
export function petPose(frame) {
  const pressure = PET_PRESSURE[frame] * .09
  const hand = HAND_POSES[frame]
  return { sx: 1 + pressure * .55, sy: 1 - pressure,
    handY: hand.y + 71.5 * pressure - hand.sink, wrist: hand.wrist, angle: hand.angle }
}
/** Pixel bounds are normalized to the square artwork layout box, including framing. */
export function framedPetBounds(bounds, zoom = 1, x = 0, y = 0) {
  return { left: .5 + (bounds[0] - .5) * zoom + x / 100,
    top: .5 + (bounds[1] - .5) * zoom + y / 100,
    right: .5 + (bounds[2] - .5) * zoom + x / 100,
    bottom: .5 + (bounds[3] - .5) * zoom + y / 100 }
}
/** Alive, awake pigs at home, regardless of form or skin. Scene feedback retains priority. */
export function canPlayPetSnap(pig) {
  const read = name => pig.getAttribute('data-' + name) || ''
  return (Boolean(read('art')) || ['piglet', 'young', 'middle'].includes(read('stage')))
    && !['box', 'grave', 'dead-day'].includes(read('stage'))
    && !read('activity') && !read('idle') && !read('illness') && read('party') !== 'true'
    && !['sleepy', 'dead', 'sick'].includes(read('mood'))
    && (!read('react') || read('react') === 'pet')
}
