// 菜园第一课（用户 2026-10-24 确认数值）：每档存档一次、课内 1 颗种子、3 分钟熟、浇水最早 2 分钟、
// 12 菜币 + 1 颗小葱种子、0 经验；只走服务端动作，不碰普通地块/种子/仓库/经验/体力/帮工/成就。
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import farm, { CROPS, LESSON, OLD_HELPER_BARN_PRICES, START_PLOTS, normalize, setRandom } from '../extensions/farm/server.js'

const T0 = 1_800_259_200_000 // 晴天的早上，避免 settleHelper 的雨天浇地改到测试数据
const MIN = 60_000
const H = 3_600_000

beforeEach(() => setRandom(() => 0.5))

/** 有菜币钱包的假宿主；金币接口一律报错，证明第一课只动菜币。 */
function fakeApi(balance = 0) {
  const bag = {}, said = [], ledger = [], events = []
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
    emit(name, payload) { if (name === 'harvest' && !(payload?.total >= 1)) return false; events.push([name, payload]); return true },
  }
  return { api, bag, said, ledger, events, balance: () => balance, tired: () => tired }
}

/** 4.0 存档模板（未安装第一课时）。 */
const v4 = (over = {}) => ({
  version: 4, unlocked: START_PLOTS,
  plots: Array.from({ length: START_PLOTS }, () => ({ fallow: true, stubble: false, pests: { dry: 0, weed: null } })),
  seeds: {}, harvest: {}, acquired: {}, harvests: {}, tools: {}, fert: {}, exp: 0, refund: 0,
  helper: { hired: false, level: 0, barn: 0, stock: {} },
  ...over,
})

const fresh = () => {
  const d = farm.init()
  const t = fakeApi()
  t.api.now = T0
  return { d, t }
}
const plantLesson = () => {
  const run = fresh()
  assert.equal(farm.actions.onboarding(run.d, { op: 'plant' }, run.t.api).ok, true)
  run.t.api.now = T0
  return run
}
const readyLesson = watered => {
  const run = plantLesson()
  if (watered) assert.equal(farm.actions.onboarding(run.d, { op: 'water' }, run.t.api).ok, true)
  run.t.api.now = T0 + (watered ? LESSON.wateredMs : LESSON.ripeMs)
  return run
}
const expectedReady = watered => T0 + (watered ? LESSON.wateredMs : LESSON.ripeMs)

test('新存档第一课：offer、课内 1 颗、0 菜币/0 普通种子，奖励是 12 菜币 + 1 颗小葱种子、0 经验', () => {
  const { d, t } = fresh()
  const o = farm.view(d, t.api).onboarding
  assert.equal(o.step, 'offer')
  assert.equal(o.legacy, false)
  assert.equal(o.rewarded, false)
  assert.deepEqual(o.reward, { currency: 12, seed: 'scallion', exp: 0 })
  assert.deepEqual([o.seed.key, o.seed.label, o.seed.count, o.seed.lessonOnly], ['scallion', '小葱种子', 1, true])
  assert.equal(o.readyAt, null)
  assert.equal(o.ready, false)
  assert.deepEqual([o.canStart, o.canPlant, o.canWater, o.canHarvest], [true, true, false, false])
  assert.equal(d.seeds.scallion, undefined, '课内种子不写进普通种子袋')
  assert.equal(t.balance(), 0, '开始前不发钱')
  assert.equal(d.exp, 0)
  assert.deepEqual(d.harvests, {})
  assert.deepEqual(farm.actions.onboarding(d, { op: 'start' }, t.api), { ok: true, step: 'offer' })
  assert.equal(farm.view(d, t.api).onboarding.step, 'offer', '开始只表示进入卡片，不提前播种')
  assert.equal(t.balance(), 0)
})

test('播种一次、浇水一次：3 分钟熟；浇水后最早 2 分钟，浇晚了也能立刻熟（没有 60 秒窗口）', () => {
  const { d, t } = plantLesson()
  let o = farm.view(d, t.api).onboarding
  assert.deepEqual([o.step, o.plantedAt, o.wateredAt, o.readyAt, o.remainingMs], ['planted', T0, null, T0 + 3 * MIN, 3 * MIN])
  assert.deepEqual([o.canPlant, o.canWater, o.canHarvest], [false, true, false])
  assert.equal(d.seeds.scallion, undefined, '播种也不消耗普通种子')
  assert.equal(farm.actions.onboarding(d, { op: 'plant' }, t.api).reason, 'already', '只种一次')
  assert.equal(farm.actions.onboarding(d, { op: 'water' }, t.api).ok, true)
  assert.equal(farm.actions.onboarding(d, { op: 'water' }, t.api).reason, 'already', '只浇一次')
  t.api.now = expectedReady(true) - 1
  assert.equal(farm.actions.onboarding(d, { op: 'harvest' }, t.api).reason, 'not-ripe')
  t.api.now += 1
  assert.equal(farm.actions.onboarding(d, { op: 'harvest' }, t.api).ok, true)

  const late = plantLesson()
  late.t.api.now = T0 + 150_000 // 两分半才浇，仍然按「种下 + 2 分钟」算
  assert.equal(farm.actions.onboarding(late.d, { op: 'water' }, late.t.api).ok, true)
  assert.equal(late.d.onboarding.wateredAt, T0 + 150_000)
  assert.equal(farm.view(late.d, late.t.api).onboarding.ready, true, '浇的时候已经过了 2 分钟，立刻可收')
  assert.equal(farm.actions.onboarding(late.d, { op: 'harvest' }, late.t.api).ok, true)

  const noWater = plantLesson()
  assert.equal(farm.view(noWater.d, noWater.t.api).onboarding.readyAt, T0 + 3 * MIN)
})

test('收获：原子发 12 菜币 + 1 颗普通小葱种子、0 经验；不碰地块/仓库/收获次数/帮工/体力/成就', () => {
  const { d, t } = readyLesson(true)
  const plots = structuredClone(d.plots), helper = structuredClone(d.helper), tools = structuredClone(d.tools)
  const before = { seeds: structuredClone(d.seeds), harvest: structuredClone(d.harvest), acquired: structuredClone(d.acquired), harvests: structuredClone(d.harvests), exp: d.exp }
  const result = farm.actions.onboarding(d, { op: 'harvest' }, t.api)
  assert.deepEqual(result, { ok: true, earned: 12, seed: 'scallion', exp: 0 })
  assert.deepEqual(t.ledger, [['in', 'tutorial', 12]], '只记一笔菜币收入，不碰金币')
  assert.equal(t.balance(), 12)
  assert.equal(d.seeds.scallion, 1, '只发 1 颗普通小葱种子')
  assert.deepEqual(d.seeds, { ...before.seeds, scallion: 1 })
  assert.deepEqual(d.harvest, before.harvest, '课内收成不进普通仓库')
  assert.deepEqual(d.acquired, before.acquired)
  assert.deepEqual(d.harvests, before.harvests, '不增加普通收获次数/成就进度')
  assert.equal(d.exp, before.exp, '0 经验')
  assert.deepEqual(d.plots, plots, '不覆盖普通地块')
  assert.deepEqual(d.helper, helper, '不碰帮工')
  assert.deepEqual(d.tools, tools)
  assert.equal(t.tired(), 0, '不额外扣饱食（用户未批准）')
  assert.deepEqual(t.events, [], '不发成就事件')
  assert.deepEqual([d.onboarding.step, d.onboarding.rewarded], ['done', true])
  const done = farm.view(d, t.api).onboarding
  assert.equal(done.seed.count, 0, '课内种子收完就没了')
  assert.deepEqual([done.progress, done.remainingMs, done.canHarvest], [1, 0, false])
  const after = farm.actions.onboarding(d, { op: 'harvest' }, t.api)
  assert.equal(after.reason, 'already')
  assert.equal(t.balance(), 12, '重复收获不再发钱')
  assert.equal(d.seeds.scallion, 1, '重复收获不再发种子')
})

test('重复请求/重开/存档回读/时间回拨：奖励只发一次，时钟回拨不能提前收', () => {
  const { d, t } = readyLesson(false)
  assert.equal(farm.actions.onboarding(d, { op: 'harvest' }, t.api).ok, true)
  const twin = structuredClone(d)
  assert.equal(farm.actions.onboarding(twin, { op: 'harvest' }, t.api).reason, 'already', '同一份存档再请求不重复发')
  assert.equal(t.balance(), 12)
  assert.equal(d.seeds.scallion, 1)
  const restored = JSON.parse(JSON.stringify(d))
  assert.equal(farm.actions.onboarding(restored, { op: 'harvest' }, t.api).reason, 'already', '重启后不再发')
  assert.equal(t.balance(), 12)

  const early = plantLesson()
  early.t.api.now = T0 - 1
  assert.equal(farm.actions.onboarding(early.d, { op: 'harvest' }, early.t.api).reason, 'not-ripe', '回拨不能提前收')
  early.t.api.now = expectedReady(false)
  assert.equal(farm.actions.onboarding(early.d, { op: 'harvest' }, early.t.api).ok, true)

  const rollback = readyLesson(false)
  rollback.t.api.now = T0 - 10_000
  assert.equal(farm.view(rollback.d, rollback.t.api).onboarding.remainingMs, LESSON.ripeMs, '回拨时最多显示整段等待，不显示负数或超长')
  assert.equal(farm.actions.onboarding(rollback.d, { op: 'harvest' }, rollback.t.api).reason, 'not-ripe')
  rollback.t.api.now = expectedReady(false)
  assert.equal(farm.actions.onboarding(rollback.d, { op: 'harvest' }, rollback.t.api).ok, true)
})

test('客户端只能传 op：时间戳、地块、奖励字段一律不采信，未知 op 拒绝', () => {
  const { d, t } = fresh()
  const plots = structuredClone(d.plots)
  const tampered = { op: 'plant', plantedAt: 1, wateredAt: 2, readyAt: 3, plot: 7, rewarded: true, reward: 999 }
  assert.equal(farm.actions.onboarding(d, tampered, t.api).ok, true)
  assert.equal(d.onboarding.plantedAt, T0)
  assert.equal(d.onboarding.wateredAt, null)
  assert.equal(d.onboarding.rewarded, false)
  assert.deepEqual(d.plots, plots, '地块是普通农场的事')
  t.api.now = T0 + 1000
  assert.equal(farm.actions.onboarding(d, { op: 'harvest', readyAt: 0, plantedAt: 0 }, t.api).reason, 'not-ripe')
  assert.equal(farm.actions.onboarding(d, { op: 'water', wateredAt: 0 }, t.api).ok, true)
  assert.equal(d.onboarding.wateredAt, T0 + 1000)
  assert.equal(farm.actions.onboarding(d, { op: 'reward' }, t.api).reason, 'unavailable')
})

test('课内种子不能卖/换/补普通库存，也不能当普通种子种；收获发的是普通种子', () => {
  const { d, t } = plantLesson()
  assert.equal(farm.actions.sell(d, { item: 'scallion' }, t.api).reason, 'unavailable')
  assert.equal(farm.actions.sell(d, { item: '*' }, t.api).reason, 'unavailable')
  assert.equal(farm.actions.store(d, { item: 'scallion' }, t.api).reason, 'unavailable')
  d.plots[0] = null
  assert.equal(farm.actions.plant(d, { plot: 0, item: 'scallion' }, t.api).reason, 'no-seed', '课内种子不顶普通种子')
  assert.equal(d.seeds.scallion, undefined)
  t.api.now = expectedReady(false)
  assert.equal(farm.actions.onboarding(d, { op: 'harvest' }, t.api).ok, true)
  assert.equal(farm.actions.plant(d, { plot: 0, item: 'scallion' }, t.api).ok, true, '发的普通种子可以正常种')
  assert.equal(d.seeds.scallion, 0)
  const stocked = readyLesson(false)
  stocked.d.seeds.scallion = 5
  assert.equal(farm.actions.onboarding(stocked.d, { op: 'harvest' }, stocked.t.api).ok, true)
  assert.equal(stocked.d.seeds.scallion, 6, '普通种子库存恰好 +1，不多发')
})

test('老玩家（有经验/种子/仓库/工具/肥料/地块/帮工/退款）标记 skipped+rewarded，不发也不扣', () => {
  const rich = v4({
    unlocked: 8, exp: 350, seeds: { radish: 2, scallion: 3 }, harvest: { radish: 4 }, acquired: { radish: 9 }, harvests: { radish: 4 },
    tools: { sickle: true }, fert: { 'fert-1': 2 }, helper: { hired: false, level: 0, barn: 0, stock: { radish: 5 }, targets: ['radish'] },
    plots: [null, { crop: 'radish', season: 1, plantedAt: T0 - 14 * H, boostMs: 0, roll: 0, pests: { weed: 1e15, bug: 1e15, dry: 1e15 } }],
  })
  const t = fakeApi(99)
  t.api.now = T0
  const kept = { seeds: structuredClone(rich.seeds), harvest: structuredClone(rich.harvest), acquired: structuredClone(rich.acquired), harvests: structuredClone(rich.harvests), tools: structuredClone(rich.tools), fert: structuredClone(rich.fert), exp: rich.exp, unlocked: rich.unlocked, plots: structuredClone(rich.plots) }
  const view = farm.view(rich, t.api)
  assert.deepEqual([view.onboarding.step, view.onboarding.legacy, view.onboarding.rewarded], ['done', true, true])
  assert.equal(t.balance(), 99, '只看一眼不发钱')
  assert.equal(rich.version, 4, 'view 只读，迁移标记等第一次成功动作再落盘')
  const migrated = normalize(structuredClone(rich))
  assert.equal(migrated.version, 5, '迁移升级到 v5')
  const result = farm.actions.onboarding(migrated, { op: 'harvest' }, t.api)
  assert.equal(result.reason, 'already')
  assert.equal(t.balance(), 99, '不发钱')
  assert.deepEqual(migrated.seeds, kept.seeds, '不发种子')
  assert.deepEqual(migrated.harvest, kept.harvest)
  assert.deepEqual(migrated.acquired, kept.acquired)
  assert.deepEqual(migrated.harvests, kept.harvests)
  assert.deepEqual(migrated.tools, kept.tools)
  assert.deepEqual(migrated.fert, kept.fert)
  assert.equal(migrated.exp, kept.exp)
  assert.equal(migrated.unlocked, kept.unlocked)
  assert.deepEqual(migrated.plots, kept.plots.concat(Array(16).fill(null)), '不改普通地块')
  assert.equal(migrated.helper.stock.radish, 5, '帮工仓库保留')
  assert.equal(migrated.helper.targets[0], 'radish', '帮工目标保留')
  assert.equal(t.tired(), 0)
  assert.deepEqual(t.ledger, [])
})

test('老存档每样真实进度都算：经验、开垦、种子、仓库、图鉴、收获次数、工具、肥料、地块、帮工、退款', () => {
  const crop = { crop: 'radish', season: 1, plantedAt: T0, boostMs: 0, roll: 0, pests: { weed: 1e15, bug: 1e15, dry: 1e15 } }
  const cases = [
    ['经验', { exp: 1 }], ['开垦', { unlocked: 7 }], ['种子', { seeds: { scallion: 1 } }], ['仓库', { harvest: { radish: 1 } }],
    ['图鉴', { acquired: { radish: 1 } }], ['收获次数', { harvests: { radish: 1 } }], ['工具', { tools: { sickle: true } }],
    ['肥料', { fert: { 'fert-1': 1 } }], ['地块', { plots: [crop] }],
    ['帮工受雇', { helper: { hired: true, level: 0, barn: 0, stock: {}, lastAt: T0, usedMs: 0, targets: [] } }],
    ['帮工仓库', { helper: { hired: false, level: 0, barn: 0, stock: { radish: 1 } } }],
    ['帮工目标', { helper: { hired: false, level: 0, barn: 0, stock: {}, targets: ['radish'] } }],
    ['待退菜币', { refund: 1 }], ['农具已退', { helperBarnRefunded: true }],
  ]
  for (const [label, over] of cases) {
    const data = normalize(structuredClone(v4(over)))
    assert.deepEqual([data.onboarding.step, data.onboarding.legacy, data.onboarding.rewarded], ['done', true, true], label)
  }
  const funded = farm.view(v4(), fakeApi(99).api)
  assert.deepEqual([funded.onboarding.step, funded.onboarding.legacy], ['offer', false], '只换过菜币、没玩过菜园仍可进第一课')
  const untouched = normalize(structuredClone(v4()))
  assert.deepEqual([untouched.onboarding.step, untouched.onboarding.legacy, untouched.onboarding.rewarded], ['offer', false, false], '装过但完全没进度可以进第一课')
  const again = normalize(untouched)
  assert.deepEqual([again.onboarding.step, again.onboarding.legacy], ['offer', false], '没进第一课前重复归一化仍是 offer')
})

test('坏第一课字段不让白拿：done 强制 rewarded、planted 缺时间或带 rewarded/legacy 一律按 skipped、奖励字段不改', () => {
  const base = () => ({ ...farm.init() })
  const set = onboarding => { const d = base(); d.onboarding = onboarding; return normalize(d) }
  const done = set({ step: 'done', rewarded: false, legacy: false, plantedAt: null, wateredAt: null })
  assert.deepEqual([done.onboarding.step, done.onboarding.rewarded], ['done', true])
  for (const bad of [
    { step: 'planted', rewarded: false, legacy: false, plantedAt: null, wateredAt: null },
    { step: 'planted', rewarded: true, legacy: false, plantedAt: T0, wateredAt: null },
    { step: 'offer', rewarded: true, legacy: false, plantedAt: null, wateredAt: null },
    { step: 'offer', rewarded: false, legacy: true, plantedAt: null, wateredAt: null },
    { step: 'bogus', rewarded: false, legacy: false, plantedAt: null, wateredAt: null },
  ]) {
    const d = set(bad)
    assert.deepEqual([d.onboarding.step, d.onboarding.legacy, d.onboarding.rewarded], ['done', true, true], JSON.stringify(bad))
  }
  const timed = set({ step: 'planted', rewarded: false, legacy: false, plantedAt: T0, wateredAt: T0 + 60_000 })
  assert.equal(timed.version, 5)
  assert.equal(farm.view(timed, { ...fakeApi().api, now: T0 }).onboarding.readyAt, T0 + LESSON.wateredMs, '浇水时刻不改 2 分钟上限')
})

test('普通农场动作不受第一课影响：种/收/卖照旧，第一课停在 offer；第一课也不占普通进度', () => {
  const { d } = fresh()
  const t = fakeApi(1000)
  t.api.now = T0
  assert.equal(farm.actions.buy(d, { item: 'radish' }, t.api).ok, true)
  d.plots[0] = null
  assert.equal(farm.actions.plant(d, { plot: 0, item: 'radish' }, t.api).ok, true)
  const before = farm.view(d, t.api)
  assert.equal(before.onboarding.step, 'offer')
  assert.equal(before.plots.length, 18)
  t.api.now = T0 + 14 * H
  assert.equal(farm.actions.harvest(d, { plot: 0 }, t.api).ok, true)
  assert.equal(d.exp, 10, '普通收获仍给 10 经验')
  assert.equal(d.harvests.radish, 1)
  const sale = farm.actions.sell(d, { item: 'radish' }, t.api)
  assert.equal(sale.earned, 18)
  assert.equal(farm.view(d, t.api).onboarding.step, 'offer', '第一课没被普通动作消耗')
  assert.equal(t.balance(), 938)
  assert.ok(t.tired() > 0, '普通动作照旧扣饱食')
  assert.equal(d.onboarding.rewarded, false)
  assert.equal(d.seeds.scallion, undefined)
})

test('接在普通进度后进第一课也不会覆盖普通地块，且同样只发一次', () => {
  const { d, t } = fresh()
  d.plots[0] = { crop: 'radish', season: 1, plantedAt: T0, boostMs: 0, roll: 0, pests: { weed: 1e15, bug: 1e15, dry: 1e15 } }
  const plot = structuredClone(d.plots[0])
  assert.equal(farm.actions.onboarding(d, { op: 'plant' }, t.api).ok, true)
  assert.equal(farm.actions.onboarding(d, { op: 'water' }, t.api).ok, true)
  t.api.now = expectedReady(true)
  assert.equal(farm.actions.onboarding(d, { op: 'harvest' }, t.api).ok, true)
  assert.deepEqual(d.plots[0], plot, '普通地块原样保留')
  assert.equal(t.balance(), 12)
  assert.equal(d.harvests.radish, undefined)
})

test('带菜币但零菜园进度的 v4：view 和动作看到同一资格，view 不改输入', () => {
  // root 怀疑 view 不传 api 会与动作的资格不一致；当前资格只看菜园进度、故意不看钱包余额（报告 2.2），
  // 归一化也不读 api。这个回归锁住「只看一眼」和「第一次动作」不会给出两套答案。
  const data = v4()
  const t = fakeApi(99)
  t.api.now = T0
  const before = structuredClone(data)
  const shown = farm.view(data, t.api).onboarding
  assert.deepEqual([shown.step, shown.legacy, shown.rewarded, shown.canPlant], ['offer', false, false, true])
  assert.deepEqual(data, before, 'view 只读，不改传入存档')
  assert.equal(farm.actions.onboarding(data, { op: 'plant' }, t.api).ok, true, '动作与 view 一样允许进入第一课')
  assert.equal(data.onboarding.step, 'planted')
  assert.equal(farm.view(data, t.api).onboarding.step, 'planted')
  assert.equal(t.balance(), 99, '进第一课不动钱包')
})

test('历史农具档即使没有预置退款也算老进度，迁移退款只发一次', () => {
  const data = v4({ helper: { hired: false, level: 0, barn: 2, stock: {} } })
  const t = fakeApi(0)
  t.api.now = T0
  const shown = farm.view(data, t.api).onboarding
  assert.deepEqual([shown.step, shown.legacy, shown.rewarded], ['done', true, true], '历史农具档算真实进度')
  assert.equal(data.version, 4, 'view 只读')
  const migrated = normalize(structuredClone(data))
  const refund = OLD_HELPER_BARN_PRICES[1] + OLD_HELPER_BARN_PRICES[2]
  assert.equal(migrated.helper.barn, 0, '农具档退完清零')
  assert.equal(migrated.helperBarnRefund, refund)
  assert.equal(migrated.refund, refund)
  assert.equal(farm.actions.onboarding(migrated, { op: 'harvest' }, t.api).reason, 'already', '老玩家不补发第一课')
  assert.equal(t.balance(), refund, '迁移欠的退款在第一次动作时付清')
  assert.equal(migrated.refund, 0)
  const again = normalize(structuredClone(migrated))
  assert.deepEqual([again.helperBarnRefund, again.refund], [0, 0], '重读不再退一次')
})

test('4.0 → 5.0 迁移保留全部旧字段；3.x 老存档也走同一条路，不静默清零', () => {
  const four = v4({ exp: 42, seeds: { radish: 2 }, harvest: { radish: 3 }, acquired: { radish: 8 }, harvests: { radish: 3 }, tools: { sickle: true }, fert: { 'fert-2': 1 }, refund: 7, unlocked: 7 })
  const migrated = normalize(four)
  assert.equal(migrated.version, 5)
  assert.deepEqual([migrated.exp, migrated.unlocked, migrated.refund], [42, 7, 7])
  assert.deepEqual(migrated.seeds, { radish: 2 })
  assert.deepEqual(migrated.harvest, { radish: 3 })
  assert.deepEqual(migrated.acquired, { radish: 8 })
  assert.deepEqual(migrated.harvests, { radish: 3 })
  assert.deepEqual(migrated.tools, { sickle: true })
  assert.deepEqual(migrated.fert, { 'fert-2': 1 })
  assert.equal(migrated.onboarding.step, 'done')

  const three = { version: 3, unlocked: 6, plots: [{ crop: 'carrot', stage: 1, plantedAt: T0, wateredAt: null }], seeds: { carrot: 2 }, harvest: { carrot: 1 }, acquired: { carrot: 4 }, tools: { can: true }, fertilizer: 3, helper: { hired: true, level: 0, barn: 0 } }
  const old = normalize(three)
  assert.equal(old.version, 5)
  assert.equal(old.seeds.carrot, 2)
  assert.equal(old.harvest.carrot, 1 + 4, '3.x 地里的胡萝卜按旧产量进仓库')
  assert.equal(old.harvests.carrot, 2, '仓库里 8 个胡萝卜 / 每个 4 个 = 2 次')
  assert.deepEqual(old.tools, { sickle: false, sprayer: true, rake: false, planter: false })
  assert.equal(old.onboarding.step, 'done', '有作物/种子/工具就按老玩家跳过')
  assert.equal(CROPS.length, 29, '作物表不变')
  assert.deepEqual([LESSON.reward, LESSON.seed, LESSON.ripeMs, LESSON.wateredMs], [12, 'scallion', 180_000, 120_000])
})
