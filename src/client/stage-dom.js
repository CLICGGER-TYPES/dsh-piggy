// @ts-check
/** DOM measurements shared by the stage adapter. */
import { artMarginFor } from './art-framing.js'
import { bodyVisualBounds } from './desktop/visual-bounds.js'
const PIG_TOP = 44
const PIG_BOTTOM = 18

/** @param {any} node */
export function layoutBox(node) {
  let x = 0
  let y = 0
  let walk = node
  while (walk !== null && walk !== undefined && walk !== document.body) {
    x += walk.offsetLeft || 0
    y += walk.offsetTop || 0
    walk = walk.offsetParent
  }
  return { x, y, width: node.offsetWidth || 0, height: node.offsetHeight || 0 }
}

/** @param {any} host @param {string} side */
export function hostInset(host, side) {
  const value = Number.parseFloat(getComputedStyle(host)[side])
  return Number.isFinite(value) ? value : null
}

/** 猪的绘制包络（页面坐标）：和 apps/desktop/stage/overlay-shape.js 同一份余量。 @param {any} pig */
export function pigEnvelope(pig) {
  const box = layoutBox(pig)
  if (box.width < 1 || box.height < 1) return null
  const side = artMarginFor(box.width) + 8
  return union(bodyVisualBounds(box), {
    x: Math.floor(box.x - side), y: Math.floor(box.y - PIG_TOP),
    width: Math.ceil(box.width + side * 2), height: Math.ceil(box.height + PIG_TOP + PIG_BOTTOM),
  })
}

/** @param {any} a @param {any} b */
export function union(a, b) {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}

