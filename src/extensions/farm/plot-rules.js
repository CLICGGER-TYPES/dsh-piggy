// @ts-check
// 菜园地块规则：开垦校验、种/照料/收/铲、一键动作的共用流程、第一课状态判定。
// 这些函数原地改 data（扩展动作允许的唯一例外），不碰宿主其他状态。
import { CARE_EXP, CROPS, LESSON, REGROW_AT, START_PLOTS } from './data.js'
import { tire } from './host.js'
import { count, cropFor, levelOf, nextPest, plotState, seasonMs, sow } from './pure.js'

export const availablePlot = (data, index) => Number.isInteger(index) && index >= 0 && index < data.unlocked
export const amountFor = (data, field, key) => count(data[field][key])
export const owns = (data, tool) => data.tools[tool] === true
export const levelNow = data => levelOf(data.exp).level
export const lessonAt = o => o.plantedAt === null ? null : o.plantedAt + (o.wateredAt === null ? LESSON.ripeMs : LESSON.wateredMs)
export const lessonDone = legacy => ({ step: 'done', rewarded: true, legacy, plantedAt: null, wateredAt: null })
export const lessonProgress = d => d.exp > 0 || d.unlocked > START_PLOTS || d.refund > 0 || d.helperBarnRefund > 0 || d.helperBarnRefunded === true || d.helper.hired || d.helper.level > 0 || d.helper.usedMs > 0 || d.helper.pending !== null || d.helper.targets.some(Boolean) || Object.values(d.helper.stock).some(n => count(n) > 0) || d.plots.some(plot => plot !== null && plot.fallow !== true) || ['seeds', 'harvest', 'acquired', 'harvests', 'fert'].some(field => Object.values(d[field]).some(n => count(n) > 0)) || Object.values(d.tools).some(on => on === true)
/** 加经验，升级了返回新等级。 */
function gainExp(data, n) {
  const before = levelNow(data)
  data.exp += n
  return levelNow(data) > before ? levelNow(data) : null
}
/** 记一次收获：进指定仓库，同时累计图鉴数量和历史收获次数（普通地和帮工共用）。 */
export function recordHarvest(data, key, n, into) {
  into[key] = count(into[key]) + n
  data.acquired[key] = amountFor(data, 'acquired', key) + n
  data.harvests[key] = amountFor(data, 'harvests', key) + 1
}
/** 收一块熟了的地；收到 into（仓库或帮工仓库）。返回 { crop, n, level } 或 null。 */
export function harvestPlot(data, index, at, into = data.harvest) {
  const plot = data.plots[index]
  const state = plotState(plot, at)
  if (state === null || !state.ripe) return null
  const crop = cropFor(plot.crop)
  recordHarvest(data, crop.key, state.yield, into)
  const level = gainExp(data, crop.exp)
  // 多季作物：回到「长大」再长一季；最后一季收完留枯苗。
  data.plots[index] = plot.season < crop.seasons ? sow(crop, at, plot.season + 1, REGROW_AT * seasonMs(crop)) : { crop: crop.key, withered: true }
  return { crop, n: state.yield, level }
}
/** 照料一块地：浇水、除草、杀虫（kind 不给就全治）。返回治了几样。 */
export function carePlot(data, index, at, kind = null) {
  const plot = data.plots[index]
  const state = plotState(plot, at)
  if (state === null || state.ripe || state.withered) return 0
  const pests = state.pests.filter(pest => kind === null || kind === pest)
  for (const pest of pests) plot.pests[pest] = plot.fallow ? null : nextPest(at)
  return pests.length
}
/** 铲掉一块地上的东西（枯苗，或者 force 时正在长的作物）。 */
export function clearPlot(data, index, force = false) {
  const plot = data.plots[index]
  if (plot?.fallow && plot.stubble) { plot.stubble = false; gainExp(data, CARE_EXP); return true }
  if (plot !== null && !plot.fallow && (plot.withered || force)) { data.plots[index] = null; return true }
  return false
}
/** 在空地上种一粒种子。 */
export function plantPlot(data, index, crop, at) {
  const old = data.plots[index]
  if ((old !== null && (!old.fallow || old.stubble || old.pests.weed === 0)) || amountFor(data, 'seeds', crop.key) < 1 || levelNow(data) < crop.level) return false
  data.seeds[crop.key] -= 1
  data.plots[index] = sow(crop, at)
  if (old?.fallow && old.pests.dry === 0) data.plots[index].pests.dry = at
  return true
}
/** 一键动作共用逐地执行与计数，耗体力按实际动过的地计算。 */
export function batchAction(data, api, spec) {
  if (spec.tool && !owns(data, spec.tool)) return { ok: false, reason: 'locked' }
  const indices = spec.indices ?? Array.from({ length: data.unlocked }, (_, index) => index)
  const results = indices.map(spec.visit)
  const total = results.reduce((sum, n) => sum + n, 0)
  if (!total) return { ok: false, reason: spec.reason ?? 'unavailable' }
  tire(api, results.filter(Boolean).length)
  const level = spec.exp ? gainExp(data, total * spec.exp) : null
  if (level) api.say('菜园升到 ' + level + ' 级了！')
  return { ok: true, [spec.key]: total }
}
/** 单块地动作共用的地块校验；失败原因统一是 locked。 */
export const plotAction = handler => (data, payload, api) => availablePlot(data, payload?.plot) ? handler(data, payload, api) : { ok: false, reason: 'locked' }
export function sayHarvest(result) {
  const head = result.crop.key === 'carrot' ? '收获 ' + result.n + ' 个胡萝卜，我一个都没偷吃' : '收获 ' + result.n + ' 个' + result.crop.label + '，菜园有收成啦！'
  return result.level ? head + '菜园升到 ' + result.level + ' 级了！' : head
}
