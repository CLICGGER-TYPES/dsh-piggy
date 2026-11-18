// @ts-check
/** 联机大厅/牌桌的宿主接线：真实 client.js + 假房间，验证房主建房和事件驱动。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mountRoulette } from '../../helpers/roulette.js'

function fakeRoom() {
  const sent = []
  const listeners = {}
  let reply = 100
  return {
    sent,
    listeners,
    hosting: true,
    selfId: 'host-1',
    snapshot: {
      ok: true, inRoom: true, hosting: true, authority: 'host', selfId: 'host-1',
      code: 'PIG-7K2M', caps: ['game'], gameEvents: [],
      players: [{ id: 'host-1', name: '房主', host: true }, { id: 'guest-1', name: '客人', host: false }],
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
