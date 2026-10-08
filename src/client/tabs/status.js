// @ts-check
/**
 * 状态页签。
 *
 * 属性条、三维、体重金币与照顾入口。
 * @module dsh-piggy/client/tabs/status
 */

import { CARE_LABEL, MODES } from '../constants.js'
import { button, el } from '../dom.js'
import { drillTo, labelledBar } from '../widgets.js'

export function renderStatusTab(ui) {
  var p = ui.view.pig
  if (p === null) return
  renderBanners(ui)
  var lv = p.level
  labelledBar(ui, '⭐ Lv.' + lv.level + ' ' + lv.titleEmoji + lv.titleLabel, lv.maxed ? 100 : lv.percent,
    lv.maxed ? '满级' : '还差 ' + Math.ceil(lv.toNext) + ' 成长', 'dp-level')
  labelledBar(ui, '🍚 饱食', p.satiety, p.satiety + '%')
  labelledBar(ui, '❤️ 心情', p.happiness, p.happiness + '%', 'dp-mood')
  labelledBar(ui, '🫧 清洁', p.cleanliness, p.cleanliness + '%', 'dp-clean')
  labelledBar(ui, '💚 健康', p.healthPercent, p.health + '/' + ui.view.maxHealth, 'dp-health')

  var traits = el('div', 'dp-traits')
  traits.appendChild(el('span', null, '🧠 智力 ' + p.traits.intel))
  traits.appendChild(el('span', null, '✨ 魅力 ' + p.traits.charm))
  traits.appendChild(el('span', null, '💪 武力 ' + p.traits.strong))
  ui.content.appendChild(traits)

  renderWeight(ui, p)

  // 签到进度：一行小字，不抢注意力（礼包攒着的时候顺带说一句）。
  var daily = ui.view.daily
  var dailyLine = el('div', 'dp-row')
  dailyLine.appendChild(el('span', null, '📅 签到'))
  dailyLine.appendChild(el('b', null, '第 ' + daily.signInDay + '/' + daily.cycle + ' 天'
    + (daily.canSignIn ? ' · 今天还没签' : '')
    + (daily.unclaimed > 0 ? ' · 🎁 ' + daily.unclaimed : '')))
  ui.content.appendChild(dailyLine)


  var grid = el('div', 'dp-actions')
  for (var i = 0; i < MODES.length; i += 1) {
    (function (key) {
      var info = ui.view.actions[key]
      var shelf = ui.view.care[key] ?? []
      var needsItem = shelf.length > 0
      var btn = button('dp-btn', { 'data-action': key }, function () {
        // 喂食、洗澡、玩耍都要用东西：直接跳到背包对应的货架（G 批次），
        // 不再在这里维护一份物品列表。摸摸不用东西，直接摸。
        if (BAG_SHELF[key] !== undefined) {
          ui.select('bag')
          ui.drill.from = 'status'
          drillTo(ui, 'bag', BAG_SHELF[key])
        } else {
          ui.send(key)
        }
      })
      btn.appendChild(el('span', null, CARE_LABEL[key][1]))
      btn.appendChild(el('span', null, CARE_LABEL[key][0]))
      if (needsItem) btn.appendChild(el('span', 'dp-count', String(shelf.length)))
      // Trust but verify: a dead pig cannot be cared for even if the host
      // forgot to clear its readiness flags.
      if (!info.ready || ui.view.dead) {
        btn.disabled = true
        if (ui.view.dead) btn.appendChild(el('span', 'dp-wait', '—'))
        else if (info.waitSeconds > 0) btn.appendChild(el('span', 'dp-wait', info.waitSeconds + 's'))
        else if (info.blocked === 'away') btn.appendChild(el('span', 'dp-wait', '不在家'))
      }
      grid.appendChild(btn)
    })(MODES[i])
  }
  ui.content.appendChild(grid)

  if (p.memories.length > 0) {
    ui.content.appendChild(el('div', 'dp-memo', p.memories.slice(-3).join('\n')))
  }
}

/** 状态页的照料按钮跳到背包的哪个货架。 */
var BAG_SHELF = { feed: 'food', bathe: 'bath', play: 'toy' }

/** 体重一行小字：多重、什么体型。 */
function renderWeight(ui, p) {
  var row = el('div', 'dp-row')
  row.appendChild(el('span', null, '⚖️ 体重'))
  row.appendChild(el('b', null, p.weight + (p.bodyWeight !== null ? ' · ' + p.bodyWeight.label : '')))
  ui.content.appendChild(row)
}

/**
 * The pig's banners — gone, sick, or out — at the top of the status tab only
 * (B9: they used to sit above every tab, the shop included).
 */
function renderBanners(ui) {
  if (ui.view.pig !== null && ui.view.dead) {
    var dead = el('div', 'dp-alert dp-dead')
    dead.appendChild(el('b', null, (ui.view.pig.stage.key === 'grave' ? '🪦 ' : '🐖 ') + ui.view.pig.name + ' 走了' + (ui.view.pig.soul ? '，灵魂还留在墓碑旁 👻' : '')))
    dead.appendChild(el('div', null, ui.view.pig.soul
      ? '用还魂丹可以把它叫回来，也可以领养新的'
      : '背包里的还魂丹就能救回来'))
    ui.content.appendChild(dead)
    // Adopting is available the moment the pig dies — not only once the
    // soul turns up a day later. Waiting a day to start over was a
    // mistake: the grave is already a dead end with nothing to do.
    var adoptWrap = el('div', 'dp-actions')
    var adopt = button('dp-btn dp-btn-wide', { 'data-action': 'adopt' }, function () { ui.send('adopt') })
    adopt.appendChild(el('span', null, '📦'))
    adopt.appendChild(el('span', null, '领养新猪'))
    adoptWrap.appendChild(adopt)
    ui.content.appendChild(adoptWrap)
  } else if (ui.view.pig !== null && ui.view.pig.illness !== null) {
    var illness = ui.view.pig.illness
    var sick = el('div', 'dp-alert dp-sick')
    sick.appendChild(el('b', null, '🤒 ' + illness.name + '（第 ' + illness.stage + '/4 期）'))
    // B3: every stage has its own cure, and the wrong one makes it worse,
    // so the alert always names the exact medicine.
    sick.appendChild(el('div', null, '需要「' + illness.cureEmoji + illness.cure + '」—— 吃错药会加重'))
    var needed = null
    var shelf = ui.view.shop || []
    for (var c = 0; c < shelf.length; c += 1) {
      if (shelf[c].needed) needed = shelf[c]
    }
    // Hosts from before B3 do not flag the cure: match it by stage tier,
    // then by name.
    for (var t = 0; needed === null && t < shelf.length; t += 1) {
      if (shelf[t].kind === 'medicine' && shelf[t].tier === illness.stage) needed = shelf[t]
    }
    for (var n = 0; needed === null && n < shelf.length; n += 1) {
      if (shelf[n].label === illness.cure) needed = shelf[n]
    }
    if (ui.view.canGoOut) {
      sick.appendChild(el('div', 'dp-dim', '带病出门报酬减半、病情更快'))
    }
    if (needed !== null && ui.view.canGoOut && ui.view.pig.coins < needed.price) {
      sick.appendChild(el('div', 'dp-dim', '还差 ' + needed.price + ' 🪙 买「' + needed.label + '」，先去打工'))
    }
    ui.content.appendChild(sick)
    if (illness.doctorFee !== null) {
      var clinic = el('div', 'dp-actions')
      var doctor = button('dp-btn dp-btn-wide', { 'data-action': 'doctor' }, function () { ui.send('doctor') })
      doctor.appendChild(el('span', null, '🏥'))
      doctor.appendChild(el('span', null, '看医生（' + illness.doctorFee + ' 🪙）'))
      clinic.appendChild(doctor)
      ui.content.appendChild(clinic)
    }
  } else if (ui.view.pig !== null && ui.view.activity !== null) {
    var away = el('div', 'dp-alert dp-work')
    away.appendChild(el('b', null, ui.view.activity.emoji + ' 在外面：' + ui.view.activity.label))
    away.appendChild(el('div', null, '还有 ' + ui.view.activity.secondsLeft + ' 秒'))
    ui.content.appendChild(away)
    var wrap = el('div', 'dp-actions')
    var call = button('dp-btn dp-btn-wide', { 'data-action': 'calloff' }, function () { ui.send('calloff') })
    call.appendChild(el('span', null, '↩️'))
    call.appendChild(el('span', null, '叫它回来'))
    wrap.appendChild(call)
    ui.content.appendChild(wrap)
  }
}

