// @ts-check
// 帮工精力 / 班次（v8）：常量、相位、精力纯函数、错峰、休息 / 工作锚点和名单合成。
// 这里不碰地块结算，也不做覆盖判断；coverage / settle / helper 三个模块共用这一套时钟。
import { HOUR_MS } from './data.js'
import { count } from './pure.js'

/** 旧等级管的地数：4 / 8 / 16 块。v7 起只作为迁移映射用，覆盖块数由在岗收菜帮工只数算。 */
export const HELPER_PLOTS = [4, 8, 16]
/** 最多雇几只帮工（v7）。 */
export const HELPER_MAX = 5
/** 每只收菜帮工管几块地（v7）；巡逻型不占地。 */
export const HELPER_PLOTS_PER_WORKER = 4
/** 历史常量：旧批次配方的目标占比（自己种的九成）。自然托管按真实生长算收成，结算不再读它。 */
export const HELPER_SHARE = 0.9
/** 历史常量：旧六小时封仓窗口。自然托管没有工作时间预算，结算不再读它。 */
export const HELPER_WINDOW = 6 * 3600000
/**
 * 雇佣价（2026-11-04 用户拍板）：首雇和追加都是 1500/只，最多 5 只。
 * `level` 只为旧导出形状保留，旧「管地数」升级档不再出售，也不参与任何结算。
 */
export const HELPER_PRICES = { hire: 1500, additional: 1500, level: [0, 2000, 6000] }

/** 满精力干到 0 需要 3 小时（速率 100%/3h）。 */
export const HELPER_WORK_MS = 3 * HOUR_MS
/** 0 精力恢复到 100% 需要 2 小时（速率 100%/2h）。 */
export const HELPER_REST_MS = 2 * HOUR_MS
/** 精力低于 20% 强制休息；此时工作窗实际 2.4h、休息窗 1.6h。 */
export const HELPER_REST_AT = 0.2
/** 从 100% 工作到 20% 的时长：2.4h。 */
export const HELPER_WORK_WINDOW_MS = HELPER_WORK_MS * (1 - HELPER_REST_AT)
/** 从 20% 休息回 100% 的时长：1.6h。 */
export const HELPER_REST_WINDOW_MS = HELPER_REST_MS * (1 - HELPER_REST_AT)
/** 一个完整班次周期：4h（2.4h 工作 + 1.6h 休息）。 */
export const HELPER_CYCLE_MS = HELPER_WORK_WINDOW_MS + HELPER_REST_WINDOW_MS
/** 同角色第 k 只的错峰间隔：30 分钟。 */
export const HELPER_STAGGER_MS = HELPER_WORK_MS / 6

/**
 * 测试缝：`false` 时结算不按精力跳过、也不做没活睡觉，覆盖回到 v7 的「4 × 收菜只数」静态分片。
 * 只给旧的自然托管 / 多帮工用例保持原语义；产品代码不要调用。默认开。
 */
let energyOn = true
export function setHelperEnergy(on) { energyOn = on !== false }
export const helperEnergyEnabled = () => energyOn

export const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
export const finiteOr = (value, fallback) => (Number.isFinite(value) ? value : fallback)

/** 同角色内第 k 只的错峰相位：0 / 30 / 60 / 90 / 120 分钟；永远小于工作窗，新雇不会一进门就睡。 */
export function helperShiftOffset(roleIndex) {
  // 5 只同角色最多 2h，仍高于 20% 工作窗，所以新雇一定是在岗而不是一进门就睡。
  return Math.min(HELPER_WORK_WINDOW_MS - 1, Math.max(0, count(roleIndex) * HELPER_STAGGER_MS))
}

/** 班次相位：0 = 满精力刚上班；[0,2.4h) 工作；[2.4h,4h) 休息。 */
export function helperPhaseAt(worker, at) {
  const shiftAt = worker?.shiftAt
  if (!Number.isFinite(shiftAt)) return 0
  const raw = (at - shiftAt) % HELPER_CYCLE_MS
  return raw < 0 ? raw + HELPER_CYCLE_MS : raw
}
/** 班表上是否在岗（不管有没有活、是否手动休息）。 */
export function helperWorkingAt(worker, at) {
  return helperPhaseAt(worker, at) < HELPER_WORK_WINDOW_MS
}
/** 班表精力 0..1；20% 是工作/休息的分界。 */
export function helperEnergyAt(worker, at) {
  const phase = helperPhaseAt(worker, at)
  return phase < HELPER_WORK_WINDOW_MS
    ? 1 - phase / HELPER_WORK_MS
    : HELPER_REST_AT + (phase - HELPER_WORK_WINDOW_MS) / HELPER_REST_MS
}
/** 下一次上班的时刻；已经在岗就返回 at 本身。 */
export function helperNextWorkAt(worker, at) {
  const phase = helperPhaseAt(worker, at)
  return phase < HELPER_WORK_WINDOW_MS ? at : at + (HELPER_CYCLE_MS - phase)
}
/** 强制休息（手动 / 暂停 / 没活）时的精力：从休息锚点单调回升，满 100% 后停住。 */
export function helperRestEnergyAt(worker, at) {
  const start = finiteOr(worker?.shiftAt, at)
  return clamp01(HELPER_REST_AT + (at - start) / HELPER_REST_MS)
}
/** 给下一阶段巡逻防御用：at 时刻在岗的巡逻只数（本阶段只导出，不接线）。 */
export function helperPatrolOnDuty(data, at = Date.now()) {
  if (!data.helper.enabled) return 0
  return (data.helper.workers || []).filter(worker => worker.role === 'patrol' && worker.resting !== true && worker.idle !== true && helperWorkingAt(worker, at)).length
}

/** 把当前精力 e 写成一个「休息锚点」，让 helperRestEnergyAt(now) 正好等于 e。 */
export function helperRestAnchor(at, energy) {
  return at - (Math.max(HELPER_REST_AT, clamp01(energy)) - HELPER_REST_AT) * HELPER_REST_MS
}
/** 把当前精力 e 写成一个「工作锚点」，让 helperEnergyAt(now) 正好等于 e。 */
export function helperWorkAnchor(at, energy) {
  return at - (1 - Math.max(HELPER_REST_AT, clamp01(energy))) * HELPER_WORK_MS
}

/**
 * 旧档按等级补几只收菜帮工（D1 = A，2026-11-04 用户拍板）：level 0/1/2 → 1/2/4 只，
 * 所以旧档的 4/8/16 块覆盖原样保住。只用于迁移/防御式合成，不再参与日常覆盖计算。
 */
export const helperWorkersForLevel = level => HELPER_PLOTS[Math.min(2, count(level))] / HELPER_PLOTS_PER_WORKER
/** 合成一份收菜帮工名单；hiredAt 留 null（旧档没有真实雇佣时间，不编）。anchor 用来补班次起点。 */
export function helperWorkerList(level = 0, anchor = null) {
  const n = Math.max(1, Math.min(HELPER_MAX, helperWorkersForLevel(level)))
  return Array.from({ length: n }, (_, index) => ({
    id: index + 1, role: 'harvest', locked: false, hiredAt: null,
    shiftAt: Number.isFinite(anchor) ? anchor - helperShiftOffset(index) : null,
    resting: false, idle: false,
  }))
}
/** 帮工此刻的展示精力：暂停 / 手动休息 / 没活睡觉都按休息锚点回升，其余按班次。 */
export function helperWorkerEnergy(data, worker, at) {
  if (!data.helper.enabled || worker.resting === true || worker.idle === true) return helperRestEnergyAt(worker, at)
  return helperEnergyAt(worker, at)
}
