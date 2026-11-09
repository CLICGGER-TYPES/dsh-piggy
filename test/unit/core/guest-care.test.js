// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applyGuestCare, applyGuestMedicine, hatchEgg, refundCareItem, takeCareItem } from '../../../src/host/core.js'
import { catchIllness } from '../../../packages/pet-core/src/core/illness.js'

const NOW = 1_800_000_000_000

function pig() {
  const state = hatchEgg(NOW)
  state.satiety = 40
  state.cleanliness = 40
  state.happiness = 40
  state.inventory = { cake: 1 }
  state.lastSeenAt = NOW
  return state
}

test('朋友照顾只应用物品效果，不扣目标背包', () => {
  const state = pig()
  const before = state.satiety
  const result = applyGuestCare(state, 'feed', NOW, 'cake')
  assert.equal(result.ok, true)
  assert.equal(state.inventory.cake, 1, 'the target keeps its own cake')
  assert.ok(state.satiety > before)
  assert.equal(result.care.satiety, state.satiety)
})

test('客人先扣自己的物品，失败时能退回', () => {
  const state = pig()
  assert.equal(takeCareItem(state, 'feed', 'cake').ok, true)
  assert.equal(state.inventory.cake, undefined)
  assert.equal(refundCareItem(state, 'feed', 'cake').ok, true)
  assert.equal(state.inventory.cake, 1)
})

test('照顾物品必须和货架匹配', () => {
  const state = pig()
  assert.equal(applyGuestCare(state, 'feed', NOW, 'bubble').ok, false)
  assert.equal(takeCareItem(state, 'bathe', 'cake').ok, false)
})


test('朋友的药品也先扣自己的，健康时用会拒绝并退回', () => {
  const state = pig()
  state.inventory = { banlangen: 1 }
  assert.equal(takeCareItem(state, 'medicine', 'banlangen').ok, true)
  assert.equal(state.inventory.banlangen, undefined)
  assert.equal(refundCareItem(state, 'medicine', 'banlangen').ok, true)
  assert.equal(state.inventory.banlangen, 1)
  assert.equal(applyGuestMedicine(state, 'banlangen', NOW).reason, 'not-sick')
})


test('朋友用对症药治好目标猪的病', () => {
  const state = pig()
  catchIllness(state, 0, NOW)
  const result = applyGuestMedicine(state, 'banlangen', NOW)
  assert.equal(result.ok, true)
  assert.equal(state.illness, null)
})
