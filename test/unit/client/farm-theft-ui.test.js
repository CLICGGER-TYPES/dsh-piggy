// @ts-check
// 菜园 v9 巡逻 / 偷窃界面：覆盖卡、地块「守」徽章、损失文案、最近事件、巡逻行文案、
// 无巡逻 / 多巡逻 / 全休息 / 暂停提示，以及旧服务端降级和经典版一句损失提示。纯 CSS，无新素材。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import farm from '../../../extensions/farm/server.js'
import { farmClassicFiles } from '../../../scripts/farm-classic-files.mjs'
import { api, establishedFarm, renderFarm, T0 } from '../../helpers/farm-ui.js'

const H = 3600000
const NO_PEST = 1e15

/** 熟地档 + 指定角色的帮工；默认 8 块地 = 2 个巡逻区。 */
function crew(roles, unlocked = 8) {
  const data = establishedFarm()
  data.exp = 10000
  data.unlocked = unlocked
  data.helper.hired = true
  data.helper.enabled = true
  data.helper.lastAt = T0
  data.helper.targets = Array(18).fill(null)
  data.helper.workers = roles.map((role, index) => ({ id: index + 1, role, locked: false, hiredAt: T0, shiftAt: T0, resting: false, idle: false }))
  return data
}

function planted(data, index, key = 'radish', at = T0 - H) {
  data.plots[index] = { crop: key, season: 1, plantedAt: at, boostMs: 0, roll: 0, pests: { weed: NO_PEST, bug: NO_PEST, dry: NO_PEST } }
  data.helper.targets[index] = key
  return data
}

function mature(data, index, loss = 0) {
  planted(data, index, 'radish', T0 - 14 * H)
  if (loss > 0) data.plots[index].loss = loss
  return data
}

function theftLog(data, event) {
  data.theft = { at: T0 + 6 * H, seq: event.seq + 1, log: [event] }
  return data
}

const stolenEvent = { seq: 0, at: T0 - 2 * H, kind: 'bird', plot: 0, zone: 0, crop: 'radish', patrolId: 1, guarded: false, blocked: false, loss: 0.25, heavy: false }
const blockedEvent = { seq: 1, at: T0 - H, kind: 'pig', plot: 1, zone: 0, crop: 'radish', patrolId: 1, guarded: true, blocked: true, loss: 0, heavy: false }

function openHelper(view) {
  const ui = renderFarm(view, 'big')
  ui.find('data-farm-shop', 'shelf').fire('click')
  ui.find('data-farm-tab', 'helper').fire('click')
  return ui
}

test('巡逻覆盖卡：每区 pill、有人守/无人守、N/M 区有人守、aria-label', () => {
  const data = crew(['harvest', 'harvest', 'patrol'])
  for (let index = 0; index < 4; index += 1) planted(data, index)
  const ui = openHelper(farm.view(data, api()))
  const zones = ui.all('data-farm-patrol-zone')
  assert.equal(zones.length, 2)
  assert.equal(zones[0].getAttribute('data-guarded'), 'true')
  assert.equal(zones[1].getAttribute('data-guarded'), 'false')
  assert.match(zones[0].getAttribute('aria-label') ?? '', /1 区，0 到 3 号地，有人守，巡逻 #3/)
  assert.match(zones[1].getAttribute('aria-label') ?? '', /2 区，4 到 7 号地，无巡逻/)
  assert.match(ui.text(), /1\/2 区有人守/)
  assert.match(ui.text(), /守 1 区 · 0–3 号地/)
  assert.match(ui.text(), /无人守/)
})

test('地块「守」徽章：只挂有人守且有作物的地；aria-label 含有人守；无人守区不挂', () => {
  const data = crew(['harvest', 'patrol'])
  for (let index = 0; index < 6; index += 1) planted(data, index)
  const ui = renderFarm(farm.view(data, api()), 'big')
  assert.equal(ui.all('data-farm-guard').length, 4, '1 区 4 块有守，2 区没有')
  const guarded = ui.find('data-farm-plot', '0')
  assert.equal(guarded.getAttribute('data-farm-guard'), 'true')
  assert.match(guarded.getAttribute('aria-label') ?? '', /有人守/)
  assert.equal(ui.find('data-farm-plot', '4').getAttribute('data-farm-guard'), null)
  ui.find('data-farm-plot', '0').fire('click')
  assert.match(ui.text(), /巡逻区 1（0–3 号地）· 有人守/)
  ui.find('data-farm-plot', '4').fire('click')
  assert.match(ui.text(), /巡逻区 2（4–7 号地）· 无人看守/)
})

test('损失：data-farm-loss、熟地 chip「−25%」、详情「被鸟啄过 · 少收 25%」、巡逻行仍守区', () => {
  const data = crew(['patrol'])
  mature(data, 0, 0.25)
  planted(data, 1)
  theftLog(data, stolenEvent)
  const clock = api()
  const view = farm.view(data, clock)
  assert.equal(view.plots[0].lossPercent, 25)
  const ui = renderFarm(view, 'big')
  const card = ui.find('data-farm-plot', '0')
  assert.equal(card.getAttribute('data-farm-loss'), '25')
  assert.match(ui.text(), /收 18 个 · −25%/)
  assert.match(ui.text(), /被鸟啄过 · 少收 25%/)
  assert.match(openHelper(farm.view(data, api())).text(), /守 1 区 · 0–3 号地/)
})

test('最近事件：被偷写少收、被赶走写 #N 赶走、没有事件写「最近没有偷窃」', () => {
  const base = () => { const data = crew(['harvest', 'patrol']); planted(data, 0); return data }

  let ui = openHelper(farm.view(theftLog(base(), stolenEvent), api()))
  assert.match(ui.text(), /最近：2 小时前 · 鸟啄了 1 号地，少收 25%/)

  ui = openHelper(farm.view(theftLog(base(), blockedEvent), api()))
  assert.match(ui.text(), /#1 赶走了小偷猪（2 号地）/)

  const clean = base()
  clean.theft = { at: T0 + 6 * H, seq: 0, log: [] }
  ui = openHelper(farm.view(clean, api()))
  assert.match(ui.text(), /最近没有偷窃/)
  assert.match(ui.text(), /5% 概率被偷/)
})

test('没有巡逻帮工 / 巡逻比区多 / 全休息 / 托管暂停：四种提示都在', () => {
  const none = crew(['harvest', 'harvest'])
  planted(none, 0)
  let ui = openHelper(farm.view(none, api()))
  assert.match(ui.text(), /没有巡逻帮工/)
  assert.match(ui.text(), /把一只改成巡逻可以守 4 块地/)

  const extra = crew(['patrol', 'patrol', 'patrol'], 6)
  planted(extra, 0)
  ui = openHelper(farm.view(extra, api()))
  assert.match(ui.text(), /巡逻帮工比巡逻区多，多出的不会提高防御/)
  assert.match(ui.text(), /机动（无空闲区）/)

  const resting = crew(['harvest', 'patrol'])
  planted(resting, 0)
  resting.helper.workers[1].resting = true
  ui = openHelper(farm.view(resting, api()))
  assert.match(ui.text(), /巡逻都在休息，田里暂时没人守/)

  const paused = crew(['harvest', 'patrol'])
  planted(paused, 0)
  paused.helper.enabled = false
  ui = openHelper(farm.view(paused, api()))
  assert.match(ui.text(), /托管暂停 · 偷窃也暂停/)
})

test('旧服务端降级：删掉 view.theft / plot.guarded / loss 后不崩，不显示覆盖卡和徽章', () => {
  const data = crew(['harvest', 'patrol'])
  mature(data, 0, 0.25)
  const view = farm.view(data, api())
  delete view.theft
  for (const plot of view.plots) {
    delete plot.guarded
    delete plot.zone
    delete plot.lossPercent
    delete plot.lossNote
  }
  const ui = renderFarm(view, 'big')
  assert.equal(ui.all('data-farm-patrol-zone').length, 0)
  assert.equal(ui.all('data-farm-guard').length, 0)
  assert.equal(ui.find('data-farm-plot', '0').getAttribute('data-farm-loss'), null)
})

test('无帮工旧单卡：有 theft.latest 时显示最近事件；没有 theft 字段就不显示', () => {
  const data = crew(['harvest'])
  planted(data, 0)
  data.theft = { at: T0 + 12 * H, seq: 2, log: [stolenEvent] }
  const view = farm.view(data, api())
  delete view.helper.workers // 旧服务端单帮工卡片
  delete view.helper.count
  delete view.helper.max
  let ui = openHelper(view)
  assert.match(ui.text(), /最近：2 小时前 · 鸟啄了 1 号地，少收 25%/)

  const plainView = farm.view(data, api())
  delete plainView.theft
  delete plainView.helper.workers
  delete plainView.helper.count
  delete plainView.helper.max
  ui = openHelper(plainView)
  assert.doesNotMatch(ui.text(), /最近：/)
})

test('经典版：被偷过的普通地在提示里写「被偷过，少收 25%」', () => {
  const data = crew(['harvest'])
  planted(data, 6, 'radish', T0 - H) // 不在帮工管区（0–3）
  data.plots[6].loss = 0.25
  data.theft = { at: T0 + 6 * H, seq: 1, log: [{ ...stolenEvent, plot: 6 }] }
  const view = farm.view(data, api())
  const classic = farmClassicFiles()['client.js']
  const ui = renderFarm(view, 'panel', {}, classic)
  ui.find('data-farm-plot', '6').fire('click')
  assert.match(ui.text(), /被偷过，少收 25%/)
})

test('纯 CSS：覆盖卡和守徽章是文本节点，不新增图片/素材引用', () => {
  const data = crew(['harvest', 'patrol'])
  for (let index = 0; index < 4; index += 1) planted(data, index)
  const field = renderFarm(farm.view(data, api()), 'big')
  const badges = field.all('data-farm-guard')
  assert.ok(badges.length > 0, 'badges ' + badges.length)
  for (const badge of badges) assert.equal(badge.tagName.toLowerCase(), 'button')
  const ui = openHelper(farm.view(data, api()))
  const zones = ui.all('data-farm-patrol-zone')
  assert.ok(zones.length > 0, 'zones ' + zones.length)
  for (const zone of zones) assert.equal(zone.tagName.toLowerCase(), 'div')
  const source = readFileSync(new URL('../../../extensions/farm/client.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /fm-patrol-(bird|pig|thief)\.(webp|png)/)
})
