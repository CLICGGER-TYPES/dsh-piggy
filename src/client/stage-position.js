// @ts-check
/**
 * 舞台位置换算（纯函数）：页面里的 right/bottom、猪的页面盒、屏幕坐标之间。
 *
 * 舞台直接改 host 的 right/bottom 时，游戏自己的 ctx.userRight/userBottom 必须一起更新，
 * 否则下一次 resize/菜单/轮询里的 clampPig() 会把猪弹回松手时的位置（A3）。
 * 这里只做算式；写回状态、夹取、存档由 stage-bridge 负责。
 * @module dsh-piggy/client/stage-position
 */

/** @typedef {{x:number,y:number,width:number,height:number}} Rect */
/** @typedef {{right:number,bottom:number}} Position */

import {
  canonicalFootFromPhysical, dipPointFromPhysical, displayForDipArea, displayForDipPoint,
  displayForPhysicalPoint, hasSpace, pairedDisplays, physicalFootForPig, physicalPointFromDip,
  rescaleGeometry, spaceScale, toCanonicalPoint, toPhysicalPoint,
} from './stage-space.js'

export { canonicalFootFromPhysical, physicalFootForPig }

const round = value => Math.round(Number(value) || 0)

export const STAGE_POSITION_MIGRATION_KEY = 'dsh-piggy:stage-position-v1'

/** 舞台 right/bottom 与换算结果差多少像素算「同一个位置」（存档只存整数）。 */
export const POSITION_SYNC_SLACK = 2

/**
 * Save the same screen foot that split desktop mode restores.
 * 物理几何下规范脚底先换回物理像素，再按所在显示器换成原来的 DIP 工作区 + 相对脚底；
 * 共享键里永远不写物理坐标。旧几何（没有 space）保持原来的 DIP 算法。
 */
export function desktopPositionForStage(pig, geometry) {
  if (!pig || !geometry?.window) return null
  const foot = { x: geometry.window.x + pig.x + pig.width / 2, y: geometry.window.y + pig.y + pig.height }
  if (hasSpace(geometry)) {
    const physical = toPhysicalPoint(foot, geometry)
    const display = displayForPhysicalPoint(physical, pairedDisplays(geometry))
    if (display === null) return null
    const dip = dipPointFromPhysical(physical, display)
    return {
      v: 3,
      area: { ...display.dipWorkArea },
      x: round(dip.x - display.dipWorkArea.x),
      y: round(dip.y - display.dipWorkArea.y),
    }
  }
  if (!Array.isArray(geometry.workAreas)) return null
  const area = nearestArea(foot, geometry.workAreas)
  if (!area) return null
  return { v: 3, area: { ...area }, x: round(foot.x - area.x), y: round(foot.y - area.y) }
}

/** Target pig box → host position, preserving the current pig-to-host inset. @param {Rect} pigBox @param {Rect} hostBox @param {{width:number,height:number}} windowSize @param {Rect} [currentPigBox] */
export function positionForPig(pigBox, hostBox, windowSize, currentPigBox = pigBox) {
  const rightInset = hostBox.x + hostBox.width - (currentPigBox.x + currentPigBox.width)
  const bottomInset = hostBox.y + hostBox.height - (currentPigBox.y + currentPigBox.height)
  return {
    right: round(windowSize.width - (pigBox.x + pigBox.width + rightInset)),
    bottom: round(windowSize.height - (pigBox.y + pigBox.height + bottomInset)),
  }
}

/**
 * 屏幕矩形 → 舞台 right/bottom；和当前值一致（±POSITION_SYNC_SLACK）时返回 null，
 * 调用方据此不做无谓的写回（否则每次进舞台都会挪 1px）。
 * @param {Rect} rect 猪左上角的屏幕坐标
 * @param {Rect} hostBox @param {Rect} pigBox @param {Rect} windowSize 舞台窗口矩形（含 x/y）
 * @param {Position|null} [current]
 */
export function positionForScreenRect(rect, hostBox, pigBox, windowSize, current = null) {
  if (!rect || !windowSize) return null
  const next = positionForPig(toPageRect(rect, windowSize), hostBox, windowSize, pigBox)
  if (current === null || current === undefined) return next
  const same = (a, b) => Math.abs(a - round(b)) <= POSITION_SYNC_SLACK
  return same(next.right, current.right) && same(next.bottom, current.bottom) ? null : next
}

/** right/bottom → 猪的页面盒（positionForPig 的逆）。 @param {Position} position @param {Rect} hostBox @param {Rect} pigBox @param {{width:number,height:number}} windowSize */
export function pigBoxForPosition(position, hostBox, pigBox, windowSize) {
  const hostX = windowSize.width - round(position.right) - hostBox.width
  const hostY = windowSize.height - round(position.bottom) - hostBox.height
  return {
    x: hostX + (pigBox.x - hostBox.x),
    y: hostY + (pigBox.y - hostBox.y),
    width: pigBox.width,
    height: pigBox.height,
  }
}

/**
 * 桌面版旧存档（localStorage 的 dsh-piggy:desktop-pig）→ 猪左上角的屏幕坐标。
 * v3 存的是相对所在工作区的脚底中心（x/y 是家的偏移）；v2 和更早存的是左上角。
 * @param {any} raw
 * @param {{width:number,height:number}} pigSize
 * @returns {Rect|null}
 */
export function savedPigTopLeft(raw, pigSize) {
  if (raw === null || typeof raw !== 'object') return null
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null
  const width = Number.isFinite(raw.w) ? Number(raw.w) : pigSize.width
  const height = Number.isFinite(raw.h) ? Number(raw.h) : pigSize.height
  if (raw.v === 3) {
    // area 为 null 时 x/y 是绝对屏幕脚底；有 area 时是相对它的偏移。两种都先还原成脚底。
    const origin = raw.area && Number.isFinite(raw.area.x) && Number.isFinite(raw.area.y) ? raw.area : { x: 0, y: 0 }
    return { x: round(origin.x + raw.x - width / 2), y: round(origin.y + raw.y - height), width: width, height: height }
  }
  return { x: round(raw.x), y: round(raw.y), width: width, height: height }
}

/**
 * 旧窗口文件里的猪左上角（window.json 的 pig 是屏幕坐标、没有宽高）→ 屏幕矩形。
 * @param {{x:number,y:number}} point
 * @param {{width:number,height:number}} pigSize
 */
export function legacyPigRect(point, pigSize) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  return { x: round(point.x), y: round(point.y), width: pigSize.width, height: pigSize.height }
}

function rectAtFoot(foot, pigSize) {
  return {
    x: round(foot.x - pigSize.width / 2),
    y: round(foot.y - pigSize.height),
    width: pigSize.width,
    height: pigSize.height,
  }
}

function savedArea(value) {
  if (!value) return null
  const area = { x: Number(value.x), y: Number(value.y), width: Number(value.width), height: Number(value.height) }
  return [area.x, area.y, area.width, area.height].every(Number.isFinite) ? area : null
}

/**
 * 共享存档（dsh-piggy:desktop-pig）→ 规范脚底。
 * v3 直接是相对 DIP 工作区的脚底，不拿现在 CSS 猪宽当 DIP 宽；
 * v2 / 旧窗口提示是 DIP 左上角，要补上猪脚（按所在显示器的 scaleFactor）再转成物理脚底。
 * 没有 space 时沿用旧存档行为。
 * @param {any} raw @param {{width:number,height:number}} pigSize @param {any} geometry
 */
export function savedHomeFoot(raw, pigSize, geometry) {
  if (raw === null || typeof raw !== 'object') return null
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null
  if (!hasSpace(geometry)) {
    const rect = savedPigTopLeft(raw, pigSize)
    return rect === null ? null : { x: rect.x + rect.width / 2, y: rect.y + rect.height }
  }
  const displays = pairedDisplays(geometry)
  if (raw.v === 3) {
    const area = savedArea(raw.area)
    const dipFoot = area === null ? { x: raw.x, y: raw.y } : { x: area.x + raw.x, y: area.y + raw.y }
    const display = area === null ? displayForDipPoint(dipFoot, displays) : displayForDipArea(area, displays)
    if (display === null) return null
    return toCanonicalPoint(physicalPointFromDip(dipFoot, display), geometry)
  }
  const dipTopLeft = { x: raw.x, y: raw.y }
  const display = displayForDipPoint(dipTopLeft, displays)
  if (display === null) return null
  const width = Number.isFinite(raw.w) ? Number(raw.w) : pigSize.width
  const height = Number.isFinite(raw.h) ? Number(raw.h) : pigSize.height
  const physicalTopLeft = physicalPointFromDip(dipTopLeft, display)
  const physicalFoot = {
    x: physicalTopLeft.x + width * display.scaleFactor / 2,
    y: physicalTopLeft.y + height * display.scaleFactor,
  }
  return toCanonicalPoint(physicalFoot, geometry)
}

/** 共享存档 → 舞台页面里的猪左上角矩形（旧行为 / 物理转换统一出口）。 */
export function savedHomeRect(raw, pigSize, geometry) {
  if (!hasSpace(geometry)) return savedPigTopLeft(raw, pigSize)
  const foot = savedHomeFoot(raw, pigSize, geometry)
  return foot === null ? null : rectAtFoot(foot, pigSize)
}

/** 旧窗口文件里的 DIP 左上角提示 → 规范脚底（第一步只认一次，由 bridge 记账）。 */
export function legacyHomeFoot(point, pigSize, geometry) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  if (!hasSpace(geometry)) {
    const rect = legacyPigRect(point, pigSize)
    return rect === null ? null : { x: rect.x + rect.width / 2, y: rect.y + rect.height }
  }
  const display = displayForDipPoint(point, pairedDisplays(geometry))
  if (display === null) return null
  const physicalTopLeft = physicalPointFromDip(point, display)
  const physicalFoot = {
    x: physicalTopLeft.x + pigSize.width * display.scaleFactor / 2,
    y: physicalTopLeft.y + pigSize.height * display.scaleFactor,
  }
  return toCanonicalPoint(physicalFoot, geometry)
}

/** 旧窗口 DIP 提示 → 舞台页面里的猪左上角矩形。 */
export function legacyHomeRect(point, pigSize, geometry) {
  if (!hasSpace(geometry)) return legacyPigRect(point, pigSize)
  const foot = legacyHomeFoot(point, pigSize, geometry)
  return foot === null ? null : rectAtFoot(foot, pigSize)
}

function scaleOf(geometry) {
  return spaceScale(geometry) ?? 1
}

/**
 * 几何更新/页面 DPR 变化时重定基：用旧几何把待应用脚底还原成物理脚底，再用新几何换回规范脚底。
 * 不从刚写过的共享存档重算（那会和拖动赛跑）。
 */
export function rebaseGeometryFoot(pendingFoot, pigBox, previous, next, skip = false) {
  if (skip === true || !previous?.window || !next?.window) return pendingFoot ?? null
  const sameWindow = previous.window.x === next.window.x && previous.window.y === next.window.y
    && previous.window.width === next.window.width && previous.window.height === next.window.height
  if (sameWindow && scaleOf(previous) === scaleOf(next)) return pendingFoot ?? null
  const physical = pendingFoot !== null && pendingFoot !== undefined
    ? toPhysicalPoint(pendingFoot, previous)
    : physicalFootForPig(pigBox, previous)
  return physical === null ? pendingFoot ?? null : canonicalFootFromPhysical(physical, next)
}

/**
 * 页面 viewport 会先于 geometry 更新而重排；用旧窗口尺寸和当前 right/bottom 还原旧几何下的
 * 页面猪盒，再按物理脚底重定基。否则 layoutBox 已经按新 viewport 算过，脚底会跟着 CSS 缩放。
 */
function pigBoxForGeometry(pigBox, hostBox, right, bottom, geometry) {
  if (!geometry?.window || !pigBox || !hostBox || !Number.isFinite(right) || !Number.isFinite(bottom)) return pigBox
  return {
    x: geometry.window.width - right - hostBox.width + (pigBox.x - hostBox.x),
    y: geometry.window.height - bottom - hostBox.height + (pigBox.y - hostBox.y),
    width: pigBox.width,
    height: pigBox.height,
  }
}

/** bridge 用的重定基：没有待应用脚底时，先按旧几何重建猪盒，再走纯物理换算。 */
export function rebaseStageFoot(pendingFoot, pigBox, hostBox, right, bottom, previous, next, skip = false) {
  const hasPending = pendingFoot !== null && pendingFoot !== undefined
  const oldPigBox = hasPending ? pigBox : pigBoxForGeometry(pigBox, hostBox, right, bottom, previous)
  return rebaseGeometryFoot(pendingFoot, oldPigBox, previous, next, skip)
}

/** 页面是否已经按这份几何重排；缩放/几何先到时，量到的猪盒还属于旧视口。 */
export function geometryMatchesViewport(geometry, width, height) {
  const win = geometry?.window
  return win !== undefined && win !== null
    && Math.abs(win.width - Number(width)) <= 2 && Math.abs(win.height - Number(height)) <= 2
}

/** 只因为页面有效 DPR 改变（例如后续按屏缩放）时重建几何；没变就原样返回。 */
export function rescaleGeometryForDpr(geometry, dpr) {
  if (!geometry?.space) return geometry
  const scale = Number(dpr)
  if (!(scale > 0) || Math.abs(scale - scaleOf(geometry)) <= 1e-6) return geometry
  return rescaleGeometry(geometry, scale)
}

/** 屏幕矩形 → 舞台页面矩形。 @param {Rect} rect @param {{x:number,y:number}} origin */
export function toPageRect(rect, origin) {
  return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height }
}

/**
 * 矩形是否被工作区并集完整覆盖（相邻屏缝算覆盖，错位屏之间的空洞不算）。
 * 和 apps/desktop/stage/geometry.js 同一算法；舞台页里没有那个模块的运行时副本。
 * @param {Rect} rect
 * @param {Rect[]} areas
 */
export function rectCoveredByAreas(rect, areas) {
  const list = Array.isArray(areas) ? areas.filter(area => area && area.width > 0 && area.height > 0) : []
  if (list.length === 0) return false
  const xs = [rect.x, ...list.map(area => area.x), ...list.map(area => area.x + area.width)]
    .filter(x => x > rect.x && x < rect.x + rect.width)
  const ys = [rect.y, ...list.map(area => area.y), ...list.map(area => area.y + area.height)]
    .filter(y => y > rect.y && y < rect.y + rect.height)
  const xCuts = [rect.x, ...Array.from(new Set(xs)).sort((a, b) => a - b), rect.x + rect.width]
  const yCuts = [rect.y, ...Array.from(new Set(ys)).sort((a, b) => a - b), rect.y + rect.height]
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
 * 猪所在（或最近）的屏幕工作区。舞台页的气泡尺寸上限、屏顶下置都该用这块，
 * 不是舞台整窗（多屏并集，可能跨好几块屏和屏间空洞）。
 * @param {Rect} pigBox 猪的页面盒
 * @param {{window?: Rect, workAreas?: Rect[]}} geometry
 */
export function workAreaForPig(pigBox, geometry) {
  if (!pigBox || !geometry || !geometry.window) return null
  const areas = Array.isArray(geometry.workAreas) ? geometry.workAreas : []
  if (areas.length === 0) return geometry.window
  const centre = { x: geometry.window.x + pigBox.x + pigBox.width / 2, y: geometry.window.y + pigBox.y + pigBox.height / 2 }
  return nearestArea(centre, areas) ?? geometry.window
}

/**
 * 面板可用区（舞台页面坐标）：猪所在那块屏的工作区。舞台整窗是所有屏的并集，
 * 拿它当「屏幕高度」会把菜单排到猪下方几百像素外的并集底边（2026-10-25 原生复现）。
 * 共享 layout 的 fitPanel 通过舞台适配器取这个矩形；网页版/分屏没有舞台适配器，不受影响。
 * @param {Rect} pigBox 猪的页面盒
 * @param {{window?: Rect, workAreas?: Rect[]}} geometry
 * @returns {Rect|null} 猪不在任何已知几何里时返回 null
 */
export function stagePanelArea(pigBox, geometry) {
  const origin = geometry?.window
  if (!origin) return null
  const area = workAreaForPig(pigBox, geometry)
  return area === null ? null : toPageRect(area, origin)
}

/** @param {{x:number,y:number}} point @param {Rect[]} areas */
export function nearestArea(point, areas) {
  let best = null
  let distance = Infinity
  for (const area of Array.isArray(areas) ? areas : []) {
    const dx = Math.max(area.x - point.x, 0, point.x - (area.x + area.width))
    const dy = Math.max(area.y - point.y, 0, point.y - (area.y + area.height))
    const next = dx * dx + dy * dy
    if (next < distance) { best = area; distance = next }
  }
  return best
}

/**
 * 让矩形完整落在某块工作区里；已经在并集里就原样返回偏移 0。
 * @param {Rect} rect
 * @param {Rect[]} areas
 * @returns {{offset:{x:number,y:number}, moved:boolean}}
 */
export function constrainRectToAreas(rect, areas) {
  const list = Array.isArray(areas) ? areas.filter(area => area && area.width > 0 && area.height > 0) : []
  if (list.length === 0 || rectCoveredByAreas(rect, list)) return { offset: { x: 0, y: 0 }, moved: false }
  const area = nearestArea({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, list)
  if (area === null) return { offset: { x: 0, y: 0 }, moved: false }
  const width = Math.min(rect.width, area.width)
  const height = Math.min(rect.height, area.height)
  const x = Math.min(Math.max(rect.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(rect.y, area.y), area.y + area.height - height)
  return { offset: { x: round(x - rect.x), y: round(y - rect.y) }, moved: x !== rect.x || y !== rect.y }
}

/** Keep an absolute screen foot when the stage work area changes. */
export function positionForScreenFoot(foot, currentPig, host, geometry) {
  if (!foot || !Number.isFinite(foot.x) || !Number.isFinite(foot.y) || !geometry?.window) return null
  const target = { x: foot.x - geometry.window.x - currentPig.width / 2, y: foot.y - geometry.window.y - currentPig.height, width: currentPig.width, height: currentPig.height }
  return positionForPig(target, host, geometry.window, currentPig)
}
