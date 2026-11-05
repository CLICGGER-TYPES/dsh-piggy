// @ts-check
/** Owner target 的管理面：注册、列举和新建猪只；共享资源始终留在 owner 权威里。 */
import { layEgg } from '../src/host/core.js'
import { createOwnerDocumentStore } from '../store/owner-document-store.js'
import { splitLegacyState } from '../store/legacy-projection.js'
import { isRecord } from './owner-runtime-json.js'
import { SESSION_TRANSPORT } from './session-context.js'

/**
 * @param {{
 *   state:import('./owner-runtime-state.js').OwnerRuntimeState,
 *   guards:{assertAccepting:()=>void},
 *   now:()=>number,
 *   ownerDocumentPath:string,
 *   persistenceKind:string,
 *   journal:object,
 *   targetById:Map<string, import('../store/owner-resources.js').PigTarget>,
 *   ownerStores:Map<string, any>,
 *   documentPersistence:{persistDocument:()=>unknown},
 *   openPigSession:(pigId:string, transport:{kind:string,origin:string})=>any,
 * }} deps
 */
export function createOwnerPigTargets(deps) {
  const {
    state, guards, now, ownerDocumentPath, persistenceKind, journal,
    targetById, ownerStores, documentPersistence, openPigSession,
  } = deps

  /** @param {string} pigId @param {import('../store/owner-resources.js').PigTarget} target */
  function pigSummary(pigId, target) {
    const body = target.body
    if (body === null || body === undefined) throw new Error('owner pig target is absent')
    return {
      pigId,
      name: typeof body.name === 'string' ? body.name : '猪猪',
      hatched: body.hatched === true,
      dead: body.dead === true,
      stage: typeof body.stage === 'string' ? body.stage : null,
      activity: isRecord(body.activity) && typeof body.activity.kind === 'string' ? body.activity.kind : null,
    }
  }

  /**
   * Register and durably append one target without selecting it for a caller.
   * The body is validated by the OwnerDocument writer; owner resources are not
   * accepted here and remain the one canonical shared copy.
   * @param {string} pigId
   * @param {Record<string, unknown>} body
   */
  function registerPigTarget(pigId, body) {
    guards.assertAccepting()
    if (typeof pigId !== 'string' || targetById.has(pigId)) throw new TypeError('new pigId must be explicit and unused')
    if (!isRecord(body)) throw new TypeError('new pig body must be an explicit object')
    const owner = /** @type {import('../store/owner-resources.js').OwnerAuthority} */ (state.owner)
    const target = owner.attachPig({ body })
    targetById.set(pigId, target)
    const persistence = Object.freeze({ kind: persistenceKind, ownerId: state.ownerId, targets: targetById.size })
    const store = createOwnerDocumentStore({
      filePath: ownerDocumentPath, owner, target, now, journal, persistence,
      persist: () => documentPersistence.persistDocument(),
    })
    ownerStores.set(pigId, store)
    try { documentPersistence.persistDocument() }
    catch (error) {
      ownerStores.delete(pigId)
      targetById.delete(pigId)
      try { store.dispose() } catch { /* keep the persistence error */ }
      try { target.release() } catch { /* keep the persistence error */ }
      throw error
    }
    return target
  }

  /** @param {string} pigId @param {Record<string, unknown>} body */
  function addPigTarget(pigId, body) {
    registerPigTarget(pigId, body)
    return openPigSession(pigId, { kind: SESSION_TRANSPORT.EMBEDDED, origin: 'in-process' })
  }

  /** Local management summary; identity labels never grant a session or authority. */
  function listPigTargets() {
    guards.assertAccepting()
    return {
      ownerId: state.ownerId,
      pigs: [...targetById].map(([pigId, target]) => pigSummary(pigId, target)),
    }
  }

  /**
   * Create the existing fresh unhatched pig-box state, then keep only its pig
   * body in the owner document. Coins, inventory, farm and other owner data
   * remain shared and are never copied from the seed state.
   * @param {string} pigId
   */
  function createPigTarget(pigId) {
    const body = splitLegacyState(layEgg(now())).body
    const target = registerPigTarget(pigId, body)
    return { ownerId: state.ownerId, pig: pigSummary(pigId, target) }
  }

  return { addPigTarget, registerPigTarget, listPigTargets, createPigTarget }
}
