// @ts-check
// 菜园给面板的 view：只读副本，结算帮工但不写回；地块、商店、图鉴和第一课的数据形状都在这里。
import { CROPS, FERTILIZERS, LESSON, PLOTS, RECLAIM_PRICE, TOOLS } from './data.js'
import { helperPlotView, helperPlots, helperShelf, helperView, settleHelper } from './helper.js'
import { purse } from './host.js'
import { normalize } from './migration.js'
import { amountFor, lessonAt, owns } from './plot-rules.js'
import { cropFor, levelOf, plotState, weatherAt } from './pure.js'

/** @param {any} data @param {any} api */
export function view(data, api) {
  const d = normalize(structuredClone(data))
  settleHelper(d, api.now)
  const wallet = purse(api), balance = wallet.balance() + d.refund
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
  const seeds = CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, count: amountFor(d, 'seeds', crop.key), price: crop.price, hours: crop.hours, level: crop.level, locked: level.level < crop.level, seasons: crop.seasons, yield: crop.yield, sell: crop.sell, exp: crop.exp }))
  const tools = TOOLS.map(tool => ({ key: tool.key, label: tool.label, note: tool.note, price: tool.price, owned: owns(d, tool.key) }))
  const cropItems = seeds.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label + '种子', note: crop.locked ? crop.level + ' 级解锁' : hoursText(crop.hours) + '成熟 · 收约 ' + crop.yield + ' 个 · 卖 ' + crop.sell + (crop.seasons > 1 ? ' · ' + crop.seasons + ' 季' : ''), price: crop.price, disabled: crop.locked || balance < crop.price, pick: null }))
  const o = d.onboarding, readyAt = lessonAt(o), lessonReady = o.step === 'planted' && readyAt !== null && api.now >= readyAt, lessonMs = o.wateredAt === null ? LESSON.ripeMs : LESSON.wateredMs
  return {
    onboarding: { step: o.step, legacy: o.legacy, rewarded: o.rewarded, watered: o.wateredAt !== null, plantedAt: o.plantedAt, wateredAt: o.wateredAt, readyAt, ready: lessonReady,
      progress: o.step === 'done' ? 1 : readyAt === null ? 0 : lessonReady ? 1 : Math.max(0, Math.min(1, (api.now - o.plantedAt) / lessonMs)), remainingMs: o.step === 'done' || lessonReady || readyAt === null ? 0 : Math.min(lessonMs, Math.max(0, readyAt - api.now)),
      seed: { key: LESSON.seed, emoji: '🌱', label: cropFor(LESSON.seed).label + '种子', count: o.step === 'done' ? 0 : 1, lessonOnly: true },
      reward: { currency: LESSON.reward, seed: LESSON.seed, exp: 0 }, canStart: o.step === 'offer', canPlant: o.step === 'offer', canWater: o.step === 'planted' && o.wateredAt === null, canHarvest: lessonReady },
    now: api.now, balance, currency: wallet.currency, level: level.level, exp: level.exp, need: level.need, weather: weatherAt(api.now),
    unlocked: d.unlocked, total: PLOTS, reclaimPrice: RECLAIM_PRICE, plots, counts,
    tools,
    fert: FERTILIZERS.map(fert => ({ key: fert.key, label: fert.label, hours: fert.hours, price: fert.price, count: amountFor(d, 'fert', fert.key) })),
    seeds,
    harvest: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, count: amountFor(d, 'harvest', crop.key), sell: crop.sell, food: crop.food ?? null, foodLabel: crop.foodLabel ?? null })),
    helper: helperView(d),
    shelf: {
      key: 'farm', label: '菜园商店', emoji: '🌱', color: 'green', currency: { label: wallet.currency.label, emoji: wallet.currency.emoji, balance },
      items: [
        ...helperShelf(d, balance),
        ...cropItems,
        ...FERTILIZERS.map(fert => ({ key: fert.key, emoji: '🧪', label: fert.label, note: '多长 ' + hoursText(fert.hours), price: fert.price, disabled: balance < fert.price, pick: null })),
        ...tools.map(tool => ({ key: tool.key, emoji: '🧰', label: tool.label, note: tool.owned ? '已拥有' : tool.note, price: tool.price, disabled: tool.owned || balance < tool.price, pick: null })),
      ],
    },
    dex: {
      key: 'crops', label: '作物', emoji: '🌾', color: 'green', entries: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, stars: 0, blurb: '收获过 ' + amountFor(d, 'acquired', crop.key) + ' 个', potential: amountFor(d, 'acquired', crop.key), acquired: amountFor(d, 'acquired', crop.key) > 0 })),
    },
  }
}
