// 第四轮：地块只留作物，统一弹层，悬停不盖弹层，场景由用户本地时段和快照天气选择。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import farm from '../extensions/farm/server.js'
import { assetNames } from '../store/ext-files.js'
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

test('fix4：商店、种子袋、肥料、仓库、购买及确认共用商店框和标题', () => {
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
    const view = { ...growing(), now, weather: sky }
    for (const mode of ['big', 'panel']) {
      const ui = renderFarm(view, mode, { ...art, hasAsset: () => true })
      const scene = ui.dom.body.querySelectorAll(mode === 'big' ? '.fm-b-scene' : '.fm-s-scene')[0]
      assert.match(scene.style.backgroundImage, new RegExp('bg-' + (mode === 'big' ? 'big' : 'small') + '-' + phase + '-' + sky))
    }
  }
})

test('fix4：场景读取同一份天气快照，夜间天气与白天一致', () => {
  const data = establishedFarm(), clock = api()
  const view = farm.view(data, clock)
  assert.ok(['sunny', 'rain'].includes(view.weather))
  clock.now = new Date(2026, 9, 13, 22).getTime()
  assert.equal(farm.view(data, clock).weather, farm.view(data, { ...clock, now: new Date(2026, 9, 13, 12).getTime() }).weather)
})

test('fix4：场景图兜底只挑登记过的图，不请求没登记的 bg-big / bg-small', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extensions/farm/manifest.json', import.meta.url), 'utf8'))
  const listed = assetNames(manifest)
  assert.ok(!listed.includes('bg-big.webp') && !listed.includes('bg-small.webp'), '这两张旧图本来就没登记')
  const file = scene => (/url\("([^"]+)"\)/.exec(scene.style.backgroundImage) ?? [])[1]?.replace('/assets/', '') ?? ''
  // 宿主有 asset 但没有 hasAsset（老版本）：以前会退回没登记的 bg-<尺寸>.webp，请求出去必 404。
  for (const mode of ['panel', 'big']) {
    const scene = renderFarm(growing(), mode, art).dom.body.querySelectorAll(mode === 'big' ? '.fm-b-scene' : '.fm-s-scene')[0]
    assert.ok(listed.includes(file(scene)), mode + ' 的底图没登记：' + file(scene))
  }
  // 该时段的图不在名单里：退到同尺寸、同晴雨的白天图（天气按钮读的也是这张图名字里的晴雨）。
  const night = { ...growing(), now: new Date(2026, 9, 13, 22).getTime() }
  const picked = renderFarm(night, 'big', { ...art, hasAsset: name => name !== 'bg-big-night-sunny.webp' })
  assert.match(picked.dom.body.querySelectorAll('.fm-b-scene')[0].style.backgroundImage, /bg-big-day-sunny\.webp/)
  // 一张能用的都没有：不铺底图，也不拼一个不存在的名字。
  const none = renderFarm(night, 'big', { ...art, hasAsset: () => false }).dom.body.querySelectorAll('.fm-b-scene')[0]
  assert.ok(!none.style.backgroundImage, '没有登记过的图时不该请求任何底图')
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

test('fix4：购买输入未失焦时数量先保存、总价更新，重绘不恢复成1颗', () => {
  const ui = renderFarm(growing(), 'big', art)
  ui.find('data-farm-shop', 'shelf').fire('click')
  ui.find('data-farm-item', 'radish').fire('click')
  const field = ui.find('aria-label', '数量')
  field.value = '5'; field.fire('input')
  assert.equal(ui.find('aria-label', '数量'), field, '输入不替换当前控件和光标')
  assert.ok(ui.find('data-farm-total', '400'))
  ui.app.rerender()
  assert.equal(ui.find('aria-label', '数量').value, '5')
  ui.find('data-farm-confirm', 'true').fire('click')
  assert.equal(ui.sent.at(-1).payload.count, 5)
})

test('fix4：跨时区的本地清晨仍使用浇水逻辑的同一份晴雨快照', () => {
  const previous = process.env.TZ
  try {
    process.env.TZ = 'UTC'
    const clock = api(); clock.now = Date.parse('2026-10-13T23:30:00Z')
    const view = farm.view(establishedFarm(), clock)
    view.weatherDays = [{ date: '2026-10-14', sky: view.weather === 'rain' ? 'sunny' : 'rain' }]
    process.env.TZ = 'Asia/Shanghai'
    const ui = renderFarm(view, 'big', { ...art, hasAsset: () => true })
    assert.match(ui.dom.body.querySelectorAll('.fm-b-scene')[0].style.backgroundImage, new RegExp('bg-big-dawn-' + view.weather))
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})

test('fix4：通用按压反馈不覆盖按钮用于定位的transform', () => {
  const ui = renderFarm(growing(), 'big', art)
  const css = ui.dom.head.children.find(node => node.id?.includes('farm-style')).textContent
  const active = /\.fm button:active\{([^}]*)\}/.exec(css)
  assert.ok(active)
  assert.doesNotMatch(active[1], /(?:^|;)\s*transform\s*:/, '开垦牌需保留translate(-50%,-50%)定位')
  assert.match(css, /\.fm-b-field \.fm-expand\{[^}]*transform:translate\(-50%,-50%\)/)
})
