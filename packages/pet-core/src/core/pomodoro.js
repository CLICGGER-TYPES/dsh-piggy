// @ts-check
/**
 * 番茄钟（C2）：主人专注，猪在旁边陪着。
 *
 * 状态挂在 `state.pomodoro`，跨刷新/重启都在跑；到点由**下次请求**结算
 * （`store/api.js` 的 freshen 调 `settlePomodoro`），所以关着面板也会结算。
 *
 * 专注期间猪进入免打扰：复用 B6 的 `state.dialogue.quiet`，开始时打开、结束或
 * 放弃时按原来的值放回去 —— 用户自己开的免打扰不会被我们关掉。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/pomodoro
 */

import {
  MAX, POMODORO_BREAK_MINUTES, POMODORO_MAX_MINUTES, POMODORO_MINUTES,
  POMODORO_REWARD,
} from '../data.js'
import { dayKeyFor } from './clock.js'
import { announce, clamp, remember } from './effects.js'
import { ensureDialogue, say } from './lines.js'
import { earnCoins } from './economy.js'

/** @returns {{startedAt: number|null, minutes: number, todayDone: number, day: string|null, restUntil: number|null, finishedAt: number|null, quietBefore: boolean|null}} */
export function emptyPomodoro() {
  return { startedAt: null, minutes: 0, todayDone: 0, day: null, restUntil: null, finishedAt: null, quietBefore: null }
}

const positiveMs = value => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null)
const dayKey = value => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null)

/**
 * Fill in / repair `state.pomodoro`. New saves get it through `migrate`; every
 * entry point calls this too, so a hand-edited save cannot crash the panel.
 * @param {object} state
 */
export function ensurePomodoro(state) {
  const raw = state.pomodoro !== null && typeof state.pomodoro === 'object' ? state.pomodoro : {}
  const minutes = typeof raw.minutes === 'number' && Number.isFinite(raw.minutes)
    ? clamp(Math.round(raw.minutes), 0, POMODORO_MAX_MINUTES)
    : 0
  const done = typeof raw.todayDone === 'number' && Number.isFinite(raw.todayDone)
    ? clamp(Math.round(raw.todayDone), 0, 999)
    : 0
  const next = {
    startedAt: positiveMs(raw.startedAt),
    minutes: minutes,
    todayDone: done,
    day: dayKey(raw.day),
    restUntil: positiveMs(raw.restUntil),
    finishedAt: positiveMs(raw.finishedAt),
    quietBefore: typeof raw.quietBefore === 'boolean' ? raw.quietBefore : null,
  }
  // A running focus needs both halves; half a state would count down forever.
  if (next.startedAt === null || next.minutes === 0) {
    next.startedAt = null
    next.minutes = 0
    next.quietBefore = null
  }
  state.pomodoro = next
  return next
}

/** 跨过 06:00 就重数今天的个数（和签到、日记同一个换天口径）。 */
export function rollPomodoroDay(state, nowMs) {
  const p = ensurePomodoro(state)
  const today = dayKeyFor(nowMs)
  if (p.day !== today) {
    p.day = today
    p.todayDone = 0
  }
  return p
}

/** Is a focus session running right now? */
export function pomodoroRunning(state, nowMs) {
  const p = ensurePomodoro(state)
  return p.startedAt !== null && nowMs < p.startedAt + p.minutes * 60_000
}

/** Why the pig cannot start one — `null` means it can. */
export function awayFromPomodoro(state, nowMs) {
  if (state === null) return 'absent'
  if (state.hatched !== true) return 'box'
  if (state.dead === true) return 'dead'
  const p = ensurePomodoro(state)
  if (p.startedAt !== null) return 'busy'
  if (state.activity !== null && state.activity !== undefined) return 'away'
  return null
}

/**
 * Start a focus session. The pig goes quiet for its duration.
 * @param {object} state
 * @param {number} minutes - one of POMODORO_MINUTES
 * @param {number} nowMs
 */
export function startPomodoro(state, minutes, nowMs) {
  if (state === null) return { ok: false, reason: 'absent' }
  // 先结算上一轮：不然「上一轮刚好看完」和「开始下一轮」会互相盖住。
  settlePomodoro(state, nowMs)
  const blocked = awayFromPomodoro(state, nowMs)
  if (blocked !== null) return { ok: false, reason: blocked }
  const wanted = Math.round(minutes)
  if (!POMODORO_MINUTES.includes(wanted)) return { ok: false, reason: 'minutes' }

  const p = rollPomodoroDay(state, nowMs)
  const dialogue = ensureDialogue(state)
  p.quietBefore = dialogue.quiet === true
  p.startedAt = nowMs
  p.minutes = wanted
  p.restUntil = null
  p.finishedAt = null
  dialogue.quiet = true
  // 台词先说完再安静下来，不然开场白自己就被免打扰吞了。
  say(state, 'pomodoroStart', nowMs)
  return { ok: true, minutes: wanted, todayDone: p.todayDone }
}

/**
 * Settle a finished session: count it, pay for the first 8 of the day, and let
 * the pig talk again. Called from every request, so a closed panel still settles.
 * @param {object} state
 * @param {number} nowMs
 * @returns {{done: boolean, minutes: number, rewarded: boolean, todayDone: number, coins: number} | null}
 */
export function settlePomodoro(state, nowMs) {
  if (state === null || state.hatched !== true) return null
  const p = rollPomodoroDay(state, nowMs)
  if (p.startedAt === null) return null
  if (!(nowMs >= p.startedAt + p.minutes * 60_000)) return null

  const minutes = p.minutes
  p.startedAt = null
  p.minutes = 0
  p.todayDone += 1
  p.finishedAt = nowMs
  p.restUntil = nowMs + POMODORO_BREAK_MINUTES * 60_000
  // 每个都给（用户 2026-10-09：不设每天的次数上限；专注要花真实时间，刷不了）。
  const rewarded = true
  if (rewarded) {
    earnCoins(state, POMODORO_REWARD.coins, 'pomodoro', nowMs)
    state.happiness = clamp(state.happiness + POMODORO_REWARD.happiness, 0, MAX.happiness)
  }
  const dialogue = ensureDialogue(state)
  if (p.quietBefore !== null) dialogue.quiet = p.quietBefore
  p.quietBefore = null

  remember(state, `🍅 陪你专注了 ${minutes} 分钟`, nowMs)
  say(state, 'pomodoroDone', nowMs)
  announce(state, 'pomodoro', rewarded
    ? `🍅 专注 ${minutes} 分钟，+${POMODORO_REWARD.coins} 🪙、心情 +${POMODORO_REWARD.happiness}`
    : `🍅 专注 ${minutes} 分钟（今天第 ${p.todayDone} 个，只计数）`, nowMs)
  return { done: true, minutes: minutes, rewarded: rewarded, todayDone: p.todayDone, coins: rewarded ? POMODORO_REWARD.coins : 0 }
}

/**
 * Give up on a running session: no reward, no count, pig talks again.
 *
 * 先结算：面板关着的时候没人轮询，回来点「放弃」时这一轮可能早就到点了 ——
 * 那是做完的番茄，按完成算（计数 + 发奖 + 完成台词），不当放弃丢掉。
 */
export function abandonPomodoro(state, nowMs) {
  if (state === null) return { ok: false, reason: 'absent' }
  const finished = settlePomodoro(state, nowMs)
  if (finished !== null) return { ok: true, abandoned: false, ...finished }
  const p = ensurePomodoro(state)
  if (p.startedAt === null) return { ok: false, reason: 'idle' }
  p.startedAt = null
  p.minutes = 0
  p.restUntil = null
  const dialogue = ensureDialogue(state)
  if (p.quietBefore !== null) dialogue.quiet = p.quietBefore
  p.quietBefore = null
  remember(state, '🍅 番茄钟没做完就停了', nowMs)
  say(state, 'pomodoroAbandon', nowMs)
  return { ok: true, abandoned: true, todayDone: p.todayDone }
}

/**
 * What the panel needs: the countdown, today's tally, and the reward rule.
 * @param {object} state
 * @param {number} nowMs
 */
export function pomodoroView(state, nowMs) {
  if (state === null) return null
  const p = rollPomodoroDay(state, nowMs)
  const from = p.startedAt
  const active = from !== null
  const endsAt = from === null ? 0 : from + p.minutes * 60_000
  return {
    active: active,
    minutes: p.minutes,
    secondsLeft: active ? Math.max(0, Math.ceil((endsAt - nowMs) / 1000)) : 0,
    breakSecondsLeft: p.restUntil === null ? 0 : Math.max(0, Math.ceil((p.restUntil - nowMs) / 1000)),
    todayDone: p.todayDone,
    rewardedToday: p.todayDone,
    cap: null,
    reward: { coins: POMODORO_REWARD.coins, happiness: POMODORO_REWARD.happiness },
    breakMinutes: POMODORO_BREAK_MINUTES,
    options: POMODORO_MINUTES,
    // 客户端拿它去重：只在时间戳变新时弹一次通知。
    finishedAt: p.finishedAt,
  }
}
