// @ts-check
// 偷窃事件（v9）：鸟 / 小偷猪按固定间隔来，一次只偷一块地；目标区有在岗巡逻时 95% 被赶走，
// 无人守时 100% 得手（3% 重损）。损失写进 plot.loss，收获时按比例扣。
// 事件游标 theft.at / theft.seq 落盘；每条决策用独立的 stableRandom 流，刷新不重 roll。
import { HOUR_MS, PLOTS } from './data.js'
import { helperPatrolWorkers, patrolOwnerOfZone, patrolZoneOf, patrolZones, zoneGuardState, zoneGuardedAt } from './helper-patrol.js'
import { count, cropFor, isObject, plotState, stableRandom } from './pure.js'

/** 下一次事件的间隔：没雇帮工 12–24h，雇了 6–10h（按分钟取整）。 */
export const THEFT_GAP_NO_HELPER = [12 * HOUR_MS, 24 * HOUR_MS]
export const THEFT_GAP_HELPER = [6 * HOUR_MS, 10 * HOUR_MS]
/** 离线只回看最近 72h：更早的事件直接跳过，不补损失。 */
export const THEFT_LOOKBACK_MS = 72 * HOUR_MS
/** 单次结算最多处理多少个事件；超过说明游标坏了，抛错交给宿主事务回滚。 */
export const THEFT_MAX_EVENTS = 240
/** 事件日志最多留几条。 */
export const THEFT_LOG_MAX = 5
/** 有在岗巡逻时的 5% 地板；无人守时不掷这个骰。 */
export const THEFT_GUARD_CHANCE = 0.05
/** 无人守时的 3% 重损；有人守的 5% 分支最多 30%。 */
export const THEFT_HEAVY_CHANCE = 0.03
/** 普通损失 20–30%，重损 80–90%，累计封顶 90%。 */
export const THEFT_NORMAL_LOSS = [0.2, 0.3]
export const THEFT_HEAVY_LOSS = [0.8, 0.9]
export const THEFT_LOSS_CAP = 0.9
/** 「2h 内成熟」的第二档目标。 */
export const THEFT_SOON_MS = 2 * HOUR_MS
/** 游标前进的最小间隔，防坏档死循环。 */
const MIN_GAP_MS = 60_000

/**
 * 测试缝：`false` 时 setup 不结算偷窃、normalize 也不补偷窃游标。
 * 旧自然托管 / 精力用例在 beforeEach 关掉；产品默认开。
 */
let theftOn = true
export function setTheft(on) { theftOn = on !== false }
export const theftEnabled = () => theftOn

/** 每条决策一个命名流：seq + at 相同就永远给出同一串数，加骰子不会串位。 */
const theftRandom = (name, seq, at) => stableRandom('farm-theft', name, seq, at)

const finiteOr = (value, fallback) => (Number.isFinite(value) ? value : fallback)
const round2 = value => Math.round(value * 100) / 100
/** 0–0.9 的损失比例；坏值当 0。 */
export const lossValue = value => (Number.isFinite(value) ? Math.max(0, Math.min(THEFT_LOSS_CAP, round2(value))) : 0)
const lossText = loss => Math.round(lossValue(loss) * 100) + '%'

/** 一次事件的间隔上/下限。 */
export function theftGapRange(data) {
  return data?.helper?.hired === true ? THEFT_GAP_HELPER : THEFT_GAP_NO_HELPER
}
const minGap = data => theftGapRange(data)[0]

/** 从 from 往后排下一次事件；seq 决定随机流，按分钟取整。 */
export function nextTheftAt(data, from, seq = 0) {
  const [min, max] = theftGapRange(data)
  const r = theftRandom('gap', seq, from)()
  const gap = Math.max(MIN_GAP_MS, Math.round((min + r * (max - min)) / MIN_GAP_MS) * MIN_GAP_MS)
  return from + gap
}

/** 巡逻区当前快照（UI / view 共用；不暴露下一次事件时刻）。 */
export function theftView(data, now = Date.now()) {
  const at = Number.isFinite(now) ? now : Date.now()
  const hired = data?.helper?.hired === true
  const enabled = data?.helper?.enabled === true
  const zones = patrolZones(data).map(zone => {
    const state = zoneGuardState(data, zone.index, at)
    return { ...zone, state, guarded: state === 'guarded' }
  })
  const log = Array.isArray(data?.theft?.log) ? data.theft.log.slice(0, THEFT_LOG_MAX) : []
  return {
    enabled: !hired || enabled,
    paused: hired && !enabled,
    patrols: helperPatrolWorkers(data).length,
    guardedZones: zones.filter(zone => zone.guarded).length,
    totalZones: zones.length,
    zones,
    log,
    latest: log[0] ?? null,
  }
}

/** 农场里还有没有可偷的地块（有作物、没到 0.9 上限）；只用于「没活睡觉」快路径判断。 */
export function hasTheftTargets(data) {
  const unlocked = Math.max(0, Math.min(PLOTS, Number(data?.unlocked) || 0))
  for (let index = 0; index < unlocked; index += 1) {
    const plot = data.plots?.[index]
    if (!isObject(plot) || plot.fallow === true || plot.withered === true) continue
    if (cropFor(plot.crop) === null) continue
    if (lossValue(plot.loss) >= THEFT_LOSS_CAP) continue
    return true
  }
  return false
}

/**
 * 选目标：成熟 > 2h 内成熟 > 任意在长；每档内部按地块索引升序，均匀随机取一块。
 * 空地 / 枯苗 / 损失已到 90% 的地不选；没有候选返回 null（事件作废，不写日志）。
 */
export function pickTheftTarget(data, at, seq) {
  const unlocked = Math.max(0, Math.min(PLOTS, Number(data?.unlocked) || 0))
  const tiers = [[], [], []]
  for (let index = 0; index < unlocked; index += 1) {
    const plot = data.plots?.[index]
    if (!isObject(plot) || plot.fallow === true || plot.withered === true) continue
    if (cropFor(plot.crop) === null) continue
    if (lossValue(plot.loss) >= THEFT_LOSS_CAP) continue
    const state = plotState(plot, at)
    if (state === null || state.empty === true || state.withered === true) continue
    const tier = state.ripe === true ? 0 : state.remainingMs > 0 && state.remainingMs <= THEFT_SOON_MS ? 1 : 2
    tiers[tier].push({ index, crop: plot.crop, tier })
  }
  const candidates = tiers.find(list => list.length > 0)
  if (candidates === undefined) return null
  const pick = Math.min(candidates.length - 1, Math.floor(theftRandom('target', seq, at)() * candidates.length))
  return candidates[pick]
}

/** 把损失累加到地块上；封顶 90%，0 不写字段（保持旧形状）。 */
export function applyTheftLoss(data, index, loss) {
  const plot = data.plots?.[index]
  if (!isObject(plot)) return 0
  const next = lossValue(lossValue(plot.loss) + loss)
  if (next > 0) plot.loss = next
  else delete plot.loss
  return next
}

/** 日志最新在前；只留最近 5 条。 */
export function pushTheftLog(data, event) {
  if (!Array.isArray(data.theft.log)) data.theft.log = []
  data.theft.log.unshift(event)
  data.theft.log.length = Math.min(data.theft.log.length, THEFT_LOG_MAX)
}

/** 游标前进：seq + 1，下一次时刻从本次事件时刻往后排。 */
export function advanceTheft(data, at) {
  const theft = data.theft
  theft.seq = count(theft.seq) + 1
  theft.at = nextTheftAt(data, at, theft.seq)
}

/**
 * 处理一次事件（at 是事件时刻，不是 now）：
 * 目标区有在岗巡逻 → 掷一次 5%；无人守 → 必中，再掷 3% 重损。一次只改一块地。
 */
export function resolveTheft(data, at) {
  const theft = data.theft
  const seq = count(theft.seq)
  const target = pickTheftTarget(data, at, seq)
  if (target === null) { advanceTheft(data, at); return null }
  const zone = patrolZoneOf(target.index)
  const guarded = zoneGuardedAt(data, zone, at)
  const kind = target.tier <= 1
    ? (theftRandom('kind', seq, at)() < 0.6 ? 'bird' : 'pig')
    : 'pig'
  let blocked = false
  let heavy = false
  let loss = 0
  if (guarded) blocked = theftRandom('guard', seq, at)() >= THEFT_GUARD_CHANCE
  if (!blocked) {
    if (!guarded && theftRandom('heavy', seq, at)() < THEFT_HEAVY_CHANCE) {
      loss = THEFT_HEAVY_LOSS[0] + theftRandom('heavy-loss', seq, at)() * (THEFT_HEAVY_LOSS[1] - THEFT_HEAVY_LOSS[0])
      heavy = true
    } else {
      loss = THEFT_NORMAL_LOSS[0] + theftRandom('normal', seq, at)() * (THEFT_NORMAL_LOSS[1] - THEFT_NORMAL_LOSS[0])
    }
    loss = Math.max(1, Math.round(loss * 100)) / 100
    applyTheftLoss(data, target.index, loss)
  }
  const event = {
    seq, at, kind, plot: target.index, zone, crop: target.crop,
    patrolId: patrolOwnerOfZone(data, zone)?.id ?? null,
    guarded, blocked, loss: blocked ? 0 : loss, heavy,
  }
  pushTheftLog(data, event)
  advanceTheft(data, at)
  return event
}

/**
 * 跳过 floor 之前的事件：不写日志、不造成损失，只把游标推到 floor 之后。
 * 72h 回看、merge 对齐、暂停快进共用；最多跳 512 次，超了直接落到 floor 之后。
 */
export function alignTheft(data, floor) {
  const theft = data?.theft
  if (!isObject(theft) || !Number.isFinite(theft.at) || !Number.isFinite(floor)) return
  let guard = 0
  while (theft.at < floor) {
    if (guard++ > 512) { theft.seq = count(theft.seq) + 1; theft.at = floor + minGap(data); return }
    advanceTheft(data, theft.at)
  }
}

/** 没雇帮工：只结算偷窃（没有收获事件可穿插）。 */
export function settleTheftOnly(data, now) {
  const theft = data?.theft
  if (!isObject(theft) || !Number.isFinite(theft.at) || !Number.isFinite(now)) return
  alignTheft(data, now - THEFT_LOOKBACK_MS)
  let guard = 0
  while (theft.at <= now) {
    if (guard++ >= THEFT_MAX_EVENTS) throw new Error('菜园偷窃事件过多，未推进结算时间；请联系维护者检查存档。')
    resolveTheft(data, theft.at)
  }
}

/** 托管暂停：暂停期间的事件跳过、不补；恢复后从 now 之后重新排。 */
export function skipTheftClock(data, now) {
  const theft = data?.theft
  if (!isObject(theft) || !Number.isFinite(theft.at) || !Number.isFinite(now)) return
  alignTheft(data, now)
  if (theft.at <= now) { theft.seq = count(theft.seq) + 1; theft.at = nextTheftAt(data, now, theft.seq) }
}

/** 把一条日志修成可读形状；缺时刻/地块的坏条目直接丢弃。 */
function cleanEvent(raw) {
  if (!isObject(raw) || !Number.isFinite(raw.at)) return null
  const plot = Math.floor(Number(raw.plot))
  if (!Number.isSafeInteger(plot) || plot < 0 || plot >= PLOTS) return null
  return {
    seq: count(raw.seq), at: raw.at,
    kind: raw.kind === 'bird' ? 'bird' : 'pig',
    plot, zone: Number.isFinite(raw.zone) ? Math.max(0, Math.floor(raw.zone)) : patrolZoneOf(plot),
    crop: typeof raw.crop === 'string' ? raw.crop : null,
    patrolId: Number.isSafeInteger(raw.patrolId) && raw.patrolId > 0 ? raw.patrolId : null,
    guarded: raw.guarded === true, blocked: raw.blocked === true,
    loss: lossValue(raw.loss), heavy: raw.heavy === true,
  }
}

/**
 * v9 迁移只补字段、不结算：缺 at 时从 now + 首间隔起排（绝不用 lastAt 回填），
 * 坏 at/seq/log 修复；loss 单独由 normalize 夹取。幂等。
 */
export function normalizeTheft(data, now = Date.now()) {
  if (!theftOn) return
  const at = Number.isFinite(now) ? now : Date.now()
  const raw = isObject(data.theft) ? data.theft : {}
  const seq = Math.max(0, Math.floor(Number(raw.seq)) || 0)
  const next = Number.isFinite(raw.at) ? raw.at : nextTheftAt(data, at, seq)
  const log = Array.isArray(raw.log) ? raw.log.map(cleanEvent).filter(Boolean).slice(0, THEFT_LOG_MAX) : []
  data.theft = { at: next, seq, log }
}

/** UI / 经典版共用：一条损失说明（少收 X%）。 */
export const theftLossText = lossText
