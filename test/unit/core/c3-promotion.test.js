// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crown, hatchEgg, migrate, useItem } from '../../../core.js'
import { FORMS, KIND_ORDER, SHOP, itemByKey, xpForLevel } from '../../../data.js'

const NOW = 1_800_000_000_000

function readyKing() {
  const state = hatchEgg(NOW)
  state.xp = xpForLevel(40)
  state.traits = { intel: 20, charm: 20, strong: 20 }
  state.stats.jobs = 10
  state.coins = 99_999
  return state
}

test('both forms use promotion items from one shelf with the agreed prices', () => {
  assert.deepEqual(FORMS.map(form => [form.key, form.via, form.item]), [
    ['king', 'item', 'crown'], ['devil', 'item', 'contract'],
  ])
  assert.equal(itemByKey('crown').price, 3000)
  assert.equal(itemByKey('crown').kind, 'promotion')
  assert.equal(itemByKey('crown').useLabel, '加冕')
  assert.equal(itemByKey('contract').price, 6666)
  assert.equal(itemByKey('contract').kind, 'promotion')
  assert.equal(itemByKey('contract').useLabel, '签约')
  assert.deepEqual(SHOP.filter(item => item.kind === 'promotion').map(item => item.key), ['crown', 'contract'])
  assert.ok(KIND_ORDER.includes('promotion'))
})

test('king needs a bought crown; unmet conditions leave it in the bag', () => {
  const state = readyKing()
  assert.equal(crown(state, NOW).reason, 'needs-item')
  assert.equal(state.form, null)
  state.inventory.crown = 1
  state.stats.jobs = 9
  const refused = useItem(state, 'crown', NOW)
  assert.equal(refused.reason, 'coronation-ineligible')
  assert.deepEqual(refused.missing.map(row => row.key), ['jobs'])
  assert.equal(state.inventory.crown, 1)
  state.stats.jobs = 10
  assert.equal(crown(state, NOW).ok, true)
  assert.equal(state.inventory.crown, 0)
  assert.equal(state.form, 'king')
})

test('contract follows the same item path and does not spend on refusal', () => {
  const state = readyKing()
  state.traits.intel = 0
  state.stats.plays = 19
  state.inventory.contract = 1
  const refused = useItem(state, 'contract', NOW)
  assert.equal(refused.reason, 'contract-ineligible')
  assert.deepEqual(refused.missing.map(row => row.key), ['plays'])
  assert.equal(state.inventory.contract, 1)
  state.stats.plays = 20
  assert.equal(useItem(state, 'contract', NOW).ok, true)
  assert.equal(state.inventory.contract, 0)
  assert.equal(state.form, 'devil')
})

test('an old king stays king and an old wearable crown becomes a crown item, without a version bump', () => {
  const old = readyKing()
  old.form = 'king'
  old.dress = ['crown']
  old.worn = ['crown']
  const loaded = migrate(old, NOW)
  assert.equal(loaded.version, old.version)
  assert.equal(loaded.form, 'king')
  assert.deepEqual(loaded.dress, [])
  assert.deepEqual(loaded.worn, [])
  assert.equal(loaded.inventory.crown, 1, 'the 5200 they paid turns into one crown item')
  const again = migrate(loaded, NOW)
  assert.equal(again.inventory.crown, 1, 'loading it again gives nothing more')
})

test('a C3-era 礼冠 also becomes a crown item', () => {
  const old = readyKing()
  old.dress = ['scarf', 'royal-crown']
  old.worn = ['royal-crown']
  const loaded = migrate(old, NOW)
  assert.deepEqual(loaded.dress, ['scarf'])
  assert.deepEqual(loaded.worn, [])
  assert.equal(loaded.inventory.crown, 1)
})
