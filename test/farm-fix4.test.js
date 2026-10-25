// 第四轮：地块只留作物，统一弹层，悬停不盖弹层，场景由用户本地时段和快照天气选择。
// 2026-10-24 用户选定平涂纸片 A 方案后，场景不再按晴雨/时段请求旧 bg-* 图；本文件守住新的低密度场景和面板进度卡。
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
const sceneOf = (ui, mode) => ui.dom.body.querySelectorAll('.fm-s-scene')[0]

test('fix4：地块和作物上没有进度条', () => {
  for (const mode of ['big', 'panel']) {
    const ui = renderFarm(growing(), mode)
    assert.equal(ui.dom.body.querySelectorAll('.fm-prog').length, 0)
  }
})

test('fix4：商店、种子袋、肥料、背包、购买及确认共用圆角纸面框和药丸标题', () => {
  for (const [attr, key] of [['data-farm-shop', 'shelf'], ['data-farm-tool', 'seedbag'], ['data-farm-tool', 'fert'], ['data-farm-bag', 'open']]) {
    const ui = renderFarm(growing(), 'big', art)
    if (key === 'seedbag' || key === 'fert') ui.find('data-farm-tools', 'toggle').fire('click')
    ui.find(attr, key).fire('click')
    const box = ui.all('data-farm-overlay')[0]
    assert.ok(!box.style.borderImageSource, 'CSS 纸面不再叠旧木框九宫格')
    assert.equal(box.getAttribute('data-farm-frame'), 'css-paper')
    assert.equal(box.querySelectorAll('.fm-title').length, 1)
  }
  const ui = renderFarm(growing(), 'big', art)
  ui.find('data-farm-shop', 'shelf').fire('click')
  ui.find('data-farm-item', 'radish').fire('click')
  assert.equal(ui.dom.body.querySelectorAll('.fm-buy')[0].getAttribute('data-farm-frame'), 'css-paper')
})

test('fix4：场景改成低密度平涂纸片，不再按时段/晴雨加载旧场景图', () => {
  for (const hour of [4, 5, 8, 17, 19]) for (const sky of ['sunny', 'rain']) {
    const now = new Date(2026, 9, 13, hour).getTime()
    const view = { ...growing(), now, weather: sky }
    for (const mode of ['big', 'panel']) {
      const ui = renderFarm(view, mode, { ...art, hasAsset: () => true })
      assert.match(sceneOf(ui, mode).style.backgroundImage, /paper-garden-(?:background|wide)\.png/, mode + ' 场景使用新平涂底图')
      assert.ok(ui.find('data-farm-grid', mode === 'big' ? 'expanded' : 'compact'))
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

test('fix4：客户端不再请求没登记的 bg-big / bg-small 场景图', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extensions/farm/manifest.json', import.meta.url), 'utf8'))
  const listed = assetNames(manifest)
  assert.ok(!listed.includes('bg-big.webp') && !listed.includes('bg-small.webp'), '这两张旧图本来就没登记')
  const source = readFileSync(new URL('../extensions/farm/client.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /'bg-(big|small)'/)
  for (const mode of ['panel', 'big']) {
    const scene = sceneOf(renderFarm(growing(), mode, art), mode)
    assert.ok(!scene.style.backgroundImage, mode + ' 不该请求任何场景文件')
  }
  const none = sceneOf(renderFarm({ ...growing(), now: new Date(2026, 9, 13, 22).getTime() }, 'big', { ...art, hasAsset: () => false }), 'big')
  assert.ok(!none.style.backgroundImage)
})

test('fix4：每个作物阶段都能在面板进度卡里看到状态，成熟/枯萎用既有中文', () => {
  for (const stage of ['seed', 'sprout', 'seedling', 'growing', 'flowering', 'ripe', 'withered']) {
    const view = growing()
    view.plots[0] = { ...view.plots[0], stage, ripe: stage === 'ripe', withered: stage === 'withered' }
    for (let index = 1; index < 6; index += 1) view.plots[index] = { ...view.plots[0] }
    const ui = renderFarm(view, 'panel', art)
    assert.ok(ui.find('data-farm-detail', '0'), stage)
    if (stage === 'ripe') assert.match(ui.text(), /可以收了/)
    else if (stage === 'withered') assert.match(ui.text(), /枯了/)
    else assert.match(ui.text(), /生长进度/)
    assert.equal(ui.all('data-farm-progress').length, 1)
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

test('fix4：跨时区的本地清晨也只铺平涂场景，不随时间换图', () => {
  const previous = process.env.TZ
  try {
    process.env.TZ = 'UTC'
    const clock = api(); clock.now = Date.parse('2026-10-13T23:30:00Z')
    const view = farm.view(establishedFarm(), clock)
    view.weatherDays = [{ date: '2026-10-14', sky: view.weather === 'rain' ? 'sunny' : 'rain' }]
    process.env.TZ = 'Asia/Shanghai'
    assert.match(sceneOf(renderFarm(view, 'big', { ...art, hasAsset: () => true }), 'big').style.backgroundImage, /paper-garden-(?:background|wide)\.png/)
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})

test('开垦按钮沿用标准按钮且保留地块内定位，不保留旧菱形图层', () => {
  const ui = renderFarm(growing(), 'big', art)
  assert.match(ui.find('data-farm-reclaim', '6').className, /\bdp-btn\b/)
  assert.equal(ui.dom.body.querySelectorAll('.fm-hit').length, 0)
})
