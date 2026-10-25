// @ts-check
// 菜园的纯规则：随机数注入、天气、生长阶段、灾害和等级。
// 这些函数不读写存档，也不直接读系统时间；时间由调用方传进来，测试可以换随机源。
import { CROPS, EXP_CAP, EXP_PER_LEVEL, FERTILIZERS, HOUR_MS, PEST_LOSS, PEST_MS, PESTS, REGROW_AT, STAGE_AT, STAGES, TOOLS } from './data.js'

export const cropFor = key => CROPS.find(crop => crop.key === key) ?? null
export const toolFor = key => TOOLS.find(tool => tool.key === key) ?? null
export const fertFor = key => FERTILIZERS.find(fert => fert.key === key) ?? null
export const count = value => Math.max(0, Math.floor(Number(value) || 0))
export const validCount = value => Number.isSafeInteger(value) && value > 0
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
/** 0～1 的随机数；测试里可以换掉。 */
let random = Math.random
export function setRandom(fn) { random = typeof fn === 'function' ? fn : Math.random }
/** 当前随机源；newGround 和 sow 共用同一个可注入实现。 */
export const randomValue = () => random()
/** 下一次灾害什么时候来：指数分布，平均 PEST_MS。 */
export const nextPest = from => from + Math.round(-Math.log(1 - Math.min(0.999999, random())) * PEST_MS)
/** 每天随机晴或雨（按日期定，两扇窗口看到的一样），与昼夜时段无关。 */
export function weatherAt(at) {
  const date = new Date(at)
  const day = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate()
  let h = Math.imul(day, 2654435761) >>> 0
  h = Math.imul(h ^ h >>> 15, 2246822519) >>> 0
  return (h ^ h >>> 13) % 2 === 0 ? 'rain' : 'sunny'
}
/** 雨天全天不旱：干旱推到下一个晴天的零点。 */
export function droughtAt(at) {
  while (Number.isFinite(at) && weatherAt(at) === 'rain') at = new Date(at).setHours(24, 0, 0, 0)
  return at
}
/** 一季要多久（毫秒）。 */
export const seasonMs = crop => crop.hours * HOUR_MS
/** 新种下（或进入下一季）的地：起点、产量浮动、三样灾害什么时候来，都在这时定好。 */
export function sow(crop, at, season = 1, offset = 0) {
  return { crop: crop.key, season, plantedAt: at - offset, boostMs: 0, roll: Math.floor(random() * 6) - 3, pests: { weed: nextPest(at), bug: nextPest(at), dry: nextPest(at) } }
}
/** 这块地这一季走到哪了（0～1）。 */
export const ageOf = (plot, crop, now) => Math.min(1, Math.max(0, (now - plot.plantedAt + plot.boostMs) / seasonMs(crop)))
/** 成熟的时刻。 */
export const ripeAt = (plot, crop) => plot.plantedAt - plot.boostMs + seasonMs(crop)
/** 某样灾害在 at 时刻有没有（只在长的时候来；成熟以后不会再来）。 */
export const pestOn = (plot, crop, kind, at) => (kind !== 'dry' || weatherAt(at) !== 'rain') && (kind === 'dry' ? droughtAt(plot.pests[kind]) : plot.pests[kind]) <= Math.min(at, ripeAt(plot, crop))
/** 这块地现在的样子（纯函数，不改存档）。 */
export function plotState(plot, now) {
  if (plot === null) return null
  if (plot.fallow) return { empty: true, stubble: plot.stubble, pests: PESTS.filter(kind => plot.pests[kind] === 0 && (kind !== 'dry' || weatherAt(now) !== 'rain')), ripe: false, withered: false }
  if (plot.withered) return { crop: plot.crop, stage: 'withered', withered: true, pests: [], ripe: false, progress: 0, remainingMs: 0, yield: 0 }
  const crop = cropFor(plot.crop)
  if (crop === null) return null
  const age = ageOf(plot, crop, now)
  const index = STAGE_AT.filter(threshold => age >= threshold).length - 1
  const ripe = age >= 1
  const pests = PESTS.filter(kind => pestOn(plot, crop, kind, now))
  return { crop: crop.key, stage: STAGES[index], ripe, withered: false, season: plot.season, seasons: crop.seasons, pests,
    progress: age, remainingMs: ripe ? 0 : Math.max(0, ripeAt(plot, crop) - now), yield: ripe ? Math.max(1, crop.yield + plot.roll - PEST_LOSS * pests.length) : 0 }
}
/** 等级：从总经验算出来。解 level(level − 1) ≤ exp / 50 得闭式；浮点误差最多一级，下面修正回来。 */
export function levelOf(exp) {
  const total = Math.min(EXP_CAP, count(exp)), reach = level => EXP_PER_LEVEL / 2 * level * (level - 1)
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + total / 12.5)) / 2))
  level += reach(level + 1) <= total ? 1 : reach(level) > total ? -1 : 0
  return { level, exp: total - reach(level), need: level * EXP_PER_LEVEL }
}
