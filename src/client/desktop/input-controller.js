// @ts-check
/**
 * Own the pet renderer's current pointer, hit rectangles and legacy hit bit.
 * Drawing-shape submission remains delegated to the shell and hit-tracking.
 */
import { startHitTracking } from './hit-tracking.js'

/**
 * @param {{shell:any, documentObject:Document, windowObject:Window,
 *   getHost:()=>any, blocked:()=>boolean, trackingBlocked?:()=>boolean,
 *   leaveBlocked?:()=>boolean}} deps
 */
export function createInputController(deps) {
  let hitRects = []
  let lastHit = null
  let mouse = { x: -1, y: -1 }
  let mousemoveInstalled = false
  let mouseleaveInstalled = false
  let stopTracking = null

  function updateHit(x, y) {
    mouse = { x, y }
    if (typeof deps.shell.setHit !== 'function') return
    let inside = deps.blocked()
    for (let i = 0; !inside && i < hitRects.length; i += 1) {
      const rect = hitRects[i]
      inside = x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
    }
    if (inside === lastHit) return
    lastHit = inside
    deps.shell.setHit(inside)
  }

  function setHitRects(rects) {
    hitRects = Array.isArray(rects) ? rects : []
    if (mouse.x >= 0) updateHit(mouse.x, mouse.y)
  }

  function onMouseMove(event) {
    updateHit(event.clientX, event.clientY)
  }

  function onMouseLeave() {
    if ((deps.leaveBlocked ?? deps.blocked)()) return
    mouse = { x: -1, y: -1 }
    lastHit = false
    if (typeof deps.shell.setHit === 'function') deps.shell.setHit(false)
  }

  function install() {
    if (!mousemoveInstalled) {
      deps.documentObject.addEventListener('mousemove', onMouseMove, true)
      mousemoveInstalled = true
    }
    if (!mouseleaveInstalled) {
      deps.documentObject.documentElement.addEventListener('mouseleave', onMouseLeave)
      mouseleaveInstalled = true
    }
  }

  function startTracking() {
    if (stopTracking !== null) return
    stopTracking = startHitTracking({
      host: deps.getHost,
      shell: deps.shell,
      // Geometry capture pauses hit-shape polling during native drag only;
      // flying still refreshes the drawing hit shape while setHit stays gated.
      blocked: deps.trackingBlocked ?? deps.blocked,
      onShape: setHitRects,
      windowObject: deps.windowObject,
    })
  }

  function dispose() {
    if (stopTracking !== null) {
      stopTracking()
      stopTracking = null
    }
    if (mousemoveInstalled) {
      deps.documentObject.removeEventListener('mousemove', onMouseMove, true)
      mousemoveInstalled = false
    }
    if (mouseleaveInstalled) {
      deps.documentObject.documentElement.removeEventListener('mouseleave', onMouseLeave)
      mouseleaveInstalled = false
    }
  }

  return { install, startTracking, setHitRects, updateHit, dispose }
}
