// @ts-check
/**
 * 显式 owner document 的写入事务层：排他锁、revision CAS、可恢复单文件事务、迁移与原子替换。
 * 所有磁盘写入都经过这里；读取与校验一律复用 owner-document-file-inspect.js（依赖单向）。
 * 事务目录里 journal 永远最后删：清理中断时 recover 仍能辨别提交状态。
 * @module dsh-piggy/runtime/owner-document-file-transaction
 */
import { createHash, randomBytes } from 'node:crypto'
import { lstatSync, mkdirSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { migrate, STATE_VERSION } from '../src/host/core.js'
import { ownerDocumentFromLegacyV15, serializeOwnerDocument, validateOwnerDocument } from '../store/owner-document.js'
import {
  HASH_PATTERN, assertExpectedRevision, assertPlainTarget, assertStableIdentity, canonicalFilePath, decodeJson,
  errorCode, inspectBytes, inspectOwnerDocumentFile, isPlainRecord, readRegularFile, sha256, validateJournal,
  validateOwnerMarker,
} from './owner-document-file-inspect.js'
import { acquireGameLock } from './owner-lock.js'
import { atomicWrite } from './merge-transaction.js'
import { syncDirectory } from './work-files.js'

const TX_PREFIX = '.owner-document-tx-'
const OWNER_MARKER = 'owner.json'
const JOURNAL = 'journal.json'
const OLD_BYTES = 'old.bin'
const NEW_BYTES = 'new.bin'

/** @typedef {{document:import('../store/owner-document.js').OwnerDocument, revision:string, cleanupDeferred:boolean}} WriteResult */

/** @param {string} filePath */
function transactionDirectory(filePath) {
  const identity = createHash('sha256').update(filePath).digest('hex')
  return join(dirname(filePath), `${TX_PREFIX}${identity}`)
}

/** @template T @param {string[]} filePaths @param {() => T} action @returns {T} */
function withLocks(filePaths, action) {
  const releases = []
  try {
    for (const filePath of [...new Set(filePaths)].sort()) releases.push(acquireGameLock(filePath))
  } catch (error) {
    for (const release of releases.reverse()) {
      try { release() } catch { /* 保留原始加锁错误 */ }
    }
    throw error
  }
  try { return action() }
  finally { for (const release of releases.reverse()) release() }
}

/** @param {string} directory */
function assertTransactionDirectory(directory) {
  let stat
  try { stat = lstatSync(directory) } catch (error) { if (errorCode(error) === 'ENOENT') return false; throw error }
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('owner document transaction path is invalid; evidence preserved')
  return true
}

/** @param {string} filePath */
function readTransactionJson(filePath) {
  const raw = readRegularFile(filePath)
  if (raw === null) return null
  const decoded = decodeJson(raw)
  if (!decoded.valid) throw new Error('owner document transaction JSON is invalid; evidence preserved')
  return decoded.value
}

/** @param {string} filePath */
function currentRevision(filePath) {
  const raw = readRegularFile(filePath)
  return raw === null ? 'missing' : sha256(raw)
}

/**
 * 删除已验证事务目录时总把 journal 留到最后：若清理中断，recover 仍能辨别提交状态。
 * @param {string} tx
 * @param {string} filePath
 */
function cleanupTransactionDirectory(tx, filePath) {
  const allowed = new Set([OWNER_MARKER, OLD_BYTES, NEW_BYTES, JOURNAL])
  if (readdirSync(tx).some(name => !allowed.has(name))) {
    throw new Error('owner document transaction contains unknown files; evidence preserved')
  }
  for (const name of [OLD_BYTES, NEW_BYTES, OWNER_MARKER]) {
    const file = join(tx, name)
    if (readRegularFile(file) !== null) unlinkSync(file)
  }
  syncDirectory(tx)
  const journal = join(tx, JOURNAL)
  if (readRegularFile(journal) !== null) unlinkSync(journal)
  syncDirectory(tx)
  if (readdirSync(tx).length !== 0) throw new Error('owner document transaction cleanup is incomplete; evidence preserved')
  rmdirSync(tx)
  syncDirectory(dirname(filePath))
}

/** @param {string} filePath */
function recoverLocked(filePath) {
  const tx = transactionDirectory(filePath)
  if (!assertTransactionDirectory(tx)) return { recovered: false }

  const journalPath = join(tx, JOURNAL)
  const journalRaw = readTransactionJson(journalPath)
  if (journalRaw === null) {
    const ownerRaw = readTransactionJson(join(tx, OWNER_MARKER))
    if (ownerRaw === null) {
      if (readdirSync(tx).length === 0) {
        rmdirSync(tx)
        syncDirectory(dirname(filePath))
        return { recovered: false, emptyPrecommitCleaned: true }
      }
      throw new Error('owner document precommit owner marker missing; evidence preserved')
    }
    const owner = validateOwnerMarker(ownerRaw)
    if (owner.targetPath !== filePath) throw new Error('owner document precommit marker path mismatch; evidence preserved')
    if (currentRevision(filePath) !== owner.expectedRevision) {
      throw new Error('owner document changed before journal publication; evidence preserved')
    }
    cleanupTransactionDirectory(tx, filePath)
    return { recovered: false, precommitCleaned: true }
  }

  const journal = validateJournal(journalRaw)
  if (journal.targetPath !== filePath) throw new Error('owner document journal path mismatch; evidence preserved')

  if (journal.phase === 'committed') {
    const current = inspectOwnerDocumentFile(filePath)
    if (current.kind !== 'owner-document' || current.revision !== journal.newRevision) {
      throw new Error('committed owner document does not match journal; evidence preserved')
    }
    cleanupTransactionDirectory(tx, filePath)
    return { recovered: false, committedCleanup: true }
  }

  const originalRevision = journal.hadExisting ? /** @type {string} */ (journal.oldRevision) : 'missing'
  const current = currentRevision(filePath)
  if (current === originalRevision) {
    const ownerRaw = readTransactionJson(join(tx, OWNER_MARKER))
    if (ownerRaw !== null) {
      const owner = validateOwnerMarker(ownerRaw)
      if (owner.targetPath !== filePath || owner.token !== journal.token || owner.expectedRevision !== originalRevision) {
        throw new Error('owner document journal does not match its owner marker; evidence preserved')
      }
    }
    cleanupTransactionDirectory(tx, filePath)
    return { recovered: true, rolledBack: true }
  }

  const ownerRaw = readTransactionJson(join(tx, OWNER_MARKER))
  if (ownerRaw === null) throw new Error('owner document applying journal is missing its owner marker; evidence preserved')
  const owner = validateOwnerMarker(ownerRaw)
  if (owner.targetPath !== filePath || owner.token !== journal.token || owner.expectedRevision !== originalRevision) {
    throw new Error('owner document journal does not match its owner marker; evidence preserved')
  }
  const newRaw = readRegularFile(join(tx, NEW_BYTES))
  if (newRaw === null || sha256(newRaw) !== journal.newRevision) {
    throw new Error('owner document staged bytes are invalid; evidence preserved')
  }
  const stagedInspection = inspectBytes(newRaw)
  if (stagedInspection.kind !== 'owner-document') throw new Error('owner document staged bytes failed validation; evidence preserved')

  if (journal.hadExisting) {
    const oldRaw = readRegularFile(join(tx, OLD_BYTES))
    if (oldRaw === null || sha256(oldRaw) !== journal.oldRevision) {
      throw new Error('owner document rollback snapshot is invalid; evidence preserved')
    }
    if (inspectBytes(oldRaw).kind !== 'owner-document') {
      throw new Error('owner document rollback snapshot failed codec validation; evidence preserved')
    }
    if (current !== journal.oldRevision && current !== journal.newRevision && current !== 'missing') {
      throw new Error('owner document changed during transaction; evidence preserved')
    }
    if (current !== journal.oldRevision) atomicWrite(filePath, oldRaw)
    const restored = inspectOwnerDocumentFile(filePath)
    if (restored.kind !== 'owner-document' || restored.revision !== journal.oldRevision) {
      throw new Error('owner document rollback readback failed; evidence preserved')
    }
  } else {
    if (current === journal.newRevision) {
      unlinkSync(filePath)
      syncDirectory(dirname(filePath))
    } else if (current !== 'missing') {
      throw new Error('unexpected owner document exists during create rollback; evidence preserved')
    }
  }
  cleanupTransactionDirectory(tx, filePath)
  return { recovered: true, rolledBack: true }
}

/**
 * Recover the deterministic transaction directory while the target lock is held.
 * @param {string} filePath
 */
function recoverBeforeWrite(filePath) {
  return recoverLocked(filePath)
}

/** @param {string} filePath @param {Buffer} newBytes @param {string} expectedRevision @returns {WriteResult} */
function commitLocked(filePath, newBytes, expectedRevision) {
  recoverBeforeWrite(filePath)
  const current = inspectOwnerDocumentFile(filePath)
  assertPlainTarget(current)
  assertExpectedRevision(current, expectedRevision)
  const previousRaw = current.kind === 'owner-document' ? readRegularFile(filePath) : null
  const nextInspection = inspectBytes(newBytes)
  if (nextInspection.kind !== 'owner-document') throw new Error('owner document payload failed validation')
  if (current.kind === 'owner-document') assertStableIdentity(current.document, nextInspection.document)

  const tx = transactionDirectory(filePath)
  mkdirSync(tx, { recursive: false, mode: 0o700 })
  syncDirectory(dirname(filePath))
  const token = randomBytes(16).toString('hex')
  const marker = {
    version: 1,
    targetPath: filePath,
    token,
    expectedRevision,
  }
  const newRevision = sha256(newBytes)
  const oldRevision = previousRaw === null ? null : sha256(previousRaw)

  try {
    atomicWrite(join(tx, OWNER_MARKER), Buffer.from(JSON.stringify(marker)))
    if (previousRaw !== null) atomicWrite(join(tx, OLD_BYTES), previousRaw)
    atomicWrite(join(tx, NEW_BYTES), newBytes)
    const journal = {
      version: 1,
      phase: 'applying',
      targetPath: filePath,
      token,
      hadExisting: previousRaw !== null,
      oldRevision,
      newRevision,
    }
    atomicWrite(join(tx, JOURNAL), Buffer.from(JSON.stringify(journal)))
    atomicWrite(filePath, newBytes)
    const readback = inspectOwnerDocumentFile(filePath)
    if (readback.kind !== 'owner-document' || readback.revision !== newRevision) {
      throw new Error('owner document write readback failed')
    }
    atomicWrite(join(tx, JOURNAL), Buffer.from(JSON.stringify({ ...journal, phase: 'committed' })))
    try {
      cleanupTransactionDirectory(tx, filePath)
      return { document: readback.document, revision: readback.revision, cleanupDeferred: false }
    } catch {
      return { document: readback.document, revision: readback.revision, cleanupDeferred: true }
    }
  } catch (error) {
    try {
      const recovered = recoverLocked(filePath)
      if (recovered.committedCleanup) {
        const readback = inspectOwnerDocumentFile(filePath)
        if (readback.kind === 'owner-document' && readback.revision === newRevision) {
          return { document: readback.document, revision: readback.revision, cleanupDeferred: false }
        }
      }
    } catch (recoveryError) {
      if (error instanceof Error) {
        /** @type {Error & {recoveryError?: unknown}} */ (error).recoveryError = recoveryError
      }
    }
    throw error
  }
}

/**
 * 在排他锁和 revision CAS 下创建/更新 owner document。
 * @param {{filePath:string, document:unknown, expectedRevision:string}} options
 */
export function writeOwnerDocumentFile({ filePath, document, expectedRevision }) {
  const validated = validateOwnerDocument(document)
  if (!(expectedRevision === 'missing' || (typeof expectedRevision === 'string' && HASH_PATTERN.test(expectedRevision)))) {
    throw new TypeError('expectedRevision must be missing or a sha256 digest')
  }
  const absolute = canonicalFilePath(filePath, true)
  return withLocks([absolute], () => {
    const bytes = Buffer.from(serializeOwnerDocument(validated), 'utf8')
    return commitLocked(absolute, bytes, expectedRevision)
  })
}

/**
 * 从显式 v15 源文件写入独立 OwnerDocument 路径；旧源只读，不自动接入运行时。
 * @param {{legacyPath:string, ownerDocumentPath:string, ownerId:string, pigId:string, expectedLegacySha256:string, nowMs:number}} options
 */
export function migrateLegacyV15File({ legacyPath, ownerDocumentPath, ownerId, pigId, expectedLegacySha256, nowMs }) {
  if (!HASH_PATTERN.test(expectedLegacySha256)) throw new TypeError('expectedLegacySha256 must be a sha256 digest')
  if (!Number.isFinite(nowMs)) throw new TypeError('nowMs must be finite')
  const source = canonicalFilePath(legacyPath)
  const target = canonicalFilePath(ownerDocumentPath, true)
  if (source === target) throw new Error('legacy source and owner document target must be separate paths')

  return withLocks([source, target], () => {
    recoverBeforeWrite(target)
    const targetStatus = inspectOwnerDocumentFile(target)
    if (targetStatus.kind !== 'missing') throw new Error('owner document migration target already exists')
    const sourceStatus = inspectOwnerDocumentFile(source)
    if (sourceStatus.kind !== 'legacy-v15') throw new Error('legacy source is not a readable v15 save')
    if (sourceStatus.revision !== expectedLegacySha256) throw new Error('legacy source revision conflict')
    const normalized = migrate(structuredClone(sourceStatus.legacyState), nowMs)
    if (!isPlainRecord(normalized) || normalized.version !== STATE_VERSION) {
      throw new Error('legacy v15 source could not be normalized')
    }
    const document = ownerDocumentFromLegacyV15(normalized, { ownerId, pigId })
    const bytes = Buffer.from(serializeOwnerDocument(document), 'utf8')
    const sourceBeforeCommit = inspectOwnerDocumentFile(source)
    if (sourceBeforeCommit.kind !== 'legacy-v15' || sourceBeforeCommit.revision !== sourceStatus.revision) {
      throw new Error('legacy source changed during migration')
    }
    return commitLocked(target, bytes, 'missing')
  })
}

/**
 * 显式恢复 owner document 单文件事务；本函数不由生产 runtime 自动调用。
 * @param {string} ownerDocumentPath
 */
export function recoverOwnerDocumentTransaction(ownerDocumentPath) {
  const absolute = canonicalFilePath(ownerDocumentPath, true)
  return withLocks([absolute], () => recoverLocked(absolute))
}
