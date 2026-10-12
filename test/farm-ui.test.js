// 菜园 4.0 的两种界面：小农场（面板）和大农场（大窗口）。用 fakeDom 跑扩展的 client.js。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test, beforeEach } from 'node:test'
import { runInNewContext } from 'node:vm'

import farm, { PEST_MS, setRandom, weatherAt } from '../extensions/farm/server.js'
import { fakeDom } from './helpers/bundle.js'

const H = 3600000
let T0 = 0
for (let day = 0; day < 30 && !T0; day += 1) { const at = new Date(2026, 9, 12 + day, 12).getTime(); if (weatherAt(at) === 'sunny') T0 = at }
beforeEach(() => setRandom(() => 0.5))

function api(balance = 50_000) {
  return { now: T0, coins: () => 0, say() {}, exert() {}, give: () => true,
    wallet: { currency: { label: '菜币', emoji: '🥬', rate: 1 }, balance: () => balance, earn(n) { balance += n; return n }, spend(n) { if (balance < n) return false; balance -= n; return true } } }
}

function renderFarm(view, mode = 'panel', extra = {}) {
  const dom = fakeDom()
  dom.document.getElementById = () => null
  let render
  const window = { dshPiggyExtensions: { register(_key, impl) { render = impl.render } } }
  runInNewContext(readFileSync(new URL('../extensions/farm/client.js', import.meta.url), 'utf8'), { window, document: dom.document, Date })
  const sent = []
  let shop = 0
  const app = {
    data: view, content: dom.body, mode,
    el(tag, className, label) { const node = dom.document.createElement(tag); node.className = className ?? ''; if (label !== undefined) node.textContent = label; return node },
    button(className, attrs, onClick) { const node = this.el('button', className); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v); node.addEventListener('click', onClick); return node },
    send(op, payload) { sent.push({ op, payload }) },
    rerender() { dom.body.children.length = 0; render(app) },
    openShop() { shop += 1 },
    ...extra,
  }
  render(app)
  const find = (attr, key) => { let found; dom.body.walk(node => { if (node.getAttribute(attr) === key) found = node }); return found }
  const all = attr => { const out = []; dom.body.walk(node => { if (node.getAttribute(attr) !== null && node.getAttribute(attr) !== undefined) out.push(node) }); return out }
  return { find, all, sent, shops: () => shop, text: () => dom.body.allText() }
}
const plain = value => JSON.parse(JSON.stringify(value))

test('小农场：6 块地；点空地种手里的种子，没种子去商店；有大农场入口就显示', () => {
  const data = farm.init()
  const t = api()
  let ui = renderFarm(farm.view(data, t), 'panel', { openBig() {} })
  assert.equal(ui.all('data-farm-plot').length, 6)
  assert.ok(ui.find('data-farm-big', 'open'))
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(ui.shops(), 1)
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  ui = renderFarm(farm.view(data, t))
  assert.equal(ui.find('data-farm-big', 'open'), undefined, 'old hosts have no big window')
  ui.find('data-farm-plot', '1').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'plant', payload: { plot: 1, item: 'radish' } })
})

test('小农场：主按钮按 收 > 照料 > 铲 > 种 的顺序做一块；买了一键工具就一次做完', () => {
  const data = farm.init()
  const t = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, t)
  t.now = T0 + Math.round(Math.LN2 * PEST_MS)
  let ui = renderFarm(farm.view(data, t))
  ui.find('data-farm-main', 'care').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'care', payload: { plot: 0 } })
  farm.actions.buy(data, { item: 'sprayer' }, t)
  ui = renderFarm(farm.view(data, t))
  ui.find('data-farm-main', 'careAll').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'careAll', payload: {} })
  farm.actions.careAll(data, {}, t)
  for (const plot of data.plots) if (plot) plot.pests = { weed: 1e15, bug: 1e15, dry: 1e15 }
  t.now = T0 + 14 * H
  ui = renderFarm(farm.view(data, t))
  assert.match(ui.text(), /收 24 个/)
  ui.find('data-farm-main', 'harvest').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'harvest', payload: { plot: 0 } })
})

test('小农场：开了第 7 块以后的地，用一行字报一下', () => {
  const data = farm.init()
  const t = api()
  farm.actions.unlock(data, { plot: 6 }, t)
  const ui = renderFarm(farm.view(data, t))
  assert.match(ui.text(), /另外 1 块地：1 块空着/)
})

test('大农场：18 块地，荒地点一下开垦；工具拿在手里点地；锁着的一键工具去商店', () => {
  const data = farm.init()
  const t = api()
  farm.actions.buy(data, { item: 'radish' }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  t.now = T0 + Math.round(Math.LN2 * PEST_MS)
  let closed = 0
  const ui = renderFarm(farm.view(data, t), 'big', { closeBig() { closed += 1 } })
  assert.equal(ui.all('data-farm-plot').length, 18)
  ui.find('data-farm-plot', '6').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'unlock', payload: { plot: 6 } })
  ui.find('data-farm-plot', '7').fire('click')
  assert.equal(ui.sent.length, 1, 'only the next wild plot can be reclaimed')
  ui.find('data-farm-tool', 'weedkiller').fire('click')
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'care', payload: { plot: 0, kind: 'weed' } })
  ui.find('data-farm-tool', 'sickle').fire('click')
  assert.equal(ui.shops(), 1)
  ui.find('data-farm-big', 'close').fire('click')
  assert.equal(closed, 1)
})

test('大农场：铁锹铲正在长的作物要点两次；仓库弹层能全卖', () => {
  const data = farm.init()
  const t = api()
  farm.actions.buy(data, { item: 'radish' }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  data.harvest.radish = 10
  const ui = renderFarm(farm.view(data, t), 'big')
  ui.find('data-farm-tool', 'shovel').fire('click')
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(ui.sent.length, 0)
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'clear', payload: { plot: 0, force: true } })
  ui.find('data-farm-panel', 'stock').fire('click')
  ui.find('data-farm-sell-everything', 'true').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'sell', payload: { item: '*' } })
})
