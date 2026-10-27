// @ts-check
/**
 * 合并结果的最后一道守卫：数值、上限、瞬态字段和收据唯一性。
 *
 * 合并是唯一会整份重写桌面存档的路径；这里失败就中止，绝不写半个结果
 * （见 #14 设计 6.6 第 8/9 步）。
 *
 * @module dsh-piggy/core/merge-validate
 */

import { migrate, sanitizeInventory } from './migrate.js'
import { MERGE_RECEIPT_LIMIT, MERGE_SKIN_LIMIT, MAX_SAFE, isObject } from './merge-rules.js'
import { MergeError } from './merge.js'

const NUMERIC = ['ageMs', 'xp', 'weightG', 'satiety', 'happiness', 'cleanliness', 'health', 'coins',
  'criticalDoctorVisits', 'outingStreak', 'restMinutes', 'lastFedAt', 'lastActiveAt', 'lastSeenAt',
  'settledUpTo', 'pendingSeq', 'bornAt', 'profileEdits']

function fail(path, reason, value) {
  throw new MergeError('invalid-result', '合并结果校验失败', { path, reason, value: typeof value === 'number' ? value : undefined })
}

/** @param {any} state @param {number} nowMs */
export function assertMergedState(state, nowMs) {
  if (!isObject(state)) fail('state', 'not-object')
  for (const key of NUMERIC) {
    const value = state[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(key, 'not-finite')
    if (value < 0) fail(key, 'negative', value)
    if (value > MAX_SAFE) fail(key, 'too-large', value)
  }
  if (state.settledUpTo < nowMs) fail('settledUpTo', 'before-now', state.settledUpTo)
  if (state.activity !== null) fail('activity', 'not-empty')
  if (state.pomodoro?.startedAt !== null) fail('pomodoro.startedAt', 'not-empty')
  if (state.fishing?.pending !== null) fail('fishing.pending', 'not-empty')
  if (!Array.isArray(state.customSkins) || state.customSkins.length > MERGE_SKIN_LIMIT) fail('customSkins', 'too-many')
  const keys = new Set()
  for (const skin of state.customSkins) {
    if (!isObject(skin) || typeof skin.key !== 'string' || skin.key === '') fail('customSkins', 'bad-key')
    if (keys.has(skin.key)) fail('customSkins', 'duplicate', skin.key)
    keys.add(skin.key)
  }
  const inventory = sanitizeInventory(state.inventory)
  if (Object.keys(inventory).length !== Object.keys(isObject(state.inventory) ? state.inventory : {}).length) {
    fail('inventory', 'unknown-key')
  }
  for (const [section, records] of Object.entries(isObject(state.dex) ? state.dex : {})) {
    for (const [key, record] of Object.entries(isObject(records) ? records : {})) {
      if (key === '' || !isObject(record) || !Number.isFinite(record.count) || record.count <= 0) fail(`dex.${section}.${key}`, 'bad-record')
    }
  }
  if (!Number.isFinite(state.pomodoro?.todayDone) || state.pomodoro.todayDone < 0) fail('pomodoro.todayDone', 'bad')
  // migrate 是最后一道「还是不是合法存档」的检查；失败就中止，不写。
  const checked = migrate(structuredClone(state), nowMs)
  if (checked === null) fail('state', 'migrate-rejected')
  return checked
}

/** @param {any[]} receipts @param {number} nowMs */
export function assertMergedReceipts(receipts, nowMs) {
  if (!Array.isArray(receipts)) fail('receipts', 'not-array')
  if (receipts.length > MERGE_RECEIPT_LIMIT) fail('receipts', 'too-many', receipts.length)
  const seen = new Set()
  for (const receipt of receipts) {
    if (!isObject(receipt)) fail('receipts', 'bad-entry')
    const key = JSON.stringify([receipt.source, receipt.id])
    if (seen.has(key)) fail('receipts', 'duplicate', key)
    seen.add(key)
    if (receipt.at < nowMs - 7 * 86_400_000) fail('receipts', 'outside-window', receipt.at)
  }
}
