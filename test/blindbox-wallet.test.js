// 盲盒 3.0：资质凭证放进宿主钱包，只能挣不能买，删掉盲盒时按 15 金币一张结清。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import blindbox from '../extensions/blindbox/server.js'
import { exchangeCurrency, hatchEgg, installExtension, removeExtension, walletsView } from '../packages/pet-core/src/core.js'
import { apiFor } from '../store/ext-api.js'

const NOW = Date.UTC(2026, 9, 9)
const MANIFEST = JSON.parse(readFileSync(new URL('../extensions/blindbox/manifest.json', import.meta.url), 'utf8'))
const CURRENCY = MANIFEST.economy.currency

function setup(certs = 0) {
  const state = hatchEgg(NOW)
  state.coins = 100_000
  installExtension(state, 'blindbox', {})
  const data = blindbox.init()
  data.certs = certs
  const api = () => apiFor(state, 'blindbox', { nowMs: NOW, currency: CURRENCY })
  return { state, data, api }
}

test('盲盒 3.0 声明资质凭证：1 张 15 金币，不能用金币买', () => {
  assert.equal(MANIFEST.version, '3.0.0')
  assert.equal(MANIFEST.minGame, '0.35.0')
  assert.deepEqual(CURRENCY, { label: '资质凭证', emoji: '📜', rate: 15, buyable: false })
})

test('老存档里的凭证第一次动作时搬进钱包；看板上的数一直是总数', () => {
  const { state, data, api } = setup(120)
  assert.equal(blindbox.view(structuredClone(data), api()).certs, 120, 'before the move the view still counts them')
  assert.equal(blindbox.actions.open(data, { banner: 'standard', count: 1 }, api(), () => 0.99).ok, true)
  assert.equal(data.certs, 0)
  assert.equal(state.wallets.blindbox.balance, 120)
  assert.equal(blindbox.view(structuredClone(data), api()).certs, 120)
  assert.equal(blindbox.view(structuredClone(data), api()).shelf.currency.balance, 120)
})

test('重复的给凭证进钱包；凭证商店从钱包扣', () => {
  const { state, data, api } = setup()
  data.owned = Object.fromEntries(blindbox.view(structuredClone(data), api()).catalog.map(entry => [entry.key, 1]))
  blindbox.actions.open(data, { banner: 'standard', count: 10 }, api(), () => 0.99)
  const earned = state.wallets.blindbox.balance
  assert.ok(earned >= 10, 'ten duplicate three-stars give at least ten')
  assert.equal(data.certs, 0)
  assert.equal(blindbox.actions.buy(data, { item: 'ticket' }, api()).ok, earned >= 20)
  if (earned >= 20) assert.equal(state.wallets.blindbox.balance, earned - 20)
  state.wallets.blindbox.balance = 5
  assert.equal(blindbox.actions.buy(data, { item: 'ticket' }, api()).reason, 'no-certs')
  assert.equal(state.wallets.blindbox.balance, 5)
})

test('凭证能换成金币，不能用金币买；删掉盲盒自动按 15 结清', () => {
  const { state, data, api } = setup(40)
  blindbox.actions.open(data, { banner: 'standard', count: 1 }, api(), () => 0.99)
  assert.equal(exchangeCurrency(state, 'blindbox', 'fromGold', 10, NOW).reason, 'not-buyable')
  assert.equal(walletsView(state).find(wallet => wallet.key === 'blindbox').buyable, false)
  const coins = state.coins
  assert.deepEqual(exchangeCurrency(state, 'blindbox', 'toGold', 10, NOW), { ok: true, amount: 10, gold: 150 })
  assert.equal(state.coins, coins + 150)
  const left = state.wallets.blindbox.balance
  assert.equal(removeExtension(state, 'blindbox', NOW).ok, true)
  assert.equal(state.coins, coins + 150 + left * 15)
})

test('打开盲盒页就把老凭证搬进钱包（sync），钱包页马上对得上', () => {
  const { state, data, api } = setup(60)
  assert.equal(blindbox.view(structuredClone(data), api()).pendingCerts, 60)
  assert.deepEqual(blindbox.actions.sync(data, {}, api()), { ok: true })
  assert.equal(state.wallets.blindbox.balance, 60)
  assert.equal(blindbox.view(structuredClone(data), api()).pendingCerts, 0)
  assert.deepEqual(blindbox.actions.sync(data, {}, api()), { ok: true }, 'a second sync is harmless')
  assert.equal(state.wallets.blindbox.balance, 60)
})
