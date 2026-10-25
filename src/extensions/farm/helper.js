// @ts-check
// 帮工猪：配方、存档字段整理、小批次结算、帮工仓库和商店项。
// 帮工管的地不长草不生虫，收成进自己的仓库；六小时封仓，批次进度随地块保存。
import { CROPS, PLOTS, STAGES } from './data.js'
import { purse } from './host.js'
import { amountFor, plantPlot, recordHarvest } from './plot-rules.js'
import { count, cropFor, droughtAt, isObject, weatherAt } from './pure.js'

/** 帮工管的地数：4 / 8 / 16 块；六小时封仓，每小时至多 400。 */
export const HELPER_PLOTS = [4, 8, 16]
/** 帮工实际净收益要到「同作物、同管地数自己种」的几成（用户 2026-10-13 要求九成；取整后落在 85%~92%）。 */
export const HELPER_SHARE = 0.9
export const HELPER_WINDOW = 6 * 3600000
/** 旧农具档 2026-10-14 用户拍板从商店下架：不再出售，存档里的 barn 字段保留但不再参与配方。 */
export const HELPER_PRICES = { hire: 2500, level: [0, 2000, 6000] }
/** 帮工配方：从「自己种的 0.9」往下试，挑净时薪落进 85%~92%（400 封顶、六小时整数批）的组合；数值一改可能无解，就取最接近九成的组合、最后保底 1 批 1 个（share/degraded 标出退化）。只有作物 key 不认识才返回 null，调用方要兜底。管地数之外没有别的档位（农具档已下架）。 */
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
export function normalizeHelper(data) {
  const raw = isObject(data.helper) ? data.helper : {}
  const level = Math.min(2, count(raw.level))
  const barn = Math.min(3, count(raw.barn)) // 农具档已下架：只读取、只 clamp；紧接着 refundOldBarn 按档位退款并清零
  const recipe = helperRecipe(raw.pending?.crop, level), pending = recipe && Number.isFinite(raw.pending.remainingMs) && Number.isInteger(raw.pending.index)
    ? { ...raw.pending, remainingMs: Math.max(0, Math.min(recipe.intervalMs, raw.pending.remainingMs)), yield: recipe.yield } : null
  data.helper = {
    hired: raw.hired === true, level, barn,
    lastAt: Number.isFinite(raw.lastAt) ? raw.lastAt : null,
    usedMs: Number.isFinite(raw.usedMs) ? Math.max(0, Math.min(HELPER_WINDOW, raw.usedMs)) : 0,
    cursor: count(raw.cursor) % PLOTS,
    pending,
    targets: Array.from({ length: PLOTS }, (_, index) => cropFor(raw.targets?.[index]) ? raw.targets[index] : null),
    stock: Object.fromEntries(CROPS.map(crop => [crop.key, count(raw.stock?.[crop.key])])),
  }
}
export const helperCount = data => Object.values(data.helper.stock).reduce((sum, n) => sum + Number(n), 0)
export const helperPlots = data => data.helper.hired ? Math.min(data.unlocked, HELPER_PLOTS[data.helper.level]) : 0
/** 枯苗先铲；开荒地先清枯苗和杂草（不给经验、不吃体力）再补种；只补这块地原来指定的作物，缺种子就跳过。 */
function prepareHelper(data, at) {
  const helper = data.helper
  const managed = helperPlots(data)
  for (let offset = 0; offset < managed; offset += 1) {
    const index = (helper.cursor + offset) % managed
    let plot = data.plots[index]
    if (plot?.withered) data.plots[index] = plot = null
    if (plot?.fallow && (plot.stubble || plot.pests.weed === 0)) { plot.stubble = false; plot.pests.weed = null }
    // 只认这块地原来指定的作物；从没指定过就跳过，不替玩家挑种子。
    const crop = cropFor(plot?.crop) ?? cropFor(helper.targets[index])
    if (!crop) continue
    helper.targets[index] = crop.key
    if (!plot || plot.fallow) { if (!plantPlot(data, index, crop, at)) continue; plot = data.plots[index] }
    const recipe = helperRecipe(crop.key, helper.level); if (!recipe) continue
    helper.pending = { index, crop: crop.key, plantedAt: plot.plantedAt, remainingMs: recipe.intervalMs, yield: recipe.yield }
    return true
  }
  return false
}
/** 时间差只用于当前小批次，满六小时停；批次进度随地块保存，收仓不复制进度。 */
export function settleHelper(data, now) {
  // 雨把已经干的地浇湿；view 在副本结算，动作时写回，下一次旱灾推到下一个晴天。
  if (weatherAt(now) === 'rain') for (const plot of data.plots) {
    if (plot?.fallow) plot.pests.dry = null
    else if (plot?.pests?.dry <= now) plot.pests.dry = droughtAt(now)
  }
  const helper = data.helper
  if (!helperPlots(data) || !Number.isFinite(now)) return
  const start = helper.lastAt ?? now; if (now < start) return
  const pendingPlot = helper.pending ? data.plots[helper.pending.index] : null
  if (helper.pending && (!pendingPlot || pendingPlot.withered || pendingPlot.plantedAt !== helper.pending.plantedAt || pendingPlot.crop !== helper.pending.crop)) helper.pending = null
  let remaining = Math.min(now - start, HELPER_WINDOW - helper.usedMs)
  let at = start
  if (!helper.pending) prepareHelper(data, start)
  while (remaining > 0 && helper.pending) {
    const pending = helper.pending
    const elapsed = Math.min(remaining, pending.remainingMs)
    pending.remainingMs -= elapsed
    helper.usedMs += elapsed
    remaining -= elapsed
    at += elapsed
    if (pending.remainingMs > 0.00001) break
    recordHarvest(data, pending.crop, pending.yield, helper.stock)
    data.plots[pending.index] = null
    helper.cursor = (pending.index + 1) % helperPlots(data)
    helper.pending = null
    if (helper.usedMs >= HELPER_WINDOW - 0.00001) { helper.usedMs = HELPER_WINDOW; break }
    plantPlot(data, pending.index, cropFor(pending.crop), at)
    if (!prepareHelper(data, at)) break
  }
  helper.lastAt = now
}
export function helperView(data) {
  const helper = data.helper
  const managed = helperPlots(data)
  const missing = helper.targets.slice(0, managed).filter((key, index) => key && (!data.plots[index] || data.plots[index].fallow) && amountFor(data, 'seeds', key) === 0)
  // 没在干活的三种原因之一：管区里没有在长的作物，也没有任何「这块地指定的作物」的种子（不替玩家挑种子）。
  const seedless = managed > 0 && !helper.pending && !data.plots.slice(0, managed).some(plot => plot?.crop) &&
    !helper.targets.slice(0, managed).some(key => key && amountFor(data, 'seeds', key) > 0)
  return { hired: helper.hired, plots: managed, stored: helperCount(data), usedHours: helper.usedMs / 3600000,
    capacityHours: 6, full: helper.usedMs >= HELPER_WINDOW, seedless, missing: [...new Set(missing)].map(key => cropFor(key).label) }
}
/** 帮工管的地显示它自己的批次进度（不长草不生虫）；手动成熟的照旧可以自己收。 */
export function helperPlotView(data, index, state) {
  if (index >= helperPlots(data) || state === null || state.ripe || state.withered) return {}
  const recipe = helperRecipe(state.crop, data.helper.level)
  if (!recipe) return {}
  const pending = data.helper.pending?.index === index ? data.helper.pending : null
  const remainingMs = pending?.remainingMs ?? recipe.intervalMs
  const progress = pending ? Math.max(0, Math.min(1, 1 - remainingMs / recipe.intervalMs)) : 0
  return { helperNote: data.helper.usedMs >= HELPER_WINDOW ? '等帮工接着干' : pending ? '帮工处理中' : '等帮工',
    pests: [], stage: STAGES[Math.min(4, Math.floor(progress * 5))], progress, remainingMs }
}
export function helperShelf(data, balance) {
  const helper = data.helper
  // 农具档（旧帮工仓库）2026-10-14 起下架，只卖管地数一档。
  const level = helper.hired ? helper.level + 1 : null
  const price = helper.hired ? HELPER_PRICES.level[level] : HELPER_PRICES.hire
  if (price === undefined) return []
  const label = helper.hired ? ['帮工猪', '熟练帮工', '老练帮工'][level] : '雇帮工猪'
  const note = helper.hired ? '管 ' + HELPER_PLOTS[level] + ' 块地' : '管 ' + HELPER_PLOTS[0] + ' 块地，6 小时封仓'
  return [{ key: helper.hired ? 'helper-level' : 'helper-hire', emoji: '🐷', label, note, price, disabled: balance < price, pick: null }]
}
export function helperBuy(data, payload, api) {
  const helper = data.helper
  const kind = String(payload?.item).replace('helper-', '')
  if (kind === 'hire') {
    if (helper.hired) return { ok: false, reason: 'owned' }
    if (!purse(api).spend(HELPER_PRICES.hire, 'helper')) return { ok: false, reason: 'poor' }
    helper.hired = true
    helper.lastAt = api.now
  } else {
    // 农具档已下架：helper-barn 一律拒，别再让玩家买到没有效果的档位。
    if (kind !== 'level' || !helper.hired) return { ok: false, reason: 'locked' }
    const price = HELPER_PRICES.level[helper.level + 1]
    if (price === undefined) return { ok: false, reason: 'owned' }
    if (!purse(api).spend(price, 'helper')) return { ok: false, reason: 'poor' }
    helper.level += 1
  }
  return { ok: true }
}
/** 收仓：帮工仓库里的东西进仓库，六小时重新算。 */
export function collectHelper(data) {
  if (!helperCount(data) && data.helper.usedMs === 0) return { ok: false, reason: 'empty' }
  for (const crop of CROPS) data.harvest[crop.key] = amountFor(data, 'harvest', crop.key) + data.helper.stock[crop.key]
  data.helper.stock = Object.fromEntries(CROPS.map(crop => [crop.key, 0])); data.helper.usedMs = 0
  return { ok: true }
}
