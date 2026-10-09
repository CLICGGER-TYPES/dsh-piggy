// @ts-check
/**
 * 经济底座（docs/design/economy.md，用户 2026-10-09：「要一套很健壮的，扩展删了不会影响现有的体系」）。
 * 金币只能走 core/economy.js；扩展的账只记在 ext.<扩展名>. 下；删扩展、扩展出错、坏账本都不能连累别的。
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { earnCoins, economyView, ensureEconomy, exert, hatchEgg, installExtension, migrate, refundCoins, removeExtension, spendCoins } from '../core.js'
import { EXT_EARN_PER_ACTION, LEDGER } from '../data.js'
import { runExtensionAction } from '../store/ext-actions.js'

const DAY = 86_400_000
const NOW = new Date(2026, 9, 9, 12).getTime()

const fresh = () => { const state = hatchEgg(NOW); state.coins = 1000; return state }

test('earn, spend and refund move coins and keep a per-source ledger', () => {
  const state = fresh()
  assert.equal(earnCoins(state, 120, 'work', NOW), 120)
  assert.equal(spendCoins(state, 200, 'trip', NOW), true)
  assert.equal(refundCoins(state, 200, 'trip', NOW), 200, 'coming back early refunds the trip')
  assert.equal(spendCoins(state, 999_999, 'shop', NOW), false, 'not enough coins: nothing changes')
  assert.equal(state.coins, 1120)
  const view = /** @type {any} */ (economyView(state))
  assert.deepEqual(view.sources.find(s => s.source === 'work'), { source: 'work', label: '打工', in: 120, out: 0 })
  assert.deepEqual(view.sources.find(s => s.source === 'trip'), { source: 'trip', label: '旅行', in: 0, out: 0 }, 'a refund cancels the spending instead of counting as income')
  assert.equal(view.sources.some(s => s.source === 'shop'), false, 'a refused purchase is not recorded')
  assert.deepEqual(view.days.at(-1), { day: '2026-10-09', in: 120, out: 0 })
})

test('the ledger stays small: a week of days, a bounded number of sources', () => {
  const state = fresh()
  for (let day = 0; day < 20; day += 1) earnCoins(state, 1, 'work', NOW + day * DAY)
  assert.equal(state.economy.days.length, LEDGER.days)
  for (let i = 0; i < LEDGER.maxSources + 50; i += 1) earnCoins(state, 1, 'source-' + i, NOW)
  assert.ok(Object.keys(state.economy.totals).length <= LEDGER.maxSources + 1, 'extra sources fold into other')
  assert.ok(state.economy.totals.other.in >= 50)
})

test('a broken ledger in the save is repaired without touching coins', () => {
  const state = fresh()
  state.economy = { totals: { 'bad name!': { in: 5 }, work: { in: -3, out: 'x' }, 'sell.fish': { in: 7.9, out: 2 } }, days: 'nope', fatigue: 9 }
  const loaded = migrate(JSON.parse(JSON.stringify(state)), NOW)
  assert.equal(loaded.coins, 1000)
  assert.deepEqual(loaded.economy.totals, { work: { in: 0, out: 0 }, 'sell.fish': { in: 7, out: 2 } })
  assert.deepEqual(loaded.economy.days, [])
  assert.equal(loaded.economy.fatigue, 1)
})

test('playing tires the pig: fractions of satiety add up before a whole point is taken', () => {
  const state = fresh()
  state.satiety = 50
  for (let i = 0; i < 3; i += 1) exert(state, 0.3)
  assert.equal(state.satiety, 50, '0.9 is still below one point')
  exert(state, 0.3)
  assert.equal(state.satiety, 49)
  ensureEconomy(state)
  assert.ok(Math.abs(state.economy.fatigue - 0.2) < 1e-9)
})

// ---------------------------------------------------------------------------
// 扩展
// ---------------------------------------------------------------------------

/** 装一个下载扩展并跑它的一个动作。 */
function act(state, key, handler, payload = {}) {
  return runExtensionAction(state, handler, { key, payload, nowMs: NOW })
}

test('an extension can only write under ext.<key>., however it names its sources', () => {
  const state = fresh()
  installExtension(state, 'farm', {})
  const result = act(state, 'farm', (data, payload, api) => {
    api.earn(10, 'work')          // pretending to be the job income
    api.earn(5, '../../sell.fish') // and the fish market
    api.spend(3)
    return { ok: true }
  })
  assert.equal(result.ok, true)
  assert.equal(state.coins, 1012)
  const names = Object.keys(state.economy.totals).sort()
  assert.deepEqual(names, ['ext.farm.sellfish', 'ext.farm.spend', 'ext.farm.work'])
  assert.equal(state.economy.totals.work, undefined, 'the real job income line is untouched')
})

test('an extension cannot mint more than the per-action cap or spend coins the pig does not have', () => {
  const state = fresh()
  installExtension(state, 'mine', {})
  act(state, 'mine', (data, payload, api) => {
    for (let i = 0; i < 20; i += 1) api.earn(EXT_EARN_PER_ACTION)
    return { ok: true }
  })
  assert.equal(state.coins, 1000 + EXT_EARN_PER_ACTION)
  const before = state.coins
  const result = act(state, 'mine', (data, payload, api) => ({ ok: api.spend(before + 1) }))
  assert.equal(result.ok, false)
  assert.equal(state.coins, before)
})

test('an extension that throws halfway changes neither coins nor the ledger', () => {
  const state = fresh()
  installExtension(state, 'gacha', {})
  const ledgerBefore = JSON.stringify(state.economy ?? null)
  const result = act(state, 'gacha', (data, payload, api) => {
    api.spend(500, 'pull')
    throw new Error('bug after paying')
  })
  assert.equal(result.ok, false)
  assert.equal(state.coins, 1000)
  assert.equal(JSON.stringify(state.economy ?? null), ledgerBefore)
})

test('removing an extension leaves coins, the bag, the core ledger and other extensions alone', () => {
  const state = fresh()
  installExtension(state, 'farm', {})
  installExtension(state, 'mine', {})
  earnCoins(state, 100, 'work', NOW)
  act(state, 'farm', (data, payload, api) => { api.earn(50, 'sell'); api.give('apple', 2); return { ok: true } })
  act(state, 'mine', (data, payload, api) => { api.earn(70, 'sell'); return { ok: true } })
  const coins = state.coins
  const apples = state.inventory.apple
  assert.equal(removeExtension(state, 'farm', NOW).ok, true)
  assert.equal(state.coins, coins, 'coins earned from a deleted extension stay earned')
  assert.equal(state.inventory.apple, apples, 'game items it gave stay in the bag')
  assert.equal(state.economy.totals.work.in, 100)
  assert.equal(state.economy.totals['ext.farm.sell'].in, 50, 'its history stays in the ledger')
  assert.equal(act(state, 'farm', (data, payload, api) => { api.earn(1); return { ok: true } }).ok, false, 'a deleted extension can no longer act')
  assert.equal(act(state, 'mine', (data, payload, api) => { api.earn(1, 'sell'); return { ok: true } }).ok, true, 'the others keep working')
  // Reload the save: nothing about the economy depends on the deleted extension being there.
  const loaded = migrate(JSON.parse(JSON.stringify(state)), NOW)
  assert.equal(loaded.coins, state.coins)
  assert.ok(/** @type {any} */ (economyView(loaded)).sources.some(s => s.source === 'ext.farm.sell'))
})

test('an extension can only give items the game knows', () => {
  const state = fresh()
  installExtension(state, 'farm', {})
  act(state, 'farm', (data, payload, api) => ({ ok: api.give('not-a-thing', 3) === false }))
  assert.equal(state.inventory['not-a-thing'], undefined)
})

// ---------------------------------------------------------------------------
// 守规矩：金币只能走 core/economy.js
// ---------------------------------------------------------------------------

test('nothing outside core/economy.js changes coins with += or -=', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const offenders = []
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) { if (name !== 'node_modules') walk(full); continue }
      if (!name.endsWith('.js') || full.endsWith(join('core', 'economy.js'))) continue
      const text = readFileSync(full, 'utf8')
      if (/\bcoins\s*[-+]=/.test(text)) offenders.push(full.slice(root.length))
    }
  }
  for (const dir of ['packages/pet-core/src', 'store']) walk(join(root, dir))
  for (const file of ['index.js', 'routes.js', 'snapshot.js', 'commands.js']) {
    if (/\bcoins\s*[-+]=/.test(readFileSync(join(root, file), 'utf8'))) offenders.push(file)
  }
  assert.deepEqual(offenders, [], 'use earnCoins / spendCoins / refundCoins so the ledger stays right')
})
