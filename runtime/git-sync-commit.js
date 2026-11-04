// @ts-check
/**
 * 云存档的提交节奏与提交信息：纯函数，不读系统时钟（now/lastSeenAt 由调用方传入），
 * 也不执行 git。传输编排在 git-sync.js。
 *
 * @module dsh-piggy/runtime/git-sync-commit
 */
import { DEFAULT_DEBOUNCE_MS } from './git-sync-process.js'

/**
 * 现在该不该提交。纯函数，单测直接算边界。
 * @param {{ lastCommitAt?: number, now: number, debounceMs?: number, dirty?: boolean }} input
 */
export function shouldCommit({ lastCommitAt = 0, now, debounceMs = DEFAULT_DEBOUNCE_MS, dirty = true }) {
  if (!dirty) return false
  return now - lastCommitAt >= debounceMs
}

/**
 * 提交信息：一行，方便 git log 扫。
 * @param {{lastSeenAt?: number | null, level?: number | null, coins?: number | null}} meta
 * @param {boolean} [manual]
 */
export function commitMessage({ lastSeenAt, level, coins }, manual = false) {
  const at = new Date(lastSeenAt || Date.now())
  const pad = value => String(value).padStart(2, '0')
  const iso = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
  const lv = typeof level === 'number' && Number.isFinite(level) ? `Lv.${level}` : 'Lv.?'
  const money = typeof coins === 'number' && Number.isFinite(coins) ? `${coins}c` : '?c'
  return `${manual ? 'save-manual' : 'save'}: ${iso} ${lv} ${money}`
}
