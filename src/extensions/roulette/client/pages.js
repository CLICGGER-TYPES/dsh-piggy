// @ts-check
/**
 * 大堂、牌桌和规则页。所有金币/对局数字来自服务端 view（app.data），
 * 本地只读 game.ui 里的装弹/转轮/火光动画状态。
 */

import { CHAMBER_X, CHAMBER_Y, LOAD_MAX, LOAD_MIN, money } from './game.js'
import { settingsBlock } from './settings.js'
import { action, assetImage, chip, coinPill, footer, modeRow, pageHead } from './ui.js'

export function renderLobby(app, game) {
  const data = game.data()
  const root = app.el('div', 'rt-page rt-lobby')

  const top = app.el('div', 'rt-topline')
  top.appendChild(app.el('span', 'rt-kicker', '6 巢 · 真实金币 · 玩具轮盘'))
  top.appendChild(app.el('span', 'rt-spacer'))
  top.appendChild(coinPill(app, data))
  root.appendChild(top)

  const hero = app.el('div', 'rt-hero')
  hero.appendChild(app.el('div', 'rt-hero-glow'))
  hero.appendChild(assetImage(app, 'table-v2.webp', 'rt-hero-table'))
  hero.appendChild(assetImage(app, 'revolver-v6.webp', 'rt-hero-gun'))
  hero.appendChild(assetImage(app, 'chip-v1.webp', 'rt-hero-chip rt-hero-chip-a'))
  hero.appendChild(assetImage(app, 'chip-v1.webp', 'rt-hero-chip rt-hero-chip-b'))
  hero.appendChild(app.el('span', 'rt-hero-tag', 'AI 对战 · 1 对 1'))
  root.appendChild(hero)

  root.appendChild(action(app, 'dp-btn rt-primary rt-wide rt-enter', { 'data-op': 'enter-ai' }, '进入牌桌', function () {
    game.enterTable()
  }))

  const menu = app.el('div', 'rt-menu')
  menu.appendChild(modeRow(app, {
    op: 'friend-mode',
    name: '好友联机',
    note: '1v1 · 房主开局',
    asset: 'chip-v1.webp',
    onClick: function () {
      // 房间通道只在桌面版大窗口里给；面板里先开大窗口。
      if (!app.room && typeof app.openBig === 'function') { app.openBig(); return }
      game.showPage('online')
    },
  }))
  menu.appendChild(modeRow(app, {
    op: 'four-mode',
    name: '4 人桌',
    note: '同批设计 · 下一阶段接入',
    locked: true,
    grid: true,
    onClick: function () { game.notify('4 人桌需要宿主房间接口，下一阶段接入') },
  }))
  root.appendChild(menu)

  root.appendChild(footer(app, {
    onRules: function () { game.openRules('lobby') },
    note: '真实金币 · 底池归赢家',
  }))
  return root
}

function lifeDots(app, count, max) {
  const lives = app.el('span', 'rt-lives')
  for (let index = 0; index < max; index += 1) {
    lives.appendChild(app.el('i', index < count ? 'rt-life rt-life-on' : 'rt-life'))
  }
  return lives
}

export function renderLives(app, data, opponentName) {
  const match = data.match
  const max = data.settings.lives
  const row = app.el('div', 'rt-livesbar')
  const ai = app.el('div', 'rt-lives-side rt-lives-ai')
  ai.appendChild(app.el('b', null, opponentName ?? '侦探猪'))
  ai.appendChild(lifeDots(app, match ? match.livesAi : 0, max))
  row.appendChild(ai)
  row.appendChild(app.el('span', 'rt-lives-score', match ? match.winsAi + ' : ' + match.winsYou : '0 : 0'))
  const you = app.el('div', 'rt-lives-side rt-lives-you')
  you.appendChild(lifeDots(app, match ? match.livesYou : 0, max))
  you.appendChild(app.el('b', null, '你'))
  row.appendChild(you)
  return row
}

/**
 * 牌桌顶部的整枪状态图。三张图同一画布：revolver-v6 是静态底图，
 * 转轮停稳换成带薄荷弧光的 2c，开过枪换成带烟痕的 3b；弹巢特写
 * cylinder-v4 仍在下面做可点底图，两者互不替代。
 */
const GUN_ART = {
  idle: { asset: 'revolver-v6.webp', label: '转轮前', note: '弹巢未转' },
  spun: { asset: 'revolver-spun-2c.png', label: '转轮已停', note: '下一枪未知' },
  spent: { asset: 'revolver-smoke-3b.png', label: '已开枪', note: '弹巢留烟' },
}

/** 只看本局进度，不读子弹位置：装弹中→底图，停轮→2c，本局开过枪→3b。 */
export function gunState(game, match) {
  if (match === null || match.stage === 'arming' || match.stage === 'idle') return 'idle'
  if (match.round > 0 && game.ui.firedRound === match.round) return 'spent'
  return 'spun'
}

export function renderGun(app, game, data) {
  const match = data.match
  const state = gunState(game, match)
  const art = GUN_ART[state]
  const stage = app.el('div', 'rt-gun-strip rt-gun-' + state)
  stage.setAttribute('data-gun-state', state)
  stage.setAttribute('role', 'img')
  stage.setAttribute('aria-label', '枪身状态：' + (match === null ? '未开局' : art.label) + '，' + (match === null ? '进牌桌后装弹' : art.note))
  const img = assetImage(app, art.asset, 'rt-gun-strip-img')
  img.setAttribute('data-gun-art', art.asset)
  stage.appendChild(img)
  const tag = app.el('div', 'rt-gun-tag')
  tag.appendChild(app.el('b', null, match === null ? '未开局' : art.label))
  tag.appendChild(app.el('span', null, match === null ? '进牌桌后选装弹' : art.note))
  stage.appendChild(tag)
  return stage
}

export function renderMeta(app, data) {
  const match = data.match
  const row = app.el('div', 'rt-meta')
  const left = app.el('div', 'rt-meta-left')
  left.appendChild(app.el('span', 'rt-meta-tag', match ? '第 ' + match.round + ' 局' : '未开局'))
  left.appendChild(app.el('span', 'rt-meta-tag', data.settings.format === 'bestOf3' ? '三局两胜' : '单局'))
  if (match && data.settings.format === 'bestOf3') {
    left.appendChild(app.el('span', 'rt-meta-tag rt-meta-score', match.winsAi + ' : ' + match.winsYou))
  }
  row.appendChild(left)
  const pot = app.el('div', 'rt-pot')
  pot.appendChild(assetImage(app, 'chip-v1.webp', 'rt-pot-chip'))
  pot.appendChild(app.el('span', null, '底池'))
  pot.appendChild(app.el('b', null, money(match ? match.pot : 0)))
  row.appendChild(pot)
  return row
}

export function renderBoard(app, game, data, canArm) {
  const match = data.match
  const ui = game.ui
  let className = 'rt-board'
  if (match && match.stage === 'arming') className += ' rt-board-arming'
  if (ui.flash === 'live') className += ' rt-board-fire rt-board-live'
  else if (ui.flash === 'blank') className += ' rt-board-fire'
  const board = app.el('div', className)
  board.setAttribute('role', 'group')
  board.setAttribute('aria-label', '六孔弹巢')

  board.appendChild(assetImage(app, 'table-v2.webp', 'rt-board-table'))

  const rotated = match !== null && match.stage !== 'arming'
  const wrap = app.el('div', 'rt-cyl-wrap' + (ui.spinning ? ' rt-cyl-spin' : rotated ? ' rt-cyl-rotated' : '') + (ui.spinHide ? ' rt-cyl-hide-bullets' : ''))
  wrap.appendChild(assetImage(app, 'cylinder-v4.webp', 'rt-cyl'))
  const holes = Array.isArray(ui.holes) ? ui.holes : []
  // 转完之后保留已装孔位，子弹标记画在孔内，跟着整个弹巢一起转；下一局装弹/其它动作清空。
  const shown = match !== null && match.stage === 'arming' ? holes : (Array.isArray(ui.armedHoles) ? ui.armedHoles : [])
  const armed = canArm !== false && match !== null && match.stage === 'arming' && !ui.spinning
  for (let index = 0; index < 6; index += 1) {
    const hole = app.button('rt-hole', {
      'data-chamber': String(index),
      'aria-label': '第 ' + (index + 1) + ' 巢' + (armed ? '，点这里装弹' : ''),
      'aria-disabled': armed ? 'false' : 'true',
    }, function () { game.load(index) })
    hole.disabled = !armed
    hole.style.setProperty('--x', CHAMBER_X[index] + 'px')
    hole.style.setProperty('--y', CHAMBER_Y[index] + 'px')
    if (shown.includes(index)) {
      hole.className += ' rt-hole-loaded'
      const bullet = app.el('span', 'rt-hole-bullet')
      bullet.setAttribute('aria-hidden', 'true')
      hole.appendChild(bullet)
    }
    wrap.appendChild(hole)
  }
  board.appendChild(wrap)
  board.appendChild(app.el('div', 'rt-flash'))
  if (match && match.stage !== 'roundOver') {
    const badge = app.el('div', 'rt-ammo rt-board-ammo')
    badge.appendChild(assetImage(app, 'bullet-side-v4.webp', 'rt-ammo-icon'))
    if (match.stage === 'arming') {
      badge.appendChild(app.el('b', null, String(holes.length)))
      badge.appendChild(app.el('span', null, '/ ' + match.bulletCount + ' 发'))
    } else {
      badge.appendChild(app.el('b', null, String(match.bulletsLeft)))
      badge.appendChild(app.el('span', null, '/ ' + match.bulletCount + ' 发'))
    }
    board.appendChild(badge)
  }
  return board
}

function statusText(match) {
  if (match === null) return '选择设置后开始对局。'
  if (match.stage === 'arming') return '点弹孔装弹，一个孔一发；本局 ' + match.bulletCount + ' 发，装满后按「开始转」。'
  if (match.stage === 'ai') {
    if (match.mustShoot === 'ai') return 'AI 被回让，必须开枪…'
    if (match.passBy === 'you') return '你已让枪，等 AI 决定。'
    return 'AI 回合…'
  }
  if (match.stage === 'choice') {
    if (match.mustShoot === 'you') return '对手回让，你必须开枪。'
    if (match.passBy === 'ai') return 'AI 已让枪：开枪，或回让让它开枪。'
    return match.turn === 'you' ? '轮到你：对自己开枪，或让枪。' : 'AI 回合…'
  }
  if (match.stage === 'roundOver') return '本局结束，比分 ' + match.winsAi + ' : ' + match.winsYou + '。点「下一局」继续。'
  if (match.stage === 'matchOver') return match.outcome === 'win' ? '你赢下整场，底池已结算。' : 'AI 赢下整场，底池已结算。'
  if (match.lastEvent === 'hit') return '中弹！'
  if (match.lastEvent === 'blank') return '空枪，换手。'
  return '准备中…'
}

/**
 * 本场真实金币净变化：底池收入 - 累计下注 - 玩家让枪费。
 * AI 的让枪费进底池，赢了才随底池拿到，所以不再单独加到净额里。
 */
function matchNet(match) {
  return (match.outcome === 'win' ? match.pot : 0) - (match.paidYou || 0) - (match.feesYou || 0)
}

function renderResult(app, match) {
  const net = matchNet(match)
  const win = match.outcome === 'win'
  const card = app.el('div', 'rt-result ' + (net >= 0 ? 'rt-result-win' : 'rt-result-lose'))
  card.appendChild(app.el('div', 'rt-result-kicker', '本场结束'))
  card.appendChild(app.el('div', 'rt-result-title', win ? '你赢了' : 'AI 赢了'))
  card.appendChild(app.el('div', 'rt-result-net', (net > 0 ? '+' : net < 0 ? '-' : '') + money(Math.abs(net))))
  card.appendChild(app.el('div', 'rt-result-label', net > 0 ? '本场净收' : net < 0 ? '本场净付' : '本场打平'))
  const meta = app.el('div', 'rt-result-meta')
  meta.appendChild(app.el('span', null, '底池 ' + money(match.pot)))
  meta.appendChild(app.el('span', null, '下注 ' + money(match.paidYou)))
  if (match.feesYou > 0) meta.appendChild(app.el('span', null, '让枪付 ' + money(match.feesYou)))
  if (match.feesAi > 0) meta.appendChild(app.el('span', null, 'AI 让枪入池 ' + money(match.feesAi)))
  card.appendChild(meta)
  return card
}

function renderDock(app, game, data) {
  const match = data.match
  const dock = app.el('div', 'rt-dock')
  if (match === null) {
    dock.appendChild(action(app, 'dp-btn rt-primary rt-wide', { 'data-op': 'start' }, '开始 AI 对战', function () {
      game.start()
    }))
    return dock
  }
  if (game.ui.leaveConfirm) {
    const confirm = app.el('div', 'rt-confirm')
    confirm.appendChild(app.el('b', null, '确认离开牌桌？'))
    confirm.appendChild(app.el('p', null, match.stage === 'arming'
      ? '前面累积的底池会归 AI 金库，已下的底注不退。'
      : '本场视为认输，底池归 AI 金库，已下的底注不退。'))
    dock.appendChild(confirm)
    const buttons = app.el('div', 'rt-actions')
    buttons.appendChild(action(app, 'dp-btn rt-primary rt-wide', { 'data-op': 'cancel-leave' }, '继续打', function () {
      game.cancelLeave()
    }))
    buttons.appendChild(action(app, 'dp-btn rt-danger rt-wide', { 'data-op': 'confirm-leave' }, '确认离开', function () {
      game.leaveTable()
    }))
    dock.appendChild(buttons)
    return dock
  }
  const info = app.el('div', 'rt-bet')
  info.appendChild(app.el('span', 'rt-bet-label', '底注'))
  info.appendChild(app.el('b', 'rt-stake', money(match.matchedYou)))
  info.appendChild(app.el('span', 'rt-bet-label', '· 本局 AI 配注'))
  info.appendChild(app.el('b', 'rt-stake', money(match.matchedAi)))
  dock.appendChild(info)

  const actions = app.el('div', 'rt-actions')
  function primary(label, op, handler, disabled) {
    const node = action(app, 'dp-btn rt-primary rt-wide', { 'data-op': op }, label, handler)
    if (disabled) node.disabled = true
    actions.appendChild(node)
    return node
  }
  if (match.stage === 'arming') {
    primary('随机装弹', 'load-random', function () { game.randomLoad() })
    primary('开始转', 'spin', function () { game.spin() }, game.ui.holes.length !== match.bulletCount || game.ui.spinning)
    const left = Math.max(0, match.bulletCount - game.ui.holes.length)
    actions.appendChild(app.el('div', 'rt-hint', left === 0
      ? '已装 ' + game.ui.holes.length + '/' + match.bulletCount + ' 发，按「开始转」才转轮'
      : '已装 ' + game.ui.holes.length + '/' + match.bulletCount + ' 发，还差 ' + left + ' 发'))
  } else if (match.stage === 'choice') {
    actions.appendChild(action(app, 'dp-btn rt-danger', { 'data-op': 'shoot' }, '对自己开枪', function () { game.fire() }))
    const fee = Math.max(1, Math.ceil(match.matchedYou * (data.passRate || 0.5)))
    const forced = match.mustShoot === 'you'
    const passBtn = action(app, 'dp-btn', { 'data-op': 'pass' }, '让枪 · 付 ' + money(fee), function () { game.pass() })
    if (forced || data.coins < fee) passBtn.disabled = true
    actions.appendChild(passBtn)
    const hint = forced
      ? '对手回让，你只能开枪'
      : data.coins < fee
        ? '金币不够让枪费，只能开枪'
        : match.passBy === 'ai'
          ? '回让会让枪回到 AI，它必须开枪'
          : '让枪费直接给 AI，本回合结束'
    actions.appendChild(app.el('div', 'rt-hint', hint))
  } else if (match.stage === 'ai') {
    if (game.ui.aiError) {
      primary('AI 行动重试', 'ai-retry', function () { game.retryAi() })
      actions.appendChild(app.el('div', 'rt-hint', 'AI 行动没送到宿主，点重试'))
    } else {
      primary('AI 回合…', 'ai-wait', function () {}, true)
      actions.appendChild(app.el('div', 'rt-hint', 'AI 不知道子弹位置'))
    }
  } else if (match.stage === 'roundOver') {
    const load = app.el('div', 'rt-next-load')
    load.appendChild(app.el('span', 'rt-bet-label', '下一局装弹'))
    const row = app.el('div', 'rt-chips')
    const current = game.ui.nextLoad ?? data.settings.loadCount
    for (let value = LOAD_MIN; value <= LOAD_MAX; value += 1) {
      row.appendChild(chip(app, value + ' 发', current === value, function () {
        game.setNextLoad(value)
      }, { 'data-op': 'next-load-' + value }))
    }
    load.appendChild(row)
    actions.appendChild(load)
    primary('下一局', 'next', function () { game.next() })
  } else if (match.stage === 'matchOver') {
    primary('再来一场', 'again', function () { game.start() })
    actions.appendChild(app.el('div', 'rt-hint', match.outcome === 'win' ? '底池已结算 · 金币已到账' : '底池归 AI · 已下底注不退'))
  }
  dock.appendChild(actions)
  return dock
}

export function renderTable(app, game) {
  const data = game.data()
  const match = data.match
  const root = app.el('div', 'rt-page rt-table')
  const sub = match === null ? '未开局' : '第 ' + match.round + ' 局 · ' + (data.settings.format === 'bestOf3' ? '三局两胜' : '单局')
  root.appendChild(pageHead(app, data, 'AI 对战', sub, '返回大厅', function () {
    game.requestLeave()
  }))
  root.appendChild(renderMeta(app, data))
  root.appendChild(renderLives(app, data, '侦探猪'))
  // 整枪状态图放在弹巢特写上方，换图不改变装弹和孔位交互。
  root.appendChild(renderGun(app, game, data))
  if (match === null) {
    // 大堂只留入口；命数、底注、AI 这些设置进入牌桌后再配。
    root.appendChild(settingsBlock(app, game, data))
  } else if (match.stage === 'matchOver') {
    root.appendChild(renderResult(app, match))
  } else {
    root.appendChild(renderBoard(app, game, data, true))
    const status = app.el('div', 'rt-status', statusText(match))
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    root.appendChild(status)
  }
  root.appendChild(renderDock(app, game, data))
  root.appendChild(footer(app, {
    onRules: function () { game.openRules('table') },
    note: '真实金币 · 让枪付 50%',
  }))
  return root
}

export function renderRules(app, game) {
  const data = game.data()
  const root = app.el('div', 'rt-page rt-rules')
  root.appendChild(pageHead(app, data, '规则', '6 巢 · 1/3 命 · 单局或三局两胜', '返回', function () {
    game.closeRules()
  }))
  const card = app.el('div', 'rt-rules-card')
  card.appendChild(app.el('h2', null, '左轮轮盘规则'))
  const list = app.el('ul')
  ;[
    '6 个弹巢。每局开局自己选装 1-5 发，单局内子弹不增加。',
    '装好后按「开始转」才转轮，子弹位置随机化，双方都不知道最终位置。',
    '每局先手随机；空枪换手；中弹扣 1 条命。',
    '1 条命：中弹即输。3 条命：装 1 发中弹后重装继续；装多发则继续打当前弹巢，子弹打完再重装。',
    '让枪：玩家付当前底注 50% 给 AI；AI 让枪付 50% 进底池。本回合结束，对手不用开枪。',
    '回让：对手让枪后你再让，枪回到先让的人手里，他这一手必须开枪。',
    '单局或三局两胜。三局两胜每局下注、底池累积，先赢 2 局者拿走全部底池。',
    'AI 按金库上限配注，跟不起就少配；5 档策略（莽夫 / 期望值 / 随机诈唬 / 贝叶斯 / 蒙特卡洛）都只读公开量，不知道子弹位置；中弹概率≥75% 时都会让枪。',
    '真实金币结算：输的钱进 AI 金库，赢的钱从 AI 金库出。',
  ].forEach(function (line) {
    list.appendChild(app.el('li', null, line))
  })
  card.appendChild(list)
  root.appendChild(card)
  const label = game.ui.rulesFrom === 'table' ? '返回牌桌' : '返回大厅'
  root.appendChild(action(app, 'dp-btn rt-primary rt-wide', { 'data-op': 'rules-back' }, label, function () {
    game.closeRules()
  }))
  return root
}
