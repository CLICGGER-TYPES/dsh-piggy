// @ts-check
/**
 * 合并用的分区规则：图鉴/皮肤/鱼/日常/日记/账本/钱包/成就/纪念品/记忆。
 *
 * 只处理纯数据，不读文件；皮肤文件哈希与改名清单由宿主传进来
 * （见 runtime/merge-service.js），这里只决定记录和改名后的 key。
 *
 * @module dsh-piggy/core/merge-collections
 */

import { EXTENSION_EVENT_LIMITS, LEDGER, SKINS } from '../data.js'
import { dayKeyFor } from './clock.js'
import { MERGE_SKIN_LIMIT, MAX_SAFE, isObject, laterDay, maxNum, sumCap, todaySide, whole } from './merge-rules.js'

const SKIN_KEY = /^[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])?$/
const warningsOf = extra => Array.isArray(extra) ? extra : []
const firstAtOf = (a, b) => {
  const left = Number.isFinite(a) ? a : null
  const right = Number.isFinite(b) ? b : null
  if (left === null) return right
  if (right === null) return left
  return Math.min(left, right)
}

/** 图鉴分区：key 并集、计数相加、首次时间取小、鱼的最大尺寸取大。 */
export function mergeDexSection(section, target, source, renames = {}) {
  const out = {}
  for (const [key, record] of Object.entries(isObject(target) ? target : {})) {
    if (!isObject(record)) continue
    out[key] = { firstAt: firstAtOf(record.firstAt, null), count: whole(record.count), ...(Number.isFinite(record.maxSizeCm) ? { maxSizeCm: record.maxSizeCm } : {}) }
  }
  for (const [rawKey, record] of Object.entries(isObject(source) ? source : {})) {
    if (!isObject(record)) continue
    const key = renames[rawKey] ?? rawKey
    const before = out[key]
    const count = sumCap(before?.count, record.count)
    out[key] = {
      firstAt: firstAtOf(before?.firstAt, record.firstAt),
      count,
      ...(section === 'fish' || Number.isFinite(record.maxSizeCm) || Number.isFinite(before?.maxSizeCm)
        ? { maxSizeCm: maxNum(before?.maxSizeCm, record.maxSizeCm) } : {}),
    }
  }
  return out
}

/**
 * 自定义皮肤：同 key 同内容去重；同 key 不同内容把 S 改名共存。
 * `targetHashes`/`sourceHashes` 是 `{key: sha256}`（宿主按实际图片算）。
 * @returns {{ skins: any[], renames: Record<string,string>, copies: {from:string,to:string,key:string}[], conflicts: any[] }}
 */
export function mergeCustomSkins(target, source, targetHashes = {}, sourceHashes = {}, extra = null) {
  const skins = []
  const renames = /** @type {Record<string,string>} */ ({})
  const copies = /** @type {{from:string,to:string,key:string}[]} */ ([])
  const conflicts = []
  const warnings = warningsOf(extra)
  const used = /** @type {Set<string>} */ (new Set(SKINS.map(skin => skin.key)))
  for (const skin of Array.isArray(target) ? target : []) {
    if (!isObject(skin) || !SKIN_KEY.test(String(skin.key ?? ''))) continue
    if (used.has(skin.key) && !SKINS.some(entry => entry.key === skin.key)) continue
    skins.push({ ...skin })
    used.add(skin.key)
  }
  const hasFiles = (hashes, key) => typeof hashes?.[key] === 'string' && hashes[key] !== ''
  const nextKey = (rawKey, hash) => {
    let index = 2
    while (index < 1000) {
      const candidate = `${rawKey}-${index}`
      if (candidate.length <= 24 && !used.has(candidate) && !SKINS.some(entry => entry.key === candidate)) return candidate
      index += 1
    }
    throw new Error('自定义皮肤没有可用的新名字')
  }
  for (const skin of Array.isArray(source) ? source : []) {
    if (!isObject(skin) || !SKIN_KEY.test(String(skin.key ?? ''))) continue
    const key = skin.key
    const existing = skins.find(entry => entry.key === key)
    if (existing === undefined) {
      skins.push({ ...skin })
      used.add(key)
      copies.push({ from: `custom-${key}`, to: `custom-${key}`, key })
      if (!hasFiles(sourceHashes, key)) warnings.push(`皮肤 ${key} 缺少图片，只保留记录`)
      continue
    }
    const same = hasFiles(targetHashes, key) && hasFiles(sourceHashes, key) && targetHashes[key] === sourceHashes[key]
    if (same) continue
    const renamed = nextKey(key, sourceHashes?.[key])
    used.add(renamed)
    renames[key] = renamed
    skins.push({ ...skin, key: renamed, art: `custom-${renamed}` })
    copies.push({ from: `custom-${key}`, to: `custom-${renamed}`, key: renamed })
    conflicts.push({ key: `customSkin:${key}`, level: 'warning', message: `同名皮肤内容不同，保留桌宠的图片，内嵌的改名为 ${renamed}` })
  }
  if (skins.length > MERGE_SKIN_LIMIT) throw new Error(`自定义皮肤超过 ${MERGE_SKIN_LIMIT} 套`)
  return { skins, renames, copies, conflicts }
}

/** 鱼篓 / 自动钓鱼库存：按 id 并集，撞 id 的 S 鱼换一个不冲突的 id，两条都留。 */
export function mergeFishList(target, source, prefix) {
  const out = []
  const used = new Set()
  for (const fish of Array.isArray(target) ? target : []) {
    if (!isObject(fish) || out.length >= 512) continue
    out.push({ ...fish })
    if (typeof fish.id === 'string') used.add(fish.id)
  }
  for (const fish of Array.isArray(source) ? source : []) {
    if (!isObject(fish) || out.length >= 512) continue
    let id = typeof fish.id === 'string' ? fish.id : `${prefix}-${out.length}`
    if (used.has(id)) {
      let index = 2
      while (used.has(`${fish.id}-s${index}`)) index += 1
      id = `${fish.id}-s${index}`
    }
    used.add(id)
    out.push({ ...fish, id })
  }
  return out
}

/** 钓鱼：pending 必须为空；鱼竿/钓点是进度与偏好；按天记录按 6.2 C 段。 */
export function mergeFishing(target, source, nowMs, fallback) {
  const T = isObject(target) ? target : {}
  const S = isObject(source) ? source : {}
  const day = todaySide(T.autoDay, S.autoDay, nowMs) === 'target' ? T.autoDay
    : todaySide(T.autoDay, S.autoDay, nowMs) === 'source' ? S.autoDay
      : (typeof T.autoDay === 'string' && T.autoDay !== '' ? T.autoDay : (typeof S.autoDay === 'string' ? S.autoDay : ''))
  let trips = 0
  if (T.autoDay === day && S.autoDay === day) trips = sumCap(T.autoTrips, S.autoTrips)
  else if (T.autoDay === day) trips = whole(T.autoTrips)
  else if (S.autoDay === day) trips = whole(S.autoTrips)
  const automation = isObject(T.automation) || isObject(S.automation) ? {
    basket: maxNum(T.automation?.basket, S.automation?.basket),
    duration: maxNum(T.automation?.duration, S.automation?.duration),
    baitBox: maxNum(T.automation?.baitBox, S.automation?.baitBox),
    usedMs: maxNum(T.automation?.usedMs, S.automation?.usedMs),
    stock: mergeFishList(T.automation?.stock, S.automation?.stock, 'auto'),
  } : undefined
  return {
    pending: null,
    bag: mergeFishList(T.bag, S.bag, 'catch'),
    seq: Math.max(whole(T.seq), whole(S.seq), ...mergeFishList(T.bag, S.bag, 'catch').map(fish => {
      const match = /(\d+)$/.exec(String(fish.id ?? ''))
      return match === null ? 0 : Number(match[1])
    })),
    autoDay: day,
    autoTrips: trips,
    rod: maxNum(T.rod, S.rod),
    spots: [...new Set([...(Array.isArray(T.spots) ? T.spots : []), ...(Array.isArray(S.spots) ? S.spots : [])])],
    spot: fallback === 'source' ? S.spot : T.spot,
    ...(automation === undefined ? {} : { automation }),
  }
}

/** 签到：较晚的 lastDay 决定 index；total 相加；合并后今天已签。 */
export function mergeSignIn(T, S) {
  const t = isObject(T) ? T : {}
  const s = isObject(S) ? S : {}
  const lastDay = laterDay(t.lastDay, s.lastDay)
  const side = lastDay !== null && lastDay === s.lastDay && lastDay !== t.lastDay ? s : (lastDay !== null && lastDay === t.lastDay ? t : s)
  const index = side === t && t.lastDay === s.lastDay ? Math.max(whole(t.index), whole(s.index)) : whole(side.index)
  return { lastDay, index, total: sumCap(t.total, s.total), cycle7: true }
}

/** 在线礼包：同一天取 max，不同天取当天那一边，unclaimed 相加。 */
export function mergeOnline(T, S, nowMs, fallback) {
  const t = isObject(T) ? T : {}
  const s = isObject(S) ? S : {}
  const side = todaySide(t.day, s.day, nowMs)
  const day = side === 'target' ? t.day : side === 'source' ? s.day : (typeof t.day === 'string' ? t.day : (typeof s.day === 'string' ? s.day : null))
  const same = t.day === day && s.day === day && day !== null
  const pick = (key) => {
    if (same) return maxNum(t[key], s[key])
    if (t.day === day) return whole(t[key])
    if (s.day === day) return whole(s[key])
    return 0
  }
  return { day, onlineMs: pick('onlineMs'), given: pick('given'), unclaimed: sumCap(t.unclaimed, s.unclaimed) }
}

/** 日记：按 day 并集，同一天不同文本追加，完全相同去重，保留最新 60 篇。 */
export function mergeDiary(T, S) {
  const byDay = new Map()
  for (const entry of [...(Array.isArray(T?.entries) ? T.entries : []), ...(Array.isArray(S?.entries) ? S.entries : [])]) {
    if (!isObject(entry) || typeof entry.day !== 'string' || typeof entry.text !== 'string' || entry.day === '' || entry.text === '') continue
    const before = byDay.get(entry.day)
    if (before === undefined) byDay.set(entry.day, entry.text)
    else if (!before.split('\n').includes(entry.text)) byDay.set(entry.day, `${before}\n${entry.text}`)
  }
  const entries = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(-60).map(([day, text]) => ({ day, text }))
  return { entries }
}

/** 当天日记计数：同一天逐 key max，否则取当天那一边；调用方传 nowMs。 */
export function mergeDiaryToday(T, S, nowMs) {
  const t = isObject(T) ? T : {}
  const s = isObject(S) ? S : {}
  const side = todaySide(t.day, s.day, nowMs)
  const day = side === 'target' ? t.day : side === 'source' ? s.day : (typeof t.day === 'string' ? t.day : (typeof s.day === 'string' ? s.day : null))
  const counts = {}
  const same = day !== null && t.day === day && s.day === day
  const sources = same ? [t, s] : [t.day === day ? t : (s.day === day ? s : {})]
  for (const record of sources) {
    for (const [key, value] of Object.entries(isObject(record.counts) ? record.counts : {})) {
      if (!Number.isFinite(value)) continue
      counts[key] = same ? Math.max(whole(counts[key]), whole(value)) : whole(value)
    }
  }
  return { day, counts }
}

/** 番茄钟：运行中必须为空；今日完成数按 pomodoro.day 判断。 */
export function mergePomodoro(T, S, nowMs) {
  const t = isObject(T) ? T : {}
  const s = isObject(S) ? S : {}
  const today = dayKeyFor(nowMs)
  let todayDone = 0
  if (t.day === today && s.day === today) todayDone = Math.max(whole(t.todayDone), whole(s.todayDone))
  else if (t.day === today) todayDone = whole(t.todayDone)
  else if (s.day === today) todayDone = whole(s.todayDone)
  const maxNullable = (a, b) => {
    const left = Number.isFinite(a) && a > 0 ? a : null
    const right = Number.isFinite(b) && b > 0 ? b : null
    return left === null ? right : right === null ? left : Math.max(left, right)
  }
  return {
    startedAt: null, minutes: 0, todayDone, day: today,
    restUntil: maxNullable(t.restUntil, s.restUntil),
    finishedAt: maxNullable(t.finishedAt, s.finishedAt),
    quietBefore: null,
  }
}

/** 总账：来源 in/out 相加；按天并集，同一天逐来源相加；保留最近 7 天。 */
export function mergeEconomy(T, S) {
  const totals = {}
  for (const [source, entry] of Object.entries({ ...(isObject(T?.totals) ? T.totals : {}), ...(isObject(S?.totals) ? S.totals : {}) })) {
    const a = isObject(T?.totals?.[source]) ? T.totals[source] : {}
    const b = isObject(S?.totals?.[source]) ? S.totals[source] : {}
    totals[source] = { in: sumCap(a.in, b.in), out: sumCap(a.out, b.out) }
  }
  const byDay = new Map()
  for (const day of [...(Array.isArray(T?.days) ? T.days : []), ...(Array.isArray(S?.days) ? S.days : [])]) {
    if (!isObject(day) || typeof day.day !== 'string') continue
    const before = byDay.get(day.day) ?? { day: day.day, in: {}, out: {} }
    for (const side of ['in', 'out']) for (const [source, value] of Object.entries(isObject(day[side]) ? day[side] : {})) {
      before[side][source] = sumCap(before[side][source], value)
      if (before[side][source] === 0) delete before[side][source]
    }
    byDay.set(day.day, before)
  }
  return { totals, days: [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-LEDGER.days), fatigue: maxNum(T?.fatigue, S?.fatigue) }
}

/** 钱包：key 并集，余额相加；元数据 T 优先，不同时记警告。 */
export function mergeWallets(T, S, warnings) {
  const out = {}
  const keys = new Set([...Object.keys(isObject(T) ? T : {}), ...Object.keys(isObject(S) ? S : {})])
  for (const key of keys) {
    const t = isObject(T?.[key]) ? T[key] : null
    const s = isObject(S?.[key]) ? S[key] : null
    if (t === null && s === null) continue
    const base = t ?? s
    out[key] = { label: base.label, emoji: base.emoji, rate: base.rate, buyable: base.buyable !== false, balance: sumCap(t?.balance, s?.balance) }
    if (t !== null && s !== null && (t.rate !== s.rate || t.label !== s.label || t.buyable !== s.buyable)) {
      warnings.push(`扩展币 ${key} 两边的名称或汇率不同，按桌宠的来`)
    }
  }
  return out
}

/** 成就：unlocked 并集；totals 取 max(两边之和, 合并后 stats)；seen 归到新 stats；events 累计。 */
export function mergeAchievements(T, S, stats, nowMs) {
  const t = isObject(T) ? T : {}
  const s = isObject(S) ? S : {}
  const unlocked = {}
  for (const [key, record] of Object.entries({ ...(isObject(t.unlocked) ? t.unlocked : {}), ...(isObject(s.unlocked) ? s.unlocked : {}) })) {
    const a = isObject(t.unlocked?.[key]) ? t.unlocked[key] : null
    const b = isObject(s.unlocked?.[key]) ? s.unlocked[key] : null
    const firstAt = firstAtOf(a?.firstAt, b?.firstAt)
    unlocked[key] = { firstAt, recovered: (a === null || a.recovered === true) && (b === null || b.recovered === true) }
  }
  const totals = {}
  const seen = {}
  const keys = new Set([...Object.keys(isObject(t.totals) ? t.totals : {}), ...Object.keys(isObject(s.totals) ? s.totals : {}), ...Object.keys(isObject(stats) ? stats : {})])
  for (const key of keys) {
    const mergedStats = whole(stats?.[key])
    totals[key] = Math.min(MAX_SAFE, Math.max(sumCap(t.totals?.[key], s.totals?.[key]), mergedStats))
    seen[key] = mergedStats
  }
  const events = {}
  for (const [source, stream] of Object.entries({ ...(isObject(t.events) ? t.events : {}), ...(isObject(s.events) ? s.events : {}) })) {
    const left = isObject(t.events?.[source]) ? t.events[source] : {}
    const right = isObject(s.events?.[source]) ? s.events[source] : {}
    events[source] = {}
    for (const name of new Set([...Object.keys(left), ...Object.keys(right)])) {
      const a = isObject(left[name]) ? left[name] : {}
      const b = isObject(right[name]) ? right[name] : {}
      const total = sumCap(a.total, b.total)
      events[source][name] = {
        total, seen: total, maximum: maxNum(a.maximum, b.maximum),
        items: [...new Set([...(Array.isArray(a.items) ? a.items : []), ...(Array.isArray(b.items) ? b.items : [])])]
          .sort().slice(0, EXTENSION_EVENT_LIMITS.items),
      }
    }
  }
  return { unlocked, totals, seen, events, nowMs }
}

/** 纪念品：三者都相同且 gotAt 有限才去重；不同时间同 key 保留多件。 */
export function mergeSouvenirs(T, S) {
  const out = []
  const seen = new Set()
  for (const entry of [...(Array.isArray(T) ? T : []), ...(Array.isArray(S) ? S : [])]) {
    if (!isObject(entry) || typeof entry.key !== 'string') continue
    const key = Number.isFinite(entry.gotAt) ? `${entry.key}\u0000${entry.gotAt}\u0000${String(entry.label ?? '')}` : null
    if (key !== null && seen.has(key)) continue
    if (key !== null) seen.add(key)
    out.push({ ...entry })
  }
  return out
}

/** 记忆：基础身份方最近 8 条；不足用另一边去重后按原顺序补齐。 */
export function mergeMemories(T, S, side) {
  const base = side === 'source' ? S : T
  const other = side === 'source' ? T : S
  const out = (Array.isArray(base) ? base.filter(text => typeof text === 'string') : []).slice(-8)
  for (const text of Array.isArray(other) ? other : []) {
    if (out.length >= 8) break
    if (typeof text === 'string' && !out.includes(text)) out.push(text)
  }
  return out
}

/** 按天计数：同一天逐 key sum（设计里 diary.counts 用 max，这里留给通用场景）。 */
export function mergeDayCounts(T, S, nowMs, mode) {
  const t = isObject(T) ? T : {}
  const s = isObject(S) ? S : {}
  const side = todaySide(t.day, s.day, nowMs)
  const day = side === 'target' ? t.day : side === 'source' ? s.day : (typeof t.day === 'string' ? t.day : (typeof s.day === 'string' ? s.day : null))
  const out = {}
  const same = day !== null && t.day === day && s.day === day
  const sides = same ? [t, s] : [t.day === day ? t : {}, s.day === day ? s : {}]
  for (const record of sides) for (const [key, value] of Object.entries(isObject(record.value) ? record.value : {})) {
    if (!Number.isFinite(value)) continue
    out[key] = mode === 'max' ? Math.max(whole(out[key]), whole(value)) : sumCap(out[key] ?? 0, value)
  }
  return { day, value: out }
}
