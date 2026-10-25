// @ts-check
/**
 * 舞台页缩放：按猪所在显示器设页面 zoom，整块舞台仍然只有一个窗口、一个 renderer。
 *
 * 舞台是一扇跨屏透明窗，窗口的 DSF 由它碰到的显示器决定：
 *   baseDPR = 物理内容宽 / getContentBounds() 逻辑宽
 * 让 56 CSS px 的猪在显示器上变成 display.scaleFactor 对应的物理大小，只需把页面
 * zoom 设成 display.scaleFactor / baseDPR。之后页面 devicePixelRatio 就是该显示器
 * 的 scaleFactor，Chromium 按这个倍率栅格化（不像 CSS transform 先栅格再放大，会糊）；
 * CSS 布局仍然用 CSS px，src/client 现有的 offsetLeft/offsetWidth 测量不用改。
 *
 * 三条硬约束：
 *   1. 先 setZoomMode('isolated')。舞台和扩展大窗都是同一个 origin，默认 same-origin
 *      缩放策略会把舞台 zoom 传到扩展窗；隔离模式不可用时宁可不缩放。
 *   2. 只在 Windows 缩放（Linux/macOS 保持原样），并且只在页面报 interacting:false
 *      时调；拖动中的 dpr 变化会让猪在指针下面漂移。
 *   3. 每次变化先落 setZoomFactor，再回调 onChange（root 用它 push 新 geometry），
 *      保证主进程/页面读到的是同一代 zoomFactor 和 dpr。
 *
 * 依赖注入：不 import electron，测试用假 ipcMain/screen/window。
 * @module dsh-piggy-desktop/stage/ui-scale
 */
import { dipForPhysicalUnion, displayRecords, physicalUnion, rectsClose } from './physical.js'

/** Chromium 能显示的缩放范围（setZoomFactor 自己也会夹，这里先夹一次好记日志）。 */
const ZOOM_MIN = 0.25
const ZOOM_MAX = 5
/** 0.5% 以内视为同一个 zoom：重复上报/浮点误差不再写，避免 resize→geometry 自激。 */
const ZOOM_EPSILON = 0.005
/** 页面 dpr 的合理范围；越界说明报告损坏，不当成真的显示器倍率。 */
const DPR_MIN = 0.25
const DPR_MAX = 8
/** CSS 视口的合理上限，挡住把 1e9 当宽高的坏消息。 */
const VIEWPORT_MAX = 20000
/** 页面报告/原生内容允许的换算误差；和 bounds 校验一样只容纳舍入与 <=2px 外扩。 */
const CONTENT_TOLERANCE = 2

/** @param {any} value */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/** @param {any} value */
function isRect(value) {
  return value !== null && typeof value === 'object'
    && isFiniteNumber(value.x) && isFiniteNumber(value.y)
    && isFiniteNumber(value.width) && isFiniteNumber(value.height)
    && value.width > 0 && value.height > 0
}

/**
 * 只收页面确实量到的 dpr / CSS 视口 / 猪的 CSS 矩形；坏消息整条丢掉。
 * @param {any} payload
 */
function readReport(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null
  const dpr = payload.dpr
  const viewport = payload.viewport
  const pig = payload.visible?.pig
  if (!isFiniteNumber(dpr) || dpr < DPR_MIN || dpr > DPR_MAX) return null
  if (viewport === null || typeof viewport !== 'object') return null
  if (!isFiniteNumber(viewport.width) || !isFiniteNumber(viewport.height)) return null
  if (viewport.width <= 0 || viewport.height <= 0 || viewport.width > VIEWPORT_MAX || viewport.height > VIEWPORT_MAX) return null
  if (!isRect(pig)) return null
  return {
    dpr,
    viewport: { width: viewport.width, height: viewport.height },
    pig: { x: pig.x, y: pig.y, width: pig.width, height: pig.height },
    interacting: payload.interacting === true,
  }
}

/** @param {{x:number,y:number,width:number,height:number}} rect @param {{x:number,y:number}} point */
function contains(rect, point) {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height
}

/**
 * 猪的物理中心落在哪块屏。跨屏/空洞时取最近的一块，避免没有显示器时不缩放。
 * @param {{scaleFactor:number,workArea:{x:number,y:number,width:number,height:number}}[]} displays
 * @param {{x:number,y:number}} point
 */
function displayAt(displays, point) {
  let best = null
  let distance = Infinity
  for (const display of displays) {
    const area = display.workArea
    if (contains(area, point)) return display
    const dx = Math.max(area.x - point.x, 0, point.x - (area.x + area.width))
    const dy = Math.max(area.y - point.y, 0, point.y - (area.y + area.height))
    const next = dx * dx + dy * dy
    if (next < distance) { best = display; distance = next }
  }
  return best
}

/**
 * @param {{
 *   ipcMain: {on:(channel:string,handler:any)=>any, removeListener:(channel:string,handler:any)=>any},
 *   getWindow: () => any,
 *   screen: {
 *     getAllDisplays: () => any[],
 *     dipToScreenRect?: (win:any, rect:any) => any,
 *     screenToDipRect?: (win:any, rect:any) => any,
 *   },
 *   onChange?: (change:{zoom:number,previous:number|null,reason:string,baseDPR:number,dpr:number,
 *     display:{id:any,scaleFactor:number,workArea:{x:number,y:number,width:number,height:number}}}) => void,
 *   log?: (...parts:any[]) => void,
 *   platform?: string,
 * }} deps
 */
export function createStageUiScale(deps) {
  const { ipcMain, getWindow, screen, onChange, log } = deps
  const platform = deps.platform ?? ''
  const win32 = platform === 'win32'

  let disposed = false
  /** @type {any} */
  let win = null
  /** @type {(() => void)|null} */
  let reloadHandler = null
  let isolated = false
  /** 上一次有效报告算出的目标；reload 后按它重放。 @type {any} */
  let lastTarget = null
  /** 同一种换算问题只记一次，避免每帧刷日志。 */
  let problem = ''

  function note(...parts) {
    try { log?.(...parts) } catch { /* logging must not break the stage */ }
  }

  function noteProblem(next) {
    if (problem === next) return
    problem = next
    note('ui-scale skipped', next)
  }

  /** 当前舞台窗；root 的 getWindow 必须指向同一个窗口对象。 */
  function stageWindow() {
    let value = null
    try { value = typeof getWindow === 'function' ? getWindow() : null } catch { value = null }
    if (value === null || value === undefined) return null
    try { if (value.isDestroyed?.() === true) return null } catch { return null }
    return value
  }

  /** isolated 是能安全改 zoom 的前提：没有它就不把舞台 zoom 漏给扩展大窗。 */
  function setMode(target) {
    const contents = target?.webContents
    if (contents === null || contents === undefined) return false
    if (typeof contents.setZoomMode !== 'function') {
      noteProblem('isolated zoom mode unavailable')
      return false
    }
    try {
      contents.setZoomMode('isolated')
      return true
    } catch (error) {
      noteProblem('setZoomMode failed: ' + String(error))
      return false
    }
  }

  /**
   * 每块屏的真实物理工作区。直接复用 physical.js 的 displayRecords：
   * 它用 dipToScreenRect(null, workArea) 换算完整工作区矩形；空矩形没有屏归属
   * （root 实测会保留未缩放原点），不能拿它当归属探针。不用 Display.nativeOrigin。
   */
  function physicalDisplays() {
    if (typeof screen?.dipToScreenRect !== 'function') return []
    let list = []
    try { list = screen.getAllDisplays() } catch { return [] }
    return displayRecords(Array.isArray(list) ? list : [], /** @type {any} */ (screen)).map(record => ({
      id: record.id,
      scaleFactor: record.scaleFactor,
      workArea: { ...record.physicalWorkArea },
    }))
  }

  /**
   * 页面报告 → 目标 zoom。猪的物理中心 = 物理内容原点 + CSS 中心 * 页面 dpr；
   * 目标 zoom = 该屏 scaleFactor / 窗口 baseDPR。
   * @param {any} stageWin
   * @param {ReturnType<typeof readReport>} report
   */
  function targetFor(stageWin, report) {
    if (report === null) return null
    if (!win32) { noteProblem('platform ' + (platform || 'unknown')); return null }
    if (typeof screen?.dipToScreenRect !== 'function') { noteProblem('screen.dipToScreenRect unavailable'); return null }
    let content = null
    try { content = stageWin.getContentBounds() } catch { content = null }
    if (!isRect(content)) { noteProblem('content bounds unavailable'); return null }
    let physicalContent = null
    // 从 screen 上调用，保留 Electron 需要的 receiver。
    try { physicalContent = screen.dipToScreenRect(stageWin, content) } catch (error) { noteProblem('content conversion failed: ' + String(error)); return null }
    if (!isRect(physicalContent)) { noteProblem('content conversion returned an invalid rect'); return null }
    // 页面还没按新视口重排时，CSS 猪坐标属于上一代 window；拿它套新内容矩形会选错屏。
    if (Math.abs(report.viewport.width * report.dpr - physicalContent.width) > CONTENT_TOLERANCE
      || Math.abs(report.viewport.height * report.dpr - physicalContent.height) > CONTENT_TOLERANCE) {
      noteProblem('report viewport does not match physical content')
      return null
    }
    const baseDPR = physicalContent.width / content.width
    if (!isFiniteNumber(baseDPR) || baseDPR <= 0) { noteProblem('base DPR unavailable'); return null }
    const displays = physicalDisplays()
    if (displays.length === 0) { noteProblem('no physical display'); return null }
    // 使用建窗时同一份舍入/外扩请求；150% 原生读回会比紧并集多出 3px，不能
    // 用紧并集拒绝已经正确落位的窗口，也不能接受旧拓扑的双倍内容。
    const union = physicalUnion(displays.map(display => display.workArea))
    if (union === null) { noteProblem('no physical work area'); return null }
    if (typeof screen.screenToDipRect !== 'function') { noteProblem('screen.screenToDipRect unavailable'); return null }
    const fit = dipForPhysicalUnion(union, /** @type {any} */ (screen))
    if (fit === null || !rectsClose(physicalContent, fit.physical, CONTENT_TOLERANCE)) { noteProblem('stage content not settled'); return null }
    const centre = {
      x: physicalContent.x + (report.pig.x + report.pig.width / 2) * report.dpr,
      y: physicalContent.y + (report.pig.y + report.pig.height / 2) * report.dpr,
    }
    const display = displayAt(displays, centre)
    if (display === null) { noteProblem('no display for pig centre'); return null }
    const rawZoom = display.scaleFactor / baseDPR
    if (!isFiniteNumber(rawZoom) || rawZoom <= 0) { noteProblem('display scale unavailable'); return null }
    problem = ''
    return {
      zoom: Math.min(Math.max(rawZoom, ZOOM_MIN), ZOOM_MAX),
      rawZoom,
      baseDPR,
      dpr: report.dpr,
      display,
      centre,
      content,
      physicalContent,
    }
  }

  /**
   * 落一次 zoom。close 且不强制时直接返回 false（防重复/抖动）。
   * @param {any} target
   * @param {string} reason
   * @param {boolean} [force] reload 后强制重放一次，让 geometry 带上最新 zoomFactor。
   */
  function applyZoom(target, reason, force = false) {
    const stageWin = win
    if (disposed || stageWin === null) return false
    if (stageWindow() !== stageWin) return false
    if (!isolated) { noteProblem('isolated zoom mode unavailable'); return false }
    const contents = stageWin.webContents
    let current = Number.NaN
    try { current = Number(contents.getZoomFactor()) } catch { current = Number.NaN }
    const close = Number.isFinite(current) && Math.abs(current - target.zoom) < ZOOM_EPSILON
    if (close && !force) return false
    try { contents.setZoomFactor(target.zoom) } catch (error) {
      note('ui-scale setZoomFactor failed', String(error))
      return false
    }
    const clamped = target.zoom !== target.rawZoom
    const detail = ['ui-scale', reason, 'zoom', target.zoom, 'base', target.baseDPR,
      'display', target.display.id, target.display.scaleFactor]
    if (clamped) detail.push('clamped')
    note(...detail)
    if (typeof onChange === 'function') {
      try {
        onChange({
          zoom: target.zoom,
          previous: Number.isFinite(current) ? current : null,
          reason,
          baseDPR: target.baseDPR,
          dpr: target.dpr,
          display: {
            id: target.display.id,
            scaleFactor: target.display.scaleFactor,
            workArea: { ...target.display.workArea },
          },
        })
      } catch (error) { note('ui-scale onChange failed', String(error)) }
    }
    return true
  }

  /** 页面重载后 Chromium 可能把 zoom 恢复成旧值：按上一次目标重放，再让 root push 新 geometry。 */
  function reapply() {
    if (disposed || win === null || lastTarget === null) return false
    isolated = setMode(win)
    return applyZoom(lastTarget, 'reload', true)
  }

  /**
   * 只认当前舞台窗的 stage:report；扩展大窗、已销毁窗口、坏消息都不动。
   * @param {any} event
   * @param {any} payload
   */
  function onReport(event, payload) {
    if (disposed) return
    const stageWin = stageWindow()
    if (win === null || stageWin === null || stageWin !== win) return
    if (event?.sender !== stageWin.webContents) return
    const report = readReport(payload)
    if (report === null) return
    if (report.interacting) return
    if (!win32) return
    const target = targetFor(stageWin, report)
    if (target === null) return
    lastTarget = target
    applyZoom(target, 'report')
  }

  function detach() {
    if (win !== null && reloadHandler !== null) {
      try {
        if (win.isDestroyed?.() !== true) win.webContents.removeListener('did-finish-load', reloadHandler)
      } catch { /* window is going away */ }
    }
    reloadHandler = null
    win = null
    isolated = false
  }

  /**
   * 接管舞台窗：先设 isolated，再挂 did-finish-load 重放。扩展大窗由 root 自己处理。
   * @param {any} target
   */
  function attach(target) {
    if (disposed || target === null || target === undefined) return false
    if (win === target && reloadHandler !== null) {
      isolated = setMode(target)
      return isolated
    }
    detach()
    win = target
    // 新窗口不继承旧窗口的目标；第一次报告会重新算。
    lastTarget = null
    isolated = setMode(target)
    reloadHandler = () => {
      if (disposed || win !== target) return
      reapply()
    }
    try {
      target.webContents.on('did-finish-load', reloadHandler)
    } catch (error) {
      note('ui-scale did-finish-load hook failed', String(error))
    }
    return isolated
  }

  function dispose() {
    if (disposed) return
    disposed = true
    detach()
    lastTarget = null
    try { ipcMain.removeListener('stage:report', onReport) } catch { /* already gone */ }
  }

  ipcMain.on('stage:report', onReport)

  return {
    attach,
    dispose,
    /** 供 root 在显示器变化后主动重放上一次目标（可选，不依赖页面新报告）。 */
    reapply,
    isIsolated: () => isolated,
  }
}
