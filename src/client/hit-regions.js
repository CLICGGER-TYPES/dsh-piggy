// @ts-check
/**
 * 真实输入区域：只收当前立绘墨迹和可见控件，不把布局祖先、动作预留或粒子绘制包络当输入。
 * 图片复用 art/custom-art 已量的 alpha 外接框；当前 DOM 变换只应用一次，不重复取景缩放。
 */
import { ART_BOUNDS } from './art-framing.js'
import { customArtInk, framedInkBox } from './custom-art.js'

/** @typedef {{x:number,y:number,width:number,height:number}} Rect */
const PIG_PARTS = '.dp-pig-img,.dp-pig-sleep,.dp-pig-emoji,.dp-slot'
const CONTROLS = '.dp-card,.dp-bubble,.dp-daily,.dp-hud,.dp-work,.dp-poke-hint,.dp-pomo,button,a,input,select,textarea,[role="button"],[data-hit]'
// `.dp-daily` 是签到/礼包按钮，显式列出来：它不一定带 `button` 语义（老主题是 div）。
const BLOCK_PET = '.dp-bubble,.dp-card,.dp-daily,button,a,input,select,textarea,[role="button"]'
// 这些容器只负责排版，透明内边距不是可点区域：只报它们里面看得见的文字/图形。
const HINT_CONTAINERS = '.dp-hud,.dp-work,.dp-pomo,.dp-poke-hint'
const PANEL_CARD = '.dp-card'
const INTERACTIVE = 'button,a,input,select,textarea,[role="button"],[data-hit]'

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

/** 只保留两个矩形的交集；完全错开时返回 null。 */
function clipRect(rect, box) {
  if (box === null) return rect
  const left = Math.max(rect.x, box.x), top = Math.max(rect.y, box.y)
  const right = Math.min(rect.x + rect.width, box.x + box.width)
  const bottom = Math.min(rect.y + rect.height, box.y + box.height)
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null
}

/** 装扮点位和睡姿图会画到 `.dp-pig` 盒外；输入区域只认猪盒里的那一段。 */
function pigBoxFor(node) {
  const pig = node.closest?.('.dp-pig') ?? null
  return pig === null ? null : nodeRect(pig)
}

/**
 * 透明容器只上报看得见的内容：文字优先量字框，图形子节点量自己的盒。
 * 容器本身的 padding/border 不参与命中。
 */
function contentRects(container) {
  const rects = []
  const visit = node => {
    for (const child of node.children ?? []) {
      if (!isVisible(child)) continue
      if ((child.children?.length ?? 0) === 0) {
        // 叶子：有字量字框，没字（进度条之类）量自己的盒。
        const rect = textRect(child) ?? nodeRect(child)
        if (rect !== null) rects.push(rect)
        continue
      }
      // 有子节点的容器也可能自己带文字（例如 .dp-pomo 直接写 textContent）。
      const own = textRect(child)
      if (own !== null) rects.push(own)
      visit(child)
    }
  }
  visit(container)
  // 容器本身就是叶子（番茄钟角标）：文字挂在容器自己身上。
  if ((container.children?.length ?? 0) === 0) {
    const own = textRect(container)
    if (own !== null) rects.push(own)
  }
  return rects
}

/** 面板整卡是实心表面，但只有里面的控件/`data-hit` 白名单才算输入。 */
function panelRects(card) {
  const rects = []
  for (const node of card.querySelectorAll?.(INTERACTIVE) ?? []) {
    if (!isVisible(node)) continue
    const rect = nodeRect(node)
    if (rect !== null) rects.push(rect)
  }
  return rects
}

/** 去重：容器分支和 CONTROLS 可能同时量到同一个盒子。 */
function uniqueRects(rects) {
  const seen = new Set(), out = []
  for (const rect of rects) {
    const key = rect.x + ',' + rect.y + ',' + rect.width + ',' + rect.height
    if (seen.has(key)) continue
    seen.add(key); out.push(rect)
  }
  return out
}

/** @param {any} host @returns {Rect[]} */
export function collectPigHitRects(host) {
  const rects = []
  for (const node of host.querySelectorAll(PIG_PARTS)) {
    if (!isVisible(node)) continue
    const image = node.matches?.('.dp-pig-img,.dp-pig-sleep')
    if (image && (!node.getAttribute('src') || node.complete === false || node.naturalWidth === 0)) continue
    const rect = image ? inkRect(node, imageInk(node)) : textRect(node)
    if (rect === null) continue
    // 睡姿比猪盒宽 20%，帽子/披风也会顶出边界；裁掉盒外那段，避免压到日历/礼包。
    const clipped = node.matches?.('.dp-pig-sleep,.dp-slot') ? clipRect(rect, pigBoxFor(node)) : rect
    if (clipped !== null) rects.push(clipped)
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
    if (node.matches?.('[data-hit]')) {
      const rect = nodeRect(node)
      if (rect !== null) rects.push(rect)
      continue
    }
    if (node.matches?.(HINT_CONTAINERS)) { rects.push(...contentRects(node)); continue }
    if (node.matches?.(PANEL_CARD)) { rects.push(...panelRects(node)); continue }
    const rect = nodeRect(node)
    if (rect !== null) rects.push(rect)
  }
  return uniqueRects(rects)
}

/** @param {Rect[]} rects @param {{clientX:number,clientY:number}} event */
export function hitsRects(rects, event) {
  return rects.some(rect => event.clientX >= rect.x && event.clientX < rect.x + rect.width
    && event.clientY >= rect.y && event.clientY < rect.y + rect.height)
}

/** 目标必须落在舞台（`.dp-scene`）或猪的子树里；面板、图标栏和宿主页面的节点都不算摸猪。 */
function insideStage(host, node) {
  if (node === null || node === undefined || host === null || node === host) return true
  if (host.contains?.(node) !== true) return false
  const scene = host.querySelector?.('.dp-scene') ?? null
  // 老夹具没有场景节点时退化为「宿主子树」校验。
  return scene === null || scene.contains?.(node) === true
}

/** 控件先处理自己的事件；即使浮在猪身上也不能变成摸猪或右键菜单。 */
export function hitsPig(host, event) {
  const target = event.target ?? null
  if (target?.closest?.(BLOCK_PET)) return false
  if (target !== null) {
    if (!insideStage(host, target)) return false
  } else {
    // 没有 target（测试/旧调用）：用命中点反查真实元素，仍然尊重阻断层。
    const under = typeof document !== 'undefined' && typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(event.clientX, event.clientY) : null
    if (under?.closest?.(BLOCK_PET)) return false
    if (under !== null && !insideStage(host, under)) return false
  }
  return hitsRects(collectPigHitRects(host), event)
}
