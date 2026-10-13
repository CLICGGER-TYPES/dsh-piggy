// 菜园 4.0 的两种界面：小农场（面板）和大农场（大窗口）。用 fakeDom 跑扩展的 client.js。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test, beforeEach } from 'node:test'
import { runInNewContext } from 'node:vm'

import farm, { PEST_MS, setRandom, weatherAt } from '../extensions/farm/server.js'
import { fakeDom } from './helpers/bundle.js'

// 既有 4.0 熟地存档用于旧行为回归；开荒另有独立测试。
function establishedFarm() { return Object.assign(farm.init(), { plots: Array(18).fill(null) }) }
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
  return { find, all, sent, app, dom, shops: () => all('data-farm-overlay').filter(node => node.getAttribute('data-farm-overlay') === 'shop').length, text: () => dom.body.allText() }
}
const plain = value => JSON.parse(JSON.stringify(value))

test('小农场：6 块地；点空地种手里的种子，没种子去商店；有大农场入口就显示', () => {
  const data = establishedFarm()
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
  const data = establishedFarm()
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
  const data = establishedFarm()
  const t = api()
  farm.actions.unlock(data, { plot: 6 }, t)
  const ui = renderFarm(farm.view(data, t))
  assert.match(ui.text(), /另外 1 块地：1 块要照料，1 块空着/)
})

test('大农场：18 块地，荒地点一下开垦；工具拿在手里点地；锁着的一键工具去商店', () => {
  const data = establishedFarm()
  const t = api()
  farm.actions.buy(data, { item: 'radish' }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  t.now = T0 + Math.round(Math.LN2 * PEST_MS)
  let closed = 0
  const ui = renderFarm(farm.view(data, t), 'big', { closeBig() { closed += 1 } })
  assert.equal(ui.all('data-farm-plot').length, 18)
  assert.equal(ui.dom.body.querySelectorAll('.fm-hit').length, 18, '菱形透明角不拦邻地点击')
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

test('大农场：铁锹铲正在长的作物要确认；仓库弹层能全卖', () => {
  const data = establishedFarm()
  const t = api()
  farm.actions.buy(data, { item: 'radish' }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  data.harvest.radish = 10
  const ui = renderFarm(farm.view(data, t), 'big')
  ui.find('data-farm-tool', 'shovel').fire('click')
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(ui.sent.length, 0)
  ui.find('data-farm-confirm', 'true').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'clear', payload: { plot: 0, force: true } })
  ui.find('data-farm-panel', 'stock').fire('click')
  ui.find('data-farm-sell-everything', 'true').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'sell', payload: { item: '*' } })
})

test('包袱：点击格子拿种子可连续播种；移开收起，用完回手套；空地显示淡影', () => {
  const data = establishedFarm(), t = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  const ui = renderFarm(farm.view(data, t), 'big', { asset: name => '/assets/' + name })
  ui.find('data-farm-tool', 'seedbag').fire('click')
  ui.find('data-farm-seed', 'radish').fire('click')
  assert.equal(ui.find('data-farm-seed', 'radish').getAttribute('aria-pressed'), 'true')
  assert.ok(ui.dom.body.querySelectorAll('.fm-ghost').length)
  ui.find('data-farm-plot', '0').fire('click')
  ui.find('data-farm-plot', '1').fire('click')
  assert.deepEqual(plain(ui.sent.map(action => action.payload.plot)), [0, 1])
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, t)
  ui.app.data = farm.view(data, t); ui.app.rerender()
  assert.equal(ui.find('data-farm-tool', 'gloves').getAttribute('aria-pressed'), 'true')
  ui.find('data-farm-overlay', 'seeds').fire('mouseleave')
  assert.equal(ui.find('data-farm-overlay', 'seeds'), undefined)
  ui.find('data-farm-tool', 'seedbag').fire('click')
  ui.dom.body.querySelectorAll('.fm-big')[0].fire('click', { target: { closest: () => null } })
  assert.equal(ui.find('data-farm-overlay', 'seeds'), undefined, '点击空白处收起')
})

test('商店：四标签、可买排前、等级或余额提示；购买数量 1～99 总价联动，走 buy', () => {
  const data = establishedFarm(), t = api(1000)
  const ui = renderFarm(farm.view(data, t), 'big')
  ui.find('data-farm-shop', 'shelf').fire('click')
  assert.equal(ui.all('data-farm-tab').length, 4)
  const items = ui.all('data-farm-item')
  assert.equal(items[0].getAttribute('aria-disabled'), 'false')
  assert.match(ui.text(), /需要 2 级/)
  ui.find('data-farm-item', 'radish').fire('click')
  assert.match(ui.text(), /成熟时间.*14 小时.*预计收入.*432 菜币/)
  ui.find('data-farm-quantity', 'plus').fire('click')
  assert.ok(ui.find('data-farm-total', '160'))
  ui.find('aria-label', '数量').value = '1000'; ui.find('aria-label', '数量').fire('change')
  assert.ok(ui.find('data-farm-total', '7920')); assert.equal(ui.find('data-farm-quantity', 'plus').disabled, true)
  assert.equal(ui.find('data-farm-confirm', 'true').disabled, true, '总价超过余额不能购买')
  ui.find('aria-label', '数量').value = '0'; ui.find('aria-label', '数量').fire('change')
  assert.ok(ui.find('data-farm-total', '80')); assert.equal(ui.find('data-farm-quantity', 'minus').disabled, true)
  ui.find('data-farm-quantity', 'plus').fire('click')
  ui.find('data-farm-confirm', 'true').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'buy', payload: { item: 'radish', count: 2 } })
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  ui.app.data = farm.view(data, t); ui.app.rerender()
  assert.match(ui.text(), /购买成功！白萝卜种子 ×2，花费 160 菜币/)
  for (const tab of ['tool', 'fert', 'helper']) { ui.find('data-farm-tab', tab).fire('click'); assert.ok(ui.all('data-farm-item').length) }
  assert.match(ui.text(), /菜币不足/)
})

test('大农场：Q/W/E/R 切换工具；输入框不响应；悬停卡与三种气泡', () => {
  const data = establishedFarm(), t = api()
  farm.actions.buy(data, { item: 'radish' }, t); farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  data.plots[0].pests = { dry: T0, weed: T0, bug: T0 }
  const ui = renderFarm(farm.view(data, t), 'big')
  ui.dom.body.querySelector = selector => ui.dom.body.querySelectorAll(selector)[0] || null
  const key = (value, tag = 'BODY') => ui.dom.documentListeners.keydown.forEach(fn => fn({ key: value, target: { tagName: tag }, preventDefault() {} }))
  for (const [shortcut, tool] of [['q', 'can'], ['w', 'weedkiller'], ['e', 'pesticide'], ['r', 'gloves']]) { key(shortcut); assert.equal(ui.find('data-farm-tool', tool).getAttribute('aria-pressed'), 'true') }
  key('q', 'INPUT'); assert.equal(ui.find('data-farm-tool', 'gloves').getAttribute('aria-pressed'), 'true')
  const plot = ui.find('data-farm-plot', '0')
  plot.fire('mouseenter'); assert.ok(ui.find('data-farm-card', '0'))
  assert.equal(ui.all('data-farm-bubble').length, 3)
  plot.fire('mouseleave'); assert.equal(ui.find('data-farm-card', '0'), undefined)
})

test('小农场：信息栏在场景外，主操作绿框，包袱和仓库为覆盖层，荒地要先照料', () => {
  const data = farm.init(), t = api()
  const ui = renderFarm(farm.view(data, t), 'panel', { asset: name => '/assets/' + name })
  const header = ui.dom.body.querySelectorAll('.fm-s-header')[0]
  assert.equal(header.parentNode.className, 'fm')
  assert.equal(ui.find('data-farm-main', 'care').getAttribute('data-farm-main'), 'care')
  assert.ok(ui.find('data-farm-next', 'true'))
  ui.find('data-farm-panel', 'seeds').fire('click')
  assert.equal(ui.find('data-farm-overlay', 'seeds').parentNode.className, 'fm')
  ui.find('data-farm-panel', 'stock').fire('click')
  assert.equal(ui.find('data-farm-overlay', 'stock').parentNode.className, 'fm')
  assert.ok(ui.find('data-farm-exchange', 'open'))
})

// 窗口叠放由原有布局负责，台词只移动自己，不改变面板与状态条尺寸。
test('独立猪窗口开面板时，台词跟签到一样放在猪旁边，避免覆盖另一个窗口底栏', () => {
  const css = readFileSync(new URL('../src/client/css-tabs.js', import.meta.url), 'utf8')
  assert.match(css, /data-panel-open="true"\] \.dp-bubble\{right:calc\(100% \+ 6px\)/)
  assert.doesNotMatch(css, /data-daily-side="right"\] \.dp-bubble\{right:auto;left:calc\(100% \+ 6px\)/)
})

test('大小农场：灾害只显示气泡，保留单个收获提示；包袱工具不挂在地上', () => {
  const data = establishedFarm(), t = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, t)
  data.plots[0].pests = { dry: T0, weed: T0, bug: T0 }
  data.plots[1].plantedAt -= 14 * H
  data.plots[1].pests = { dry: 1e15, weed: 1e15, bug: 1e15 }
  for (const mode of ['panel', 'big']) {
    const ui = renderFarm(farm.view(data, t), mode)
    const afflicted = ui.find('data-farm-plot', '0')
    assert.equal(afflicted.querySelectorAll('.fm-chip').length, 0, '已有三种气泡，不再画灾害文字条')
    assert.equal(afflicted.querySelectorAll('.fm-bubble').length, 3)
    assert.equal(ui.find('data-farm-plot', '1').querySelectorAll('.fm-chip').length, 1, '收获提示只留一项')
    if (mode === 'panel') {
      assert.equal(ui.find('data-farm-panel', 'seeds').parentNode.className, 'fm-s-tools')
      ui.find('data-farm-panel', 'seeds').fire('click')
      assert.ok(ui.find('data-farm-overlay', 'seeds'))
    }
  }
})

test('经验条使用 levelOf 的当前等级进度：六级零经验、半满及升级后归零', () => {
  const data = establishedFarm(), t = api()
  for (const [total, level, exp, need, width] of [[1500, 6, 0, 600, '0%'], [1800, 6, 300, 600, '45%'], [2100, 7, 0, 700, '0%']]) {
    data.exp = total
    const view = farm.view(data, t)
    assert.deepEqual([view.level, view.exp, view.need], [level, exp, need])
    for (const mode of ['panel', 'big']) {
      const ui = renderFarm(view, mode)
      const bar = ui.dom.body.querySelectorAll('.fm-exp')[0]
      assert.equal(bar.getAttribute('title'), '经验 ' + exp + ' / ' + need)
      assert.equal(bar.children[0].style.width, width)
    }
  }
})

test('小农场紧凑布局按宿主可用高度决定，不随面板自身内容高度切换', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()))
  const panel = { style: { maxHeight: '400px' } }
  ui.app.content.closest = selector => selector === '.dp-card' ? panel : null
  ui.app.rerender()
  assert.ok(ui.find('data-farm-compact', 'true'))
  panel.style.maxHeight = '485px'
  ui.app.rerender()
  assert.equal(ui.find('data-farm-compact', 'true'), undefined)
})
