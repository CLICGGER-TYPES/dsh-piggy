// @ts-check
/**
 * 显式 owner document 文件层：版本识别、revision CAS、排他锁和可恢复单文件事务。
 * 本模块只供调用者显式使用，不接入 runtime/store/routes 启动。
 * @module dsh-piggy/runtime/owner-document-file
 */
import { createHash, randomBytes } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmdirSync, unlinkSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { TextDecoder } from 'node:util'

import { migrate, STATE_VERSION } from '../core.js'
import { ownerDocumentFromLegacyV15, OWNER_DOCUMENT_VERSION, serializeOwnerDocument, validateOwnerDocument } from '../store/owner-document.js'
import { acquireGameLock } from './owner-lock.js'
import { atomicWrite } from './merge-transaction.js'
import { syncDirectory } from './work-files.js'

const TX_PREFIX = '.owner-document-tx-'
const OWNER_MARKER = 'owner.json'
const JOURNAL = 'journal.json'
const OLD_BYTES = 'old.bin'
const NEW_BYTES = 'new.bin'
const HASH_PATTERN = /^[a-f0-9]{64}$/
const TOKEN_PATTERN = /^[a-f0-9]{32}$/
const OWNER_KEYS = new Set(['version', 'targetPath', 'token', 'expectedRevision'])
const JOURNAL_KEYS = new Set(['version', 'phase', 'targetPath', 'token', 'hadExisting', 'oldRevision', 'newRevision'])

/**
 * @typedef {{kind:'missing'}} MissingFile
 * @typedef {{kind:'owner-document', revision:string, document:import('../store/owner-document.js').OwnerDocument}} OwnerFile
 * @typedef {{kind:'legacy-v15', revision:string, legacyState:Record<string, unknown>}} LegacyFile
 * @typedef {{kind:'invalid-json'|'invalid-document', revision:string, reason?:string}} InvalidFile
 * @typedef {{kind:'unsupported-version', revision:string, version:unknown}} UnsupportedFile
 * @typedef {{kind:'unknown-format', revision:string}} UnknownFile
 * @typedef {{kind:'io-error', code?:string}} IoError
 * @typedef {MissingFile|OwnerFile|LegacyFile|InvalidFile|UnsupportedFile|UnknownFile|IoError} OwnerFileInspection
 * @typedef {{kind:'missing'|'sha256', value?:string}} ExpectedRevision
 * @typedef {{version:1, targetPath:string, token:string, expectedRevision:'missing'|string}} OwnerMarker
 * @typedef {{version:1, phase:'applying'|'committed', targetPath:string, token:string, hadExisting:boolean, oldRevision:string|null, newRevision:string}} TransactionJournal
 * @typedef {{document:import('../store/owner-document.js').OwnerDocument, revision:string, cleanupDeferred:boolean}} WriteResult
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** @param {Buffer} bytes */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** @param {unknown} error */
function errorCode(error) {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}

/** @param {string} filePath @param {boolean} createParent */
function canonicalFilePath(filePath, createParent = false) {
  if (typeof filePath !== 'string' || filePath.trim() === '') throw new TypeError('owner document path is required')
  const absolute = resolve(filePath)
  const parent = dirname(absolute)
  if (createParent) mkdirSync(parent, { recursive: true, mode: 0o700 })
  const realParent = realpathSync(parent)
  return join(realParent, basename(absolute))
}

/** @param {string} filePath */
function transactionDirectory(filePath) {
  const identity = createHash('sha256').update(filePath).digest('hex')
  return join(dirname(filePath), `${TX_PREFIX}${identity}`)
}

/** @param {string} filePath */
function readRegularFile(filePath) {
  let stat
  try { stat = lstatSync(filePath) } catch (error) { if (errorCode(error) === 'ENOENT') return null; throw error }
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('owner document path is not a regular file')
  return readFileSync(filePath)
}

/** @param {Buffer} bytes */
function decodeJson(bytes) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { text, value: JSON.parse(text), valid: true }
  } catch {
    return { text: null, value: null, valid: false }
  }
}

/** @param {unknown} value @param {Set<string>} allowed @returns {value is Record<string, unknown>} */
function hasExactShape(value, allowed) {
  if (!isPlainRecord(value)) return false
  const keys = Object.keys(value)
  return keys.length === allowed.size && keys.every(key => allowed.has(key))
}

/** @param {unknown} value */
function validateOwnerMarker(value) {
  if (!hasExactShape(value, OWNER_KEYS) || value.version !== 1 || typeof value.targetPath !== 'string' ||
    typeof value.token !== 'string' || !TOKEN_PATTERN.test(value.token) ||
    !(value.expectedRevision === 'missing' || (typeof value.expectedRevision === 'string' && HASH_PATTERN.test(value.expectedRevision)))) {
    throw new Error('owner document precommit marker is invalid; evidence preserved')
  }
  return /** @type {OwnerMarker} */ (value)
}

/** @param {unknown} value */
function validateJournal(value) {
  if (!hasExactShape(value, JOURNAL_KEYS) || value.version !== 1 ||
    (value.phase !== 'applying' && value.phase !== 'committed') || typeof value.targetPath !== 'string' ||
    typeof value.token !== 'string' || !TOKEN_PATTERN.test(value.token) || typeof value.hadExisting !== 'boolean' ||
    !(value.oldRevision === null || (typeof value.oldRevision === 'string' && HASH_PATTERN.test(value.oldRevision))) ||
    typeof value.newRevision !== 'string' || !HASH_PATTERN.test(value.newRevision) ||
    value.hadExisting !== (value.oldRevision !== null)) {
    throw new Error('owner document journal is invalid; evidence preserved')
  }
  return /** @type {TransactionJournal} */ (value)
}

/**
 * @param {string} filePath
 * @returns {OwnerFileInspection}
 */
export function inspectOwnerDocumentFile(filePath) {
  let absolute
  try { absolute = canonicalFilePath(filePath) }
  catch (error) {
    if (errorCode(error) === 'ENOENT') return { kind: 'missing' }
    return { kind: 'io-error', code: errorCode(error) }
  }

  let raw
  try { raw = readRegularFile(absolute) }
  catch (error) { return { kind: 'io-error', code: errorCode(error) } }
  if (raw === null) return { kind: 'missing' }
  const revision = sha256(raw)
  const decoded = decodeJson(raw)
  if (!decoded.valid) return { kind: 'invalid-json', revision }
  if (!isPlainRecord(decoded.value)) return { kind: 'unknown-format', revision }

  // v15 允许把未知顶层字段留在 opaque；version===15 的扁平档优先于同名 opaque 键。
  if (decoded.value.version === STATE_VERSION) {
    return { kind: 'legacy-v15', revision, legacyState: /** @type {Record<string, unknown>} */ (structuredClone(decoded.value)) }
  }

  if (Object.hasOwn(decoded.value, 'documentVersion')) {
    if (decoded.value.documentVersion !== OWNER_DOCUMENT_VERSION) {
      return { kind: 'unsupported-version', revision, version: decoded.value.documentVersion }
    }
    try {
      return { kind: 'owner-document', revision, document: validateOwnerDocument(decoded.value) }
    } catch (error) {
      return { kind: 'invalid-document', revision, reason: error instanceof Error ? error.message : 'invalid owner document' }
    }
  }
  if (typeof decoded.value.version === 'number') {
    return { kind: 'unsupported-version', revision, version: decoded.value.version }
  }
  return { kind: 'unknown-format', revision }
}

/** @param {OwnerFileInspection} current @param {string} expectedRevision */
function assertExpectedRevision(current, expectedRevision) {
  if (expectedRevision === 'missing') {
    if (current.kind !== 'missing') throw new Error('owner document creation conflict')
    return
  }
  if (!HASH_PATTERN.test(expectedRevision) || current.kind !== 'owner-document' || current.revision !== expectedRevision) {
    throw new Error('owner document revision conflict')
  }
}

/** @param {ReturnType<typeof validateOwnerDocument>} previous @param {ReturnType<typeof validateOwnerDocument>} next */
function assertStableIdentity(previous, next) {
  if (previous.ownerId !== next.ownerId) throw new Error('ownerId is immutable after document creation')
  const nextIds = new Set(next.pigs.map(pig => pig.pigId))
  if (previous.pigs.some(pig => !nextIds.has(pig.pigId))) {
    throw new Error('existing pigId cannot be removed or reassigned in this storage slice')
  }
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

/** @param {Buffer} raw */
function inspectBytes(raw) {
  const decoded = decodeJson(raw)
  if (!decoded.valid || !isPlainRecord(decoded.value)) return { kind: 'invalid-json' }
  if (decoded.value.documentVersion !== OWNER_DOCUMENT_VERSION) return { kind: 'unknown-format' }
  try { return { kind: 'owner-document', document: validateOwnerDocument(decoded.value) } }
  catch { return { kind: 'invalid-document' } }
}

/** @param {OwnerFileInspection} value */
function assertPlainTarget(value) {
  if (value.kind !== 'missing' && value.kind !== 'owner-document') {
    throw new Error('owner document target is not a writable owner document')
  }
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
 * 显式读取 owner document 或旧 v15 状态；无效文件不会被折算为空档。
 * @param {string} filePath
 * @returns {OwnerFileInspection}
 */
export function readOwnerDocumentFile(filePath) {
  return inspectOwnerDocumentFile(filePath)
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
