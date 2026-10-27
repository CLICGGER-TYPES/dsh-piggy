// @ts-check
/**
 * #14 外部桌宠：官方四个扩展的合并钩子（farm / mine / gacha / blindbox）。
 *
 * 用的是扩展自己的 init()/normalize() 和真实存档形状，不是另写一套字段表：
 * 两边资产相加、进度取高、局内上下文整套选一边；数据版本比扩展新就抛错，让宿主退回「二选一」。
 * 规则见 docs/guides/writing-extensions.md「合并钩子」与 issue14-DESIGN-FINAL.md 6.4。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg, migrate } from '../core.js'
import { createGameRuntime } from '../runtime/index.js'
import { startPairServer } from '../runtime/pair-server.js'
import { createSaveArchive } from '../runtime/save-archive.js'
import { createStore } from '../store.js'
import { createExtRuntime } from '../store/ext-runtime.js'
import { createJournal } from '../store/journal.js'
import { describeExtensionConflicts } from '../packages/pet-core/src/core/merge-identity.js'
import farm from '../extensions/farm/server.js'
import mine from '../extensions/mine/server.js'
import gacha, { gameDay } from '../extensions/gacha/server.js'
import blindbox from '../extensions/blindbox/server.js'

const NOW = Date.UTC(2027, 0, 15, 12)
const H = 3_600_000
const MIN = 60_000
const SAFE = Number.MAX_SAFE_INTEGER
const OFFICIAL = ['farm', 'mine', 'gacha', 'blindbox']
const manifestOf = key => JSON.parse(readFileSync(new URL('../extensions/' + key + '/manifest.json', import.meta.url), 'utf8'))
const clone = value => structuredClone(value)

/** 交出去的必须是纯 JSON：没有函数、NaN、Infinity，也没有 undefined 的键。 */
function assertPlainData(result) {
  assert.equal(result !== null && typeof result === 'object', true)
  assert.equal(Array.isArray(result), false)
  assert.ok(result.data !== undefined, '钩子必须返回 data')
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), result.data, '返回值必须是纯 JSON 数据')
  assert.ok(Array.isArray(result.warnings) && result.warnings.every(item => typeof item === 'string'))
  assert.ok(Array.isArray(result.conflicts))
}

const merge = (extension, target, source, now = NOW) => extension.mergeStates(target, source, now)

// ---------------------------------------------------------------- manifest

test('官方四个扩展（含经典菜园）都声明 mergeHook 1，服务端都导出 mergeStates', () => {
  for (const key of OFFICIAL) {
    const manifest = manifestOf(key)
    assert.equal(manifest.mergeHook, 1, key + ' 的 manifest 要写 mergeHook: 1')
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/)
  }
  const classic = JSON.parse(readFileSync(new URL('../extension-variants/farm-classic/manifest.json', import.meta.url), 'utf8'))
  assert.equal(classic.key, 'farm')
  assert.equal(classic.mergeHook, 1)
  // 经典菜园有自己的大版本号，但跟现代菜园共用同一份服务端：小版本和补丁位一起走。
  const [, classicMinor, classicPatch] = classic.version.split('.')
  const [, modernMinor, modernPatch] = manifestOf('farm').version.split('.')
  assert.deepEqual([classicMinor, classicPatch], [modernMinor, modernPatch], '经典菜园和现代菜园共用同一份服务端，小版本一起走')
  for (const extension of [farm, mine, gacha, blindbox]) assert.equal(typeof extension.mergeStates, 'function')
})

// ---------------------------------------------------------------- 菜园

/** v5 的干净起点：地块自己摆，避免 init() 的随机荒地影响断言。 */
function farming() {
  const state = farm.init()
  state.unlocked = 6
  state.plots = Array(18).fill(null)
  state.onboarding = { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null }
  state.helper = { hired: false, level: 0, barn: 0, lastAt: null, usedMs: 0, cursor: 0, pending: null, targets: Array(18).fill(null), stock: {} }
  return state
}

const plot = (crop, plantedAt, patch = {}) => ({ crop, season: 1, plantedAt, boostMs: 0, roll: 0, pests: { weed: null, bug: null, dry: null }, ...patch })

test('菜园：金样例——两边资产相加、进度取高、同块地取更靠后的、帮工只留一套进度', () => {
  const target = farming()
  Object.assign(target, { unlocked: 8, exp: 900, refund: 25 })
  target.seeds = { radish: 3, apple: 1 }
  target.harvest = { radish: 12 }
  target.acquired = { radish: 40 }
  target.harvests = { radish: 5 }
  target.tools = { sickle: true }
  target.fert = { 'fert-1': 2 }
  target.plots[0] = plot('radish', NOW - 15 * H) // 14 小时熟的萝卜：已经成熟
  target.plots[1] = plot('apple', NOW - 5 * H)
  target.helper = { hired: true, level: 1, barn: 0, lastAt: NOW - 3 * H, usedMs: 3 * H, cursor: 3, pending: null, targets: Array(18).fill(null), stock: { radish: 4 } }
  target.helper.targets[2] = 'apple'

  const source = farming()
  Object.assign(source, { unlocked: 12, exp: 1500 })
  source.seeds = { radish: 4, carrot: 2 }
  source.harvest = { radish: 1, apple: 3 }
  source.acquired = { radish: 10, apple: 9 }
  source.harvests = { radish: 1, apple: 2 }
  source.tools = { sprayer: true }
  source.fert = { 'fert-1': 1, 'fert-3': 1 }
  source.plots[0] = plot('radish', NOW - 2 * H) // 同一天，但桌宠那块已经熟了
  source.plots[2] = plot('apple', NOW - 10 * H) // 比桌宠那块的 -6 小时更靠后
  source.helper = { hired: true, level: 0, barn: 0, lastAt: NOW - 1 * H, usedMs: 5 * H, cursor: 7, pending: null, targets: Array(18).fill(null), stock: { apple: 3 } }
  source.helper.targets[2] = 'apple'
  source.onboarding = { step: 'planted', rewarded: false, legacy: false, plantedAt: NOW - MIN, wateredAt: null }

  const before = { target: clone(target), source: clone(source) }
  const result = merge(farm, target, source)
  assert.deepEqual(target, before.target, '钩子不能改入参')
  assert.deepEqual(source, before.source, '钩子不能改入参')
  assertPlainData(result)
  const merged = result.data

  assert.equal(merged.version, 5)
  assert.equal(merged.unlocked, 12, '开垦块数取高')
  assert.equal(merged.exp, 1500, '经验取高，不相加')
  assert.deepEqual(merged.seeds, { radish: 7, apple: 1, carrot: 2 }, '种子每种相加')
  assert.deepEqual(merged.harvest, { radish: 13, apple: 3 }, '仓库每种相加')
  assert.deepEqual(merged.acquired, { radish: 50, apple: 9 }, '图鉴数量每种相加')
  assert.deepEqual(merged.harvests, { radish: 6, apple: 2 }, '历史收获次数每种相加')
  assert.deepEqual(merged.tools, { sickle: true, sprayer: true }, '工具是永久解锁，两边都算')
  assert.deepEqual(merged.fert, { 'fert-1': 3, 'fert-3': 1 }, '肥料相加')
  assert.equal(merged.refund, 25, '欠着的退款也是资产')

  assert.equal(merged.plots.length, 18)
  assert.equal(merged.plots[0].crop, 'radish')
  assert.equal(merged.plots[0].plantedAt, NOW - 15 * H, '成熟的地压过生长中的同一块地')
  assert.equal(merged.plots[2].plantedAt, NOW - 10 * H, '同为生长中取更靠后的')
  assert.equal(merged.plots[1].plantedAt, NOW - 5 * H, '只有一边有就留那一边')
  for (let index = 12; index < 18; index += 1) assert.equal(merged.plots[index], null, '没开垦的地是空的')

  assert.equal(merged.helper.hired, true)
  assert.equal(merged.helper.level, 1, '帮工等级取高')
  assert.equal(merged.helper.usedMs, 0, '自然托管没有工作预算')
  assert.equal(merged.helper.cursor, 7, '指针和管区跟结算得更晚的一方')
  assert.equal(merged.helper.targets[2], 'apple')
  assert.equal(merged.helper.pending, null)
  assert.equal(merged.helper.stock.radish, 4, '帮工仓是资产，两边相加')
  assert.equal(merged.helper.stock.apple, 3)
  assert.equal(Object.values(merged.helper.stock).reduce((sum, n) => sum + n, 0), 7, '帮工仓一共 7 个，不相加之外不藏东西')
  assert.equal(merged.onboarding.step, 'done', '第一课做过了就算做过')
  assert.equal(merged.onboarding.rewarded, true)
  assert.match(result.warnings.join(' '), /第一课/)
})

test('菜园：帮工的旧批次不再合并，仓里已落袋的果保留一次，指针跟结算得更晚的一边', () => {
  const target = farming()
  target.plots[0] = plot('apple', NOW - 6 * H)
  target.helper = { hired: true, level: 1, barn: 0, lastAt: NOW - 2 * H, usedMs: 5 * H, cursor: 0, pending: { index: 0, crop: 'apple', plantedAt: NOW - 6 * H, remainingMs: 60000, yield: 1 }, targets: Array(18).fill(null), stock: { apple: 3 } }
  target.helper.targets[0] = 'apple'

  const stale = farming()
  stale.plots[0] = plot('apple', NOW - 2 * H)
  stale.helper = { hired: true, level: 1, barn: 0, lastAt: NOW - 5 * H, usedMs: 1 * H, cursor: 4, pending: { index: 0, crop: 'apple', plantedAt: NOW - 2 * H, remainingMs: 60000, yield: 1 }, targets: Array(18).fill(null), stock: { apple: 2 } }
  stale.helper.targets[0] = 'apple'
  const kept = merge(farm, target, stale)
  assertPlainData(kept)
  assert.equal(kept.data.helper.pending, null, '旧批次一律清成 null，不把上一边的队列带过来')
  assert.equal(kept.data.helper.usedMs, 0, '自然托管没有工作预算')
  assert.equal(kept.data.helper.stock.apple, 5, '已经在仓里的果保留一次、两边相加')
  assert.equal(kept.data.helper.cursor, 0, '指针和管区跟结算得更晚的一方')
  assert.equal(kept.data.helper.targets[0], 'apple')
  assert.equal(kept.data.helper.lastAt, NOW - 2 * H, '结算时间取更晚的一边')
  assert.equal(kept.data.plots[0].plantedAt, NOW - 6 * H, '同块地取更靠后的那份')

  const betterPlot = farming()
  betterPlot.plots[0] = plot('apple', NOW - 10 * H, { roll: 2 })
  betterPlot.helper = { hired: true, level: 1, barn: 0, lastAt: NOW - 1 * H, usedMs: 6 * H, cursor: 9, pending: null, targets: Array(18).fill(null), stock: {} }
  const dropped = merge(farm, target, betterPlot)
  assertPlainData(dropped)
  assert.equal(dropped.data.plots[0].plantedAt, NOW - 10 * H, '更靠后的地块赢')
  assert.equal(dropped.data.helper.pending, null, '地块换了一份，旧批次不能假装还在')
  assert.equal(dropped.data.helper.cursor, 9, '指针跟结算得更晚的一边')
  assert.equal(dropped.data.helper.stock.apple, 3, '仓里的果一个不少')
})

test('菜园：经典/旧版数据先迁移到 v5 再合并，收获、退款、帮工仓和首课都不丢', () => {
  const target = farming()
  target.unlocked = 8
  target.harvest = { sprout: 1 }
  target.acquired = { sprout: 3 }
  target.harvests = { sprout: 1 }
  target.exp = 100
  target.helper = { hired: true, level: 0, barn: 0, lastAt: null, usedMs: 0, cursor: 0, pending: null, targets: Array(18).fill(null), stock: { scallion: 1 } }
  // 3.x 的形状：地里长着的作物在迁移时按旧产量进仓库；旧洒水器/肥料/农具档退成菜币。
  const legacy = {
    unlocked: 6,
    plots: [{ crop: 'sprout' }, { crop: 'scallion' }],
    seeds: { scallion: 2 },
    harvest: { scallion: 4 },
    acquired: { scallion: 4 },
    tools: { can: true, sickle: true },
    fertilizer: 3,
    sprinklers: [true],
    helper: { hired: true, level: 1, barn: 2, usedMs: 2 * H, lastAt: NOW - 2 * H, stock: { sprout: 5 } },
  }
  const result = merge(farm, target, legacy)
  assertPlainData(result)
  const merged = result.data
  assert.equal(merged.version, 5, '迁移后写当前版本')
  assert.equal(merged.harvest.sprout, 3, '桌宠 1 + 旧地里长完的 2')
  assert.equal(merged.acquired.sprout, 5)
  assert.equal(merged.harvest.scallion, 7, '旧地里的白菜按旧产量 3 个进仓库，再加原来的 4 个')
  assert.equal(merged.harvest.sprout + merged.harvest.scallion, 10, '两边仓库相加')
  assert.equal(merged.harvests.sprout, 2)
  assert.equal(merged.harvests.scallion, 2, '旧数据按旧产量折算历史收获次数')
  assert.equal(merged.tools.sprayer, true, '旧大水壶迁移成喷雾桶')
  assert.equal(merged.helper.stock.sprout, 5, '帮工仓里的作物保留')
  assert.equal(Object.values(merged.helper.stock).reduce((sum, n) => sum + n, 0), 6, '帮工仓总数是两边之和')
  assert.equal(merged.helper.hired, true)
  assert.equal(merged.helper.level, 1)
  assert.equal(merged.helper.barn, 0, '下架的农具档迁移后退款并清零')
  assert.equal(merged.refund, 3000 + 3 * 20 + 1000 + 3000, '旧洒水器 + 旧肥料 + 农具档 2 档退款')
  assert.equal(merged.helperBarnRefund, 4000)
  assert.equal(merged.onboarding.step, 'done', '旧存档有进度就是做过第一课')
  assert.equal(merged.onboarding.legacy, true)
})

test('菜园：数量不超游戏约束；版本比扩展新或不是对象就拒绝合并', () => {
  const big = farming()
  big.unlocked = 99
  big.exp = Infinity
  big.seeds.radish = SAFE
  big.helper.hired = true
  big.helper.level = 9
  big.helper.usedMs = 1e12
  big.plots = [plot('radish', NOW - H)]
  const small = farming()
  small.unlocked = 4
  small.seeds.radish = 10
  const result = merge(farm, big, small)
  assertPlainData(result)
  const merged = result.data
  assert.equal(merged.unlocked, 18, '最多 18 块地')
  assert.equal(merged.plots.length, 18)
  assert.equal(merged.exp, SAFE, '经验封顶安全整数')
  assert.equal(merged.seeds.radish, SAFE, '数量封顶安全整数，不是负数/NaN')
  assert.equal(merged.helper.level, 2, '帮工最多升到 2 级')
  assert.equal(merged.helper.usedMs, 0, '自然托管没有工作预算：旧工时一律清零')

  const v6 = Object.assign(farming(), { version: 6 })
  assert.throws(() => merge(farm, v6, farming()), /版本 6 比当前扩展新/)
  assert.throws(() => merge(farm, farming(), v6), /版本 6 比当前扩展新/)
  for (const bad of [null, [], 'farm', 42]) assert.throws(() => merge(farm, bad, farming()), /不是对象/)
})

// ---------------------------------------------------------------- 矿洞

const mining = () => mine.init()

test('矿洞：金样例——矿石/化石两边相加，镐和深度取高，探索上下文整套取更深的一边', () => {
  const target = mining()
  Object.assign(target, { deepest: 9, layer: 9, pickaxe: 3, run: 4, oreCount: 40, bombs: 2 })
  target.bag = { coal: 3, iron: 2 }
  target.found = { amber: true }
  target.maps = { 9: { open: [0, 1, 2, 3, 4, 5, 6, 7], hits: { 8: 1 } } }
  target.combo = { n: 2, at: NOW - 1000 }
  target.last = { layer: 9, index: 7, kind: 'ore', key: 'iron', at: NOW - 1000, bonus: 0, combo: 2, id: 11 }
  target.helper = { hired: true, cart: 1, lamp: 1, floor: 6, lastAt: NOW - H, remainder: 500, sequence: 10, usedMs: H, stock: { coal: 2 } }

  const source = mining()
  Object.assign(source, { deepest: 14, layer: 14, pickaxe: 4, run: 7, oreCount: 25, bombs: 1 })
  source.bag = { coal: 4, gold: 1 }
  source.found = { amber: true, leaf: true }
  source.maps = { 14: { open: [0, 1, 2, 3, 4, 5, 6], hits: {} } }
  source.combo = { n: 0, at: 0 }
  source.last = { layer: 14, index: 9, kind: 'fossil', key: 'leaf', at: NOW - 2000, bonus: 0, combo: 0, id: 30 }
  source.helper = { hired: true, cart: 3, lamp: 2, floor: 11, lastAt: NOW - 2 * H, remainder: 900, sequence: 20, usedMs: 2 * H, stock: { gold: 1 } }

  const before = { target: clone(target), source: clone(source) }
  const result = merge(mine, target, source)
  assert.deepEqual(target, before.target)
  assert.deepEqual(source, before.source)
  assertPlainData(result)
  const merged = result.data

  assert.equal(merged.v, 2)
  assert.equal(merged.deepest, 14, '深度取高')
  assert.equal(merged.pickaxe, 4, '镐取高')
  assert.deepEqual(merged.bag, { coal: 7, iron: 2, gold: 1 }, '矿石每种相加')
  assert.deepEqual(merged.found, { amber: true, leaf: true }, '化石图鉴并集')
  assert.equal(merged.oreCount, 65, '累计挖到的矿两边相加')
  assert.equal(merged.bombs, 3, '炸弹相加')
  assert.equal(merged.layer, 14, '当前层跟更深的那一边')
  assert.equal(merged.run, 7, '趟编号跟同一套上下文')
  assert.deepEqual(Object.keys(merged.maps), ['14'], '不混两张地图')
  assert.deepEqual(merged.combo, { n: 0, at: 0 })
  assert.equal(merged.last.id, 30)
  assert.equal(merged.helper.cart, 3, '矿车取高')
  assert.equal(merged.helper.lamp, 2, '头灯取高')
  assert.equal(merged.helper.floor, 11, '电梯站跟同一套进度')
  assert.equal(merged.helper.usedMs, 2 * H, '本窗口工作量取高')
  assert.equal(merged.helper.stock.coal, 2, '矿车里的矿相加')
  assert.equal(merged.helper.stock.gold, 1)
  assert.equal(Object.values(merged.helper.stock).reduce((sum, n) => sum + n, 0), 3)
})

test('矿洞：数量不超约束；版本比扩展新或不是对象就拒绝合并', () => {
  const big = mining()
  Object.assign(big, { layer: 99, deepest: 99, pickaxe: 4, bombs: SAFE, oreCount: SAFE, bag: { coal: SAFE } })
  big.helper = { hired: true, cart: 9, lamp: 9, floor: 12, lastAt: NOW, remainder: 1e12, sequence: SAFE, usedMs: 1e12, stock: { gold: SAFE } }
  big.maps = { 1: { open: [0, 5, 5, 999, -1, 2], hits: { 1: 3, 8: 2, 99: 1 } }, 99: { open: [0], hits: {} } }
  const small = mining()
  small.pickaxe = 5
  small.bag = { coal: 10 }
  const result = merge(mine, big, small)
  assertPlainData(result)
  const merged = result.data
  assert.equal(merged.layer >= 1 && merged.layer <= 20, true, '当前层在 1～20')
  assert.equal(merged.deepest >= 1 && merged.deepest <= 20, true, '最深不超过 20 层')
  assert.equal(merged.pickaxe, 5, '镐最多 5 级')
  assert.deepEqual(Object.keys(merged.maps), ['1'], '坏掉的层号和越界格都清掉')
  assert.deepEqual(merged.maps[1].open, [0, 1, 2, 3, 4, 5], '入口那行始终开着，门口格重复/越界都去掉')
  assert.deepEqual(merged.maps[1].hits, { 8: 2 }, '只留能敲的格子上的剩余次数')
  assert.equal(merged.bag.coal, SAFE, '矿石数量封顶安全整数')
  assert.equal(merged.helper.cart, 3)
  assert.equal(merged.helper.lamp, 3)
  assert.equal(merged.helper.usedMs <= 6 * H, true, '六小时封顶')
  assert.equal(merged.bombs, SAFE)

  const v3 = Object.assign(mining(), { v: 3 })
  assert.throws(() => merge(mine, v3, mining()), /版本 3 比当前扩展新/)
  assert.throws(() => merge(mine, mining(), v3), /版本 3 比当前扩展新/)
  for (const bad of [null, [], 'mine']) assert.throws(() => merge(mine, bad, mining()), /不是对象/)
})

// ---------------------------------------------------------------- 扭蛋

const got = (key, rarity, count = 1) => ({ key, label: key, emoji: 'x', count, rarity })

test('扭蛋：金样例——运气/序号取高，记录拼起来留最近 30 条，里程碑两边相加，免费抽不重复', () => {
  const target = gacha.init()
  Object.assign(target, { luck: 7, seq: 3, freeDay: gameDay(NOW) })
  target.history = [got('apple', 'normal', 3), got('rice', 'rare', 2), got('feast', 'gold', 5)]
  target.last = { id: 3, machine: 'snack', items: [got('feast', 'gold', 5)] }
  target.milestones = { spins: 10, gold: 1, machines: ['snack'] }

  const source = gacha.init()
  Object.assign(source, { luck: 19, seq: 8, freeDay: '2026-10-01' })
  source.history = [got('soap', 'normal', 3), got('soul', 'gold', 1)]
  source.last = { id: 8, machine: 'medicine', items: [got('soul', 'gold', 1)] }
  source.milestones = { spins: 5, gold: 2, machines: ['goods'] }

  const before = { target: clone(target), source: clone(source) }
  const result = merge(gacha, target, source)
  assert.deepEqual(target, before.target)
  assert.deepEqual(source, before.source)
  assertPlainData(result)
  const merged = result.data

  assert.equal(merged.luck, 19, '幸运值取高：20 就是必出金')
  assert.equal(merged.seq, 8)
  assert.equal(merged.freeDay, gameDay(NOW), '今天任一边抽过，合并后今天不再免费')
  assert.equal(merged.history.length, 5)
  assert.equal(merged.history[0].key, 'apple', '桌宠的记录在前')
  assert.equal(merged.last.id, 8, '最近一次看 id 更大的')
  assert.deepEqual(merged.milestones, { spins: 15, gold: 3, machines: ['snack', 'goods', 'medicine'] }, '里程碑两边累计相加；最近一次记录里的机器也算用过')

  // 目录上限：记录最多 30 条，序号不会因为截断而变小。
  const many = gacha.init()
  many.seq = 40
  many.history = Array.from({ length: 25 }, (_, index) => got('apple', 'normal', 3 + index))
  const more = gacha.init()
  more.seq = 60
  more.history = Array.from({ length: 25 }, (_, index) => got('bread', 'normal', 1 + index))
  const capped = merge(gacha, many, more).data
  assert.equal(capped.history.length, 30, '记录最多 30 条')
  assert.equal(capped.seq, 60)
})

test('扭蛋：认不出的内嵌字段只提示不猜；不是对象就拒绝合并', () => {
  const target = gacha.init()
  target.futureField = { kept: true }
  const source = Object.assign(gacha.init(), { futureField: { kept: 'from-source' }, anotherFuture: 1 })
  const result = merge(gacha, target, source)
  assertPlainData(result)
  assert.deepEqual(result.data.futureField, { kept: true }, '桌宠自己的未知字段原样保留')
  assert.match(result.warnings.join(' '), /不认识的字段/)
  for (const bad of [null, [], 'gacha']) assert.throws(() => merge(gacha, bad, gacha.init()), /不是对象/)
})

// ---------------------------------------------------------------- 盲盒

test('盲盒：金样例——潜能取高封顶 6，凭证/抽数相加，保底按卡池取高，最近记录取更新的', () => {
  const target = blindbox.init()
  Object.assign(target, { certs: 3, pulls: 20, seq: 4 })
  target.owned = { goldpig: 2, duck: 6 }
  target.pity = { standard: 12, limited: 0 }
  target.last = { id: 4, banner: 'standard', items: [{ key: 'goldpig', stars: 6, isNew: false, potential: 2, certs: 40 }] }

  const source = blindbox.init()
  Object.assign(source, { certs: 5, pulls: 11, seq: 9 })
  source.owned = { goldpig: 4, whale: 1, duck: 2 }
  source.pity = { standard: 9, limited: 30 }
  source.last = { id: 9, banner: 'limited', items: [{ key: 'whale', stars: 6, isNew: true, potential: 1, certs: 0 }] }

  const before = { target: clone(target), source: clone(source) }
  const result = merge(blindbox, target, source)
  assert.deepEqual(target, before.target)
  assert.deepEqual(source, before.source)
  assertPlainData(result)
  const merged = result.data

  assert.equal(merged.v, 2)
  assert.deepEqual(merged.owned, { goldpig: 4, duck: 6, whale: 1 }, '潜能取高（不超 6），摆件并集')
  assert.equal(merged.certs, 8, '还没搬进钱包的凭证相加')
  assert.deepEqual(merged.pity, { standard: 12, limited: 30 }, '每个卡池的保底水位取高')
  assert.equal(merged.pulls, 31, '抽数两边相加')
  assert.equal(merged.seq, 9)
  assert.equal(merged.last.id, 9, '最近一次取 id 更大的')
  assert.equal(merged.last.banner, 'limited')
})

test('盲盒：1.0 的旧数据先换算再合并；潜能封顶、数量封顶；版本比扩展新或不是对象就拒绝', () => {
  const target = blindbox.init()
  target.owned = { goldpig: 6 }
  target.certs = SAFE
  // 1.0 的形状：按系列存 have/shards，normalize 先换算成 v2。
  const legacy = { series: { farm: { have: { duck: 2, goldpig: 3 }, shards: 2 } } }
  const result = merge(blindbox, target, legacy)
  assertPlainData(result)
  const merged = result.data
  assert.equal(merged.v, 2)
  assert.equal(merged.owned.goldpig, 6, '潜能最多 6')
  assert.equal(merged.owned.duck, 2, '旧数据的摆件保留')
  assert.equal(merged.certs, SAFE, '凭证封顶安全整数')
  assert.equal(merged.owned.duck + 4 >= 2, true)

  // 坏数据里的负数不能带进合并结果（normalize 只保证是整数）。
  const negative = blindbox.init()
  Object.assign(negative, { certs: -5, pulls: -3, seq: -1 })
  negative.owned = { duck: -2 }
  const clamped = merge(blindbox, blindbox.init(), negative).data
  assert.equal(clamped.certs, 0)
  assert.equal(clamped.pulls, 0)
  assert.equal(clamped.seq, 0)
  assert.equal(clamped.owned.duck, undefined)

  const v3 = Object.assign(blindbox.init(), { v: 3 })
  assert.throws(() => merge(blindbox, v3, blindbox.init()), /版本 3 比当前扩展新/)
  assert.throws(() => merge(blindbox, blindbox.init(), v3), /版本 3 比当前扩展新/)
  for (const bad of [null, [], 'blindbox']) assert.throws(() => merge(blindbox, bad, blindbox.init()), /不是对象/)
})

// ---------------------------------------------------------------- 通用不变量

test('四个钩子：同输入同输出、自己和自己合并也不出非法值', () => {
  const samples = [[farm, farming()], [mine, mining()], [gacha, gacha.init()], [blindbox, blindbox.init()]]
  for (const [extension, base] of samples) {
    const copy = clone(base)
    const first = merge(extension, base, copy)
    const second = merge(extension, base, copy)
    assertPlainData(first)
    assert.deepEqual(first, second, '同样的输入要得到同样的结果')
    assert.deepEqual(base, clone(base))
    assert.deepEqual(copy, clone(copy))
    // 自己和自己：资产会按规则相加（设计允许），但不能出现 NaN/Infinity/负数。
    const doubled = merge(extension, base, clone(base))
    assertPlainData(doubled)
  }
})

test('四个钩子：存档里出现 __proto__ 之类的名字也不会带进合并结果', () => {
  const hostile = text => JSON.parse(text)
  const farmTarget = farming()
  farmTarget.seeds = hostile('{"__proto__": 5, "radish": 1}')
  farmTarget.tools = hostile('{"__proto__": true, "sickle": true}')
  const farmResult = merge(farm, farmTarget, farming())
  assertPlainData(farmResult)
  assert.equal(Object.hasOwn(farmResult.data.seeds, '__proto__'), false)
  assert.equal(Object.hasOwn(farmResult.data.tools, '__proto__'), false)
  assert.equal(farmResult.data.seeds.radish, 1)
  assert.equal(Object.getPrototypeOf(farmResult.data.seeds), Object.prototype)

  const mineTarget = mining()
  mineTarget.bag = hostile('{"__proto__": 9, "coal": 2}')
  mineTarget.found = hostile('{"__proto__": true, "amber": true}')
  const mineResult = merge(mine, mineTarget, mining())
  assertPlainData(mineResult)
  assert.equal(Object.hasOwn(mineResult.data.bag, '__proto__'), false)
  assert.equal(Object.hasOwn(mineResult.data.found, '__proto__'), false)
  assert.equal(mineResult.data.bag.coal, 2)

  const gachaResult = merge(gacha, hostile('{"luck": 1, "__proto__": {"polluted": true}}'), gacha.init())
  assertPlainData(gachaResult)
  assert.equal(Object.hasOwn(gachaResult.data, '__proto__'), false)
  assert.equal({}.polluted, undefined)

  const boxTarget = blindbox.init()
  boxTarget.owned = hostile('{"__proto__": 6, "duck": 1}')
  boxTarget.pity = hostile('{"__proto__": 30, "standard": 2}')
  const boxResult = merge(blindbox, boxTarget, blindbox.init())
  assertPlainData(boxResult)
  assert.equal(Object.hasOwn(boxResult.data.owned, '__proto__'), false)
  assert.equal(Object.hasOwn(boxResult.data.pity, '__proto__'), false)
  assert.equal(boxResult.data.owned.duck, 1)
  assert.equal(boxResult.data.pity.standard, 2)
})

// ---------------------------------------------------------------- 宿主接线

/** 把扩展原样装进临时存档，走真实的 manifest/加载路径。 */
async function installed(key, patchManifest = manifest => manifest) {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-merge-official-'))
  const state = hatchEgg(NOW)
  state.extData = { [key]: {} }
  writeFileSync(join(dir, 'state.json'), JSON.stringify(state))
  const folder = join(dir, 'extensions', key)
  mkdirSync(folder, { recursive: true })
  const manifest = patchManifest(manifestOf(key))
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify(manifest))
  for (const name of ['server.js', 'client.js']) writeFileSync(join(folder, name), readFileSync(new URL('../extensions/' + key + '/' + name, import.meta.url)))
  const store = createStore(join(dir, 'state.json'), { now: () => NOW, journal: createJournal({ now: () => NOW }) })
  const runtime = createExtRuntime(store, { gameVersion: manifest.minGame, now: () => NOW })
  store.ext = runtime
  await runtime.ready
  return { runtime, dispose() { store.dispose(); rmSync(dir, { recursive: true, force: true, maxRetries: 3 }) } }
}

test('只有已安装且 manifest mergeHook>=1 的扩展才有钩子；没有钩子仍是逐个二选一', async () => {
  for (const key of OFFICIAL) {
    const loaded = await installed(key)
    try {
      const hooks = loaded.runtime.mergeStates()
      assert.equal(typeof hooks[key], 'function', key + ' 装上了就要提供合并钩子')
      const hooks2 = loaded.runtime.mergeStates()
      assert.equal(typeof hooks2[key], 'function')
    } finally { loaded.dispose() }
  }
  const bare = await installed('mine', manifest => { const next = { ...manifest }; delete next.mergeHook; return next })
  try {
    const hooks = bare.runtime.mergeStates()
    assert.equal(hooks.mine, undefined, '没有 mergeHook 不提供钩子')
    const target = { extData: { mine: {} } }
    const source = { extData: { mine: {} } }
    assert.deepEqual(describeExtensionConflicts(target, source, hooks).map(item => item.key), ['ext:mine'], '没有钩子就退回二选一')
    assert.deepEqual(describeExtensionConflicts(target, source, { mine: () => ({}) }), [], '有钩子就不进二选一')
  } finally { bare.dispose() }
})

test('真实安装的矿洞走完整 preview/commit：钩子跑在桌面端，不出现二选一', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-merge-e2e-'))
  const statePath = join(dir, 'state.json')
  const folder = join(dir, 'extensions', 'mine')
  mkdirSync(folder, { recursive: true })
  for (const name of ['manifest.json', 'server.js', 'client.js']) writeFileSync(join(folder, name), readFileSync(new URL('../extensions/mine/' + name, import.meta.url)))
  const targetMine = mining()
  Object.assign(targetMine, { deepest: 6, layer: 6, pickaxe: 2, bag: { coal: 2 }, bombs: 1 })
  const sourceMine = mining()
  Object.assign(sourceMine, { deepest: 11, layer: 11, pickaxe: 3, bag: { coal: 5, silver: 1 }, bombs: 4 })
  const target = Object.assign(migrate(hatchEgg(NOW), NOW), { extensions: { mine: true }, extData: { mine: targetMine } })
  const source = Object.assign(migrate(hatchEgg(NOW), NOW), { extensions: { mine: true }, extData: { mine: sourceMine } })
  writeFileSync(statePath, JSON.stringify(target))
  const runtime = createGameRuntime({ statePath, now: () => NOW })
  try {
    await runtime.ext?.ready
    const pair = await startPairServer({ runtime, directory: join(dir, 'endpoint'), appVersion: '0.6.7', gameVersion: '0.37.2', confirm: () => true, now: () => NOW })
    const discovery = JSON.parse(readFileSync(join(dir, 'endpoint', 'pair.json'), 'utf8'))
    const base = 'http://127.0.0.1:' + discovery.port
    const headers = { authorization: 'Bearer ' + discovery.token }
    try {
      const archive = createSaveArchive({ statePath: join(dir, 'source.json'), state: source, nowMs: NOW })
      let response = await fetch(base + '/pair/merge/preview', { method: 'POST', headers: { ...headers, 'content-type': 'application/zip' }, body: archive.buffer })
      const preview = await response.json()
      assert.equal(response.status, 200, JSON.stringify(preview))
      assert.equal(preview.conflicts.some(item => item.key === 'ext:mine'), false, '有钩子就不该进二选一')
      response = await fetch(base + '/pair/merge/commit', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices: { duplicate: 'merge' } }) })
      const commit = await response.json()
      assert.equal(response.status, 200, JSON.stringify(commit))
      const saved = JSON.parse(readFileSync(statePath, 'utf8')).extData.mine
      assert.equal(saved.deepest, 11, '桌面存档里是合并后的深度')
      assert.equal(saved.layer, 11, '整套探索上下文来自更深的一边')
      assert.equal(saved.pickaxe, 3, '镐取高')
      assert.equal(saved.bag.coal, 7, '矿石两边相加')
      assert.equal(saved.bag.silver, 1)
      assert.equal(saved.bombs, 5)
    } finally { await pair.close() }
  } finally { runtime.dispose(); rmSync(dir, { recursive: true, force: true, maxRetries: 3 }) }
})
