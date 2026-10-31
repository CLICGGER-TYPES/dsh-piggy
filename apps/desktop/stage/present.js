// @ts-check
/**
 * 舞台窗口的形状与交互状态（主进程侧）。
 *
 * Linux 的 setShape 同时决定「可点」和「绘制」，所以：
 * - 交互/抛掷期间用整窗形状，避免高速帧被裁（A1）；
 * - 交互刚结束时仍保持整窗，等页面报来落地后的真实形状再收窄；
 * - 页面漏发结束时由租约/失焦/销毁恢复，不永久挡桌面（A5）。
 *
 * 只碰窗口形状与命中，不管 IPC、显示器或生命周期；便于单独测试。
 * @module dsh-piggy-desktop/stage/present
 */
import { translatePhysicalCursor, translatePhysicalCursorDpr } from './hit-physical.js'
import { pigDisplayBounds } from './pig-display.js'
import { pointerHitsShape, sanitizeReport } from './shape.js'

/**
 * @param {{
 *   getWindow: () => any,
 *   platform: string,
 *   screen: {
 *     getCursorScreenPoint: () => {x:number,y:number},
 *     dipToScreenPoint?: (point:{x:number,y:number}) => {x:number,y:number},
 *     dipToScreenRect?: (
 *       win:any, rect:{x:number,y:number,width:number,height:number}
 *     ) => {x:number,y:number,width:number,height:number},
 *     getAllDisplays?: () => any[],
 *     getDisplayMatching?: (rect:{x:number,y:number,width:number,height:number}) => any,
 *     getDisplayNearestPoint?: (point:{x:number,y:number}) => any,
 *   },
 *   log: (...parts:any[]) => void,
 *   onInteraction?: (active:boolean) => void,
 * }} deps
 */
export function createPresenter(deps) {
  let lastShape = []
  let lastHitShape = []
  let hadShape = false
  let interacting = false
  let awaitingShape = false
  /** @type {any} */
  let awaitingTimer = null
  let lastShapeKey = ''
  /** 页面最近一次报告里的 CSS 视口 / dpr；没有就保持旧 DIP 路径。 */
  /** @type {{width:number,height:number}|null} */
  let lastViewport = null
  /** @type {number|null} */
  let lastDpr = null
  /** 页面最近一次报告的猪（CSS 坐标）；全屏探测按它的中心找显示器。 */
  /** @type {{x:number,y:number,width:number,height:number}|null} */
  let lastPig = null
  /** @type {boolean|null} */
  let lastHit = null
  /** 同一种换算错误只记一次，避免 16ms 轮询刷日志。 */
  let hitProblem = ''
  let shaped = deps.platform === 'linux'

  function win() {
    const value = deps.getWindow()
    return value !== null && value !== undefined && !value.isDestroyed() ? value : null
  }

  function applyShape(force = false) {
    const stageWin = win()
    if (stageWin === null) return
    const bounds = stageWin.getContentBounds()
    const full = interacting || awaitingShape
    const rects = full ? [{ x: 0, y: 0, width: bounds.width, height: bounds.height }] : lastShape
    const key = JSON.stringify({ full, rects })
    if (!force && key === lastShapeKey) return
    lastShapeKey = key
    if (!shaped) { refreshHit(); return }
    try {
      stageWin.setShape(rects.length > 0 ? rects : [{ x: 0, y: 0, width: 1, height: 1 }])
    } catch (error) { deps.log('setShape failed', String(error)) }
    // 原生形状更新可能重置输入，即使提交失败也要恢复当前穿透，不能只比较旧命中。
    lastHit = null
    refreshHit()
  }

  /** 换算不可用：记日志并按「不命中」放行桌面，不退回错误的 DIP 基准。 */
  function rejectHit(problem, detail) {
    if (problem === hitProblem) return
    hitProblem = problem
    try { deps.log('hit conversion rejected', problem, JSON.stringify(detail)) } catch { /* logging must not break input */ }
  }

  /**
   * Windows：光标 DIP 按光标所在屏、窗口 DIP 按窗口所在屏，不能直接相减。
   * 两边都换到物理像素后，优先按报告 dpr（或 CSS 视口）折回页面逻辑坐标；
   * 两者都没有时才沿用旧的物理/内容 DIP 比例。
   * @returns {boolean|undefined} undefined 表示环境没有这套方法，沿用原来的 DIP 命中。
   */
  function physicalPointerHit(stageWin) {
    const { screen } = deps
    if (typeof screen.dipToScreenPoint !== 'function' || typeof screen.dipToScreenRect !== 'function') return undefined
    try {
      const content = stageWin.getContentBounds()
      // 方法都从 screen 上调用：Electron 的绑定 receiver 不能换成解构出来的裸函数。
      const cursorPhysical = screen.dipToScreenPoint(screen.getCursorScreenPoint())
      const contentPhysical = screen.dipToScreenRect(stageWin, content)
      // zoom 后 CSS 视口 ≠ getContentBounds()：优先 (物理光标 - C) / dpr；
      // 没有 dpr 但有 CSS 视口时用 C/视口 的物理比例，两者都没有才回旧 DIP 基准。
      const cssRect = lastViewport === null ? content
        : { x: 0, y: 0, width: lastViewport.width, height: lastViewport.height }
      const { cursor, problem } = lastDpr !== null
        ? translatePhysicalCursorDpr(cursorPhysical, contentPhysical, lastDpr)
        : translatePhysicalCursor(cursorPhysical, contentPhysical, cssRect)
      if (cursor === null) {
        rejectHit(problem, { cursorPhysical, contentPhysical, content })
        return false
      }
      hitProblem = ''
      const width = lastViewport?.width ?? (lastDpr !== null ? contentPhysical.width / lastDpr : content.width)
      const height = lastViewport?.height ?? (lastDpr !== null ? contentPhysical.height / lastDpr : content.height)
      return pointerHitsShape(cursor, { x: 0, y: 0, width, height }, lastHitShape)
    } catch (error) {
      rejectHit('screen conversion failed: ' + String(error), {})
      return false
    }
  }

  function pointerHit(stageWin) {
    if (deps.platform === 'win32') {
      const hit = physicalPointerHit(stageWin)
      if (hit !== undefined) return hit
    }
    return pointerHitsShape(deps.screen.getCursorScreenPoint(), stageWin.getBounds(), lastHitShape)
  }

  function refreshHit() {
    const stageWin = win()
    if (stageWin === null || !stageWin.isVisible()) return
    const hit = interacting || awaitingShape || pointerHit(stageWin)
    if (hit === lastHit) return
    lastHit = hit
    stageWin.setIgnoreMouseEvents(!hit, deps.platform === 'win32' ? { forward: true } : undefined)
  }

  function applyInteracting(active) {
    if (interacting === active) return
    interacting = active
    if (active) {
      awaitingShape = false
      if (awaitingTimer !== null) { clearTimeout(awaitingTimer); awaitingTimer = null }
    } else {
      // 先保持整窗，等页面把落地后的真实形状报上来；页面一直不报就 600ms 后兜底。
      awaitingShape = true
      if (awaitingTimer !== null) clearTimeout(awaitingTimer)
      awaitingTimer = setTimeout(() => {
        awaitingTimer = null
        awaitingShape = false
        applyShape()
        refreshHit()
      }, 600)
      awaitingTimer.unref?.()
    }
    applyShape()
    refreshHit()
  }

  /** @param {any} payload */
  function applyReport(payload) {
    const stageWin = win()
    if (stageWin === null) return
    const report = sanitizeReport(payload, stageWin.getContentBounds())
    if (report === null) return
    lastShape = report.shape
    lastHitShape = report.hitShape ?? report.shape
    lastDpr = report.dpr ?? null
    lastViewport = report.viewport ?? null
    if (report.visible?.pig) lastPig = report.visible.pig
    if (!hadShape && lastShape.length > 0) { hadShape = true; deps.log('first shape', JSON.stringify(report.visible)) }
    if (report.interacting !== interacting) (deps.onInteraction ?? applyInteracting)(report.interacting)
    // 这份形状就是最终值：结束交互后的「等新形状」到此为止。
    awaitingShape = false
    if (awaitingTimer !== null) { clearTimeout(awaitingTimer); awaitingTimer = null }
    applyShape()
    refreshHit()
  }

  /** 窄接口：全屏探测只要「猪所在显示器」的物理 bounds。 */
  function getPigDisplayBounds() {
    const stageWin = win()
    if (stageWin === null) return null
    return pigDisplayBounds({ platform: deps.platform, screen: deps.screen, win: stageWin,
      pig: lastPig, dpr: lastDpr, viewport: lastViewport })
  }

  return {
    applyShape,
    refreshHit,
    applyInteracting,
    applyReport,
    getPigDisplayBounds,
    isInteracting() { return interacting },
    setShaped(value) { shaped = value === true },
    dispose() {
      if (awaitingTimer !== null) { clearTimeout(awaitingTimer); awaitingTimer = null }
      awaitingShape = false
      lastShape = []
      lastHitShape = []
      lastDpr = null
      lastViewport = null
      lastPig = null
    },
  }
}
