// @ts-check
// 菜园「自然托管」回归（用户 2026-10-27 批准）：托管地按原成熟时间并行生长，成熟进帮工仓、同种种子自动补种，
// 不给经验、不扣体力，没有加速批次、六小时停工和 400 预算。存档仍是 farm v5：pending 一律 null、usedMs 一律 0。
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import farm, {
  CROPS, HELPER_PLOTS, PLOTS, START_PLOTS, normalize, plotState, setRandom, weatherAt,
} from '../extensions/farm/server.js'

const H = 3600000
const MIN = 60000

/** 找一个晴天中午当起点（weatherAt 按日期定晴雨），免得雨天浇地打乱断言。 */
function sunnyNoon() {
  for (let day = 0; day < 60; day += 1) {
    const at = new Date(2026, 9, 12 + day, 12).getTime()
    if (weatherAt(at) === 'sunny' && weatherAt(at + 24 * H) === 'sunny') return at
  }
  throw new Error('no sunny day')
}
const T0 = sunnyNoon()

function api(balance = 100_000) {
  const bag = [], said = []
  let tired = 0
  const host = {
    now: T0,
    coins: () => 0,
    spend() { throw new Error('farm must not touch gold') },
    earn() { throw new Error('farm must not touch gold') },
    wallet: {
      currency: { label: '菜币', emoji: '🥬', rate: 1 },
      balance: () => balance,
      earn(n) { balance += n; return n },
      spend(n) { if (balance < n) return false; balance -= n; return true },
    },
    give(key, n) { bag.push([key, n]); return true },
    say(line) { said.push(line) },
    exert(points) { tired += points },
  }
  return { api: host, bag, said, balance: () => balance, tired: () => tired }
}

/** 干净的 v5 熟地存档：18 块空地，第一课已完成，9 级（种子等级不挡路）。 */
function farm9() {
  const data = Object.assign(farm.init(), { plots: Array(PLOTS).fill(null) })
  data.exp = 10000
  data.onboarding = { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null }
  return data
}

const cropOf = key => CROPS.find(crop => crop.key === key)
const rollsOf = (data, count) => data.plots.slice(0, count).map(plot => plot.roll)
const naturalYield = (crop, roll) => Math.max(1, crop.yield + roll)
const sumOf = (data, count) => data.plots.slice(0, count).reduce((sum, plot) => sum + (plot ? naturalYield(cropOf(plot.crop), plot.roll) : 0), 0)
/** 只比较「长得对不对」：灾害时间每次结算按当前时刻重算，本来就不是存档事实。 */
const growingShape = data => ({
  stock: data.helper.stock, seeds: data.seeds, harvests: data.harvests, acquired: data.acquired, harvest: data.harvest,
  cursor: data.helper.cursor, targets: data.helper.targets, lastAt: data.helper.lastAt,
  plots: data.plots.map(plot => (plot === null ? null : { crop: plot.crop, season: plot.season, plantedAt: plot.plantedAt, boostMs: plot.boostMs, roll: plot.roll })),
})

beforeEach(() => setRandom(() => 0.5))

test('六块小白菜同刻种：25 分钟六块都在长、2 小时一块没收，18 小时同刻收六块并按现有种子补种', () => {
  const t = api()
  const data = farm9()
  data.helper.level = 1 // 管 8 块地
  data.seeds.cabbage = 12
  farm.actions.hire(data, {}, t.api)
  for (const plot of [0, 1, 2, 3, 4, 5]) assert.equal(farm.actions.plant(data, { plot, item: 'cabbage' }, t.api).ok, true)
  const rolls = rollsOf(data, 6)
  const crop = cropOf('cabbage')

  t.api.now = T0 + 25 * MIN
  const early = farm.view(data, t.api)
  for (const plot of early.plots.slice(0, 6)) {
    assert.ok(plot.progress > 0.02 && plot.progress < 0.03, '25 分钟：六块都按真实时间在长（' + plot.progress + '）')
    assert.equal(plot.stage, 'seed')
    assert.equal(plot.ripe, false)
    assert.deepEqual(plot.pests, [], '托管地不长草不生虫')
    assert.equal(plot.helperNote, '帮工照料中')
  }
  assert.equal(early.helper.stored, 0, '一块都没收')

  t.api.now = T0 + 2 * H
  const twoHours = farm.view(data, t.api)
  assert.equal(twoHours.helper.stored, 0, '两小时没有提前收成')
  assert.equal(twoHours.plots.slice(0, 6).filter(plot => plot.ripe).length, 0)
  assert.equal(twoHours.plots[0].remainingMs, crop.hours * H - 2 * H, '剩余时间照真实成熟时间走')

  t.api.now = T0 + crop.hours * H
  farm.actions.buy(data, { item: 'nothing' }, t.api) // 任意动作先结算一次
  assert.equal(data.harvests.cabbage, 6, '六块同刻成熟，一块都不漏')
  assert.equal(data.helper.stock.cabbage, rolls.reduce((sum, roll) => sum + naturalYield(crop, roll), 0), '每块按自己的 roll 收')
  for (const plot of data.plots.slice(0, 6)) {
    assert.equal(plot.crop, 'cabbage', '按现有种子补种同一种作物')
    assert.equal(plot.plantedAt, T0 + crop.hours * H, '补种从真实收获时刻起算')
    assert.equal(plot.season, 1)
    assert.ok(Number.isInteger(plot.roll) && plot.roll >= -3 && plot.roll <= 2, '新一株的 roll 仍取 −3～+2')
  }
  assert.equal(data.seeds.cabbage, 0, '12 颗种子：先种 6 颗，收完再补 6 颗')
})

test('托管地只清灾害：已种下的 roll、plantedAt、boostMs 一个都不改', () => {
  const t = api()
  const data = farm9()
  data.helper.level = 1
  data.seeds.radish = 10
  farm.actions.hire(data, {}, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  data.plots[0].roll = 2
  data.plots[0].boostMs = 3 * H
  const plantedAt = data.plots[0].plantedAt
  data.plots[0].pests = { weed: T0 + H, bug: T0, dry: T0 - H } // 已经落地的灾害

  t.api.now = T0 + 2 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.plots[0].roll, 2, 'roll 保留')
  assert.equal(data.plots[0].plantedAt, plantedAt, '种植时间不动')
  assert.equal(data.plots[0].boostMs, 3 * H, '施肥加速保留')
  for (const kind of ['weed', 'bug', 'dry']) {
    assert.ok(Number.isFinite(data.plots[0].pests[kind]) && data.plots[0].pests[kind] > T0 + 2 * H, kind + ' 推到未来的有效时间（不是 null / Infinity）')
  }

  t.api.now = T0 + 11 * H // 14 小时 − 3 小时加速
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 1, '到点就收')
  assert.equal(data.helper.stock.radish, 24 + 2, '帮工一直打理：没有灾害减产，roll 照算')
  assert.equal(data.plots[0].plantedAt, T0 + 11 * H, '补种从真实收获时刻起算')
  assert.equal(data.plots[0].boostMs, 0, '新一株的加速从零开始')
})

test('离线多轮：一次结算到底，和逐小时结算的结果完全一致（谁也不会把种子一次吃光）', () => {
  const setup = () => {
    const t = api()
    const data = farm9()
    data.helper.level = 0 // 管 4 块地
    data.seeds.radish = 40
    farm.actions.hire(data, {}, t.api)
    for (const plot of [0, 1, 2, 3]) farm.actions.plant(data, { plot, item: 'radish' }, t.api)
    return { data, t }
  }
  const oneshot = setup()
  oneshot.t.api.now = T0 + 72 * H
  farm.actions.buy(oneshot.data, { item: 'nothing' }, oneshot.t.api)

  const stepwise = setup()
  for (let hour = 1; hour <= 72; hour += 1) {
    stepwise.t.api.now = T0 + hour * H
    farm.actions.buy(stepwise.data, { item: 'nothing' }, stepwise.t.api)
  }
  assert.deepEqual(growingShape(stepwise.data), growingShape(oneshot.data), '离线结算和在线结算必须走同一条时间线')
  assert.equal(oneshot.data.harvests.radish, 20, '72 小时里四块地每块走满五轮')
  assert.equal(oneshot.data.seeds.radish, 40 - 4 - 20, '每收一块补一颗种子')
  assert.equal(oneshot.data.plots.slice(0, 4).filter(plot => plot && plot.crop === 'radish').length, 4, '四块都还在种')
})

test('同种种子不够时按 cursor 轮着补：先种前两块，买第二包后轮到后两块', () => {
  const t = api()
  const data = farm9()
  data.helper.level = 0
  for (const index of [0, 1, 2, 3]) data.helper.targets[index] = 'radish'
  farm.actions.hire(data, {}, t.api)
  farm.actions.buy(data, { item: 'radish', count: 2 }, t.api)
  assert.deepEqual(data.plots.slice(0, 4).map(plot => plot?.crop ?? null), ['radish', 'radish', null, null], '两颗种子先给 cursor 后面的两块')
  assert.equal(data.helper.cursor, 2, '下次从第三块接着补')

  farm.actions.buy(data, { item: 'radish', count: 2 }, t.api)
  assert.deepEqual(data.plots.slice(0, 4).map(plot => plot?.crop ?? null), ['radish', 'radish', 'radish', 'radish'], '第二包种子轮到后两块')
  assert.equal(data.seeds.radish, 0)
})

test('多季作物：自动收满季数才枯萎，整株结束才消耗下一颗种子', () => {
  const t = api()
  const data = farm9()
  data.exp = 2100 // 7 级：南瓜
  const crop = cropOf('pumpkin')
  data.helper.level = 0
  data.seeds.pumpkin = 3
  farm.actions.hire(data, {}, t.api)
  farm.actions.plant(data, { plot: 0, item: 'pumpkin' }, t.api)
  assert.equal(data.seeds.pumpkin, 2)
  const firstRoll = data.plots[0].roll

  t.api.now = T0 + crop.hours * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.pumpkin, 1, '第一季到点就收')
  assert.equal(data.plots[0].season, 2, '收完回到第二季')
  assert.equal(data.plots[0].plantedAt, T0 + crop.hours * H - crop.hours * H / 2, '第二季从「长大」起算（REGROW_AT）')
  assert.equal(data.seeds.pumpkin, 2, '重长不扣种子')
  const secondRoll = data.plots[0].roll
  assert.ok(secondRoll >= -3 && secondRoll <= 2, '第二季重新抽 roll（跟手动的多季一致）')

  t.api.now = T0 + crop.hours * H + crop.hours * H / 2 - 1
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.pumpkin, 1, '第二季差 1 毫秒也不提前收')

  t.api.now = T0 + crop.hours * H + crop.hours * H / 2
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.pumpkin, 2, '第二季到点收')
  assert.equal(data.helper.stock.pumpkin, naturalYield(crop, firstRoll) + naturalYield(crop, secondRoll), '两季各按自己那一季的 roll 收')
  assert.equal(data.plots[0].crop, 'pumpkin', '整株收完才补种')
  assert.equal(data.seeds.pumpkin, 1, '现在才扣第二颗种子')
  assert.equal(data.plots[0].season, 1)
  assert.equal(data.plots[0].plantedAt, T0 + crop.hours * H * 1.5)
})

test('缺种子停空地：收完不补、如实报缺哪种；买了种子下一次结算补上', () => {
  const t = api()
  const data = farm9()
  data.helper.level = 0
  data.seeds.radish = 4
  farm.actions.hire(data, {}, t.api)
  for (const plot of [0, 1, 2, 3]) farm.actions.plant(data, { plot, item: 'radish' }, t.api)

  t.api.now = T0 + 14 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 4)
  assert.deepEqual(data.plots.slice(0, 4), [null, null, null, null], '没种子就停在空地上')
  let helper = farm.view(data, t.api).helper
  assert.deepEqual(helper.missing, ['白萝卜'], '缺哪种种子要说清楚')
  assert.equal(helper.seedless, true)
  assert.equal(helper.stored, 4 * 24, '仓里的收成还在')

  farm.actions.buy(data, { item: 'radish', count: 2 }, t.api)
  assert.ok(data.plots[0] && data.plots[1], '新买的两颗种子先补两块')
  assert.equal(data.plots[0].plantedAt, T0 + 14 * H, '从买种子的时刻起算，不倒填过去')
  helper = farm.view(data, t.api).helper
  assert.deepEqual(helper.missing, ['白萝卜'], '还剩两块空地，种子用光了就如实报缺')
  assert.equal(data.helper.stock.radish, 4 * 24, '收成没有被补种抹掉')
})

test('收仓只搬仓库：重复收仓不重复发货，也不动地块和生长时间', () => {
  const t = api()
  const data = farm9()
  data.helper.level = 0
  data.seeds.radish = 8
  farm.actions.hire(data, {}, t.api)
  for (const plot of [0, 1, 2, 3]) farm.actions.plant(data, { plot, item: 'radish' }, t.api)
  t.api.now = T0 + 14 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  const stock = data.helper.stock.radish
  const plots = structuredClone(data.plots)

  assert.equal(farm.actions.collect(data, {}, t.api).ok, true)
  assert.equal(data.harvest.radish, stock)
  assert.equal(data.helper.stock.radish, 0)
  assert.deepEqual(data.plots, plots, '收仓不动地块和生长时间')
  assert.equal(farm.actions.collect(data, {}, t.api).reason, 'empty', '第二次收仓什么都不搬')
  assert.equal(data.harvest.radish, stock, '不重复发货')
})

test('view 反复调用不改变后续结果，也不推进全局随机', () => {
  const setup = () => {
    const t = api()
    const data = farm9()
    data.helper.level = 0
    data.seeds.radish = 20
    farm.actions.hire(data, {}, t.api)
    for (const plot of [0, 1, 2, 3]) farm.actions.plant(data, { plot, item: 'radish' }, t.api)
    return { data, t }
  }
  let draws = 0
  setRandom(() => { draws += 1; return 0.5 })
  const watched = setup()
  const snapshot = structuredClone(watched.data)
  const drawsAfterSetup = draws
  watched.t.api.now = T0 + 14 * H
  for (let index = 0; index < 8; index += 1) farm.view(watched.data, watched.t.api)
  assert.equal(draws, drawsAfterSetup, 'view 一次全局随机都不抽')
  assert.deepEqual(watched.data, snapshot, 'view 不改存档')

  const control = setup()
  draws = drawsAfterSetup
  for (const world of [watched, control]) {
    world.t.api.now = T0 + 14 * H
    farm.actions.buy(world.data, { item: 'nothing' }, world.t.api)
    world.t.api.now = T0 + 40 * H
    farm.actions.buy(world.data, { item: 'nothing' }, world.t.api)
  }
  assert.deepEqual(growingShape(watched.data), growingShape(control.data), '看多少次快照都不改将来的收成')

  // 手动播种还是走游戏随机源（托管用稳定随机源，两者互不干扰）。
  watched.data.seeds.radish = 1
  const before = draws
  assert.equal(farm.actions.plant(watched.data, { plot: 5, item: 'radish' }, watched.t.api).ok, true)
  assert.equal(draws, before + 4, '手动种一颗要抽 4 次：roll + 三样灾害')
})

test('旧存档的 pending / usedMs 只做幂等清理，不发果、不动种植时间，库存保留', () => {
  const raw = {
    version: 5, unlocked: 6,
    plots: [{ crop: 'radish', season: 1, plantedAt: T0, boostMs: 0, roll: 1, pests: { weed: null, bug: null, dry: null } }, null, null, null, null, null],
    seeds: {}, harvest: { radish: 3 }, acquired: { radish: 30 }, harvests: { radish: 1 }, tools: {}, fert: {}, exp: 200, refund: 0,
    helper: { hired: true, level: 1, barn: 0, lastAt: T0 - 5 * H, usedMs: 6 * H, cursor: 3, pending: { index: 0, crop: 'radish', plantedAt: T0, remainingMs: 60000, yield: 3 }, targets: ['radish'], stock: { radish: 7 } },
    onboarding: { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null },
  }
  const once = normalize(structuredClone(raw))
  assert.equal(once.version, 5, '字段形状仍是 v5，不升版')
  assert.equal(once.helper.pending, null, '旧批次清成 null')
  assert.equal(once.helper.usedMs, 0, '工作预算清成 0')
  assert.equal(once.helper.stock.radish, 7, '已经落进帮工仓的果保留')
  assert.equal(once.helper.targets[0], 'radish')
  assert.equal(once.plots[0].plantedAt, T0, '种植时间不动')
  assert.equal(once.plots[0].roll, 1)
  assert.equal(once.harvest.radish, 3, 'normalize 不发果')
  assert.deepEqual(normalize(structuredClone(once)), once, 'normalize 幂等')

  const t = api()
  const data = structuredClone(once)
  t.api.now = T0 + H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.helper.stock.radish, 7, '还没熟：结算不发果')
  assert.equal(data.harvests.radish, 1)
  t.api.now = T0 + 14 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 2, '到点才收一次')
  assert.ok(data.helper.stock.radish >= 7 + 21)
  assert.equal(data.helper.lastAt, T0 + 14 * H)
  const after = structuredClone(data.helper.stock)
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.deepEqual(data.helper.stock, after, '同一时刻再结算不重复发果')
})

test('回退旧扩展安全：存档形状不变，同一份数据不会藏着重复收成', () => {
  const t = api()
  const data = farm9()
  data.seeds.radish = 10
  farm.actions.hire(data, {}, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  t.api.now = T0 + 14 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.deepEqual(Object.keys(data.helper).sort(), ['barn', 'cursor', 'hired', 'lastAt', 'level', 'pending', 'stock', 'targets', 'usedMs'])
  assert.equal(data.version, 5)
  assert.equal(data.helper.pending, null)
  assert.equal(data.helper.usedMs, 0)
  assert.equal(data.helper.stock.radish, 24, '收成只在帮工仓里出现一次')
  assert.equal(data.harvest.radish ?? 0, 0, '没进玩家仓库')
  assert.equal(data.plots[0].crop, 'radish', '地块已经换上新一株（旧扩展不会把同一块地再收一遍）')
  assert.equal(data.harvests.radish, 1)
})

test('新手试种不被误判已有进度：空存档和只有旧工时 / 旧批次的存档都还是第一课「未开始」', () => {
  const fresh = farm.init()
  assert.equal(fresh.onboarding.step, 'offer')
  assert.equal(normalize(structuredClone(fresh)).onboarding.step, 'offer')
  const legacy = normalize({
    version: 4, unlocked: START_PLOTS, plots: [], seeds: {}, harvest: {}, acquired: {}, harvests: {}, tools: {}, fert: {}, exp: 0, refund: 0,
    helper: { hired: false, level: 0, barn: 0, usedMs: 6 * H, pending: { index: 0, crop: 'radish', plantedAt: T0, remainingMs: 1000, yield: 1 }, stock: {} },
  })
  assert.equal(legacy.helper.usedMs, 0)
  assert.equal(legacy.helper.pending, null)
  assert.equal(legacy.onboarding.step, 'offer', '旧工时和旧批次不算「已经玩过」')
  assert.equal(legacy.onboarding.legacy, false)
})

test('helperView 兼容字段：full 恒 false、capacityHours 为 null、continuous 只在 view 里；地块显示真实进度', () => {
  const t = api()
  const data = farm9()
  data.helper.level = 1
  data.seeds.cabbage = 2
  farm.actions.hire(data, {}, t.api)
  farm.actions.plant(data, { plot: 0, item: 'cabbage' }, t.api)
  t.api.now = T0 + 9 * H
  const view = farm.view(data, t.api)
  assert.equal(view.helper.hired, true)
  assert.equal(view.helper.plots, Math.min(data.unlocked, HELPER_PLOTS[1]))
  assert.equal(view.helper.full, false)
  assert.equal(view.helper.capacityHours, null)
  assert.equal(view.helper.continuous, true)
  assert.equal(view.helper.usedHours, 0)
  assert.equal('continuous' in data.helper, false, 'continuous 只在 view 里，不写存档')

  const crop = cropOf('cabbage')
  const state = plotState(data.plots[0], t.api.now)
  const plot = view.plots[0]
  assert.equal(plot.stage, state.stage, '阶段就是地块自己的阶段')
  assert.equal(plot.progress, state.progress, '进度就是地块自己的进度')
  assert.equal(plot.remainingMs, crop.hours * H - 9 * H, '剩余时间照真实成熟时间')
  assert.deepEqual(plot.pests, [])
  assert.equal(plot.helperNote, '帮工照料中')
})


test('雇用前早已成熟的多季作物只在雇用时收第一季，下一季不倒填雇用前时间', () => {
  const t = api(), data = farm9(), crop = cropOf('pumpkin')
  data.seeds.pumpkin = 2
  t.api.now = T0 - 100 * H
  farm.actions.plant(data, { plot: 0, item: 'pumpkin' }, t.api)
  t.api.now = T0
  farm.actions.hire(data, {}, t.api)
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.pumpkin, 1)
  assert.equal(data.plots[0].season, 2)
  assert.equal(data.plots[0].plantedAt, T0 - crop.hours * H / 2)
  assert.equal(data.seeds.pumpkin, 1)
})
