// @ts-check
/**
 * 扩展币钱包（规则 1，用户 2026-10-09：每个扩展自己的货币，按比例换金币；删了扩展也按比例换成金币）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { exchangeCurrency, hatchEgg, installExtension, migrate, openWallet, removeExtension, walletsView } from '../core.js'
import { EXCHANGE } from '../data.js'
import { runExtensionAction } from '../store/ext-actions.js'
import { fakeDom, findByAttr } from './helpers/bundle.js'

const NOW = new Date(2026, 9, 9, 12).getTime()
const VEG = { label: '菜币', emoji: '🥬', rate: 0.5 }
const ORE = { label: '矿石币', emoji: '⛏️', rate: 2 }

function farmWithCoins(balance = 0) {
  const state = hatchEgg(NOW)
  state.coins = 1000
  installExtension(state, 'farm', {})
  openWallet(state, 'farm', VEG)
  if (balance > 0) runExtensionAction(state, (data, payload, api) => { api.wallet.earn(balance, 'sell'); return { ok: true } }, { key: 'farm', payload: {}, nowMs: NOW, currency: VEG })
  return state
}

test('an extension earns and spends its own coins through api.wallet, never gold', () => {
  const state = farmWithCoins()
  const result = runExtensionAction(state, (data, payload, api) => {
    assert.deepEqual(api.wallet.currency, VEG)
    api.wallet.earn(300, 'sell')
    return { ok: api.wallet.spend(40, 'seed') && api.wallet.spend(10_000) === false }
  }, { key: 'farm', payload: {}, nowMs: NOW, currency: VEG })
  assert.equal(result.ok, true)
  assert.equal(state.coins, 1000, 'gold untouched')
  assert.equal(state.wallets.farm.balance, 260)
  assert.equal(state.economy.totals['ext.farm.sell'].in, 300)
  assert.equal(state.economy.totals['ext.farm.seed'].out, 40)
})

test('an extension without a declared currency has no wallet, and cannot reach another one', () => {
  const state = farmWithCoins(100)
  installExtension(state, 'mine', {})
  runExtensionAction(state, (data, payload, api) => {
    assert.equal(api.wallet, null)
    return { ok: true }
  }, { key: 'mine', payload: {}, nowMs: NOW })
  runExtensionAction(state, (data, payload, api) => { api.wallet.earn(5); return { ok: true } }, { key: 'mine', payload: {}, nowMs: NOW, currency: ORE })
  assert.equal(state.wallets.farm.balance, 100, 'the mine only ever touches its own wallet')
  assert.equal(state.wallets.mine.balance, 5)
})

test('exchange: to gold at the rate, back with a 5% fee, so a round trip always loses', () => {
  const state = farmWithCoins(1000)
  assert.deepEqual(exchangeCurrency(state, 'farm', 'toGold', 100, NOW), { ok: true, amount: 100, gold: 50 })
  assert.equal(state.coins, 1050)
  assert.deepEqual(exchangeCurrency(state, 'farm', 'fromGold', 100, NOW), { ok: true, amount: 100, gold: 53 })
  assert.equal(state.coins, 997)
  assert.equal(state.wallets.farm.balance, 1000)
  // Many small round trips never make money.
  const start = state.coins + state.wallets.farm.balance * VEG.rate
  for (let i = 0; i < 50; i += 1) {
    exchangeCurrency(state, 'farm', 'toGold', 3, NOW)
    exchangeCurrency(state, 'farm', 'fromGold', 3, NOW)
  }
  assert.ok(state.coins + state.wallets.farm.balance * VEG.rate < start)
  assert.equal(exchangeCurrency(state, 'farm', 'toGold', 1, NOW).reason, 'too-small', '1 菜币 is worth less than a coin')
  assert.equal(exchangeCurrency(state, 'farm', 'fromGold', 10_000_000, NOW).reason, 'poor')
  assert.equal(exchangeCurrency(state, 'nope', 'toGold', 10, NOW).reason, 'unknown')
  assert.equal(state.economy.totals['exchange.farm'].in > 0 && state.economy.totals['exchange.farm'].out > 0, true)
})

test('removing an extension cashes its coins out at the saved rate, even if its files are gone', () => {
  const state = farmWithCoins(801)
  // The manifest can no longer be read when the extension is deleted: the wallet remembers the rate.
  assert.equal(removeExtension(state, 'farm', NOW).ok, true)
  assert.equal(state.coins, 1000 + Math.floor(801 * VEG.rate))
  assert.equal(state.wallets.farm, undefined)
  assert.equal(state.economy.totals['exchange.farm'].in, 400)
  assert.match(state.memories.at(-1), /801 菜币换成了 🪙 400/)
  // Reinstalling starts from zero.
  installExtension(state, 'farm', {})
  openWallet(state, 'farm', VEG)
  assert.equal(state.wallets.farm.balance, 0)
})

test('bad wallets in the save are dropped; an out-of-range rate is refused', () => {
  const state = farmWithCoins(10)
  state.wallets.evil = { label: 'x', emoji: 'x', rate: 1e9, balance: 5 }
  state.wallets['../x'] = { label: 'y', emoji: 'y', rate: 1, balance: 5 }
  const loaded = migrate(JSON.parse(JSON.stringify(state)), NOW)
  assert.deepEqual(Object.keys(loaded.wallets), ['farm'])
  assert.equal(openWallet(loaded, 'mine', { label: '矿', emoji: '⛏️', rate: EXCHANGE.maxRate * 2 }), null)
})

test('the wallet bar shows the balance and what each button gets you', async () => {
  const { document } = fakeDom()
  globalThis.document = document
  const { walletBar } = await import('../src/client/wallet.js')
  const sent = []
  const ui = { view: { pig: { coins: 60 }, wallets: [] }, drill: { wallet: 'farm' }, send: (action, body) => sent.push({ action, body }), renderContent() {} }
  const [wallet] = walletsView(farmWithCoins(150))
  const bar = walletBar(ui, wallet)
  assert.match(bar.allText(), /150\s+菜币/)
  assert.equal(findByAttr(bar, 'data-wallet-out', 'all').textContent, '全部 150 → 🪙 75')
  assert.equal(findByAttr(bar, 'data-wallet-in', '100').textContent, '🪙 53 → 100')
  assert.equal(findByAttr(bar, 'data-wallet-in', '1000').disabled, true, 'not enough gold')
  findByAttr(bar, 'data-wallet-out', '100').fire('click')
  assert.deepEqual(sent, [{ action: 'exchange', body: { key: 'farm', direction: 'toGold', amount: 100 } }])
})
