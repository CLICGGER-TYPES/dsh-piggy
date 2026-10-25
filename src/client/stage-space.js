// @ts-check
/**
 * 物理像素与舞台规范单位（CSS px）之间的换算（纯函数）。
 *
 * 主进程按共享契约发 geometry：
 *   window / workAreas 已经是规范单位（物理像素 / 有效渲染 DPR s）；
 *   space = { scale:s, content:物理内容矩形, displays:[{id,scaleFactor,dipWorkArea,physicalWorkArea}] }。
 * 共享存档 dsh-piggy:desktop-pig 仍是原来的 display DIP 工作区 + 相对 DIP 脚底，
 * 所以舞台写回/读取都要按显示器 pairs 转一次，不把物理坐标写进共享键。
 * @module dsh-piggy/client/stage-space
 */

/** @typedef {{x:number,y:number,width:number,height:number}} Rect */
/** @typedef {{x:number,y:number}} Point */
/** @typedef {{id?:any,scaleFactor:number,dipWorkArea:Rect,physicalWorkArea:Rect}} PairedDisplay */

function rectOf(value) {
  if (!value) return null
  const x = Number(value.x)
  const y = Number(value.y)
  const width = Number(value.width)
  const height = Number(value.height)
  return [x, y, width, height].every(Number.isFinite) ? { x, y, width, height } : null
}

function pointOf(value) {
  if (!value) return null
  const x = Number(value.x)
  const y = Number(value.y)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function sameRect(a, b) {
  return Math.abs(a.x - b.x) <= 1e-6 && Math.abs(a.y - b.y) <= 1e-6
    && Math.abs(a.width - b.width) <= 1e-6 && Math.abs(a.height - b.height) <= 1e-6
}

function pointRectDistance(point, area) {
  const dx = Math.max(area.x - point.x, 0, point.x - (area.x + area.width))
  const dy = Math.max(area.y - point.y, 0, point.y - (area.y + area.height))
  return dx * dx + dy * dy
}

function rectDistance(a, b) {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0)
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0)
  return dx * dx + dy * dy
}

function nearest(list, distance) {
  let best = null
  let bestDistance = Infinity
  for (const item of list) {
    const next = distance(item)
    if (next < bestDistance) { best = item; bestDistance = next }
  }
  return best
}

/** geometry.space.scale（有效渲染 DPR），没有或不合法时为 null。 */
export function spaceScale(geometry) {
  const scale = Number(geometry?.space?.scale)
  return Number.isFinite(scale) && scale > 0 ? scale : null
}

/** 带完整物理/ DIP 显示器对的 space 几何。 */
export function pairedDisplays(geometry) {
  const list = Array.isArray(geometry?.space?.displays) ? geometry.space.displays : []
  /** @type {PairedDisplay[]} */
  const paired = []
  for (const item of list) {
    const scaleFactor = Number(item?.scaleFactor)
    const dipWorkArea = rectOf(item?.dipWorkArea)
    const physicalWorkArea = rectOf(item?.physicalWorkArea)
    if (!(scaleFactor > 0) || dipWorkArea === null || physicalWorkArea === null) continue
    paired.push({ id: item.id, scaleFactor, dipWorkArea, physicalWorkArea })
  }
  return paired
}

/** 是否使用物理规范几何（纯 DIP/旧几何仍返回 false，行为不变）。 */
export function hasSpace(geometry) {
  return spaceScale(geometry) !== null && pairedDisplays(geometry).length > 0
}

/** 规范屏幕点 → 物理像素点；没有 space 时就是原来的 DIP 点。 */
export function toPhysicalPoint(value, geometry) {
  const point = pointOf(value)
  if (point === null) return null
  const scale = spaceScale(geometry)
  return scale === null ? point : { x: point.x * scale, y: point.y * scale }
}

/** 物理像素点 → 规范屏幕点；没有 space 时就是原来的 DIP 点。 */
export function toCanonicalPoint(value, geometry) {
  const point = pointOf(value)
  if (point === null) return null
  const scale = spaceScale(geometry)
  return scale === null ? point : { x: point.x / scale, y: point.y / scale }
}

/** 猪页面盒（规范单位）的脚底中心（规范屏幕坐标）。 */
export function canonicalFootForPig(pigBox, geometry) {
  const box = rectOf(pigBox)
  const win = rectOf(geometry?.window)
  if (box === null || win === null) return null
  return { x: win.x + box.x + box.width / 2, y: win.y + box.y + box.height }
}

/** 猪页面盒的脚底中心，换成物理像素。 */
export function physicalFootForPig(pigBox, geometry) {
  const foot = canonicalFootForPig(pigBox, geometry)
  return foot === null ? null : toPhysicalPoint(foot, geometry)
}

/** 物理脚底 → 规范脚底。 */
export function canonicalFootFromPhysical(value, geometry) {
  return toCanonicalPoint(value, geometry)
}

/** 物理脚底落在哪块屏；不在任何屏里就取最近的一块。 */
export function displayForPhysicalPoint(value, displays) {
  const point = pointOf(value)
  const list = Array.isArray(displays) ? displays : []
  if (point === null || list.length === 0) return null
  const inside = list.find(display => point.x >= display.physicalWorkArea.x
    && point.x <= display.physicalWorkArea.x + display.physicalWorkArea.width
    && point.y >= display.physicalWorkArea.y
    && point.y <= display.physicalWorkArea.y + display.physicalWorkArea.height)
  return inside ?? nearest(list, display => pointRectDistance(point, display.physicalWorkArea))
}

/** v3 存档里的 DIP 工作区 → 对应的显示器；先精确匹配，旧屏不在了就取最近的 DIP 工作区。 */
export function displayForDipArea(value, displays) {
  const area = rectOf(value)
  const list = Array.isArray(displays) ? displays : []
  if (area === null || list.length === 0) return null
  const exact = list.find(display => sameRect(display.dipWorkArea, area))
  return exact ?? nearest(list, display => rectDistance(area, display.dipWorkArea))
}

/** DIP 点落在哪块屏的 DIP 工作区；都不在就取最近的一块。 */
export function displayForDipPoint(value, displays) {
  const point = pointOf(value)
  const list = Array.isArray(displays) ? displays : []
  if (point === null || list.length === 0) return null
  const inside = list.find(display => point.x >= display.dipWorkArea.x
    && point.x <= display.dipWorkArea.x + display.dipWorkArea.width
    && point.y >= display.dipWorkArea.y
    && point.y <= display.dipWorkArea.y + display.dipWorkArea.height)
  return inside ?? nearest(list, display => pointRectDistance(point, display.dipWorkArea))
}

/** 显示器 DIP 点 → 该屏物理点（以配对的工作区原点为基准，负原点也正确）。 */
export function physicalPointFromDip(value, display) {
  const point = pointOf(value)
  if (point === null || !display) return null
  return {
    x: display.physicalWorkArea.x + (point.x - display.dipWorkArea.x) * display.scaleFactor,
    y: display.physicalWorkArea.y + (point.y - display.dipWorkArea.y) * display.scaleFactor,
  }
}

/** 物理点 → 该屏 DIP 点。 */
export function dipPointFromPhysical(value, display) {
  const point = pointOf(value)
  if (point === null || !display) return null
  return {
    x: display.dipWorkArea.x + (point.x - display.physicalWorkArea.x) / display.scaleFactor,
    y: display.dipWorkArea.y + (point.y - display.physicalWorkArea.y) / display.scaleFactor,
  }
}

/**
 * 只改有效 DPR（例如页面缩放）时，用物理内容矩形重建规范 window / workAreas。
 * 物理内容没变，所以猪的物理脚底可以保持不动。
 */
export function rescaleGeometry(geometry, scaleValue) {
  const scale = Number(scaleValue)
  const oldScale = spaceScale(geometry)
  const displays = pairedDisplays(geometry)
  const win = rectOf(geometry?.window)
  if (!(scale > 0) || oldScale === null || displays.length === 0 || win === null) return geometry
  const content = rectOf(geometry?.space?.content)
    ?? { x: win.x * oldScale, y: win.y * oldScale, width: win.width * oldScale, height: win.height * oldScale }
  const div = area => ({ x: area.x / scale, y: area.y / scale, width: area.width / scale, height: area.height / scale })
  return {
    ...geometry,
    window: div(content),
    workAreas: displays.map(display => div(display.physicalWorkArea)),
    space: { ...geometry.space, scale },
  }
}
