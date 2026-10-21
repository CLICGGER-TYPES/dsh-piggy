// @ts-check
/**
 * A1 原地手感 + A2 抛出的控制器。
 *
 * 只对整只猪做 transform：按压、拎起拉长、拖动倾斜、落地挤压、翻卡片、
 * 动作图切换遮挡、来回摸。PNG、布局、存档都不动。
 *
 * 弹簧在 feel/motor.js（Motion，MIT），弹道在 desktop/flight.js，
 * 窗口跟飞在 feel/flight-run.js。旧外壳没有 flyMove 时自动退回原地落地。
 * @module dsh-piggy/client/feel
 */
import { clearEffectArt, showEffectArt, syncPigArt } from '../art.js'
import { playSound } from '../sound.js'
import { FEEL, modeScale } from './config.js'
import { createDizzy } from './dizzy.js'
import { createFlightRunner } from './flight-run.js'
import { createMotor } from './motor.js'
import { effectiveFeelMode, onFeelModeChange } from './settings.js'
import { createSettle } from './settle.js'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function canAnimate() {
  try {
    return typeof window !== 'undefined'
      && (typeof window.requestAnimationFrame === 'function' || typeof globalThis.requestAnimationFrame === 'function')
  } catch {
    return false
  }
}

/**
 * @param {{
 *   pig: any, pigHold: any, pigBody: any, scene: any, host: any,
 *   pigArt: any, pigEmoji: any,
 *   burst: (emojis: string[], count: number) => void,
 *   getShell: () => any,
 *   isQuiet?: () => boolean,
 *   onGeometry?: () => void,
 * }} deps
 */
export function createFeel(deps) {
  const pig = deps.pig
  const pigHold = deps.pigHold
  const pigBody = deps.pigBody
  const host = deps.host
  const getShell = deps.getShell
  const onGeometry = deps.onGeometry ?? function () {}

  const motor = canAnimate() ? createMotor(pigHold, pigBody) : null
  let mode = motor === null ? 'off' : effectiveFeelMode()
  let disposed = false
  let flashing = false
  let swapTimer = null
  let pendingSwap = null
  let crouchTimer = null
  let tapTimer = null
  let wakeTimer = null
  /** 刚被拿起：即使宿主的 sleepy 快照还没回来，也先按清醒幅度演。 */
  let justWoke = false
  let lifted = false
  let liftSoundPlayed = false
  let dragging = false
  let flipToken = 0
  /** 逻辑朝向（data-walk 的状态），和翻面进度分开记，避免「同方向再翻一次」。 */
  let facing = (pig.getAttribute('data-walk') || '') === 'right' ? 'right' : 'left'
  /** 这次翻面开始时的逻辑朝向：进度 1 表示翻到另一边，0 表示取消。 */
  let flipFrom = facing

  function scale() {
    return modeScale(mode)
  }

  function enabled() {
    return motor !== null && !disposed && mode !== 'off'
  }

  function sleeping() {
    if (justWoke) return false
    return (pig.getAttribute('data-idle') || '') === 'nap' || (pig.getAttribute('data-mood') || '') === 'sleepy'
  }

  /** 拿起/戳一下：先停掉打盹小动作，并按清醒幅度演；真正的 mood 由 core 的 touch 快照刷新。 */
  function wake() {
    if (pig.getAttribute('data-idle') === 'nap') {
      pig.removeAttribute('data-idle')
      syncPigArt(pig, deps.pigArt, deps.pigEmoji)
    }
    justWoke = true
    if (wakeTimer !== null) clearTimeout(wakeTimer)
    wakeTimer = setTimeout(function () {
      wakeTimer = null
      justWoke = false
    }, 1500)
  }

  function restingFactor() {
    return sleeping() ? 0.5 : 1
  }

  function immobileStage() {
    const stage = pig.getAttribute('data-stage') || ''
    const mood = pig.getAttribute('data-mood') || ''
    return stage === 'box' || stage === 'grave' || stage === 'dead-day' || mood === 'dead'
  }

  // ---- 回稳与包络 ----

  const settle = createSettle({
    pig: pig, pigHold: pigHold, pigBody: pigBody,
    getMotor: function () { return motor },
    onGeometry: onGeometry,
  })

  function setMode(next) {
    mode = next
    if (mode !== 'off' || motor === null) return
    runner.cancel()
    motor.pressTarget(0)
    motor.holdTarget(0)
    motor.tiltTarget(0)
    motor.impulse(0)
    motor.stopFlip()
    motor.resetFlip()
    pig.removeAttribute('data-feel-flip')
    settle.reset()
    cancelSwap()
  }

  // ---- 按压 / 拎起 / 倾斜 / 松手 ----

  function pressPig() {
    if (!enabled() || immobileStage() || runner.isFlying()) return
    dizzyFx.cancel()
    lifted = false
    liftSoundPlayed = false
    motor.pressTarget(FEEL.pressSquash * scale() * restingFactor())
    playSound('tap')
    settle.begin()
  }

  function liftPig() {
    if (!enabled() || immobileStage() || runner.isFlying()) return
    lifted = true
    motor.holdTarget(FEEL.holdMax * scale() * restingFactor())
    motor.pressTarget(0)
    if (!liftSoundPlayed && !sleeping()) {
      playSound('lift')
      liftSoundPlayed = true
    }
    settle.begin()
  }

  function movePig(vx) {
    if (!enabled() || immobileStage() || runner.isFlying()) return
    const limit = FEEL.tiltMaxDrag * scale() * restingFactor()
    motor.tiltTarget(clamp(-(Number(vx) || 0) * FEEL.tiltGain, -limit, limit))
    settle.begin()
  }

  function applyImpact(amount) {
    if (!enabled()) return
    motor.impulse(clamp(amount, 0, FEEL.squashMax))
    settle.begin()
  }

  function burstDust(count) {
    deps.burst(['💨', '💨', '✨'], Math.max(1, Math.round(count * (mode === 'soft' ? 0.5 : 1))))
  }

  function releasePig(options) {
    if (!enabled()) return 'off'
    dragging = false
    const vx = Number(options?.vx) || 0
    const vy = Number(options?.vy) || 0
    const speed = Math.hypot(vx, vy)
    motor.holdTarget(0)
    motor.tiltTarget(0)
    motor.pressTarget(0)
    if (lifted && speed >= FEEL.throwMin && runner.start(vx, vy, scale())) return 'throw'
    if (lifted || options?.dragged === true) {
      applyImpact(clamp(0.04 + speed / 9000, 0.04, FEEL.squashMax))
      if (speed > 240) {
        burstDust(clamp(Math.round(speed / 600), 1, 3))
        playSound(speed > 900 ? 'land-hard' : 'land-soft', { soft: mode === 'soft' })
      }
    } else if (tapTimer === null) {
      // 单击：等 250ms 看宿主会不会回 data-react="pet"；没回来就自己轻弹一下。
      tapTimer = setTimeout(function () {
        tapTimer = null
        if (disposed || pig.getAttribute('data-react') !== null) return
        applyImpact(0.06 * scale())
      }, 250)
    }
    settle.schedule(900)
    return 'drop'
  }

  function tap() {
    if (!enabled() || immobileStage()) return
    applyImpact(0.06 * scale())
    playSound('tap')
  }

  function crouch(ms) {
    if (!enabled() || immobileStage()) return
    motor.pressTarget(FEEL.pressSquash * 2 * scale() * restingFactor())
    if (crouchTimer !== null) clearTimeout(crouchTimer)
    crouchTimer = setTimeout(function () {
      crouchTimer = null
      motor.pressTarget(0)
    }, ms ?? 120)
    settle.begin()
  }

  const dizzyFx = createDizzy({
    pig: pig, pigArt: deps.pigArt, pigEmoji: deps.pigEmoji,
    burst: deps.burst, getMode: function () { return mode },
  })

  // ---- 翻卡片 ----

  function applyFacing(direction) {
    facing = direction
    if (direction === 'right') pig.setAttribute('data-walk', 'right')
    else pig.removeAttribute('data-walk')
  }

  /** @param {'left'|'right'|null} direction */
  function face(direction) {
    if (!enabled()) {
      if (disposed) return
      if (direction === 'right' || direction === 'left') applyFacing(direction)
      return
    }
    if (direction === null) {
      flipToken += 1
      motor.stopFlip()
      pig.removeAttribute('data-feel-flip')
      motor.resetFlip()
      applyFacing(facing)
      return
    }
    // 已经朝这个方向、也没有正在翻：不重复翻。
    if (direction === facing && Math.abs(motor.flipValue()) < 0.001) {
      applyFacing(direction)
      return
    }
    // 每次翻面都从进度 0 走到 1：外层镜像翻到另一边，结束时同一帧切 data-walk 并归零。
    // 中途反向就按当前进度往回走（回到 0 = 取消这次翻面）。
    flipToken += 1
    const token = flipToken
    const wasFlipping = Math.abs(motor.flipValue()) > 0.001
    if (!wasFlipping) flipFrom = facing
    const target = direction === flipFrom ? 0 : 1
    pig.setAttribute('data-feel-flip', 'true')
    playSound('flip', { soft: mode === 'soft' })
    settle.begin()
    motor.flipTo(target, function (done) {
      if (!done || token !== flipToken || disposed) return
      if (target === 1) applyFacing(direction)
      else applyFacing(flipFrom)
      pig.removeAttribute('data-feel-flip')
      motor.resetFlip()
      settle.schedule(600)
    })
  }

  // ---- 动作图切换遮挡 ----

  function cancelSwap() {
    if (swapTimer !== null) clearTimeout(swapTimer)
    swapTimer = null
    pendingSwap = null
    if (flashing) {
      flashing = false
      motor?.pressTarget(0)
    }
  }

  function coverSwap(apply) {
    if (typeof apply !== 'function') return
    if (!enabled() || dragging || runner.isFlying()
      || pig.getAttribute('data-pet-snap') === 'true'
      || pig.getAttribute('data-react') !== null
      || pig.getAttribute('data-micro-action') !== null) {
      apply()
      return
    }
    pendingSwap = apply
    if (swapTimer !== null) return
    flashing = true
    motor.pressTarget((FEEL.pressSquash + 0.015) * scale())
    settle.begin()
    swapTimer = setTimeout(function () {
      swapTimer = null
      const run = pendingSwap
      pendingSwap = null
      flashing = false
      if (run !== null) run()
      motor.pressTarget(0)
      settle.schedule(650)
    }, FEEL.swapApplyMs)
  }

  // ---- 抛出 ----

  const runner = createFlightRunner({
    getShell: getShell,
    host: host,
    onStart: function () { settle.begin() },
    onImpact: applyImpact,
    onDust: burstDust,
    onTilt: function (vx) {
      if (motor === null) return
      const limit = FEEL.tiltMaxFly * scale()
      motor.tiltTarget(clamp(-vx * FEEL.tiltGain, -limit, limit))
    },
    onSound: function (key) { playSound(key, { soft: mode === 'soft' }) },
    onFinish: function (result) {
      if (motor !== null) motor.tiltTarget(0)
      if (result.dizzy) dizzyFx.trigger()
      settle.schedule(900)
    },
  })

  function catchFlight() {
    if (!runner.catch()) return false
    applyImpact(0.06 * scale())
    playSound('catch', { soft: mode === 'soft' })
    return true
  }

  // ---- 事件与生命周期 ----

  function onAnimationEnd(event) {
    const name = event?.animationName
    if (name === 'dp-jump' || name === 'dp-feed-hop' || name === 'dp-play-hop') applyImpact(0.075 * scale())
  }
  pig.addEventListener?.('animationend', onAnimationEnd)

  let stopPreference = function () {}
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)')
      const onChange = function () { setMode(effectiveFeelMode()) }
      query.addEventListener?.('change', onChange)
      stopPreference = function () { query.removeEventListener?.('change', onChange) }
    }
  } catch { /* 没有 matchMedia 就不跟 */ }

  const stopModeListener = onFeelModeChange(function (next) { setMode(next) })

  return {
    ready: function () { return motor !== null },
    mode: function () { return mode },
    wake: wake,
    press: pressPig,
    lift: liftPig,
    move: movePig,
    release: releasePig,
    tap: tap,
    crouch: crouch,
    impact: function (amount) { applyImpact(typeof amount === 'number' ? amount : 0.09) },
    face: face,
    coverSwap: coverSwap,
    dizzy: function () { dizzyFx.trigger() },
    cancelDizzy: function () { dizzyFx.cancel() },
    isFlying: function () { return runner.isFlying() },
    catchFlight: catchFlight,
    setDragging: function (on) { dragging = on === true },
    dispose: function () {
      disposed = true
      stopModeListener()
      stopPreference()
      runner.dispose()
      settle.dispose()
      settle.reset()
      cancelSwap()
      if (crouchTimer !== null) clearTimeout(crouchTimer)
      if (tapTimer !== null) clearTimeout(tapTimer)
      if (wakeTimer !== null) clearTimeout(wakeTimer)
      crouchTimer = null
      tapTimer = null
      wakeTimer = null
      dizzyFx.dispose()
      pig.removeEventListener?.('animationend', onAnimationEnd)
      motor?.dispose()
      pig.removeAttribute('data-feel')
      pig.removeAttribute('data-feel-flip')
      pigBody.style.willChange = ''
      pigHold.style.willChange = ''
    },
  }
}
