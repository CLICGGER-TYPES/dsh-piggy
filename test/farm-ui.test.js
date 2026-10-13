// 菜园 4.0 的两种界面：小农场（面板）和大农场（大窗口）。用 fakeDom 跑扩展的 client.js。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test, beforeEach } from 'node:test'

import farm, { PEST_MS, setRandom } from '../extensions/farm/server.js'

import { establishedFarm, api, renderFarm, plain, H, T0 } from './helpers/farm-ui.js'
beforeEach(() => setRandom(() => 0.5))

test('小农场：6 块地；点空地种手里的种子，没种子去商店；有大农场入口就显示', () => {
  const data = establishedFarm()
  const t = api()
  let ui = renderFarm(farm.view(data, t), 'panel', { openBig() {} })
  assert.equal(ui.all('data-farm-plot').length, 6)
  assert.ok(ui.find('data-farm-big', 'open'))
  ui.find('data-farm-main', 'shop').fire('click')
  assert.equal(ui.shops(), 1)
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  ui = renderFarm(farm.view(data, t))
  assert.equal(ui.find('data-farm-big', 'open'), undefined, 'old hosts have no big window')
  ui.find('data-farm-main', 'plant').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'plant', payload: { plot: 0, item: 'radish' } })
})

test('小农场：主按钮按 收 > 照料 > 铲 > 种 的顺序做一块；买了一键工具也只选工具', () => {
  const data = establishedFarm()
  const t = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, t)
  t.now = T0 + Math.round(Math.LN2 * PEST_MS)
  let ui = renderFarm(farm.view(data, t))
  ui.find('data-farm-main', 'care').fire('click')
  assert.equal(ui.sent.length, 0)
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'care', payload: { plot: 0, kind: 'weed' } })
  farm.actions.buy(data, { item: 'sprayer' }, t)
  ui = renderFarm(farm.view(data, t))
  ui.find('data-farm-main', 'care').fire('click')
  assert.equal(ui.sent.length, 0)
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
  ui.find('data-farm-reclaim', '6').fire('click')
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

test('fix3：手套只收成熟作物，主按钮只选照料工具，拥有喷雾桶也不自动批量', () => {
  const data = establishedFarm(), t = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  for (const plot of [0, 1]) farm.actions.plant(data, { plot, item: 'radish' }, t)
  for (const plot of data.plots.filter(Boolean)) plot.pests = { dry: T0, weed: T0, bug: T0 }
  farm.actions.buy(data, { item: 'sprayer' }, t)
  const ui = renderFarm(farm.view(data, t))
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(ui.sent.length, 0)
  ui.find('data-farm-main', 'care').fire('click')
  assert.equal(ui.sent.length, 0)
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent), [{ op: 'care', payload: { plot: 0, kind: 'weed' } }])
})

test('fix3：大农场悬停框不借下一步标记常亮，点击与重绘不保留 hover', () => {
  const source = readFileSync(new URL('../extensions/farm/client.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /(?<!\.fm-s-field )\.fm-plot\[data-farm-next="true"\] \.fm-hover/)
  assert.doesNotMatch(source, /\.fm-plot:hover \.fm-hover/)
  assert.match(source, /data-farm-hover/)
})

test('fix3：等级与天气有提示，田地层不截获顶部信息牌空白区域', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  ui.find('data-farm-level', 'info').fire('click')
  assert.match(ui.text(), /经验/)
  ui.find('data-farm-weather', 'info').fire('click')
  assert.match(ui.text(), /天气/)
  const source = readFileSync(new URL('../extensions/farm/client.js', import.meta.url), 'utf8')
  assert.match(source, /\.fm-b-field\{[^}]*pointer-events:none/)
})

test('fix3：三种照料工具一次只请求一种灾害、一个地块；手套不铲不种', () => {
  const data = establishedFarm(), t = api()
  farm.actions.buy(data, { item: 'radish', count: 3 }, t)
  for (const plot of [0, 1]) farm.actions.plant(data, { plot, item: 'radish' }, t)
  for (const plot of data.plots.filter(Boolean)) plot.pests = { dry: T0, weed: T0, bug: T0 }
  for (const [tool, kind] of [['can', 'dry'], ['weedkiller', 'weed'], ['pesticide', 'bug']]) {
    const ui = renderFarm(farm.view(data, t), 'big')
    ui.find('data-farm-tool', tool).fire('click')
    ui.find('data-farm-plot', '0').fire('click')
    assert.deepEqual(plain(ui.sent), [{ op: 'care', payload: { plot: 0, kind } }])
    const before = structuredClone(data)
    farm.actions.care(data, { plot: 0, kind }, t)
    assert.deepEqual(data.plots[1], before.plots[1])
    data.plots[0].pests = { dry: T0, weed: T0, bug: T0 }
  }
  data.plots[2] = { wild: false, stubble: true, dry: true, weed: true }
  for (const plot of [2, 3]) {
    const ui = renderFarm(farm.view(data, t), 'big')
    ui.find('data-farm-plot', String(plot)).fire('click')
    assert.equal(ui.sent.length, 0)
  }
})

test('fix3：大农场绿框只在移动时出现，点击、离开、重绘会清空', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  let plot = ui.find('data-farm-plot', '0')
  plot.fire('mousemove')
  assert.equal(plot.getAttribute('data-farm-hover'), 'true')
  plot.fire('mouseleave')
  assert.equal(plot.getAttribute('data-farm-hover'), null)
  plot.fire('mousemove')
  plot.fire('click')
  assert.equal(plot.getAttribute('data-farm-hover'), null)
  plot = ui.find('data-farm-plot', '0')
  plot.fire('mousemove')
  ui.app.rerender()
  assert.equal(ui.find('data-farm-plot', '0').getAttribute('data-farm-hover'), null)
})

test('fix3：工具提示跟随移动，点击后清除；R只拿手套，Esc关闭当前弹层', () => {
  const ui = renderFarm(farm.view(farm.init(), api()), 'big')
  let tool = ui.find('data-farm-tool', 'can')
  tool.fire('mousemove')
  assert.equal(tool.getAttribute('data-farm-hover'), 'true')
  tool.fire('click')
  assert.equal(tool.getAttribute('data-farm-hover'), null)
  tool = ui.find('data-farm-tool', 'can')
  assert.equal(tool.getAttribute('data-farm-hover'), null)
  ui.app.content.querySelector = selector => ui.app.content.querySelectorAll(selector)[0] || null
  const keydown = event => ui.dom.documentListeners.keydown.forEach(fn => fn({ target: { tagName: 'BODY' }, preventDefault() {}, ...event }))
  keydown({ key: 'r' })
  assert.equal(ui.find('data-farm-tool', 'gloves').getAttribute('aria-pressed'), 'true')
  assert.equal(ui.sent.length, 0)
  ui.find('data-farm-shop', 'shelf').fire('click')
  assert.ok(ui.find('data-farm-overlay', 'shop'))
  keydown({ key: 'Escape' })
  assert.equal(ui.find('data-farm-overlay', 'shop'), undefined)
})

test('fix3追加：18块地同尺寸、相邻只共边，整个网格位于中央空地', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  const plots = ui.all('data-farm-plot').map(node => {
    const w = parseFloat(node.style.width), h = parseFloat(node.style.height)
    const [dx, dy] = (node.style.translate || '0% 0%').split(' ').map(parseFloat)
    return { x: parseFloat(node.style.left) + dx * w / 100, y: parseFloat(node.style.top) + dy * h / 100, w, h }
  })
  assert.equal(plots.length, 18)
  for (const p of plots) {
    assert.ok(Number.isFinite(p.w) && Number.isFinite(p.h), '尺寸随地块坐标从同一份几何配置生成')
    assert.equal(p.w, plots[0].w)
    assert.equal(p.h, plots[0].h)
    assert.ok(p.x >= 20 && p.x + p.w <= 82 && p.y >= 25 && p.y + p.h <= 83, '不压水边、上方道路或工具栏')
  }
  for (let i = 0; i < plots.length; i += 1) {
    for (let j = i + 1; j < plots.length; j += 1) {
      const a = plots[i], b = plots[j]
      const separation = Math.abs(a.x - b.x) / (a.w / 2) + Math.abs(a.y - b.y) / (a.h / 2)
      assert.ok(separation >= 2 - 1e-9, '菱形内部不得相交：' + i + '/' + j)
    }
  }
  assert.ok(Math.abs(plots[3].x - plots[0].x - plots[0].w / 2) < 1e-9)
  assert.ok(Math.abs(plots[3].y - plots[0].y - plots[0].h / 2) < 1e-9)
})

test('fix3追加：进度条和开垦标签位于菱形内部，工具字号至少12px且角标不盖图', () => {
  const source = readFileSync(new URL('../extensions/farm/client.js', import.meta.url), 'utf8')
  assert.match(source, /\.fm-b-field \.fm-prog\{left:35%;right:35%;bottom:28%/)
  assert.match(source, /\.fm-b-field \.fm-chip\{[^}]*bottom:2%/)
  assert.match(source, /\.fm-b-bar \.fm-tool-label\{[^}]*font-size:clamp\(12px,/)
  assert.match(source, /\.fm-b-bar \.fm-n,\.fm-b-bar \.fm-lock\{[^}]*top:-13px/)
  assert.match(source, /\.fm-big\{[^}]*background:[^}]*\/cover/)
})

test('fix3：更新扩展后替换旧样式，不能让旧的hover规则继续覆盖新行为', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  const style = ui.dom.head.children[0]
  style.textContent = '.fm-plot:hover .fm-hover{opacity:1}'
  ui.app.rerender()
  assert.equal(ui.dom.head.children.length, 1)
  assert.doesNotMatch(style.textContent, /\.fm-plot:hover \.fm-hover/)
  assert.match(style.textContent, /data-farm-hover/)
})

test('fix3：手套不直接开垦，只有明确点击开垦牌才操作；种子不收成熟菜', () => {
  const data = establishedFarm(), t = api()
  let ui = renderFarm(farm.view(data, t), 'big')
  ui.find('data-farm-plot', '6').fire('click')
  assert.equal(ui.sent.length, 0)
  ui.find('data-farm-reclaim', '6').fire('click')
  assert.deepEqual(plain(ui.sent), [{ op: 'unlock', payload: { plot: 6 } }])
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  t.now += 14 * H
  ui = renderFarm(farm.view(data, t), 'big')
  ui.find('data-farm-tool', 'seedbag').fire('click')
  ui.find('data-farm-seed', 'radish').fire('click')
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(ui.sent.length, 0)
})

test('fix3：种子工具点成熟作物不收获', () => {
  const data = establishedFarm(), t = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  t.now += 14 * H
  const ui = renderFarm(farm.view(data, t), 'big')
  ui.find('data-farm-tool', 'seedbag').fire('click')
  ui.find('data-farm-seed', 'radish').fire('click')
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(ui.sent.length, 0)
})
test('fix3：Esc只关闭当前购买框，点遮罩取消不向下冒泡关闭商店', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()))
  ui.find('data-farm-shop', 'shelf').fire('click')
  ui.find('data-farm-item', 'radish').fire('click')
  ui.dom.documentListeners.keydown.forEach(fn => fn({ key: 'Escape', target: { tagName: 'BODY' }, preventDefault() {} }))
  assert.equal(ui.dom.body.querySelectorAll('.fm-mask').length, 0)
  assert.ok(ui.find('data-farm-overlay', 'shop'))
  ui.find('data-farm-item', 'radish').fire('click')
  const mask = ui.dom.body.querySelectorAll('.fm-mask')[0]
  let stopped = false
  mask.fire('click', { target: mask, stopPropagation() { stopped = true } })
  assert.equal(stopped, true)
  assert.ok(ui.find('data-farm-overlay', 'shop'))
})

test('fix3：大小农场商店标题都为关闭按钮保留32px，钱包保持一组', () => {
  for (const mode of ['big', 'panel']) {
    const ui = renderFarm(farm.view(establishedFarm(), api()), mode)
    ui.find('data-farm-shop', 'shelf').fire('click')
    const style = ui.dom.head.children[0].textContent
    assert.match(style, /\.fm-shop-head\{[^}]*padding-right:32px/)
    assert.equal(ui.dom.body.querySelectorAll('.fm-shop-wallet').length, 1)
  }
})

test('fix3：最小大农场帮工牌标签保持一行', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  assert.match(ui.dom.head.children[0].textContent, /\.fm-b-helper\{[^}]*white-space:nowrap/)
})

test('fix3：浏览器按1/64px取整后菱形仍共边，不分别取整每块的位置', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  const round = value => Math.floor(value * 64) / 64
  const plots = ui.all('data-farm-plot').map(node => {
    const w = round(1036.5 * parseFloat(node.style.width) / 100)
    const h = round(691 * parseFloat(node.style.height) / 100)
    const [dx, dy] = (node.style.translate || '0% 0%').split(' ').map(parseFloat)
    return { x: round(1036.5 * parseFloat(node.style.left) / 100) + dx * w / 100,
      y: round(691 * parseFloat(node.style.top) / 100) + dy * h / 100, w, h }
  })
  for (let i = 0; i < plots.length; i++) for (let j = i + 1; j < plots.length; j++) {
    const a = plots[i], b = plots[j]
    assert.ok(Math.abs(a.x - b.x) / (a.w / 2) + Math.abs(a.y - b.y) / (a.h / 2) >= 2 - 1e-9, `${i}/${j}`)
  }
})
