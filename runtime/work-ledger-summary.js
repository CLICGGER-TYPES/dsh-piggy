// @ts-check
/** 收据来源的只读聚合；不返回事件正文，也不改存档。 */
import { WORK_EVENT_WINDOW_MS } from './work-events.js'

const DEFAULT_LIMIT = 8

/**
 * @typedef {{ source: string, count: number, lastAt: number, types: Record<string, number> }} WorkSourceSummary
 */

/**
 * 按 source 聚合窗口内的收据，按最近时间倒序，最多 limit 个来源。
 * 损坏/缺字段的收据跳过，不影响其它来源。
 * @param {readonly any[] | null | undefined} receipts
 * @param {{ now?: number, windowMs?: number, limit?: number }} [options]
 * @returns {WorkSourceSummary[]}
 */
export function summarizeWorkSources(receipts, options = {}) {
  if (!Array.isArray(receipts)) return []
  const now = Number.isFinite(options.now) ? options.now : Date.now()
  const windowMs = Number.isFinite(options.windowMs) && options.windowMs > 0 ? options.windowMs : WORK_EVENT_WINDOW_MS
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : DEFAULT_LIMIT
  const cutoff = now - windowMs
  /** @type {Map<string, WorkSourceSummary>} */
  const bySource = new Map()
  for (const receipt of receipts) {
    if (receipt === null || typeof receipt !== 'object') continue
    if (typeof receipt.source !== 'string' || receipt.source === '') continue
    if (typeof receipt.type !== 'string' || receipt.type === '') continue
    if (!Number.isFinite(receipt.at) || receipt.at < cutoff) continue
    let entry = bySource.get(receipt.source)
    if (entry === undefined) {
      entry = { source: receipt.source, count: 0, lastAt: receipt.at, types: Object.create(null) }
      bySource.set(receipt.source, entry)
    }
    entry.count += 1
    if (receipt.at > entry.lastAt) entry.lastAt = receipt.at
    entry.types[receipt.type] = (entry.types[receipt.type] ?? 0) + 1
  }
  return [...bySource.values()]
    .sort((a, b) => b.lastAt - a.lastAt || a.source.localeCompare(b.source))
    .slice(0, limit)
    .map(entry => ({ source: entry.source, count: entry.count, lastAt: entry.lastAt, types: { ...entry.types } }))
}
