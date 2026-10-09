// G2 照料数值（docs/numbers/G2-care-balance.md，用户 2026-10-05 确认）
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACTIONS, CLEANLINESS_DECAY_PER_MIN, HAPPINESS_DECAY_PER_MIN, SATIETY_DECAY_PER_MIN } from '../packages/pet-core/src/core/constants.js'
import { ILLNESS_ONSET, SHOP } from '../packages/pet-core/src/data.js'

test('G2：食物一律不扣清洁；洗澡、玩耍的副作用减半；胀气只在 100% 还硬喂，15%', () => {
  for (const item of SHOP.filter(i => i.kind === 'food')) assert.ok(!(item.cleanliness < 0), item.label)
  assert.equal(ACTIONS.bathe.satiety, -1)
  assert.equal(ACTIONS.play.cleanliness, -2)
  const by = key => SHOP.find(i => i.key === key)
  assert.equal(by('sauna').satiety, -4)
  assert.equal(by('deadsea').satiety, -3)
  assert.deepEqual(['scooter', 'rccar', 'trampoline', 'bubbles', 'carousel'].map(k => by(k).cleanliness), [-3, -3, -4, -4, -4])
  assert.equal(ILLNESS_ONSET.overfullAt, 100)
  assert.equal(ILLNESS_ONSET.overfeedChance, 0.15)
  assert.equal(Math.round(HAPPINESS_DECAY_PER_MIN * 60 * 10) / 10, 2.4)
  assert.equal(Math.round(CLEANLINESS_DECAY_PER_MIN * 60 * 10) / 10, 3.6)
  assert.equal(Math.round(SATIETY_DECAY_PER_MIN * 60 * 10) / 10, 4.8)
})
