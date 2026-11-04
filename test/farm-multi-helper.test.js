// @ts-check
// 菜园多帮工 Slice 0（v7 数据模型）：workers[] 的迁移/夹取/幂等、覆盖 4×收菜只数、合并规则，
// 以及「全巡逻也要推进 lastAt」。这一刀不加动作、不改商店/UI/动画；旧 level 字段只作迁移映射。
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import farm, { setTheft,  CROPS, HELPER_MAX, HELPER_PLOTS, HELPER_PLOTS_PER_WORKER, HELPER_PRICES, PLOTS, normalize, setHelperEnergy, setRandom, weatherAt } from '../extensions/farm/server.js'

setTheft(false) // 旧用例默认关闭偷窃；巡逻/偷窃规则与 UI 在新文件里单独开

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

beforeEach(() => { setHelperEnergy(false); setRandom(() => 0.5) })

function api(balance = 100_000) {
  let funds = balance
  const said = []
  const host = {
    now: T0,
    coins: () => 0,
    spend() { throw new Error('farm must not touch gold') },
    earn() { throw new Error('farm must not touch gold') },
    wallet: {
      currency: { label: '菜币', emoji: '🥬', rate: 1 },
      balance: () => funds,
      earn(n) { funds += n; return n },
      spend(n) { if (funds < n) return false; funds -= n; return true },
    },
    give: () => true,
    say(line) { said.push(line) },
    exert() {},
  }
  return { api: host, balance: () => funds }
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
    assert.equal(migrated.version, 9)
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
  assert.equal(repaired.version, 9)
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
  assert.equal(merged.version, 9)
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

test('旧「管地数」升级在 v7 不再出售：拒绝且不扣钱，商店改卖追加雇佣', () => {
  const t = api()
  const data = bare()
  farm.actions.hire(data, {}, t.api)
  const afterHire = t.balance()
  assert.equal(farm.actions.buy(data, { item: 'helper-level' }, t.api).reason, 'unavailable', '不再卖空升级')
  assert.equal(farm.actions.upgrade(data, { kind: 'level' }, t.api).reason, 'unavailable', '旧 upgrade 别名也拒绝')
  assert.equal(t.balance(), afterHire, '拒绝时不扣钱')
  assert.equal(data.helper.level, 0, 'level 不涨')
  assert.equal(data.helper.workers.length, 1, '拒绝时不加帮工')
  const keys = farm.view(data, t.api).shelf.items.map(item => item.key)
  assert.ok(keys.includes('helper-additional'), '已雇后卖追加雇佣')
  assert.ok(!keys.includes('helper-level'), '不再产出 helper-level：' + keys.join(','))
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

// ---- Slice 1：追加雇佣 / 角色 / 排班 ----

const helperItems = (view, prefix = 'helper-') => view.shelf.items.filter(item => item.key.startsWith(prefix))

test('雇佣：首雇 1500 只给 1 只；追加 1500/只到 5 只；再雇 limit；穷 poor；未首雇追加 locked', () => {
  const t = api()
  const data = bare()
  const before = t.balance()
  assert.equal(farm.actions.hire(data, {}, t.api).ok, true)
  assert.equal(t.balance(), before - 1500, '首雇 1500')
  assert.equal(data.helper.workers.length, 1)
  assert.deepEqual(data.helper.workers[0], { id: 1, role: 'harvest', locked: false, hiredAt: T0, shiftAt: T0, resting: false, idle: false })
  assert.equal(data.helper.hired, true)
  assert.equal(data.helper.enabled, true)
  assert.equal(data.helper.lastAt, T0, '首雇从当下开始托管')
  assert.equal(data.helper.level, 0, 'level 只是遗留字段，不因雇佣变化')
  assert.deepEqual(farm.actions.hire(data, {}, t.api), { ok: false, reason: 'owned' }, '已雇再首雇')
  assert.equal(t.balance(), before - 1500, 'owned 不扣钱')

  for (let n = 1; n < HELPER_MAX; n += 1) {
    assert.equal(farm.actions.hireAdditional(data, {}, t.api).ok, true, '追加第 ' + (n + 1) + ' 只')
    assert.equal(data.helper.workers.length, n + 1)
  }
  assert.equal(t.balance(), before - 5 * 1500, '5 只一共 7500')
  assert.deepEqual(data.helper.workers.map(entry => entry.id), [1, 2, 3, 4, 5], 'id 连续')
  assert.deepEqual(farm.actions.hireAdditional(data, {}, t.api), { ok: false, reason: 'limit' })
  assert.equal(data.helper.workers.length, 5, '第 6 只不落数据')
  assert.equal(t.balance(), before - 5 * 1500, 'limit 不扣钱')

  const poorHire = api(1499)
  const broke = bare()
  assert.deepEqual(farm.actions.hire(broke, {}, poorHire.api), { ok: false, reason: 'poor' })
  assert.equal(broke.helper.hired, false)
  assert.deepEqual(broke.helper.workers, [])
  assert.equal(poorHire.balance(), 1499, 'poor 不扣钱')

  const poorAdditional = api(2000)
  const second = bare()
  assert.equal(farm.actions.hire(second, {}, poorAdditional.api).ok, true)
  assert.deepEqual(farm.actions.hireAdditional(second, {}, poorAdditional.api), { ok: false, reason: 'poor' })
  assert.equal(second.helper.workers.length, 1)
  assert.equal(poorAdditional.balance(), 500, 'poor 不扣钱')

  const locked = api()
  const fresh = bare()
  assert.deepEqual(farm.actions.hireAdditional(fresh, {}, locked.api), { ok: false, reason: 'locked' })
  assert.equal(fresh.helper.hired, false)
  assert.equal(locked.balance(), 100_000, 'locked 不扣钱')
})

test('商店：未雇卖 helper-hire 1500；已雇卖 helper-additional 1500；满 5 只不产出；旧档位消失', () => {
  const t = api()
  const data = bare()
  let items = helperItems(farm.view(data, t.api))
  assert.deepEqual(items.map(item => item.key), ['helper-hire'])
  assert.equal(items[0].price, 1500)
  assert.equal(items[0].label, '雇帮工猪')
  assert.equal(items[0].note, '管 ' + HELPER_PLOTS_PER_WORKER + ' 块地')
  assert.equal(items[0].disabled, false)
  assert.equal(helperItems(farm.view(data, api(100).api))[0].disabled, true, '钱不够置灰')

  assert.equal(farm.actions.buy(data, { item: 'helper-hire' }, t.api).ok, true, '购买弹窗直接下单')
  items = helperItems(farm.view(data, t.api))
  assert.deepEqual(items.map(item => item.key), ['helper-additional'])
  assert.equal(items[0].price, 1500)
  assert.equal(items[0].note, '收菜 ' + HELPER_PLOTS_PER_WORKER + ' 块地 / 可改巡逻')
  assert.equal(farm.actions.buy(data, { item: 'helper-additional' }, t.api).ok, true, 'helper-additional 也能直接下单')

  for (let n = 2; n < HELPER_MAX; n += 1) farm.actions.hireAdditional(data, {}, t.api)
  assert.equal(data.helper.workers.length, HELPER_MAX)
  assert.deepEqual(helperItems(farm.view(data, t.api)), [], '满 5 只不产出帮工条目')
  const all = farm.view(data, t.api).shelf.items.map(item => item.key)
  assert.ok(!all.includes('helper-level'), 'helper-level 不再产出：' + all.join(','))
  assert.equal(farm.view(data, t.api).helper.canHire, false)
})

test('角色：改巡逻并锁定、覆盖缩回；非法 id/role unavailable；同角色 already；改回收菜恢复覆盖', () => {
  const t = api()
  const data = bare({ unlocked: 18 })
  farm.actions.hire(data, {}, t.api)
  farm.actions.hireAdditional(data, {}, t.api)
  assert.equal(farm.view(data, t.api).helper.plots, 8)

  assert.equal(farm.actions.setHelperRole(data, { id: 2, role: 'barn' }, t.api).reason, 'unavailable', '非法 role')
  assert.equal(farm.actions.setHelperRole(data, { id: 9, role: 'patrol' }, t.api).reason, 'unavailable', '非法 id')
  assert.equal(farm.actions.setHelperRole(data, { id: 1.5, role: 'patrol' }, t.api).reason, 'unavailable', '非整数 id')
  assert.equal(data.helper.workers[1].role, 'harvest', '失败不改数据')

  assert.equal(farm.actions.setHelperRole(data, { id: 2, role: 'patrol' }, t.api).ok, true)
  assert.equal(data.helper.workers[1].role, 'patrol')
  assert.equal(data.helper.workers[1].locked, true, '手动改角色即锁定')
  const view = farm.view(data, t.api).helper
  assert.equal(view.plots, 4, '巡逻不占地，覆盖缩回 4 块')
  assert.deepEqual(view.workers.map(worker => [worker.id, worker.role, worker.locked, worker.plotCount]), [[1, 'harvest', false, 4], [2, 'patrol', true, 0]])

  assert.equal(farm.actions.setHelperRole(data, { id: 2, role: 'patrol' }, t.api).reason, 'already')
  assert.equal(farm.actions.setHelperRole(data, { id: 2, role: 'harvest' }, t.api).ok, true)
  assert.equal(data.helper.workers[1].locked, true, '改回收菜仍然锁着')
  assert.equal(farm.view(data, t.api).helper.plots, 8, '覆盖恢复 8 块')
  assert.deepEqual(normalize(structuredClone(data), T0).helper.workers, data.helper.workers, '角色和锁定落盘、normalize 幂等')

  const fresh = bare()
  assert.equal(farm.actions.setHelperRole(fresh, { id: 1, role: 'patrol' }, t.api).reason, 'unavailable', '没雇就没有可改的 id')
})

test('排班：auto/manual 切换；同值 already；非法 unavailable；auto 不清 locked；按排班决定新雇默认角色', () => {
  const t = api()
  const data = bare({ unlocked: 6 })
  assert.equal(data.helper.schedule, 'auto')
  assert.equal(farm.actions.setHelperSchedule(data, { mode: 'auto' }, t.api).reason, 'already')
  assert.equal(farm.actions.setHelperSchedule(data, { mode: 'night' }, t.api).reason, 'unavailable')
  assert.equal(farm.actions.setHelperSchedule(data, { mode: 'manual' }, t.api).ok, true)
  assert.equal(farm.view(data, t.api).helper.schedule, 'manual')

  // 手动排班：地已经铺满也继续雇收菜。
  farm.actions.hire(data, {}, t.api)
  farm.actions.hireAdditional(data, {}, t.api)
  farm.actions.hireAdditional(data, {}, t.api)
  assert.deepEqual(data.helper.workers.map(worker => worker.role), ['harvest', 'harvest', 'harvest'], 'manual 一律默认收菜')

  // auto 只影响以后雇佣，不清已经锁定的角色。
  farm.actions.setHelperRole(data, { id: 2, role: 'patrol' }, t.api)
  assert.equal(farm.actions.setHelperSchedule(data, { mode: 'auto' }, t.api).ok, true)
  assert.equal(data.helper.workers[1].role, 'patrol', 'auto 不改已有角色')
  assert.equal(data.helper.workers[1].locked, true, 'auto 不清 locked')
  assert.equal(farm.actions.setHelperSchedule(data, { mode: 'auto' }, t.api).reason, 'already')

  // auto + 地已铺满：新雇默认巡逻；铺满前仍然收菜。
  const auto = bare({ unlocked: 6 })
  farm.actions.hire(auto, {}, t.api)
  farm.actions.hireAdditional(auto, {}, t.api)
  assert.deepEqual(auto.helper.workers.map(worker => worker.role), ['harvest', 'harvest'])
  assert.equal(farm.view(auto, t.api).helper.plots, 6, '两只收菜正好铺满 6 块')
  farm.actions.hireAdditional(auto, {}, t.api)
  assert.deepEqual(auto.helper.workers.map(worker => worker.role), ['harvest', 'harvest', 'patrol'], '自动排班：地满了新雇去巡逻')
  assert.equal(farm.view(auto, t.api).helper.plots, 6, '巡逻不扩覆盖')
})

test('2 只收菜管 8 块：同刻成熟各收一次、各补一颗种子，XP 正好 75%', () => {
  const t = api()
  const data = bare({ unlocked: 18 })
  data.seeds.radish = 30
  data.helper.schedule = 'manual' // 两只都收菜
  farm.actions.hire(data, {}, t.api)
  farm.actions.hireAdditional(data, {}, t.api)
  for (let index = 0; index < 8; index += 1) assert.equal(farm.actions.plant(data, { plot: index, item: 'radish' }, t.api).ok, true)
  assert.equal(data.seeds.radish, 22, '先种 8 颗')
  const exp = data.exp

  t.api.now = T0 + 14 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 8, '8 块同时熟：一块都不漏')
  assert.equal(data.helper.stock.radish, 8 * 24, '每块按自己的 roll 进帮工仓')
  assert.equal(data.seeds.radish, 14, '收 8 块补 8 颗')
  assert.equal(data.exp - exp, 60, '8 × 10 × 75% = 60')
  assert.equal(data.helper.xpQuarterRemainder, 0)
  assert.ok(data.plots.slice(0, 8).every(plot => plot?.crop === 'radish'), '8 块都补种')
  assert.equal(data.plots[8], null, '第 9 块不归帮工管')
})

test('1 巡逻 + 1 收菜：只动前 4 块，后 4 块照常长、不会被收走', () => {
  const t = api()
  const data = bare({ unlocked: 8 })
  data.seeds.radish = 20
  data.helper.schedule = 'manual'
  farm.actions.hire(data, {}, t.api)
  farm.actions.hireAdditional(data, {}, t.api)
  assert.equal(farm.actions.setHelperRole(data, { id: 2, role: 'patrol' }, t.api).ok, true)
  for (let index = 0; index < 8; index += 1) farm.actions.plant(data, { plot: index, item: 'radish' }, t.api)

  t.api.now = T0 + 14 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 4, '只有收菜帮工那 4 块')
  assert.equal(data.helper.stock.radish, 4 * 24)
  assert.deepEqual(data.plots.slice(0, 4).map(plot => plot.plantedAt), Array(4).fill(T0 + 14 * H), '收菜区从收获时刻补种')
  for (const plot of data.plots.slice(4, 8)) {
    assert.equal(plot.crop, 'radish')
    assert.equal(plot.plantedAt, T0, '巡逻区原封不动')
  }
  const view = farm.view(data, t.api)
  assert.equal(view.helper.plots, 4)
  assert.equal(view.plots.slice(4, 8).filter(plot => plot.ripe).length, 4, '巡逻区继续自然成熟')
})

test('harvest → patrol → harvest 跨 24 小时：全巡逻不追溯收获/补种，改回来只从当下收一轮', () => {
  const t = api()
  const data = bare()
  data.seeds.radish = 10
  farm.actions.hire(data, {}, t.api)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  assert.equal(data.seeds.radish, 9)
  assert.equal(farm.actions.setHelperRole(data, { id: 1, role: 'patrol' }, t.api).ok, true)

  t.api.now = T0 + 24 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish ?? 0, 0, '巡逻期间不收获')
  assert.equal(data.helper.stock.radish, 0)
  assert.equal(data.plots[0].plantedAt, T0, '巡逻期间地块原封不动')
  assert.equal(data.helper.lastAt, T0 + 24 * H, '全巡逻也推进检查点')

  assert.equal(farm.actions.setHelperRole(data, { id: 1, role: 'harvest' }, t.api).ok, true)
  assert.equal(data.harvests.radish, 1, '改回收菜只从当下收一轮')
  assert.equal(data.plots[0].plantedAt, T0 + 24 * H, '补种从当下起算，不倒填巡逻期间')
  assert.equal(data.seeds.radish, 8, '只补一颗种子')
  assert.equal(data.helper.lastAt, T0 + 24 * H)
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 1, '同一时刻再结算不重复收')
  assert.equal(data.seeds.radish, 8)
})

test('导出：HELPER_MAX / HELPER_PLOTS_PER_WORKER / HELPER_PRICES 与动作 key 是本刀的契约', () => {
  assert.equal(HELPER_MAX, 5)
  assert.equal(HELPER_PLOTS_PER_WORKER, 4)
  assert.deepEqual(HELPER_PRICES, { hire: 1500, additional: 1500, level: [0, 2000, 6000] })
  for (const key of ['hire', 'hireAdditional', 'setHelperRole', 'setHelperSchedule']) assert.equal(typeof farm.actions[key], 'function', key)
})
