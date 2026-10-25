// @ts-check
/**
 * 整屏舞台的纯几何：窗口 bounds、工作区空洞、矩形夹取。
 *
 * 舞台窗口覆盖所有显示器 workArea 的并集（DIP，可为负坐标）。窗口里不属于任何
 * workArea 的像素是屏间空洞：透明、不可点，也不能把猪/面板留在那里。
 * 所有函数只接收普通对象，Electron 和单测共用。
 * @module dsh-piggy-desktop/stage/geometry
 */

/** @typedef {{x:number,y:number,width:number,height:number}} Rect */
/** @typedef {{id?:number,label?:string,bounds?:Rect,workArea:Rect,scaleFactor?:number}} DisplayLike */

const round = value => Math.round(Number(value) || 0)

/** @param {unknown} value @returns {value is Rect} */
export function isRect(value) {
  if (value === null || typeof value !== 'object') return false
  const rect = /** @type {Rect} */ (value)
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0
}

/** @param {Rect} rect */
export function copyRect(rect) {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

/** @param {Rect} a @param {Rect} b */
export function rectsEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/** @param {Rect} a @param {Rect} b */
export function rectsIntersect(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** @param {Rect} rect @param {{x:number,y:number}} point */
export function rectContains(rect, point) {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height
}

/**
 * 所有工作区的并集。每次从显示器清单重算，不在旧 bounds 上累加。
 * @param {DisplayLike[] | Rect[]} displays
 * @returns {Rect|null}
 */
export function stageBounds(displays) {
  const areas = (Array.isArray(displays) ? displays : [])
    .map(entry => (entry && typeof entry === 'object' && 'workArea' in entry ? entry.workArea : entry))
    .filter(isRect)
  if (areas.length === 0) return null
  const x = Math.min(...areas.map(area => area.x))
  const y = Math.min(...areas.map(area => area.y))
  const right = Math.max(...areas.map(area => area.x + area.width))
  const bottom = Math.max(...areas.map(area => area.y + area.height))
  return { x: round(x), y: round(y), width: Math.max(1, round(right - x)), height: Math.max(1, round(bottom - y)) }
}

/**
 * 工作区清单（去重、稳定排序），同时作为页面和主进程的唯一来源。
 * @param {DisplayLike[]} displays
 * @returns {Rect[]}
 */
export function workAreasOf(displays) {
  const seen = new Set()
  const areas = []
  for (const display of Array.isArray(displays) ? displays : []) {
    const area = display?.workArea
    if (!isRect(area)) continue
    const key = [area.x, area.y, area.width, area.height].join(',')
    if (seen.has(key)) continue
    seen.add(key)
    areas.push(copyRect(area))
  }
  return areas.sort((a, b) => a.y - b.y || a.x - b.x || a.width - b.width)
}

/**
 * 点离哪个工作区最近（落在里面距离为 0）。空洞里的点会得到最近的屏。
 * @param {{x:number,y:number}} point
 * @param {Rect[]} areas
 * @returns {Rect|null}
 */
export function nearestWorkArea(point, areas) {
  let best = null
  let distance = Infinity
  for (const area of areas) {
    const dx = Math.max(area.x - point.x, 0, point.x - (area.x + area.width))
    const dy = Math.max(area.y - point.y, 0, point.y - (area.y + area.height))
    const next = dx * dx + dy * dy
    if (next < distance) { best = area; distance = next }
  }
  return best
}

/**
 * 把矩形整体夹进一块工作区。比工作区还大时贴左边/上边，保证至少左上可见。
 * @param {Rect} rect
 * @param {Rect} area
 * @returns {Rect}
 */
export function clampRectInto(rect, area) {
  const width = Math.min(rect.width, area.width)
  const height = Math.min(rect.height, area.height)
  const x = Math.min(Math.max(rect.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(rect.y, area.y), area.y + area.height - height)
  return { x: round(x), y: round(y), width: round(width), height: round(height) }
}


/**
 * 矩形是否被工作区并集完整覆盖。相邻屏缝算覆盖（猪可以跨缝），
 * 错位屏幕之间的真正空洞不算。用工作区边界切网格，逐格看中心点落在哪块屏。
 * @param {Rect} rect
 * @param {Rect[]} areas
 */
export function rectCoveredByAreas(rect, areas) {
  const list = Array.isArray(areas) ? areas.filter(isRect) : []
  if (list.length === 0) return false
  const xs = [...new Set([rect.x, rect.x + rect.width, ...list.flatMap(area => [area.x, area.x + area.width])])]
    .filter(x => x > rect.x && x < rect.x + rect.width)
  const ys = [...new Set([rect.y, rect.y + rect.height, ...list.flatMap(area => [area.y, area.y + area.height])])]
    .filter(y => y > rect.y && y < rect.y + rect.height)
  const xCuts = [rect.x, ...xs.sort((a, b) => a - b), rect.x + rect.width]
  const yCuts = [rect.y, ...ys.sort((a, b) => a - b), rect.y + rect.height]
  for (let xi = 0; xi < xCuts.length - 1; xi += 1) {
    for (let yi = 0; yi < yCuts.length - 1; yi += 1) {
      const x = (xCuts[xi] + xCuts[xi + 1]) / 2
      const y = (yCuts[yi] + yCuts[yi + 1]) / 2
      if (!list.some(area => x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height)) return false
    }
  }
  return true
}

/**
 * 让矩形完整落在某块工作区里：先找包含中心点的屏，否则找最近的屏。
 * 返回新矩形和需要移动的偏移；已经在某块屏里就原样返回（offset 0）。
 * @param {Rect} rect
 * @param {Rect[]} areas
 * @returns {{rect:Rect, area:Rect|null, offset:{x:number,y:number}, moved:boolean}}
 */
export function constrainRectToAreas(rect, areas) {
  const list = Array.isArray(areas) ? areas.filter(isRect) : []
  if (list.length === 0) return { rect: copyRect(rect), area: null, offset: { x: 0, y: 0 }, moved: false }
  if (rectCoveredByAreas(rect, list)) {
    return { rect: copyRect(rect), area: nearestWorkArea({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, list), offset: { x: 0, y: 0 }, moved: false }
  }
  const area = nearestWorkArea({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, list)
  const clamped = clampRectInto(rect, area)
  return {
    rect: clamped,
    area,
    offset: { x: clamped.x - rect.x, y: clamped.y - rect.y },
    moved: clamped.x !== rect.x || clamped.y !== rect.y,
  }
}

/**
 * 页面坐标 -> 屏幕坐标。舞台无边框，窗口 origin 就是内容 origin。
 * @param {Rect} rect
 * @param {{x:number,y:number}} origin
 * @returns {Rect}
 */
export function toScreenRect(rect, origin) {
  return { x: rect.x + origin.x, y: rect.y + origin.y, width: rect.width, height: rect.height }
}

/**
 * 屏幕坐标 -> 页面坐标。
 * @param {Rect} rect
 * @param {{x:number,y:number}} origin
 * @returns {Rect}
 */
export function toPageRect(rect, origin) {
  return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height }
}

/**
 * 物理空间元数据（只有 Windows 舞台带）：s、物理内容矩形、成对的显示器工作区。
 * 老载荷没有 space，页面照旧按 DIP 用。
 * @param {{scale:number, content:Rect, displays:any[]}} space
 */
function spacePayload(space) {
  return {
    scale: Number(space.scale) || 1,
    content: copyRect(space.content),
    displays: (Array.isArray(space.displays) ? space.displays : []).map(display => ({
      id: display.id,
      scaleFactor: Number(display.scaleFactor) || 1,
      dipWorkArea: copyRect(display.dipWorkArea),
      physicalWorkArea: copyRect(display.physicalWorkArea),
    })),
  }
}

/**
 * 主进程发给页面的几何。seq 单调递增，页面据此丢弃迟到的旧消息。
 * window/workAreas 在舞台里是「物理像素 / 有效 DPR」；非 Windows 仍是 DIP。
 * displays 保持原有元数据（bounds/workArea/scaleFactor），Windows 额外带成对工作区。
 * @param {{window:Rect, workAreas:Rect[], displays:any[], seq:number, interacting?:boolean, legacyPig?:{x:number,y:number}|null, space?:{scale:number,content:Rect,displays:any[]}|null}} value
 */
export function geometryPayload(value) {
  /** @type {Record<string, any>} */
  const payload = {
    window: copyRect(value.window),
    workAreas: value.workAreas.map(copyRect),
    displays: value.displays.map(display => {
      /** @type {Record<string, any>} */
      const out = {
        id: display.id, label: display.label,
        bounds: display.bounds ? copyRect(display.bounds) : undefined,
        workArea: copyRect(display.workArea),
        scaleFactor: Number(display.scaleFactor) || 1,
      }
      if (isRect(display.dipWorkArea)) out.dipWorkArea = copyRect(display.dipWorkArea)
      if (isRect(display.physicalWorkArea)) out.physicalWorkArea = copyRect(display.physicalWorkArea)
      return out
    }),
    interacting: value.interacting === true,
    // 桌面版旧 window.json 里猪的屏幕左上角；页面只在没有本机位置偏好时用一次（A3）。
    // 契约：这里保持 DIP 原值，由页面按 space 换算，主进程不改写。
    legacyPig: value.legacyPig && Number.isFinite(value.legacyPig.x) && Number.isFinite(value.legacyPig.y)
      ? { x: value.legacyPig.x, y: value.legacyPig.y } : null,
    seq: value.seq,
  }
  if (value.space !== undefined && value.space !== null) payload.space = spacePayload(value.space)
  return payload
}
