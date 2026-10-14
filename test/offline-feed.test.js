// @ts-check
/** 离线喂食按真实结算时钟消费，在线和关闭时保留原规则。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decay, hatchEgg, migrate, THRESHOLDS, SHOP, REVIVE_ITEM } from '../core.js'
const START = 1_700_000_000_000
const DAY = 86_400_000
const HOUR = 3_600_000
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
test('系统时钟回拨时结算游标不能跟着退回', () => {
  const pig = pigWithFood()
  decay(pig, START + 2 * DAY, never)
  const highWater = pig.lastSeenAt
  decay(pig, START + DAY, never)
  assert.equal(pig.lastSeenAt, highWater, '回拨只应跳过这一次结算，游标仍指向已结算到的时刻')
})

test('时钟回拨再恢复不能把已结算的时间重复结算一遍', () => {
  const pig = pigWithFood()
  decay(pig, START + 2 * DAY, never)
  const feeds = pig.stats.feeds
  const ageMs = pig.ageMs
  const satiety = pig.satiety
  const inventory = { ...pig.inventory }
  decay(pig, START + DAY, never)
  decay(pig, START + 2 * DAY, never)
  assert.equal(pig.stats.feeds, feeds, '回拨再恢复不能重复喂食')
  assert.equal(pig.ageMs, ageMs, '回拨再恢复不能重复长大')
  assert.equal(pig.satiety, satiety, '回拨再恢复不能重复衰减')
  assert.deepEqual(pig.inventory, inventory, '回拨再恢复不能重复扣食物')
})

test('存档游标在未来（负时长）时不能把游标吞到现在', () => {
  const pig = pigWithFood()
  pig.lastSeenAt = START + 5 * DAY
  decay(pig, START, never)
  assert.equal(pig.lastSeenAt, START + 5 * DAY, '游标在未来时应保留，等真实时间追上再结算')
})

test('对表式的小幅回拨：冻结到真实时间追上原游标，恢复后不重复结算', () => {
  const pig = pigWithFood()
  decay(pig, START + 3 * HOUR, never)
  const ageMs = pig.ageMs
  decay(pig, START + 2 * HOUR, never)
  assert.equal(pig.lastSeenAt, START + 3 * HOUR, '回拨一小时：游标留在高点')
  decay(pig, START + 3 * HOUR - 1, never)
  assert.equal(pig.lastSeenAt, START + 3 * HOUR, '没追上原游标之前一直冻结')
  assert.equal(pig.ageMs, ageMs, '冻结期间不长大')
  decay(pig, START + 4 * HOUR, never)
  assert.equal(pig.lastSeenAt, START + 4 * HOUR, '追上之后照常往前走')
  assert.ok(pig.ageMs > ageMs, '恢复后正常结算')
})

test('系统时间被永久调回：冻结满一天后接受新时间当新起点，不补结算', () => {
  const pig = pigWithFood()
  decay(pig, START + 10 * DAY, never)
  const held = pig.lastSeenAt
  const ageMs = pig.ageMs
  const satiety = pig.satiety
  const feeds = pig.stats.feeds
  decay(pig, START, never)
  assert.equal(pig.lastSeenAt, held, '回拨当下保留游标')
  assert.equal(pig.ageMs, ageMs, '回拨当下不结算')
  decay(pig, START + DAY - 1, never)
  assert.equal(pig.lastSeenAt, held, '错误时钟不满一天，猪还在冻结')
  decay(pig, START + DAY, never)
  assert.equal(pig.lastSeenAt, START + DAY, '满一天后接受新时间')
  assert.equal(pig.ageMs, ageMs, '接受新时间也不补结算冻结的那一段')
  assert.equal(pig.satiety, satiety, '冻结期间不衰减')
  assert.equal(pig.stats.feeds, feeds, '冻结期间不自动吃')
  decay(pig, START + DAY + 60_000, never)
  assert.ok(pig.ageMs > ageMs, '接受新时间之后照新时钟正常结算')
})

test('旧存档默认开启，已有关闭值在迁移后保留', () => {
  const pig = pigWithFood()
  const before = { ...pig, version: 12 }
  delete before.isOfflineFeedEnabled
  assert.equal(migrate(before, START).isOfflineFeedEnabled, true)
  assert.equal(migrate({ ...pig, isOfflineFeedEnabled: false }, START).isOfflineFeedEnabled, false)
})

test('老存档没有回拨标记就补 null，坏值当没有，有效值原样留下', () => {
  const pig = pigWithFood()
  const before = { ...pig, version: 12 }
  delete before.clockRollbackAt
  assert.equal(migrate(before, START).clockRollbackAt, null, '老存档：没有正在进行的回拨')
  assert.equal(migrate({ ...pig, clockRollbackAt: '昨天' }, START).clockRollbackAt, null, '坏值当没有')
  assert.equal(migrate({ ...pig, clockRollbackAt: START - DAY }, START).clockRollbackAt, START - DAY, '有效值保留，存档重载后还能继续判断')
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
