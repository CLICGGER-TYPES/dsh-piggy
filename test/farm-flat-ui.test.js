// 菜园平涂纸片界面（用户 2026-10-24 选定 A）与第一课前端的定向测试：
// 只跑 fakeDom 和真实 server 动作，不复制业务数字；时间、进度都从 farm.view 读。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import farm, { LESSON } from '../extensions/farm/server.js'

import { H, T0, api, establishedFarm, plain, renderFarm } from './helpers/farm-ui.js'

const newSave = () => { const data = farm.init(); return { data, clock: api(0) } }
const paint = (ui, data, clock) => { ui.app.data = farm.view(data, clock); ui.app.rerender() }
const main = (ui, key) => ui.find('data-farm-main', key)

function plantedLesson() {
  const run = newSave()
  assert.equal(farm.actions.onboarding(run.data, { op: 'plant' }, run.clock).ok, true)
  return run
}

test('第一课 offer：先试种一轮、课内 1 颗、只发 onboarding plant，不伪造普通种子', () => {
  const { data, clock } = newSave()
  const ui = renderFarm(farm.view(data, clock), 'panel')
  assert.match(ui.text(), /先试种一轮/)
  assert.match(ui.text(), /课内小葱种子 ×1/)
  assert.equal(ui.find('data-farm-lesson', 'offer').getAttribute('aria-label'), '第一课 小葱 待播种')
  assert.equal(ui.all('data-farm-lesson-plot').length, 1)
  assert.equal(ui.find('data-farm-lesson', 'offer').getAttribute('data-farm-target'), 'true')
  assert.equal(ui.all('data-farm-plot').length, 5, '第一课 + 5 块真实普通地块，没把六格写死')
  assert.ok(ui.find('data-farm-detail', 'lesson'))
  main(ui, 'onboarding').fire('click')
  assert.deepEqual(plain(ui.sent), [{ op: 'onboarding', payload: { op: 'plant' } }])
  assert.equal(data.seeds.scallion, undefined, '课内种子不写进普通种子袋')
})

test('第一课 planted：待浇水、浇水只发 onboarding water；成熟后主按钮按快照变成收获', () => {
  const { data, clock } = plantedLesson()
  let ui = renderFarm(farm.view(data, clock), 'panel')
  assert.match(ui.text(), /第一课 · 小葱 · 待浇水/)
  assert.match(ui.text(), /生长进度/)
  assert.equal(ui.find('data-farm-lesson', 'planted').getAttribute('data-farm-lesson'), 'planted')
  main(ui, 'onboarding').fire('click')
  assert.deepEqual(plain(ui.sent), [{ op: 'onboarding', payload: { op: 'water' } }])
  assert.equal(farm.actions.onboarding(data, { op: 'water' }, clock).ok, true)
  clock.now = T0 + LESSON.ripeMs
  ui = renderFarm(farm.view(data, clock), 'panel')
  assert.match(ui.text(), /第一课熟了/)
  assert.match(ui.text(), /收获第一课/)
  main(ui, 'onboarding').fire('click')
  assert.deepEqual(plain(ui.sent), [{ op: 'onboarding', payload: { op: 'harvest' } }])
})

test('第一课完成：只发 12 菜币 + 1 颗普通小葱种子，页面显示奖励摘要，普通地块不被替换', () => {
  const { data, clock } = plantedLesson()
  farm.actions.onboarding(data, { op: 'water' }, clock)
  clock.now = T0 + LESSON.wateredMs
  const before = structuredClone(data.plots)
  const ui = renderFarm(farm.view(data, clock), 'panel')
  main(ui, 'onboarding').fire('click')
  assert.equal(farm.actions.onboarding(data, { op: 'harvest' }, clock).ok, true)
  paint(ui, data, clock)
  assert.match(ui.text(), /第一课完成：12 菜币 \+ 小葱种子 ×1/)
  assert.equal(data.seeds.scallion, 1)
  assert.equal(data.exp, 0)
  assert.deepEqual(data.plots, before, '普通地块原样保留')
  assert.equal(ui.all('data-farm-lesson-plot').length, 0, '完成后第一课地块收起')
  assert.equal(ui.all('data-farm-plot').length, 6, '收完恢复六块真实地块')
})

test('第一课按钮在请求未回时禁用并标 aria-busy，重复点击不会发第二次', () => {
  const { data, clock } = newSave()
  const calls = []
  const ui = renderFarm(farm.view(data, clock), 'panel', { send(op, payload) { calls.push([op, payload]); return new Promise(() => {}) } })
  main(ui, 'onboarding').fire('click')
  assert.equal(calls.length, 1)
  const button = main(ui, 'onboarding')
  assert.equal(button.disabled, true)
  assert.equal(button.getAttribute('aria-busy'), 'true')
  button.fire('click')
  assert.equal(calls.length, 1)
})

test('老玩家和成熟菜园：没有第一课控件，主按钮按真实地块收菜', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish' }, clock)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, clock)
  clock.now = T0 + 14 * H
  const ui = renderFarm(farm.view(data, clock), 'panel')
  assert.equal(ui.all('data-farm-lesson-plot').length, 0)
  assert.equal(ui.all('data-farm-plot').length, 6)
  assert.doesNotMatch(ui.text(), /第一课/)
  assert.equal(main(ui, 'harvest').getAttribute('data-farm-main'), 'harvest')
  assert.equal(ui.find('data-farm-plot', '0').getAttribute('data-farm-target'), 'true')
  assert.match(ui.text(), /可以收了/)
  main(ui, 'harvest').fire('click')
  assert.deepEqual(plain(ui.sent), [{ op: 'harvest', payload: { plot: 0 } }])
})

test('菜币是单个可点入口；工具抽屉里保留帮工、天气；大农场入口在顶栏，背包是独立子页', () => {
  const data = establishedFarm(), clock = api()
  const ui = renderFarm(farm.view(data, clock), 'panel', { openBig() {} })
  ui.find('data-farm-coin', 'open').fire('click')
  assert.ok(ui.find('data-farm-overlay', 'wallet'))
  assert.equal(ui.all('data-farm-exchange').length, 0, '不再把余额和换币叠成两个入口')
  ui.find('data-farm-back', 'true').fire('click')
  ui.find('data-farm-tools', 'toggle').fire('click')
  assert.equal(ui.find('data-farm-helper', 'hire').getAttribute('aria-label'), '雇帮工猪')
  assert.ok(ui.find('data-farm-big', 'open'))
  ui.find('data-farm-weather', 'info').fire('click')
  assert.match(ui.text(), /天气/)
  ui.find('data-farm-bag', 'open').fire('click')
  assert.ok(ui.find('data-farm-overlay', 'bag'))
  assert.equal(ui.all('data-farm-bag-tab').length, 3)
})

test('选中的种子 / 水壶只给真正能用的地块加高亮', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, clock)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, clock)
  data.plots[0].pests = { dry: T0, weed: 1e15, bug: 1e15 }
  const ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-tools', 'toggle').fire('click')
  ui.find('data-farm-tool', 'can').fire('click')
  assert.equal(ui.find('data-farm-plot', '0').getAttribute('data-farm-valid'), 'true')
  assert.equal(ui.find('data-farm-plot', '1').getAttribute('data-farm-valid'), 'false')
  ui.find('data-farm-tools', 'toggle').fire('click')
  ui.find('data-farm-tool', 'seedbag').fire('click')
  ui.find('data-farm-seed', 'radish').fire('click')
  assert.equal(ui.find('data-farm-overlay', 'bag'), undefined, '选好种子就回到菜地，不能继续挡住田地')
  ui.app.rerender()
  assert.equal(ui.find('data-farm-plot', '1').getAttribute('data-farm-valid'), 'true')
  assert.equal(ui.find('data-farm-plot', '0').getAttribute('data-farm-valid'), 'false', '有作物 / 干了的地不能直接播种')
})

test('面板进度条用快照的 progress，都在长时不出现无用主按钮但保留状态文案', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 6 }, clock)
  for (let index = 0; index < 6; index += 1) farm.actions.plant(data, { plot: index, item: 'radish' }, clock)
  const view = farm.view(data, clock)
  view.plots[0].progress = 0.42
  const ui = renderFarm(view, 'panel')
  assert.equal(ui.dom.body.querySelectorAll('.fm-s-track')[0].children[0].style.width, '42%')
  assert.equal(ui.all('data-farm-main').length, 0, '都在长时不出现点不动的快捷按钮')
  assert.match(ui.find('data-farm-detail', '0').allText(), /还剩/, '详情里的生长状态仍在')
  assert.match(ui.text(), /都在长/, '目标文案仍在')
})

test('面板里铁锹铲正在长的作物仍先确认；确认发 force、取消不发', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish' }, clock)
  farm.actions.plant(data, { plot: 0, item: 'radish' }, clock)
  const ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-tools', 'toggle').fire('click')
  ui.find('data-farm-tool', 'shovel').fire('click')
  ui.find('data-farm-plot', '0').fire('click')
  assert.equal(ui.sent.length, 0)
  assert.equal(ui.find('role', 'dialog').getAttribute('aria-label'), '铲除确认')
  ui.find('data-farm-cancel', 'true').fire('click')
  assert.equal(ui.sent.length, 0)
  ui.find('data-farm-plot', '0').fire('click')
  ui.find('data-farm-confirm', 'true').fire('click')
  assert.deepEqual(plain(ui.sent), [{ op: 'clear', payload: { plot: 0, force: true } }])
})

test('面板高级工具里的一键工具没买只去商店；买了才会发批量动作', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, clock)
  for (const plot of [0, 1]) farm.actions.plant(data, { plot, item: 'radish' }, clock)
  let ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-tools', 'toggle').fire('click')
  ui.find('data-farm-tool', 'sickle').fire('click')
  assert.equal(ui.shops(), 1)
  farm.actions.buy(data, { item: 'sickle' }, clock)
  ui = renderFarm(farm.view(data, clock), 'panel')
  ui.find('data-farm-tools', 'toggle').fire('click')
  clock.now = T0 + 14 * H
  ui.app.data = farm.view(data, clock); ui.app.rerender()
  ui.find('data-farm-tool', 'sickle').fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'harvestAll', payload: {} })
})

test('登记过的平涂素材才加载：背景、土块、小葱三段；未登记时退回 CSS 和旧作物图', () => {
  const { data, clock } = newSave()
  const config = { hasAsset: name => name.startsWith('paper-'), asset: name => '/assets/' + name }
  let ui = renderFarm(farm.view(data, clock), 'panel', config)
  const scene = ui.dom.body.querySelectorAll('.fm-s-scene')[0]
  assert.match(scene.style.backgroundImage, /paper-garden-background\.png/)
  assert.equal(scene.getAttribute('data-paper'), 'true')
  assert.match(ui.dom.body.querySelectorAll('.fm-soil')[0].getAttribute('src'), /paper-soil-patch\.png/)
  assert.equal(farm.actions.onboarding(data, { op: 'plant' }, clock).ok, true)
  ui = renderFarm(farm.view(data, clock), 'panel', config)
  assert.match(ui.find('data-farm-lesson', 'planted').querySelectorAll('.fm-crop')[0].getAttribute('src'), /paper-scallion-seed\.png/)
  clock.now = T0 + LESSON.ripeMs
  ui = renderFarm(farm.view(data, clock), 'panel', config)
  assert.match(ui.find('data-farm-lesson', 'planted').querySelectorAll('.fm-crop')[0].getAttribute('src'), /paper-scallion-ripe\.png/)
  const plain = renderFarm(farm.view(data, clock), 'panel', { asset: name => '/assets/' + name })
  assert.ok(!plain.dom.body.querySelectorAll('.fm-s-scene')[0].style.backgroundImage, '未登记时不请求 paper 背景')
  assert.match(plain.find('data-farm-lesson', 'planted').querySelectorAll('.fm-crop')[0].getAttribute('src'), /crop-scallion-ripe\.webp/)
})
