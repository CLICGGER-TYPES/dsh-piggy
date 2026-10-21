// @ts-check
/**
 * 桌面版窗口几何（D1）：窗口只框住「猪 + 面板 + 气泡」的外接矩形，四周留 16px。
 *
 * 纯函数，不碰 Electron —— 这样多显示器、贴边、超大窗口这些情况都能跑测试。
 * 约定：窗口的**右下角**是猪的锚点，内容变大就往左上长。
 */

/** 四周留白：内容外接矩形之外再留这么多。 */
export const WINDOW_PADDING = 16

/** 窗口最小尺寸：小猪 + 留白，别缩成一条线。 */
export const MIN_WINDOW = Object.freeze({ width: 96, height: 96 })

/** 取整步长：动画抖几像素不算变化（渲染层用同一个数）。 */
export const QUANTIZE_STEP = 4

const round = value => Math.round(Number(value) || 0)
/** 向下取整到 4px 一档：只有真的挪了 4px 才会换档，边界不会来回跳。 */
const even = value => Math.floor(round(value) / QUANTIZE_STEP) * QUANTIZE_STEP

/**
 * 把窗口夹进工作区。比工作区还大的窗口不硬塞，贴左上就好。
 * @param {{x: number, y: number, width: number, height: number}} bounds
 * @param {{x: number, y: number, width: number, height: number}} area
 */
export function clampBounds(bounds, area) {
  const width = Math.max(MIN_WINDOW.width, round(bounds.width))
  const height = Math.max(MIN_WINDOW.height, round(bounds.height))
  const maxX = area.x + area.width - width
  const maxY = area.y + area.height - height
  return {
    x: Math.max(area.x, Math.min(round(bounds.x), maxX)),
    y: Math.max(area.y, Math.min(round(bounds.y), maxY)),
    width,
    height,
  }
}

/**
 * 内容变了：**盯住猪贴着的那两条窗口边**，窗口往另一边长。
 *
 * 页面把猪钉在锚边上固定 16px（见 renderer/shell.js 的 pinPig），所以只要锚边在屏幕上
 * 不动，猪就一像素不动 —— 不需要推算猪的位置，也就没有「按上一次报告推算」带来的漂移。
 * 锚点由面板朝哪边开决定：面板在上 → 锚下边；面板在下 → 锚上边；横向同理。
 *
 * @param {{x: number, y: number, width: number, height: number}} windowBounds - 当前窗口
 * @param {{width: number, height: number, anchor?: {vertical?: string, horizontal?: string}}} content
 * @param {{x: number, y: number, width: number, height: number}} area
 */
export function contentBounds(windowBounds, content, area) {
  const width = Math.max(MIN_WINDOW.width, round(content.width))
  const height = Math.max(MIN_WINDOW.height, round(content.height))
  const vertical = content.anchor?.vertical === 'top' ? 'top' : 'bottom'
  const horizontal = content.anchor?.horizontal === 'left' ? 'left' : 'right'
  const right = round(windowBounds.x) + round(windowBounds.width)
  const bottom = round(windowBounds.y) + round(windowBounds.height)
  return clampBounds({
    x: horizontal === 'right' ? right - width : round(windowBounds.x),
    y: vertical === 'bottom' ? bottom - height : round(windowBounds.y),
    width,
    height,
  }, area)
}

/**
 * Resize and place the window in one operation around a fixed pig position.
 * A closed panel may let transparent padding cross the work-area edge. With an
 * open panel, the pig only shifts if neither side can contain that panel.
 * @param {{width:number,height:number,pigWindow:{x:number,y:number,width:number,height:number},panelOpen?:boolean,allowPanelOverflow?:boolean}} content
 * @param {{x:number,y:number}} targetPigScreen
 * @param {{x:number,y:number,width:number,height:number}} area
 */
export function contentBoundsForPig(content, targetPigScreen, area) {
  const width = Math.max(MIN_WINDOW.width, round(content.width))
  const height = Math.max(MIN_WINDOW.height, round(content.height))
  const pig = content.pigWindow
  function axis(target, pigOffset, pigSize, windowSize, areaStart, areaSize) {
    const desired = round(target) - round(pigOffset)
    if (!content.panelOpen) return desired
    if (content.allowPanelOverflow) {
      // Changing scale keeps the feet fixed; only the pig itself is clamped.
      // Small transparent/window-padding overflow is less disruptive than
      // moving the pig whenever its art grows near an edge.
      const minStart = round(areaStart) - round(pigOffset)
      const maxStart = round(areaStart + areaSize) - round(pigOffset) - round(pigSize)
      return Math.max(minStart, Math.min(desired, maxStart))
    }
    const before = round(pigOffset)
    const after = windowSize - before - round(pigSize)
    const availableBefore = round(target) - round(areaStart)
    const availableAfter = round(areaStart + areaSize - target - pigSize)
    const chosenFits = availableBefore >= before && availableAfter >= after
    const otherFits = availableBefore >= after && availableAfter >= before
    if (chosenFits || otherFits) return desired
    const lastStart = round(areaStart + areaSize - windowSize)
    return Math.max(round(areaStart), Math.min(desired, lastStart))
  }
  return {
    x: axis(targetPigScreen.x, pig.x, pig.width, width, area.x, area.width),
    y: axis(targetPigScreen.y, pig.y, pig.height, height, area.y, area.height),
    width,
    height,
  }
}

/** Keep the pig's bottom center on the same screen pixel when its art grows. */
export function resizedPigScreenPoint(point, before, after) {
  return {
    x: round(point.x + (before.width - after.width) / 2),
    y: round(point.y + before.height - after.height),
  }
}

/**
 * 拖动：按屏幕增量平移，夹进当前那块屏的工作区。
 * @param {{x: number, y: number, width: number, height: number}} windowBounds
 * @param {number} dx
 * @param {number} dy
 * @param {{x: number, y: number, width: number, height: number}} area
 */
export function movedBounds(windowBounds, dx, dy, area) {
  return clampBounds({
    x: round(windowBounds.x) + round(dx),
    y: round(windowBounds.y) + round(dy),
    width: round(windowBounds.width),
    height: round(windowBounds.height),
  }, area)
}

/** During a drag the window may straddle monitors; clamp to the virtual desktop instead of the current screen. */
export function moveAcrossDisplays(windowBounds, dx, dy, areas) {
  if (!Array.isArray(areas) || areas.length === 0) return windowBounds
  const moved = movedBounds(windowBounds, dx, dy, unionOf(areas))
  // 并集外接矩形在 L 形/错位排列下包含「不属于任何屏」的死角：窗口一半以上都不在屏上就
  // 拉回重叠最多的那块。散步和旧游戏包走这条，别让猪走到看不见的地方。
  let best = null
  let bestOverlap = 0
  for (const area of areas) {
    const overlap = overlapArea(moved, area)
    if (overlap > bestOverlap) { best = area; bestOverlap = overlap }
  }
  if (bestOverlap * 2 >= moved.width * moved.height) return moved
  // 一个屏都不沾（L 形排列的死角）时 best 会是 null：按离窗口中心最近的屏拉回去。
  const center = { x: moved.x + moved.width / 2, y: moved.y + moved.height / 2 }
  return clampBounds(moved, best ?? nearestAreaTo(center, areas))
}

/**
 * A desktop drag is always measured from the pointer-down sample. Clamping may
 * hold the pig at an edge, but cannot consume movement and skew the next frame.
 * The panel and transparent padding may leave the work area; only the pig is
 * constrained to the display currently under the pointer.
 * @param {{x:number,y:number,width:number,height:number}} startBounds
 * @param {{x:number,y:number}} startCursor
 * @param {{x:number,y:number}} cursor
 * @param {{x:number,y:number,width:number,height:number}} pigWindow
 * @param {{x:number,y:number,width:number,height:number}} area
 */
export function absoluteDragBounds(startBounds, startCursor, cursor, pigWindow, area) {
  if (area === null || area === undefined) {
    return {
      x: round(startBounds.x + cursor.x - startCursor.x),
      y: round(startBounds.y + cursor.y - startCursor.y),
      width: round(startBounds.width),
      height: round(startBounds.height),
    }
  }
  const width = round(startBounds.width)
  const height = round(startBounds.height)
  const pigX = round(pigWindow.x)
  const pigY = round(pigWindow.y)
  const pigWidth = Math.max(1, round(pigWindow.width))
  const pigHeight = Math.max(1, round(pigWindow.height))
  const minX = round(area.x) - pigX
  const minY = round(area.y) - pigY
  const maxX = round(area.x + area.width) - pigX - pigWidth
  const maxY = round(area.y + area.height) - pigY - pigHeight
  const wantedX = round(startBounds.x + cursor.x - startCursor.x)
  const wantedY = round(startBounds.y + cursor.y - startCursor.y)
  return {
    x: Math.max(minX, Math.min(wantedX, maxX)),
    y: Math.max(minY, Math.min(wantedY, maxY)),
    width,
    height,
  }
}

/** 猪的框和一块工作区重叠多少面积（像素²）。 */
function overlapArea(box, area) {
  const width = Math.max(0, Math.min(box.x + box.width, area.x + area.width) - Math.max(box.x, area.x))
  const height = Math.max(0, Math.min(box.y + box.height, area.y + area.height) - Math.max(box.y, area.y))
  return width * height
}

/** 离某个点最近的屏（点在里面距离为 0）。 */
function nearestAreaTo(point, areas) {
  let best = areas[0]
  let bestDistance = Infinity
  for (const area of areas) {
    const dx = Math.max(area.x - point.x, 0, point.x - (area.x + area.width))
    const dy = Math.max(area.y - point.y, 0, point.y - (area.y + area.height))
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) { best = area; bestDistance = distance }
  }
  return best
}

/** 所有工作区的并集外接矩形。 */
function unionOf(areas) {
  return {
    x: Math.min(...areas.map(area => area.x)),
    y: Math.min(...areas.map(area => area.y)),
    width: Math.max(...areas.map(area => area.x + area.width)) - Math.min(...areas.map(area => area.x)),
    height: Math.max(...areas.map(area => area.y + area.height)) - Math.min(...areas.map(area => area.y)),
  }
}

/** 拖动中的透明窗口可跨屏缝，只在整个桌面的外沿夹取，避免切屏时整窗瞬移。 */
export function desktopViewportBounds(wanted, areas) {
  if (!Array.isArray(areas) || areas.length === 0) return wanted
  return clampBounds(wanted, unionOf(areas))
}

/**
 * 拖动：按住时记下猪的屏幕位置和鼠标位置，之后猪 = 起点 + 鼠标位移。
 * 用**当前**窗口大小和猪在窗口里的**当前**位置反推窗口原点 —— 拖动中窗口可能因为
 * 冒气泡、换页改了大小，按起始窗口算会把大小改回去，窗口就一抽一抽的。
 *
 * 夹取按**屏幕集合**算，不按「鼠标现在在哪块屏」：
 *   - 先按所有工作区的并集外接矩形夹位置，跨屏缝、半上半下都放行；
 *   - 再要求猪至少一半落在某块屏上；不够（L 形排列的死角）才整只拉进最近的那块屏。
 * 旧做法要求整只猪落在鼠标所在那块屏里，鼠标一过缝就把猪整只弹回去
 * （2026-10-06 实测模拟：上下屏缝上鼠标移 10px，猪弹 86px）。
 *
 * @param {{x:number,y:number,width:number,height:number}} bounds 当前窗口
 * @param {{x:number,y:number,width:number,height:number}} pigWindow 猪在窗口里的位置和大小
 * @param {{x:number,y:number}} startPigScreen 按下时猪的屏幕位置
 * @param {{x:number,y:number}} startCursor
 * @param {{x:number,y:number}} cursor
 * @param {Array<{x:number,y:number,width:number,height:number}>} areas 所有屏的工作区
 */
export function dragPigBounds(bounds, pigWindow, startPigScreen, startCursor, cursor, areas) {
  const width = round(bounds.width)
  const height = round(bounds.height)
  const startBounds = {
    x: round(startPigScreen.x) - round(pigWindow.x),
    y: round(startPigScreen.y) - round(pigWindow.y),
    width,
    height,
  }
  const list = Array.isArray(areas) && areas.length > 0 ? areas : null
  if (list === null) return absoluteDragBounds(startBounds, startCursor, cursor, pigWindow, null)
  const pigX = round(pigWindow.x)
  const pigY = round(pigWindow.y)
  const pigWidth = Math.max(1, round(pigWindow.width))
  const pigHeight = Math.max(1, round(pigWindow.height))
  const union = unionOf(list)
  const wantedX = round(startBounds.x + cursor.x - startCursor.x)
  const wantedY = round(startBounds.y + cursor.y - startCursor.y)
  const x = Math.max(round(union.x) - pigX, Math.min(wantedX, round(union.x + union.width) - pigX - pigWidth))
  const y = Math.max(round(union.y) - pigY, Math.min(wantedY, round(union.y + union.height) - pigY - pigHeight))
  const pig = { x: x + pigX, y: y + pigY, width: pigWidth, height: pigHeight }
  // 一半以上还看得见就放行（跨缝时就是这种）；掉进 L 形排列的死角才拉回整块屏。
  let best = null
  let bestOverlap = 0
  for (const area of list) {
    const overlap = overlapArea(pig, area)
    if (overlap > bestOverlap) { best = area; bestOverlap = overlap }
  }
  if (best !== null && bestOverlap * 2 >= pigWidth * pigHeight) return { x, y, width, height }
  if (best === null) return { x, y, width, height }
  return absoluteDragBounds(startBounds, startCursor, cursor, pigWindow, best)
}

/** 收敛容差：猪的屏幕位置差这么点就不管了。 */
export const ANCHOR_TOLERANCE = 1

/**
 * 第二步（收敛）：窗口大小已经改好，再照页面量到的**猪在窗口坐标里的真实位置**
 * 把窗口平移一次，让猪的屏幕坐标和「展开前」一致。
 *
 * shell.js 报的 `pig` 是相对内容框原点的，而面板换方向时最左/最上的框会换人
 * （HUD、面板、猪轮流当），那个原点差值就是残余的十几、二十几像素。
 * 直接用 `pigWindow`（layoutBox(.dp-pig)，不减内容原点）就没有这个问题。
 *
 * @param {{x: number, y: number, width: number, height: number}} windowBounds - 已经改好大小的窗口
 * @param {{x: number, y: number}} pigWindow - 猪在窗口坐标里的位置（页面量的）
 * @param {{x: number, y: number}} targetPigScreen - 展开/收起前记下的猪屏幕坐标
 * @param {{x: number, y: number, width: number, height: number}} area
 * @returns {{x: number, y: number, width: number, height: number}|null} 要平移就返回新 bounds
 */
export function anchorCorrection(windowBounds, pigWindow, targetPigScreen, area) {
  const nowX = round(windowBounds.x) + round(pigWindow.x)
  const nowY = round(windowBounds.y) + round(pigWindow.y)
  const dx = nowX - round(targetPigScreen.x)
  const dy = nowY - round(targetPigScreen.y)
  if (Math.abs(dx) <= ANCHOR_TOLERANCE && Math.abs(dy) <= ANCHOR_TOLERANCE) return null
  return clampBounds({
    x: round(windowBounds.x) - dx,
    y: round(windowBounds.y) - dy,
    width: round(windowBounds.width),
    height: round(windowBounds.height),
  }, area)
}

/** 窗口的右下角：猪停在这儿。 */
export function anchorPoint(bounds) {
  return { x: round(bounds.x) + round(bounds.width), y: round(bounds.y) + round(bounds.height) }
}

/** 内容框（含留白）换算成窗口坐标下的可点区域。 */
export function shapeRects(content, boxes) {
  const left = round(content.x) - WINDOW_PADDING
  const top = round(content.y) - WINDOW_PADDING
  return boxes.map(box => ({
    x: Math.max(0, even(box.x - left)),
    y: Math.max(0, even(box.y - top)),
    width: Math.max(0, even(box.width)),
    height: Math.max(0, even(box.height)),
  }))
}

/** 变化判断用的 key：4px 一档，动画级抖动落在同一档里。 */
export function quantizeKey(box) {
  return [even(box.x), even(box.y), even(box.width), even(box.height)].join(',')
}
