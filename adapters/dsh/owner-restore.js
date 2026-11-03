// @ts-check
/** DSH cloud-to-local restore: validate, import a new owner root, then switch explicitly.
 *
 * The remote archive is only ever written to a fresh root under the DSH-owned
 * archive directory. The configured/live owner is never overwritten, and the
 * active selection is changed only after the imported copy reads back correctly.
 */
import { randomUUID } from 'node:crypto'
import { lstatSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { createOwnerDocumentArchiveImporter } from '../../runtime/owner-document-archive.js'
import { inspectOwnerDocumentFile } from '../../runtime/owner-document-file.js'
import { ownerCloudConfigDigest } from './owner-cloud.js'

const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
const PREVIEW_TTL_MS = 10 * 60 * 1000

/** @param {unknown} value @returns {value is string} */
function isId(value) { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value) }

/** @param {unknown} left @param {unknown} right */
function sameIds(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
    left.every((value, index) => value === right[index])
}

/**
 * @param {{
 *   archiveRoot:string,
 *   selectionStore:any,
 *   getRuntime:()=>any,
 *   getActive:()=>{ownerDocumentPath:string,ownerId:string|null,pigId:string|null},
 *   getCloudConfig:()=>any,
 *   switchOwner:(next:{ownerDocumentPath:string,ownerId:string,pigId:string})=>Promise<{ok:boolean,reason?:string}>,
 *   prepareCloudReady:(input:{ownerDocumentPath:string,ownerId:string,baseHead:string})=>Promise<any>,
 *   clearCloudReady:(input:{ownerDocumentPath:string,ownerId:string})=>any,
 *   now?:()=>number,
 * }} options
 */
export function createDshOwnerRestoreService(options) {
  const { archiveRoot, selectionStore, getRuntime, getActive, getCloudConfig, switchOwner,
    prepareCloudReady, clearCloudReady } = options
  const now = options.now ?? Date.now
  /** @type {Map<string,{importer:any,ownerDocumentPath:string,ownerId:string,pigIds:string[],initialPigId:string,previous:{ownerDocumentPath:string,ownerId:string|null},remoteHead:string,configDigest:string,expires:number}>} */
  const previews = new Map()

  function ensureArchiveRoot() {
    try { mkdirSync(archiveRoot, { recursive: true, mode: 0o700 }) }
    catch { throw new Error('本机独立存档目录无法创建') }
    let stat
    try { stat = lstatSync(archiveRoot) } catch { throw new Error('本机独立存档目录不可用') }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('本机独立存档目录无效')
  }

  function clear() {
    for (const entry of previews.values()) {
      try { entry.importer.clear() } catch { /* previews are disposable */ }
    }
    previews.clear()
  }

  /** Read the configured branch and validate the full owner archive before offering a copy. */
  async function preview(runtime = getRuntime()) {
    const current = getActive()
    const configDigest = ownerCloudConfigDigest(getCloudConfig())
    let remote
    try { remote = await runtime.firstSyncCloud('cloud-to-local') }
    catch { return { ok: false, reason: 'Owner cloud restore could not read the remote archive' } }
    if (remote?.ok !== true) {
      return remote?.reason ? remote : { ok: false, reason: 'Owner cloud restore could not read the remote archive' }
    }
    const archive = remote.archive instanceof Uint8Array ? Buffer.from(remote.archive) : null
    if (archive === null || archive.length === 0 || archive.length > MAX_ARCHIVE_BYTES) {
      return { ok: false, reason: 'Owner cloud archive is empty or exceeds the restore size limit' }
    }
    if (!isId(remote.ownerId) || !Array.isArray(remote.pigIds) || remote.pigIds.length === 0 || remote.pigIds.some(id => !isId(id))) {
      return { ok: false, reason: 'Owner cloud archive identity is invalid' }
    }
    if (typeof remote.remoteHead !== 'string' || !/^[a-f0-9]{40,64}$/iu.test(remote.remoteHead)) {
      return { ok: false, reason: 'Owner cloud archive has no verified remote head' }
    }
    try { ensureArchiveRoot() } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : '本机独立存档目录无效' }
    }
    clear()
    const targetRoot = join(archiveRoot, `archive-${randomUUID()}`)
    const ownerDocumentPath = join(targetRoot, 'owner-document.json')
    const importer = createOwnerDocumentArchiveImporter({ ownerDocumentPath, allowLegacy: false, now })
    let parsed
    try { parsed = importer.preview(archive) } catch (error) {
      importer.clear()
      return { ok: false, reason: error instanceof Error ? error.message : 'Owner archive preview failed' }
    }
    if (parsed?.ok !== true || typeof parsed.token !== 'string') {
      importer.clear()
      return { ok: false, reason: parsed?.reason ?? 'Owner cloud archive is not a complete owner archive' }
    }
    if (parsed.ownerId !== remote.ownerId || !sameIds(parsed.pigIds, remote.pigIds)) {
      importer.clear()
      return { ok: false, reason: 'Owner cloud archive identity does not match the verified remote record' }
    }
    previews.set(parsed.token, {
      importer,
      ownerDocumentPath,
      ownerId: parsed.ownerId,
      pigIds: [...parsed.pigIds],
      initialPigId: parsed.initialPigId,
      previous: { ownerDocumentPath: current.ownerDocumentPath, ownerId: current.ownerId ?? null },
      remoteHead: remote.remoteHead,
      configDigest,
      expires: now() + PREVIEW_TTL_MS,
    })
    return {
      ok: true,
      token: parsed.token,
      ownerId: parsed.ownerId,
      pigIds: [...parsed.pigIds],
      initialPigId: parsed.initialPigId,
      summary: parsed.summary,
      warnings: [...parsed.warnings],
      deviceSettings: 'excluded',
      currentOwnerId: current.ownerId ?? null,
    }
  }

  /** @param {string} token @param {{acceptWarnings?:boolean,pigId?:string}} [selection] */
  async function importPreview(token, selection = {}) {
    const entry = previews.get(token)
    if (entry === undefined || entry.expires <= now()) {
      previews.delete(token)
      return { ok: false, reason: 'Owner cloud restore preview expired; preview the remote archive again' }
    }
    if (ownerCloudConfigDigest(getCloudConfig()) !== entry.configDigest) {
      previews.delete(token)
      entry.importer.clear()
      return { ok: false, reason: 'Owner cloud settings changed; preview the remote archive again' }
    }
    if (getCloudConfig()?.enabled !== true) {
      return { ok: false, reason: 'Owner cloud is disabled; nothing was changed' }
    }
    const active = getActive()
    if (active.ownerDocumentPath !== entry.previous.ownerDocumentPath || (active.ownerId ?? null) !== entry.previous.ownerId) {
      previews.delete(token)
      entry.importer.clear()
      return { ok: false, reason: 'The active owner changed; preview the remote archive again' }
    }
    const targetPigId = selection.pigId ?? entry.initialPigId
    if (!isId(targetPigId) || !entry.pigIds.includes(targetPigId)) {
      return { ok: false, reason: 'Requested pigId is not present in the owner cloud archive' }
    }
    try {
      if (selectionStore.read().pending !== null) {
        return { ok: false, reason: 'Another owner switch is pending recovery; nothing was changed' }
      }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'Owner selection is unreadable; nothing was changed' }
    }
    let imported
    try { imported = entry.importer.import(token, { acceptWarnings: selection.acceptWarnings === true }) }
    catch (error) { imported = { ok: false, reason: error instanceof Error ? error.message : 'Owner archive import failed' } }
    if (imported?.ok !== true) return { ok: false, reason: imported?.reason ?? 'Owner archive import failed' }
    previews.delete(token)
    const inspected = inspectOwnerDocumentFile(entry.ownerDocumentPath)
    if (inspected.kind !== 'owner-document' || inspected.document.ownerId !== entry.ownerId ||
        !inspected.document.pigs.some(pig => pig.pigId === targetPigId)) {
      return { ok: false, imported: true,
        reason: 'Owner copy readback did not match; the new copy was kept and the current owner was not changed' }
    }
    try {
      await prepareCloudReady({ ownerDocumentPath: entry.ownerDocumentPath, ownerId: entry.ownerId, baseHead: entry.remoteHead })
    } catch {
      return { ok: false, imported: true,
        reason: 'Owner cloud readiness could not be saved; the new copy was kept and the current owner was not changed' }
    }
    let switched
    try {
      switched = await switchOwner({ ownerDocumentPath: entry.ownerDocumentPath, ownerId: entry.ownerId, pigId: targetPigId })
    } catch {
      switched = { ok: false, reason: 'Owner copy could not be activated; the new copy was kept and the previous owner was restored' }
    }
    if (switched?.ok !== true) {
      try { clearCloudReady({ ownerDocumentPath: entry.ownerDocumentPath, ownerId: entry.ownerId }) } catch { /* keep the copy as evidence */ }
      return { ok: false, imported: true,
        reason: switched?.reason ?? 'Owner copy could not be activated; the new copy was kept and the previous owner was restored' }
    }
    return { ok: true, imported: true, switched: true, ownerId: entry.ownerId, pigIds: [...entry.pigIds], pigId: targetPigId }
  }

  return Object.freeze({ preview, import: importPreview, clear, archiveRoot })
}
