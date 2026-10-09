// @ts-check
/** 自动钓鱼按时间差逐竿结算；独立的存档随机种子让分段和离线结算一致。 */
import { AUTO_FISH_GEAR, AUTO_FISH_INTERVAL, AUTO_FISH_WINDOW, AUTO_FISH_SUCCESS_FACTOR } from '../data/fishing-auto.js'
import { itemByKey, rodByLevel } from '../data.js'
import { begin } from './activity.js'
import { spendCoins } from './economy.js'
import { remember } from './effects.js'
import { reduceFishingWeight } from './weight.js'
import { rollerFor, chance } from './random.js'
import { ensureFishing, makeCatch, recordFish, spotOpen, weightedFish } from './fishing.js'

/** 清洗自动升级字段；旧背包保持原样，不用鱼篓上限裁掉历史鱼。 */
export function cleanAutomation(raw, cleanCatch) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const level = kind => Number.isInteger(source[kind]) && AUTO_FISH_GEAR[kind][source[kind]] ? source[kind] : 0
  return { basket: level('basket'), duration: level('duration'), baitBox: level('baitBox'),
    usedMs: Number.isFinite(source.usedMs) ? Math.max(0, Math.min(AUTO_FISH_WINDOW, source.usedMs)) : 0,
    stock: Array.isArray(source.stock) ? source.stock.map(cleanCatch).filter(Boolean) : [] }
}

export function automationView(state) {
  const automation = ensureFishing(state).automation
  return { unlocked: automation.duration > 0, stored: automation.stock.length, usedHours: automation.usedMs / 3600000, capacityHours: 6, full: automation.usedMs >= AUTO_FISH_WINDOW,
    baitLimit: AUTO_FISH_GEAR.baitBox[automation.baitBox].value,
    choices: [30, 60, 120, 240].filter(minutes => minutes <= AUTO_FISH_GEAR.duration[automation.duration].value)
      .map(minutes => ({ minutes, attempts: minutes <= 60 ? minutes / 3 : Math.floor(minutes * 60000 / AUTO_FISH_INTERVAL), legacy: minutes <= 60 })),
    upgrades: Object.entries(AUTO_FISH_GEAR).flatMap(([kind, levels]) => {
      const next = levels[automation[kind] + 1]
      return next ? [{ kind, ...next }] : []
    }) }
}

export function buyFishingAutomation(state, kind, nowMs) {
  const automation = ensureFishing(state).automation
  if (!Object.hasOwn(AUTO_FISH_GEAR, kind)) return { ok: false, reason: 'unknown' }
  const next = AUTO_FISH_GEAR[kind][automation[kind] + 1]
  if (!next) return { ok: false, reason: 'owned' }
  if (!spendCoins(state, next.price, 'fish.' + kind, nowMs)) return { ok: false, reason: 'poor' }
  automation[kind] += 1
  return { ok: true }
}

export function collectAutoFish(state, nowMs) {
  const fishing = ensureFishing(state)
  if (fishing.automation.stock.length === 0 && fishing.automation.usedMs === 0) return { ok: false, reason: 'empty' }
  const count = fishing.automation.stock.length
  fishing.bag.push(...fishing.automation.stock)
  fishing.automation.stock = []
  fishing.automation.usedMs = 0
  remember(state, `🎣 收了 ${count} 条鱼，放进背包`, nowMs)
  return { ok: true, count }
}

export function beginAutoFishing(state, minutes, nowMs, baitKey) {
  const fishing = ensureFishing(state)
  const view = automationView(state)
  if (![120, 240].includes(minutes) || !view.choices.some(choice => choice.minutes === minutes)) return { ok: false, reason: 'minutes' }
  if (view.full) return { ok: false, reason: 'unavailable' }
  if (!spotOpen(fishing.spot, nowMs)) return { ok: false, reason: 'closed' }
  const attempts = Math.floor(minutes * 60000 / AUTO_FISH_INTERVAL), bait = itemByKey(baitKey)
  const have = state.inventory?.[baitKey] ?? 0, boxed = view.baitLimit > 0
  if (bait?.kind !== 'bait' || have < (boxed ? 1 : attempts)) return { ok: false, reason: 'no-bait', need: boxed ? 1 : attempts }
  const auto = { version: 1, attempted: 0, spent: 0, count: 0, lastAt: nowMs, boxed, limit: boxed ? view.baitLimit : attempts,
    seed: (state.seed ^ nowMs ^ fishing.autoTrips) >>> 0, spot: fishing.spot, rod: fishing.rod }
  const result = begin(state, { kind: 'fishing', key: `auto-${minutes}`, label: `自动钓鱼 ${minutes} 分钟`, emoji: '🎣',
    minutes, cost: 0, baitKey, baitCount: boxed ? 0 : attempts, auto }, nowMs)
  if (!result.ok) return result
  if (!boxed) {
    state.inventory[baitKey] -= attempts
    if (state.inventory[baitKey] === 0) delete state.inventory[baitKey]
  }
  fishing.autoTrips += 1
  return result
}

/** 缺饵或仓满的瞬间缩短行程；预付但未使用的鱼饵在结束 / 召回时退回。 */
export function settleAutoFishing(state, activity, nowMs) {
  const auto = activity?.auto
  if (activity?.kind !== 'fishing' || auto?.version !== 1 || nowMs < auto.lastAt || auto.finished) return
  const fishing = ensureFishing(state), rod = rodByLevel(auto.rod), bait = itemByKey(activity.baitKey)
  const next = rollerFor(auto)
  const until = Math.min(nowMs, activity.endsAt, auto.lastAt + AUTO_FISH_WINDOW - fishing.automation.usedMs)
  const attempts = Math.floor((until - activity.startedAt) / AUTO_FISH_INTERVAL)
  while (auto.attempted < attempts) {
    const at = activity.startedAt + (auto.attempted + 1) * AUTO_FISH_INTERVAL
    if (fishing.automation.usedMs >= AUTO_FISH_WINDOW || auto.spent >= auto.limit) {
      activity.endsAt = Math.min(activity.endsAt, at); break
    }
    const fish = weightedFish(at, 0.45, next, bait?.rarityBoost ?? 0, auto.spot, rod.rare)
    if (fish !== null && (auto.boxed ? (state.inventory?.[activity.baitKey] ?? 0) < 1 : activity.baitCount < 1)) {
      activity.endsAt = Math.min(activity.endsAt, at); break
    }
    auto.attempted += 1
    if (fish === null) continue
    if (auto.boxed) {
      state.inventory[activity.baitKey] -= 1
      if (state.inventory[activity.baitKey] === 0) delete state.inventory[activity.baitKey]
    } else activity.baitCount -= 1
    auto.spent += 1; reduceFishingWeight(state, 3)
    if (chance(next, Math.max(0.2, 0.95 - fish.difficulty * rod.difficulty * 0.0075) * AUTO_FISH_SUCCESS_FACTOR * AUTO_FISH_GEAR.basket[fishing.automation.basket].value)) {
      const caught = makeCatch(state, fish, at, next)
      recordFish(state, caught, at); fishing.automation.stock.push(caught); auto.count += 1
      state.stats.fishCaught = (state.stats.fishCaught ?? 0) + 1
    }
    if (fishing.automation.usedMs >= AUTO_FISH_WINDOW || auto.spent >= auto.limit || (auto.boxed && (state.inventory?.[activity.baitKey] ?? 0) === 0)) {
      activity.endsAt = Math.min(activity.endsAt, at); break
    }
  }
  const through = Math.min(until, activity.endsAt)
  fishing.automation.usedMs = Math.min(AUTO_FISH_WINDOW, fishing.automation.usedMs + Math.max(0, through - auto.lastAt))
  auto.lastAt = Math.max(auto.lastAt, through)
  if (fishing.automation.usedMs >= AUTO_FISH_WINDOW) activity.endsAt = Math.min(activity.endsAt, through)
}

export function finishAutomation(state, activity, nowMs) {
  if (activity.auto.finished) return { count: 0 }
  settleAutoFishing(state, activity, nowMs)
  const auto = activity.auto
  auto.finished = true
  if (activity.baitCount > 0) {
    state.inventory[activity.baitKey] = (state.inventory[activity.baitKey] ?? 0) + activity.baitCount
    activity.baitCount = 0
  }
  state.stats.fishingAuto = (state.stats.fishingAuto ?? 0) + 1
  remember(state, `🎣 自动钓鱼回来，钓到 ${auto.count} 条，放在鱼篓里等你收`, nowMs)
  return { count: auto.count }
}

/** 行程随旧档清洗保留进度，不能重启后把已结算的竿数清成零。 */
export function cleanAutoTrip(raw, activity) {
  if (raw?.version !== 1 || !Number.isFinite(raw.lastAt)) return undefined
  const count = value => Number.isSafeInteger(value) ? Math.max(0, Math.min(64, value)) : 0
  return { version: 1, attempted: count(raw.attempted), spent: count(raw.spent), count: count(raw.count),
    lastAt: Math.max(activity.startedAt, raw.lastAt), boxed: raw.boxed === true, limit: count(raw.limit),
    seed: Number(raw.seed) >>> 0, spot: typeof raw.spot === 'string' ? raw.spot : 'river', rod: rodByLevel(raw.rod).level,
    finished: raw.finished === true }
}
