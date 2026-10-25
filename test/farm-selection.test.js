import assert from 'node:assert/strict'
import { test } from 'node:test'
import farm from '../extensions/farm/server.js'
import { api, establishedFarm, plain, renderFarm, T0 } from './helpers/farm-ui.js'

test('点选普通地块后详情、高亮和主操作保持同一目标，轮询不跳回首块', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, clock)
  const ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-plot', '4').fire('click')
  assert.ok(ui.find('data-farm-detail', '4'))
  assert.equal(ui.find('data-farm-plot', '4').getAttribute('data-farm-target'), 'true')
  ui.app.rerender()
  ui.find('data-farm-main', 'plant').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'plant', payload: { plot: 4, item: 'radish' } })
})

test('主按钮浇水一次就向选中地块发动作，不是只把水壶拿起来', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish' }, clock)
  farm.actions.plant(data, { plot: 3, item: 'radish' }, clock)
  data.plots[3].pests = { dry: T0, weed: 1e15, bug: 1e15 }
  const ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-plot', '3').fire('click')
  ui.find('data-farm-main', 'care').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'care', payload: { plot: 3, kind: 'dry' } })
})

test('在工具抽屉中选除草剂后立即收起抽屉，能直接点地', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'panel')
  ui.find('data-farm-tools', 'toggle').fire('click')
  ui.find('data-farm-tool', 'weedkiller').fire('click')
  assert.equal(ui.find('data-farm-drawer', 'tools'), undefined)
  assert.equal(ui.find('data-farm-tools', 'toggle').getAttribute('aria-expanded'), 'false')
  ui.find('data-farm-tools', 'toggle').fire('click')
  assert.equal(ui.find('data-farm-tool', 'can').getAttribute('aria-pressed'), 'false')
})

test('首课存在时点选普通地，详情和主操作不继续指向首课', () => {
  const data = farm.init(), clock = api()
  const ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-plot', '2').fire('click')
  assert.ok(ui.find('data-farm-detail', '2'))
  assert.equal(ui.find('data-farm-main', 'onboarding'), undefined)
  assert.ok(ui.find('data-farm-lesson-plot', 'true'), '首课地块仍可再次选择')
})

test('没有种子时选空地也保留高亮，商店入口不把详情跳回第一块', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'panel')
  ui.find('data-farm-plot', '4').fire('click')
  assert.ok(ui.find('data-farm-detail', '4'))
  assert.equal(ui.find('data-farm-plot', '4').getAttribute('data-farm-target'), 'true')
  assert.equal(ui.find('data-farm-main', 'shop'), undefined, '买种子走商店入口，不再占主按钮')
  assert.match(ui.find('data-farm-detail', '4').allText(), /去商店买/)
  ui.find('data-farm-shop', 'shelf').fire('click')
  assert.equal(ui.shops(), 1)
  ui.find('data-farm-back', 'true').fire('click')
  assert.ok(ui.find('data-farm-detail', '4'), '返回后仍停在原空地')
  assert.equal(ui.find('data-farm-plot', '4').getAttribute('data-farm-target'), 'true')
})

test('自动推荐买种子时，详情与高亮对应真实空地，不出现无用主按钮', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish' }, clock)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, clock)
  const ui = renderFarm(farm.view(data, clock), 'big')
  assert.equal(ui.find('data-farm-main', 'shop'), undefined)
  assert.equal(ui.find('data-farm-main', 'idle'), undefined)
  assert.ok(ui.find('data-farm-detail', '1'))
  assert.match(ui.find('data-farm-detail', '1').allText(), /去商店买/)
  assert.equal(ui.find('data-farm-plot', '1').getAttribute('data-farm-target'), 'true')
  ui.find('data-farm-shop', 'shelf').fire('click')
  assert.equal(ui.find('data-farm-tab', 'seed').getAttribute('aria-selected'), 'true')
  ui.find('data-farm-back', 'true').fire('click')
  assert.ok(ui.find('data-farm-detail', '1'), '从商店返回仍对着真实空地')
})

test('选择荒地展示开垦条件，余额不足不显示无用主按钮，不冒充作物生长状态', () => {
  let ui = renderFarm(farm.view(establishedFarm(), api(0)), 'big')
  ui.find('data-farm-plot', '6').fire('click')
  const detail = ui.find('data-farm-detail', '6')
  assert.match(detail.allText(), /荒地/)
  assert.match(detail.allText(), /需要 \d+ 菜币/)
  assert.equal(ui.find('data-farm-main', 'unlock'), undefined, '余额不足不出现点不动的快捷按钮')
  assert.equal(detail.querySelectorAll('.fm-s-track').length, 0)
  ui = renderFarm(farm.view(establishedFarm(), api()), 'big')
  ui.find('data-farm-plot', '6').fire('click')
  ui.find('data-farm-main', 'unlock').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'unlock', payload: { plot: 6 } })
})
