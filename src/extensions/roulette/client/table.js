// @ts-check
/**
 * 牌桌：双方玩家卡、比分、六孔弹巢和底注/动作卡。
 * 装弹时把六个孔直接变成可点按钮；点哪个孔，底火就落在哪个孔。
 */

import { aiCap, CHAMBER_X, CHAMBER_Y, matchStake, money, STAKE_STEP } from './game.js'
import { action, ammoBadge, assetImage, footer, pageHead, pigAvatar } from './ui.js'

function pips(app, count) {
  const row = app.el('div', 'rt-pips')
  row.setAttribute('aria-hidden', 'true')
  for (let index = 0; index < 2; index += 1) {
    row.appendChild(app.el('i', index < count ? 'rt-pip rt-pip-on' : 'rt-pip'))
  }
  return row
}

function playerCard(app, options) {
  const card = app.el('div', 'rt-pcard ' + (options.you ? 'rt-pcard-you' : 'rt-pcard-ai'))
  const avatar = app.el('span', 'rt-avatar')
  if (options.you) avatar.appendChild(pigAvatar(app, 'rt-avatar-img'))
  else avatar.textContent = '🐷'
  card.appendChild(avatar)
  const who = app.el('div', 'rt-pwho')
  who.appendChild(app.el('div', 'rt-pname', options.name))
  who.appendChild(app.el('div', 'rt-prole', options.role))
  who.appendChild(pips(app, options.wins))
  card.appendChild(who)
  return card
}

function renderPlayers(app, state) {
  const row = app.el('div', 'rt-players')
  row.appendChild(playerCard(app, {
    name: '侦探猪',
    role: state.matched > 0 ? '配注 ' + money(state.matched) : '配注上限 ' + money(aiCap(state.vault)),
    wins: state.ai,
  }))
  const score = app.el('div', 'rt-score')
  score.appendChild(app.el('b', null, state.you + ' : ' + state.ai))
  score.appendChild(app.el('small', null, state.stage === 'matchOver' ? '已结束' : '第 ' + state.round + ' 局'))
  row.appendChild(score)
  row.appendChild(playerCard(app, {
    name: '你',
    role: '金币 ' + money(state.coins),
    wins: state.you,
    you: true,
  }))
  return row
}

function renderBoard(app, game) {
  const state = game.state
  let className = 'rt-board'
  if (state.stage === 'arming') className += ' rt-board-arming'
  if (state.flash === 'live') className += ' rt-board-fire rt-board-live'
  else if (state.flash === 'blank') className += ' rt-board-fire'
  const board = app.el('div', className)
  board.setAttribute('role', 'group')
  board.setAttribute('aria-label', '六孔弹巢')

  board.appendChild(assetImage(app, 'table-v1.webp', 'rt-board-table'))
  const pot = app.el('div', 'rt-pot')
  pot.appendChild(assetImage(app, 'chip-v1.webp', 'rt-pot-chip'))
  pot.appendChild(app.el('span', null, '底池'))
  pot.appendChild(app.el('b', null, money(state.pot > 0 ? state.pot : matchStake(state) * 2)))
  board.appendChild(pot)

  const wrap = app.el('div', state.spinning ? 'rt-cyl-wrap rt-cyl-spin' : 'rt-cyl-wrap')
  wrap.appendChild(assetImage(app, 'cylinder-v1.webp', 'rt-cyl'))
  if (state.primer >= 0) {
    const primer = app.el('i', state.primerPop ? 'rt-primer rt-primer-show' : 'rt-primer rt-primer-on')
    primer.style.setProperty('--x', CHAMBER_X[state.primer] + 'px')
    primer.style.setProperty('--y', CHAMBER_Y[state.primer] + 'px')
    wrap.appendChild(primer)
  }
  for (let index = 0; index < 6; index += 1) {
    const on = state.stage === 'arming'
    const hole = app.button('rt-hole', {
      'data-chamber': String(index),
      'aria-label': '第 ' + (index + 1) + ' 巢' + (on ? '，点这里装弹' : ''),
      'aria-disabled': on ? 'false' : 'true',
    }, function () { game.seat(index) })
    hole.disabled = !on
    hole.style.setProperty('--x', CHAMBER_X[index] + 'px')
    hole.style.setProperty('--y', CHAMBER_Y[index] + 'px')
    wrap.appendChild(hole)
  }
  board.appendChild(wrap)
  board.appendChild(app.el('div', 'rt-flash'))

  const badge = ammoBadge(app)
  badge.className += ' rt-board-ammo'
  board.appendChild(badge)
  board.appendChild(assetImage(app, 'chip-v1.webp', 'rt-board-chips'))
  return board
}

function betNote(app, state) {
  const note = app.el('div', 'rt-bet-note')
  const cap = aiCap(state.vault)
  if (state.matched > 0) {
    note.appendChild(app.el('span', null, '本局配注 '))
    note.appendChild(app.el('b', null, money(state.matched)))
    if (state.stake > state.matched) {
      note.appendChild(app.el('div', 'rt-warn', '多出 ' + money(state.stake - state.matched) + ' 退回'))
    }
    return note
  }
  if (state.stake > cap) {
    note.appendChild(app.el('span', null, '有效配注 '))
    note.appendChild(app.el('b', null, money(cap)))
    note.appendChild(app.el('div', 'rt-warn', '多出 ' + money(state.stake - cap) + ' 退回'))
    return note
  }
  note.appendChild(app.el('span', null, '配注上限 '))
  note.appendChild(app.el('b', null, money(cap)))
  return note
}

function renderDock(app, game) {
  const state = game.state
  const dock = app.el('div', 'rt-dock')
  const bet = app.el('div', 'rt-bet')
  bet.appendChild(app.el('span', 'rt-bet-label', '底注'))
  const minus = app.button('rt-step', { 'data-op': 'stake-down', 'aria-label': '减少底注' }, function () {
    game.setStake(-STAKE_STEP)
  })
  minus.textContent = '−'
  minus.disabled = state.stage !== 'idle'
  bet.appendChild(minus)
  bet.appendChild(app.el('span', 'rt-stake', money(state.stake)))
  const plus = app.button('rt-step', { 'data-op': 'stake-up', 'aria-label': '增加底注' }, function () {
    game.setStake(STAKE_STEP)
  })
  plus.textContent = '+'
  plus.disabled = state.stage !== 'idle'
  bet.appendChild(plus)
  bet.appendChild(betNote(app, state))
  dock.appendChild(bet)

  const actions = app.el('div', 'rt-actions')
  function primary(label, op, handler, disabled) {
    const node = action(app, 'dp-btn rt-primary rt-wide', { 'data-op': op }, label, handler)
    if (disabled) node.disabled = true
    actions.appendChild(node)
    return node
  }
  function hint(text) {
    actions.appendChild(app.el('div', 'rt-hint', text))
  }
  if (state.stage === 'idle') {
    primary('开始对局', 'start', function () { game.startMatch() })
    hint('AI 金库配注 · 三局两胜')
  } else if (state.stage === 'arming') {
    primary('随机装弹', 'random-arm', function () { game.randomArm() })
    hint('点一个弹孔装弹，或点「随机装弹」')
  } else if (state.stage === 'ready') {
    primary('转轮', 'spin', function () { game.spin() })
    actions.appendChild(action(app, 'dp-btn', { 'data-op': 'pass' }, '不开枪', function () { game.pass() }))
    actions.appendChild(action(app, 'dp-btn rt-danger', { 'data-op': 'shoot' }, '对自己开枪', function () { game.fire('you') }))
  } else if (state.stage === 'spinning') {
    primary('转轮中…', 'spin-wait', function () {}, true)
    hint('转轮中… 子弹位置不会显示')
  } else if (state.stage === 'choice') {
    actions.appendChild(action(app, 'dp-btn', { 'data-op': 'pass' }, '不开枪', function () { game.pass() }))
    actions.appendChild(action(app, 'dp-btn rt-danger', { 'data-op': 'shoot' }, '对自己开枪', function () { game.fire('you') }))
    hint('空枪换手 · 先赢 2 局')
  } else if (state.stage === 'ai') {
    primary('AI 回合…', 'ai-wait', function () {}, true)
    hint('AI 转轮后开枪')
  } else if (state.stage === 'roundOver') {
    primary('下一局', 'next', function () { game.startMatch() })
    hint('本局结束 · 点下一局继续')
  } else {
    primary('再来一场', 'again', function () { game.startMatch() })
    hint('整场结束 · 底池已结算')
  }
  dock.appendChild(actions)
  return dock
}

export function renderTable(app, game) {
  const state = game.state
  const root = app.el('div', 'rt-page rt-table')
  const sub = state.stage === 'matchOver' ? '已结束 · 三局两胜' : '第 ' + state.round + ' 局 · 三局两胜'
  root.appendChild(pageHead(app, state, 'AI 对战', sub, '返回大厅', function () {
    game.leaveTable()
  }))
  root.appendChild(renderPlayers(app, state))
  root.appendChild(renderBoard(app, game))
  const status = app.el('div', 'rt-status', state.status)
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  root.appendChild(status)
  root.appendChild(renderDock(app, game))
  root.appendChild(footer(app, {
    onRules: function () { game.openRules('table') },
    note: '单局底池',
  }))
  return root
}
