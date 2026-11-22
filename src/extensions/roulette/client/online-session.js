// @ts-check
/**
 * 联机对局的房间会话：绑定宿主房间通道、消费权威事件、房主权威状态机、
 * 钱包动作与心跳。界面状态由 online-game 持有，这里只改其中的房间/对局字段。
 * 局域网 authority='host' 由房主大窗口跑 online.js 并广播；公网 authority='server' 只收发事件；关窗即结束，靠心跳超时判离开，不做重连。
 */

import { applyAction, createMatch, initialEvent, passFee, publicView } from '../online.js'
import { clearRoomUi } from './match-state.js'

export const PING_MS = 5000
export const SILENCE_MS = 20000

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function numberIn(value, min, max, fallback) {
  const n = Math.floor(Number(value))
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

/**
 * @param {{ ui: any, getApp: () => any, rerender: () => void,
 *   schedule?: (fn: () => void, ms: number) => any, cancel?: (id: any) => void,
 *   now?: () => number }} deps
 */
export function createOnlineSession(deps) {
  const ui = deps.ui
  const getApp = deps.getApp
  const rerender = deps.rerender
  const schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms))
  const cancel = deps.cancel ?? (id => clearTimeout(id))
  const now = deps.now ?? (() => Date.now())

  let rules = null
  let bound = false
  let boundBridge = null
  let selfId = ''
  let mySeat = ''
  let seq = 0
  const seen = {}
  const paid = {}
  let heartbeat = null
  let flashTimer = null
  let spinTimer = null
  let lastOtherAt = 0
  // 打开窗口时房间里的最大事件号：之前的历史只回放视图，房主不再广播，避免把上一场复活。
  let baselineId = null

  const app = () => getApp()

  function bridge() {
    const current = app()
    return current && isObject(current.room) ? current.room : null
  }

  function authority() {
    return ui.room !== null && ui.room.hosting === true && ui.room.authority === 'host'
  }

  const terminal = view => isObject(view) && view.stage === 'matchOver'

  function active(view) {
    return isObject(view) && view.stage !== 'matchOver'
  }

  function seatOf(view) {
    if (view.hostId === selfId) return 'host'
    return view.guestId === selfId ? 'guest' : ''
  }

  function otherId() {
    const view = ui.matchView
    if (view === null) return ''
    return view.hostId === selfId ? view.guestId : view.hostId
  }

  /* ---------- 宿主房间通道 ---------- */

  function bind() {
    if (bound) return
    const channel = bridge()
    if (channel === null) return
    bound = true
    boundBridge = channel
    if (typeof channel.onUpdate === 'function') channel.onUpdate(onRoom)
    if (typeof channel.onClosed === 'function') channel.onClosed(onClosed)
    if (typeof channel.status === 'function') {
      const result = channel.status()
      if (result && typeof result.then === 'function') result.then(onRoom, function () {})
    }
  }

  function onClosed() {
    resetState()
    clearRoomUi(ui)
    ui.error = '联机房间已关闭'
    rerender()
  }

  function onRoom(snapshot) {
    if (!isObject(snapshot) || snapshot.ok !== true || snapshot.inRoom !== true) {
      ui.room = null
      ui.roomError = '不在联机房间里'
      rerender()
      return
    }
    ui.room = snapshot
    ui.roomError = ''
    ui.error = ui.error === '联机房间已关闭' ? '' : ui.error
    selfId = typeof snapshot.selfId === 'string' ? snapshot.selfId : ''
    const events = Array.isArray(snapshot.gameEvents) ? snapshot.gameEvents : []
    if (baselineId === null) {
      let latest = 0
      for (const event of events) {
        if (isObject(event) && Number.isSafeInteger(event.id) && event.id > latest) latest = event.id
      }
      baselineId = latest
      // 新窗口的 seq 从房间已收到的事件号接着走，否则服务端会把本窗口的消息都当重复丢掉。
      if (latest > seq) seq = latest
    }
    for (const event of events) {
      handleEvent(event, typeof event.id === 'number' && event.id <= baselineId)
    }
    if (ui.page === 'table' && active(ui.matchView)) startHeartbeat()
    rerender()
  }

  function handleEvent(event, replay) {
    if (!isObject(event) || event.ext !== 'roulette') return
    if (typeof event.id === 'number') {
      if (seen[event.id] === true) return
      seen[event.id] = true
    }
    if (event.from !== selfId && selfId !== '') lastOtherAt = now()
    const data = isObject(event.data) ? event.data : {}
    if (event.op === 'create' || event.op === 'action') {
      // 历史事件不交给房主权威重算：重算会重新随机装弹，还会把开局事件重新广播出去。
      if (replay !== true && authority() && (event.op === 'create' || rules !== null)) applyInput(event, data)
      return
    }
    if (isObject(data.view)) applyView(data.view, event.op, data)
  }

  /** 房主权威：应用一条输入，并把产生的事件广播回房间。 */
  function applyInput(event, data) {
    if (event.op === 'create') {
      if (event.from !== selfId || rules !== null) return
      const matchId = typeof data.matchId === 'string' ? data.matchId : ''
      const guestId = typeof data.guestId === 'string' ? data.guestId : ''
      if (matchId === '' || guestId === '') return
      const settings = isObject(data.settings) ? data.settings : {}
      rules = createMatch({
        matchId,
        hostId: selfId,
        guestId,
        lives: settings.lives,
        format: settings.format,
        stake: settings.stake,
        loadCount: settings.loadCount,
      })
      mySeat = 'host'
      ui.waiting = false
      emit(initialEvent(rules))
      emit({ op: 'round-start', round: rules.round, stake: rules.settings.stake, pot: rules.pot, view: publicView(rules) })
      rerender()
      return
    }
    if (rules === null || typeof data.op !== 'string') return
    const result = applyAction(rules, { from: event.from, seq: event.id, op: data.op, data })
    if (!result.ok) return
    for (const item of result.events ?? []) emit(item)
    rerender()
  }

  function emit(event) {
    applyView(event.view, event.op, event)
    const channel = boundBridge
    if (channel === null || typeof channel.send !== 'function') return
    seq += 1
    const result = channel.send(seq, event.op, event)
    if (result && typeof result.then === 'function') {
      result.then(function (reply) {
        if (isObject(reply) && reply.ok === true && Number.isInteger(reply.eventId)) seen[reply.eventId] = true
      }, function () {})
    }
  }

  function applyView(view, op, data) {
    if (!isObject(view) || seatOf(view) === '') return
    ui.matchView = view
    ui.matchId = typeof view.matchId === 'string' ? view.matchId : ui.matchId
    if (seatOf(view) !== '') mySeat = seatOf(view)
    ui.waiting = false
    if (op === 'match-start') ui.opponentGone = false
    // 重开大窗口回放上一场时，把大厅设置也带回来，「再来一场」沿用刚才的底注装弹。
    if (op === 'match-start' && isObject(view.settings)) ui.settings = Object.assign({}, view.settings)
    if (op === 'round-start' || op === 'match-start') payStake(view)
    if (op === 'pass' && data.who === mySeat) payFee(view)
    if (op === 'arm') spin()
    if (op === 'hit' && data.who === mySeat) flash('live')
    if (op === 'blank' && data.who === mySeat) flash('blank')
    if (op === 'match-over' || op === 'forfeit' || op === 'cancelled') settle(view, op)
    if (terminal(view)) stopHeartbeat()
    else if (ui.page === 'lobby') {
      ui.page = 'table'
      startHeartbeat()
    }
  }

  function flash(kind) {
    if (flashTimer !== null) cancel(flashTimer)
    ui.flash = kind
    flashTimer = schedule(function () {
      flashTimer = null
      ui.flash = ''
      rerender()
    }, 450)
  }

  function spin() {
    ui.spinning = true
    if (spinTimer !== null) cancel(spinTimer)
    spinTimer = schedule(function () {
      spinTimer = null
      ui.spinning = false
      rerender()
    }, 600)
  }

  /* ---------- 本机钱包 ---------- */

  function wallet(op, payload) {
    const current = app()
    if (!current || typeof current.send !== 'function') return null
    const result = current.send(op, payload)
    return result && typeof result.then === 'function' ? result : null
  }

  function payStake(view) {
    const key = view.matchId + ':stake:' + view.round
    if (paid[key] === true) return
    paid[key] = true
    const stake = numberIn(view.settings?.stake, 1, 100000, 0)
    const result = wallet('online-wallet', { kind: 'stake', matchId: view.matchId, handId: view.round, amount: stake })
    if (result !== null) {
      result.then(function (reply) {
        if (!isObject(reply) || reply.ok !== true) {
          ui.error = '金币不够本局底注，按认输处理'
          sendAction('leave')
        }
        rerender()
      }, function () {})
    }
  }

  function payFee(view) {
    const key = view.matchId + ':fee:' + view.rev
    if (paid[key] === true) return
    paid[key] = true
    const fee = passFee(numberIn(view.settings?.stake, 1, 100000, 100))
    const result = wallet('online-wallet', { kind: 'fee', matchId: view.matchId, handId: view.round, id: view.rev, amount: fee })
    if (result !== null) result.then(function () { rerender() }, function () {})
  }

  function settle(view, op) {
    if (ui.settled === view.matchId) return
    ui.settled = view.matchId
    const mine = view.seats?.[mySeat] ?? { paid: 0, fees: 0 }
    if (op === 'cancelled') {
      wallet('online-wallet', { kind: 'refund', matchId: view.matchId })
      ui.net = 0
      return
    }
    const win = view.winner === mySeat
    wallet('online-wallet', { kind: 'settle', matchId: view.matchId, winner: win ? 'you' : 'them', pot: win ? view.pot : 0 })
    ui.net = (win ? view.pot : 0) - mine.paid - mine.fees
  }

  /* ---------- 心跳与对手离开 ---------- */

  function startHeartbeat() {
    if (heartbeat !== null) return
    lastOtherAt = now()
    heartbeat = schedule(tick, PING_MS)
  }

  function stopHeartbeat() {
    if (heartbeat !== null) cancel(heartbeat)
    heartbeat = null
  }

  function tick() {
    heartbeat = null
    if (ui.page !== 'table' || !active(ui.matchView)) return
    const channel = bridge()
    if (channel !== null && typeof channel.send === 'function') {
      seq += 1
      channel.send(seq, 'ping', {})
    }
    watch()
    heartbeat = schedule(tick, PING_MS)
  }

  function watch() {
    if (ui.opponentGone || !active(ui.matchView) || mySeat === '' || ui.room === null) return
    // 公网的 ping 只发给权威、不进房间事件，客户端数沉默会把同一场判给两边；掉线由服务器权威结算。
    if (ui.room.authority !== 'host') return
    if (now() - lastOtherAt < SILENCE_MS) return
    ui.opponentGone = true
    if (authority() && rules !== null) {
      // 心跳超时是关窗/掉线，不是主动离开：直接判认输，不退第一局装弹前的底注。
      const seat = otherId() === rules.hostId ? 'host' : 'guest'
      const result = applyAction(rules, { from: otherId(), seq: (rules.lastSeq[seat] ?? 0) + 1, op: 'leave', data: { force: true } })
      if (result.ok) for (const item of result.events ?? []) emit(item)
    } else {
      // 对手窗口没了，底池判给自己；终局视图写回房间，对手重开大窗口时不会复活这一场。
      const view = Object.assign({}, ui.matchView, {
        stage: 'matchOver',
        winner: mySeat,
        outcome: mySeat === 'host' ? 'host-win' : 'guest-win',
        settled: true,
      })
      applyView(view, 'forfeit', {})
      emit({ op: 'forfeit', view })
    }
    rerender()
  }

  /* ---------- 对外 ---------- */

  function refresh() {
    const channel = bridge()
    if (channel !== null && typeof channel.status === 'function') {
      const result = channel.status()
      if (result && typeof result.then === 'function') result.then(onRoom, function () {})
    }
  }

  function createFailed() {
    ui.waiting = false
    ui.error = '牌桌没建成，检查房间状态'
    rerender()
  }

  function create(matchId, guestId, settings) {
    ui.matchId = matchId
    ui.waiting = true
    seq += 1
    const channel = bridge()
    if (channel !== null && typeof channel.send === 'function') {
      const result = channel.send(seq, 'create', { matchId, guestId, settings: Object.assign({}, settings) })
      if (result && typeof result.then === 'function') {
        result.then(function (reply) { if (!isObject(reply) || reply.ok !== true) createFailed() }, createFailed)
      }
    }
    rerender()
  }

  function sendAction(op, data) {
    const channel = bridge()
    if (channel === null || typeof channel.send !== 'function') {
      ui.error = '联机通道不可用'
      rerender()
      return null
    }
    seq += 1
    const result = channel.send(seq, 'action', Object.assign({ op }, data ?? {}))
    if (result && typeof result.then === 'function') {
      result.then(function (reply) {
        if (!isObject(reply) || reply.ok !== true) ui.error = '动作没发出去'
        rerender()
      }, function () { ui.error = '动作没发出去'; rerender() })
    }
    return result
  }

  function enterTable() { ui.page = 'table'; startHeartbeat() }

  function resetState() {
    rules = null
    mySeat = ''
    stopHeartbeat()
  }

  return {
    sync: bind,
    refresh,
    create,
    sendAction,
    enterTable,
    stop: stopHeartbeat,
    seat: () => mySeat,
    authority,
    active: () => active(ui.matchView),
    terminal: () => terminal(ui.matchView),
    reset: resetState,
  }
}
