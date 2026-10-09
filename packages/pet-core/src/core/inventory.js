// @ts-check
/**
 * 背包、购买、装扮与道具使用。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/inventory
 */

import { DEFAULT_TOY, REVIVE_ITEM, SHOP, dressSlotByKey, itemByKey } from '../data.js'
import { levelProgress } from './clock.js'
import { applyEffects, remember } from './effects.js'
import { useFormItem } from './evolution.js'
import { medicate } from './illness.js'
import { decay } from './settlement.js'
import { revive } from './state.js'
import { recordDex } from './dex.js'
import { act } from './care.js'
import { spendCoins } from './economy.js'

/** Inventory counts, always including zeroes so the UI can render a grid. */
export function inventoryView(state) {
  const out = {}
  for (const item of SHOP) {
    // 家当 is not carried in counts — it is owned and worn.
    if (item.kind === 'dress') continue
    out[item.key] = state.inventory?.[item.key] ?? 0
  }
  // The free default toy is always in the bag and never runs out, so `玩耍` is
  // never blocked by an empty one.
  out[DEFAULT_TOY.key] = Infinity
  return out
}

/**
 * Owned / worn state for the 装扮 shelf, plus the level each one needs.
 *
 * The panel shows all twelve even when locked: an item you cannot see is an
 * item you will never save up for.
 */
export function dressView(state) {
  const owned = new Set(state.dress ?? [])
  const worn = new Set(state.worn ?? [])
  const have = levelProgress(state.xp).level
  return SHOP.filter(item => item.kind === 'dress').map(item => ({
    key: item.key, label: item.label, emoji: item.emoji, price: item.price,
    level: item.level ?? 1,
    // The anchor this piece goes on; one item per slot at a time.
    slot: item.slot ?? null,
    slotLabel: item.slot === undefined ? '' : (dressSlotByKey(item.slot)?.label ?? item.slot),
    blurb: item.blurb ?? '',
    owned: owned.has(item.key),
    worn: worn.has(item.key),
    unlocked: have >= (item.level ?? 1),
  }))
}

export function buy(state, itemKey, nowMs) {
  const item = itemByKey(itemKey)
  if (item === null) return { ok: false, reason: 'unknown' }
  if (state.dead && item.key !== REVIVE_ITEM.key) return { ok: false, reason: 'dead' }

  // 家当 is a different transaction: own it once, then wear it. No counts.
  if (item.kind === 'dress') {
    if ((state.dress ?? []).includes(item.key)) return { ok: false, reason: 'owned', item }
    const have = levelProgress(state.xp).level
    const need = item.level ?? 1
    if (have < need) return { ok: false, reason: 'low-level', need, have, item }
    if (!spendCoins(state, item.price, 'dress', nowMs)) return { ok: false, reason: 'poor', price: item.price }
    recordDex(state, 'items', item.key, nowMs)
    state.dress = [...(state.dress ?? []), item.key]
    state.stats.purchases += 1
    remember(state, `买下了 ${item.emoji} ${item.label}（-${item.price} 金币）`, nowMs)
    return { ok: true, item }
  }

  if (!spendCoins(state, item.price, 'shop', nowMs)) return { ok: false, reason: 'poor', price: item.price }

  state.inventory = { ...(state.inventory ?? {}) }
  recordDex(state, 'items', item.key, nowMs)
  state.inventory[item.key] = (state.inventory[item.key] ?? 0) + 1
  state.stats.purchases += 1
  remember(state, `买了 ${item.emoji} ${item.label}（-${item.price} 金币）`, nowMs)
  return { ok: true, item }
}

/** Shared checks for the two 装扮 actions. */
export function wearableDress(state, itemKey) {
  const item = itemByKey(itemKey)
  if (item === null || item.kind !== 'dress') return { item: null, reason: 'unknown' }
  if (!(state.dress ?? []).includes(item.key)) return { item: null, reason: 'not-owned' }
  return { item, reason: null }
}

/**
 * Put a 装扮 on. Only owned dress items; one item per slot, so a new hat
 * automatically takes the old one off.
 * @returns `{ ok: true, item, worn }` or `{ ok: false, reason }`.
 */
export function wearItem(state, itemKey, nowMs) {
  const { item, reason } = wearableDress(state, itemKey)
  if (item === null) return { ok: false, reason }
  const worn = new Set(state.worn ?? [])
  for (const key of [...worn]) {
    const other = itemByKey(key)
    if (other !== null && other.slot === item.slot) worn.delete(key)
  }
  worn.add(item.key)
  state.worn = [...worn]
  remember(state, `戴上了 ${item.emoji} ${item.label}`, nowMs)
  return { ok: true, item, worn: state.worn.slice() }
}

/** Take a 装扮 off. */
export function takeOff(state, itemKey, nowMs) {
  const { item, reason } = wearableDress(state, itemKey)
  if (item === null) return { ok: false, reason }
  const worn = new Set(state.worn ?? [])
  worn.delete(item.key)
  state.worn = [...worn]
  remember(state, `摘下了 ${item.emoji} ${item.label}`, nowMs)
  return { ok: true, item, worn: state.worn.slice() }
}

/**
 * Debug helper: hand the pig one of everything.
 *
 * 20 of each consumable, every 装扮 owned, and enough coins that price is never
 * the reason a test in the panel fails.
 */
export function grantAll(state, nowMs) {
  if (state === null || state === undefined) return { ok: false, reason: 'absent' }
  const inventory = { ...(state.inventory ?? {}) }
  for (const item of SHOP) {
    if (item.kind === 'dress') {
      if (!(state.dress ?? []).includes(item.key)) recordDex(state, 'items', item.key, nowMs)
      continue
    }
    const added = Math.max(0, 20 - (inventory[item.key] ?? 0))
    if (added > 0) recordDex(state, 'items', item.key, nowMs, added)
    inventory[item.key] = Math.max(inventory[item.key] ?? 0, 20)
  }
  state.inventory = inventory
  const dress = SHOP.filter(item => item.kind === 'dress').map(item => item.key)
  state.dress = dress
  state.coins = Math.max(state.coins ?? 0, 99999)
  state.stats.purchases = (state.stats.purchases ?? 0) + dress.length
  remember(state, '🔧 调试：一键拿齐了所有物品', nowMs)
  return { ok: true, granted: { items: SHOP.length - dress.length, dress: dress.length, coins: state.coins } }
}

export const canAfford = (state, itemKey) => {
  const item = itemByKey(itemKey)
  return item !== null && state.coins >= item.price
}

/** 背包里哪些货架的东西其实是一次照料。 */
const CARE_FOR_KIND = Object.freeze({ food: 'feed', bath: 'bathe', toy: 'play' })

export function useItem(state, itemKey, nowMs) {
  const item = itemByKey(itemKey)
  if (item === null) return { ok: false, reason: 'unknown' }
  // 家当 is worn, not consumed — 穿上 is a different action.
  if (item.kind === 'dress') return { ok: false, reason: 'not-consumable' }
  // Promotion owns its condition check and consumption as one transaction.
  if (item.kind === 'promotion') return useFormItem(state, itemKey, nowMs)
  // 食物、洗浴、玩具在背包里用，和状态页的喂食 / 洗澡 / 玩耍是同一件事：长体重、可能胀气、
  // 猪会说话、玩耍会减重（G 批次：状态页的照料按钮改成跳到背包）。免费的小皮球也走这里。
  const careAction = CARE_FOR_KIND[item.kind]
  const have = state.inventory?.[itemKey] ?? 0
  if (have <= 0 && item.default !== true) return { ok: false, reason: 'empty' }
  if (careAction !== undefined) {
    const result = act(state, careAction, nowMs, itemKey)
    return result.ok ? { ...result, ok: true, item } : result
  }
  decay(state, nowMs)

  if (item.key === REVIVE_ITEM.key) {
    if (!state.dead) return { ok: false, reason: 'not-dead' }
    state.inventory[itemKey] = have - 1
    revive(state, nowMs)
    return { ok: true, item }
  }
  if (state.dead) return { ok: false, reason: 'dead' }

  if (item.kind === 'medicine') {
    if (state.illness === null) return { ok: false, reason: 'not-sick' }
    // Swallowed either way: the wrong medicine is spent too, and makes it worse.
    state.inventory[itemKey] = have - 1
    const result = medicate(state, item, nowMs)
    return result.ok ? { ok: true, item } : result
  }

  if (state.activity !== null) return { ok: false, reason: 'away' }

  state.inventory[itemKey] = have - 1
  applyEffects(state, item, nowMs)
  remember(state, `用了 ${item.emoji} ${item.label}`, nowMs)
  return { ok: true, item }
}
