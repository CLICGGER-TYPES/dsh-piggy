// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { achievementsView, migrate } from '../core.js'
import farm from '../extensions/farm/server.js'
import mine, { dayKey, generateMap, hitsNeeded } from '../extensions/mine/server.js'
import gacha from '../extensions/gacha/server.js'
import blindbox, { CATALOG } from '../extensions/blindbox/server.js'
import { snapshot } from '../snapshot.js'
import { KEYS, NOW, setupExtensions } from './helpers/extension-achievements.js'
const entry = (state, key) => achievementsView(state).find(item => item.key === key)

test('all four real extensions download and install with compatible manifests', async () => {
  const setup = await setupExtensions()
  try {
    for (const key of KEYS) assert.equal((await setup.runtime.install(key)).ok, true)
    assert.equal(achievementsView(setup.store.state).length, 28)
    assert.equal(setup.runtime.list(setup.store.state).length, 4)
  } finally { setup.dispose() }
})

test('real farm harvest unlocks; unripe/duplicate attempts and sale do not add progress', async () => {
  const data = farm.init(); data.plots[0] = { crop: 'carrot', stage: 3, wateredAt: null }
  const setup = await setupExtensions({ farm: data })
  try {
    const { runtime, store } = setup
    assert.equal(runtime.act('farm', 'harvest', { plot: 0 }).ok, true)
    assert.equal(entry(store.state, 'farm-first').acquired, true)
    assert.equal(entry(store.state, 'farm-first').firstAt, NOW)
    assert.equal(runtime.act('farm', 'harvest', { plot: 0 }).ok, false)
    assert.equal(entry(store.state, 'farm-ten').progress, 1)
    assert.equal(runtime.act('farm', 'sell', { item: 'carrot', count: 4 }).ok, true)
    assert.equal(entry(store.state, 'farm-five').progress, 1)
    store.dispose()
    const loaded = migrate(JSON.parse(readFileSync(join(setup.dir, 'state.json'), 'utf8')), NOW)
    assert.equal(entry(loaded, 'farm-first').firstAt, NOW)
    assert.equal(entry(loaded, 'farm-ten').progress, 1)
  } finally { setup.dispose() }
})

test('real mine cracks are not ore; discovery and descent report completed facts', async () => {
  const data = mine.init(); data.day = dayKey(NOW)
  const map = generateMap(1, data.day)
  const ore = map.findIndex(cell => cell.kind === 'ore')
  assert.ok(ore >= 6)
  data.maps[1] = { open: map.map((_, index) => index).filter(index => index !== ore), hits: {} }
  const setup = await setupExtensions({ mine: data })
  try {
    const { runtime, store } = setup
    assert.equal(runtime.act('mine', 'dig', { cell: ore }).ok, true)
    assert.equal(entry(store.state, 'mine-first').acquired, false)
    assert.equal(runtime.act('mine', 'dig', { cell: ore }).ok, true)
    assert.equal(entry(store.state, 'mine-first').acquired, true)
    assert.equal(runtime.act('mine', 'dig', { cell: ore }).ok, false)
    const current = store.state.extData.mine
    current.layer = 9
    const ladder = generateMap(9, current.day).findIndex(cell => cell.kind === 'ladder')
    current.maps[9] = { open: [0, 1, 2, 3, 4, 5, ladder], hits: {} }
    assert.equal(runtime.act('mine', 'descend', {}).ok, true)
    assert.equal(entry(store.state, 'mine-deep').acquired, true)
    assert.equal(runtime.act('mine', 'descend', {}).ok, false)
  } finally { setup.dispose() }
})

test('three real gacha machines, free spins and guaranteed gold all unlock correctly', async () => {
  const data = gacha.init(); data.luck = 20
  const setup = await setupExtensions({ gacha: data })
  try {
    const { runtime, store } = setup
    const coins = store.state.coins
    assert.equal(runtime.act('gacha', 'spin', { machine: 'snack', count: 1 }).ok, true)
    assert.equal(store.state.coins, coins)
    assert.equal(entry(store.state, 'gacha-first').acquired, true)
    assert.equal(entry(store.state, 'gacha-gold').acquired, true)
    for (const machine of ['goods', 'medicine']) assert.equal(runtime.act('gacha', 'spin', { machine, count: 1 }).ok, true)
    assert.equal(entry(store.state, 'gacha-machines').acquired, true)
    assert.equal(runtime.act('gacha', 'spin', { machine: 'unknown', count: 10 }).ok, false)
    assert.equal(store.state.achievements.events.gacha.spin.total, 3)
  } finally { setup.dispose() }
})

test('real blindbox certificates count as figures/six-star; duplicate trades are refused', async () => {
  const data = blindbox.init(); data.certs = 300
  const setup = await setupExtensions({ blindbox: data })
  try {
    const { runtime, store } = setup
    assert.equal(runtime.act('blindbox', 'buy', { item: 'pick6', pick: 'goldpig' }).ok, true)
    assert.equal(entry(store.state, 'blindbox-first').acquired, true)
    assert.equal(entry(store.state, 'blindbox-six').acquired, true)
    assert.equal(entry(store.state, 'blindbox-ten').progress, 1)
    const coins = store.state.coins
    assert.equal(runtime.act('blindbox', 'buy', { item: 'pick6', pick: 'goldpig' }).ok, false)
    assert.equal(store.state.coins, coins)
    assert.equal(entry(store.state, 'blindbox-ten').progress, 1)
  } finally { setup.dispose() }
})

test('historical hooks backfill only available proof, silently and without dates', async () => {
  const farmData = farm.init(); farmData.acquired = { carrot: 40, cabbage: 3 }
  const mineData = mine.init(); mineData.layer = 10; mineData.found = { bone: true, fish: true, trex: true }; mineData.bag = { copper: 1 }
  const gachaData = gacha.init(); gachaData.history = [{ key: 'feast', rarity: 'gold', count: 3 }]; gachaData.last = { machine: 'snack', items: gachaData.history }
  const blindData = blindbox.init(); blindData.owned = Object.fromEntries(CATALOG.slice(0, 10).map(item => [item.key, 1]))
  const setup = await setupExtensions({ farm: farmData, mine: mineData, gacha: gachaData, blindbox: blindData })
  try {
    for (const key of ['farm-ten', 'mine-fossils', 'mine-deep', 'gacha-gold', 'blindbox-ten', 'blindbox-six']) {
      const badge = entry(setup.store.state, key)
      assert.equal(badge.acquired, true, key)
      assert.equal(badge.firstAt, null)
      assert.equal(badge.recovered, true)
    }
    assert.equal(entry(setup.store.state, 'gacha-machines').progress, 1, 'unknown historical machines are not invented')
    assert.equal(setup.store.state.pending.filter(item => item.kind === 'achievement').length, 0)
    const before = JSON.stringify(setup.store.state.achievements)
    setup.runtime.views(setup.store.state); setup.runtime.views(setup.store.state)
    assert.equal(JSON.stringify(setup.store.state.achievements), before)
    assert.equal((await setup.runtime.install('farm')).ok, true)
    assert.equal(entry(setup.store.state, 'farm-ten').firstAt, null)
    assert.equal(setup.store.state.achievements.events.farm.harvest.total, 11)
  } finally { setup.dispose() }
})

test('disabled extensions reject actions; uninstall preserves progress and reinstallation resumes', async () => {
  const data = farm.init(); data.acquired = { carrot: 24 }
  const setup = await setupExtensions({ farm: data })
  try {
    const { runtime, store } = setup
    store.setExtension('farm', false)
    assert.equal(runtime.act('farm', 'harvest', { plot: 0 }).reason, 'extension-off')
    assert.equal(entry(store.state, 'farm-ten').availability, 'off')
    assert.equal(runtime.remove('farm').ok, true)
    assert.equal(entry(store.state, 'farm-ten').progress, 6)
    assert.equal(entry(store.state, 'farm-ten').availability, 'not-installed')
    assert.equal((await runtime.install('farm')).ok, true)
    store.state.extData.farm.plots[0] = { crop: 'carrot', stage: 3, wateredAt: null }
    assert.equal(runtime.act('farm', 'harvest', { plot: 0 }).ok, true)
    assert.equal(entry(store.state, 'farm-ten').progress, 7)
  } finally { setup.dispose() }
})


test('legacy extensions still run, while their locked goals explain that an update is needed', async () => {
  const setup = await setupExtensions({ farm: {} }, { farm: { 'server.js': "export default { actions: { buy(data) { data.bought = true; return { ok: true } } }, view() { return {} } }" } })
  try {
    assert.equal(setup.runtime.act('farm', 'buy', {}).ok, true)
    const view = snapshot(setup.store, { drain: false }).dex.achievements
    assert.equal(view.find(item => item.key === 'farm-first').availability, 'update-required')
    assert.equal(entry(setup.store.state, 'farm-first').acquired, false)
  } finally { setup.dispose() }
})
