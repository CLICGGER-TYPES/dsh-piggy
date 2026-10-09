import assert from 'node:assert/strict'
import { test } from 'node:test'

import gacha, { POOLS, gameDay } from '../extensions/gacha/server.js'
import { itemByKey } from '../packages/pet-core/src/data.js'

function fakeApi(now, startCoins = 10000) {
  let coins = startCoins
  const bag = {}
  const said = []
  return {
    api: {
      now, coins: () => coins,
      spend: n => { if (coins < n) return false; coins -= n; return true },
      give: (key, n) => { bag[key] = (bag[key] ?? 0) + n; return true },
      say: line => said.push(line),
    },
    bag, said, coins: () => coins,
  }
}

test('三个口味：原来的物品都还在，新加的都是商店里有的；一抽的平均价值低于 60（扭蛋是花钱的地方）', () => {
  const keys = pool => pool.map(item => item.key)
  for (const key of ['apple', 'bread', 'strawberry', 'fish', 'sweetpotato', 'bone']) assert.ok(keys(POOLS.snack.normal).includes(key), key)
  for (const key of ['rice', 'pumpkin', 'cake', 'skewer', 'noodle']) assert.ok(keys(POOLS.snack.rare).includes(key), key)
  assert.deepEqual(POOLS.snack.gold.slice(0, 3).map(item => [item.key, item.count]), [['feast', 3], ['seafoodrice', 3], ['feast', 5]])
  assert.deepEqual(POOLS.goods.gold.slice(0, 5).map(item => [item.key, item.count]), [['trampoline', 1], ['carousel', 1], ['bubbles', 1], ['deadsea', 2], ['bait_glow', 5]])
  assert.deepEqual(POOLS.medicine.gold.map(item => item.key), ['baicaodan', 'soul'])
  const price = key => itemByKey(key)?.price ?? NaN
  for (const [machine, pool] of Object.entries(POOLS)) {
    for (const entry of [...pool.normal, ...pool.rare, ...pool.gold]) assert.ok(Number.isFinite(price(entry.key)), `${machine} ${entry.key} is a shop item`)
    const many = machine === 'medicine' ? [1, 1] : [3, 2]
    const average = (list, count) => list.reduce((sum, entry) => sum + price(entry.key) * (count ?? entry.count), 0) / list.length
    const value = 0.77 * average(pool.normal, many[0]) + 0.2 * average(pool.rare, many[1]) + 0.03 * average(pool.gold)
    assert.ok(value < 60, `${machine} ${value.toFixed(1)}`)
  }
})

test('首次免费，第二次 60；十连 540，余额不足不动数据', () => {
  const data = gacha.init()
  const account = fakeApi(Date.UTC(2026, 9, 5, 12))
  assert.equal(gacha.actions.spin(data, { machine: 'snack', count: 1 }, account.api, () => 0.5).ok, true)
  assert.equal(account.coins(), 10000)
  assert.equal(gacha.actions.spin(data, { machine: 'snack', count: 1 }, account.api, () => 0.5).ok, true)
  assert.equal(account.coins(), 9940)
  assert.equal(gacha.actions.spin(data, { machine: 'goods', count: 10 }, account.api, () => 0.5).ok, true)
  assert.equal(account.coins(), 9400)
  assert.equal(data.history.length, 12)
  const poor = fakeApi(account.api.now, 0)
  const before = structuredClone(data)
  assert.equal(gacha.actions.spin(data, { machine: 'snack', count: 1 }, poor.api).reason, 'poor')
  assert.deepEqual(data, before)
})

test('本地 06:00 换天，05:59 仍属于前一天', () => {
  const before = new Date(2026, 9, 6, 5, 59).getTime()
  const after = new Date(2026, 9, 6, 6, 0).getTime()
  assert.notEqual(gameDay(before), gameDay(after))
  const data = gacha.init()
  const account = fakeApi(before, 0)
  assert.equal(gacha.actions.spin(data, { machine: 'snack', count: 1 }, account.api, () => 0.5).ok, true)
  account.api.now = after
  assert.equal(gacha.actions.spin(data, { machine: 'snack', count: 1 }, account.api, () => 0.5).ok, true)
})

test('白蓝金数量正确，20 次未出金后下一颗保底且重置', () => {
  const data = gacha.init()
  const account = fakeApi(Date.UTC(2026, 9, 5, 12))
  gacha.actions.spin(data, { machine: 'medicine', count: 1 }, account.api, () => 0.5)
  assert.equal(data.last.items[0].count, 1)
  gacha.actions.spin(data, { machine: 'snack', count: 1 }, account.api, () => 0.18)
  assert.equal(data.last.items[0].count, 2)
  for (let i = 0; i < 18; i++) gacha.actions.spin(data, { machine: 'snack', count: 1 }, account.api, () => 0.5)
  assert.equal(data.luck, 20)
  gacha.actions.spin(data, { machine: 'snack', count: 1 }, account.api, () => 0.5)
  assert.equal(data.last.items[0].rarity, 'gold')
  assert.equal(data.luck, 0)
  assert.equal(data.history.length, 21)
})

test('基础概率边界为金 3%、蓝 17%、白 80%；自然出金也清空幸运值', () => {
  const data = gacha.init()
  const account = fakeApi(Date.UTC(2026, 9, 5, 12))
  for (const [value, expected] of [[0.029, 'gold'], [0.03, 'rare'], [0.199, 'rare'], [0.2, 'normal']]) {
    gacha.actions.spin(data, { machine: 'snack', count: 1 }, account.api, () => value)
    assert.equal(data.last.items[0].rarity, expected)
  }
  assert.equal(data.luck, 3)
  gacha.actions.spin(data, { machine: 'snack', count: 1 }, account.api, () => 0)
  assert.equal(data.luck, 0)
})

test('十连每颗独立累加幸运值，记录只留最近 30 颗', () => {
  const data = gacha.init()
  const account = fakeApi(Date.UTC(2026, 9, 5, 12))
  for (let i = 0; i < 4; i++) gacha.actions.spin(data, { machine: 'goods', count: 10 }, account.api, () => 0.5)
  assert.equal(data.history.length, 30)
  assert.equal(data.history.filter(item => item.rarity === 'gold').length, 1)
  assert.equal(data.luck, 19)
  assert.equal(gacha.view(data, account.api).pityLeft, 1)
})
