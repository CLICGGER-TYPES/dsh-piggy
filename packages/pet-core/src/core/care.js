// @ts-check
/**
 * 照护动作（喂食/洗澡/玩耍）。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/care
 */

import { CARE_KIND, ILLNESS_ONSET, PET_PARTS, careItems } from '../data.js'
import { ACTIONS, DIET } from './constants.js'
import { applyEffects, remember } from './effects.js'
import { growFromRealWork } from './growth.js'
import { rollForOverfeeding } from './illness.js'
import { ensureDialogue, say } from './lines.js'
import { notePet } from './talk.js'
import { decay } from './settlement.js'
import { noteToday } from './diary.js'
import { bodyWeightClass, reducePlayWeight } from './weight.js'

/** Which line scene each care action makes the pig speak from. */
const CARE_SCENE = Object.freeze({ feed: 'eat', bathe: 'bathe', play: 'play', pet: 'pet' })

/** Which shelves the pig can actually use right now, for the panel's picker. */
export function careView(state) {
  const out = {}
  for (const action of ['feed', 'bathe', 'play']) out[action] = careOptions(state, action)
  return out
}

export function feed(state, event, nowMs) {
  const diet = DIET[event]
  if (diet === undefined) return []
  decay(state, nowMs)
  if (state.dead) return []
  switch (event) {
    case 'message': state.stats.messages += 1; break
    case 'turn': state.stats.turns += 1; break
    case 'tool': state.stats.tools += 1; break
    case 'toolError': state.stats.toolErrors += 1; break
    case 'agentError': state.stats.agentErrors += 1; break
    default: break
  }
  // The box does not eat: the work still counts in the stats, nothing else.
  if (state.hatched !== true) return []
  applyEffects(state, diet, nowMs)
  growFromRealWork(state, event, nowMs)
  noteToday(state, event)
  return []
}

// ---------------------------------------------------------------------------
// Care actions
// ---------------------------------------------------------------------------

export function actionCooldownSeconds(state, action, nowMs) {
  const spec = ACTIONS[action]
  if (spec === undefined || spec.cooldownMs <= 0) return 0
  const last = state.cooldowns?.[action] ?? 0
  const remaining = spec.cooldownMs - (nowMs - last)
  return remaining <= 0 ? 0 : Math.ceil(remaining / 1000)
}

export const actionReady = (state, action, nowMs) => actionCooldownSeconds(state, action, nowMs) === 0

/**
 * 照料一次。`itemKey` 是要用的物品；摸摸时它是摸的部位（head、belly……，见 PET_PARTS）。
 */
export function act(state, action, nowMs, itemKey) {
  const spec = ACTIONS[action]
  if (spec === undefined) return { ok: false, reason: 'unknown' }
  if (state === null) return { ok: false, reason: 'absent' }
  if (state.hatched !== true) return { ok: false, reason: 'box' }
  decay(state, nowMs)
  if (state.dead) return { ok: false, reason: 'dead' }
  if (state.activity !== null && action !== 'pet') return { ok: false, reason: 'away' }

  return applySettledCare(state, { action, nowMs, itemKey })
}

/** 已推进到发生时刻的照料，离线结算复用同一套消费与效果，避免递归推进时钟。 */
export function applySettledCare(state, { action, nowMs, itemKey }) {
  const spec = ACTIONS[action]
  const wait = actionCooldownSeconds(state, action, nowMs)
  if (wait > 0) return { ok: false, reason: 'cooldown', wait }

  // Feeding, washing and playing each spend something off their own shelf —
  // QQ Pet keeps food, sundries and medicine in separate inventory categories
  // for exactly this reason. Petting is affection, and costs nothing.
  const shelf = CARE_KIND[action]
  let item = null
  if (shelf !== undefined) {
    item = resolveCareItem(state, shelf, itemKey)
    if (item === null) return { ok: false, reason: 'no-item', kind: shelf }
    if (item.default !== true) {
      const left = (state.inventory?.[item.key] ?? 0) - 1
      state.inventory = { ...(state.inventory ?? {}) }
      if (left > 0) state.inventory[item.key] = left
      else delete state.inventory[item.key]
    }
  }

  state.cooldowns = { ...(state.cooldowns ?? {}), [action]: nowMs }
  if (action === 'feed') { state.stats.feeds += 1; state.lastFedAt = nowMs }
  else if (action === 'bathe') state.stats.baths += 1
  else if (action === 'play') state.stats.plays += 1
  else if (action === 'pet') state.stats.pets += 1

  const satietyBefore = state.satiety
  const bodyBefore = bodyWeightClass(state)
  // 摸太多会不耐烦：这一下不加心情（G 批次）。
  const annoyed = action === 'pet' && notePet(ensureDialogue(state), nowMs)
  if (!annoyed) applyEffects(state, careEffects(item, spec), nowMs)
  if (action === 'play') reducePlayWeight(state, nowMs)
  remember(state, item === null ? spec.verb : `${item.emoji} ${spec.label}用了「${item.label}」`, nowMs)
  if (action === 'feed') rollForOverfeeding(state, satietyBefore, nowMs)
  // Feeding a pig that was already stuffed gets a different complaint; this bite
  // filling it up to 100 gets a contented 「吃饱啦」 (G2, 用户 2026-10-05).
  const scene = action === 'pet' ? (annoyed ? 'petTooMuch' : PET_PARTS[itemKey] ?? 'pet')
    : action !== 'feed' ? CARE_SCENE[action]
    : Math.round(satietyBefore) >= ILLNESS_ONSET.overfullAt ? 'overfull'
      : state.satiety >= 100 ? 'full' : CARE_SCENE[action]
  // 吃胖了一档（正常 → 圆润 → 胖胖）就说体型，不说「好吃」。
  const RANK = { normal: 0, round: 1, fat: 2 }
  const grew = action === 'feed' && RANK[bodyWeightClass(state)] > RANK[bodyBefore]
  say(state, grew ? 'bodyChange' : scene, nowMs)
  noteToday(state, action)
  return { ok: true, item: item === null ? null : item.key, spent: item !== null && item.default !== true }
}

/**
 * The item an action will spend: the caller's pick when it is actually in the
 * bag, otherwise the cheapest thing the pig owns. The free default toy makes
 * `play` always available.
 */
export function resolveCareItem(state, kind, wanted) {
  const usable = careItems(kind).filter(
    item => item.default === true || (state.inventory?.[item.key] ?? 0) > 0,
  )
  if (usable.length === 0) return null
  if (wanted === undefined || wanted === null || wanted === '') return usable[0]
  return usable.find(item => item.key === wanted) ?? null
}

/**
 * Blend an item's own effects with the action's baseline. The item decides how
 * far its own bar moves; the action keeps whatever the item does not mention.
 */
export function careEffects(item, spec) {
  if (item === null) return spec
  return {
    weightG: item.satiety !== undefined && spec.key === 'feed' ? spec.weightG : 0,
    satiety: item.satiety ?? spec.satiety,
    happiness: item.happiness ?? spec.happiness,
    cleanliness: item.cleanliness ?? spec.cleanliness,
  }
}

/** What each care action could be done with right now, and how many are left. */
export function careOptions(state, action) {
  const kind = CARE_KIND[action]
  if (kind === undefined) return []
  return careItems(kind)
    .filter(item => item.default === true || (state.inventory?.[item.key] ?? 0) > 0)
    .map(item => ({
      key: item.key,
      label: item.label,
      emoji: item.emoji,
      price: item.price,
      default: item.default === true,
      count: item.default === true ? null : (state.inventory?.[item.key] ?? 0),
      satiety: item.satiety ?? 0,
      happiness: item.happiness ?? 0,
      cleanliness: item.cleanliness ?? 0,
    }))
}

// ---------------------------------------------------------------------------
// Activities: work · study · trip
// ---------------------------------------------------------------------------

export const canFeed = (state, nowMs) => actionReady(state, 'feed', nowMs)

export const feedCooldownSeconds = (state, nowMs) => actionCooldownSeconds(state, 'feed', nowMs)
