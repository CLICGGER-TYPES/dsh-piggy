// @ts-check
// 菜园 v9 巡逻区 / 偷窃规则（2026-11-04 用户拍板 D1–D12 全 A）：
// 4 块一区、按巡逻序号固定、不接管不叠加；有守 5% 地板、无人守 100%、3% 重损只给无人守；
// 损失写 plot.loss，时间线和帮工收获穿插；v9 迁移 / merge / 72h 离线 / 暂停 / 回拨 / view。
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import farm, {
  CROPS, HELPER_PATROL_ZONE_PLOTS, PLOTS, THEFT_LOOKBACK_MS, normalize, patrolOwnerOfZone,
  patrolZoneCount, patrolZoneOf, patrolZoneRange, patrolZones, plotState, resolveTheft, setRandom, setTheft, settleHelper, nextTheftAt,
  theftView, weatherAt, zoneGuardState, zoneGuardedAt,
} from '../../../extensions/farm/server.js'

const H = 3600000
const DAY = 24 * H

function sunnyNoon() {
  for (let day = 0; day < 60; day += 1) {
    const at = new Date(2026, 9, 12 + day, 12).getTime()
    if (weatherAt(at) === 'sunny' && weatherAt(at + 24 * H) === 'sunny') return at
  }
  throw new Error('no sunny day')
}
const T0 = sunnyNoon()
const crop = key => CROPS.find(entry => entry.key === key)

function api(now = T0, balance = 100_000) {
  return {
    now, coins: () => 0, say() {}, exert() {}, give: () => true,
    wallet: {
      currency: { label: '菜币', emoji: '🥬', rate: 1 },
      balance: () => balance,
      earn(n) { balance += n; return n },
      spend(n) { if (balance < n) return false; balance -= n; return true },
    },
  }
}

/** 熟地档：18 块空地、第一课完成、9 级；workers 自己给；不跑 normalize，偷窃游标单独写。 */
function bare(roles = [], overrides = {}) {
  const data = Object.assign(farm.init(), { plots: Array(PLOTS).fill(null) })
  data.exp = 10000
  data.unlocked = 18
  data.onboarding = { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null }
  data.helper.hired = roles.length > 0
  data.helper.enabled = true
  data.helper.lastAt = T0
  data.helper.workers = roles.map((role, index) => worker(index + 1, role))
  delete data.theft
  return Object.assign(data, overrides)
}
const worker = (id, role = 'harvest', shiftAt = T0, extra = {}) => ({ id, role, locked: false, hiredAt: T0, shiftAt, resting: false, idle: false, ...extra })

function planted(data, index, key = 'radish', at = null) {
  const when = at ?? T0 - crop(key).hours * H
  data.plots[index] = { crop: key, season: 1, plantedAt: when, boostMs: 0, roll: 0, pests: { weed: 1e15, bug: 1e15, dry: 1e15 } }
  data.helper.targets[index] = key
  return data
}
const eventAt = (data, at, seq = 0) => Object.assign(data, { theft: { at, seq, log: [] } })

/** 在 seq 上找第一次满足条件的事件；产品代码没有测试专用概率分支。 */
function findSeq(data, at, predicate, max = 4000) {
  for (let seq = 0; seq < max; seq += 1) {
    const copy = structuredClone(data)
    eventAt(copy, at, seq)
    const event = resolveTheft(copy, at)
    if (predicate(event, copy)) return { seq, event, data: copy }
  }
  throw new Error('no seq matched')
}

beforeEach(() => { setTheft(true); setRandom(() => 0.5) })

test('巡逻区：4 块一区，18 块 5 区；6/7 块 2 区；边界固定不随巡逻只数变', () => {
  assert.equal(HELPER_PATROL_ZONE_PLOTS, 4)
  assert.deepEqual([0, 3, 4, 7, 8, 11, 12, 15, 16, 17].map(patrolZoneOf), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4])
  assert.equal(patrolZoneCount({ unlocked: 18 }), 5)
  assert.equal(patrolZoneCount({ unlocked: 6 }), 2)
  assert.equal(patrolZoneCount({ unlocked: 7 }), 2)
  assert.deepEqual(patrolZoneRange({ unlocked: 18 }, 4), { from: 16, to: 17, count: 2 })
  const zones = patrolZones(bare(['patrol', 'patrol']))
  assert.deepEqual(zones.map(zone => [zone.label, zone.from, zone.to, zone.patrolId]), [
    ['1 区', 0, 3, 1], ['2 区', 4, 7, 2], ['3 区', 8, 11, null], ['4 区', 12, 15, null], ['5 区', 16, 17, null],
  ])
})

test('区归属：第 k 只巡逻守第 k 区；改角色后顺位补区；多出的巡逻机动', () => {
  const data = bare(['patrol', 'patrol', 'patrol'])
  assert.equal(patrolOwnerOfZone(data, 0).id, 1)
  assert.equal(patrolOwnerOfZone(data, 1).id, 2)
  assert.equal(patrolOwnerOfZone(data, 2).id, 3)
  assert.equal(patrolOwnerOfZone(data, 3), null)
  data.helper.workers[0].role = 'harvest'
  assert.equal(patrolOwnerOfZone(data, 0).id, 2, '后面的巡逻顺位补上')
  assert.equal(patrolOwnerOfZone(data, 1).id, 3)
  const small = bare(['patrol', 'patrol', 'patrol'], { unlocked: 6 })
  assert.equal(patrolZoneCount(small), 2)
  assert.equal(patrolOwnerOfZone(small, 2), null, '第 3 只巡逻没有空闲区')
})

test('在岗覆盖：工作窗算有人守；班次休息 / 手动休息 / 没活睡觉 / 暂停都算无人守；不接管', () => {
  const data = bare(['patrol', 'patrol'])
  assert.equal(zoneGuardState(data, 0, T0), 'guarded')
  assert.equal(zoneGuardedAt(data, 0, T0 + 1 * H), true)
  assert.equal(zoneGuardState(data, 0, T0 + 2.4 * H), 'resting')
  assert.equal(zoneGuardedAt(data, 0, T0 + 3 * H), false)

  data.helper.workers[0].resting = true
  assert.equal(zoneGuardState(data, 0, T0), 'resting')
  assert.equal(zoneGuardedAt(data, 1, T0), true, '2 号在岗也不替 1 号守 1 区')

  data.helper.workers[0].resting = false
  data.helper.workers[0].idle = true
  assert.equal(zoneGuardState(data, 0, T0), 'idle')
  assert.equal(zoneGuardedAt(data, 0, T0), false)

  data.helper.workers[0].idle = false
  data.helper.enabled = false
  assert.equal(zoneGuardState(data, 0, T0), 'paused')
  assert.equal(zoneGuardedAt(data, 0, T0), false)
  assert.equal(zoneGuardState(data, 4, T0), 'unassigned')
})

test('有人守：5% 得手且只普通损失；95% 被赶走、无损失、仍写日志', () => {
  const data = planted(bare(['patrol']), 0)
  const stolen = findSeq(data, T0 + H, event => event.guarded && !event.blocked)
  assert.equal(stolen.event.patrolId, 1)
  assert.ok(stolen.event.loss >= 0.2 && stolen.event.loss <= 0.3, 'loss ' + stolen.event.loss)
  assert.equal(stolen.event.heavy, false, '有人守不重损')
  assert.equal(stolen.data.plots[0].loss, stolen.event.loss)
  assert.equal(stolen.data.theft.log.length, 1)

  const blocked = findSeq(data, T0 + H, event => event.blocked)
  assert.equal(blocked.event.loss, 0)
  assert.equal(blocked.data.plots[0].loss, undefined)
  assert.equal(blocked.data.theft.log[0].blocked, true, '被赶走也写日志')
})

test('无人守：100% 得手；3% 重损 80–90%，否则 20–30%', () => {
  const data = planted(bare(), 0)
  for (let seq = 0; seq < 20; seq += 1) {
    const one = structuredClone(data); eventAt(one, T0 + H, seq)
    const event = resolveTheft(one, T0 + H)
    assert.equal(event.guarded, false)
    assert.equal(event.blocked, false)
    assert.ok(event.loss > 0)
  }
  const heavy = findSeq(data, T0 + H, event => event.heavy)
  assert.ok(heavy.event.loss >= 0.8 && heavy.event.loss <= 0.9, 'heavy loss ' + heavy.event.loss)
  assert.equal(heavy.data.plots[0].loss, heavy.event.loss)
  const normal = findSeq(data, T0 + H, event => !event.heavy)
  assert.ok(normal.event.loss >= 0.2 && normal.event.loss <= 0.3, 'normal loss ' + normal.event.loss)
})

test('一次事件只改一块地：其他地的 loss 不变，日志只加一条', () => {
  const data = planted(bare(), 0)
  planted(data, 1)
  planted(data, 2)
  const { data: after } = findSeq(data, T0 + H, () => true)
  const changed = after.plots.map((plot, index) => (plot?.loss ? index : null)).filter(index => index !== null)
  assert.equal(changed.length, 1)
  assert.equal(after.theft.log.length, 1)
})

test('目标层级：成熟 > 2h 内成熟 > 在长；空地/枯苗不选；全空事件作废不写日志', () => {
  const ripe = planted(bare(), 0)
  planted(ripe, 1, 'radish', T0 - 13 * H) // 1h 后熟
  planted(ripe, 2, 'radish', T0 - 1 * H) // 在长
  const pick = findSeq(ripe, T0, event => event !== null)
  assert.equal(pick.event.plot, 0, '有成熟只选成熟')

  const soon = planted(bare(), 1, 'radish', T0 - 13 * H)
  planted(soon, 2, 'radish', T0 - 1 * H)
  assert.equal(findSeq(soon, T0, event => event !== null).event.plot, 1, '没有成熟选 2h 内成熟')

  const growing = planted(bare(), 2, 'radish', T0 - 1 * H)
  assert.equal(findSeq(growing, T0, event => event !== null).event.plot, 2, '只有在长就选在长')

  const empty = bare()
  eventAt(empty, T0, 7)
  assert.equal(resolveTheft(empty, T0), null)
  assert.equal(empty.theft.log.length, 0, '作废不写日志')
  assert.equal(empty.theft.seq, 8, '游标仍然前进')
})

test('产量：先扣虫害再乘 (1 - loss)，至少 1 个；损失封顶 90%', () => {
  const data = bare()
  data.plots[0] = { crop: 'radish', season: 1, plantedAt: T0 - 14 * H, boostMs: 0, roll: 0, loss: 0.25, pests: { weed: 1e15, bug: 1e15, dry: 1e15 } }
  assert.equal(plotState(data.plots[0], T0).yield, 18)
  data.plots[0].pests.weed = 0
  assert.equal(plotState(data.plots[0], T0).yield, 17, '24 - 2 = 22，再乘 75%')
  data.plots[0].loss = 0.9
  assert.ok(plotState(data.plots[0], T0).yield >= 1, '重损也至少 1 个')
})

test('多季：收完进入下一季，loss 自动清零', () => {
  const data = bare(['harvest'])
  data.plots[0] = { crop: 'pomelo', season: 1, plantedAt: T0 - 22 * H, boostMs: 0, roll: 0, loss: 0.3, pests: { weed: 1e15, bug: 1e15, dry: 1e15 } }
  data.helper.targets[0] = 'pomelo'
  data.seeds.pomelo = 5
  eventAt(data, T0 + 100 * DAY) // 不让偷窃插进这次结算
  settleHelper(data, T0 + H)
  assert.equal(data.helper.stock.pomelo, 14, '20 个少收 30%')
  assert.equal(data.plots[0].season, 2)
  assert.equal(data.plots[0].loss, undefined, '下一季重新算，不带上一季损失')
})

test('时间线：事件在收获前 → 先扣损失再收；事件在收获后且地空了 → 作废', () => {
  const early = bare(['harvest'])
  early.helper.lastAt = T0 - H
  early.helper.workers[0].shiftAt = T0 - H
  planted(early, 0, 'radish', T0 - 14 * H) // 收获时刻 T0
  early.seeds.radish = 0
  eventAt(early, T0 - 30 * 60 * 1000, 0) // 收获前半小时
  settleHelper(early, T0 + H)
  assert.ok(early.helper.stock.radish < 24, '先被偷再收，产量被扣')
  assert.equal(early.theft.log.length, 1)
  assert.equal(early.plots[0], null, '单季收完腾地')

  const late = bare(['harvest'])
  late.helper.lastAt = T0 - H
  late.helper.workers[0].shiftAt = T0 - H
  planted(late, 0, 'radish', T0 - 14 * H) // 收获时刻 T0
  late.seeds.radish = 0 // 收完不补种，地空着
  eventAt(late, T0 + 30 * 60 * 1000, 0) // 收获后才来
  settleHelper(late, T0 + H)
  assert.equal(late.helper.stock.radish, 24, '事件不能倒回去偷已经收掉的果子')
  assert.equal(late.theft.log.length, 0, '地空了，事件作废')
})

test('休息空档：1 号巡逻休息时 1 区必被偷；在岗时能阻止（按 seq 断言两种分支）', () => {
  const gap = bare(['patrol'])
  gap.helper.workers[0].shiftAt = T0 - 2.5 * H // 2.4h 后进入休息窗
  planted(gap, 0)
  const hit = findSeq(gap, T0, () => true)
  assert.equal(hit.event.guarded, false)
  assert.equal(hit.event.blocked, false)
  assert.ok(hit.event.loss > 0)

  const onDuty = bare(['patrol'])
  planted(onDuty, 0)
  const blocked = findSeq(onDuty, T0, event => event.blocked)
  assert.equal(blocked.event.guarded, true)
  assert.equal(blocked.event.loss, 0)
})

test('频率：无帮工 12–24h，已雇 6–10h，按分钟取整；事件推进后 at 只增', () => {
  const idle = bare()
  const hired = bare(['harvest'])
  for (let seq = 0; seq < 200; seq += 1) {
    const gapIdle = nextTheftAt(idle, T0, seq) - T0
    const gapHired = nextTheftAt(hired, T0, seq) - T0
    assert.ok(gapIdle >= 12 * H && gapIdle <= 24 * H, 'idle gap ' + gapIdle)
    assert.ok(gapHired >= 6 * H && gapHired <= 10 * H, 'hired gap ' + gapHired)
    assert.equal(gapIdle % 60000, 0)
    assert.equal(gapHired % 60000, 0)
  }
  const data = planted(bare(), 0)
  eventAt(data, T0, 3)
  resolveTheft(data, T0)
  assert.ok(data.theft.at > T0)
  assert.equal(data.theft.seq, 4)
})

test('确定性：同一 seq/at 的事件完全相同；同一 now 两次 view deepEqual', () => {
  const data = planted(bare(['patrol']), 0)
  const one = structuredClone(data); eventAt(one, T0 + H, 11)
  const two = structuredClone(data); eventAt(two, T0 + H, 11)
  assert.deepEqual(resolveTheft(one, T0 + H), resolveTheft(two, T0 + H))
  const source = planted(bare(['patrol']), 0)
  eventAt(source, T0 + 30 * 60 * 1000, 2)
  const clock = api(T0 + H)
  const first = farm.view(source, clock)
  const second = farm.view(source, clock)
  assert.deepEqual(first, second, '刷新不重 roll')
  assert.deepEqual(source.theft, { at: T0 + 30 * 60 * 1000, seq: 2, log: [] }, 'view 只改副本')
  assert.equal(first.theft.zones[0].guarded, true)
  assert.equal(first.plots[0].zone, 0)
  assert.equal(first.plots[0].guarded, true)
})

test('离线只回看 72h；暂停不结算不补；无帮工照常', () => {
  const offline = planted(bare(), 0)
  eventAt(offline, T0 - 30 * DAY, 0)
  settleHelper(offline, T0)
  assert.ok(offline.theft.at > T0)
  assert.ok(offline.theft.log.length <= 5)
  assert.ok(offline.theft.log.every(event => event.at >= T0 - THEFT_LOOKBACK_MS), '不处理 72h 前的事件')

  const paused = planted(bare(['patrol']), 0)
  paused.helper.enabled = false
  eventAt(paused, T0 - H, 0)
  const before = structuredClone(paused.plots)
  settleHelper(paused, T0)
  assert.ok(paused.theft.at > T0, '暂停期间快进')
  assert.deepEqual(paused.plots, before, '暂停不损失')
  paused.helper.enabled = true
  settleHelper(paused, T0 + H)
  assert.deepEqual(paused.plots, before, '恢复不补暂停那一段')

  const alone = planted(bare(), 0)
  eventAt(alone, T0 - H, 0)
  settleHelper(alone, T0)
  assert.ok(alone.plots[0].loss > 0, '没雇帮工也会有偷窃')
})

test('时钟回拨：now < lastAt 整段不结算，不重复扣', () => {
  const data = planted(bare(['harvest']), 0)
  eventAt(data, T0 + H, 0)
  settleHelper(data, T0 + 2 * H)
  const snapshot = structuredClone(data)
  settleHelper(data, T0)
  assert.deepEqual(data, snapshot, '回拨不重算')
  assert.equal(data.theft.seq, snapshot.theft.seq)
})

test('v8 → v9 迁移只补字段：不结算、不补损失；幂等；坏数据可修复', () => {
  const raw = bare()
  raw.version = 8
  raw.plots[0] = { crop: 'radish', season: 1, plantedAt: T0 - 14 * H, boostMs: 0, roll: 0, loss: 0.25, pests: { weed: 1e15, bug: 1e15, dry: 1e15 } }
  const migrated = normalize(structuredClone(raw), T0)
  assert.equal(migrated.version, 9)
  assert.equal(migrated.theft.seq, 0)
  assert.ok(migrated.theft.at >= T0 + 12 * H && migrated.theft.at <= T0 + 24 * H, '升级从 now + 首间隔起排，不用 lastAt 回填')
  assert.equal(migrated.theft.at % 60000, 0)
  assert.deepEqual(migrated.theft.log, [])
  assert.equal(migrated.plots[0].loss, 0.25, '已有损失保留')

  const twice = normalize(structuredClone(migrated), T0)
  assert.deepEqual(twice, migrated, 'normalize 幂等')

  const broken = normalize(structuredClone({ ...raw, theft: { at: 'x', seq: -3, log: [{ at: 'bad' }, { at: T0 - H, seq: 2, plot: 1, kind: 'bird', loss: 5 }] } }), T0)
  assert.ok(Number.isFinite(broken.theft.at))
  assert.equal(broken.theft.seq, 0)
  assert.equal(broken.theft.log.length, 1, '坏日志丢弃')
  assert.ok(broken.theft.log[0].loss <= 0.9, '日志损失也夹取')

  const clamped = normalize(structuredClone({ ...raw, plots: [{ ...raw.plots[0], loss: 1.5 }] }), T0)
  assert.equal(clamped.plots[0].loss, 0.9)
  const removed = normalize(structuredClone({ ...raw, plots: [{ ...raw.plots[0], loss: 'bad' }] }), T0)
  assert.equal(removed.plots[0].loss, undefined)
})

test('merge：theft 取结算更晚一侧、seq 取 max、日志并集去重取 5、plot loss 跟选中 plot；>9 抛错', () => {
  const target = bare(['harvest'], { unlocked: 8, version: 9 })
  target.helper.lastAt = T0 - 2 * H
  planted(target, 0, 'radish', T0 - 5 * H)
  target.plots[0].loss = 0.1
  eventAt(target, T0 - H, 1)
  target.theft.log = [{ seq: 0, at: T0 - H, kind: 'bird', plot: 0, zone: 0, crop: 'radish', patrolId: null, guarded: false, blocked: false, loss: 0.1, heavy: false }]

  const source = bare(['harvest'], { unlocked: 8, version: 9 })
  source.helper.lastAt = T0
  planted(source, 0, 'radish', T0 - 10 * H) // 进度更靠后，pickPlot 选 source
  source.plots[0].loss = 0.4
  eventAt(source, T0 + 5 * H, 3)
  source.theft.log = [
    { seq: 2, at: T0, kind: 'pig', plot: 1, zone: 0, crop: 'radish', patrolId: null, guarded: false, blocked: false, loss: 0.25, heavy: false },
    { seq: 0, at: T0 - H, kind: 'bird', plot: 0, zone: 0, crop: 'radish', patrolId: null, guarded: false, blocked: false, loss: 0.1, heavy: false },
  ]

  const merged = farm.mergeStates(target, source, T0).data
  assert.equal(merged.version, 9)
  assert.equal(merged.theft.at, T0 + 5 * H, '取结算更晚一侧的游标')
  assert.equal(merged.theft.seq, 3, 'seq 取 max')
  assert.equal(merged.theft.log.length, 2, '日志并集去重')
  assert.equal(merged.plots[0].loss, 0.4, 'loss 跟选中的那份 plot 走，不相加')
  assert.throws(() => farm.mergeStates({ ...target, version: 10 }, source, T0), /比当前扩展新/)
})

test('测试缝：setTheft(false) 后不结算、不补游标；打开后恢复', () => {
  setTheft(false)
  const data = planted(bare(), 0)
  delete data.theft
  const migrated = normalize(structuredClone(data), T0)
  assert.equal(migrated.theft, undefined, '关闭时不补 theft')
  assert.equal(migrated.version, 9)
  settleHelper(migrated, T0 + DAY)
  assert.equal(migrated.plots[0].loss, undefined)
  setTheft(true)
})

test('theftView / view：覆盖区、最近事件、loss 文案；空农场没有最近事件', () => {
  const data = planted(bare(['patrol']), 0)
  data.plots[0].loss = 0.25
  eventAt(data, T0 - 2 * H, 2)
  data.theft.log = [{ seq: 1, at: T0 - 2 * H, kind: 'bird', plot: 0, zone: 0, crop: 'radish', patrolId: 1, guarded: false, blocked: false, loss: 0.25, heavy: false }]
  const view = theftView(data, T0)
  assert.equal(view.guardedZones, 1)
  assert.equal(view.totalZones, 5)
  assert.equal(view.latest.plot, 0)
  assert.equal(view.zones[0].state, 'guarded')
  assert.equal(view.zones[1].state, 'unassigned')

  const clock = api(T0)
  const shown = farm.view(data, clock)
  assert.equal(shown.plots[0].lossPercent, 25)
  assert.match(shown.plots[0].lossNote, /被鸟啄过/)
  assert.match(shown.plots[0].lossNote, /少收 25%/)
  assert.equal(shown.theft.latest.plot, 0)

  const none = theftView(bare(), T0)
  assert.equal(none.latest, null)
})
