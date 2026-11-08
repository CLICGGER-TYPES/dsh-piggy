// @ts-check
/**
 * 番茄钟的本地秒针。
 *
 * 服务端每 POLL_MS（4 秒）才报一次剩余秒数，只靠它的话倒计时是一段一段跳的。
 * 这里每拿到一份新快照就按它重新对表（以服务端为准），之后本地每秒走一格，
 * 只改倒计时那几个字，不重画面板；走到 0 马上找服务端结算。
 * @module dsh-piggy/client/pomodoro-clock
 */

import { clockText } from './tabs/pomodoro.js'

/**
 * @param {() => any} getView - 当前快照（每次轮询会换成新对象）
 * @param {HTMLElement} pill - 猪身上的番茄角标
 * @param {HTMLElement} content - 面板内容区（番茄钟 App 的大倒计时、休息提示在里面）
 * @param {() => void} refresh - 到点时立刻拉一次快照
 * @param {() => boolean} isStopped - 猪被卸载后秒针自己停
 */
export function createPomodoroClock(getView, pill, content, refresh, isStopped) {
  var seen = null
  var endsAt = 0
  var breakEndsAt = 0

  function resync(local, server) {
    if (local === 0 || server === 0) return server
    return Math.abs(server - local) > 1500 ? server : local
  }

  function tick() {
    if (isStopped()) {
      window.clearInterval(timer)
      return
    }
    var p = getView().pomodoro
    var now = Date.now()
    if (p && p !== seen) {
      seen = p
      // 服务端报的是取整后的秒数，差一秒以内就不对表：不然每次轮询都会往回拨一下。
      endsAt = resync(endsAt, p.active ? now + p.secondsLeft * 1000 : 0)
      breakEndsAt = resync(breakEndsAt, !p.active && p.breakSecondsLeft > 0 ? now + p.breakSecondsLeft * 1000 : 0)
    }
    if (endsAt > 0) {
      var left = Math.max(0, Math.ceil((endsAt - now) / 1000))
      var text = '🍅 ' + clockText(left)
      if (pill.getAttribute('data-pomo') === 'on') pill.textContent = text
      var clock = content.querySelector('.dp-pomo-clock')
      if (clock !== null) clock.textContent = clockText(left)
      var ring = /** @type {HTMLElement|null} */ (content.querySelector('.dp-pomo-ring'))
      if (ring !== null && p && p.active) {
        var total = Math.max(1, p.minutes * 60)
        ring.style.setProperty('--pomo-progress', Math.max(0, Math.min(100, Math.round((1 - left / total) * 100))) + '%')
      }
      if (left === 0) {
        endsAt = 0
        refresh()
      }
    }
    if (breakEndsAt > 0) {
      var rest = Math.max(0, Math.ceil((breakEndsAt - now) / 1000))
      var note = content.querySelector('[data-pomo-break]')
      if (note !== null) note.textContent = '☕ 休息 ' + clockText(rest) + ' · 也可以直接开下一个'
      if (rest === 0) breakEndsAt = 0
    }
  }

  var timer = window.setInterval(tick, 1000)
  return { tick: tick, dispose: function () { window.clearInterval(timer) } }
}
