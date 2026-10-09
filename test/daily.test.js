// @ts-check
/**
 * B5 日常：签到、在线礼包、宠物日记。
 *
 * 数值全部来自 docs/numbers/B5-daily.md（用户 2026-10-01 确认），这里只
 * 验规则：一天从 06:00 算起、12 天一轮、断签不清零、在线只算真实时间、
 * 礼包按概率表抽、日记跨天写前一天。
 *
 * Run: node --test test/*.test.js
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hatchEgg, layEgg } from '../core.js'
import { DIARY_BOOK, GIFT_TABLE, ONLINE_GIFT, SIGN_IN_CYCLE, SIGN_IN_REWARDS } from '../data.js'
import { canSignIn, dayKeyFor, ensureDaily, giftBucketIndex, openGift, recordOnline, signIn } from '../packages/pet-core/src/core/daily.js'
import { rollerFor } from '../packages/pet-core/src/core/random.js'
import { composeDiary, diaryGroupFor, diaryView, ensureDiary, noteToday, writeDiaryIfNewDay } from '../packages/pet-core/src/core/diary.js'
import { migrate } from '../packages/pet-core/src/core/migrate.js'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** 本地时间的一个时刻，省得每次写 new Date(...).getTime()。 */
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime()

// ===========================================================================
// 一天的边界
// ===========================================================================

test('the day rolls over at 06:00, so 05:59 still counts as yesterday', () => {
  assert.equal(dayKeyFor(at(2026, 10, 1, 5, 59)), '2026-09-30')
  assert.equal(dayKeyFor(at(2026, 10, 1, 6, 0)), '2026-10-01')
  assert.equal(dayKeyFor(at(2026, 10, 1, 23, 59)), '2026-10-01')
  assert.equal(dayKeyFor(at(2026, 10, 2, 0, 30)), '2026-10-01', '熬夜到凌晨还是前一天')
})

// ===========================================================================
// 签到
// ===========================================================================

test('signing in once a day walks the 12-day ladder, then starts again', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  let clock = at(2026, 10, 1, 9)
  for (let i = 0; i < SIGN_IN_CYCLE; i += 1) {
    assert.equal(canSignIn(pig, clock), true, `day ${i + 1} must be signable`)
    const result = signIn(pig, clock)
    assert.equal(result.ok, true)
    assert.equal(result.day, i + 1, 'the ladder runs in order')
    assert.equal(canSignIn(pig, clock), false, 'twice in one day is refused')
    assert.equal(signIn(pig, clock).reason, 'signed')
    clock += DAY
  }
  assert.equal(signIn(pig, clock).day, 1, 'day 13 is day 1 again')
})

test('a missed day does not reset the ladder', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  signIn(pig, at(2026, 10, 1, 9))
  const result = signIn(pig, at(2026, 10, 5, 9))
  assert.equal(result.day, 2, 'the next reward, not back to the start')
})

test('the ladder pays what the confirmed G1 table says (7 days)', () => {
  // G1（用户 2026-10-05 确认）：第 1 天苹果和香皂，第 7 天还魂丹 + 豪华大餐 ×2，然后回到第 1 天。
  const pig = hatchEgg(at(2026, 10, 1, 9))
  let clock = at(2026, 10, 1, 9)
  const first = signIn(pig, clock)
  assert.equal(pig.inventory.apple, 3)
  assert.equal(pig.inventory.soap, 2)
  assert.ok(first.reward.includes('苹果'), first.reward)
  clock += DAY
  for (let day = 2; day <= 6; day += 1) { signIn(pig, clock); clock += DAY }
  assert.equal(pig.inventory.baicaodan, 1, 'day 6 is the 百草丹')
  const coinsBefore = pig.coins
  const seventh = signIn(pig, clock)
  assert.equal(pig.inventory.soul, 1, 'day 7 is the 还魂丹')
  assert.equal(pig.inventory.feast, 2)
  assert.ok(seventh.reward.includes('还魂丹'), seventh.reward)
  assert.equal(pig.coins, coinsBefore)
  clock += DAY
  assert.equal(signIn(pig, clock).day, 1, 'after day 7 comes day 1 again')
})

test('G1：老存档在第 8～12 天的回到第 1 天并补发第 7 天礼包；第 1～7 天原样接着领；只换算一次', () => {
  const late = hatchEgg(at(2026, 10, 1, 9))
  late.daily = { signIn: { lastDay: '2026-09-30', index: 9, total: 9 }, online: {} }
  ensureDaily(late)
  assert.equal(late.daily.signIn.index, 0)
  assert.equal(late.inventory.soul, 1)
  assert.equal(late.inventory.feast, 2)
  ensureDaily(late)
  assert.equal(late.inventory.soul, 1, '只补一次')
  const early = hatchEgg(at(2026, 10, 1, 9))
  early.daily = { signIn: { lastDay: '2026-09-30', index: 4, total: 4 }, online: {} }
  ensureDaily(early)
  assert.equal(early.daily.signIn.index, 4)
  assert.equal(early.inventory.soul, undefined)
})

test('a dead pig and an unopened box can still sign in', () => {
  const box = layEgg(at(2026, 10, 1, 9))
  assert.equal(signIn(box, at(2026, 10, 1, 9)).ok, true, 'the box on the doorstep can collect')

  const dead = hatchEgg(at(2026, 10, 1, 9))
  dead.dead = true
  dead.health = 0
  assert.equal(signIn(dead, at(2026, 10, 1, 9)).ok, true, 'a tombstone collects too')
})

test('signing in announces it and makes the pig say something', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  signIn(pig, at(2026, 10, 1, 9))
  assert.ok(pig.pending.some(entry => entry.kind === 'gift'), 'the reward is announced')
  assert.ok(pig.pending.some(entry => entry.kind === 'line'), 'and the pig talks')
})

// ===========================================================================
// 存档
// ===========================================================================

test('daily survives a restart, and an old save without it gets sane defaults', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  signIn(pig, at(2026, 10, 1, 9))
  const reloaded = migrate(JSON.parse(JSON.stringify(pig)), at(2026, 10, 1, 10))
  assert.equal(reloaded.daily.signIn.lastDay, '2026-10-01')
  assert.equal(reloaded.daily.signIn.index, 1)
  assert.equal(canSignIn(reloaded, at(2026, 10, 1, 11)), false, 'still signed today')

  // An older save has no `daily` at all.
  const old = hatchEgg(at(2026, 10, 1, 9))
  delete old.daily
  const upgraded = migrate(JSON.parse(JSON.stringify(old)), at(2026, 10, 1, 10))
  assert.deepEqual(upgraded.daily, {
    signIn: { lastDay: null, index: 0, total: 0, cycle7: true },
    online: { day: null, onlineMs: 0, given: 0, unclaimed: 0 },
  })
})

test('a corrupted daily block is repaired instead of crashing the load', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  pig.daily = { signIn: { lastDay: 42, index: -3, total: 'lots' }, online: 'nope' }
  const daily = ensureDaily(pig)
  assert.equal(daily.signIn.lastDay, null)
  assert.equal(daily.signIn.index, 0)
  assert.equal(daily.signIn.total, 0)
  assert.equal(daily.online.given, 0)
})

test('the confirmed ladder is 7 entries and every key is a real item', () => {
  assert.equal(SIGN_IN_CYCLE, 7)
  assert.deepEqual(SIGN_IN_REWARDS.map(entry => entry.items.length >= 1 || entry.coins > 0), Array(7).fill(true))
})

// ===========================================================================
// 在线礼包
// ===========================================================================

test('only a poll gap of 30 seconds or less counts as being online', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  const start = at(2026, 10, 1, 9)
  recordOnline(pig, start, start + ONLINE_GIFT.pollGapMaxMs)
  assert.equal(pig.daily.online.onlineMs, ONLINE_GIFT.pollGapMaxMs, 'a 30s gap counts')

  const idle = hatchEgg(at(2026, 10, 1, 9))
  recordOnline(idle, start, start + ONLINE_GIFT.pollGapMaxMs + 1)
  assert.equal(idle.daily.online.onlineMs, 0, 'a longer gap means nobody was there')

  const first = hatchEgg(at(2026, 10, 1, 9))
  recordOnline(first, 0, start)
  assert.equal(first.daily.online.onlineMs, 0, 'the first poll has nothing to measure')
})

/** 每 10 秒轮询一次，跑 `hours` 小时。 */
function pollFor(pig, fromMs, hours) {
  let clock = fromMs
  for (let i = 0; i < 360 * hours; i += 1) {
    const next = clock + 10_000
    recordOnline(pig, clock, next)
    clock = next
  }
  return clock
}

test('one hour online hands out one gift, and the day caps at 8', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  let clock = pollFor(pig, at(2026, 10, 1, 9), 1)
  assert.equal(pig.daily.online.unclaimed, 1, 'one full hour, one gift')
  assert.equal(pig.daily.online.given, 1)

  // Open each gift as it arrives; 8 is the daily cap.
  openGift(pig, clock)
  for (let hour = 0; hour < 12; hour += 1) {
    clock = pollFor(pig, clock, 1)
    if (pig.daily.online.unclaimed > 0) openGift(pig, clock)
  }
  assert.equal(pig.daily.online.given, ONLINE_GIFT.perDay, '8 a day')
})

test('at most three gifts wait to be opened', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  pollFor(pig, at(2026, 10, 1, 9), 6)
  assert.equal(pig.daily.online.unclaimed, ONLINE_GIFT.unclaimedMax)
  // Hours kept being consumed — the pig just stopped being paid for them.
  assert.ok(pig.daily.online.onlineMs < ONLINE_GIFT.perGiftMs)
  assert.equal(pig.daily.online.given, ONLINE_GIFT.unclaimedMax)
})

test('the time scale does not speed up online gifts', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  pig.timeScale = 60
  let clock = at(2026, 10, 1, 9)
  for (let i = 0; i < 360; i += 1) {
    const next = clock + 10_000
    recordOnline(pig, clock, next)
    clock = next
  }
  assert.equal(pig.daily.online.unclaimed, 1, 'real time only')
})

test('a new day resets the online counter but keeps unopened gifts', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  let clock = at(2026, 10, 1, 9)
  for (let i = 0; i < 360; i += 1) {
    const next = clock + 10_000
    recordOnline(pig, clock, next)
    clock = next
  }
  assert.equal(pig.daily.online.unclaimed, 1)

  const tomorrow = at(2026, 10, 2, 9)
  recordOnline(pig, tomorrow - 10_000, tomorrow)
  assert.equal(pig.daily.online.onlineMs, 10_000, 'a fresh day')
  assert.equal(pig.daily.online.given, 0)
  assert.equal(pig.daily.online.unclaimed, 1, 'the gift you never opened is still there')
})

test('opening a gift pays something, and an empty queue is refused', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  assert.deepEqual(openGift(pig, at(2026, 10, 1, 9)), { ok: false, reason: 'empty' })

  pig.daily.online.unclaimed = 2
  const coinsBefore = pig.coins
  const itemsBefore = Object.values(pig.inventory).reduce((sum, n) => sum + n, 0)
  const opened = openGift(pig, at(2026, 10, 1, 9))
  assert.equal(opened.ok, true)
  assert.equal(pig.daily.online.unclaimed, 1, 'one at a time')
  const coinsAfter = pig.coins
  const itemsAfter = Object.values(pig.inventory).reduce((sum, n) => sum + n, 0)
  assert.ok(coinsAfter > coinsBefore || itemsAfter > itemsBefore, 'it paid something')
  assert.ok(opened.reward.length > 0)
})

test('the gift table draws close to the confirmed probabilities', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  const next = rollerFor(pig)
  const rounds = 10000
  const counts = new Array(GIFT_TABLE.length).fill(0)
  for (let i = 0; i < rounds; i += 1) counts[giftBucketIndex(next())] += 1

  GIFT_TABLE.forEach((bucket, index) => {
    const share = counts[index] / rounds
    assert.ok(
      Math.abs(share - bucket.chance) <= 0.02,
      `bucket ${index} (${bucket.chance}) came out at ${share.toFixed(4)}`,
    )
  })
})

// ===========================================================================
// 宠物日记
// ===========================================================================

test('the first read after 06:00 writes yesterday into a diary entry', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  writeDiaryIfNewDay(pig, at(2026, 10, 1, 9))     // 第一次读：给今天归位
  noteToday(pig, 'feed')
  noteToday(pig, 'feed')
  noteToday(pig, 'turn', 43)

  assert.equal(writeDiaryIfNewDay(pig, at(2026, 10, 1, 23, 0)), false, '同一天不落笔')
  assert.equal(pig.diary.entries.length, 0)

  assert.equal(writeDiaryIfNewDay(pig, at(2026, 10, 2, 6, 30)), true, '换天落笔')
  assert.equal(pig.diary.entries.length, 1)
  const entry = pig.diary.entries[0]
  assert.equal(entry.day, '2026-10-01')
  // G 批次：从日记本里挑一篇。喂了 2 顿、主人敲了 43 轮：最要紧的是「陪主人干活」。
  assert.ok(DIARY_BOOK.busy.map(text => text.split('[主人]').join('主人')).includes(entry.text), entry.text)
  assert.equal(pig.diary.today.counts.feed, undefined, '今天的计数清零了')
  assert.equal(pig.diary.today.day, '2026-10-02')
})

test('a day where nothing happened still gets a line', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  writeDiaryIfNewDay(pig, at(2026, 10, 1, 9))
  writeDiaryIfNewDay(pig, at(2026, 10, 2, 7, 0))
  assert.equal(pig.diary.entries.length, 1)
  const lonely = DIARY_BOOK.lonely.map(text => text.split('[主人]').join('主人'))
  assert.ok(lonely.includes(pig.diary.entries[0].text), pig.diary.entries[0].text)
})

test('the diary picks the group of the day\'s biggest event', () => {
  assert.equal(diaryGroupFor({}), 'lonely')
  assert.equal(diaryGroupFor({ feed: 1 }), 'daily')
  assert.equal(diaryGroupFor({ feed: 6 }), 'glutton')
  assert.equal(diaryGroupFor({ feed: 6, work: 1 }), 'work')
  assert.equal(diaryGroupFor({ illness: 1, cure: 1 }), 'cure')
  assert.equal(diaryGroupFor({ illness: 1, wrongMedicine: 1 }), 'wrongMedicine')
  assert.equal(diaryGroupFor({ turn: 12 }), 'busy')
  // 每组都有日记，全书几百篇，每篇都不长。
  let total = 0
  for (const [group, pool] of Object.entries(DIARY_BOOK)) {
    assert.ok(pool.length >= 10, group)
    for (const text of pool) assert.ok(text.length <= 60, text)
    total += pool.length
  }
  assert.ok(total >= 300, String(total))
})

test('the diary does not repeat a recent page while the group has fresh ones', () => {
  const recent = DIARY_BOOK.bathe.slice(1).map(text => text.split('[主人]').join('主人'))
  const text = composeDiary({ bathe: 1 }, '主人', () => 0.99, recent)
  assert.equal(text, DIARY_BOOK.bathe[0].split('[主人]').join('主人'))
})

test('the owner name replaces the placeholder in the diary', () => {
  const text = composeDiary({ cure: 1 }, '老板', () => 0.1)
  assert.ok(text.includes('老板'), text)
  assert.ok(!text.includes('[主人]'), '占位符必须换掉')
})

test('only the newest 60 entries are kept', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  writeDiaryIfNewDay(pig, at(2026, 10, 1, 9))
  for (let day = 1; day <= 70; day += 1) {
    writeDiaryIfNewDay(pig, at(2026, 10, 1 + day, 7, 0))
  }
  assert.equal(pig.diary.entries.length, 60, '71 days lived, 60 kept')
  // 每次落笔写的是「前一天」，所以最后一次写的是 12-09 那篇。
  assert.equal(pig.diary.entries[59].day, '2026-12-09', 'the newest one is last in the save')
  assert.equal(pig.diary.entries[0].day, '2026-10-11', 'the oldest survivors start here')
})

test('the panel gets the diary newest-first, and old saves get an empty one', () => {
  const pig = hatchEgg(at(2026, 10, 1, 9))
  writeDiaryIfNewDay(pig, at(2026, 10, 1, 9))
  writeDiaryIfNewDay(pig, at(2026, 10, 2, 7, 0))
  writeDiaryIfNewDay(pig, at(2026, 10, 3, 7, 0))
  const view = diaryView(pig)
  assert.equal(view[0].day, '2026-10-02', 'newest first')

  const old = hatchEgg(at(2026, 10, 1, 9))
  delete old.diary
  const upgraded = migrate(JSON.parse(JSON.stringify(old)), at(2026, 10, 1, 10))
  assert.deepEqual(upgraded.diary, { entries: [], today: { day: null, counts: {} } })

  const broken = hatchEgg(at(2026, 10, 1, 9))
  broken.diary = { entries: [{ day: 1 }, 'nope', { day: '2026-10-01', text: '好' }], today: { counts: { feed: -2, turn: 3 } } }
  const repaired = ensureDiary(broken)
  assert.deepEqual(repaired.entries, [{ day: '2026-10-01', text: '好' }])
  assert.deepEqual(repaired.today.counts, { turn: 3 })
})

test('调试补丁：设签到第几天（今天还没签）、礼包攒几个、让猪说某个场景', async () => {
  const { applyDevPatch } = await import('../packages/pet-core/src/core.js')
  const pig = hatchEgg(at(2026, 10, 1, 9))
  signIn(pig, at(2026, 10, 1, 9))
  applyDevPatch(pig, { signInDay: 7, gifts: 5, say: 'full' }, at(2026, 10, 1, 10))
  assert.equal(pig.daily.signIn.index, 6)
  assert.equal(pig.daily.signIn.lastDay, null)
  assert.equal(pig.daily.online.unclaimed, 3, '最多攒 3 个')
  assert.equal(signIn(pig, at(2026, 10, 1, 11)).day, 7)
})
