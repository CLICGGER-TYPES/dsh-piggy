// @ts-check
// 菜园帮工 E2 UI：精力条、状态词、剩余时间、手动休息/叫醒、排班切换、全休/全巡逻/待命文案与旧服务端降级。
// 只读 view，不跑动画，不改结算。
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import farm, { setTheft,  HELPER_WORK_MS, setHelperEnergy } from '../../../extensions/farm/server.js'

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

function openHelperShop(view, extra = {}) {
  const ui = renderFarm(view, 'big', extra)
  ui.find('data-farm-shop', 'shelf').fire('click')
  ui.find('data-farm-tab', 'helper').fire('click')
  return ui
}

beforeEach(() => setHelperEnergy(true))

test('工作中：每只一行有精力条、状态词、百分比和休息按钮', () => {
  const { data, clock } = crew(1)
  data.seeds.cabbage = 12
  for (let plot = 0; plot < 4; plot += 1) assert.equal(farm.actions.plant(data, { plot, item: 'cabbage' }, clock).ok, true)
  const ui = openHelperShop(farm.view(data, clock))

  const bars = ui.all('data-farm-helper-energy')
  assert.equal(bars.length, 1)
  assert.equal(bars[0].getAttribute('data-state'), 'working')
  const track = ui.find('role', 'progressbar')
  assert.ok(track, '精力条要有 progressbar 语义')
  assert.equal(track.getAttribute('aria-valuemin'), '0')
  assert.equal(track.getAttribute('aria-valuemax'), '100')
  const now = Number(track.getAttribute('aria-valuenow'))
  assert.ok(now >= 0 && now <= 100, 'aria-valuenow 在 0..100：' + now)
  assert.match(track.getAttribute('aria-label') ?? '', /#1.*精力.*工作中/)

  assert.match(ui.text(), /工作中/)
  assert.match(ui.text(), /还剩/)
  assert.match(ui.text(), /在岗 1 \/ 休息 0/)
  assert.match(ui.text(), /共管 4 块地/)

  const rest = ui.find('data-farm-rest', 'rest')
  assert.ok(rest, '在岗帮工要能手动休息')
  assert.equal(rest.textContent, '休息')
  rest.fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'setHelperRest', payload: { id: 1, resting: true } })
})

test('休息中：显示剩余时间与叫醒按钮；暂停不显示休息按钮', () => {
  const { data, clock } = crew(1)
  data.helper.workers[0].shiftAt = clock.now - HELPER_WORK_MS / 2 // 半格精力，休息半小时后回来
  assert.equal(farm.actions.setHelperRest(data, { id: 1, resting: true }, clock).ok, true)

  let ui = openHelperShop(farm.view(data, clock))
  assert.match(ui.text(), /休息中/)
  assert.match(ui.text(), /后回来/)
  const bar = ui.find('data-farm-helper-energy', '1')
  assert.equal(bar.getAttribute('data-state'), 'resting')
  const wake = ui.find('data-farm-rest', 'wake')
  assert.equal(wake.textContent, '叫醒')
  wake.fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'setHelperRest', payload: { id: 1, resting: false } })

  const paused = crew(1)
  assert.equal(farm.actions.toggleHelper(paused.data, { enabled: false }, paused.clock).ok, true)
  ui = openHelperShop(farm.view(paused.data, paused.clock))
  assert.match(ui.text(), /已暂停/)
  assert.match(ui.text(), /托管已暂停/)
  assert.equal(ui.all('data-farm-rest').length, 0, '全局暂停时不显示逐只的叫醒死按钮')
  assert.equal(ui.find('data-farm-helper-energy', '1').getAttribute('data-state'), 'paused')
})

test('待命：没活睡觉有明确文案，不是工作中', () => {
  const { data, clock } = crew(1)
  const ui = openHelperShop(farm.view(data, clock))
  assert.match(ui.text(), /待命/)
  assert.match(ui.text(), /管区没活/)
  assert.match(ui.text(), /管区暂时没活，帮工在待命休息/)
  assert.doesNotMatch(ui.text(), /工作中/)
  assert.equal(ui.find('data-farm-helper-energy', '1').getAttribute('data-state'), 'idle')
})

test('全员休息：总览说清楚都在休息、多久回来，不弹死按钮', () => {
  const { data, clock } = crew(2)
  data.helper.workers[0].shiftAt = clock.now - HELPER_WORK_MS / 2
  data.helper.workers[1].shiftAt = clock.now - HELPER_WORK_MS / 2
  assert.equal(farm.actions.setHelperRest(data, { id: 1, resting: true }, clock).ok, true)
  assert.equal(farm.actions.setHelperRest(data, { id: 2, resting: true }, clock).ok, true)
  const ui = openHelperShop(farm.view(data, clock))
  assert.match(ui.text(), /帮工都在休息/)
  assert.match(ui.text(), /后陆续回来/)
  assert.match(ui.text(), /休息 2/)
  assert.equal(ui.all('data-farm-rest').length, 2, '手动的两只都能叫醒')
})

test('抽屉：全员休息时写「帮工都在休息」，点击只提示多久回来，不进商店', () => {
  const { data, clock } = crew(2)
  data.seeds.cabbage = 8
  for (let plot = 0; plot < 8; plot += 1) assert.equal(farm.actions.plant(data, { plot, item: 'cabbage' }, clock).ok, true)
  data.helper.workers[0].shiftAt = clock.now - HELPER_WORK_MS / 2
  data.helper.workers[1].shiftAt = clock.now - HELPER_WORK_MS / 2
  assert.equal(farm.actions.setHelperRest(data, { id: 1, resting: true }, clock).ok, true)
  assert.equal(farm.actions.setHelperRest(data, { id: 2, resting: true }, clock).ok, true)
  const ui = renderFarm(farm.view(data, clock), 'big')
  ui.find('data-farm-tools', 'toggle').fire('click')
  assert.match(ui.text(), /帮工都在休息/)
  ui.find('data-farm-helper', 'collect').fire('click')
  assert.match(ui.text(), /帮工在休息.*后回来/)
  assert.equal(ui.shops(), 0, '非购买/收集路径不打开商店')
})

test('全巡逻：总览警告 + 巡逻不占地说明，不出现收菜死按钮', () => {
  const { data, clock } = crew(2, ['patrol', 'patrol'])
  data.seeds.cabbage = 4
  for (let plot = 0; plot < 4; plot += 1) assert.equal(farm.actions.plant(data, { plot, item: 'cabbage' }, clock).ok, true)
  const ui = openHelperShop(farm.view(data, clock))
  assert.match(ui.text(), /没有收菜帮工，菜不会自动收/)
  assert.match(ui.text(), /巡逻帮工不占地/)
  assert.match(ui.text(), /#1 巡逻/)
  assert.match(ui.text(), /待命/, '没有收菜覆盖时巡逻也按没活睡觉，不假装在巡逻')
})

test('混合角色：有收菜在管地时，巡逻在岗显示「巡逻中」', () => {
  const { data, clock } = crew(2, ['harvest', 'patrol'])
  data.seeds.cabbage = 4
  for (let plot = 0; plot < 4; plot += 1) assert.equal(farm.actions.plant(data, { plot, item: 'cabbage' }, clock).ok, true)
  const ui = openHelperShop(farm.view(data, clock))
  assert.match(ui.text(), /巡逻中/)
  assert.match(ui.text(), /工作中/)
})

test('排班：auto/manual 切换走 setHelperSchedule，文案说明错峰与逐只休息', () => {
  const { data, clock } = crew(1)
  let ui = openHelperShop(farm.view(data, clock))
  const auto = ui.find('data-farm-schedule', 'auto')
  const manual = ui.find('data-farm-schedule', 'manual')
  assert.equal(auto.getAttribute('aria-pressed'), 'true')
  assert.equal(manual.getAttribute('aria-pressed'), 'false')
  assert.match(ui.text(), /自动错峰/)
  manual.fire('click')
  assert.deepEqual(plain(ui.sent.at(-1)), { op: 'setHelperSchedule', payload: { mode: 'manual' } })

  data.helper.schedule = 'manual'
  ui = openHelperShop(farm.view(data, clock))
  assert.match(ui.text(), /可以逐只休息 \/ 叫醒/)
  assert.equal(ui.find('data-farm-schedule', 'manual').getAttribute('aria-pressed'), 'true')
})

test('旧服务端：没有 workers 或没有 energy 都退回单帮工卡片，不渲染精力条', () => {
  const { data, clock } = crew(2)
  const noWorkers = farm.view(data, clock)
  delete noWorkers.helper.workers
  delete noWorkers.helper.count
  delete noWorkers.helper.max
  let ui = openHelperShop(noWorkers)
  assert.equal(ui.all('data-farm-helper-energy').length, 0)
  assert.equal(ui.all('data-farm-role').length, 0)
  assert.match(ui.text(), /已雇用 · 管 \d+ 块地/)

  const noEnergy = farm.view(data, clock)
  for (const worker of noEnergy.helper.workers) { delete worker.energy; delete worker.status }
  ui = openHelperShop(noEnergy)
  assert.equal(ui.all('data-farm-helper-energy').length, 0)
  assert.equal(ui.all('data-farm-role').length, 0)
  assert.match(ui.text(), /已雇用 · 管 \d+ 块地/)
})

test('动作失败：too-tired 只给轻提示，不弹大错', async () => {
  const { data, clock } = crew(1)
  data.seeds.cabbage = 4
  for (let plot = 0; plot < 4; plot += 1) assert.equal(farm.actions.plant(data, { plot, item: 'cabbage' }, clock).ok, true)
  const ui = openHelperShop(farm.view(data, clock), { send: () => Promise.resolve({ ok: false, reason: 'too-tired' }) })
  ui.find('data-farm-rest', 'rest').fire('click')
  await Promise.resolve(); await Promise.resolve()
  assert.match(ui.text(), /帮工太累了/)
  assert.equal(ui.all('data-farm-confirm').length, 0, '轻提示不弹确认框')
})
