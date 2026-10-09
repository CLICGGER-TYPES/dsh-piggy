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

export function renderPomodoroTab(ui) {
  var view = ui.view.pomodoro
  if (view === null) {
    ui.content.appendChild(el('div', 'dp-empty', '宿主还没提供番茄钟。'))
    return
  }

  // 当下在做什么：专注中 → 倒计时 + 放弃；休息中 → 休息倒计时；否则 → 挑时长。
  if (view.active) {
    var live = el('div', 'dp-pomo-live')
    live.appendChild(el('div', 'dp-pomo-clock', '🍅 ' + clockText(view.secondsLeft)))
    live.appendChild(el('div', 'dp-dim', '专注 ' + view.minutes + ' 分钟 · 这期间我不吵你'))
    ui.content.appendChild(live)
    var stop = button('dp-btn dp-btn-wide', { 'data-pomo-abandon': 'true' }, function () {
      ui.send('pomodoroAbandon')
    })
    stop.textContent = '放弃这一个'
    ui.content.appendChild(stop)
  } else {
    if (view.breakSecondsLeft > 0) {
      var rest = el('div', 'dp-empty', '☕ 休息 ' + clockText(view.breakSecondsLeft) + '（也可以直接开下一个）')
      rest.setAttribute('data-pomo-break', 'true')
      ui.content.appendChild(rest)
    }
    var head = el('div', 'dp-title')
    head.appendChild(el('b', null, '🍅 专注多久？'))
    head.appendChild(el('span', null, '休息 ' + view.breakMinutes + ' 分钟'))
    ui.content.appendChild(head)
    var row = el('div', 'dp-dev-row')
    for (var i = 0; i < view.options.length; i += 1) {
      (function (minutes) {
        var start = button('dp-mini dp-dev-btn', { 'data-pomo-start': String(minutes) }, function () {
          ui.send('pomodoro', { minutes: minutes })
        })
        start.textContent = minutes + ' 分钟'
        row.appendChild(start)
      })(view.options[i])
    }
    ui.content.appendChild(row)
  }

  // 今天做了几个、还有几个给钱。
  var today = el('div', 'dp-row')
  today.appendChild(el('span', null, '今天完成'))
  today.appendChild(el('b', null, view.todayDone + ' 个'))
  ui.content.appendChild(today)
  ui.content.appendChild(el('div', 'dp-dim',
    '每完成一个 +' + view.reward.coins + ' 🪙 · 心情 +' + view.reward.happiness))
}
