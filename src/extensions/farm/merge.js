// @ts-check
// 菜园合并钩子（#14 外部桌宠：把内嵌猪的菜园并进桌面猪的菜园）。
// 只相信自己的 normalize：两边的数据先各自补齐/迁移到 v9，再按下面这套规则合，最后再过一次 normalize。
// 规则写在 docs/guides/writing-extensions.md「合并钩子」（#14 设计稿 6.4）。
//
// 规则：资产（种子、仓库、图鉴数量、历史收获、肥料、帮工仓、欠着的退款）两边相加；
// 进度（开垦块数、经验、帮工等级）取更高；同一块地只能留一份，取更靠后/种得更晚的一方；
// 帮工只保留「结算得更晚」那一侧的指针、排班和管区目标，旧批次（pending）不再合并；
// workers 数量取两边较多的（封顶 5，不按角色相加，避免两台设备各雇 5 只变 10 只），
// 角色/hiredAt/shiftAt/resting/idle 取「结算更晚」的一侧，locked 两边同 id 任一为 true 就算锁。
// 数据版本比当前新（> 9）就抛错，交给宿主退回「二选一」，不拿旧规则硬读新数据。
import { EXP_CAP, PLOTS, START_PLOTS } from './data.js'
import { HELPER_MAX } from './helper.js'
import { normalize } from './migration.js'
import { lessonAt } from './plot-rules.js'
import { count, cropFor, isObject, plotState } from './pure.js'

/** 当前这份服务端读写的数据版本（normalize 的终点）。 */
export const FARM_DATA_VERSION = 9

const KNOWN = new Set(['version', 'unlocked', 'plots', 'seeds', 'harvest', 'acquired', 'harvests', 'tools', 'fert',
  'exp', 'refund', 'helperBarnRefund', 'helperBarnRefunded', 'helper', 'onboarding', 'theft'])
const SAFE = Number.MAX_SAFE_INTEGER

/** 存档里的 key 会拼进新对象：`__proto__` 这类名字一律不收。 */
const safeKey = key => key !== '__proto__' && key !== 'constructor' && key !== 'prototype'

const amount = value => {
  const n = Math.floor(Number(value))
  return Number.isSafeInteger(n) && n > 0 ? Math.min(SAFE, n) : 0
}

/** 按 key 相加，封顶安全整数（种子一次最多买 999，但仓库里的存量可以更多）。 */
function sumCounts(...maps) {
  const out = {}
  for (const map of maps) {
    if (!isObject(map)) continue
    for (const [key, value] of Object.entries(map)) {
      const n = amount(value)
      if (n > 0 && safeKey(key)) out[key] = Math.min(SAFE, (out[key] ?? 0) + n)
    }
  }
  return out
}

/** 确认是对象、版本不比当前新，再深拷贝一份来改：入参一份不动。 */
function prepare(data, side, now) {
  if (!isObject(data)) throw new Error('菜园数据（' + side + '）不是对象，无法合并')
  const version = Math.floor(Number(data.version))
  if (Number.isSafeInteger(version) && version > FARM_DATA_VERSION) {
    throw new Error('菜园数据（' + side + '）版本 ' + version + ' 比当前扩展新，请先更新菜园再合并')
  }
  return normalize(structuredClone(data), now)
}

/** 地块状态统一成「越靠后越好」：成熟 > 生长中（进度高）> 空地/休耕 > 枯苗。 */
function plotRank(plot, now) {
  if (!isObject(plot)) return [-1, 0]
  const state = plotState(plot, now)
  if (state === null) return [-1, 0]
  if (state.withered === true) return [0, 0]
  if (state.empty === true) return [1, 0]
  return state.ripe === true ? [3, 1] : [2, Math.max(0, Math.min(0.999999, state.progress))]
}

/** 交出去的每块地都要是合法 v6 形状；坏数字按「没有」处理，不让整个钩子失败。 */
function cleanPlot(plot) {
  if (!isObject(plot)) return null
  if (plot.fallow === true) return { fallow: true, stubble: plot.stubble === true, pests: { dry: plot.pests?.dry === 0 ? 0 : null, weed: plot.pests?.weed === 0 ? 0 : null } }
  if (plot.withered === true) return { crop: plot.crop, withered: true }
  const crop = cropFor(plot.crop)
  if (crop === null) return null
  const pest = kind => (Number.isFinite(plot.pests?.[kind]) ? plot.pests[kind] : null)
  const loss = Number.isFinite(plot.loss) ? Math.max(0, Math.min(0.9, Math.round(plot.loss * 100) / 100)) : 0
  return {
    crop: crop.key,
    season: Math.max(1, Math.min(crop.seasons, Math.floor(Number(plot.season)) || 1)),
    plantedAt: plot.plantedAt,
    boostMs: Number.isFinite(plot.boostMs) ? Math.max(0, plot.boostMs) : 0,
    roll: Number.isFinite(plot.roll) ? Math.max(-3, Math.min(2, Math.floor(plot.roll))) : 0,
    pests: { weed: pest('weed'), bug: pest('bug'), dry: pest('dry') },
    ...(loss > 0 ? { loss } : {}),
  }
}

/** 同一块地只留一份：两边都长着就取更靠后的；完全一样时保留桌宠。 */
function pickPlot(target, source, now) {
  const t = cleanPlot(target), s = cleanPlot(source)
  if (t === null) return s
  if (s === null) return t
  const [tRank, tProgress] = plotRank(t, now)
  const [sRank, sProgress] = plotRank(s, now)
  if (sRank > tRank || (sRank === tRank && sProgress > tProgress)) return s
  return t
}

/** 帮工：等级/雇佣取高，仓库相加；指针和管哪几块地整套跟「结算得更晚」的一边（旧批次不再合并）。 */
function pickHelperContext(target, source) {
  const settledAt = helper => (Number.isFinite(helper.lastAt) ? helper.lastAt : -Infinity)
  return settledAt(source) > settledAt(target) ? source : target
}

function mergeHelper(out, t, s) {
  const level = Math.max(t.level, s.level)
  const context = pickHelperContext(t, s)
  const other = context === t ? s : t
  // 只数取 max，不按角色/设备相加；id 连续重排后按位置对齐两边同一只帮工。
  const count = Math.min(HELPER_MAX, Math.max(t.workers.length, s.workers.length))
  const workers = []
  for (let id = 1; id <= count; id += 1) {
    const primary = context.workers[id - 1], secondary = other.workers[id - 1]
    const pick = primary ?? secondary
    if (pick === undefined) continue
    workers.push({
      id,
      role: pick.role === 'patrol' ? 'patrol' : 'harvest', // 角色跟「结算更晚」的一侧
      locked: primary?.locked === true || secondary?.locked === true,
      hiredAt: Number.isFinite(pick.hiredAt) ? pick.hiredAt : null,
      shiftAt: Number.isFinite(pick.shiftAt) ? pick.shiftAt : null,
      resting: pick.resting === true,
      idle: pick.idle === true,
    })
  }
  const hired = workers.length > 0
  out.helper = {
    hired, enabled: hired && context.enabled === true, xpQuarterRemainder: context.xpQuarterRemainder,
    xpEligibleAt: context.xpEligibleAt,
    level, barn: Math.max(t.barn, s.barn),
    lastAt: hired && Number.isFinite(context.lastAt) ? context.lastAt : null,
    usedMs: 0,
    cursor: context.cursor,
    pending: null,
    targets: Array.from({ length: PLOTS }, (_, index) => context.targets[index] ?? null),
    stock: sumCounts(t.stock, s.stock),
    schedule: context.schedule,
    workers,
  }
}

/** 偷窃游标跟「结算更晚」的一侧；两边都没结算时看 theft.at 更晚、再退到 seq 更大。 */
function pickTheftContext(target, source) {
  const settledAt = helper => (Number.isFinite(helper.lastAt) ? helper.lastAt : -Infinity)
  const t = settledAt(target.helper), s = settledAt(source.helper)
  if (t !== s) return s > t ? source : target
  const ta = Number.isFinite(target.theft?.at) ? target.theft.at : -Infinity
  const sa = Number.isFinite(source.theft?.at) ? source.theft.at : -Infinity
  if (ta !== sa) return sa > ta ? source : target
  return (source.theft?.seq ?? 0) > (target.theft?.seq ?? 0) ? source : target
}

/** 日志并集：按 at + plot + kind 去重，按 at 倒序，只留 5 条。 */
function mergeTheftLog(left, right) {
  const seen = new Set()
  const out = []
  for (const event of [...(left ?? []), ...(right ?? [])]) {
    if (!isObject(event) || !Number.isFinite(event.at)) continue
    const key = event.at + '|' + event.plot + '|' + event.kind
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...event })
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 5)
}

/**
 * theft 游标跟「结算更晚」的一侧；seq 取 max（避免两边独立玩后日志序号重复）；
 * 日志两边并集。地块 loss 不在这里相加：它跟 pickPlot 选中的那份快照走。
 */
function mergeTheft(out, t, s) {
  const ctx = pickTheftContext(t, s)
  out.theft = {
    at: Number.isFinite(ctx.theft?.at) ? ctx.theft.at : null,
    seq: Math.max(t.theft?.seq ?? 0, s.theft?.seq ?? 0),
    log: mergeTheftLog(t.theft?.log, s.theft?.log),
  }
}

/** 第一课只算一次：任一边做完就算做完；都没做完就留更靠后的那一步（进度高、到点早）。 */
function mergeLesson(out, t, s, warnings) {
  const done = t.step === 'done' ? t : s.step === 'done' ? s : null
  if (done !== null) {
    const other = done === t ? s : t
    if (other.step !== 'done') warnings.push('菜园：另一边的第一课还没做完，合并后按已完成处理，只保留一份 12 菜币奖励')
    out.onboarding = { step: 'done', rewarded: true, legacy: t.legacy === true || s.legacy === true,
      plantedAt: Number.isFinite(done.plantedAt) ? done.plantedAt : null, wateredAt: Number.isFinite(done.wateredAt) ? done.wateredAt : null }
    return
  }
  const ready = lesson => (lesson.plantedAt === null ? Infinity : lessonAt(lesson))
  const advanced = s.step === 'planted' && (t.step !== 'planted' || ready(s) < ready(t))
  const pick = advanced ? s : t
  out.onboarding = pick.step === 'planted'
    ? { step: 'planted', rewarded: false, legacy: false, plantedAt: pick.plantedAt, wateredAt: Number.isFinite(pick.wateredAt) ? pick.wateredAt : null }
    : { step: 'offer', rewarded: false, legacy: false, plantedAt: null, wateredAt: null }
}

/**
 * 合并两边的菜园数据。
 * @param {any} targetData 桌面猪的 extData.farm
 * @param {any} sourceData 内嵌猪的 extData.farm
 * @param {number} [now] 判定生长/成熟用的时刻；宿主调用时不传，用当前时间
 */
export function mergeStates(targetData, sourceData, now = Date.now()) {
  const t = prepare(targetData, '桌宠', now)
  const s = prepare(sourceData, '内嵌猪', now)
  const warnings = []
  const out = {
    version: FARM_DATA_VERSION,
    unlocked: Math.max(START_PLOTS, Math.min(PLOTS, Math.max(t.unlocked, s.unlocked))),
    plots: [],
    seeds: sumCounts(t.seeds, s.seeds),
    harvest: sumCounts(t.harvest, s.harvest),
    acquired: sumCounts(t.acquired, s.acquired),
    harvests: sumCounts(t.harvests, s.harvests),
    tools: {},
    fert: sumCounts(t.fert, s.fert),
    exp: Math.min(EXP_CAP, Math.max(t.exp, s.exp)),
    refund: Math.min(SAFE, t.refund + s.refund),
    helperBarnRefund: Math.max(amount(t.helperBarnRefund), amount(s.helperBarnRefund)),
    helperBarnRefunded: t.helperBarnRefunded === true || s.helperBarnRefunded === true,
  }
  // 开垦过的每一块地都要有值：没开垦的以后面 null 收尾。
  for (let index = 0; index < PLOTS; index += 1) {
    out.plots.push(index < out.unlocked ? pickPlot(t.plots[index], s.plots[index], now) : null)
  }
  // 工具是买过的永久解锁，两边都算；认不出的 key 原样留着。
  for (const map of [t.tools, s.tools]) for (const [key, value] of Object.entries(map)) if (value === true && safeKey(key)) out.tools[key] = true
  mergeHelper(out, t.helper, s.helper)
  mergeTheft(out, t, s)
  mergeLesson(out, t.onboarding, s.onboarding, warnings)
  // 桌宠自己的未来字段原样保留；内嵌猪的认不出字段不猜，只提示。
  for (const [key, value] of Object.entries(t)) if (!KNOWN.has(key) && safeKey(key)) out[key] = value
  const unknown = Object.keys(s).filter(key => !KNOWN.has(key))
  if (unknown.length > 0) warnings.push('菜园：内嵌猪有当前版本不认识的字段（' + unknown.slice(0, 6).join('、') + '），没有合并')
  normalize(out, now)
  out.unlocked = Math.max(START_PLOTS, Math.min(PLOTS, out.unlocked))
  for (let index = out.unlocked; index < PLOTS; index += 1) out.plots[index] = null
  return { data: out, warnings, conflicts: [] }
}
