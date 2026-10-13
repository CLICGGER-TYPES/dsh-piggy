// 菜园 4.0（docs/design/farm-qqfarm.md；用户 2026-10-12：照 QQ 农场改版，A 照搬时长、B 补多季、C 一键要买工具、D 留帮工、F 留原有 9 种）。
import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'

import farm, {
  CROPS, FERTILIZERS, PEST_LOSS, PEST_MS, PLOTS, RECLAIM_PRICE, START_PLOTS, TOOLS,
  levelOf, normalize, plotState, setRandom, weatherAt, helperRecipe, HELPER_PLOTS,
} from '../extensions/farm/server.js'

// 既有 4.0 熟地存档用于旧行为回归；开荒另有独立测试。
function establishedFarm() { return Object.assign(farm.init(), { plots: Array(18).fill(null) }) }
const H = 3600000
/** 找一个晴天中午当起点（weatherAt 按日期定晴雨），免得雨天推迟干旱打乱断言。 */
function sunnyNoon() {
  for (let day = 0; day < 30; day += 1) {
    const at = new Date(2026, 9, 12 + day, 12).getTime()
    if (weatherAt(at) === 'sunny') return at
  }
  throw new Error('no sunny day')
}
const T0 = sunnyNoon()

/** 有菜币钱包的假宿主。 */
export function fakeApi(balance = 100_000) {
  const bag = {}
  const said = []
  const ledger = []
  let tired = 0
  const api = {
    now: T0,
    coins: () => 0,
    spend() { throw new Error('farm must not touch gold') },
    earn() { throw new Error('farm must not touch gold') },
    wallet: {
      currency: { label: '菜币', emoji: '🥬', rate: 1 },
      balance: () => balance,
      earn(n, source) { balance += n; ledger.push(['in', source, n]); return n },
      spend(n, sink) { if (balance < n) return false; balance -= n; ledger.push(['out', sink, n]); return true },
    },
    give(key, n) { bag[key] = (bag[key] ?? 0) + n; return true },
    say(line) { said.push(line) },
    exert(points) { tired += points },
  }
  return { api, bag, said, ledger, balance: () => balance, tired: () => tired }
}

// 默认让随机数返回 0.5：产量浮动 roll = 0，灾害在 ln2 × 4 小时 ≈ 2.77 小时后来。
beforeEach(() => setRandom(() => 0.5))
const FIRST_PEST = Math.round(Math.LN2 * PEST_MS)
const noPests = plot => { plot.pests = { weed: 1e15, bug: 1e15, dry: 1e15 } }

test('原版 20 种 + 原有 9 种，数值照设计稿；18 块地开局 6 块，开垦 10000', () => {
  assert.equal(CROPS.length, 29)
  const radish = CROPS.find(c => c.key === 'radish')
  assert.deepEqual({ level: radish.level, price: radish.price, hours: radish.hours, exp: radish.exp, yield: radish.yield, sell: radish.sell }, { level: 1, price: 80, hours: 14, exp: 10, yield: 24, sell: 18 })
  const coconut = CROPS.find(c => c.key === 'coconut')
  assert.deepEqual([coconut.level, coconut.hours, coconut.seasons, coconut.sell], [9, 30, 3, 35])
  assert.equal(CROPS.find(c => c.key === 'melon').hours, 30)
  assert.deepEqual(CROPS.filter(c => c.seasons > 1).map(c => c.key + c.seasons), ['pomelo2', 'pumpkin2', 'orange2', 'pomegranate3', 'coconut3'])
  assert.deepEqual([PLOTS, START_PLOTS, RECLAIM_PRICE], [18, 6, 10000])
  assert.deepEqual(FERTILIZERS.map(f => [f.price, f.hours]), [[500, 2], [800, 3.5], [1000, 5]])
  assert.deepEqual(TOOLS.map(t => t.key), ['sickle', 'sprayer', 'rake', 'planter'])
})

test('等级：升下一级要「等级 × 100」经验，种子按等级解锁', () => {
  assert.deepEqual(levelOf(0), { level: 1, exp: 0, need: 100 })
  assert.deepEqual(levelOf(100), { level: 2, exp: 0, need: 200 })
  assert.deepEqual(levelOf(299), { level: 2, exp: 199, need: 200 })
  assert.equal(levelOf(300).level, 3)
  const data = establishedFarm()
  const t = fakeApi()
  assert.equal(farm.actions.buy(data, { item: 'strawberry' }, t.api).reason, 'level', '6 级才能买草莓')
  assert.equal(farm.actions.buy(data, { item: 'radish', count: 2 }, t.api).ok, true)
  const view = farm.view(data, t.api)
  assert.equal(view.seeds.find(s => s.key === 'strawberry').locked, true)
  assert.equal(view.shelf.items.find(i => i.key === 'strawberry').note, '6 级解锁')
})

test('种下按真实时间自己长，不用浇水；14 小时白萝卜 14 小时熟，收进仓库给经验，留下枯萎秆', () => {
  const data = establishedFarm()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'radish' }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  assert.equal(plotState(data.plots[0], T0).stage, 'seed')
  assert.equal(plotState(data.plots[0], T0 + 7 * H).stage, 'growing')
  assert.equal(plotState(data.plots[0], T0 + 14 * H - 1).ripe, false)
  noPests(data.plots[0])
  t.api.now = T0 + 14 * H
  assert.equal(farm.view(data, t.api).plots[0].ripe, true)
  const result = farm.actions.harvest(data, { plot: 0 }, t.api)
  assert.equal(result.ok, true)
  assert.equal(result.n, 24, 'roll 0, no pests: base yield')
  assert.equal(data.harvest.radish, 24)
  assert.equal(data.exp, 10)
  assert.equal(data.plots[0].withered, true)
  assert.equal(farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api).ok, false, 'withered stalks must be dug up first')
  assert.equal(farm.actions.clear(data, { plot: 0 }, t.api).ok, true)
  assert.equal(data.plots[0], null)
})

test('灾害：长的时候来草、虫、旱，每样少 2 个；治了 +2 经验；成熟以后不再来', () => {
  const data = establishedFarm()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, t.api)
  assert.deepEqual(plotState(data.plots[0], T0 + FIRST_PEST - 1).pests, [])
  t.api.now = T0 + FIRST_PEST
  assert.deepEqual([...farm.view(data, t.api).plots[0].pests].sort(), ['bug', 'dry', 'weed'])
  const cured = farm.actions.care(data, { plot: 1 }, t.api)
  assert.equal(cured.cured, 3)
  assert.equal(data.exp, 6)
  assert.equal(farm.actions.care(data, { plot: 1 }, t.api).reason, 'unavailable', 'nothing left to cure')
  t.api.now = T0 + 14 * H
  assert.equal(plotState(data.plots[0], t.api.now).yield, 24 - 3 * PEST_LOSS)
  t.api.now = T0 + 40 * H
  assert.equal(plotState(data.plots[0], t.api.now).yield, 24 - 3 * PEST_LOSS, 'nothing new after ripe')
})

test('雨天白天不旱：干旱落在下雨的白天推到 18 点', () => {
  let rainy = null
  for (let day = 0; day < 30 && rainy === null; day += 1) {
    const at = new Date(2026, 9, 12 + day, 9).getTime()
    if (weatherAt(at) === 'rain') rainy = at
  }
  assert.ok(rainy, 'some rainy morning within a month')
  assert.equal(weatherAt(new Date(rainy).setHours(20)), 'night')
  const data = establishedFarm()
  const t = fakeApi()
  t.api.now = rainy
  farm.actions.buy(data, { item: 'radish' }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  data.plots[0].pests = { weed: rainy + 99 * H, bug: rainy + 99 * H, dry: rainy + H }
  assert.deepEqual(plotState(data.plots[0], rainy + 2 * H).pests, [], 'raining: no drought yet')
  const evening = new Date(rainy).setHours(18, 0, 0, 0)
  assert.deepEqual(plotState(data.plots[0], evening).pests, ['dry'])
})

test('产量浮动 −3～+2，至少 1 个', () => {
  setRandom(() => 0)
  const data = establishedFarm()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  assert.equal(data.plots[0].roll, -3)
  // random 0：三样灾害种下就来
  assert.equal(plotState(data.plots[0], T0 + 14 * H).yield, 24 - 3 - 3 * PEST_LOSS)
  setRandom(() => 0.99)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, t.api)
  assert.equal(data.plots[1].roll, 2)
})

test('多季作物：收完回到「长大」再长一季，最后一季才枯萎', () => {
  const data = establishedFarm()
  data.exp = 3600 // 9 级
  const t = fakeApi()
  farm.actions.buy(data, { item: 'coconut' }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'coconut' }, t.api)
  noPests(data.plots[0])
  t.api.now = T0 + 30 * H
  farm.actions.harvest(data, { plot: 0 }, t.api)
  assert.equal(data.plots[0].season, 2)
  assert.equal(plotState(data.plots[0], t.api.now).stage, 'growing', 'second season starts grown')
  noPests(data.plots[0])
  t.api.now += 15 * H
  assert.equal(plotState(data.plots[0], t.api.now).ripe, true, 'later seasons take half the time')
  farm.actions.harvest(data, { plot: 0 }, t.api)
  noPests(data.plots[0])
  t.api.now += 15 * H
  farm.actions.harvest(data, { plot: 0 }, t.api)
  assert.equal(data.plots[0].withered, true)
  assert.equal(data.harvests.coconut, 3)
})

test('化肥：多长 2 / 3.5 / 5 小时，可以连着施；熟了不能施', () => {
  const data = establishedFarm()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'radish' }, t.api)
  farm.actions.buy(data, { item: 'fert-3', count: 2 }, t.api)
  assert.equal(t.balance(), 100_000 - 80 - 2000)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  farm.actions.fertilize(data, { plot: 0, item: 'fert-3' }, t.api)
  farm.actions.fertilize(data, { plot: 0, item: 'fert-3' }, t.api)
  assert.equal(plotState(data.plots[0], T0 + 4 * H).ripe, true)
  assert.equal(farm.actions.fertilize(data, { plot: 0, item: 'fert-3' }, t.api).reason, 'empty')
})

test('一键收获 / 照料 / 铲除 / 播种一开始锁着，买了对应工具才能用', () => {
  const data = establishedFarm()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'radish', count: 6 }, t.api)
  assert.equal(farm.actions.plantAll(data, { item: 'radish' }, t.api).reason, 'locked')
  farm.actions.buy(data, { item: 'planter' }, t.api)
  assert.equal(farm.actions.plantAll(data, { item: 'radish' }, t.api).planted, 6)
  t.api.now = T0 + FIRST_PEST
  assert.equal(farm.actions.careAll(data, {}, t.api).reason, 'locked')
  farm.actions.buy(data, { item: 'sprayer' }, t.api)
  assert.equal(farm.actions.careAll(data, {}, t.api).cured, 18)
  for (const plot of data.plots) if (plot) noPests(plot)
  t.api.now = T0 + 14 * H
  assert.equal(farm.actions.harvestAll(data, {}, t.api).reason, 'locked')
  farm.actions.buy(data, { item: 'sickle' }, t.api)
  assert.equal(farm.actions.harvestAll(data, {}, t.api).harvested, 6)
  assert.equal(farm.actions.clearAll(data, {}, t.api).reason, 'locked')
  farm.actions.buy(data, { item: 'rake' }, t.api)
  assert.equal(farm.actions.clearAll(data, {}, t.api).cleared, 6)
  assert.equal(farm.actions.buy(data, { item: 'rake' }, t.api).reason, 'owned')
})

test('铲掉正在长的作物要 force', () => {
  const data = establishedFarm()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'radish' }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  assert.equal(farm.actions.clear(data, { plot: 0 }, t.api).ok, false)
  assert.equal(farm.actions.clear(data, { plot: 0, force: true }, t.api).ok, true)
})

test('开垦：按顺序开，10000 菜币一块，最多 18 块', () => {
  const data = establishedFarm()
  const t = fakeApi(25_000)
  assert.equal(farm.actions.unlock(data, { plot: 7 }, t.api).reason, 'locked')
  assert.equal(farm.actions.unlock(data, { plot: 6 }, t.api).ok, true)
  assert.equal(farm.actions.unlock(data, { plot: 7 }, t.api).ok, true)
  assert.equal(farm.actions.unlock(data, { plot: 8 }, t.api).reason, 'poor')
  assert.equal(data.unlocked, 8)
  const view = farm.view(data, t.api)
  assert.equal(view.plots[8].wild, true)
  assert.equal(view.plots[8].next, true)
  assert.equal(view.plots[17].next, false)
})

test('卖、全卖进菜币；放背包给宿主物品；金币一个不碰', () => {
  const data = establishedFarm()
  const t = fakeApi(0)
  data.harvest.pumpkin = 2
  data.harvest.radish = 10
  assert.equal(farm.actions.store(data, { item: 'pumpkin', count: 1 }, t.api).ok, true)
  assert.deepEqual(t.bag, { pumpkin: 1 })
  assert.equal(farm.actions.store(data, { item: 'radish' }, t.api).ok, false, 'only food crops go to the bag')
  assert.equal(farm.actions.sell(data, { item: 'radish', count: 4 }, t.api).earned, 72)
  assert.equal(farm.actions.sell(data, { item: '*' }, t.api).earned, 30 + 6 * 18)
  assert.equal(t.balance(), 72 + 138)
})

test('3.x 老存档：地至少 6 块、地里作物按旧产量进仓库、洒水器和旧肥料退菜币、大水壶换喷雾桶', () => {
  const old = {
    unlocked: 3,
    plots: [{ crop: 'pumpkin', stage: 1, plantedAt: T0, wateredAt: null }, null, { crop: 'carrot', stage: 3, plantedAt: T0, wateredAt: null }],
    seeds: { carrot: 3 }, harvest: { carrot: 1 }, acquired: { carrot: 8 },
    tools: { can: true, sickle: true }, sprinklers: [true, true, false], fertilizer: 5,
    helper: { hired: true, level: 1, barn: 2, stock: { sprout: 4 } },
  }
  const t = fakeApi(0)
  farm.actions.buy(old, { item: 'nothing' }, t.api)
  assert.equal(old.version, 4)
  assert.equal(old.unlocked, 6)
  assert.equal(old.harvest.pumpkin, 2)
  assert.equal(old.harvest.carrot, 1 + 4)
  assert.equal(old.harvests.carrot, 3, 'acquired 12 carrots at 4 each')
  assert.deepEqual(old.tools, { sickle: true, sprayer: true, rake: false, planter: false })
  assert.equal(old.seeds.carrot, 3)
  assert.equal(t.balance(), 2 * 3000 + 5 * 20)
  assert.deepEqual(old.plots.slice(0, 3), [null, null, null])
  assert.equal(old.helper.hired, true)
  assert.equal(old.helper.stock.sprout, 4)
  assert.ok(old.exp > 0)
  assert.equal(old.sprinklers, undefined)
})

test('view 不改存档；货架列种子、化肥、工具和帮工，用菜币标价', () => {
  const data = establishedFarm()
  const t = fakeApi(15)
  const before = structuredClone(data)
  const view = farm.view(data, t.api)
  assert.deepEqual(data, before)
  assert.equal(view.shelf.currency.balance, 15)
  assert.equal(view.shelf.items.length, 1 + 29 + 3 + 4)
  assert.equal(view.dex.entries.length, 29)
  assert.equal(view.plots.length, 18)
  assert.deepEqual(view.counts, { ripe: 0, pests: 0, withered: 0, empty: 6 })
  assert.equal(normalize(structuredClone(data)).plots.length, 18)
})

test('帮工猪（J2 不变）：按自己的小批次收进谷仓、管的地不显示灾害、六小时封仓、收仓后接着干', () => {
  const data = establishedFarm()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'radish', count: 50 }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, t.api)
  farm.actions.hire(data, {}, t.api)
  const recipe = helperRecipe('radish', 0, 0)
  assert.ok(recipe.net > 0 && recipe.net <= 400)
  t.api.now = T0 + FIRST_PEST + 1
  const view = farm.view(data, t.api)
  assert.deepEqual(view.plots[0].pests, [], 'the helper keeps its plots clean')
  t.api.now = T0 + 24 * H
  const full = farm.view(data, t.api)
  assert.equal(full.helper.full, true)
  assert.equal(full.helper.stored, recipe.batches * recipe.yield)
  assert.equal(farm.actions.collect(data, {}, t.api).ok, true)
  assert.equal(data.harvest.radish, recipe.batches * recipe.yield)
  assert.equal(data.helper.usedMs, 0)
})

test('帮工每种作物、每档：净时薪 ≤ 400 且比自己种少赚', () => {
  for (const crop of CROPS) for (let level = 0; level < 3; level += 1) for (let barn = 0; barn < 4; barn += 1) {
    const recipe = helperRecipe(crop.key, level, barn)
    const manual = HELPER_PLOTS[level] * (crop.yield * crop.sell - crop.price) / crop.hours
    assert.ok(recipe.net > 0 && recipe.net <= 400 && recipe.net < manual, crop.key + level + barn)
  }
})

test('新开荒地：六块全干，每块有草或残株；除草、铲残株和浇水各 +2 经验', () => {
  let draw = 0
  setRandom(() => [0.1, 0.1, 0.9, 0.2, 0.9][draw++ % 5])
  const data = farm.init(), t = fakeApi()
  const plots = farm.view(data, t.api).plots.slice(0, 6)
  assert.equal(plots.filter(plot => plot.pests.includes('dry')).length, 6)
  assert.ok(plots.every(plot => plot.stubble || plot.pests.includes('weed')))
  assert.ok(plots.filter(plot => plot.pests.includes('weed')).length > 3)
  farm.actions.buy(data, { item: 'radish', count: 2 }, t.api)
  assert.equal(farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api).reason, 'clear-ground')
  const start = data.exp
  assert.equal(farm.actions.care(data, { plot: 0, kind: 'weed' }, t.api).ok, true)
  assert.equal(farm.actions.clear(data, { plot: 0 }, t.api).ok, true)
  assert.equal(data.exp - start, 4)
  assert.equal(farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api).ok, true)
  assert.ok(plotState(data.plots[0], t.api.now).pests.includes('dry'), '干土允许播种，种下仍干')
  assert.equal(farm.actions.care(data, { plot: 0, kind: 'dry' }, t.api).ok, true)
  assert.equal(data.exp - start, 6)
  assert.equal(farm.actions.unlock(data, { plot: 6 }, t.api).ok, true)
  assert.ok(data.plots[6].fallow)
  assert.ok(data.plots[6].stubble || data.plots[6].pests.weed === 0)
  data.plots[1] = { fallow: true, stubble: false, pests: { weed: 0, dry: 0 } }
  assert.equal(farm.actions.clear(data, { plot: 1, force: true }, t.api).reason, 'unavailable', 'force 不绕过去除空地杂草')
})

test('雨天浇湿已经干的空地和作物；view 不改输入；动作写回后空地不复干', () => {
  const data = farm.init(), t = fakeApi()
  data.plots[0] = { crop: 'radish', plantedAt: T0, season: 1, boostMs: 0, roll: 0, pests: { weed: 1e15, bug: 1e15, dry: T0 } }
  let rain = T0
  for (let day = 1; day < 30; day += 1) { rain = T0 + day * 24 * H; if (weatherAt(rain) === 'rain') break }
  t.api.now = rain
  const before = structuredClone(data)
  assert.equal(farm.view(data, t.api).plots.filter(plot => plot.pests?.includes('dry')).length, 0)
  assert.deepEqual(data, before)
  farm.actions.buy(data, { item: 'radish' }, t.api)
  assert.equal(data.plots[1].pests.dry, null)
  assert.ok(data.plots[0].pests.dry > rain)
  t.api.now = new Date(rain).setHours(19)
  assert.equal(farm.view(data, t.api).plots[1].pests.includes('dry'), false)
})

test('开荒字段 normalize 兼容；3.x 迁移和既有 4.0 空地不长出草和残株', () => {
  const old = normalize({ version: 4, unlocked: 8, plots: [] })
  assert.ok(old.plots.every(plot => plot === null))
  const migrated = normalize({ version: 3, unlocked: 8, plots: [] })
  assert.ok(migrated.plots.every(plot => plot === null))
  const data = farm.init()
  data.plots[0] = { fallow: true }
  normalize(data)
  assert.equal(data.plots[0].stubble, false)
  assert.equal(data.plots[0].pests.dry, null)
})
