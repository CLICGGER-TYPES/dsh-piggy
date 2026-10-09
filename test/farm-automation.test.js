// @ts-check
/** 菜园帮工按真实种、收动作测试离线、种子、仓位和时间回拨。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import farm, { helperRecipe } from '../extensions/farm/server.js'
const NOW = 1800000000000
function setup(balance = 100000) {
  const data = farm.init(), effects = []
  const api = { now: NOW, wallet: { balance: () => balance, currency: {},
    spend(n) { if (balance < n) return false; balance -= n; return true }, earn(n) { balance += n; return n } },
    say() {}, exert: n => effects.push(n), emit() { return false } }
  return { data, api, effects }
}
function planted(seeds = 200) {
  const run = setup()
  run.data.seeds.sprout = seeds
  farm.actions.plant(run.data, { plot: 0, item: 'sprout' }, run.api)
  farm.actions.plant(run.data, { plot: 1, item: 'sprout' }, run.api)
  farm.actions.hire(run.data, {}, run.api)
  return run
}
const total = stock => Object.values(stock).reduce((sum, count) => sum + Number(count), 0)

test('帮工：旧档未雇、钱不够不能买、管地周期和 J2 一致', () => {
  const { data, api } = setup(2499)
  delete data.helper
  assert.equal(farm.view(data, api).helper.hired, false)
  assert.equal(farm.actions.hire(data, {}, api).reason, 'poor')
  assert.equal(data.helper.hired, false)
  assert.equal(helperRecipe('melon').yield, 1)
})

test('帮工：没洒水器也浇水；六小时封仓，view 不写档，分段与一次结算相同', () => {
  const first = planted(), second = planted()
  first.api.now += 3600000
  const before = structuredClone(first.data)
  const view = farm.view(first.data, first.api)
  assert.ok(view.helper.stored > 0)
  assert.deepEqual(first.data, before)
  farm.actions.collect(first.data, {}, first.api)
  assert.equal(first.data.harvest.sprout, view.helper.stored)
  for (let index = 1; index <= 12; index += 1) {
    second.api.now = NOW + index * 300000
    farm.actions.buy(second.data, { item: 'sprout' }, second.api)
  }
  assert.equal(second.data.helper.usedMs, 3600000)
  assert.equal(second.data.helper.stock.sprout, view.helper.stored)
  assert.equal(first.effects.length, 2, '只有之前手动播种让猪累')
})

test('帮工：一天离线只结六小时，收后不补发，不能补发停工期间', () => {
  const { data, api } = planted()
  api.now += 86400000
  const view = farm.view(data, api)
  assert.equal(view.helper.usedHours, 6)
  assert.equal(view.helper.full, true)
  farm.actions.collect(data, {}, api)
  assert.equal(data.harvest.sprout, view.helper.stored)
  assert.equal(data.helper.stock.sprout, 0)
  const stock = total(data.helper.stock), seedCount = data.seeds.sprout
  api.now -= 3600000
  farm.actions.buy(data, { item: 'fertilizer' }, api)
  assert.equal(total(data.helper.stock), stock)
  assert.equal(data.seeds.sprout, seedCount)
  api.now += 3600000
  assert.equal(farm.view(data, api).helper.stored, stock)
})

test('帮工：没种子先收菜再停在空地，买回种子从购买时重新种，不追补', () => {
  const { data, api } = planted(2)
  api.now += 3600000
  farm.actions.collect(data, {}, api)
  assert.equal(data.harvest.sprout, 4)
  assert.deepEqual(farm.view(data, api).helper.missing, ['豆芽'])
  api.now += 86400000
  farm.actions.buy(data, { item: 'sprout', count: 2 }, api)
  assert.equal(total(data.helper.stock), 0)
  assert.equal(data.plots[0].plantedAt, api.now)
  assert.equal(data.plots[0].stage, 0)
  api.now += 600000
  assert.equal(farm.view(data, api).helper.stored, 4)
})

test('帮工：哈密瓜六小时有实物产出并封仓，不改手动作物时间', () => {
  const { data, api } = setup()
  data.seeds.melon = 20
  farm.actions.plant(data, { plot: 0, item: 'melon' }, api)
  farm.actions.hire(data, {}, api)
  api.now += 6 * 3600000
  const view = farm.view(data, api)
  assert.equal(view.helper.full, true)
  assert.equal(view.helper.stored, 1)
  farm.actions.collect(data, {}, api)
  assert.equal(data.harvest.melon, 1)
})

test('旧超长批次不会把六小时工作耗成空仓，管理地块不显示手动缺水', () => {
  const { data, api } = setup()
  data.seeds.melon = 20
  for (const plot of [0, 1]) farm.actions.plant(data, { plot, item: 'melon' }, api)
  farm.actions.hire(data, {}, api)
  data.helper.pending.remainingMs = 18 * 3600000
  api.now += 100 * 3600000
  const view = farm.view(data, api)
  assert.equal(view.helper.stored, 1)
  assert.ok(view.plots.slice(0, 2).filter(Boolean).every(plot => !plot.thirsty))
})

test('哈密瓜与葡萄跨四个六小时仓期的实物产出符合 J2', () => {
  for (const key of ['melon', 'grape']) {
    const { data, api } = setup()
    data.seeds[key] = 100
    for (const plot of [0, 1]) farm.actions.plant(data, { plot, item: key }, api)
    farm.actions.hire(data, {}, api)
    for (let period = 1; period <= 4; period += 1) {
      api.now = NOW + period * 6 * 3600000
      assert.equal(farm.actions.collect(data, {}, api).ok, true)
      assert.equal(data.harvest[key], period * helperRecipe(key).batches * helperRecipe(key).yield)
    }
  }
})

test('手动浇水不重置批次；手动收掉当前作物后不重复发果，空仓休息后可续做', () => {
  const { data, api } = setup()
  data.seeds.melon = 20
  for (const plot of [0, 1]) farm.actions.plant(data, { plot, item: 'melon' }, api)
  data.plots[0].stage = 2
  data.plots[0].wateredAt = NOW - 3 * 3600000
  farm.actions.hire(data, {}, api)
  api.now += 3600000
  const projected = farm.view(data, api)
  assert.equal(projected.plots[0].helperManaged, true)
  assert.ok(Math.abs(projected.plots[0].progress - 1 / 6) < 1e-10)
  assert.equal(projected.plots[0].manualRipe, true)
  assert.equal(farm.actions.water(data, { plot: 1 }, api).ok, true)
  assert.equal(data.helper.pending.remainingMs, 5 * 3600000)
  assert.equal(farm.actions.harvest(data, { plot: 0 }, api).ok, true)
  assert.equal(data.harvest.melon, 2)
  api.now = NOW + 6 * 3600000
  const stopped = farm.view(data, api)
  assert.equal(stopped.helper.full, true)
  assert.equal(stopped.helper.stored, 0)
  assert.equal(stopped.plots[0].helperNote, '等帮工接着干')
  assert.equal(farm.actions.collect(data, {}, api).ok, true)
  assert.equal(data.harvest.melon, 2)
  api.now += 3600000
  farm.actions.collect(data, {}, api)
  assert.equal(data.harvest.melon, 3)
})

test('旧仓期已停且空仓、再回拨一百小时：不倒扣也不显示缺水，继续后可出货', () => {
  const { data, api } = setup()
  data.seeds.melon = 20
  for (const plot of [0, 1]) farm.actions.plant(data, { plot, item: 'melon' }, api)
  farm.actions.hire(data, {}, api)
  data.helper.usedMs = 21600000
  data.helper.pending.remainingMs = 18 * 3600000
  api.now -= 100 * 3600000
  assert.equal(farm.view(data, api).helper.stored, 0)
  assert.equal(farm.view(data, api).plots[1].thirsty, false)
  assert.equal(farm.actions.collect(data, {}, api).ok, true)
  api.now = NOW + 21600000
  farm.actions.collect(data, {}, api)
  assert.equal(data.harvest.melon, 1)
})
