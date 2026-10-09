// @ts-check
import { announce, earnCoins, exert, extensionSource, openWallet, spendCoins, walletBalance, walletEarn, walletSpend } from '../core.js'
import { BOX_TICKET, EXT_EARN_PER_ACTION, itemByKey } from '../data.js'
import { EXTENSION_EVENT_VERSION } from '../packages/pet-core/src/data/extension-events.js'
/**
 * 给扩展用的口子：只能花钱、挣钱、给东西、说话；数据只能动自己的那份。
 * 金币一律走 core/economy.js 记账，来源强制记在 `ext.<扩展名>.` 下（docs/guides/writing-extensions.md「经济」）。
 * 一次动作最多挣 EXT_EARN_PER_ACTION，写错的扩展冲不垮经济。
 * 声明了货币（manifest.economy.currency）的扩展还有 api.wallet：自己的币，钱包放在宿主，删扩展时按汇率换成金币。
 * @param {any} state @param {string} key @param {{nowMs:number, emit?:Function, currency?:any}} options
 */
export function apiFor(state, key, options) {
  const nowMs = options.nowMs
  let earned = 0
  const wallet = openWallet(state, key, options.currency)
  return {
    /** 自己的币（游戏 0.35.0 起；没声明货币就是 null）。 */
    wallet: wallet === null ? null : {
      currency: { label: wallet.label, emoji: wallet.emoji, rate: wallet.rate },
      balance: () => walletBalance(state, key),
      /** 进账，返回实际加了多少。source 是来源名（如 'sell'）。 */
      earn: (amount, source = 'earn') => walletEarn(state, key, amount, extensionSource(state, key, source), nowMs),
      /** 花出去，不够返回 false、什么都不动。 */
      spend: (amount, sink = 'spend') => walletSpend(state, key, amount, extensionSource(state, key, sink), nowMs),
    },
    now: nowMs,
    eventVersion: EXTENSION_EVENT_VERSION,
    emit: options.emit ?? (() => false),
    coins: () => state.coins,
    /** 花钱：不够返回 false、什么都不动。sink 是去处名（如 'seed'），不写记成 spend。 */
    spend: (amount, sink = 'spend') => {
      const n = Math.floor(Number(amount))
      if (!(n >= 0)) return false
      return spendCoins(state, n, extensionSource(state, key, sink), nowMs)
    },
    /** 挣钱：source 是来源名（如 'sell'），不写记成 earn。返回实际加了多少（超过单次动作上限的部分不给）。 */
    earn: (amount, source = 'earn') => {
      const n = Math.min(Math.max(0, Math.floor(Number(amount) || 0)), EXT_EARN_PER_ACTION - earned)
      if (n <= 0) return 0
      earned += n
      return earnCoins(state, n, extensionSource(state, key, source), nowMs)
    },
    /** 「玩会累」：主动玩一下扣一点饱食（data/economy.js 的建议值），最多一次 5 点。 */
    exert: points => exert(state, Math.min(5, Math.max(0, Number(points) || 0))),
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
