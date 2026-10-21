// @ts-check
/**
 * A2 抛掷的窗口驱动：把 flight.js 算出的位置每帧发给外壳，让窗口跟着猪飞。
 *
 * 只负责「窗口跟着飞」；挤压、尘土、晕、声音由控制器通过回调决定。
 * 外壳没有 flyMove 时 start() 返回 false，控制器自动退回原地落地。
 * @module dsh-piggy/client/feel/flight-run
 */
import { artMarginFor } from '../art-framing.js'
import { workAreaBounds } from '../desktop/geometry.js'
import { createFlight } from '../desktop/flight.js'
import { FEEL } from './config.js'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * @param {{
 *   getShell: () => any,
 *   host: any,
 *   onStart: () => void,
 *   onImpact: (amount: number) => void,
 *   onDust: (count: number) => void,
 *   onTilt: (vx: number) => void,
 *   onSound: (key: string) => void,
 *   onFinish: (result: { dizzy: boolean, speed: number }) => void,
 * }} c
 */
export function createFlightRunner(c) {
  let state = null

  function finish(result) {
    const current = state
    if (current === null) return
    state = null
    if (current.raf) cancelAnimationFrame(current.raf)
    try {
      current.shell.flight.finish?.({
        window: current.lastWindow,
        pig: current.start.pig,
        slide: current.slide,
        areas: current.start.areas,
      })
    } catch (error) {
      // 收尾失败也要让猪落地：不能因为重定家出错就把飞行状态卡住。
      console.error('[dsh-piggy] 抛掷落地收尾失败', error)
    }
    c.host.style.translate = ''
    if (result !== null) c.onFinish(result)
  }

  function step(now) {
    if (state === null) return
    const current = state
    const dt = Math.min(50, Math.max(0, now - current.lastTime))
    current.lastTime = now
    const events = current.body.advance(dt)
    // 晕的判定可能在第一次重摔时就已经发生；要跨帧记住，别被最后一帧的 land 覆盖。
    let dizzy = current.dizzy === true
    let landSpeed = 0
    for (const event of events) {
      if (event.type === 'bounce') {
        c.onImpact(0.06 * current.scale)
        c.onDust(clamp(Math.round((event.speed || 0) / 800), 1, 3))
        c.onSound('bounce')
      } else if (event.type === 'dizzy') {
        current.dizzy = true
        dizzy = true
      } else if (event.type === 'land') {
        landSpeed = event.speed || 0
        c.onImpact(current.body.impactFor(landSpeed) * current.scale)
        c.onDust(current.body.dustFor(landSpeed))
        c.onSound(landSpeed > 900 ? 'land-hard' : 'land-soft')
      }
    }
    c.onTilt(current.body.vx)
    const width = current.start.window.width
    const height = current.start.window.height
    const local = current.start.pig
    const desiredX = current.body.x - (local.x + local.width / 2)
    const desiredY = current.body.y - (local.y + local.height)
    const clampedX = clamp(desiredX, current.viewport.x, Math.max(current.viewport.x, current.viewport.x + current.viewport.width - width))
    const clampedY = clamp(desiredY, current.viewport.y, Math.max(current.viewport.y, current.viewport.y + current.viewport.height - height))
    current.slide = { x: desiredX - clampedX, y: desiredY - clampedY }
    current.lastWindow = { x: clampedX, y: clampedY }
    current.shell.flight.move?.(clampedX, clampedY, current.slide)
    c.host.style.translate = current.slide.x === 0 && current.slide.y === 0 ? ''
      : current.slide.x + 'px ' + current.slide.y + 'px'
    if (current.body.done) {
      finish({ dizzy: dizzy || (current.body.landed && landSpeed > FEEL.dizzyImpact), speed: landSpeed })
      return
    }
    current.raf = requestAnimationFrame(step)
  }

  return {
    /** @param {number} vx @param {number} vy @param {number} [scale] */
    start: function (vx, vy, scale) {
      const shell = c.getShell()
      if (shell?.flight?.supported !== true) return false
      const start = shell.flight.start()
      if (start === null || start === undefined || !start.area) return false
      const body = createFlight({
        x: start.home.x, y: start.home.y, vx: vx, vy: vy,
        area: start.area, areas: start.areas, pig: start.pig, artMargin: artMarginFor(start.pig.width),
      })
      state = {
        body: body, start: start, shell: shell,
        viewport: workAreaBounds(start.areas, start.area),
        lastWindow: { x: start.window.x, y: start.window.y },
        slide: { x: 0, y: 0 },
        raf: requestAnimationFrame(step),
        lastTime: performance.now(),
        scale: Number.isFinite(scale) ? scale : 1,
        dizzy: false,
      }
      shell.flight.setFlying?.(true)
      c.onStart()
      c.onSound('toss')
      return true
    },
    /** 空中接住：停住并重定家，不播放落地冲击。 */
    catch: function () {
      if (state === null) return false
      state.body.stop()
      finish(null)
      return true
    },
    cancel: function () {
      if (state === null) return
      state.body.stop()
      finish(null)
    },
    isFlying: function () { return state !== null },
    setScale: function (value) { if (state !== null) state.scale = value },
    dispose: function () { finish(null) },
  }
}
