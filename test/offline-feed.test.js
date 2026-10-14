// @ts-check
/** 离线自动用背包（吃 / 洗 / 玩）、时钟回拨冻结、撑不住之后的垂危与死亡。 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ageFromNow, applyDevPatch, awayBlockedReason, decay, doctorFee, hatchEgg, lifeStageFor, migrate, onsetRisks, seeDoctor, THRESHOLDS, SHOP, REVIVE_ITEM } from '../core.js'
import { CHAIN_INDEX } from '../packages/pet-core/src/data/illness.js'
import { raiseSettledUpTo } from '../packages/pet-core/src/core/clock.js'
import { emptyOfflineMeals, finishOfflineMeals, offlineSustainMs, pickOfflineItem, OFFLINE_NEEDS } from '../packages/pet-core/src/core/offline-feed.js'
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
/** 200 个苹果约撑 38 天，够跑十几天的结算（落回旧水位那几条测试用）。 */
function wellFed() {
  const pig = hatchEgg(START)
  pig.inventory = { apple: 200 }
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

// ===========================================================================
// 返工3 A1：时钟往回调就冻结，取消「倒退满一天认新时钟」那个出口。
// 玩家调时间了猪就不动，等真实时间追上旧水位（settledUpTo）再只结算新增的那一段。
// ===========================================================================

test('返工3 A1：往回调 1 小时 / 1 天 / 10 天，猪都不动、不补结算，追上后只结算新增那一段', () => {
  for (const [label, back] of [['1 小时', HOUR], ['1 天', DAY], ['10 天', 10 * DAY]]) {
    const pig = wellFed()
    decay(pig, START + 12 * DAY, never)
    const before = {
      cursor: pig.lastSeenAt, ageMs: pig.ageMs, satiety: pig.satiety,
      feeds: pig.stats.feeds, inventory: { ...pig.inventory },
    }
    // 往回拨：同一时刻反复调用也只是跳过，不会开始数「倒退持续了多久」。
    for (let i = 0; i < 5; i++) decay(pig, START + 12 * DAY - back, never)
    assert.equal(pig.lastSeenAt, before.cursor, `回拨 ${label}：游标留在旧高点`)
    assert.equal(pig.ageMs, before.ageMs, '冻结期间不长大')
    assert.equal(pig.satiety, before.satiety, '冻结期间不衰减')
    assert.equal(pig.stats.feeds, before.feeds, '冻结期间不自动吃')
    assert.deepEqual(pig.inventory, before.inventory, '冻结期间不动背包')
    // 真实时间还差 1 毫秒到旧水位：仍然不动。
    decay(pig, before.cursor - 1, never)
    assert.equal(pig.ageMs, before.ageMs, '没追上旧水位之前一直冻结')
    // 越过旧水位 1 小时：只结算新增的那一段，错表那段不算第二遍。
    decay(pig, before.cursor + HOUR, never)
    assert.equal(pig.lastSeenAt, before.cursor + HOUR)
    assert.ok(Math.abs(pig.ageMs - before.ageMs - HOUR) < 1000, `只结算新增的 1 小时（实际 ${(pig.ageMs - before.ageMs) / HOUR} 小时）`)
  }
})

test('返工3 A1：回拨跨重启一直冻结，错表的时钟走到旧水位才恢复', () => {
  const pig = wellFed()
  decay(pig, START + 5 * DAY, never)
  const held = pig.lastSeenAt
  const ageMs = pig.ageMs
  decay(pig, START, never)
  assert.equal(pig.lastSeenAt, held, '回拨当下保留游标')
  const reloaded = JSON.parse(JSON.stringify(pig))
  for (let day = 1; day <= 5; day += 1) decay(reloaded, START + day * DAY, never)
  assert.equal(reloaded.lastSeenAt, held, '错表的时钟走到旧水位也还没超过它')
  assert.equal(reloaded.ageMs, ageMs, '一路冻结，错表的时间一点都不补算')
  decay(reloaded, held + HOUR, never)
  assert.ok(Math.abs(reloaded.ageMs - ageMs - HOUR) < 1000, `越过旧水位只结算新增的 1 小时（实际 ${(reloaded.ageMs - ageMs) / HOUR} 小时）`)
})

test('返工3 A1：出生时刻在将来（快机器上孵的猪）——回拨后冻结，不再有「满一天认新时钟」', () => {
  const pig = wellFed()
  decay(pig, START + 10 * DAY, never)
  const held = pig.lastSeenAt
  const ageMs = pig.ageMs
  pig.bornAt = START + 5 * DAY
  decay(pig, START, never)
  assert.equal(pig.lastSeenAt, held, '回拨当下保留游标')
  decay(pig, START + DAY, never)
  assert.equal(pig.lastSeenAt, held, '满一天也不认新时钟（本轮取消了那个出口）')
  assert.equal(pig.ageMs, ageMs, '冻结期间不补结算')
  decay(pig, held + HOUR, never)
  assert.ok(pig.ageMs > ageMs, '越过旧水位后继续长大')
  assert.ok(Math.abs(pig.ageMs - ageMs - HOUR) < 1000, '只结算新增的 1 小时')
})

test('返工3 A1：冻结期间有进行中的活动，解冻后只结算一次、工资只发一份', async () => {
  const { startWork } = await import('../core.js')
  const pig = wellFed()
  decay(pig, START + 2 * DAY, never)
  startWork(pig, 'bricks', START + 2 * DAY)
  const endsAt = pig.activity.endsAt
  decay(pig, START - 3 * DAY, never)
  assert.equal(pig.stats.jobs, 0, '回拨当下不结算')
  decay(pig, START + DAY, never)
  assert.equal(pig.activity.endsAt, endsAt, '冻结期间活动原样留在存档里')
  assert.equal(pig.stats.jobs, 0, '冻结期间活动不结算')
  decay(pig, START + 3 * DAY, never)
  assert.equal(pig.activity, null)
  assert.equal(pig.stats.jobs, 1, '解冻后活动只结算一次')
  const coins = pig.stats.coinsEarned
  assert.ok(coins > 0, '这一班要发工资')
  decay(pig, START + 4 * DAY, never)
  assert.equal(pig.stats.jobs, 1, '继续往前走不重复结算')
  assert.equal(pig.stats.coinsEarned, coins, '工资只发一份')
})

test('返工3 A1：回拨 10 天再改回真实时间——错表那段不算第二遍', () => {
  const pig = wellFed()
  decay(pig, START + 12 * DAY, never)
  const ageMs = pig.ageMs
  const feeds = pig.stats.feeds
  decay(pig, START + 2 * DAY, never)
  assert.equal(pig.lastSeenAt, START + 12 * DAY, '回拨当期冻结，不认新时钟')
  decay(pig, START + 11 * DAY, never)
  assert.equal(pig.ageMs, ageMs, '还没追上旧水位，猪一直不动')
  const realNow = START + 13 * DAY
  decay(pig, realNow, never)
  // 错表那 10 天本来就没真的流过；改回真实时间只多走了 1 天。
  assert.ok(Math.abs(pig.ageMs - ageMs - DAY) < 1000, `只结算新增的 1 天（实际 ${(pig.ageMs - ageMs) / DAY} 天）`)
  assert.equal(pig.lastSeenAt, realNow)
  assert.equal(pig.settledUpTo, realNow, '水位跟着推进到新的结算高点')
  assert.ok(pig.stats.feeds >= feeds, '新增的那一天照常结算（该吃吃、该长长）')
})

test('返工3 A1：永久回拨——猪整段不推进，等真实时间追上旧水位才继续', () => {
  const pig = wellFed()
  decay(pig, START + 10 * DAY, never)
  const highWater = pig.settledUpTo
  const frozen = pig.ageMs
  decay(pig, START, never)
  assert.equal(pig.lastSeenAt, highWater, '回拨当下保留游标')
  // 一步步走错表的时钟：不崩、不结算，直到越过旧水位。
  for (let hour = 1; hour <= 10 * 24; hour += 1) decay(pig, START + hour * HOUR, never)
  assert.equal(pig.ageMs, frozen, '旧高点之前一天都不结算')
  assert.equal(pig.lastSeenAt, highWater, '旧高点之前游标也不动（没有认新时钟的出口）')
  assert.equal(pig.dead, false, '暂停期间猪不崩')
  decay(pig, highWater + HOUR, never)
  assert.ok(pig.ageMs > frozen, '越过水位之后恢复结算')
  assert.ok(Math.abs(pig.ageMs - frozen - HOUR) < 1000, '只结算新增的 1 小时')
})

test('返工3 A1：来回多次拨表（+5d / -1d / +1d / +7d）不重复结算任何一段', () => {
  const pig = wellFed()
  decay(pig, START + 5 * DAY, never)
  assert.ok(Math.abs(pig.ageMs - 5 * DAY) < 1000, '先正常结算 5 天')
  assert.equal(pig.settledUpTo, START + 5 * DAY)
  decay(pig, START - DAY, never)
  assert.equal(pig.lastSeenAt, START + 5 * DAY, '回拨期间游标不动')
  decay(pig, START + DAY, never)
  assert.equal(pig.lastSeenAt, START + 5 * DAY, '错表时钟没追上旧水位，还是不动')
  decay(pig, START + 7 * DAY, never)
  assert.equal(pig.lastSeenAt, START + 7 * DAY)
  assert.equal(pig.settledUpTo, START + 7 * DAY)
  // 不重叠之和 = 5 天 + 2 天 = 7 天（= START 到最后的真实间隔）。
  assert.ok(Math.abs(pig.ageMs - 7 * DAY) < 1000, `总结算 = 各段不重叠之和 7 天（实际 ${pig.ageMs / DAY} 天）`)
})

test('旧存档默认开启，已有关闭值在迁移后保留', () => {
  const pig = pigWithFood()
  const before = { ...pig, version: 12 }
  delete before.isOfflineFeedEnabled
  assert.equal(migrate(before, START).isOfflineFeedEnabled, true)
  assert.equal(migrate({ ...pig, isOfflineFeedEnabled: false }, START).isOfflineFeedEnabled, false)
})

test('返工3：不再使用的 clockRollbackAt 迁移时丢掉', () => {
  const pig = pigWithFood()
  const before = { ...pig, version: 12, clockRollbackAt: START - DAY }
  assert.equal('clockRollbackAt' in migrate(before, START), false, '老存档留下的冻结标记不再进内存')
})

// ===========================================================================
// 返工3 P2-A：老存档（没有 settledUpTo 水位）在回拨场景下的保护要有会红的测试。
//
// 注意夹具：`bornAt` 必须放在很远的过去。decay() 里 `fromMs = max(lastSeenAt, bornAt)`
// 是一道「生日下界」，生日放近会把重复结算量掩盖掉（xreview 实测只剩 2.04 天）。
// ===========================================================================

test('返工3 P2-A：老存档（没有水位）回拨后恢复，不把已结算的那段算第二遍', () => {
  // 先正常结算到 T，再把水位字段删掉、过一遍 migrate：得到「游标在 T、水位为 null」的
  // 升级后老存档（老版本根本没有这个字段，migrate 会补成 null）。
  const settled = hatchEgg(START)
  settled.bornAt = START - 100 * DAY
  settled.inventory = { apple: 300 }
  decay(settled, START + 12 * DAY, never)
  const T = settled.lastSeenAt
  const raw = JSON.parse(JSON.stringify(settled))
  delete raw.settledUpTo
  raw.version = 12
  const upgraded = migrate(raw, T)
  assert.equal(upgraded.settledUpTo, null, '老存档升级后水位是 null')
  const ageMs = upgraded.ageMs
  const apples = upgraded.inventory.apple
  // 玩家把系统时间拨回 10 天：冻结，不补结算。
  decay(upgraded, T - 10 * DAY, never)
  assert.equal(upgraded.lastSeenAt, T, '回拨当下保留游标——没有水位时这就是唯一保护')
  assert.equal(upgraded.ageMs, ageMs, '回拨不补结算')
  assert.equal(upgraded.inventory.apple, apples, '回拨不吃背包')
  // 真实时间越过旧游标 1 小时：只结算新增的 1 小时，错表那 10 天不算第二遍。
  decay(upgraded, T + HOUR, never)
  assert.ok(Math.abs(upgraded.ageMs - ageMs - HOUR) < 1000, `只结算新增的 1 小时（实际 ${(upgraded.ageMs - ageMs) / HOUR} 小时）`)
  assert.equal(upgraded.settledUpTo, T + HOUR, '从这一轮起水位被立起来')
  assert.ok(apples - upgraded.inventory.apple <= 2, `重复结算会多吃几十个苹果（实际多吃 ${apples - upgraded.inventory.apple} 个）`)
})

test('返工3 P2-A：游标落在水位后面（手改存档 / 更旧的拷贝）时，从水位起算，不重算已结算那段', () => {
  const pig = hatchEgg(START)
  pig.inventory = { apple: 300 }
  decay(pig, START + 12 * DAY, never)
  const watermark = pig.settledUpTo
  assert.equal(watermark, START + 12 * DAY)
  // 手改存档：游标被写回 10 天前，水位没动。
  pig.lastSeenAt = START + 2 * DAY
  const ageMs = pig.ageMs
  decay(pig, watermark + HOUR, never)
  assert.equal(pig.settledUpTo, watermark + HOUR)
  assert.ok(Math.abs(pig.ageMs - ageMs - HOUR) < 1000, `只结算水位之后新增的 1 小时（实际 ${(pig.ageMs - ageMs) / HOUR} 小时）`)
})

test('优先能越过饥饿线的便宜食物，不足时选回复最多的', () => {
  const pig = pigWithFood()
  pig.inventory = { apple: 2, bread: 2, strawberry: 2, bone: 2 }
  pig.satiety = 20
  assert.equal(pickOfflineItem(pig, OFFLINE_NEEDS[0]).key, 'apple')
  pig.satiety = 0
  assert.equal(pickOfflineItem(pig, OFFLINE_NEEDS[0]).key, 'bread')
  pig.inventory = { apple: 2, strawberry: 2 }
  assert.equal(pickOfflineItem(pig, OFFLINE_NEEDS[0]).key, 'apple')
})
test('先吃完食物后继续衰减，鱼饵 / 药品 / 王冠不消耗', () => {
  const pig = hatchEgg(START)
  pig.inventory = { apple: 1, bait_worm: 4, crown: 1, [medicineKey]: 2 }
  decay(pig, START + 3 * DAY, never)
  assert.equal(pig.stats.feeds, 1)
  assert.equal(pig.satiety, 0)
  assert.deepEqual(pig.inventory, { bait_worm: 4, crown: 1, [medicineKey]: 2 })
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
  const { dayKeyFor } = await import('../packages/pet-core/src/core/clock.js')
  const { writeDiaryIfNewDay } = await import('../packages/pet-core/src/core/diary.js')
  const pig = pigWithFood()
  const day = dayKeyFor(START)
  pig.diary = { entries: [{ day, text: '原来的日记' }], today: { day, counts: { feed: 1 } } }
  const meals = emptyOfflineMeals()
  meals.counts.food.apple = 2
  finishOfflineMeals(pig, meals, START)
  assert.equal(pig.diary.entries.filter(entry => entry.day === day).length, 1, '日期是日记页的选择键，不能生成重名条目')
  assert.ok(pig.diary.entries[0].text.includes('原来的日记'))
  assert.ok(pig.diary.entries[0].text.includes('自己吃了 苹果×2'))
  writeDiaryIfNewDay(pig, START + DAY)
  assert.equal(pig.diary.entries.filter(entry => entry.day === day).length, 1, '跨天落笔也不能重复当天摘要的日期')
  assert.ok(pig.diary.entries[0].text.includes('原来的日记'))
  assert.ok(pig.diary.entries[0].text.includes('自己吃了 苹果×2'))
})

// ===========================================================================
// 返工3 B：离线自动用背包扩成三类（吃 / 洗 / 玩），阈值照 mood() 的那条线。
// ===========================================================================

test('返工3 B：清洁低就用洗澡道具，走正常照料管线扣库存', () => {
  const pig = wellFed()
  pig.inventory = { apple: 20, soap: 3 }
  pig.cleanliness = 20
  decay(pig, START + 6 * HOUR, never)
  assert.ok(pig.stats.baths > 0, '清洁低于 35 就自己洗')
  assert.ok(pig.cleanliness > THRESHOLDS.dirty, '洗完要回到阈值线以上')
  assert.equal(pig.inventory.soap, 1, '用掉两份香皂（20 → 55 → 又掉回 35 以下）')
})

test('返工3 B：心情低就用玩具，免费的默认玩具不算背包里的东西', () => {
  const pig = wellFed()
  pig.inventory = { apple: 20, yoyo: 4 }
  pig.happiness = 20
  decay(pig, START + 6 * HOUR, never)
  assert.ok(pig.stats.plays > 0, '心情低于 35 就自己玩')
  assert.ok(pig.happiness > THRESHOLDS.lonely)
  assert.ok((pig.inventory.yoyo ?? 0) < 4, '用掉悠悠球')

  const noToy = wellFed()
  noToy.happiness = 20
  decay(noToy, START + 6 * HOUR, never)
  assert.equal(noToy.stats.plays, 0, '没有玩具就不玩（小皮球不是背包里的东西）')
  assert.ok(noToy.happiness < 20, '心情照常往下掉')
})

test('返工3 B：三类同时低就各用一份，同一段结算里互不挤掉', () => {
  const pig = hatchEgg(START)
  pig.inventory = { apple: 10, soap: 10, yoyo: 10 }
  pig.satiety = 20
  pig.cleanliness = 20
  pig.happiness = 20
  decay(pig, START + DAY, never)
  assert.ok(pig.stats.feeds > 0)
  assert.ok(pig.stats.baths > 0)
  assert.ok(pig.stats.plays > 0)
  assert.ok(pig.inventory.apple < 10)
  assert.ok(pig.inventory.soap < 10)
  assert.ok(pig.inventory.yoyo < 10)
  assert.ok(pig.pending.some(entry => entry.text.includes('吃了') && entry.text.includes('洗了') && entry.text.includes('玩了')))
})

test('返工3 B：库存为空就什么都不消耗，照旧衰减', () => {
  const pig = hatchEgg(START)
  pig.inventory = { apple: 1, soap: 1, yoyo: 1 }
  pig.satiety = 20
  pig.cleanliness = 20
  pig.happiness = 20
  decay(pig, START + DAY, never)
  assert.equal(pig.inventory.apple, undefined, '最后一份苹果也吃掉了')
  assert.equal(pig.inventory.soap, undefined)
  assert.equal(pig.inventory.yoyo, undefined)
  assert.equal(pig.satiety, 0)
  assert.equal(pig.cleanliness, 0)
  assert.equal(pig.happiness, 0)
})

test('返工3 B：关掉开关就三类都不动', () => {
  const pig = hatchEgg(START)
  pig.isOfflineFeedEnabled = false
  pig.inventory = { apple: 5, soap: 5, yoyo: 5 }
  pig.satiety = 20
  pig.cleanliness = 20
  pig.happiness = 20
  decay(pig, START + DAY, never)
  assert.deepEqual(pig.inventory, { apple: 5, soap: 5, yoyo: 5 })
  assert.equal(pig.stats.feeds, 0)
  assert.equal(pig.stats.baths, 0)
  assert.equal(pig.stats.plays, 0)
})

test('返工3 B：离线汇总把吃了 / 洗了 / 玩了都列出来', () => {
  const pig = pigWithFood()
  const meals = emptyOfflineMeals()
  meals.counts.food.apple = 2
  meals.counts.bath.soap = 1
  meals.counts.toy.yoyo = 3
  finishOfflineMeals(pig, meals, START)
  const text = pig.pending.at(-1).text
  assert.equal(text, '你不在的时候，猪猪自己吃了 苹果×2、洗了 香皂×1、玩了 悠悠球×3')
  assert.ok(pig.diary.entries.at(-1).text.includes('玩了 悠悠球×3'), '日记里也列出来')
})

test('返工3 B：单类的选择规则和食物一样（能越线的最便宜，不够就回复最多）', () => {
  const pig = hatchEgg(START)
  const bath = OFFLINE_NEEDS[1]
  pig.inventory = { scrubber: 1, soap: 1, bubble: 1 }
  pig.cleanliness = 20
  // 20 + 35 = 55 > 35，能越线的里香皂 6 块最便宜。
  assert.equal(pickOfflineItem(pig, bath).key, 'soap')
  pig.cleanliness = 0
  // 0 + 35 恰好到不了 35 以上，能越线的只有搓澡巾（45）和泡泡浴（100）→ 搓澡巾最便宜。
  assert.equal(pickOfflineItem(pig, bath).key, 'scrubber')
  // 一份都越不过线时选回复最多的：泡泡浴 100。
  assert.equal(pickOfflineItem(pig, { ...bath, threshold: 200 }).key, 'bubble')
})

test('返工3 B：清洁 / 心情低的后果按现有发病规则（不另造因果）', () => {
  const pig = hatchEgg(START)
  pig.cleanliness = 20
  pig.happiness = 20
  const chains = onsetRisks(pig).map(risk => risk.chain)
  assert.ok(chains.includes(CHAIN_INDEX.cough), '脏 → 咳嗽')
  assert.ok(chains.includes(CHAIN_INDEX.dizzy), '心情差 → 头晕')
})

// ===========================================================================
// 返工3 A2：撑不住之后的结果（10 天垂危 / 30 天死亡），取代原来的 400 天上限。
// ===========================================================================

test('返工3 A2：空背包离开正好 10 天还不垂危，超过一分钟就是生命垂危', () => {
  const atTen = hatchEgg(START)
  decay(atTen, START + 10 * DAY, never)
  assert.equal(atTen.dead, false)
  assert.equal(atTen.health, 5, '撑着满 10 天还没到垂危')

  const over = hatchEgg(START)
  decay(over, START + 10 * DAY + 60_000, never)
  assert.equal(over.dead, false, '垂危还不死')
  assert.equal(over.health, 1, '生命垂危用现有的健康 1 格表示（太虚弱不能出门那一档）')
  assert.ok(over.pending.some(entry => entry.kind === 'weak'), '要说一声垂危')
})

test('返工3 A2：空背包整整 30 天死亡变墓碑，差一分钟还活着', () => {
  const almost = hatchEgg(START)
  decay(almost, START + 30 * DAY - 60_000, never)
  assert.equal(almost.dead, false)
  assert.equal(almost.health, 1, '差一分钟只是垂危')

  const dead = hatchEgg(START)
  decay(dead, START + 30 * DAY, never)
  assert.equal(dead.dead, true, '整整一个月就死了')
  assert.equal(dead.health, 0)
  assert.equal(dead.illness, null)
  assert.equal(dead.diedAt, START + 30 * DAY)
  assert.equal(lifeStageFor(dead, START + 30 * DAY).key, 'dead-day', '当天先留着小猪的身影')
  assert.equal(lifeStageFor(dead, START + 31 * DAY).key, 'grave', '满一天后是墓碑')
  assert.ok(dead.pending.some(entry => entry.kind === 'death'))
  assert.equal(dead.stats.deaths, 1)
})

test('返工3 A2：背包只够撑 5 天时，离开 20 天垂危、离开 40 天死亡', () => {
  const short = hatchEgg(START)
  short.inventory = { apple: 26 }
  assert.ok(offlineSustainMs(short) > 4 * DAY && offlineSustainMs(short) < 6 * DAY, `26 个苹果约撑 5 天（实际 ${offlineSustainMs(short) / DAY} 天）`)
  decay(short, START + 20 * DAY, never)
  assert.equal(short.dead, false)
  assert.equal(short.health, 1, '苹果吃光之后超过 10 天：垂危')
  // 返工4 P2-1：判定按完整跨度（20 天），结算也要按完整跨度长年龄/写日记；被 horizon 截掉的
  // 头部（撑得住的那 5 天）要一次性补回，不能只算「截头后那 15 天」。
  assert.ok(Math.abs(short.ageMs - 20 * DAY) < 1000, `活着回来要按完整 20 天长大（实际 ${short.ageMs / DAY} 天）`)

  const dead = hatchEgg(START)
  dead.inventory = { apple: 26 }
  decay(dead, START + 40 * DAY, never)
  assert.equal(dead.dead, true, '吃光之后累计满 30 天：死亡')
})

test('返工3 A2：背包能撑的天数只看食物（用户原话「背包有吃的能撑」）', () => {
  const toyOnly = hatchEgg(START)
  toyOnly.inventory = { soap: 50, yoyo: 50 }
  assert.equal(offlineSustainMs(toyOnly), 0, '洗浴 / 玩具不算「撑」')
  decay(toyOnly, START + 10 * DAY + HOUR, never)
  assert.equal(toyOnly.health, 1, '没有吃的撑着，超过 10 天照样垂危')

  const fed = hatchEgg(START)
  fed.inventory = { apple: 26 }
  assert.ok(offlineSustainMs(fed) > 0)
  const off = hatchEgg(START)
  off.isOfflineFeedEnabled = false
  off.inventory = { apple: 300 }
  assert.equal(offlineSustainMs(off), 0, '关了开关就当作一点东西都没有')
})

test('返工3 A2：垂危只公告一次，不重复刷屏', () => {
  const pig = hatchEgg(START)
  decay(pig, START + 10 * DAY + HOUR, never)
  assert.equal(pig.pending.filter(entry => entry.kind === 'weak').length, 1)
  const weakBefore = pig.pending.filter(entry => entry.kind === 'weak').length
  decay(pig, START + 11 * DAY, never)
  assert.equal(pig.pending.filter(entry => entry.kind === 'weak').length, weakBefore, '已经是 1 格健康就不再重复公告')
  assert.equal(pig.health, 1)
})

test('返工5：离线撑到垂危的猪，「快喂点东西」不再出现；带去看医生花 45 回满、又能出门', () => {
  const pig = hatchEgg(START)
  decay(pig, START + 10 * DAY + HOUR, never)
  assert.equal(pig.health, 1)
  const weak = pig.pending.find(entry => entry.kind === 'weak')
  assert.ok(weak !== undefined && weak.text.includes('生命垂危'))
  assert.ok(!weak.text.includes('喂'), '公告不能指点一个救不回垂危的动作（喂食不加 health）')
  // 2026-10-14 用户拍板：垂危也能看医生，看一次回满。
  pig.coins = 100
  assert.equal(doctorFee(pig), 45)
  assert.deepEqual(seeDoctor(pig, START + 10 * DAY + HOUR), { ok: true, fee: 45 })
  assert.equal(pig.health, 5)
  assert.equal(awayBlockedReason(pig), null, '恢复之后又能出门了')
})

test('返工3 A2：合法的离开 100 天照常结算（背包够撑，行为不变）', { timeout: 5000 }, () => {
  const pig = hatchEgg(START)
  pig.inventory = { apple: 300, bread: 300 }
  decay(pig, START + 100 * DAY, never)
  assert.equal(pig.dead, false, '有离线喂食，100 天不会饿死')
  assert.equal(pig.health, 5, '吃的够了就不会垂危')
  assert.ok(Math.abs(pig.ageMs - 100 * DAY) < 1000, `100 天应全部结算（实际 ${pig.ageMs / DAY} 天）`)
  assert.equal(pig.lastSeenAt, START + 100 * DAY)
})

test('返工3 A2：巨远的现在仍秒回，按背包上限推算、按「没东西撑着」给结果', { timeout: 5000 }, () => {
  const pig = hatchEgg(START)
  pig.inventory = { apple: 300, bread: 300 }
  pig.lastSeenAt = START + 1
  const started = Date.now()
  decay(pig, START + 5000 * DAY, never)
  const elapsed = Date.now() - started
  assert.equal(pig.lastSeenAt, START + 5000 * DAY)
  assert.equal(pig.dead, true, '5000 天没东西撑着：早就死了')
  assert.ok(pig.ageMs < 200 * DAY, `只推算到「撑住的天数 + 10 天」为止（实际 ${pig.ageMs / DAY} 天）`)
  assert.ok(elapsed < 10_000, `秒回（实际 ${elapsed}ms，旧实现 77-102 秒）`)
})

test('返工3 A2：背包再满也走不过 400 天的绝对上限', { timeout: 5000 }, () => {
  const rich = hatchEgg(START)
  rich.inventory = { apple: 100_000 }
  const started = Date.now()
  decay(rich, START + 5000 * DAY, never)
  const elapsed = Date.now() - started
  assert.equal(rich.dead, false, '背包真的够撑 5000 天，不该判成饿死')
  assert.ok(Math.abs(rich.ageMs - 400 * DAY) < 1000, `绝对上限 400 天（实际 ${rich.ageMs / DAY} 天）`)
  assert.equal(rich.lastSeenAt, START + 5000 * DAY)
  assert.ok(elapsed < 6_000, `400 天的结算应在秒级完成（实际 ${elapsed}ms）`)
})

test('返工3 A2：关掉自动用背包 + 超长离线：没东西撑着，满 30 天死亡', () => {
  const pig = hatchEgg(START)
  pig.isOfflineFeedEnabled = false
  pig.inventory = { apple: 300 }
  decay(pig, START + 30 * DAY, never)
  assert.equal(pig.inventory.apple, 300, '不开开关就不动背包')
  assert.equal(pig.stats.feeds, 0)
  assert.equal(pig.satiety, 0, '不开自动吃就是饿到 0')
  assert.equal(pig.dead, true, '没东西撑着满 30 天：死亡')
})

// ===========================================================================
// 坏结算游标与单次结算跨度上限（存档模糊测试 4.1 回归）
//
// 见 results/save-fuzz/REPORT.md §4.1：lastSeenAt 为 0 / 负数 / 非有限 / 早于
// bornAt 时，decay() 会按 SETTLE_STEP_MS 一步走完巨大的时间差（最坏等于永不返回）。
// 夹具：
//   fixtures/save-fuzz-01.json  从 crashes/01-core-decay-Timeout.json 提取的 save
//   fixtures/save-fuzz-03.json  crashes/03-core-decay-compact.json 在产物里缺失，
//                               按报告 §4.1 的最小条件重建（hatched + 时间戳坏 +
//                               一个 endsAt 在结算点附近的活动）
// ===========================================================================

const FUZZ_NOW = 1_790_780_277_081
const loadFixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))

for (const name of ['01', '03']) {
  test(`模糊测试 4.1（sample ${name}）：坏游标不按几百万步补结算，仍要秒回`, { timeout: 5000 }, () => {
    const pig = migrate(loadFixture(`save-fuzz-${name}`), FUZZ_NOW)
    const ageMs = pig.ageMs
    const satiety = pig.satiety
    const started = Date.now()
    // 修复前：crashes/01 与 03 各约 77-102 秒（本机实测），lastSeenAt = -1e15 时等于不返回。
    decay(pig, FUZZ_NOW + DAY, never)
    const elapsed = Date.now() - started
    assert.equal(pig.lastSeenAt, FUZZ_NOW + DAY, '坏游标按刚看过处理，修到 nowMs')
    assert.equal(pig.ageMs, ageMs, '坏游标不补结算：不凭空长大')
    assert.equal(pig.satiety, satiety, '坏游标不补结算：不凭空衰减')
    assert.ok(elapsed < 1000, `坏游标要秒回（实际 ${elapsed}ms）`)
    // 修游标只跳过这一次；下一次看到它时照常结算并结束那班活动。
    decay(pig, FUZZ_NOW + DAY + 60_000, never)
    assert.equal(pig.activity, null, '修完游标后活动照常结算')
  })
}

for (const [label, bad] of [
  ['0', 0],
  ['负数', -1],
  ['负数（很大）', -1e15],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
]) {
  test(`坏游标（${label}）一律不补结算`, { timeout: 5000 }, () => {
    const pig = pigWithFood()
    pig.lastSeenAt = bad
    const ageMs = pig.ageMs
    decay(pig, START + DAY, never)
    assert.equal(pig.lastSeenAt, START + DAY)
    assert.equal(pig.ageMs, ageMs)
    assert.equal(pig.stats.feeds, 0)
  })
}

test('坏游标只看时间戳：缺 bornAt 也不会把 0 兜成「结算 400 天」', () => {
  // 返工 P3-8：把「早于出生」从坏游标判定里去掉之后，0 / 负数只能靠「非正数」这一条兜住；
  // 少了它就会被上限兜成「凭空结算 400 天」。这里锁住这个耦合。
  const pig = pigWithFood()
  delete pig.bornAt
  pig.lastSeenAt = 0
  const ageMs = pig.ageMs
  decay(pig, START + DAY, never)
  assert.equal(pig.lastSeenAt, START + DAY)
  assert.equal(pig.ageMs, ageMs, '没有可信起点就不补结算')
  assert.equal(pig.stats.feeds, 0)
})

test('游标早于出生：从出生时刻起结算，不再判成坏数据（返工 P2-1）', () => {
  const pig = pigWithFood()
  pig.lastSeenAt = START - DAY
  const ageMs = pig.ageMs
  decay(pig, START + DAY, never)
  assert.equal(pig.lastSeenAt, START + DAY)
  assert.ok(pig.ageMs > ageMs, '出生之后的这一天要照常结算')
  assert.ok(Math.abs(pig.ageMs - DAY) < 1000, `出生前那一天不补（实际 ${pig.ageMs / DAY} 天）`)
})

test('返工3：老存档没有已结算水位就补 null，坏值当没有，有效值原样留下', () => {
  const pig = pigWithFood()
  const before = { ...pig, version: 12 }
  delete before.settledUpTo
  assert.equal(migrate(before, START).settledUpTo, null, '老存档：还没结算过，decay 按 lastSeenAt 处理')
  assert.equal(migrate({ ...pig, settledUpTo: '刚才' }, START).settledUpTo, null, '坏值当没有')
  assert.equal(migrate({ ...pig, settledUpTo: START - DAY }, START).settledUpTo, START - DAY, '有效值保留，存档重载后不重复结算')
})

// ===========================================================================
// 返工3 P2-C：冻结不是隐形的——跳过路径要留一条日志（不加界面提示）。
// 返工3 P3-D：settledUpTo 只增不减，全库的赋值点要受守卫。
// ===========================================================================

test('返工3 P2-C：冻结时打一条日志，写清水位与两个时间戳', () => {
  const pig = hatchEgg(START)
  pig.bornAt = START - 100 * DAY
  // 这个水位别的用例没出现过，避开日志的「同一道下界只报一次」限流。
  const held = START + 37 * DAY + 12_345
  raiseSettledUpTo(pig, held)
  pig.lastSeenAt = held
  const warnings = []
  const original = console.warn
  console.warn = (...args) => warnings.push(args.map(String).join(' '))
  try {
    decay(pig, held - 3 * DAY, never)
  } finally {
    console.warn = original
  }
  const frozen = warnings.find(line => line.includes('settle frozen'))
  assert.ok(frozen, `冻结要打日志，实际：${warnings.join(' | ')}`)
  assert.ok(frozen.includes(String(held)), '日志要有水位 / 下界时间戳')
  assert.ok(frozen.includes(String(held - 3 * DAY)), '日志要有现在的时间戳')
  assert.equal(pig.ageMs, 0, '冻结期间不结算')
})

test('返工3 P3-D：settledUpTo 只增不减，传更小的值不改水位', () => {
  const pig = hatchEgg(START)
  raiseSettledUpTo(pig, START + 5 * DAY)
  assert.equal(pig.settledUpTo, START + 5 * DAY)
  raiseSettledUpTo(pig, START + DAY)
  assert.equal(pig.settledUpTo, START + 5 * DAY, '更小的值不写进去（「同一段绝不重算」的地基）')
  raiseSettledUpTo(pig, START + 5 * DAY)
  assert.equal(pig.settledUpTo, START + 5 * DAY, '相等的值也不动')
  raiseSettledUpTo(pig, START + 7 * DAY)
  assert.equal(pig.settledUpTo, START + 7 * DAY, '更大的值照常抬高')
})

test('返工3 P3-D：往下写水位的赋值点只有 state.js 的两处重置（年龄归零 / 调试快进）', () => {
  // 静态守卫：以后谁在别处直接 `state.settledUpTo = ...`（绕过 raiseSettledUpTo 的只增判断）
  // 就当场变红。state.js 那两处是唯二合法下调点，都在注释里点名了。
  const dir = new URL('../packages/pet-core/src/core/', import.meta.url)
  const hits = {}
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.js')) continue
    const count = (readFileSync(new URL(name, dir), 'utf8').match(/\.settledUpTo\s*=/g) ?? []).length
    if (count > 0) hits[name] = count
  }
  assert.deepEqual(hits, { 'clock.js': 1, 'migrate.js': 1, 'state.js': 2 }, '水位只能由 raiseSettledUpTo 抬高；下调仅限 state.js 的两处重置')
})

test('返工3 P3-D：年龄归零把水位重设到当下，dev 快进不会被高水位挡住', () => {
  const pig = hatchEgg(START)
  decay(pig, START + 5 * DAY, never)
  assert.equal(pig.settledUpTo, START + 5 * DAY)
  ageFromNow(pig, START + 100 * DAY)
  assert.equal(pig.settledUpTo, START + 100 * DAY, '年龄归零：旧时间线丢掉，水位跟到当下')
  assert.equal(pig.ageMs, 0)
  applyDevPatch(pig, { __advanceMs: 2 * DAY }, START + 100 * DAY)
  assert.ok(pig.ageMs > 0, 'dev 快进照常结算（水位跟着退回去，没有把它挡住）')
})

for (const [label, bad] of [['NaN', Number.NaN], ['负数', -1], ['Infinity', Number.POSITIVE_INFINITY]]) {
  test(`decay 的 nowMs 自己坏掉（${label}）：原样返回、不动状态`, () => {
    const pig = pigWithFood()
    decay(pig, START + DAY, never)
    const before = JSON.parse(JSON.stringify(pig))
    assert.equal(decay(pig, bad, never), pig)
    assert.deepEqual(pig, before)
  })
}
