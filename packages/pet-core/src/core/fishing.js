// @ts-check
/** C5 manual and automatic fishing; all core randomness comes through random.js. */
import { FISH, FISH_FIGHTS, fishByKey, itemByKey } from '../data.js'
import { begin, awayBlockedReason } from './activity.js'
import { dayKeyFor } from './clock.js'
import { clamp100, remember } from './effects.js'
import { ensureDex } from './dex.js'
import { chance, pickOne, rollerFor } from './random.js'
import { reduceFishingWeight } from './weight.js'
import { say } from './lines.js'
import { earnCoins } from './economy.js'

const WEIGHT = { common: 60, uncommon: 24, rare: 8, legend: 1 }
export const emptyFishing = () => ({ pending: null, bag: [], seq: 0, autoDay: '', autoTrips: 0 })

function cleanCatch(value) {
  if (!value || typeof value !== 'object' || fishByKey(value.key) === null || typeof value.id !== 'string') return null
  if (!Number.isFinite(value.sizeCm) || !Number.isFinite(value.price)) return null
  return { id: value.id, key: value.key, sizeCm: Math.max(0.1, value.sizeCm), price: Math.max(0, Math.floor(value.price)), caughtAt: Number(value.caughtAt) || 0 }
}

function cleanPending(value) {
  const caught = cleanCatch(value)
  if (caught === null || !['waiting', 'hooked', 'caught'].includes(value.phase)) return null
  if (![value.castPower, value.bitesAt, value.hookUntil, value.expiresAt].every(Number.isFinite)) return null
  const fight = FISH_FIGHTS.includes(value.fight) ? { fight: value.fight } : {}
  return { ...caught, phase: value.phase, castPower: Math.max(0, Math.min(1, value.castPower)), bitesAt: value.bitesAt, hookUntil: value.hookUntil, expiresAt: value.expiresAt, ...fight }
}

export function ensureFishing(state) {
  const raw = state.fishing && typeof state.fishing === 'object' && !Array.isArray(state.fishing) ? state.fishing : {}
  const clean = {
    pending: cleanPending(raw.pending),
    bag: Array.isArray(raw.bag) ? raw.bag.map(cleanCatch).filter(Boolean) : [],
    seq: Number.isInteger(raw.seq) && raw.seq >= 0 ? raw.seq : 0,
    autoDay: typeof raw.autoDay === 'string' ? raw.autoDay : '',
    autoTrips: Number.isFinite(raw.autoTrips) ? Math.max(0, Math.floor(raw.autoTrips)) : 0,
  }
  Object.assign(raw, clean)
  state.fishing = raw
  return raw
}

export function fishingPeriod(nowMs) {
  const hour = new Date(nowMs).getHours()
  return hour >= 5 && hour < 10 ? 'early' : hour >= 10 && hour < 16 ? 'noon' : hour >= 16 && hour < 21 ? 'evening' : 'night'
}

function weightedFish(nowMs, power, next, baitBoost = 0) {
  const entries = FISH.filter(fish => fish.times.includes(fishingPeriod(nowMs))).map(fish => ({
    fish,
    weight: WEIGHT[fish.rarity] * (fish.rarity === 'legend' ? 1 + power * 8 : fish.rarity === 'rare' ? 1 + power * 4 : fish.rarity === 'uncommon' ? 1 + power : 1)
      * (fish.rarity === 'legend' ? 1 + baitBoost * 3 : fish.rarity === 'rare' ? 1 + baitBoost * 2 : fish.rarity === 'uncommon' ? 1 + baitBoost : 1),
  }))
  let cursor = next() * entries.reduce((sum, entry) => sum + entry.weight, 0)
  for (const entry of entries) { cursor -= entry.weight; if (cursor < 0) return entry.fish }
  return entries[entries.length - 1].fish
}

function makeCatch(state, fish, nowMs, next) {
  const fishing = ensureFishing(state)
  fishing.seq += 1
  return { id: `catch-${nowMs}-${fishing.seq}`, key: fish.key, sizeCm: Number((fish.minCm + next() * (fish.maxCm - fish.minCm)).toFixed(1)), price: fish.price, caughtAt: nowMs }
}

export function castFishing(state, power, nowMs, next = rollerFor(state), baitKey) {
  const fishing = ensureFishing(state)
  if (fishing.pending !== null && nowMs <= fishing.pending.expiresAt) return { ok: false, reason: 'pending' }
  fishing.pending = null
  // 猪在打工、上学、旅行也能钓（用户 2026-10-09：外出不挡扩展玩法）；只有自动钓鱼时不能手动钓。
  const blocked = awayBlockedReason(state)
  if (blocked !== null && !(blocked === 'away' && state.activity?.kind !== 'fishing')) return { ok: false, reason: blocked }
  if (state.satiety < 1) return { ok: false, reason: 'hungry' }
  const bait = itemByKey(baitKey)
  if (bait?.kind !== 'bait' || (state.inventory?.[baitKey] ?? 0) < 1) return { ok: false, reason: 'no-bait' }
  const castPower = Number.isFinite(power) ? Math.max(0, Math.min(1, power)) : 0
  const fish = weightedFish(nowMs, castPower, next, bait.rarityBoost ?? 0)
  const caught = makeCatch(state, fish, nowMs, next)
  const bitesAt = nowMs + 2000 + Math.floor(next() * 6001)
  fishing.pending = { ...caught, phase: 'waiting', castPower, bitesAt, hookUntil: bitesAt + 2000, expiresAt: nowMs + 60_000 }
  state.inventory[baitKey] -= 1
  if (state.inventory[baitKey] === 0) delete state.inventory[baitKey]
  state.satiety = clamp100(state.satiety - 1)
  return { ok: true, fish, pending: fishing.pending }
}

export function hookFishing(state, nowMs) {
  const fishing = ensureFishing(state)
  const pending = fishing.pending
  if (pending === null || nowMs > pending.expiresAt) { fishing.pending = null; return { ok: false, reason: 'none' } }
  if (pending.phase !== 'waiting') return { ok: false, reason: 'phase' }
  if (nowMs < pending.bitesAt) return { ok: false, reason: 'early' }
  if (nowMs > pending.hookUntil) { fishing.pending = null; return { ok: false, reason: 'escaped' } }
  pending.phase = 'hooked'
  // 三种搏斗玩法随机一种；竖条和拉力要拉一会儿，给足一分钟。
  pending.fight = pickOne(rollerFor(state), FISH_FIGHTS) ?? 'ring'
  pending.expiresAt = Math.max(pending.expiresAt, nowMs + 60_000)
  return { ok: true, fish: fishByKey(pending.key), pending }
}

export function resolveFishing(state, success, nowMs) {
  const fishing = ensureFishing(state)
  const pending = fishing.pending
  if (pending === null || pending.phase !== 'hooked' || nowMs > pending.expiresAt) { fishing.pending = null; return { ok: false, reason: 'none' } }
  if (success !== true) { fishing.pending = null; say(state, 'fishEscape', nowMs); return { ok: true, caught: false } }
  pending.phase = 'caught'
  const rarity = fishByKey(pending.key)?.rarity
  say(state, rarity === 'rare' || rarity === 'legend' ? 'fishRare' : 'fishCatch', nowMs)
  return { ok: true, caught: true, pending }
}

function recordFish(state, caught, nowMs) {
  const dex = ensureDex(state, nowMs)
  const before = dex.fish[caught.key]
  dex.fish[caught.key] = { firstAt: before?.firstAt ?? nowMs, count: (before?.count ?? 0) + 1, maxSizeCm: Math.max(before?.maxSizeCm ?? 0, caught.sizeCm) }
}

export function keepFish(state, nowMs) {
  const fishing = ensureFishing(state)
  if (fishing.pending === null || fishing.pending.phase !== 'caught') return { ok: false, reason: 'none' }
  const caught = cleanCatch(fishing.pending)
  fishing.pending = null
  if (caught === null) return { ok: false, reason: 'none' }
  fishing.bag.push(caught)
  recordFish(state, caught, nowMs)
  state.stats.fishCaught = (state.stats.fishCaught ?? 0) + 1
  reduceFishingWeight(state, 3)
  remember(state, `${fishByKey(caught.key)?.emoji ?? '🐟'} 钓到了${fishByKey(caught.key)?.label ?? '鱼'}，${caught.sizeCm} cm`, nowMs)
  return { ok: true, fish: caught }
}

export function grantFish(state, key, nowMs, forcedSize) {
  const fish = fishByKey(key)
  if (fish === null) return null
  const fishing = ensureFishing(state)
  const caught = makeCatch(state, fish, nowMs, () => 0.5)
  if (Number.isFinite(forcedSize)) caught.sizeCm = Math.max(fish.minCm, Math.min(fish.maxCm, forcedSize))
  fishing.bag.push(caught)
  recordFish(state, caught, nowMs)
  return caught
}

function takeFish(state, id) {
  const bag = ensureFishing(state).bag
  const index = bag.findIndex(entry => entry.id === id)
  return index < 0 ? null : bag.splice(index, 1)[0]
}

export function feedFish(state, id, nowMs) {
  const blocked = awayBlockedReason(state)
  if (blocked !== null) return { ok: false, reason: blocked }
  const caught = takeFish(state, id)
  if (caught === null) return { ok: false, reason: 'missing' }
  const gain = Math.min(60, caught.price / 2)
  state.satiety = clamp100(state.satiety + gain)
  remember(state, `🍽 吃掉了${fishByKey(caught.key)?.label ?? '鱼'}，饱食 +${gain}`, nowMs)
  return { ok: true, gain }
}

export function sellFish(state, id, nowMs) {
  const caught = takeFish(state, id)
  if (caught === null) return { ok: false, reason: 'missing' }
  earnCoins(state, caught.price, 'sell.fish', nowMs)
  state.stats.sales = (state.stats.sales ?? 0) + 1
  state.stats.coinsEarned = (state.stats.coinsEarned ?? 0) + caught.price
  remember(state, `🪙 卖掉${fishByKey(caught.key)?.label ?? '鱼'}，得到 ${caught.price} 金币`, nowMs)
  return { ok: true, sold: caught.price }
}

function resetAutoDay(fishing, nowMs) {
  const day = dayKeyFor(nowMs)
  if (fishing.autoDay !== day) { fishing.autoDay = day; fishing.autoTrips = 0 }
}

export function startAutoFishing(state, minutes, nowMs, baitKey) {
  const fishing = ensureFishing(state)
  resetAutoDay(fishing, nowMs)
  if (![30, 60].includes(minutes)) return { ok: false, reason: 'minutes' }
  // rc.1 反馈：自动钓鱼不限每天次数，只看鱼饵够不够（autoTrips 仍记今天去了几次）。
  const bait = itemByKey(baitKey)
  const attempts = minutes / 3
  if (bait?.kind !== 'bait' || (state.inventory?.[baitKey] ?? 0) < attempts) return { ok: false, reason: 'no-bait', need: attempts }
  const result = begin(state, { kind: 'fishing', key: `auto-${minutes}`, label: `自动钓鱼 ${minutes} 分钟`, emoji: '🎣', minutes, cost: 0, baitKey, baitCount: attempts }, nowMs)
  if (result.ok) {
    state.inventory[baitKey] -= attempts
    if (state.inventory[baitKey] === 0) delete state.inventory[baitKey]
    fishing.autoTrips += 1
  }
  return result
}

export function finishAutoFishing(state, activity, nowMs, next = rollerFor(state)) {
  const attempts = Math.max(1, Math.floor((activity.endsAt - activity.startedAt) / 180_000))
  let count = 0
  const bait = itemByKey(activity.baitKey)
  for (let index = 0; index < attempts; index += 1) {
    const at = activity.startedAt + index * 180_000
    const fish = weightedFish(at, 0.45, next, bait?.rarityBoost ?? 0)
    if (!chance(next, Math.max(0.2, 0.95 - fish.difficulty * 0.0075))) continue
    const caught = makeCatch(state, fish, at, next)
    recordFish(state, caught, nowMs)
    ensureFishing(state).bag.push(caught)
    count += 1
  }
  state.stats.fishingAuto = (state.stats.fishingAuto ?? 0) + 1
  state.stats.fishCaught = (state.stats.fishCaught ?? 0) + count
  reduceFishingWeight(state, attempts * 3)
  remember(state, `🎣 自动钓鱼回来，钓到 ${count} 条，已放进鱼篓`, nowMs)
  return { count }
}

export function fishingView(state, nowMs) {
  const fishing = ensureFishing(state)
  resetAutoDay(fishing, nowMs)
  if (fishing.pending !== null && nowMs > fishing.pending.expiresAt) fishing.pending = null
  const enrich = caught => ({ ...caught, ...fishByKey(caught.key) })
  return { pending: fishing.pending === null ? null : enrich(fishing.pending), bag: fishing.bag.map(enrich), period: fishingPeriod(nowMs), autoTrips: fishing.autoTrips, autoLeft: null }
}

export function skipFishingWait(state, nowMs) {
  const pending = ensureFishing(state).pending
  if (pending === null || pending.phase !== 'waiting') return { ok: false, reason: 'none' }
  pending.bitesAt = nowMs
  pending.hookUntil = nowMs + 2000
  return { ok: true }
}
