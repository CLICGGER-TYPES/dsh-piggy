// @ts-check
/**
 * 番茄钟 App（C2）。
 *
 * 主人挑一个时长，猪就在旁边陪着、自己进免打扰；倒计时存在服务端，所以关面板、
 * 刷新、重启都接着走。到点由服务端结算（8 金币、心情 +6，每个都给），
 * 客户端只负责显示和发一条浏览器通知。
 * @module dsh-piggy/client/tabs/pomodoro
 */

import { button, el } from '../dom.js'

/** mm:ss，给倒计时用。 */
export function clockText(seconds) {
  var left = Math.max(0, Math.round(seconds))
  var mm = Math.floor(left / 60)
  var ss = left % 60
  return mm + ':' + (ss < 10 ? '0' : '') + ss
}

/** 今天完成和每个番茄的奖励，专注中/休息中也保留。 */
function renderStats(ui, view) {
  var stats = el('div', 'dp-pomo-stats')
  var done = el('div', 'dp-pomo-stat')
  done.appendChild(el('span', null, '今天完成'))
  done.appendChild(el('b', null, view.todayDone + ' 个'))
  var reward = el('div', 'dp-pomo-stat')
  reward.appendChild(el('span', null, '每个完成'))
  reward.appendChild(el('b', null, '+' + view.reward.coins + ' 🪙 · +' + view.reward.happiness + ' 💗'))
  stats.appendChild(done)
  stats.appendChild(reward)
  ui.content.appendChild(stats)
}

export function renderPomodoroTab(ui) {
  var view = ui.view.pomodoro
  if (view === null) {
    ui.content.appendChild(el('div', 'dp-empty', '宿主还没提供番茄钟。'))
    return
  }

  if (view.active) {
    var total = Math.max(1, view.minutes * 60)
    var percent = Math.max(0, Math.min(100, Math.round((1 - view.secondsLeft / total) * 100)))
    var focus = el('div', 'dp-pomo-focus')
    var top = el('div', 'dp-pomo-focus-top')
    top.appendChild(el('span', 'dp-pomo-chip', '专注中'))
    top.appendChild(el('span', 'dp-pomo-top-note', '不打扰'))
    focus.appendChild(top)
    var ring = el('div', 'dp-pomo-ring')
    ring.style.setProperty('--pomo-progress', percent + '%')
    ring.appendChild(el('span', 'dp-pomo-ring-label', '剩余时间'))
    ring.appendChild(el('b', 'dp-pomo-clock', clockText(view.secondsLeft)))
    ring.appendChild(el('span', 'dp-pomo-ring-sub', view.minutes + ' 分钟 · 到点提醒'))
    focus.appendChild(ring)
    focus.appendChild(el('p', 'dp-pomo-quiet', '这期间我不吵你，到点会提醒你休息。'))
    ui.content.appendChild(focus)
    renderStats(ui, view)
    var stop = button('dp-pomo-abandon', { 'data-pomo-abandon': 'true' }, function () {
      ui.send('pomodoroAbandon')
    })
    stop.textContent = '放弃这一个'
    ui.content.appendChild(stop)
    return
  }

  if (view.breakSecondsLeft > 0) {
    var rest = el('div', 'dp-pomo-break')
    rest.setAttribute('data-pomo-break', 'true')
    rest.textContent = '☕ 休息 ' + clockText(view.breakSecondsLeft) + ' · 也可以直接开下一个'
    ui.content.appendChild(rest)
  }

  var hero = el('div', 'dp-pomo-hero')
  hero.appendChild(el('span', 'dp-pomo-hero-icon', '🍅'))
  var copy = el('div', 'dp-pomo-hero-copy')
  copy.appendChild(el('b', null, '专注多久？'))
  copy.appendChild(el('span', null, '挑个时长，我陪你'))
  hero.appendChild(copy)
  hero.appendChild(el('span', 'dp-pomo-break-pill', '☕ 休息 ' + view.breakMinutes + ' 分钟'))
  ui.content.appendChild(hero)

  var options = el('div', 'dp-pomo-options')
  for (var i = 0; i < view.options.length; i += 1) {
    (function (minutes) {
      var featured = minutes === 25
      var start = button('dp-pomo-option' + (featured ? ' dp-pomo-option-featured' : ''), { 'data-pomo-start': String(minutes) }, function () {
        ui.send('pomodoro', { minutes: minutes })
      })
      start.appendChild(el('b', null, String(minutes)))
      start.appendChild(el('span', null, '分钟'))
      if (featured) start.appendChild(el('small', null, '推荐'))
      options.appendChild(start)
    })(view.options[i])
  }
  ui.content.appendChild(options)

  renderStats(ui, view)
  ui.content.appendChild(el('p', 'dp-pomo-note', '到点会提醒你休息，期间不打扰。'))
}
