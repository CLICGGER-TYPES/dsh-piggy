// @ts-check
/**
 * 真实输入区域：只收当前立绘墨迹和可见控件，不把布局祖先、动作预留或粒子绘制包络当输入。
 * 图片复用 art/custom-art 已量的 alpha 外接框；当前 DOM 变换只应用一次，不重复取景缩放。
 */
import { ART_BOUNDS } from './art-framing.js'
import { customArtInk, framedInkBox } from './custom-art.js'

/** @typedef {{x:number,y:number,width:number,height:number}} Rect */
const PIG_PARTS = '.dp-pig-img,.dp-pig-sleep,.dp-pig-emoji,.dp-slot'
const CONTROLS = '.dp-card,.dp-bubble,.dp-daily,.dp-hud,.dp-work,.dp-poke-hint,.dp-pomo,button,a,input,select,textarea,[role="button"]'
const BLOCK_PET = '.dp-bubble,.dp-card,button,a,input,select,textarea,[role="button"]'

const parentElement = node => node.parentElement ?? (node.parentNode?.nodeType === 9 ? null : node.parentNode)
/** 父节点隐藏/透明时，子节点即使自身可见也不能取得输入。 @param {any} node */
function isVisible(node) {
  for (let walk = node; walk; walk = parentElement(walk)) {
    if (walk.hidden) return false
    const style = getComputedStyle(walk)
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
    if (style.opacity !== '' && style.opacity !== undefined && Number(style.opacity) <= .01) return false
  }
  return true
}

/** @param {any} node @returns {Rect|null} */
function nodeRect(node) {
  const box = node.getBoundingClientRect?.()
  if (!box || !(box.width > 0) || !(box.height > 0)) return null
  return { x: box.left ?? box.x, y: box.top ?? box.y, width: box.width, height: box.height }
}

/** 二维线性部分：平移和变换中心由实际 DOM rect 的原点还原。 */
function multiply(one, two) {
  return [one[0] * two[0] + one[2] * two[1], one[1] * two[0] + one[3] * two[1],
    one[0] * two[2] + one[2] * two[3], one[1] * two[2] + one[3] * two[3]]
}

function linearTransform(style) {
  const transform = String(style.transform ?? '')
  const values = transform.slice(transform.indexOf('(') + 1, -1).split(',').map(Number)
  let matrix = [1, 0, 0, 1]
  if (transform.startsWith('matrix(') && values.length === 6) matrix = values.slice(0, 4)
  if (transform.startsWith('matrix3d(') && values.length === 16) matrix = [values[0], values[1], values[4], values[5]]
  const scale = String(style.scale ?? 'none').split(/\s+/).map(Number)
  if (Number.isFinite(scale[0])) matrix = multiply([scale[0], 0, 0, scale[1] ?? scale[0]], matrix)
  const rotate = String(style.rotate ?? 'none')
  if (rotate !== 'none' && Number.isFinite(parseFloat(rotate))) {
    const angle = parseFloat(rotate) * (rotate.endsWith('rad') ? 1 : rotate.endsWith('turn') ? Math.PI * 2 : Math.PI / 180)
    matrix = multiply([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle)], matrix)
  }
  return matrix
}

/**
 * 已归一化到元素盒的墨迹 → 当前视口。祖先倾斜/旋转也作用于墨迹四角；
 * 用完整元素的实际 rect 校准 CSS zoom 和变换原点，因此不会再乘一次 --art-zoom。
 * @param {any} node @param {number[]} ink @returns {Rect|null}
 */
function inkRect(node, ink) {
  const box = nodeRect(node)
  if (box === null) return null
  const width = node.offsetWidth || box.width, height = node.offsetHeight || box.height
  let matrix = [1, 0, 0, 1]
  for (let walk = node; walk; walk = parentElement(walk)) matrix = multiply(linearTransform(getComputedStyle(walk)), matrix)
  const project = (x, y) => ({ x: matrix[0] * x * width + matrix[2] * y * height, y: matrix[1] * x * width + matrix[3] * y * height })
  const corners = bounds => [project(bounds[0], bounds[1]), project(bounds[2], bounds[1]), project(bounds[0], bounds[3]), project(bounds[2], bounds[3])]
  const extent = points => ({ left: Math.min(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)) })
  const full = extent(corners([0, 0, 1, 1])), part = extent(corners(ink))
  const sx = box.width / (full.right - full.left), sy = box.height / (full.bottom - full.top)
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null
  return { x: box.x + (part.left - full.left) * sx, y: box.y + (part.top - full.top) * sy,
    width: (part.right - part.left) * sx, height: (part.bottom - part.top) * sy }
}

/** 内置 bounds 归一化到源图；自定义缓存已经按 contain 归一化到显示元素盒。 */
function imageInk(node) {
  const src = node.getAttribute('src') || ''
  const custom = customArtInk(src)
  if (custom !== null) return custom
  const path = src.split('/art/')[1]?.split('?')[0].replace(/^pigs\/no-outline\//, 'pigs/')
  const bounds = ART_BOUNDS[path] ?? [0, 0, 1, 1]
  const width = node.offsetWidth || 1, height = node.offsetHeight || width
  const naturalWidth = node.naturalWidth || width, naturalHeight = node.naturalHeight || height
  const fit = Math.min(width / naturalWidth, height / naturalHeight)
  const contained = { x: (1 - naturalWidth * fit / width) / 2, y: (1 - naturalHeight * fit / height) / 2,
    width: naturalWidth * fit / width, height: naturalHeight * fit / height }
  const ink = framedInkBox(contained, bounds)
  return [ink.x, ink.y, ink.x + ink.width, ink.y + ink.height]
}

/** 字框只量当前文字，不退回透明的猪/装扮祖先。 */
function textRect(node) {
  if (!node.textContent?.trim()) return null
  if (typeof document.createRange !== 'function') return nodeRect(node)
  const range = document.createRange()
  range.selectNodeContents(node)
  const box = range.getBoundingClientRect()
  return box.width > 0 && box.height > 0 ? { x: box.left, y: box.top, width: box.width, height: box.height } : null
}

/** @param {any} host @returns {Rect[]} */
export function collectPigHitRects(host) {
  const rects = []
  for (const node of host.querySelectorAll(PIG_PARTS)) {
    if (!isVisible(node)) continue
    const image = node.matches?.('.dp-pig-img,.dp-pig-sleep')
    if (image && (!node.getAttribute('src') || node.complete === false || node.naturalWidth === 0)) continue
    const rect = image ? inkRect(node, imageInk(node)) : textRect(node)
    if (rect !== null) rects.push(rect)
  }
  return rects
}

/** 舞台、split 和 DOM 手势共享的 CSS 视口矩形。@param {any} host @returns {Rect[]} */
export function collectHitRects(host) {
  const rects = collectPigHitRects(host)
  for (const node of host.querySelectorAll(CONTROLS)) {
    if (!isVisible(node)) continue
    const surface = node.closest?.('.dp-card,.dp-bubble')
    if (surface && surface !== node) continue
    const rect = nodeRect(node)
    if (rect !== null) rects.push(rect)
  }
  return rects
}

/** @param {Rect[]} rects @param {{clientX:number,clientY:number}} event */
export function hitsRects(rects, event) {
  return rects.some(rect => event.clientX >= rect.x && event.clientX < rect.x + rect.width
    && event.clientY >= rect.y && event.clientY < rect.y + rect.height)
}

/** 控件先处理自己的事件；即使浮在猪身上也不能变成摸猪或右键菜单。 */
export function hitsPig(host, event) {
  if (event.target?.closest?.(BLOCK_PET)) return false
  return hitsRects(collectPigHitRects(host), event)
}
