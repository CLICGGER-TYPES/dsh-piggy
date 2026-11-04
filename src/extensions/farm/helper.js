// @ts-check
// 帮工猪公开 API：价格/常量再导出、normalize、商店、view、角色/排班/手动休息、暂停与收仓。
// 精力时钟在 helper-energy.js，覆盖池在 helper-coverage.js，结算在 helper-settle.js；这里只做组装。
import { CROPS, PLOTS } from './data.js'
import { purse } from './host.js'
import { amountFor } from './plot-rules.js'
import { count, cropFor, isObject } from './pure.js'
import {
  HELPER_MAX, HELPER_PLOTS, HELPER_PLOTS_PER_WORKER, HELPER_PRICES, HELPER_REST_AT, HELPER_REST_MS,
  HELPER_SHARE, HELPER_WINDOW, HELPER_WORK_MS, finiteOr, helperRestAnchor, helperRestEnergyAt, helperShiftOffset, helperWorkerEnergy,
  helperWorkerList, helperWorkAnchor,
} from './helper-energy.js'
import {
  helperAssignments, helperFullPlots, helperHasWork, helperPlots, helperTargetCropFor,
  helperWorkerOnDuty, helperWorkerState,
} from './helper-coverage.js'
import { settleHelper } from './helper-settle.js'

export {
  HELPER_CYCLE_MS, HELPER_MAX, HELPER_PLOTS, HELPER_PLOTS_PER_WORKER, HELPER_PRICES, HELPER_REST_AT,
  HELPER_REST_MS, HELPER_REST_WINDOW_MS, HELPER_SHARE, HELPER_STAGGER_MS, HELPER_WINDOW, HELPER_WORK_MS,
  HELPER_WORK_WINDOW_MS, helperEnergyAt, helperEnergyEnabled, helperNextWorkAt, helperPatrolOnDuty,
  helperRestEnergyAt, helperShiftOffset, helperWorkerEnergy, helperWorkerList, helperWorkersForLevel,
  helperWorkingAt, setHelperEnergy,
} from './helper-energy.js'
export {
  helperAssignments, helperFullPlots, helperHarvestWorkers, helperHasWork, helperPlots,
  helperLegacyAssignments, helperWorkerOnDuty, helperWorkerState,
} from './helper-coverage.js'
export { settleHelper } from './helper-settle.js'

/**
 * 归一化只做幂等清理：旧批次清成 null、工作预算清成 0，不动已经种下的地块，也不发果。
 * v8 顺带夹取 workers（最多 5 只、连续重编号、只认 harvest / patrol）并派生 hired；
 * shiftAt 缺失时按角色内序号从 lastAt（没有就用 now）补；resting / idle 只认严格 true。
 * 旧档或「被 4.2.x 旧 normalize 丢过 workers」的档按等级补回 1/2/4 只，避免永久变成没帮工。
 */
export function normalizeHelper(data, now = Date.now()) {
  const raw = isObject(data.helper) ? data.helper : {}
  const level = Math.min(2, count(raw.level))
  const barn = Math.min(3, count(raw.barn)) // 农具档已下架：只读取、只 clamp；紧接着 refundOldBarn 按档位退款并清零
  const anchor = finiteOr(raw.lastAt, now)
  const seen = { harvest: 0, patrol: 0 }
  let workers = (Array.isArray(raw.workers) ? raw.workers : [])
    .filter(isObject)
    .slice(0, HELPER_MAX)
    .map((worker, index) => {
      const role = worker.role === 'patrol' ? 'patrol' : 'harvest'
      const roleIndex = seen[role]++
      return {
        id: index + 1, // 连续重编号：id 只给 UI/动作定位，别信存档里的旧 id
        role,
        locked: worker.locked === true,
        hiredAt: Number.isFinite(worker.hiredAt) ? worker.hiredAt : null,
        shiftAt: Number.isFinite(worker.shiftAt) ? worker.shiftAt : (Number.isFinite(anchor) ? anchor - helperShiftOffset(roleIndex) : null),
        resting: worker.resting === true,
        idle: worker.idle === true,
      }
    })
  if (raw.hired === true && workers.length === 0) workers = helperWorkerList(level, anchor)
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

/**
 * 面板用的帮工状态：老字段一个不少（还剩 full / usedHours / capacityHours），自然托管下 full 恒为 false、continuous 恒为 true。
 * v8 新增 onDuty/resting/restUntil/activePlots/energy；workers 里的 energy/state/restRemainingMs/workRemainingMs 只展示，不写存档。
 */
export function helperView(data, now = Date.now()) {
  const helper = data.helper
  if (!Number.isFinite(now)) now = Date.now()
  const assignments = helperAssignments(data, now)
  const managed = assignments.total
  const capacity = helperFullPlots(data)
  const hasWork = helperHasWork(data)
  const diagnosticPlots = Math.max(managed, capacity)
  const missing = helper.targets.slice(0, diagnosticPlots).filter((key, index) => key && (!data.plots[index] || data.plots[index].fallow) && amountFor(data, 'seeds', key) === 0)
  // 没在干活的两种原因：管区里没有在长的作物，也没有任何「这块地指定的作物」的种子（不替玩家挑种子）。
  const seedless = diagnosticPlots > 0 && !data.plots.slice(0, diagnosticPlots).some(plot => cropFor(plot?.crop)) &&
    !helper.targets.slice(0, diagnosticPlots).some(key => key && amountFor(data, 'seeds', key) > 0)
  const workers = []
  let onDuty = 0
  let resting = 0
  let restUntil = null
  let energySum = 0
  for (const worker of helper.workers) {
    const role = worker.role === 'patrol' ? 'patrol' : 'harvest'
    const plots = assignments.plots.get(worker.id) ?? []
    const plotCount = role === 'harvest' ? plots.length : 0
    const onDutyNow = helperWorkerOnDuty(data, worker, now, hasWork)
    const hasPlotWork = role === 'harvest' && plots.some(index => cropFor(data.plots[index]?.crop) !== null ||
      (helperTargetCropFor(data, index) !== null && amountFor(data, 'seeds', helperTargetCropFor(data, index).key) > 0))
    const state = helperWorkerState(data, worker, now, hasWork, hasPlotWork)
    const energy = Math.max(0, Math.min(1, helperWorkerEnergy(data, worker, now)))
    const working = onDutyNow
    const status = !helper.enabled ? 'paused' : state === 'resting' ? 'resting' : role === 'patrol' ? 'patrol' : hasPlotWork ? 'working' : 'idle'
    const restRemainingMs = state === 'resting' ? Math.max(0, Math.round((1 - energy) * HELPER_REST_MS)) : 0
    const workRemainingMs = state === 'working' ? Math.max(0, Math.round((energy - HELPER_REST_AT) * HELPER_WORK_MS)) : 0
    if (onDutyNow) onDuty += 1
    if (state === 'resting') {
      resting += 1
      if (restRemainingMs > 0) restUntil = restUntil === null ? now + restRemainingMs : Math.min(restUntil, now + restRemainingMs)
    }
    energySum += energy
    workers.push({
      id: worker.id, role, roleLabel: role === 'harvest' ? '收菜' : '巡逻', locked: worker.locked === true,
      plots, plotCount, status, state, working, energy: Math.round(energy * 1000) / 1000,
      restRemainingMs, workRemainingMs, shiftAt: worker.shiftAt, resting: worker.resting === true, idle: worker.idle === true,
    })
  }
  return { hired: helper.hired, enabled: helper.enabled, plots: managed, stored: helperCount(data), usedHours: helper.usedMs / 3600000,
    capacityHours: null, full: false, continuous: helper.enabled, seedless, missing: [...new Set(missing)].map(key => cropFor(key).label),
    count: helper.workers.length, max: HELPER_MAX, canHire: helper.workers.length < HELPER_MAX,
    hirePrice: HELPER_PRICES.hire, schedule: helper.schedule,
    onDuty, resting, restUntil, activePlots: managed,
    energy: workers.length === 0 ? 0 : Math.round(energySum / workers.length * 1000) / 1000,
    workers }
}
/** 托管地照常按真实时间长大：只多一句「帮工在看着」，不改 progress / remainingMs / stage（view.js 已经铺好真实值）。 */
export function helperPlotView(data, index, state, now = Date.now()) {
  if (!data.helper.enabled || index >= helperPlots(data, now) || state === null || state.ripe || state.withered) return {}
  return { helperNote: '帮工照料中', pests: [] }
}
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
export function helperShelf(data, balance) {
  const helper = data.helper
  // 2026-11-04 用户拍板：首雇 1500，之后每只追加也是 1500，最多 5 只；满 5 只就不产条目。
  // 旧的「管地数」升级档（helper-level）和农具档（helper-barn）都不再出售。
  if (!helper.hired) {
    const price = HELPER_PRICES.hire
    return [{ key: 'helper-hire', emoji: '🐷', label: '雇帮工猪', note: '管 ' + HELPER_PLOTS_PER_WORKER + ' 块地', price, disabled: balance < price, pick: null }]
  }
  if (helper.workers.length >= HELPER_MAX) return []
  const price = HELPER_PRICES.additional
  return [{ key: 'helper-additional', emoji: '🐷', label: '再雇一只帮工猪', note: '收菜 ' + HELPER_PLOTS_PER_WORKER + ' 块地 / 可改巡逻', price, disabled: balance < price, pick: null }]
}
export function helperBuy(data, payload, api) {
  const helper = data.helper
  const kind = String(payload?.item).replace('helper-', '')
  if (kind !== 'hire' && kind !== 'additional') {
    // 旧「管地数」升级（helper-level）和农具档（helper-barn）：一律拒绝，且绝不扣钱。
    return { ok: false, reason: 'unavailable' }
  }
  if (kind === 'additional') {
    if (!helper.hired) return { ok: false, reason: 'locked' }
    if (helper.workers.length >= HELPER_MAX) return { ok: false, reason: 'limit' }
  } else if (helper.hired) return { ok: false, reason: 'owned' }
  const price = kind === 'hire' ? HELPER_PRICES.hire : HELPER_PRICES.additional
  if (!purse(api).spend(price, 'helper')) return { ok: false, reason: 'poor' }
  const now = Number.isFinite(api?.now) ? api.now : Date.now()
  // 默认角色要在加进名单前算：helperPlots 反映现有收菜帮工的覆盖。
  const role = helperDefaultRole(data, now)
  const roleIndex = helper.workers.filter(worker => worker.role === role).length
  helper.workers.push({
    id: helper.workers.length + 1, role, locked: false, hiredAt: Number.isFinite(api?.now) ? api.now : null,
    shiftAt: now - helperShiftOffset(roleIndex), resting: false, idle: false,
  })
  helper.hired = true
  helper.enabled = true
  // 首雇从当下开始托管；追加不移动检查点（入口已结算到 api.now，新管区从当下开始）。
  if (kind === 'hire') helper.lastAt = api.now
  return { ok: true }
}
/** 新雇默认角色：自动排班且收菜已铺满已开垦地时去巡逻，其余先收菜；手动排班一律收菜。 */
function helperDefaultRole(data, now = Date.now()) {
  return data.helper.schedule === 'auto' && helperPlots(data, now) >= data.unlocked ? 'patrol' : 'harvest'
}
/**
 * 改一只帮工的角色（收菜 / 巡逻）：成功即锁定，自动排班以后也不会再改它。非法 id / role 一律 unavailable。
 * 班次锚点保留（换岗不重置精力、也不补满）；覆盖按新角色在下次 view / 结算重算，lastAt 钉在当下不追溯。
 */
export function setHelperRole(data, payload, api) {
  const helper = data.helper
  const role = payload?.role
  if (role !== 'harvest' && role !== 'patrol') return { ok: false, reason: 'unavailable' }
  const id = Number(payload?.id)
  const worker = Number.isInteger(id) ? helper.workers.find(entry => entry.id === id) : undefined
  if (worker === undefined) return { ok: false, reason: 'unavailable' }
  if (worker.role === role) return { ok: false, reason: 'already' }
  worker.role = role
  worker.locked = true
  // 覆盖分片变了：入口已经结算到 now；全巡逻时也把检查点钉在当下，改回收菜不追溯那段空档。
  if (helper.enabled && Number.isFinite(api?.now)) helper.lastAt = Number.isFinite(helper.lastAt) ? Math.max(helper.lastAt, api.now) : api.now
  return { ok: true, role }
}
/** 排班只影响以后雇佣的默认角色；auto 不会清掉已经锁定的帮工，manual 也不会。 */
export function setHelperSchedule(data, payload) {
  const mode = payload?.mode
  if (mode !== 'auto' && mode !== 'manual') return { ok: false, reason: 'unavailable' }
  if (data.helper.schedule === mode) return { ok: false, reason: 'already' }
  data.helper.schedule = mode
  return { ok: true, mode }
}

/**
 * 手动让一只帮工休息 / 提前恢复（2026-11-04 D2/D3）。
 * payload：{ id, resting: true|false }（兼容 { rest: true|false }）。
 * - 休息：写 resting，休息锚点从当前精力续上；暂停中也可以先标记。
 * - 恢复：精力 ≤20% 拒绝（too-tired），不能手动绕过强制休息；≥20% 时按当前精力接回工作。
 */
export function setHelperRest(data, payload, api) {
  const helper = data.helper
  const id = Number(payload?.id)
  const worker = Number.isInteger(id) ? helper.workers.find(entry => entry.id === id) : undefined
  if (worker === undefined) return { ok: false, reason: 'unavailable' }
  const wanted = typeof payload?.resting === 'boolean' ? payload.resting : payload?.rest
  if (typeof wanted !== 'boolean') return { ok: false, reason: 'unavailable' }
  const now = Number.isFinite(api?.now) ? api.now : Date.now()
  if (wanted) {
    if (worker.resting === true) return { ok: false, reason: 'already' }
    worker.resting = true
    worker.idle = false
    worker.shiftAt = helperRestAnchor(now, helperWorkerEnergy(data, worker, now))
  } else {
    if (worker.resting !== true) return { ok: false, reason: 'already' }
    const energy = helperRestEnergyAt(worker, now)
    if (energy <= HELPER_REST_AT) return { ok: false, reason: 'too-tired' }
    worker.resting = false
    if (helperHasWork(data)) {
      worker.idle = false
      worker.shiftAt = helperWorkAnchor(now, energy)
    } else {
      worker.idle = true
      worker.shiftAt = helperRestAnchor(now, energy)
    }
  }
  if (helper.enabled && Number.isFinite(api?.now)) helper.lastAt = Number.isFinite(helper.lastAt) ? Math.max(helper.lastAt, api.now) : api.now
  return { ok: true, resting: worker.resting }
}

/**
 * 在动作入口已结算到 api.now 后切换整个帮工托管。
 * v8（用户 D6）：暂停 = 全部休息，精力按时间恢复；恢复时按当前精力接回工作（≥20%）或继续休息。
 */
export function toggleHelper(data, payload, api) {
  const helper = data.helper
  if (!helper.hired) return { ok: false, reason: 'locked' }
  if (typeof payload?.enabled !== 'boolean') return { ok: false, reason: 'unavailable' }
  if (payload.enabled === helper.enabled) return { ok: false, reason: 'already' }
  const now = Number.isFinite(api?.now) ? api.now : Date.now()
  if (payload.enabled === false) {
    // 暂停：所有人切到休息锚点，保留当前精力；不推进 lastAt（沿用暂停语义）。
    for (const worker of helper.workers) {
      if (worker.resting === true) continue
      const energy = helperWorkerEnergy(data, worker, now)
      worker.idle = false
      worker.shiftAt = helperRestAnchor(now, energy)
    }
    helper.enabled = false
  } else {
    helper.enabled = true
    const hasWork = helperHasWork(data)
    for (const worker of helper.workers) {
      if (worker.resting === true) continue
      const energy = helperRestEnergyAt(worker, now)
      if (hasWork && energy > HELPER_REST_AT) {
        worker.idle = false
        worker.shiftAt = helperWorkAnchor(now, energy)
      } else {
        worker.idle = true
        worker.shiftAt = helperRestAnchor(now, energy)
      }
    }
  }
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
