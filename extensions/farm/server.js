// @ts-check
// 菜园扩展 2.0（数值见 docs/numbers/J1-economy.md 第 2 节）：用自己的「菜币」，钱包在宿主（api.wallet）。
// 一键浇水 / 收获 / 种满照增量游戏的做法，一开始锁着，买了大水壶 / 收割镰 / 播种器才解锁（用户 2026-10-09）。
// 只保存菜园数据；金币、背包、说话、累都经过宿主 api。

/** 第 1～8 块地的开垦价（菜币）。 */
export const PLOT_PRICES = [0, 0, 500, 1200, 2500, 5000, 10000, 20000]
export const PLOTS = PLOT_PRICES.length

export const CROPS = [
  { key: 'sprout', emoji: '🌱', label: '豆芽', price: 4, minutes: 5, yield: 2, sell: 5, food: null },
  { key: 'scallion', emoji: '🧅', label: '小葱', price: 6, minutes: 10, yield: 3, sell: 5, food: null },
  { key: 'coriander', emoji: '🌿', label: '香菜', price: 8, minutes: 12, yield: 3, sell: 6, food: null },
  { key: 'lettuce', emoji: '🥗', label: '生菜', price: 10, minutes: 15, yield: 3, sell: 8, food: null },
  { key: 'cabbage', emoji: '🥬', label: '小白菜', price: 10, minutes: 30, yield: 3, sell: 12, food: null },
  { key: 'strawberry', emoji: '🍓', label: '草莓', price: 20, minutes: 60, yield: 3, sell: 25, food: 'strawberry', foodLabel: '草莓' },
  { key: 'blueberry', emoji: '🫐', label: '蓝莓', price: 30, minutes: 90, yield: 4, sell: 29, food: null },
  { key: 'carrot', emoji: '🥕', label: '胡萝卜', price: 25, minutes: 120, yield: 4, sell: 36, food: null },
  { key: 'sweetpotato', emoji: '🍠', label: '红薯', price: 40, minutes: 180, yield: 3, sell: 78, food: 'sweetpotato', foodLabel: '烤红薯' },
  { key: 'tomato', emoji: '🍅', label: '番茄', price: 60, minutes: 240, yield: 4, sell: 85, food: null },
  { key: 'corn', emoji: '🌽', label: '玉米', price: 80, minutes: 300, yield: 5, sell: 91, food: null },
  { key: 'pumpkin', emoji: '🎃', label: '南瓜', price: 90, minutes: 360, yield: 2, sell: 285, food: 'pumpkin', foodLabel: '南瓜粥' },
  { key: 'sunflower', emoji: '🌻', label: '向日葵', price: 120, minutes: 420, yield: 3, sell: 238, food: null },
  { key: 'watermelon', emoji: '🍉', label: '西瓜', price: 150, minutes: 480, yield: 2, sell: 435, food: null },
  { key: 'grape', emoji: '🍇', label: '葡萄', price: 200, minutes: 600, yield: 3, sell: 400, food: null },
  { key: 'melon', emoji: '🍈', label: '哈密瓜', price: 260, minutes: 720, yield: 2, sell: 790, food: null },
]

/** 工具：一键操作在增量游戏里一开始锁着，买了才有。洒水器按块买，肥料是消耗品。 */
export const TOOLS = [
  { key: 'can', emoji: '🪣', label: '大水壶', price: 600, note: '解锁一键浇水' },
  { key: 'sickle', emoji: '🌾', label: '收割镰', price: 1000, note: '解锁一键收获' },
  { key: 'planter', emoji: '🫘', label: '播种器', price: 1800, note: '解锁一键种满' },
  { key: 'sprinkler', emoji: '💦', label: '洒水器', price: 3000, note: '装在一块地上，以后自动浇水' },
  { key: 'fertilizer', emoji: '🧪', label: '肥料', price: 20, note: '施在一块地上，这一季快 30%' },
]

/** 「玩会累」：种、浇、收一块地扣多少饱食（data/economy.js 的建议值）。 */
export const EXERT = 0.2
/** 施了肥的地，这一季每个阶段只要原来的这么多。 */
export const FERTILIZED = 0.7

const cropFor = key => CROPS.find(crop => crop.key === key) ?? null
const toolFor = key => TOOLS.find(tool => tool.key === key) ?? null
const count = value => Math.max(0, Math.floor(Number(value) || 0))
const validCount = value => Number.isSafeInteger(value) && value > 0

/** 一个生长阶段需要的浇水后时间；施了肥的打折。 */
export function stageTime(key, fertilized = false) {
  const crop = cropFor(key)
  return crop === null ? 0 : crop.minutes * 60_000 / 3 * (fertilized ? FERTILIZED : 1)
}

/**
 * 纯函数：到了边界就进下一阶段。没洒水器时下一阶段要重新浇水，时间再久也不长；
 * 有洒水器时自动浇水，离线久了可以一口气长过好几个阶段。
 */
export function advancePlot(plot, now, sprinkler = false) {
  if (plot === null) return null
  let current = { ...plot }
  const duration = stageTime(current.crop, current.fertilized === true)
  if (!duration) return current
  for (let guard = 0; guard < 3; guard += 1) {
    const stage = Number(current.stage)
    if (!Number.isInteger(stage) || stage < 0 || stage >= 3) break
    if (!Number.isFinite(current.wateredAt)) {
      if (!sprinkler) break
      current = { ...current, wateredAt: now }
    }
    if (now - current.wateredAt < duration) break
    current = { ...current, stage: stage + 1, wateredAt: sprinkler ? current.wateredAt + duration : null }
  }
  if (current.stage >= 3) current.wateredAt = null
  return current
}

/** 旧存档（1.x 是 6 块地、用金币）缺字段时补齐；只用于动作中的私有数据。 */
export function normalize(data) {
  if (!Array.isArray(data.plots)) data.plots = []
  data.plots = Array.from({ length: PLOTS }, (_, index) => data.plots[index] ?? null)
  if (!Number.isInteger(data.unlocked)) data.unlocked = 2
  data.unlocked = Math.min(PLOTS, Math.max(2, data.unlocked))
  for (const field of ['seeds', 'harvest', 'acquired', 'tools']) {
    if (data[field] === null || typeof data[field] !== 'object' || Array.isArray(data[field])) data[field] = {}
  }
  if (!Array.isArray(data.sprinklers)) data.sprinklers = []
  data.sprinklers = Array.from({ length: PLOTS }, (_, index) => data.sprinklers[index] === true)
  data.fertilizer = count(data.fertilizer)
  return data
}

const availablePlot = (data, index) => Number.isInteger(index) && index >= 0 && index < data.unlocked
const amountFor = (data, field, key) => count(data[field][key])
const owns = (data, tool) => data.tools[tool] === true

/** 菜币钱包；老宿主（没有 api.wallet）退回金币，免得装上就坏。 */
function purse(api) {
  if (api.wallet) return api.wallet
  return { currency: { label: '金币', emoji: '🪙', rate: 1 }, balance: () => api.coins(), earn: (n, source) => api.earn(n, source), spend: (n, sink) => api.spend(n, sink) }
}
const tire = (api, plots = 1) => { if (typeof api.exert === 'function') api.exert(EXERT * plots) }

function sayHarvest(crop) {
  if (crop.key === 'carrot') return '拔了四个胡萝卜，我一个都没偷吃'
  return '收了' + crop.yield + '个' + crop.label + '，菜园有收成啦！'
}

/** Historical totals come from acquired crops, not the current warehouse. */
export function progress(data) {
  const saved = normalize(structuredClone(data))
  const crops = CROPS.filter(crop => Number.isSafeInteger(saved.acquired[crop.key]) && saved.acquired[crop.key] >= crop.yield)
  return [{ name: 'harvest', total: crops.reduce((sum, crop) => Math.min(Number.MAX_SAFE_INTEGER, sum + Math.floor(saved.acquired[crop.key] / crop.yield)), 0), items: crops.map(crop => crop.key) }]
}

function reportProgress(data, api) {
  if (typeof api.emit !== 'function') return
  for (const { name, ...payload } of progress(data)) api.emit(name, payload)
}

/** 收一块熟了的地，返回收到的作物（没熟返回 null）。 */
function harvestPlot(data, index, api) {
  const plot = advancePlot(data.plots[index], api.now, data.sprinklers[index])
  if (plot === null || plot.stage !== 3) return null
  const crop = cropFor(plot.crop)
  if (crop === null) return null
  data.harvest[crop.key] = amountFor(data, 'harvest', crop.key) + crop.yield
  data.acquired[crop.key] = amountFor(data, 'acquired', crop.key) + crop.yield
  data.plots[index] = null
  return crop
}

/** 给一块缺水的地浇水，浇了返回 true。 */
function waterPlot(data, index, api) {
  const plot = advancePlot(data.plots[index], api.now, data.sprinklers[index])
  if (plot === null || plot.stage >= 3 || plot.wateredAt !== null) return false
  data.plots[index] = { ...plot, wateredAt: api.now }
  return true
}

/** 在空地上种一粒种子，种了返回 true。 */
function plantPlot(data, index, crop, api) {
  if (data.plots[index] !== null || amountFor(data, 'seeds', crop.key) < 1) return false
  data.seeds[crop.key] -= 1
  data.plots[index] = { crop: crop.key, stage: 0, plantedAt: api.now, wateredAt: data.sprinklers[index] ? api.now : null }
  return true
}

export default {
  eventVersion: 1,
  progress,
  init() { return normalize({}) },

  actions: {
    /** 商店货架：种子（可一次买多颗）和工具。 */
    buy(data, payload, api) {
      normalize(data)
      const wallet = purse(api)
      const crop = cropFor(payload.item)
      if (crop !== null) {
        const n = payload.count === undefined ? 1 : payload.count
        if (!validCount(n) || n > 999) return { ok: false, reason: 'unavailable' }
        if (!wallet.spend(crop.price * n, 'seed')) return { ok: false, reason: 'poor' }
        data.seeds[crop.key] = amountFor(data, 'seeds', crop.key) + n
        return { ok: true }
      }
      const tool = toolFor(payload.item)
      if (tool === null) return { ok: false, reason: 'unknown' }
      if (tool.key === 'fertilizer') {
        if (!wallet.spend(tool.price, 'fertilizer')) return { ok: false, reason: 'poor' }
        data.fertilizer += 1
        return { ok: true }
      }
      if (tool.key === 'sprinkler') {
        const index = Number.isInteger(payload.plot) ? payload.plot : data.sprinklers.findIndex((on, at) => !on && at < data.unlocked)
        if (!availablePlot(data, index) || data.sprinklers[index]) return { ok: false, reason: 'owned' }
        if (!wallet.spend(tool.price, 'tool')) return { ok: false, reason: 'poor' }
        data.sprinklers[index] = true
        const plot = advancePlot(data.plots[index], api.now, false)
        if (plot !== null && plot.stage < 3 && plot.wateredAt === null) data.plots[index] = { ...plot, wateredAt: api.now }
        return { ok: true }
      }
      if (owns(data, tool.key)) return { ok: false, reason: 'owned' }
      if (!wallet.spend(tool.price, 'tool')) return { ok: false, reason: 'poor' }
      data.tools[tool.key] = true
      api.say('买到了' + tool.label + '！' + tool.note.replace('解锁', '以后可以'))
      return { ok: true }
    },

    unlock(data, payload, api) {
      normalize(data)
      if (payload.plot !== data.unlocked || data.unlocked >= PLOTS) return { ok: false, reason: 'locked' }
      if (!purse(api).spend(PLOT_PRICES[data.unlocked], 'plot')) return { ok: false, reason: 'poor' }
      data.unlocked += 1
      return { ok: true }
    },

    plant(data, payload, api) {
      normalize(data)
      const crop = cropFor(payload.item)
      if (crop === null || !availablePlot(data, payload.plot) || data.plots[payload.plot] !== null) return { ok: false, reason: 'unavailable' }
      if (!plantPlot(data, payload.plot, crop, api)) return { ok: false, reason: 'no-seed' }
      tire(api)
      return { ok: true }
    },

    /** 一键种满（要播种器）：同一种种子种满所有空地，种子不够就种到用完。 */
    plantAll(data, payload, api) {
      normalize(data)
      if (!owns(data, 'planter')) return { ok: false, reason: 'locked' }
      const crop = cropFor(payload.item)
      if (crop === null) return { ok: false, reason: 'unavailable' }
      let planted = 0
      for (let index = 0; index < data.unlocked; index += 1) if (plantPlot(data, index, crop, api)) planted += 1
      if (planted === 0) return { ok: false, reason: amountFor(data, 'seeds', crop.key) < 1 ? 'no-seed' : 'unavailable' }
      tire(api, planted)
      return { ok: true, planted }
    },

    water(data, payload, api) {
      normalize(data)
      if (!availablePlot(data, payload.plot)) return { ok: false, reason: 'locked' }
      if (!waterPlot(data, payload.plot, api)) return { ok: false, reason: 'unavailable' }
      tire(api)
      return { ok: true }
    },

    /** 一键浇水（要大水壶）。 */
    waterAll(data, payload, api) {
      normalize(data)
      if (!owns(data, 'can')) return { ok: false, reason: 'locked' }
      let watered = 0
      for (let index = 0; index < data.unlocked; index += 1) if (waterPlot(data, index, api)) watered += 1
      if (watered === 0) return { ok: false, reason: 'unavailable' }
      tire(api, watered)
      return { ok: true, watered }
    },

    /** 施肥：这一季每个阶段快 30%（正在长的阶段从现在起按新速度算）。 */
    fertilize(data, payload, api) {
      normalize(data)
      if (!availablePlot(data, payload.plot)) return { ok: false, reason: 'locked' }
      if (data.fertilizer < 1) return { ok: false, reason: 'empty' }
      const plot = advancePlot(data.plots[payload.plot], api.now, data.sprinklers[payload.plot])
      if (plot === null || plot.stage >= 3 || plot.fertilized === true) return { ok: false, reason: 'unavailable' }
      data.fertilizer -= 1
      data.plots[payload.plot] = { ...plot, fertilized: true }
      return { ok: true }
    },

    harvest(data, payload, api) {
      normalize(data)
      if (!availablePlot(data, payload.plot)) return { ok: false, reason: 'locked' }
      const crop = harvestPlot(data, payload.plot, api)
      if (crop === null) return { ok: false, reason: 'not-ripe' }
      tire(api)
      reportProgress(data, api)
      api.say(sayHarvest(crop))
      return { ok: true }
    },

    /** 一键收获（要收割镰）。 */
    harvestAll(data, payload, api) {
      normalize(data)
      if (!owns(data, 'sickle')) return { ok: false, reason: 'locked' }
      let harvested = 0
      for (let index = 0; index < data.unlocked; index += 1) if (harvestPlot(data, index, api) !== null) harvested += 1
      if (harvested === 0) return { ok: false, reason: 'not-ripe' }
      tire(api, harvested)
      reportProgress(data, api)
      api.say('一口气收了' + harvested + '块地，仓库都快装不下了！')
      return { ok: true, harvested }
    },

    sell(data, payload, api) {
      normalize(data)
      const crop = cropFor(payload.item)
      const n = payload.count === undefined ? 1 : payload.count
      if (crop === null || !validCount(n) || !Number.isSafeInteger(crop.sell * n) || amountFor(data, 'harvest', crop.key) < n) return { ok: false, reason: 'unavailable' }
      data.harvest[crop.key] -= n
      purse(api).earn(crop.sell * n, 'sell')
      return { ok: true }
    },

    store(data, payload, api) {
      normalize(data)
      const crop = cropFor(payload.item)
      const n = payload.count === undefined ? 1 : payload.count
      if (crop === null || crop.food === null || !validCount(n) || n > 99 || amountFor(data, 'harvest', crop.key) < n) return { ok: false, reason: 'unavailable' }
      if (!api.give(crop.food, n)) return { ok: false, reason: 'unavailable' }
      data.harvest[crop.key] -= n
      return { ok: true }
    },
  },

  view(data, api) {
    const d = normalize(structuredClone(data))
    const wallet = purse(api)
    const balance = wallet.balance()
    const minutesText = minutes => minutes >= 60 ? minutes / 60 + ' 小时' : minutes + ' 分钟'
    return {
      now: api.now,
      balance,
      currency: wallet.currency,
      unlocked: d.unlocked,
      prices: PLOT_PRICES,
      tools: TOOLS.map(tool => ({ key: tool.key, emoji: tool.emoji, label: tool.label, note: tool.note, price: tool.price, owned: tool.key === 'fertilizer' ? d.fertilizer > 0 : owns(d, tool.key) })),
      fertilizer: d.fertilizer,
      sprinklers: d.sprinklers,
      plots: d.plots.map((plot, index) => {
        const current = advancePlot(plot, api.now, d.sprinklers[index])
        if (current === null) return null
        const crop = cropFor(current.crop)
        const duration = stageTime(current.crop, current.fertilized === true)
        const left = current.stage >= 3 || current.wateredAt === null ? 0 : Math.max(0, duration - (api.now - current.wateredAt))
        const inStage = current.wateredAt === null || !duration ? 0 : 1 - left / duration
        return {
          crop: current.crop, stage: current.stage, fertilized: current.fertilized === true,
          emoji: current.stage === 0 ? '🟫' : current.stage === 1 ? '🌱' : current.stage === 2 ? '🌿' : crop?.emoji ?? '🟫',
          cropEmoji: crop?.emoji ?? '', label: crop?.label ?? '',
          thirsty: current.stage < 3 && current.wateredAt === null,
          remainingMs: left,
          /** 这一季整体走到哪了（0～1），给进度条用。 */
          progress: current.stage >= 3 ? 1 : Math.min(1, (current.stage + inStage) / 3),
        }
      }),
      seeds: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, count: amountFor(d, 'seeds', crop.key), price: crop.price, minutes: crop.minutes })),
      harvest: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, count: amountFor(d, 'harvest', crop.key), sell: crop.sell, food: crop.food, foodLabel: crop.foodLabel ?? null })),
      shelf: {
        key: 'farm', label: '菜园商店', emoji: '🌱', color: 'green',
        currency: { label: wallet.currency.label, emoji: wallet.currency.emoji, balance },
        items: [
          ...CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label + '种子', note: minutesText(crop.minutes) + '成熟 · 收 ' + crop.yield + ' 个 · 卖 ' + crop.sell, price: crop.price, disabled: balance < crop.price, pick: null })),
          ...TOOLS.map(tool => {
            const owned = tool.key !== 'fertilizer' && tool.key !== 'sprinkler' && owns(d, tool.key)
            return { key: tool.key, emoji: tool.emoji, label: tool.label, note: owned ? '已拥有' : tool.note, price: tool.price, disabled: owned || balance < tool.price, pick: null }
          }),
        ],
      },
      dex: {
        key: 'crops', label: '作物', emoji: '🌾', color: 'green',
        entries: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, stars: 0, blurb: '收获过 ' + amountFor(d, 'acquired', crop.key) + ' 个', potential: amountFor(d, 'acquired', crop.key), acquired: amountFor(d, 'acquired', crop.key) > 0 })),
      },
    }
  },
}
