// @ts-check
/**
 * 宠物日记：把「今天发生了什么」攒起来，跨天（06:00）写成一篇。
 *
 * 零 token：从写好的日记本（data/diary-book.js）里挑一篇——按当天最要紧的事选组，
 * 组里挑最近没用过的。事件点只是在原有逻辑旁边加一句 `noteToday(state, 'feed')`。
 *
 * @module dsh-piggy/core/diary
 */
import { DIARY_BOOK, DIARY_GROUP_ORDER, DIARY_MAX, OWNER_TOKEN } from '../data.js'
import { dayKeyFor } from './clock.js'
import { ensureDialogue } from './lines.js'
import { rollerFor } from './random.js'
import { splitDiaryText } from './diary-text.js'

/** 一本空日记：没有历史，今天还没开始记。 */
export function emptyDiary() {
  return { entries: [], today: { day: null, counts: {} } }
}

/**
 * 补默认值（新字段不加 upgrades 级、不动 STATE_VERSION）。
 * @param {object} state
 */
export function ensureDiary(state) {
  const raw = state.diary
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    state.diary = emptyDiary()
    return state.diary
  }
  const entries = Array.isArray(raw.entries) ? raw.entries : []
  const kept = []
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue
    if (typeof entry.day !== 'string' || typeof entry.text !== 'string') continue
    if (entry.day === '' || entry.text === '') continue
    kept.push({ day: entry.day, text: entry.text })
  }
  const today = raw.today !== null && typeof raw.today === 'object' && !Array.isArray(raw.today) ? raw.today : {}
  const counts = {}
  if (today.counts !== null && typeof today.counts === 'object' && !Array.isArray(today.counts)) {
    for (const [key, value] of Object.entries(today.counts)) {
      if (Number.isFinite(value) && value > 0) counts[key] = Math.floor(value)
    }
  }
  state.diary = {
    entries: kept.slice(-DIARY_MAX),
    today: { day: typeof today.day === 'string' && today.day !== '' ? today.day : null, counts },
  }
  return state.diary
}

/**
 * 记一笔今天发生了什么。
 *
 * 归属哪一天由结算器在事件发生时调用 `writeDiaryIfNewDay()` 决定；
 * 在线动作则由宿主读取状态时先翻页。
 * @param {object} state
 * @param {string} kind - 事件名（feed、work、illness……见 data/diary-book.js 的分组规则）
 * @param {number} [amount]
 */
export function noteToday(state, kind, amount = 1) {
  const diary = ensureDiary(state)
  diary.today.counts[kind] = (diary.today.counts[kind] ?? 0) + amount
  return diary
}

/** 日记页用日期选篇：当天的摘要和跨天落笔追加到同一篇，保留已有文字。 */
export function appendDiaryEntry(state, day, text) {
  const diary = ensureDiary(state)
  const entry = diary.entries.find(item => item.day === day)
  if (entry) entry.text += '\n' + text
  else diary.entries.push({ day, text })
  if (diary.entries.length > DIARY_MAX) diary.entries.splice(0, diary.entries.length - DIARY_MAX)
  return diary
}

/**
 * 这一天该从哪组里挑：最要紧的那件事；有点动静但不特别算「日常」，什么都没有算「没人来」。
 * @param {Record<string, number>} counts
 * @returns {string}
 */
export function diaryGroupFor(counts) {
  for (const rule of DIARY_GROUP_ORDER) {
    if (rule.when(counts)) return rule.group
  }
  return Object.values(counts).some(value => value > 0) ? 'daily' : 'lonely'
}

/**
 * 写一篇：从当天那组里挑一篇最近没写过的（组里都写过了就随便挑）。
 * @param {Record<string, number>} counts
 * @param {string} ownerName
 * @param {() => number} [next] 随机数，默认取第一篇（测试用）
 * @param {ReadonlyArray<string>} [recent] 最近写过的日记全文
 */
export function composeDiary(counts, ownerName, next = () => 0, recent = []) {
  const book = /** @type {Record<string, ReadonlyArray<string>>} */ (DIARY_BOOK)
  const pool = book[diaryGroupFor(counts)] ?? book.daily
  const said = text => text.split(OWNER_TOKEN).join(ownerName)
  const recentBodies = new Set(recent.map(text => splitDiaryText(text).body.trim()))
  const fresh = pool.filter(text => !recentBodies.has(said(text).trim()))
  const from = fresh.length > 0 ? fresh : pool
  return said(from[Math.min(from.length - 1, Math.floor(next() * from.length))])
}

/**
 * 跨天了就把昨天（`today`）写成一篇，然后从今天重新开始记。
 *
 * 每次读状态都会调一次：第一次见到今天会把 `today.day` 归位；换了天就落笔。
 * @returns {boolean} 是否写了新的一篇
 */
export function writeDiaryIfNewDay(state, nowMs) {
  const diary = ensureDiary(state)
  const today = dayKeyFor(nowMs)
  if (diary.today.day === null) {
    diary.today.day = today
    return false
  }
  if (diary.today.day === today) return false

  const owner = ensureDialogue(state).ownerName
  const recent = diary.entries.map(entry => entry.text)
  const updated = appendDiaryEntry(state, diary.today.day, composeDiary(diary.today.counts, owner, rollerFor(state), recent))
  updated.today = { day: today, counts: {} }
  return true
}

/** 面板用按日期倒序的派生信息；text原文保留以兼容旧客户端和存档导出。 */
export function diaryView(state) {
  const diary = ensureDiary(state)
  return diary.entries.slice().reverse().map(entry => ({ day: entry.day, text: entry.text, ...splitDiaryText(entry.text) }))
}
