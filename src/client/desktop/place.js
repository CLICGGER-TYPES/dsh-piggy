// @ts-check
/**
 * 桌面版：窗口摆哪（从桌面程序 main.js 的 piggy:content 搬进游戏包）。
 *
 * 只有一个真相：猪的「家」= 猪脚底中心在屏幕上的点（home）。
 *   - 只有三件事能改它：用户拖动（松手时按猪真实落点重定）、散步（挪完按真实位置重定）、启动时读存档。
 *   - 开关面板、冒气泡、切页、换皮肤/换立绘大小、更新、预留面板范围变化，一律不改它。
 *   - 每一轮都按「家 − 猪现在在窗口里的位置」重新算窗口，不在上一轮的结果上累加：
 *     算错一次下一轮就自己纠正，误差攒不起来（2026-10-06 之前的版本靠「上一轮猪在哪」「原位」「目标点」
 *     几套记账互相推，任何一处差一点都会被继承，用户看到的就是越用越偏、拖完弹回去）。
 *   - 用脚底中心而不是左上角：立绘换大小（占位纸盒 → 真猪、73x58 ↔ 54x54）脚底中心不变，不用特殊处理。
 *
 * 猪窗口里没有面板（外壳 0.6.0 起面板单独一个窗口），所以猪永远在家。
 */
import { contentBoundsForPig, nearestArea } from './geometry.js'

const PIG_SCREEN_KEY = 'dsh-piggy:desktop-pig'
const STORE_VERSION = 3

/** @param {{x:number,y:number,width:number,height:number}} area @param {{x:number,y:number}} point */
function inside(area, point) {
  return point.x >= area.x && point.x < area.x + area.width && point.y >= area.y && point.y < area.y + area.height
}

/** 点落在哪块屏的工作区里；都不在就取最近的。 */
function areaOf(point, areas) {
  if (!Array.isArray(areas) || areas.length === 0) return null
  return areas.find(area => inside(area, point)) ?? nearestArea(point, areas)
}

export function createPlacement() {
  /** 猪脚底中心的屏幕点；还不知道就是 null。 */
  let home = null
  /** 存档里读出来、还没换算成家的位置（v2 旧格式存的是左上角，要等知道猪多大才能换算）。 */
  let pending = /** @type {any} */ (undefined)
  let stored = ''
  /** 这一轮窗口被工作区夹了多少（夹后 − 夹前），页面据此把内容在窗口里反向挪。 */
  let lastClamp = { dx: 0, dy: 0 }
  let lastPigSize = { width: 56, height: 56 }

  /** 读存档：v3 存脚底中心相对工作区的偏移；v2 存左上角（可能带猪大小）；更早的是绝对坐标。 */
  function readSaved() {
    let raw = null
    try { raw = JSON.parse(localStorage.getItem(PIG_SCREEN_KEY) || 'null') } catch { return null }
    if (raw === null || typeof raw !== 'object' || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null
    return raw
  }

  /** 存档 → 家（屏幕上的脚底中心）。显示器拔了就落到最近的屏上（用户 2026-10-06 确认这是预期行为）。 */
  function homeFromSaved(raw, pigSize, areas) {
    const list = Array.isArray(areas) ? areas : []
    const relative = raw.v === STORE_VERSION || raw.v === 2
    const same = relative && raw.area ? list.find(a => a.x === raw.area.x && a.y === raw.area.y && a.width === raw.area.width && a.height === raw.area.height) : null
    const origin = relative && raw.area ? (same ?? raw.area) : { x: 0, y: 0 }
    let point = { x: origin.x + raw.x, y: origin.y + raw.y }
    if (raw.v !== STORE_VERSION) {
      // v2 / 绝对坐标存的是左上角：按存下的猪大小（没有就用现在的）换成脚底中心。
      const w = Number.isFinite(raw.w) ? raw.w : pigSize.width
      const h = Number.isFinite(raw.h) ? raw.h : pigSize.height
      point = { x: point.x + w / 2, y: point.y + h }
    }
    if (relative && raw.area && same === null) {
      // 原来那块屏不在了：保持相对偏移，落到离它最近的屏上，再夹进那块屏。
      const area = areaOf(point, list)
      if (area !== null) point = clampInto(point, area)
    }
    return { x: Math.round(point.x), y: Math.round(point.y) }
  }

  function clampInto(point, area) {
    return {
      x: Math.max(area.x, Math.min(point.x, area.x + area.width - 1)),
      y: Math.max(area.y + 1, Math.min(point.y, area.y + area.height)),
    }
  }

  /** 家写进存档（只在家变了的时候写）。 */
  function persist(areas) {
    if (home === null) return
    const area = areaOf(home, areas)
    const payload = area === null
      ? { v: STORE_VERSION, area: null, x: home.x, y: home.y }
      : { v: STORE_VERSION, area: { x: area.x, y: area.y, width: area.width, height: area.height }, x: home.x - area.x, y: home.y - area.y }
    const key = JSON.stringify(payload)
    if (key === stored) return
    stored = key
    try { localStorage.setItem(PIG_SCREEN_KEY, key) } catch { /* 存不下就下次从默认位置开始 */ }
  }

  /**
   * 按家算这一轮窗口该在哪。
   * @param {any} report 页面这一轮量到的：width/height（内容=窗口大小）、pig（猪的大小）、
   *   pigWindow（换成这个窗口大小后猪在窗口里的左上角，含 shift）、pigNow（猪现在在当前窗口里的左上角）、
   *   shift（内容在窗口里被挪了多少）
   * @param {{x:number,y:number,width:number,height:number}} bounds 当前窗口
   * @param {Array<any>} areas 所有屏的工作区
   * @returns {{x:number,y:number,width:number,height:number}} 窗口应该在的位置和大小
   */
  function decide(report, bounds, areas) {
    const pigSize = report.pig.width > 0 && report.pig.height > 0 ? { width: report.pig.width, height: report.pig.height } : lastPigSize
    lastPigSize = pigSize
    if (pending === undefined) pending = readSaved()
    if (home === null) {
      home = pending !== null ? homeFromSaved(pending, pigSize, areas)
        : { x: Math.round(bounds.x + report.pigNow.x + pigSize.width / 2), y: Math.round(bounds.y + report.pigNow.y + pigSize.height) }
      pending = null
    }
    // 家不在任何一块屏上（拔了显示器、改了分辨率）：落到最近那块屏里，整只猪看得见。
    const list = Array.isArray(areas) ? areas : []
    if (list.length > 0 && !list.some(area => inside(area, home))) {
      const area = /** @type {any} */ (nearestArea(home, list))
      home = {
        x: Math.round(Math.max(area.x + pigSize.width / 2, Math.min(home.x, area.x + area.width - pigSize.width / 2))),
        y: Math.round(Math.max(area.y + pigSize.height, Math.min(home.y, area.y + area.height))),
      }
    }
    const shift = report.shift ?? { x: 0, y: 0 }
    // 按「内容没在窗口里挪过」的布局算窗口；被夹了多少交给页面去挪内容（只在收起时）。
    const pigPlain = { x: report.pigWindow.x - shift.x, y: report.pigWindow.y - shift.y, ...pigSize }
    const topLeft = { x: home.x - pigSize.width / 2, y: home.y - pigSize.height }
    const area = nearestArea(home, areas) ?? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    const next = contentBoundsForPig({ width: report.width, height: report.height, pigWindow: pigPlain }, topLeft)
    // 永远不请求会被系统拒绝的窗口矩形：系统（mutter 等）会把伸出工作区的窗口整块推回来，
    // 而页面不知道（用户 2026-10-06 日志里的 143px）。收起时页面会把内容反向挪回去，猪不动。
    const rawX = next.x
    const rawY = next.y
    next.x = Math.max(area.x, Math.min(next.x, area.x + area.width - next.width))
    next.y = Math.max(area.y, Math.min(next.y, area.y + area.height - next.height))
    lastClamp = { dx: next.x - rawX, dy: next.y - rawY }
    return next
  }

  /**
   * 猪被用户（拖动）或散步挪到了新地方：按真实落点重定家。
   * @param {{x:number,y:number}} windowPos 窗口现在的位置 @param {{x:number,y:number,width:number,height:number}} pigLocal 猪在窗口里的框
   */
  function rehome(windowPos, pigLocal, areas) {
    home = { x: Math.round(windowPos.x + pigLocal.x + pigLocal.width / 2), y: Math.round(windowPos.y + pigLocal.y + pigLocal.height) }
    pending = null
    persist(areas)
  }

  return {
    decide, rehome,
    /** 家写盘（启动换算完、显示器变了之后调一次）。 */
    persist,
    /** 猪的家（脚底中心）；还不知道是 null。 */
    home: () => home,
    /** 猪在家时左上角在哪（面板预留范围按它判断放不放得下）。 */
    homeTopLeft: () => home === null ? null : { x: home.x - lastPigSize.width / 2, y: home.y - lastPigSize.height },
    /** 上一轮算出来的窗口被工作区夹了多少。 */
    clamp: () => lastClamp,
    pigSize: () => lastPigSize,
  }
}
