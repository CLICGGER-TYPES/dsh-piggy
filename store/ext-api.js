// @ts-check
import { announce } from '../core.js'
import { BOX_TICKET, itemByKey } from '../data.js'
import { EXTENSION_EVENT_VERSION } from '../packages/pet-core/src/data/extension-events.js'
/** 给扩展用的口子：只能花钱、挣钱、给东西、说话；数据只能动自己的那份。 */
/** @param {any} state @param {string} key @param {{nowMs:number, emit?:Function}} options */
export function apiFor(state, key, options) {
  const nowMs = options.nowMs
  return {
    now: nowMs,
    eventVersion: EXTENSION_EVENT_VERSION,
    emit: options.emit ?? (() => false),
    coins: () => state.coins,
    spend: amount => {
      const n = Math.floor(Number(amount))
      if (!(n >= 0) || state.coins < n) return false
      state.coins -= n
      return true
    },
    earn: amount => { state.coins += Math.max(0, Math.min(100_000, Math.floor(Number(amount) || 0))) },
    give: (itemKey, count = 1) => {
      // 盲盒券不在商店里，但盲盒的凭证商店要能发。
      if (itemByKey(itemKey) === null && itemKey !== BOX_TICKET.key) return false
      const n = Math.max(1, Math.min(99, Math.floor(Number(count) || 1)))
      state.inventory = { ...(state.inventory ?? {}), [itemKey]: (state.inventory?.[itemKey] ?? 0) + n }
      return true
    },
    say: text => { announce(state, 'line', String(text).slice(0, 80), nowMs, { scene: 'ext:' + key, replies: [] }) },
    /** 背包里某样东西有几个。 */
    count: itemKey => Math.max(0, Math.floor(Number(state.inventory?.[itemKey]) || 0)),
    take: (itemKey, amount = 1) => takeInventory(state, itemKey, amount),
  }
}


/** Refusal leaves the inventory untouched. */
function takeInventory(state, itemKey, amount) {
  const n = Math.max(1, Math.floor(Number(amount) || 1))
  const have = Math.floor(Number(state.inventory?.[itemKey]) || 0)
  if (have < n) return false
  const inventory = { ...state.inventory }
  if (have === n) delete inventory[itemKey]
  else inventory[itemKey] = have - n
  state.inventory = inventory
  return true
}
