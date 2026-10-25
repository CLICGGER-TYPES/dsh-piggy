// @ts-check
/**
 * 全屏探测要的「猪所在显示器」矩形。
 *
 * Windows 的窗口 bounds 是按 HMONITOR 缩放报的 DIP，副屏 DIP 原点和物理原点
 * 不是同一个比例（实机副屏 DIP 1280、物理 1280，直接乘 1.25 会得到 1600）。
 * 所以这里先用窗口内容的物理矩形 C，再加上页面报告的 CSS 猪中心 × dpr：
 * 只换猪这一个点，不乘整块屏幕的 DIP 原点。
 *
 * 每次调用都重新取显示器清单，热插拔后不会拿着已经拔掉的屏。
 * Linux/macOS 沿用原来的 DIP 坐标和 bounds × scaleFactor 返回值，只把
 * 「窗口交集最大的屏」换成「猪中心最近的屏」，不调用 Windows 的换算方法。
 * @module dsh-piggy-desktop/stage/pig-display
 */
import { physicalContentRect } from './physical.js'

/** @typedef {{x:number,y:number,width:number,height:number}} Rect */

/** @param {any} value @returns {value is Rect} */
function isRect(value) {
  return value !== null && typeof value === 'object'
    && [value.x, value.y, value.width, value.height].every(Number.isFinite)
    && value.width > 0 && value.height > 0
}

/** @param {Rect} rect @returns {Rect} */
function copy(rect) {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

/** @param {Rect} rect @param {number} factor @returns {Rect} */
function scaleRect(rect, factor) {
  return { x: rect.x * factor, y: rect.y * factor, width: rect.width * factor, height: rect.height * factor }
}

/** @param {Rect} rect @param {{x:number,y:number}} point */
function containsPoint(rect, point) {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height
}

/** @param {Rect} rect @param {{x:number,y:number}} point */
function distanceToRect(rect, point) {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
  return dx * dx + dy * dy
}

/** 旧路径：窗口交集最大的屏，再按 scaleFactor 放大（没有猪报告时原样保留）。 */
export function fallbackPigDisplayBounds(win, screen) {
  if (typeof screen?.getDisplayMatching !== 'function') return null
  const display = screen.getDisplayMatching(win.getBounds())
  const scale = Number(display?.scaleFactor) || 1
  return isRect(display?.bounds) ? scaleRect(display.bounds, scale) : null
}

/** Windows：每一块屏的真实物理 bounds 用原生换算推，不能用 DIP 原点乘缩放。 */
export function physicalDisplayBounds(display, screen) {
  if (!isRect(display?.bounds) || typeof screen?.dipToScreenRect !== 'function') return null
  try {
    const rect = screen.dipToScreenRect(null, display.bounds)
    return isRect(rect) ? copy(rect) : null
  } catch { return null }
}

/**
 * 物理点落在哪块屏里；边界/取整导致哪块都不包含时退回最近的一块。
 * @param {any[]} displays
 * @param {{x:number,y:number}} point
 * @param {any} screen
 */
export function displayForPhysicalPoint(displays, point, screen) {
  let nearest = null
  let nearestDistance = Infinity
  for (const display of Array.isArray(displays) ? displays : []) {
    const bounds = physicalDisplayBounds(display, screen)
    if (bounds === null) continue
    if (containsPoint(bounds, point)) return bounds
    const distance = distanceToRect(bounds, point)
    if (distance < nearestDistance) { nearest = bounds; nearestDistance = distance }
  }
  return nearest
}

/** 页面 CSS 像素 → 物理像素的比例：优先报告 dpr，退而用 CSS 视口。 */
function pageScale(content, dpr, viewport) {
  if (Number.isFinite(dpr) && Number(dpr) > 0) return Number(dpr)
  if (isRect({ x: 0, y: 0, width: viewport?.width, height: viewport?.height })) return content.width / viewport.width
  return null
}

/** @param {Rect} content @param {Rect} pig @param {number} scale @returns {{x:number,y:number}} */
function physicalPigCenter(content, pig, scale) {
  return {
    x: content.x + (pig.x + pig.width / 2) * scale,
    y: content.y + (pig.y + pig.height / 2) * scale,
  }
}

/**
 * @param {{
 *   platform: string,
 *   screen: any,
 *   win: any,
 *   pig: Rect|null,
 *   dpr?: number|null,
 *   viewport?: {width:number,height:number}|null,
 * }} options
 * @returns {Rect|null}
 */
export function pigDisplayBounds(options) {
  const { platform, screen, win, pig } = options
  if (!isRect(pig)) return fallbackPigDisplayBounds(win, screen)

  if (platform === 'win32') {
    if (typeof screen?.getAllDisplays !== 'function') return fallbackPigDisplayBounds(win, screen)
    try {
      const content = physicalContentRect(win, screen)
      const scale = pageScale(content, options.dpr ?? null, options.viewport ?? null)
      if (!isRect(content) || scale === null || !Number.isFinite(scale) || scale <= 0) return fallbackPigDisplayBounds(win, screen)
      return displayForPhysicalPoint(screen.getAllDisplays(), physicalPigCenter(content, pig, scale), screen)
        ?? fallbackPigDisplayBounds(win, screen)
    } catch { return fallbackPigDisplayBounds(win, screen) }
  }

  // Linux/macOS：pig 的 CSS 坐标直接落在原有的 DIP 空间里，不做物理换算。
  const content = win.getContentBounds()
  if (!isRect(content)) return fallbackPigDisplayBounds(win, screen)
  const point = { x: content.x + pig.x + pig.width / 2, y: content.y + pig.y + pig.height / 2 }
  const display = typeof screen?.getDisplayNearestPoint === 'function'
    ? screen.getDisplayNearestPoint(point)
    : typeof screen?.getDisplayMatching === 'function'
      ? screen.getDisplayMatching({ x: point.x, y: point.y, width: 1, height: 1 })
      : null
  const scale = Number(display?.scaleFactor) || 1
  return isRect(display?.bounds) ? scaleRect(display.bounds, scale) : fallbackPigDisplayBounds(win, screen)
}
