// @ts-check
/**
 * 打工。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/work
 */

import { SHORT_SHIFT_MINUTES, TRAITS, jobByKey, jobRequirement, traitBonus } from '../data.js'
import { begin } from './activity.js'
import { levelFor } from './clock.js'
import { TOO_WEAK_HEALTH } from './constants.js'
import { remember } from './effects.js'

/**
 * What a job's gate looks at: level, lessons per subject, 兴趣课 counts (B4).
 * @param {object} state
 */
export function jobFacts(state) {
  return { level: levelFor(state.xp), lessons: state.lessons ?? {}, interests: state.interests ?? {} }
}

/** @param {boolean} [short] 只去 10 分钟的短班 */
export function startWork(state, jobKey, nowMs, short = false) {
  const job = jobByKey(jobKey)
  if (job === null) return { ok: false, reason: 'unknown' }
  if (state.hatched !== true) return { ok: false, reason: 'box' }
  if (state.dead) return { ok: false, reason: 'dead' }
  if (state.activity !== null) return { ok: false, reason: 'away' }
  if (state.health <= TOO_WEAK_HEALTH) return { ok: false, reason: 'weak' }
  // The gate is checked before the pig walks out: an unqualified job is refused
  // with everything it is short on (level, lessons, certificate).
  const gate = jobRequirement(job, jobFacts(state))
  if (gate !== null && !gate.ok) {
    return { ok: false, reason: 'underqualified', missing: gate.missing, job: job.key }
  }
  if (state.satiety < 15) return { ok: false, reason: 'hungry' }
  // The pig's trait shortens the shift; the pay bonus is applied on the way out.
  const points = state.traits?.[job.trait] ?? 0
  const bonus = traitBonus(job.trait, points)
  const nominal = short ? Math.min(SHORT_SHIFT_MINUTES, job.minutes) : job.minutes
  const minutes = Math.max(1, Math.round(nominal * bonus.minutes))
  const result = begin(state, {
    kind: 'work', key: job.key, label: short ? `${job.label}（短班）` : job.label, emoji: job.emoji, minutes, cost: 0,
    trait: job.trait ?? null,
    ...(short ? { share: nominal / job.minutes } : {}),
  }, nowMs)
  if (result.ok) {
    const saved = nominal - minutes
    remember(state, `${job.emoji} 出门${job.label}去了${short ? `（短班 ${nominal} 分钟）` : ''}${saved > 0 ? `（${TRAITS[job.trait].label} ${points}，省了 ${saved} 分钟）` : ''}`, nowMs)
  }
  return result
}
