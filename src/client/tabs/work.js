// @ts-check
/**
 * 打工页签（B9：和学习 / 商店 / 背包一样的方块）。
 *
 * 第一层：武力 / 魅力 / 智力 三个大方块，右上角写能干的份数。
 * 第二层：这类职业的方块；点一个，下面出详情卡 —— 门槛逐条打勾打叉、加成和消耗、「出发」。
 * @module dsh-piggy/client/tabs/work
 */

import { button, el } from '../dom.js'
import { drillHeader, drillTo, tile, tileGrid } from '../widgets.js'
import { canStart, renderSwitchAsk, startOrSwitch } from '../switch-activity.js'

/** The three skills, in the order QQ Pet lists its traits, each with its colour. */
var SKILLS = [
  { key: 'strong', emoji: '💪', label: '武力', color: 'orange' },
  { key: 'charm', emoji: '✨', label: '魅力', color: 'pink' },
  { key: 'intel', emoji: '🧠', label: '智力', color: 'blue' },
]

export function renderWorkTab(ui) {
  renderSwitchAsk(ui)
  if (ui.view.jobs.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '宿主还没提供工作列表。'))
    return
  }
  // Older hosts send no trait per job: one list of every job, no skill layer.
  var bySkill = ui.view.jobs.some(function (job) { return job.trait !== '' })
  if (!bySkill) {
    renderJobs(ui, ui.view.jobs, 'orange')
    return
  }
  var skill = SKILLS.find(function (entry) { return entry.key === ui.drill.work })
  if (skill === undefined) {
    renderSkills(ui)
    return
  }
  var chosen = skill
  drillHeader(ui, 'work', chosen.emoji + ' ' + chosen.label, '')
  renderJobs(ui, ui.view.jobs.filter(function (job) { return job.trait === chosen.key }), chosen.color)
}

/** The top layer: one tile per skill, with how many of its jobs the pig can do. */
function renderSkills(ui) {
  var grid = tileGrid()
  for (var s = 0; s < SKILLS.length; s += 1) {
    (function (skill) {
      var open = ui.view.jobs.filter(function (job) { return job.trait === skill.key && job.qualified }).length
      grid.appendChild(tile({
        emoji: skill.emoji, label: skill.label, color: skill.color,
        badge: open > 0 ? String(open) : '',
        data: { 'data-skill': skill.key },
        onPick: function () { drillTo(ui, 'work', skill.key) },
      }))
    })(SKILLS[s])
  }
  ui.content.appendChild(grid)
}

/** Job tiles; the picked job stays visible under the scrolling list. */
function renderJobs(ui, jobs, color) {
  var grid = tileGrid()
  var picked = null
  for (var i = 0; i < jobs.length; i += 1) {
    (function (job) {
      var active = ui.drill.pick === job.key
      if (active) picked = job
      var locked = job.qualified === false
      grid.appendChild(tile({
        emoji: job.emoji, label: job.label, color: color, soft: true, active: active,
        note: job.minutes + '分·' + job.coins + '🪙',
        tag: locked ? '🔒' : '', dim: locked,
        data: { 'data-job-tile': job.key },
        onPick: function () {
          ui.drill.pick = active ? null : job.key
          ui.renderContent()
        },
      }))
    })(jobs[i])
  }
  ui.content.appendChild(grid)
  if (picked !== null) {
    ui.footer.appendChild(jobDetails(ui, picked))
    ui.footer.hidden = false
  }
}

/** 详情: every condition with a tick or a cross, what the job pays and costs, and 出发. */
function jobDetails(ui, job) {
  var box = el('div', 'dp-pick dp-tile-card dp-job-detail')
  box.appendChild(el('div', 'dp-pick-head', job.emoji + ' ' + job.label + ' · ' + (job.qualified ? '条件都够了' : '还差这些')))
  for (var r = 0; r < job.requirements.length; r += 1) {
    var need = job.requirements[r]
    var have = need.kind === 'level' ? '（现在 Lv.' + need.have + '）'
      : need.kind === 'certificate' ? '（' + need.have + '/' + need.need + ' 次）'
        : need.kind === 'every' || need.kind === 'anyOf' ? '（' + need.have + '/' + need.need + ' 门）'
          : '（现在 ' + need.have + ' 节）'
    box.appendChild(el('div', need.met ? 'dp-req dp-req-ok' : 'dp-req', (need.met ? '✓ ' : '✗ ') + need.text + (need.met ? '' : ' ' + have)))
  }
  // A locked job from an older host has no checklist, only the summary line.
  if (job.requirements.length === 0 && job.lockText) box.appendChild(el('div', 'dp-req', '✗ ' + job.lockText))
  box.appendChild(el('div', 'dp-dim', job.minutes + ' 分钟 · ' + job.coins + ' 🪙 · '
    + job.traitEmoji + job.traitLabel + ' ' + job.traitPoints
    + (job.payPercent > 0 ? '（+' + job.payPercent + '%）' : '')
    + ' · 饱食 ' + job.satiety + ' · 清洁 ' + job.cleanliness))
  var go = button('dp-btn dp-btn-wide dp-job-go', { 'data-job': job.key }, function () { startOrSwitch(ui, '打工（' + job.label + '）', 'work', { job: job.key }) })
  go.textContent = '💼 出发'
  go.disabled = !canStart(ui) || job.qualified === false
  box.appendChild(go)
  if (job.shortMinutes > 0 && job.shortMinutes < job.minutes) {
    var quick = button('dp-btn dp-btn-wide dp-job-short', { 'data-job-short': job.key }, function () { startOrSwitch(ui, '短班（' + job.label + '）', 'work', { job: job.key, short: true }) })
    quick.textContent = '⏱ 短班 ' + job.shortMinutes + ' 分钟 · ' + job.shortCoins + ' 🪙'
    quick.disabled = go.disabled
    box.appendChild(quick)
  }
  return box
}
