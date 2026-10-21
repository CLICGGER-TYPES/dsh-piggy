// @ts-check
/** C7 weight classes, exercise and fat-body artwork. */
import { MAX_LEVEL, WEIGHT_RULES, xpForLevel } from '../data.js'
import { dayKeyFor } from './clock.js'
import { DAY_MS } from './constants.js'

/** Reference weight follows growth continuously and stops at the Lv60 reference. */
export function idealWeightG(state) {
  const xp = Number.isFinite(state?.xp) ? Math.max(0, state.xp) : 0
  return Math.round(WEIGHT_RULES.baseG
    + Math.min(xp, xpForLevel(MAX_LEVEL)) * WEIGHT_RULES.growthGPerXp)
}

/** Exact C7 thresholds: normal, round at 1.3x, fat at 1.6x. */
export function bodyWeightClass(state) {
  const locked = state?.bodyWeight?.lockedClass
  if (['normal', 'round', 'fat'].includes(locked)) return locked
  const ideal = idealWeightG(state)
  const weight = Number.isFinite(state?.weightG) ? state.weightG : ideal
  if (weight >= ideal * WEIGHT_RULES.fatRatio) return 'fat'
  if (weight >= ideal * WEIGHT_RULES.roundRatio) return 'round'
  return 'normal'
}

/** Add and sanitize the optional per-day exercise record without a save-version bump. */
export function ensureBodyWeight(state) {
  const raw = state.bodyWeight
  const record = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  state.bodyWeight = {
    ...(['normal', 'round', 'fat'].includes(record.lockedClass) ? { lockedClass: record.lockedClass } : {}),
    playDay: typeof record.playDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.playDay)
      ? record.playDay : '',
    plays: Number.isFinite(record.plays)
      ? Math.max(0, Math.min(WEIGHT_RULES.playsPerDay, Math.floor(record.plays))) : 0,
  }
  return state.bodyWeight
}

function reduceExcess(state, retained) {
  if (state?.hatched !== true || state.dead === true || !Number.isFinite(state.weightG)) return
  const ideal = idealWeightG(state)
  const excess = Math.max(0, state.weightG - ideal)
  if (excess > 0) state.weightG = ideal + excess * Math.max(0, Math.min(1, retained))
}

/** A successful play uses one of ten daily exercise slots. */
export function reducePlayWeight(state, nowMs) {
  if (state?.hatched !== true || state.dead === true) return
  const record = ensureBodyWeight(state)
  const day = dayKeyFor(nowMs)
  if (record.playDay !== day) {
    record.playDay = day
    record.plays = 0
  }
  if (record.plays >= WEIGHT_RULES.playsPerDay) return
  record.plays += 1
  reduceExcess(state, 1 - WEIGHT_RULES.playLoss)
}

/** Work reduces excess weight by actual completed duration. */
export function reduceWorkWeight(state, minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  reduceExcess(state, (1 - WEIGHT_RULES.workLossPerHour) ** (minutes / 60))
}

/** Fishing is continuous outdoor exercise and follows the work curve. */
export function reduceFishingWeight(state, minutes) {
  reduceWorkWeight(state, minutes)
}

/** Natural metabolism removes 2% of excess per pig day, including offline time. */
export function settleWeight(state, pigMs) {
  if (!Number.isFinite(pigMs) || pigMs <= 0) return
  reduceExcess(state, (1 - WEIGHT_RULES.dailyLoss) ** (pigMs / DAY_MS))
}

/** Used by the debug page; exact thresholds are calculated from the current level. */
export function setBodyWeightClass(state, bodyClass) {
  const ratios = { normal: 1, round: WEIGHT_RULES.roundRatio + 0.01, fat: WEIGHT_RULES.fatRatio + 0.01 }
  if (!(bodyClass in ratios)) return
  state.weightG = Math.round(idealWeightG(state) * ratios[bodyClass])
}

/** Read-only status data. Weight art only overlays the ordinary default pig. */
export function bodyWeightView(state, nowMs) {
  if (state?.hatched !== true || state.dead === true) return null
  const ideal = idealWeightG(state)
  const bodyClass = bodyWeightClass(state)
  const hasDefaultSkin = state.skin == null || state.skin === 'default'
  const today = state.bodyWeight?.playDay === dayKeyFor(nowMs) ? state.bodyWeight.plays : 0
  const roundAtG = Math.round(ideal * WEIGHT_RULES.roundRatio)
  const fatAtG = Math.round(ideal * WEIGHT_RULES.fatRatio)
  return {
    class: bodyClass,
    locked: ['normal', 'round', 'fat'].includes(state.bodyWeight?.lockedClass),
    // 体型叫法统一成 正常 / 圆润 / 胖胖（以前一处写圆润/胖胖、一处写胖胖猪/大肥猪）。
    label: bodyClass === 'fat' ? '胖胖' : (bodyClass === 'round' ? '圆润' : '正常'),
    weightG: Number.isFinite(state.weightG) ? Math.round(state.weightG) : ideal,
    visible: bodyClass !== 'normal' && state.form == null && hasDefaultSkin,
    idealG: ideal,
    roundAtG,
    fatAtG,
    ideal: (ideal / 1000).toFixed(1) + ' kg',
    roundAt: (roundAtG / 1000).toFixed(1) + ' kg',
    fatAt: (fatAtG / 1000).toFixed(1) + ' kg',
    playsLeft: Math.max(0, WEIGHT_RULES.playsPerDay - (Number.isFinite(today) ? today : 0)),
  }
}

/** Lay the two contributed weight sets over the ordinary default pig only. */
export function weightStageView(state, life, nowMs) {
  const weight = bodyWeightView(state, nowMs)
  if (!weight?.visible) return life
  const fat = weight.class === 'fat'
  return {
    ...life,
    label: fat ? '大肥猪' : '胖胖猪',
    art: fat ? 'pig-fat' : 'pig-round',
    actionArt: true,
    size: Math.round(life.size * (fat ? WEIGHT_RULES.fatSizeMultiplier : WEIGHT_RULES.roundSizeMultiplier)),
    line: fat ? '胖得像一朵会走路的云，尾巴还在后面努力摇。' : '肚子有点圆，走路一颠一颠的。',
  }
}
