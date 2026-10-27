// @ts-check
/** 内置立绘的取景：每张图按可见边界放大、居中，所有图同一个可见高度（tools/measure-feedback-framing.py 生成数据）。 */
import * as data from './feedback-framing.js'
import { ART_URL } from './constants.js'

export const FRAME_HEIGHT = data.FRAME_HEIGHT
export const ART_BOUNDS = data.ART_BOUNDS
export const MAX_ART_ASPECT = data.MAX_ART_ASPECT

export function builtinFrame(src) {
  // 2026-10-13 以前的无描边图在 pigs/no-outline/ 下，现在就是主图：老地址按同一张算。
  const path = src.slice(ART_URL.length).split('?')[0].replace(/^pigs\/no-outline\//, 'pigs/')
  const name = path.split('/').pop()?.replace(/\.png$/, '')
  return data.BUILTIN_FRAMING[path] ?? data.FEEDBACK_FRAMING[name] ?? null
}

export function applyFrame(image, frame) {
  if (typeof image.style?.setProperty !== 'function') return
  image.style.setProperty('--art-zoom', frame ? String(frame[0]) : '1')
  image.style.setProperty('--art-x', frame ? frame[1] + '%' : '0%')
  image.style.setProperty('--art-y', frame ? frame[2] + '%' : '0%')
}

/** Fixed reserve, including animation slack. */
export function artMarginFor(width) {
  return Math.max(40, (MAX_ART_ASPECT * FRAME_HEIGHT - 1) * width / 2 + 6)
}
