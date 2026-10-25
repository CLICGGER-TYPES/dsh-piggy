// 菜园导航返修（用户 2026-10-24 指定布局）的纯逻辑守卫：
// 顶栏单一菜币入口、底部三颗按钮 + 工具抽屉、背包子页数量与真实快照一致、
// 未开垦地块灰暗纸土、大农场宽布局、子页只有一个返回且确认框没有多余关闭叉。
// 全部走 fakeDom 和真实 farm.view/actions，不复制玩法数字，也不代替原生窗口验收。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import farm from '../extensions/farm/server.js'

import { H, T0, api, establishedFarm, plain, renderFarm } from './helpers/farm-ui.js'

const cssOf = ui => ui.dom.head.children[0].textContent
const openTools = ui => { if (ui.find('data-farm-tools', 'toggle').getAttribute('aria-expanded') !== 'true') ui.find('data-farm-tools', 'toggle').fire('click') }
const art = { asset: name => '/assets/' + name, hasAsset: () => true }

test('顶栏：小农场左边大农场入口、右边唯一菜币入口；大农场单一返回 + 同一菜币入口，等级不挤顶栏', () => {
  let ui = renderFarm(farm.view(establishedFarm(), api()), 'panel', { openBig() {} })
  assert.equal(ui.all('data-farm-big').length, 1)
  assert.equal(ui.find('data-farm-big', 'open').getAttribute('data-farm-big'), 'open')
  assert.equal(ui.all('data-farm-coin').length, 1, '菜币只留一个可点入口')
  assert.equal(ui.all('data-farm-exchange').length, 0, '余额和换菜币不再叠在同一处')
  assert.match(ui.find('data-farm-coin', 'open').allText(), /菜币 50000/)
  assert.equal(ui.dom.body.querySelectorAll('.fm-s-header .fm-level').length, 0, '等级经验不在顶栏')
  ui.find('data-farm-coin', 'open').fire('click')
  assert.ok(ui.find('data-farm-overlay', 'wallet'))

  ui = renderFarm(farm.view(establishedFarm(), api()), 'big', { closeBig() {} })
  assert.equal(ui.all('data-farm-big').length, 1)
  assert.equal(ui.find('data-farm-big', 'close').getAttribute('data-farm-big'), 'close')
  assert.equal(ui.all('data-farm-coin').length, 1)
  assert.equal(ui.dom.body.querySelectorAll('.fm-garden-title')[0].textContent, '菜园', '大农场仍保留标题')
  assert.equal(ui.dom.body.querySelectorAll('.fm-s-header .fm-level').length, 0)
  assert.ok(ui.find('data-farm-level', 'info'), '等级放在菜地下方控制区')
})

test('菜币入口打开宿主现有换币页，不自己造汇率', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'panel', { walletContent() { return this.el('div', 'wallet-probe', '换菜币页') } })
  ui.find('data-farm-coin', 'open').fire('click')
  assert.match(ui.text(), /换菜币页/)
  assert.equal(ui.all('data-farm-back').length, 1)
})

test('小农场底部只留三颗同风格图文按钮，工具按钮带 aria-expanded 开合下方抽屉', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'panel', { openBig() {}, asset: name => '/assets/' + name })
  const dock = ui.dom.body.querySelectorAll('.fm-dock')[0]
  assert.equal(dock.children.length, 3)
  assert.deepEqual(dock.children.map(node => node.allText().trim()), ['工具', '背包', '商店'])
  for (const node of dock.children) {
    assert.match(node.className, /\bdp-btn\b/)
    assert.equal(node.querySelectorAll('img').length, 1, '工具入口是图片加文字，不是小纯文字入口')
    assert.ok(node.allText().trim())
  }
  const toggle = ui.find('data-farm-tools', 'toggle')
  assert.equal(toggle.getAttribute('aria-expanded'), 'false')
  assert.equal(toggle.querySelectorAll('img').length, 1)
  assert.match(toggle.allText(), /工具/)
  toggle.fire('click')
  assert.equal(ui.find('data-farm-tools', 'toggle').getAttribute('aria-expanded'), 'true')
  assert.ok(ui.find('data-farm-drawer', 'tools'), '抽屉在菜地下方展开，不是整页弹层')
  assert.equal(ui.all('data-farm-overlay').length, 0)
  ui.find('data-farm-tools', 'toggle').fire('click')
  assert.equal(ui.find('data-farm-drawer', 'tools'), undefined)
})

test('工具抽屉保留全部基础/高级工具与帮工入口；选工具后自动收起，直接点地使用', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish' }, clock)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, clock)
  data.plots[0].pests = { dry: T0, weed: 1e15, bug: 1e15 }
  const ui = renderFarm(farm.view(data, clock), 'panel')
  openTools(ui)
  assert.deepEqual(ui.all('data-farm-tool').map(node => node.getAttribute('data-farm-tool')),
    ['gloves', 'seedbag', 'can', 'shovel', 'weedkiller', 'pesticide', 'sickle', 'sprayer', 'rake', 'planter', 'fert'])
  assert.ok(ui.find('data-farm-helper', 'hire'))
  assert.ok(ui.find('data-farm-weather', 'info'))
  assert.ok(ui.find('data-farm-level', 'info'))
  for (const tool of ui.all('data-farm-tool')) assert.ok(tool.querySelectorAll('.fm-tool-label')[0].textContent, '工具必须有文字标签')
  ui.find('data-farm-tool', 'can').fire('click')
  assert.equal(ui.find('data-farm-tools', 'toggle').getAttribute('aria-expanded'), 'false', '选好工具就收起抽屉')
  assert.equal(ui.find('data-farm-drawer', 'tools'), undefined)
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'care', payload: { plot: 0, kind: 'dry' } })
})

test('大农场仍是 18 块地，详情与工具组在菜地下方，底部导航语义和小农场一致', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  assert.equal(ui.all('data-farm-plot').length, 18)
  const body = ui.dom.body.querySelectorAll('.fm-b-body')[0]
  assert.equal(body.children.length, 2)
  assert.match(body.children[0].className, /\bfm-b-stage\b/)
  assert.match(body.children[1].className, /\bfm-b-controls\b/, '详情与工具回到菜地下方，不做侧栏')
  const controls = body.children[1]
  assert.equal(controls.querySelectorAll('.fm-s-scene').length, 0, '控制区不塞进场景')
  assert.ok(controls.querySelectorAll('.fm-s-detail').length, '详情在菜地下方')
  assert.ok(controls.querySelectorAll('.fm-dock').length, '工具 / 背包 / 商店在菜地下方')
  const dock = controls.querySelectorAll('.fm-dock')[0]
  assert.deepEqual(dock.children.map(node => node.allText().trim()), ['工具', '背包', '商店'])
  assert.equal(ui.dom.body.querySelectorAll('.fm-b-side').length, 0, '不再有侧栏容器')
  openTools(ui)
  assert.equal(ui.all('data-farm-tool').length, 11)
  assert.match(ui.find('data-farm-drawer', 'tools').parentNode.className, /\bfm-b-controls\b/, '大农场工具也在菜地下方')
})

test('背包是独立子页：种子 / 蔬菜 / 道具三个页签，数量都取真实快照', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 3 }, clock)
  farm.actions.buy(data, { item: 'fert-1', count: 2 }, clock)
  farm.actions.buy(data, { item: 'sickle' }, clock)
  data.harvest.radish = 5
  const ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-bag', 'open').fire('click')
  assert.equal(ui.all('data-farm-item').length, 0, '背包不混进商店商品')
  assert.equal(ui.all('data-farm-bag-tab').length, 3)
  assert.equal(ui.find('data-farm-seed', 'radish').querySelectorAll('.dp-tile-badge')[0].textContent, '×3')
  assert.match(ui.find('data-farm-seed', 'radish').allText(), /× 3|×3/)
  ui.find('data-farm-bag-tab', 'crop').fire('click')
  assert.equal(ui.find('data-farm-crop', 'radish').querySelectorAll('.dp-tile-badge')[0].textContent, '×5')
  assert.match(ui.find('data-farm-crop', 'radish').allText(), /卖 18\/个/)
  ui.find('data-farm-bag-tab', 'item').fire('click')
  assert.equal(ui.find('data-farm-fert', 'fert-1').querySelectorAll('.dp-tile-badge')[0].textContent, '×2')
  assert.ok(ui.find('data-farm-owned-tool', 'sickle'), '已购买道具能看到')
})

test('背包保留种子使用、肥料使用、蔬菜出售和帮工入库；返回后选地与手里的种子不丢', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, clock)
  farm.actions.buy(data, { item: 'fert-1', count: 2 }, clock)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, clock)
  data.harvest.radish = 4
  const view = farm.view(data, clock)
  view.helper.stored = 3
  const ui = renderFarm(view, 'panel')
  ui.find('data-farm-plot', '4').fire('click')
  ui.find('data-farm-bag', 'open').fire('click')
  ui.find('data-farm-helper', 'collect').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'collect', payload: {} })
  ui.find('data-farm-seed', 'radish').fire('click')
  assert.ok(ui.find('data-farm-detail', '4'), '回到菜地还停在原来选的地块')
  assert.equal(ui.find('data-farm-overlay', 'bag'), undefined)
  ui.find('data-farm-plot', '4').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'plant', payload: { plot: 4, item: 'radish' } })

  ui.find('data-farm-bag', 'open').fire('click')
  ui.find('data-farm-bag-tab', 'item').fire('click')
  ui.find('data-farm-fert', 'fert-1').fire('click')
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'fertilize', payload: { plot: 0, item: 'fert-1' } })

  const sellUi = renderFarm(farm.view(data, clock), 'panel')
  sellUi.find('data-farm-bag', 'open').fire('click')
  sellUi.find('data-farm-bag-tab', 'crop').fire('click')
  sellUi.find('data-farm-crop', 'radish').fire('click')
  sellUi.find('data-farm-sell', 'radish').fire('click')
  assert.deepEqual(plain(sellUi.sent.at(-1)), { op: 'sell', payload: { item: 'radish' } })
  sellUi.find('data-farm-sell-everything', 'true').fire('click')
  assert.deepEqual(plain(sellUi.sent.at(-1)), { op: 'sell', payload: { item: '*' } })
})

test('商店是小图标方块：分类、价格、锁定、数量与确认都在，不是整图大列表', () => {
  const view = farm.view(establishedFarm(), api(1000))
  const ui = renderFarm(view, 'big')
  ui.find('data-farm-shop', 'shelf').fire('click')
  const grid = ui.dom.body.querySelectorAll('.dp-tiles')[0]
  assert.ok(grid, '复用宿主 tileGrid 的三列方块')
  assert.ok(grid.querySelectorAll('.dp-tile-icon').length >= 4)
  assert.equal(ui.all('data-farm-item').length, view.seeds.length, '种子货架商品一件不少')
  const locked = ui.all('data-farm-item').find(node => node.getAttribute('aria-disabled') === 'true')
  assert.match(locked.allText(), /菜币|级|已拥有/, '锁定与买不起写清楚原因')
  assert.match(ui.text(), /80 菜币/, '价格仍然显示')
  ui.find('data-farm-item', 'radish').fire('click')
  assert.ok(ui.find('data-farm-quantity-field', 'true'))
  assert.equal(ui.find('data-farm-confirm', 'true').getAttribute('data-farm-confirm'), 'true')
  assert.equal(ui.all('data-farm-close').length, 0)
})

test('大农场未开垦地块是灰暗纸土：复用 paper-soil，有锁与开垦顺序，价格不变', () => {
  const view = farm.view(establishedFarm(), api())
  const ui = renderFarm(view, 'big', art)
  const wild = ui.all('data-farm-plot').slice(6)
  assert.equal(wild.length, 12)
  for (const plot of wild) {
    assert.equal(plot.getAttribute('data-farm-soil'), 'wild')
    const soil = plot.querySelectorAll('.fm-soil')[0]
    assert.ok(soil, '荒地也铺纸土')
    assert.match(soil.getAttribute('src'), /paper-soil-patch\.png/)
    assert.ok(!plot.style.backgroundImage, '不拿整图或白底冒充土地')
  }
  assert.equal(ui.all('data-farm-reclaim').length, 1, '只有下一块能点开垦')
  assert.equal(ui.find('data-farm-reclaim', '6').allText(), '开垦 ' + view.reclaimPrice)
  assert.equal(ui.all('data-farm-plot').filter(plot => plot.querySelectorAll('.fm-lock').length).length, 11)
  const css = cssOf(ui)
  assert.match(css, /\.fm-plot\[data-farm-soil="wild"\]\{background:none\}/)
  assert.match(css, /\.fm-plot\[data-farm-soil="wild"\] \.fm-soil\{filter:grayscale\(1\) brightness\(/)
  assert.doesNotMatch(css, /\.fm-plot\[data-farm-soil="wild"\]\{[^}]*background:#fff/)
  ui.find('data-farm-plot', '7').fire('click')
  const detail = ui.find('data-farm-detail', '7')
  assert.match(detail.allText(), /尚未解锁/)
  assert.match(detail.allText(), /第 2 块/)
  assert.match(detail.allText(), new RegExp('价格同样 ' + view.reclaimPrice + ' 菜币'))
  assert.equal(detail.querySelectorAll('.fm-s-track').length, 0, '荒地不冒充生长进度')
})

test('选有菜 / 没菜 / 荒地时详情行数与主按钮文案行数固定，小农场和大农场场景不换高', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 3 }, clock)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, clock)
  const growing = farm.view(data, clock)
  farm.actions.plant(data, { plot: 1, item: 'radish' }, clock)
  const view = farm.view(data, clock)
  view.plots[0] = { ...view.plots[0], ripe: true }
  const heights = []
  for (const [mode, indexes] of [['panel', ['0', '2']], ['big', ['0', '2', '6']]]) {
    for (const index of indexes) {
      const ui = renderFarm(view, mode)
      ui.find('data-farm-plot', index).fire('click')
      const detail = ui.find('data-farm-detail', index)
      assert.equal(detail.children.length, 4, mode + ' 详情固定：标题 / 信息行 / 说明行 / 末行快捷操作')
      assert.equal(detail.children[3].className, 'fm-s-acts')
      const main = ui.dom.body.querySelectorAll('.fm-main')[0]
      assert.equal(main.children.length, 2, '主按钮始终有标题和预留副行')
      heights.push(ui.dom.body.querySelectorAll('.fm-s-scene').length)
    }
  }
  assert.ok(heights.every(count => count === 1), '两种模式都只有一个场景，不因选择重建')
  const css = cssOf(renderFarm(view, 'panel'))
  assert.match(css, /\.fm-s-detail\{[^}]*grid-template-rows:24px 18px minmax\(30px,auto\)[^}]*min-height:80px/)
  assert.match(css, /\.fm-main\{[^}]*min-height:54px/)
  assert.ok(!growing.plots[0].empty)
})

test('每个子页只有一个返回；确认框只有确定 / 取消，不再叠关闭叉', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api(1000)), 'big')
  for (const [open, overlay] of [
    [() => ui.find('data-farm-shop', 'shelf').fire('click'), 'shop'],
    [() => { ui.find('data-farm-back', 'true').fire('click'); ui.find('data-farm-bag', 'open').fire('click') }, 'bag'],
    [() => { ui.find('data-farm-back', 'true').fire('click'); ui.find('data-farm-coin', 'open').fire('click') }, 'wallet'],
  ]) {
    open()
    assert.ok(ui.find('data-farm-overlay', overlay))
    assert.equal(ui.all('data-farm-back').length, 1)
    assert.equal(ui.all('data-farm-close').length, 0)
    assert.equal(ui.find('data-farm-overlay', overlay).getAttribute('data-scroll-key').startsWith('farm-popup:'), true)
  }
  ui.find('data-farm-back', 'true').fire('click')
  ui.find('data-farm-shop', 'shelf').fire('click')
  ui.find('data-farm-item', 'radish').fire('click')
  assert.equal(ui.all('data-farm-close').length, 0)
  assert.ok(ui.find('data-farm-confirm', 'true') && ui.find('data-farm-cancel', 'true'))
  ui.find('data-farm-cancel', 'true').fire('click')
  ui.find('data-farm-back', 'true').fire('click')
  assert.equal(ui.find('data-farm-overlay', 'shop'), undefined)
  assert.ok(ui.find('data-farm-plot', '0'), '返回保留菜地')
})

test('所有返回都复用系统 dp-drill-back 圆箭头：只有 ‹、aria-label 明确、不叠 dp-btn 或自造尺寸', () => {
  const arrow = node => {
    assert.match(node.className, /\bdp-drill-back\b/)
    assert.doesNotMatch(node.className, /\bdp-btn\b/, '不叠普通按钮样式')
    assert.equal(node.textContent, '‹')
    assert.equal(node.allText().trim(), '‹', '不能自造「‹ 返回」文字胶囊')
    assert.ok(node.getAttribute('aria-label'))
    assert.equal(node.style.width, undefined)
    assert.equal(node.style.height, undefined)
  }
  let ui = renderFarm(farm.view(establishedFarm(), api()), 'big', { closeBig() {} })
  const close = ui.find('data-farm-big', 'close')
  arrow(close)
  assert.match(close.getAttribute('aria-label'), /小农场/)
  ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  for (const [open, overlay] of [
    [() => ui.find('data-farm-shop', 'shelf').fire('click'), 'shop'],
    [() => { ui.find('data-farm-back', 'true').fire('click'); ui.find('data-farm-bag', 'open').fire('click') }, 'bag'],
    [() => { ui.find('data-farm-back', 'true').fire('click'); ui.find('data-farm-coin', 'open').fire('click') }, 'wallet'],
  ]) {
    open()
    assert.ok(ui.find('data-farm-overlay', overlay))
    assert.equal(ui.all('data-farm-back').length, 1)
    const back = ui.find('data-farm-back', 'true')
    arrow(back)
    assert.match(back.getAttribute('aria-label'), /菜地/)
  }
})

test('子页返回保留滚动键与菜地页，选中地块和手里工具不因翻页重置', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, clock)
  const ui = renderFarm(farm.view(data, clock), 'big')
  ui.find('data-farm-plot', '3').fire('click')
  openTools(ui)
  ui.find('data-farm-tool', 'can').fire('click')
  ui.find('data-farm-tools', 'toggle').fire('click')
  assert.equal(ui.find('data-scroll-page', 'farm-large').getAttribute('data-scroll-page'), 'farm-large')
  ui.find('data-farm-bag', 'open').fire('click')
  assert.equal(ui.find('data-scroll-page', 'farm-large').getAttribute('data-scroll-page'), 'farm-large', '子页不换菜地页，返回时宿主可还原滚动')
  assert.equal(ui.find('data-farm-overlay', 'bag').getAttribute('data-scroll-key'), 'farm-popup:bag:seed')
  ui.find('data-farm-back', 'true').fire('click')
  assert.ok(ui.find('data-farm-detail', '3'))
  openTools(ui)
  assert.equal(ui.find('data-farm-tool', 'can').getAttribute('aria-pressed'), 'true', '手里的工具还在')
})

test('背包页签和商店页签用同一套导航语义与真实数量，不互相冒充', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, clock)
  data.harvest.radish = 1
  const ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-bag', 'open').fire('click')
  assert.equal(ui.all('data-farm-tab').length, 0, '背包不画商店分类')
  assert.equal(ui.find('data-farm-bag-tab', 'seed').getAttribute('aria-selected'), 'true')
  ui.find('data-farm-back', 'true').fire('click')
  ui.find('data-farm-shop', 'shelf').fire('click')
  assert.equal(ui.all('data-farm-bag-tab').length, 0, '商店不画背包页签')
  assert.equal(ui.all('data-farm-tab').length, 4)
  assert.equal(ui.find('data-farm-item', 'radish').querySelectorAll('.dp-tile-badge')[0].textContent, '×2', '商店能看到已有种子数')
  ui.find('data-farm-tab', 'tool').fire('click')
  assert.equal(ui.all('data-farm-seed').length, 0, '商店工具货架不混进背包种子')
})

test('大农场点击地块不重建场景，18 块地仍是同一套平面网格', () => {
  const view = farm.view(establishedFarm(), api())
  const ui = renderFarm(view, 'big')
  const scene = ui.dom.body.querySelectorAll('.fm-s-scene')[0]
  for (const index of ['0', '3', '7', '17']) {
    ui.find('data-farm-plot', index).fire('click')
    assert.equal(ui.dom.body.querySelectorAll('.fm-s-scene').length, 1)
    assert.equal(ui.all('data-farm-plot').length, 18)
    assert.equal(ui.find('data-farm-grid', 'expanded').className, 'fm-s-field')
  }
  assert.ok(scene)
  const css = readFileSync(new URL('../extensions/farm/client.js', import.meta.url), 'utf8')
  assert.doesNotMatch(css, /fm-b-field|fm-hit/)
  assert.match(css, /\.fm-big \.fm-s-field\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/)
})

// 原生鼠标顺序是 focus → pointerup → click；focus 阶段不能拆掉按钮。
test('选好种子后首次点空地不会被焦点重绘吞掉，仍发一次播种', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, clock)
  const ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-bag', 'open').fire('click')
  ui.find('data-farm-seed', 'radish').fire('click')
  const plot = ui.find('data-farm-plot', '3')
  plot.fire('pointerdown')
  plot.fire('focus')
  let attached = false
  ui.dom.body.walk(node => { if (node === plot) attached = true })
  assert.equal(attached, true, '松手前必须仍是原来的地块按钮')
  plot.fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'plant', payload: { plot: 3, item: 'radish' } })
  assert.equal(ui.sent.filter(entry => entry.op === 'plant').length, 1)
})
