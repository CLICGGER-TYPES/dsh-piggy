// @ts-check
/** Owner document 的工作收据与单文件 WAL：落盘、去重窗口和崩溃恢复都在这里。 */
import { serializeOwnerDocument, validateOwnerDocument } from '../store/owner-document.js'
import { writeOwnerDocumentFile } from './owner-document-file.js'
import { isRecord, sha256, stableText } from './owner-runtime-json.js'
import { inspectCurrentOwnerDocument } from './owner-runtime-state.js'
import { WORK_EVENT_WINDOW_MS, validateWorkEvent, workError } from './work-events.js'
import { summarizeWorkSources } from './work-ledger-summary.js'
import { readWorkJson, removeWorkFile, writeWorkJson } from './work-files.js'

const RECEIPT_LIMIT = 20_000

/** @param {string} ownerId @param {string} pigId @param {{source:string,id:string}} event */
function receiptKey(ownerId, pigId, event) {
  return JSON.stringify([ownerId, pigId, event.source, event.id])
}

/** @typedef {{version:1,source:string,id:string,type:string,at:number,ownerId:string,pigId:string,disposition:'applied'|'ignored'}} OwnerWorkReceipt */

/** @param {unknown} value @param {string} label */
function assertReceipt(value, label = 'owner work receipt') {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'at,disposition,id,ownerId,pigId,source,type,version' ||
      typeof value.ownerId !== 'string' || typeof value.pigId !== 'string' ||
      (value.disposition !== 'applied' && value.disposition !== 'ignored')) {
    throw new Error(`${label} is invalid; evidence preserved`)
  }
  const event = { version: value.version, source: value.source, id: value.id, type: value.type, at: value.at }
  try { validateWorkEvent(event) } catch { throw new Error(`${label} is invalid; evidence preserved`) }
  return /** @type {OwnerWorkReceipt} */ ({ ...event, ownerId: value.ownerId, pigId: value.pigId, disposition: value.disposition })
}

/** @param {unknown} value @returns {Map<string, OwnerWorkReceipt>} */
function loadReceipts(value) {
  const receipts = new Map()
  if (value === null) return receipts
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'receipts,version' || value.version !== 2 ||
      !Array.isArray(value.receipts) || value.receipts.length > RECEIPT_LIMIT) {
    throw new Error('owner work receipts are invalid; evidence preserved')
  }
  for (const raw of value.receipts) {
    const receipt = assertReceipt(raw)
    const key = receiptKey(receipt.ownerId, receipt.pigId, receipt)
    if (receipts.has(key)) throw new Error('duplicate owner work receipt; evidence preserved')
    receipts.set(key, receipt)
  }
  return receipts
}

/**
 * 收据和 WAL 只属于一个 owner document 路径；恢复时按记录中的 before/next
 * revision 决定补提交、回滚还是保留现场。
 * @param {{ownerDocumentPath:string, receiptPath:string, walPath:string, now:()=>number, getOwnerId:()=>string}} options
 */
export function createOwnerWorkLedger(options) {
  const { ownerDocumentPath, receiptPath, walPath, now, getOwnerId } = options
  /** @type {Map<string, OwnerWorkReceipt>} */
  let receipts = new Map()

  /** @param {Map<string, OwnerWorkReceipt>} next */
  function writeReceiptSet(next) {
    const list = [...next.values()].slice(-RECEIPT_LIMIT)
    writeWorkJson(receiptPath, { version: 2, receipts: list })
    receipts = new Map(list.map(receipt => [receiptKey(receipt.ownerId, receipt.pigId, receipt), receipt]))
  }

  function recover() {
    const ownerId = getOwnerId()
    const saved = readWorkJson(receiptPath)
    receipts = loadReceipts(saved)
    const pending = readWorkJson(walPath)
    if (pending === null) return
    const required = ['beforeDocument', 'beforeRevision', 'event', 'generation', 'nextDocument', 'nextRevision', 'ownerId', 'pigId', 'receipt', 'sessionId', 'version']
    if (!isRecord(pending) || Object.keys(pending).sort().join(',') !== required.sort().join(',') ||
        pending.version !== 1 || pending.ownerId !== ownerId || typeof pending.pigId !== 'string' ||
        typeof pending.sessionId !== 'string' || !Number.isSafeInteger(pending.generation) ||
        typeof pending.beforeRevision !== 'string' || typeof pending.nextRevision !== 'string') {
      throw new Error('owner work transaction is invalid; evidence preserved')
    }
    const before = validateOwnerDocument(pending.beforeDocument)
    const next = validateOwnerDocument(pending.nextDocument)
    const receipt = assertReceipt(pending.receipt, 'owner work transaction receipt')
    const eventValue = pending.event
    if (!isRecord(eventValue) || Object.keys(eventValue).sort().join(',') !== 'at,id,source,type,version') {
      throw new Error('owner work transaction event is invalid; evidence preserved')
    }
    const event = { version: eventValue.version, source: eventValue.source, id: eventValue.id, type: eventValue.type, at: eventValue.at }
    try { validateWorkEvent(event) } catch { throw new Error('owner work transaction event is invalid; evidence preserved') }
    if (receipt.ownerId !== ownerId || receipt.pigId !== pending.pigId ||
        receiptKey(ownerId, pending.pigId, event) !== receiptKey(receipt.ownerId, receipt.pigId, receipt) ||
        stableText(event) !== stableText({ version: receipt.version, source: receipt.source, id: receipt.id, type: receipt.type, at: receipt.at }) ||
        before.ownerId !== ownerId || next.ownerId !== ownerId ||
        !before.pigs.some(pig => pig.pigId === pending.pigId) || !next.pigs.some(pig => pig.pigId === pending.pigId) ||
        sha256(serializeOwnerDocument(before)) !== pending.beforeRevision ||
        sha256(serializeOwnerDocument(next)) !== pending.nextRevision) {
      throw new Error('owner work transaction target or revision mismatch; evidence preserved')
    }
    const current = inspectCurrentOwnerDocument(ownerDocumentPath)
    if (current.revision === pending.beforeRevision && pending.nextRevision !== pending.beforeRevision) {
      writeOwnerDocumentFile({ filePath: ownerDocumentPath, document: next, expectedRevision: pending.beforeRevision })
    } else if (current.revision !== pending.nextRevision && current.revision !== pending.beforeRevision) {
      throw new Error('owner work transaction conflicts with a newer document; evidence preserved')
    }
    const key = receiptKey(receipt.ownerId, receipt.pigId, receipt)
    const existing = receipts.get(key)
    if (existing !== undefined && stableText(existing) !== stableText(receipt)) {
      throw new Error('owner work receipt conflicts during recovery; evidence preserved')
    }
    if (existing === undefined) {
      const nextReceipts = new Map(receipts)
      nextReceipts.set(key, receipt)
      writeReceiptSet(nextReceipts)
    }
    removeWorkFile(walPath)
  }

  /**
   * @param {string} ownerId
   * @param {string} pigId
   * @param {{source:string,id:string}} event
   */
  function findEvent(ownerId, pigId, event) {
    return receipts.get(receiptKey(ownerId, pigId, event))
  }

  /** @param {number} nowMs */
  function pruneTo(nowMs) {
    const kept = new Map([...receipts].filter(([, receipt]) => receipt.at >= nowMs - WORK_EVENT_WINDOW_MS))
    if (kept.size !== receipts.size) writeReceiptSet(kept)
  }

  function assertCapacity() {
    if (receipts.size >= RECEIPT_LIMIT) throw workError('owner work receipt capacity reached', 429)
  }

  /** @param {OwnerWorkReceipt} receipt */
  function writeEventReceipt(receipt) {
    const key = receiptKey(receipt.ownerId, receipt.pigId, receipt)
    const existing = receipts.get(key)
    if (existing !== undefined) {
      if (existing.at !== receipt.at || existing.type !== receipt.type) throw workError('owner work event id conflict', 409)
      return
    }
    const next = new Map([...receipts].filter(([, entry]) => entry.at >= now() - WORK_EVENT_WINDOW_MS))
    if (next.size >= RECEIPT_LIMIT) throw workError('owner work receipt capacity reached', 429)
    next.set(key, receipt)
    writeReceiptSet(next)
  }

  function sources() {
    return summarizeWorkSources([...receipts.values()], { now: now() })
  }

  return { recover, findEvent, pruneTo, assertCapacity, writeEventReceipt, sources }
}
