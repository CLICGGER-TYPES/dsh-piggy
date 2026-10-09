// @ts-check
/**
 * 九门课：每门课各算各的课时，课时决定这门课在哪个学段、能干什么工作（B4）。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/school
 */

import { GRADUATION_LESSONS, SUBJECTS, TRAITS, graduatedStage, stageForNextLesson, subjectByKey } from '../data.js'
import { begin } from './activity.js'
import { TOO_WEAK_HEALTH } from './constants.js'
import { remember } from './effects.js'
import { refundCoins, spendCoins } from './economy.js'

/** Lessons taken per subject, always including every subject (0 = never). */
export function courseView(state) {
  const out = {}
  for (const subject of SUBJECTS) out[subject.key] = state.lessons?.[subject.key] ?? 0
  return out
}

/**
 * Each subject as the panel needs it: where it is, what the next lesson costs
 * and gives, and how far to the next graduation.
 */
export function studyView(state) {
  const taken = courseView(state)
  return SUBJECTS.map(subject => {
    const count = taken[subject.key]
    const next = stageForNextLesson(count)
    const done = graduatedStage(count)
    const nextGraduation = GRADUATION_LESSONS.find(mark => mark > count) ?? null
    return {
      key: subject.key,
      label: subject.label,
      emoji: subject.emoji,
      trait: subject.trait,
      traitLabel: TRAITS[subject.trait].label,
      traitEmoji: TRAITS[subject.trait].emoji,
      secondary: subject.secondary,
      lessons: count,
      stage: { key: next.key, label: next.label, emoji: next.emoji },
      graduated: done === null ? null : { key: done.key, label: done.label },
      nextGraduation,
      minutes: next.minutes,
      tuition: next.tuition,
      gain: next.gain,
      secondaryGain: subject.secondary === null ? 0 : next.secondaryGain,
    }
  })
}

/**
 * Send the pig to the next lesson of a subject. The stage is decided by how
 * many lessons of it the pig has already taken; `_stageKey` is accepted for
 * older callers and ignored.
 */
export function startStudy(state, subjectKey, _stageKey, nowMs) {
  if (state.hatched !== true) return { ok: false, reason: 'box' }
  const subject = subjectByKey(subjectKey)
  if (subject === null) return { ok: false, reason: 'unknown' }
  if (state.dead) return { ok: false, reason: 'dead' }
  if (state.activity !== null) return { ok: false, reason: 'away' }
  if (state.health <= TOO_WEAK_HEALTH) return { ok: false, reason: 'weak' }
  const taken = state.lessons?.[subject.key] ?? 0
  const stage = stageForNextLesson(taken)
  if (state.coins < stage.tuition) return { ok: false, reason: 'poor', price: stage.tuition }
  if (state.satiety < 15) return { ok: false, reason: 'hungry' }

  spendCoins(state, stage.tuition, 'school', nowMs)
  const result = begin(state, {
    kind: 'study', key: subject.key, stage: stage.key,
    label: `${subject.label}（${stage.label}第 ${taken + 1} 节）`, emoji: subject.emoji,
    minutes: stage.minutes, cost: stage.tuition,
  }, nowMs)
  if (!result.ok) {
    refundCoins(state, stage.tuition, 'school', nowMs) // the pig turned out to be unavailable
    return result
  }
  remember(state, `${subject.emoji} 去上${subject.label}第 ${taken + 1} 节（学费 ${stage.tuition}）`, nowMs)
  return result
}
