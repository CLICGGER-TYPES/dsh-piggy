// @ts-check
/**
 * 合并规则表与通用取值器。
 *
 * 这里是「哪个字段怎么合」的唯一清单：合并实现、字段覆盖守卫测试和预览都读
 * 同一张表。新增字段必须先在这里登记规则，否则 test/merge-guard.test.js 会失败
 * （见 #14 设计附录 C）。
 *
 * @module dsh-piggy/core/merge-rules
 */

import { dayKeyFor } from './clock.js'

/** 合并规则自身的版本；新增/改变合并规则时 +1，不要求 STATE_VERSION 变化。 */
export const MERGE_RULES_VERSION = 1

/** 收据上限（和 runtime/work-ledger.js 的同名上限保持一致）。 */
export const MERGE_RECEIPT_LIMIT = 20000
export const MERGE_SKIN_LIMIT = 128

export const MAX_SAFE = Number.MAX_SAFE_INTEGER

/** @param {unknown} value */
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/** @param {unknown} value */
export const num = value => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

/** @param {unknown} value */
export const whole = value => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0)

/** @param {unknown} a @param {unknown} b */
export const sumCap = (a, b) => Math.min(MAX_SAFE, whole(a) + whole(b))

/** @param {unknown} a @param {unknown} b */
export const maxNum = (a, b) => Math.max(num(a), num(b))

/** @param {unknown} a @param {unknown} b */
export const minNum = (a, b) => Math.min(num(a), num(b))

/** 活着且已孵化：身份、状态取「生命方优先」时用。 @param {any} state */
export const aliveHatched = state => state !== null && state?.hatched === true && state?.dead !== true

/** 基础身份方：活着且已孵化的一方；都活着跟 T。 @param {any} T @param {any} S */
export function baseSide(T, S) {
  const tLive = aliveHatched(T)
  const sLive = aliveHatched(S)
  if (tLive) return 'target'
  if (sLive) return 'source'
  return 'target'
}

/** 生命方：只有一边活着时返回那一边，都活/都死返回 null。 @param {any} T @param {any} S */
export function lifeSide(T, S) {
  const tLive = aliveHatched(T)
  const sLive = aliveHatched(S)
  return tLive === sLive ? null : tLive ? 'target' : 'source'
}

/** 较晚的日期字符串（空/坏值当没有）。 @param {unknown} a @param {unknown} b */
export function laterDay(a, b) {
  const left = typeof a === 'string' && a !== '' ? a : null
  const right = typeof b === 'string' && b !== '' ? b : null
  if (left === null) return right
  if (right === null) return left
  return left > right ? left : right
}

/** 今天这一边；都不是今天返回 null。 @param {unknown} a @param {unknown} b @param {number} nowMs */
export function todaySide(a, b, nowMs) {
  const today = dayKeyFor(nowMs)
  if (a === today) return 'target'
  if (b === today) return 'source'
  return null
}

/**
 * 按天取值：任一边是今天取今天；否则取基础身份方那一边；都没有就是 empty。
 * @template T
 * @param {any} a @param {any} b @param {number} nowMs @param {'target'|'source'} fallback
 * @param {T} empty
 * @returns {{ side: 'target'|'source'|null, value: T }}
 */
export function dayValue(a, b, nowMs, fallback, empty) {
  const side = todaySide(a?.day, b?.day, nowMs)
  if (side !== null) return { side, value: (side === 'target' ? a : b)?.value ?? empty }
  if (a?.day === b?.day && a?.day !== undefined && a?.day !== null && a?.day !== '') {
    return { side: fallback, value: (fallback === 'target' ? a : b)?.value ?? empty }
  }
  return { side: null, value: empty }
}

/** 顶层字段规则。值可以是字符串规则名，或另一层同样结构的对象。 */
export const MERGE_RULES = Object.freeze({
  version: 'target',
  name: 'choice:name',
  personality: 'choice:personality',
  catchphrase: 'choice:personality',
  motto: 'choice:personality',
  profileEdits: 'max',
  bornAt: 'timeline',
  hatched: 'or',
  dead: 'and',
  diedAt: 'death',
  stage: 'derived',
  form: 'choice:look',
  skin: 'choice:look',
  customSkins: 'skins',
  bodyWeight: Object.freeze({ playDay: 'day', plays: 'daySum', lockedClass: 'target' }),
  ageMs: 'max',
  timeScale: 'choice:preferences',
  ageForced: 'timeline',
  birthday: 'choice:birthday',
  xp: 'max',
  weightG: 'xpSide',
  satiety: 'lifeMax',
  happiness: 'lifeMax',
  cleanliness: 'lifeMax',
  health: 'health',
  coins: 'sum',
  inventory: 'sumMap',
  isOfflineFeedEnabled: 'choice:preferences',
  criticalDoctorVisits: 'min',
  dress: 'union',
  worn: 'choice:look',
  dex: Object.freeze({ forms: 'dex', skins: 'dex', fish: 'dex', items: 'dex', souvenirs: 'dex' }),
  fishing: Object.freeze({
    pending: 'mustNull',
    bag: 'fishBag',
    seq: 'max',
    autoDay: 'day',
    autoTrips: 'daySum',
    rod: 'max',
    spots: 'union',
    spot: 'choice:preferences',
    automation: Object.freeze({ basket: 'max', duration: 'max', baitBox: 'max', usedMs: 'max', stock: 'fishStock' }),
  }),
  traits: 'maxMap',
  lessons: 'maxMap',
  interests: 'maxMap',
  souvenirs: 'souvenirList',
  illness: 'illness',
  activity: 'mustNull',
  outingStreak: 'min',
  restMinutes: 'max',
  lastFedAt: 'max',
  lastActiveAt: 'max',
  lastSeenAt: 'now',
  settledUpTo: 'now',
  cooldowns: 'cooldownMap',
  pending: 'clear',
  pendingSeq: 'max',
  dialogue: Object.freeze({
    ownerName: 'choice:preferences',
    lastByScene: 'lastByScene',
    open: 'clear',
    quiet: 'choice:preferences',
    greetedAt: 'max',
    talk: Object.freeze({ day: 'day', said: 'dayUnion', water: 'dayMax', eyes: 'dayMax' }),
    petTimes: 'clear',
    petAnnoyed: 'clear',
  }),
  memories: 'memories',
  stats: 'sumMap',
  seed: 'baseSide',
  daily: Object.freeze({
    signIn: Object.freeze({ lastDay: 'signInDay', index: 'signInIndex', total: 'sum', cycle7: 'target' }),
    online: Object.freeze({ day: 'day', onlineMs: 'dayMax', given: 'dayMax', unclaimed: 'sum' }),
  }),
  diary: Object.freeze({ entries: 'diary', today: Object.freeze({ day: 'day', counts: 'dayMaxMap' }) }),
  pomodoro: Object.freeze({
    startedAt: 'mustNull', minutes: 'mustNullZero', todayDone: 'pomodoroDone', day: 'today',
    restUntil: 'maxNullable', finishedAt: 'maxNullable', quietBefore: 'clear',
  }),
  economy: Object.freeze({ totals: 'ledgerTotals', days: 'ledgerDays', fatigue: 'max' }),
  wallets: 'wallets',
  extensions: 'extensionFlags',
  extensionsRemoved: 'extensionsRemoved',
  extData: 'extData',
  achievements: Object.freeze({
    unlocked: 'achievementsUnlocked', totals: 'achievementsTotals',
    seen: 'achievementsSeen', events: 'achievementEvents',
  }),
  realWorkGrowth: Object.freeze({ day: 'day', amount: 'dayMax' }),
})

/** 运行时数据 map：key 不是固定字段，守卫只查容器规则。 */
export const DYNAMIC_MAP_RULES = Object.freeze({
  inventory: 'sumMap',
  traits: 'maxMap',
  lessons: 'maxMap',
  interests: 'maxMap',
  stats: 'sumMap',
  cooldowns: 'cooldownMap',
  wallets: 'wallets',
  extData: 'extData',
  extensions: 'extensionFlags',
  'dex.forms': 'dex',
  'dex.skins': 'dex',
  'dex.fish': 'dex',
  'dex.items': 'dex',
  'dex.souvenirs': 'dex',
  'fishing.spots': 'union',
  'fishing.automation.stock': 'fishStock',
  'dialogue.lastByScene': 'lastByScene',
  'achievements.unlocked': 'achievementsUnlocked',
  'achievements.totals': 'achievementsTotals',
  'achievements.seen': 'achievementsSeen',
  'achievements.events': 'achievementEvents',
  'diary.today.counts': 'dayMaxMap',
})

/** 规则名是否已登记（守卫和调试用）。 @param {string} rule */
export const knownRule = rule => typeof rule === 'string' && RULE_NAMES.has(rule)

const RULE_NAMES = new Set([
  'target', 'timeline', 'or', 'and', 'death', 'derived', 'day', 'daySum', 'max', 'min', 'maxMap', 'sumMap',
  'xpSide', 'lifeMax', 'health', 'sum', 'union', 'mustNull', 'mustNullZero', 'fishBag', 'fishStock',
  'souvenirList', 'illness', 'now', 'clear', 'cooldownMap', 'lastByScene', 'memories', 'baseSide',
  'signInDay', 'signInIndex', 'diary', 'dayUnion', 'dayMax', 'dayMaxMap', 'pomodoroDone', 'today',
  'maxNullable', 'ledgerTotals', 'ledgerDays', 'wallets', 'extensionFlags', 'extensionsRemoved', 'extData',
  'achievementsUnlocked', 'achievementsTotals', 'achievementsSeen', 'achievementEvents', 'skins', 'dex',
  'choice:name', 'choice:look', 'choice:personality', 'choice:preferences', 'choice:birthday',
])

/**
 * 找出状态里没有合并规则的 key（附录 C 的静态守卫）。
 * 动态 map 只跳过它的子 key；未知的顶层/二级 key 会作为路径返回。
 * @param {any} state
 * @returns {string[]}
 */
export function missingMergeRules(state) {
  const missing = []
  const walk = (value, rules, path) => {
    if (!isObject(value) || !isObject(rules)) return
    for (const key of Object.keys(value)) {
      const nextPath = path === '' ? key : `${path}.${key}`
      const rule = rules[key]
      if (rule === undefined) {
        if (!Object.hasOwn(DYNAMIC_MAP_RULES, nextPath)) missing.push(nextPath)
        continue
      }
      if (isObject(rule)) {
        if (!isObject(value[key]) && !Array.isArray(value[key])) continue
        walk(value[key], rule, nextPath)
      } else if (!knownRule(rule)) missing.push(`${nextPath}=${String(rule)}`)
    }
  }
  walk(state, MERGE_RULES, '')
  return missing
}

/**
 * #14 6.5 疑似副本：同 seed + 出生相近，或名字/经验/金币高度重合。
 * 只做提示，不硬拦截；用户在提交时必须显式选一项。
 * @param {any} target @param {any} source
 */
export function duplicateOf(target, source) {
  if (!isObject(target) || !isObject(source)) return { suspected: false, reasons: [] }
  const reasons = []
  if (target.seed === source.seed && Number.isFinite(target.bornAt) && Number.isFinite(source.bornAt) && Math.abs(target.bornAt - source.bornAt) < 5000) {
    reasons.push('两只猪的 seed 和出生时间几乎相同')
  }
  const same = ['name', 'xp', 'coins'].filter(key => target[key] === source[key])
  const tBadges = Object.keys(isObject(target.achievements?.unlocked) ? target.achievements.unlocked : {})
  const sBadges = new Set(Object.keys(isObject(source.achievements?.unlocked) ? source.achievements.unlocked : {}))
  const overlap = tBadges.filter(key => sBadges.has(key)).length
  const ratio = tBadges.length === 0 ? 0 : overlap / tBadges.length
  if (same.length >= 2 || ratio >= 0.8) reasons.push('名字/经验/金币/徽章高度重合')
  return { suspected: reasons.length > 0, reasons: [...new Set(reasons)] }
}

/**
 * #14 4.4：两边进行中的活动/番茄/钓鱼的真实细节，给阻塞页和强制终结文案用。
 * `nowMs` 用这一端自己的猪时钟（暂存期间传 suspendedAt，不能按墙钟结算）。
 * @param {any} target @param {any} source @param {number} nowMs
 */
export function mergeBlockers(target, source, nowMs) {
  const out = []
  for (const [side, state] of [['target', target], ['source', source]]) {
    if (!isObject(state)) continue
    const activity = state.activity
    if (activity !== null && activity !== undefined) {
      const auto = activity.kind === 'fishing'
      const endsAt = Number.isFinite(activity.endsAt) ? activity.endsAt : null
      out.push({
        side,
        reason: auto ? 'fishing' : 'activity',
        kind: auto ? 'fishing-auto' : String(activity.kind ?? 'activity'),
        label: typeof activity.label === 'string' ? activity.label : '',
        phase: auto ? 'auto' : '',
        finished: endsAt !== null && endsAt <= num(nowMs),
        refund: auto || activity.kind === 'work' ? 0 : whole(activity.cost),
        bait: auto ? whole(activity.baitCount) : 0,
        endsAt,
        minutes: endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - num(nowMs)) / 60_000)),
      })
    }
    const pomodoro = state.pomodoro
    if (pomodoro?.startedAt !== null && pomodoro?.startedAt !== undefined) {
      const endsAt = num(pomodoro.startedAt) + num(pomodoro.minutes) * 60_000
      out.push({ side, reason: 'pomodoro', kind: 'pomodoro', label: '番茄钟', phase: '', finished: endsAt <= num(nowMs), refund: 0, bait: 0, endsAt, minutes: Math.max(0, Math.ceil((endsAt - num(nowMs)) / 60_000)) })
    }
    const pending = state.fishing?.pending
    if (pending !== null && pending !== undefined) {
      out.push({ side, reason: 'fishing', kind: 'fishing-manual', label: '钓鱼', phase: typeof pending.phase === 'string' ? pending.phase : '', finished: pending.phase === 'caught', refund: 0, bait: 0, endsAt: null, minutes: 0 })
    }
  }
  return out
}
