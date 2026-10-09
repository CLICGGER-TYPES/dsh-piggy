// @ts-check
/**
 * 旅行与纪念品。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/travel
 */

import { rarityByKey, tripByKey } from '../data.js'
import { begin } from './activity.js'
import { TOO_WEAK_HEALTH } from './constants.js'
import { remember } from './effects.js'
import { earnCoins, refundCoins, spendCoins } from './economy.js'

/**
 * Sell one souvenir from the collection.
 *
 * Souvenirs used to be strings with no way out of the list; now each one has a
 * rarity and a price, so the collection is a wallet as well as a shelf.
 *
 * @returns `{ok: true, sold, coins}` or `{ok: false, reason}`.
 */
export function sellSouvenir(state, souvenirKey, nowMs) {
  if (state === null || state === undefined) return { ok: false, reason: 'absent' }
  if (state.dead === true) return { ok: false, reason: 'dead' }
  const list = Array.isArray(state.souvenirs) ? state.souvenirs : []
  const index = list.findIndex(entry => entry !== null && typeof entry === 'object' && entry.key === souvenirKey)
  if (index < 0) return { ok: false, reason: 'not-owned' }
  const entry = list[index]
  const tier = rarityByKey(entry.rarity)
  state.souvenirs = [...list.slice(0, index), ...list.slice(index + 1)]
  earnCoins(state, tier.price, 'sell.souvenir', nowMs)
  state.stats.sales = (state.stats.sales ?? 0) + 1
  remember(state, `把「${entry.label}」卖了 ${tier.price} 金币`, nowMs)
  return { ok: true, sold: entry.key, coins: tier.price, rarity: tier.key }
}

export function startTrip(state, tripKey, nowMs) {
  if (state.hatched !== true) return { ok: false, reason: 'box' }
  const trip = tripByKey(tripKey)
  if (trip === null) return { ok: false, reason: 'unknown' }
  if (state.dead) return { ok: false, reason: 'dead' }
  if (state.activity !== null) return { ok: false, reason: 'away' }
  if (state.health <= TOO_WEAK_HEALTH) return { ok: false, reason: 'weak' }
  if (state.coins < trip.cost) return { ok: false, reason: 'poor', price: trip.cost }
  if (state.satiety < 15) return { ok: false, reason: 'hungry' }

  spendCoins(state, trip.cost, 'trip', nowMs)
  const result = begin(state, {
    kind: 'trip', key: trip.key, label: trip.label, emoji: trip.emoji,
    minutes: trip.minutes, cost: trip.cost,
  }, nowMs)
  if (!result.ok) {
    refundCoins(state, trip.cost, 'trip', nowMs)
    return result
  }
  remember(state, `${trip.emoji} 出发去${trip.label}（花了 ${trip.cost} 金币）`, nowMs)
  return result
}
