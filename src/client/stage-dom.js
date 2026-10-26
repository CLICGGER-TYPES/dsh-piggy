// @ts-check
/** DOM measurements shared by the stage adapter. */
import { artMarginFor } from './art-framing.js'
import { bodyVisualBounds } from './desktop/visual-bounds.js'
import { customArtVisibleBox } from './custom-art.js'
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
  const envelope = union(bodyVisualBounds(box), {
    x: Math.floor(box.x - side), y: Math.floor(box.y - PIG_TOP),
    width: Math.ceil(box.width + side * 2), height: Math.ceil(box.height + PIG_TOP + PIG_BOTTOM),
  })
  // 自定义立绘可能比固定 MAX_ART_ASPECT 更宽：可见范围用和显示同一份已量 ink，
  // 但只在该节点真的可见时并入，睡姿图 hidden 时不额外撑大。
  const art = customArtBounds(pig)
  return art === null ? envelope : union(envelope, art)
}

/** 自定义立绘节点在页面里真的可见（睡姿图平时 display:none）。 */
function artVisible(node) {
  if (node === null || node === undefined || node.hidden) return false
  if (typeof getComputedStyle === 'function') {
    const style = getComputedStyle(node)
    if (style?.display === 'none' || style?.visibility === 'hidden' || Number(style?.opacity) <= .01) return false
  }
  return true
}

/**
 * 猪身上所有已量、可见的自定义立绘可见矩形并集；没有就是 null。
 * `target` 是猪盒的目标位置（舞台飞行时带 host translate）；不给就用节点自己的布局坐标。
 */
function customArtBounds(pig, target = null) {
  if (pig === null || pig === undefined || typeof pig.querySelectorAll !== 'function') return null
  const pigBox = layoutBox(pig)
  let art = null
  for (const node of pig.querySelectorAll('.dp-pig-img,.dp-pig-sleep')) {
    if (!artVisible(node)) continue
    const local = layoutBox(node)
    const box = target === null ? local : {
      x: target.x + local.x - pigBox.x, y: target.y + local.y - pigBox.y,
      width: local.width, height: local.height,
    }
    const rect = customArtVisibleBox(node, box)
    if (rect !== null) art = art === null ? rect : union(art, rect)
  }
  return art
}

/**
 * 舞台绘制范围：原有身体包络 ∪ 已量自定义立绘可见框。舞台外壳的 drawingBounds
 * 回调用它，Linux 的 setShape 才不会裁掉宽图的左右。
 * @param {{x:number,y:number,width:number,height:number}} box 猪的布局盒
 * @param {any} pig .dp-pig 节点
 */
export function stageDrawingBounds(box, pig) {
  const body = bodyVisualBounds(box)
  const art = customArtBounds(pig, box)
  return art === null ? body : union(body, art)
}

/** @param {any} a @param {any} b */
export function union(a, b) {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}

