// @ts-check
/** 0.37 迁移、离线结算、真实路由和工作事件提交的整合回归。 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { hatchEgg } from '../core.js'
import { createGameRuntime } from '../runtime/index.js'
import farm from '../extensions/farm/server.js'

const NOW = Date.UTC(2026, 9, 15, 12)
const DAY = 86_400_000
const HOUR = 3_600_000
const temp = () => mkdtempSync(join(tmpdir(), 'piggy-runtime-037-'))
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const stateOf = result => JSON.parse(result.body)
const post = (runtime, action, data = {}) => runtime.handle('POST', '/dsh-piggy/act', JSON.stringify({ action, ...data }))

test('v12 和 v13 存档经真实 Store 打开和落盘后保留钱包、背包与扩展数据', async t => {
  t.mock.method(Date, 'now', () => NOW)
  for (const version of [12, 13]) {
    const directory = temp(), statePath = join(directory, 'state.json')
    const legacy = hatchEgg(NOW)
    legacy.version = version
    legacy.coins = 731
    legacy.inventory = { apple: 7 }
    legacy.wallets = { farm: { label: '菜币', emoji: '🥬', rate: 1, balance: 19 } }
    legacy.extData = { farm: farm.init() }
    writeFileSync(statePath, JSON.stringify(legacy))
    const runtime = createGameRuntime({ statePath, now: () => NOW })
    try {
      runtime.dispose()
      const saved = read(statePath)
      assert.equal(saved.version, 14)
      assert.equal(saved.coins, 731)
      assert.equal(saved.inventory.apple, 7, JSON.stringify(saved.inventory))
      assert.deepEqual(saved.wallets.farm, { ...legacy.wallets.farm, buyable: true })
      assert.deepEqual(saved.extData.farm, legacy.extData.farm)
      assert.equal(saved.isOfflineFeedEnabled, true)
    } finally { runtime.dispose(); rmSync(directory, { recursive: true, force: true }) }
  }
})

test('设置路由关闭离线自动照顾后，跨两小时真实快照推进饱食但不扣食物', async t => {
  let clock = NOW - 2 * HOUR
  t.mock.method(Date, 'now', () => clock)
  const directory = temp(), statePath = join(directory, 'state.json')
  const state = hatchEgg(clock)
  state.inventory = { apple: 12 }
  state.satiety = 26
  writeFileSync(statePath, JSON.stringify(state))
  let runtime = createGameRuntime({ statePath, now: () => clock })
  try {
    const toggle = await post(runtime, 'offlineFeed', { on: false })
    assert.equal(toggle.status, 200)
    runtime.dispose()
    clock = NOW
    runtime = createGameRuntime({ statePath, now: () => clock })
    const snapshot = stateOf(await runtime.handle('GET', '/dsh-piggy/state'))
    assert.equal(snapshot.dialogue.isOfflineFeedEnabled, false)
    assert.ok(snapshot.pig.satiety < 25, `两小时结算后饱食应低于饥饿线，实际 ${snapshot.pig.satiety}`)
    runtime.dispose()
    assert.equal(read(statePath).inventory.apple, 12)
    assert.equal(read(statePath).isOfflineFeedEnabled, false)
  } finally { runtime.dispose(); rmSync(directory, { recursive: true, force: true }) }
})

test('垂危免费看诊和工作事件经过真实落盘，重启重复事件不再加奖', async t => {
  t.mock.method(Date, 'now', () => NOW)
  const directory = temp(), statePath = join(directory, 'state.json')
  const state = hatchEgg(NOW)
  state.health = 1
  state.coins = 5000
  state.criticalDoctorVisits = 0
  writeFileSync(statePath, JSON.stringify(state))
  const event = { version: 1, source: 'runtime-test', id: 'turn:critical-1', type: 'turn', at: NOW }
  let runtime = createGameRuntime({ statePath, now: () => NOW })
  try {
    const first = await post(runtime, 'doctor')
    assert.equal(first.status, 200)
    assert.equal(stateOf(first).ok, true)
    runtime.dispose()
    const afterDoctor = read(statePath)
    assert.equal(afterDoctor.criticalDoctorVisits, 1)
    assert.equal(afterDoctor.health, 5)
    assert.equal(afterDoctor.coins, 5000)
    runtime = createGameRuntime({ statePath, now: () => NOW })
    const before = read(statePath)
    const committed = runtime.acceptWorkEvent(event)
    assert.equal(committed.status, 'applied')
    assert.equal(committed.disposition, 'applied')
    const after = read(statePath)
    assert.equal(after.stats.turns, before.stats.turns + 1)
    assert.equal(runtime.acceptWorkEvent(event).status, 'duplicate')
    assert.deepEqual(read(statePath), after)
    assert.equal(after.criticalDoctorVisits, 1)
    assert.ok(after.stats.turns >= before.stats.turns)
    runtime.dispose()
    runtime = createGameRuntime({ statePath, now: () => NOW })
    assert.equal(runtime.acceptWorkEvent(event).status, 'duplicate')
    assert.equal(read(statePath).criticalDoctorVisits, 1)
  } finally { runtime.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
