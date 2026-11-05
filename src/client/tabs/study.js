// @ts-check
/**
 * 学习页签（B8：动森手机式方块）。
 *
 * 第一层：学段方块（小学 … 学无止境）+ 兴趣。锁住的学段变灰，但点得进去看。
 * 第二层：学段里是九门课的方块，点一下就去上这一节；兴趣里是兴趣课方块，点一下就去学。
 * B4 起每门课各算各的课时：同一个学段里，正在这一段的能上，念完的打勾，还没到的上锁。
 * @module dsh-piggy/client/tabs/study
 */

import { STAGES } from '../constants.js'
import { el } from '../dom.js'
import { drillHeader, drillTo, tile, tileGrid } from '../widgets.js'
import { canStart, renderSwitchAsk, startOrSwitch } from '../switch-activity.js'

/** The drill key that opens the interest courses instead of a stage. */
export const INTEREST_TAB = 'interest'

/** One colour per stage, so the inner layer still says which stage it is. */
var STAGE_COLOR = { primary: 'yellow', middle: 'teal', college: 'blue', graduate: 'purple', beyond: 'pink' }
var INTEREST_COLOR = 'orange'
/** Stages this client does not know (an older host's ladder) take colours in turn. */
var FALLBACK_COLORS = ['yellow', 'teal', 'blue', 'purple', 'pink', 'green', 'lime']

/** Where a subject stands relative to one stage: 'current' | 'done' | 'ahead'. */
function standing(sub, stage) {
  if (stage === null || sub.stageKey === '') return 'current'
  if (sub.stageKey === stage.key) return 'current'
  if (stage.upTo !== null && sub.lessons >= stage.upTo) return 'done'
  return 'ahead'
}

export function renderStudyTab(ui) {
  renderSwitchAsk(ui)
  if (ui.view.activity?.kind === 'interest') {
    var active = ui.view.activity
    var left = Math.max(1, Math.ceil(active.secondsLeft / 60))
    ui.content.appendChild(el('div', 'dp-alert', active.emoji + ' 正在学' + active.label.replace(/^兴趣·/, '') + ' · 还有 ' + left + ' 分钟'))
  }
  if (ui.view.subjects.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '宿主还没提供课程表。'))
    return
  }
  var open = ui.drill.study
  if (open === INTEREST_TAB && ui.view.interests.length > 0) {
    renderInterests(ui)
    return
  }
  var stage = null
  for (var d = 0; d < ui.view.stages.length; d += 1) if (ui.view.stages[d].key === open) stage = ui.view.stages[d]
  if (stage === null) {
    renderStages(ui)
    return
  }
  renderSubjects(ui, stage)
}

/** The top layer: one tile per stage, then 兴趣. */
function renderStages(ui) {
  // Prefer the host's own ladder: a client that hard-codes the stages would
  // keep offering one the host has never heard of.
  var stageList = ui.view.stages.length > 0 ? ui.view.stages : STAGES
  var grid = tileGrid()
  grid.className += ' dp-nine-grid'
  for (var s = 0; s < stageList.length; s += 1) {
    (function (entry, index) {
      var locked = entry.unlocked === false
      var finished = entry.upTo === null || entry.upTo === undefined ? 0
        : ui.view.subjects.filter(function (sub) { return sub.lessons >= entry.upTo }).length
      grid.appendChild(tile({
        emoji: entry.emoji || '📚', label: entry.label,
        color: STAGE_COLOR[entry.key] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        locked: locked, tag: locked ? '🔒' : '', badge: finished > 0 ? '✓' + finished : '',
        data: { 'data-stage': entry.key },
        onPick: function () { drillTo(ui, 'study', entry.key) },
      }))
    })(stageList[s], s)
  }
  if (ui.view.interests.length > 0) {
    var certified = ui.view.interests.filter(function (entry) { return entry.certified }).length
    grid.appendChild(tile({
      emoji: '🎯', label: '兴趣', color: INTEREST_COLOR,
      badge: certified > 0 ? '📜' + certified : '',
      data: { 'data-stage': INTEREST_TAB },
      onPick: function () { drillTo(ui, 'study', INTEREST_TAB) },
    }))
  }
  ui.content.appendChild(grid)
}

/** Inside a stage: the nine subjects. Tap one that is at this stage to go to class. */
function renderSubjects(ui, stage) {
  drillHeader(ui, 'study', stage.emoji + ' ' + stage.label,
    stage.minutes + ' 分钟 · ' + stage.tuition + ' 🪙 · +' + stage.gain)
  var color = STAGE_COLOR[stage.key] ?? FALLBACK_COLORS[Math.max(0, ui.view.stages.indexOf(stage)) % FALLBACK_COLORS.length]
  var grid = tileGrid()
  for (var i = 0; i < ui.view.subjects.length; i += 1) {
    (function (sub) {
      var where = standing(sub, stage)
      var note
      if (where === 'done') note = '✓ 毕业'
      else if (where === 'ahead') note = '🔒 ' + (sub.stageLabel || '没到')
      else if (stage.upTo !== null) note = (sub.lessons - stage.from) + '/' + (stage.upTo - stage.from) + ' 节'
      else note = sub.lessons + ' 节'
      grid.appendChild(tile({
        emoji: sub.emoji, label: sub.label, color: color, soft: true, note: note,
        disabled: where !== 'current' || !canStart(ui),
        dim: where === 'current' && !sub.affordable,
        data: { 'data-subject': sub.key },
        onPick: function () { startOrSwitch(ui, '上' + sub.label + '课', 'study', { subject: sub.key }) },
      }))
    })(ui.view.subjects[i])
  }
  ui.content.appendChild(grid)
}

/** Inside 兴趣: every interest course; tap to go. Five of one earns its certificate. */
function renderInterests(ui) {
  var after = ui.view.interests[0].certificateAfter
  drillHeader(ui, 'study', '🎯 兴趣', after > 0 ? '上满 ' + after + ' 次拿证' : '')
  var grid = tileGrid()
  grid.className += ' dp-nine-grid'
  for (var n = 0; n < ui.view.interests.length; n += 1) {
    (function (entry) {
      var note = entry.cost + ' 🪙 · 约 ' + entry.minutes + ' 分钟后 ' + entry.traitLabel + ' +' + entry.gain
      var badge = entry.certificate === '' ? '' : (entry.certified ? '📜' : entry.times + '/' + entry.certificateAfter)
      grid.appendChild(tile({
        emoji: entry.emoji, label: entry.label, color: INTEREST_COLOR, soft: true, note: note,
        noteClass: 'dp-tile-note-2', badge: badge,
        disabled: !canStart(ui),
        dim: !entry.affordable,
        data: { 'data-interest': entry.key },
        onPick: function () { startOrSwitch(ui, '学' + entry.label, 'interest', { interest: entry.key }) },
      }))
    })(ui.view.interests[n])
  }
  ui.content.appendChild(grid)
}
