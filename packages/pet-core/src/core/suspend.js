// @ts-check
/**
 * 外部模式暂存/恢复：把内嵌猪的时间戳按暂存时长后移。
 *
 * 只移动「观察/活动」时间戳，不结算、不改存档版本、不改 ageMs 和状态值。
 * 有 ageMs 时不动 bornAt（生日不漂）；老存档没有 ageMs 时先把生日固定成
 * 冻结前的值，再后移 bornAt（见 #14 设计 5.9）。
 *
 * @module dsh-piggy/core/suspend
 */

import { lifeStageFor, raiseSettledUpTo } from './clock.js'
import { birthdayOf } from './profile.js'
import { isObject } from './merge-rules.js'

const positive = value => (Number.isFinite(value) && value > 0 ? value : null)
const shift = (value, elapsed) => (Number.isFinite(value) && value > 0 ? value + elapsed : value)

/** 暂停前把时间戳再对一次，避免恢复时把「已经流逝的一段」重复后移。 */
export function suspensionState(state, suspendedAt, nowMs) {
  return { version: 1, suspendedAt, frozenAt: nowMs, ageMs: Number.isFinite(state?.ageMs) ? state.ageMs : null }
}

/**
 * @param {any} state
 * @param {{suspendedAt:number, nowMs:number, hash?:string}} options
 * @returns {{ok:true, state:any, elapsed:number, warnings:string[]}|{ok:false, reason:string, details?:object}}
 */
export function resumeSuspendedPig(state, options) {
  if (!isObject(state)) return { ok: false, reason: 'absent' }
  const suspendedAt = Number(options?.suspendedAt)
  const nowMs = Number(options?.nowMs)
  if (!Number.isFinite(suspendedAt) || suspendedAt <= 0 || !Number.isFinite(nowMs) || nowMs <= 0) {
    return { ok: false, reason: 'bad-clock' }
  }
  if (state.activity !== null && state.activity !== undefined) return { ok: false, reason: 'activity', details: { side: 'source' } }
  if (state.pomodoro?.startedAt !== null && state.pomodoro?.startedAt !== undefined) return { ok: false, reason: 'pomodoro', details: { side: 'source' } }
  if (state.fishing?.pending !== null && state.fishing?.pending !== undefined) return { ok: false, reason: 'fishing', details: { side: 'source' } }
  const elapsed = Math.max(0, nowMs - suspendedAt)
  const next = structuredClone(state)
  const warnings = []
  if (next.health <= 0 && next.dead !== true) next.health = 1
  if (Number.isFinite(next.ageMs)) {
    next.lastFedAt = shift(next.lastFedAt, elapsed)
    next.lastActiveAt = shift(next.lastActiveAt, elapsed)
    next.diedAt = shift(next.diedAt, elapsed)
  } else {
    // 老存档只能靠 bornAt 保年龄：先把生日定在冻结前的那一刻，再后移出生时间。
    const birthday = birthdayOf(next, suspendedAt)
    next.birthday = { month: birthday.month, day: birthday.day }
    if (Number.isFinite(next.bornAt)) next.bornAt += elapsed
    else warnings.push('存档没有出生时间，恢复时按现在算')
  }
  next.lastSeenAt = nowMs
  const floor = Number.isFinite(next.settledUpTo) ? next.settledUpTo + elapsed : nowMs
  raiseSettledUpTo(next, floor)
  raiseSettledUpTo(next, nowMs)
  next.stage = lifeStageFor(next, nowMs).key
  return { ok: true, state: next, elapsed, warnings }
}

/** 冻结后计算给 `external-pet.json` 的校验指纹（调用方传 sha256）。 */
export function suspensionFingerprint(state, receipts, digest) {
  const canonical = JSON.stringify({ state, receipts: Array.isArray(receipts) ? receipts : [] }, (key, value) => {
    if (isObject(value) && !Array.isArray(value)) {
      return Object.fromEntries(Object.keys(value).sort().map(name => [name, value[name]]))
    }
    return value
  })
  return digest(canonical)
}

