// @ts-check
/** Both reviewed styles share a visible height, with independent alpha bounds. */
import * as outlined from './feedback-framing.js'
import * as plain from './no-outline-framing.js'
import { ART_URL } from './constants.js'

export const FRAME_HEIGHT = outlined.FRAME_HEIGHT
export const ART_BOUNDS = Object.freeze({ ...outlined.ART_BOUNDS, ...plain.ART_BOUNDS })
export const MAX_ART_ASPECT = Math.max(outlined.MAX_ART_ASPECT, plain.MAX_ART_ASPECT)

export function builtinFrame(src) {
  const path = src.slice(ART_URL.length)
  const data = path.startsWith('pigs/no-outline/') ? plain : outlined
  const name = path.split('/').pop()?.replace(/\.png$/, '')
  return data.BUILTIN_FRAMING[path] ?? data.FEEDBACK_FRAMING[name] ?? null
}

export function applyFrame(image, frame) {
  if (typeof image.style?.setProperty !== 'function') return
  image.style.setProperty('--art-zoom', frame ? String(frame[0]) : '1')
  image.style.setProperty('--art-x', frame ? frame[1] + '%' : '0%')
  image.style.setProperty('--art-y', frame ? frame[2] + '%' : '0%')
}

/** Fixed reserve for both styles, including animation slack. */
export function artMarginFor(width) {
  return Math.max(40, (MAX_ART_ASPECT * FRAME_HEIGHT - 1) * width / 2 + 6)
}
