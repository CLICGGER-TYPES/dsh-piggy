// @ts-check
// 第二期候选验证真实进度、边界、历史补录和持久化，不把背包数量当经历。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adopt, achievementsView, hatchEgg, migrate, settleAchievements } from '../../../core.js'
import { FISH, ALL_SOUVENIRS } from '../../../data.js'
import farm, { setTheft,  CROPS } from '../../../extensions/farm/server.js'

setTheft(false) // 旧用例默认关闭偷窃；巡逻/偷窃规则与 UI 在新文件里单独开
import mine, { generateMap } from '../../../extensions/mine/server.js'
import { NOW, setupExtensions } from '../../helpers/extension-achievements.js'
const entry = (state, key) => achievementsView(state).find(item => item.key === key)
const records = (items, amount) => Object.fromEntries(items.slice(0, amount).map(item => [item.key, { count: 1, firstAt: NOW }]))
const ripe = crop => ({ crop, season: 1, plantedAt: NOW - 40 * 3600000, boostMs: 0, roll: 0, pests: { weed: 1e15, bug: 1e15, dry: 1e15 } })

test('鱼类收藏只认有效图鉴，19到20解锁，出售与读取不改记录', () => {
  const state = hatchEgg(NOW)
  state.dex.fish = records(FISH, 19)
  state.dex.fish.unknown = { count: 99, firstAt: NOW }
  state.dex.fish[FISH[19].key] = { count: 0, firstAt: NOW }
  settleAchievements(state, NOW)
  assert.equal(entry(state, 'fish-twenty').progress, 19)
  state.dex.fish[FISH[19].key].count = 1
  assert.ok(settleAchievements(state, NOW + 1).some(item => item.key === 'fish-twenty'))
  const saved = JSON.stringify(state)
  assert.equal(entry(state, 'fish-twenty').firstAt, NOW + 1)
  assert.equal(JSON.stringify(state), saved)
  assert.deepEqual(settleAchievements(state, NOW + 2), [])
})

test('百条鱼跨代累计，99未达成，新一代一条后解锁', () => {
  const state = hatchEgg(NOW)
  state.stats.fishCaught = 99
  settleAchievements(state, NOW)
  assert.equal(entry(state, 'fish-hundred').acquired, false)
  state.dead = true
  adopt(state, NOW + 1)
  state.hatched = true
  state.stats.fishCaught = 1
  settleAchievements(state, NOW + 2)
  assert.equal(entry(state, 'fish-hundred').acquired, true)
  assert.equal(state.achievements.totals.fishCaught, 100)
  assert.deepEqual(settleAchievements(state, NOW + 3), [])
})

test('纪念品9到10解锁，同种数量和无效key不增加种类', () => {
  const state = hatchEgg(NOW)
  state.dex.souvenirs = records(ALL_SOUVENIRS, 9)
  state.dex.souvenirs[ALL_SOUVENIRS[0].key].count = 100
  state.dex.souvenirs.unknown = { count: 1, firstAt: NOW }
  settleAchievements(state, NOW)
  assert.equal(entry(state, 'souvenirs-ten').progress, 9)
  state.dex.souvenirs[ALL_SOUVENIRS[9].key] = { count: 1, firstAt: NOW }
  settleAchievements(state, NOW + 1)
  assert.equal(entry(state, 'souvenirs-ten').firstAt, NOW + 1)
})

test('旧档第二期成就静默补录，不编日期、不改金币和背包', () => {
  const state = hatchEgg(NOW)
  state.stats.fishCaught = 100
  state.dex.fish = records(FISH, 20)
  state.dex.souvenirs = records(ALL_SOUVENIRS, 10)
  const before = { coins: state.coins, inventory: structuredClone(state.inventory) }
  const loaded = migrate(state, NOW + 1)
  for (const key of ['fish-twenty', 'fish-hundred', 'souvenirs-ten']) {
    assert.equal(entry(loaded, key).firstAt, null)
    assert.equal(entry(loaded, key).recovered, true)
  }
  assert.deepEqual({ coins: loaded.coins, inventory: loaded.inventory }, before)
  assert.equal(loaded.pending.some(item => item.kind === 'achievement'), false)
})

test('真实菜园99次再收一块解锁100次，25个产物只记一次，重复拒绝且重载保留', async () => {
  const data = farm.init()
  data.harvests = { carrot: 99 }
  data.plots[0] = ripe('carrot')
  const setup = await setupExtensions({ farm: data })
  try {
    assert.equal(entry(setup.store.state, 'farm-hundred').progress, 99)
    assert.equal(setup.runtime.act('farm', 'harvest', { plot: 0 }).ok, true)
    assert.equal(entry(setup.store.state, 'farm-hundred').firstAt, NOW)
    assert.equal(setup.store.state.achievements.events.farm.harvest.total, 100)
    assert.equal(setup.runtime.act('farm', 'harvest', { plot: 0 }).ok, false)
    assert.equal(setup.store.state.achievements.events.farm.harvest.total, 100)
    setup.store.flush()
    const loaded = migrate(JSON.parse(readFileSync(join(setup.dir, 'state.json'), 'utf8')), NOW + 1)
    assert.equal(entry(loaded, 'farm-hundred').firstAt, NOW)
  } finally { setup.dispose() }
})

test('真实菜园第15种收获解锁，库存和第14种重复数量不算新种', async () => {
  const data = farm.init()
  data.harvests = Object.fromEntries(CROPS.slice(0, 14).map(crop => [crop.key, 1]))
  data.harvest = { [CROPS[14].key]: 999 }
  data.plots[0] = ripe(CROPS[14].key)
  const setup = await setupExtensions({ farm: data })
  try {
    assert.equal(entry(setup.store.state, 'farm-fifteen').progress, 14)
    assert.equal(setup.runtime.act('farm', 'harvest', { plot: 0 }).ok, true)
    assert.equal(entry(setup.store.state, 'farm-fifteen').firstAt, NOW)
    assert.equal(setup.store.state.achievements.events.farm.harvest.items.length, 15)
  } finally { setup.dispose() }
})

test('真实矿洞从19层下到20层解锁，未发现梯子拒绝，失败不修改经历', async () => {
  const data = mine.init()
  data.layer = 19; data.deepest = 19; data.pickaxe = 5
  data.maps[19] = { open: [0, 1, 2, 3, 4, 5], hits: {} }
  const setup = await setupExtensions({ mine: data })
  try {
    assert.equal(entry(setup.store.state, 'mine-twenty').progress, 19)
    const before = structuredClone(setup.store.state.achievements)
    assert.equal(setup.runtime.act('mine', 'descend', {}).ok, false)
    assert.deepEqual(setup.store.state.achievements, before)
    const ladder = generateMap(19, data.run, 5).findIndex(cell => cell.kind === 'ladder')
    setup.store.mutate(state => { state.extData.mine.maps[19].open.push(ladder); return { ok: true } })
    assert.equal(setup.runtime.act('mine', 'descend', {}).ok, true)
    assert.equal(entry(setup.store.state, 'mine-twenty').firstAt, NOW)
    assert.equal(setup.runtime.act('mine', 'descend', {}).ok, false)
    assert.equal(entry(setup.store.state, 'mine-twenty').firstAt, NOW)
  } finally { setup.dispose() }
})
