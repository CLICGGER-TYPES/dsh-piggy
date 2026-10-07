// @ts-check
/** Milestones use saved evidence; querying a view never unlocks anything. */
import { ACHIEVEMENTS, ALL_SOUVENIRS, FISH } from '../data.js'
import { levelFor } from './clock.js'
import { announce } from './effects.js'
import { ensureExtensionEvents, extensionEventProgress } from './extension-events.js'
import { extensionInstalled, extensionOn } from './extensions.js'
const SPECIAL = new Set(['fishKinds', 'souvenirKinds', 'king', 'devil', 'level'])
const COUNTERS = [...new Set(ACHIEVEMENTS.filter(item => !item.extension).map(item => item.metric).filter(key => !SPECIAL.has(key)))]
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
const count = value => Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))) : 0

/** Sanitize optional fields without changing the save version.
 * @param {object} state
 * @returns {object}
 */
export function ensureAchievements(state) {
  const raw = object(state.achievements)
  const unlocked = {}
  for (const item of ACHIEVEMENTS) {
    const record = object(raw.unlocked)[item.key]
    if (record === null || typeof record !== 'object' || Array.isArray(record)) continue
    const firstAt = Number.isFinite(record.firstAt) && record.firstAt >= 0 ? record.firstAt : null
    unlocked[item.key] = { firstAt, recovered: record.recovered === true || firstAt === null }
  }
  state.achievements = { unlocked, totals: {}, seen: {}, events: raw.events }
  ensureExtensionEvents(state)
  for (const key of COUNTERS) {
    state.achievements.totals[key] = count(object(raw.totals)[key])
    state.achievements.seen[key] = count(object(raw.seen)[key])
  }
  return state.achievements
}

/** Acquisition records persist after selling, feeding or changing form. */
function discovered(state, section, keys) {
  const records = object(state.dex?.[section])
  return keys.filter(key => {
    const record = object(records[key])
    return count(record.count) > 0 && Number.isFinite(record.firstAt)
  }).length
}

function progressFor(state, item) {
  if (item.extension) return extensionEventProgress(state, item)
  if (COUNTERS.includes(item.metric)) return count(state.achievements?.totals?.[item.metric])
  if (item.metric === 'level') return levelFor(state.xp)
  if (item.metric === 'fishKinds') return discovered(state, 'fish', FISH.map(fish => fish.key))
  if (item.metric === 'souvenirKinds') return discovered(state, 'souvenirs', ALL_SOUVENIRS.map(entry => entry.key))
  return state.form === item.metric || discovered(state, 'forms', [item.metric]) > 0 ? 1 : 0
}

/** Count deltas once. A new generation starts its existing stats at zero. */
function collectCounters(state, saved) {
  for (const key of COUNTERS) {
    const current = count(state.stats?.[key])
    const previous = saved.seen[key]
    const added = current >= previous ? current - previous : current
    saved.totals[key] = Math.min(Number.MAX_SAFE_INTEGER, saved.totals[key] + added)
    saved.seen[key] = current
  }
}

/** Host checkpoint after actions and elapsed-time settlement.
 * @param {object} state
 * @param {number} nowMs
 * @param {{silent?:boolean}} [options]
 * @returns {object[]} Newly earned milestones, including silent historical backfill.
 */
export function settleAchievements(state, nowMs, options = {}) {
  if (state === null) return []
  const saved = ensureAchievements(state)
  collectCounters(state, saved)
  const earned = []
  for (const item of ACHIEVEMENTS) {
    if (saved.unlocked[item.key] !== undefined || progressFor(state, item) < item.target) continue
    saved.unlocked[item.key] = { firstAt: options.silent ? null : nowMs, recovered: options.silent === true }
    earned.push(item)
  }
  if (earned.length > 0 && !options.silent) {
    const text = earned.length === 1 ? '获得小猪徽章：'+earned[0].label : '获得 '+earned.length+' 枚小猪徽章：'+earned.slice(0,3).map(item=>item.label).join('、')
    announce(state, 'achievement', text, nowMs)
  }
  return earned
}

/** Pure snapshot data; earned progress remains complete across generations.
 * @param {object|null} state
 * @returns {object[]}
 */
export function achievementsView(state) {
  return ACHIEVEMENTS.filter(item => !item.extension || (state !== null && (extensionInstalled(state, item.extension) ||
    state.achievements?.events?.[item.extension] !== undefined || state.achievements?.unlocked?.[item.key] !== undefined))).map(item => {
    const record = state?.achievements?.unlocked?.[item.key]
    const acquired = record !== null && typeof record === 'object'
    return { ...item, acquired, progress: acquired ? item.target : Math.min(item.target, state === null ? 0 : progressFor(state,item)),
      firstAt: acquired ? record.firstAt : null, recovered: acquired && record.recovered === true,
      availability: !item.extension || extensionOn(state, item.extension) ? 'ready' : extensionInstalled(state, item.extension) ? 'off' : 'not-installed' }
  })
}
