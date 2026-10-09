// @ts-check
/**
 * 经济模拟（docs/design/economy.md 规则 3）：按「会玩的轻度玩家」玩 1 小时，算主动玩法的净时薪（折成金币，扣掉吃饭）。
 *
 * 假设：每 2 秒操作一次（ACTIONS_PER_HOUR = 1800）；吃饭按面包算（饱食 32 点 10 金币）；扩展币按汇率折金币。
 * 用法：node tools/economy-sim.mjs        打印各玩法、各工具档的时薪
 *      test/economy-bands.test.js 用同一套函数检查区间。
 */
import { fileURLToPath } from 'node:url'

import mine, { CHECKPOINTS, FLOORS, ORES, generateMap, hitsNeeded, pickaxeFor } from '../extensions/mine/server.js'
import { CROPS } from '../extensions/farm/server.js'
import { FISH, RODS, SHOP } from '../data.js'
import { FISH_WEIGHT } from '../packages/pet-core/src/core/fishing.js'

export const ACTIONS_PER_HOUR = 1800
/** 一点饱食值多少金币（面包：32 点 10 金币）。 */
export const FOOD_PER_POINT = 10 / 32

/** 可复现的随机数。 */
function rng(seed) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let n = Math.imul(s ^ s >>> 15, s | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296 }
}

/** 一个只记账的假宿主。 */
function fakeHost() {
  const host = { balance: 0, earned: 0, tired: 0, now: 0 }
  const api = {
    get now() { return host.now },
    wallet: {
      currency: { label: '矿石币', emoji: '⛏️', rate: 1 },
      balance: () => host.balance,
      earn: n => { host.balance += n; host.earned += n; return n },
      spend: n => { if (host.balance < n) return false; host.balance -= n; return true },
    },
    say() {}, emit() { return false },
    exert: points => { host.tired += points },
  }
  return { host, api }
}

/**
 * 矿洞：用某把镐，从某个电梯站开始挖一小时。策略：先挖挨着已开矿的格子（矿成堆），其次挨着梯子方向往下挖；
 * 这一层挖开七成或者没得挖了就下楼；到底了就再下一趟。
 * @param {number} pickaxe 1～5 @param {number} startFloor 电梯站
 */
export function simulateMine(pickaxe, startFloor, seed = 1) {
  const random = rng(seed)
  const { host, api } = fakeHost()
  const data = mine.init()
  data.pickaxe = pickaxe
  data.deepest = FLOORS
  mine.actions.newRun(data, { floor: startFloor })
  for (let action = 0; action < ACTIONS_PER_HOUR; action += 1) {
    host.now = action * 2000
    const view = mine.view(data, api)
    const map = generateMap(data.layer, data.run, data.pickaxe)
    const candidates = view.cells.filter(cell => !cell.open && cell.adjacent)
    const opened = view.cells.filter(cell => cell.open).length
    const stuck = !view.canDescend && view.needPickaxe !== null && view.cells[map.findIndex(cell => cell.kind === 'ladder')]?.open
    if (view.atBottom || candidates.length === 0 || (stuck && opened >= 34)) { mine.actions.newRun(data, { floor: startFloor }); continue }
    if (view.canDescend && (opened >= 34 || candidates.every(cell => map[cell.index].kind !== 'ore'))) { mine.actions.descend(data, {}, api); continue }
    // 已经敲了几下的先敲完；然后挨着矿的；然后往下（编号大的）挖。
    const started = candidates.find(cell => cell.hits > 0)
    const nextToOre = candidates.filter(cell => [cell.index - 1, cell.index + 1, cell.index - 6, cell.index + 6].some(i => view.cells[i]?.open && view.cells[i].kind === 'ore'))
    const pick = started ?? (nextToOre.length > 0 ? nextToOre[Math.floor(random() * nextToOre.length)] : candidates.sort((a, b) => b.index - a.index)[Math.floor(random() * Math.min(3, candidates.length))])
    mine.actions.dig(data, { cell: pick.index }, api)
    if (Object.keys(data.bag).length > 0 && action % 120 === 119) mine.actions.sell(data, {}, api)
  }
  mine.actions.sell(data, {}, api)
  return Math.round(host.earned - host.tired * FOOD_PER_POINT)
}

/**
 * 菜园：一块地种一种作物，只算熟了就收、马上再种的理论时薪（种、浇、收都跟得上）。
 * @param {string} key 作物
 */
export function farmPlotPerHour(key) {
  const crop = CROPS.find(entry => entry.key === key)
  if (!crop) return 0
  return (crop.yield * crop.sell - crop.price) / (crop.minutes / 60)
}

/** 一块地一季要操作几次（种 1 + 浇 3 + 收 1），用来估「人一直点」时能照看几块地。 */
export const FARM_ACTIONS_PER_SEASON = 5


/** 玩家搏斗的成功率：按（鱼的难度 × 鱼竿的难度乘数）估。 */
export const fightSuccess = difficulty => Math.max(0.3, Math.min(0.95, 0.95 - difficulty / 110))

/**
 * 手动钓鱼的净时薪（金币）：某把竿、某个钓点，几个开着的时段平均。一竿 = 抛竿 1.5 秒 + 等咬钩（看鱼竿）
 * + 反应 0.5 秒 + 搏斗（3 秒起，越难越久）+ 收鱼 1 秒；扣鱼饵和吃饭（每竿 0.5 饱食）。
 * @param {number} rodLevel @param {string} spot @param {string | {price: number, rarityBoost?: number}} [baitKey] 鱼饵名，或者试算用的鱼饵
 */
export function fishingPerHour(rodLevel, spot, baitKey = 'bait_worm') {
  const rod = RODS.find(entry => entry.level === rodLevel)
  const bait = typeof baitKey === 'object' ? baitKey : SHOP.find(item => item.key === baitKey)
  if (!rod || !bait) return 0
  const boost = bait.rarityBoost ?? 0
  const periods = ['early', 'noon', 'evening', 'night'].filter(period => FISH.some(fish => fish.spot === spot && fish.times.includes(period)))
  let total = 0
  for (const period of periods) {
    const pool = FISH.filter(fish => fish.spot === spot && fish.times.includes(period)).map(fish => {
      // 抛竿力度按界面固定的 0.5 算（src/client/tabs/fishing.js）。
      const rare = fish.rarity === 'legend' ? (1 + 0.5 * 2) * (1 + boost * 3) * rod.rare : fish.rarity === 'rare' ? (1 + 0.5) * (1 + boost * 2) * rod.rare : fish.rarity === 'uncommon' ? (1 + 0.5 * 0.5) * (1 + boost) : 1
      return { fish, weight: FISH_WEIGHT[fish.rarity] * rare }
    })
    const sum = pool.reduce((a, entry) => a + entry.weight, 0)
    let value = 0, seconds = 0
    for (const { fish, weight } of pool) {
      const difficulty = Math.min(100, fish.difficulty * rod.difficulty)
      value += weight / sum * fish.price * fightSuccess(difficulty)
      seconds += weight / sum * (3 + difficulty * 0.03)
    }
    const cycle = 1.5 + (rod.bite[0] + rod.bite[1]) / 2000 + 0.5 + seconds + 1
    total += (value - bait.price - 0.5 * FOOD_PER_POINT) * 3600 / cycle
  }
  return Math.round(total / periods.length)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const names = ['', '木镐', '铁镐', '钢镐', '钻石镐', '星辰镐']
  console.log('矿洞（每 2 秒一下，净时薪，6 个种子平均）')
  for (let pickaxe = 1; pickaxe <= 5; pickaxe += 1) {
    const row = CHECKPOINTS.filter(floor => pickaxeFor(floor) <= pickaxe).map(floor => {
      const runs = [1, 2, 3, 4, 5, 6].map(seed => simulateMine(pickaxe, floor, seed))
      return `第${floor}层起 ${Math.round(runs.reduce((a, b) => a + b, 0) / runs.length)}`
    })
    console.log(' ', names[pickaxe], row.join(' · '))
  }
  console.log('钓鱼（手动，净时薪，各钓点开着的时段平均；蚯蚓 / 鲜虾 / 夜光饵）')
  for (const rod of RODS) {
    console.log(' ', rod.label, ['river', 'lake', 'sea', 'night'].map(spot => spot + ' ' + ['bait_worm', 'bait_shrimp', 'bait_glow'].map(bait => fishingPerHour(rod.level, spot, bait)).join('/')).join(' · '))
  }
  console.log('菜园（单块地理论时薪）')
  console.log(' ', CROPS.map(crop => `${crop.label} ${farmPlotPerHour(crop.key).toFixed(0)}`).join(' · '))
  console.log('矿价', ORES.map(ore => ore.label + ore.price).join(' '), '· hits(木)', ['soil', 'rock', 'hard', 'ore'].map(kind => kind + hitsNeeded(kind, 1)).join(' '))
}
