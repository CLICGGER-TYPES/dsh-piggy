// @ts-check
/**
 * 生病与治病：按条件概率发病、病情推进与自愈、吃药（对症 / 吃错 / 百草丹）、看医生、死亡。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，随机数来自 core/random.js（见 docs/CONVENTIONS.md）。
 * 数字见 data/illness.js（docs/numbers/B3-illness.md）。
 * @module dsh-piggy/core/illness
 */

import {
  CHAIN_INDEX,
  DOCTOR_MARKUP,
  GRAVE,
  ILLNESS_CHAINS,
  ILLNESS_ONSET,
  MAX,
  MEDICINE_PRICE_BY_TIER,
  REVIVE_ITEM,
  SELF_HEAL_CHANCE,
  SICK_AWAY_MULTIPLIER,
  STAGE_HEALTH,
  THRESHOLDS,
  illnessAt,
  illnessStageMs,
  nextIllness,
} from '../data.js'
import { TOO_WEAK_HEALTH } from './constants.js'
import { announce, remember } from './effects.js'
import { say } from './lines.js'
import { chance, rollerFor } from './random.js'
import { noteToday } from './diary.js'
import { spendCoins } from './economy.js'

/**
 * Let the pig go. Only accidents kill it (the end of an illness chain, or a
 * wrong medicine at the last stage); there is no old age (B2).
 * @param {string} why - shown in the announcement.
 */
export function die(state, nowMs, why) {
  if (state.dead === true) return
  state.dead = true
  state.health = 0
  state.illness = null
  state.activity = null
  state.diedAt = nowMs
  state.stats.deaths = (state.stats.deaths ?? 0) + 1
  remember(state, `${why} ${GRAVE.emoji}`, nowMs)
  announce(state, 'death', `${state.name} ${why}…用${REVIVE_ITEM.label}可以救回来，也可以领养一只新的`, nowMs)
  say(state, 'death', nowMs)
}

export function currentIllness(state) {
  if (state.illness === null || state.illness === undefined) return null
  return illnessAt(state.illness.chain, state.illness.stage)
}

/**
 * 疾病按累计的「有效时间」推进，不是墙上时钟：生病还出门时按 SICK_AWAY_MULTIPLIER
 * 加倍，所以在家躺着养病最省。从 settlement.js 搬来这里（返工3：那边 400 行正好撞上
 * 硬线，本轮又要往里加结算逻辑）——病情推进本来就该和疾病的其它逻辑放在一起。
 * @param {object} state
 * @param {number} elapsedMs
 * @param {{away: boolean, atMs: number}} where
 * @param {import('./random.js').Roll} next
 */
export function progressIllness(state, elapsedMs, where, next) {
  if (state.illness === null || state.illness === undefined) return
  const rate = where.away ? SICK_AWAY_MULTIPLIER : 1
  state.illness.progressMs = (state.illness.progressMs ?? 0) + elapsedMs * rate
  let guard = 0
  while (state.illness !== null && guard < 16) {
    // Each stage has its own length, so it has to be re-read after every step.
    const stageMs = illnessStageMs(state.illness.stage)
    if (state.illness.progressMs < stageMs) break
    // Carry the excess into the next stage rather than dropping it.
    const carried = state.illness.progressMs - stageMs
    advanceIllness(state, where.atMs, next)
    if (state.illness !== null) state.illness.progressMs = carried
    guard += 1
  }
}

// ---------------------------------------------------------------------------
// Falling ill
// ---------------------------------------------------------------------------

/**
 * 疾病阶段只会把健康往下带到该阶段的格数，绝不往上抬。
 *
 * 垂危（`health` = 1，见 `settleStarvation`）时发病 / 病情加重都必须停在 1：
 * 否则「再生一场病」会顺手把垂危治好，`work/study/trip/…` 的 `weak` 拦截也被解除
 * （2026-10-14 用户拍板，P3-2）。正常猪的健康高于任何阶段的格数，取 min 后逐位不变。
 * @param {object} state
 * @param {number} stageHealth - `STAGE_HEALTH` 里该阶段的格数
 */
function capHealth(state, stageHealth) {
  return Math.min(Number.isFinite(state.health) ? state.health : MAX.health, stageHealth)
}

/**
 * What the pig is at risk of right now, per hour, and from which chain.
 * Each condition adds its own chance and points at its own chain, so the
 * illness tells the owner what went wrong: hungry → a cold, filthy → skin.
 * @param {object} state
 * @returns {Array<{chain: number, perHour: number}>}
 */
export function onsetRisks(state) {
  /** @type {Array<{chain: number, perHour: number}>} */
  const risks = [{ chain: -1, perHour: ILLNESS_ONSET.basePerHour }]
  if (state.satiety < THRESHOLDS.hungry) risks.push({ chain: CHAIN_INDEX.cold, perHour: ILLNESS_ONSET.hungryPerHour })
  if (state.cleanliness < THRESHOLDS.dirty) {
    const chain = state.cleanliness < ILLNESS_ONSET.veryDirty ? CHAIN_INDEX.skin : CHAIN_INDEX.cough
    risks.push({ chain, perHour: ILLNESS_ONSET.dirtyPerHour })
  }
  if (state.happiness < ILLNESS_ONSET.sadBelow) risks.push({ chain: CHAIN_INDEX.dizzy, perHour: ILLNESS_ONSET.sadPerHour })
  if ((state.outingStreak ?? 0) >= ILLNESS_ONSET.overworkStreak) {
    risks.push({ chain: CHAIN_INDEX.dizzy, perHour: ILLNESS_ONSET.overworkPerHour })
  }
  return risks
}

/**
 * One stretch of time at home: maybe fall ill. The hourly chances are turned
 * into a chance for this many minutes, so stepping in 5-minute slices gives
 * the same odds as one long step would.
 * @param {object} state
 * @param {{minutes: number, atMs: number}} span
 * @param {import('./random.js').Roll} next
 */
export function rollForIllness(state, span, next) {
  if (state.illness !== null && state.illness !== undefined) return
  const risks = onsetRisks(state)
  const perHour = risks.reduce((sum, risk) => sum + risk.perHour, 0)
  const hit = 1 - Math.pow(1 - Math.min(1, perHour), span.minutes / 60)
  if (!chance(next, hit)) return
  // Which condition did it: weighted by each one's share of the risk. The
  // base chance (chain -1) picks any chain at random.
  let pick = next() * perHour
  let cause = risks[0]
  for (const risk of risks) {
    cause = risk
    pick -= risk.perHour
    if (pick < 0) break
  }
  const chain = cause.chain >= 0 ? cause.chain : Math.min(ILLNESS_CHAINS.length - 1, Math.floor(next() * ILLNESS_CHAINS.length))
  catchIllness(state, chain, span.atMs)
}

/** Feeding a pig that is already stuffed can upset its stomach. */
export function rollForOverfeeding(state, satietyBefore, nowMs) {
  // 按面板上显示的整数比：喂之前结算会让满格的 100 变成 99.99。
  if (Math.round(satietyBefore) < ILLNESS_ONSET.overfullAt || state.illness !== null) return
  if (chance(rollerFor(state), ILLNESS_ONSET.overfeedChance)) catchIllness(state, CHAIN_INDEX.stomach, nowMs)
}

/** Work, school and trips in a row wear the pig out; an hour at home resets it. */
export function noteOuting(state) {
  state.outingStreak = (state.outingStreak ?? 0) + 1
  state.restMinutes = 0
}

export function restAtHome(state, minutes) {
  state.restMinutes = (state.restMinutes ?? 0) + minutes
  if (state.restMinutes >= ILLNESS_ONSET.restMinutes) state.outingStreak = 0
}

/**
 * @param {object} state
 * @param {number} chain - index into ILLNESS_CHAINS
 * @param {number} nowMs
 */
export function catchIllness(state, chain, nowMs) {
  state.illness = { chain, stage: 1, since: nowMs, progressMs: 0 }
  // 取 min，不覆写：垂危（健康 1 格）时发病不能把 health 抬回 4，否则等于「生一场病治好垂危」
  // （2026-10-14 交叉审查 P3-2、用户同日拍板）。正常猪 health 高于 4，行为逐位不变。
  state.health = capHealth(state, STAGE_HEALTH[0])
  state.stats.illnesses = (state.stats.illnesses ?? 0) + 1
  const ill = illnessAt(chain, 1)
  if (ill === null) return
  remember(state, `得了${ill.name} 🤒`, nowMs)
  announce(state, 'sick', `${state.name} 得了${ill.name}，需要${ill.cureEmoji}${ill.cure} 🤒`, nowMs)
  noteToday(state, 'illness')
  say(state, 'sick', nowMs)
}

// ---------------------------------------------------------------------------
// Getting worse, getting better
// ---------------------------------------------------------------------------

/**
 * A stage ran its course: it may shake itself off, otherwise it gets worse.
 * @param {object} state
 * @param {number} nowMs
 * @param {import('./random.js').Roll} [next] - defaults to the pig's own seed.
 */
export function advanceIllness(state, nowMs, next = rollerFor(state)) {
  const healChance = SELF_HEAL_CHANCE[state.illness.stage - 1] ?? 0
  if (chance(next, healChance)) {
    const name = ILLNESS_CHAINS[state.illness.chain].name
    recover(state, nowMs)
    remember(state, `自己好了，扛过去了 💚`, nowMs)
    announce(state, 'cured', `${state.name} 的${name}自己好了 💚`, nowMs)
    noteToday(state, 'cure')
    return
  }
  worsen(state, nowMs, '没能撑过去')
}

/**
 * One stage worse, now. The end of the chain is death.
 * @param {string} why - the cause of death, if it comes to that.
 */
export function worsen(state, nowMs, why) {
  const { chain, stage } = state.illness
  const worse = nextIllness(chain, stage)
  if (worse === null) {
    die(state, nowMs, why)
    return
  }
  state.illness = { chain, stage: stage + 1, since: nowMs, progressMs: 0 }
  // 同样取 min：垂危时病情加重也只停在 1 格（P3-2）。
  state.health = capHealth(state, STAGE_HEALTH[stage])
  remember(state, `病情加重：${worse.name}`, nowMs)
  announce(state, 'worse', `${state.name} 的病情加重了：${worse.name}，需要${worse.cureEmoji}${worse.cure}`, nowMs)
}

/** Well again, all the way (#7): an illness leaves no permanent dent. */
function recover(state, nowMs) {
  state.illness = null
  state.health = MAX.health
  say(state, 'cured', nowMs)
}

// ---------------------------------------------------------------------------
// Treatment
// ---------------------------------------------------------------------------

/**
 * Give the pig a medicine it already has in the bag (the caller spends it).
 * The right cure, or 百草丹, makes it well. The wrong one makes it worse at
 * once, as in the original — which is why the panel always says what it needs.
 * @returns {{ok: true, cured: true}|{ok: false, reason: 'not-sick'}|{ok: false, reason: 'wrong-medicine', needs: object|null}}
 */
export function medicate(state, item, nowMs) {
  const ill = currentIllness(state)
  if (ill === null) return { ok: false, reason: 'not-sick' }
  if (item.cureAll === true || item.key === ill.cureKey) {
    recover(state, nowMs)
    state.stats.cures = (state.stats.cures ?? 0) + 1
    remember(state, `吃了 ${item.emoji} ${item.label}，病好了`, nowMs)
    announce(state, 'cured', `${state.name} 吃了 ${item.label}，痊愈了 💚`, nowMs)
    noteToday(state, 'cure')
    return { ok: true, cured: true }
  }
  remember(state, `吃错了药（${item.label}），病情加重`, nowMs)
  say(state, 'wrongMedicine', nowMs)
  noteToday(state, 'wrongMedicine')
  worsen(state, nowMs, '吃错了药，没能撑过去')
  return { ok: false, reason: 'wrong-medicine', needs: ill }
}

/**
 * 垂危（无病）看诊费。
 *
 * **本轮自定，待用户确认**：垂危没有疾病可对症，就按最便宜一档药价（30）× 现有看诊加价口径
 * （`DOCTOR_MARKUP` = 1.5）= 45。候选方案：把垂危当「健康只剩 1 格」的重症，用 4 级药价
 * 260 × 1.5 = 390——本轮不采用，等用户拍板。
 */
export const CRITICAL_DOCTOR_FEE = Math.ceil(MEDICINE_PRICE_BY_TIER[0] * DOCTOR_MARKUP)

/** What seeing the doctor costs for the illness the pig has now, or the flat charge when it is only 垂危. */
export function doctorFee(state) {
  const ill = currentIllness(state)
  if (ill !== null) return Math.ceil(ill.curePrice * DOCTOR_MARKUP)
  // 没病、没死但健康只剩 1 格（垂危）：也放行看医生（2026-10-14 用户拍板）。
  if (state.dead !== true && Number.isFinite(state.health) && state.health <= TOO_WEAK_HEALTH) return CRITICAL_DOCTOR_FEE
  return null
}

/** 看医生：pay the fee, skip the shopping, get well. */
export function seeDoctor(state, nowMs) {
  if (state === null) return { ok: false, reason: 'absent' }
  if (state.dead === true) return { ok: false, reason: 'dead' }
  const fee = doctorFee(state)
  if (fee === null) return { ok: false, reason: 'not-sick' }
  const sick = currentIllness(state) !== null
  if (!spendCoins(state, fee, 'doctor', nowMs)) return { ok: false, reason: 'poor', need: fee, have: state.coins }
  recover(state, nowMs)
  state.stats.cures = (state.stats.cures ?? 0) + 1
  state.stats.doctorVisits = (state.stats.doctorVisits ?? 0) + 1
  // 垂危本来没病，别说「病好了」，只说身体恢复了（措辞进 文案稿.md 待用户确认）。
  remember(state, sick ? `🏥 看了医生，花了 ${fee} 金币，病好了` : `🏥 看了医生，花了 ${fee} 金币，身体恢复了`, nowMs)
  announce(state, 'cured', sick ? `${state.name} 看了医生，痊愈了 💚（${fee} 🪙）` : `${state.name} 看了医生，身体恢复了 💚（${fee} 🪙）`, nowMs)
  noteToday(state, 'cure')
  return { ok: true, fee }
}
