// @ts-check
/**
 * 显式 owner document ZIP 导出、导入预检和新 owner 根恢复服务；不接生产路由。
 * 清单/收据/文件校验在 owner-document-archive-manifest.js，本文件只保留 export/import/preview/事务流程；
 * 依赖单向（archive -> manifest），公共导出与返回形状不变。
 */
import { createHash, randomUUID } from 'node:crypto'
import { lstatSync, readdirSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'

import { projectOwnerDocumentToLegacyV15, serializeOwnerDocument } from '../store/owner-document.js'
import { PACKAGE_VERSION } from '../snapshot.js'
import {
  ID_PATTERN, OWNER_ARCHIVE_FORMAT, OWNER_ARCHIVE_MANIFEST, OWNER_ARCHIVE_VERSION, OWNER_DOCUMENT_ENTRY,
  OWNER_RECEIPTS_ENTRY, allowedSidecar, assertOwnerReferences, isRecord, parseLegacyArchive, parseOwnerArchive,
  validateOwnerReceipts,
} from './owner-document-archive-manifest.js'
import { createArchiveImportTransaction, recoverOwnerArchiveImport } from './owner-archive-transaction.js'
import { inspectOwnerDocumentFile, recoverOwnerDocumentTransaction } from './owner-document-file.js'
import { acquireGameLock } from './owner-lock.js'
import { createSaveArchive } from './save-archive.js'
import { makeZip, readZip } from './save-zip.js'
import { readWorkJson } from './work-files.js'

export { OWNER_ARCHIVE_FORMAT, OWNER_ARCHIVE_VERSION, OWNER_ARCHIVE_MANIFEST, OWNER_DOCUMENT_ENTRY, OWNER_RECEIPTS_ENTRY }

const PREVIEW_TTL_MS = 10 * 60 * 1000

/** @param {Buffer|string} value */
function sha256(value) { return createHash('sha256').update(value).digest('hex') }

/** @template T @param {string[]} paths @param {() => T} action @returns {T} */
function withArchiveLocks(paths, action) {
  const releases = []
  try {
    for (const path of new Set(paths)) releases.push(acquireGameLock(path))
  } catch (error) {
    for (const release of releases.reverse()) {
      try { release() } catch { /* preserve the original lock error */ }
    }
    throw error
  }
  try { return action() }
  finally { for (const release of releases.reverse()) release() }
}

/** @param {string} ownerDocumentPath */
function existingOwnerPath(ownerDocumentPath) {
  if (typeof ownerDocumentPath !== 'string' || !isAbsolute(ownerDocumentPath)) throw new TypeError('ownerDocumentPath must be absolute')
  const absolute = resolve(ownerDocumentPath)
  const parent = realpathSync(dirname(absolute))
  return join(parent, basename(absolute))
}

/** @param {import('../store/owner-document.js').OwnerDocument} document */
function ownerArchiveSummary(document) {
  const pigs = document.pigs.slice(0, 20).map((pig, index) => {
    const state = pig.body
    return {
      label: `小猪 ${index + 1}`,
      name: typeof state.name === 'string' ? state.name.slice(0, 40) : '未命名',
      ageMs: Number.isFinite(state.ageMs) ? state.ageMs : null,
      xp: Number.isFinite(state.xp) ? state.xp : null,
      weightG: Number.isFinite(state.weightG) ? state.weightG : null,
      wornCount: Array.isArray(state.worn) ? state.worn.length : 0,
    }
  })
  const resources = document.resources
  const hasInventory = isRecord(resources.inventory)
  const inventory = hasInventory ? Object.values(resources.inventory) : []
  const inventoryCount = hasInventory ? inventory.reduce((total, value) => total +
    (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0), 0) : null
  const extData = isRecord(resources.extData) ? resources.extData : null
  const farm = extData !== null && isRecord(extData.farm) ? extData.farm : null
  const plots = farm !== null && Array.isArray(farm.plots) ? farm.plots : []
  const planted = plots.reduce((total, plot) => total +
    (isRecord(plot) && typeof plot.crop === 'string' ? 1 : 0), 0)
  return {
    pigCount: document.pigs.length,
    pigs,
    shared: {
      coins: typeof resources.coins === 'number' && Number.isFinite(resources.coins) ? resources.coins : null,
      inventoryCount,
      garden: farm === null ? null : {
        experience: typeof farm.exp === 'number' && Number.isFinite(farm.exp) ? farm.exp : null,
        unlocked: typeof farm.unlocked === 'number' && Number.isSafeInteger(farm.unlocked) ? farm.unlocked : null,
        planted,
      },
    },
  }
}

/** Convert a validated flat-save ZIP into a complete one-pig archive without touching its source. */
export function exportLegacySaveArchiveAsOwnerDocumentArchive({ archiveBuffer, ownerId, pigId, nowMs = Date.now() }) {
  if (!Buffer.isBuffer(archiveBuffer)) throw new TypeError('legacy archive export needs ZIP bytes')
  if (typeof ownerId !== 'string' || !ID_PATTERN.test(ownerId) || typeof pigId !== 'string' || !ID_PATTERN.test(pigId)) {
    throw new TypeError('legacy archive export requires explicit owner and pig IDs')
  }
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new TypeError('export nowMs must be a nonnegative safe integer')
  const parsed = parseLegacyArchive(archiveBuffer, ownerId, pigId, nowMs)
  const documentBytes = Buffer.from(serializeOwnerDocument(parsed.document))
  const archiveFiles = new Map([[OWNER_DOCUMENT_ENTRY, documentBytes], ...parsed.sidecars])
  if (parsed.receipts !== null) archiveFiles.set(OWNER_RECEIPTS_ENTRY, Buffer.from(JSON.stringify(parsed.receipts)))
  const fileRecords = Object.fromEntries([...archiveFiles].map(([name, body]) => [name, { size: body.length, sha256: sha256(body) }]))
  const manifest = {
    format: OWNER_ARCHIVE_FORMAT,
    version: OWNER_ARCHIVE_VERSION,
    documentVersion: parsed.document.documentVersion,
    legacyFormatVersion: parsed.document.legacyFormat.version,
    createdAt: nowMs,
    gameVersion: PACKAGE_VERSION,
    ownerId,
    pigIds: [pigId],
    files: fileRecords,
  }
  const buffer = makeZip([...archiveFiles, [OWNER_ARCHIVE_MANIFEST, Buffer.from(JSON.stringify(manifest))]])
  readZip(buffer)
  return { buffer, name: 'piggy-owner-save.zip', ownerId, pigIds: [pigId], warnings: parsed.warnings }
}

/** 完整导出 owner 文档、已支持 sidecars 与收据；设备 localStorage/cloud settings 不属于存档。 */
export function exportOwnerDocumentArchive({ ownerDocumentPath, ownerId, nowMs = Date.now() }) {
  if (typeof ownerId !== 'string' || !ID_PATTERN.test(ownerId)) throw new TypeError('export requires an explicit ownerId context')
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new TypeError('export nowMs must be a nonnegative safe integer')
  const path = existingOwnerPath(ownerDocumentPath)
  recoverOwnerDocumentTransaction(path)
  // Match the live owner writer's lock order: ledger first, then document file.
  return withArchiveLocks([`${path}.owner-work-ledger`, path], () => {
    const status = inspectOwnerDocumentFile(path)
    if (status.kind !== 'owner-document') throw new Error(`owner export source is not readable (${status.kind})`)
    const document = assertOwnerReferences(status.document)
    if (document.ownerId !== ownerId) throw new Error('owner archive context ownerId mismatch')
    const workDirectory = `${path}.work-events`
    let workStat
    try { workStat = lstatSync(workDirectory) } catch (error) { if (error?.code !== 'ENOENT') throw error }
    if (workStat !== undefined && (!workStat.isDirectory() || workStat.isSymbolicLink())) {
      throw new Error('owner work directory is unsafe; evidence preserved')
    }
    if (workStat !== undefined && readdirSync(workDirectory).includes('transaction.json')) {
      throw new Error('pending owner work transaction blocks export; reopen the owner runtime first')
    }
    if (workStat !== undefined && readdirSync(workDirectory).some(name => name !== 'receipts.json')) {
      throw new Error('owner work directory contains unsupported files; evidence preserved')
    }
    const receiptsValue = readWorkJson(join(workDirectory, 'receipts.json'))
    const receipts = receiptsValue === null ? null : validateOwnerReceipts(receiptsValue, document)
    const sidecars = new Map()
    const warnings = new Set()
    const root = dirname(path)
    for (const pig of document.pigs) {
      const viewPath = join(root, `.owner-archive-view-${randomUUID()}.json`)
      const built = createSaveArchive({ statePath: viewPath, state: projectOwnerDocumentToLegacyV15(document, pig.pigId),
        gameVersion: PACKAGE_VERSION, nowMs })
      for (const warning of built.summary.warnings ?? []) warnings.add(warning)
      for (const [name, body] of readZip(built.buffer)) {
        if (name === 'state.json' || name === 'backup.json') continue
        if (!allowedSidecar(name)) throw new Error(`unsupported owner sidecar: ${name}`)
        const previous = sidecars.get(name)
        if (previous !== undefined && !previous.equals(body)) throw new Error(`owner sidecar changed while exporting: ${name}`)
        sidecars.set(name, body)
      }
    }
    const documentBytes = Buffer.from(serializeOwnerDocument(document))
    const archiveFiles = new Map([[OWNER_DOCUMENT_ENTRY, documentBytes], ...sidecars])
    if (receipts !== null) archiveFiles.set(OWNER_RECEIPTS_ENTRY, Buffer.from(JSON.stringify(receipts)))
    const fileRecords = Object.fromEntries([...archiveFiles].map(([name, body]) => [name, { size: body.length, sha256: sha256(body) }]))
    const manifest = {
      format: OWNER_ARCHIVE_FORMAT,
      version: OWNER_ARCHIVE_VERSION,
      documentVersion: document.documentVersion,
      legacyFormatVersion: document.legacyFormat.version,
      createdAt: nowMs,
      gameVersion: PACKAGE_VERSION,
      ownerId: document.ownerId,
      pigIds: document.pigs.map(pig => pig.pigId),
      files: fileRecords,
    }
    const buffer = makeZip([...archiveFiles, [OWNER_ARCHIVE_MANIFEST, Buffer.from(JSON.stringify(manifest))]])
    readZip(buffer)
    return { buffer, name: 'piggy-owner-save.zip', ownerId, pigIds: manifest.pigIds, warnings: [...warnings] }
  })
}

/** Preview is read-only; importing never merges into or overwrites an existing owner root. */
export function createOwnerDocumentArchiveImporter({ ownerDocumentPath, ownerId = null, pigId = null, allowLegacy = true, now = Date.now }) {
  if (typeof ownerDocumentPath !== 'string' || !isAbsolute(ownerDocumentPath) ||
      (ownerId !== null && (typeof ownerId !== 'string' || !ID_PATTERN.test(ownerId))) ||
      (pigId !== null && (typeof pigId !== 'string' || !ID_PATTERN.test(pigId))) || typeof allowLegacy !== 'boolean') {
    throw new TypeError('importer needs an absolute target and valid optional identity context')
  }
  const previews = new Map()
  function preview(input) {
    try {
      if (!Buffer.isBuffer(input)) throw new Error('owner import input must be a ZIP buffer')
      const path = resolve(ownerDocumentPath), root = dirname(path)
      const rootStat = (() => { try { return lstatSync(root) } catch (error) { if (error?.code === 'ENOENT') return null; throw error } })()
      if (rootStat !== null) throw new Error('owner import target directory already exists; refusing to overwrite or merge')
      const parent = dirname(root)
      const parentStat = lstatSync(parent)
      if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('owner import target parent must be a real directory')
      const ownerArchive = parseOwnerArchive(input, ownerId, pigId, now())
      if (ownerArchive === null && !allowLegacy) throw new Error('请选择完整存档 ZIP；单猪存档请使用当前小猪存档入口')
      const parsed = ownerArchive ?? parseLegacyArchive(input, ownerId ?? randomUUID(), pigId ?? randomUUID(), now())
      const token = randomUUID()
      previews.clear()
      previews.set(token, { parsed, expires: now() + PREVIEW_TTL_MS })
      const initialPigId = pigId ?? parsed.document.pigs[0]?.pigId
      if (typeof initialPigId !== 'string' || !parsed.document.pigs.some(pig => pig.pigId === initialPigId)) {
        throw new Error('owner archive has no available pig target')
      }
      return {
        ok: true,
        token,
        format: parsed.format,
        ownerId: parsed.document.ownerId,
        pigIds: parsed.document.pigs.map(pig => pig.pigId),
        initialPigId,
        summary: ownerArchiveSummary(parsed.document),
        sharedResources: Object.keys(parsed.document.resources),
        warnings: [...parsed.warnings],
        deviceSettings: 'excluded',
      }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'owner archive is invalid' }
    }
  }

  function importPreview(token, { acceptWarnings = false } = {}) {
    const entry = previews.get(token)
    if (entry === undefined || entry.expires <= now()) {
      previews.delete(token)
      return { ok: false, reason: 'owner archive preview expired; preview again' }
    }
    if (entry.parsed.warnings.length > 0 && acceptWarnings !== true) {
      return { ok: false, reason: 'owner archive has incomplete optional resources; explicit warning acknowledgement is required', warnings: [...entry.parsed.warnings] }
    }
    try {
      const result = createArchiveImportTransaction({
        ownerDocumentPath,
        document: entry.parsed.document,
        sidecars: sidecarsForDestination(entry.parsed, basename(resolve(ownerDocumentPath))),
        archiveSha256: entry.parsed.archiveSha256,
        ownerId: entry.parsed.document.ownerId,
        pigIds: entry.parsed.document.pigs.map(pig => pig.pigId),
      })
      previews.delete(token)
      return { ok: true, ownerId: result.document.ownerId, pigIds: result.document.pigs.map(pig => pig.pigId),
        initialPigId: pigId ?? result.document.pigs[0]?.pigId, cleanupDeferred: result.cleanupDeferred }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'owner archive import failed' }
    }
  }

  return Object.freeze({ preview, import: importPreview, clear() { previews.clear() }, recover() { return recoverOwnerArchiveImport(ownerDocumentPath) } })
}

/** @param {{document:import('../store/owner-document.js').OwnerDocument,sidecars:Map<string,Buffer>,receipts:unknown|null}} parsed @param {string} documentName */
function sidecarsForDestination(parsed, documentName) {
  const sidecars = new Map(parsed.sidecars)
  if (parsed.receipts !== null) sidecars.set(`${documentName}.work-events/receipts.json`, Buffer.from(JSON.stringify(parsed.receipts)))
  return sidecars
}

/** Recovery API used before enabling an explicitly restored owner runtime. */
export { recoverOwnerArchiveImport }
