// @ts-check
/**
 * 物理层的活跃标记与回稳收尾。
 *
 * data-feel="active|settle" 让桌面测量把固定物理包络算进可点/可见区域；
 * 弹簧完全回正后才移除，否则回弹尾巴会被裁。回稳期间不跑 rAF，只用
 * setTimeout 检查，空闲时没有任何循环。
 * @module dsh-piggy/client/feel/settle
 */
import { FEEL } from './config.js'

/**
 * @param {{
 *   pig:any, pigHold:any, pigBody:any,
 *   getMotor: () => any,
 *   onGeometry: () => void,
 * }} c
 */
export function createSettle(c) {
  let active = false
  let timer = null
  let attempts = 0
  let finishTimer = null
  let disposed = false

  function clear() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function finish() {
    clear()
    if (!active) return
    if (finishTimer !== null) clearTimeout(finishTimer)
    c.pig.setAttribute('data-feel', 'settle')
    c.onGeometry()
    finishTimer = setTimeout(function () {
      finishTimer = null
      if (disposed) return
      c.pig.removeAttribute('data-feel')
      active = false
      c.pigBody.style.willChange = ''
      c.pigHold.style.willChange = ''
      c.onGeometry()
    }, 220)
  }

  function check() {
    timer = null
    const motor = c.getMotor()
    if (disposed || motor === null) return
    if (!motor.settled()) {
      attempts += 1
      if (attempts < 24) timer = setTimeout(check, 180)
      else finish()
      return
    }
    finish()
  }

  function schedule(delay) {
    clear()
    attempts = 0
    timer = setTimeout(check, delay ?? 700)
  }

  return {
    begin: function () {
      if (finishTimer !== null) { clearTimeout(finishTimer); finishTimer = null }
      if (!active) {
        active = true
        c.pigBody.style.willChange = 'transform'
        c.pigHold.style.willChange = 'transform'
        c.onGeometry()
      }
      if (c.pig.getAttribute('data-feel') !== 'active') c.pig.setAttribute('data-feel', 'active')
      schedule(800)
    },
    schedule: schedule,
    clear: clear,
    finish: finish,
    isActive: function () { return active },
    reset: function () {
      clear()
      if (finishTimer !== null) clearTimeout(finishTimer)
      finishTimer = null
      c.pig.removeAttribute('data-feel')
      c.pigBody.style.willChange = ''
      c.pigHold.style.willChange = ''
      active = false
    },
    dispose: function () {
      disposed = true
      clear()
      if (finishTimer !== null) clearTimeout(finishTimer)
      finishTimer = null
    },
  }
}
