// @ts-check
// 菜园 4.0：照 QQ 农场改版（设计见 docs/design/farm-qqfarm.md，用户 2026-10-12 定）。用自己的「菜币」，钱包在宿主（api.wallet）。
// 18 块地（开局 6 块，其余荒地 10000 开垦），作物按真实时间自己长；长的时候会长草、生虫、干旱，不管就减产；
// 收完留枯萎秆要铲掉；多季作物收完回到「长大」再长一季。等级照原版：升下一级要「等级 × 100」经验，种子按等级解锁。
// 一键收获 / 照料 / 铲除 / 播种要先买工具解锁（用户定 C）；帮工猪照旧可雇（D）。
// 随机的东西（产量浮动、灾害什么时候来）都在种下时就定好存进存档，view 只算不写，结果可复现。
/** 地：一共 18 块，开局 6 块熟地。 */
export const PLOTS = 18
export const START_PLOTS = 6
/** 每开垦一块荒地（原版 10000 元宝）。 */
export const RECLAIM_PRICE = 10000
/** 原版 InstallFace：每样灾害平均 4 小时来一次；每样灾害收获时少 2 个；产量浮动 −3～+2。 */
export const PEST_MS = 4 * 3600000
export const PEST_LOSS = 2
/** 照料一次（浇水、除草、杀虫）的经验。 */
export const CARE_EXP = 2
/** 升下一级要「当前等级 × 100」经验。 */
export const EXP_PER_LEVEL = 100
/** 「玩会累」：种、收、照料一块地扣多少饱食（data/economy.js 的建议值）。 */
export const EXERT = 0.2
const H = 3600000
/**
 * 作物：原版 20 种照 Crop.xml / seed.xml，后 9 种是菜园原有的，按原版规律定（设计稿 3.5）。
 * level 解锁等级；price 种子价；hours 成熟时间；exp 每次收获经验；yield 基础产量；sell 单价；seasons 收几季。
 */
export const CROPS = [
  { key: 'radish', emoji: '🥕', label: '白萝卜', level: 1, price: 80, hours: 14, exp: 10, yield: 24, sell: 18, seasons: 1 },
  { key: 'apple', emoji: '🍎', label: '苹果', level: 1, price: 75, hours: 20, exp: 12, yield: 24, sell: 18, seasons: 1 },
  { key: 'grape', emoji: '🍇', label: '葡萄', level: 1, price: 70, hours: 17, exp: 11, yield: 24, sell: 18, seasons: 1 },
  { key: 'carrot', emoji: '🥕', label: '胡萝卜', level: 2, price: 90, hours: 16, exp: 12, yield: 25, sell: 20, seasons: 1 },
  { key: 'peach', emoji: '🍑', label: '桃子', level: 2, price: 85, hours: 16, exp: 14, yield: 25, sell: 20, seasons: 1 },
  { key: 'watermelon', emoji: '🍉', label: '西瓜', level: 2, price: 90, hours: 19, exp: 15, yield: 25, sell: 20, seasons: 1 },
  { key: 'potato', emoji: '🥔', label: '土豆', level: 3, price: 120, hours: 17, exp: 14, yield: 22, sell: 22, seasons: 1 },
  { key: 'chili', emoji: '🌶️', label: '辣椒', level: 3, price: 110, hours: 16, exp: 16, yield: 22, sell: 22, seasons: 1 },
  { key: 'banana', emoji: '🍌', label: '香蕉', level: 3, price: 95, hours: 20, exp: 18, yield: 22, sell: 22, seasons: 1 },
  { key: 'tomato', emoji: '🍅', label: '西红柿', level: 4, price: 110, hours: 18, exp: 18, yield: 26, sell: 24, seasons: 1 },
  { key: 'eggplant', emoji: '🍆', label: '茄子', level: 4, price: 120, hours: 20, exp: 20, yield: 26, sell: 24, seasons: 1 },
  { key: 'pea', emoji: '🫛', label: '豌豆', level: 4, price: 120, hours: 20, exp: 20, yield: 26, sell: 24, seasons: 1 },
  { key: 'pineapple', emoji: '🍍', label: '菠萝', level: 4, price: 110, hours: 28, exp: 18, yield: 26, sell: 24, seasons: 1 },
  { key: 'corn', emoji: '🌽', label: '玉米', level: 5, price: 105, hours: 19, exp: 22, yield: 20, sell: 28, seasons: 1 },
  { key: 'pomelo', emoji: '🍈', label: '柚子', level: 5, price: 120, hours: 22, exp: 32, yield: 20, sell: 28, seasons: 2 },
  { key: 'strawberry', emoji: '🍓', label: '草莓', level: 6, price: 130, hours: 24, exp: 26, yield: 24, sell: 18, seasons: 1, food: 'strawberry', foodLabel: '草莓' },
  { key: 'pumpkin', emoji: '🎃', label: '南瓜', level: 7, price: 300, hours: 22, exp: 28, yield: 28, sell: 30, seasons: 2, food: 'pumpkin', foodLabel: '南瓜粥' },
  { key: 'orange', emoji: '🍊', label: '橘子', level: 7, price: 160, hours: 24, exp: 26, yield: 28, sell: 30, seasons: 2 },
  { key: 'pomegranate', emoji: '🍎', label: '石榴', level: 8, price: 170, hours: 27, exp: 20, yield: 30, sell: 32, seasons: 3 },
  { key: 'coconut', emoji: '🥥', label: '椰子', level: 9, price: 190, hours: 30, exp: 28, yield: 30, sell: 35, seasons: 3 },
  { key: 'scallion', emoji: '🧅', label: '小葱', level: 1, price: 70, hours: 14, exp: 10, yield: 24, sell: 18, seasons: 1 },
  { key: 'sprout', emoji: '🌱', label: '豆芽', level: 1, price: 75, hours: 15, exp: 10, yield: 25, sell: 18, seasons: 1 },
  { key: 'coriander', emoji: '🌿', label: '香菜', level: 2, price: 85, hours: 16, exp: 12, yield: 24, sell: 20, seasons: 1 },
  { key: 'lettuce', emoji: '🥗', label: '生菜', level: 2, price: 90, hours: 17, exp: 13, yield: 25, sell: 20, seasons: 1 },
  { key: 'cabbage', emoji: '🥬', label: '小白菜', level: 3, price: 100, hours: 18, exp: 15, yield: 24, sell: 22, seasons: 1 },
  { key: 'blueberry', emoji: '🫐', label: '蓝莓', level: 5, price: 140, hours: 22, exp: 22, yield: 26, sell: 26, seasons: 1 },
  { key: 'sweetpotato', emoji: '🍠', label: '红薯', level: 6, price: 150, hours: 24, exp: 24, yield: 26, sell: 28, seasons: 1, food: 'sweetpotato', foodLabel: '烤红薯' },
  { key: 'sunflower', emoji: '🌻', label: '向日葵', level: 7, price: 170, hours: 26, exp: 26, yield: 28, sell: 30, seasons: 1 },
  { key: 'melon', emoji: '🍈', label: '哈密瓜', level: 9, price: 200, hours: 30, exp: 28, yield: 30, sell: 34, seasons: 1 },
]
/** 解锁一键操作的工具（先买才有，用户定 C）。 */
export const TOOLS = [{ key: 'sickle', label: '收割镰', price: 1000, note: '解锁一键收获' }, { key: 'sprayer', label: '喷雾桶', price: 600, note: '解锁一键照料' }, { key: 'rake', label: '平地耙', price: 800, note: '解锁一键铲除' }, { key: 'planter', label: '播种器', price: 1800, note: '解锁一键播种' }]
/** 化肥（原版 props.xml）：施一次多长几小时，可以连着施。 */
export const FERTILIZERS = [{ key: 'fert-1', label: '普通化肥', price: 500, hours: 2 }, { key: 'fert-2', label: '快速化肥', price: 800, hours: 3.5 }, { key: 'fert-3', label: '急速化肥', price: 1000, hours: 5 }]
/** 灾害：长草、生虫、干旱，各自独立。 */
export const PESTS = ['weed', 'bug', 'dry']
/** 生长阶段（按这一季走过的比例）：种子、发芽、小苗、长大、开花、成熟。多季作物收完回到「长大」。 */
export const STAGES = ['seed', 'sprout', 'seedling', 'growing', 'flowering', 'ripe']
const STAGE_AT = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 1]
const REGROW_AT = 3 / 6
/** 3.x 存档的旧数据，迁移时用：旧产量（算历史收获次数）、旧洒水器和旧肥料按原价退成菜币。 */
const OLD_YIELD = { sprout: 2, scallion: 3, coriander: 3, lettuce: 3, cabbage: 3, strawberry: 3, blueberry: 4, carrot: 4, sweetpotato: 3, tomato: 4, corn: 5, pumpkin: 2, sunflower: 3, watermelon: 2, grape: 3, melon: 2 }
const OLD_SPRINKLER = 3000
const OLD_FERTILIZER = 20
export const cropFor = key => CROPS.find(crop => crop.key === key) ?? null
const toolFor = key => TOOLS.find(tool => tool.key === key) ?? null
const fertFor = key => FERTILIZERS.find(fert => fert.key === key) ?? null
const count = value => Math.max(0, Math.floor(Number(value) || 0))
const validCount = value => Number.isSafeInteger(value) && value > 0
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
/** 0～1 的随机数；测试里可以换掉。 */
let random = Math.random
export function setRandom(fn) { random = typeof fn === 'function' ? fn : Math.random }
/** 下一次灾害什么时候来：指数分布，平均 PEST_MS。 */
const nextPest = from => from + Math.round(-Math.log(1 - Math.min(0.999999, random())) * PEST_MS)
/** 每天随机晴或雨（按日期定，两扇窗口看到的一样），与昼夜时段无关。 */
export function weatherAt(at) {
  const date = new Date(at)
  const day = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate()
  let h = Math.imul(day, 2654435761) >>> 0
  h = Math.imul(h ^ h >>> 15, 2246822519) >>> 0
  return (h ^ h >>> 13) % 2 === 0 ? 'rain' : 'sunny'
}
/** 雨天全天不旱：干旱推到下一个晴天的零点。 */
function droughtAt(at) {
  while (Number.isFinite(at) && weatherAt(at) === 'rain') at = new Date(at).setHours(24, 0, 0, 0)
  return at
}
/** 一季要多久（毫秒）。 */
const seasonMs = crop => crop.hours * H
/** 新种下（或进入下一季）的地：起点、产量浮动、三样灾害什么时候来，都在这时定好。 */
function sow(crop, at, season = 1, offset = 0) {
  return { crop: crop.key, season, plantedAt: at - offset, boostMs: 0, roll: Math.floor(random() * 6) - 3, pests: { weed: nextPest(at), bug: nextPest(at), dry: nextPest(at) } }
}
/** 这块地这一季走到哪了（0～1）。 */
const ageOf = (plot, crop, now) => Math.min(1, Math.max(0, (now - plot.plantedAt + plot.boostMs) / seasonMs(crop)))
/** 成熟的时刻。 */
const ripeAt = (plot, crop) => plot.plantedAt - plot.boostMs + seasonMs(crop)
/** 某样灾害在 at 时刻有没有（只在长的时候来；成熟以后不会再来）。 */
const pestOn = (plot, crop, kind, at) => (kind !== 'dry' || weatherAt(at) !== 'rain') && (kind === 'dry' ? droughtAt(plot.pests[kind]) : plot.pests[kind]) <= Math.min(at, ripeAt(plot, crop))
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
/** 等级：从总经验算出来（升下一级要「等级 × 100」）。 */
export function levelOf(exp) {
  let level = 1
  let left = count(exp)
  while (left >= level * EXP_PER_LEVEL) { left -= level * EXP_PER_LEVEL; level += 1 }
  return { level, exp: left, need: level * EXP_PER_LEVEL }
}
/** 3.x → 4.0：地数至少 6 块；地里的作物当作长完、按旧产量进仓库；旧洒水器、旧肥料退菜币；大水壶换成喷雾桶。 */
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
/** 补齐字段（只用于动作里的私有数据，view 先 structuredClone 再调）。 */
export function normalize(data) {
  if (data.version !== 4) {
    const old = { ...data }
    for (const key of Object.keys(data)) delete data[key]
    Object.assign(data, migrate(old))
  }
  data.unlocked = Math.max(START_PLOTS, Math.min(PLOTS, count(data.unlocked) || START_PLOTS))
  if (!Array.isArray(data.plots)) data.plots = []
  data.plots = Array.from({ length: PLOTS }, (_, index) => {
    const plot = data.plots[index]
    if (!isObject(plot) || index >= data.unlocked) return null
    if (plot.fallow === true) return { fallow: true, stubble: plot.stubble === true, pests: { dry: plot.pests?.dry === 0 ? 0 : null, weed: plot.pests?.weed === 0 ? 0 : null } }
    if (plot.withered === true) return cropFor(plot.crop) ? { crop: plot.crop, withered: true } : null
    if (!cropFor(plot.crop) || !Number.isFinite(plot.plantedAt) || !isObject(plot.pests)) return null
    return plot
  })
  for (const field of ['seeds', 'harvest', 'acquired', 'harvests', 'tools', 'fert']) if (!isObject(data[field])) data[field] = {}
  data.exp = count(data.exp)
  data.refund = count(data.refund)
  normalizeHelper(data)
  return data
}
/** 新开垦的地：至少有草或残株，多数长草；旧存档不补这些东西。 */
function newGround() {
  const weed = random() < 0.8
  return { fallow: true, stubble: !weed || random() < 0.5, pests: { dry: 0, weed: weed ? 0 : null } }
}
const availablePlot = (data, index) => Number.isInteger(index) && index >= 0 && index < data.unlocked
const amountFor = (data, field, key) => count(data[field][key])
const owns = (data, tool) => data.tools[tool] === true
const levelNow = data => levelOf(data.exp).level
/** 菜币钱包；老宿主（没有 api.wallet）退回金币，免得装上就坏。 */
function purse(api) {
  return api.wallet ? api.wallet : { currency: { label: '金币', emoji: '🪙', rate: 1 }, balance: () => api.coins(), earn: (n, source) => api.earn(n, source), spend: (n, sink) => api.spend(n, sink) }
}
const tire = (api, plots = 1) => { if (typeof api.exert === 'function') api.exert(EXERT * plots) }
/** 迁移欠下的退款：下一次动作时付。 */
function payRefund(data, api) {
  if (data.refund > 0 && api) { purse(api).earn(data.refund, 'refund'); data.refund = 0 }
}
/** 加经验，升级了返回新等级。 */
function gainExp(data, n) {
  const before = levelNow(data)
  data.exp += n
  return levelNow(data) > before ? levelNow(data) : null
}
/** Historical totals count harvests, not crops: a harvest is one plot picked once. */
export function progress(data) {
  const saved = normalize(structuredClone(data))
  const crops = CROPS.filter(crop => amountFor(saved, 'harvests', crop.key) > 0)
  return [{ name: 'harvest', total: crops.reduce((sum, crop) => Math.min(Number.MAX_SAFE_INTEGER, sum + amountFor(saved, 'harvests', crop.key)), 0), items: crops.map(crop => crop.key) }]
}
/** 收一块熟了的地；收到 into（仓库或帮工的谷仓）。返回 { crop, n, level } 或 null。 */
function harvestPlot(data, index, at, into = data.harvest) {
  const plot = data.plots[index]
  const state = plotState(plot, at)
  if (state === null || !state.ripe) return null
  const crop = cropFor(plot.crop)
  into[crop.key] = count(into[crop.key]) + state.yield
  data.acquired[crop.key] = amountFor(data, 'acquired', crop.key) + state.yield
  data.harvests[crop.key] = amountFor(data, 'harvests', crop.key) + 1
  const level = gainExp(data, crop.exp)
  // 多季作物：回到「长大」再长一季；最后一季收完留枯萎秆。
  data.plots[index] = plot.season < crop.seasons ? sow(crop, at, plot.season + 1, REGROW_AT * seasonMs(crop)) : { crop: crop.key, withered: true }
  return { crop, n: state.yield, level }
}
/** 照料一块地：浇水、除草、杀虫（kind 不给就全治）。返回治了几样。 */
function carePlot(data, index, at, kind = null) {
  const plot = data.plots[index]
  const state = plotState(plot, at)
  if (state === null || state.ripe || state.withered) return 0
  const pests = state.pests.filter(pest => kind === null || kind === pest)
  for (const pest of pests) plot.pests[pest] = plot.fallow ? null : nextPest(at)
  return pests.length
}
/** 铲掉一块地上的东西（枯萎秆，或者 force 时正在长的作物）。 */
function clearPlot(data, index, force = false) {
  const plot = data.plots[index]
  if (plot?.fallow && plot.stubble) { plot.stubble = false; gainExp(data, CARE_EXP); return true }
  if (plot !== null && !plot.fallow && (plot.withered || force)) { data.plots[index] = null; return true }
  return false
}
/** 在空地上种一粒种子。 */
function plantPlot(data, index, crop, at) {
  const old = data.plots[index]
  if ((old !== null && (!old.fallow || old.stubble || old.pests.weed === 0)) || amountFor(data, 'seeds', crop.key) < 1 || levelNow(data) < crop.level) return false
  data.seeds[crop.key] -= 1
  data.plots[index] = sow(crop, at)
  if (old?.fallow && old.pests.dry === 0) data.plots[index].pests.dry = at
  return true
}
/** 一键动作共用逐地执行与计数，耗体力按实际动过的地计算。 */
function batchAction(data, api, spec) {
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
function sayHarvest(result) {
  const head = result.crop.key === 'carrot' ? '拔了' + result.n + '个胡萝卜，我一个都没偷吃' : '收了' + result.n + '个' + result.crop.label + '，菜园有收成啦！'
  return result.level ? head + '菜园升到 ' + result.level + ' 级了！' : head
}
const game = {
  eventVersion: 1, progress,
  init() { return normalize({ version: 4, plots: Array.from({ length: START_PLOTS }, () => newGround()) }) },
  actions: {
    /** 商店：种子（可一次买多颗）、工具、化肥、帮工。 */
    buy(data, payload, api) {
      const wallet = purse(api)
      const item = String(payload?.item ?? '')
      if (item.startsWith('helper-')) return helperBuy(data, payload, api)
      const n = payload?.count === undefined ? 1 : payload.count
      const crop = cropFor(item), fert = fertFor(item)
      const consumable = crop ?? fert
      if (consumable !== null) {
        const limit = crop ? 999 : 99
        if (!validCount(n) || n > limit) return { ok: false, reason: 'unavailable' }
        if (crop && levelNow(data) < crop.level) return { ok: false, reason: 'level' }
        if (!wallet.spend(consumable.price * n, crop ? 'seed' : 'fertilizer')) return { ok: false, reason: 'poor' }
        const field = crop ? 'seeds' : 'fert'
        data[field][item] = amountFor(data, field, item) + n
        return { ok: true }
      }
      const tool = toolFor(item)
      if (tool === null || owns(data, tool.key)) return { ok: false, reason: tool === null ? 'unknown' : 'owned' }
      if (!wallet.spend(tool.price, 'tool')) return { ok: false, reason: 'poor' }
      data.tools[tool.key] = true
      api.say('买到了' + tool.label + '！' + tool.note.replace('解锁', '以后可以'))
      return { ok: true }
    },
    /** 开垦下一块荒地（只能按顺序开）。 */
    unlock(data, payload, api) {
      if (payload?.plot !== data.unlocked || data.unlocked >= PLOTS) return { ok: false, reason: 'locked' }
      if (!purse(api).spend(RECLAIM_PRICE, 'plot')) return { ok: false, reason: 'poor' }
      data.plots[data.unlocked] = newGround()
      return { ok: true, plots: (data.unlocked += 1) }
    },
    plant(data, payload, api) {
      const crop = cropFor(payload?.item)
      if (crop === null || !availablePlot(data, payload.plot) || (data.plots[payload.plot] !== null && !data.plots[payload.plot]?.fallow)) return { ok: false, reason: 'unavailable' }
      if (data.plots[payload.plot]?.fallow && (data.plots[payload.plot].stubble || data.plots[payload.plot].pests.weed === 0)) return { ok: false, reason: 'clear-ground' }
      if (levelNow(data) < crop.level) return { ok: false, reason: 'level' }
      if (!plantPlot(data, payload.plot, crop, api.now)) return { ok: false, reason: 'no-seed' }
      tire(api)
      return { ok: true }
    },
    /** 照料一块地：kind 是 weed / bug / dry，不给就把这块地的毛病全治了。 */
    care(data, payload, api) {
      if (!availablePlot(data, payload?.plot)) return { ok: false, reason: 'locked' }
      const kind = PESTS.includes(payload.kind) ? payload.kind : null
      return batchAction(data, api, { indices: [payload.plot], key: 'cured', visit: index => carePlot(data, index, api.now, kind), exp: CARE_EXP })
    },
    fertilize(data, payload, api) {
      if (!availablePlot(data, payload?.plot)) return { ok: false, reason: 'locked' }
      const fert = fertFor(payload.item)
      if (fert === null || amountFor(data, 'fert', fert.key) < 1) return { ok: false, reason: 'empty' }
      const state = plotState(data.plots[payload.plot], api.now)
      if (state === null || state.empty || state.ripe || state.withered) return { ok: false, reason: 'unavailable' }
      data.fert[fert.key] -= 1
      data.plots[payload.plot].boostMs += fert.hours * H
      return { ok: true }
    },
    harvest(data, payload, api) {
      if (!availablePlot(data, payload?.plot)) return { ok: false, reason: 'locked' }
      const result = harvestPlot(data, payload.plot, api.now)
      if (result === null) return { ok: false, reason: 'not-ripe' }
      tire(api)
      api.say(sayHarvest(result))
      return { ok: true, n: result.n }
    },
    /** 铲地：枯萎秆随便铲；正在长的作物要 force（界面先问一句）。 */
    clear(data, payload, api) {
      if (!availablePlot(data, payload?.plot)) return { ok: false, reason: 'locked' }
      if (!clearPlot(data, payload.plot, payload.force === true)) return { ok: false, reason: 'unavailable' }
      tire(api)
      return { ok: true }
    },
    /** 一键收获（要收割镰）。 */
    harvestAll(data, payload, api) {
      if (!owns(data, 'sickle')) return { ok: false, reason: 'locked' }
      let harvested = 0, crops = 0, level = null
      for (let index = 0; index < data.unlocked; index += 1) {
        const result = harvestPlot(data, index, api.now)
        if (result !== null) { harvested += 1; crops += result.n; level = result.level ?? level }
      }
      if (harvested === 0) return { ok: false, reason: 'not-ripe' }
      tire(api, harvested)
      api.say('一口气收了' + harvested + '块地，' + crops + '个果实进了仓库！' + (level ? '菜园升到 ' + level + ' 级了！' : ''))
      return { ok: true, harvested }
    },
    /** 一键照料（要喷雾桶）：所有地的草、虫、旱一次治完。 */
    careAll(data, payload, api) {
      return batchAction(data, api, { tool: 'sprayer', key: 'cured', visit: index => carePlot(data, index, api.now), exp: CARE_EXP })
    },
    /** 一键铲除（要平地耙）：只铲枯萎秆，不碰正在长的。 */
    clearAll(data, payload, api) {
      return batchAction(data, api, { tool: 'rake', key: 'cleared', visit: index => Number(clearPlot(data, index)) })
    },
    /** 一键播种（要播种器）：同一种种子种满所有空地，种子不够就种到用完。 */
    plantAll(data, payload, api) {
      if (!owns(data, 'planter')) return { ok: false, reason: 'locked' }
      const crop = cropFor(payload?.item)
      if (crop === null || levelNow(data) < crop.level) return { ok: false, reason: crop === null ? 'unavailable' : 'level' }
      return batchAction(data, api, { tool: 'planter', key: 'planted', visit: index => Number(plantPlot(data, index, crop, api.now)), reason: amountFor(data, 'seeds', crop.key) < 1 ? 'no-seed' : 'unavailable' })
    },
    /** 卖：item 是作物；item '*' 是全卖。 */
    sell(data, payload, api) {
      if (payload?.item === '*') {
        let total = 0
        for (const crop of CROPS) { total += amountFor(data, 'harvest', crop.key) * crop.sell; data.harvest[crop.key] = 0 }
        if (total === 0) return { ok: false, reason: 'unavailable' }
        purse(api).earn(total, 'sell')
        return { ok: true, earned: total }
      }
      const n = payload?.count === undefined ? 1 : payload.count
      const crop = cropFor(payload?.item)
      if (crop === null || !validCount(n) || !Number.isSafeInteger(crop.sell * n) || amountFor(data, 'harvest', crop.key) < n) return { ok: false, reason: 'unavailable' }
      data.harvest[crop.key] -= n
      purse(api).earn(crop.sell * n, 'sell')
      return { ok: true, earned: crop.sell * n }
    },
    store(data, payload, api) {
      const crop = cropFor(payload?.item)
      const n = payload?.count === undefined ? 1 : payload.count
      if (crop === null || !crop.food || !validCount(n) || n > 99 || amountFor(data, 'harvest', crop.key) < n) return { ok: false, reason: 'unavailable' }
      if (!api.give(crop.food, n)) return { ok: false, reason: 'unavailable' }
      data.harvest[crop.key] -= n
      return { ok: true }
    },
  },
  view(data, api) {
    const d = normalize(structuredClone(data))
    settleHelper(d, api.now)
    const wallet = purse(api)
    const balance = wallet.balance() + d.refund
    const level = levelOf(d.exp)
    const managed = helperPlots(d)
    const plots = d.plots.map((plot, index) => {
      if (index >= d.unlocked) return { index, wild: true, next: index === d.unlocked }
      const state = plotState(plot, api.now)
      if (state === null || state.empty) return { index, empty: true, stubble: state?.stubble || false, pests: state?.pests || [], helper: index < managed }
      const crop = cropFor(state.crop)
      return { index, ...state, label: crop.label, emoji: crop.emoji, helper: index < managed, ...helperPlotView(d, index, state) }
    })
    const tally = test => plots.filter(test).length
    const counts = { ripe: tally(plot => plot.ripe), pests: tally(plot => plot.pests?.length > 0), withered: tally(plot => plot.withered), empty: tally(plot => plot.empty) }
    const hoursText = hours => (Number.isInteger(hours) ? hours : hours.toFixed(1)) + ' 小时'
    return {
      now: api.now, balance, currency: wallet.currency, level: level.level, exp: level.exp, need: level.need, weather: weatherAt(api.now),
      unlocked: d.unlocked, total: PLOTS, reclaimPrice: RECLAIM_PRICE, plots, counts,
      tools: TOOLS.map(tool => ({ key: tool.key, label: tool.label, note: tool.note, price: tool.price, owned: owns(d, tool.key) })),
      fert: FERTILIZERS.map(fert => ({ key: fert.key, label: fert.label, hours: fert.hours, price: fert.price, count: amountFor(d, 'fert', fert.key) })),
      seeds: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, count: amountFor(d, 'seeds', crop.key), price: crop.price, hours: crop.hours, level: crop.level, locked: level.level < crop.level, seasons: crop.seasons, yield: crop.yield, sell: crop.sell, exp: crop.exp })),
      harvest: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, count: amountFor(d, 'harvest', crop.key), sell: crop.sell, food: crop.food ?? null, foodLabel: crop.foodLabel ?? null })),
      helper: helperView(d),
      shelf: {
        key: 'farm', label: '菜园商店', emoji: '🌱', color: 'green', currency: { label: wallet.currency.label, emoji: wallet.currency.emoji, balance },
        items: [
          ...helperShelf(d, balance),
          ...CROPS.map(crop => {
            const locked = level.level < crop.level
            const note = locked ? crop.level + ' 级解锁' : hoursText(crop.hours) + '成熟 · 收约 ' + crop.yield + ' 个 · 卖 ' + crop.sell + (crop.seasons > 1 ? ' · ' + crop.seasons + ' 季' : '')
            return { key: crop.key, emoji: crop.emoji, label: crop.label + '种子', note, price: crop.price, disabled: locked || balance < crop.price, pick: null }
          }),
          ...FERTILIZERS.map(fert => ({ key: fert.key, emoji: '🧪', label: fert.label, note: '多长 ' + hoursText(fert.hours), price: fert.price, disabled: balance < fert.price, pick: null })),
          ...TOOLS.map(tool => {
            const owned = owns(d, tool.key)
            return { key: tool.key, emoji: '🧰', label: tool.label, note: owned ? '已拥有' : tool.note, price: tool.price, disabled: owned || balance < tool.price, pick: null }
          }),
        ],
      },
      dex: {
        key: 'crops', label: '作物', emoji: '🌾', color: 'green', entries: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, stars: 0, blurb: '收获过 ' + amountFor(d, 'acquired', crop.key) + ' 个', potential: amountFor(d, 'acquired', crop.key), acquired: amountFor(d, 'acquired', crop.key) > 0 })),
      },
    }
  },
}
/** 帮工猪（D，规矩照 J2：六小时封仓、每小时至多 400、比自己种少赚；4.0 管 4/8/16 块地）。用自己的小批次周期，管的地不长草不生虫，收成进自己的谷仓。 */
export const HELPER_PLOTS = [4, 8, 16]
/** 帮工实际净收益要到「同作物、同管地数自己种」的几成（用户 2026-10-13 要求九成；取整后落在 85%~92%）。 */
export const HELPER_SHARE = 0.9
export const HELPER_WINDOW = 6 * 3600000
export const HELPER_PRICES = { hire: 2500, level: [0, 2000, 6000], barn: [0, 1000, 3000, 9000] }
/** 旧公式的批数向下取整让净时薪只有自己种的 56%~89%；这里从「每批收成」往下试，挑净时薪落进 85%~92% 的组合（400 封顶、六小时整数批；农具档不再改收益）。 */
export function helperRecipe(key, level = 0, barn = 0) {
  const crop = cropFor(key)
  if (!crop) return null
  const manual = HELPER_PLOTS[level] * (crop.yield * crop.sell - crop.price) / crop.hours
  const target = Math.min(400, manual * HELPER_SHARE)
  for (let batches = 1; batches <= 60; batches += 1) {
    const y = Math.round((target * 6 / batches + crop.price) / crop.sell), net = (y * crop.sell - crop.price) * batches / 6
    if (y >= 1 && y <= crop.yield && net >= manual * 0.85 && net <= Math.min(manual * 0.92, 400)) return { yield: y, intervalMs: HELPER_WINDOW / batches, net, itemsPerHour: y * batches / 6, batches }
  }
  return null
}
function normalizeHelper(data) {
  const raw = isObject(data.helper) ? data.helper : {}
  const level = Math.min(2, count(raw.level))
  const barn = Math.min(3, count(raw.barn))
  const recipe = helperRecipe(raw.pending?.crop, level, barn)
  const pending = recipe && Number.isFinite(raw.pending.remainingMs) && Number.isInteger(raw.pending.index)
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
const helperCount = data => Object.values(data.helper.stock).reduce((sum, n) => sum + Number(n), 0)
const helperPlots = data => data.helper.hired ? Math.min(data.unlocked, HELPER_PLOTS[data.helper.level]) : 0
/** 没目标的空地：用仓库里数量最多的种子补种，一种都没有就没得种。 */
function helperSeed(data) {
  const have = crop => amountFor(data, 'seeds', crop.key)
  return CROPS.filter(crop => have(crop) > 0).sort((a, b) => have(b) - have(a))[0] ?? null
}
/** 枯萎的先铲；开荒地先清残株和杂草再补种；恢复时从当前动作时间开始，不补停工收益。 */
function prepareHelper(data, at) {
  const helper = data.helper
  const managed = helperPlots(data)
  for (let offset = 0; offset < managed; offset += 1) {
    const index = (helper.cursor + offset) % managed
    let plot = data.plots[index]
    if (plot?.withered) data.plots[index] = plot = null
    if (plot?.fallow && (plot.stubble || plot.pests.weed === 0)) { plot.stubble = false; plot.pests.weed = null; gainExp(data, CARE_EXP) }
    const crop = cropFor(plot?.crop ?? helper.targets[index]) ?? helperSeed(data)
    if (!crop) continue
    helper.targets[index] = crop.key
    if (!plot || plot.fallow) { if (!plantPlot(data, index, crop, at)) continue; plot = data.plots[index] }
    const recipe = helperRecipe(crop.key, helper.level, helper.barn)
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
  const start = helper.lastAt ?? now
  if (now < start) return
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
    helper.stock[pending.crop] += pending.yield
    data.acquired[pending.crop] = amountFor(data, 'acquired', pending.crop) + pending.yield
    data.harvests[pending.crop] = amountFor(data, 'harvests', pending.crop) + 1
    data.plots[pending.index] = null
    helper.cursor = (pending.index + 1) % helperPlots(data)
    helper.pending = null
    if (helper.usedMs >= HELPER_WINDOW - 0.00001) { helper.usedMs = HELPER_WINDOW; break }
    plantPlot(data, pending.index, cropFor(pending.crop), at)
    if (!prepareHelper(data, at)) break
  }
  helper.lastAt = now
}
function helperView(data) {
  const helper = data.helper
  const missing = helper.targets.slice(0, helperPlots(data)).filter((key, index) => key && !data.plots[index] && amountFor(data, 'seeds', key) === 0)
  const seedless = helperPlots(data) > 0 && !helper.pending && !CROPS.some(crop => amountFor(data, 'seeds', crop.key) > 0) && !data.plots.slice(0, helperPlots(data)).some(plot => plot?.crop)
  return { hired: helper.hired, plots: helperPlots(data), stored: helperCount(data), usedHours: helper.usedMs / 3600000,
    capacityHours: 6, full: helper.usedMs >= HELPER_WINDOW, seedless, missing: [...new Set(missing)].map(key => cropFor(key).label) }
}
/** 帮工管的地显示它自己的批次进度（不长草不生虫）；手动成熟的照旧可以自己收。 */
function helperPlotView(data, index, state) {
  if (index >= helperPlots(data) || state === null || state.ripe || state.withered) return {}
  const recipe = helperRecipe(state.crop, data.helper.level, data.helper.barn)
  if (!recipe) return {}
  const pending = data.helper.pending?.index === index ? data.helper.pending : null
  const remainingMs = pending?.remainingMs ?? recipe.intervalMs
  const progress = pending ? Math.max(0, Math.min(1, 1 - remainingMs / recipe.intervalMs)) : 0
  return { helperNote: data.helper.usedMs >= HELPER_WINDOW ? '等帮工接着干' : pending ? '帮工处理中' : '等帮工',
    pests: [], stage: STAGES[Math.min(4, Math.floor(progress * 5))], progress, remainingMs }
}
function helperShelf(data, balance) {
  const helper = data.helper
  return (helper.hired ? ['level', 'barn'] : ['hire']).flatMap(kind => {
    const next = kind === 'hire' ? 0 : helper[kind] + 1
    const price = kind === 'hire' ? HELPER_PRICES.hire : HELPER_PRICES[kind][next]
    if (price === undefined) return []
    const label = kind === 'hire' ? '雇帮工猪' : kind === 'level' ? ['帮工猪', '熟练帮工', '老练帮工'][next] : ['小谷仓', '顺手农具', '轻巧农具', '高效农具'][next]
    const note = kind === 'hire' ? '管 ' + HELPER_PLOTS[0] + ' 块地，六小时封仓' : kind === 'level' ? '管 ' + HELPER_PLOTS[next] + ' 块地' : '提高自动收成效率'
    return [{ key: 'helper-' + kind, emoji: kind === 'barn' ? '🧺' : '🐷', label, note, price, disabled: balance < price, pick: null }]
  })
}
function helperBuy(data, payload, api) {
  const helper = data.helper
  const kind = String(payload?.item).replace('helper-', '')
  if (kind === 'hire') {
    if (helper.hired) return { ok: false, reason: 'owned' }
    if (!purse(api).spend(HELPER_PRICES.hire, 'helper')) return { ok: false, reason: 'poor' }
    helper.hired = true
    helper.lastAt = api.now
  } else {
    if (!helper.hired || !['level', 'barn'].includes(kind)) return { ok: false, reason: 'locked' }
    const price = HELPER_PRICES[kind][helper[kind] + 1]
    if (price === undefined) return { ok: false, reason: 'owned' }
    if (!purse(api).spend(price, 'helper')) return { ok: false, reason: 'poor' }
    helper[kind] += 1
  }
  return { ok: true }
}
game.actions.hire = (data, payload, api) => helperBuy(data, { item: 'helper-hire' }, api)
game.actions.upgrade = (data, payload, api) => helperBuy(data, { item: 'helper-' + payload?.kind }, api)
/** 收仓：帮工谷仓里的东西进仓库，六小时重新算。 */
game.actions.collect = data => {
  if (!helperCount(data) && data.helper.usedMs === 0) return { ok: false, reason: 'empty' }
  for (const crop of CROPS) data.harvest[crop.key] = amountFor(data, 'harvest', crop.key) + data.helper.stock[crop.key]
  data.helper.stock = Object.fromEntries(CROPS.map(crop => [crop.key, 0]))
  data.helper.usedMs = 0
  return { ok: true }
}
for (const [key, action] of Object.entries(game.actions)) {
  game.actions[key] = (data, payload, api) => {
    normalize(data)
    payRefund(data, api)
    settleHelper(data, api?.now)
    const result = action(data, payload, api)
    if (result.ok) {
      settleHelper(data, api?.now)
      if (typeof api?.emit === 'function') for (const { name, ...payload } of progress(data)) api.emit(name, payload)
    }
    return result
  }
}
export default game
