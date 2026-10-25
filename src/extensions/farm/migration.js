// @ts-check
// 存档迁移与归一化：3.x -> 4.0 -> 5，补齐地块、仓库、帮工和第一课字段。
// 迁移只补数据、退款，不跑动作；动作入口会先 normalize 再结算，保证旧存档可重复读。
import { EXP_CAP, OLD_FERTILIZER, OLD_HELPER_BARN_PRICES, OLD_SPRINKLER, OLD_YIELD, PLOTS, START_PLOTS } from './data.js'
import { normalizeHelper } from './helper.js'
import { lessonDone, lessonProgress } from './plot-rules.js'
import { count, cropFor, isObject, randomValue } from './pure.js'

/** 3.x → 4.0（normalize 随后统一升到 5）：地数至少 6 块；地里的作物当作长完、按旧产量进仓库；旧洒水器、旧肥料退菜币；大水壶换成喷雾桶。 */
function migrate(data) {
  const oldPlots = Array.isArray(data.plots) ? data.plots : []
  const harvest = isObject(data.harvest) ? data.harvest : {}
  const acquired = isObject(data.acquired) ? data.acquired : {}
  const harvests = {}
  for (const plot of oldPlots) {
    if (!isObject(plot) || !OLD_YIELD[plot.crop]) continue
    harvest[plot.crop] = count(harvest[plot.crop]) + OLD_YIELD[plot.crop]
    acquired[plot.crop] = count(acquired[plot.crop]) + OLD_YIELD[plot.crop]
  }
  for (const [key, yieldCount] of Object.entries(OLD_YIELD)) harvests[key] = Math.floor(count(acquired[key]) / yieldCount)
  const tools = isObject(data.tools) ? data.tools : {}
  const sprinklers = Array.isArray(data.sprinklers) ? data.sprinklers.filter(on => on === true).length : 0
  const pastHarvests = Object.values(harvests).reduce((sum, n) => sum + n, 0)
  const helper = isObject(data.helper) ? data.helper : {}
  return { version: 4, unlocked: Math.max(START_PLOTS, Math.min(PLOTS, count(data.unlocked))), plots: [], seeds: isObject(data.seeds) ? data.seeds : {}, harvest, acquired, harvests,
    tools: { sickle: tools.sickle === true, sprayer: tools.can === true, rake: false, planter: tools.planter === true }, fert: {}, exp: pastHarvests * 10,
    refund: sprinklers * OLD_SPRINKLER + count(data.fertilizer) * OLD_FERTILIZER,
    helper: { hired: helper.hired === true, level: count(helper.level), barn: count(helper.barn), usedMs: helper.usedMs, lastAt: helper.lastAt, stock: isObject(helper.stock) ? helper.stock : {} },
  }
}
export function refundOldBarn(data) { // 3.0.0 的农具档退款只发一次：helperBarnRefunded 标记已退，barn 退完清零
  if (data.helperBarnRefunded === true || data.helper.barn < 1) return
  let amount = 0; for (let stage = 1; stage <= data.helper.barn; stage += 1) amount += OLD_HELPER_BARN_PRICES[stage]
  data.refund += amount; data.helperBarnRefund = amount; data.helper.barn = 0; data.helperBarnRefunded = true
}
/** 补齐字段（只用于动作里的私有数据，view 先 structuredClone 再调）。 */
export function normalize(data) {
  if (count(data.version) < 4) {
    const old = { ...data }
    for (const key of Object.keys(data)) delete data[key]
    Object.assign(data, migrate(old))
  }
  data.unlocked = Math.max(START_PLOTS, Math.min(PLOTS, count(data.unlocked) || START_PLOTS)); if (!Array.isArray(data.plots)) data.plots = []
  data.plots = Array.from({ length: PLOTS }, (_, index) => {
    const plot = data.plots[index]
    if (!isObject(plot) || index >= data.unlocked) return null
    if (plot.fallow === true) return { fallow: true, stubble: plot.stubble === true, pests: { dry: plot.pests?.dry === 0 ? 0 : null, weed: plot.pests?.weed === 0 ? 0 : null } }
    if (plot.withered === true) return cropFor(plot.crop) ? { crop: plot.crop, withered: true } : null
    if (!cropFor(plot.crop) || !Number.isFinite(plot.plantedAt) || !isObject(plot.pests)) return null
    return plot
  })
  for (const field of ['seeds', 'harvest', 'acquired', 'harvests', 'tools', 'fert']) if (!isObject(data[field])) data[field] = {}
  data.exp = Math.min(EXP_CAP, count(data.exp)); data.refund = count(data.refund); data.helperBarnRefund = count(data.helperBarnRefund)
  normalizeHelper(data)
  refundOldBarn(data)
  const known = count(data.version) >= 5, raw = known && isObject(data.onboarding) ? data.onboarding : null
  if (!known) data.onboarding = lessonProgress(data) ? lessonDone(true) : { step: 'offer', rewarded: false, legacy: false, plantedAt: null, wateredAt: null }
  else if (raw === null || !['offer', 'planted', 'done'].includes(raw.step) || (raw.step === 'planted' && !Number.isFinite(raw.plantedAt)) || (raw.step !== 'done' && (raw.rewarded || raw.legacy))) data.onboarding = lessonDone(true)
  else data.onboarding = raw.step === 'done' ? { step: 'done', rewarded: true, legacy: raw.legacy === true, plantedAt: Number.isFinite(raw.plantedAt) ? raw.plantedAt : null, wateredAt: Number.isFinite(raw.wateredAt) ? raw.wateredAt : null }
    : { step: raw.step, rewarded: false, legacy: false, plantedAt: raw.step === 'offer' ? null : raw.plantedAt, wateredAt: raw.step === 'offer' ? null : Number.isFinite(raw.wateredAt) ? raw.wateredAt : null }
  data.version = Math.max(5, count(data.version))
  return data
}
/** 新开垦的地：至少有杂草，多数长草；旧存档不补这些东西。 */
export function newGround() {
  const weed = randomValue() < 0.8
  return { fallow: true, stubble: !weed || randomValue() < 0.5, pests: { dry: 0, weed: weed ? 0 : null } }
}
