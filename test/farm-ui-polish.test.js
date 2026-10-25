// 菜园 A 方案第二轮：动作成功反馈、失败/轮询不重播、大农场真实悬停信息、纸片土块与小葱三段的锚点。
// 全部走 fakeDom 和真实 farm.actions，不复制业务数字；动画只在服务器快照确认后出现。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import farm, { LESSON } from '../extensions/farm/server.js'

import { H, T0, api, establishedFarm, plain, renderFarm } from './helpers/farm-ui.js'

const paint = (ui, data, clock) => { ui.app.data = farm.view(data, clock); ui.app.rerender() }
const openTools = ui => { if (ui.find('data-farm-tools', 'toggle').getAttribute('aria-expanded') !== 'true') ui.find('data-farm-tools', 'toggle').fire('click') }
const pickTool = (ui, key) => { openTools(ui); ui.find('data-farm-tool', key).fire('click') }
const fxOf = (ui, index) => ui.find('data-farm-plot', String(index)).getAttribute('data-farm-fx')
const cssOf = ui => ui.dom.head.children[0].textContent

function growingRadish() {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish' }, clock)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, clock)
  return { data, clock }
}

test('播种、浇水、收获只在快照确认后各播一次动作反馈，轮询和重开不重播', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish' }, clock)
  const ui = renderFarm(farm.view(data, clock), 'panel')
  pickTool(ui, 'seedbag')
  ui.find('data-farm-seed', 'radish').fire('click')
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent), [{ op: 'plant', payload: { plot: 0, item: 'radish' } }])
  assert.equal(fxOf(ui, 0), null, '发送前不播成功动画')
  assert.equal(farm.actions.plant(data, { plot: 0, item: 'radish' }, clock).ok, true)
  paint(ui, data, clock)
  assert.equal(fxOf(ui, 0), 'sow', '服务器确认播种后才出现播种反馈')
  assert.match(ui.text(), /播种成功/)
  ui.app.rerender()
  assert.equal(fxOf(ui, 0), 'sow', '早到轮询续接当前播种反馈')
  data.plots[0].pests = { dry: T0, weed: 1e15, bug: 1e15 }
  paint(ui, data, clock)
  pickTool(ui, 'can')
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'care', payload: { plot: 0, kind: 'dry' } })
  assert.notEqual(fxOf(ui, 0), 'water', '浇水请求发出时不抢先播本次成功')
  assert.equal(farm.actions.care(data, { plot: 0, kind: 'dry' }, clock).ok, true)
  paint(ui, data, clock)
  assert.equal(fxOf(ui, 0), 'water')
  assert.match(ui.text(), /照料成功/)
  ui.app.rerender()
  assert.equal(fxOf(ui, 0), 'water', '早到轮询续接当前浇水反馈')
  clock.now = T0 + 14 * H
  paint(ui, data, clock)
  pickTool(ui, 'gloves')
  ui.find('data-farm-plot', '0').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'harvest', payload: { plot: 0 } })
  assert.notEqual(fxOf(ui, 0), 'harvest', '收获请求发出时不抢先播本次成功')
  assert.equal(farm.actions.harvest(data, { plot: 0 }, clock).ok, true)
  paint(ui, data, clock)
  assert.equal(fxOf(ui, 0), 'harvest')
  assert.match(ui.text(), /收获 \d+ 个/)
  ui.app.rerender()
  assert.equal(fxOf(ui, 0), 'harvest', '早到轮询续接当前收获反馈')
  const reopened = renderFarm(farm.view(data, clock), 'panel')
  assert.equal(fxOf(reopened, 0), null, '重开页面不重播上一次成功动画')
})

test('请求未回时只发一次，失败结果清掉动作；之后轮询到的变化不会被当成收获成功', async () => {
  const { data, clock } = growingRadish()
  clock.now = T0 + 14 * H
  const calls = []
  let resolveSend
  const ui = renderFarm(farm.view(data, clock), 'panel', { send(op, payload) { calls.push([op, payload]); return new Promise(resolve => { resolveSend = resolve }) } })
  pickTool(ui, 'gloves')
  const plot = ui.find('data-farm-plot', '0')
  plot.fire('click'); plot.fire('click')
  assert.equal(calls.length, 1, '同一动作在请求未回时不重复发送')
  assert.equal(ui.find('data-farm-main', 'harvest').getAttribute('aria-busy'), 'true')
  assert.equal(fxOf(ui, 0), null)
  resolveSend({ ok: false, reason: 'already' })
  await Promise.resolve()
  assert.equal(fxOf(ui, 0), null, '失败不播成功动画')
  assert.doesNotMatch(ui.text(), /收获 \d+ 个/)
  data.plots[0].pests = { dry: T0, weed: 1e15, bug: 1e15 }
  paint(ui, data, clock)
  assert.equal(fxOf(ui, 0), null, '失败后别的快照变化不会补播旧动作')
})

test('Promise 成功：宿主先画快照时不抢先播，确认结果后才用动作前状态播一次', async () => {
  const { data, clock } = growingRadish()
  clock.now = T0 + 14 * H
  let resolveSend
  const ui = renderFarm(farm.view(data, clock), 'panel', { send() { return new Promise(resolve => { resolveSend = resolve }) } })
  pickTool(ui, 'gloves')
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(farm.actions.harvest(data, { plot: 0 }, clock).ok, true)
  paint(ui, data, clock)
  assert.equal(fxOf(ui, 0), null, '宿主快照先到、请求未确认时不播成功')
  assert.equal(ui.find('data-farm-main', 'clear').getAttribute('aria-busy'), 'true')
  resolveSend({ ok: true })
  await Promise.resolve()
  assert.equal(fxOf(ui, 0), 'harvest', '确认成功的那次重绘才播收获反馈')
  assert.match(ui.text(), /收获 \d+ 个/)
  assert.equal(ui.find('data-farm-main', 'clear').getAttribute('aria-busy'), null, '确认后按钮恢复')
  ui.app.rerender()
  assert.equal(fxOf(ui, 0), 'harvest', '早到轮询保留同一次反馈')
})

test('第一课种、浇、收都有确认后的反馈，收获收起地块时播在场景中央', () => {
  const data = farm.init(), clock = api(0)
  let ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-main', 'onboarding').fire('click')
  assert.deepEqual(plain(ui.sent), [{ op: 'onboarding', payload: { op: 'plant' } }])
  assert.equal(ui.find('data-farm-lesson', 'offer').getAttribute('data-farm-fx'), null, '发送前不播')
  assert.equal(farm.actions.onboarding(data, { op: 'plant' }, clock).ok, true)
  paint(ui, data, clock)
  assert.equal(ui.find('data-farm-lesson', 'planted').getAttribute('data-farm-fx'), 'sow')
  assert.match(ui.text(), /第一课种下了/)
  ui.app.rerender()
  assert.equal(ui.find('data-farm-lesson', 'planted').getAttribute('data-farm-fx'), 'sow', '早到轮询续接当前反馈')
  ui.find('data-farm-main', 'onboarding').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'onboarding', payload: { op: 'water' } })
  assert.equal(farm.actions.onboarding(data, { op: 'water' }, clock).ok, true)
  paint(ui, data, clock)
  assert.equal(ui.find('data-farm-lesson', 'planted').getAttribute('data-farm-fx'), 'water')
  assert.match(ui.text(), /浇水成功/)
  ui.app.rerender()
  assert.equal(ui.find('data-farm-lesson', 'planted').getAttribute('data-farm-fx'), 'water', '早到轮询续接当前反馈')
  clock.now = T0 + LESSON.wateredMs
  paint(ui, data, clock)
  ui.find('data-farm-main', 'onboarding').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'onboarding', payload: { op: 'harvest' } })
  assert.equal(farm.actions.onboarding(data, { op: 'harvest' }, clock).ok, true)
  paint(ui, data, clock)
  assert.equal(ui.all('data-farm-lesson-plot').length, 0, '收获后第一课地块收起')
  assert.equal(ui.dom.body.querySelectorAll('.fm-s-scene')[0].getAttribute('data-farm-fx'), 'harvest')
  assert.match(ui.text(), /第一课完成：12 菜币 \+ 小葱种子 ×1/)
  ui.app.rerender()
  assert.equal(ui.dom.body.querySelectorAll('.fm-s-scene')[0].getAttribute('data-farm-fx'), 'harvest', '早到轮询续接同一次第一课收获')
})

test('大农场点击或键盘聚焦地块，复用真实选中详情，不显示悬浮旧框', () => {
  const { data, clock } = growingRadish()
  const view = farm.view(data, clock)
  view.plots[0].progress = 0.42
  const ui = renderFarm(view, 'big')
  ui.find('data-farm-plot', '0').fire('focus')
  const card = ui.find('data-farm-detail', '0')
  assert.match(card.allText(), /白萝卜/)
  assert.equal(card.querySelectorAll('.fm-s-track')[0].children[0].style.width, '42%')
  ui.find('data-farm-plot', '1').fire('click')
  assert.match(ui.find('data-farm-detail', '1').allText(), /空地/)
  assert.equal(ui.all('data-farm-hover-card').length, 0)
})

test('纸片土块按可见 bbox 等比摆放，小葱三段各有自然比例和正确基线', () => {
  const config = { hasAsset: name => name.startsWith('paper-'), asset: name => '/assets/' + name }
  const data = farm.init(), clock = api(0)
  assert.equal(farm.actions.onboarding(data, { op: 'plant' }, clock).ok, true)
  let ui = renderFarm(farm.view(data, clock), 'panel', config)
  const soil = ui.dom.body.querySelectorAll('.fm-soil')[0]
  assert.match(soil.getAttribute('src'), /paper-soil-patch\.png/)
  const css = cssOf(ui)
  assert.match(css, /\.fm-s-field img\.fm-soil\{[^}]*height:149\.09%;[^}]*transform:translateX\(-50\.44%\)/)
  assert.doesNotMatch(css, /\.fm-soil\{[^}]*object-fit:fill/)
  const lesson = ui.find('data-farm-lesson', 'planted')
  let crop = lesson.querySelectorAll('.fm-crop')[0]
  assert.equal(crop.getAttribute('data-paper-stage'), 'seed')
  assert.match(crop.getAttribute('src'), /paper-scallion-seed\.png/)
  clock.now = T0 + 90 * 1000
  ui = renderFarm(farm.view(data, clock), 'panel', config)
  crop = ui.find('data-farm-lesson', 'planted').querySelectorAll('.fm-crop')[0]
  assert.equal(crop.getAttribute('data-paper-stage'), 'seedling')
  assert.match(crop.getAttribute('src'), /paper-scallion-seedling\.png/)
  clock.now = T0 + LESSON.ripeMs
  ui = renderFarm(farm.view(data, clock), 'panel', config)
  crop = ui.find('data-farm-lesson', 'planted').querySelectorAll('.fm-crop')[0]
  assert.equal(crop.getAttribute('data-paper-stage'), 'ripe')
  assert.match(crop.getAttribute('src'), /paper-scallion-ripe\.png/)
  assert.match(css, /data-paper-stage="seed"\]\{[^}]*height:205\.78%;[^}]*width:auto[^}]*bottom:-34\.86%/)
  assert.match(css, /data-paper-stage="seedling"\]\{[^}]*height:83\.41%;[^}]*width:auto[^}]*bottom:-2\.92%/)
  assert.match(css, /data-paper-stage="ripe"\]\{[^}]*height:93\.81%;[^}]*width:auto[^}]*bottom:0\.06%/)
  assert.ok(css.includes('.fm-plot[data-farm-fx]::after{opacity:0!important}'), '减少动态时动作反馈不再播动画')
})

// VM复现：收获确认后的下一帧碰到轮询，整段动画被立即清掉；刷新应续接同一时间线。
test('成功反馈遇到早到轮询时续播剩余时间，过期后消失且不补播', () => {
  const data = farm.init(), clock = api(0)
  let now = T0
  const ui = renderFarm(farm.view(data, clock), 'panel', { now: () => now })
  ui.find('data-farm-main', 'onboarding').fire('click')
  farm.actions.onboarding(data, { op: 'plant' }, clock)
  paint(ui, data, clock)
  assert.equal(ui.find('data-farm-lesson', 'planted').getAttribute('data-farm-fx'), 'sow')
  now += 100
  ui.app.rerender()
  const resumed = ui.find('data-farm-lesson', 'planted')
  assert.equal(resumed.getAttribute('data-farm-fx'), 'sow', '早到轮询不截断正在播的反馈')
  assert.equal(resumed.style['--fm-fx-delay'], '-100ms', '从原时刻续播，不能重新从0开始')
  now += 600
  ui.app.rerender()
  assert.equal(ui.find('data-farm-lesson', 'planted').getAttribute('data-farm-fx'), null)
  now += 4000
  ui.app.rerender()
  assert.equal(ui.find('data-farm-lesson', 'planted').getAttribute('data-farm-fx'), null)
})
