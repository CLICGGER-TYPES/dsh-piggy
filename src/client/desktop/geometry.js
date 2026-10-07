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
