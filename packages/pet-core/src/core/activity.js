// @ts-check
/**
 * 外出活动的开始与召回。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/activity
 */

import { TOO_WEAK_HEALTH } from './constants.js'
import { itemByKey } from '../data.js'
import { remember } from './effects.js'
import { decay } from './settlement.js'
import { refundCoins } from './economy.js'

/**
 * Why the pig cannot head out right now, or null when it can.
 *
 * Illness used to block this outright, which deadlocked the whole game:
 * sick → cannot work → no coins → cannot buy medicine → still sick, and the
 * only way out was to wait to die. A pig that can still stand up can go and
 * earn its own prescription; only one at death's door has to stay in bed.
 */
export function awayBlockedReason(state) {
  if (state === null) return 'absent'
  if (state.hatched !== true) return 'box'
  if (state.dead) return 'dead'
  if (state.activity !== null) return 'away'
  if (state.health <= TOO_WEAK_HEALTH) return 'weak'
  return null
}

/** Whether the pig is free to go out. */
export function canStartActivity(state) {
  return awayBlockedReason(state) === null
}

/** Back-compat alias. */
export const canWork = canStartActivity

/** Start the named activity. Returns `{ ok, activity }` or `{ ok:false, reason }`. */
export function begin(state, activity, nowMs) {
  decay(state, nowMs)
  const blocked = awayBlockedReason(state)
  if (blocked !== null) return { ok: false, reason: blocked }
  state.activity = { ...activity, startedAt: nowMs, endsAt: nowMs + activity.minutes * 60000 }
  state.lastActiveAt = nowMs
  return { ok: true, activity: state.activity }
}

/** Seconds left on the current activity (0 when idle). */
export function activitySecondsLeft(state, nowMs) {
  if (state.activity === null) return 0
  return Math.max(0, Math.ceil((state.activity.endsAt - nowMs) / 60000 * 60))
}

/** Back-compat alias. */
export const workSecondsLeft = activitySecondsLeft

/** Bring the pig home early. Work forfeits pay; study and trips are refunded. */
export function callOffActivity(state, nowMs) {
  // Settle first: a shift/lesson/trip that already ended must pay out (and be
  // announced) before anyone decides it was "called off". Without this the
  // panel's 召回 button voided the wages of a finished shift.
  decay(state, nowMs)
  if (state.activity === null) return { ok: false, reason: 'idle' }
  const activity = state.activity
  state.activity = null
  if (activity.kind === 'fishing' && itemByKey(activity.baitKey)?.kind === 'bait' && activity.baitCount > 0) {
    state.inventory = { ...(state.inventory ?? {}), [activity.baitKey]: (state.inventory?.[activity.baitKey] ?? 0) + activity.baitCount }
    remember(state, `🎣 提前回来，退回 ${activity.baitCount} 个鱼饵`, nowMs)
    return { ok: true, baitRefunded: activity.baitCount }
  }
  if (activity.kind !== 'work' && activity.cost > 0) {
    refundCoins(state, activity.cost, activity.kind === 'trip' ? 'trip' : activity.kind === 'study' ? 'school' : activity.kind === 'interest' ? 'interest' : 'other', nowMs)
    remember(state, `${activity.emoji} 从${activity.label}提前回来了，钱退回来了`, nowMs)
    return { ok: true, refunded: activity.cost }
  }
  remember(state, `${activity.emoji} 从${activity.label}提前回来了，白跑一趟`, nowMs)
  return { ok: true, refunded: 0 }
}

/** Back-compat alias. */
export const callOffWork = callOffActivity

// ---------------------------------------------------------------------------
// Shop and inventory
// ---------------------------------------------------------------------------
