// @ts-check
/**
 * 桌面壳窗口的物理命中换算：光标和窗口各自按所在屏的缩放解释。
 *
 * Windows 混合 DPI 下 `getCursorScreenPoint()` 的 DIP 按「光标所在屏」的 scaleFactor
 * 解释，`getBounds()/getContentBounds()` 的 DIP 按「窗口所在屏」的 scaleFactor 解释；
 * 两块屏缩放不同时直接相减没有意义。舞台窗口已按同一结论处理（stage/hit-physical.js），
 * 这里复用它的折回公式：先用 Electron 的 `dipToScreenPoint` / `dipToScreenRect`
 * 换到物理像素，再按页面 dpr（或 CSS 视口 / 内容 DIP 尺寸）折回窗口逻辑坐标。
 *
 * 纯函数不碰 Electron；运行时包装在换算不可用时返回 problem，由调用方按「不命中」
 * 处理，不退回看起来差不多的 DIP 减法。
 * @module dsh-piggy-desktop/lib/hit-physical
 */
import { pointerHitsShape } from './pointer-hit.js'
import { translatePhysicalCursor, translatePhysicalCursorDpr } from '../stage/hit-physical.js'

export { translatePhysicalCursor, translatePhysicalCursorDpr }

const finite = value => typeof value === 'number' && Number.isFinite(value)

/** @param {any} value */
function isPoint(value) {
  return value !== null && typeof value === 'object' && finite(value.x) && finite(value.y)
}

/** @param {any} value */
function isRect(value) {
  return value !== null && typeof value === 'object'
    && finite(value.x) && finite(value.y) && finite(value.width) && finite(value.height)
}

/** 该屏 DIP 到物理的缩放；坏数据按 1 处理，不放大猜测。 */
function scaleOf(display) {
  return finite(display?.scaleFactor) && display.scaleFactor > 0 ? display.scaleFactor : 1
}

/**
 * 该屏物理原点的位置：优先 display.physicalBounds；没有就按 DIP 原点乘本屏缩放。
 * Electron 的 Display 不暴露 physicalBounds，运行时走原生 dipToScreen*；
 * 纯函数夹具可以显式给出它，从而模拟混合 DPI 的两块屏。
 */
function physicalOriginOf(display, scale) {
  const physical = display?.physicalBounds
  if (isPoint(physical)) return { x: physical.x, y: physical.y }
  const dip = display?.bounds
  return isPoint(dip) ? { x: dip.x * scale, y: dip.y * scale } : { x: 0, y: 0 }
}

/**
 * DIP 点 → 物理点（用光标所在屏的 scaleFactor）。
 * @param {{x:number,y:number}} cursor
 * @param {any} display
 * @returns {{x:number,y:number}|null}
 */
export function dipToScreenPoint(cursor, display) {
  if (!isPoint(cursor)) return null
  const scale = scaleOf(display)
  const origin = physicalOriginOf(display, scale)
  const dip = isPoint(display?.bounds) ? display.bounds : { x: 0, y: 0 }
  const x = origin.x + (cursor.x - dip.x) * scale
  const y = origin.y + (cursor.y - dip.y) * scale
  return finite(x) && finite(y) ? { x, y } : null
}

/**
 * DIP 矩形 → 物理矩形（用窗口所在屏的 scaleFactor）。
 * `win` 是 Electron 原生签名的第一位，纯换算用不到；保留它让调用方按原生顺序传参。
 * @param {any} win
 * @param {{x:number,y:number,width:number,height:number}} rect
 * @param {any} display
 * @returns {{x:number,y:number,width:number,height:number}|null}
 */
export function dipToScreenRect(win, rect, display) {
  if (!isRect(rect)) return null
  const scale = scaleOf(display)
  const origin = physicalOriginOf(display, scale)
  const dip = isPoint(display?.bounds) ? display.bounds : { x: 0, y: 0 }
  const x = origin.x + (rect.x - dip.x) * scale
  const y = origin.y + (rect.y - dip.y) * scale
  const width = rect.width * scale
  const height = rect.height * scale
  return [x, y, width, height].every(finite) ? { x, y, width, height } : null
}

/** 物理光标折回窗口逻辑坐标；dpr 优先，其次 CSS 视口，最后内容 DIP 尺寸。 */
function foldPhysical(cursorPhysical, contentPhysical, content, dpr, viewport) {
  const viewportWidth = viewport !== null && finite(viewport?.width) && viewport.width > 0 ? viewport.width : null
  const viewportHeight = viewport !== null && finite(viewport?.height) && viewport.height > 0 ? viewport.height : null
  const width = viewportWidth ?? content.width
  const height = viewportHeight ?? content.height
  const cssRect = { x: 0, y: 0, width, height }
  const result = finite(dpr) && dpr > 0
    ? translatePhysicalCursorDpr(cursorPhysical, contentPhysical, dpr)
    : translatePhysicalCursor(cursorPhysical, contentPhysical, cssRect)
  return { cursor: result.cursor, problem: result.problem, width, height }
}

/**
 * 纯函数：把 DIP 光标折成窗口内容的逻辑坐标，可直接和 hitShape 比较。
 * @param {{
 *   cursor: any,
 *   content: any,
 *   cursorDisplay: any,
 *   windowDisplay: any,
 *   dpr?: number|null,
 *   viewport?: any,
 * }} input
 * @returns {{cursor:{x:number,y:number}|null, problem:string, width:number, height:number}}
 */
export function windowLocalCursor({ cursor, content, cursorDisplay, windowDisplay, dpr = null, viewport = null }) {
  if (!isRect(content)) return { cursor: null, problem: 'invalid content rect', width: 0, height: 0 }
  const cursorPhysical = dipToScreenPoint(cursor, cursorDisplay)
  if (cursorPhysical === null) return { cursor: null, problem: 'invalid cursor dip point', width: 0, height: 0 }
  const contentPhysical = dipToScreenRect(null, content, windowDisplay)
  if (contentPhysical === null) return { cursor: null, problem: 'invalid content dip rect', width: 0, height: 0 }
  return foldPhysical(cursorPhysical, contentPhysical, content, dpr, viewport)
}

/**
 * 运行时换算：优先用 Electron 原生方法（光标按光标所在屏、内容矩形按窗口所在屏），
 * 环境没有这套方法时才退回纯函数。绑定 receiver 不能换成解构出来的裸函数。
 * @param {any} screenApi
 * @param {any} win
 * @param {any} cursor
 * @param {any} content
 * @param {number|null} dpr
 * @param {any} viewport
 */
function nativeWindowLocalCursor(screenApi, win, cursor, content, dpr, viewport) {
  if (typeof screenApi?.dipToScreenPoint !== 'function' || typeof screenApi?.dipToScreenRect !== 'function') {
    const cursorDisplay = typeof screenApi?.getDisplayNearestPoint === 'function' ? screenApi.getDisplayNearestPoint(cursor) : null
    const windowDisplay = typeof screenApi?.getDisplayMatching === 'function'
      ? screenApi.getDisplayMatching(win.getBounds()) : null
    return windowLocalCursor({ cursor, content, cursorDisplay, windowDisplay, dpr, viewport })
  }
  try {
    const cursorPhysical = screenApi.dipToScreenPoint(cursor)
    const contentPhysical = screenApi.dipToScreenRect(win, content)
    return foldPhysical(cursorPhysical, contentPhysical, content, dpr, viewport)
  } catch (error) {
    return { cursor: null, problem: 'screen conversion failed: ' + String(error), width: 0, height: 0 }
  }
}

/**
 * 光标是否落在窗口内 shape 上（shape 用窗口局部逻辑坐标）。
 * Windows 走物理换算；其它平台光标和窗口在同一 DIP 坐标系，保持原来的相减。
 * @param {{
 *   platform: string,
 *   screen: any,
 *   window: any,
 *   shape: any[],
 *   cursor?: any,
 *   dpr?: number|null,
 *   viewport?: any,
 * }} input
 * @returns {{hit:boolean, problem:string}}
 */
export function cursorHitsWindow({ platform, screen, window, shape, cursor = null, dpr = null, viewport = null }) {
  const bounds = window.getBounds()
  const point = cursor ?? screen.getCursorScreenPoint()
  if (platform !== 'win32') return { hit: pointerHitsShape(point, bounds, shape), problem: '' }
  const content = typeof window.getContentBounds === 'function' ? window.getContentBounds() : bounds
  const local = nativeWindowLocalCursor(screen, window, point, content, dpr, viewport)
  if (local.cursor === null) return { hit: false, problem: local.problem }
  const origin = { x: 0, y: 0, width: local.width, height: local.height }
  return { hit: pointerHitsShape(local.cursor, origin, shape), problem: '' }
}
