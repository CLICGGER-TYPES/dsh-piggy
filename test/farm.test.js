// 菜园 4.0（docs/design/farm-qqfarm.md；用户 2026-10-12：照 QQ 农场改版，A 照搬时长、B 补多季、C 一键要买工具、D 留帮工、F 留原有 9 种）。
import assert from 'node:assert/strict'
import { test, beforeEach } from 'node:test'

import farm, {
  CROPS, FERTILIZERS, PEST_LOSS, PEST_MS, PLOTS, RECLAIM_PRICE, START_PLOTS, TOOLS,
  levelOf, normalize, plotState, setRandom, weatherAt, helperRecipe, HELPER_PLOTS, HELPER_WINDOW,
} from '../extensions/farm/server.js'

// 既有 4.0 熟地存档用于旧行为回归；开荒另有独立测试。
function establishedFarm() { return Object.assign(farm.init(), { plots: Array(18).fill(null) }) }
const H = 3600000
/** 找一个晴天中午当起点（weatherAt 按日期定晴雨），免得雨天推迟干旱打乱断言。 */
function sunnyNoon() {
  for (let day = 0; day < 30; day += 1) {
    const at = new Date(2026, 9, 12 + day, 12).getTime()
    if (weatherAt(at) === 'sunny' && weatherAt(at + 24 * H) === 'sunny') return at
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

test('雨天全天不旱：夜里也下雨，干旱推到下一个晴天', () => {
  let rainy = null
  for (let day = 0; day < 30 && rainy === null; day += 1) {
    const at = new Date(2026, 9, 12 + day, 9).getTime()
    if (weatherAt(at) === 'rain') rainy = at
  }
  assert.ok(rainy, 'some rainy morning within a month')
  assert.equal(weatherAt(new Date(rainy).setHours(20)), 'rain')
  const data = establishedFarm()
  const t = fakeApi()
  t.api.now = rainy
  farm.actions.buy(data, { item: 'radish' }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  data.plots[0].pests = { weed: rainy + 99 * H, bug: rainy + 99 * H, dry: rainy + H }
  assert.deepEqual(plotState(data.plots[0], rainy + 2 * H).pests, [], 'raining: no drought yet')
  const evening = new Date(rainy).setHours(18, 0, 0, 0)
  assert.deepEqual(plotState(data.plots[0], evening).pests, [])
  assert.deepEqual(plotState(data.plots[0], new Date(rainy).setHours(23)).pests, [])
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
  assert.equal(t.balance(), 2 * 3000 + 5 * 20 + (1000 + 3000), '旧洒水器 + 旧肥料 + 农具档（档位 2 = 1000+3000）')
  assert.deepEqual(old.plots.slice(0, 3), [null, null, null])
  assert.equal(old.helper.hired, true)
  assert.equal(old.helper.barn, 0, '农具档退完菜币后 barn 清零')
  assert.equal(old.helperBarnRefunded, true, '留下「已退过」标记，不再退第二次')
  assert.ok(t.said.some(line => line.includes('农具暂时下架，已退还 4000 菜币')), '退农具时提示一句')
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
  const recipe = helperRecipe('radish', 0)
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

test('帮工每种作物、每档管地：净时薪 ≤ 400 且比自己种少赚', () => {
  for (const crop of CROPS) for (let level = 0; level < 3; level += 1) {
    const recipe = helperRecipe(crop.key, level)
    const manual = HELPER_PLOTS[level] * (crop.yield * crop.sell - crop.price) / crop.hours
    assert.ok(recipe.net > 0 && recipe.net <= 400 && recipe.net < manual, crop.key + level)
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

test('fix4：夜里下雨浇湿已干地，时段不改变天气或浇水', () => {
  const t = fakeApi(), data = farm.init()
  let night = new Date(2026, 9, 13, 22).getTime()
  while (weatherAt(night) !== 'rain') night = new Date(night).setDate(new Date(night).getDate() + 1)
  data.plots[0] = { fallow: true, stubble: false, pests: { dry: 0, weed: null, bug: null } }
  data.plots[1] = { crop: 'radish', season: 1, plantedAt: night - H, boostMs: 0, roll: 0, pests: { dry: night - H, weed: 1e15, bug: 1e15 } }
  t.api.now = night
  const before = structuredClone(data), view = farm.view(data, t.api)
  assert.equal(view.weather, 'rain')
  assert.ok(view.plots.slice(0, 2).every(plot => !plot.pests.includes('dry')))
  assert.deepEqual(data, before, '只读view不写入存档')
  farm.actions.buy(data, { item: 'radish' }, t.api)
  assert.equal(data.plots[0].pests.dry, null)
  assert.ok(data.plots[1].pests.dry > night)
})

test('帮工每种作物、每档管地：实际净时薪落在自己种的 85%~92%，400 封顶、六小时整数批', () => {
  const capped = []
  for (const crop of CROPS) for (let level = 0; level < 3; level += 1) {
    const recipe = helperRecipe(crop.key, level)
    const manual = HELPER_PLOTS[level] * (crop.yield * crop.sell - crop.price) / crop.hours
    const where = crop.key + '/' + HELPER_PLOTS[level] + '块地'
    assert.ok(Number.isInteger(recipe.batches) && recipe.batches >= 1, where + ' 批数是整数')
    assert.equal(recipe.intervalMs * recipe.batches, HELPER_WINDOW, where + ' 批次正好铺满六小时')
    assert.ok(recipe.yield >= 1 && recipe.yield <= crop.yield, where + ' 单批收成不超过自己种')
    assert.ok(recipe.net > 0 && recipe.net <= 400, where + ' 净时薪不超过 400')
    const share = recipe.net / manual
    assert.ok(share >= 0.85 - 1e-9 && share <= 0.92 + 1e-9, where + ' 实际占比 ' + share.toFixed(4))
    if (manual * 0.92 > 400) capped.push(where + '=' + recipe.net.toFixed(0))
  }
  assert.ok(capped.length > 0, '有被 400 封顶的组合：' + capped.join(','))
})

test('数值扰动 ±5%：87 个组合都不返回 null、周期/批数/收成可用，净时薪恒 ≤ 400（防崩回归）', () => {
  const fields = ['price', 'sell', 'yield', 'hours']
  const before = CROPS.map(crop => ({ ...crop }))
  const check = label => {
    let degraded = 0
    for (const crop of CROPS) for (let level = 0; level < 3; level += 1) {
      const where = label + ' ' + crop.key + '/' + HELPER_PLOTS[level] + '块地'
      const recipe = helperRecipe(crop.key, level)
      assert.ok(recipe, where + ' 不该返回 null')
      assert.ok(Number.isInteger(recipe.batches) && recipe.batches >= 1, where + ' 批数是正整数')
      assert.ok(Number.isFinite(recipe.intervalMs) && recipe.intervalMs > 0, where + ' 周期是有限正数')
      assert.equal(recipe.intervalMs * recipe.batches, HELPER_WINDOW, where + ' 批次铺满六小时')
      assert.ok(recipe.yield >= 1 && recipe.yield <= crop.yield, where + ' 单批收成在 1~自己种之间')
      assert.ok(Number.isFinite(recipe.net) && recipe.net <= 400, where + ' 净时薪恒 ≤ 400')
      assert.ok(Number.isFinite(recipe.share) && Math.abs(recipe.share - recipe.net / (HELPER_PLOTS[level] * (crop.yield * crop.sell - crop.price) / crop.hours)) < 1e-9, where + ' share = net / 自己种')
      if (recipe.degraded) degraded += 1
    }
    return degraded
  }
  let degraded = 0
  try {
    for (const factor of [0.95, 1.05]) {
      CROPS.forEach((crop, index) => { for (const field of fields) crop[field] = before[index][field] * factor })
      degraded += check('×' + factor)
    }
  } finally {
    CROPS.forEach((crop, index) => { for (const field of fields) crop[field] = before[index][field] })
  }
  assert.ok(degraded > 0, '扰动后得有组合走退化路径，否则这条测试没碰到退化代码：' + degraded)
})

test('400 封顶与退化路径：区间无解时也给出可用配方（带 degraded / share）', () => {
  for (const crop of CROPS) for (let level = 0; level < 3; level += 1) {
    const recipe = helperRecipe(crop.key, level)
    assert.ok(recipe.net <= 400, crop.key + ' 净时薪必须 ≤ 400')
    assert.equal(recipe.degraded, false, crop.key + '/' + level + ' 当前数值表不该退化')
  }
  // 石榴种子价 170 → 160：16 地自己种净时薪 474 > 400/0.85，85% 下界（402.96）高过 400 封顶，
  // 区间整个落空——旧代码在这条组合上返回 null，prepareHelper 读 recipe.intervalMs 会抛穿整个扩展。
  const pomegranate = CROPS.find(crop => crop.key === 'pomegranate')
  const price = pomegranate.price
  try {
    pomegranate.price = 160
    const manual = HELPER_PLOTS[2] * (pomegranate.yield * pomegranate.sell - pomegranate.price) / pomegranate.hours
    assert.ok(manual * 0.85 > 400, '这条组合的 85% 下界确实高过 400 封顶：' + (manual * 0.85).toFixed(2))
    const recipe = helperRecipe('pomegranate', 2)
    assert.ok(recipe, '无解也不能返回 null')
    assert.equal(recipe.degraded, true, '无解就走退化路径')
    assert.ok(recipe.yield >= 1 && recipe.yield <= pomegranate.yield, '退化配方的单批收成仍可用')
    assert.ok(Number.isFinite(recipe.intervalMs) && recipe.intervalMs > 0, '退化配方周期有限')
    assert.equal(recipe.intervalMs * recipe.batches, HELPER_WINDOW, '退化配方照样铺满六小时')
    assert.ok(recipe.net > 0 && recipe.net <= 400 && recipe.net < manual, '退化配方仍便宜于自己种且 ≤ 400')
    assert.ok(recipe.share > 0.8 && recipe.share === recipe.net / manual, '退化也尽量贴近九成：' + recipe.share)
  } finally {
    pomegranate.price = price
  }
  // key 不认识时仍返回 null（调用方必须兜底），但整条动作链不能抛。
  assert.equal(helperRecipe('not-a-crop', 0), null)
  const data = establishedFarm(), t = fakeApi()
  farm.actions.buy(data, { item: 'radish', count: 4 }, t.api)
  farm.actions.hire(data, {}, t.api)
  t.api.now = T0 + 6 * H
  assert.doesNotThrow(() => farm.view(data, t.api), '坏数据下 view 不该崩掉整个扩展')
})

test('时钟回拨：结算不挪 lastAt，回拨那一段不重记工时（回归）', () => {
  const data = establishedFarm()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'radish', count: 50 }, t.api)
  for (const plot of [0, 1, 2, 3]) farm.actions.plant(data, { plot, item: 'radish' }, t.api)
  farm.actions.hire(data, {}, t.api)
  t.api.now = T0 + 5 * H
  farm.actions.buy(data, { item: 'radish' }, t.api)
  const used = data.helper.usedMs, stock = structuredClone(data.helper.stock)
  assert.ok(used > 0 && used <= 5 * H, '先干满五小时：' + used)
  t.api.now = T0 + 4 * H
  farm.actions.buy(data, { item: 'radish' }, t.api)
  assert.equal(data.helper.lastAt, T0 + 5 * H, '回拨不把 lastAt 挪到过去')
  assert.equal(data.helper.usedMs, used, '回拨这一段不结算')
  assert.deepEqual(data.helper.stock, stock, '回拨不发货')
  t.api.now = T0 + 5 * H
  farm.actions.buy(data, { item: 'radish' }, t.api)
  assert.equal(data.helper.usedMs, used, '时钟走回原处不重复记工时')
  assert.deepEqual(data.helper.stock, stock, '时钟走回原处不重复发货')
})

test('帮工清理管区开荒地（残株、杂草）不给经验、不吃体力；缺指定种子就只清不种', () => {
  setRandom(() => 0.1)
  const data = establishedFarm()
  const t = fakeApi()
  data.plots[0] = { fallow: true, stubble: true, pests: { dry: null, weed: null } }
  data.plots[1] = { fallow: true, stubble: false, pests: { dry: null, weed: 0 } }
  data.plots[2] = { fallow: true, stubble: true, pests: { dry: null, weed: 0 } }
  data.helper.targets[0] = 'radish' // 指定了白萝卜，但一颗白萝卜种子都没有
  farm.actions.hire(data, {}, t.api)
  const exp = data.exp, tired = t.tired()
  t.api.now = T0 + H
  farm.actions.buy(data, { item: 'sprout', count: 1 }, t.api) // 有别的种子，帮工也不替玩家挑
  assert.equal(data.plots[0].fallow, true, '缺种子不补种')
  assert.equal(data.plots[0].stubble, false, '残株照清')
  assert.equal(data.plots[1].pests.weed, null, '杂草照拔')
  assert.equal(data.plots[2].stubble, false, '没指定作物的荒地也只清')
  assert.equal(data.exp, exp, '帮工清理开荒地不给经验')
  assert.equal(t.tired(), tired, '帮工干活不吃玩家体力')
  assert.deepEqual(farm.view(data, t.api).helper.missing, ['白萝卜'], '缺哪种目标种子如实报')
})

test('帮工清理开荒地后按指定作物补种，不换仓库里数量更多的种子', () => {
  setRandom(() => 0.1)
  const data = establishedFarm()
  const t = fakeApi()
  data.exp = 10000
  farm.actions.buy(data, { item: 'radish', count: 5 }, t.api)
  farm.actions.buy(data, { item: 'carrot', count: 50 }, t.api)
  data.plots[0] = { fallow: true, stubble: true, pests: { dry: null, weed: 0 } }
  data.helper.targets[0] = 'radish'
  farm.actions.hire(data, {}, t.api)
  t.api.now = T0 + H
  farm.actions.buy(data, { item: 'radish' }, t.api)
  assert.equal(data.plots[0].crop, 'radish', '清理后按指定的白萝卜补种，不吃数量更多的胡萝卜')
})

test('玩家主动铲空管区地：帮工按原来指定的作物补种，不换仓库里数量更多的种子', () => {
  const data = establishedFarm()
  const t = fakeApi()
  data.exp = 10000
  farm.actions.buy(data, { item: 'radish', count: 50 }, t.api)
  farm.actions.buy(data, { item: 'carrot', count: 200 }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  farm.actions.hire(data, {}, t.api)
  t.api.now = T0 + 2 * H
  farm.actions.buy(data, { item: 'radish' }, t.api)
  assert.equal(data.helper.targets[0], 'radish', '帮工认下玩家种的白萝卜')
  assert.equal(farm.actions.clear(data, { plot: 0, force: true }, t.api).ok, true, '玩家主动铲空')
  assert.equal(data.plots[0]?.crop, 'radish', '补的是原来指定的白萝卜，不是数量最多的胡萝卜')
})

test('农具档下架：商店不卖、配方不吃 barn、旧存档 barn 退款后清零，barn 0/3 结算结果完全相同', () => {
  assert.equal(helperRecipe.length, 2, 'helperRecipe 只剩 (key, level) 两个形参')
  const data = establishedFarm()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'radish', count: 50 }, t.api)
  farm.actions.hire(data, {}, t.api)
  const keys = farm.view(data, t.api).shelf.items.map(item => item.key)
  assert.ok(!keys.includes('helper-barn'), '商店不再卖农具档：' + keys.join(','))
  assert.ok(keys.includes('helper-level'), '管地数一档还在')
  assert.equal(farm.actions.upgrade(data, { kind: 'barn' }, t.api).reason, 'locked', 'helperBuy 拒收 barn')
  data.exp = 10000
  for (const plot of [0, 1, 2, 3]) farm.actions.plant(data, { plot, item: 'radish' }, t.api)
  data.helper.pending = null
  const run = barn => {
    const copy = structuredClone(data), host = fakeApi()
    copy.helper.barn = barn
    host.api.now = T0 + 6 * H
    return { helper: farm.view(copy, host.api).helper, result: JSON.parse(JSON.stringify(farm.actions.collect(copy, {}, host.api))), harvest: structuredClone(copy.harvest), usedMs: copy.helper.usedMs }
  }
  assert.deepEqual(run(3), run(0), 'barn 0 与 barn 3 的 view / 结算结果完全相同')
  const old = structuredClone(data)
  old.helper.barn = 3
  old.helper.pending = { index: 0, crop: 'radish', plantedAt: old.plots[0].plantedAt, remainingMs: 900000, yield: 3 }
  const host = fakeApi()
  host.api.now = T0 + H
  assert.doesNotThrow(() => farm.actions.buy(old, { item: 'radish' }, host.api), '旧存档 barn:3 + pending 迁移/结算不抛')
  assert.equal(old.helper.barn, 0, '旧存档 barn:3 退完菜币后清零（退款口径见下条测试）')
  assert.equal(old.helperBarnRefunded, true, '留下「已退过」标记')
})

test('农具档退款：3.0.0 买过的档位 1/2/3 累计退 1000/4000/13000 菜币，barn=0 不退', () => {
  for (const [barn, amount] of [[1, 1000], [2, 4000], [3, 13000]]) {
    const t = fakeApi(0)
    const old = { version: 3, unlocked: 6, plots: [], helper: { hired: true, level: 0, barn } }
    farm.actions.buy(old, { item: 'nothing' }, t.api)
    assert.equal(t.balance(), amount, 'barn ' + barn + ' 累计退 ' + amount)
    assert.equal(old.helper.barn, 0, '退完清零')
    assert.equal(old.helperBarnRefunded, true, '留下「已退过」标记')
    assert.ok(t.said.includes('农具暂时下架，已退还 ' + amount + ' 菜币'), '提示退款金额：' + amount)
  }
  const zero = fakeApi(0)
  const fresh = { version: 3, unlocked: 6, plots: [], helper: { hired: true, level: 0, barn: 0 } }
  farm.actions.buy(fresh, { item: 'nothing' }, zero.api)
  assert.equal(zero.balance(), 0, 'barn=0 一分不退')
  assert.equal(fresh.helperBarnRefunded, undefined, '没农具就不写已退标记')
  assert.deepEqual(zero.said, [], '没农具就不提示')
})

test('农具档退款：早就迁到 v4、barn 还在的存档也退一次并清零', () => {
  const t = fakeApi(0)
  const v4 = { version: 4, unlocked: 6, plots: [], seeds: {}, harvest: {}, acquired: {}, harvests: {}, tools: {}, fert: {}, exp: 0, refund: 0, helper: { hired: true, level: 0, barn: 3 } }
  farm.actions.buy(v4, { item: 'nothing' }, t.api)
  assert.equal(t.balance(), 13000, 'v4 存档里遗留的 barn 3 退 13000')
  assert.equal(v4.helper.barn, 0)
  assert.equal(v4.helperBarnRefunded, true)
})

test('农具档退款只发一次：同一存档跑两遍 normalize/migrate、付过之后再来动作都不再退', () => {
  const raw = { version: 3, unlocked: 6, plots: [], helper: { hired: true, level: 0, barn: 2 } }
  const first = normalize(structuredClone(raw))
  assert.equal(first.refund, 4000, 'migrate + 首次 normalize 记下待退 4000')
  assert.equal(first.helperBarnRefunded, true)
  const second = normalize(first)
  assert.equal(second.refund, 4000, '第二遍 normalize 不再累加')
  assert.equal(second.helper.barn, 0)
  const t = fakeApi(0)
  farm.actions.buy(first, { item: 'nothing' }, t.api)
  assert.equal(t.balance(), 4000, '动作时付一次')
  t.api.now = T0 + H
  farm.actions.buy(first, { item: 'nothing' }, t.api)
  assert.equal(t.balance(), 4000, '付过之后再跑动作不再退')
})

test('帮工 view：没种子就报「缺种子」/「没种子」，不再只写「帮工 · N 块地」', () => {
  const data = establishedFarm()
  const t = fakeApi()
  farm.actions.hire(data, {}, t.api)
  let helper = farm.view(data, t.api).helper
  assert.equal(helper.hired, true)
  assert.equal(helper.plots, HELPER_PLOTS[0])
  assert.equal(helper.seedless, true, '一种目标种子都没有：没得种')
  assert.deepEqual(helper.missing, [])
  data.helper.targets[0] = 'radish'
  helper = farm.view(data, t.api).helper
  assert.deepEqual(helper.missing, ['白萝卜'], '有目标没种子：报缺哪种')
  farm.actions.buy(data, { item: 'radish', count: 2 }, t.api)
  helper = farm.view(data, t.api).helper
  assert.equal(helper.seedless, false, '有目标作物种子就干活')
  assert.deepEqual(helper.missing, [])
  assert.ok(data.plots.some(plot => plot?.crop === 'radish'), '按指定作物补种')
})

test('fix4：缺失或越界的旧旱灾时间不导致雨天顺延无限循环', () => {
  for (const dry of [undefined, NaN, Infinity, 9e15]) {
    const plot = { crop: 'radish', season: 1, plantedAt: T0, boostMs: 0, roll: 0, pests: { weed: 1e15, bug: 1e15, dry } }
    assert.deepEqual(plotState(plot, T0).pests, [])
  }
})
