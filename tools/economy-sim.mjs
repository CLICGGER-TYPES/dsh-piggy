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
  mine.actions.newRun(data, { floor: startFloor }, api)
  for (let action = 0; action < ACTIONS_PER_HOUR; action += 1) {
    host.now = action * 2000
    const view = mine.view(data, api)
    const map = generateMap(data.layer, data.run, data.pickaxe)
    const candidates = view.cells.filter(cell => !cell.open && cell.adjacent)
    const opened = view.cells.filter(cell => cell.open).length
    const stuck = !view.canDescend && view.needPickaxe !== null && view.cells[map.findIndex(cell => cell.kind === 'ladder')]?.open
    if (view.atBottom || candidates.length === 0 || (stuck && opened >= 34)) { mine.actions.newRun(data, { floor: startFloor }, api); continue }
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
  console.log('菜园（单块地理论时薪）')
  console.log(' ', CROPS.map(crop => `${crop.label} ${farmPlotPerHour(crop.key).toFixed(0)}`).join(' · '))
  console.log('矿价', ORES.map(ore => ore.label + ore.price).join(' '), '· hits(木)', ['soil', 'rock', 'hard', 'ore'].map(kind => kind + hitsNeeded(kind, 1)).join(' '))
}
