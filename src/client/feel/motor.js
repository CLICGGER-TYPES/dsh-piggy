// @ts-check
/**
 * Motion 适配层：把所有弹簧通道收在这里，控制器只设目标值。
 *
 * 用 motion@14 的 springValue / motionValue / transformValue / styleEffect，
 * 不手写弹簧求解器。空闲时没有活动动画，Motion 的帧循环自己停。
 * @module dsh-piggy/client/feel/motor
 */
import { animate, motionValue, springValue, styleEffect, transformValue } from 'motion'

import { FEEL } from './config.js'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * @param {any} pigHold
 * @param {any} pigBody
 */
export function createMotor(pigHold, pigBody) {
  try {
    const pressTarget = motionValue(0)
    const press = springValue(pressTarget, { ...FEEL.press })
    const holdTarget = motionValue(0)
    const hold = springValue(holdTarget, { ...FEEL.hold })
    const tiltTarget = motionValue(0)
    const tilt = springValue(tiltTarget, { ...FEEL.tilt })
    const impact = motionValue(0)
    const flip = motionValue(0)
    let impactAnimation = null
    let flipAnimation = null
    let disposed = false

    const holdTransform = transformValue(function () {
      const h = clamp(hold.get(), -0.2, 0.24)
      return 'scale(' + (1 - FEEL.holdNarrow * h).toFixed(4) + ',' + (1 + h).toFixed(4) + ')'
    })
    const bodyTransform = transformValue(function () {
      // 夹一层安全范围：弹簧被打断/帧时间异常时，宁可停在极限姿态也不能让
      // scale 变成负数或几百倍（否则整只猪会翻转、消失）。
      const squash = clamp(press.get() + impact.get(), -0.3, 0.3)
      const progress = clamp(flip.get(), 0, 1)
      const facing = Math.cos(Math.PI * progress)
      const bulge = 1 + FEEL.turnBulge * Math.sin(Math.PI * progress)
      const sx = (1 + FEEL.volumeK * squash) * facing
      const sy = (1 - squash) * bulge
      return 'rotate(' + clamp(tilt.get(), -30, 30).toFixed(3) + 'deg) scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')'
    })
    const stopHold = styleEffect(pigHold, { transform: holdTransform })
    const stopBody = styleEffect(pigBody, { transform: bodyTransform })

    return {
      pressTarget: function (value) { pressTarget.set(value) },
      holdTarget: function (value) { holdTarget.set(value) },
      tiltTarget: function (value) { tiltTarget.set(value) },
      pressValue: function () { return press.get() },
      holdValue: function () { return hold.get() },
      tiltValue: function () { return tilt.get() },
      impactValue: function () { return impact.get() },
      flipValue: function () { return flip.get() },
      targetValue: function () { return [pressTarget.get(), holdTarget.get(), tiltTarget.get(), impact.get()] },

      /** 落地/撞边：先跳到压缩量，再让弹簧从压缩位置弹回。 */
      impulse: function (amount) {
        if (disposed) return
        impactAnimation?.stop?.()
        impact.set(clamp(amount, 0, FEEL.squashMax))
        // 明确从 0 初速度释放：不要继承上一次弹簧中途的速度，连续反弹时
        // 每次重新起跳会把速度越叠越大。
        impactAnimation = animate(impact, 0, { type: 'spring', ...FEEL.impact, velocity: 0 })
      },

      /**
       * 翻卡片：0 = 朝左，1 = 朝右；中途反向从当前进度继续。
       * @param {number} target
       * @param {(done: boolean) => void} onDone
       */
      flipTo: function (target, onDone) {
        flipAnimation?.stop?.()
        flipAnimation = animate(flip, target, { duration: FEEL.turnMs / 1000, ease: 'easeInOut' })
        const controls = flipAnimation
        Promise.resolve(controls).then(function () {
          if (flipAnimation === controls) flipAnimation = null
          onDone(true)
        }, function () { onDone(false) })
        return flipAnimation
      },
      stopFlip: function () {
        flipAnimation?.stop?.()
        flipAnimation = null
      },
      resetFlip: function () { flip.set(0) },

      settled: function () {
        if (flipAnimation !== null) return false
        if (Math.abs(flip.get()) > 0.001) return false
        const targets = [pressTarget.get(), holdTarget.get(), tiltTarget.get(), impact.get()]
        if (targets.some(value => Math.abs(value) > FEEL.settleEpsilon)) return false
        if (Math.abs(press.get()) > FEEL.settleEpsilon) return false
        if (Math.abs(hold.get()) > FEEL.settleEpsilon) return false
        if (Math.abs(impact.get()) > FEEL.settleEpsilon) return false
        if (Math.abs(tilt.get()) > FEEL.settleTilt) return false
        return true
      },

      dispose: function () {
        disposed = true
        impactAnimation?.stop?.()
        flipAnimation?.stop?.()
        stopHold?.()
        stopBody?.()
        pressTarget.destroy?.()
        holdTarget.destroy?.()
        tiltTarget.destroy?.()
        impact.destroy?.()
        flip.destroy?.()
      },
    }
  } catch (error) {
    console.warn('[dsh-piggy] 手感初始化失败，退回现有 CSS 动画', error)
    return null
  }
}
