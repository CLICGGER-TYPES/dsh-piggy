// 菜园 2.0（docs/numbers/J1-economy.md 第 2 节；用户 2026-10-09：一键操作照增量游戏，买工具才解锁；界面点地块就做该做的事）。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

import farm, { CROPS, EXERT, PLOT_PRICES, TOOLS, advancePlot, normalize, stageTime } from '../extensions/farm/server.js'
import { fakeDom } from './helpers/bundle.js'

const T0 = Date.UTC(2026, 9, 5)

/** 有菜币钱包的假宿主。 */
function fakeApi(balance = 10_000) {
  const bag = {}
  const said = []
  let tired = 0
  const ledger = []
  const api = {
    now: T0,
    coins: () => 0,
    spend() { throw new Error('farm 2.0 must not touch gold') },
    earn() { throw new Error('farm 2.0 must not touch gold') },
    wallet: {
      currency: { label: '菜币', emoji: '🥬', rate: 1 },
      balance: () => balance,
      earn(n, source) { balance += n; ledger.push(['in', source, n]); return n },
      spend(n, sink) { if (balance < n) return false; balance -= n; ledger.push(['out', sink, n]); return true },
    },
    give(key, n) { bag[key] = (bag[key] ?? 0) + n; return true },
    say(line) { said.push(line) },
    exert(points) { tired += points },
  }
  return { api, bag, said, ledger, balance: () => balance, tired: () => tired }
}

/** 浇完三次水等它熟。 */
function grow(data, t, plot, crop) {
  const duration = stageTime(crop)
  for (let stage = 0; stage < 3; stage += 1) {
    farm.actions.water(data, { plot }, t.api)
    t.api.now += duration
  }
}

test('十六种作物、八块地、五样工具严格按 J1 数值单', () => {
  assert.deepEqual(PLOT_PRICES, [0, 0, 500, 1200, 2500, 5000, 10000, 20000])
  assert.deepEqual(CROPS.map(c => [c.label, c.price, c.minutes, c.yield, c.sell]), [
    ['豆芽', 4, 5, 2, 5], ['小葱', 6, 10, 3, 5], ['香菜', 8, 12, 3, 6], ['生菜', 10, 15, 3, 8],
    ['小白菜', 10, 30, 3, 12], ['草莓', 20, 60, 3, 25], ['蓝莓', 30, 90, 4, 29], ['胡萝卜', 25, 120, 4, 36],
    ['红薯', 40, 180, 3, 78], ['番茄', 60, 240, 4, 85], ['玉米', 80, 300, 5, 91], ['南瓜', 90, 360, 2, 285],
    ['向日葵', 120, 420, 3, 238], ['西瓜', 150, 480, 2, 435], ['葡萄', 200, 600, 3, 400], ['哈密瓜', 260, 720, 2, 790],
  ])
  assert.deepEqual(TOOLS.map(t => [t.key, t.price]), [['can', 600], ['sickle', 1000], ['planter', 1800], ['sprinkler', 3000], ['fertilizer', 20]])
  // 单块地时薪落在 50～110 菜币（J1：慢熟靠挂、快熟靠一直点）。
  for (const crop of CROPS) {
    const perHour = (crop.yield * crop.sell - crop.price) / (crop.minutes / 60)
    assert.ok(perHour >= 49 && perHour <= 111, `${crop.label} ${perHour.toFixed(1)}/h`)
  }
})

test('每个阶段必须浇水，干地离线再久也不长，成熟不坏', () => {
  const duration = stageTime('cabbage')
  const planted = { crop: 'cabbage', stage: 0, wateredAt: null }
  assert.deepEqual(advancePlot(planted, T0 + 20 * duration), planted)
  const watered = { ...planted, wateredAt: T0 }
  assert.equal(advancePlot(watered, T0 + duration - 1).stage, 0)
  const sprout = advancePlot(watered, T0 + 20 * duration)
  assert.deepEqual(sprout, { crop: 'cabbage', stage: 1, wateredAt: null })
  assert.deepEqual(advancePlot(sprout, T0 + 100 * duration), sprout)
})

test('洒水器自动浇水：离线久了一口气长熟；肥料让每个阶段快 30%', () => {
  const duration = stageTime('cabbage')
  assert.equal(advancePlot({ crop: 'cabbage', stage: 0, wateredAt: T0 }, T0 + 3 * duration, true).stage, 3)
  assert.equal(advancePlot({ crop: 'cabbage', stage: 0, wateredAt: T0 }, T0 + 2 * duration, true).stage, 2)
  assert.equal(stageTime('cabbage', true), duration * 0.7)
  const data = farm.init()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'cabbage', count: 2 }, t.api)
  assert.equal(farm.actions.buy(data, { item: 'sprinkler', plot: 0 }, t.api).ok, true)
  farm.actions.plant(data, { plot: 0, item: 'cabbage' }, t.api)
  t.api.now += 3 * duration
  assert.equal(farm.view(data, t.api).plots[0].stage, 3, 'grown with no watering at all')
  assert.equal(farm.actions.fertilize(data, { plot: 1 }, t.api).reason, 'empty')
  farm.actions.buy(data, { item: 'fertilizer' }, t.api)
  farm.actions.plant(data, { plot: 1, item: 'cabbage' }, t.api)
  assert.equal(farm.actions.fertilize(data, { plot: 1 }, t.api).ok, true)
  assert.equal(data.fertilizer, 0)
  assert.equal(farm.actions.fertilize(data, { plot: 1 }, t.api).reason, 'empty')
})

test('一键操作一开始锁着，买了工具才能用；工具只能买一次', () => {
  const data = farm.init()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'sprout', count: 5 }, t.api)
  for (const op of ['waterAll', 'harvestAll']) assert.equal(farm.actions[op](data, {}, t.api).reason, 'locked')
  assert.equal(farm.actions.plantAll(data, { item: 'sprout' }, t.api).reason, 'locked')
  for (const tool of ['can', 'sickle', 'planter']) assert.equal(farm.actions.buy(data, { item: tool }, t.api).ok, true)
  assert.equal(farm.actions.buy(data, { item: 'can' }, t.api).reason, 'owned')
  assert.equal(t.balance(), 10_000 - 20 - 600 - 1000 - 1800)

  assert.deepEqual(farm.actions.plantAll(data, { item: 'sprout' }, t.api), { ok: true, planted: 2 }, 'two free plots')
  assert.equal(data.seeds.sprout, 3)
  for (let stage = 0; stage < 3; stage += 1) {
    assert.deepEqual(farm.actions.waterAll(data, {}, t.api), { ok: true, watered: 2 })
    t.api.now += stageTime('sprout')
  }
  assert.deepEqual(farm.actions.harvestAll(data, {}, t.api), { ok: true, harvested: 2 })
  assert.equal(data.harvest.sprout, 4)
  assert.ok(Math.abs(t.tired() - EXERT * 10) < 1e-9, 'plant 2 + water 6 + harvest 2 plots, 0.2 each')
})

test('种子、工具、开地都花菜币；卖作物进菜币；放背包给宿主物品；金币一个不碰', () => {
  const data = farm.init()
  const t = fakeApi(535)
  assert.equal(farm.actions.buy(data, { item: 'cabbage' }, t.api).ok, true)
  assert.equal(farm.actions.unlock(data, { plot: 2 }, t.api).ok, true)
  assert.equal(t.balance(), 25)
  assert.equal(farm.actions.unlock(data, { plot: 4 }, t.api).ok, false)
  assert.equal(farm.actions.buy(data, { item: 'watermelon' }, t.api).reason, 'poor')
  farm.actions.buy(data, { item: 'strawberry' }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'strawberry' }, t.api)
  grow(data, t, 0, 'strawberry')
  assert.equal(farm.actions.harvest(data, { plot: 0 }, t.api).ok, true)
  assert.equal(farm.actions.sell(data, { item: 'strawberry', count: 2 }, t.api).ok, true)
  assert.equal(t.balance(), 5 + 50)
  assert.equal(farm.actions.store(data, { item: 'strawberry' }, t.api).ok, true)
  assert.equal(t.bag.strawberry, 1)
  assert.deepEqual(t.ledger.map(([side, name]) => side + ':' + name), ['out:seed', 'out:plot', 'out:seed', 'in:sell'])
})

test('1.x 的老存档（6 块地）补成 8 块，种子、仓库、作物都在', () => {
  const old = { plots: [{ crop: 'cabbage', stage: 1, plantedAt: T0, wateredAt: null }, null, null, null, null, null], unlocked: 4, seeds: { carrot: 3 }, harvest: { pumpkin: 2 }, acquired: { pumpkin: 2 } }
  const data = normalize(structuredClone(old))
  assert.equal(data.plots.length, 8)
  assert.equal(data.unlocked, 4)
  assert.deepEqual(data.plots[0], old.plots[0])
  assert.deepEqual([data.seeds.carrot, data.harvest.pumpkin], [3, 2])
  assert.deepEqual(data.sprinklers, Array(8).fill(false))
  assert.equal(data.fertilizer, 0)
})

test('货架列种子和工具，用菜币标价；view 不改存档', () => {
  const data = farm.init()
  const before = structuredClone(data)
  const view = farm.view(data, fakeApi(15).api)
  assert.deepEqual(data, before)
  assert.equal(view.shelf.currency.label, '菜币')
  assert.equal(view.shelf.currency.balance, 15)
  assert.equal(view.shelf.items.length, 16 + 5 + 1)
  assert.equal(view.shelf.items.find(c => c.key === 'cabbage').disabled, false)
  assert.equal(view.shelf.items.find(c => c.key === 'can').note, '解锁一键浇水')
  assert.equal(view.dex.entries.length, 16)
})

// ---------------------------------------------------------------------------
// 界面
// ---------------------------------------------------------------------------

function renderFarm(view) {
  const dom = fakeDom()
  dom.document.getElementById = () => null
  let render
  const window = { dshPiggyExtensions: { register(_key, impl) { render = impl.render } } }
  runInNewContext(readFileSync(new URL('../extensions/farm/client.js', import.meta.url), 'utf8'), { window, document: dom.document, Date })
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
  return { find, sent, shops: () => shop, text: () => dom.body.allText() }
}

test('空谷仓停工显示休息和接着干，管理地块不显示缺水提示', () => {
  const data = farm.init()
  const t = fakeApi()
  data.seeds.melon = 10
  for (const plot of [0, 1]) farm.actions.plant(data, { plot, item: 'melon' }, t.api)
  farm.actions.hire(data, {}, t.api)
  data.helper.usedMs = 21600000
  const ui = renderFarm(farm.view(data, t.api))
  assert.match(ui.text(), /帮工歇了/)
  assert.doesNotMatch(ui.text(), /谷仓满了|渴了，点一下浇/)
  const resume = ui.find('data-farm-helper', 'collect')
  assert.match(resume.allText(), /接着干/)
  assert.equal(resume.disabled, false)
  resume.fire('click')
  assert.equal(ui.sent[0].op, 'collect')
})

test('界面：点空地种手里的种子，没种子就去商店；锁着的工具点了去商店', () => {
  const data = farm.init()
  const t = fakeApi()
  const empty = renderFarm(farm.view(data, t.api))
  empty.find('data-farm-plot', '0').fire('click')
  assert.equal(empty.shops(), 1, 'no seed in hand: go buy some')
  empty.find('data-farm-panel', 'tools').fire('click')
  empty.find('data-farm-tool', 'can').fire('click')
  assert.equal(empty.shops(), 2, 'locked tool: go buy it')

  farm.actions.buy(data, { item: 'carrot', count: 2 }, t.api)
  const ui = renderFarm(farm.view(data, t.api))
  assert.equal(ui.find('data-farm-seed', 'carrot').getAttribute('aria-pressed'), 'true', 'the only seed is in hand')
  ui.find('data-farm-plot', '1').fire('click')
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent)), [{ op: 'plant', payload: { plot: 1, item: 'carrot' } }])
})

test('界面：渴了的地点一下浇，熟了的点一下收；工具角标是用得上的地数', () => {
  const data = farm.init()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'sprout', count: 2 }, t.api)
  farm.actions.buy(data, { item: 'can' }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'sprout' }, t.api)
  farm.actions.plant(data, { plot: 1, item: 'sprout' }, t.api)
  let ui = renderFarm(farm.view(data, t.api))
  ui.find('data-farm-panel', 'tools').fire('click')
  assert.equal(ui.find('data-farm-tool', 'can').allText().includes('2'), true, 'two thirsty plots')
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent.at(-1))), { op: 'water', payload: { plot: 0 } })
  grow(data, t, 0, 'sprout')
  ui = renderFarm(farm.view(data, t.api))
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent.at(-1))), { op: 'harvest', payload: { plot: 0 } })
})

test('界面：仓库点开才出卖 / 全卖 / 放背包，全卖写出能得多少菜币', () => {
  const data = farm.init()
  data.harvest.pumpkin = 2
  const ui = renderFarm(farm.view(data, fakeApi().api))
  assert.equal(ui.find('data-farm-crop', 'pumpkin'), undefined, 'the stock drawer is closed by default')
  ui.find('data-farm-panel', 'stock').fire('click')
  assert.equal(ui.find('data-farm-sell-all', 'pumpkin'), undefined, 'collapsed by default')
  ui.find('data-farm-crop', 'pumpkin').fire('click')
  assert.equal(ui.find('data-farm-sell-all', 'pumpkin').textContent, '全卖 🥬 570')
  assert.equal(ui.find('data-farm-store', 'pumpkin').textContent, '放进背包 · 南瓜粥')
  ui.find('data-farm-sell-all', 'pumpkin').fire('click')
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent.at(-1))), { op: 'sell', payload: { item: 'pumpkin', count: 2 } })
})

test('界面 2.1：主按钮做最该做的事——没收割镰一次收一块，有了一次收完；都在长时按钮灰掉', () => {
  const data = farm.init()
  const t = fakeApi()
  farm.actions.buy(data, { item: 'sprout', count: 2 }, t.api)
  farm.actions.plant(data, { plot: 0, item: 'sprout' }, t.api)
  farm.actions.plant(data, { plot: 1, item: 'sprout' }, t.api)
  let ui = renderFarm(farm.view(data, t.api))
  assert.equal(ui.find('data-farm-main', 'water').getAttribute('data-farm-main'), 'water', 'thirsty plots come first when nothing is ripe')
  grow(data, t, 0, 'sprout')
  grow(data, t, 1, 'sprout')
  ui = renderFarm(farm.view(data, t.api))
  ui.find('data-farm-main', 'harvest').fire('click')
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent.at(-1))), { op: 'harvest', payload: { plot: 0 } })
  farm.actions.buy(data, { item: 'sickle' }, t.api)
  ui = renderFarm(farm.view(data, t.api))
  ui.find('data-farm-main', 'harvestAll').fire('click')
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent.at(-1))), { op: 'harvestAll', payload: {} })
  assert.match(ui.text(), /🐖|雇帮工猪/, 'the helper badge uses 🐖')
})
