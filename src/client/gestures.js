// @ts-check
/**
 * 猪的手势：单击 / 来回摸 / 拖动 / 拎起 / 空中接住。
 *
 * 和旧实现的区别：pointerdown 不再立刻让窗口跟手。净位移超过 4px 才
 * beginDrag（网页版也才改 right/bottom），超过 6px 才拎起拉长。这样来回摸
 * 不会把猪推着走，单击也不会让窗口抖一下。
 * @module dsh-piggy/client/gestures
 */
import { beginPetSnap, releasePetSnap, cancelPetSnap } from './pet-snap.js'
import { startDragHeartbeat } from './drag-heartbeat.js'
import { FEEL } from './feel/config.js'
import { recentVelocity } from './feel/velocity.js'
import { partAt } from './pet-parts.js'
import { playSound, unlockSound } from './sound.js'
import { hitsPig } from './hit-regions.js'

function pointerScreen(event) {
  return {
    x: typeof event.screenX === 'number' ? event.screenX : event.clientX,
    y: typeof event.screenY === 'number' ? event.screenY : event.clientY,
  }
}

/**
 * @param {{
 *   scene:any, host:any, pig:any, feel:any,
 *   getView:()=>any, send:(action:string, extra?:any, options?:{petAnimated?:boolean})=>void, pokeBox:()=>void,
 *   getRight:()=>number, setRight:(n:number)=>void,
 *   getBottom:()=>number, setBottom:(n:number)=>void,
 *   clampPig:()=>void, fitPanel:()=>void,
 *   desktopShell:()=>any, isDesktop:boolean, writePosition:()=>void,
 *   isPanelOpen?:()=>boolean,
 * }} c
 */
export function attachGestures(c) {
  let drag = null
  let stopHeartbeat = function () {}

  function velocity() {
    if (drag === null) return { vx: 0, vy: 0 }
    return recentVelocity(drag.samples, performance.now())
  }

  /** 越过 4px 才让窗口开始动；把 pointerdown 的屏幕坐标带给外壳当起点。 */
  function beginWindowDrag() {
    if (drag === null || drag.started) return
    c.scene.setAttribute('data-window-dragging', 'true')
    cancelPetSnap(c.pig)
    drag.started = true
    drag.moved = true
    const shell = c.desktopShell()
    if (shell !== null && typeof shell.beginDrag === 'function') {
      shell.beginDrag({ x: drag.startScreenX, y: drag.startScreenY })
      stopHeartbeat = startDragHeartbeat(shell, function () { return drag !== null && drag.started })
    } else if (shell !== null) {
      // 0.2.1 旧外壳只有 moveBy：仍按屏幕增量挪，没有窗口会话。
      drag.legacy = true
      drag.lastX = drag.startX
      drag.lastY = drag.startY
    } else {
      // 网页版：4px 之后才真正开始移动；位移仍从 pointerdown 算起，越过阈值这一下不丢。
      drag.startClientX = drag.x
      drag.startClientY = drag.y
    }
    c.feel.setDragging(true)
  }

  /** @param {{x:number,y:number}|null} [release] 松手时的屏幕坐标：外壳用它算最后一帧 slide。 */
  function endDrag(release) {
    if (drag === null) return null
    const info = drag
    drag = null
    stopHeartbeat()
    stopHeartbeat = function () {}
    if (info.started) c.desktopShell()?.endDrag?.(release ?? null)
    c.scene.removeAttribute('data-window-dragging')
    c.feel.setDragging(false)
    c.scene.removeAttribute('data-dragging')
    c.clampPig()
    if (!c.isDesktop) c.writePosition()
    c.fitPanel()
    return info.started ? info : null
  }

  function onPointerDown(event) {
    if (event.button !== 0 || drag !== null) return
    if (!hitsPig(c.host, event)) return
    stopHeartbeat()
    stopHeartbeat = function () {}
    const screen = pointerScreen(event)
    // 飞行中点到猪：先接住，再按普通拖动开始。
    c.feel.catchFlight()
    // 拿起/戳/点都算一次互动：刷新 core 的 lastActiveAt（后台动作，不占 busy），
    // 睡着的猪会醒来并换回清醒立绘。纸盒不送，避免打扰拆盒流程。
    c.feel.wake?.()
    if (c.getView().hatched === true) c.send('touch')
    const snap = beginPetSnap(c.pig)
    if (!snap) c.feel.press()
    unlockSound()
    drag = {
      x: event.clientX, y: event.clientY,
      lastClientX: event.clientX, lastClientY: event.clientY,
      startX: screen.x, startY: screen.y,
      startScreenX: screen.x, startScreenY: screen.y,
      lastScreenX: screen.x, lastScreenY: screen.y,
      lastX: screen.x, lastY: screen.y,
      // 用实际显示的位置（可能已被 clampPig 夹过），不是用户设的原始值。
      right: parseFloat(getComputedStyle(c.host).right) || c.getRight(),
      bottom: parseFloat(getComputedStyle(c.host).bottom) || c.getBottom(),
      snap, moved: false, started: false, lifted: false, patted: false, legacy: false,
      path: 0, pathStart: performance.now(), lastStroke: 0,
      samples: [{ t: performance.now(), x: screen.x, y: screen.y }],
    }
    c.scene.setAttribute('data-dragging', 'true')
    c.scene.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event) {
    if (drag === null) return
    const screen = pointerScreen(event)
    const now = performance.now()
    const net = Math.hypot(screen.x - drag.startX, screen.y - drag.startY)
    drag.lastClientX = event.clientX
    drag.lastClientY = event.clientY
    drag.samples.push({ t: now, x: screen.x, y: screen.y })
    while (drag.samples.length > 16 || (drag.samples.length > 2 && now - drag.samples[0].t > 240)) drag.samples.shift()

    if (!drag.started && net < FEEL.dragPx) {
      // 还没到拖动阈值：累计「来回摸」的路径长度（只看路径，不看终点）。
      const step = Math.hypot(screen.x - drag.lastScreenX, screen.y - drag.lastScreenY)
      drag.lastScreenX = screen.x
      drag.lastScreenY = screen.y
      if (now - drag.pathStart > FEEL.strokeWindowMs) { drag.path = 0; drag.pathStart = now }
      drag.path += step
      if (drag.path >= FEEL.strokePx && now - drag.lastStroke > FEEL.strokeCooldownMs) {
        drag.path = 0
        drag.pathStart = now
        drag.lastStroke = now
        drag.patted = true
        playSound('purr')
        const view = c.getView()
        if (view.hatched === true && !view.dead) c.send('pet', { part: partAt(c.pig, event) }, { petAnimated: drag.snap })
      }
      return
    }
    if (!drag.started) {
      beginWindowDrag()
      drag.lastScreenX = screen.x
      drag.lastScreenY = screen.y
    }
    if (net > FEEL.liftPx && !drag.lifted) {
      drag.lifted = true
      c.feel.lift()
    }
    const speed = velocity()
    c.feel.move(speed.vx)

    const shell = c.desktopShell()
    if (shell !== null) {
      if (typeof shell.beginDrag === 'function') shell.dragHeartbeat?.()
      else if (typeof shell.moveBy === 'function' && drag.legacy) {
        const stepX = screen.x - drag.lastX
        const stepY = screen.y - drag.lastY
        drag.lastX = screen.x
        drag.lastY = screen.y
        if (stepX !== 0 || stepY !== 0) shell.moveBy(stepX, stepY)
      }
      return
    }
    c.setRight(drag.right - (event.clientX - drag.startClientX))
    c.setBottom(drag.bottom - (event.clientY - drag.startClientY))
    c.clampPig()
    c.fitPanel()
  }

  function onPointerUp(event) {
    if (drag === null) return
    // 面板开着时猪窗口在面板下面：抛出去会飞到面板背后看不见。
    // 直接按「放下」处理，面板在 endDrag 里重新贴到猪旁边。
    const speed = c.isPanelOpen?.() === true ? { vx: 0, vy: 0 } : velocity()
    const started = drag.started
    const patted = drag.patted
    const snap = drag.snap
    endDrag(pointerScreen(event))
    if (started) {
      c.feel.release({ vx: speed.vx, vy: speed.vy, dragged: true })
      return
    }
    const view = c.getView()
    if (view.hatched !== true) {
      c.pokeBox()
      c.feel.release({ vx: 0, vy: 0 })
      return
    }
    // 来回摸已经触发过就不再补一次单击。
    if (snap) releasePetSnap(c.pig)
    if (!patted && !view.dead) c.send('pet', { part: partAt(c.pig, event) }, { petAnimated: snap })
    if (!snap) c.feel.release({ vx: 0, vy: 0 })
  }

  function onPointerCancel() {
    if (drag === null) return
    const started = drag.started
    cancelPetSnap(c.pig)
    endDrag()
    c.feel.release({ vx: 0, vy: 0, dragged: started })
  }

  c.scene.addEventListener('pointerdown', onPointerDown)
  c.scene.addEventListener('pointermove', onPointerMove)
  c.scene.addEventListener('pointerup', onPointerUp)
  c.scene.addEventListener('pointercancel', onPointerCancel)
  c.scene.addEventListener('lostpointercapture', onPointerCancel)

  return {
    isDragging: function () { return drag !== null },
    dispose: function () {
      c.scene.removeEventListener('pointerdown', onPointerDown)
      c.scene.removeEventListener('pointermove', onPointerMove)
      c.scene.removeEventListener('pointerup', onPointerUp)
      c.scene.removeEventListener('pointercancel', onPointerCancel)
      c.scene.removeEventListener('lostpointercapture', onPointerCancel)
      stopHeartbeat()
      c.scene.removeAttribute('data-window-dragging')
      drag = null
    },
  }
}
