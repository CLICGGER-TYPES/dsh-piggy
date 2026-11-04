// @ts-check
// 帮工自然托管结算（v8）：按真实成熟时刻一件件处理；只处理在岗覆盖池里的地，
// 没活就睡、来活且精力 ≥20% 再醒；暂停直接 return，精力由休息锚点在 view 里恢复。
import { EXP_CAP, PESTS, REGROW_AT } from './data.js'
import { plantPlot, recordHarvest } from './plot-rules.js'
import { cropFor, droughtAt, isObject, nextPest, plotState, ripeAt, seasonMs, sow, stableRandom, weatherAt } from './pure.js'
import {
  HELPER_CYCLE_MS, HELPER_REST_AT, HELPER_REST_MS, HELPER_WORK_WINDOW_MS,
  helperEnergyAt, helperEnergyEnabled, helperPhaseAt, helperRestAnchor, helperRestEnergyAt, helperWorkAnchor,
} from './helper-energy.js'
import { helperAssignments, helperFullPlots, helperHasWork, helperLegacyAssignments } from './helper-coverage.js'

/** 一次结算最多处理多少件农活：防坏存档把扩展卡死；正常存档受种子数量限制，远到不了这个数。 */
const MAX_STEPS = 100000

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
function nextEventLegacy(data, helper, managed, at, now, blocked) {
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

/**
 * v8 事件：在完整潜在池里找「成熟/可补种，并且在该事件时刻落在覆盖池里」的最早一件。
 * 同一时刻的覆盖池是稳定的：收完一块不会立刻把「另外 4 块」拉进覆盖，否则一只在岗收菜
 * 能在同一次结算里连收 8 块，等于休息没有释放覆盖。
 */
function nextEventDynamic(data, at, now, blocked, coverage) {
  let pick = null
  for (const index of coverage.covered) {
    if (blocked.has(index)) continue
    const plot = data.plots[index]
    const crop = cropFor(plot?.fallow === true || plot?.withered === true ? null : plot?.crop)
    const when = crop === null ? at : Math.max(at, ripeAt(plot, crop))
    if (when > now) continue
    if (when > at && !helperAssignments(data, when).covered.has(index)) continue
    if (pick === null || when < pick.when) pick = { when, index, crop }
  }
  return pick
}

/** 没事件时，找到下一次「在岗收菜变多」的班次边界；把离线期间醒来的那一段也结算掉。 */
function nextCoverageAt(data, at, now) {
  if (!helperEnergyEnabled() || at >= now) return null
  const before = helperAssignments(data, at).onDuty.length
  const harvest = (data.helper.workers || []).filter(worker => worker.role === 'harvest')
  const horizon = Math.min(now, at + HELPER_CYCLE_MS + 1)
  const points = new Set()
  for (const worker of harvest) {
    if (worker.resting === true || worker.idle === true) continue
    let cursor = at
    for (let step = 0; step < 6; step += 1) {
      const phase = helperPhaseAt(worker, cursor)
      const delta = phase < HELPER_WORK_WINDOW_MS ? HELPER_WORK_WINDOW_MS - phase : HELPER_CYCLE_MS - phase
      cursor += Math.max(1, delta)
      if (cursor > horizon) break
      points.add(cursor)
    }
  }
  for (const point of [...points].sort((left, right) => left - right)) {
    if (helperAssignments(data, point).onDuty.length > before) return point
  }
  return null
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
function tidy(data, now, indices) {
  for (const index of indices) {
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
const allIndices = data => Array.from({ length: helperFullPlots(data) }, (_, index) => index)

/**
 * 结算主循环：按成熟时刻一件件处理，同刻按 cursor 排队。收成用真实的成熟时刻（离线多久就补多少轮），
 * 补种用结算时钟且不早于 lastAt：没雇帮工的那段不会掉出“追溯种上”的果。
 */
function settlePlots(data, helper, start, now, awardExperience, useEnergy) {
  // 托管地在长什么就认下什么：玩家自己种的作物也归帮工按原样补种。
  for (const index of allIndices(data)) {
    const crop = cropFor(data.plots[index]?.crop)
    if (crop !== null) helper.targets[index] = crop.key
  }
  const blocked = new Set() // 这一轮种不了的地（缺种子 / 没指定作物）：别让结算空转
  let at = start
  let coverage = useEnergy ? helperAssignments(data, at) : null
  let step = 0
  for (; step < MAX_STEPS; step += 1) {
    const managed = useEnergy ? coverage.total : helperLegacyAssignments(data).total
    const next = useEnergy
      ? nextEventDynamic(data, at, now, blocked, coverage)
      : nextEventLegacy(data, helper, managed, at, now, blocked)
    if (next === null) {
      const wake = useEnergy ? nextCoverageAt(data, at, now) : null
      if (wake !== null && wake > at) { at = wake; coverage = helperAssignments(data, at); continue }
      break
    }
    if (next.when > at) {
      at = next.when
      coverage = helperAssignments(data, at)
    }
    if (useEnergy && !coverage.covered.has(next.index)) {
      const wake = nextCoverageAt(data, at, now)
      if (wake === null || wake <= at) break
      at = wake
      coverage = helperAssignments(data, at)
      continue
    }
    const effectiveManaged = Math.max(1, useEnergy ? coverage.total : managed)
    if (next.crop === null) plantHere(data, helper, effectiveManaged, next, at, blocked)
    else harvestHere(data, helper, effectiveManaged, { at: next.when, index: next.index, crop: next.crop }, awardExperience)
  }
  // 不静默丢弃超大离线存档的剩余农活：失败由宿主事务回滚，lastAt 不会被推进。
  const managed = useEnergy ? coverage.total : helperLegacyAssignments(data).total
  const remaining = useEnergy ? nextEventDynamic(data, at, now, blocked, coverage) : nextEventLegacy(data, helper, managed, at, now, blocked)
  if (step === MAX_STEPS && remaining !== null) throw new Error('菜园离线农活过多，未推进结算时间；请联系维护者检查存档。')
  const covered = useEnergy ? helperAssignments(data, now).covered : new Set(allIndices(data))
  tidy(data, now, [...covered])
}

/** 把一批 worker 切到「没活睡觉」：只补数据，不发货；休息锚点从当前精力续上。 */
function sleepWorkers(data, from, now, recovering) {
  for (const worker of data.helper.workers) {
    if (worker.resting === true) continue // 手动休息优先级更高，锚点已经在休息段
    if (worker.idle === true) continue // 已经睡着：shiftAt 就是休息锚点，别覆盖进度
    const energy = recovering && now > from
      ? Math.max(0, Math.min(1, helperEnergyAt(worker, from) + (now - from) / HELPER_REST_MS))
      : helperEnergyAt(worker, now)
    worker.idle = true
    worker.shiftAt = helperRestAnchor(now, energy)
  }
}

/** 有活来了：睡着的帮工精力 ≥20% 就醒，按当前精力接回工作锚点；不足 20% 继续睡。 */
function wakeSleepers(data, now) {
  for (const worker of data.helper.workers) {
    if (worker.idle !== true || worker.resting === true) continue
    const energy = helperRestEnergyAt(worker, now)
    if (energy <= HELPER_REST_AT) continue
    worker.idle = false
    worker.shiftAt = helperWorkAnchor(now, energy)
  }
}

/**
 * 自然托管结算：从 helper.lastAt 走到 now，按成熟时间顺序收成、补种（六块同时熟也不会漏）。
 * 只按存档里真实的 plantedAt / boostMs / season 推进；lastAt 只进不退，回拨那一段不重算、不重发。
 * v8：只结算在岗覆盖；没活干就睡，来活且精力 ≥20% 再醒；暂停时直接 return。
 */
export function settleHelper(data, now, { awardExperience = true, energy = helperEnergyEnabled() } = {}) {
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
  const useEnergy = energy === true
  const workStart = useEnergy ? helperHasWork(data) : true
  const workNow = useEnergy ? helperHasWork(data) : true
  // 有活就先叫醒上一轮睡着的帮工（≥20%）；否则它们会以 idle 状态错过这次结算。
  if (useEnergy && workNow) wakeSleepers(data, now)
  // 整段都没活：直接睡过去，精力按休息速率恢复；没有农活可结算。
  if (useEnergy && !workStart && !workNow) {
    sleepWorkers(data, start, now, true)
    helper.lastAt = now
    return
  }
  settlePlots(data, helper, start, now, awardExperience, useEnergy)
  if (useEnergy) {
    if (helperHasWork(data)) wakeSleepers(data, now)
    else sleepWorkers(data, now, now, false)
  }
  helper.lastAt = now
}
