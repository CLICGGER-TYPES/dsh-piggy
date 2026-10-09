import test from 'node:test'
import assert from 'node:assert/strict'

import { buyRod, castFishing, chooseSpot, ensureFishing, fightFeel, fishingView, hatchEgg, hookFishing, spotOpen, startAutoFishing } from '../packages/pet-core/src/core.js'
import { FISH, FISH_FEEL, FISH_SPOTS, RODS } from '../packages/pet-core/src/data.js'
import { INCOME_LINES } from '../packages/pet-core/src/data/economy.js'

const EVENING = new Date(2026, 9, 2, 19, 0).getTime()
const NIGHT = new Date(2026, 9, 2, 23, 0).getTime()
const fresh = () => { const state = hatchEgg(EVENING); state.inventory.bait_worm = 40; return state }

test('钓鱼 2.0：新猪拿竹竿、只开小河；老存档没有鱼竿的送碳素竿', () => {
  const state = fresh()
  assert.equal(state.fishing.rod, 1)
  assert.deepEqual(state.fishing.spots, ['river'])
  assert.equal(state.fishing.spot, 'river')
  const old = { fishing: { pending: null, bag: [], spots: ['lake', 'nowhere', 'river'], spot: 'nowhere' } }
  ensureFishing(old)
  assert.equal(old.fishing.rod, 2)
  assert.deepEqual(old.fishing.spots, ['river', 'lake'])
  assert.equal(old.fishing.spot, 'river')
})

test('鱼竿一把一把买，花金币，到传说竿为止', () => {
  const state = fresh()
  state.coins = 100
  assert.deepEqual(buyRod(state, EVENING), { ok: false, reason: 'poor', price: 800 })
  state.coins = 20_000
  for (const rod of RODS.slice(1)) assert.equal(buyRod(state, EVENING).rod, rod.key)
  assert.equal(state.coins, 20_000 - RODS.reduce((sum, rod) => sum + rod.price, 0))
  assert.equal(buyRod(state, EVENING).reason, 'owned')
  assert.equal(fishingView(state, EVENING).nextRod, null)
})

test('钓点先花金币开，开过的随时去；鱼咬着钩不能换地方', () => {
  const state = fresh()
  state.coins = 1000
  assert.deepEqual(chooseSpot(state, 'lake', EVENING), { ok: false, reason: 'poor', price: 1500 })
  assert.equal(chooseSpot(state, 'moon', EVENING).reason, 'unknown')
  state.coins = 2000
  assert.equal(chooseSpot(state, 'lake', EVENING).ok, true)
  assert.equal(state.coins, 500)
  assert.equal(chooseSpot(state, 'river', EVENING).ok, true)
  assert.equal(chooseSpot(state, 'lake', EVENING).ok, true, 'opened once, free after')
  assert.equal(state.coins, 500)
  castFishing(state, 0.5, EVENING, () => 0.1, 'bait_worm')
  assert.equal(chooseSpot(state, 'river', EVENING + 100).reason, 'pending')
  const view = fishingView(state, EVENING)
  assert.deepEqual(view.spots.map(spot => [spot.key, spot.unlocked, spot.kinds]), FISH_SPOTS.map(spot => [spot.key, ['river', 'lake'].includes(spot.key), FISH.filter(f => f.spot === spot.key).length]))
})

test('夜潭只在晚上开：白天不能抛竿也不能自动钓，晚上只出夜潭的鱼', () => {
  const state = fresh()
  state.fishing.spots = ['river', 'night']
  state.fishing.spot = 'night'
  assert.equal(spotOpen('night', EVENING), false)
  assert.equal(spotOpen('night', NIGHT), true)
  assert.equal(castFishing(state, 0.5, EVENING, () => 0.1, 'bait_worm').reason, 'closed')
  assert.equal(startAutoFishing(state, 30, EVENING, 'bait_worm').reason, 'closed')
  assert.equal(state.inventory.bait_worm, 40, 'no bait spent while closed')
  for (let i = 0; i < 20; i += 1) {
    state.fishing.pending = null
    const result = castFishing(state, 0.5, NIGHT, () => i / 20, 'bait_worm')
    assert.equal(result.fish.spot, 'night')
  }
})

test('鱼竿管咬钩快慢；越大的鱼越值钱（七折到一点三倍）', () => {
  for (const rod of RODS) {
    const state = fresh()
    state.fishing.rod = rod.level
    castFishing(state, 0.5, EVENING, () => 0, 'bait_worm')
    assert.equal(state.fishing.pending.bitesAt, EVENING + rod.bite[0])
  }
  for (let i = 1; i < RODS.length; i += 1) assert.ok(RODS[i].bite[1] < RODS[i - 1].bite[1], 'better rods bite sooner')
  const small = fresh(), big = fresh()
  castFishing(small, 0.5, EVENING, () => 0, 'bait_worm')
  castFishing(big, 0.5, EVENING, (() => { let n = 0; return () => (n++ === 0 ? 0 : 0.999) })(), 'bait_worm')
  const fish = FISH.find(f => f.key === small.fishing.pending.key)
  assert.equal(small.fishing.pending.price, Math.round(fish.price * 0.7))
  assert.equal(big.fishing.pending.price, Math.round(fish.price * (0.7 + 0.6 * 0.999)))
})

test('手感：按游法取速度区间，难的鱼更快；好竿降难度、绿区更宽、更耐拉', () => {
  const byBehavior = Object.groupBy(FISH, fish => fish.behavior)
  for (const [behavior, fishes] of Object.entries(byBehavior)) {
    const range = FISH_FEEL[behavior].speed
    for (const fish of fishes) {
      const feel = fightFeel(fish, RODS[1])
      assert.ok(feel.speed >= range[0] && feel.speed <= range[1], `${fish.key} speed in ${behavior} range`)
    }
  }
  const easy = fightFeel(FISH.find(f => f.key === 'fish_loach'), RODS[1])
  const hard = fightFeel(FISH.find(f => f.key === 'fish_crucian'), RODS[1])
  assert.ok(hard.speed > easy.speed)
  assert.equal(fightFeel(FISH.find(f => f.key === 'fish_moon'), RODS[0]).difficulty, 100, 'capped at 100')
  const eel = FISH.find(f => f.key === 'fish_eel')
  const [bamboo, legend] = [fightFeel(eel, RODS[0]), fightFeel(eel, RODS[3])]
  assert.equal(bamboo.difficulty, 98)
  assert.equal(legend.difficulty, 67)
  assert.ok(legend.zone > bamboo.zone && legend.hold > bamboo.hold)
  assert.equal(fightFeel(FISH.find(f => f.behavior === 'sink'), RODS[1]).drift < 0, true)
  assert.equal(fightFeel(FISH.find(f => f.behavior === 'rise'), RODS[1]).drift > 0, true)
  const state = fresh()
  castFishing(state, 0.5, EVENING, () => 0, 'bait_worm')
  hookFishing(state, state.fishing.pending.bitesAt)
  assert.equal(state.fishing.pending.feel.rod, 'bamboo', 'the hooked fish carries its feel to the client')
})

test('经济：手动钓鱼净时薪落在主动线里，竿越好赚得越多（tools/economy-sim.mjs）', async () => {
  const { fishingPerHour } = await import('../tools/economy-sim.mjs')
  const [low, high] = [INCOME_LINES.active.start[0], INCOME_LINES.active.max[1]]
  // 起步：竹竿在小河，略高于起步区间上限也可以（J1 第 4 节：621）。
  const start = fishingPerHour(1, 'river')
  assert.ok(start >= low && start <= 700, `bamboo river ${start}`)
  for (const spot of ['river', 'lake', 'sea', 'night']) {
    const rates = RODS.map(rod => fishingPerHour(rod.level, spot))
    for (let i = 1; i < rates.length; i += 1) assert.ok(rates[i] > rates[i - 1], `${spot}: rod ${i + 1} beats rod ${i}`)
    assert.ok(rates.at(-1) <= high, `${spot} legend rod ${rates.at(-1)}`)
  }
  assert.ok(fishingPerHour(4, 'lake') >= INCOME_LINES.active.max[0])
  // 鱼饵：白天蚯蚓最划算，高级鱼饵是冲图鉴；只有夜潭配好竿时高级鱼饵才回本。唯一超上限的是夜潭 + 传说竿 + 鲜虾（夜里的高峰，J1 记着）。
  for (const spot of ['river', 'lake', 'sea']) for (const rod of RODS) {
    assert.ok(fishingPerHour(rod.level, spot, 'bait_shrimp') <= fishingPerHour(rod.level, spot), `${spot} rod ${rod.level} shrimp`)
  }
  assert.ok(fishingPerHour(4, 'night', 'bait_glow') > fishingPerHour(4, 'night'))
  assert.ok(fishingPerHour(4, 'night', 'bait_shrimp') <= 2900)
})
