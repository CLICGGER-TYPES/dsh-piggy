// @ts-check
/**
 * 扩展币钱包（规则 1，docs/design/economy.md；用户 2026-10-09）。
 *
 * - 钱包放在宿主 `state.wallets[扩展名]`，不在扩展的 data 里：扩展只能通过 api.wallet 动自己那一个。
 * - 钱包里存着币的名字、图标和汇率（1 个币值多少金币），每次扩展动作时按 manifest 刷新；
 *   删扩展时按存着的汇率把余额全部换成金币（不收费），所以扩展文件坏了也能结清。
 * - 换成金币按汇率不收费；用金币换多收 EXCHANGE.buyFee，来回倒腾会亏。
 * - 扩展可以声明 `buyable: false`：这种币只能在扩展里挣，不能拿金币买（盲盒的资质凭证——能买就等于花钱直接买六星）。
 * @module dsh-piggy/core/wallets
 */

import { EXCHANGE } from '../data.js'
import { earnCoins, record, spendCoins } from './economy.js'
import { remember } from './effects.js'

const KEY = /^[a-z0-9-]{2,24}$/

/** @param {any} value */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
/** @param {any} value */
const whole = value => Math.max(0, Math.floor(Number(value) || 0))

/**
 * manifest 里的 `economy.currency` → 干净的币信息；不合法返回 null。
 * @param {any} raw
 * @returns {{ label: string, emoji: string, rate: number, buyable: boolean }|null}
 */
export function currencyInfo(raw) {
  if (!isObject(raw)) return null
  const rate = Number(raw.rate)
  if (!Number.isFinite(rate) || rate < EXCHANGE.minRate || rate > EXCHANGE.maxRate) return null
  const label = String(raw.label ?? '').trim().slice(0, 8)
  const emoji = String(raw.emoji ?? '').trim().slice(0, 8) || '🪙'
  return label === '' ? null : { label, emoji, rate, buyable: raw.buyable !== false }
}

/** 补齐 / 修好钱包；坏的丢掉。 @param {any} state */
export function ensureWallets(state) {
  const out = {}
  if (isObject(state.wallets)) {
    for (const [key, wallet] of Object.entries(state.wallets)) {
      if (!KEY.test(key) || !isObject(wallet)) continue
      const info = currencyInfo(wallet)
      if (info === null) continue
      out[key] = { ...info, balance: whole(wallet.balance) }
    }
  }
  state.wallets = out
  return out
}

/**
 * 扩展动作前按 manifest 开 / 刷新钱包（名字、图标、汇率），余额不动。没声明货币就不开。
 * @param {any} state @param {string} key @param {any} currency manifest.economy.currency
 */
export function openWallet(state, key, currency) {
  const info = currencyInfo(currency)
  if (info === null || !KEY.test(key)) return null
  const wallets = ensureWallets(state)
  wallets[key] = { ...info, balance: wallets[key]?.balance ?? 0 }
  return wallets[key]
}

/** @param {any} state @param {string} key */
export function walletBalance(state, key) {
  return ensureWallets(state)[key]?.balance ?? 0
}

/**
 * 扩展币进账；来源记在 ext.<扩展名>. 下（单位是扩展币）。返回实际加了多少。
 * @param {any} state @param {string} key @param {number} amount @param {string} source 已带前缀的来源 @param {number} nowMs
 */
export function walletEarn(state, key, amount, source, nowMs) {
  const wallet = ensureWallets(state)[key]
  const n = Math.min(whole(amount), EXCHANGE.maxAmount)
  if (wallet === undefined || n === 0) return 0
  wallet.balance += n
  record(state, 'in', source, n, nowMs)
  return n
}

/**
 * 扩展币花出去；不够就不动，返回 false。
 * @param {any} state @param {string} key @param {number} amount @param {string} sink 已带前缀的去处 @param {number} nowMs
 */
export function walletSpend(state, key, amount, sink, nowMs) {
  const wallet = ensureWallets(state)[key]
  const n = whole(amount)
  if (wallet === undefined || wallet.balance < n) return false
  if (n === 0) return true
  wallet.balance -= n
  record(state, 'out', sink, n, nowMs)
  return true
}

/**
 * 兑换。`toGold`：amount 个扩展币换成金币（向下取整，不收费）；`fromGold`：用金币买 amount 个扩展币（多收 5%，向上取整）。
 * @param {any} state @param {string} key @param {'toGold'|'fromGold'} direction @param {number} amount @param {number} nowMs
 */
export function exchangeCurrency(state, key, direction, amount, nowMs) {
  const wallet = ensureWallets(state)[key]
  if (wallet === undefined) return { ok: false, reason: 'unknown' }
  const n = Math.min(whole(amount), EXCHANGE.maxAmount)
  if (n === 0) return { ok: false, reason: 'empty' }
  const source = `exchange.${key}`
  if (direction === 'toGold') {
    const gold = Math.floor(n * wallet.rate)
    if (gold === 0) return { ok: false, reason: 'too-small' }
    if (!walletSpend(state, key, n, `ext.${key}.exchange`, nowMs)) return { ok: false, reason: 'poor' }
    earnCoins(state, gold, source, nowMs)
    return { ok: true, amount: n, gold }
  }
  if (direction === 'fromGold') {
    if (!wallet.buyable) return { ok: false, reason: 'not-buyable' }
    const gold = Math.ceil(n * wallet.rate * (1 + EXCHANGE.buyFee))
    if (!spendCoins(state, gold, source, nowMs)) return { ok: false, reason: 'poor', price: gold }
    walletEarn(state, key, n, `ext.${key}.exchange`, nowMs)
    return { ok: true, amount: n, gold }
  }
  return { ok: false, reason: 'unknown' }
}

/**
 * 删扩展时：余额按存着的汇率全部换成金币（不收费），钱包删掉。返回换了多少金币。
 * @param {any} state @param {string} key @param {number} nowMs
 */
export function cashOutWallet(state, key, nowMs) {
  const wallets = ensureWallets(state)
  const wallet = wallets[key]
  if (wallet === undefined) return 0
  const gold = Math.floor(wallet.balance * wallet.rate)
  if (wallet.balance > 0) record(state, 'out', `ext.${key}.exchange`, wallet.balance, nowMs)
  if (gold > 0) {
    earnCoins(state, gold, `exchange.${key}`, nowMs)
    remember(state, `${wallet.emoji} ${wallet.balance} ${wallet.label}换成了 🪙 ${gold}（删掉扩展时自动结清）`, nowMs)
  }
  delete wallets[key]
  return gold
}

/** 背包「钱包」页和扩展页顶上的余额条。 @param {any} state */
export function walletsView(state) {
  if (state === null) return []
  return Object.entries(ensureWallets(state)).map(([key, wallet]) => ({
    key, label: wallet.label, emoji: wallet.emoji, balance: wallet.balance, rate: wallet.rate, buyable: wallet.buyable,
    /** 用金币买 1 个要多少（含手续费），给界面显示。 */
    buyRate: Number((wallet.rate * (1 + EXCHANGE.buyFee)).toFixed(4)),
  }))
}
