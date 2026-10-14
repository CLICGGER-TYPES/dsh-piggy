// @ts-check
/** 游戏状态与工作收据一起提交；失败事务恢复前不接受下一次游戏操作。 */
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { feed, settleAchievements } from '../core.js'
import { writeStateFile } from '../store/state-file.js'
import { readWorkJson, removeWorkFile, syncDirectory, writeWorkJson } from './work-files.js'
import { WORK_EVENT_WINDOW_MS, validateWorkEvent, workError, workEventKey } from './work-events.js'

const RECEIPT_LIMIT = 20000
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
}
const identity = value => JSON.stringify(canonical(value))

function savedState(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error }
}

function validateReceipt(receipt) {
  const { disposition, ...event } = receipt
  validateWorkEvent(event)
  if (!['applied', 'ignored'].includes(disposition)) throw new Error('invalid work receipt; evidence preserved')
}

export function openWorkLedger({ directory, statePath, now = Date.now }) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const receiptPath = join(directory, 'receipts.json')
  const walPath = join(directory, 'transaction.json')
  let receipts = new Map()
  const saved = readWorkJson(receiptPath)
  if (saved !== null) {
    if (saved.version !== 1 || !Array.isArray(saved.receipts) || saved.receipts.length > RECEIPT_LIMIT) {
      throw new Error('invalid work receipts; evidence preserved')
    }
    for (const receipt of saved.receipts) {
      validateReceipt(receipt)
      const key = workEventKey(receipt)
      if (receipts.has(key)) throw new Error('duplicate work receipt; evidence preserved')
      receipts.set(key, receipt)
    }
  }
  let pending = readWorkJson(walPath)
  if (pending !== null) {
    const isState = state => state === null || (typeof state === 'object' && !Array.isArray(state))
    if (Object.keys(pending).sort().join(',') !== 'beforeState,nextState,receipt,statePath,version' ||
        pending.version !== 1 || pending.statePath !== resolve(statePath) ||
        !isState(pending.beforeState) || !isState(pending.nextState)) {
      throw new Error('invalid work transaction; evidence preserved')
    }
    validateReceipt(pending.receipt)
  }

  function finish(store) {
    if (pending === null) return
    const disk = identity(savedState(statePath))
    const before = identity(pending.beforeState)
    const after = identity(pending.nextState)
    if (disk !== before && disk !== after) throw new Error('work state conflict; evidence preserved')
    if (store && ![before, after].includes(identity(store.state))) {
      throw new Error('work memory conflict; evidence preserved')
    }
    if (disk === before && pending.nextState !== null) {
      writeStateFile(statePath, pending.nextState)
      syncDirectory(dirname(statePath))
    }
    // flush 已撤下旧状态的节流计时器；安装不能再安排一次旧快照写盘。
    if (store) store.installCommittedState(structuredClone(pending.nextState))
    const key = workEventKey(pending.receipt)
    const existing = receipts.get(key)
    if (existing && identity(existing) !== identity(pending.receipt)) throw new Error('work receipt conflict; evidence preserved')
    if (!existing) {
      const next = new Map(receipts)
      next.set(key, pending.receipt)
      writeWorkJson(receiptPath, { version: 1, receipts: [...next.values()] })
      receipts = next
    }
    removeWorkFile(walPath)
    pending = null
  }

  // 恢复早于 Store 打开，不让旧内存状态覆盖已提交存档。
  finish(null)

  function receive(store, event) {
    const nowMs = now()
    validateWorkEvent(event, nowMs)
    finish(store)
    const existing = receipts.get(workEventKey(event))
    if (existing) {
      if (existing.at !== event.at || existing.type !== event.type) throw workError('work event id conflict', 409)
      return { ok: true, status: 'duplicate', disposition: existing.disposition }
    }
    const kept = new Map([...receipts].filter(([, receipt]) => receipt.at >= nowMs - WORK_EVENT_WINDOW_MS))
    if (kept.size !== receipts.size) {
      writeWorkJson(receiptPath, { version: 1, receipts: [...kept.values()] })
      receipts = kept
    }
    if (receipts.size >= RECEIPT_LIMIT) throw workError('work receipt capacity reached', 429)
    // 保存完整内存基线，让 WAL 的 beforeState 与当前 Store 一致。
    store.flush(true)
    const beforeState = savedState(statePath)
    const nextState = structuredClone(store.state)
    const disposition = nextState === null || nextState.dead ? 'ignored' : 'applied'
    if (nextState !== null) { feed(nextState, event.type, nowMs); settleAchievements(nextState, nowMs) }
    const receipt = { ...event, disposition }
    const wal = { version: 1, statePath: resolve(statePath), beforeState, nextState, receipt }
    writeWorkJson(walPath, wal)
    pending = wal
    finish(store)
    return { ok: true, status: 'applied', disposition }
  }

  return { receive, finish }
}
