// 第四轮：地块只留作物，统一弹层，悬停不盖弹层，场景由用户本地时段和快照天气选择。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import farm from '../extensions/farm/server.js'
import { api, establishedFarm, renderFarm } from './helpers/farm-ui.js'

function growing() {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 6 }, clock)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, clock)
  return farm.view(data, clock)
}
const art = { asset: name => '/assets/' + name }

test('fix4：地块和作物上没有进度条', () => {
  for (const mode of ['big', 'panel']) {
    const ui = renderFarm(growing(), mode)
    assert.equal(ui.dom.body.querySelectorAll('.fm-prog').length, 0)
  }
})

test('fix4：商店、包袱、化肥、仓库、购买及确认共用商店框和标题', () => {
  for (const [attr, key] of [['data-farm-shop', 'shelf'], ['data-farm-tool', 'seedbag'], ['data-farm-tool', 'fert'], ['data-farm-panel', 'stock']]) {
    const ui = renderFarm(growing(), 'big', art)
    ui.find(attr, key).fire('click')
    const box = ui.all('data-farm-overlay')[0]
    assert.equal(box.style.borderImageSource, 'url("/assets/shop-frame.webp")')
    assert.equal(box.getAttribute('data-farm-frame'), 'shop-frame')
    assert.equal(box.querySelectorAll('.fm-title').length, 1)
  }
  const ui = renderFarm(growing(), 'big', art)
  ui.find('data-farm-shop', 'shelf').fire('click')
  ui.find('data-farm-item', 'radish').fire('click')
  assert.equal(ui.dom.body.querySelectorAll('.fm-buy')[0].getAttribute('data-farm-frame'), 'shop-frame')
})

test('fix4：只在真实移动后生成悬停卡，弹层打开时不生成卡', () => {
  const ui = renderFarm(growing(), 'big', art)
  const plot = ui.find('data-farm-plot', '0')
  plot.fire('mousemove', { movementX: 1, movementY: 0 })
  assert.equal(ui.dom.body.querySelectorAll('.fm-hover-card').length, 1)
  plot.fire('mouseleave')
  assert.equal(ui.dom.body.querySelectorAll('.fm-hover-card').length, 0)
  ui.find('data-farm-tool', 'fert').fire('click')
  ui.find('data-farm-plot', '0').fire('mouseenter')
  ui.find('data-farm-plot', '0').fire('mousemove', { movementX: 1, movementY: 0 })
  assert.equal(ui.dom.body.querySelectorAll('.fm-hover-card').length, 0)
})

test('fix4：按本地05/08/17/19界线和晴雨选场景，夜雨与夜晴不同', () => {
  const phases = [[4, 'night'], [5, 'dawn'], [8, 'day'], [17, 'dusk'], [19, 'night']]
  for (const [hour, phase] of phases) for (const sky of ['sunny', 'rain']) {
    const now = new Date(2026, 9, 13, hour).getTime()
    const view = { ...growing(), now, weatherDays: [{ date: '2026-10-13', sky }] }
    for (const mode of ['big', 'panel']) {
      const ui = renderFarm(view, mode, { ...art, hasAsset: () => true })
      const scene = ui.dom.body.querySelectorAll(mode === 'big' ? '.fm-b-scene' : '.fm-s-scene')[0]
      assert.match(scene.style.backgroundImage, new RegExp('bg-' + (mode === 'big' ? 'big' : 'small') + '-' + phase + '-' + sky))
    }
  }
})

test('fix4：天气日历覆盖UTC相邻日期并保持原有夜间照料规则', () => {
  const data = establishedFarm(), clock = api()
  const view = farm.view(data, clock)
  assert.equal(view.weatherDays.length, 3)
  assert.equal(new Set(view.weatherDays.map(day => day.date)).size, 3)
  assert.ok(view.weatherDays.every(day => ['sunny', 'rain'].includes(day.sky)))
  clock.now = new Date(2026, 9, 13, 22).getTime()
  assert.equal(farm.view(data, clock).weather, 'night')
})

test('fix4：每个作物阶段均可查看卡片，成熟/枯萎使用既有中文状态', () => {
  for (const stage of ['seed', 'sprout', 'seedling', 'growing', 'flowering', 'ripe', 'withered']) {
    const view = growing()
    view.plots[0] = { ...view.plots[0], stage, ripe: stage === 'ripe', withered: stage === 'withered' }
    const ui = renderFarm(view, 'big', art)
    ui.find('data-farm-plot', '0').fire('mousemove', { movementX: 1, movementY: 0 })
    assert.equal(ui.dom.body.querySelectorAll('.fm-hover-card').length, 1, stage)
    if (stage === 'ripe' || stage === 'withered') assert.doesNotMatch(ui.text(), new RegExp('阶段：' + stage))
    ui.app.rerender()
    assert.equal(ui.dom.body.querySelectorAll('.fm-hover-card').length, 0)
  }
})
