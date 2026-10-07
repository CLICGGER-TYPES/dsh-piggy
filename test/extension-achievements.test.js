// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync } from 'node:fs'
import { ACHIEVEMENTS } from '../data.js'

const CORE_COUNT = ACHIEVEMENTS.filter(item => item.metric !== 'extension').length
import { adopt, achievementsView, hatchEgg, installExtension, migrate, recordExtensionEvent, removeExtension, reset, settleAchievements, validateExtensionEvent } from '../core.js'
import { runExtensionAction } from '../store/ext-actions.js'
const NOW = 1_800_000_000_000
const entry = (state, key) => achievementsView(state).find(item => item.key === key)
const event = (state, source, name, payload) => recordExtensionEvent(state, source, { name, ...payload })

test('extension event schema rejects spoofed sources, bad counts and unbounded data', () => {
  for (const [source, name, payload] of [
    ['farm', 'gold', { total: 1 }], ['__proto__', 'harvest', { total: 1, items: [] }],
    ['farm', 'harvest', { total: -1, items: [] }], ['farm', 'harvest', { total: 1.1, items: [] }],
    ['farm', 'harvest', { total: NaN, items: [] }], ['farm', 'harvest', { total: '1', items: [] }],
    ['farm', 'harvest', { total: 1, items: ['../mine'] }], ['farm', 'harvest', { total: 1, items: Array(129).fill('carrot') }],
    ['farm', 'harvest', { total: 1, items: [], extension: 'mine' }], ['mine', 'depth', null],
  ]) assert.equal(validateExtensionEvent(source, name, payload), null)
  assert.deepEqual(validateExtensionEvent('farm', 'harvest', { total: 2, items: ['carrot', 'carrot'] }), { name: 'harvest', total: 2, items: ['carrot'] })
})

test('repeated and older cumulative reports do not inflate totals or collections', () => {
  const state = hatchEgg(NOW)
  for (const total of [6, 6, 3, 7, 7]) event(state, 'farm', 'harvest', { total, items: ['carrot', 'carrot'] })
  settleAchievements(state, NOW)
  assert.equal(entry(state, 'farm-ten').progress, 7)
  assert.equal(entry(state, 'farm-five').progress, 1)
  assert.equal(entry(state, 'farm-first').firstAt, NOW)
  assert.deepEqual(settleAchievements(state, NOW + 1), [])
  const before = JSON.stringify(state)
  achievementsView(state)
  assert.equal(JSON.stringify(state), before)
})

test('counter baselines reset only for a new installation; memories survive deletion/adoption', () => {
  const state = hatchEgg(NOW)
  installExtension(state, 'farm', {})
  event(state, 'farm', 'harvest', { total: 6, items: ['carrot'] })
  settleAchievements(state, NOW)
  installExtension(state, 'farm', {})
  event(state, 'farm', 'harvest', { total: 6, items: ['carrot'] })
  assert.equal(entry(state, 'farm-ten').progress, 6, 'updating is not a new counter baseline')
  removeExtension(state, 'farm', NOW)
  assert.equal(entry(state, 'farm-ten').availability, 'not-installed')
  assert.equal(entry(state, 'farm-first').acquired, true)
  installExtension(state, 'farm', {})
  event(state, 'farm', 'harvest', { total: 2, items: ['cabbage'] })
  settleAchievements(state, NOW + 1)
  assert.equal(entry(state, 'farm-ten').progress, 8)
  state.dead = true
  adopt(state, NOW + 2)
  installExtension(state, 'farm', {})
  event(state, 'farm', 'harvest', { total: 2, items: ['cabbage'] })
  settleAchievements(state, NOW + 3)
  assert.equal(entry(state, 'farm-ten').acquired, true)
  assert.equal(entry(state, 'farm-ten').firstAt, NOW + 3)
  assert.equal(achievementsView(reset(NOW)).length, CORE_COUNT)
})

test('migration sanitizes optional event saves and silently retains valid historical proof', () => {
  const state = hatchEgg(NOW)
  state.achievements = { events: { farm: { harvest: { total: 10, seen: 10, items: ['carrot', '../bad', 'carrot'] } },
    mine: { depth: { maximum: -10 }, unknown: { total: 999 } }, evil: { any: {} } } }
  const loaded = migrate(JSON.parse(JSON.stringify(state)), NOW)
  assert.equal(loaded.version, 12)
  assert.equal(entry(loaded, 'farm-ten').acquired, true)
  assert.equal(entry(loaded, 'farm-ten').firstAt, null)
  assert.equal(entry(loaded, 'farm-five').progress, 1)
  assert.equal(loaded.achievements.events.evil, undefined)
  assert.equal(loaded.achievements.events.mine.unknown, undefined)
  assert.equal(loaded.pending.filter(item => item.kind === 'achievement').length, 0)
})

test('failed and throwing actions roll back money, inventory, private data and queued events', () => {
  for (const throwing of [false, true]) {
    const state = hatchEgg(NOW)
    installExtension(state, 'farm', { harvests: 0 })
    const before = structuredClone(state)
    const result = runExtensionAction(state, (data, payload, api) => {
      api.spend(10); api.give('apple'); api.say('failed')
      data.harvests = 1
      assert.equal(api.emit('harvest', { total: 1, items: ['carrot'] }), true)
      if (throwing) throw new Error('after report')
      return { ok: false, reason: 'not-ripe' }
    }, { key: 'farm', nowMs: NOW, payload: {} })
    assert.equal(result.ok, false)
    assert.deepEqual(state, before)
  }
})

test('successful actions commit reports once, bound their source and merge notifications', () => {
  const state = hatchEgg(NOW)
  installExtension(state, 'farm', {})
  const result = runExtensionAction(state, (data, payload, api) => {
    assert.equal(api.emit('gold', { total: 1 }), false)
    for (let i = 0; i < 2; i++) api.emit('harvest', { total: 10, items: ['carrot', 'cabbage', 'corn', 'pumpkin', 'tomato'] })
    return { ok: true }
  }, { key: 'farm', payload: {}, nowMs: NOW })
  assert.equal(result.ok, true)
  assert.equal(settleAchievements(state, NOW).length, 3)
  assert.equal(state.pending.filter(item => item.kind === 'achievement').length, 1)
  assert.equal(state.achievements.events.farm.harvest.total, 10)
})

test('uninstalled unseen goals stay out of the catalogue; twelve new pig badge files exist', () => {
  const state = hatchEgg(NOW)
  assert.equal(achievementsView(state).length, CORE_COUNT)
  installExtension(state, 'farm', {})
  assert.equal(achievementsView(state).length, 19)
  for (const item of ACHIEVEMENTS.filter(item => item.extension)) assert.equal(existsSync(new URL('../assets/' + item.art + '.svg', import.meta.url)), true)
})


test('unsupported async actions are refused without a leaked promise rejection or side effects', async () => {
  const state = hatchEgg(NOW)
  installExtension(state, 'farm', {})
  const before = structuredClone(state)
  const result = runExtensionAction(state, async (data, payload, api) => {
    api.spend(10)
    api.emit('harvest', { total: 1, items: ['carrot'] })
    throw new Error('unsupported async test')
  }, { key: 'farm', payload: {}, nowMs: NOW })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(result.reason, 'extension-error')
  assert.deepEqual(state, before)
})
