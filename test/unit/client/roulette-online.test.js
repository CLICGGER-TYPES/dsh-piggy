// @ts-check
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ONLINE_CHAMBERS, ONLINE_STAKE_MAX, applyAction, createMatch, initialEvent, passFee, publicView,
} from '../../../src/extensions/roulette/online.js'

function seeded(seed = 1) {
  let state = seed >>> 0
  return function random() {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function match(overrides = {}, random = seeded(7)) {
  return createMatch({
    matchId: 'm1', hostId: 'h', guestId: 'g',
    lives: 1, format: 'single', stake: 1000, loadCount: 2,
    ...overrides,
  }, random)
}

function act(state, from, seq, op, random = seeded(11)) {
  return applyAction(state, { from, seq, op }, random)
}

test('开局：两个座位各付一份底注，底池是两倍，快照不含子弹', () => {
  const state = match()
  assert.equal(state.pot, 2000)
  assert.equal(state.seats.host.paid, 1000)
  assert.equal(state.seats.guest.paid, 1000)
  assert.equal(state.round, 1)
  assert.equal(state.stage, 'arming')
  const view = publicView(state)
  assert.equal(view.pot, 2000)
  assert.equal('bullets' in view, false)
  assert.equal(JSON.stringify(view).includes('bullets"'), false)
  assert.deepEqual(initialEvent(state).op, 'match-start')
})

test('装弹只有房主能做，装完随机先手并进入开枪阶段', () => {
  const state = match()
  const guestTry = act(state, 'guest', 1, 'arm')
  assert.equal(guestTry.ok, false)
  assert.equal(guestTry.reason, 'not-loader')
  const armed = act(state, 'host', 1, 'arm', seeded(3))
  assert.equal(armed.ok, true)
  assert.equal(state.stage, 'choice')
  assert.equal(state.bullets.length, 2)
  assert.ok(['host', 'guest'].includes(state.turn))
})

test('空枪换手，中弹扣命；1 条命中弹即结束', () => {
  const state = match()
  act(state, 'host', 1, 'arm', seeded(5))
  // 直接把当前弹巢改成空/实，避免依赖随机位置。
  state.chamber = 0
  state.bullets = [1, 2]
  state.turn = 'host'
  const blank = act(state, 'host', 2, 'fire')
  assert.equal(blank.ok, true)
  assert.equal(blank.events[0].op, 'blank')
  assert.equal(state.turn, 'guest')
  assert.equal(state.lastEvent, 'blank')
  state.chamber = 1
  state.turn = 'guest'
  const hit = act(state, 'guest', 1, 'fire')
  assert.equal(hit.ok, true)
  assert.equal(hit.events[0].op, 'match-over')
  assert.equal(state.winner, 'host')
  assert.equal(state.seats.guest.lives, 0)
})

test('让枪费进底池，回让后先让者必须开枪', () => {
  const state = match()
  act(state, 'host', 1, 'arm', seeded(5))
  state.turn = 'host'
  state.chamber = 0
  state.bullets = [3, 4]
  const first = act(state, 'host', 2, 'pass')
  assert.equal(first.ok, true)
  assert.equal(state.pot, 2500)
  assert.equal(state.seats.host.fees, 500)
  assert.equal(state.turn, 'guest')
  const back = act(state, 'guest', 1, 'pass')
  assert.equal(back.ok, true)
  assert.equal(state.pot, 3000)
  assert.equal(state.seats.guest.fees, 500)
  assert.equal(state.mustShoot, 'host')
  assert.equal(state.turn, 'host')
  const blocked = act(state, 'host', 3, 'pass')
  assert.equal(blocked.ok, false)
  assert.equal(blocked.reason, 'must-shoot')
  const forced = act(state, 'host', 4, 'fire')
  assert.equal(forced.ok, true)
  assert.equal(state.mustShoot, '')
})

test('三局两胜：每局重新扣底注，先赢两局者结束', () => {
  const state = match({ format: 'bestOf3', lives: 1 })
  act(state, 'host', 1, 'arm', seeded(5))
  state.chamber = 0
  state.bullets = [0]
  state.turn = 'guest'
  act(state, 'guest', 1, 'fire')
  assert.equal(state.stage, 'roundOver')
  assert.equal(state.seats.host.wins, 1)
  const next = act(state, 'host', 2, 'next', seeded(9))
  assert.equal(next.ok, true)
  assert.equal(state.round, 2)
  assert.equal(state.pot, 4000)
  assert.equal(state.seats.host.paid, 2000)
  act(state, 'host', 3, 'arm', seeded(5))
  state.chamber = 0
  state.bullets = [0]
  state.turn = 'guest'
  act(state, 'guest', 2, 'fire')
  assert.equal(state.stage, 'matchOver')
  assert.equal(state.winner, 'host')
  assert.equal(state.settled, true)
})

test('单局：一局结束即整场结束，赢家拿底池', () => {
  const state = match({ format: 'single' })
  act(state, 'host', 1, 'arm', seeded(5))
  state.chamber = 0
  state.bullets = [0]
  state.turn = 'guest'
  act(state, 'guest', 1, 'fire')
  assert.equal(state.stage, 'matchOver')
  assert.equal(state.winner, 'host')
  assert.equal(state.pot, 2000)
})

test('第一局装弹前离开取消本场；开打后离开视为认输', () => {
  const cancelled = match()
  const leave = act(cancelled, 'guest', 1, 'leave')
  assert.equal(leave.ok, true)
  assert.equal(leave.events[0].op, 'cancelled')
  assert.equal(cancelled.outcome, 'cancelled')

  const forfeit = match()
  act(forfeit, 'host', 1, 'arm', seeded(5))
  forfeit.turn = 'host'
  forfeit.chamber = 0
  forfeit.bullets = [3, 4]
  act(forfeit, 'host', 2, 'fire')
  const left = act(forfeit, 'guest', 1, 'leave')
  assert.equal(left.ok, true)
  assert.equal(left.events[0].op, 'forfeit')
  assert.equal(forfeit.winner, 'host')
})

test('心跳超时带 force：第一局装弹前也按认输结算，不退底注', () => {
  const state = match()
  const left = applyAction(state, { from: 'guest', seq: 1, op: 'leave', data: { force: true } })
  assert.equal(left.ok, true)
  assert.equal(left.events[0].op, 'forfeit')
  assert.equal(state.outcome, 'forfeit')
  assert.equal(state.winner, 'host')
  assert.equal(state.settled, true)
})

test('重复 seq 幂等丢弃，旧 seq 不改状态', () => {
  const state = match()
  const first = act(state, 'host', 1, 'arm', seeded(5))
  assert.equal(first.ok, true)
  const rev = state.rev
  const again = act(state, 'host', 1, 'arm', seeded(5))
  assert.equal(again.ok, true)
  assert.equal(again.duplicate, true)
  assert.equal(state.rev, rev)
  const stale = act(state, 'host', 0, 'fire')
  assert.equal(stale.ok, false)
  assert.equal(stale.reason, 'bad-seq')
})

test('非当前回合不能开枪/让枪，非法座位和操作被拒绝', () => {
  const state = match()
  act(state, 'host', 1, 'arm', seeded(5))
  const turn = state.turn
  const other = turn === 'host' ? 'guest' : 'host'
  const wrong = act(state, other, 1, 'fire')
  assert.equal(wrong.ok, false)
  assert.equal(wrong.reason, 'not-your-turn')
  const badSeat = applyAction(state, { from: 'ai', seq: 1, op: 'fire' })
  assert.equal(badSeat.ok, false)
  assert.equal(badSeat.reason, 'bad-seat')
  const badOp = act(state, turn, 2, 'dance')
  assert.equal(badOp.ok, false)
  assert.equal(badOp.reason, 'bad-op')
})

test('让枪费按当前底注 50% 向上取整', () => {
  assert.equal(passFee(100), 50)
  assert.equal(passFee(101), 51)
  assert.equal(passFee(ONLINE_STAKE_MAX), 5000)
})

test('整场任何快照都不含子弹数组', () => {
  const state = match({ format: 'bestOf3', loadCount: 5 })
  const views = [publicView(state)]
  act(state, 'host', 1, 'arm', seeded(5))
  views.push(publicView(state))
  for (let index = 0; index < 4; index += 1) {
    if (state.stage !== 'choice') break
    state.chamber = state.bullets.includes(state.chamber) ? state.chamber : state.bullets[0]
    const seat = state.turn
    const result = act(state, seat, 2 + index, 'fire')
    views.push(publicView(state))
    if (!result.ok) break
  }
  for (const view of views) {
    assert.equal('bullets' in view, false)
    assert.equal('lastSeq' in view, false)
    assert.ok(view.chamber >= 0 && view.chamber < ONLINE_CHAMBERS)
  }
})
