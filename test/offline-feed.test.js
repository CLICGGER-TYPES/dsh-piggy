// @ts-check
/** 离线喂食按真实结算时钟消费，在线和关闭时保留原规则。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
  test(`模糊测试 4.1（sample ${name}）：坏游标不按几百万步补结算`, () => {
    const pig = migrate(loadFixture(`save-fuzz-${name}`), FUZZ_NOW)
    const ageMs = pig.ageMs
    const satiety = pig.satiety
    // 修复前：crashes/01 与 03 各约 77 秒（本机实测），lastSeenAt = -1e15 时等于不返回。
    decay(pig, FUZZ_NOW + DAY, never)
    assert.equal(pig.lastSeenAt, FUZZ_NOW + DAY, '坏游标按刚看过处理，修到 nowMs')
    assert.equal(pig.ageMs, ageMs, '坏游标不补结算：不凭空长大')
    assert.equal(pig.satiety, satiety, '坏游标不补结算：不凭空衰减')
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
  test(`坏游标（${label}）一律不补结算`, () => {
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
  // 少了它就会被 400 天上限兜成「凭空结算 400 天」。这里锁住这个耦合。
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

test('出生时刻在将来（快机器上孵的猪）：对表回拨满一天就解冻，年龄继续增长', () => {
  // 返工 P2-1 复现 B：旧实现解冻后写出的游标仍早于出生，又落回「坏游标」分支，
  // 于是「满一天接受新时钟」这个出口被自己吃掉、猪永久冻住。
  const pig = pigWithFood()
  decay(pig, START + 10 * DAY, never)
  const held = pig.lastSeenAt
  pig.bornAt = START + 5 * DAY
  decay(pig, START, never)
  assert.equal(pig.lastSeenAt, held, '回拨当下保留游标')
  decay(pig, START + DAY, never)
  assert.equal(pig.lastSeenAt, START + DAY, '满一天后接受新时钟')
  const frozen = pig.ageMs
  decay(pig, START + 2 * DAY, never)
  assert.ok(pig.ageMs > frozen, '解冻后年龄必须继续增长')
})

test('冻结期间有进行中的活动：解冻后只结算一次、工资只发一份', async () => {
  const { startWork } = await import('../core.js')
  const pig = pigWithFood()
  decay(pig, START + 2 * DAY, never)
  startWork(pig, 'bricks', START + 2 * DAY)
  const endsAt = pig.activity.endsAt
  decay(pig, START - 3 * DAY, never)
  assert.equal(pig.stats.jobs, 0, '回拨当下不结算')
  decay(pig, START - 2 * DAY, never)
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

test('400 天边界两侧：正好 400 天与 400 天 + 1ms 都按整整 400 天补', { timeout: 5000 }, () => {
  const full = hatchEgg(START)
  full.inventory = { apple: 300, bread: 300 }
  decay(full, START + 400 * DAY, never)
  assert.ok(Math.abs(full.ageMs - 400 * DAY) <= 1, `正好 400 天应全额结算（实际 ${full.ageMs}）`)

  const over = hatchEgg(START)
  over.inventory = { apple: 300, bread: 300 }
  decay(over, START + 400 * DAY + 1, never)
  assert.equal(over.lastSeenAt, START + 400 * DAY + 1)
  assert.ok(Math.abs(over.ageMs - 400 * DAY) <= 1, `400 天 + 1ms 不该少算（实际 ${over.ageMs}）`)
  const atBoundary = over.ageMs
  decay(over, START + 400 * DAY + 2, never)
  assert.ok(Math.abs(over.ageMs - atBoundary - 1) <= 1, '跨过边界之后按新增的 1ms 继续，曲线连续')
})

test('回拨跨重启累计：存档往返后接着数满一天才接受新时钟', () => {
  const pig = pigWithFood()
  decay(pig, START + 2 * DAY, never)
  const held = pig.lastSeenAt
  decay(pig, START, never)
  assert.equal(pig.clockRollbackAt, START, '回拨后第一次被看到，开始数')
  decay(pig, START + 20 * HOUR, never)
  assert.equal(pig.lastSeenAt, held, '不满一天不结算')
  assert.equal(pig.clockRollbackAt, START)
  const reloaded = JSON.parse(JSON.stringify(pig))
  assert.equal(reloaded.clockRollbackAt, START, '标记要跟着存档一起回来')
  decay(reloaded, START + 25 * HOUR, never)
  assert.equal(reloaded.lastSeenAt, START + 25 * HOUR, '重启前 20 小时 + 重启后 5 小时 = 满一天')
  assert.equal(reloaded.clockRollbackAt, null)
  assert.equal(reloaded.ageMs, pig.ageMs, '冻结期间不补结算')
})

test('关掉离线喂食 + 超长离线：饿到 0、不动背包（产品期望待用户确认）', () => {
  const pig = hatchEgg(START)
  pig.isOfflineFeedEnabled = false
  pig.inventory = { apple: 300 }
  decay(pig, START + 400 * DAY, never)
  assert.equal(pig.satiety, 0, '不开自动吃就是饿到 0')
  assert.equal(pig.inventory.apple, 300, '不开开关就不动背包')
  assert.equal(pig.stats.feeds, 0)
  assert.ok(Math.abs(pig.ageMs - 400 * DAY) <= 1000)
  // 会不会病死全看疾病骰子：never（全 0.99）活着。现状是否符合产品期望（必病必死？
  // 还是留一条命？）在返工报告里标成「待用户确认」，这里只把现状钉住。
  assert.equal(pig.dead, false)
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

test('坏但「能用」的游标 + 巨远的现在：结算时间与跨度都被钉住，不会卡死', { timeout: 5000 }, () => {
  // 游标有限、正数、在出生之后 → 走 400 天上限。上限被删掉时这里要按 SETTLE_STEP_MS
  // 走 144 万步（5000 天）、ageMs 也会变成 5000 天，两条断言都会红。
  // 注：node:test 的 { timeout } 不会打断同步执行的测试体（实测过），所以这里用
  // 结果与墙上时间断言，而不是只挂一个 timeout。
  const pig = hatchEgg(START)
  pig.inventory = { apple: 300, bread: 300 }
  pig.lastSeenAt = START + 1
  const started = Date.now()
  decay(pig, START + 5000 * DAY, never)
  const elapsed = Date.now() - started
  assert.equal(pig.lastSeenAt, START + 5000 * DAY)
  assert.ok(Math.abs(pig.ageMs - 400 * DAY) <= 1000, `只补最近 400 天（实际 ${pig.ageMs / DAY} 天）`)
  assert.ok(elapsed < 10_000, `400 天的结算应在秒级完成（实际 ${elapsed}ms）`)
})

test('合法的离开 100 天照常结算', { timeout: 5000 }, () => {
  const pig = hatchEgg(START)
  pig.inventory = { apple: 300, bread: 300 }
  decay(pig, START + 100 * DAY, never)
  assert.equal(pig.dead, false, '有离线喂食，100 天不会饿死')
  assert.ok(Math.abs(pig.ageMs - 100 * DAY) < 1000, `100 天应全部结算（实际 ${pig.ageMs / DAY} 天）`)
  assert.equal(pig.lastSeenAt, START + 100 * DAY)
})

test('单次结算跨度封顶 400 天：更早的部分不补', { timeout: 5000 }, () => {
  const pig = hatchEgg(START)
  pig.inventory = { apple: 300, bread: 300 }
  decay(pig, START + 500 * DAY, never)
  assert.equal(pig.lastSeenAt, START + 500 * DAY)
  assert.ok(pig.ageMs <= 400 * DAY + 1000, `最多补 400 天（实际 ${pig.ageMs / DAY} 天）`)
  assert.ok(pig.ageMs > 399 * DAY, '上限内的 400 天要照常结算')
})
