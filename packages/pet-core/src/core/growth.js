// @ts-check
/**
 * 成长：时间自己长、照顾好坏定快慢、陪主人干活有加成、升级和换形态。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * 数字见 data/growth.js（docs/numbers/B2-growth.md）。
 * @module dsh-piggy/core/growth
 */

import {
  DSH_GROWTH,
  DSH_GROWTH_DAILY_CAP,
  GROWTH_PER_HOUR,
  MAX,
  MIN_GROWTH_FACTOR,
  MOOD_GROWTH_FACTORS,
  NEGLECT_GROWTH_FACTOR,
  SICK_GROWTH_PENALTY_PER_HEALTH,
  THRESHOLDS,
  WORK_GROWTH_PER_HOUR,
} from '../data.js'
import { dayKeyFor, levelFor, levelTitle, lifeStageFor } from './clock.js'
import { announce, remember } from './effects.js'
import { say } from './lines.js'
import { noteToday } from './diary.js'

/**
 * How fast the pig is growing right now, as a multiplier on the base rate.
 * Mood sets the band; being hungry or dirty and being ill each take a further
 * cut. The factors multiply, and never drop below MIN_GROWTH_FACTOR.
 * @param {object} state
 * @returns {number}
 */
export function careFactor(state) {
  const mood = MOOD_GROWTH_FACTORS.find(band => state.happiness >= band.min) ?? MOOD_GROWTH_FACTORS.at(-1)
  let factor = mood?.factor ?? 1
  if (state.satiety < THRESHOLDS.hungry || state.cleanliness < THRESHOLDS.dirty) factor *= NEGLECT_GROWTH_FACTOR
  if (state.illness !== null && state.illness !== undefined) {
    const lost = Math.max(0, MAX.health - state.health)
    factor *= Math.max(0, 1 - lost * SICK_GROWTH_PENALTY_PER_HEALTH)
  }
  return Math.max(MIN_GROWTH_FACTOR, factor)
}

/**
 * Add growth and announce whatever it crosses: each level, a new title, a new
 * body. The only way `xp` should ever go up.
 * @param {object} state
 * @param {number} amount
 * @param {number} nowMs
 */
export function grow(state, amount, nowMs) {
  if (!(amount > 0) || state.hatched !== true || state.dead === true) return
  const before = levelFor(state.xp)
  const stageBefore = state.stage
  state.xp = (Number.isFinite(state.xp) ? state.xp : 0) + amount
  const after = levelFor(state.xp)
  if (after > before) announceLevelUp(state, before, after, nowMs)
  const stage = lifeStageFor(state, nowMs)
  if (stage.key !== stageBefore) {
    state.stage = stage.key
    remember(state, `长成了${stage.label} ${stage.emoji}`, nowMs)
    announce(state, 'stage', `${state.name} 长成了${stage.label} ${stage.emoji}`, nowMs)
    noteToday(state, 'stage')
    say(state, 'growUp', nowMs)
  }
}

function announceLevelUp(state, before, after, nowMs) {
  state.stats.levelUps = (state.stats.levelUps ?? 0) + (after - before)
  noteToday(state, 'levelUp', after - before)
  const title = levelTitle(after)
  const newTitle = levelTitle(before).level !== title.level
  remember(state, `升到 Lv.${after}${newTitle ? `，成了「${title.label}」` : ''}`, nowMs)
  announce(state, 'levelup', newTitle
    ? `${state.name} 升到 Lv.${after}，成了「${title.label}」${title.emoji}`
    : `${state.name} 升到 Lv.${after} ✨`, nowMs)
  say(state, 'levelup', nowMs)
}

/**
 * Growth from time passing: the base rate times the care factor, over pig time
 * (so the debug page's time scale speeds it up along with age).
 * @param {object} state
 * @param {number} pigMs - elapsed pig time in this step
 * @param {number} atMs
 */
export function growWithTime(state, pigMs, atMs) {
  grow(state, (pigMs / 3_600_000) * GROWTH_PER_HOUR * careFactor(state), atMs)
}

/**
 * The bonus for keeping the owner company while they really work — a turn
 * ended, a tool ran — up to DSH_GROWTH_DAILY_CAP a day.
 * @param {object} state
 * @param {string} event - a DIET key; only those in DSH_GROWTH count
 * @param {number} nowMs
 */
export function growFromRealWork(state, event, nowMs) {
  const amount = DSH_GROWTH[event]
  if (amount === undefined || state.hatched !== true || state.dead === true) return
  const day = dayKeyFor(nowMs)
  const today = state.realWorkGrowth?.day === day ? state.realWorkGrowth.amount : 0
  const granted = Math.min(amount, Math.max(0, DSH_GROWTH_DAILY_CAP - today))
  state.realWorkGrowth = { day, amount: today + granted }
  grow(state, granted, nowMs)
}

/** Growth for time spent out working or travelling. */
export const outingGrowth = minutes => Math.round((minutes / 60) * WORK_GROWTH_PER_HOUR)
