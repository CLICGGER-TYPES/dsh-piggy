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

test('所有作物、管地和农具档：实物菜、扣种子、六小时封仓、手动更赚', () => {
  for (const crop of CROPS) for (const plots of [2, 4, 8]) for (let efficiency = 0; efficiency < 4; efficiency += 1) {
    const rate = farmHelperPerHour({ cropKey: crop.key, plots, efficiency })
    const manual = plots * (crop.yield * crop.sell - crop.price - 5 * .2 * 10 / 32) / (crop.minutes / 60)
    assert.ok(rate.net > 0 && rate.net <= 400 && rate.net < manual, crop.key)
    assert.equal(rate.fullHours, 6)
    const data = farm.init(), host = api()
    data.unlocked = plots
    data.seeds[crop.key] = 999
    for (let index = 0; index < plots; index += 1) farm.actions.plant(data, { plot: index, item: crop.key }, host)
    farm.actions.hire(data, {}, host)
    data.helper.level = [2, 4, 8].indexOf(plots)
    data.helper.barn = efficiency
    data.helper.pending = null
    host.now += 6 * 3600000
    farm.actions.collect(data, {}, host)
    assert.equal(data.harvest[crop.key], rate.storedItems, crop.key + ' / ' + plots + ' / ' + efficiency)
    assert.equal(data.helper.usedMs, 0)
    assert.equal(data.helper.stock[crop.key], 0)
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
