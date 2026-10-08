// @ts-check
/**
 * 派生视图（属性/心情/血条）。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/views
 */

import { GRAVE, JOBS, LIFE_STAGES, MAX, REVIVE_ITEM, SCHOOL_STAGES, SHOP, SLEEPY_AFTER_MINUTES, SOUL, SOUL_AFTER_DAYS, SUBJECTS, THRESHOLDS, TRAITS, TRAIT_ORDER, TRIPS } from '../data.js'
import { AWAY_MOODS, DIET } from './constants.js'
import { clamp, clamp100 } from './effects.js'
import { currentIllness, decay } from './settlement.js'

/** Trait totals, always including every trait. */
export function traitView(state) {
  const out = {}
  for (const key of TRAIT_ORDER) out[key] = state.traits?.[key] ?? 0
  return out
}

export function mood(state, nowMs) {
  decay(state, nowMs)
  if (state.dead) return { key: 'dead', emoji: '💀', label: '已经走了' }
  if (state.illness !== null) {
    const ill = currentIllness(state)
    return { key: 'sick', emoji: '🤒', label: ill === null ? '生病了' : `得了${ill.name}` }
  }
  if (state.cleanliness < THRESHOLDS.dirty) return { key: 'dirty', emoji: '🫧', label: '该洗澡了' }

  if (state.activity !== null) {
    const base = AWAY_MOODS[state.activity.kind] ?? AWAY_MOODS.work
    return { ...base, emoji: state.activity.emoji || base.emoji }
  }
  if (state.satiety < THRESHOLDS.hungry) return { key: 'hungry', emoji: '🍎', label: '饿了' }
  if (nowMs - state.lastActiveAt > SLEEPY_AFTER_MINUTES * 60000) return { key: 'sleepy', emoji: '💤', label: '睡着了' }
  if (state.happiness >= 75) return { key: 'happy', emoji: '❤️', label: '很开心' }
  if (state.happiness < THRESHOLDS.lonely) return { key: 'lonely', emoji: '🥺', label: '有点孤单' }
  return { key: 'fine', emoji: '😊', label: '还不错' }
}

export const healthPercent = state => Math.round((clamp(state.health, 0, MAX.health) / MAX.health) * 100)

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const formatWeight = weightG => `${(weightG / 1000).toFixed(1)} kg`

export function bar(value, width = 10) {
  const filled = Math.round((clamp100(value) / 100) * width)
  return `${'▓'.repeat(filled)}${'░'.repeat(width - filled)}`
}

export { JOBS, SHOP, MAX, THRESHOLDS, REVIVE_ITEM, SUBJECTS, SCHOOL_STAGES, TRIPS, TRAITS, TRAIT_ORDER }
export { LIFE_STAGES, GRAVE, SOUL, SOUL_AFTER_DAYS }
export { DIET }
