// @ts-check
/** 联机大厅/牌桌的宿主接线：真实 client.js + 假房间，验证房主建房和事件驱动。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mountRoulette } from '../../helpers/roulette.js'

function fakeRoom(options = {}) {
  const sent = []
  const listeners = {}
  let reply = 100
  const hosting = options.hosting ?? true
  const selfId = options.selfId ?? 'host-1'
  const players = options.players ?? [
    { id: 'host-1', name: '房主', host: true },
    { id: 'guest-1', name: '客人', host: false },
  ]
  return {
    sent,
    listeners,
    hosting,
    selfId,
    snapshot: {
      ok: true, inRoom: true, hosting, authority: options.authority ?? 'host', selfId,
      code: 'PIG-7K2M', caps: ['game'], gameEvents: [],
      players,
    },
    status() { return Promise.resolve(this.snapshot) },
    onUpdate(callback) { listeners.update = callback },
    onClosed(callback) { listeners.closed = callback },
    send(seq, op, data) {
      sent.push({ seq, op, data })
      reply += 1
      return Promise.resolve({ ok: true, version: 1, eventId: reply })
    },
    push(events) {
      listeners.update(Object.assign({}, this.snapshot, { gameEvents: events }))
    },
  }
}

test('好友联机：大厅显示房间与设置，房主建房后进入牌桌并扣本局底注', async () => {
  const ui = mountRoulette({ coins: 5000 })
  const room = fakeRoom()
  ui.app.room = room
  ui.click('data-op', 'friend-mode')
  await Promise.resolve()
  await Promise.resolve()
  assert.match(ui.text(), /PIG-7K2M/)
  assert.match(ui.text(), /房主客户端权威/)
  assert.match(ui.text(), /创建牌桌/)

  ui.click('data-op', 'online-create')
  const create = room.sent.find(entry => entry.op === 'create')
  assert.ok(create !== undefined)
  assert.equal(create.data.guestId, 'guest-1')
  assert.equal(create.data.settings.stake, 1000)

  room.push([{ id: 1, from: 'host-1', ext: 'roulette', op: 'create', data: create.data }])
  await Promise.resolve()
  await Promise.resolve()
  assert.match(ui.text(), /联机牌桌/)
  assert.equal(ui.wallet.coins, 4000, '首局底注真的扣了')
  assert.equal(room.sent.some(entry => entry.op === 'match-start'), true)
  assert.equal(room.sent.some(entry => entry.op === 'round-start'), true)
  assert.equal(JSON.stringify(room.sent).includes('"bullets"'), false)
})

test('公网持久房间：没有 host 标记时，按加入顺序第一位当房主并能开局', async () => {
  const ui = mountRoulette({ coins: 5000 })
  const room = fakeRoom({
    hosting: false, selfId: 'host-1', authority: 'server',
    players: [{ id: 'host-1', name: '联机A', host: false }, { id: 'guest-1', name: '联机B', host: false }],
  })
  ui.app.room = room
  ui.click('data-op', 'friend-mode')
  await Promise.resolve()
  await Promise.resolve()
  assert.match(ui.text(), /联机A（你） 房主/)
  assert.match(ui.text(), /联机B 客人/)
  assert.match(ui.text(), /创建牌桌/)
  ui.click('data-op', 'online-create')
  const create = room.sent.find(entry => entry.op === 'create')
  assert.ok(create !== undefined)
  assert.equal(create.data.guestId, 'guest-1')
})

test('公网持久房间：第二位玩家只等待，不能自己建房', async () => {
  const ui = mountRoulette({ coins: 5000 })
  const room = fakeRoom({
    hosting: false, selfId: 'guest-1', authority: 'server',
    players: [{ id: 'host-1', name: '联机A', host: false }, { id: 'guest-1', name: '联机B', host: false }],
  })
  ui.app.room = room
  ui.click('data-op', 'friend-mode')
  await Promise.resolve()
  await Promise.resolve()
  assert.match(ui.text(), /联机A 房主/)
  assert.match(ui.text(), /联机B（你） 客人/)
  assert.match(ui.text(), /等房主设置并创建牌桌/)
  assert.equal(ui.find('data-op', 'online-create'), null)
})

test('没有开局权威的房间：徽标与提示一致，两个人都没有建房按钮', async () => {
  const ui = mountRoulette({ coins: 5000 })
  const room = fakeRoom({
    hosting: false, selfId: 'host-1', authority: 'host',
    players: [{ id: 'host-1', name: '联机A', host: false }, { id: 'guest-1', name: '联机B', host: false }],
  })
  ui.app.room = room
  ui.click('data-op', 'friend-mode')
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(ui.byClass('rt-badge').textContent, '没有开局权威')
  assert.match(ui.text(), /这个房间没有开局权威。/)
  assert.equal(ui.find('data-op', 'online-create'), null)
  assert.doesNotMatch(ui.text(), /创建牌桌/)
})

test('关房后重新入房：不再残留“联机房间已关闭”', async () => {
  const ui = mountRoulette({ coins: 5000 })
  const room = fakeRoom()
  ui.app.room = room
  ui.click('data-op', 'friend-mode')
  await Promise.resolve()
  await Promise.resolve()
  room.listeners.closed()
  room.push([])
  await Promise.resolve()
  await Promise.resolve()
  assert.doesNotMatch(ui.text(), /联机房间已关闭/)
  assert.match(ui.text(), /创建牌桌/)
})

test('没配权威的非持久房间：第一位玩家也不显示建房按钮', async () => {
  const ui = mountRoulette({ coins: 5000 })
  const room = fakeRoom({
    hosting: false, selfId: 'host-1', authority: 'host',
    players: [{ id: 'host-1', name: '联机A', host: true }, { id: 'guest-1', name: '联机B', host: false }],
  })
  ui.app.room = room
  ui.click('data-op', 'friend-mode')
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(ui.byClass('rt-badge').textContent, '没有开局权威')
  assert.match(ui.text(), /这个房间没有开局权威。/)
  assert.equal(ui.find('data-op', 'online-create'), null)
})

test('没配权威的持久房间：只有一个人也先提示没有权威', async () => {
  const ui = mountRoulette({ coins: 5000 })
  const room = fakeRoom({
    hosting: false, selfId: 'host-1', authority: 'host',
    players: [{ id: 'host-1', name: '联机A', host: false }],
  })
  ui.app.room = room
  ui.click('data-op', 'friend-mode')
  await Promise.resolve()
  await Promise.resolve()
  assert.match(ui.text(), /这个房间没有开局权威。/)
  assert.doesNotMatch(ui.text(), /等另一位朋友进房间/)
})

test('局域网客人：房主带标记时继续等房主，不显示无权威提示', async () => {
  const ui = mountRoulette({ coins: 5000 })
  const room = fakeRoom({ hosting: false, selfId: 'guest-1', authority: 'host' })
  ui.app.room = room
  ui.click('data-op', 'friend-mode')
  await Promise.resolve()
  await Promise.resolve()
  assert.match(ui.text(), /等房主设置并创建牌桌/)
  assert.doesNotMatch(ui.text(), /这个房间没有开局权威/)
})
