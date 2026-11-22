/**
 * api.refund：扩展取消/退款时冲掉原来的支出，不能凭空造币，也不能记成收入。
 * 背景：左轮第一局装弹前退出、联机取消对局都要退底注（docs/design/roulette-rules-20261118.md）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { economyView, hatchEgg } from '../../../packages/pet-core/src/core.js'
import { apiFor } from '../../../store/ext-api.js'

const NOW = Date.UTC(2026, 10, 22)

function setup() {
  const state = hatchEgg(NOW)
  state.coins = 10_000
  return { state, api: apiFor(state, 'demo', { nowMs: NOW }) }
}

const sourceOf = (state, name) => economyView(state).sources.find(entry => entry.source === name)

test('退款冲掉原支出，不记成收入', () => {
  const { state, api } = setup()
  assert.equal(api.spend(500, 'bet'), true)
  assert.equal(state.coins, 9_500)
  assert.equal(api.refund(200, 'bet'), 200)
  assert.equal(state.coins, 9_700)
  assert.deepEqual(sourceOf(state, 'ext.demo.bet'), { source: 'ext.demo.bet', label: null, in: 0, out: 300 })
  assert.equal(sourceOf(state, 'ext.demo.refund'), undefined, '退款不新增收入行')
})

test('最多退这项还没退完的钱，多给只退能退的', () => {
  const { state, api } = setup()
  api.spend(500, 'bet')
  assert.equal(api.refund(800, 'bet'), 500)
  assert.equal(state.coins, 10_000)
  assert.equal(api.refund(1, 'bet'), 0, '退完再退没有钱可退')
  assert.equal(sourceOf(state, 'ext.demo.bet').out, 0)
})

test('没花过、去处不对、金额不合法都退不到钱', () => {
  const { state, api } = setup()
  assert.equal(api.refund(100, 'bet'), 0)
  api.spend(100, 'bet')
  assert.equal(api.refund(100, 'seed'), 0, '去处名要一致')
  assert.equal(api.refund(0, 'bet'), 0)
  assert.equal(api.refund(-50, 'bet'), 0)
  assert.equal(api.refund('abc', 'bet'), 0)
  assert.equal(state.coins, 9_900)
  assert.equal(sourceOf(state, 'ext.demo.bet').out, 100)
})
