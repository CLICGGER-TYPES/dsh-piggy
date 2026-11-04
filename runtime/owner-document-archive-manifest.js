// @ts-check
/**
 * Owner archive 的清单、收据与文件校验层：格式/版本/身份、完整性摘要、sidecar 白名单和引用闭包。
 * 这一层只解析与校验内存里的 ZIP，不落盘、不加锁；导出/导入/预检流程在 owner-document-archive.js。
 * @module dsh-piggy/runtime/owner-document-archive-manifest
 */
import { createHash } from 'node:crypto'

import { itemByKey, skinByKey } from '../data.js'
import { MERGE_RULES_VERSION } from '../packages/pet-core/src/core/merge-rules.js'
import { REQUIRED_SKIN_SCENES, SKIN_SCENES } from '../packages/pet-core/src/data/skins.js'
import { STATE_VERSION } from '../packages/pet-core/src/core/constants.js'
import { OWNER_DOCUMENT_VERSION, ownerDocumentFromLegacyV15, parseOwnerDocument, projectOwnerDocumentToLegacyV15, validateOwnerDocument } from '../store/owner-document.js'
import { PACKAGE_VERSION } from '../snapshot.js'
import { createSaveArchive, parseSaveArchive } from './save-archive.js'
import { readZip, makeZip } from './save-zip.js'
import { validateWorkEvent, workEventKey } from './work-events.js'

export const OWNER_ARCHIVE_FORMAT = 'dsh-piggy-owner-document'
export const OWNER_ARCHIVE_VERSION = 1

export const OWNER_ARCHIVE_MANIFEST = 'owner-archive.json'
export const OWNER_DOCUMENT_ENTRY = 'owner-document.json'
export const OWNER_RECEIPTS_ENTRY = 'owner-document.json.work-events/receipts.json'
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SKIN_KEY = /^[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])?$/
const DIGEST = /^[a-f0-9]{64}$/

/** @param {Buffer|string} value */
function sha256(value) { return createHash('sha256').update(value).digest('hex') }

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }

/** @param {unknown} document */
export function assertOwnerReferences(document) {
  const checked = validateOwnerDocument(document)
  if (checked.legacyFormat.version !== STATE_VERSION) throw new Error('owner archive legacy format version is unsupported')
  if (checked.pigs.length === 0) throw new Error('owner archive needs at least one pig target')
  const rawSkins = checked.resources.customSkins
  if (rawSkins !== undefined && !Array.isArray(rawSkins)) throw new Error('owner archive customSkins reference list is invalid')
  const customKeys = new Set()
  for (const skin of Array.isArray(rawSkins) ? rawSkins : []) {
    if (!isRecord(skin) || typeof skin.key !== 'string' || !SKIN_KEY.test(skin.key) || skin.key === 'default' || skinByKey(skin.key) !== null) {
      throw new Error('owner archive custom skin identity is invalid')
    }
    if (customKeys.has(skin.key)) throw new Error('owner archive has duplicate custom skin keys')
    customKeys.add(skin.key)
    const scenes = skin.scenes
    if (!Array.isArray(scenes) || scenes.some(scene => typeof scene !== 'string') || new Set(scenes).size !== scenes.length ||
        !REQUIRED_SKIN_SCENES.every(scene => scenes.includes(scene)) ||
        scenes.some(scene => !SKIN_SCENES.some(allowed => allowed === scene))) {
      throw new Error(`owner archive skin ${skin.key} has invalid scene references`)
    }
  }
  const dressValue = checked.resources.dress
  if (dressValue !== undefined && !Array.isArray(dressValue)) throw new Error('owner archive shared dress list is invalid')
  const dress = new Set()
  for (const key of Array.isArray(dressValue) ? dressValue : []) {
    const item = typeof key === 'string' ? itemByKey(key) : null
    if (item === null || item.kind !== 'dress' || dress.has(key)) throw new Error('owner archive shared dress reference is invalid')
    dress.add(key)
  }
  for (const pig of checked.pigs) {
    const skin = pig.body.skin
    if (skin !== undefined && (typeof skin !== 'string' ||
        (skin !== 'default' && skinByKey(skin) === null && !customKeys.has(skin)))) {
      throw new Error(`owner archive pig ${pig.pigId} references a missing skin`)
    }
    const worn = pig.body.worn
    if (worn !== undefined && (!Array.isArray(worn) || worn.some(key => typeof key !== 'string' || !dress.has(key)))) {
      throw new Error(`owner archive pig ${pig.pigId} references unowned worn items`)
    }
  }
  return checked
}

/** @param {unknown} value @param {import('../store/owner-document.js').OwnerDocument} document */
export function validateOwnerReceipts(value, document) {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'receipts,version' ||
      value.version !== 2 || !Array.isArray(value.receipts) || value.receipts.length > 20_000) {
    throw new Error('owner work receipts are invalid; evidence preserved')
  }
  const pigIds = new Set(document.pigs.map(pig => pig.pigId)), seen = new Set()
  for (const receipt of value.receipts) {
    if (!isRecord(receipt) || Object.keys(receipt).sort().join(',') !== 'at,disposition,id,ownerId,pigId,source,type,version' ||
        receipt.ownerId !== document.ownerId || typeof receipt.pigId !== 'string' || !pigIds.has(receipt.pigId) ||
        !['applied', 'ignored'].includes(String(receipt.disposition))) throw new Error('owner work receipt identity is invalid; evidence preserved')
    const event = { version: receipt.version, source: receipt.source, id: receipt.id, type: receipt.type, at: receipt.at }
    try { validateWorkEvent(event) } catch { throw new Error('owner work receipt event is invalid; evidence preserved') }
    const key = JSON.stringify([receipt.ownerId, receipt.pigId, workEventKey(event)])
    if (seen.has(key)) throw new Error('duplicate owner work receipt; evidence preserved')
    seen.add(key)
  }
  return /** @type {{version:2,receipts:Record<string,unknown>[]}} */ (value)
}

/** @param {string} name */
export function allowedSidecar(name) {
  return /^skins\/custom-[a-z0-9-]{1,41}(?:-(?:bathe|eat|pet|play|relaxed|sleep|study|trip|work|fish))?\.(?:png|svg)$/.test(name)
    || /^extensions\/[a-z0-9-]{2,24}\/(?:manifest\.json|server\.js|client\.js|assets\/[a-z0-9][a-z0-9-]{0,47}\.(?:webp|png))$/.test(name)
}

/** Reuse the existing flat archive validator as a sidecar/skin/official-extension validator. */
function validateSidecars(document, sidecars, nowMs) {
  const warnings = new Set()
  for (const pig of document.pigs) {
    const flat = projectOwnerDocumentToLegacyV15(document, pig.pigId)
    const files = new Map([['state.json', Buffer.from(JSON.stringify(flat))], ...sidecars])
    const records = Object.fromEntries([...files].map(([name, body]) => [name, { size: body.length, sha256: sha256(body) }]))
    const manifest = { version: 1, gameVersion: PACKAGE_VERSION, stateVersion: STATE_VERSION,
      mergeRulesVersion: MERGE_RULES_VERSION, createdAt: nowMs, files: records }
    const parsed = parseSaveArchive(makeZip([...files, ['backup.json', Buffer.from(JSON.stringify(manifest))]]), { nowMs })
    for (const name of sidecars.keys()) {
      if (!parsed.files.has(name)) throw new Error(`owner archive contains an unsupported or unverified resource: ${name}`)
    }
    for (const warning of parsed.warnings ?? []) warnings.add(warning)
  }
  return [...warnings]
}

/** @param {Buffer|undefined} raw @param {import('../store/owner-document.js').OwnerDocument} document */
function validateManifestReceipts(raw, document) {
  if (raw === undefined) return null
  return validateOwnerReceipts(JSON.parse(raw.toString('utf8')), document)
}

/** @param {Buffer} buffer @param {string|null} ownerId @param {string|null} pigId @param {number} nowMs */
export function parseOwnerArchive(buffer, ownerId, pigId, nowMs) {
  let files
  try { files = readZip(buffer) } catch { return null }
  const manifestBytes = files.get(OWNER_ARCHIVE_MANIFEST)
  if (manifestBytes === undefined) return null
  let manifest
  try { manifest = JSON.parse(manifestBytes.toString('utf8')) } catch { throw new Error('owner archive manifest is invalid JSON') }
  const manifestKeys = ['createdAt', 'documentVersion', 'files', 'format', 'gameVersion', 'legacyFormatVersion', 'ownerId', 'pigIds', 'version']
  if (!isRecord(manifest) || Object.keys(manifest).sort().join(',') !== [...manifestKeys].sort().join(',') ||
      manifest.format !== OWNER_ARCHIVE_FORMAT || manifest.version !== OWNER_ARCHIVE_VERSION ||
      manifest.documentVersion !== OWNER_DOCUMENT_VERSION || manifest.legacyFormatVersion !== STATE_VERSION ||
      typeof manifest.ownerId !== 'string' || !ID_PATTERN.test(manifest.ownerId) || (ownerId !== null && manifest.ownerId !== ownerId) ||
      typeof manifest.createdAt !== 'number' || !Number.isSafeInteger(manifest.createdAt) || manifest.createdAt < 0 || typeof manifest.gameVersion !== 'string' ||
      !Array.isArray(manifest.pigIds) || !isRecord(manifest.files)) throw new Error('owner archive format, version or owner identity is invalid')
  const manifestRecord = /** @type {Record<string, unknown>} */ (manifest)
  const manifestFiles = /** @type {Record<string, unknown>} */ (manifestRecord.files)
  const manifestPigIds = /** @type {unknown[]} */ (manifestRecord.pigIds)
  if (manifestPigIds.some(id => typeof id !== 'string')) throw new Error('owner archive pig identity list is invalid')
  const documentBytes = files.get(OWNER_DOCUMENT_ENTRY)
  if (documentBytes === undefined) throw new Error('owner archive is missing its document')
  const document = assertOwnerReferences(parseOwnerDocument(documentBytes.toString('utf8')))
  if (document.ownerId !== manifest.ownerId || document.documentVersion !== manifest.documentVersion ||
      document.legacyFormat.version !== manifest.legacyFormatVersion ||
      document.pigs.map(pig => pig.pigId).join('\0') !== manifestPigIds.join('\0')) {
    throw new Error('owner archive manifest does not match its document identities')
  }
  if (pigId !== null && !document.pigs.some(pig => pig.pigId === pigId)) throw new Error('requested pigId is not present in owner archive')
  const names = [...files.keys()].filter(name => name !== OWNER_ARCHIVE_MANIFEST)
  if (Object.keys(manifestFiles).length !== names.length || names.some(name => !Object.hasOwn(manifestFiles, name))) {
    throw new Error('owner archive file list does not match manifest')
  }
  /** @type {Map<string, Buffer>} */
  const sidecars = new Map()
  let receipts = null
  for (const name of names) {
    const body = files.get(name)
    const record = manifestFiles[name]
    if (body === undefined || !isRecord(record) || Object.keys(record).sort().join(',') !== 'sha256,size' ||
        record.size !== body.length || record.sha256 !== sha256(body)) throw new Error(`owner archive file integrity failed: ${name}`)
    if (name === OWNER_DOCUMENT_ENTRY) continue
    if (name === OWNER_RECEIPTS_ENTRY) {
      receipts = validateManifestReceipts(body, document)
      continue
    }
    if (!allowedSidecar(name)) throw new Error(`owner archive contains an unsupported file: ${name}`)
    sidecars.set(name, body)
  }
  const warnings = validateSidecars(document, sidecars, nowMs)
  return { document, sidecars, receipts, warnings, archiveSha256: sha256(buffer), format: OWNER_ARCHIVE_FORMAT }
}

/** @param {Buffer} buffer @param {string} ownerId @param {string} pigId @param {number} nowMs */
export function parseLegacyArchive(buffer, ownerId, pigId, nowMs) {
  if (!ID_PATTERN.test(ownerId) || !ID_PATTERN.test(pigId)) throw new Error('legacy import requires explicit ownerId and pigId')
  const parsed = parseSaveArchive(buffer, { nowMs })
  if (parsed.state === null) throw new Error('empty or unhatched flat archive cannot create an owner pig target')
  if (parsed.state.version !== STATE_VERSION) throw new Error('flat archive could not be normalized to supported v15')
  const document = assertOwnerReferences(ownerDocumentFromLegacyV15(parsed.state, { ownerId, pigId }))
  const sidecars = new Map()
  let receipts = null
  for (const [name, bytes] of parsed.files) {
    if (name === 'state.json') continue
    if (name === 'state.json.work-events/receipts.json') {
      const old = JSON.parse(bytes.toString('utf8'))
      if (old.version !== 1 || !Array.isArray(old.receipts)) throw new Error('legacy work receipts are invalid')
      receipts = validateOwnerReceipts({ version: 2, receipts: old.receipts.map(receipt => ({ ...receipt, ownerId, pigId })) }, document)
      continue
    }
    if (!allowedSidecar(name)) throw new Error(`flat archive contains an unsupported resource: ${name}`)
    sidecars.set(name, bytes)
  }
  const warnings = [...new Set([...(parsed.warnings ?? []), ...validateSidecars(document, sidecars, nowMs)])]
  return { document, sidecars, receipts, warnings, archiveSha256: sha256(buffer), format: 'legacy-flat-v15' }
}

