// @ts-check
/** 联机钱包动作：底注/让枪费按 matchId 幂等、结算入账、取消只退本场。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import roulette from '../../../extensions/roulette/server.js'

function walletApi(coins) {
  const wallet = { coins, spent: {} }
  return {
    wallet,
    api: {
      now: 0,
      coins: () => wallet.coins,
      spend(n, sink = 'spend') {
        const amount = Math.max(0, Math.floor(Number(n) || 0))
        if (wallet.coins < amount) return false
        wallet.coins -= amount
        wallet.spent[sink] = (wallet.spent[sink] ?? 0) + amount
        return true
      },
      earn(n) {
        wallet.coins += Math.max(0, Math.floor(Number(n) || 0))
        return n
      },
      refund(n, sink = 'refund') {
        const have = wallet.spent[sink] ?? 0
        const real = Math.min(Math.max(0, Math.floor(Number(n) || 0)), have)
        if (real <= 0) return 0
        wallet.coins += real
        wallet.spent[sink] = have - real
        return real
      },
    },
  }
}

test('底注与让枪费幂等，赢家结算入账，重复结算丢弃', () => {
  const data = roulette.init()
  const { api, wallet } = walletApi(5000)
  const pay = payload => roulette.actions['online-wallet'](data, payload, api)
  assert.equal(pay({ kind: 'stake', matchId: 'm1', handId: 1, amount: 1000 }).ok, true)
  assert.equal(wallet.coins, 4000)
  assert.deepEqual(pay({ kind: 'stake', matchId: 'm1', handId: 1, amount: 1000 }), { ok: true, duplicate: true })
  assert.equal(wallet.coins, 4000, '重复底注不能再扣')
  assert.equal(pay({ kind: 'fee', matchId: 'm1', id: 9, amount: 500 }).ok, true)
  assert.equal(wallet.coins, 3500)
  assert.equal(pay({ kind: 'fee', matchId: 'm1', id: 9, amount: 500 }).duplicate, true)
  assert.equal(wallet.coins, 3500)
  assert.equal(pay({ kind: 'stake', matchId: 'm1', handId: 2, amount: 1000 }).ok, true)
  assert.equal(wallet.coins, 2500)
  assert.equal(pay({ kind: 'settle', matchId: 'm1', winner: 'you', pot: 4000 }).ok, true)
  assert.equal(wallet.coins, 6500)
  assert.equal(pay({ kind: 'settle', matchId: 'm1', winner: 'you', pot: 4000 }).duplicate, true)
  assert.equal(wallet.coins, 6500, '重复结算不能重复入账')
  assert.equal(pay({ kind: 'refund', matchId: 'm1' }).duplicate, true)
  assert.equal(wallet.coins, 6500, '已结算的场次不能再退款')
})

test('取消退款只退本场已扣的底注和让枪费', () => {
  const data = roulette.init()
  const { api, wallet } = walletApi(5000)
  const pay = payload => roulette.actions['online-wallet'](data, payload, api)
  pay({ kind: 'stake', matchId: 'm1', handId: 1, amount: 1000 })
  pay({ kind: 'fee', matchId: 'm1', id: 4, amount: 500 })
  pay({ kind: 'stake', matchId: 'm2', handId: 1, amount: 1000 })
  assert.equal(wallet.coins, 2500)
  assert.equal(pay({ kind: 'refund', matchId: 'm1' }).ok, true)
  assert.equal(wallet.coins, 4000, '只退 m1 的 1000 底注 + 500 让枪费')
  assert.equal(wallet.spent['roulette-online-bet'], 1000, 'm2 的底注还在')
  assert.equal(wallet.spent['roulette-online-pass'], 0, '让枪费已按原去处冲减')
  assert.equal(pay({ kind: 'refund', matchId: 'm1' }).duplicate, true)
  assert.equal(wallet.coins, 4000)
  assert.equal(pay({ kind: 'refund', matchId: 'm2' }).ok, true)
  assert.equal(wallet.coins, 5000)
})

test('余额不足、非法输入与输家结算不入账', () => {
  const data = roulette.init()
  const { api, wallet } = walletApi(300)
  const pay = payload => roulette.actions['online-wallet'](data, payload, api)
  assert.deepEqual(pay({ kind: 'stake', matchId: 'm1', handId: 1, amount: 500 }), { ok: false, reason: 'poor' })
  assert.equal(wallet.coins, 300)
  assert.equal(pay({ kind: 'stake', matchId: '', handId: 1, amount: 100 }).ok, false)
  assert.equal(pay({ kind: 'stake', matchId: 'm1', handId: 0, amount: 100 }).ok, false)
  assert.equal(pay({ kind: 'fee', matchId: 'm1', id: 1, amount: 99999 }).ok, false)
  assert.equal(pay({ kind: 'nope', matchId: 'm1' }).ok, false)
  assert.equal(pay({ kind: 'settle', matchId: 'm1', winner: 'them', pot: 5000 }).ok, true)
  assert.equal(wallet.coins, 300, '输家不拿底池')
})

test('视图不暴露联机账本', () => {
  const data = roulette.init()
  const { api } = walletApi(5000)
  roulette.actions['online-wallet'](data, { kind: 'stake', matchId: 'm1', handId: 1, amount: 1000 }, api)
  const view = roulette.view(data, api)
  assert.equal('online' in view, false)
  assert.equal(JSON.stringify(view).includes('m1'), false)
})
