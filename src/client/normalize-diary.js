// @ts-check
/**
 * 日记条目：保留宿主原文 {day,text}，另外准备只用于展示的 {body,careNotes}。
 *
 * 新宿主自己拆好 body/careNotes；老宿主只有 day/text，就在客户端用 core 的
 * splitDiaryText 派生一次。这里只洗形状：不改原文、不存数据、不消耗随机数。
 * 拆出来的文字最终都走 textContent，不拼 HTML。
 * @module dsh-piggy/client/normalize-diary
 */
import { splitDiaryText } from '../../packages/pet-core/src/core/diary-text.js'
import { arr, obj, str } from './values.js'

/** 只有字符串才算一条照料记录；空串和怪东西丢掉。 */
function careNotesOf(value) {
  return arr(value).filter(note => typeof note === 'string' && note !== '')
}

/**
 * 一条日记。`body` 允许是空串（只有照料记录的那一页），所以不能拿它当
 * 「字段缺失」看 —— 分不清就会把原文里的小票又当正文显示一遍。
 * @param {unknown} raw
 * @returns {{ day: string, text: string, body: string, careNotes: string[] }}
 */
export function normalizeDiaryEntry(raw) {
  const entry = obj(raw)
  const text = str(entry.text, '')
  const hasBody = typeof entry.body === 'string'
  const hasCare = Array.isArray(entry.careNotes)
  // 逐字段兜底：老宿主两个都没有，就整条按原文派生；只缺一个时也只补那一个。
  // 显式的空 body / 空 careNotes 是宿主的意思（这页只有明细），不能再拿 text 猜。
  const derived = hasBody && hasCare ? null : splitDiaryText(text)
  return {
    day: str(entry.day, ''),
    text: text,
    body: hasBody ? entry.body : derived !== null ? derived.body : '',
    careNotes: hasCare ? careNotesOf(entry.careNotes) : derived !== null ? derived.careNotes : [],
  }
}

/**
 * 日记列表。新到旧由宿主决定，这里只清洗形状；整条都没有字的条目丢掉，
 * 但「只有照料记录」的条目要留下（正文为空、明细非空）。
 * @param {unknown} raw
 */
export function normalizeDiary(raw) {
  return arr(raw)
    .map(normalizeDiaryEntry)
    .filter(entry => entry.day !== '' && (entry.text !== '' || entry.body !== '' || entry.careNotes.length > 0))
}
