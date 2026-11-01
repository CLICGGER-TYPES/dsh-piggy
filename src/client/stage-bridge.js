// @ts-check
/**
 * 网页版单页在整屏舞台里缺的几项能力（挂载时注册，只在这一个页面里有效）。
 *
 * 舞台不装桌面外壳：window.__dshPiggyShell 保持 null，网页版的拖动、clampPig、
 * 面板排版照旧。这里补的是外壳才能做的四件事：
 *   1. setPosition：舞台自己挪完猪（抛掷落地、屏间空洞补偿、散步）后把真实位置写回
 *      ctx.userRight/userBottom 并存本机偏好，下一次 resize/菜单/轮询不会弹回去（A3）。
 *   2. flight：抛掷时给 feel 一个只含 flight 的 shell，窗口不动、猪在页面里飞；
 *      飞行全程整窗形状（Linux setShape 会裁绘制，A1），结束后再恢复精确形状。
 *
 * @module dsh-piggy/client/stage-bridge
 */
import { bodyVisualBounds } from './desktop/visual-bounds.js'
import { autoCollapseEnabled } from './auto-collapse.js'
import { applyBubbleSize, setStageAreaProvider } from './bubble-size.js'
import { fitSpeechPlacement } from './bubble-fit.js'
import { createStageSpeechPanel } from './stage-speech-panel.js'
import { characterGeometry } from './character-geometry.js'
import { POSITION_KEY } from './constants.js'
import { nearestArea } from './desktop/geometry.js'
import { DESKTOP_HOME_KEY, resolveStageHome } from './stage-home.js'
import { hostInset, layoutBox, pigEnvelope, stageDrawingBounds, union } from './stage-dom.js'
import { readStore, writeStore } from './storage.js'
import { constrainRectToAreas, desktopPositionForStage, geometryMatchesViewport, positionForScreenFoot, rebaseStageFoot, rescaleGeometryForDpr, STAGE_POSITION_MIGRATION_KEY, stagePanelArea, toPageRect, workAreaForPig } from './stage-position.js'
import { applyPigFx, forwardPigFx, registerStageShell, unregisterStageShell } from './stage-shell.js'
import { createStageAnchor } from './stage-anchor.js'
import { bindStageEvents } from './stage-events.js'
import { collectHitRects } from './hit-regions.js'

const FLIGHT_GUARD_MS = 15000
const ROUND = value => Math.round(Number(value) || 0)

/**
 * @param {{
 *   options: any, ctx: any, host: any, pig: any, bubble: any, card: any,
 *   setOpen: (open:boolean)=>void, clampPig: ()=>void, fitPanel: ()=>void,
 * }} deps
 */
export function createStageBridge(deps) {
  const options = deps.options
  if (options === null || options === undefined) return null
  const role = options.role === 'ext' ? 'ext' : 'stage'

  // 扩展大窗：wireSplit 已经按 role=ext 接管 ctx；这里只把「猪的反应」转出去。
  if (role === 'ext') {
    const shell = /** @type {any} */ (window).piggyShell
    const restore = typeof shell?.panel?.fx === 'function'
      ? forwardPigFx(deps.ctx, (name, args) => shell.panel.fx(name, args))
      : function () {}
    return { role: 'ext', dispose: function () { restore() } }
  }

  const { ctx, host, pig, bubble, card, setOpen, clampPig, fitPanel } = deps
  /** @type {any} */ let geometry = null
  let flying = false
  let flightGuard = null
  let settleFrame = 0
  let bubbleFrame = 0
  let migrated = false
  let pendingHome = null
  const fitSpeechPanel = createStageSpeechPanel(card, fitPanel)
  /** @type {any} */ let lastFlightWindow = null
  function currentGeometry() {
    // 主进程会在显示器/resize 后推新的几何；只在第一次或还没收到时同步问一次。
    if (geometry === null) {
      try {
        const live = options.geometry?.()
        if (live !== null && live !== undefined && live.window) geometry = live
      } catch { /* 舞台页还没挂好 */ }
    }
    return geometry
  }

  function scheduleSettle() {
    if (settleFrame !== 0) return
    settleFrame = requestAnimationFrame(() => { settleFrame = 0; settle() })
  }

  function scheduleBubble() {
    if (bubbleFrame !== 0) return
    // 猪可能走到另一块屏：气泡上限按它现在所在的工作区重算（不是舞台整窗并集）。
    bubbleFrame = requestAnimationFrame(() => { bubbleFrame = 0; applyBubbleSize(host); fitBubble() })
  }

  /** 把真实位置写回游戏状态；视口还没跟上几何（缩放/启动）时不写共享家，避免存成默认位置。 */
  function setPosition(right, bottom, resettle = true) {
    if (!Number.isFinite(right) || !Number.isFinite(bottom)) return
    pendingHome = null
    ctx.userRight = ROUND(right)
    ctx.userBottom = ROUND(bottom)
    host.style.left = 'auto'
    host.style.top = 'auto'
    host.style.right = ctx.userRight + 'px'
    host.style.bottom = ctx.userBottom + 'px'
    clampPig()
    const appliedRight = hostInset(host, 'right')
    const appliedBottom = hostInset(host, 'bottom')
    if (appliedRight !== null) ctx.userRight = appliedRight
    if (appliedBottom !== null) ctx.userBottom = appliedBottom
    footAnchor.remember()
    writeStore(POSITION_KEY, JSON.stringify({ right: ctx.userRight, bottom: ctx.userBottom }))
    const geo = currentGeometry()
    const desktop = geometryMatchesViewport(geo, window.innerWidth, window.innerHeight) ? desktopPositionForStage(layoutBox(pig), geo) : null
    if (desktop) writeStore(DESKTOP_HOME_KEY, JSON.stringify(desktop))
    fitPanel()
    scheduleBubble()
    if (resettle) scheduleSettle()
  }

  /** 尺寸/内边距变了但位置没变：把 right/bottom 补回同一个脚底。 */
  const footAnchor = createStageAnchor(pig, host, shift => {
    setPosition((hostInset(host, 'right') ?? ctx.userRight) + shift.right, (hostInset(host, 'bottom') ?? ctx.userBottom) + shift.bottom, false)
  })

  /** 猪带着面板留在真实工作区里；屏间空洞不算可用（A3 多屏补偿）。 */
  function settle() {
    if (flying) return
    const geo = currentGeometry()
    if (geo === null || !geo.window || !Array.isArray(geo.workAreas) || geo.workAreas.length === 0) return
    if (!geometryMatchesViewport(geo, window.innerWidth, window.innerHeight)) return
    if (!migrated) { migratePosition(); if (!migrated) return }
    if (pendingHome !== null) {
      const next = positionForScreenFoot(pendingHome, layoutBox(pig), layoutBox(host), geo)
      pendingHome = null; if (next) setPosition(next.right, next.bottom, false)
    }
    footAnchor.restore()
    const envelope = pigEnvelope(pig)
    if (envelope === null) return
    let target = envelope
    if (host.getAttribute('data-open') === 'true' && card !== null && !card.hidden) {
      const rect = card.getBoundingClientRect()
      if (rect.width > 1 && rect.height > 1) target = union(envelope, { x: rect.left, y: rect.top, width: rect.width, height: rect.height })
    }
    const screen = { x: target.x + geo.window.x, y: target.y + geo.window.y, width: target.width, height: target.height }
    const moved = constrainRectToAreas(screen, geo.workAreas)
    if (moved.moved) {
      // 屏幕往右挪 dx → CSS right 减小 dx；往下同理。不再排下一轮 settle，避免贴边来回夹。
      setPosition((hostInset(host, 'right') ?? ctx.userRight) - moved.offset.x, (hostInset(host, 'bottom') ?? ctx.userBottom) - moved.offset.y, false)
      scheduleBubble()
      return
    }
    fitBubble()
  }

  /** 屏顶下置 + 横向可见约束 + 菜单避让（A2）。宽度和猪都不动。 */
  function fitBubble() {
    if (bubble === null || bubble.hidden) {
      fitSpeechPanel()
      return
    }
    const geo = currentGeometry()
    if (geo === null || !geo.window) return
    const parent = bubble.offsetParent
    if (parent === null || parent === undefined) return
    const pigBox = layoutBox(pig)
    if (pigBox.width < 1 || pigBox.height < 1) return
    const width = bubble.offsetWidth
    const height = bubble.offsetHeight
    if (width < 1 || height < 1) return
    const parentBox = layoutBox(parent)
    const originalX = parentBox.width - 6 - width + parentBox.x
    const anchors = characterGeometry(pigBox)
    const originalY = anchors.headTop.y - 10 - height
    const origin = geo.window
    const area = workAreaForPig(pigBox, geo) ?? origin
    const pageArea = toPageRect(area, origin)
    const pageWindow = { x: 0, y: 0, width: origin.width, height: origin.height }
    let menu = null
    if (host.getAttribute('data-open') === 'true' && card !== null && !card.hidden) {
      const box = layoutBox(card)
      if (box.width > 1 && box.height > 1) menu = box
    }
    const place = fitSpeechPlacement({
      bubble: { x: originalX, y: originalY, width, height },
      pig: pigBox, window: pageWindow, workArea: pageArea, menu,
    })
    const left = place.clipped ? ROUND(place.x - parentBox.x) + 'px' : ''
    const top = place.clipped || place.side === 'below' ? ROUND(place.y - parentBox.y) + 'px' : ''
    const tail = place.clipped ? place.tailLeft + 'px' : ''
    setStyle(bubble, 'left', left)
    setStyle(bubble, 'right', left === '' ? '' : 'auto')
    setStyle(bubble, 'top', top)
    setStyle(bubble, 'bottom', top === '' ? '' : 'auto')
    const currentTail = bubble.style.getPropertyValue('--bubble-tail-left')
    if (currentTail !== tail) { if (tail === '') bubble.style.removeProperty('--bubble-tail-left'); else bubble.style.setProperty('--bubble-tail-left', tail) }
    setAttr(bubble, 'data-fitted', place.clipped ? 'true' : null)
    setAttr(bubble, 'data-bubble-side', place.side === 'below' ? 'below' : null)
    fitSpeechPanel(menu, place, pigBox, pageArea)
  }

  /** @param {any} node @param {string} name @param {string} value */
  function setStyle(node, name, value) { if (node.style[name] !== value) node.style[name] = value }
  function setAttr(node, name, value) {
    if (value === null) { if (node.hasAttribute(name)) node.removeAttribute(name) }
    else if (node.getAttribute(name) !== value) node.setAttribute(name, value)
  }

  // ---- 抛掷：窗口不动，猪在页面里飞（A1） ----
  function beginFlight() {
    flying = true
    options.setInteracting?.(true)
    if (flightGuard !== null) clearTimeout(flightGuard)
    flightGuard = setTimeout(() => {
      flightGuard = null
      if (flying) flightBridge.finish(lastFlightWindow)
    }, FLIGHT_GUARD_MS)
  }

  function endFlight() { flying = false
    lastFlightWindow = null
    if (flightGuard !== null) { clearTimeout(flightGuard); flightGuard = null }
    // 落地后的位置已经写进 right/bottom；等两帧让页面排好、形状上报到最终值，
    // 再把整窗形状换回精确控件（A1：普通 pointerup 不能提前恢复）。
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (flying) return
      options.setInteracting?.(false)
      scheduleSettle()
      scheduleBubble()
    }))
  }

  /** @param {number} screenX @param {number} screenY */
  function placeHostAt(screenX, screenY) {
    const geo = currentGeometry()
    if (geo === null || !geo.window) return
    host.style.right = 'auto'
    host.style.bottom = 'auto'
    host.style.left = ROUND(screenX - geo.window.x) + 'px'
    host.style.top = ROUND(screenY - geo.window.y) + 'px'
  }

  const flightBridge = {
    supported: true,
    start() {
      const geo = currentGeometry(), pigBox = layoutBox(pig)
      if (geo === null || !geo.window || !Array.isArray(geo.workAreas) || pigBox.width < 1) return null
      const hostRect = host.getBoundingClientRect()
      const local = { x: pigBox.x - hostRect.left, y: pigBox.y - hostRect.top, width: pigBox.width, height: pigBox.height }
      const visual = bodyVisualBounds(local)
      const home = { x: geo.window.x + pigBox.x + pigBox.width / 2, y: geo.window.y + pigBox.y + pigBox.height }
      beginFlight()
      lastFlightWindow = { x: geo.window.x + hostRect.left, y: geo.window.y + hostRect.top, width: hostRect.width, height: hostRect.height }
      return {
        home, pig: local, visual,
        window: lastFlightWindow,
        area: nearestArea(home, geo.workAreas) ?? geo.window,
        areas: geo.workAreas,
      }
    },
    move(x, y) {
      flying = true
      lastFlightWindow = { x, y, width: lastFlightWindow?.width ?? 0, height: lastFlightWindow?.height ?? 0 }
      placeHostAt(x, y)
    },
    setFlying(on) { if (on === true && !flying) beginFlight() },
    finish(last) {
      if (flying) {
        const final = last?.window ?? lastFlightWindow ?? { x: lastFlightWindow?.x ?? 0, y: lastFlightWindow?.y ?? 0 }
        const slide = last?.slide ?? { x: 0, y: 0 }
        placeHostAt(final.x + (Number(slide.x) || 0), final.y + (Number(slide.y) || 0))
        host.style.translate = ''
        const rect = host.getBoundingClientRect()
        setPosition(window.innerWidth - rect.right, window.innerHeight - rect.bottom)
      }
      endFlight()
    },
  }

  /** 桌面散步（G 批次）：按屏幕增量走，走完写回真实位置（A7）。 */
  function moveBy(dx, dy) {
    if (flying) return
    const right = hostInset(host, 'right') ?? ctx.userRight
    const bottom = hostInset(host, 'bottom') ?? ctx.userBottom
    setPosition(right - (Number(dx) || 0), bottom - (Number(dy) || 0), true)
  }

  /**
   * 每台设备每次挂载都对齐共享的「猪的家」（split 与舞台都写同一个键），
   * 不再只认一次：split 里挪过猪再进舞台也能拿到新位置；舞台自己写的家与
   * 当前位置一致，所以不会来回弹。没有家时才用旧窗口文件的位置（只一次）。
   */
  function migratePosition() {
    const geo = currentGeometry()
    if (geo === null || !geo.window || flying) return
    const pigBox = layoutBox(pig)
    if (pigBox.width < 8 || pigBox.height < 8) return
    let homeRaw = null
    try { homeRaw = JSON.parse(readStore(DESKTOP_HOME_KEY)) } catch { /* 坏数据就当没有 */ }
    const home = resolveStageHome({
      homeRaw, legacyPig: geo.legacyPig, allowLegacy: !migrated,
      pigSize: { width: pigBox.width, height: pigBox.height },
      hostBox: layoutBox(host), pigBox, geometry: geo,
      current: { right: ctx.userRight, bottom: ctx.userBottom },
    })
    migrated = true
    if (readStore(STAGE_POSITION_MIGRATION_KEY) !== '1') writeStore(STAGE_POSITION_MIGRATION_KEY, '1')
    if (home.position !== null) setPosition(home.position.right, home.position.bottom)
  }

  /** 舞台页的气泡尺寸上限：猪现在所在那块屏的工作区（和 split 的 workArea 同源）。
   *  直接用已收到的几何，不再主动发一次同步询问（没收到时退回整窗上限）。 */
  function stageBubbleArea() {
    return workAreaForPig(layoutBox(pig), geometry)
  }

  function canCollapse() {
    if (ctx.isOpen !== true || !autoCollapseEnabled()) return false
    const active = document.activeElement
    const tag = active?.tagName?.toLowerCase?.() ?? ''
    if (tag === 'input' || tag === 'textarea' || active?.getAttribute?.('contenteditable') === 'true') return false
    if (ctx.tab === 'fishing' && ctx.view?.fishing?.pending?.phase === 'hooked') return false
    if (ctx.content?.querySelector?.('[data-save-transfer-active="true"]') !== null) return false
    return true
  }

  function onGeometry(info) {
    if (info === null || info === undefined) return
    pendingHome = rebaseStageFoot(pendingHome, layoutBox(pig), layoutBox(host), hostInset(host, 'right') ?? ctx.userRight, hostInset(host, 'bottom') ?? ctx.userBottom, geometry, info, flying)
    geometry = info
    if (!migrated) migratePosition()
    scheduleBubble(); scheduleSettle()
  }

  function onOutsideBlur() { if (canCollapse()) setOpen(false) }
  function onPointerUp() { setTimeout(() => { if (!flying) scheduleSettle() }, 0) }
  function onResize() {
    const geo = currentGeometry()
    const next = rescaleGeometryForDpr(geo, window.devicePixelRatio)
    if (geo !== null && next !== geo) { pendingHome = rebaseStageFoot(pendingHome, layoutBox(pig), layoutBox(host), hostInset(host, 'right') ?? ctx.userRight, hostInset(host, 'bottom') ?? ctx.userBottom, geo, next, flying); geometry = next }
    scheduleBubble(); scheduleSettle()
  }

  const subscriptions = []
  for (const off of [options.onGeometry?.(onGeometry), options.onBlur?.(onOutsideBlur)]) {
    if (typeof off === 'function') subscriptions.push(off)
  }
  const shell = /** @type {any} */ (window).piggyShell
  if (typeof shell?.panel?.onFx === 'function') shell.panel.onFx(fx => applyPigFx(ctx, fx))
  subscriptions.push(bindStageEvents(window, ctx, setOpen, onPointerUp, onResize))
  const observer = new MutationObserver(() => { scheduleBubble(); scheduleSettle() })
  observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'style', 'data-open', 'data-bubble-side', 'data-fitted'] })

  const api = {
    role: 'stage',
    setPosition,
    recover(home) {
      flying = false; pendingHome = null; lastFlightWindow = null; options.setInteracting?.(false)
      if (flightGuard !== null) { clearTimeout(flightGuard); flightGuard = null }
      host.style.translate = ''; writeStore(DESKTOP_HOME_KEY, JSON.stringify({ v: 3, area: home.area, x: home.x, y: home.y }))
      migratePosition(); footAnchor.remember(); scheduleBubble(); scheduleSettle()
    },
    setOpen,
    /** 面板可用区（猪所在屏的工作区，页面坐标）：共享 layout 的 fitPanel 按它排面板。 */
    panelArea() { return stagePanelArea(layoutBox(pig), currentGeometry()) },
    syncGeometry() { scheduleBubble(); scheduleSettle() },
    ext: {
      open(key) { shell?.ext?.open?.(String(key)) },
      close() { shell?.ext?.close?.() },
    },
    walk: true,
    proxy: shell?.proxy ?? null,
    fullscreen: shell?.fullscreen ?? null,
    external: shell?.external ?? null,
    isFlying() { return flying },
    feelShell() { return { flight: flightBridge } },
    moveShell() { return { moveBy } },
    dispose,
  }
  registerStageShell(api)
  setStageAreaProvider(stageBubbleArea)
  const publicApi = {
    setPosition, setOpen, ext: api.ext, syncGeometry: api.syncGeometry, walk: true,
    drawingBounds: box => stageDrawingBounds(box, pig),
    hitRegions: collectHitRects,
    isFlying() { return flying },
  }
  ;/** @type {any} */ (window).piggyStage = publicApi
  function dispose() {
    observer.disconnect()
    for (const off of subscriptions.splice(0)) { try { off() } catch { /* already gone */ } }
    if (settleFrame !== 0) cancelAnimationFrame(settleFrame)
    if (bubbleFrame !== 0) cancelAnimationFrame(bubbleFrame)
    if (flightGuard !== null) clearTimeout(flightGuard)
    settleFrame = 0
    bubbleFrame = 0
    flightGuard = null
    flying = false
    options.setInteracting?.(false)
    setStageAreaProvider(null)
    unregisterStageShell(api)
    if (/** @type {any} */ (window).piggyStage === publicApi) delete /** @type {any} */ (window).piggyStage
  }

  requestAnimationFrame(() => { migratePosition(); scheduleBubble(); scheduleSettle() })
  return api
}
