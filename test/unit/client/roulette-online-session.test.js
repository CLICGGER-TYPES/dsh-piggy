// @ts-check
/** 联机会话：房主权威、客人事件、钱包幂等与心跳超时。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createMatch, publicView } from '../../../src/extensions/roulette/online.js'
import { createOnlineSession } from '../../../src/extensions/roulette/client/online-session.js'

function createUi() {
  return {
    page: 'lobby', room: null, roomError: '', matchView: null, matchId: '',
    error: '', waiting: false, flash: '', spinning: false, net: null, settled: '', opponentGone: false,
  }
}

function fakeRoom(options) {
  const listeners = {}
  const sent = []
  let replyId = 100
  const room = {
    listeners,
    sent,
    snapshot: {
      ok: true, inRoom: true, hosting: options.hosting, authority: options.authority ?? 'host',
      selfId: options.selfId, code: 'PIG-7K2M',
      players: options.players ?? [
        { id: 'host-1', name: '房主', host: true },
        { id: 'guest-1', name: '客人', host: false },
      ],
      caps: ['game'], gameEvents: [],
    },
    onUpdate(callback) { listeners.update = callback },
    onClosed(callback) { listeners.closed = callback },
    status() { return Promise.resolve(room.snapshot) },
    send(seq, op, data) {
      sent.push({ seq, op, data })
      replyId += 1
      return Promise.resolve({ ok: true, version: 1, eventId: replyId })
    },
    push(events) {
      room.snapshot = Object.assign({}, room.snapshot, { gameEvents: events })
      listeners.update(room.snapshot)
    },
  }
  return room
}

function fakeTimers() {
  let clock = 0
  let nextId = 0
  const tasks = []
  return {
    now: () => clock,
    schedule(fn, ms) {
      nextId += 1
      tasks.push({ id: nextId, fn, at: clock + ms, canceled: false })
      return nextId
    },
    cancel(id) {
      const task = tasks.find(entry => entry.id === id)
      if (task) task.canceled = true
    },
    advance(ms) {
      clock += ms
      for (;;) {
        const due = tasks.filter(task => !task.canceled && task.at <= clock).sort((a, b) => a.at - b.at)[0]
        if (!due) return
        due.canceled = true
        due.fn()
      }
    },
  }
}

function createWallet() {
  const calls = []
  const app = {
    data: { coins: 5000 },
    send(op, payload) { calls.push([op, payload]); return Promise.resolve({ ok: true }) },
  }
  return { app, calls }
}

async function settleMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

function hostSetup() {
  const ui = createUi()
  const timers = fakeTimers()
  const wallet = createWallet()
  const room = fakeRoom({ hosting: true, selfId: 'host-1', authority: 'host' })
  wallet.app.room = room
  const session = createOnlineSession({
    ui, getApp: () => wallet.app, rerender() {},
    schedule: timers.schedule, cancel: timers.cancel, now: timers.now,
  })
  return { ui, room, wallet, session, timers }
}

test('房主权威：create 事件建局，广播 match-start / round-start，只扣一次底注', async () => {
  const { ui, room, wallet, session } = hostSetup()
  session.sync()
  await settleMicrotasks()
  room.push([{
    id: 1, from: 'host-1', ext: 'roulette', op: 'create',
    data: { matchId: 'm1', guestId: 'guest-1', settings: { lives: 1, format: 'single', stake: 1000, loadCount: 2 } },
  }])
  await settleMicrotasks()
  assert.equal(ui.page, 'table')
  assert.equal(ui.matchView.pot, 2000)
  assert.equal(ui.matchView.stage, 'arming')
  assert.deepEqual(room.sent.map(entry => entry.op), ['match-start', 'round-start'])
  assert.deepEqual(wallet.calls, [['online-wallet', { kind: 'stake', matchId: 'm1', handId: 1, amount: 1000 }]])
  assert.equal(ui.matchView.hostId, 'host-1')
  assert.equal(ui.matchView.guestId, 'guest-1')

  const action = { id: 2, from: 'host-1', ext: 'roulette', op: 'action', data: { op: 'arm', chamber: 2 } }
  room.push([action])
  await settleMicrotasks()
  assert.equal(ui.matchView.stage, 'choice')
  assert.equal(room.sent.at(-1).op, 'arm')
  assert.equal('bullets' in room.sent.at(-1).data, false)
  assert.equal(JSON.stringify(room.sent).includes('"bullets"'), false)
})

test('客人：权威事件驱动界面，自己的让枪付进底池，赢家结算底池', async () => {
  const ui = createUi()
  const timers = fakeTimers()
  const wallet = createWallet()
  const room = fakeRoom({ hosting: false, selfId: 'guest-1', authority: 'host' })
  wallet.app.room = room
  const session = createOnlineSession({
    ui, getApp: () => wallet.app, rerender() {},
    schedule: timers.schedule, cancel: timers.cancel, now: timers.now,
  })
  session.sync()
  await settleMicrotasks()
  const state = createMatch({ matchId: 'm2', hostId: 'host-1', guestId: 'guest-1', stake: 500, lives: 1, format: 'single', loadCount: 1 })
  const view = publicView(state)
  room.push([{ id: 5, from: 'authority', ext: 'roulette', op: 'match-start', data: { op: 'match-start', view } }])
  await settleMicrotasks()
  assert.equal(ui.page, 'table')
  assert.deepEqual(wallet.calls.at(-1), ['online-wallet', { kind: 'stake', matchId: 'm2', handId: 1, amount: 500 }])

  const passed = Object.assign({}, view, {
    rev: view.rev + 1, lastEvent: 'guest-pass', passBy: 'guest', turn: 'host',
    seats: { host: view.seats.host, guest: Object.assign({}, view.seats.guest, { fees: 250 }) },
  })
  room.push([{ id: 6, from: 'authority', ext: 'roulette', op: 'pass', data: { op: 'pass', who: 'guest', fee: 250, view: passed } }])
  await settleMicrotasks()
  assert.deepEqual(wallet.calls.at(-1), ['online-wallet', { kind: 'fee', matchId: 'm2', handId: 1, id: passed.rev, amount: 250 }])

  const over = Object.assign({}, passed, {
    rev: passed.rev + 1, stage: 'matchOver', winner: 'guest', outcome: 'guest-win', settled: true,
    pot: 1250,
  })
  room.push([{ id: 7, from: 'authority', ext: 'roulette', op: 'match-over', data: { op: 'match-over', winner: 'guest', pot: 1250, view: over } }])
  await settleMicrotasks()
  assert.deepEqual(wallet.calls.at(-1), ['online-wallet', { kind: 'settle', matchId: 'm2', winner: 'you', pot: 1250 }])
  assert.equal(ui.net, 1250 - 500 - 250)
  assert.equal(ui.settled, 'm2')
})

test('心跳：对手沉默超过 20 秒，客人本地判对手离开并把底池判给自己', async () => {
  const ui = createUi()
  const timers = fakeTimers()
  const wallet = createWallet()
  const room = fakeRoom({ hosting: false, selfId: 'guest-1', authority: 'host' })
  wallet.app.room = room
  const session = createOnlineSession({
    ui, getApp: () => wallet.app, rerender() {},
    schedule: timers.schedule, cancel: timers.cancel, now: timers.now,
  })
  session.sync()
  await settleMicrotasks()
  const state = createMatch({ matchId: 'm3', hostId: 'host-1', guestId: 'guest-1', stake: 500, lives: 1, format: 'single', loadCount: 1 })
  const view = publicView(state)
  room.push([{ id: 1, from: 'host-1', ext: 'roulette', op: 'match-start', data: { op: 'match-start', view } }])
  await settleMicrotasks()
  session.enterTable()
  timers.advance(25000)
  await settleMicrotasks()
  assert.equal(ui.opponentGone, true)
  assert.equal(ui.matchView.stage, 'matchOver')
  assert.equal(ui.matchView.winner, 'guest')
  assert.equal(wallet.calls.at(-1)[1].kind, 'settle')
  assert.equal(wallet.calls.at(-1)[1].winner, 'you')
})

test('公网权威：客户端不按沉默自行结算，掉线交给服务器判', async () => {
  const ui = createUi()
  const timers = fakeTimers()
  const wallet = createWallet()
  const room = fakeRoom({ hosting: false, selfId: 'guest-1', authority: 'server' })
  wallet.app.room = room
  const session = createOnlineSession({
    ui, getApp: () => wallet.app, rerender() {},
    schedule: timers.schedule, cancel: timers.cancel, now: timers.now,
  })
  session.sync()
  await settleMicrotasks()
  const state = createMatch({ matchId: 'm7', hostId: 'host-1', guestId: 'guest-1', stake: 500, lives: 1, format: 'single', loadCount: 1 })
  room.push([{ id: 1, from: 'host-1', ext: 'roulette', op: 'match-start', data: { op: 'match-start', view: publicView(state) } }])
  await settleMicrotasks()
  session.enterTable()
  const eventsBefore = room.sent.length
  timers.advance(25000)
  await settleMicrotasks()
  assert.equal(ui.opponentGone, false, '公网模式不能因为没事件就把对手算掉线')
  assert.equal(ui.matchView.stage, 'arming')
  assert.equal(wallet.calls.some(call => call[1].kind === 'settle'), false, '不能自行结算底池')
  assert.equal(room.sent.slice(eventsBefore).some(entry => entry.op === 'forfeit'), false)
})

test('重开大窗口：历史只回放终局视图，不复活对局，seq 接着房间事件号', async () => {
  const ui = createUi()
  const timers = fakeTimers()
  const room = fakeRoom({ hosting: true, selfId: 'host-1', authority: 'host' })
  const wallet = createWallet()
  wallet.app.room = room
  const state = createMatch({ matchId: 'm5', hostId: 'host-1', guestId: 'guest-1', stake: 100, lives: 1, format: 'single', loadCount: 1 })
  const view = publicView(state)
  const over = Object.assign({}, view, { stage: 'matchOver', winner: 'guest', outcome: 'guest-win', settled: true })
  room.snapshot.gameEvents = [
    { id: 1, from: 'host-1', ext: 'roulette', op: 'create', data: { matchId: 'm5', guestId: 'guest-1', settings: state.settings } },
    { id: 2, from: 'host-1', ext: 'roulette', op: 'match-start', data: { op: 'match-start', view } },
    { id: 3, from: 'host-1', ext: 'roulette', op: 'round-start', data: { op: 'round-start', round: 1, stake: 100, pot: 200, view } },
    { id: 4, from: 'guest-1', ext: 'roulette', op: 'forfeit', data: { op: 'forfeit', view: over } },
  ]
  const session = createOnlineSession({
    ui, getApp: () => wallet.app, rerender() {},
    schedule: timers.schedule, cancel: timers.cancel, now: timers.now,
  })
  session.sync()
  await settleMicrotasks()
  assert.equal(ui.matchView.stage, 'matchOver', '回放后停在终局，不复活装弹中')
  assert.equal(ui.matchView.winner, 'guest')
  assert.equal(room.sent.length, 0, '历史不能重新广播开局事件')
  session.create('m6', 'guest-1', { lives: 1, format: 'single', stake: 100, loadCount: 1 })
  await settleMicrotasks()
  assert.equal(room.sent.length, 1)
  assert.equal(room.sent[0].op, 'create')
  assert.equal(room.sent[0].seq, 5, '新窗口的 seq 从房间已有事件号 4 往后走')
})

test('房主心跳超时：替客人发 leave，事件广播出去', async () => {
  const { ui, room, wallet, session, timers } = hostSetup()
  session.sync()
  await settleMicrotasks()
  room.push([{
    id: 1, from: 'host-1', ext: 'roulette', op: 'create',
    data: { matchId: 'm4', guestId: 'guest-1', settings: { lives: 1, format: 'single', stake: 1000, loadCount: 1 } },
  }])
  await settleMicrotasks()
  session.enterTable()
  const before = room.sent.length
  timers.advance(25000)
  await settleMicrotasks()
  const events = room.sent.slice(before)
  assert.equal(events.some(entry => entry.op === 'cancelled' || entry.op === 'forfeit'), true)
  assert.equal(ui.matchView.stage, 'matchOver')
  // 心跳超时是掉线/关窗，按认输算，不走第一局装弹前的取消退注。
  assert.equal(events.some(entry => entry.op === 'forfeit'), true)
  assert.equal(wallet.calls.at(-1)[1].kind, 'settle')
  assert.equal(wallet.calls.at(-1)[1].winner, 'you')
})
