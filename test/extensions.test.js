/**
 * 扩展中心（docs/design/extension-center.md）：番茄钟、钓鱼可以整体开关，开关跟着存档。
 * 用户 2026-10-05 定的：进行中也能关（放弃 / 召回）；商店里和扩展有关的东西一起撤下；背包里已有的保留。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  ensureExtensions, extensionOn, extensionsView, hatchEgg, installExtension, migrate, setExtension, startAutoFishing, startPomodoro,
} from '../packages/pet-core/src/core.js'
import { EXTENSIONS, FISH, extensionForAction } from '../packages/pet-core/src/data.js'
import { createStore } from '../store.js'
import { snapshot } from '../snapshot.js'

const NOW = new Date(2026, 9, 5, 10, 0).getTime()
const MIN = 60_000

test('注册表：番茄钟、钓鱼两条；动作能找回所属扩展', () => {
  assert.deepEqual(EXTENSIONS.map(e => e.key), ['pomodoro', 'fishing'])
  assert.equal(extensionForAction('fishCast').key, 'fishing')
  assert.equal(extensionForAction('pomodoro').key, 'pomodoro')
  assert.equal(extensionForAction('feed'), null)
  assert.equal(extensionForAction('fishFeed'), null, '背包里的鱼照样能喂')
  assert.equal(extensionForAction('fishSell'), null, '背包里的鱼照样能卖')
})

test('老存档默认全开，不升存档版本；认不出的开关原样保留', () => {
  const state = hatchEgg(NOW)
  delete state.extensions
  const version = state.version
  const loaded = migrate(state, NOW)
  assert.deepEqual(loaded.extensions, { pomodoro: true, fishing: true })
  assert.equal(loaded.version, version)
  state.extensions = { ...loaded.extensions, garden: false }
  ensureExtensions(state)
  assert.equal(state.extensions.garden, false)
  assert.equal(extensionOn(null, 'fishing'), true)
})

test('新下载扩展默认开；存档明确关过的内置与下载扩展保持关', () => {
  const state = hatchEgg(NOW)
  delete state.extensions
  ensureExtensions(state)
  for (const extension of EXTENSIONS) assert.equal(extensionOn(state, extension.key), true)
  assert.equal(installExtension(state, 'piggybank', {}).ok, true)
  assert.equal(extensionOn(state, 'piggybank'), true)
  assert.equal(setExtension(state, 'piggybank', false, NOW).ok, true)
  assert.equal(setExtension(state, 'fishing', false, NOW).ok, true)
  ensureExtensions(state)
  assert.equal(extensionOn(state, 'piggybank'), false)
  assert.equal(extensionOn(state, 'fishing'), false)
})

test('关掉番茄钟：专注中的那一个放弃（不给奖励，免打扰恢复），再打开数据都在', () => {
  const state = hatchEgg(NOW)
  state.dialogue.quiet = false
  assert.equal(startPomodoro(state, 25, NOW).ok, true)
  const coins = state.coins
  const result = setExtension(state, 'pomodoro', false, NOW + 5 * MIN)
  assert.equal(result.ok, true)
  assert.deepEqual(result.wrapped, ['pomodoro-abandoned'])
  assert.equal(state.pomodoro.startedAt, null)
  assert.equal(state.coins, coins)
  assert.equal(state.dialogue.quiet, false)
  assert.equal(extensionOn(state, 'pomodoro'), false)
  assert.equal(setExtension(state, 'pomodoro', true, NOW + 6 * MIN).changed, true)
  assert.equal(extensionOn(state, 'pomodoro'), true)
})

test('关掉钓鱼：外面自动钓鱼的猪召回、鱼饵退还；钓上来没收的鱼收进鱼篓', () => {
  const state = hatchEgg(NOW)
  state.inventory.bait_worm = 10
  assert.equal(startAutoFishing(state, 30, NOW, 'bait_worm').ok, true)
  const result = setExtension(state, 'fishing', false, NOW + MIN)
  assert.ok(result.wrapped.includes('fishing-recalled'))
  assert.equal(state.activity, null)
  assert.equal(state.inventory.bait_worm, 10)

  const again = hatchEgg(NOW)
  again.fishing.pending = { id: 'catch-1', key: FISH[0].key, sizeCm: FISH[0].minCm, price: FISH[0].price, caughtAt: NOW, phase: 'caught', castPower: 0.5, bitesAt: NOW, hookUntil: NOW + 2000, expiresAt: NOW + MIN }
  const bag = again.fishing.bag.length
  assert.ok(setExtension(again, 'fishing', false, NOW).wrapped.includes('fish-kept'))
  assert.equal(again.fishing.bag.length, bag + 1)
  assert.equal(again.fishing.pending, null)
})

test('存档里：关闭后动作被拒、番茄钟不结算、鱼饵下架且买不了；快照带扩展列表', context => {
  const dir = mkdtempSync(join(tmpdir(), 'pig-ext-'))
  let clock = NOW
  // 快照的规则视图也读取当前时间；与存档的测试时钟保持一致。
  context.mock.method(Date, 'now', () => clock)
  const store = createStore(join(dir, 'state.json'), { now: () => clock, setTimer: () => 0, clearTimer: () => {} })
  try {
    store.hatch()
    store.state.coins = 1000
    assert.ok(snapshot(store).shop.some(item => item.kind === 'bait'))
    assert.equal(store.setExtension('fishing', false).ok, true)
    const view = snapshot(store)
    assert.equal(view.extensions.find(e => e.key === 'fishing').on, false)
    assert.equal(view.shop.some(item => item.kind === 'bait'), false, '鱼饵从商店撤下')
    assert.equal(store.buy('bait_worm').reason, 'extension-off')

    assert.equal(store.startPomodoro(25).ok, true)
    store.setExtension('pomodoro', false)
    clock += 30 * MIN
    const coins = store.state.coins
    store.freshen()
    assert.equal(store.state.coins, coins, '关掉后不结算')
    assert.equal(store.extensionOn('pomodoro'), false)
    assert.deepEqual(extensionsView(store.state).map(e => [e.key, e.on]), [['pomodoro', false], ['fishing', false]])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
