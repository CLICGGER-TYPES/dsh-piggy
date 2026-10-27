// @ts-check
/** 第二轮：每个新帮工最高 400，同配置手动更赚，所有仓均六小时封顶。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import mine, { CHECKPOINTS, HELPER_SPEEDS, pickaxeFor } from '../extensions/mine/server.js'
import farm, { CROPS } from '../extensions/farm/server.js'
import { RODS } from '../data.js'
import { autoFishingPerHour, farmHelperPerHour, fishingPerHour, mineHelperPerHour, simulateMine } from '../tools/economy-sim.mjs'
const NOW = 1800000000000
function api() { return { now: NOW, wallet: { currency: {}, balance: () => 100000, spend: () => true }, say() {}, exert() {}, emit() {} } }

test('矿工每个工具、选站、速度档都低于 400 和对应手动，六小时封仓', () => {
  for (let pickaxe = 1; pickaxe <= 5; pickaxe += 1) {
    for (const floor of CHECKPOINTS.filter(floor => pickaxeFor(floor) <= pickaxe)) {
      const manual = (simulateMine(pickaxe, floor, 1) + simulateMine(pickaxe, floor, 2)) / 2
      for (let cart = 0; cart < HELPER_SPEEDS.length; cart += 1) {
        const rate = mineHelperPerHour({ pickaxe, floor, cart })
        assert.ok(rate.net <= 400 && rate.net < manual)
        assert.equal(rate.fullHours, 6)
      }
    }
  }
})

test('菜园自然托管：收成按地块真实生长与 roll，不再有 400 / 六小时预算，手动仍多拿经验', () => {
  for (const crop of CROPS) for (const plots of [4, 8, 16]) {
    const rate = farmHelperPerHour({ cropKey: crop.key, plots })
    assert.ok(rate.net > 0 && rate.itemsPerHour > 0, crop.key + ' / ' + plots)
    // 同样的地自己种一整株（多季含重长期）也差不多这个时薪：托管就是替你按时收、按时补种，不是加速器。
    const manual = plots * (crop.yield * crop.seasons * crop.sell - crop.price) / rate.hours
    assert.ok(Math.abs(rate.net - manual) < 1e-9, crop.key + ' / ' + plots + ' 托管时薪就该等于同地块自然生长的时薪')
    assert.equal(rate.hours, crop.hours + (crop.seasons - 1) * crop.hours / 2, crop.key + ' 多季只花半季重长')
  }

  for (const crop of CROPS.slice(0, 6)) for (const plots of [4, 8, 16]) {
    const data = Object.assign(farm.init(), { plots: Array(18).fill(null) }), host = api()
    data.unlocked = Math.max(6, plots)
    data.exp = 10000 // 4.0 起种子按等级解锁：直接给到满级
    data.seeds[crop.key] = 999
    for (let index = 0; index < plots; index += 1) farm.actions.plant(data, { plot: index, item: crop.key }, host)
    farm.actions.hire(data, {}, host)
    data.helper.level = [4, 8, 16].indexOf(plots)
    const before = structuredClone(data.plots.slice(0, plots))
    host.now = NOW + crop.hours * 3600000
    // 到点结算一次：每块地都按自己的 roll 收一次，不封仓、不按预算打折。
    farm.actions.collect(data, {}, host) // 只是逼一次结算
    farm.actions.buy(data, { item: 'nothing' }, host)
    let expected = 0
    for (const plot of before) expected += Math.max(1, crop.yield + plot.roll)
    assert.ok(data.harvest[crop.key] + data.helper.stock[crop.key] === expected, crop.key + ' / ' + plots + ' 收成 ' + (data.harvest[crop.key] + data.helper.stock[crop.key]) + ' 应为 ' + expected)
    assert.equal(data.exp, 10000, '帮工不给玩家经验')
  }
})

test('新长时自动钓：全部时段、竿、饵、抄网档净时薪至多 400；旧短行程不参与新限额', () => {
  let max = 0
  for (const rod of RODS) for (const spot of ['river','lake','sea','night']) for (const baitKey of ['bait_worm','bait_shrimp','bait_glow']) for (let basket = 0; basket < 3; basket += 1) {
    const manual = Math.max(...['bait_worm','bait_shrimp','bait_glow'].map(bait => fishingPerHour(rod.level, spot, bait)))
    const average = autoFishingPerHour({ rodLevel: rod.level, spot, baitKey, basket })
    assert.ok(average.net < manual)
    assert.equal(average.fullHours, 6)
    for (const period of ['early','noon','evening','night']) {
      const rate = autoFishingPerHour({ rodLevel: rod.level, spot, baitKey, basket, period })
      assert.ok(rate.net <= 400)
      max = Math.max(max, rate.net)
    }
  }
  // 2026-10-10 钓鱼改成等待短、搏斗难以后，最高从 361.96 降到约 223；只守上限，不钉死具体值。
  assert.ok(max > 150 && max <= 400, `max ${max.toFixed(2)}`)
  assert.ok(autoFishingPerHour({ rodLevel: 4, spot: 'lake', baitKey: 'bait_shrimp', period: 'night', legacy: true }).net > 400)
})
