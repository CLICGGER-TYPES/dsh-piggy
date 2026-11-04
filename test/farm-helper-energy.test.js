// @ts-check
// 菜园帮工精力 / 休息（v8，2026-11-04 用户拍板 D1–D4/D6）：20% 强制休息、3h/2h 速率、30 分钟错峰、
// 没活睡 / 来活醒、暂停=休息、手动休息、覆盖 = 4 × 在岗收菜只数、v7→v8 迁移与 merge。
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import farm, { setTheft,
  CROPS, HELPER_CYCLE_MS, HELPER_PLOTS_PER_WORKER, HELPER_REST_AT, HELPER_REST_MS, HELPER_WORK_MS,
  HELPER_WORK_WINDOW_MS, PLOTS, helperEnergyAt, helperNextWorkAt, helperWorkingAt, normalize,
  setHelperEnergy, setRandom, weatherAt,
} from '../extensions/farm/server.js'

setTheft(false) // 旧用例默认关闭偷窃；巡逻/偷窃规则与 UI 在新文件里单独开

const H = 3600000
const MIN = 60000

function sunnyNoon() {
  for (let day = 0; day < 60; day += 1) {
    const at = new Date(2026, 9, 12 + day, 12).getTime()
    if (weatherAt(at) === 'sunny' && weatherAt(at + 24 * H) === 'sunny') return at
  }
  throw new Error('no sunny day')
}
const T0 = sunnyNoon()
const crop = key => CROPS.find(entry => entry.key === key)

function api(balance = 100_000) {
  const host = {
    now: T0,
    wallet: {
      currency: { label: '菜币', emoji: '🥬', rate: 1 },
      balance: () => balance,
      earn(n) { balance += n; return n },
      spend(n) { if (balance < n) return false; balance -= n; return true },
    },
    give: () => true,
    say() {},
    exert() {},
  }
  return { api: host, balance: () => balance }
}

/** 干净熟地档：18 块空地、第一课已完成、9 级；worker 自己给，避免雇佣动作把「没活」写成睡觉。 */
function bare(workers, overrides = {}) {
  const data = Object.assign(farm.init(), { plots: Array(PLOTS).fill(null) })
  data.exp = 10000
  data.onboarding = { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null }
  data.helper.hired = true
  data.helper.enabled = true
  data.helper.lastAt = T0
  data.helper.workers = workers
  return Object.assign(data, overrides)
}
const worker = (id, role = 'harvest', shiftAt = T0, extra = {}) => ({ id, role, locked: false, hiredAt: T0, shiftAt, resting: false, idle: false, ...extra })

/** 直接把熟地放进数据：返回时 helper.targets 也认下同种作物，收完能补种。 */
function ripe(data, index, key = 'radish') {
  return planted(data, index, key, T0 - crop(key).hours * H)
}
function planted(data, index, key = 'radish', at = T0) {
  data.plots[index] = { crop: key, season: 1, plantedAt: at, boostMs: 0, roll: 0, pests: { weed: 1e15, bug: 1e15, dry: 1e15 } }
  data.helper.targets[index] = key
  return data
}

beforeEach(() => { setHelperEnergy(true); setRandom(() => 0.5) })

test('精力常数与纯函数：3h 掉到 0、2h 回到 100、20% 换相位、周期 4h', () => {
  assert.equal(HELPER_WORK_MS, 3 * H)
  assert.equal(HELPER_REST_MS, 2 * H)
  assert.equal(HELPER_REST_AT, 0.2)
  assert.equal(HELPER_WORK_WINDOW_MS, 2.4 * H)
  assert.equal(HELPER_CYCLE_MS, 4 * H)
  const entry = worker(1, 'harvest', T0)
  assert.equal(helperEnergyAt(entry, T0), 1)
  assert.equal(helperEnergyAt(entry, T0 + 1.5 * H), 0.5)
  assert.equal(helperEnergyAt(entry, T0 + 2.4 * H), 0.2)
  assert.ok(Math.abs(helperEnergyAt(entry, T0 + 3.2 * H) - 0.6) < 1e-9)
  assert.equal(helperEnergyAt(entry, T0 + 4 * H), 1)
  assert.equal(helperWorkingAt(entry, T0 + 2.4 * H - 1), true, '20% 前一毫秒仍在岗')
  assert.equal(helperWorkingAt(entry, T0 + 2.4 * H), false, '20% 整点开始休息')
  assert.equal(helperNextWorkAt(entry, T0 + 2.4 * H), T0 + 4 * H)
  assert.equal(helperNextWorkAt(entry, T0 + 1 * H), T0 + 1 * H, '在岗时就返回当下')
  const future = { ...entry, shiftAt: T0 + 10 * H }
  const energy = helperEnergyAt(future, T0)
  assert.ok(Number.isFinite(energy) && energy >= 0 && energy <= 1, '未来锚点也不 NaN')
})

test('单只：14h 熟的白萝卜在 14h 工作窗收掉；15h 已进入休息，熟地原地等 16h 复工', () => {
  const t = api()
  const data = planted(bare([worker(1)]), 0)
  data.seeds.radish = 1
  t.api.now = T0 + 15 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 1, '14h 成熟、14h 在岗：不会因为 15h 正好休息而漏收')
  assert.equal(data.plots[0].plantedAt, T0 + 14 * H, '补种从真实收获时刻起算')
  assert.equal(data.helper.stock.radish, 24)

  const v = farm.view(data, t.api).helper
  assert.equal(v.onDuty, 0)
  assert.equal(v.resting, 1)
  assert.equal(v.workers[0].state, 'resting')
  assert.equal(v.workers[0].energy, 0.5)
  assert.equal(v.workers[0].restRemainingMs, 1 * H)
  assert.equal(v.plots, 0, '休息中的收菜不占地')
  assert.ok(Number.isFinite(v.restUntil))
})

test('自动错峰：同角色 5 只按 30 分钟偏移；0–4h 每 5 分钟至少 1 只在岗；新雇不会一进门就睡', () => {
  const t = api()
  const data = bare([], { unlocked: 18 })
  data.seeds.radish = 40
  // 先种 18 块，保证「有活」，避免没活睡觉干扰在岗采样。
  for (let index = 0; index < 18; index += 1) farm.actions.plant(data, { plot: index, item: 'radish' }, t.api)
  farm.actions.hire(data, {}, t.api)
  for (let n = 1; n < 5; n += 1) farm.actions.hireAdditional(data, {}, t.api)
  const offsets = data.helper.workers.map(entry => T0 - entry.shiftAt)
  assert.deepEqual(offsets, [0, 30 * MIN, 60 * MIN, 90 * MIN, 120 * MIN])
  assert.ok(data.helper.workers.every(entry => entry.shiftAt <= T0), '锚点不会在未来（不会带疲劳上岗）')

  for (let minute = 0; minute <= 4 * 60; minute += 5) {
    const at = T0 + minute * MIN
    const view = farm.view(data, { ...t.api, now: at }).helper
    assert.ok(view.onDuty >= 1, '第 ' + minute + ' 分钟至少 1 只在岗')
  }
  const first = farm.view(data, t.api).helper.workers[0]
  assert.equal(first.state, 'working')
  assert.ok(first.energy > HELPER_REST_AT)
})

test('手动休息：单只可提前睡、可恢复；精力 ≤20% 时不能手动绕过强制休息', () => {
  const t = api()
  const data = ripe(bare([worker(1)]), 0)
  data.seeds.radish = 1
  assert.equal(farm.actions.setHelperRest(data, { id: 1, resting: true }, t.api).ok, true)
  assert.equal(data.helper.workers[0].resting, true)
  assert.equal(farm.actions.setHelperRest(data, { id: 1, resting: true }, t.api).reason, 'already')
  assert.equal(farm.view(data, t.api).helper.workers[0].state, 'resting')
  assert.equal(farm.view(data, t.api).helper.plots, 0, '手动休息释放覆盖')

  t.api.now = T0 + 1.6 * H
  const rested = farm.view(data, t.api).helper.workers[0]
  assert.equal(rested.energy, 1, '休息 1.6h 回满')
  assert.equal(farm.actions.setHelperRest(data, { id: 1, resting: false }, t.api).ok, true)
  assert.equal(farm.view(data, t.api).helper.workers[0].state, 'working')

  const tired = ripe(bare([worker(1)]), 0)
  t.api.now = T0
  tired.helper.workers[0].resting = true
  tired.helper.workers[0].shiftAt = T0
  assert.equal(farm.actions.setHelperRest(tired, { id: 1, resting: false }, t.api).reason, 'too-tired')
  assert.equal(tired.helper.workers[0].resting, true, '低于 20% 仍强制休息')

  assert.equal(farm.actions.setHelperRest(data, { id: 9, resting: true }, t.api).reason, 'unavailable')
  assert.equal(farm.actions.setHelperRest(data, { id: 1, resting: 'yes' }, t.api).reason, 'unavailable')
})

test('没活干就睡：空农场睡 2h 精力回满；来活且 ≥20% 立即醒，覆盖回到 4 块', () => {
  const t = api()
  const data = bare([worker(1)], { unlocked: 6 })
  t.api.now = T0 + 2 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.helper.workers[0].idle, true)
  assert.equal(data.helper.workers[0].shiftAt, T0 + 0.4 * H, '睡觉时锚点落在休息段（now − 1.6h），精力按休息速率恢复')
  const sleeping = farm.view(data, t.api).helper
  assert.equal(sleeping.workers[0].state, 'resting')
  assert.equal(sleeping.workers[0].energy, 1)
  assert.equal(sleeping.plots, 0)

  data.seeds.radish = 1
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t.api)
  assert.equal(data.helper.workers[0].idle, false, '来活且精力 ≥20%：醒')
  const awake = farm.view(data, t.api).helper
  assert.equal(awake.workers[0].state, 'working')
  assert.equal(awake.plots, 4)

  // 来活但精力不足 20%：继续睡，不工作。
  const tired = bare([worker(1)], { unlocked: 6 })
  tired.helper.workers[0].shiftAt = T0
  tired.helper.workers[0].idle = true
  t.api.now = T0
  tired.seeds.radish = 1
  farm.actions.plant(tired, { plot: 0, item: 'radish' }, t.api)
  assert.equal(tired.helper.workers[0].idle, true, '精力 0% 不因来活而强行上班')
})

test('全局暂停 = 休息：不收货、精力按时间恢复、lastAt 不动；恢复只从当下收一轮', () => {
  const t = api()
  const data = planted(bare([worker(1, 'harvest', T0 - 1.5 * H)]), 0)
  data.seeds.radish = 1
  assert.ok(farm.view(data, t.api).helper.workers[0].energy < 1, '暂停前不是满精力')
  assert.equal(farm.actions.toggleHelper(data, { enabled: false }, t.api).ok, true)
  const pausedAt = data.helper.lastAt
  assert.equal(farm.view(data, t.api).helper.workers[0].state, 'paused')

  t.api.now = T0 + 1 * H
  const pausedView = farm.view(data, t.api).helper
  assert.equal(pausedView.enabled, false)
  assert.equal(pausedView.workers[0].state, 'paused')
  assert.equal(pausedView.workers[0].energy, 1, '暂停期间按休息速率恢复')
  assert.equal(data.helper.lastAt, pausedAt, '暂停不推进 lastAt')

  // 暂停期间成熟的地不自动收。
  t.api.now = T0 + 14 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish ?? 0, 0, '暂停时不收货')
  assert.equal(farm.actions.toggleHelper(data, { enabled: true }, t.api).ok, true)
  assert.equal(data.harvests.radish, 1, '恢复后只收当前成熟的一轮，不追补暂停期间')
})

test('覆盖：休息释放、在岗接管；总覆盖 = 4 × 在岗收菜只数；复工回到覆盖池', () => {
  const t = api()
  const data = bare([worker(1, 'harvest', T0), worker(2, 'harvest', T0 - H)], { unlocked: 8 })
  for (let index = 0; index < 8; index += 1) planted(data, index)
  data.seeds.radish = 8

  // T0+14h：1 号相位 2h（在岗），2 号相位 3h（休息）→ 在岗 1 只、覆盖 4 块。
  t.api.now = T0 + 14 * H
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(farm.view(data, t.api).helper.plots, 4)
  assert.equal(data.harvests.radish, 4, '只收在岗那 4 块')
  const first = farm.view(data, t.api).helper.workers
  assert.equal(first[0].plotCount, 4)
  assert.equal(first[1].plotCount, 0)
  assert.equal(first[1].state, 'resting')

  // T0+16h：2 号也复工 → 覆盖 8 块，剩下的 4 块被接管。
  t.api.now = T0 + 16 * H
  const after = farm.view(data, t.api).helper
  assert.equal(after.plots, 8)
  assert.equal(after.onDuty, 2)
  farm.actions.buy(data, { item: 'nothing' }, t.api)
  assert.equal(data.harvests.radish, 8, '复工后剩下 4 块也被收掉')
})

test('离线 / 分两段结算等价；回拨不重算、不重复收', () => {
  const setup = () => {
    const t = api()
    const data = ripe(bare([worker(1)]), 0)
    data.seeds.radish = 3
    return { t, data }
  }
  const oneshot = setup()
  oneshot.t.api.now = T0 + 30 * H
  farm.actions.buy(oneshot.data, { item: 'nothing' }, oneshot.t.api)

  const stepwise = setup()
  for (const hour of [14, 18, 22, 26, 30]) {
    stepwise.t.api.now = T0 + hour * H
    farm.actions.buy(stepwise.data, { item: 'nothing' }, stepwise.t.api)
  }
  assert.deepEqual(stepwise.data.helper.stock, oneshot.data.helper.stock)
  assert.deepEqual(stepwise.data.plots, oneshot.data.plots)
  assert.equal(stepwise.data.helper.lastAt, oneshot.data.helper.lastAt)

  const before = structuredClone(oneshot.data)
  oneshot.t.api.now = T0 + 10 * H
  farm.actions.buy(oneshot.data, { item: 'nothing' }, oneshot.t.api)
  assert.deepEqual(oneshot.data.helper.stock, before.helper.stock)
  assert.equal(oneshot.data.helper.lastAt, before.helper.lastAt, '回拨不把检查点挪回过去')
})

test('v7 → v8：只补 shiftAt/resting/idle，不结算、不补 XP；normalize 幂等；旧档默认在岗', () => {
  const raw = {
    version: 7, unlocked: 6, plots: Array(PLOTS).fill(null),
    seeds: {}, harvest: {}, acquired: {}, harvests: {}, tools: {}, fert: {}, exp: 200, refund: 0,
    helper: {
      hired: true, enabled: true, level: 0, barn: 0, lastAt: T0 - 5 * H, usedMs: 0, cursor: 0, pending: null,
      targets: Array(PLOTS).fill(null), stock: { radish: 7 }, xpQuarterRemainder: 1, xpEligibleAt: T0 - 6 * H,
      schedule: 'auto', workers: [{ id: 1, role: 'harvest', locked: false, hiredAt: null }, { id: 2, role: 'patrol', locked: true, hiredAt: T0 }],
    },
    onboarding: { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null },
  }
  const migrated = normalize(structuredClone(raw), T0)
  assert.equal(migrated.version, 9)
  assert.equal(migrated.exp, 200, '迁移不补经验')
  assert.equal(migrated.helper.stock.radish, 7)
  assert.equal(migrated.helper.lastAt, T0 - 5 * H, '迁移不结算、不推进检查点')
  assert.deepEqual(migrated.helper.workers.map(entry => entry.shiftAt), [T0 - 5 * H, T0 - 5 * H], '旧档从 lastAt 补锚点')
  assert.deepEqual(migrated.helper.workers.map(entry => [entry.resting, entry.idle]), [[false, false], [false, false]])
  assert.deepEqual(normalize(structuredClone(migrated), T0), migrated, 'v8 normalize 幂等')
  const bad = normalize({ ...structuredClone(raw), version: 8, helper: { ...raw.helper, workers: [{ id: 1, role: 'harvest', shiftAt: 'x' }] } }, T0)
  assert.equal(bad.helper.workers[0].shiftAt, T0 - 5 * H, '坏 shiftAt 从 lastAt/now 补')
})

test('merge：版本 9，shiftAt/resting 逐 id 取 context，locked OR，v>9 抛错', () => {
  const target = bare([worker(1, 'harvest', T0 - H), worker(2, 'harvest', T0, { resting: true })], { unlocked: 8 })
  target.helper.lastAt = T0 - 2 * H
  const source = bare([worker(1, 'harvest', T0 - 3 * H), worker(2, 'patrol', T0 - 4 * H)], { unlocked: 8 })
  source.helper.lastAt = T0
  target.helper.workers[0].locked = true
  source.helper.workers[1].resting = true

  const merged = farm.mergeStates(target, source, T0).data
  assert.equal(merged.version, 9)
  assert.equal(merged.helper.workers.length, 2)
  assert.deepEqual(merged.helper.workers.map(entry => entry.shiftAt), [T0 - 3 * H, T0 - 4 * H], '锚点跟 context（source 结算更晚）')
  assert.equal(merged.helper.workers[1].resting, true, 'resting 跟 context')
  assert.equal(merged.helper.workers[0].locked, true, 'locked 两边 OR')
  assert.equal(merged.helper.workers[1].role, 'patrol', 'role 跟 context')

  assert.throws(() => farm.mergeStates({ ...target, version: 10 }, source, T0), /比当前扩展新/)
})
