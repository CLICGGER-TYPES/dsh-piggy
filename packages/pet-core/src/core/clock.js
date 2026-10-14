// @ts-check
/**
 * 时间、年龄、等级派生。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/clock
 */

import { DAYS_PER_MONTH, DAY_STARTS_AT_HOUR, DEAD_DAY, GRAVE, GROWTH_PER_HOUR, LEVEL_TITLES, LIFE_STAGES, MAX_LEVEL, SOUL_AFTER_DAYS, xpForLevel } from '../data.js'
import { CLOCK_ROLLBACK_HOLD_MS, DAY_MS } from './constants.js'

/**
 * The pig's age in days.
 *
 * This is accumulated *pig time*, not wall clock: `decay()` adds elapsed real
 * time times the time scale. Storing it this way means changing the scale only
 * affects the future — the pig does not suddenly jump from a piglet to elderly
 * because you raised the multiplier.
 */
export function ageDays(state, nowMs) {
  if (state === null) return 0
  if (typeof state.ageMs === 'number' && Number.isFinite(state.ageMs)) {
    return Math.max(0, state.ageMs / DAY_MS)
  }
  // Saves from before pig time existed only have a birthday.
  if (typeof state.bornAt !== 'number') return 0
  return Math.max(0, (nowMs - state.bornAt) / DAY_MS)
}

/** The pig's age in whole months, for display. */
export const ageMonths = (state, nowMs) => ageDays(state, nowMs) / DAYS_PER_MONTH

/**
 * Is a saved `lastSeenAt` believable? False for a non-number, a non-finite
 * value, or a moment that is not a positive instant. Such a cursor is corrupt
 * or hand-edited data, not evidence of an absence — decay() settles nothing for
 * it and repairs it to nowMs (see core/settlement.js).
 *
 * 「早于出生」不再算坏游标（2026-10-14 返工 P2-1）：把那种情况判成坏数据会把猪永久冻住
 * ——出生时刻在将来（快机器上孵的猪、对表之后）时，修出来的游标仍然早于出生，这条判定
 * 每次都会命中、又没有出口。出生之前的时间本来也不该补结算，所以改成在 decay() 里把结算
 * 起点钳到出生时刻；坏值只留「非数字 / 非有限 / 非正数」三条。
 * @param {unknown} cursor
 */
export function isUsableCursor(cursor) {
  return typeof cursor === 'number' && Number.isFinite(cursor) && cursor > 0
}

/**
 * 时钟比结算游标走得慢时的处理：保留游标、本次不结算。
 *
 * 为什么会走到这里：`fromMs` 是已经结算到的高点。时钟回拨、或存档里的游标来自一台
 * 走快的机器（B2），都会让 `nowMs < fromMs`。这时把游标落到 `nowMs` 就是「吞掉」
 * 已经结算过的时间，等真实时钟追上来会重复结算。
 *
 * 但不能永远保留：用户把系统时间调成错的（笔记本没电池、手动改表）时，游标就永远
 * 停在未来、猪一直冻结。折中——倒退持续满 CLOCK_ROLLBACK_HOLD_MS（按倒退后的新
 * 时钟计）就认新时钟当新起点，跳过去、不补结算。回拨出来的那段本来就没真的流过，
 * 补上等于凭空多给一次离线结算；回拨不超过一天时，真实时钟会在冻结 CLOCK_ROLLBACK_HOLD_MS
 * 之前追上原游标，所以普通对表不会触发这一步。
 *
 * 2026-10-14 从 settlement.js 搬来这里：那边快撞上 400 行的硬线，而这一条和
 * isUsableCursor 讲的都是「游标可不可信」，放一起更好读（原位置与行为不变）。
 *
 * @param {object} state
 * @param {number} nowMs
 * @param {number} fromMs
 */
export function holdClock(state, nowMs, fromMs) {
  // 只认真正的倒退。同一毫秒里的重复调用很常见（describe 等只读路径），
  // 不能拿它当冻结的起点。（坏游标在 decay() 里就已经被修掉，这里只会拿到有限的 fromMs。）
  if (!(nowMs < fromMs)) return
  const since = Number.isFinite(state.clockRollbackAt) ? state.clockRollbackAt : nowMs
  if (nowMs - since >= CLOCK_ROLLBACK_HOLD_MS) {
    // 别静默：猪停了一天，排障的人需要知道是时钟被拨了（P3-3）。
    console.warn(`[dsh-piggy] clock held for a day, accepting the new time: heldAt=${fromMs} nowMs=${nowMs}`)
    state.lastSeenAt = nowMs
    state.clockRollbackAt = null
    return
  }
  state.clockRollbackAt = since
}

/**
 * Which stage the pig is at right now: a box, a pig of some size, or a grave.
 * The body follows the level, not the calendar (B2).
 */
export function lifeStageFor(state, nowMs) {
  if (state === null) return LIFE_STAGES[0]
  if (state.dead === true) return hasSoul(state, nowMs) ? GRAVE : DEAD_DAY
  if (state.hatched !== true) return LIFE_STAGES[0]
  const level = levelFor(state.xp)
  let stage = LIFE_STAGES[1]
  for (const candidate of LIFE_STAGES) {
    if (candidate.box === true) continue
    if (level >= (candidate.fromLevel ?? 0)) stage = candidate
  }
  return stage
}

/** The next rung, or null once the pig is fully grown. */
export function nextLifeStage(state, nowMs) {
  if (state === null || state.dead === true || state.hatched !== true) return null
  const level = levelFor(state.xp)
  return LIFE_STAGES.find(stage => stage.box !== true && (stage.fromLevel ?? 0) > level) ?? null
}

/**
 * Roughly how many days until the next rung, at full care and the base rate.
 * An estimate for the panel, not a promise: care and activities move it.
 */
export function daysToNextStage(state, nowMs) {
  const next = nextLifeStage(state, nowMs)
  if (next === null) return null
  const remaining = Math.max(0, xpForLevel(next.fromLevel ?? 0) - (Number.isFinite(state.xp) ? state.xp : 0))
  return remaining / GROWTH_PER_HOUR / 24
}

/**
 * The day an instant belongs to, as 'YYYY-MM-DD' in local time. A day starts
 * at DAY_STARTS_AT_HOUR (06:00), so staying up past midnight still counts as
 * the evening before. Daily caps, sign-in and the diary all key off this.
 * @param {number} nowMs
 */
export function dayKeyFor(nowMs) {
  const shifted = new Date(nowMs - DAY_STARTS_AT_HOUR * 3_600_000)
  const month = String(shifted.getMonth() + 1).padStart(2, '0')
  const day = String(shifted.getDate()).padStart(2, '0')
  return `${shifted.getFullYear()}-${month}-${day}`
}

// ---------------------------------------------------------------------------
// Level
// ---------------------------------------------------------------------------

/** The pig's level for a growth total, 1..MAX_LEVEL. */
export function levelFor(xp) {
  const value = Number.isFinite(xp) ? Math.max(0, xp) : 0
  let level = 1
  while (level < MAX_LEVEL && value >= xpForLevel(level + 1)) level += 1
  return level
}

/** The title earned at this level. */
export function levelTitle(level) {
  let found = LEVEL_TITLES[0]
  for (const entry of LEVEL_TITLES) if (level >= entry.level) found = entry
  return found
}

/** How far into the current level, 0-100, plus the numbers behind it. */
export function levelProgress(xp) {
  const value = Number.isFinite(xp) ? Math.max(0, xp) : 0
  const level = levelFor(value)
  const floor = xpForLevel(level)
  const maxed = level >= MAX_LEVEL
  const ceiling = maxed ? floor : xpForLevel(level + 1)
  const span = Math.max(1, ceiling - floor)
  return {
    level,
    xp: value,
    floor,
    ceiling,
    maxed,
    toNext: maxed ? 0 : Math.max(0, ceiling - value),
    percent: maxed ? 100 : Math.max(0, Math.min(100, Math.round(((value - floor) / span) * 100))),
    title: levelTitle(level),
    // 下一个称号（满级或已经是最后一个称号时为 null）：等级说明里写「再升到 Lv.N 就是……」。
    nextTitle: LEVEL_TITLES.find(entry => entry.level > level) ?? null,
  }
}

/** Has the grave been left alone long enough for the soul to settle on it? */
export const hasSoul = (state, nowMs) =>
  state !== null && state.dead === true && (nowMs - (state.diedAt ?? nowMs)) / DAY_MS >= SOUL_AFTER_DAYS
