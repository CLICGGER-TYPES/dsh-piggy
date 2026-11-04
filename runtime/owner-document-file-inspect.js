// @ts-check
/**
 * 显式 owner document 的读取与校验层：版本识别、事务记录形状、revision/身份断言和字节检查。
 * 这一层只读不写：不加锁、不建目录、不落盘；写入与恢复在 owner-document-file-transaction.js，
 * 依赖方向单向（transaction -> inspect），公共入口仍是 owner-document-file.js。
 * @module dsh-piggy/runtime/owner-document-file-inspect
 */
import { createHash } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { TextDecoder } from 'node:util'

import { STATE_VERSION } from '../core.js'
import { OWNER_DOCUMENT_VERSION, validateOwnerDocument } from '../store/owner-document.js'

export const HASH_PATTERN = /^[a-f0-9]{64}$/
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
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** @param {Buffer} bytes */
export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/** @param {unknown} error */
export function errorCode(error) {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}

/** @param {string} filePath @param {boolean} createParent */
export function canonicalFilePath(filePath, createParent = false) {
  if (typeof filePath !== 'string' || filePath.trim() === '') throw new TypeError('owner document path is required')
  const absolute = resolve(filePath)
  const parent = dirname(absolute)
  if (createParent) mkdirSync(parent, { recursive: true, mode: 0o700 })
  const realParent = realpathSync(parent)
  return join(realParent, basename(absolute))
}

/** @param {string} filePath */
export function readRegularFile(filePath) {
  let stat
  try { stat = lstatSync(filePath) } catch (error) { if (errorCode(error) === 'ENOENT') return null; throw error }
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('owner document path is not a regular file')
  return readFileSync(filePath)
}

/** @param {Buffer} bytes */
export function decodeJson(bytes) {
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
export function validateOwnerMarker(value) {
  if (!hasExactShape(value, OWNER_KEYS) || value.version !== 1 || typeof value.targetPath !== 'string' ||
    typeof value.token !== 'string' || !TOKEN_PATTERN.test(value.token) ||
    !(value.expectedRevision === 'missing' || (typeof value.expectedRevision === 'string' && HASH_PATTERN.test(value.expectedRevision)))) {
    throw new Error('owner document precommit marker is invalid; evidence preserved')
  }
  return /** @type {OwnerMarker} */ (value)
}

/** @param {unknown} value */
export function validateJournal(value) {
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

/** @param {Buffer} raw */
export function inspectBytes(raw) {
  const decoded = decodeJson(raw)
  if (!decoded.valid || !isPlainRecord(decoded.value)) return { kind: 'invalid-json' }
  if (decoded.value.documentVersion !== OWNER_DOCUMENT_VERSION) return { kind: 'unknown-format' }
  try { return { kind: 'owner-document', document: validateOwnerDocument(decoded.value) } }
  catch { return { kind: 'invalid-document' } }
}

/** @param {OwnerFileInspection} current @param {string} expectedRevision */
export function assertExpectedRevision(current, expectedRevision) {
  if (expectedRevision === 'missing') {
    if (current.kind !== 'missing') throw new Error('owner document creation conflict')
    return
  }
  if (!HASH_PATTERN.test(expectedRevision) || current.kind !== 'owner-document' || current.revision !== expectedRevision) {
    throw new Error('owner document revision conflict')
  }
}

/** @param {ReturnType<typeof validateOwnerDocument>} previous @param {ReturnType<typeof validateOwnerDocument>} next */
export function assertStableIdentity(previous, next) {
  if (previous.ownerId !== next.ownerId) throw new Error('ownerId is immutable after document creation')
  const nextIds = new Set(next.pigs.map(pig => pig.pigId))
  if (previous.pigs.some(pig => !nextIds.has(pig.pigId))) {
    throw new Error('existing pigId cannot be removed or reassigned in this storage slice')
  }
}

/** @param {OwnerFileInspection} value */
export function assertPlainTarget(value) {
  if (value.kind !== 'missing' && value.kind !== 'owner-document') {
    throw new Error('owner document target is not a writable owner document')
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

