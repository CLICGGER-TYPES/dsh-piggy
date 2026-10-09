import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STATE_VERSION, applyDevPatch, callOffActivity, castFishing, ensureFishing, feedFish, finishActivity, grantFish, hatchEgg,
  hookFishing, keepFish, migrate, resolveFishing, sellFish, startAutoFishing,
} from '../packages/pet-core/src/core.js'
import { FISH, FISH_FIGHTS, SHOP } from '../packages/pet-core/src/data.js'

const NOW = new Date(2026, 9, 2, 19, 0).getTime()
const fresh = () => { const state = hatchEgg(NOW); state.inventory.bait_worm = 40; return state }

test('fish table: the 15 C5 fish plus 25 new ones (J1), every fish lives in one of the four spots', () => {
  assert.equal(FISH.length, 40)
  assert.deepEqual(Object.fromEntries(['river', 'lake', 'sea', 'night'].map(spot => [spot, FISH.filter(f => f.spot === spot).length])), { river: 12, lake: 10, sea: 11, night: 7 })
  assert.deepEqual(FISH.filter(f => f.rarity === 'legend').map(f => f.label), ['月影鱼', '湖中巨影', '小鲸鲨', '夜之鲸'])
  assert.ok(FISH.filter(f => f.spot === 'night').every(f => f.times.length === 1 && f.times[0] === 'night'), 'the night pond only has night fish')
  for (const fish of FISH) {
    assert.match(fish.key, /^fish_/)
    assert.ok(fish.price >= 6 && fish.price <= 1500)
    assert.ok(fish.difficulty >= 1 && fish.difficulty <= 100)
    assert.ok(fish.times.length > 0)
  }
})

test('every cast spends the selected bait and rejects an empty bait bag', () => {
  const state = fresh()
  delete state.inventory.bait_worm
  assert.equal(castFishing(state, 0.7, NOW, () => 0.2, 'bait_worm').reason, 'no-bait')
  state.inventory.bait_worm = 2
  assert.equal(castFishing(state, 0.7, NOW, () => 0.2, 'bait_worm').ok, true)
  assert.equal(state.inventory.bait_worm, 1)
  assert.equal(SHOP.filter(item => item.kind === 'bait').length >= 3, true)
})

test('automatic fishing consumes bait per attempt and puts catches in the bag without selling', () => {
  const state = fresh()
  state.inventory.bait_worm = 10
  const coins = state.coins
  assert.equal(startAutoFishing(state, 30, NOW, 'bait_worm').ok, true)
  assert.equal(state.inventory.bait_worm ?? 0, 0)
  finishActivity(state, state.activity.endsAt, () => 0)
  assert.equal(state.coins, coins)
  assert.ok(state.fishing.bag.length > 0)
})

test('calling auto fishing off before settlement returns its reserved bait', () => {
  const state = fresh()
  state.inventory.bait_shrimp = 10
  assert.equal(startAutoFishing(state, 30, NOW, 'bait_shrimp').ok, true)
  assert.equal(state.inventory.bait_shrimp, undefined)
  assert.equal(callOffActivity(state, NOW + 1000).ok, true)
  assert.equal(state.inventory.bait_shrimp, 10)
})

test('better bait increases rare and legendary catches for the same rolls', () => {
  const night = new Date(2026, 9, 2, 23, 0).getTime()
  const rareCount = baitKey => {
    let count = 0
    for (let step = 0; step < 1000; step += 1) {
      const state = fresh()
      state.inventory[baitKey] = 1
      const result = castFishing(state, .7, night, () => (step + .5) / 1000, baitKey)
      if (['rare', 'legend'].includes(result.fish.rarity)) count += 1
    }
    return count
  }
  assert.ok(rareCount('bait_glow') > rareCount('bait_shrimp'))
  assert.ok(rareCount('bait_shrimp') > rareCount('bait_worm'))
})

test('a cast tires the pig by half a point and pins one pending fish; the bamboo rod bites in 14–32 s', () => {
  const state = fresh()
  const before = state.satiety
  const result = castFishing(state, 0.8, NOW, () => 0.25, 'bait_worm')
  assert.equal(result.ok, true)
  assert.equal(state.satiety, before, 'half a point is saved up, not taken yet')
  assert.equal(state.fishing.pending.key, result.fish.key)
  assert.equal(state.fishing.pending.expiresAt, NOW + 60_000)
  assert.ok(state.fishing.pending.bitesAt >= NOW + 14_000)
  assert.ok(state.fishing.pending.bitesAt <= NOW + 32_000)
  assert.equal(castFishing(state, 0.2, NOW + 100, () => 0.9, 'bait_worm').reason, 'pending')
  state.fishing.pending = null
  castFishing(state, 0.2, NOW + 100, () => 0.9, 'bait_worm')
  assert.equal(state.satiety, before - 1, 'two casts make one whole point')
  // 用户 2026-10-09：猪在打工也能钓；只有猪正在自动钓鱼时不能再手动钓。
  state.activity = { kind: 'work', key: 'x', startedAt: NOW, endsAt: NOW + 60_000 }
  state.fishing.pending = null
  assert.equal(castFishing(state, 0.2, NOW + 100, () => 0.9, 'bait_worm').ok, true, 'fishing while the pig is at work')
  state.activity = { kind: 'fishing', key: 'auto-30', startedAt: NOW, endsAt: NOW + 60_000 }
  state.fishing.pending = null
  assert.equal(castFishing(state, 0.2, NOW + 200, () => 0.9, 'bait_worm').reason, 'away')
})

test('hook window, minigame verdict and bag transfer cannot duplicate a fish', () => {
  const state = fresh()
  castFishing(state, 0.5, NOW, () => 0, 'bait_worm')
  const bite = state.fishing.pending.bitesAt
  assert.equal(hookFishing(state, bite - 1).reason, 'early')
  assert.equal(hookFishing(state, bite).ok, true)
  assert.equal(resolveFishing(state, true, bite + 500).ok, true)
  const id = state.fishing.pending.id
  assert.equal(keepFish(state, bite + 600).ok, true)
  assert.equal(state.fishing.bag.length, 1)
  assert.equal(state.fishing.bag[0].id, id)
  assert.equal(keepFish(state, bite + 700).reason, 'none')
  assert.equal(state.dex.fish[state.fishing.bag[0].key].maxSizeCm, state.fishing.bag[0].sizeCm)
})

test('missing a bite or losing the minigame clears pending', () => {
  const late = fresh()
  castFishing(late, 0, NOW, () => 0, 'bait_worm')
  assert.equal(hookFishing(late, late.fishing.pending.bitesAt + 1500).ok, true, 'the bite remains clickable for two seconds')
  const tooLate = fresh()
  castFishing(tooLate, 0, NOW, () => 0, 'bait_worm')
  assert.equal(hookFishing(tooLate, tooLate.fishing.pending.bitesAt + 2001).reason, 'escaped')
  assert.equal(tooLate.fishing.pending, null)

  const lost = fresh()
  castFishing(lost, 0, NOW, () => 0, 'bait_worm')
  hookFishing(lost, lost.fishing.pending.bitesAt)
  assert.equal(resolveFishing(lost, false, NOW + 3000).ok, true)
  assert.equal(lost.fishing.pending, null)
})

test('caught fish can be fed or sold and dex keeps the largest size', () => {
  const state = fresh()
  state.satiety = 10
  const first = grantFish(state, FISH[0].key, NOW, 12.3)
  const second = grantFish(state, FISH[0].key, NOW + 1, 19.8)
  assert.equal(state.dex.fish[FISH[0].key].maxSizeCm, 19.8)
  assert.equal(feedFish(state, first.id, NOW + 2).ok, true)
  assert.equal(state.satiety, Math.min(70, 10 + FISH[0].price / 2))
  const coins = state.coins
  assert.equal(sellFish(state, second.id, NOW + 3).ok, true)
  assert.equal(state.coins, coins + FISH[0].price)
})

test('auto fishing occupies the pig and keeps catches; no daily cap, only bait', () => {
  const state = fresh()
  const first = startAutoFishing(state, 30, NOW, 'bait_worm')
  assert.equal(first.ok, true)
  assert.equal(state.activity.kind, 'fishing')
  const coins = state.coins
  finishActivity(state, state.activity.endsAt, () => 0)
  assert.equal(state.coins, coins)
  assert.ok(state.fishing.bag.length > 0)
  assert.equal(state.stats.fishingAuto, 1)
  assert.equal(startAutoFishing(state, 60, NOW + 31 * 60_000, 'bait_worm').ok, true)
  finishActivity(state, state.activity.endsAt, () => 0)
  // rc.1 反馈：不限次数，鱼饵够就能去。
  state.inventory.bait_worm = 10
  assert.equal(startAutoFishing(state, 30, NOW + 92 * 60_000, 'bait_worm').ok, true)
  finishActivity(state, state.activity.endsAt, () => 0)
  assert.equal(startAutoFishing(state, 30, NOW + 123 * 60_000, 'bait_worm').reason, 'no-bait')
})

test('old saves gain sanitized fishing fields without a save-version bump', () => {
  const old = fresh()
  delete old.fishing
  const migrated = migrate(old, NOW)
  assert.equal(migrated.version, STATE_VERSION)
  assert.deepEqual(migrated.fishing.bag, [])
  assert.equal(migrated.fishing.pending, null)
})

test('developer fast-forward settles an automatic fishing activity', () => {
  const state = fresh()
  startAutoFishing(state, 30, NOW, 'bait_worm')
  applyDevPatch(state, { __advanceMs: 30 * 60_000 }, NOW)
  assert.equal(state.activity, null)
  assert.equal(state.stats.fishingAuto, 1)
})

test('a hooked fish gets one of the three fights, kept in the save', () => {
  const seen = new Set()
  for (let i = 0; i < 30; i += 1) {
    const state = fresh()
    state.seed = 1000 + i * 7919
    castFishing(state, 0.5, NOW, () => 0, 'bait_worm')
    const bite = state.fishing.pending.bitesAt
    assert.equal(hookFishing(state, bite).ok, true)
    assert.ok(FISH_FIGHTS.includes(state.fishing.pending.fight), state.fishing.pending.fight)
    seen.add(state.fishing.pending.fight)
    // 存档清洗时保留玩法。
    ensureFishing(state)
    assert.ok(FISH_FIGHTS.includes(state.fishing.pending.fight))
  }
  assert.equal(seen.size, 3, 'all three fights come up')
})
