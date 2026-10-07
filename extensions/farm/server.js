// @ts-check
// 菜园扩展 1.0：只保存菜园数据，金币、背包和说话都经过宿主 api。
export const PLOT_PRICES = [0, 0, 500, 1200, 2500, 5000]

export const CROPS = [
  { key: 'cabbage', emoji: '🥬', label: '小白菜', price: 10, minutes: 30, yield: 3, sell: 6, food: null },
  { key: 'strawberry', emoji: '🍓', label: '草莓', price: 20, minutes: 60, yield: 3, sell: 12, food: 'strawberry', foodLabel: '草莓' },
  { key: 'carrot', emoji: '🥕', label: '胡萝卜', price: 25, minutes: 120, yield: 4, sell: 12, food: null },
  { key: 'sweetpotato', emoji: '🍠', label: '红薯', price: 40, minutes: 180, yield: 3, sell: 25, food: 'sweetpotato', foodLabel: '烤红薯' },
  { key: 'tomato', emoji: '🍅', label: '番茄', price: 60, minutes: 240, yield: 4, sell: 25, food: null },
  { key: 'pumpkin', emoji: '🎃', label: '南瓜', price: 90, minutes: 360, yield: 2, sell: 75, food: 'pumpkin', foodLabel: '南瓜粥' },
  { key: 'corn', emoji: '🌽', label: '玉米', price: 80, minutes: 300, yield: 5, sell: 30, food: null },
  { key: 'watermelon', emoji: '🍉', label: '西瓜', price: 150, minutes: 480, yield: 2, sell: 140, food: null },
]

const cropFor = key => CROPS.find(crop => crop.key === key) ?? null
const count = value => Math.max(0, Math.floor(Number(value) || 0))
const validCount = value => Number.isSafeInteger(value) && value > 0

/** 一个生长阶段需要的浇水后时间。 */
export function stageTime(key) {
  const crop = cropFor(key)
  return crop === null ? 0 : crop.minutes * 60_000 / 3
}

/** 纯函数：到了边界就进下一阶段；下一阶段没有水，时间再久也不继续长。 */
export function advancePlot(plot, now) {
  if (plot === null) return null
  const stage = Number(plot.stage)
  const duration = stageTime(plot.crop)
  if (!duration || !Number.isInteger(stage) || stage < 0 || stage >= 3 || !Number.isFinite(plot.wateredAt)) return { ...plot }
  if (now - plot.wateredAt < duration) return { ...plot }
  return { ...plot, stage: stage + 1, wateredAt: null }
}

/** 旧存档缺字段时补齐；只用于动作中的私有数据。 */
export function normalize(data) {
  if (!Array.isArray(data.plots)) data.plots = Array(6).fill(null)
  data.plots = Array.from({ length: 6 }, (_, index) => data.plots[index] ?? null)
  if (!Number.isInteger(data.unlocked)) data.unlocked = 2
  data.unlocked = Math.min(6, Math.max(2, data.unlocked))
  for (const field of ['seeds', 'harvest', 'acquired']) {
    if (data[field] === null || typeof data[field] !== 'object' || Array.isArray(data[field])) data[field] = {}
  }
  return data
}

function availablePlot(data, index) {
  return Number.isInteger(index) && index >= 0 && index < data.unlocked
}

function amountFor(data, field, key) {
  return count(data[field][key])
}

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

export default {
  eventVersion: 1,
  progress,
  init() { return normalize({}) },

  actions: {
    buy(data, payload, api) {
      normalize(data)
      const crop = cropFor(payload.item)
      if (crop === null) return { ok: false, reason: 'unknown' }
      if (!api.spend(crop.price)) return { ok: false, reason: 'poor' }
      data.seeds[crop.key] = amountFor(data, 'seeds', crop.key) + 1
      return { ok: true }
    },

    unlock(data, payload, api) {
      normalize(data)
      if (payload.plot !== data.unlocked || data.unlocked >= 6) return { ok: false, reason: 'locked' }
      if (!api.spend(PLOT_PRICES[data.unlocked])) return { ok: false, reason: 'poor' }
      data.unlocked += 1
      return { ok: true }
    },

    plant(data, payload, api) {
      normalize(data)
      const crop = cropFor(payload.item)
      if (crop === null || !availablePlot(data, payload.plot) || data.plots[payload.plot] !== null) return { ok: false, reason: 'unavailable' }
      if (amountFor(data, 'seeds', crop.key) < 1) return { ok: false, reason: 'no-seed' }
      data.seeds[crop.key] -= 1
      data.plots[payload.plot] = { crop: crop.key, stage: 0, plantedAt: api.now, wateredAt: null }
      return { ok: true }
    },

    water(data, payload, api) {
      normalize(data)
      if (!availablePlot(data, payload.plot)) return { ok: false, reason: 'locked' }
      const plot = advancePlot(data.plots[payload.plot], api.now)
      if (plot === null || plot.stage >= 3 || plot.wateredAt !== null) return { ok: false, reason: 'unavailable' }
      data.plots[payload.plot] = { ...plot, wateredAt: api.now }
      return { ok: true }
    },

    harvest(data, payload, api) {
      normalize(data)
      if (!availablePlot(data, payload.plot)) return { ok: false, reason: 'locked' }
      const plot = advancePlot(data.plots[payload.plot], api.now)
      if (plot === null || plot.stage !== 3) return { ok: false, reason: 'not-ripe' }
      const crop = cropFor(plot.crop)
      if (crop === null) return { ok: false, reason: 'unknown' }
      data.harvest[crop.key] = amountFor(data, 'harvest', crop.key) + crop.yield
      data.acquired[crop.key] = amountFor(data, 'acquired', crop.key) + crop.yield
      data.plots[payload.plot] = null
      reportProgress(data, api)
      api.say(sayHarvest(crop))
      return { ok: true }
    },

    sell(data, payload, api) {
      normalize(data)
      const crop = cropFor(payload.item)
      const n = payload.count === undefined ? 1 : payload.count
      if (crop === null || !validCount(n) || !Number.isSafeInteger(crop.sell * n) || amountFor(data, 'harvest', crop.key) < n) return { ok: false, reason: 'unavailable' }
      data.harvest[crop.key] -= n
      // 宿主单次 earn 最多记 10 万，整仓出售时分笔结算。
      let earnings = crop.sell * n
      while (earnings > 0) {
        const part = Math.min(100_000, earnings)
        api.earn(part)
        earnings -= part
      }
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
    return {
      now: api.now,
      coins: api.coins(),
      unlocked: d.unlocked,
      plots: d.plots.map(plot => {
        const current = advancePlot(plot, api.now)
        if (current === null) return null
        const crop = cropFor(current.crop)
        const duration = stageTime(current.crop)
        return {
          ...current,
          emoji: current.stage === 0 ? '🟫' : current.stage === 1 ? '🌱' : current.stage === 2 ? '🌿' : crop?.emoji ?? '🟫',
          label: crop?.label ?? '',
          thirsty: current.stage < 3 && current.wateredAt === null,
          remainingMs: current.stage >= 3 || current.wateredAt === null ? 0 : Math.max(0, duration - (api.now - current.wateredAt)),
        }
      }),
      seeds: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, count: amountFor(d, 'seeds', crop.key) })),
      harvest: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, count: amountFor(d, 'harvest', crop.key), sell: crop.sell, food: crop.food, foodLabel: crop.foodLabel ?? null })),
      prices: PLOT_PRICES,
      shelf: {
        key: 'farm', label: '种子', emoji: '🌱', color: 'green',
        currency: { label: '金币', emoji: '🪙', balance: api.coins() },
        items: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, note: (crop.minutes > 60 ? crop.minutes / 60 + ' 小时' : crop.minutes + ' 分钟') + '成熟 · 收 ' + crop.yield + ' 个', price: crop.price, disabled: api.coins() < crop.price, pick: null })),
      },
      dex: {
        key: 'crops', label: '作物', emoji: '🌾', color: 'green',
        entries: CROPS.map(crop => ({ key: crop.key, emoji: crop.emoji, label: crop.label, stars: 0, blurb: '收获过 ' + amountFor(d, 'acquired', crop.key) + ' 个', potential: amountFor(d, 'acquired', crop.key), acquired: amountFor(d, 'acquired', crop.key) > 0 })),
      },
    }
  },
}
