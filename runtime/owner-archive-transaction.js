// @ts-check
/** Owner archive 的 staging + 同文件系统目录发布；owner JSON 写入复用 D02 CAS/WAL。 */
import { createHash } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'

import { validateOwnerDocument } from '../store/owner-document.js'
import { acquireGameLock } from './owner-lock.js'
import { inspectOwnerDocumentFile, recoverOwnerDocumentTransaction, writeOwnerDocumentFile } from './owner-document-file.js'
import { syncDirectory, writeWorkJson } from './work-files.js'

const JOURNAL = 'journal.json'
const STAGE = 'stage-root'
const DIGEST = /^[a-f0-9]{64}$/
const RELATIVE_PATH = value => typeof value === 'string' && value !== '' && !value.startsWith('/') && !value.includes('\\')
  && value.split('/').every(part => part !== '' && part !== '.' && part !== '..')

/** @param {Buffer|string} value */
function sha256(value) { return createHash('sha256').update(value).digest('hex') }

/** @param {string} filePath */
function locate(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '' || !isAbsolute(filePath)) {
    throw new TypeError('owner archive target path must be absolute')
  }
  const absolute = resolve(filePath), rootInput = dirname(absolute), parentInput = dirname(rootInput)
  const parentStat = lstatSync(parentInput)
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('owner archive target parent must be a real directory')
  const parent = realpathSync(parentInput), root = join(parent, basename(rootInput)), documentPath = join(root, basename(absolute))
  const key = sha256(Buffer.from(root)).slice(0, 32)
  return { parent, root, documentPath, stagePath: join(parent, `.owner-archive-import-${key}`), lockPath: join(parent, `.owner-archive-lock-${key}`) }
}

/** @param {string} path */
function lstatOrNull(path) {
  try { return lstatSync(path) } catch (error) { if (error?.code === 'ENOENT') return null; throw error }
}

/** @param {unknown} value */
function validateJournal(value) {
  const keys = ['archiveSha256', 'documentName', 'files', 'ownerId', 'phase', 'pigIds', 'targetRoot', 'version']
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) {
    throw new Error('owner archive transaction journal is invalid; evidence preserved')
  }
  const journal = /** @type {Record<string, unknown>} */ (value)
  if (journal.version !== 1 || !['staging', 'ready', 'committed'].includes(String(journal.phase)) ||
      typeof journal.targetRoot !== 'string' || typeof journal.documentName !== 'string' || typeof journal.ownerId !== 'string' ||
      journal.documentName === '' || basename(journal.documentName) !== journal.documentName ||
      typeof journal.archiveSha256 !== 'string' || !DIGEST.test(journal.archiveSha256) ||
      !Array.isArray(journal.pigIds) || journal.pigIds.some(id => typeof id !== 'string') || !Array.isArray(journal.files)) {
    throw new Error('owner archive transaction journal is invalid; evidence preserved')
  }
  const seen = new Set()
  for (const rawEntry of journal.files) {
    if (rawEntry === null || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      throw new Error('owner archive transaction member is invalid; evidence preserved')
    }
    const entry = /** @type {Record<string, unknown>} */ (rawEntry)
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry) ||
        Object.keys(entry).sort().join(',') !== 'path,sha256,size' || typeof entry.path !== 'string' || !RELATIVE_PATH(entry.path) ||
        typeof entry.size !== 'number' || !Number.isSafeInteger(entry.size) || entry.size < 0 || typeof entry.sha256 !== 'string' ||
        !DIGEST.test(entry.sha256) || seen.has(entry.path)) {
      throw new Error('owner archive transaction member is invalid; evidence preserved')
    }
    seen.add(entry.path)
  }
  if (!seen.has(journal.documentName) || journal.files.length === 0) throw new Error('owner archive transaction document is missing; evidence preserved')
  return /** @type {{archiveSha256:string,documentName:string,files:{path:string,size:number,sha256:string}[],ownerId:string,phase:'staging'|'ready'|'committed',pigIds:string[],targetRoot:string,version:1}} */ (value)
}

/** @param {string} root @param {Set<string>} expected */
function assertKnownTree(root, expected) {
  const rootStat = lstatOrNull(root)
  if (rootStat === null) return
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('owner archive staging root is unsafe; evidence preserved')
  const walk = (directory, prefix = '') => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name), relative = prefix === '' ? name : `${prefix}/${name}`, stat = lstatSync(path)
      if (stat.isSymbolicLink()) throw new Error('owner archive staging contains a symlink; evidence preserved')
      if (stat.isDirectory()) {
        if (![...expected].some(file => file.startsWith(relative + '/'))) throw new Error('owner archive staging contains an unknown directory; evidence preserved')
        walk(path, relative)
      } else if (!stat.isFile() || !expected.has(relative)) {
        throw new Error('owner archive staging contains an unknown file; evidence preserved')
      }
    }
  }
  walk(root)
}

/** @param {string} path @param {Buffer} bytes */
function writePrivateFile(path, bytes) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const descriptor = openSync(path, 'wx', 0o600)
  try { writeFileSync(descriptor, bytes); fsyncSync(descriptor) } finally { closeSync(descriptor) }
  syncDirectory(dirname(path))
}

/** @param {string} root @param {ReturnType<typeof validateJournal>} journal */
function publishedTreeMatches(root, journal) {
  const rootStat = lstatOrNull(root)
  if (rootStat === null || !rootStat.isDirectory() || rootStat.isSymbolicLink()) return false
  assertKnownTree(root, new Set(journal.files.map(entry => entry.path)))
  for (const entry of journal.files) {
    const path = join(root, ...entry.path.split('/')), stat = lstatOrNull(path)
    if (stat === null || !stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.size || sha256(readFileSync(path)) !== entry.sha256) return false
  }
  const status = inspectOwnerDocumentFile(join(root, journal.documentName))
  return status.kind === 'owner-document' && status.document.ownerId === journal.ownerId &&
    status.document.pigs.map(pig => pig.pigId).join('\0') === journal.pigIds.join('\0')
}

function cleanupTransaction(paths) {
  const entries = readdirSync(paths.stagePath)
  if (entries.some(name => name !== JOURNAL && name !== STAGE)) throw new Error('owner archive transaction contains unknown entries; evidence preserved')
  const stageRoot = join(paths.stagePath, STAGE), stageStat = lstatOrNull(stageRoot)
  if (stageStat !== null) {
    if (!stageStat.isDirectory() || stageStat.isSymbolicLink()) throw new Error('owner archive staging root is unsafe; evidence preserved')
    rmSync(stageRoot, { recursive: true })
    syncDirectory(paths.stagePath)
  }
  const journalPath = join(paths.stagePath, JOURNAL), journalStat = lstatOrNull(journalPath)
  if (journalStat !== null) {
    if (!journalStat.isFile() || journalStat.isSymbolicLink()) throw new Error('owner archive journal path is unsafe; evidence preserved')
    unlinkSync(journalPath)
    syncDirectory(paths.stagePath)
  }
  if (readdirSync(paths.stagePath).length !== 0) throw new Error('owner archive transaction cleanup is incomplete; evidence preserved')
  rmdirSync(paths.stagePath)
  syncDirectory(paths.parent)
}

/** @param {ReturnType<typeof locate>} paths */
function recoverLocked(paths) {
  const txStat = lstatOrNull(paths.stagePath)
  if (txStat === null) return { recovered: false }
  if (!txStat.isDirectory() || txStat.isSymbolicLink()) throw new Error('owner archive transaction path is unsafe; evidence preserved')
  const contents = readdirSync(paths.stagePath)
  if (!contents.includes(JOURNAL)) {
    if (contents.length === 0) {
      rmSync(paths.stagePath, { recursive: true })
      syncDirectory(paths.parent)
      return { recovered: true, rolledBack: true, emptyPrecommitCleaned: true }
    }
    throw new Error('owner archive transaction journal missing; evidence preserved')
  }
  const journal = validateJournal(JSON.parse(readFileSync(join(paths.stagePath, JOURNAL), 'utf8')))
  if (journal.targetRoot !== paths.root || journal.documentName !== basename(paths.documentPath)) {
    throw new Error('owner archive transaction path mismatch; evidence preserved')
  }
  const stageRoot = join(paths.stagePath, STAGE)
  if (lstatOrNull(paths.root) !== null) {
    if (lstatOrNull(stageRoot) !== null || !publishedTreeMatches(paths.root, journal)) {
      throw new Error('owner archive published target conflicts with transaction; evidence preserved')
    }
    cleanupTransaction(paths)
    return { recovered: true, committedCleanup: true }
  }
  if (journal.phase === 'committed') throw new Error('committed owner archive target is missing; evidence preserved')
  if (lstatOrNull(stageRoot) !== null) {
    const expected = new Set(journal.files.map(entry => entry.path))
    const stagedDocumentPath = join(stageRoot, journal.documentName)
    if (lstatOrNull(stagedDocumentPath) !== null) recoverOwnerDocumentTransaction(stagedDocumentPath)
    assertKnownTree(stageRoot, expected)
  }
  cleanupTransaction(paths)
  return { recovered: true, rolledBack: true }
}

/** Explicit pre-runtime recovery. Staged-but-unpublished imports roll back; published imports only clean their journal. */
export function recoverOwnerArchiveImport(ownerDocumentPath) {
  const paths = locate(ownerDocumentPath), release = acquireGameLock(paths.lockPath)
  try { return recoverLocked(paths) } finally { release() }
}

/** @param {{ownerDocumentPath:string,document:unknown,sidecars:Map<string,Buffer>,archiveSha256:string,ownerId:string,pigIds:string[]}} input */
function stageLocked(input, paths) {
  const document = validateOwnerDocument(input.document)
  if (document.ownerId !== input.ownerId || document.pigs.map(pig => pig.pigId).join('\0') !== input.pigIds.join('\0')) {
    throw new Error('owner archive transaction identity mismatch')
  }
  if (!DIGEST.test(input.archiveSha256)) throw new TypeError('owner archive sha256 is invalid')
  if (lstatOrNull(paths.root) !== null) throw new Error('owner archive import target directory already exists')
  if (lstatOrNull(paths.stagePath) !== null) throw new Error('owner archive import transaction is still pending')
  const documentName = basename(paths.documentPath), documentBytes = Buffer.from(JSON.stringify(document))
  const files = new Map([[documentName, documentBytes]])
  for (const [path, bytes] of input.sidecars) {
    if (!Buffer.isBuffer(bytes) || !RELATIVE_PATH(path) || files.has(path)) throw new Error('owner archive sidecar path is invalid')
    files.set(path, Buffer.from(bytes))
  }
  const records = [...files].map(([path, bytes]) => ({ path, size: bytes.length, sha256: sha256(bytes) }))
  mkdirSync(paths.stagePath, { mode: 0o700 })
  syncDirectory(paths.parent)
  const journal = { version: 1, phase: 'staging', targetRoot: paths.root, documentName, archiveSha256: input.archiveSha256,
    ownerId: input.ownerId, pigIds: [...input.pigIds], files: records }
  writeWorkJson(join(paths.stagePath, JOURNAL), journal)
  const stageRoot = join(paths.stagePath, STAGE)
  mkdirSync(stageRoot, { mode: 0o700 })
  const stagedDocumentPath = join(stageRoot, documentName)
  const writeResult = writeOwnerDocumentFile({ filePath: stagedDocumentPath, document, expectedRevision: 'missing' })
  const recovered = recoverOwnerDocumentTransaction(stagedDocumentPath)
  if (writeResult.cleanupDeferred && recovered.committedCleanup !== true) throw new Error('owner document staging cleanup is deferred')
  if (writeResult.revision !== sha256(documentBytes)) throw new Error('owner document staging readback mismatch')
  for (const [path, bytes] of files) if (path !== documentName) writePrivateFile(join(stageRoot, ...path.split('/')), bytes)
  assertKnownTree(stageRoot, new Set(records.map(entry => entry.path)))
  writeWorkJson(join(paths.stagePath, JOURNAL), { ...journal, phase: 'ready' })
  syncDirectory(stageRoot)
  return { document, revision: writeResult.revision }
}

function publishLocked(paths) {
  const journal = validateJournal(JSON.parse(readFileSync(join(paths.stagePath, JOURNAL), 'utf8')))
  if (journal.phase !== 'ready' || journal.targetRoot !== paths.root || journal.documentName !== basename(paths.documentPath)) {
    throw new Error('owner archive import is not ready to publish')
  }
  if (lstatOrNull(paths.root) !== null) throw new Error('owner archive import target directory appeared before commit')
  const stageRoot = join(paths.stagePath, STAGE)
  renameSync(stageRoot, paths.root)
  syncDirectory(paths.parent)
  writeWorkJson(join(paths.stagePath, JOURNAL), { ...journal, phase: 'committed' })
  try { cleanupTransaction(paths); return { cleanupDeferred: false } }
  catch { return { cleanupDeferred: true } }
}

/** Prepare and atomically publish a new owner root. Existing roots are never replaced. */
export function createArchiveImportTransaction(input) {
  const paths = locate(input.ownerDocumentPath), release = acquireGameLock(paths.lockPath)
  try {
    const prior = recoverLocked(paths)
    if (prior.committedCleanup) throw new Error('owner archive import already committed; reopen the target owner')
    let prepared
    try { prepared = stageLocked(input, paths) }
    catch (error) {
      try { recoverLocked(paths) }
      catch (recoveryError) { if (error instanceof Error) /** @type {Error & {recoveryError?:unknown}} */ (error).recoveryError = recoveryError }
      throw error
    }
    try {
      const published = publishLocked(paths)
      return { ...prepared, cleanupDeferred: published.cleanupDeferred }
    } catch (error) {
      const recovered = recoverLocked(paths)
      if (recovered.committedCleanup) {
        return { ...prepared, cleanupDeferred: false }
      }
      throw error
    }
  } finally { release() }
}

/** @internal Test contract: leave a ready staging transaction to exercise deterministic recovery. */
export function stageArchiveImportTransactionForRecovery(input) {
  const paths = locate(input.ownerDocumentPath), release = acquireGameLock(paths.lockPath)
  try {
    recoverLocked(paths)
    return stageLocked(input, paths)
  } finally { release() }
}
