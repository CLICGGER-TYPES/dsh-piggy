// @ts-check
/**
 * 大堂、装弹页和规则页。牌桌在 table.js，三个页面共用同一份 game 状态，
 * 所以从规则页返回时不会重开对局。
 */

import { matchStake, money } from './game.js'
import { action, ammoBadge, assetImage, footer, modeRow, pageHead, vaultPill } from './ui.js'

export function renderLobby(app, game) {
  const state = game.state
  const root = app.el('div', 'rt-page rt-lobby')

  const top = app.el('div', 'rt-topline')
  top.appendChild(app.el('span', 'rt-kicker', '经典 6 巢 · 1 条命 · 三局两胜'))
  top.appendChild(app.el('span', 'rt-spacer'))
  top.appendChild(vaultPill(app, state))
  root.appendChild(top)

  const hero = app.el('div', 'rt-hero')
  hero.appendChild(app.el('div', 'rt-hero-glow'))
  hero.appendChild(assetImage(app, 'table-v1.webp', 'rt-hero-table'))
  hero.appendChild(assetImage(app, 'revolver-v2.webp', 'rt-hero-gun'))
  hero.appendChild(assetImage(app, 'chip-v1.webp', 'rt-hero-chip rt-hero-chip-a'))
  hero.appendChild(assetImage(app, 'chip-v1.webp', 'rt-hero-chip rt-hero-chip-b'))
  const badge = ammoBadge(app)
  badge.className += ' rt-hero-ammo'
  hero.appendChild(badge)
  root.appendChild(hero)

  root.appendChild(app.el('div', 'rt-menu-label', '选择玩法'))
  const menu = app.el('div', 'rt-menu')
  menu.appendChild(modeRow(app, {
    op: 'enter-ai',
    name: 'AI 对战',
    note: '单局底池 · AI 从金库配注',
    primary: true,
    asset: 'cylinder-v1.webp',
    onClick: function () { game.enterTable() },
  }))
  menu.appendChild(modeRow(app, {
    op: 'friend-mode',
    name: '好友联机',
    note: '需要宿主房间接口',
    locked: true,
    asset: 'chip-v1.webp',
    onClick: function () { game.notify('好友联机需要宿主房间接口，下一阶段接入') },
  }))
  menu.appendChild(modeRow(app, {
    op: 'team-mode',
    name: '4v4 阵营',
    note: '单局淘汰 · 后续开放',
    locked: true,
    grid: true,
    onClick: function () { game.notify('4v4 需要宿主房间接口，下一阶段接入') },
  }))
  root.appendChild(menu)

  root.appendChild(footer(app, {
    onRules: function () { game.openRules('lobby') },
    note: '金币 ' + money(state.coins) + ' · 本地演示',
  }))
  return root
}

export function renderLoading(app, game) {
  const state = game.state
  const root = app.el('div', 'rt-page rt-loading')
  root.appendChild(pageHead(app, state, '装弹', '第 ' + state.round + ' 局 · 三局两胜', '返回牌桌', function () {
    game.backToTable()
  }))

  const stage = app.el('div', 'rt-gun-stage')
  const wrap = app.el('div', 'rt-gun-wrap')
  wrap.appendChild(assetImage(app, 'revolver-v2.webp', 'rt-gun-img'))
  const ring = app.el('div', 'rt-gun-ring')
  for (let index = 0; index < 6; index += 1) ring.appendChild(app.el('i'))
  wrap.appendChild(ring)
  stage.appendChild(wrap)
  const bullet = app.button('rt-gun-bullet', { 'data-op': 'load-bullet', 'aria-label': '装弹' }, function () {
    game.beginLoad(false)
  })
  bullet.appendChild(assetImage(app, 'bullet-v1.webp', 'rt-gun-bullet-icon'))
  bullet.appendChild(app.el('span', null, '装弹'))
  stage.appendChild(bullet)
  root.appendChild(stage)

  const pot = state.pendingFresh ? matchStake(state) * 2 : state.pot
  const bet = app.el('div', 'rt-bet-pill')
  bet.appendChild(app.el('span', null, '底注'))
  bet.appendChild(app.el('b', null, money(state.stake)))
  bet.appendChild(app.el('span', null, '· 底池'))
  bet.appendChild(app.el('b', null, money(pot)))
  root.appendChild(bet)
  root.appendChild(app.el('div', 'rt-load-hint', '点「装弹」后在弹巢上点一个孔；也可以让系统随机。返回大厅会取消本场，装弹前不扣钱。'))

  const actions = app.el('div', 'rt-actions rt-actions-two')
  actions.appendChild(action(app, 'dp-btn rt-primary', { 'data-op': 'load-now' }, '装弹', function () {
    game.beginLoad(false)
  }))
  actions.appendChild(action(app, 'dp-btn', { 'data-op': 'load-random' }, '随机装弹', function () {
    game.beginLoad(true)
  }))
  root.appendChild(actions)

  root.appendChild(footer(app, {
    onRules: function () { game.openRules('loading') },
    extra: function () {
      return action(app, 'rt-link', { 'data-op': 'leave-lobby', 'aria-label': '返回大厅并取消本场' }, '返回大厅', function () {
        game.leaveTable()
      })
    },
    note: '金币 ' + money(state.coins),
  }))
  return root
}

export function renderRules(app, game) {
  const state = game.state
  const root = app.el('div', 'rt-page rt-rules')
  root.appendChild(pageHead(app, state, '规则', '经典 6 巢 · 1 条命', '返回', function () {
    game.closeRules()
  }))

  const card = app.el('div', 'rt-rules-card')
  card.appendChild(app.el('h2', null, '经典俄罗斯轮盘'))
  const list = app.el('ul')
  ;[
    '6 个弹巢，1 发实弹，1 条命。每局开始先装弹，再选择是否转轮。',
    '转轮会重新随机子弹位置并隐藏底火；不转轮直接开枪，按你装弹时选的孔结算。',
    '空枪换手；中弹输掉本局。先赢 2 局的人拿走底池。',
    'AI 只在对战模式参战，按金库 1% 等额配注；超出部分原路退回。',
    '好友联机 / 4v4 需要宿主房间接口，当前只锁定入口，不假装已支持。',
    '本扩展使用本地演示金币，不读写主存档金币；关闭扩展后本场数据不保留。',
  ].forEach(function (line) {
    list.appendChild(app.el('li', null, line))
  })
  card.appendChild(list)
  card.appendChild(app.el('p', 'rt-rules-note', '装弹页和牌桌都能点「规则」；从规则返回时，牌桌的底注、比分和弹巢状态不变。'))
  root.appendChild(card)

  const label = state.rulesFrom === 'table' ? '返回牌桌' : state.rulesFrom === 'loading' ? '返回装弹' : '返回大厅'
  root.appendChild(action(app, 'dp-btn rt-primary rt-wide', { 'data-op': 'rules-back' }, label, function () {
    game.closeRules()
  }))
  return root
}
