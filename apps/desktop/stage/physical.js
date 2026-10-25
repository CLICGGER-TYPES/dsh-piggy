// @ts-check
/**
 * Windows 舞台的物理像素几何。
 *
 * getBounds/getContentBounds 是「物理像素 / 窗口所在显示器（HMONITOR）的缩放」，
 * 而 setBounds 的 DIP 解释按 DIP 矩形最近的显示器换算：两者不对称。所以
 * 窗口只从物理并集出发（screenToDipRect(null, U)），校验只比物理矩形。
 * 显示器物理工作区必须用 screen.dipToScreenRect(null, workArea) 推：
 * root 实测副屏 Display.nativeOrigin 是 1024，实际物理原点是 1280，不能直接相乘。
 * @module dsh-piggy-desktop/stage/physical
 */
import { copyRect, geometryPayload, isRect } from './geometry.js'

/** @typedef {{x:number,y:number,width:number,height:number}} Rect */
/** @typedef {{id?:number,label?:string,bounds?:Rect,workArea:Rect,scaleFactor?:number}} DisplayLike */

// -0 会让 deepEqual/JSON 对照出现无关差异，统一成 0。
const round = value => Math.round(Number(value) || 0) + 0

/** @param {Rect} rect @param {number} factor */
export function scaleRect(rect, factor) {
  return { x: rect.x * factor, y: rect.y * factor, width: rect.width * factor, height: rect.height * factor }
}

/** @param {Rect} rect @param {number} amount @returns {Rect} */
export function expandRect(rect, amount) {
  return { x: rect.x - amount, y: rect.y - amount, width: rect.width + 2 * amount, height: rect.height + 2 * amount }
}

/** 两条矩形的四边都在 tolerance 物理像素内一致。 @param {Rect} a @param {Rect} b @param {number} [tolerance] */
export function rectsClose(a, b, tolerance = 1) {
  if (!isRect(a) || !isRect(b)) return false
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance
    && Math.abs(a.x + a.width - (b.x + b.width)) <= tolerance
    && Math.abs(a.y + a.height - (b.y + b.height)) <= tolerance
}

/** outer 是否完整包住 inner（含边界）。 @param {Rect} outer @param {Rect} inner */
export function coversRect(outer, inner) {
  if (!isRect(outer) || !isRect(inner)) return false
  return outer.x <= inner.x && outer.y <= inner.y
    && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height
}

/**
 * 使用 Electron 对完整工作区矩形的原生换算。空矩形的换算并不提供屏幕归属：
 * Windows VM 已记录到空矩形原点保持未缩放，而完整矩形返回正确物理范围。
 * @param {DisplayLike} display
 * @param {{dipToScreenRect: (hwnd:any, rect:Rect) => Rect}} screen
 * @returns {Rect|null}
 */
function physicalWorkAreaFor(display, screen) {
  const area = screen.dipToScreenRect(null, display.workArea)
  return isRect(area) ? area : null
}

/**
 * 每个显示器的两块工作区：Electron 报的 DIP 原值 + 实际物理矩形。
 * @param {DisplayLike[]} displays
 * @param {{dipToScreenRect: (hwnd: any, rect: Rect) => Rect}} screen
 */
export function displayRecords(displays, screen) {
  const records = []
  for (const display of Array.isArray(displays) ? displays : []) {
    if (!isRect(display?.workArea)) continue
    const physicalWorkArea = physicalWorkAreaFor(display, screen)
    if (!isRect(physicalWorkArea)) continue
    records.push({
      id: display.id,
      label: display.label,
      scaleFactor: Number(display.scaleFactor) || 1,
      bounds: isRect(display.bounds) ? copyRect(display.bounds) : undefined,
      workArea: copyRect(display.workArea),
      dipWorkArea: copyRect(display.workArea),
      physicalWorkArea: copyRect(physicalWorkArea),
    })
  }
  return records
}

/** @param {DisplayLike[]} displays @param {{dipToScreenRect: any}} screen @returns {Rect[]} */
export function physicalWorkAreas(displays, screen) {
  return displayRecords(displays, screen).map(record => record.physicalWorkArea)
}

/**
 * 物理工作区并集。每次从清单重算，不在旧 bounds 上累加。
 * @param {Rect[]} rects @returns {Rect|null}
 */
export function physicalUnion(rects) {
  const areas = (Array.isArray(rects) ? rects : []).filter(isRect)
  if (areas.length === 0) return null
  const x = Math.min(...areas.map(area => area.x))
  const y = Math.min(...areas.map(area => area.y))
  const right = Math.max(...areas.map(area => area.x + area.width))
  const bottom = Math.max(...areas.map(area => area.y + area.height))
  return { x: round(x), y: round(y), width: Math.max(1, round(right - x)), height: Math.max(1, round(bottom - y)) }
}

/**
 * 物理并集反推 setBounds 的 DIP。必须用 null 窗口（setBounds 自己就按 DIP 矩形
 * 最近的显示器换算）；预测包不住目标时按 1、2 物理像素外扩重试，不用大余量。
 * @param {Rect} target
 * @param {{screenToDipRect: (hwnd: any, rect: Rect) => Rect, dipToScreenRect: (hwnd: any, rect: Rect) => Rect}} screen
 * @returns {{dip:Rect, physical:Rect, pad:number}|null}
 */
export function dipForPhysicalUnion(target, screen) {
  let last = null
  for (const pad of [0, 1, 2]) {
    const dip = screen.screenToDipRect(null, expandRect(target, pad))
    const physical = screen.dipToScreenRect(null, dip)
    last = { dip, physical, pad }
    if (isRect(dip) && isRect(physical) && coversRect(physical, target)) return last
  }
  return last
}

/**
 * 物理并集 + setBounds 目标 + 成对的显示器记录（一次算齐，避免各算各的）。
 * @param {DisplayLike[]} displays
 * @param {{screenToDipRect: any, dipToScreenRect: any}} screen
 * @returns {{records:any[], union:Rect, dip:Rect, physical:Rect, pad:number}|null}
 */
export function physicalStagePlan(displays, screen) {
  const records = displayRecords(displays, screen)
  const union = physicalUnion(records.map(record => record.physicalWorkArea))
  if (union === null) return null
  const fit = dipForPhysicalUnion(union, screen)
  if (fit === null || !isRect(fit.dip)) return null
  return { records, union, dip: fit.dip, physical: fit.physical, pad: fit.pad }
}

/** 窗口矩形（物理像素）：Windows 上按 HMONITOR 缩放换算。 @param {any} win @param {any} screen */
export function windowPhysicalRect(win, screen) {
  return screen.dipToScreenRect(win, win.getBounds())
}

/**
 * 内容矩形（物理像素）。Windows 最小化后 getContentBounds() 会报 {-32000,-32000,0,0}，
 * 这不是可用几何：返回 null，调用方保留上一份有效几何，绝不把哨兵写进猪的家。
 * @param {any} win @param {any} screen
 * @returns {Rect|null}
 */
export function physicalContentRect(win, screen) {
  const rect = screen.dipToScreenRect(win, win.getContentBounds())
  return isRect(rect) ? rect : null
}

/**
 * 有效渲染缩放 s = 窗口基础缩放（物理内容宽 / DIP 内容宽）× 页面缩放。
 * 目前不改页面缩放，但先按契约乘上，后面开每屏缩放不用再动这里。
 * @param {any} win @param {Rect} content
 */
export function effectiveScale(win, content) {
  const bounds = win.getContentBounds()
  const base = isRect(content) && bounds.width > 0 ? content.width / bounds.width : 1
  const zoom = Number(win.webContents?.getZoomFactor?.()) || 1
  const scale = base * zoom
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

/**
 * canonical 页面几何：window/workAreas 都是「物理像素 / s」，workAreas 用绝对
 * 物理原点（不相对窗口）。space 给共享猪家的 DIP 换算用。
 * @param {{win:any, screen:any, plan:any, seq:number, interacting?:boolean, legacyPig?:{x:number,y:number}|null}} value
 */
export function physicalStageGeometry(value) {
  const content = physicalContentRect(value.win, value.screen)
  if (content === null) return null
  // 原生 setBounds 落地前，getContentBounds 仍可能报旧拓扑的矩形。它不能当页面几何：
  // 页面会按旧的 window/scale 重定基猪脚，等真正的内容矩形到了就回不去。
  // plan.physical 已经包含 <=2px 的换算外扩，所以用同一容差比较，避免 150% 下永远等不到。
  if (!rectsClose(content, value.plan.physical, 2)) return null
  const scale = effectiveScale(value.win, content)
  return geometryPayload({
    window: scaleRect(content, 1 / scale),
    workAreas: value.plan.records.map(record => scaleRect(record.physicalWorkArea, 1 / scale)),
    displays: value.plan.records,
    space: { scale, content, displays: value.plan.records },
    seq: value.seq,
    interacting: value.interacting,
    legacyPig: value.legacyPig,
  })
}
