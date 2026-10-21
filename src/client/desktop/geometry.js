// @ts-check
/**
 * 桌面版窗口几何（纯函数，从桌面程序 lib/window-geometry.js 搬进游戏包）。
 * 窗口摆哪、多大由游戏包算好，桌面程序只照做；以后调整这些规则只发游戏包。
 */

/** 内容外接框四周留白。 */
export const PAD = 16
/** 尺寸取整步长：动画抖几像素不算变化。 */
export const STEP = 4
/** 窗口最小尺寸。 */
export const MIN_WINDOW = Object.freeze({ width: 96, height: 96 })

/** 透明窗口可跨屏缝，只按整个桌面的外沿夹取；猪本体仍由各块工作区约束。 */
export function workAreaBounds(areas, fallback) {
  if (!Array.isArray(areas) || areas.length === 0) return fallback
  const x = Math.min(...areas.map(a => a.x)), y = Math.min(...areas.map(a => a.y))
  return { x, y, width: Math.max(...areas.map(a => a.x + a.width)) - x,
    height: Math.max(...areas.map(a => a.y + a.height)) - y }
}

const round = value => Math.round(Number(value) || 0)

/**
 * 内容变了：按「猪在屏幕上的目标位置」一次算出窗口位置和大小（透明留白可以越出工作区，
 * 由 place.js 夹回来、页面把内容反向挪）。
 * @param {{width:number,height:number,pigWindow:{x:number,y:number,width:number,height:number}}} content
 * @param {{x:number,y:number}} targetPigScreen
 */
export function contentBoundsForPig(content, targetPigScreen) {
  return {
    x: round(targetPigScreen.x) - round(content.pigWindow.x),
    y: round(targetPigScreen.y) - round(content.pigWindow.y),
    width: Math.max(MIN_WINDOW.width, round(content.width)),
    height: Math.max(MIN_WINDOW.height, round(content.height)),
  }
}

/**
 * 离某个点最近的屏幕工作区（点在哪块屏里就用哪块，都不在就取最近的）。
 * @param {{x:number,y:number}} point
 * @param {Array<{x:number,y:number,width:number,height:number}>} areas
 */
export function nearestArea(point, areas) {
  let best = null
  let bestDistance = Infinity
  for (const area of areas) {
    const dx = Math.max(area.x - point.x, 0, point.x - (area.x + area.width))
    const dy = Math.max(area.y - point.y, 0, point.y - (area.y + area.height))
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) { best = area; bestDistance = distance }
  }
  return best
}

/** 两个矩形每一项都差 tolerance 以内就算一样。 */
export function sameBounds(a, b, tolerance) {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance
    && Math.abs(a.width - b.width) <= tolerance && Math.abs(a.height - b.height) <= tolerance
}


/**
 * 窗口在哪块屏、那块屏什么缩放：Windows 分数缩放的问题只能靠这个在日志里看出来。
 * @param {any} info geometryOf() 的返回
 */
export function displayNote(info) {
  const list = info?.displays
  if (!Array.isArray(list) || list.length === 0) return null
  const win = info.window
  const hit = list.find(display => win.x >= display.workArea.x && win.x < display.workArea.x + display.workArea.width
    && win.y >= display.workArea.y && win.y < display.workArea.y + display.workArea.height)
  const one = hit ?? list[0]
  return { id: one.id, scale: one.scaleFactor, count: list.length }
}
