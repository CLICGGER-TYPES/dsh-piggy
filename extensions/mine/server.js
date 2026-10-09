// @ts-check
// 矿洞扩展 2.0（数值见 docs/numbers/J1-economy.md 第 3 节；用户 2026-10-09：去掉体力，玩法再丰富）。
// 用自己的「矿石币」（钱包在宿主 api.wallet）。20 层；每一趟的矿脉由 run 编号决定，挖完了随时「再下一趟」，
// 不用等明天。电梯（第 6 / 11 / 16 层）、宝箱、炸弹、连挖加成、矿脉成堆。每敲一下让猪累 0.3。
// 矿石越值钱越少见（按价格倒数配权重），时薪落在主动线区间里，见 tools/economy-sim.mjs。

const WIDTH = 6
const SIZE = 48
export const FLOORS = 20
/** 电梯站：到过这些层，以后可以直接从这里开始。 */
export const CHECKPOINTS = [1, 6, 11, 16]
/** 越深岩石越硬：去第 6 / 11 / 16 层起要铁镐 / 钢镐 / 钻石镐（工具开路，增量游戏的成长线）。 */
export function pickaxeFor(floor) {
  return floor >= 16 ? 4 : floor >= 11 ? 3 : floor >= 6 ? 2 : 1
}
/** 每敲一下扣多少饱食。炸弹一次算 1。 */
export const EXERT = 0.3
/** 连挖：上一块矿后这么久内再挖到矿就算接上。 */
export const COMBO_MS = 6000
/** 每接一个多给多少，最多多少。 */
export const COMBO_STEP = 0.1
export const COMBO_MAX = 0.5
/** 每层埋一块宝石类矿的概率（第 9 层起才有宝石类）。 */
export const TREASURE_CHANCE = 0.03
/** 第 19、20 层另有这个概率埋一块星辰石：大约几个小时的深层挖掘能碰上一次的大奖。 */
export const STAR_CHANCE = 0.02

export const ORES = [
  { key: 'coal', emoji: '⚫', label: '煤', unlock: 1, price: 8 },
  { key: 'copper', emoji: '🟠', label: '铜', unlock: 1, price: 15 },
  { key: 'iron', emoji: '⛓️', label: '铁', unlock: 2, price: 20 },
  { key: 'silver', emoji: '⚪', label: '银', unlock: 5, price: 35 },
  { key: 'gold', emoji: '🟡', label: '金', unlock: 7, price: 80 },
  { key: 'gem', emoji: '💎', label: '宝石', unlock: 9, price: 200 },
  { key: 'jade', emoji: '🟢', label: '翡翠', unlock: 11, price: 260 },
  { key: 'ruby', emoji: '🔴', label: '红宝石', unlock: 13, price: 360 },
  { key: 'sapphire', emoji: '🔵', label: '蓝宝石', unlock: 15, price: 450 },
  { key: 'star', emoji: '✨', label: '星辰石', unlock: 19, price: 1200 },
]
/** 图鉴里收藏的稀有矿（宝石起）。 */
const RARE_ORES = ORES.filter(ore => ore.price >= 200)

export const FOSSILS = [
  { key: 'bone', emoji: '🦴', label: '骨头', unlock: 1 },
  { key: 'ammonite', emoji: '🐚', label: '菊石', unlock: 1 },
  { key: 'dinosaur', emoji: '🦕', label: '恐龙骨', unlock: 1 },
  { key: 'trex', emoji: '🦖', label: '霸王龙牙', unlock: 1 },
  { key: 'feather', emoji: '🪶', label: '羽毛化石', unlock: 1 },
  { key: 'fish', emoji: '🐟', label: '鱼化石', unlock: 1 },
  { key: 'trilobite', emoji: '🦂', label: '三叶虫', unlock: 8 },
  { key: 'amber', emoji: '🟠', label: '琥珀', unlock: 10 },
  { key: 'sabertooth', emoji: '🐯', label: '剑齿虎牙', unlock: 12 },
  { key: 'mammoth', emoji: '🦣', label: '猛犸象牙', unlock: 14 },
  { key: 'footprint', emoji: '🐾', label: '鸟脚印化石', unlock: 17 },
  { key: 'leaf', emoji: '🍂', label: '古树叶', unlock: 20 },
]

/** 镐：level 1 是送的木镐。 */
export const PICKAXES = [
  { level: 1, key: 'wood', emoji: '🪓', label: '木镐', price: 0, note: '' },
  { level: 2, key: 'iron', emoji: '⛏️', label: '铁镐', price: 1500, note: '石头、矿、化石、宝箱少敲 1 下' },
  { level: 3, key: 'steel', emoji: '⚒️', label: '钢镐', price: 4000, note: '再加：硬岩少敲 1 下' },
  { level: 4, key: 'diamond', emoji: '💠', label: '钻石镐', price: 10000, note: '再加：硬岩再少敲 1 下；11 层以下的宝石类矿多出六成' },
  { level: 5, key: 'star', emoji: '🌟', label: '星辰镐', price: 25000, note: '再加：每一格都一下敲开' },
]
export const BOMB = { key: 'bomb', emoji: '💣', label: '炸弹', price: 60, note: '一下炸开 3×3 的格子' }

const count = value => Math.max(0, Math.floor(Number(value) || 0))
const oreFor = key => ORES.find(ore => ore.key === key) ?? null

/** 以前按日期换图，2.0 起按「第几趟」换；dayKey 留着给老代码和测试用。 */
export function dayKey(now) {
  const d = new Date(now - 6 * 3_600_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 32 位整数 PRNG；同一趟同一层序列相同。 */
function randomFor(floor, run) {
  let seed = 2166136261
  for (const char of `${run}:${floor}`) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0
  return () => { seed = (seed + 0x6d2b79f5) >>> 0; let n = Math.imul(seed ^ seed >>> 15, seed | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296 }
}

/** 选一种矿：越值钱越少见；钻石镐以上在 11 层以下宝石类多六成。 */
function pickOre(floor, random, pickaxe, power = 1.35) {
  const pool = ORES.filter(ore => ore.unlock <= floor)
  const weights = pool.map(ore => (1 / ore.price ** power) * (pickaxe >= 4 && floor >= 11 && ore.price >= 200 ? 1.6 : 1))
  let roll = random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll < 0) return pool[i] }
  return pool[pool.length - 1]
}

/**
 * 一层的地图（6×8）：第一行是入口；梯子在最底两行；每层最多一个化石、一个宝箱；矿成堆（挨着矿的格子更容易是矿、而且常是同一种）。
 * @param {number} floor @param {number|string} run @param {number} [pickaxe]
 */
export function generateMap(floor, run, pickaxe = 1) {
  const depth = Math.max(1, Math.min(FLOORS, Math.floor(floor)))
  const random = randomFor(depth, run)
  const t = (depth - 1) / (FLOORS - 1)
  const soil = 60 - 40 * t, rock = 25 + 5 * t, hard = 6 + 18 * t, ore = 3.4 - 0.9 * t
  /** @type {any[]} */
  const map = []
  for (let index = 0; index < SIZE; index += 1) {
    if (index < WIDTH) { map.push({ kind: 'entrance' }); continue }
    const left = index % WIDTH > 0 ? map[index - 1] : null
    const up = map[index - WIDTH]
    const nearOre = [left, up].find(cell => cell && cell.kind === 'ore') ?? null
    const oreWeight = nearOre ? ore * 3 : ore
    const roll = random() * (soil + rock + hard + oreWeight)
    if (roll < oreWeight) {
      const chosen = nearOre && random() < 0.6 ? oreFor(nearOre.key) : pickOre(depth, random, pickaxe)
      map.push({ kind: 'ore', key: chosen.key })
    } else if (roll < oreWeight + soil) map.push({ kind: 'soil' })
    else if (roll < oreWeight + soil + rock) map.push({ kind: 'rock' })
    else map.push({ kind: 'hard' })
  }
  const ladder = 36 + Math.floor(random() * 12)
  map[ladder] = { kind: 'ladder' }
  const place = kind => {
    let index = WIDTH + Math.floor(random() * (SIZE - WIDTH))
    while (['ladder', 'fossil', 'chest'].includes(map[index].kind) || (map[index].kind === 'ore' && kind.kind === 'ore')) index = index + 1 >= SIZE ? WIDTH : index + 1
    map[index] = kind
  }
  if (random() < 0.3) {
    const fossils = FOSSILS.filter(fossil => fossil.unlock <= depth)
    place({ kind: 'fossil', key: fossils[Math.floor(random() * fossils.length)].key })
  }
  if (random() < 0.25) place({ kind: 'chest' })
  // 宝藏格：宝石类矿平时极少见，每层另有一小概率直接埋一块（同样越贵越少），挖到才是惊喜。
  const treasures = ORES.filter(entry => entry.price >= 200 && entry.unlock <= depth)
  if (treasures.length > 0 && random() < TREASURE_CHANCE) {
    const weights = treasures.map(entry => 1 / entry.price)
    let roll = random() * weights.reduce((a, b) => a + b, 0)
    const chosen = treasures.find((entry, i) => (roll -= weights[i]) < 0) ?? treasures[0]
    place({ kind: 'ore', key: chosen.key })
  }
  if (depth >= 19 && random() < STAR_CHANCE) place({ kind: 'ore', key: 'star' })
  return map
}

/** 一格要敲几下（看镐）。 */
export function hitsNeeded(kind, pickaxe) {
  if (pickaxe >= 5) return 1
  const base = { soil: 1, rock: 2, hard: 4, ore: 3, fossil: 3, chest: 3, ladder: 1 }[kind] ?? 1
  const softer = pickaxe >= 2 && ['rock', 'ore', 'fossil', 'chest'].includes(kind) ? 1 : 0
  const harder = kind === 'hard' ? (pickaxe >= 4 ? 2 : pickaxe >= 3 ? 1 : 0) : 0
  return Math.max(1, base - softer - harder)
}

/** 补齐旧存档（1.x：10 层、按日期换图、体力、镐 3 级）或部分写入的数据，保留镐、矿石袋、化石。 */
export function normalize(data) {
  if (data.v !== 2) {
    // 1.x 的钻石镐（第 3 级，花了 6000）对应 2.0 的钻石镐（第 4 级）；地图换了生成方式，旧的挖掘进度清掉。
    if (data.pickaxe === 3) data.pickaxe = 4
    data.maps = {}
    data.layer = 1
    delete data.energy; delete data.energyAt; delete data.drinks; delete data.day
    data.v = 2
  }
  if (!Number.isInteger(data.layer) || data.layer < 1 || data.layer > FLOORS) data.layer = 1
  for (const field of ['maps', 'bag', 'found']) {
    if (!data[field] || typeof data[field] !== 'object' || Array.isArray(data[field])) data[field] = {}
  }
  if (!Number.isInteger(data.pickaxe) || data.pickaxe < 1 || data.pickaxe > 5) data.pickaxe = 1
  data.run = count(data.run)
  data.bombs = count(data.bombs)
  if (!data.combo || typeof data.combo !== 'object' || !Number.isFinite(data.combo.at)) data.combo = { n: 0, at: 0 }
  if (!data.last || typeof data.last !== 'object') data.last = null
  for (const [floor, value] of Object.entries(data.maps)) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.open)) { delete data.maps[floor]; continue }
    if (!value.hits || typeof value.hits !== 'object' || Array.isArray(value.hits)) value.hits = {}
  }
  if (!Number.isSafeInteger(data.oreCount) || data.oreCount < 0) {
    data.oreCount = ORES.reduce((sum, ore) => Math.min(Number.MAX_SAFE_INTEGER, sum + count(data.bag[ore.key])), 0)
  }
  data.deepest = Math.max(data.layer, Number.isInteger(data.deepest) && data.deepest <= FLOORS ? data.deepest : 1)
  normalizeHelper(data)
  return data
}

/** 兼容老代码：2.0 没有「换天」了，只是补齐数据。 */
export function refresh(data) { return normalize(data) }
export const dayState = data => ({ ...data })

function floorProgress(data) {
  return data.maps[data.layer] ?? (data.maps[data.layer] = { open: [0, 1, 2, 3, 4, 5], hits: {} })
}
const mapFor = data => generateMap(data.layer, data.run, data.pickaxe)

function adjacent(index, open) {
  const x = index % WIDTH
  return (x > 0 && open.includes(index - 1)) || (x < WIDTH - 1 && open.includes(index + 1)) || open.includes(index - WIDTH) || open.includes(index + WIDTH)
}

/** 矿石币钱包；老宿主（没有 api.wallet）退回金币。 */
function purse(api) {
  if (api.wallet) return api.wallet
  return { currency: { label: '金币', emoji: '🪙', rate: 1 }, balance: () => api.coins(), earn: (n, source) => api.earn(n, source), spend: (n, sink) => api.spend(n, sink) }
}
const tire = (api, points) => { if (typeof api.exert === 'function') api.exert(points) }

/** 挖开一格，结算里面的东西（矿进袋子并算连挖、化石进图鉴、宝箱开奖）。 */
function reveal(data, cell, index, api) {
  const wallet = purse(api)
  let bonus = 0
  if (cell.kind === 'ore') {
    const ore = oreFor(cell.key)
    data.oreCount = Math.min(Number.MAX_SAFE_INTEGER, data.oreCount + 1)
    data.bag[cell.key] = count(data.bag[cell.key]) + 1
    if (ore.price >= 200) data.found[cell.key] = true
    const chained = api.now - data.combo.at <= COMBO_MS && data.combo.n > 0
    data.combo = { n: chained ? data.combo.n + 1 : 1, at: api.now }
    bonus = Math.floor(ore.price * Math.min(COMBO_MAX, COMBO_STEP * (data.combo.n - 1)))
    if (bonus > 0) wallet.earn(bonus, 'combo')
    api.say(data.combo.n >= 3 ? '连挖 ×' + data.combo.n + '！又是' + ore.label + '！' : '挖到了' + ore.label + '！')
  } else if (cell.kind === 'fossil') {
    data.found[cell.key] = true
    api.say('找到了一块' + FOSSILS.find(fossil => fossil.key === cell.key).label + '！')
  } else if (cell.kind === 'chest') {
    // 宝箱：七成是一小笔矿石币（越深越多），三成是一颗炸弹。
    const roll = randomFor(data.layer * 101 + index, data.run)()
    if (roll < 0.3) { data.bombs += 1; api.say('宝箱里有一颗炸弹！') } else {
      const coins = 10 + data.layer * 4 + Math.floor(roll * data.layer * 4)
      wallet.earn(coins, 'chest')
      bonus = coins
      api.say('宝箱里有 ' + coins + ' 矿石币！')
    }
  } else if (cell.kind === 'ladder') api.say(data.layer >= FLOORS ? '到底了！回地面再下一趟吧' : '找到通往下一层的梯子了！')
  data.last = { layer: data.layer, index, kind: cell.kind, key: cell.key ?? null, at: api.now, bonus, combo: data.combo.n, id: (data.last?.id ?? 0) + 1 }
}

/** Sold ore without a historical counter cannot be reconstructed. */
export function progress(data) {
  const saved = normalize(structuredClone(data))
  return [
    { name: 'ore', total: saved.oreCount },
    { name: 'fossil', items: FOSSILS.filter(fossil => saved.found[fossil.key] === true).map(fossil => fossil.key) },
    { name: 'depth', maximum: saved.deepest },
  ]
}

function reportProgress(data, api) {
  if (typeof api.emit !== 'function') return
  for (const { name, ...payload } of progress(data)) api.emit(name, payload)
}

const game = {
  eventVersion: 1,
  progress,
  init() { return normalize({ v: 2, layer: 1, maps: {}, pickaxe: 1, bag: {}, found: {}, last: null, run: 0, bombs: 0 }) },
  actions: {
    dig(data, payload, api) {
      normalize(data)
      const index = payload?.cell
      if (!Number.isInteger(index) || index < WIDTH || index >= SIZE) return { ok: false, reason: 'unknown' }
      const p = floorProgress(data)
      if (p.open.includes(index)) return { ok: false, reason: 'already-open' }
      if (!adjacent(index, p.open)) return { ok: false, reason: 'not-adjacent' }
      const cell = mapFor(data)[index]
      tire(api, EXERT)
      p.hits[index] = (p.hits[index] ?? 0) + 1
      if (p.hits[index] >= hitsNeeded(cell.kind, data.pickaxe)) {
        p.open.push(index); delete p.hits[index]; reveal(data, cell, index, api)
      } else data.last = { layer: data.layer, index, kind: 'crack', at: api.now, id: (data.last?.id ?? 0) + 1 }
      reportProgress(data, api)
      return { ok: true }
    },
    /** 炸弹：一下炸开以这一格为中心的 3×3（入口那行不算），里面的东西照常结算。 */
    bomb(data, payload, api) {
      normalize(data)
      const index = payload?.cell
      if (!Number.isInteger(index) || index < WIDTH || index >= SIZE) return { ok: false, reason: 'unknown' }
      if (data.bombs < 1) return { ok: false, reason: 'empty' }
      const p = floorProgress(data)
      if (p.open.includes(index) || !adjacent(index, p.open)) return { ok: false, reason: 'not-adjacent' }
      const map = mapFor(data)
      data.bombs -= 1
      tire(api, 1)
      const x = index % WIDTH
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const cx = x + dx, target = index + dy * WIDTH + dx
          if (cx < 0 || cx >= WIDTH || target < WIDTH || target >= SIZE || p.open.includes(target)) continue
          p.open.push(target); delete p.hits[target]; reveal(data, map[target], target, api)
        }
      }
      reportProgress(data, api)
      return { ok: true }
    },
    descend(data, _payload, api) {
      normalize(data)
      if (data.layer >= FLOORS) return { ok: false, reason: 'deepest' }
      const ladder = mapFor(data).findIndex(cell => cell.kind === 'ladder')
      if (!floorProgress(data).open.includes(ladder)) return { ok: false, reason: 'no-ladder' }
      if (data.pickaxe < pickaxeFor(data.layer + 1)) return { ok: false, reason: 'need-pickaxe', need: pickaxeFor(data.layer + 1) }
      data.layer += 1
      data.deepest = Math.max(data.deepest, data.layer)
      reportProgress(data, api)
      return { ok: true }
    },
    /** 电梯：到过的电梯站之间随便坐。 */
    elevator(data, payload) {
      normalize(data)
      const floor = payload?.floor
      if (!CHECKPOINTS.includes(floor) || floor > data.deepest) return { ok: false, reason: 'locked' }
      if (data.pickaxe < pickaxeFor(floor)) return { ok: false, reason: 'need-pickaxe', need: pickaxeFor(floor) }
      data.layer = floor
      return { ok: true }
    },
    /** 再下一趟：矿洞重新长出来（新的一趟、新的矿脉），从选的电梯站开始；不用等明天。 */
    newRun(data, payload) {
      normalize(data)
      const wanted = payload?.floor
      const floor = CHECKPOINTS.includes(wanted) && wanted <= data.deepest && data.pickaxe >= pickaxeFor(wanted) ? wanted : 1
      data.run += 1
      data.maps = {}
      data.layer = floor
      data.combo = { n: 0, at: 0 }
      return { ok: true }
    },
    /** 老界面的「回地面 / 回矿洞」：2.0 在哪都能卖，留着不报错。 */
    surface(data) { normalize(data); return { ok: true } },
    enter(data) { normalize(data); return { ok: true } },
    sell(data, _payload, api) {
      normalize(data)
      const total = ORES.reduce((sum, ore) => sum + count(data.bag[ore.key]) * ore.price, 0)
      if (!total) return { ok: false, reason: 'empty' }
      purse(api).earn(total, 'sell'); data.bag = {}
      api.say('矿石卖了 ' + total + ' 矿石币！')
      return { ok: true, coins: total }
    },
    buy(data, payload, api) {
      normalize(data)
      const wallet = purse(api)
      if (String(payload?.item).startsWith('helper-')) return helperBuy(data, payload, api)
      if (payload?.item === BOMB.key) {
        if (!wallet.spend(BOMB.price, 'bomb')) return { ok: false, reason: 'poor' }
        data.bombs += 1
        return { ok: true }
      }
      const next = PICKAXES.find(pick => pick.level === data.pickaxe + 1)
      // 1.x 的货架按名字买（iron / diamond）：只要买的就是下一把，照样认。
      if (!next || (payload?.item !== 'pickaxe' && payload?.item !== next.key)) return { ok: false, reason: next ? 'unavailable' : 'owned' }
      if (!wallet.spend(next.price, 'pickaxe')) return { ok: false, reason: 'poor' }
      data.pickaxe = next.level
      api.say('换上了' + next.label + '！')
      return { ok: true }
    },
  },
  view(data, api) {
    const d = normalize(structuredClone(data))
    settleHelper(d, api.now)
    const p = floorProgress(d)
    const map = mapFor(d)
    const wallet = purse(api)
    const balance = wallet.balance()
    const pick = PICKAXES.find(entry => entry.level === d.pickaxe) ?? PICKAXES[0]
    const next = PICKAXES.find(entry => entry.level === d.pickaxe + 1) ?? null
    const comboLive = d.combo.n > 0 && api.now - d.combo.at <= COMBO_MS
    return {
      layer: d.layer, floors: FLOORS, deepest: d.deepest, run: d.run,
      balance, currency: wallet.currency,
      pickaxe: { level: pick.level, emoji: pick.emoji, label: pick.label },
      helper: helperView(d),
      bombs: d.bombs,
      combo: comboLive ? { n: d.combo.n, msLeft: COMBO_MS - (api.now - d.combo.at) } : null,
      checkpoints: CHECKPOINTS.map(floor => ({ floor, unlocked: floor <= d.deepest && d.pickaxe >= pickaxeFor(floor) })),
      /** 下一层要什么镐（够了就是 null），界面写「要铁镐才挖得动」。 */
      needPickaxe: d.layer < FLOORS && d.pickaxe < pickaxeFor(d.layer + 1) ? PICKAXES[pickaxeFor(d.layer + 1) - 1].label : null,
      bag: ORES.filter(ore => count(d.bag[ore.key]) > 0).map(ore => ({ key: ore.key, emoji: ore.emoji, label: ore.label, count: count(d.bag[ore.key]), price: ore.price })),
      bagValue: ORES.reduce((sum, ore) => sum + count(d.bag[ore.key]) * ore.price, 0),
      last: d.last,
      cells: map.map((cell, index) => {
        const open = p.open.includes(index)
        const hits = p.hits[index] ?? 0
        return { index, open, hits, remaining: hits > 0 ? Math.max(1, hitsNeeded(cell.kind, d.pickaxe) - hits) : undefined, adjacent: adjacent(index, p.open), ...(open ? { kind: cell.kind, key: cell.key, emoji: cell.kind === 'ore' ? oreFor(cell.key)?.emoji : cell.kind === 'fossil' ? FOSSILS.find(f => f.key === cell.key)?.emoji : undefined } : {}) }
      }),
      canDescend: d.layer < FLOORS && d.pickaxe >= pickaxeFor(d.layer + 1) && p.open.includes(map.findIndex(cell => cell.kind === 'ladder')),
      atBottom: d.layer >= FLOORS && p.open.includes(map.findIndex(cell => cell.kind === 'ladder')),
      shelf: {
        key: 'mine', label: '矿工用品', emoji: '⛏️', color: 'teal',
        currency: { label: wallet.currency.label, emoji: wallet.currency.emoji, balance },
        items: [
          ...helperShelf(d, balance),
          ...(next ? [{ key: 'pickaxe', emoji: next.emoji, label: next.label, note: next.note, price: next.price, disabled: balance < next.price, pick: null }] : []),
          { key: BOMB.key, emoji: BOMB.emoji, label: BOMB.label, note: BOMB.note + ' · 有 ' + d.bombs + ' 颗', price: BOMB.price, disabled: balance < BOMB.price, pick: null },
        ],
      },
      dex: { key: 'mine', label: '矿石', emoji: '💎', color: 'teal', entries: [...FOSSILS, ...RARE_ORES].map(entry => ({ key: entry.key, emoji: entry.emoji, label: entry.label, stars: 1, blurb: 'price' in entry ? '矿洞深处的闪亮宝物' : '矿洞里发现的古老收藏品', potential: d.found[entry.key] ? 1 : 0, acquired: !!d.found[entry.key] })) },
    }
  },
}

/** K1 第二轮：仓按六小时有效工作封顶，矿车升级只提高速度。 */
export const HELPER_RATES = [8, 14, 18, 22, 26]
export const HELPER_SPEEDS = [1, 1.05, 1.1, 1.15]
export const HELPER_WINDOW = 6 * 3600000
export const HELPER_PRICES = { hire: 3000, cart: [0, 1000, 3000, 9000], lamp: [0, 1500, 4000, 10000] }

export function helperRate(data) {
  return HELPER_RATES[data.pickaxe - 1] * HELPER_SPEEDS[data.helper.cart]
}

function normalizeHelper(data) {
  const raw = data.helper && typeof data.helper === 'object' ? data.helper : {}
  data.helper = {
    hired: raw.hired === true,
    cart: Math.min(3, count(raw.cart)),
    lamp: Math.min(3, count(raw.lamp)),
    floor: CHECKPOINTS.includes(raw.floor) ? raw.floor : 1,
    lastAt: Number.isFinite(raw.lastAt) ? raw.lastAt : null,
    remainder: Number.isFinite(raw.remainder) ? Math.max(0, Math.min(3600000, raw.remainder)) : 0,
    sequence: count(raw.sequence),
    usedMs: Number.isFinite(raw.usedMs) ? Math.max(0, Math.min(HELPER_WINDOW, raw.usedMs)) : 0,
    stock: Object.fromEntries(ORES.map(ore => [ore.key, count(raw.stock?.[ore.key])])),
  }
}

const helperCount = data => Object.values(data.helper.stock).reduce((sum, n) => sum + Number(n), 0)

/** 时间单调递增；六小时后的离线时间作废，收取后从当前时间继续。 */
export function settleHelper(data, now) {
  const helper = data.helper
  if (!helper.hired || !Number.isFinite(now)) return
  if (helper.lastAt === null) helper.lastAt = now
  if (now < helper.lastAt) return
  const duration = Math.min(now - helper.lastAt, HELPER_WINDOW - helper.usedMs)
  const interval = 3600000 / helperRate(data)
  const elapsed = duration + helper.remainder
  const amount = Math.floor((elapsed + 0.00001) / interval)
  for (let index = 0; index < amount; index += 1) {
    const floor = helper.floor + helper.sequence % 5
    const ore = pickOre(floor, randomFor(floor, 'helper:' + helper.sequence), data.pickaxe, 2)
    helper.stock[ore.key] += 1
    helper.sequence += 1
  }
  helper.usedMs += duration
  helper.lastAt = now
  helper.remainder = elapsed - amount * interval
}

function helperView(data) {
  const helper = data.helper
  return {
    hired: helper.hired, floor: helper.floor, stored: helperCount(data),
    usedHours: helper.usedMs / 3600000, capacityHours: 6, full: helper.usedMs >= HELPER_WINDOW,
    stops: CHECKPOINTS.filter((floor, index) => index <= helper.lamp && floor <= data.deepest && pickaxeFor(floor) <= data.pickaxe),
  }
}

function helperShelf(data, balance) {
  const helper = data.helper
  if (!helper.hired) return [{ key: 'helper-hire', emoji: '⛏️', label: '雇小矿工猪', note: '矿车最多攒六小时产出', price: HELPER_PRICES.hire, disabled: balance < HELPER_PRICES.hire, pick: null }]
  return ['cart', 'lamp'].flatMap(kind => {
    const level = helper[kind] + 1
    const price = HELPER_PRICES[kind][level]
    if (price === undefined) return []
    const label = kind === 'cart' ? ['小矿车', '轻便矿车', '顺滑矿车', '飞驰矿车'][level] : ['小头灯', '明亮头灯', '探矿头灯', '深井头灯'][level]
    const note = kind === 'cart' ? '产矿速度 +' + Math.round((HELPER_SPEEDS[level] - 1) * 100) + '%' : '解锁第 ' + CHECKPOINTS[level] + ' 站'
    return [{ key: 'helper-' + kind, emoji: kind === 'cart' ? '🧺' : '💡', label, note, price, disabled: balance < price, pick: null }]
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
    if (!helper.hired || !['cart', 'lamp'].includes(kind)) return { ok: false, reason: 'locked' }
    const price = HELPER_PRICES[kind][helper[kind] + 1]
    if (price === undefined) return { ok: false, reason: 'owned' }
    if (!purse(api).spend(price, 'helper')) return { ok: false, reason: 'poor' }
    helper[kind] += 1
  }
  return { ok: true }
}

game.actions.hire = (data, payload, api) => helperBuy(data, { item: 'helper-hire' }, api)
game.actions.upgrade = (data, payload, api) => helperBuy(data, { item: 'helper-' + payload?.kind }, api)
game.actions.workerFloor = (data, payload) => {
  if (!data.helper.hired || !helperView(data).stops.includes(payload?.floor)) return { ok: false, reason: 'locked' }
  data.helper.floor = payload.floor
  return { ok: true }
}
game.actions.collect = (data, payload, api) => {
  if (!helperCount(data) && data.helper.usedMs === 0) return { ok: false, reason: 'empty' }
  for (const ore of ORES) {
    data.bag[ore.key] = count(data.bag[ore.key]) + data.helper.stock[ore.key]
    if (ore.price >= 200 && data.helper.stock[ore.key] > 0) data.found[ore.key] = true
  }
  data.oreCount = Math.min(Number.MAX_SAFE_INTEGER, data.oreCount + helperCount(data))
  data.helper.stock = Object.fromEntries(ORES.map(ore => [ore.key, 0]))
  data.helper.usedMs = 0
  reportProgress(data, api)
  return { ok: true }
}

// 每个动作先结旧速度的收益；view 只在副本里结算，不写存档。
for (const [key, action] of Object.entries(game.actions)) {
  game.actions[key] = (data, payload, api) => {
    normalize(data)
    settleHelper(data, api?.now)
    const oldRate = helperRate(data)
    const result = action(data, payload, api)
    if (result.ok) data.helper.remainder *= oldRate / helperRate(data)
    return result
  }
}
export default game
