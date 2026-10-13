// @ts-check
/** 离线喂食按真实结算时钟消费，在线和关闭时保留原规则。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decay, hatchEgg, migrate, THRESHOLDS, SHOP, REVIVE_ITEM } from '../core.js'
const START = 1_700_000_000_000
const DAY = 86_400_000
const never = { roll: () => 0.99 }
const medicineKey = SHOP.find(item => item.kind === 'medicine').key
function pigWithFood() {
  const pig = hatchEgg(START)
  pig.inventory = { apple: 30, bread: 10, baozi: 5, [medicineKey]: 2, [REVIVE_ITEM.key]: 1 }
  return pig
}
test('离线三天按阈值消费便宜食物，记提示和日记', () => {
  const pig = pigWithFood()
  decay(pig, START + 3 * DAY, never)
  assert.ok(pig.satiety >= THRESHOLDS.hungry)
  assert.equal(pig.dead, false)
  assert.ok(pig.stats.feeds > 0)
  assert.ok(pig.lastFedAt < START + 3 * DAY)
  assert.ok(pig.pending.some(entry => entry.text.includes('自己吃了')))
  assert.ok(pig.diary.entries.some(entry => entry.text.includes('自己吃了')))
  assert.equal(pig.inventory[medicineKey], 2)
  assert.equal(pig.inventory[REVIVE_ITEM.key], 1)
})
test('没食物和关闭开关保留原来的结算', () => {
  const empty = hatchEgg(START)
  const disabled = hatchEgg(START)
  disabled.isOfflineFeedEnabled = false
  disabled.inventory = { apple: 20 }
  decay(empty, START + 3 * DAY, never)
  decay(disabled, START + 3 * DAY, never)
  assert.equal(empty.satiety, disabled.satiety)
  assert.equal(empty.health, disabled.health)
  assert.equal(disabled.inventory.apple, 20)
  assert.equal(empty.stats.feeds, 0)
  assert.ok(empty.pending.some(entry => entry.text.includes('背包里没吃的了')))
})
test('在线轮询不自动吃食物', () => {
  const pig = pigWithFood()
  pig.satiety = 24
  for (let index = 1; index <= 60; index++) decay(pig, START + index * 1000, never)
  assert.equal(pig.stats.feeds, 0)
  assert.equal(pig.inventory.apple, 30)
})
test('旧存档默认开启，已有关闭值在迁移后保留', () => {
  const pig = pigWithFood()
  const before = { ...pig, version: 12 }
  delete before.isOfflineFeedEnabled
  assert.equal(migrate(before, START).isOfflineFeedEnabled, true)
  assert.equal(migrate({ ...pig, isOfflineFeedEnabled: false }, START).isOfflineFeedEnabled, false)
})

test('优先能越过饥饿线的便宜食物，不足时选回复最多的', async () => {
  const { pickOfflineFood } = await import('../packages/pet-core/src/core/offline-feed.js')
  const pig = pigWithFood()
  pig.inventory = { apple: 2, bread: 2, strawberry: 2, bone: 2 }
  pig.satiety = 20
  assert.equal(pickOfflineFood(pig).key, 'apple')
  pig.satiety = 0
  assert.equal(pickOfflineFood(pig).key, 'bread')
  pig.inventory = { apple: 2, strawberry: 2 }
  assert.equal(pickOfflineFood(pig).key, 'apple')
})
test('先吃完库存后继续衰减，非食物不消耗', () => {
  const pig = pigWithFood()
  pig.inventory = { apple: 1, soap: 3, bait_worm: 4, crown: 1 }
  decay(pig, START + 3 * DAY, never)
  assert.equal(pig.stats.feeds, 1)
  assert.equal(pig.satiety, 0)
  assert.deepEqual(pig.inventory, { soap: 3, bait_worm: 4, crown: 1 })
  assert.ok(pig.pending.some(entry => entry.text.includes('苹果×1') && entry.text.includes('背包里没吃的了')))
})
test('离线发生在外出过程中也可吃背包食物，手动喂食仍受外出限制', async () => {
  const { act, startWork } = await import('../core.js')
  const pig = pigWithFood()
  startWork(pig, 'bricks', START)
  pig.satiety = 26
  assert.equal(act(pig, 'feed', START, 'apple').reason, 'away')
  decay(pig, START + 10 * 60_000, never)
  assert.equal(pig.stats.feeds, 1)
  assert.ok(pig.satiety > THRESHOLDS.hungry)
})

test('同一天离线摘要与原日记合在一篇，翻页后仍能按日期读到两者', async () => {
  const { finishOfflineMeals } = await import('../packages/pet-core/src/core/offline-feed.js')
  const { dayKeyFor } = await import('../packages/pet-core/src/core/clock.js')
  const { writeDiaryIfNewDay } = await import('../packages/pet-core/src/core/diary.js')
  const pig = pigWithFood()
  const day = dayKeyFor(START)
  pig.diary = { entries: [{ day, text: '原来的日记' }], today: { day, counts: { feed: 1 } } }
  finishOfflineMeals(pig, { counts: { apple: 2 } }, START)
  assert.equal(pig.diary.entries.filter(entry => entry.day === day).length, 1, '日期是日记页的选择键，不能生成重名条目')
  assert.ok(pig.diary.entries[0].text.includes('原来的日记'))
  assert.ok(pig.diary.entries[0].text.includes('自己吃了 苹果×2'))
  writeDiaryIfNewDay(pig, START + DAY)
  assert.equal(pig.diary.entries.filter(entry => entry.day === day).length, 1, '跨天落笔也不能重复当天摘要的日期')
  assert.ok(pig.diary.entries[0].text.includes('原来的日记'))
  assert.ok(pig.diary.entries[0].text.includes('自己吃了 苹果×2'))
})
