// @ts-check
// 帮工覆盖池（v8）：只统计在岗收菜帮工。休息 / 暂停 / 没活睡觉都会释放地块，
// 其他在岗收菜按「有作物 > 可补种 > 其他空地」稳定排序接管；总数 = min(已开垦, 4 × 在岗收菜只数)。
import { amountFor } from './plot-rules.js'
import { cropFor } from './pure.js'
import {
  HELPER_PLOTS_PER_WORKER, HELPER_REST_AT, helperEnergyAt, helperEnergyEnabled, helperWorkingAt,
} from './helper-energy.js'

/** 收菜帮工只数：只有它们占地，巡逻 0 块。 */
export const helperHarvestWorkers = data => (Array.isArray(data.helper.workers) ? data.helper.workers : []).filter(worker => worker.role === 'harvest').length

/** 满编（所有收菜帮工都算在岗）时的潜在覆盖：4 × 收菜只数，封顶已开垦数。 */
export function helperFullPlots(data) {
  return data.helper.hired ? Math.min(data.unlocked, HELPER_PLOTS_PER_WORKER * helperHarvestWorkers(data)) : 0
}

/** 这块地原本指定的作物：在长就认地里的，空着就认 helper.targets。 */
export function helperTargetCropFor(data, index) {
  const plot = data.plots[index]
  const growing = cropFor(plot?.crop)
  if (growing !== null) return growing
  return cropFor(data.helper.targets?.[index])
}

/** 托管池里还有没有活：有作物（含枯苗等待清理）或「指定作物 + 有种子」的空地。 */
export function helperHasWork(data) {
  const full = helperFullPlots(data)
  for (let index = 0; index < full; index += 1) {
    const plot = data.plots[index]
    if (cropFor(plot?.crop) !== null) return true
    const target = helperTargetCropFor(data, index)
    if (target !== null && amountFor(data, 'seeds', target.key) > 0) return true
  }
  return false
}

/** 一只帮工此刻是否在岗：没暂停、没手动休息、没睡、班表在工作窗、农场有活。 */
export function helperWorkerOnDuty(data, worker, at, hasWork = helperHasWork(data)) {
  if (!data.helper.enabled || worker.resting === true || worker.idle === true) return false
  if (!helperEnergyEnabled()) return true
  if (!hasWork) return false
  return helperWorkingAt(worker, at)
}

/** 工作优先排序：有作物的地最优先，其次是「指定了作物且有种子」的空地，最后才是其它空地。 */
function plotWorkRank(data, index) {
  const plot = data.plots[index]
  if (cropFor(plot?.crop) !== null) return 0
  const target = helperTargetCropFor(data, index)
  return target !== null && amountFor(data, 'seeds', target.key) > 0 ? 1 : 2
}

/**
 * 当前覆盖池：只算在岗收菜帮工。总数 = min(已开垦, 4 × 在岗收菜只数)；
 * 地块按「有活优先」稳定排序，再按收菜顺序轮流分给在岗帮工（每只最多 4 块）。
 */
export function helperAssignments(data, at = Date.now()) {
  if (!helperEnergyEnabled()) return helperLegacyAssignments(data)
  const workers = Array.isArray(data.helper.workers) ? data.helper.workers : []
  const harvest = workers.filter(worker => worker.role === 'harvest')
  const full = helperFullPlots(data)
  const empty = { total: 0, covered: new Set(), plots: new Map(), onDuty: [] }
  if (!data.helper.hired || full === 0) return empty
  const hasWork = helperHasWork(data)
  const onDuty = hasWork ? harvest.filter(worker => helperWorkerOnDuty(data, worker, at, true)) : []
  const total = Math.min(full, HELPER_PLOTS_PER_WORKER * onDuty.length)
  if (total === 0) return empty
  const candidates = Array.from({ length: full }, (_, index) => index)
    .sort((left, right) => plotWorkRank(data, left) - plotWorkRank(data, right) || left - right)
  const plots = new Map(onDuty.map(worker => [worker.id, []]))
  let cursor = 0
  while (cursor < total) {
    for (const worker of onDuty) {
      if (cursor >= total) break
      const index = candidates[cursor]
      cursor += 1
      plots.get(worker.id).push(index)
    }
  }
  return { total, covered: new Set(candidates.slice(0, total)), plots, onDuty }
}

/** 静态满编分片：v7 兼容 / 测试缝关闭精力 / v5 迁移结算使用。 */
export function helperLegacyAssignments(data) {
  const workers = Array.isArray(data.helper.workers) ? data.helper.workers : []
  const harvest = workers.filter(worker => worker.role === 'harvest')
  const full = helperFullPlots(data)
  const empty = { total: 0, covered: new Set(), plots: new Map(), onDuty: [] }
  if (!data.helper.hired || full === 0) return empty
  const plots = new Map()
  let offset = 0
  for (const worker of harvest) {
    const count = Math.max(0, Math.min(HELPER_PLOTS_PER_WORKER, full - offset))
    plots.set(worker.id, Array.from({ length: count }, (_, index) => offset + index))
    offset += count
  }
  const total = Math.min(full, offset)
  return { total, covered: new Set(Array.from({ length: total }, (_, index) => index)), plots, onDuty: harvest }
}

/** 帮工覆盖的地块数：4 × 在岗收菜只数，封顶已开垦数；没雇就是 0。 */
export function helperPlots(data, at = Date.now()) {
  return helperAssignments(data, at).total
}

/** 一只帮工面板用的状态：working / resting / idle / paused（旧 status 仍保留 working/patrol/idle/resting/paused）。 */
export function helperWorkerState(data, worker, at, hasWork = helperHasWork(data), busy = false) {
  if (!data.helper.enabled) return 'paused'
  if (!helperEnergyEnabled()) return busy ? 'working' : 'idle'
  if (worker.resting === true || worker.idle === true) return 'resting'
  if (!hasWork) return 'resting'
  if (!helperWorkingAt(worker, at)) return 'resting'
  if (helperEnergyAt(worker, at) <= HELPER_REST_AT) return 'resting'
  return busy ? 'working' : 'idle'
}
