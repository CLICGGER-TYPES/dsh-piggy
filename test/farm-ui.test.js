// 菜园 4.0 的两种界面：小农场（面板）和大农场（大窗口）。用 fakeDom 跑扩展的 client.js。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test, beforeEach } from 'node:test'

import farm, { PEST_MS, setRandom } from '../extensions/farm/server.js'

import { establishedFarm, api, renderFarm, plain, H, T0 } from './helpers/farm-ui.js'
function openTools(ui) {
  const toggle = ui.find('data-farm-tools', 'toggle')
  if (toggle.getAttribute('aria-expanded') !== 'true') toggle.fire('click')
}
function toolNode(ui, key) {
  if (!ui.find('data-farm-tool', key)) openTools(ui)
  return ui.find('data-farm-tool', key)
}
function chooseTool(ui, key) { openTools(ui); toolNode(ui, key).fire('click') }
function advancedText(ui) { openTools(ui); return ui.text() }

beforeEach(() => setRandom(() => 0.5))

test('小农场：6 块地；保留标题且大农场在菜币左边；没种子不放大号买种子按钮，走真实商店入口', () => {
  const data = establishedFarm()
  const t = api()
  let ui = renderFarm(farm.view(data, t), 'panel', { openBig() {} })
  assert.equal(ui.all('data-farm-plot').length, 6)
  const header = ui.dom.body.querySelectorAll('.fm-s-header')[0]
  const classes = header.children.map(node => node.className)
  const titleAt = classes.findIndex(name => /\bfm-garden-title\b/.test(name))
  const bigAt = classes.findIndex(name => /\bfm-big-open\b/.test(name))
  const coinAt = classes.findIndex(name => /\bfm-coin\b/.test(name))
  assert.equal(titleAt, 0, '大农场入口不能替换标题')
  assert.ok(bigAt > titleAt && coinAt > bigAt, '大农场入口保留在菜币左边')
  assert.equal(header.children[titleAt].textContent, '菜园')
  assert.equal(ui.find('data-farm-main', 'shop'), undefined, '普通详情不再放大号买种子主按钮')
  assert.equal(ui.find('data-farm-main', 'idle'), undefined, '没有有效操作就不显示无用主按钮')
  assert.match(ui.find('data-farm-detail', '0').allText(), /去商店买/, '状态与条件文本保留')
  ui.find('data-farm-shop', 'shelf').fire('click')
  assert.equal(ui.shops(), 1)
  ui.find('data-farm-back', 'true').fire('click')
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  ui = renderFarm(farm.view(data, t))
  assert.equal(ui.find('data-farm-big', 'open'), undefined, 'old hosts have no big window')
  ui.find('data-farm-main', 'plant').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'plant', payload: { plot: 0, item: 'radish' } })
})

test('小农场：主按钮按 收 > 照料 > 铲 > 种 的顺序做一块；买了一键工具也只照料一块', () => {
  const data = establishedFarm()
  const t = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, t)
  t.now = T0 + Math.round(Math.LN2 * PEST_MS)
  let ui = renderFarm(farm.view(data, t))
  ui.find('data-farm-main', 'care').fire('click')
  assert.equal(ui.sent.length, 1)
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'care', payload: { plot: 0, kind: 'weed' } })
  farm.actions.buy(data, { item: 'sprayer' }, t)
  ui = renderFarm(farm.view(data, t))
  ui.find('data-farm-main', 'care').fire('click')
  assert.equal(ui.sent.length, 1)
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
  assert.equal(ui.dom.body.querySelectorAll('.fm-hit').length, 0, '平面地块本身命中，不保留旧菱形透明覆盖层')
  ui.find('data-farm-reclaim', '6').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'unlock', payload: { plot: 6 } })
  ui.find('data-farm-plot', '7').fire('click')
  assert.equal(ui.sent.length, 1, 'only the next wild plot can be reclaimed')
  chooseTool(ui, 'weedkiller')
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'care', payload: { plot: 0, kind: 'weed' } })
  chooseTool(ui, 'sickle')
  assert.equal(ui.shops(), 1)
  ui.find('data-farm-big', 'close').fire('click')
  assert.equal(closed, 1)
})

test('大农场帮工牌说实话：没种子写「帮工没种子」，缺某种种子写清哪种，真在干活才写 N 块地', () => {
  const data = establishedFarm(), t = api()
  farm.actions.hire(data, {}, t)
  const badge = () => advancedText(renderFarm(farm.view(data, t), 'big'))
  assert.match(badge(), /帮工没种子/)
  data.helper.targets[0] = 'radish'
  assert.match(badge(), /缺白萝卜种子/)
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  assert.match(badge(), /帮工 · 4 块地/)
})

test('大农场帮工牌：帮工仓库有货就先说有货，不被「缺种子」顶掉', () => {
  const data = establishedFarm(), t = api()
  farm.actions.hire(data, {}, t)
  data.helper.targets[0] = 'radish'
  farm.actions.buy(data, { item: 'radish', count: 1 }, t) // 只有一颗，种下就用光
  t.now = T0 + 14 * H // 自然成熟才收进帮工仓库
  const helper = farm.view(data, t).helper
  assert.ok(helper.stored > 0, '帮工仓库有货：' + helper.stored)
  assert.ok(helper.missing.length > 0 || helper.seedless, '同时也在缺种子')
  assert.match(advancedText(renderFarm(farm.view(data, t), 'big')), /帮工收了 \d+ 个/)
})

test('大农场：铁锹铲正在长的作物要确认；仓库弹层能全卖', () => {
  const data = establishedFarm()
  const t = api()
  farm.actions.buy(data, { item: 'radish' }, t)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  data.harvest.radish = 10
  const ui = renderFarm(farm.view(data, t), 'big')
  chooseTool(ui, 'shovel')
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(ui.sent.length, 0)
  ui.find('data-farm-confirm', 'true').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'clear', payload: { plot: 0, force: true } })
  ui.find('data-farm-bag', 'open').fire('click')
  ui.find('data-farm-bag-tab', 'crop').fire('click')
  ui.find('data-farm-sell-everything', 'true').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'sell', payload: { item: '*' } })
})

test('种子袋：点击格子拿种子可连续播种；选完收起，用完回手套；空地显示淡影', () => {
  const data = establishedFarm(), t = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  const ui = renderFarm(farm.view(data, t), 'big', { asset: name => '/assets/' + name })
  chooseTool(ui, 'seedbag')
  ui.find('data-farm-seed', 'radish').fire('click')
  assert.equal(ui.find('data-farm-overlay', 'seeds'), undefined)
  assert.ok(ui.dom.body.querySelectorAll('.fm-ghost').length)
  ui.find('data-farm-plot', '0').fire('click')
  ui.find('data-farm-plot', '1').fire('click')
  assert.deepEqual(plain(ui.sent.map(action => action.payload.plot)), [0, 1])
  farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, t)
  ui.app.data = farm.view(data, t); ui.app.rerender()
  openTools(ui)
  assert.equal(ui.find('data-farm-tool', 'gloves').getAttribute('aria-pressed'), 'true')
  ui.find('data-farm-tools', 'toggle').fire('click')
  assert.equal(ui.find('data-farm-overlay', 'seeds'), undefined)
  chooseTool(ui, 'seedbag')
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

test('大农场：Q/W/E/R 切换工具；输入框不响应；三种灾害气泡仍可见', () => {
  const data = establishedFarm(), t = api()
  farm.actions.buy(data, { item: 'radish' }, t); farm.actions.plant(data, { plot: 0, item: 'radish' }, t)
  data.plots[0].pests = { dry: T0, weed: T0, bug: T0 }
  const ui = renderFarm(farm.view(data, t), 'big')
  openTools(ui)
  ui.dom.body.querySelector = selector => ui.dom.body.querySelectorAll(selector)[0] || null
  const key = (value, tag = 'BODY') => ui.dom.documentListeners.keydown.forEach(fn => fn({ key: value, target: { tagName: tag }, preventDefault() {} }))
  for (const [shortcut, tool] of [['q', 'can'], ['w', 'weedkiller'], ['e', 'pesticide'], ['r', 'gloves']]) { key(shortcut); assert.equal(toolNode(ui, tool).getAttribute('aria-pressed'), 'true') }
  key('q', 'INPUT'); assert.equal(ui.find('data-farm-tool', 'gloves').getAttribute('aria-pressed'), 'true')
  assert.equal(ui.all('data-farm-bubble').length, 3)
  ui.find('data-farm-plot', '0').fire('mouseleave')
})

test('小农场：第一课在地块里，信息栏和进度在场景外，工具抽屉与背包仍可到达', () => {
  const data = farm.init(), t = api()
  const ui = renderFarm(farm.view(data, t), 'panel', { asset: name => '/assets/' + name, openBig() {} })
  const header = ui.dom.body.querySelectorAll('.fm-s-header')[0]
  assert.equal(header.parentNode.className, 'fm')
  assert.equal(ui.find('data-farm-main', 'onboarding').getAttribute('data-farm-main'), 'onboarding')
  assert.ok(ui.find('data-farm-lesson-plot', 'true'))
  assert.ok(ui.find('data-farm-progress', '0'))
  ui.find('data-farm-bag', 'open').fire('click')
  assert.equal(ui.find('data-farm-overlay', 'bag').parentNode.className, 'fm')
  assert.equal(ui.all('data-farm-back').length, 1, '背包子页只有一个返回')
  ui.find('data-farm-back', 'true').fire('click')
  openTools(ui)
  assert.equal(ui.find('data-farm-tools', 'toggle').getAttribute('aria-expanded'), 'true')
  assert.ok(ui.find('data-farm-helper', 'hire'))
  assert.ok(ui.find('data-farm-big', 'open'))
  ui.find('data-farm-weather', 'info').fire('click')
  assert.match(ui.text(), /天气/)
  assert.ok(ui.find('data-farm-tool', 'gloves').querySelectorAll('.fm-tool-label')[0].textContent)
  assert.ok(ui.find('data-farm-coin', 'open'))
})

// 窗口层级保证现有对话可见，开关菜单不重新定位或缩窄对话。
test('独立猪窗口开面板时，对话保持头顶位置与宽度', () => {
  const css = readFileSync(new URL('../src/client/css-tabs.js', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /data-panel-open="true"\] \.dp-bubble\{/)
  assert.doesNotMatch(css, /data-daily-side="right"\] \.dp-bubble\{right:auto;left:calc\(100% \+ 6px\)/)
})

test('大小农场：灾害只显示气泡，保留单个收获提示；种子袋工具不挂在地上', () => {
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
      ui.find('data-farm-tools', 'toggle').fire('click')
      assert.equal(ui.find('data-farm-tool', 'seedbag').parentNode.className, 'fm-advanced-grid')
      ui.find('data-farm-tool', 'seedbag').fire('click')
      assert.ok(ui.find('data-farm-overlay', 'bag'))
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
      if (mode === 'panel') openTools(ui)
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

test('fix3：手套只收成熟作物，主按钮直接照料一块，拥有喷雾桶也不自动批量', () => {
  const data = establishedFarm(), t = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, t)
  for (const plot of [0, 1]) farm.actions.plant(data, { plot, item: 'radish' }, t)
  for (const plot of data.plots.filter(Boolean)) plot.pests = { dry: T0, weed: T0, bug: T0 }
  farm.actions.buy(data, { item: 'sprayer' }, t)
  const ui = renderFarm(farm.view(data, t))
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(ui.sent.length, 0)
  ui.find('data-farm-main', 'care').fire('click')
  assert.equal(ui.sent.length, 1)
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
  assert.equal(ui.find('data-farm-exchange', 'open'), undefined, '顶栏不再堆换菜币按钮')
  ui.find('data-farm-weather', 'info').fire('click')
  assert.match(ui.text(), /天气/)
  const source = readFileSync(new URL('../extensions/farm/client.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /fm-b-field|fm-hit/)
})

test('fix3：三种照料工具一次只请求一种灾害、一个地块；手套不铲不种', () => {
  const data = establishedFarm(), t = api()
  farm.actions.buy(data, { item: 'radish', count: 3 }, t)
  for (const plot of [0, 1]) farm.actions.plant(data, { plot, item: 'radish' }, t)
  for (const plot of data.plots.filter(Boolean)) plot.pests = { dry: T0, weed: T0, bug: T0 }
  for (const [tool, kind] of [['can', 'dry'], ['weedkiller', 'weed'], ['pesticide', 'bug']]) {
    const ui = renderFarm(farm.view(data, t), 'big')
    chooseTool(ui, tool)
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

test('fix3：工具提示跟随移动，点击后收起抽屉；R只拿手套，Esc关闭当前弹层', () => {
  const ui = renderFarm(farm.view(farm.init(), api()), 'big')
  openTools(ui)
  let tool = ui.find('data-farm-tool', 'can')
  tool.fire('mousemove')
  assert.equal(tool.getAttribute('data-farm-hover'), 'true')
  tool.fire('click')
  assert.equal(tool.getAttribute('data-farm-hover'), null)
  assert.equal(ui.find('data-farm-drawer', 'tools'), undefined, '选好工具就收起抽屉回菜地')
  openTools(ui)
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

test('大小农场共用平面地块，扩展视图保留18块及真实开垦入口', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  assert.equal(ui.all('data-farm-plot').length, 18)
  assert.equal(ui.find('data-farm-grid', 'expanded').className, 'fm-s-field')
  assert.ok(ui.find('data-farm-reclaim', '6'))
  for (const plot of ui.all('data-farm-plot')) {
    assert.equal(plot.style.translate, undefined, '不使用旧菱形的逐格位移')
    assert.equal(plot.style.left, undefined)
  }
})

test('大小农场有效快捷操作是详情末行的小 dp-mini，工具是 40px 图片加文字的标准次按钮', () => {
  for (const mode of ['panel', 'big']) {
    const data = establishedFarm(), t = api()
    farm.actions.buy(data, { item: 'radish' }, t)
    const ui = renderFarm(farm.view(data, t), mode, { asset: name => '/assets/' + name })
    const main = ui.find('data-farm-main', 'plant')
    assert.match(main.className, /\bdp-mini\b/)
    assert.equal(main.parentNode.className, 'fm-s-acts', '有效快捷操作只占详情末行')
    assert.equal(main.parentNode.parentNode, ui.find('data-farm-detail', '0'))
    openTools(ui)
    for (const tool of ui.all('data-farm-tool')) {
      assert.match(tool.className, /\bdp-btn\b/)
      assert.doesNotMatch(tool.className, /\bdp-mini\b/)
      assert.ok(tool.allText().trim(), '工具按钮必须带文字标签')
      assert.equal(tool.querySelectorAll('img').length, 1, '工具入口同时带图片内容')
      assert.equal(tool.style.backgroundImage, undefined, '图片是工具内容，不是整颗按钮')
    }
    const css = ui.dom.head.children[0].textContent
    assert.match(css, /\.fm \.fm-slot>img\{width:40px;height:40px/)
    assert.match(css, /\.fm-dock-btn>img\{width:40px;height:40px\}/)
  }
})

test('fix3：更新扩展后替换旧样式，不能让旧的hover规则继续覆盖新行为', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  const style = ui.dom.head.children[0]
  style.textContent = '.fm-plot:hover .fm-hover{opacity:1}'
  ui.app.rerender()
  assert.equal(ui.dom.head.children.length, 1)
  assert.doesNotMatch(style.textContent, /\.fm-plot:hover \.fm-hover/)
  assert.match(style.textContent, /data-farm-target/)
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
  chooseTool(ui, 'seedbag')
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
  chooseTool(ui, 'seedbag')
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

test('fix3：大小农场商店只留一个返回入口，钱包保持一组，不再叠关闭叉', () => {
  for (const mode of ['big', 'panel']) {
    const ui = renderFarm(farm.view(establishedFarm(), api()), mode)
    ui.find('data-farm-shop', 'shelf').fire('click')
    assert.equal(ui.all('data-farm-back').length, 1, '子页只有一个返回')
    assert.equal(ui.all('data-farm-close').length, 0, '不再有第二个关闭入口')
    assert.equal(ui.dom.body.querySelectorAll('.fm-shop-wallet').length, 1)
    ui.find('data-farm-back', 'true').fire('click')
    assert.equal(ui.find('data-farm-overlay', 'shop'), undefined)
    assert.equal(ui.find('data-farm-shop', 'shelf').getAttribute('data-farm-shop'), 'shelf', '返回菜地')
  }
})

test('帮工入口在工具抽屉里，大农场入口在顶栏：都用次按钮而非两颗主按钮', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'panel', { openBig() {} })
  const entry = ui.find('data-farm-big', 'open')
  assert.match(entry.className, /\bdp-btn\b/)
  assert.doesNotMatch(entry.className, /\bdp-mini\b/)
  openTools(ui)
  const helper = ui.find('data-farm-helper', 'hire')
  assert.match(helper.className, /\bdp-btn\b/)
  assert.doesNotMatch(helper.className, /\bdp-mini\b/)
  assert.equal(helper.querySelectorAll('img').length, 0)
})

test('大小农场切换不再各自计算几何：均使用共享场景和网格', () => {
  const view = farm.view(establishedFarm(), api())
  const small = renderFarm(view), large = renderFarm(view, 'big')
  assert.equal(small.dom.body.querySelectorAll('.fm-s-scene').length, 1)
  assert.equal(large.dom.body.querySelectorAll('.fm-s-scene').length, 1)
  assert.equal(large.dom.body.querySelectorAll('.fm-b-scene').length, 0)
  assert.equal(small.all('data-farm-plot').length, 6)
  assert.equal(large.all('data-farm-plot').length, 18)
})
