// @ts-check
/**
 * 金币的唯一入口（设计：docs/design/economy.md）。
 *
 * - 所有加减都走 earnCoins / spendCoins / refundCoins，按来源记账（总账 + 最近几天）。
 * - 扩展的来源一律在 `ext.<扩展名>.` 下（store/ext-api.js 加前缀），冒充不了游戏本身的来源；
 *   删掉扩展只是它的那几行账不再增长，金币和别的账都不受影响。
 * - 账本有大小上限（data/economy.js 的 LEDGER），存档不会被撑大。
 * - 「玩会累」：主动玩法用 exert 扣饱食，不满 1 点的部分攒着。
 * @module dsh-piggy/core/economy
 */

import { LEDGER, SOURCE_LABELS } from '../data.js'
import { dayKeyFor } from './clock.js'

const SOURCE = /^[a-z0-9][a-z0-9.-]{0,47}$/

/** @param {any} value */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
/** @param {any} value */
const amountOf = value => Math.max(0, Math.floor(Number(value) || 0))

/** 一组「来源 → 数」，只留合法的来源和非负整数。 @param {any} raw */
function cleanCounts(raw) {
  const out = {}
  if (!isObject(raw)) return out
  for (const [source, value] of Object.entries(raw)) if (SOURCE.test(source) && amountOf(value) > 0) out[source] = amountOf(value)
  return out
}

/**
 * 补齐 / 修好账本；坏数据丢掉，不影响金币本身。
 * @param {any} state
 */
export function ensureEconomy(state) {
  const raw = isObject(state.economy) ? state.economy : {}
  const totals = {}
  if (isObject(raw.totals)) {
    for (const [source, entry] of Object.entries(raw.totals)) {
      if (!SOURCE.test(source) || !isObject(entry)) continue
      totals[source] = { in: amountOf(entry.in), out: amountOf(entry.out) }
    }
  }
  const days = (Array.isArray(raw.days) ? raw.days : [])
    .filter(day => isObject(day) && typeof day.day === 'string')
    .slice(-LEDGER.days)
    .map(day => ({ day: day.day, in: cleanCounts(day.in), out: cleanCounts(day.out) }))
  const fatigue = Number.isFinite(raw.fatigue) ? Math.max(0, Math.min(1, raw.fatigue)) : 0
  state.economy = { totals, days, fatigue }
  return state.economy
}

/**
 * 来源名：小写字母、数字、点、横线，最长 48；不合法的记成 `other`。
 * @param {unknown} source
 */
export function cleanSource(source) {
  const text = String(source ?? '').toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 48)
  return SOURCE.test(text) ? text : 'other'
}

/**
 * 扩展的来源名：强制加 `ext.<扩展名>.` 前缀；一个扩展最多 LEDGER.maxSourcesPerExtension 个，超了并进 `.other`。
 * @param {any} state @param {string} key @param {unknown} source
 */
export function extensionSource(state, key, source) {
  const prefix = `ext.${cleanSource(key)}.`
  const tail = String(source ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'other'
  const wanted = prefix + tail
  const totals = ensureEconomy(state).totals
  if (totals[wanted] !== undefined) return wanted
  const used = Object.keys(totals).filter(name => name.startsWith(prefix)).length
  return used >= LEDGER.maxSourcesPerExtension ? prefix + 'other' : wanted
}

/**
 * 记一笔账（金币或扩展币；扩展币的来源都在 ext.<扩展名>. 下，单位看前缀）。amount 可以是负数（退款冲掉支出）。
 * @param {any} state @param {'in'|'out'} side @param {string} source @param {number} amount @param {number} nowMs
 */
export function record(state, side, source, amount, nowMs) {
  const ledger = ensureEconomy(state)
  let name = cleanSource(source)
  if (ledger.totals[name] === undefined && Object.keys(ledger.totals).length >= LEDGER.maxSources) name = 'other'
  const entry = ledger.totals[name] ?? { in: 0, out: 0 }
  ledger.totals[name] = { ...entry, [side]: Math.max(0, entry[side] + amount) }
  const day = dayKeyFor(nowMs)
  let today = ledger.days[ledger.days.length - 1]
  if (today === undefined || today.day !== day) {
    today = { day, in: {}, out: {} }
    ledger.days = [...ledger.days, today].slice(-LEDGER.days)
  }
  today[side][name] = Math.max(0, (today[side][name] ?? 0) + amount)
  if (today[side][name] === 0) delete today[side][name]
}

/**
 * 加金币并记账。返回实际加了多少。
 * @param {any} state @param {number} amount @param {string} source @param {number} nowMs
 */
export function earnCoins(state, amount, source, nowMs) {
  const n = amountOf(amount)
  if (n === 0) return 0
  state.coins = amountOf(state.coins) + n
  record(state, 'in', source, n, nowMs)
  return n
}

/**
 * 扣金币并记账；不够就什么都不动，返回 false。
 * @param {any} state @param {number} amount @param {string} sink @param {number} nowMs
 */
export function spendCoins(state, amount, sink, nowMs) {
  const n = amountOf(amount)
  if (amountOf(state.coins) < n) return false
  if (n === 0) return true
  state.coins = amountOf(state.coins) - n
  record(state, 'out', sink, n, nowMs)
  return true
}

/**
 * 退钱（提前回来、没去成）：加回金币，并从原来那项支出里扣掉，不算成收入。
 * @param {any} state @param {number} amount @param {string} sink @param {number} nowMs
 */
export function refundCoins(state, amount, sink, nowMs) {
  const n = amountOf(amount)
  if (n === 0) return 0
  state.coins = amountOf(state.coins) + n
  record(state, 'out', sink, -n, nowMs)
  return n
}

/**
 * 「玩会累」：主动玩一下扣一点饱食，不满 1 点的攒着，攒满 1 点才扣。
 * @param {any} state @param {number} points
 */
export function exert(state, points) {
  const ledger = ensureEconomy(state)
  const add = Math.max(0, Number(points) || 0)
  if (add === 0) return 0
  const total = ledger.fatigue + add
  const whole = Math.floor(total)
  ledger.fatigue = total - whole
  if (whole > 0) state.satiety = Math.max(0, (Number(state.satiety) || 0) - whole)
  return whole
}

/**
 * 调试页「经济」：每个来源的收支、今天和最近几天的合计。
 * @param {any} state
 */
export function economyView(state) {
  if (state === null) return null
  const ledger = ensureEconomy(state)
  const sources = Object.entries(ledger.totals)
    .map(([source, entry]) => ({ source, label: SOURCE_LABELS[source] ?? null, in: entry.in, out: entry.out }))
    .sort((a, b) => (b.in + b.out) - (a.in + a.out))
  const sum = counts => Object.values(counts).reduce((total, value) => total + value, 0)
  return {
    sources,
    days: ledger.days.map(day => ({ day: day.day, in: sum(day.in), out: sum(day.out) })),
  }
}
