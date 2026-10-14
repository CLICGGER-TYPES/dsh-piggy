// 菜园 4.0 规则补充测试：雨天浇湿干地（含夜雨、daypart）、新开垦荒地、多季重长、帮工产出上限、3.x 迁移。
// 只看 extensions/farm/server.js 的规则，用假 api 直接调扩展动作；不改规则本身。
import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'

import farm, {
  CROPS, HELPER_WINDOW, PLOTS, START_PLOTS,
  helperRecipe, normalize, plotState, setRandom, weatherAt,
} from '../extensions/farm/server.js'

const H = 3600000

/** 有菜币钱包的假宿主；金币接口故意抛错，farm 只能用自己的钱包。 */
function fakeApi(now, balance = 100_000) {
  const bag = {}
  const api = {
    now,
    coins: () => 0,
    spend() { throw new Error('farm must not touch gold') },
    earn() { throw new Error('farm must not touch gold') },
    wallet: {
      currency: { label: '菜币', emoji: '🥬', rate: 1 },
      balance: () => balance,
      earn(n) { balance += n; return n },
      spend(n) { if (balance < n) return false; balance -= n; return true },
    },
    give(key, n) { bag[key] = (bag[key] ?? 0) + n; return true },
    say() {},
    exert() {},
  }
  return { api, bag, balance: () => balance }
}

/** 找一个指定天气的日子（hour 默认中午）。weatherAt 按日期定晴雨，所以同一天各时段一致。 */
function dayAt(weather, hour = 12, days = 60) {
  for (let day = 0; day < days; day += 1) {
    const at = new Date(2026, 9, 12 + day, hour).getTime()
    if (weatherAt(at) === weather) return at
  }
  throw new Error('no ' + weather + ' day')
}

const SUNNY = dayAt('sunny')
const RAINY = dayAt('rain')

/** 既有 4.0 熟地存档：18 块都是空地，用来只测规则。 */
function emptyFarm() { return Object.assign(farm.init(), { plots: Array(PLOTS).fill(null) }) }
const noPests = plot => { plot.pests = { weed: 1e15, bug: 1e15, dry: 1e15 } }

beforeEach(() => setRandom(() => 0.5))

test('天气按日期定晴雨：同一天各时段一致，夜雨与白天是同一份快照', () => {
  for (const noon of [SUNNY, RAINY]) {
    const sky = weatherAt(noon)
    for (const hour of [0, 5, 8, 12, 17, 19, 23]) {
      assert.equal(weatherAt(new Date(noon).setHours(hour)), sky, '第 ' + hour + ' 点应与当天一致')
    }
  }
  assert.equal(weatherAt(SUNNY), 'sunny')
  assert.equal(weatherAt(RAINY), 'rain')
})

test('雨天浇湿已经干的空地：动作写回存档，view 只读不写', () => {
  const t = fakeApi(SUNNY)
  const data = farm.init()
  assert.ok(data.plots.slice(0, START_PLOTS).every(plot => plot.pests.dry === 0), '新地本来是干的')

  const before = structuredClone(data)
  assert.equal(farm.view(data, t.api).plots.slice(0, START_PLOTS).filter(plot => plot.pests.includes('dry')).length, START_PLOTS)
  assert.deepEqual(data, before, 'view 只算不写')

  t.api.now = RAINY
  assert.equal(farm.view(data, t.api).plots.filter(plot => plot.pests?.includes('dry')).length, 0, '雨天 view 里已不旱')
  farm.actions.buy(data, { item: 'radish' }, t.api)
  assert.ok(data.plots.slice(0, START_PLOTS).every(plot => plot.pests.dry === null), '雨天动作把干地浇湿并写回')
  assert.equal(farm.view(data, t.api).plots.filter(plot => plot.pests?.includes('dry')).length, 0)
})

test('夜里下雨同样浇湿已干的作物，干旱顺延到下一个晴天的零点', () => {
  const rainyNight = new Date(RAINY).setHours(22, 0, 0, 0)
  const t = fakeApi(rainyNight)
  const data = emptyFarm()
  data.exp = 3600 // 9 级，能种椰子（30 小时，成熟晚于下一个晴天零点）
  data.plots[0] = { crop: 'coconut', season: 1, plantedAt: rainyNight, boostMs: 0, roll: 0,
    pests: { weed: 1e15, bug: 1e15, dry: rainyNight - H } }
  assert.equal(weatherAt(rainyNight), 'rain')
  assert.deepEqual(plotState(data.plots[0], rainyNight).pests, [], '下雨当下不显示干旱')

  farm.actions.buy(data, { item: 'coconut' }, t.api)
  const dry = data.plots[0].pests.dry
  assert.ok(dry > rainyNight, '干旱推到之后')
  assert.equal(weatherAt(dry), 'sunny', '顺延到晴天')
  assert.equal(new Date(dry).getHours(), 0)
  assert.equal(new Date(dry).getMinutes(), 0)
  assert.deepEqual(plotState(data.plots[0], rainyNight).pests, [], '夜雨里仍不旱')
  assert.ok(plotState(data.plots[0], dry).pests.includes('dry'), '到了晴天才重新旱')
})

test('新开垦的地是荒地：干土 + 杂草或残株，清干净才能种', () => {
  setRandom(() => 0.1) // 有草也有残株
  const t = fakeApi(SUNNY)
  const data = emptyFarm()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t.api)
  for (const plot of [6, 7, 8]) assert.equal(farm.actions.unlock(data, { plot }, t.api).ok, true)
  for (const index of [6, 7, 8]) {
    const plot = data.plots[index]
    assert.equal(plot.fallow, true, '新地是空地')
    assert.equal(plot.pests.dry, 0, '新地是干的')
    assert.ok(plot.pests.weed === 0 || plot.stubble === true, '新地至少长草或留残株')
    assert.equal(farm.actions.plant(data, { plot: index, item: 'radish' }, t.api).reason, 'clear-ground', '没清干净不能种')
  }
  const index = 6
  farm.actions.care(data, { plot: index, kind: 'weed' }, t.api)
  assert.equal(data.plots[index].pests.weed, null)
  assert.equal(farm.actions.plant(data, { plot: index, item: 'radish' }, t.api).reason, 'clear-ground', '残株还在')
  assert.equal(farm.actions.clear(data, { plot: index }, t.api).ok, true)
  assert.equal(data.plots[index].stubble, false)
  assert.equal(farm.actions.plant(data, { plot: index, item: 'radish' }, t.api).ok, true)
  assert.equal(data.plots[index].crop, 'radish')
})

test('新开垦的地无论抽到草还是残株，都挡播种且能清掉', () => {
  // 抽到只有草（无残株）：要先除草
  setRandom(() => 0.5)
  let t = fakeApi(SUNNY)
  let data = emptyFarm()
  farm.actions.buy(data, { item: 'radish' }, t.api)
  farm.actions.unlock(data, { plot: 6 }, t.api)
  assert.equal(data.plots[6].pests.weed, 0, '抽到草')
  assert.equal(data.plots[6].stubble, false, '没残株')
  assert.equal(farm.actions.plant(data, { plot: 6, item: 'radish' }, t.api).reason, 'clear-ground')
  assert.equal(farm.actions.care(data, { plot: 6, kind: 'weed' }, t.api).cured, 1)
  assert.equal(farm.actions.plant(data, { plot: 6, item: 'radish' }, t.api).ok, true)

  // 抽到只有残株（无草）：要先铲
  setRandom(() => 0.95)
  t = fakeApi(SUNNY)
  data = emptyFarm()
  farm.actions.buy(data, { item: 'radish' }, t.api)
  farm.actions.unlock(data, { plot: 6 }, t.api)
  assert.equal(data.plots[6].pests.weed, null, '没草')
  assert.equal(data.plots[6].stubble, true, '抽到残株')
  assert.equal(farm.actions.plant(data, { plot: 6, item: 'radish' }, t.api).reason, 'clear-ground')
  assert.equal(farm.actions.clear(data, { plot: 6 }, t.api).ok, true)
  assert.equal(farm.actions.plant(data, { plot: 6, item: 'radish' }, t.api).ok, true)
})

test('多季作物收完回到「长大」接着长，收满季数才枯萎', () => {
  const multi = CROPS.filter(crop => crop.seasons > 1)
  assert.ok(multi.length > 0)
  for (const crop of multi) {
    setRandom(() => 0.5)
    const t = fakeApi(SUNNY)
    const data = emptyFarm()
    data.exp = 3600 // 9 级，能买所有种子
    farm.actions.buy(data, { item: crop.key }, t.api)
    farm.actions.plant(data, { plot: 0, item: crop.key }, t.api)
    for (let season = 1; season <= crop.seasons; season += 1) {
      noPests(data.plots[0])
      const state = plotState(data.plots[0], t.api.now)
      assert.equal(state.ripe, false, crop.key + ' 第 ' + season + ' 季还没熟')
      t.api.now += state.remainingMs + 1
      noPests(data.plots[0])
      const result = farm.actions.harvest(data, { plot: 0 }, t.api)
      assert.equal(result.ok, true, crop.key + ' 第 ' + season + ' 季可收')
      assert.ok(result.n > 0)
      if (season < crop.seasons) {
        const next = data.plots[0]
        assert.equal(next.withered, undefined, '还有下一季，不能枯萎')
        assert.equal(next.crop, crop.key)
        assert.equal(next.season, season + 1)
        const regrown = plotState(next, t.api.now)
        assert.equal(regrown.stage, 'growing', '回到长大，不是从种子重来')
        assert.ok(Math.abs(regrown.remainingMs - crop.hours * H / 2) < 1, '下一季只差半个生长期')
      } else {
        assert.equal(data.plots[0].withered, true, crop.key + ' 最后一季收完枯萎')
      }
    }
    assert.equal(data.harvests[crop.key], crop.seasons)
    assert.equal(data.seeds[crop.key], 0, '重长不再扣种子')
  }
})

test('帮工每小时净产出不超过 400，六小时封仓后不再增产', () => {
  for (const crop of CROPS) for (let level = 0; level < 3; level += 1) for (let barn = 0; barn < 4; barn += 1) {
    const recipe = helperRecipe(crop.key, level, barn)
    assert.ok(recipe.net > 0 && recipe.net <= 400, crop.key + '/' + level + '/' + barn + ' 净时薪超限')
    assert.ok(recipe.yield <= crop.yield, '单次产量不超过自己种')
    assert.ok(Math.abs(recipe.intervalMs * recipe.batches - HELPER_WINDOW) < 1e-6, '批次正好铺满六小时窗口')
  }

  setRandom(() => 0.5)
  const t = fakeApi(SUNNY)
  const data = emptyFarm()
  farm.actions.buy(data, { item: 'radish', count: 50 }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, t.api)
  farm.actions.hire(data, {}, t.api)
  const crop = CROPS.find(c => c.key === 'radish')
  const recipe = helperRecipe('radish', 0, 0)

  t.api.now = SUNNY + HELPER_WINDOW + 1
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.helper.usedMs, HELPER_WINDOW, '六小时封顶')
  assert.equal(data.helper.stock.radish, recipe.batches * recipe.yield, '只收满一个窗口的批次')
  const windowValue = (recipe.yield * crop.sell - crop.price) * recipe.batches
  assert.ok(windowValue / (HELPER_WINDOW / H) <= 400 + 1e-9, '六小时净产出不超过 2400')

  const before = structuredClone(data.helper.stock)
  t.api.now = SUNNY + 100 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.deepEqual(data.helper.stock, before, '封仓后不再增产')
  assert.equal(data.helper.usedMs, HELPER_WINDOW)
})

test('3.x 存档迁移不凭空补出已开垦地（全为空地，无荒草残株）', () => {
  const old = {
    version: 3, unlocked: 8,
    plots: [{ crop: 'pumpkin', stage: 1, plantedAt: SUNNY, wateredAt: null }, null, { crop: 'carrot', stage: 3, plantedAt: SUNNY, wateredAt: null }],
    seeds: {}, harvest: {}, acquired: {}, tools: {}, helper: {},
  }
  normalize(old)
  assert.equal(old.version, 4)
  assert.equal(old.unlocked, 8)
  assert.equal(old.plots.length, PLOTS)
  assert.ok(old.plots.every(plot => plot === null), '迁移后地块全空')
  assert.equal(old.plots.filter(plot => plot && plot.fallow).length, 0, '不能凭空长出荒地')

  setRandom(() => 0.5)
  const fresh = farm.init()
  assert.equal(fresh.unlocked, START_PLOTS)
  assert.ok(fresh.plots.slice(0, START_PLOTS).every(plot => plot.fallow === true && plot.pests.dry === 0), '只有新开局才生成荒地')
  assert.ok(fresh.plots.slice(START_PLOTS).every(plot => plot === null))

  const small = normalize({ version: 3, unlocked: 2, plots: [], seeds: {}, harvest: {}, acquired: {}, tools: {}, helper: {} })
  assert.equal(small.unlocked, START_PLOTS, '至少 6 块')
  assert.ok(small.plots.every(plot => plot === null))

  const four = normalize({ version: 4, unlocked: 8, plots: [] })
  assert.ok(four.plots.every(plot => plot === null), '4.0 空存档同样不补荒地')

  const kept = normalize({ version: 4, unlocked: 6, plots: [{ fallow: true, stubble: true, pests: { dry: null, weed: null } }] })
  assert.equal(kept.plots[0].stubble, true, '已有空地保留原样')
  assert.equal(kept.plots[0].pests.dry, null)
  assert.equal(kept.plots[0].pests.weed, null)
})
