// @ts-check
/**
 * Windows 混合 DPI 的命中换算（纯函数）。
 *
 * `getCursorScreenPoint()` 的 DIP 按「光标所在屏」的 scale 解释，
 * `stageWin.getBounds()/getContentBounds()` 的 DIP 按「窗口所在屏」的 scale 解释。
 * 两块屏 scale 不同时，两者相减没有意义。这里统一回到物理像素：
 * 光标用 `screen.dipToScreenPoint()`，窗口内容矩形用
 * `screen.dipToScreenRect(win, win.getContentBounds())`，再把物理点按
 * 「物理内容宽 / 内容逻辑宽」折回页面逻辑坐标，交给 pointerHitsShape(origin 0)。
 *
 * 只做数字校验和换算，不碰 Electron/窗口；调用方负责记录不可用的换算。
 * 换算不可用时返回 null，不做「看起来差不多」的回退。
 * @module dsh-piggy-desktop/stage/hit-physical
 */

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

/**
 * 把屏幕物理像素的光标点折回窗口内容的页面逻辑坐标。
 *
 * @param {any} cursorPhysical `screen.dipToScreenPoint(getCursorScreenPoint())`
 * @param {any} contentPhysical `screen.dipToScreenRect(win, win.getContentBounds())`
 * @param {any} contentSize `win.getContentBounds()`（页面逻辑尺寸）
 * @returns {{cursor:{x:number,y:number}|null,problem:string}}
 */
export function translatePhysicalCursor(cursorPhysical, contentPhysical, contentSize) {
  if (!isPoint(cursorPhysical)) return { cursor: null, problem: 'invalid cursor physical point' }
  if (!isRect(contentPhysical)) return { cursor: null, problem: 'invalid physical content rect' }
  if (!isRect(contentSize)) return { cursor: null, problem: 'invalid content size' }
  if (contentPhysical.width <= 0 || contentPhysical.height <= 0) {
    return { cursor: null, problem: 'empty physical content rect' }
  }
  if (contentSize.width <= 0 || contentSize.height <= 0) return { cursor: null, problem: 'empty content size' }
  const x = (cursorPhysical.x - contentPhysical.x) * (contentSize.width / contentPhysical.width)
  const y = (cursorPhysical.y - contentPhysical.y) * (contentSize.height / contentPhysical.height)
  if (!finite(x) || !finite(y)) return { cursor: null, problem: 'non-finite logical cursor' }
  return { cursor: { x, y }, problem: '' }
}

/**
 * 有页面 zoom 时：物理内容原点 + CSS 坐标 × 页面 dpr 就是物理光标，所以直接
 * `(cursorPhysical - contentPhysical.origin) / dpr` 得到 CSS 页坐标。这里不能用
 * getContentBounds() 的 DIP 宽高当比例：zoom 后 innerWidth 与它不同。
 *
 * @param {any} cursorPhysical
 * @param {any} contentPhysical `screen.dipToScreenRect(win, win.getContentBounds())`
 * @param {any} dpr 页面 devicePixelRatio（已由报告清洗）
 * @returns {{cursor:{x:number,y:number}|null,problem:string}}
 */
export function translatePhysicalCursorDpr(cursorPhysical, contentPhysical, dpr) {
  if (!isPoint(cursorPhysical)) return { cursor: null, problem: 'invalid cursor physical point' }
  if (!isRect(contentPhysical)) return { cursor: null, problem: 'invalid physical content rect' }
  if (contentPhysical.width <= 0 || contentPhysical.height <= 0) {
    return { cursor: null, problem: 'empty physical content rect' }
  }
  if (!finite(dpr) || dpr <= 0) return { cursor: null, problem: 'invalid page dpr' }
  const x = (cursorPhysical.x - contentPhysical.x) / dpr
  const y = (cursorPhysical.y - contentPhysical.y) / dpr
  if (!finite(x) || !finite(y)) return { cursor: null, problem: 'non-finite logical cursor' }
  return { cursor: { x, y }, problem: '' }
}
