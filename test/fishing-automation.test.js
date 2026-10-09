// @ts-check
/** 宿主自动钓鱼：新旧行程、仓位、补饵、重启和离线结算走真实领域函数。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { buyFishingAutomation, callOffActivity, collectAutoFish, decay, ensureFishing, finishActivity, grantFish, hatchEgg, migrate, startAutoFishing } from '../core.js'
import { settleAutoFishing } from '../packages/pet-core/src/core/fishing-auto.js'
const NOW = new Date(2026, 9, 9, 12).getTime()
const fresh = () => { const state = hatchEgg(NOW); state.coins = 100000; state.inventory.bait_worm = 100; return state }
function upgraded() {
  const state = fresh()
  for (const kind of ['basket', 'duration', 'baitBox']) for (let index = 0; index < 2; index += 1) assert.equal(buyFishingAutomation(state, kind, NOW).ok, true)
  return state
}

test('钓鱼升级：顺序买、金币进账本、钱不够不扣、旧档默认保留全部历史鱼', () => {
  const state = fresh()
  state.coins = 1499
  assert.equal(buyFishingAutomation(state, 'basket', NOW).reason, 'poor')
  assert.equal(state.coins, 1499)
  assert.equal(buyFishingAutomation(state, '__proto__', NOW).reason, 'unknown')
  for (let index = 0; index < 20; index += 1) grantFish(state, 'fish_carp', NOW + index)
  state.version = 12
  delete state.fishing.automation
  const before = structuredClone(state.fishing.bag)
  const loaded = migrate(state, NOW)
  assert.equal(loaded.version, 12)
  assert.deepEqual(loaded.fishing.bag, before)
  assert.deepEqual(loaded.fishing.automation, { basket: 0, duration: 0, baitBox: 0, usedMs: 0, stock: [] })
})

test('新自动钓：逐竿消费、重启不重钓、一小时 13 竿，旧背包不受仓位影响', () => {
  const state = upgraded()
  for (let index = 0; index < 20; index += 1) grantFish(state, 'fish_carp', NOW + index)
  assert.equal(startAutoFishing(state, 240, NOW, 'bait_worm').ok, true)
  assert.equal(state.inventory.bait_worm, 100)
  settleAutoFishing(state, state.activity, NOW + 3600000)
  assert.equal(state.activity.auto.attempted, 13)
  assert.equal(state.inventory.bait_worm, 87)
  assert.equal(state.fishing.bag.length, 20)
  const stock = structuredClone(state.fishing.automation.stock), seed = state.activity.auto.seed
  const loaded = migrate(state, NOW + 3600000)
  assert.equal(loaded.activity.key, 'auto-240')
  assert.equal(loaded.activity.auto.attempted, 13)
  settleAutoFishing(loaded, loaded.activity, NOW + 3600000)
  assert.deepEqual(loaded.fishing.automation.stock, stock)
  assert.equal(loaded.activity.auto.seed, seed)
  loaded.inventory.bait_worm = 0
  decay(loaded, NOW + 7200000, { roll: () => 0 })
  assert.equal(loaded.activity, null)
  assert.equal(loaded.fishing.automation.stock.length, stock.length)
})

test('新自动钓：分段、一天离线结果相同，最多一趟四小时 / 53 竿 / 六小时仓', () => {
  const first = upgraded(), second = upgraded()
  for (const state of [first, second]) startAutoFishing(state, 240, NOW, 'bait_worm')
  for (let index = 1; index <= 24 && first.activity; index += 1) settleAutoFishing(first, first.activity, NOW + index * 600000)
  settleAutoFishing(second, second.activity, NOW + 86400000)
  assert.deepEqual(first.fishing.automation.stock, second.fishing.automation.stock)
  assert.equal(first.inventory.bait_worm, second.inventory.bait_worm)
  assert.ok(second.activity.auto.attempted <= 53)
  assert.ok(second.fishing.automation.stock.length <= 53)
  finishActivity(second, NOW + 86400000)
  const stored = second.fishing.automation.stock.length
  assert.equal(collectAutoFish(second, NOW + 86400000).count, stored)
  assert.equal(collectAutoFish(second, NOW + 86400000).reason, 'empty')
})

test('新鱼篓按三趟两小时封仓；旧 30/60 不受新仓或盒限制', () => {
  const state = upgraded()
  state.inventory.bait_worm = 200
  for (let trip = 0; trip < 3; trip += 1) {
    const at = NOW + trip * 7200000
    assert.equal(startAutoFishing(state, 120, at, 'bait_worm').ok, true)
    finishActivity(state, state.activity.endsAt)
  }
  assert.equal(state.fishing.automation.usedMs, 21600000)
  assert.equal(startAutoFishing(state, 120, NOW + 21600000, 'bait_worm').reason, 'unavailable')
  const stock = structuredClone(state.fishing.automation.stock)
  const before = state.inventory.bait_worm
  assert.equal(startAutoFishing(state, 30, NOW + 21600000, 'bait_worm').ok, true)
  assert.equal(state.activity.auto, undefined)
  assert.equal(state.inventory.bait_worm, before - 10)
  finishActivity(state, state.activity.endsAt, () => 0)
  assert.equal(state.fishing.bag.length, 10)
  assert.deepEqual(state.fishing.automation.stock, stock)
})

test('鱼饵盒：少量鱼饵也能出发，耗尽就回；召回只退未用的预付饵', () => {
  const state = fresh()
  buyFishingAutomation(state, 'duration', NOW)
  buyFishingAutomation(state, 'baitBox', NOW)
  state.inventory.bait_worm = 2
  assert.equal(startAutoFishing(state, 120, NOW, 'bait_worm').ok, true)
  decay(state, NOW + 3600000, { roll: () => 0 })
  assert.equal(state.activity, null)
  assert.equal(state.inventory.bait_worm ?? 0, 0)
  const prepaid = fresh()
  startAutoFishing(prepaid, 60, NOW, 'bait_worm')
  settleAutoFishing(prepaid, prepaid.activity, NOW + 600000)
  const spent = 0
  callOffActivity(prepaid, NOW + 600000)
  assert.equal(prepaid.inventory.bait_worm, 100)
})

test('旧三分钟行程照旧结完；新升级期间不丢旧进度', () => {
  const state = fresh()
  state.version = 12
  state.inventory.bait_worm = 90
  state.activity = { kind: 'fishing', key: 'auto-30', label: '自动钓鱼 30 分钟', emoji: '🎣',
    startedAt: NOW, endsAt: NOW + 1800000, baitKey: 'bait_worm', baitCount: 10, cost: 0 }
  const loaded = migrate(state, NOW)
  assert.equal(loaded.activity.auto, undefined)
  finishActivity(loaded, NOW + 1800000, () => 0)
  assert.equal(loaded.fishing.bag.length, 10)
  assert.equal(loaded.fishing.automation.stock.length, 0)
  assert.equal(loaded.inventory.bait_worm, 90)
  ensureFishing(loaded)
  assert.equal(loaded.fishing.bag.length, 10)
})

test('旧 30/60 在新仓满、鱼饵盒已升满时仍预付 10/20 饵，直接入背包', () => {
  for (const minutes of [30, 60]) {
    const state = upgraded()
    state.fishing.automation.usedMs = 21600000
    const before = state.inventory.bait_worm
    assert.equal(startAutoFishing(state, minutes, NOW, 'bait_worm').ok, true)
    assert.equal(state.activity.auto, undefined)
    assert.equal(state.activity.baitCount, minutes / 3)
    assert.equal(state.inventory.bait_worm, before - minutes / 3)
    finishActivity(state, state.activity.endsAt, () => 0)
    assert.equal(state.fishing.bag.length, minutes / 3)
    assert.equal(state.fishing.automation.stock.length, 0)
    assert.equal(state.fishing.automation.usedMs, 21600000)
  }
})
