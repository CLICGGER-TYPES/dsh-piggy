// @ts-check
/** Owner 会话注册与 target 作用域视图：session 只认本运行时、本代、本 target。 */
import { STORE_INTERNALS } from '../store.js'
import { composeLegacyState, splitLegacyState } from '../store/legacy-projection.js'
import {
  SESSION_BOUNDARY,
  SESSION_SCOPE,
  SESSION_TRANSPORT,
  SessionBoundaryError,
  assertApplicationUsable,
  assertLiveSession,
  createOwnerLanSessionBinding,
  createSessionBinding,
} from './session-context.js'

/**
 * @param {{
 *   state:import('./owner-runtime-state.js').OwnerRuntimeState,
 *   guards:{assertHealthy:()=>void, assertAccepting:()=>void},
 *   targetById:Map<string, import('../store/owner-resources.js').PigTarget>,
 *   ownerStores:Map<string, any>,
 *   sessions:Map<any, any>,
 *   runtimeId:string,
 *   generation:number,
 * }} deps
 */
export function createOwnerSessionRegistry(deps) {
  const { state, guards, targetById, ownerStores, sessions, runtimeId, generation } = deps

  /** @param {object} session @param {object} store */
  function createSessionStoreView(session, store) {
    /** @type {Record<string, unknown>} */
    const view = {}
    Object.defineProperties(view, {
      state: {
        enumerable: true,
        get() {
          selectTargetSession(session)
          const targetState = store.state
          return targetState === null ? null : composeLegacyState(splitLegacyState(targetState))
        },
      },
      filePath: {
        enumerable: true,
        get() { selectTargetSession(session); return store.filePath },
      },
      journal: {
        enumerable: true,
        get() { selectTargetSession(session); return store.journal },
      },
      ext: {
        enumerable: true,
        get() { selectTargetSession(session); return store.ext },
      },
    })
    for (const key of Object.keys(store)) {
      if (key === 'installCommittedState' || key === 'dispose' || key === 'state' || key === 'filePath' || key === 'journal' || key === 'ext') continue
      const method = store[key]
      if (typeof method !== 'function') continue
      Object.defineProperty(view, key, {
        enumerable: true,
        value: (...args) => {
          selectTargetSession(session)
          return Reflect.apply(method, store, args)
        },
      })
    }
    return Object.freeze(view)
  }

  /** @param {any} binding @param {boolean} [allowClosing] */
  function selectTargetSession(binding, allowClosing = false) {
    if (allowClosing) guards.assertHealthy()
    else guards.assertAccepting()
    const active = binding === undefined || binding === null ? state.defaultSession : binding
    if (active === null) throw new Error('owner document runtime has no default session')
    const entry = sessions.get(active)
    if (entry === undefined) {
      assertLiveSession(active)
      throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'session is not registered with this owner runtime')
    }
    assertLiveSession(active, {
      runtimeId,
      generation,
      application: entry.internals.application,
      commandScope: entry.internals.commands.scope,
      owner: entry.target.owner,
      target: entry.target,
    })
    assertApplicationUsable(active.assertApplication())
    guards.assertHealthy()
    return { session: active, ...entry }
  }

  /**
   * @param {string} pigId
   * @param {{kind:string,origin:string}} [transport]
   * @returns {import('./session-context.js').SessionBinding}
   */
  function openPigSession(pigId, transport) {
    guards.assertAccepting()
    const target = targetById.get(pigId)
    const store = ownerStores.get(pigId)
    if (target === undefined || store === undefined) {
      throw new SessionBoundaryError(SESSION_BOUNDARY.TARGET_UNUSABLE, 'pigId is not registered in this owner runtime')
    }
    const internals = store[STORE_INTERNALS]
    if (internals === undefined || internals === null) throw new Error('owner target store internals missing')
    const createBinding = transport?.kind === SESSION_TRANSPORT.LAN ? createOwnerLanSessionBinding : createSessionBinding
    const session = createBinding({
      scope: SESSION_SCOPE.HOST_RUNTIME,
      transport,
      application: internals.application,
      commands: internals.commands,
      runtimeId,
      generation,
    })
    const view = createSessionStoreView(session, store)
    sessions.set(session, { pigId, target, store, internals, view })
    return session
  }

  return { openPigSession, selectTargetSession }
}
