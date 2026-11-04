// @ts-check
// 帮工猪：自然托管（用户 2026-10-27 批准）。托管地按原成熟时间、原收成并行生长，启用时持续浇水 / 除草 / 除虫，
// 熟了收进帮工仓，仓库里有同种种子就自动补种，缺种子就停空地。暂停不影响自然生长和库存领取；自动收获发 75% 菜园经验。
// 存档 v7：多了 helper.workers[]（1–5 只，收菜/巡逻）和 helper.schedule；pending 一律 null、usedMs 一律 0；
// 真实生长只看 plot.plantedAt / boostMs / season。覆盖块数 = 4 × 收菜帮工数，巡逻不占地。
import { CROPS, EXP_CAP, PESTS, PLOTS, REGROW_AT } from './data.js'
import { purse } from './host.js'
import { amountFor, plantPlot, recordHarvest } from './plot-rules.js'
import { count, cropFor, droughtAt, isObject, nextPest, plotState, ripeAt, seasonMs, sow, stableRandom, weatherAt } from './pure.js'

/** 旧等级管的地数：4 / 8 / 16 块。v7 起只作为迁移映射用，覆盖块数由收菜帮工只数算。 */
export const HELPER_PLOTS = [4, 8, 16]
/** 最多雇几只帮工（v7）。 */
export const HELPER_MAX = 5
/** 每只收菜帮工管几块地（v7）；巡逻型不占地。 */
export const HELPER_PLOTS_PER_WORKER = 4
/** 历史常量：旧批次配方的目标占比（自己种的九成）。自然托管按真实生长算收成，结算不再读它。 */
export const HELPER_SHARE = 0.9
/** 历史常量：旧六小时封仓窗口。自然托管没有工作时间预算，结算不再读它。 */
export const HELPER_WINDOW = 6 * 3600000
/** 旧农具档 2026-10-14 用户拍板从商店下架：不再出售，存档里的 barn 字段保留但不再参与配方。 */
export const HELPER_PRICES = { hire: 2500, level: [0, 2000, 6000] }
/** 一次结算最多处理多少件农活：防坏存档把扩展卡死；正常存档受种子数量限制，远到不了这个数。 */
const MAX_STEPS = 100000

/** 旧批次配方（2026-10-27 起结算不再使用）：只作为历史导出留着，老面板 / 老调用方读它不会崩。别在新逻辑里引用。 */
export function helperRecipe(key, level) {
  const crop = cropFor(key); if (!crop) return null
  const manual = HELPER_PLOTS[level] * (crop.yield * crop.sell - crop.price) / crop.hours
  const cap = Math.min(400, manual * 0.92), target = Math.min(400, manual * HELPER_SHARE)
  let best = null, make = (batches, y, degraded) => { const net = (y * crop.sell - crop.price) * batches / 6; return { yield: y, intervalMs: HELPER_WINDOW / batches, net, itemsPerHour: y * batches / 6, batches, share: manual > 0 ? net / manual : 0, degraded: degraded === true } }, gap = net => Math.abs(net - manual * HELPER_SHARE)
  for (let batches = 1; batches <= 60; batches += 1) {
    const y = Math.round((target * 6 / batches + crop.price) / crop.sell), net = (y * crop.sell - crop.price) * batches / 6, ok = y >= 1 && y <= crop.yield
    if (ok && net >= manual * 0.85 && net <= cap) return make(batches, y, false)
    if (ok && net > 0 && net <= cap && (!best || gap(net) < gap(best.net))) best = make(batches, y, true)
  }
  return best ?? make(1, 1, true)
}
/**
 * 旧档按等级补几只收菜帮工（D1 = A，2026-11-04 用户拍板）：level 0/1/2 → 1/2/4 只，
 * 所以旧档的 4/8/16 块覆盖原样保住。只用于迁移/防御式合成，不再参与日常覆盖计算。
 */
export const helperWorkersForLevel = level => HELPER_PLOTS[Math.min(2, count(level))] / HELPER_PLOTS_PER_WORKER
/** 合成一份收菜帮工名单；hiredAt 留 null（旧档没有真实雇佣时间，不编）。 */
export function helperWorkerList(level = 0) {
  const n = Math.max(1, Math.min(HELPER_MAX, helperWorkersForLevel(level)))
  return Array.from({ length: n }, (_, index) => ({ id: index + 1, role: 'harvest', locked: false, hiredAt: null }))
}
/**
 * 归一化只做幂等清理：旧批次清成 null、工作预算清成 0，不动已经种下的地块，也不发果。
 * v7 起顺带夹取 workers（最多 5 只、连续重编号、只认 harvest / patrol）并派生 hired；
 * 旧档或「被 4.2.x 旧 normalize 丢过 workers」的档按等级补回 1/2/4 只，避免永久变成没帮工。
 */
export function normalizeHelper(data) {
  const raw = isObject(data.helper) ? data.helper : {}
  const level = Math.min(2, count(raw.level))
  const barn = Math.min(3, count(raw.barn)) // 农具档已下架：只读取、只 clamp；紧接着 refundOldBarn 按档位退款并清零
  let workers = (Array.isArray(raw.workers) ? raw.workers : [])
    .filter(isObject)
    .slice(0, HELPER_MAX)
    .map((worker, index) => ({
      id: index + 1, // 连续重编号：id 只给 UI/动作定位，别信存档里的旧 id
      role: worker.role === 'patrol' ? 'patrol' : 'harvest',
      locked: worker.locked === true,
      hiredAt: Number.isFinite(worker.hiredAt) ? worker.hiredAt : null,
    }))
  if (raw.hired === true && workers.length === 0) workers = helperWorkerList(level)
  const hired = workers.length > 0 // 派生不变式：hired ⇔ 至少一只帮工
  data.helper = {
    hired, enabled: hired && raw.enabled !== false, xpQuarterRemainder: Math.min(3, count(raw.xpQuarterRemainder)),
    xpEligibleAt: Number.isFinite(raw.xpEligibleAt) ? raw.xpEligibleAt : null, level, barn,
    lastAt: Number.isFinite(raw.lastAt) ? raw.lastAt : null,
    usedMs: 0,
    cursor: count(raw.cursor) % PLOTS,
    pending: null,
    targets: Array.from({ length: PLOTS }, (_, index) => cropFor(raw.targets?.[index]) ? raw.targets[index] : null),
    stock: Object.fromEntries(CROPS.map(crop => [crop.key, count(raw.stock?.[crop.key])])),
    schedule: raw.schedule === 'manual' ? 'manual' : 'auto',
    workers,
  }
}
export const helperCount = data => Object.values(data.helper.stock).reduce((sum, n) => sum + Number(n), 0)
/** 收菜帮工只数：只有它们占地，巡逻 0 块。 */
export const helperHarvestWorkers = data => (Array.isArray(data.helper.workers) ? data.helper.workers : []).filter(worker => worker.role === 'harvest').length
/** 帮工覆盖的地块数：4 × 收菜帮工只数，封顶已开垦数；没雇就是 0。 */
export const helperPlots = data => data.helper.hired ? Math.min(data.unlocked, HELPER_PLOTS_PER_WORKER * helperHarvestWorkers(data)) : 0

/** 托管地的随机源：同一块地、作物、时刻、季数永远给出同一串数，view 反复结算不会改将来的收成。 */
const helperRandom = (...parts) => stableRandom('helper', ...parts)

/** 托管地不长草不生虫：把已经落地的灾害时间推到未来。只动 pests，不动 plantedAt / boostMs。 */
function keepClean(plot, at, index) {
  if (!isObject(plot.pests)) plot.pests = { weed: null, bug: null, dry: null }
  for (const kind of PESTS) {
    const when = plot.pests[kind]
    if (Number.isFinite(when) && when > at) continue // 时间必须是「还没到的未来数」：null / Infinity 会被当成病害
    plot.pests[kind] = nextPest(at, helperRandom('pest', index, kind, plot.crop, plot.plantedAt, at))
  }
}

/** 托管地下一件农活：在长的等成熟，空的（枯苗、荒地、收完的）现在就补种。同刻按 cursor 顺序稳定排队。 */
function nextEvent(data, helper, managed, at, now, blocked) {
  let pick = null
  for (let offset = 0; offset < managed; offset += 1) {
    const index = (helper.cursor + offset) % managed
    if (blocked.has(index)) continue
    const plot = data.plots[index]
    const crop = cropFor(plot?.fallow === true || plot?.withered === true ? null : plot?.crop)
    const when = crop === null ? at : Math.max(at, ripeAt(plot, crop))
    if (when > now) continue
    if (pick === null || when < pick.when) pick = { when, index, crop }
  }
  return pick
}

/** 收一块托管地：产量按地块自己的 roll（帮工一直打理，没有灾害减产）；多季先长下一季，整株收完才腾地补种。 */
function awardHelperExperience(data, helper, crop, eventAt) {
  if (Number.isFinite(helper.xpEligibleAt) && eventAt <= helper.xpEligibleAt) return
  if (data.exp >= EXP_CAP) {
    helper.xpQuarterRemainder = 0
    return
  }
  const quarters = helper.xpQuarterRemainder + 3 * crop.exp
  const gained = Math.floor(quarters / 4)
  data.exp = Math.min(EXP_CAP, data.exp + gained)
  helper.xpQuarterRemainder = data.exp >= EXP_CAP ? 0 : quarters % 4
}

function harvestHere(data, helper, managed, next, awardExperience) {
  const plot = data.plots[next.index]
  const crop = next.crop
  keepClean(plot, next.at, next.index)
  const state = plotState(plot, next.at)
  recordHarvest(data, crop.key, Math.max(1, state?.yield ?? 1), helper.stock)
  if (awardExperience) awardHelperExperience(data, helper, crop, next.at)
  helper.targets[next.index] = crop.key
  if (plot.season < crop.seasons) {
    const season = plot.season + 1
    data.plots[next.index] = sow(crop, next.at, season, REGROW_AT * seasonMs(crop), helperRandom('sow', next.index, crop.key, next.at, season))
  } else data.plots[next.index] = null
  helper.cursor = (next.index + 1) % managed
}

/** 补种：先清枯苗 / 留茬 / 杂草（不给经验、不吃体力），只种这块地原来指定的作物；缺种子就空着。 */
function plantHere(data, helper, managed, next, at, blocked) {
  const index = next.index
  let plot = data.plots[index]
  if (plot?.withered) data.plots[index] = plot = null
  if (plot?.fallow && (plot.stubble || plot.pests.weed === 0)) { plot.stubble = false; plot.pests.weed = null }
  // 只认这块地原来指定的作物；从没指定过就跳过，不替玩家挑种子。
  const crop = cropFor(plot?.crop) ?? cropFor(helper.targets[index])
  if (crop === null || !plantPlot(data, index, crop, at, helperRandom('sow', index, crop.key, at, 1))) { blocked.add(index); return }
  helper.targets[index] = crop.key
  keepClean(data.plots[index], at, index)
  helper.cursor = (index + 1) % managed
}

/** 没在长的托管地顺手清干净（枯苗铲掉、留茬杂草清掉）；在长的把灾害推到未来。都不给经验、不吃体力。 */
function tidy(data, managed, now) {
  for (let index = 0; index < managed; index += 1) {
    let plot = data.plots[index]
    if (plot?.withered) data.plots[index] = plot = null
    if (plot === null) continue
    if (plot.fallow) {
      if (plot.stubble) plot.stubble = false
      if (plot.pests?.weed === 0) plot.pests.weed = null
      continue
    }
    keepClean(plot, now, index)
  }
}

/**
 * 结算主循环：按成熟时刻一件件处理，同刻按 cursor 排队。收成用真实的成熟时刻（离线多久就补多少轮），
 * 补种用结算时钟且不早于 lastAt：没雇帮工的那段不会掉出“追溯种上”的果。
 */
function settlePlots(data, helper, managed, start, now, awardExperience) {
  // 托管地在长什么就认下什么：玩家自己种的作物也归帮工按原样补种。
  for (let index = 0; index < managed; index += 1) {
    const crop = cropFor(data.plots[index]?.crop)
    if (crop !== null) helper.targets[index] = crop.key
  }
  const blocked = new Set() // 这一轮种不了的地（缺种子 / 没指定作物）：别让结算空转
  let at = start
  let step = 0
  for (; step < MAX_STEPS; step += 1) {
    const next = nextEvent(data, helper, managed, at, now, blocked)
    if (next === null) break
    at = Math.max(at, next.when)
    if (next.crop === null) plantHere(data, helper, managed, next, at, blocked)
    else harvestHere(data, helper, managed, { at: next.when, index: next.index, crop: next.crop }, awardExperience)
  }
  // 不静默丢弃超大离线存档的剩余农活：失败由宿主事务回滚，lastAt 不会被推进。
  if (step === MAX_STEPS && nextEvent(data, helper, managed, at, now, blocked) !== null) throw new Error('菜园离线农活过多，未推进结算时间；请联系维护者检查存档。')
  tidy(data, managed, now)
}

/**
 * 自然托管结算：从 helper.lastAt 走到 now，按成熟时间顺序收成、补种（六块同时熟也不会漏）。
 * 只按存档里真实的 plantedAt / boostMs / season 推进；lastAt 只进不退，回拨那一段不重算、不重发。
 */
export function settleHelper(data, now, { awardExperience = true } = {}) {
  // 雨把已经干的地浇湿；view 在副本结算，动作时写回，下一次旱灾推到下一个晴天。
  if (weatherAt(now) === 'rain') for (const plot of data.plots) {
    if (plot?.fallow) plot.pests.dry = null
    else if (plot?.pests?.dry <= now) plot.pests.dry = droughtAt(now)
  }
  const helper = data.helper
  if (!Number.isFinite(now)) return
  const start = helper.lastAt ?? now
  if (now < start) return
  if (!helper.enabled) return
  const managed = helperPlots(data)
  // 全巡逻（managed = 0）也要把检查点推到 now：否则以后改回收菜会从旧检查点补做那段时间的收获/补种。
  if (managed === 0) { if (helper.hired === true) helper.lastAt = now; return }
  settlePlots(data, helper, managed, start, now, awardExperience)
  helper.lastAt = now
}

/**
 * 面板用的帮工状态：老字段一个不少（还剩 full / usedHours / capacityHours），自然托管下 full 恒为 false、continuous 恒为 true。
 * v7 新增 count/max/canHire/hirePrice/schedule/workers[]；workers 里的 plots/plotCount/status 只是展示用的派生值，不写存档。
 */
export function helperView(data) {
  const helper = data.helper
  const managed = helperPlots(data)
  const missing = helper.targets.slice(0, managed).filter((key, index) => key && (!data.plots[index] || data.plots[index].fallow) && amountFor(data, 'seeds', key) === 0)
  // 没在干活的两种原因：管区里没有在长的作物，也没有任何「这块地指定的作物」的种子（不替玩家挑种子）。
  const seedless = managed > 0 && !data.plots.slice(0, managed).some(plot => cropFor(plot?.crop)) &&
    !helper.targets.slice(0, managed).some(key => key && amountFor(data, 'seeds', key) > 0)
  // 覆盖按收菜帮工的雇佣顺序连续分片：第 h 只收菜帮工管 [4h, 4h+4)，巡逻 0 块。
  const workers = []
  let offset = 0
  for (const worker of helper.workers) {
    const role = worker.role === 'patrol' ? 'patrol' : 'harvest'
    const plotCount = role === 'harvest' ? Math.max(0, Math.min(HELPER_PLOTS_PER_WORKER, managed - offset)) : 0
    const plots = Array.from({ length: plotCount }, (_, index) => offset + index)
    offset += plotCount
    const working = plots.some(index => cropFor(data.plots[index]?.crop) !== null)
    workers.push({ id: worker.id, role, roleLabel: role === 'harvest' ? '收菜' : '巡逻', locked: worker.locked === true,
      plots, plotCount, status: !helper.enabled ? 'paused' : role === 'patrol' ? 'patrol' : working ? 'working' : 'idle' })
  }
  return { hired: helper.hired, enabled: helper.enabled, plots: managed, stored: helperCount(data), usedHours: helper.usedMs / 3600000,
    capacityHours: null, full: false, continuous: helper.enabled, seedless, missing: [...new Set(missing)].map(key => cropFor(key).label),
    count: helper.workers.length, max: HELPER_MAX, canHire: helper.workers.length < HELPER_MAX,
    hirePrice: HELPER_PRICES.hire, schedule: helper.schedule, workers }
}
/** 托管地照常按真实时间长大：只多一句「帮工在看着」，不改 progress / remainingMs / stage（view.js 已经铺好真实值）。 */
export function helperPlotView(data, index, state) {
  if (!data.helper.enabled || index >= helperPlots(data) || state === null || state.ripe || state.withered) return {}
  return { helperNote: '帮工照料中', pests: [] }
}
export function helperShelf(data, balance) {
  const helper = data.helper
  // 农具档（旧帮工仓库）2026-10-14 起下架，只卖管地数一档。
  const level = helper.hired ? helper.level + 1 : null
  const price = helper.hired ? HELPER_PRICES.level[level] : HELPER_PRICES.hire
  if (price === undefined) return []
  const label = helper.hired ? ['帮工猪', '熟练帮工', '老练帮工'][level] : '雇帮工猪'
  const note = helper.hired ? '管 ' + HELPER_PLOTS[level] + ' 块地' : '管 ' + HELPER_PLOTS[0] + ' 块地'
  return [{ key: helper.hired ? 'helper-level' : 'helper-hire', emoji: '🐷', label, note, price, disabled: balance < price, pick: null }]
}
export function helperBuy(data, payload, api) {
  const helper = data.helper
  const kind = String(payload?.item).replace('helper-', '')
  if (kind === 'hire') {
    if (helper.hired) return { ok: false, reason: 'owned' }
    if (!purse(api).spend(HELPER_PRICES.hire, 'helper')) return { ok: false, reason: 'poor' }
    helper.hired = true
    helper.enabled = true
    // 首雇补齐 workers（hired ⇔ 至少一只）。旧档/旧测试用 level 表达已买的档位，这里按等级补 1/2/4 只；
    // 新档 level 恒为 0，只有 1 只。Slice 1 会换成 1500/只的追加雇佣，不再读 level。
    helper.workers = helperWorkerList(helper.level)
    helper.lastAt = api.now
  } else {
    // 农具档已下架：helper-barn 一律拒，别再让玩家买到没有效果的档位。
    if (kind !== 'level' || !helper.hired) return { ok: false, reason: 'locked' }
    // v7 起覆盖只看 workers，旧「管地数」档不再改变任何效果：Slice 0 先拒绝且不扣钱，
    // 不让玩家花 2000/6000 买一个空升级（Slice 1 会把它换成追加雇佣/角色按钮）。
    return { ok: false, reason: 'unavailable' }
  }
  return { ok: true }
}

/** 在动作入口已结算到 api.now 后切换整个帮工托管；暂停时保留较新的检查点。 */
export function toggleHelper(data, payload, api) {
  const helper = data.helper
  if (!helper.hired) return { ok: false, reason: 'locked' }
  if (typeof payload?.enabled !== 'boolean') return { ok: false, reason: 'unavailable' }
  if (payload.enabled === helper.enabled) return { ok: false, reason: 'already' }
  helper.enabled = payload.enabled
  if (Number.isFinite(api?.now)) helper.lastAt = Number.isFinite(helper.lastAt) ? Math.max(helper.lastAt, api.now) : api.now
  return { ok: true, enabled: helper.enabled }
}
/** 收仓：只把帮工仓里的收成搬进玩家仓库，地块和生长时间一个都不动。 */
export function collectHelper(data) {
  if (!helperCount(data)) return { ok: false, reason: 'empty' }
  for (const crop of CROPS) data.harvest[crop.key] = amountFor(data, 'harvest', crop.key) + data.helper.stock[crop.key]
  data.helper.stock = Object.fromEntries(CROPS.map(crop => [crop.key, 0]))
  return { ok: true }
}
