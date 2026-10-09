// 矿洞 2.0（docs/numbers/J1-economy.md 第 3 节；用户 2026-10-09：去掉体力、玩法丰富、增量游戏式成长）。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

import mine, { BOMB, CHECKPOINTS, COMBO_MS, EXERT, FLOORS, FOSSILS, ORES, PICKAXES, generateMap, hitsNeeded, normalize, pickaxeFor } from '../extensions/mine/server.js'
import { fakeDom } from './helpers/bundle.js'

const T0 = new Date(2026, 9, 9, 12).getTime()

/** 有矿石币钱包的假宿主。 */
function fake(balance = 100_000) {
  const said = []
  let tired = 0
  const earned = {}
  const api = {
    now: T0,
    coins: () => 0,
    spend() { throw new Error('mine 2.0 must not touch gold') },
    earn() { throw new Error('mine 2.0 must not touch gold') },
    wallet: {
      currency: { label: '矿石币', emoji: '⛏️', rate: 1 },
      balance: () => balance,
      earn: (n, source) => { balance += n; earned[source] = (earned[source] ?? 0) + n; return n },
      spend: n => { if (balance < n) return false; balance -= n; return true },
    },
    say: line => said.push(line),
    emit: () => false,
    exert: points => { tired += points },
  }
  return { api, said, earned, balance: () => balance, tired: () => tired }
}

/** 把一格敲开（按当前镐敲够次数）。 */
function open(data, index, api) {
  const cell = generateMap(data.layer, data.run, data.pickaxe)[index]
  for (let hit = 0; hit < hitsNeeded(cell.kind, data.pickaxe); hit += 1) mine.actions.dig(data, { cell: index }, api)
  return cell
}

/** 找一趟、一层里满足条件的格子，并把它上面那格打开，让它能挖。 */
function find(data, floor, test) {
  for (let run = 0; run < 400; run += 1) {
    const map = generateMap(floor, run, data.pickaxe)
    const index = map.findIndex((cell, at) => at >= 12 && test(cell))
    if (index >= 0) {
      data.run = run; data.layer = floor
      data.maps[floor] = { open: [0, 1, 2, 3, 4, 5, index - 6], hits: {} }
      return { index, cell: map[index] }
    }
  }
  throw new Error('no such cell')
}

test('十种矿、十二种化石、五把镐、二十层严格按 J1；矿越值钱越少见', () => {
  assert.deepEqual(ORES.map(o => [o.label, o.unlock, o.price]), [
    ['煤', 1, 8], ['铜', 1, 15], ['铁', 2, 20], ['银', 5, 35], ['金', 7, 80], ['宝石', 9, 200],
    ['翡翠', 11, 260], ['红宝石', 13, 360], ['蓝宝石', 15, 450], ['星辰石', 19, 1200],
  ])
  assert.equal(FOSSILS.length, 12)
  assert.deepEqual(PICKAXES.map(p => [p.label, p.price]), [['木镐', 0], ['铁镐', 1500], ['钢镐', 4000], ['钻石镐', 10000], ['星辰镐', 25000]])
  assert.equal(FLOORS, 20)
  assert.deepEqual(CHECKPOINTS, [1, 6, 11, 16])
  const counts = {}
  for (let run = 0; run < 300; run += 1) for (const cell of generateMap(19, run)) if (cell.kind === 'ore') counts[cell.key] = (counts[cell.key] ?? 0) + 1
  assert.ok(counts.coal > counts.gold && counts.gold > (counts.star ?? 0), JSON.stringify(counts))
  assert.ok((counts.star ?? 0) > 0, 'star stones do turn up deep down')
})

test('地图按「第几趟」和层数确定：入口、唯一的梯子、最多一个化石和宝箱、矿不超过这层能出的', () => {
  assert.deepEqual(generateMap(3, 7), generateMap(3, 7))
  assert.notDeepEqual(generateMap(3, 7), generateMap(3, 8))
  for (let floor = 1; floor <= FLOORS; floor += 1) {
    for (const run of [0, 1, 2, 3]) {
      const map = generateMap(floor, run)
      assert.equal(map.length, 48)
      assert.ok(map.slice(0, 6).every(cell => cell.kind === 'entrance'))
      assert.equal(map.filter(cell => cell.kind === 'ladder').length, 1)
      assert.ok(map.findIndex(cell => cell.kind === 'ladder') >= 36)
      assert.ok(map.filter(cell => cell.kind === 'fossil').length <= 1)
      assert.ok(map.filter(cell => cell.kind === 'chest').length <= 1)
      assert.ok(map.filter(cell => cell.kind === 'ore').every(cell => ORES.find(o => o.key === cell.key).unlock <= floor))
      assert.ok(map.filter(cell => cell.kind === 'fossil').every(cell => FOSSILS.find(f => f.key === cell.key).unlock <= floor))
    }
  }
})

test('没有体力：一直能挖，每敲一下让猪累 0.3；只能挖挨着已开的格子', () => {
  const t = fake()
  const data = mine.init()
  assert.equal(mine.actions.dig(data, { cell: 47 }, t.api).reason, 'not-adjacent')
  let digs = 0
  for (let i = 0; i < 300; i += 1) {
    const cells = mine.view(data, t.api).cells.filter(cell => !cell.open && cell.adjacent)
    if (cells.length === 0) { mine.actions.newRun(data, {}, t.api); continue }
    assert.equal(mine.actions.dig(data, { cell: cells[0].index }, t.api).ok, true)
    digs += 1
  }
  assert.ok(digs > 250)
  assert.ok(Math.abs(t.tired() - digs * EXERT) < 1e-6)
  assert.equal(data.energy, undefined)
})

test('镐越好敲得越少；星辰镐每格一下', () => {
  assert.deepEqual(['soil', 'rock', 'hard', 'ore'].map(kind => hitsNeeded(kind, 1)), [1, 2, 4, 3])
  assert.deepEqual(['soil', 'rock', 'hard', 'ore'].map(kind => hitsNeeded(kind, 2)), [1, 1, 4, 2])
  assert.deepEqual(['soil', 'rock', 'hard', 'ore'].map(kind => hitsNeeded(kind, 3)), [1, 1, 3, 2])
  assert.deepEqual(['soil', 'rock', 'hard', 'ore'].map(kind => hitsNeeded(kind, 4)), [1, 1, 2, 2])
  assert.deepEqual(['soil', 'rock', 'hard', 'ore', 'chest'].map(kind => hitsNeeded(kind, 5)), [1, 1, 1, 1, 1])
})

test('工具开路：第 6 / 11 / 16 层起要铁镐 / 钢镐 / 钻石镐；镐按顺序一把把买', () => {
  assert.deepEqual([1, 5, 6, 10, 11, 16, 20].map(pickaxeFor), [1, 1, 2, 2, 3, 4, 4])
  const t = fake()
  const data = mine.init()
  find(data, 5, cell => cell.kind === 'ladder')
  const ladder = generateMap(5, data.run).findIndex(cell => cell.kind === 'ladder')
  data.maps[5].open.push(ladder)
  assert.deepEqual(mine.actions.descend(data, {}, t.api), { ok: false, reason: 'need-pickaxe', need: 2 })
  assert.equal(mine.view(data, t.api).needPickaxe, '铁镐')
  assert.equal(mine.actions.buy(data, { item: 'pickaxe' }, t.api).ok, true)
  assert.equal(data.pickaxe, 2)
  assert.equal(t.balance(), 100_000 - 1500)
  assert.equal(mine.actions.descend(data, {}, t.api).ok, true)
  assert.equal(data.layer, 6)
  assert.equal(mine.actions.buy(data, { item: 'diamond' }, t.api).reason, 'unavailable', 'steel comes first')
  for (let level = 3; level <= 5; level += 1) assert.equal(mine.actions.buy(data, { item: 'pickaxe' }, t.api).ok, true)
  assert.equal(mine.actions.buy(data, { item: 'pickaxe' }, t.api).reason, 'owned')
})

test('连挖：6 秒内接连挖到矿，每接一个多给一成，最多五成；断了重新数', () => {
  const t = fake()
  const data = mine.init()
  data.pickaxe = 5
  const ore = { key: 'coal', kind: 'ore' }
  data.maps[1] = { open: [0, 1, 2, 3, 4, 5], hits: {} }
  // 直接走 reveal 的路径：连着敲开几块矿。
  const ores = []
  for (let run = 0; run < 200 && ores.length < 7; run += 1) {
    const map = generateMap(1, run, 5)
    const index = map.findIndex((cell, at) => at >= 6 && at < 12 && cell.kind === 'ore')
    if (index >= 0) ores.push({ run, index, key: map[index].key })
  }
  assert.ok(ores.length >= 7)
  for (const [i, entry] of ores.entries()) {
    data.run = entry.run
    data.maps = { 1: { open: [0, 1, 2, 3, 4, 5], hits: {} } }
    t.api.now = T0 + i * 1000
    mine.actions.dig(data, { cell: entry.index }, t.api)
  }
  assert.equal(data.combo.n, 7)
  const price = key => ORES.find(o => o.key === key).price
  const expected = ores.reduce((sum, entry, i) => sum + Math.floor(price(entry.key) * Math.min(0.5, 0.1 * i)), 0)
  assert.equal(t.earned.combo, expected)
  data.run = ores[0].run
  data.maps = { 1: { open: [0, 1, 2, 3, 4, 5], hits: {} } }
  t.api.now += COMBO_MS + 1
  mine.actions.dig(data, { cell: ores[0].index }, t.api)
  assert.equal(data.combo.n, 1, 'a pause breaks the chain')
  assert.ok(ore)
})

test('宝箱开出矿石币或炸弹；炸弹一下炸开 3×3，里面的矿照常进袋', () => {
  const t = fake()
  const data = mine.init()
  data.pickaxe = 5
  const { index } = find(data, 4, cell => cell.kind === 'chest')
  open(data, index, t.api)
  assert.ok((t.earned.chest ?? 0) > 0 || data.bombs === 1, 'a chest pays something')

  const target = find(data, 3, cell => cell.kind === 'soil')
  data.bombs = 0
  assert.equal(mine.actions.bomb(data, { cell: target.index }, t.api).reason, 'empty')
  assert.equal(mine.actions.buy(data, { item: 'bomb' }, t.api).ok, true)
  assert.equal(t.balance() < 100_000, true)
  const before = data.maps[3].open.length
  assert.equal(mine.actions.bomb(data, { cell: target.index }, t.api).ok, true)
  assert.ok(data.maps[3].open.length - before >= 6, 'a 3×3 blast opens several cells at once')
  assert.equal(data.bombs, 0)
  assert.equal(BOMB.price, 60)
})

test('电梯：到过的电梯站（镐也够）能直接去；再下一趟换一批新矿脉，不用等明天', () => {
  const t = fake()
  const data = mine.init()
  assert.equal(mine.actions.elevator(data, { floor: 6 }, t.api).reason, 'locked')
  data.deepest = 12
  data.pickaxe = 2
  assert.equal(mine.actions.elevator(data, { floor: 6 }, t.api).ok, true)
  assert.equal(mine.actions.elevator(data, { floor: 11 }, t.api).reason, 'need-pickaxe')
  assert.deepEqual(mine.view(data, t.api).checkpoints.map(stop => stop.unlocked), [true, true, false, false])
  const run = data.run
  data.maps[6] = { open: [0, 1, 2, 3, 4, 5, 6], hits: {} }
  assert.equal(mine.actions.newRun(data, { floor: 6 }, t.api).ok, true)
  assert.equal(data.run, run + 1)
  assert.deepEqual(data.maps, {})
  assert.equal(data.layer, 6)
})

test('矿在哪都能卖，进矿石币；化石和宝石类矿进图鉴', () => {
  const t = fake(0)
  const data = mine.init()
  data.bag = { coal: 2, copper: 1 }
  assert.deepEqual(mine.actions.sell(data, {}, t.api), { ok: true, coins: 31 })
  assert.equal(t.balance(), 31)
  data.pickaxe = 5
  const fossil = find(data, 1, cell => cell.kind === 'fossil')
  open(data, fossil.index, t.api)
  assert.equal(data.found[fossil.cell.key], true)
  assert.equal(mine.view(data, t.api).dex.entries.find(entry => entry.key === fossil.cell.key).acquired, true)
  assert.equal(mine.view(data, t.api).dex.entries.length, 12 + 5)
})

test('1.x 老存档：钻石镐（3 级）变成 2.0 的钻石镐（4 级），体力和按日期的地图清掉，矿袋和化石保留', () => {
  const old = { day: '2026-10-08', layer: 7, maps: { 7: { open: [0, 1, 2, 3, 4, 5, 9], hits: {} } }, energy: 12, energyAt: 1, drinks: 3, pickaxe: 3, bag: { gold: 2 }, found: { bone: true }, deepest: 9 }
  const data = normalize(structuredClone(old))
  assert.equal(data.pickaxe, 4)
  assert.equal(data.layer, 1)
  assert.deepEqual(data.maps, {})
  assert.equal(data.energy, undefined)
  assert.equal(data.drinks, undefined)
  assert.deepEqual(data.bag, { gold: 2 })
  assert.equal(data.found.bone, true)
  assert.equal(data.deepest, 9)
  assert.equal(normalize({ v: 2, pickaxe: 3 }).pickaxe, 3, 'a 2.0 steel pickaxe stays steel')
})

test('缺字段的存档在 view 和动作中自动补齐；view 不改存档', () => {
  const t = fake()
  const empty = {}
  const first = mine.view(empty, t.api)
  assert.deepEqual(empty, {}, 'view 不改原始存档')
  assert.equal(first.cells.length, 48)
  assert.equal(first.pickaxe.label, '木镐')
  assert.equal(first.shelf.currency.label, '矿石币')
  assert.deepEqual(first.shelf.items.map(item => item.key), ['helper-hire', 'pickaxe', 'bomb'])
  assert.equal(mine.actions.dig(empty, { cell: 6 }, t.api).ok, true)
  assert.equal(mine.actions.surface(empty, {}, t.api).ok, true)
  assert.equal(mine.actions.sell(empty, {}, t.api).reason, 'empty')
})

test('经济：每一档镐的净时薪落在主动线区间里，镐越好赚得越多（tools/economy-sim.mjs）', async () => {
  const { simulateMine } = await import('../tools/economy-sim.mjs')
  const best = pickaxe => Math.max(...CHECKPOINTS.filter(floor => pickaxeFor(floor) <= pickaxe).map(floor => (simulateMine(pickaxe, floor, 1) + simulateMine(pickaxe, floor, 2)) / 2))
  const wood = best(1)
  const star = best(5)
  assert.ok(wood >= 300 && wood <= 600, `木镐 ${wood}`)
  assert.ok(star >= 1500 && star <= 2600, `星辰镐 ${star}`)
  assert.ok(best(2) > wood && star > best(2), 'better pickaxes earn more')
})

// ---------------------------------------------------------------------------
// 界面
// ---------------------------------------------------------------------------

function renderMine(view) {
  const dom = fakeDom()
  dom.document.getElementById = () => null
  let render
  const window = { dshPiggyExtensions: { register(_key, impl) { render = impl.render } } }
  runInNewContext(readFileSync(new URL('../extensions/mine/client.js', import.meta.url), 'utf8'), { window, document: dom.document, Date, requestAnimationFrame: () => {} })
  const sent = []
  let shop = 0
  const app = {
    data: view, content: dom.body,
    el(tag, className, label) {
      const node = dom.document.createElement(tag)
      node.className = className ?? ''
      if (label !== undefined) node.textContent = label
      return node
    },
    button(className, attrs, onClick) {
      const node = this.el('button', className)
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
      node.addEventListener('click', onClick)
      return node
    },
    send(op, payload) { sent.push({ op, payload }) },
    rerender() { dom.body.children.length = 0; render(app) },
    openShop() { shop += 1 },
  }
  render(app)
  const find = (attr, key) => {
    let result
    dom.body.walk(node => { if (node.getAttribute(attr) === key) result = node })
    return result
  }
  return { find, sent, shops: () => shop, body: dom.body }
}

test('矿车空仓停工显示休息和接着干，不写仓满', () => {
  const t = fake()
  const data = mine.init()
  mine.actions.hire(data, {}, t.api)
  data.helper.usedMs = 21600000
  const ui = renderMine(mine.view(data, t.api))
  assert.match(ui.body.allText(), /矿工歇了/)
  assert.doesNotMatch(ui.body.allText(), /仓满/)
  assert.match(ui.find('data-mine-helper', 'collect').allText(), /接着干/)
  assert.equal(mine.actions.collect(data, {}, t.api).ok, true)
  assert.equal(data.helper.usedMs, 0)
})

test('界面：点能挖的格子就敲；缺镐时写清楚要哪把并能去商店；矿石袋写出全卖多少', () => {
  const t = fake()
  const data = mine.init()
  data.bag = { coal: 3 }
  const ladder = find(data, 5, cell => cell.kind === 'ladder')
  data.maps[5].open.push(ladder.index)
  const ui = renderMine(mine.view(data, t.api))
  assert.match(ui.body.allText(), /第 5 \/ 20 层/)
  ui.find('data-mine-cell', String(ladder.index - 5)) // 任一格子存在
  const target = mine.view(data, t.api).cells.find(cell => !cell.open && cell.adjacent)
  ui.find('data-mine-cell', String(target.index)).fire('click')
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent.at(-1))), { op: 'dig', payload: { cell: target.index } })
  assert.equal(ui.find('data-mine-op', 'need-pickaxe').textContent, '🔒 要铁镐才挖得动下一层')
  ui.find('data-mine-op', 'need-pickaxe').fire('click')
  assert.equal(ui.shops(), 1)
  ui.find('data-mine-panel', 'bag').fire('click')
  assert.equal(ui.find('data-mine-op', 'sell').textContent, '全卖 ⛏️ 24')
})

test('界面：有炸弹时点 💣 进入炸格子模式，下一次点格子发 bomb', () => {
  const t = fake()
  const data = mine.init()
  data.bombs = 2
  const ui = renderMine(mine.view(data, t.api))
  ui.find('data-mine-bomb', 'toggle').fire('click')
  const target = mine.view(data, t.api).cells.find(cell => !cell.open && cell.adjacent)
  ui.find('data-mine-cell', String(target.index)).fire('click')
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent.at(-1))), { op: 'bomb', payload: { cell: target.index } })
})
