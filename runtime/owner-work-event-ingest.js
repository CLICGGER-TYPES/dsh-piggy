// @ts-check
/** Owner work event 的接入：在 owner 事务里结算，再用 WAL + document CAS 提交收据。 */
import { feed, settleAchievements } from '../core.js'
import { serializeOwnerDocument } from '../store/owner-document.js'
import { writeOwnerDocumentFile } from './owner-document-file.js'
import { sha256 } from './owner-runtime-json.js'
import { SESSION_BOUNDARY, SessionBoundaryError } from './session-context.js'
import { validateWorkEvent, workError } from './work-events.js'
import { removeWorkFile, writeWorkJson } from './work-files.js'

/**
 * @param {{
 *   state:import('./owner-runtime-state.js').OwnerRuntimeState,
 *   guards:{assertAccepting:()=>void},
 *   now:()=>number,
 *   ownerDocumentPath:string,
 *   walPath:string,
 *   ledger:{
 *     recover:()=>void,
 *     findEvent:(ownerId:string,pigId:string,event:any)=>any,
 *     pruneTo:(nowMs:number)=>void,
 *     assertCapacity:()=>void,
 *     writeEventReceipt:(receipt:any)=>void,
 *     sources:()=>any[],
 *   },
 *   persistence:{
 *     withOwnerWorkLock:(action:()=>any)=>any,
 *     inspectCurrent:()=>{revision:string},
 *     snapshotDocument:()=>import('../store/owner-document.js').OwnerDocument,
 *   },
 *   selectTargetSession:(binding?:unknown)=>any,
 *   onStateChanged?:()=>void,
 * }} deps
 */
export function createOwnerWorkEventIngest(deps) {
  const { state, guards, now, ownerDocumentPath, walPath, ledger, persistence, selectTargetSession, onStateChanged } = deps

  /** @param {any} event @param {unknown} [binding] */
  function acceptWorkEvent(event, binding) {
    guards.assertAccepting()
    const entry = selectTargetSession(binding)
    const nowMs = now()
    validateWorkEvent(event, nowMs)
    const owner = /** @type {import('../store/owner-resources.js').OwnerAuthority} */ (state.owner)
    return persistence.withOwnerWorkLock(() => {
      try { ledger.recover() } catch (error) { state.fault = error; throw error }
      const current = persistence.inspectCurrent()
      if (current.revision !== state.revision) {
        const error = new SessionBoundaryError(SESSION_BOUNDARY.SOURCE_CHANGED, 'owner document revision changed; reopen this runtime before receiving work')
        state.fault = error
        throw error
      }
      const existing = /** @type {{at:number,type:string,disposition:'applied'|'ignored'}|undefined} */ (
        ledger.findEvent(state.ownerId, entry.pigId, event))
      if (existing !== undefined) {
        if (existing.at !== event.at || existing.type !== event.type) throw workError('work event id conflict', 409)
        return { ok: true, status: 'duplicate', disposition: existing.disposition }
      }
      ledger.pruneTo(nowMs)
      ledger.assertCapacity()
      const beforeDocument = persistence.snapshotDocument()
      const beforeRevision = state.revision
      /** @type {'applied'|'ignored'} */
      let disposition = 'ignored'
      /** @type {unknown} */
      let postCommitError = null
      try {
        owner.transact(entry.target, live => {
          if (live.dead !== true) {
            feed(live, event.type, nowMs)
            settleAchievements(live, nowMs)
            disposition = 'applied'
          }
          return { ok: true }
        }, {
          afterSuccess: () => {
            const nextDocument = persistence.snapshotDocument()
            const nextText = serializeOwnerDocument(nextDocument)
            const nextRevision = sha256(nextText)
            const receipt = { ...event, ownerId: state.ownerId, pigId: entry.pigId, disposition }
            const wal = {
              version: 1,
              ownerId: state.ownerId,
              pigId: entry.pigId,
              sessionId: entry.session.id,
              generation: entry.session.generation,
              event: { ...event },
              receipt,
              beforeRevision,
              nextRevision,
              beforeDocument,
              nextDocument,
            }
            writeWorkJson(walPath, wal)
            try {
              if (nextRevision !== beforeRevision) {
                const written = writeOwnerDocumentFile({ filePath: ownerDocumentPath, document: nextDocument, expectedRevision: beforeRevision })
                state.revision = written.revision
              }
            } catch (error) {
              state.fault = error
              throw error
            }
            try {
              ledger.writeEventReceipt(receipt)
              removeWorkFile(walPath)
            } catch (error) {
              state.fault = error
              postCommitError = error
            }
          },
        })
      } catch (error) {
        state.fault = error
        throw error
      }
      if (postCommitError !== null) throw postCommitError
      state.epoch += 1
      onStateChanged?.()
      return { ok: true, status: 'applied', disposition }
    })
  }

  return { acceptWorkEvent, sources: ledger.sources }
}
