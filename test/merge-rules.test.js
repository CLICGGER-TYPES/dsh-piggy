// @ts-check
/** #14 合并规则：金样例、逐字段、守卫、幂等、皮肤改名和收据。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DYNAMIC_MAP_RULES, MERGE_RULES, MERGE_RULES_VERSION, MergeError, assertMergeable, mergeReceipts, mergeSaveStates,
  mergeSummary, migrate, hatchEgg, missingMergeRules, resumeSuspendedPig, suspensionFingerprint, dayKeyFor,
} from '../core.js'
import { ACHIEVEMENTS, FISH } from '../packages/pet-core/src/data.js'
import { emptyMergeTarget } from '../runtime/merge-source.js'

const NOW = 1_800_000_000_000
const DAY = 86_400_000
const todayKey = () => dayKeyFor(NOW)
const clone = value => structuredClone(value)
const fresh = () => migrate(hatchEgg(NOW), NOW)
const merge = (T, S, extra = {}) => mergeSaveStates(T, S, { nowMs: NOW, targetReceipts: [], sourceReceipts: [], ...extra })

function receipt(index, patch = {}) {
  return { version: 1, source: 'dsh', id: `turn:${index}`, type: 'turn', at: NOW - index * 1000, disposition: 'applied', ...patch }
}

function golden() {
  const T = fresh(), S = fresh()
  T.name = '团团'; S.name = '猪猪'
  T.xp = 20000; S.xp = 12000
  T.ageMs = 30 * DAY; S.ageMs = 21 * DAY
  T.coins = 1240; S.coins = 880
  T.inventory = { apple: 2 }; S.inventory = { apple: 3 }
  T.traits = { ...T.traits, intel: 3 }; S.traits = { ...S.traits, intel: 1 }
  T.lessons = { mathematics: 5 }; S.lessons = { mathematics: 3 }
  T.daily.signIn = { lastDay: todayKey(), index: 9, total: 10, cycle7: true }
  S.daily.signIn = { lastDay: todayKey(), index: 6, total: 7, cycle7: true }
  T.daily.online = { day: todayKey(), onlineMs: 1000, given: 1, unclaimed: 2 }
  S.daily.online = { day: todayKey(), onlineMs: 2000, given: 2, unclaimed: 3 }
  T.stats = { ...T.stats, tools: 100 }; S.stats = { ...S.stats, tools: 50 }
  const keys = ACHIEVEMENTS.map(item => item.key)
  T.achievements.unlocked = Object.fromEntries(keys.slice(0, 18).map((key, index) => [key, { firstAt: NOW - index * 1000, recovered: false }]))
  S.achievements.unlocked = Object.fromEntries(keys.slice(13, 25).map((key, index) => [key, { firstAt: NOW - (index + 5) * 1000, recovered: false }]))
  for (const key of FISH.slice(0, 7).map(item => item.key)) T.dex.fish[key] = { firstAt: NOW - 1000, count: 1 }
  for (const key of [0, 1, 2, 7, 8].map(index => FISH[index].key)) S.dex.fish[key] = { firstAt: NOW - 2000, count: 2 }
  T.diary.entries = []
  S.diary.entries = Array.from({ length: 4 }, (_, index) => ({ day: `2026-10-0${index + 1}`, text: `第 ${index} 天` }))
  const targetReceipts = Array.from({ length: 10 }, (_, index) => receipt(index))
  const sourceReceipts = [
    ...Array.from({ length: 2 }, (_, index) => receipt(index)), // 与 T 重叠
    ...Array.from({ length: 6 }, (_, index) => receipt(index + 10)),
  ]
  return { T, S, targetReceipts, sourceReceipts }
}

test('金样例：资产相加、进度取高、身份跟桌宠、徽章并集', () => {
  const { T, S, targetReceipts, sourceReceipts } = golden()
  const result = merge(T, S, { targetReceipts, sourceReceipts })
  assert.equal(result.state.name, '团团')
  assert.equal(result.state.xp, 20000)
  assert.equal(Math.floor(result.state.ageMs / DAY), 30)
  assert.equal(result.state.coins, 2120)
  assert.equal(result.state.inventory.apple, 5)
  assert.equal(result.state.traits.intel, 3)
  assert.equal(result.state.lessons.mathematics, 5)
  assert.equal(result.state.daily.signIn.total, 17)
  assert.equal(result.state.daily.signIn.index, 9, '同一天取较大的 index')
  assert.equal(result.state.daily.online.unclaimed, 5)
  assert.equal(result.state.stats.tools, 150)
  assert.equal(Object.keys(result.state.achievements.unlocked).length, 25)
  assert.equal(Object.keys(result.state.dex.fish).length, 9)
  assert.equal(result.receipts.length, 16)
  assert.equal(result.report.result.newBadges, 7)
  assert.equal(result.report.result.newDiary, 4)
  assert.equal(result.report.result.coins, 2120)
  assert.equal(result.report.sides.target.name, '团团')
  assert.equal(result.report.sides.source.name, '猪猪')
  assert.ok(result.report.editors.look.skin.includes('mint') || Array.isArray(result.report.editors.look.skin))
  assert.ok(result.report.autoMerge.length > 0)
  assert.deepEqual(result.state.activity, null)
  assert.deepEqual(result.state.pomodoro.startedAt, null)
  assert.deepEqual(result.state.fishing.pending, null)
})

test('两边金币物品相加：纸盒 500 也加；无存档不补 500', () => {
  const T = fresh(), S = fresh()
  T.hatched = false; T.dead = false; T.satiety = 70; T.cleanliness = 90; T.coins = 500; T.inventory = {}
  S.coins = 880; S.satiety = 40; S.happiness = 35; S.cleanliness = 50
  const result = merge(T, S)
  assert.equal(result.state.coins, 1380)
  assert.equal(result.state.hatched, true)
  assert.equal(result.state.name, S.name, '身份跟活着的内嵌猪')
  assert.equal(result.state.satiety, 40, '状态不取纸盒的 70')
  assert.equal(result.state.cleanliness, 50)
  const virtual = emptyMergeTarget(NOW)
  const noState = mergeSaveStates(virtual, S, { nowMs: NOW, targetReceipts: [], sourceReceipts: [] })
  assert.equal(noState.state.coins, 880)
})

test('生命方优先：活着的一方贡献状态；墓碑的历史与资产仍保留', () => {
  const T = fresh(), S = fresh()
  T.dead = true; T.health = 0; T.diedAt = NOW - DAY; T.hatched = true; T.satiety = 90; T.happiness = 95; T.coins = 300
  T.stats.deaths = 2; T.illness = { chain: 0, stage: 3, since: NOW - DAY, progressMs: 100 }
  S.dead = false; S.health = 4; S.satiety = 30; S.happiness = 40; S.illness = null; S.coins = 500
  const result = merge(T, S)
  assert.equal(result.state.dead, false)
  assert.equal(result.state.satiety, 30)
  assert.equal(result.state.happiness, 40)
  assert.equal(result.state.health, 4)
  assert.equal(result.state.illness, null)
  assert.equal(result.state.coins, 800)
  assert.equal(result.state.stats.deaths, 2)
})

test('疾病整组同源：取阶段较低；同阶段取进度小；health 按阶段封顶', () => {
  const T = fresh(), S = fresh()
  T.illness = { chain: 1, stage: 3, since: NOW - 5000, progressMs: 900 }
  S.illness = { chain: 0, stage: 1, since: NOW - 1000, progressMs: 200 }
  let result = merge(T, S)
  assert.deepEqual(result.state.illness, S.illness)
  assert.equal(result.state.health, Math.min(4, 4))
  T.illness = { chain: 0, stage: 2, since: NOW - 9000, progressMs: 900 }
  S.illness = { chain: 2, stage: 2, since: NOW - 1000, progressMs: 100 }
  result = merge(T, S)
  assert.deepEqual(result.state.illness, S.illness)
  assert.equal(result.state.health, Math.min(4, 3))
})

test('钓鱼：撞 id 的鱼与自动库存换 id 共存；鱼竿取高；钓点并集；当日次数按天', () => {
  const T = fresh(), S = fresh()
  T.fishing.bag = [{ id: 'catch-1-1', key: 'crucian', sizeCm: 10, price: 5, caughtAt: NOW }]
  S.fishing.bag = [{ id: 'catch-1-1', key: 'carp', sizeCm: 20, price: 9, caughtAt: NOW }, { id: 'catch-1-2', key: 'carp', sizeCm: 22, price: 9, caughtAt: NOW }]
  T.fishing.seq = 1; S.fishing.seq = 2
  T.fishing.rod = 2; S.fishing.rod = 3
  T.fishing.spots = ['river', 'pond']; S.fishing.spots = ['river', 'reef']
  T.fishing.autoDay = todayKey(); S.fishing.autoDay = todayKey()
  T.fishing.autoTrips = 1; S.fishing.autoTrips = 2
  T.fishing.automation = { basket: 1, duration: 1, baitBox: 0, usedMs: 100, stock: [{ id: 'auto-1', key: 'carp', sizeCm: 20, price: 9, caughtAt: NOW }] }
  S.fishing.automation = { basket: 2, duration: 2, baitBox: 1, usedMs: 300, stock: [{ id: 'auto-1', key: 'crucian', sizeCm: 10, price: 5, caughtAt: NOW }] }
  const result = merge(T, S)
  assert.equal(result.state.fishing.bag.length, 3)
  assert.equal(new Set(result.state.fishing.bag.map(fish => fish.id)).size, 3)
  assert.equal(result.state.fishing.bag[0].key, 'crucian')
  assert.equal(result.state.fishing.rod, 3)
  assert.deepEqual(result.state.fishing.spots, ['river', 'pond', 'reef'])
  assert.equal(result.state.fishing.autoTrips, 3)
  assert.equal(result.state.fishing.automation.basket, 2)
  assert.equal(result.state.fishing.automation.stock.length, 2)
  assert.equal(new Set(result.state.fishing.automation.stock.map(fish => fish.id)).size, 2)
})

test('自定义皮肤同名不同内容改名并存，两套都能用；同步 dex.skins', () => {
  const T = fresh(), S = fresh()
  const skin = { key: 'mint', label: '薄荷', author: 'A', description: '', emoji: '🎨', art: 'custom-mint', scenes: ['idle', 'eat', 'bathe', 'pet', 'play', 'sleep', 'study', 'trip', 'work', 'relaxed'], custom: true }
  T.customSkins = [clone(skin)]
  S.customSkins = [{ ...clone(skin), label: '薄荷二号' }]
  T.dex.skins.mint = { firstAt: NOW - 1000, count: 2 }
  S.dex.skins.mint = { firstAt: NOW - 2000, count: 3 }
  const result = merge(T, S, { targetSkins: { mint: 'aaa' }, sourceSkins: { mint: 'bbb' } })
  assert.deepEqual(result.skinRenames, { mint: 'mint-2' })
  assert.deepEqual(result.state.customSkins.map(item => item.key), ['mint', 'mint-2'])
  assert.equal(result.state.dex.skins['mint-2'].count, 3)
  assert.equal(result.state.dex.skins.mint.count, 2)
  assert.equal(result.state.dex.skins.mint.count + result.state.dex.skins['mint-2'].count, 5)
  assert.match(result.report.conflicts[0].message, /mint-2/)
  const same = merge(T, S, { targetSkins: { mint: 'same' }, sourceSkins: { mint: 'same' } })
  assert.deepEqual(same.state.customSkins.map(item => item.key), ['mint'])
})

test('扩展：只有一边有数据时复制并提示重装；第三方冲突默认桌宠；钩子优先', () => {
  const T = fresh(), S = fresh()
  T.extData = { garden: { level: 2 } }
  S.extData = { garden: { level: 9 }, farm: { version: 5 } }
  T.extensions = { garden: true, farm: true }
  S.extensions = { garden: true, farm: true }
  const result = merge(T, S, { targetInstalled: ['garden'] })
  assert.deepEqual(result.state.extData.garden, { level: 2 })
  assert.deepEqual(result.state.extData.farm, { version: 5 })
  assert.match(result.report.warnings.join(' '), /farm.*重新安装/)
  const chosen = merge(T, S, { targetInstalled: ['garden', 'farm'], choices: { extensions: { garden: 'source' } } })
  assert.deepEqual(chosen.state.extData.garden, { level: 9 })
  const hooked = merge(T, S, { hooks: { garden: (target, source) => ({ data: { level: target.level + source.level }, warnings: ['慢'], conflicts: [] }) } })
  assert.deepEqual(hooked.state.extData.garden, { level: 11 })
  assert.match(hooked.report.warnings.join(' '), /慢/)
})

test('钩子自报未解决的 conflicts：降级二选一，两份数据都留着并警告，不默默接受钩子的 data', () => {
  const T = fresh(), S = fresh()
  T.extData = { garden: { level: 2, seeds: { apple: 3 } } }
  S.extData = { garden: { level: 9, seeds: { apple: 1 } } }
  T.extensions = { garden: true }
  S.extensions = { garden: true }
  const hooks = { garden: () => ({ data: { level: 11 }, warnings: ['先试了一下'], conflicts: [{ key: 'seeds', message: '种子对不上' }] }) }
  const result = merge(T, S, { hooks, targetInstalled: ['garden'] })
  assert.deepEqual(result.state.extData.garden, { level: 2, seeds: { apple: 3 } }, '默认保留桌宠那份，不用钩子那份')
  const conflict = result.report.conflicts.find(item => item.key === 'ext:garden')
  assert.ok(conflict, '未解决的钩子冲突必须进二选一')
  assert.deepEqual(conflict.options, ['target', 'source'])
  assert.equal(conflict.default, 'target')
  assert.match(result.report.warnings.join(' '), /未解决的冲突/)
  assert.match(result.report.warnings.join(' '), /种子对不上/)
  // 用户选来源端时拿到来源那份，说明两份数据都还在
  const chosen = merge(T, S, { hooks, targetInstalled: ['garden'], choices: { extensions: { garden: 'source' } } })
  assert.deepEqual(chosen.state.extData.garden, { level: 9, seeds: { apple: 1 } })
  // conflicts 是空数组时维持钩子自动合并，不额外冒二选一
  const clean = merge(T, S, { hooks: { garden: (target, source) => ({ data: { level: target.level + source.level }, warnings: [], conflicts: [] }) }, targetInstalled: ['garden'] })
  assert.deepEqual(clean.state.extData.garden, { level: 11 })
  assert.equal(clean.report.conflicts.some(item => item.key === 'ext:garden'), false)
})

test('收据：并集、同 key 不同内容保留 T 并警告、窗口外剔除、超上限拒绝', () => {
  const base = receipt(1)
  const merged = mergeReceipts([base], [{ ...base, type: 'tool' }, receipt(2), { ...receipt(3), at: NOW - 8 * DAY }], NOW)
  assert.equal(merged.receipts.length, 2)
  assert.equal(merged.receipts[0].type, 'turn')
  assert.match(merged.warnings.join(' '), /内容不同/)
  assert.throws(() => mergeReceipts(Array.from({ length: 20001 }, (_, index) => receipt(index)), [], NOW), error => error instanceof MergeError && error.code === 'too-many-receipts')
})

test('身份和偏好的「改…」：合法值写入；非法组合拒绝；不消耗 profileEdits', () => {
  const T = fresh(), S = fresh()
  T.dex.forms.swine = { firstAt: NOW, count: 1 }
  T.dress = ['scarf']; T.worn = ['scarf']
  const beforeEdits = T.profileEdits
  const choices = {
    name: { side: 'custom', value: '团子' },
    look: { side: 'custom', form: 'swine', skin: 'default', worn: ['scarf'] },
    personality: { side: 'custom', personality: 'sisterly', catchphrase: '走吧', motto: '今天也要开心', birthday: { month: 5, day: 2 } },
    preferences: { side: 'custom', ownerName: '主人', quiet: true, isOfflineFeedEnabled: false, timeScale: 2, spot: 'river' },
  }
  const result = merge(T, S, { choices })
  assert.equal(result.state.name, '团子')
  assert.equal(result.state.form, 'swine')
  assert.deepEqual(result.state.worn, ['scarf'])
  assert.equal(result.state.personality, 'sisterly')
  assert.equal(result.state.catchphrase, '走吧')
  assert.deepEqual(result.state.birthday, { month: 5, day: 2 })
  assert.equal(result.state.dialogue.quiet, true)
  assert.equal(result.state.timeScale, 2)
  assert.equal(result.state.profileEdits, beforeEdits)
  assert.throws(() => merge(T, S, { choices: { name: { side: 'custom', value: '' } } }), /选择不合法/)
  assert.throws(() => merge(T, S, { choices: { name: { side: 'custom', value: '一二三四五六' } } }), /选择不合法/)
  const fiveName = merge(T, S, { choices: { name: { side: 'custom', value: '一二三四五' } } })
  assert.equal(fiveName.state.name, '一二三四五')
  // 旧档里的长名字选边时原样保留，不截断（用户 10 月 21 日确认：新输入 5 字）。
  const longTarget = fresh()
  longTarget.name = '一二三四五六七八九十一二三四五六'
  const kept = merge(longTarget, S, { choices: { name: { side: 'target' } } })
  assert.equal(kept.state.name, longTarget.name)
  assert.throws(() => merge(T, S, { choices: { look: { side: 'custom', form: 'nope' } } }), /选择不合法/)
  assert.throws(() => merge(T, S, { choices: { preferences: { side: 'custom', spot: 'moon' } } }), /选择不合法/)
  assert.throws(() => merge(T, S, { choices: { preferences: { side: 'custom', timeScale: 0 } } }), /选择不合法/)
})

test('日常/日记/番茄/账本/钱包/纪念品/记忆按 6.2 合并', () => {
  const T = fresh(), S = fresh()
  T.daily.signIn = { lastDay: '2026-10-01', index: 1, total: 3, cycle7: true }
  S.daily.signIn = { lastDay: '2026-10-03', index: 4, total: 2, cycle7: true }
  T.diary.entries = [{ day: '2026-10-02', text: 'A' }]
  S.diary.entries = [{ day: '2026-10-02', text: 'B' }, { day: '2026-10-01', text: 'C' }]
  T.pomodoro = { ...T.pomodoro, day: dayKeyFor(NOW), todayDone: 2, restUntil: NOW + 1000 }
  S.pomodoro = { ...S.pomodoro, day: dayKeyFor(NOW), todayDone: 5, restUntil: NOW + 2000 }
  T.economy = { totals: { work: { in: 10, out: 0 } }, days: [{ day: '2026-10-01', in: { work: 10 }, out: {} }], fatigue: 0.2 }
  S.economy = { totals: { work: { in: 5, out: 2 } }, days: [{ day: '2026-10-01', in: { work: 5 }, out: { work: 2 } }], fatigue: 0.5 }
  T.wallets = { farm: { label: '菜币', emoji: '🥕', rate: 0.1, buyable: true, balance: 10 } }
  S.wallets = { farm: { label: '菜币', emoji: '🥕', rate: 0.1, buyable: true, balance: 20 } }
  T.souvenirs = [{ key: 'shell', gotAt: NOW, label: '贝壳' }]
  S.souvenirs = [{ key: 'shell', gotAt: NOW, label: '贝壳' }, { key: 'shell', gotAt: NOW + 1, label: '贝壳' }]
  T.memories = ['甲']; S.memories = ['乙', '甲']
  const result = merge(T, S)
  assert.equal(result.state.daily.signIn.lastDay, '2026-10-03')
  assert.equal(result.state.daily.signIn.index, 4)
  assert.equal(result.state.daily.signIn.total, 5)
  assert.equal(result.state.diary.entries.find(entry => entry.day === '2026-10-02').text, 'A\nB')
  assert.equal(result.state.pomodoro.todayDone, 5)
  assert.equal(result.state.economy.totals.work.in, 15)
  assert.equal(result.state.economy.totals.work.out, 2)
  assert.equal(result.state.economy.fatigue, 0.5)
  assert.equal(result.state.wallets.farm.balance, 30)
  assert.equal(result.state.souvenirs.length, 2)
  assert.deepEqual(result.state.memories, ['甲', '乙'])
})

test('前置条件：进行中的活动/番茄/钓鱼拒绝；双墓碑拒绝', () => {
  const T = fresh(), S = fresh()
  T.activity = { kind: 'work', key: 'odd', label: '打工', emoji: '💼', startedAt: NOW - 1000, endsAt: NOW + 1000, cost: 0 }
  assert.throws(() => merge(T, S), error => error.code === 'activity')
  T.activity = null; T.pomodoro = { ...T.pomodoro, startedAt: NOW, minutes: 25 }
  assert.throws(() => merge(T, S), error => error.code === 'pomodoro')
  T.pomodoro.startedAt = null; T.fishing.pending = { id: 'x', key: 'carp', sizeCm: 1, price: 1, caughtAt: NOW, phase: 'waiting', castPower: 0, bitesAt: NOW, hookUntil: NOW, expiresAt: NOW }
  assert.throws(() => merge(T, S), error => error.code === 'fishing')
  T.fishing.pending = null
  T.dead = true; T.health = 0; S.dead = true; S.health = 0
  assert.throws(() => merge(T, S), error => error.code === 'no-living-pig')
})

test('重复合并同一输入结果稳定；同一份源端收据不会重复', () => {
  const { T, S, targetReceipts, sourceReceipts } = golden()
  const first = merge(T, S, { targetReceipts, sourceReceipts })
  const second = merge(clone(T), clone(S), { targetReceipts: clone(targetReceipts), sourceReceipts: clone(sourceReceipts) })
  assert.deepEqual(first.state, second.state)
  assert.deepEqual(first.receipts, second.receipts)
  assert.equal(new Set(first.receipts.map(item => `${item.source}/${item.id}`)).size, first.receipts.length)
  assert.deepEqual(T, golden().T, '预览/合并不能改运行时内存里的目标状态')
  assert.deepEqual(S, golden().S, 'migrate 只作用于副本，源状态不变')
  assert.equal(MERGE_RULES_VERSION, 1)
})

test('字段覆盖守卫：新猪 + 全可选字段都在规则表里；动态 map 不误报', () => {
  const state = fresh()
  state.birthday = { month: 5, day: 2 }
  state.realWorkGrowth = { day: todayKey(), amount: 5 }
  state.profileEdits = 2
  state.customSkins = []
  state.extData = { farm: { version: 5 } }
  state.extensions = { farm: true, pomodoro: true, fishing: true, mine: false }
  state.achievements.events = { farm: { harvest: { total: 1, seen: 1, maximum: 1, items: ['radish'] } } }
  state.stats.shortShifts = 2
  state.wallets = { farm: { label: '菜币', emoji: '🥕', rate: 0.1, buyable: true, balance: 1 } }
  state.cooldowns = { feed: NOW + 1 }
  state.fishing.spots = ['river', 'pond']
  state.dialogue.lastByScene = { enter: 'x' }
  state.diary.today.counts = { work: 1 }
  assert.deepEqual(missingMergeRules(state), [])
  assert.ok(Object.keys(MERGE_RULES).length > 40)
  assert.ok(Object.keys(DYNAMIC_MAP_RULES).length > 5)
  const unknown = clone(state); unknown.futureField = 1; unknown.nested = { future: 1 }
  assert.deepEqual(missingMergeRules(unknown).sort(), ['futureField', 'nested'])
  const result = merge(state, clone(state))
  assert.equal(result.state.futureField, undefined)
  const withTargetUnknown = clone(state); withTargetUnknown.futureField = { keep: true }
  const merged = merge(withTargetUnknown, clone(state))
  assert.deepEqual(merged.state.futureField, { keep: true }, 'T 的未知字段原样保留')
})

test('摘要不含完整状态/路径/令牌', () => {
  const { T } = golden()
  const summary = mergeSummary(T)
  assert.deepEqual(Object.keys(summary).sort(), ['badges', 'box', 'coins', 'days', 'dead', 'hatched', 'items', 'kind', 'level', 'name'])
  assert.doesNotMatch(JSON.stringify(summary), /state\.json|\/tmp|token/i)
})

test('暂存恢复：后移观察时间戳、ageMs/出生时间不漂、生日固定', () => {
  const state = fresh()
  state.ageMs = 10 * DAY
  state.lastSeenAt = NOW - 1000
  state.lastFedAt = NOW - 2000
  state.lastActiveAt = NOW - 3000
  state.settledUpTo = NOW - 1000
  const before = { bornAt: state.bornAt, ageMs: state.ageMs, satiety: state.satiety, birthday: state.birthday }
  const result = resumeSuspendedPig(state, { suspendedAt: NOW, nowMs: NOW + 60_000 })
  assert.equal(result.ok, true)
  assert.equal(result.elapsed, 60_000)
  assert.equal(result.state.ageMs, before.ageMs)
  assert.equal(result.state.bornAt, before.bornAt)
  assert.equal(result.state.lastFedAt, state.lastFedAt + 60_000)
  assert.equal(result.state.lastActiveAt, state.lastActiveAt + 60_000)
  assert.equal(result.state.lastSeenAt, NOW + 60_000)
  assert.ok(result.state.settledUpTo >= NOW + 60_000)
  assert.equal(result.state.satiety, before.satiety)
  const legacy = fresh(); delete legacy.ageMs; legacy.bornAt = NOW - 50 * DAY
  const legacyResult = resumeSuspendedPig(legacy, { suspendedAt: NOW, nowMs: NOW + 10 * DAY })
  assert.equal(legacyResult.ok, true)
  const born = new Date(legacy.bornAt)
  assert.deepEqual(legacyResult.state.birthday, { month: born.getMonth() + 1, day: born.getDate() })
  assert.equal(legacyResult.state.bornAt, legacy.bornAt + 10 * DAY)
  const negative = resumeSuspendedPig(state, { suspendedAt: NOW + 60_000, nowMs: NOW })
  assert.equal(negative.elapsed, 0)
  const busy = clone(state); busy.pomodoro = { ...busy.pomodoro, startedAt: NOW, minutes: 25 }
  assert.equal(resumeSuspendedPig(busy, { suspendedAt: NOW, nowMs: NOW + 1000 }).reason, 'pomodoro')
  assert.match(suspensionFingerprint({ a: 1 }, [], value => value), /^\{/)
})

test('合并拒绝高于当前版本的原始版本', () => {
  const T = fresh(), S = fresh()
  S.version = 16
  assert.throws(() => assertMergeable(T, S), error => error.code === 'version-too-new')
})

test('疑似副本三选一：只保留一边不相加；同名皮肤改名、回执只取保留的一边', () => {
  const T = fresh(), S = fresh()
  T.coins = 100; S.coins = 50
  T.customSkins = [{ key: 'mint', label: '桌宠薄荷', author: 'A', description: '', emoji: '🌿', scenes: ['idle'], art: 'custom-mint', custom: true }]
  S.customSkins = [{ key: 'mint', label: '内嵌薄荷', author: 'B', description: '', emoji: '🌿', scenes: ['idle'], art: 'custom-mint', custom: true }]
  S.skin = 'mint'
  const targetReceipts = [receipt(1), receipt(2)]
  const sourceReceipts = [receipt(3)]
  const keepTarget = merge(T, S, { choices: { duplicate: 'target' }, targetReceipts, sourceReceipts, sourceSkins: { mint: 'b' }, targetSkins: { mint: 'a' } })
  assert.equal(keepTarget.state.coins, 100, '不相加')
  assert.equal(keepTarget.state.name, T.name)
  assert.equal(keepTarget.receipts.length, 2, '只保留桌宠的收据')
  assert.equal(keepTarget.report.duplicate.kept, 'target')
  assert.deepEqual(keepTarget.report.autoMerge, ['只保留桌宠：金币、物品和徽章都不相加'])
  const keepSource = merge(T, S, { choices: { duplicate: 'source' }, targetReceipts, sourceReceipts, sourceSkins: { mint: 'b' }, targetSkins: { mint: 'a' } })
  assert.equal(keepSource.state.coins, 50, '只保留内嵌猪的值')
  assert.equal(keepSource.state.name, S.name)
  assert.equal(keepSource.state.skin, 'mint-2', '同名皮肤改名，避免覆盖桌宠文件')
  assert.equal(keepSource.state.customSkins.length, 1)
  assert.equal(keepSource.state.customSkins[0].key, 'mint-2')
  assert.deepEqual(keepSource.skinCopies, [{ from: 'custom-mint', to: 'custom-mint-2', key: 'mint-2' }])
  assert.equal(keepSource.receipts.length, 1, '只保留内嵌猪的收据')
  assert.equal(keepSource.report.duplicate.kept, 'source')
  assert.throws(() => merge(T, S, { choices: { duplicate: 'nope' } }), error => error.code === 'invalid-choices')
})
