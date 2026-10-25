// @ts-check
// 菜园动作：商店、开垦、第一课、种/照料/收/铲、一键动作、卖菜和做饭。
// 每个动作只改传进来的 data 和宿主 api；事务、迁移和帮工结算由 server.js 的入口统一包住。
import { CARE_EXP, CROPS, HOUR_MS, LESSON, PESTS, PLOTS, RECLAIM_PRICE } from './data.js'
import { collectHelper, helperBuy } from './helper.js'
import { purse, tire } from './host.js'
import { newGround } from './migration.js'
import { amountFor, availablePlot, batchAction, carePlot, clearPlot, harvestPlot, lessonAt, levelNow, owns, plantPlot, plotAction, sayHarvest } from './plot-rules.js'
import { cropFor, fertFor, plotState, toolFor, validCount } from './pure.js'

export const actions = {
  /** 商店：种子（可一次买多颗）、工具、肥料、帮工。 */
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
  /** 第一课：op = start / plant / water / harvest；不碰普通地块、种子、仓库、经验、体力或帮工。 */
  onboarding(data, payload, api) {
    const o = data.onboarding, op = String(payload?.op ?? ''), readyAt = lessonAt(o)
    const allowed = { start: o.step === 'offer', plant: o.step === 'offer', water: o.step === 'planted' && o.wateredAt === null, harvest: o.step === 'planted' && readyAt !== null && api.now >= readyAt }[op]
    if (!allowed) return { ok: false, reason: o.step === 'done' || o.rewarded || (op === 'water' && o.wateredAt !== null) || (op === 'start' && o.step !== 'offer') || (op === 'plant' && o.step !== 'offer') ? 'already' : op === 'harvest' ? 'not-ripe' : 'unavailable' }
    if (op === 'start') return { ok: true, step: o.step }
    if (op === 'plant') { o.step = 'planted'; o.plantedAt = api.now; o.wateredAt = null; return { ok: true } }
    if (op === 'water') { o.wateredAt = api.now; return { ok: true } }
    o.step = 'done'; o.rewarded = true; purse(api).earn(LESSON.reward, 'tutorial'); data.seeds[LESSON.seed] = amountFor(data, 'seeds', LESSON.seed) + 1
    return { ok: true, earned: LESSON.reward, seed: LESSON.seed, exp: 0 }
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
  care: plotAction((data, payload, api) => {
    const kind = PESTS.includes(payload.kind) ? payload.kind : null
    return batchAction(data, api, { indices: [payload.plot], key: 'cured', visit: index => carePlot(data, index, api.now, kind), exp: CARE_EXP })
  }),
  fertilize: plotAction((data, payload, api) => {
    const fert = fertFor(payload.item)
    if (fert === null || amountFor(data, 'fert', fert.key) < 1) return { ok: false, reason: 'empty' }
    const state = plotState(data.plots[payload.plot], api.now)
    if (state === null || state.empty || state.ripe || state.withered) return { ok: false, reason: 'unavailable' }
    data.fert[fert.key] -= 1
    data.plots[payload.plot].boostMs += fert.hours * HOUR_MS
    return { ok: true }
  }),
  harvest: plotAction((data, payload, api) => {
    const result = harvestPlot(data, payload.plot, api.now)
    if (result === null) return { ok: false, reason: 'not-ripe' }
    tire(api)
    api.say(sayHarvest(result))
    return { ok: true, n: result.n }
  }),
  /** 铲地：枯苗随便铲；正在长的作物要 force（界面先问一句）。 */
  clear: plotAction((data, payload, api) => {
    if (!clearPlot(data, payload.plot, payload.force === true)) return { ok: false, reason: 'unavailable' }
    tire(api)
    return { ok: true }
  }),
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
    api.say('一口气收获 ' + harvested + ' 块地，' + crops + ' 个果实进了仓库！' + (level ? '菜园升到 ' + level + ' 级了！' : ''))
    return { ok: true, harvested }
  },
  /** 一键照料（要喷雾桶）：所有地的草、虫、旱一次治完。 */
  careAll(data, payload, api) {
    return batchAction(data, api, { tool: 'sprayer', key: 'cured', visit: index => carePlot(data, index, api.now), exp: CARE_EXP })
  },
  /** 一键铲除（要平地耙）：只铲枯苗，不碰正在长的。 */
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
}
// 旧动作别名和收仓：保持面板老按钮与既有调用可用。
actions.hire = (data, payload, api) => helperBuy(data, { item: 'helper-hire' }, api)
actions.upgrade = (data, payload, api) => helperBuy(data, { item: 'helper-' + payload?.kind }, api)
actions.collect = data => collectHelper(data)
