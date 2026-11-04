// @ts-check
// 菜园多帮工 Slice 0（v7 数据模型）：workers[] 的迁移/夹取/幂等、覆盖 4×收菜只数、合并规则，
// 以及「全巡逻也要推进 lastAt」。这一刀不加动作、不改商店/UI/动画；旧 level 字段只作迁移映射。
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import farm, { CROPS, HELPER_PLOTS, PLOTS, normalize, setRandom, weatherAt } from '../extensions/farm/server.js'

const H = 3600000

/** 找一个晴天中午当起点，免得雨天浇地打乱断言。 */
function sunnyNoon() {
  for (let day = 0; day < 60; day += 1) {
    const at = new Date(2026, 9, 12 + day, 12).getTime()
    if (weatherAt(at) === 'sunny' && weatherAt(at + 24 * H) === 'sunny') return at
  }
  throw new Error('no sunny day')
}
const T0 = sunnyNoon()

beforeEach(() => setRandom(() => 0.5))

function api() {
  let balance = 100_000
  const said = []
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
    give: () => true,
    say(line) { said.push(line) },
    exert() {},
  }
  return { api: host, balance: () => balance }
}

/** 干净的 v7 熟地存档：18 块空地，第一课已完成，9 级（种子等级不挡路）。 */
function bare(overrides = {}) {
  const data = Object.assign(farm.init(), { plots: Array(PLOTS).fill(null) })
  data.exp = 10000
  data.onboarding = { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null }
  return Object.assign(data, overrides)
}

const worker = (id, role = 'harvest', locked = false, hiredAt = null) => ({ id, role, locked, hiredAt })
const harvestWorkers = count => Array.from({ length: count }, (_, index) => worker(index + 1))

/** 旧 v6 存档：只有 level，没有 workers/schedule。 */
function v6(helper = {}) {
  return {
    version: 6, unlocked: 6, plots: Array(PLOTS).fill(null),
    seeds: {}, harvest: {}, acquired: {}, harvests: {}, tools: {}, fert: {}, exp: 200, refund: 0,
    helper: { hired: true, enabled: true, level: 0, barn: 0, lastAt: T0 - 5 * H, usedMs: 0, cursor: 0, pending: null, targets: Array(PLOTS).fill(null), stock: { radish: 7 }, xpQuarterRemainder: 1, xpEligibleAt: T0 - 6 * H, ...helper },
    onboarding: { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null },
  }
}

test('覆盖 = 4 × 收菜帮工只数，封顶已开垦数；巡逻 0 块；5 只收菜第 5 只只有 2 块', () => {
  const t = api()
  const data = bare({ unlocked: 18 })
  for (const [count, plots] of [[1, 4], [2, 8], [3, 12], [4, 16], [5, 18]]) {
    data.helper.hired = true
    data.helper.enabled = true
    data.helper.workers = harvestWorkers(count)
    assert.equal(farm.view(data, t.api).helper.plots, plots, count + ' 只收菜管 ' + plots + ' 块')
  }

  data.helper.workers = [worker(1, 'harvest'), worker(2, 'patrol'), worker(3, 'patrol')]
  const mixed = farm.view(data, t.api).helper
  assert.equal(mixed.plots, 4, '只有收菜型占地')
  assert.equal(mixed.count, 3)
  assert.equal(mixed.max, 5)
  assert.equal(mixed.workers[1].plotCount, 0, '巡逻不占地')
  assert.equal(mixed.workers[1].status, 'patrol')

  data.helper.workers = [worker(1, 'patrol'), worker(2, 'patrol')]
  const allPatrol = farm.view(data, t.api).helper
  assert.equal(allPatrol.plots, 0, '全巡逻一块地也不管')
  assert.equal(allPatrol.hired, true)
})

test('v6 → v7：level 0/1/2 补 1/2/4 只收菜帮工，覆盖仍是 4/8/16，迁移不结算、不补 XP', () => {
  for (const [level, count, plots] of [[0, 1, 4], [1, 2, 8], [2, 4, 16]]) {
    const migrated = normalize(v6({ level }), T0)
    assert.equal(migrated.version, 7)
    assert.equal(migrated.helper.workers.length, count, 'level ' + level + ' → ' + count + ' 只')
    assert.deepEqual(migrated.helper.workers.map(entry => entry.role), Array(count).fill('harvest'))
    assert.deepEqual(migrated.helper.workers.map(entry => entry.id), Array.from({ length: count }, (_, index) => index + 1))
    assert.equal(migrated.helper.hired, true)
    assert.equal(migrated.helper.schedule, 'auto', '旧档默认自动排班')
    assert.equal(migrated.helper.level, level, '旧 level 保留只读')
    assert.equal(migrated.helper.stock.radish, 7, '帮工仓原样保留')
    assert.equal(migrated.helper.lastAt, T0 - 5 * H, '迁移不推进检查点、不结算')
    assert.equal(migrated.helper.xpQuarterRemainder, 1)
    assert.equal(migrated.exp, 200, '迁移不补经验')
    assert.deepEqual(normalize(structuredClone(migrated), T0), migrated, 'v7 normalize 幂等')
  }

  const idle = normalize(v6({ hired: false }), T0)
  assert.deepEqual(idle.helper.workers, [], '没雇就没有帮工')
  assert.equal(idle.helper.hired, false)
})

test('坏 workers 安全夹取：截断 5、重编号、非法 role 归收菜、非对象丢弃；缺 workers 的 v7 档防御式补回', () => {
  const bad = normalize(v6({
    workers: [
      { id: 9, role: 'patrol', locked: true, hiredAt: T0 },
      { id: 9, role: 'bogus', locked: 'yes', hiredAt: 'x' },
      null, 'nope',
      { id: 1, role: 'harvest', locked: false, hiredAt: T0 + 1 },
      { id: 2, role: 'harvest', locked: false, hiredAt: T0 + 2 },
      { id: 3, role: 'harvest', locked: false, hiredAt: T0 + 3 },
    ],
  }), T0)
  assert.equal(bad.helper.workers.length, 5, '最多 5 只')
  assert.deepEqual(bad.helper.workers.map(entry => entry.id), [1, 2, 3, 4, 5], '连续重编号')
  assert.equal(bad.helper.workers[0].role, 'patrol')
  assert.equal(bad.helper.workers[0].locked, true)
  assert.equal(bad.helper.workers[0].hiredAt, T0)
  assert.equal(bad.helper.workers[1].role, 'harvest', '认不出的 role 归收菜')
  assert.equal(bad.helper.workers[1].locked, false, 'locked 只认严格的 true')
  assert.equal(bad.helper.workers[1].hiredAt, null, '坏时间不编')
  assert.ok(bad.helper.workers.every(entry => entry.role === 'harvest' || entry.role === 'patrol'))

  // 被 4.2.x 旧 normalize 丢过 workers 的 v7 档：hired 还在，就按 level 补回来，不会永久变成没帮工。
  const repaired = normalize({
    version: 7, unlocked: 6, plots: Array(PLOTS).fill(null), seeds: {}, harvest: {}, acquired: {}, harvests: {},
    tools: {}, fert: {}, exp: 0, refund: 0,
    helper: { hired: true, enabled: true, level: 2, barn: 0, lastAt: null, cursor: 0, pending: null, targets: Array(PLOTS).fill(null), stock: {} },
    onboarding: { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null },
  }, T0)
  assert.equal(repaired.version, 7)
  assert.equal(repaired.helper.workers.length, 4, 'level 2 的旧档补回 4 只')
  assert.equal(repaired.helper.hired, true)

  const noHired = normalize({
    version: 7, unlocked: 6, plots: Array(PLOTS).fill(null), seeds: {}, harvest: {}, acquired: {}, harvests: {},
    tools: {}, fert: {}, exp: 0, refund: 0,
    helper: { hired: false, enabled: true, level: 1, barn: 0, lastAt: null, cursor: 0, pending: null, targets: Array(PLOTS).fill(null), stock: {} },
    onboarding: { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null },
  }, T0)
  assert.deepEqual(noHired.helper.workers, [], '没雇过就不凭空补帮工')
  assert.equal(noHired.helper.enabled, false, '没雇就不可能是启用状态')
})

test('merge：workers 数量取 max（≤5）、role/hiredAt 取 context、locked OR、stock 相加、schedule/level 取 context/max', () => {
  const now = T0
  const target = bare({ unlocked: 12 })
  Object.assign(target.helper, {
    hired: true, enabled: true, level: 0, lastAt: now - H, schedule: 'manual', stock: { radish: 2 },
    workers: [worker(1, 'harvest', false, now - 3 * H), worker(2, 'patrol', true, now - 2 * H)],
  })
  const source = normalize(v6({ level: 2, lastAt: now - 3 * H, stock: { radish: 5 } }), now)
  assert.equal(source.helper.workers.length, 4)

  const merged = farm.mergeStates(target, source, now).data
  assert.equal(merged.version, 7)
  assert.equal(merged.helper.workers.length, 4, '取两边较多的 4 只，不按设备相加')
  assert.equal(merged.helper.hired, true)
  assert.equal(merged.helper.schedule, 'manual', '排班跟 context')
  assert.equal(merged.helper.level, 2, 'level 取 max（遗留字段）')
  assert.equal(merged.helper.stock.radish, 7, '帮工仓相加')
  assert.equal(merged.helper.lastAt, now - H, '检查点跟 context')
  assert.equal(merged.helper.workers[0].role, 'harvest')
  assert.equal(merged.helper.workers[1].role, 'patrol', 'role 取 context 的 id 2')
  assert.equal(merged.helper.workers[1].locked, true, 'locked 两边同 id 任一为 true')
  assert.equal(merged.helper.workers[1].hiredAt, now - 2 * H, 'hiredAt 跟 context')
  assert.equal(merged.helper.workers[2].role, 'harvest', 'context 缺的 id 从另一边补')
  assert.equal(merged.helper.workers[2].hiredAt, null)

  // 反方向：source 结算更晚 → role 跟 source（全收菜），数量仍取 max。
  const later = normalize(v6({ level: 1, lastAt: now + H, stock: {} }), now)
  assert.equal(later.helper.workers.length, 2)
  const reversed = farm.mergeStates(target, later, now).data
  assert.equal(reversed.helper.workers.length, 2)
  assert.equal(reversed.helper.workers[1].role, 'harvest', 'context 换成 source（source 的 id 2 是收菜）')
  assert.equal(reversed.helper.workers[1].locked, true, 'locked 仍取 OR')
  assert.equal(reversed.helper.workers[1].hiredAt, null, 'hiredAt 跟 context（source 没有雇佣时间）')

  // 5 只封顶：两边都有 5 只也只合出 5 只。
  const five = bare()
  Object.assign(five.helper, { hired: true, enabled: true, level: 0, lastAt: now - 2 * H, stock: {}, workers: harvestWorkers(5) })
  const capped = farm.mergeStates(five, normalize(v6({ level: 2, lastAt: now - H }), now), now).data
  assert.equal(capped.helper.workers.length, 5, '最多 5 只')
  assert.equal(capped.helper.workers.every(entry => entry.role === 'harvest'), true)
})

test('全巡逻：结算把 lastAt 推到 now、不收货；改回收菜只从当下收一轮，不追溯补种', () => {
  const t = api()
  const data = bare()
  data.exp = 10000
  data.seeds.radish = 10
  const crop = CROPS.find(entry => entry.key === 'radish')
  farm.actions.hire(data, {}, t.api)
  assert.equal(farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api).ok, true)
  const hiredAt = data.helper.lastAt

  data.helper.workers = [worker(1, 'patrol'), worker(2, 'patrol')]
  t.api.now = T0 + 14 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.helper.stock.radish, 0, '全巡逻不收货')
  assert.equal(data.harvests.radish ?? 0, 0)
  assert.equal(data.plots[0].plantedAt, T0, '地块原封不动')
  assert.equal(data.helper.lastAt, T0 + 14 * H, '全巡逻也把检查点推到 now')
  assert.notEqual(data.helper.lastAt, hiredAt)

  // 再巡逻 10 小时：检查点继续推进。
  t.api.now = T0 + 24 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.helper.lastAt, T0 + 24 * H)
  assert.equal(data.harvests.radish ?? 0, 0)

  // 改回收菜（Slice 1 的动作；这里直接改数据模拟）：只从当下收一轮、补种也在当下，不按 24 小时补做多轮。
  data.helper.workers = harvestWorkers(1)
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 1, '成熟的旧作物只收一次')
  assert.equal(data.plots[0].crop, 'radish')
  assert.equal(data.plots[0].plantedAt, T0 + 24 * H, '补种从当下起算，不倒填巡逻期间')
  assert.equal(data.seeds.radish, 10 - 1 - 1, '只补一颗种子')
  assert.equal(data.helper.lastAt, T0 + 24 * H)
  assert.equal(data.harvests.radish, 1, '同一时刻再结算不重复收')

  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 1)
  // 作物按真实成熟时间生长：14 小时后再收一季。
  t.api.now = T0 + 38 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 2)
  assert.equal(data.plots[0].plantedAt, T0 + 38 * H)
  assert.equal(data.plots[0].crop, 'radish')
  assert.equal(crop.hours * H, 14 * H)
})

test('旧「管地数」升级在 v7 不再有效果：拒绝且不扣钱，商店条目本刀不动', () => {
  const t = api()
  const data = bare()
  farm.actions.hire(data, {}, t.api)
  const afterHire = t.balance()
  assert.equal(farm.actions.buy(data, { item: 'helper-level' }, t.api).reason, 'unavailable', '不再卖空升级')
  assert.equal(t.balance(), afterHire, '拒绝时不扣钱')
  assert.equal(data.helper.level, 0, 'level 不涨')
  const keys = farm.view(data, t.api).shelf.items.map(item => item.key)
  assert.ok(keys.includes('helper-level'), 'Slice 0 不改商店条目（Slice 1 再换）')
})

test('旧 level 只是遗留字段：改 level 不再改变覆盖（Slice 0 的覆盖只看 workers）', () => {
  const t = api()
  const data = bare({ unlocked: 18 })
  data.helper.hired = true
  data.helper.enabled = true
  data.helper.workers = harvestWorkers(1)
  data.helper.level = 2
  assert.equal(farm.view(data, t.api).helper.plots, 4, 'level 2 也不会变成 16 块')
  data.helper.workers = harvestWorkers(4)
  data.helper.level = 0
  assert.equal(farm.view(data, t.api).helper.plots, 16, '覆盖只由收菜只数决定')
  assert.equal(HELPER_PLOTS[2], 16, '旧常量保留给老面板/老测试')
})
