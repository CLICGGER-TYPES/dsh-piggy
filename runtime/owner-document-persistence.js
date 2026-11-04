// @ts-check
/** Owner document 的迁移、快照、revision CAS 持久化与 work 锁；运行态 revision 由这里推进。 */
import { isDeepStrictEqual } from 'node:util'

import { OWNER_DOCUMENT_VERSION, serializeOwnerDocument, validateOwnerDocument } from '../store/owner-document.js'
import { splitLegacyState } from '../store/legacy-projection.js'
import { isMixedContainer } from '../store/state-ownership.js'
import { inspectOwnerDocumentFile, migrateLegacyV15File, recoverOwnerDocumentTransaction, writeOwnerDocumentFile } from './owner-document-file.js'
import { acquireGameLock } from './owner-lock.js'
import { jsonClone, isRecord, sha256 } from './owner-runtime-json.js'
import { inspectCurrentOwnerDocument } from './owner-runtime-state.js'
import { SESSION_BOUNDARY, SessionBoundaryError } from './session-context.js'

/**
 * @param {{
 *   ownerDocumentPath:string,
 *   options:{legacyStatePath?:string, ownerId?:string, pigId:string},
 *   now:()=>number,
 *   ownerWorkLockPath:string,
 *   state:import('./owner-runtime-state.js').OwnerRuntimeState,
 *   ledger:{recover:()=>void},
 *   guards:{assertHealthy:()=>void},
 *   getOwner:()=>import('../store/owner-resources.js').OwnerAuthority|null,
 *   getTargets:()=>Map<string, import('../store/owner-resources.js').PigTarget>,
 * }} deps
 */
export function createOwnerDocumentPersistence(deps) {
  const { ownerDocumentPath, options, now, ownerWorkLockPath, state, ledger, guards, getOwner, getTargets } = deps

  const inspectCurrent = () => inspectCurrentOwnerDocument(ownerDocumentPath)

  /** @template T @param {() => T} action @returns {T} */
  function withOwnerWorkLock(action) {
    let release
    try { release = acquireGameLock(ownerWorkLockPath) }
    catch {
      throw Object.assign(new Error('owner document writer is busy; retry after its current commit'), { status: 503, code: 'OWNER_WRITE_BUSY' })
    }
    try { return action() }
    finally { release() }
  }

  function loadOrMigrate() {
    recoverOwnerDocumentTransaction(ownerDocumentPath)
    let current = inspectOwnerDocumentFile(ownerDocumentPath)
    if (current.kind === 'missing') {
      if (typeof options.legacyStatePath !== 'string' || options.legacyStatePath.trim() === '' ||
          typeof options.ownerId !== 'string' || typeof options.pigId !== 'string') {
        throw new Error('creating an owner document requires explicit legacyStatePath, ownerId, and pigId')
      }
      const legacy = inspectOwnerDocumentFile(options.legacyStatePath)
      if (legacy.kind !== 'legacy-v15') throw new Error(`legacy source is not a readable v15 save (${legacy.kind})`)
      migrateLegacyV15File({
        legacyPath: options.legacyStatePath,
        ownerDocumentPath,
        ownerId: options.ownerId,
        pigId: options.pigId,
        expectedLegacySha256: legacy.revision,
        nowMs: now(),
      })
      current = inspectOwnerDocumentFile(ownerDocumentPath)
    }
    if (current.kind !== 'owner-document') {
      throw new Error(`owner document is not an owner document (${current.kind}); refusing fallback to v15`)
    }
    if (typeof options.ownerId === 'string' && options.ownerId !== current.document.ownerId) {
      throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'ownerDocumentPath belongs to another ownerId')
    }
    if (!current.document.pigs.some(pig => pig.pigId === options.pigId)) {
      throw new SessionBoundaryError(SESSION_BOUNDARY.TARGET_UNUSABLE, 'requested pigId is absent from this owner document')
    }
    return current
  }

  /** @returns {import('../store/owner-document.js').OwnerDocument} */
  function snapshotDocument() {
    const entries = [...getTargets().entries()]
    if (entries.length === 0) throw new Error('owner document has no registered pig targets')
    const firstTarget = entries[0][1]
    const firstState = firstTarget.state
    if (firstState === null) throw new Error('owner document target has no legacy projection')
    const canonical = splitLegacyState(firstState)
    const owner = /** @type {import('../store/owner-resources.js').OwnerAuthority} */ (getOwner())
    const resources = jsonClone(owner.state ?? {})
    const opaque = jsonClone(canonical.opaque)
    const format = jsonClone(canonical.format)
    const pigs = entries.map(([pigId, target]) => {
      const targetState = target.state
      if (targetState === null || target.body === null) throw new Error(`owner target ${pigId} is absent`)
      const parts = splitLegacyState(targetState)
      if (!isDeepStrictEqual(jsonClone(parts.resources), resources) ||
          !isDeepStrictEqual(jsonClone(parts.opaque), opaque) ||
          !isDeepStrictEqual(jsonClone(parts.format), format)) {
        throw new Error('owner target facades disagree about canonical owner data')
      }
      const body = jsonClone(target.body)
      for (const key of Object.keys(body)) {
        if (isMixedContainer(key) && isRecord(body[key]) && Object.keys(body[key]).length === 0) delete body[key]
      }
      return { pigId, body }
    })
    return validateOwnerDocument({
      documentVersion: OWNER_DOCUMENT_VERSION,
      ownerId: state.ownerId,
      legacyFormat: format,
      resources,
      pigs,
      opaque,
    })
  }

  function persistDocument(document = snapshotDocument()) {
    guards.assertHealthy()
    const validated = validateOwnerDocument(document)
    const text = serializeOwnerDocument(validated)
    const nextRevision = sha256(text)
    try {
      return withOwnerWorkLock(() => {
        ledger.recover()
        const current = inspectCurrent()
        if (current.revision !== state.revision) {
          const error = new SessionBoundaryError(SESSION_BOUNDARY.SOURCE_CHANGED, 'owner document revision changed; reopen this runtime before writing')
          state.fault = error
          throw error
        }
        if (nextRevision === state.revision) return { document: validated, revision: state.revision }
        const result = writeOwnerDocumentFile({ filePath: ownerDocumentPath, document: validated, expectedRevision: state.revision })
        state.revision = result.revision
        return result
      })
    } catch (error) {
      if (state.fault === null && error?.code !== 'OWNER_WRITE_BUSY' &&
          !(error instanceof SessionBoundaryError && error.code === SESSION_BOUNDARY.SOURCE_CHANGED)) state.fault = error
      throw error
    }
  }

  return { inspectCurrent, loadOrMigrate, snapshotDocument, persistDocument, withOwnerWorkLock }
}
