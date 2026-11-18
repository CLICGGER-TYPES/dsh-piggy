// @ts-check
/**
 * 联机大厅与牌桌。牌桌复用单机的弹巢、命数和比分区，只换文案与操作区。
 * 金币、命数、比分都来自权威事件里的公开快照（online.ui.matchView）。
 */

import { passFee, ONLINE_STAKE_MAX, ONLINE_STAKE_MIN } from '../online.js'
import { money } from './game.js'
import { renderBoard, renderLives, renderMeta } from './pages.js'
import { action, chip, footer, pageHead } from './ui.js'

const STAKE_CHOICES = [100, 500, 1000, 5000]

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function mapSeat(value, seat) {
  if (value !== 'host' && value !== 'guest') return ''
  return value === seat ? 'you' : 'ai'
}

function nameOf(room, id) {
  const players = isObject(room) && Array.isArray(room.players) ? room.players : []
  const player = players.find(entry => entry.id === id)
  return player && typeof player.name === 'string' && player.name !== '' ? player.name : '对手'
}

/** 把联机公开快照映射成单机牌桌用的形状；座位视角在这里统一。 */
export function mapMatch(data, view, seat) {
  const me = view.seats[seat] ?? { lives: 0, wins: 0, paid: 0, fees: 0 }
  const them = view.seats[seat === 'host' ? 'guest' : 'host'] ?? { lives: 0, wins: 0, paid: 0, fees: 0 }
  const mine = view.turn === seat
  return {
    coins: data.coins,
    settings: {
      lives: view.settings.lives,
      format: view.settings.format,
      loadCount: view.settings.loadCount,
      stake: view.settings.stake,
    },
    match: {
      handId: view.rev,
      round: view.round,
      winsYou: me.wins,
      winsAi: them.wins,
      pot: view.pot,
      matchedYou: me.paid,
      matchedAi: them.paid,
      paidYou: me.paid,
      feesYou: me.fees,
      feesAi: them.fees,
      livesYou: me.lives,
      livesAi: them.lives,
      bulletCount: view.bulletCount,
      bulletsLeft: view.bulletsLeft,
      chamber: view.chamber,
      turn: mine ? 'you' : 'ai',
      stage: view.stage === 'choice' && !mine ? 'ai' : view.stage,
      passBy: mapSeat(view.passBy, seat),
      mustShoot: mapSeat(view.mustShoot, seat),
      outcome: view.winner === seat ? 'win' : view.winner === '' ? '' : 'lose',
      lastEvent: view.lastEvent,
      lastShooter: mapSeat(view.lastShooter, seat),
      settled: view.settled,
    },
  }
}

function roomLine(app, room) {
  const box = app.el('div', 'rt-room')
  const head = app.el('div', 'rt-room-head')
  head.appendChild(app.el('span', 'rt-room-code', room.code ?? ''))
  head.appendChild(app.el('span', 'rt-badge', room.authority === 'server' ? '公网服务器权威' : '房主客户端权威'))
  box.appendChild(head)
  const players = Array.isArray(room.players) ? room.players : []
  for (const player of players) {
    const row = app.el('div', 'rt-player' + (player.id === room.selfId ? ' rt-player-self' : ''))
    row.appendChild(app.el('b', null, (player.name ?? '小猪') + (player.id === room.selfId ? '（你）' : '')))
    row.appendChild(app.el('span', 'rt-tiny', player.host ? '房主' : '客人'))
    box.appendChild(row)
  }
  return box
}

export function renderOnlineLobby(app, online, game) {
  const data = game.data()
  const root = app.el('div', 'rt-page rt-online')
  root.appendChild(pageHead(app, data, '好友联机', '1v1 · 同一房间', '返回大厅', function () {
    game.showPage('lobby')
  }))
  const room = online.ui.room
  if (room === null) {
    const empty = app.el('div', 'rt-empty')
    empty.appendChild(app.el('p', null, online.ui.roomError || '还没有进入联机房间。'))
    empty.appendChild(app.el('p', 'rt-tiny', app.room
      ? '先在面板的联机房间里建房或加入，再回到这里。'
      : '联机需要桌面版：网页版没有房间通道。'))
    empty.appendChild(action(app, 'dp-btn rt-primary rt-wide', { 'data-op': 'online-refresh' }, '刷新房间状态', function () {
      online.refresh()
    }))
    root.appendChild(empty)
    root.appendChild(footer(app, { onRules: function () { game.openRules('online') }, note: '真实金币 · 各扣各的' }))
    return root
  }
  root.appendChild(roomLine(app, room))
  const players = Array.isArray(room.players) ? room.players : []
  const other = players.find(player => player.id !== room.selfId) ?? null
  if (players.length > 2) {
    root.appendChild(app.el('p', 'rt-online-note', '房间里超过两个人。联机 1v1 只支持两人，请其他人先离开。'))
    root.appendChild(footer(app, { onRules: function () { game.openRules('online') }, note: '真实金币 · 各扣各的' }))
    return root
  }
  if (other === null) {
    root.appendChild(app.el('p', 'rt-online-note', '等另一位朋友进房间。两个人都到了才能开局。'))
    root.appendChild(action(app, 'dp-btn rt-wide', { 'data-op': 'online-refresh' }, '刷新', function () {
      online.refresh()
    }))
    root.appendChild(footer(app, { onRules: function () { game.openRules('online') }, note: '真实金币 · 各扣各的' }))
    return root
  }
  if (online.roomHost()) {
    root.appendChild(hostSettings(app, online, data))
  } else {
    const wait = app.el('div', 'rt-empty')
    wait.appendChild(app.el('p', null, '等房主设置并创建牌桌。'))
    wait.appendChild(app.el('p', 'rt-tiny', '房主创建后会自动进入牌桌。'))
    wait.appendChild(action(app, 'dp-btn rt-wide', { 'data-op': 'online-refresh' }, '刷新', function () {
      online.refresh()
    }))
    root.appendChild(wait)
  }
  if (online.ui.error !== '') root.appendChild(app.el('p', 'rt-online-note rt-online-error', online.ui.error))
  root.appendChild(footer(app, { onRules: function () { game.openRules('online') }, note: '真实金币 · 各扣各的' }))
  return root
}

function settingRow(app, online, label, values, current, key) {
  const row = app.el('div', 'rt-setting')
  row.appendChild(app.el('span', 'rt-setting-label', label))
  const chips = app.el('div', 'rt-chips')
  for (const value of values) {
    chips.appendChild(chip(app, typeof value === 'number' ? money(value) : value.label, current === value.key, function () {
      online.setSetting(key, value.key)
    }, { 'data-op': 'online-' + key + '-' + value.key }))
  }
  row.appendChild(chips)
  return row
}

function hostSettings(app, online, data) {
  const box = app.el('div', 'rt-settings')
  const s = online.ui.settings
  box.appendChild(settingRow(app, online, '命数', [{ key: 1, label: '1 条' }, { key: 3, label: '3 条' }], s.lives, 'lives'))
  box.appendChild(settingRow(app, online, '赛制', [{ key: 'single', label: '单局' }, { key: 'bestOf3', label: '三局两胜' }], s.format, 'format'))
  const loads = []
  for (let value = 1; value <= 5; value += 1) loads.push({ key: value, label: value + ' 发' })
  box.appendChild(settingRow(app, online, '装弹', loads, s.loadCount, 'loadCount'))
  const stakes = STAKE_CHOICES.filter(value => value >= ONLINE_STAKE_MIN && value <= ONLINE_STAKE_MAX)
  box.appendChild(settingRow(app, online, '底注', stakes.map(value => ({ key: value, label: money(value) })), s.stake, 'stake'))
  const start = action(app, 'dp-btn rt-primary rt-wide', { 'data-op': 'online-create' }, online.ui.waiting ? '正在开局…' : '创建牌桌', function () {
    online.createTable()
  })
  if (online.ui.waiting) start.disabled = true
  if (Number.isFinite(data.coins) && data.coins < s.stake) {
    start.disabled = true
    box.appendChild(app.el('p', 'rt-online-note', '金币不够本局底注。'))
  }
  box.appendChild(start)
  box.appendChild(app.el('p', 'rt-tiny', '开局后双方各扣本局底注；中途关闭大窗口即结束对局。'))
  return box
}

function renderOnlineResult(app, online, view, seat) {
  const mine = view.seats[seat] ?? { paid: 0, fees: 0 }
  const them = view.seats[seat === 'host' ? 'guest' : 'host'] ?? { paid: 0, fees: 0 }
  const cancelled = view.outcome === 'cancelled'
  const win = view.winner === seat
  const net = cancelled ? 0 : online.ui.net ?? ((win ? view.pot : 0) - mine.paid - mine.fees)
  const card = app.el('div', 'rt-result ' + (net >= 0 ? 'rt-result-win' : 'rt-result-lose'))
  card.appendChild(app.el('div', 'rt-result-kicker', '本场结束'))
  card.appendChild(app.el('div', 'rt-result-title', cancelled ? '本场取消' : win ? '你赢了' : '你输了'))
  card.appendChild(app.el('div', 'rt-result-net', (net > 0 ? '+' : net < 0 ? '-' : '') + money(Math.abs(net))))
  card.appendChild(app.el('div', 'rt-result-label', net > 0 ? '本场净收' : net < 0 ? '本场净付' : '本场打平'))
  const meta = app.el('div', 'rt-result-meta')
  meta.appendChild(app.el('span', null, '底池 ' + money(view.pot)))
  meta.appendChild(app.el('span', null, '下注 ' + money(mine.paid)))
  if (mine.fees > 0) meta.appendChild(app.el('span', null, '让枪付 ' + money(mine.fees)))
  if (them.fees > 0) meta.appendChild(app.el('span', null, '对手让枪入池 ' + money(them.fees)))
  card.appendChild(meta)
  if (online.ui.opponentGone) card.appendChild(app.el('p', 'rt-tiny', '对手已经离开，底池判给你。'))
  return card
}

function statusText(view, seat, opponentName) {
  if (view.stage === 'arming') {
    return seat === 'host' ? '装 ' + view.bulletCount + ' 发。点一个弹孔，随后强制转轮。' : '房主装弹中…'
  }
  if (view.stage === 'ai') return '等' + opponentName + '行动…'
  if (view.stage === 'choice') {
    if (view.mustShoot === seat) return '对手回让，你必须开枪。'
    if (view.passBy !== '' && view.passBy !== seat) return '对手让枪：开枪，或回让让它开枪。'
    return view.turn === seat ? '轮到你：对自己开枪，或让枪。' : '等' + opponentName + '行动…'
  }
  if (view.stage === 'roundOver') return '本局结束。'
  if (view.stage === 'matchOver') return view.winner === seat ? '你赢下整场，底池已结算。' : '对手赢下整场，底池已结算。'
  return '准备中…'
}

function renderOnlineDock(app, online, view, seat, data, opponentName) {
  const dock = app.el('div', 'rt-dock')
  if (online.ui.leaveConfirm) {
    const confirm = app.el('div', 'rt-confirm')
    confirm.appendChild(app.el('b', null, '确认离开牌桌？'))
    confirm.appendChild(app.el('p', null, '本场视为认输，底池归' + opponentName + '，已下的底注不退。'))
    const buttons = app.el('div', 'rt-actions')
    buttons.appendChild(action(app, 'dp-btn rt-primary rt-wide', { 'data-op': 'online-cancel-leave' }, '继续打', function () {
      online.cancelLeave()
    }))
    buttons.appendChild(action(app, 'dp-btn rt-danger rt-wide', { 'data-op': 'online-confirm-leave' }, '确认离开', function () {
      online.confirmLeave()
    }))
    dock.appendChild(buttons)
    return dock
  }
  const actions = app.el('div', 'rt-actions')
  function primary(label, op, handler, disabled) {
    const node = action(app, 'dp-btn rt-primary rt-wide', { 'data-op': op }, label, handler)
    if (disabled) node.disabled = true
    actions.appendChild(node)
    return node
  }
  if (view.stage === 'arming') {
    if (seat === 'host') {
      primary('随机装弹', 'online-arm-random', function () { online.randomArm() })
      actions.appendChild(app.el('div', 'rt-hint', '也可以直接点弹孔 · 装完强制转轮'))
    } else {
      primary('房主装弹中…', 'online-arm-wait', function () {}, true)
    }
  } else if (view.stage === 'choice') {
    if (view.turn !== seat) {
      primary('等' + opponentName + '行动…', 'online-wait', function () {}, true)
    } else {
      actions.appendChild(action(app, 'dp-btn rt-danger', { 'data-op': 'online-shoot' }, '对自己开枪', function () { online.fire() }))
      const fee = passFee(view.settings.stake)
      const forced = view.mustShoot === seat
      const passBtn = action(app, 'dp-btn', { 'data-op': 'online-pass' }, '让枪 · 付 ' + money(fee), function () { online.pass() })
      if (forced || data.coins < fee) passBtn.disabled = true
      actions.appendChild(passBtn)
      const hint = forced
        ? '对手回让，你只能开枪'
        : data.coins < fee
          ? '金币不够让枪费，只能开枪'
          : view.passBy !== ''
            ? '回让会让枪回到' + opponentName + '，对方必须开枪'
            : '让枪费进底池，本回合结束'
      actions.appendChild(app.el('div', 'rt-hint', hint))
    }
  } else if (view.stage === 'roundOver') {
    if (seat === 'host') {
      const load = app.el('div', 'rt-next-load')
      load.appendChild(app.el('span', 'rt-bet-label', '下一局装弹'))
      const row = app.el('div', 'rt-chips')
      const current = online.ui.settings.loadCount
      for (let value = 1; value <= 5; value += 1) {
        row.appendChild(chip(app, value + ' 发', current === value, function () {
          online.setSetting('loadCount', value)
        }, { 'data-op': 'online-next-load-' + value }))
      }
      load.appendChild(row)
      actions.appendChild(load)
      primary('下一局', 'online-next', function () { online.next() })
    } else {
      primary('等房主开下一局', 'online-next-wait', function () {}, true)
    }
  } else if (view.stage === 'matchOver') {
    if (seat === 'host') {
      primary('再来一场', 'online-again', function () { online.createTable() })
      actions.appendChild(app.el('div', 'rt-hint', '对手还在房间里就能直接开新一场'))
    } else {
      primary('等房主再来一场', 'online-again-wait', function () {}, true)
      actions.appendChild(app.el('div', 'rt-hint', '想退出可以点上方返回大厅'))
    }
  }
  dock.appendChild(actions)
  return dock
}

export function renderOnlineTable(app, online, game) {
  const data = game.data()
  const view = online.ui.matchView
  if (!isObject(view)) {
    const root = app.el('div', 'rt-page rt-online')
    root.appendChild(pageHead(app, data, '联机牌桌', '1v1', '返回大厅', function () { online.back() }))
    root.appendChild(app.el('p', 'rt-online-note', '还没有进行中的对局。'))
    root.appendChild(action(app, 'dp-btn rt-primary rt-wide', { 'data-op': 'online-back-lobby' }, '回到联机大厅', function () {
      online.back()
    }))
    return root
  }
  const room = online.ui.room
  const selfId = room !== null ? room.selfId : ''
  const seat = view.hostId === selfId ? 'host' : 'guest'
  const opponentName = nameOf(room, view.hostId === selfId ? view.guestId : view.hostId)
  const mapped = mapMatch(data, view, seat)
  const root = app.el('div', 'rt-page rt-table rt-online-table')
  const sub = '第 ' + view.round + ' 局 · ' + (view.settings.format === 'bestOf3' ? '三局两胜' : '单局') + ' · 对手 ' + opponentName
  root.appendChild(pageHead(app, data, '联机牌桌', sub, '返回大厅', function () { online.requestLeave() }))
  root.appendChild(renderMeta(app, mapped))
  root.appendChild(renderLives(app, mapped, opponentName))
  if (view.stage === 'matchOver') {
    root.appendChild(renderOnlineResult(app, online, view, seat))
  } else {
    root.appendChild(renderBoard(app, { ui: online.ui, load: function (index) { online.arm(index) } }, mapped, seat === 'host'))
    const status = app.el('div', 'rt-status', statusText(view, seat, opponentName))
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    root.appendChild(status)
  }
  if (online.ui.error !== '') root.appendChild(app.el('p', 'rt-online-note rt-online-error', online.ui.error))
  root.appendChild(renderOnlineDock(app, online, view, seat, data, opponentName))
  root.appendChild(footer(app, {
    onRules: function () { game.openRules('table') },
    note: '真实金币 · 让枪付 50% 进底池',
  }))
  return root
}
