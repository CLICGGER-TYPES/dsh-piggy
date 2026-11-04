// @ts-check
// 巡逻区（v9）：4 块地一区，按地块绝对序号连续切；第 k 只巡逻守第 k 区。
// 只有「在岗」才算有人守：休息 / 手动休息 / 没活睡觉 / 托管暂停都留空档，不接管、不叠加。
// 这里只算分区和覆盖快照，不碰地块结算；偷窃事件在 theft.js。
import { helperEnergyEnabled, helperWorkingAt } from './helper-energy.js'

/** 一区几块地：和「一只收菜帮工管 4 块」同单位；18 块刚好 5 区。 */
export const HELPER_PATROL_ZONE_PLOTS = 4

/** 地块 -> 区（0-based）。区是逻辑分区，不随巡逻只数或开垦重切。 */
export const patrolZoneOf = index => Math.floor(Math.max(0, Number(index) || 0) / HELPER_PATROL_ZONE_PLOTS)

/** 当前已开垦地有几区；至少 1 区，方便 UI 显示。 */
export const patrolZoneCount = data => Math.max(1, Math.ceil(Math.max(1, Number(data?.unlocked) || 1) / HELPER_PATROL_ZONE_PLOTS))

/** 巡逻帮工名单：按雇佣/重编号顺序，第 k 只守第 k 区。 */
export const helperPatrolWorkers = data => (Array.isArray(data?.helper?.workers) ? data.helper.workers : []).filter(worker => worker.role === 'patrol')

/** 第 zone 区归哪只巡逻；没有就是 null。多出的巡逻（区不够）返回 null。 */
export function patrolOwnerOfZone(data, zone) {
  const index = Math.floor(Number(zone))
  if (!Number.isSafeInteger(index) || index < 0 || index >= patrolZoneCount(data)) return null
  return helperPatrolWorkers(data)[index] ?? null
}

/** 区的地块范围（闭区间，0-based），最后区区数可能不足 4 块。 */
export function patrolZoneRange(data, zone) {
  const from = Math.max(0, Number(zone) || 0) * HELPER_PATROL_ZONE_PLOTS
  const to = Math.min(Math.max(1, Number(data?.unlocked) || 1), from + HELPER_PATROL_ZONE_PLOTS) - 1
  return { from, to, count: Math.max(0, to - from + 1) }
}

/** 当前所有巡逻区的描述：UI 覆盖卡和 theftView 共用。 */
export function patrolZones(data) {
  const total = patrolZoneCount(data)
  const patrols = helperPatrolWorkers(data)
  return Array.from({ length: total }, (_, zone) => {
    const owner = patrols[zone] ?? null
    const { from, to, count } = patrolZoneRange(data, zone)
    return { index: zone, label: (zone + 1) + ' 区', from, to, count, patrolId: owner === null ? null : owner.id }
  })
}

/**
 * 这一区在 at 时刻的状态：guarded / resting / idle / paused / unassigned。
 * 在岗口径内联在这里（不看收菜覆盖池，也不给「任意一只在岗」开后门）：
 * 启用 + 没手动休息 + 没睡 + 班次在工作窗。测试缝关掉精力时只看前三条。
 */
export function zoneGuardState(data, zone, at) {
  const owner = patrolOwnerOfZone(data, zone)
  if (owner === null) return 'unassigned'
  if (!data?.helper?.hired || !data?.helper?.enabled) return 'paused'
  if (owner.resting === true) return 'resting'
  if (owner.idle === true) return 'idle'
  if (!helperEnergyEnabled()) return 'guarded'
  return helperWorkingAt(owner, at) ? 'guarded' : 'resting'
}

/** 事件时刻这一区有没有人在岗。只在事件时刻取快照，不看 now。 */
export const zoneGuardedAt = (data, zone, at) => zoneGuardState(data, zone, at) === 'guarded'
