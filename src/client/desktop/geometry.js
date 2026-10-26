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

/**
 * CSS 用 `transform:translate(-50%,-50%)` 居中在锚点上的元素，画出来的盒子。
 *
 * 百分比 translate 相对元素自己的边框盒，所以画出来的盒子就是布局盒往左上挪半格。
 * `offsetLeft/offsetTop/offsetWidth/offsetHeight` 都不认 transform，直接用布局盒量出来的
 * 矩形会停在锚点上（装扮点位就是帽心），比画出来的 emoji 低半个字号。
 * 纯布局换算：动画只改 transform，这里一个 rect 都不读。
 * @param {{x:number,y:number,width:number,height:number}} box
 */
export function centeredBox(box) {
  const width = Number(box.width) || 0
  const height = Number(box.height) || 0
  return {
    x: (Number(box.x) || 0) - width / 2,
    y: (Number(box.y) || 0) - height / 2,
    width,
    height,
  }
}

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

// 对完整身体覆盖的每一条工作区带取交集；相接的屏幕先合并，再留立绘边距。
// 因此内侧屏缝没有墙，错位屏幕之间的空白仍是墙。
function merged(ranges) {
  const result = []
  for (const range of ranges.sort((a, b) => a[0] - b[0])) {
    const last = result[result.length - 1]
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else result.push([...range])
  }
  return result
}

function intersect(a, b) {
  return a.flatMap(one => b.map(two => [Math.max(one[0], two[0]), Math.min(one[1], two[1])]))
    .filter(range => range[0] <= range[1])
}

export function drawingCorridor(areas, horizontal, from, to, before, after, position) {
  const axis = horizontal ? 'y' : 'x'
  const size = horizontal ? 'height' : 'width'
  const other = horizontal ? 'x' : 'y'
  const otherSize = horizontal ? 'width' : 'height'
  const cuts = [from, to, ...areas.flatMap(a => [a[axis], a[axis] + a[size]])
    .filter(v => v > from && v < to)].sort((a, b) => a - b)
  let ranges = [[-Infinity, Infinity]]
  for (let i = 1; i < cuts.length; i++) {
    const mid = (cuts[i - 1] + cuts[i]) / 2
    const band = merged(areas.filter(a => mid >= a[axis] && mid <= a[axis] + a[size])
      .map(a => [a[other], a[other] + a[otherSize]]))
    ranges = intersect(ranges, band)
  }
  if (ranges.length === 0) {
    const nearest = areas.slice().sort((a, b) =>
      Math.abs(position - (a[other] + a[otherSize] / 2)) - Math.abs(position - (b[other] + b[otherSize] / 2)))[0]
    ranges = [[nearest[other], nearest[other] + nearest[otherSize]]]
  }
  const allowed = ranges.map(r => {
    const min = r[0] + before, max = r[1] - after
    return min <= max ? [min, max] : [(min + max) / 2, (min + max) / 2]
  })
  return allowed.find(r => position >= r[0] - 0.00001 && position <= r[1] + 0.00001)
    ?? allowed.sort((a, b) => Math.abs(Math.max(a[0], Math.min(position, a[1])) - position) - Math.abs(Math.max(b[0], Math.min(position, b[1])) - position))[0]
}
