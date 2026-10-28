// @ts-check
/**
 * 舞台页面分别量绘制形状与真实输入区域。
 * 猪的保守包络和粒子只用于绘制，Linux setShape 不能把它们裁掉；
 * 输入由游戏的 hitRegions 提供当前可见立绘与真实控件，旧游戏仍沿用绘制形状。
 * @module dsh-piggy-desktop/stage/overlay-shape
 */

/** 与 src/client/art-framing.js、desktop/measure.js 保持一致的保守立绘边距。 */
const ART_MIN = 40
const MAX_ART_ASPECT = 1.947826
const FRAME_HEIGHT = 0.84375
const PAD = 8
/** 头顶礼包/饥饿/番茄钟/打盹与脚下 bob 的余量。 */
export const PIG_TOP = 44
export const PIG_BOTTOM = 18
/** 气泡尾巴/阴影超出正文一点。 */
const BUBBLE_PAD = 10
/**
 * 爆点粒子（.dp-fx）的绘制带：和 src/client/desktop/measure.js 的 .dp-fx 矩形同一份
 * 余量（那边是内联的 36/84/12，测试 stage-audit-regression 会比对两边）。
 * 粒子从猪头上方 20px 升起、再上移 56px（effects.js、css-tabs.js 的 dp-rise），
 * 只留 PIG_TOP 时 Linux 的 setShape 会把最上面 52px 连绘制一起裁掉。
 * 粒子 pointer-events:none，这块矩形只为绘制留位，不增加可点区域。
 */
export const FX_SIDE = 36
export const FX_TOP = 84
export const FX_BOTTOM = 12

/** @param {number} width */
export function artMargin(width) {
  return Math.max(ART_MIN, (MAX_ART_ASPECT * FRAME_HEIGHT - 1) * width / 2 + 6)
}

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

/** @param {any} node */
export function visible(node) {
  if (node === null || node === undefined) return false
  if (node.closest?.('[hidden]')) return false
  for (let walk = node; walk !== null && walk !== undefined; walk = walk.parentElement) {
    const style = getComputedStyle(walk)
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) <= 0.01) return false
  }
  return true
}

/** @param {{x:number,y:number,width:number,height:number}} rect @param {number} pad */
function roundRect(rect, pad) {
  const x = Math.floor(rect.x - pad)
  const y = Math.floor(rect.y - pad)
  const right = Math.ceil(rect.x + rect.width + pad)
  const bottom = Math.ceil(rect.y + rect.height + pad)
  return { x, y, width: right - x, height: bottom - y }
}

/**
 * 猪的布局盒（页面坐标，含 host 的 translate）：呼吸/浮动只改 transform，不在这里。
 * offsetParent 链异常时退回当前 rect（只发生一次测量，不影响点击）。
 * @param {any} host
 */
export function pigLayoutBox(host) {
  const pig = host?.querySelector?.('.dp-pig')
  if (pig === null || pig === undefined) return null
  let box = layoutBox(pig)
  if (box.width < 1 || box.height < 1) return null
  const rect = pig.getBoundingClientRect()
  if (Math.abs(rect.left - box.x) > 300 || Math.abs(rect.top - box.y) > 300) {
    box = { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
  }
  // layoutBox 不含 host 的 translate；飞行贴边时 flight-run 会在 host 上加 translate。
  const shift = hostTranslate(host)
  return { x: box.x + shift.x, y: box.y + shift.y, width: box.width, height: box.height }
}

/**
 * 猪的布局盒 → 宽度包络（宽立绘/尾巴 + 头顶脚下动画余量）。
 * @param {{x:number,y:number,width:number,height:number}} box pigLayoutBox() 的结果
 */
export function envelopeFor(box) {
  if (box === null || box.width < 1 || box.height < 1) return null
  const side = artMargin(box.width) + PAD
  return {
    x: Math.floor(box.x - side),
    y: Math.floor(box.y - PIG_TOP),
    width: Math.ceil(box.width + side * 2),
    height: Math.ceil(box.height + PIG_TOP + PIG_BOTTOM),
  }
}

/**
 * 猪的布局盒 + 宽立绘/尾巴 + 头顶脚下动画余量。返回页面坐标。
 * @param {any} host
 */
export function pigEnvelope(host) {
  return envelopeFor(pigLayoutBox(host))
}

/**
 * 爆点粒子的绘制带（页面坐标）。只有猪身上真有 .dp-fx 时才用。
 * @param {any} pigBox pigLayoutBox() 的结果
 */
export function fxBand(pigBox) {
  if (pigBox === null || pigBox.width < 1 || pigBox.height < 1) return null
  const x = Math.floor(pigBox.x - FX_SIDE)
  const y = Math.floor(pigBox.y - FX_TOP)
  return {
    x, y,
    width: Math.ceil(pigBox.x + pigBox.width + FX_SIDE) - x,
    height: Math.ceil(pigBox.y + FX_BOTTOM) - y,
  }
}

/** host 上的 translate（飞行时 flight-run 用它把猪滑回屏幕边内）。 */
export function hostTranslate(host) {
  const value = getComputedStyle(host).translate
  const match = /(-?\d+(?:\.\d+)?)px(?:\s+(-?\d+(?:\.\d+)?)px)?/.exec(value || '')
  return match === null ? { x: 0, y: 0 } : { x: Number(match[1]) || 0, y: Number(match[2]) || 0 }
}

/** @param {any} node @param {number} pad */
function elementRect(node, pad) {
  if (!visible(node)) return null
  const rect = node.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null
  return roundRect(rect, pad)
}

/**
 * 当前真实输入；缺 hook 和空数组必须区分，旧游戏才不会失去原有点击契约。
 * @param {any} host
 * @param {Document} doc
 * @param {{hitRegions?:((host:any)=>any[])}} stageApi
 */
export function collectStageHitShape(host, doc, stageApi) {
  if (typeof stageApi.hitRegions !== 'function') return undefined
  const rects = stageApi.hitRegions(host)
  const hits = Array.isArray(rects) ? rects : []
  const overlays = []
  // role dialog / 农场纸面才是真实内容，不能把 .dp-save-overlay 的整屏暗底变成输入。
  for (const node of Array.from(doc.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal="true"],[data-farm-overlay]'))) {
    const rect = elementRect(node, 0)
    if (rect !== null) overlays.push(rect)
  }
  return overlays.length === 0 ? hits : hits.concat(overlays)
}

/**
 * @param {any} host
 * @param {Document} doc
 * @param {{drawingBounds?:((box:any)=>any), hitRegions?:((host:any)=>any[])}} [stageApi]
 */
export function collectStageShape(host, doc = document, stageApi = {}) {
  if (host === null || host === undefined) return null
  const pigBox = pigLayoutBox(host)
  const pig = envelopeFor(pigBox)
  const body = pigBox !== null && typeof stageApi.drawingBounds === 'function' ? roundRect(stageApi.drawingBounds(pigBox), 0) : null
  // Linux setShape 同时裁绘制：粒子升起的那一段也要在形状里（split 的 measure.js 早就有）。
  const fx = host.querySelector('.dp-fx') === null ? null : fxBand(pigBox)
  const bubble = elementRect(host.querySelector('.dp-bubble'), BUBBLE_PAD)
  const menu = elementRect(host.querySelector('.dp-card'), PAD)
  const gift = elementRect(host.querySelector('.dp-daily'), PAD)
  const hud = elementRect(host.querySelector('.dp-hud'), PAD)
  const work = elementRect(host.querySelector('.dp-work'), PAD)
  const poke = elementRect(host.querySelector('.dp-poke-hint'), PAD)
  const soul = elementRect(host.querySelector('.dp-soul'), PAD)
  const overlays = []
  const nodes = doc.querySelectorAll('[role="dialog"],[role="alertdialog"],[aria-modal="true"],[data-farm-overlay],.dp-save-overlay')
  for (const node of Array.from(nodes)) {
    const rect = elementRect(node, PAD)
    if (rect !== null) overlays.push(rect)
  }
  const shape = []
  for (const rect of [pig, body, fx, bubble, menu, gift, hud, work, poke, soul, ...overlays]) {
    if (rect !== null) shape.push(rect)
  }
  const hitShape = collectStageHitShape(host, doc, stageApi)
  return {
    shape,
    ...(hitShape !== undefined ? { hitShape: Array.isArray(hitShape) ? hitShape : [] } : {}),
    visible: {
      pig,
      bubble,
      menu,
      gift,
      hud,
      overlay: overlays.length === 0 ? null : overlays[0],
    },
  }
}

/** 形状的稳定键：顺序由本模块的固定顺序保证。 */
export function stageShapeKey(shape) {
  return Array.isArray(shape) ? JSON.stringify(shape) : ''
}
