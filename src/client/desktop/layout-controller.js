// @ts-check
/** The single owner of one pet page's window measurement and placement loop. */
import { artMarginFor } from '../art-framing.js'
import { bodyVisualBounds } from './visual-bounds.js'
import { displayNote, sameBounds } from './geometry.js'
import { createMeasure, layoutBox } from './measure.js'
import { createPlacement } from './place.js'
import { createWindowClamp } from './window-clamp.js'
import { commitSlide } from './slide.js'

const TOLERANCE = 2
const STALE_WAIT_MS = 500

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
    const want = placement.decide({
      width: next.content.width,
      height: next.content.height,
      pig: next.pig,
      artMargin: artMarginFor(next.pig.width),
      visual: bodyVisualBounds(next.pig),
      pigWindow: { x: next.pigBox.x + grownX, y: next.pigBox.y + grownY },
      pigNow: { x: next.pigBox.x, y: next.pigBox.y },
      shift: measure.state.shift,
    }, bounds, areas)
    placement.persist(areas)

    // Clamp the window while shifting its contents by the same amount, preserving the pig's screen point.
    const clamp = placement.clamp()
    const old = measure.state.shift
    const fresh = { x: -clamp.dx, y: -clamp.dy }
    if (fresh.x !== old.x || fresh.y !== old.y) {
      measure.state.shift = fresh
      measure.pin(host, side, next.hostBox, next.contentBox)
      const dx = fresh.x - old.x
      const dy = fresh.y - old.y
      next.shape = next.shape.map(rect => ({ ...rect, x: rect.x + dx, y: rect.y + dy }))
      next.hitShape = next.hitShape.map(rect => ({ ...rect, x: rect.x + dx, y: rect.y + dy }))
    }
    // Fit speech inside the current native frame, then measure the final shapes together.
    measure.fitBubble(host, info)
    next = measure.boxes(host)
    if (next === null) return
    deps.setHitRects(next.hitShape)

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
        from: bounds, to: want, home: placement.home(), shift: measure.state.shift,
        content: { w: next.content.width, h: next.content.height }, pigBox: next.pigBox,
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
