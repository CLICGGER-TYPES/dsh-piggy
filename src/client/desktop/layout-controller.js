// @ts-check
/** The single owner of one pet page's window measurement and placement loop. */
import { artMarginFor } from '../art-framing.js'
import { bodyVisualBounds } from './visual-bounds.js'
import { displayNote, sameBounds } from './geometry.js'
import { createMeasure, layoutBox } from './measure.js'
import { createPlacement } from './place.js'
import { pigInsideWindow, pigVisibility } from './visibility.js'
import { createWindowClamp } from './window-clamp.js'
import { commitSlide } from './slide.js'

const TOLERANCE = 2
const STALE_WAIT_MS = 500
/** 布局没变化时也要留一条心跳，30 分钟挂机后能直接看日志确认猪一直在窗口里。 */
const VISIBILITY_HEARTBEAT_MS = 30000

/**
 * @param {{shell:any, windowObject:Window, getHost:()=>any, isDragging:()=>boolean,
 *   isFlying:()=>boolean, setHitRects:(rects:any[])=>void,
 *   pigId?:string|null, primary?:boolean, slot?:number|null}} deps
 */
export function createLayoutController(deps) {
  const shell = deps.shell
  const requestFrame = deps.windowObject.requestAnimationFrame?.bind(deps.windowObject)
    ?? requestAnimationFrame
  let lastKey = null
  let staleSince = /** @type {number|null} */ (null)
  let clampNotice = null
  let scheduled = false
  let visibilityKey = ''
  let visibilityAt = 0
  const windowClamp = createWindowClamp()

  function geometry() {
    return typeof shell.geometry === 'function' ? shell.geometry() : null
  }

  const measure = createMeasure({ platform: shell.platform || '', geometry })
  // One pet per window: stay on getHost's single root, but save under this window's pigId.
  const placement = createPlacement({ pigId: deps.pigId ?? null, primary: deps.primary === true, slot: deps.slot ?? null })

  function layoutStale(win) {
    return Math.abs(deps.windowObject.innerWidth - win.width) > 1
      || Math.abs(deps.windowObject.innerHeight - win.height) > 1
  }

  function readGeometry() {
    if (typeof shell.place === 'function') {
      const fresh = shell.place({})
      if (fresh !== null && fresh !== undefined && fresh.window) return fresh
    }
    return geometry()
  }

  function pigInWindow(win) {
    const host = deps.getHost()
    const pigNode = host?.querySelector('.dp-pig')
    const size = placement.pigSize()
    const homeTL = placement.homeTopLeft()
    if (pigNode && !layoutStale(win)) return layoutBox(pigNode)
    if (homeTL !== null) return { x: homeTL.x - win.x, y: homeTL.y - win.y, width: size.width, height: size.height }
    return pigNode ? layoutBox(pigNode) : null
  }

  function schedule() {
    if (scheduled) return
    scheduled = true
    requestFrame(function () {
      scheduled = false
      if (!deps.isDragging() && !deps.isFlying()) tick()
    })
  }

  /**
   * 窗口被工作区夹住时，把内容反向挪同样的量（猪的屏幕位置不变，只裁透明留白）。
   * 返回按新偏移重新钉过的这一帧；形状先跟着挪，调用方随后还会重测一次。
   * @param {any} host @param {any} side @param {any} next
   */
  function applyClamp(host, side, next) {
    const clamp = placement.clamp()
    const old = measure.state.shift
    const fresh = { x: -clamp.dx, y: -clamp.dy }
    if (fresh.x === old.x && fresh.y === old.y) return next
    measure.state.shift = fresh
    measure.pin(host, side, next.hostBox, next.contentBox)
    const dx = fresh.x - old.x
    const dy = fresh.y - old.y
    next.shape = next.shape.map(rect => ({ ...rect, x: rect.x + dx, y: rect.y + dy }))
    next.hitShape = next.hitShape.map(rect => ({ ...rect, x: rect.x + dx, y: rect.y + dy }))
    return next
  }

  /**
   * 拖动/抛掷的 slide 与窗口夹取补偿会叠成永久偏移：窗口夹住时落一次 slide，
   * 紧接着的抛掷又在同一个边上落一次，anchor 就攒成 2 倍，猪被推到 surface 外
   * （2026-11-26：pigBox.x = -100 / 窗口 x = 161 / shift 0，之后 4 小时不回位）。
   * 归零内部偏移后按「家」重新摆一次：窗口会挪到猪身上，猪的屏幕位置不变。
   * @param {any} host @param {any} side @param {any} next
   * @returns {any} 重新量过的一帧
   */
  function rebaseOutsideWindow(host, side, next) {
    measure.state.shift = { x: 0, y: 0 }
    measure.state.anchor = { x: 0, y: 0 }
    measure.state.pinned = ''
    measure.pin(host, side, next.hostBox, next.contentBox)
    return measure.boxes(host) ?? next
  }

  /**
   * 可见性日志：pigBox（窗口内坐标）+ 窗口矩形 + 是否相交 + 页面显示状态。
   * 布局变化立刻记一条；稳定挂机每 30 秒一条，避免每秒刷屏。
   * @param {any} host @param {any} next @param {any} win
   */
  function logVisibility(host, next, win) {
    const shown = typeof document === 'object' && document !== null ? document.visibilityState !== 'hidden' : true
    const vis = pigVisibility(next.pigBox, win, shown)
    const key = JSON.stringify([next.pigBox, win, vis.inside, vis.shown, host.getAttribute('data-open'),
      measure.state.shift, measure.state.anchor])
    const at = Date.now()
    if (key === visibilityKey && at - visibilityAt < VISIBILITY_HEARTBEAT_MS) return
    visibilityKey = key
    visibilityAt = at
    console.warn('[piggy-desktop] pig-visible ' + JSON.stringify({
      window: { x: win.x, y: win.y, width: win.width, height: win.height },
      pigBox: next.pigBox,
      content: { width: next.content.width, height: next.content.height },
      inside: vis.inside, visible: vis.visible, intersect: vis.intersect, shown: vis.shown,
      open: host.getAttribute('data-open'), shift: measure.state.shift, anchor: measure.state.anchor,
    }))
  }

  function tick() {
    // Direct callers (feel/size/menu hooks) obey the same ownership rule as schedule().
    if (deps.isDragging() || deps.isFlying()) return
    const host = deps.getHost()
    if (host === null) return
    const info = readGeometry()
    if (info !== null && info.window && layoutStale(info.window)) {
      const at = typeof performance === 'object' ? performance.now() : Date.now()
      if (staleSince === null) staleSince = at
      if (at - staleSince < STALE_WAIT_MS) { lastKey = null; schedule(); return }
    }
    staleSince = null
    let next = measure.boxes(host)
    if (next === null) return
    measure.fitWindow(next.content, info?.window)
    const side = measure.sides()
    measure.pin(host, side, next.hostBox, next.contentBox)
    next = measure.boxes(host)
    if (next === null) return

    deps.setHitRects(next.hitShape)

    // Without known screen geometry, do not place from an invented (0, 0).
    if (info === null || !info.window) { lastKey = null; return }
    // X11 setBounds is asynchronous; wait until the page and native window agree.
    if (Math.abs(deps.windowObject.screenX - info.window.x) > 1
        || Math.abs(deps.windowObject.screenY - info.window.y) > 1) {
      lastKey = null
      schedule()
      return
    }
    const bounds = info.window
    const areas = info.workAreas ?? [info.workArea]
    // Recompute from the saved home each pass; never accumulate a previous predicted location.
    const grownX = side.horizontal === 'right' ? next.content.width - bounds.width : 0
    const grownY = side.vertical === 'bottom' ? next.content.height - bounds.height : 0
    /** @param {any} candidate */
    const decideFor = candidate => placement.decide({
      width: candidate.content.width,
      height: candidate.content.height,
      pig: candidate.pig,
      artMargin: artMarginFor(candidate.pig.width),
      visual: bodyVisualBounds(candidate.pig),
      pigWindow: { x: candidate.pigBox.x + grownX, y: candidate.pigBox.y + grownY },
      pigNow: { x: candidate.pigBox.x, y: candidate.pigBox.y },
      shift: measure.state.shift,
    }, bounds, areas)
    let want = decideFor(next)
    placement.persist(areas)

    // Clamp the window while shifting its contents by the same amount, preserving the pig's screen point.
    next = applyClamp(host, side, next)
    // Fit speech inside the current native frame, then measure the final shapes together.
    measure.fitBubble(host, info)
    next = measure.boxes(host)
    if (next === null) return
    deps.setHitRects(next.hitShape)

    // 猪必须完整落在窗口里，否则原生形状会把整只猪裁掉。偏移是拖动/抛掷叠出来的，
    // 归零后按家重摆：猪的屏幕位置不变，窗口挪到猪身上。
    // 窗口正在换尺寸时不抢跑：这一帧窗口比内容小是正常的，下一帧 decide 会把它放大。
    const settling = bounds.width >= next.content.width - TOLERANCE
      && bounds.height >= next.content.height - TOLERANCE
    if (settling && !pigInsideWindow(next.pigBox, bounds)) {
      const before = { window: bounds, pigBox: next.pigBox,
        shift: { ...measure.state.shift }, anchor: { ...measure.state.anchor } }
      next = rebaseOutsideWindow(host, side, next)
      want = decideFor(next)
      placement.persist(areas)
      next = applyClamp(host, side, next)
      measure.fitBubble(host, info)
      next = measure.boxes(host) ?? next
      deps.setHitRects(next.hitShape)
      lastKey = null
      console.warn('[piggy-desktop] pet outside window, rebased ' + JSON.stringify({
        before, window: bounds, pigBox: next.pigBox, home: placement.home(), shift: measure.state.shift,
        inside: pigInsideWindow(next.pigBox, bounds),
      }))
    }
    // 只记窗口尺寸已经跟内容对齐的帧：启动/换尺寸那一两帧窗口还小，
    // 猪只是暂时贴着上沿，不该在时间线上冒充「被画出 surface」。
    if (settling) logVisibility(host, next, bounds)

    const move = !sameBounds(want, bounds, TOLERANCE)
    const clampState = windowClamp.observe(want, bounds)
    if (clampState === 'accept') {
      const pig = pigInWindow(bounds)
      if (pig !== null) {
        placement.acceptWindow(bounds, pig, areas)
        const notice = JSON.stringify({ want, actual: bounds })
        if (clampNotice !== notice) {
          clampNotice = notice
          console.warn('[piggy-desktop] wm clamp accepted ' + notice)
        }
        lastKey = null
        shell.place({ bounds: { ...bounds } })
        return
      }
    }
    const key = measure.keyOf(next)
    if (!move && key === lastKey) return
    lastKey = key
    const request = { shape: next.shape, hitShape: next.hitShape, bounds: move ? want : undefined,
      pig: undefined, speech: undefined }
    const pigNode = host.querySelector('.dp-pig')
    if (pigNode) request.pig = layoutBox(pigNode)
    const speech = host.querySelector('.dp-bubble[data-bubble-side="below"]')
    request.speech = speech && !speech.hidden ? layoutBox(speech) : null
    if (move) {
      console.warn('[piggy-desktop] move ' + JSON.stringify({ open: host.getAttribute('data-open'), side,
        from: bounds, to: want, home: placement.home(), shift: measure.state.shift, anchor: measure.state.anchor,
        content: { w: next.content.width, h: next.content.height }, pigBox: next.pigBox,
        inside: pigInsideWindow(next.pigBox, bounds),
        intersect: pigVisibility(next.pigBox, bounds).intersect,
        ghosts: host.querySelectorAll('[data-ghost]').length, display: displayNote(info) }))
    }
    shell.place(request)
  }

  function commit(host, slide) {
    commitSlide(host, measure.state, slide)
  }

  return {
    readGeometry,
    pigInWindow,
    tick,
    schedule,
    recover: (foot, areas) => placement.recover(foot, areas),
    rehome: (win, pig, areas) => placement.rehome(win, pig, areas),
    commit,
    forget: () => { lastKey = null },
  }
}
