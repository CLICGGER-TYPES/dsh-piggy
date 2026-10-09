// @ts-check
/** 矿工走扩展真实动作和 view；时间切片不能改变产出，满仓不攒欠账。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import mine, { HELPER_RATES, dayKey, refresh, dayState } from '../extensions/mine/server.js'
import { MINE_HELPER_RATES } from '../tools/economy-sim.mjs'

const NOW = 1800000000000
function setup(balance = 100000) {
  const data = mine.init(), effects = []
  const api = { now: NOW, wallet: { balance: () => balance, currency: {},
    spend(n) { if (balance < n) return false; balance -= n; return true }, earn(n) { balance += n; return n } },
    say() {}, exert: n => effects.push(n), emit() { return false } }
  return { data, api, effects }
}
const total = stock => Object.values(stock).reduce((sum, count) => sum + Number(count), 0)

test('矿工：旧档默认未雇、钱不够失败、共用镐与 J2 的速度一致', () => {
  const { data, api } = setup(2999)
  delete data.helper
  assert.equal(mine.view(data, api).helper.hired, false)
  assert.equal(mine.actions.hire(data, {}, api).reason, 'poor')
  assert.equal(data.helper.hired, false)
  assert.deepEqual(HELPER_RATES, MINE_HELPER_RATES)
})

test('矿工：一小时 view 只算副本；逐次结算与离线一次结算相同，不累猪、不触发连挖', () => {
  const first = setup(), second = setup()
  for (const run of [first, second]) mine.actions.hire(run.data, {}, run.api)
  first.api.now += 3600000
  const before = structuredClone(first.data)
  const view = mine.view(first.data, first.api)
  assert.equal(view.helper.stored, 8)
  assert.deepEqual(first.data, before)
  mine.actions.surface(first.data, {}, first.api)
  for (let index = 1; index <= 12; index += 1) {
    second.api.now = NOW + index * 300000
    mine.actions.surface(second.data, {}, second.api)
  }
  assert.deepEqual(first.data.helper.stock, second.data.helper.stock)
  assert.deepEqual(first.effects, [])
  assert.equal(first.data.combo.n, 0)
  assert.equal(first.data.bombs, 0)
})

test('矿工：一天只到满仓；收后从当前时间继续，往回拨时钟不重复给矿', () => {
  const { data, api } = setup()
  mine.actions.hire(data, {}, api)
  api.now += 86400000
  mine.actions.collect(data, {}, api)
  assert.equal(total(data.bag), 48)
  assert.equal(total(data.helper.stock), 0)
  assert.equal(mine.actions.collect(data, {}, api).reason, 'empty')
  api.now -= 3600000
  mine.actions.surface(data, {}, api)
  assert.equal(total(data.helper.stock), 0)
  api.now += 3600000 + 450000
  mine.actions.surface(data, {}, api)
  assert.equal(total(data.helper.stock), 1)
})

test('矿工：头灯、到达层和共用镐一起开路，仓升级不追补满仓期间', () => {
  const { data, api } = setup()
  mine.actions.hire(data, {}, api)
  data.deepest = 20
  assert.equal(mine.actions.workerFloor(data, { floor: 6 }, api).reason, 'locked')
  mine.actions.upgrade(data, { kind: 'lamp' }, api)
  assert.equal(mine.actions.workerFloor(data, { floor: 6 }, api).reason, 'locked')
  mine.actions.buy(data, { item: 'pickaxe' }, api)
  assert.equal(mine.actions.workerFloor(data, { floor: 6 }, api).ok, true)
  api.now += 86400000
  mine.actions.upgrade(data, { kind: 'cart' }, api)
  assert.equal(total(data.helper.stock), 84)
  mine.actions.surface(data, {}, api)
  assert.equal(total(data.helper.stock), 84)
})

test('旧导出保留，日期和刷新仍能调用', () => {
  assert.equal(typeof dayKey(NOW), 'string')
  const data = mine.init()
  assert.equal(refresh(data), data)
  assert.deepEqual(dayState(data), { ...data })
})
