// @ts-check
/**
 * 恶魔猪：不是加冕来的，是签来的。
 *
 * 条件与猪猪王一样从严（Lv40 / 武力 20 / 魅力 20 / 本代玩耍 20），但入口是商店的
 * 「😈 恶魔契约」在背包里使用 —— 加冕是给王的动词，恶魔只能签约。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { act, adopt, buy, crown, formStageView, formsView, hatchEgg, migrate, revive, signContract, useItem } from '../../../src/host/core.js'
import { KIND_ORDER, itemByKey, xpForLevel } from '../../../src/host/data.js'
import { createStore } from '../../../src/host/store.js'
const NOW = 1_800_000_000_000
function ready(level = 40) {
  const state = hatchEgg(NOW)
  Object.assign(state, { xp: xpForLevel(level), traits: { intel: 0, strong: 20, charm: 20 }, happiness: 10, coins: 99_999 })
  state.stats.plays = 20
  state.inventory = { ...state.inventory, contract: 1 }
  return state
}
const devil = state => formsView(state).forms.find(form => form.key === 'devil')

test('devil uses level, strength, charm and successful plays as independent boundaries', () => {
  for (const [key, value] of [['level', 39], ['strong', 19], ['charm', 19], ['plays', 19]]) {
    const state = ready(key === 'level' ? value : 40)
    if (key === 'plays') state.stats.plays = value
    else if (key !== 'level') state.traits[key] = value
    assert.equal(devil(state).ready, false, key)
    assert.deepEqual(signContract(state, 'devil', NOW).missing.map(row => row.key), [key])
    assert.equal(state.form, null)
  }
  const state = ready()
  assert.equal(devil(state).ready, true)
  assert.equal(state.form, null, 'meeting conditions never changes the form automatically')
  assert.deepEqual(devil(state).requirements.map(row => [row.key, row.have, row.need]), [['level', 40, 40], ['strong', 20, 20], ['charm', 20, 20], ['plays', 20, 20]])
  assert.equal(signContract(state, 'devil', NOW).ok, true, 'no intelligence, work or happiness gate')
})

test('加冕 is the wrong door for the devil, and the command says so', () => {
  const state = ready()
  assert.equal(devil(state).via, 'item')
  assert.equal(devil(state).item, 'contract')
  const refused = crown(state, NOW, 'devil')
  assert.equal(refused.ok, false)
  assert.equal(refused.reason, 'needs-contract')
  assert.equal(refused.form, 'devil')
  assert.equal(state.form, null, 'a refused 加冕 changes nothing')
  // …and the king still comes through it.
  Object.assign(state.traits, { intel: 20 })
  state.stats.jobs = 10
  state.inventory.crown = 1
  assert.equal(crown(state, NOW, 'king').ok, true)
  assert.equal(state.form, 'king')
})

test('the contract shares the promotion shelf and its refusal does not spend it', () => {
  const item = itemByKey('contract')
  assert.equal(item.kind, 'promotion')
  assert.equal(item.form, 'devil')
  assert.ok(KIND_ORDER.includes('promotion'), 'the shelf is part of the shop order')
  // The tile has no room for the numbers, so the blurb says what it does; the
  // exact shortfall is spelled out by the refusal (covered in host.test.js).
  assert.match(item.blurb, /恶魔猪/, 'the blurb says what it turns the pig into')

  const state = ready()
  Object.assign(state, { coins: 99_999 })
  assert.equal(buy(state, 'contract', NOW).ok, true)
  assert.equal(state.inventory.contract, 2, 'one from the seed, one bought')

  state.stats.plays = 19
  const refused = useItem(state, 'contract', NOW)
  assert.equal(refused.ok, false)
  assert.equal(refused.reason, 'contract-ineligible')
  assert.deepEqual(refused.missing.map(row => row.key), ['plays'])
  assert.equal(state.inventory.contract, 2, 'a refused contract stays in the bag')
  assert.equal(state.form, null)

  state.stats.plays = 20
  const signed = useItem(state, 'contract', NOW)
  assert.equal(signed.ok, true)
  assert.equal(signed.form, 'devil')
  assert.equal(state.inventory.contract, 1, 'a signed contract is spent')
  assert.equal(state.form, 'devil')
  assert.ok(state.pending.some(entry => entry.kind === 'line' && entry.scene === 'contract'))

  // Signing again is refused rather than silently burning another one.
  const again = useItem(state, 'contract', NOW)
  assert.equal(again.ok, false)
  assert.equal(again.reason, 'already')
  assert.equal(state.inventory.contract, 1)
})

test('consecutive play actions reach the contract threshold', () => {
  const state = ready()
  state.stats.plays = 18
  assert.equal(act(state, 'play', NOW).ok, true)
  assert.equal(state.stats.plays, 19)
  assert.equal(devil(state).ready, false)
  assert.equal(act(state, 'play', NOW).ok, true)
  assert.equal(state.stats.plays, 20)
  assert.equal(signContract(state, 'devil', NOW).ok, true)
})

test('devil stays selected when unhappy, is idempotent, and can switch to king', () => {
  const state = ready()
  assert.equal(signContract(state, 'devil', NOW).ok, true)
  const announcements = state.pending.length
  state.happiness = 0
  assert.equal(signContract(state, 'devil', NOW).reason, 'already')
  assert.equal(state.pending.length, announcements)
  const view = formStageView(state, NOW)
  assert.equal(view.art, 'pig-devil')
  assert.equal(view.label, '恶魔猪')
  assert.equal(view.actionArt, true)
  assert.deepEqual(view.hides, ['head', 'back'])
  state.traits.intel = 20
  state.stats.jobs = 10
  state.inventory.crown = 1
  assert.equal(crown(state, NOW).ok, true, 'king remains the default')
  assert.equal(state.form, 'king')
  state.inventory.contract = 1
  assert.equal(signContract(state, 'devil', NOW).ok, true, 'and the contract can take it back')
  assert.equal(state.form, 'devil')
})

test('dead pigs cannot sign; revival keeps it and adoption clears generation progress', () => {
  const state = ready()
  signContract(state, 'devil', NOW)
  state.dead = true
  state.health = 0
  assert.equal(signContract(state, 'devil', NOW).reason, 'dead')
  revive(state, NOW)
  assert.equal(state.form, 'devil')
  state.dead = true
  const fresh = adopt(state, NOW)
  assert.equal(fresh.form, null)
  assert.equal(fresh.stats.plays, 0)
  assert.equal(formsView(fresh).forms.every(form => !form.ready), true, 'adoption starts with an unhatched box')
})

test('devil survives a saved state and reopen without a schema upgrade', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devil-save-'))
  const path = join(dir, 'state.json')
  let store
  try {
    writeFileSync(path, JSON.stringify(ready()))
    store = createStore(path, { now: () => NOW })
    assert.equal(store.useItem('contract').ok, true)
    store.dispose()
    const saved = JSON.parse(readFileSync(path, 'utf8'))
    assert.equal(saved.form, 'devil')
    assert.equal(saved.inventory.contract, 0)
    assert.equal(migrate(saved, NOW).form, 'devil')
    store = createStore(path, { now: () => NOW })
    assert.equal(store.state.form, 'devil')
    assert.equal(store.state.stats.plays, 20)
  } finally {
    store?.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})
