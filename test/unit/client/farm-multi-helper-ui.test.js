// @ts-check
// 菜园多帮工 Slice 2：商店帮工页签的总览/列表、角色按钮、追加雇佣，以及工具抽屉的多只文案与旧服务端降级。
// 只读 view，不跑动画，不改结算。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import farm, { setTheft,  setHelperEnergy } from '../../../extensions/farm/server.js'

setTheft(false) // 旧用例默认关闭偷窃；巡逻/偷窃规则与 UI 在新文件里单独开

import { api, establishedFarm, plain, renderFarm } from '../../helpers/farm-ui.js'

/** 已雇 count 只、按 roles 配角色；默认全收菜。 */
function crew(count, roles = []) {
  const data = establishedFarm()
  data.exp = 10000
  data.unlocked = 18
  const clock = api()
  farm.actions.hire(data, {}, clock)
  for (let index = 1; index < count; index += 1) assert.equal(farm.actions.hireAdditional(data, {}, clock).ok, true)
  roles.forEach((role, index) => {
    const result = farm.actions.setHelperRole(data, { id: index + 1, role }, clock)
    assert.ok(result.ok === true || result.reason === 'already')
  })
  return { data, clock }
}

function openHelperShop(view) {
  const ui = renderFarm(view, 'big')
  ui.find('data-farm-shop', 'shelf').fire('click')
  ui.find('data-farm-tab', 'helper').fire('click')
  return ui
}

setHelperEnergy(false) // E1 只测旧多帮工布局；精力条在 E2 的 UI 用例里开

test('帮工页签：总览 N/5 + 总覆盖块数，每只一行带角色徽章、覆盖块数和改角色按钮', () => {
  const { data, clock } = crew(2, ['harvest', 'patrol'])
  const ui = openHelperShop(farm.view(data, clock))
  assert.match(ui.text(), /帮工 2\/5/)
  assert.match(ui.text(), /共管 4 块地/)
  assert.equal(ui.all('data-farm-helper-worker').length, 2)
  const badges = ui.all('data-role')
  assert.deepEqual(badges.map(node => node.textContent), ['收菜', '巡逻'])
  assert.match(ui.text(), /收 4 块/)
  assert.match(ui.text(), /守 1 区 · 0–3 号地/)

  const buttons = ui.all('data-farm-role')
  assert.deepEqual(buttons.map(node => node.getAttribute('data-farm-role')), ['patrol', 'harvest'])
  assert.deepEqual(buttons.map(node => node.getAttribute('data-farm-helper-id')), ['1', '2'])
  assert.match(buttons[0].getAttribute('aria-label') ?? '', /#1.*巡逻/)
  buttons[1].fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'setHelperRole', payload: { id: 2, role: 'harvest' } })
})

test('追加雇佣入口只在未满 5 只时出现，走 helper-additional 购买弹窗；旧升级卡片不渲染', () => {
  const { data, clock } = crew(1)
  let ui = openHelperShop(farm.view(data, clock))
  assert.ok(ui.find('data-farm-item', 'helper-additional'))
  assert.equal(ui.find('data-farm-item', 'helper-level'), undefined)
  assert.match(ui.text(), /再雇一只帮工猪/)
  assert.match(ui.text(), /1,500 菜币/)
  assert.equal(ui.all('data-farm-item').filter(node => node.getAttribute('data-farm-item') === 'helper-additional').length, 1, '面板入口和货架不重复')
  ui.find('data-farm-item', 'helper-additional').fire('click')
  assert.match(ui.text(), /再雇一只帮工猪/)
  assert.match(ui.text(), /总价 1500 菜币/)

  const full = crew(5)
  ui = openHelperShop(farm.view(full.data, full.clock))
  assert.equal(ui.find('data-farm-item', 'helper-additional'), undefined, '满 5 只不再出售追加雇佣')
  assert.match(ui.text(), /帮工 5\/5/)
})

test('全巡逻：工具抽屉说实话，点它进帮工页签而不是假装在干活', () => {
  const { data, clock } = crew(2, ['patrol', 'patrol'])
  const view = farm.view(data, clock)
  const ui = renderFarm(view, 'big')
  ui.find('data-farm-tools', 'toggle').fire('click')
  assert.match(ui.text(), /没有收菜帮工，菜不会自动收/)
  ui.find('data-farm-helper', 'collect').fire('click')
  ui.find('data-farm-tab', 'helper').fire('click')
  assert.match(ui.text(), /帮工 2\/5/)
  assert.match(ui.text(), /没有收菜帮工，菜不会自动收/)
})

test('多只收菜：抽屉文案带只数；单只仍保留旧文案', () => {
  const two = crew(2)
  two.data.seeds.cabbage = 12
  for (let plot = 0; plot < 8; plot += 1) assert.equal(farm.actions.plant(two.data, { plot, item: 'cabbage' }, two.clock).ok, true)
  let ui = renderFarm(farm.view(two.data, two.clock), 'big')
  ui.find('data-farm-tools', 'toggle').fire('click')
  assert.match(ui.text(), /帮工 ×2 · 收 8 块/)

  const one = crew(1)
  one.data.seeds.cabbage = 8
  for (let plot = 0; plot < 4; plot += 1) assert.equal(farm.actions.plant(one.data, { plot, item: 'cabbage' }, one.clock).ok, true)
  ui = renderFarm(farm.view(one.data, one.clock), 'big')
  ui.find('data-farm-tools', 'toggle').fire('click')
  assert.match(ui.text(), /帮工 · 4 块地/)
})

test('旧服务端没有 workers：退回原单帮工卡片，不渲染角色按钮也不崩', () => {
  const { data, clock } = crew(1)
  const view = farm.view(data, clock)
  delete view.helper.workers
  delete view.helper.count
  delete view.helper.max
  const ui = openHelperShop(view)
  assert.equal(ui.all('data-farm-role').length, 0)
  assert.match(ui.text(), /已雇用 · 管 4 块地/)
  assert.match(ui.text(), /帮工仓/)
  assert.match(ui.text(), /托管开关/)
})
