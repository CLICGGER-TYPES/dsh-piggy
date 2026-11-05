// @ts-check
/** 显式 opt-in 的多 target OwnerDocument runtime；默认 createGameRuntime 仍是 v15 单 target。 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

import { dispatch } from '../src/host/commands.js'
import { createOwnerDocumentStore } from '../store/owner-document-store.js'
import { projectOwnerDocumentToLegacyV15 } from '../store/owner-document.js'
import { createOwnerResources } from '../store/owner-resources.js'
import { createJournal } from '../store/journal.js'
import { composeLegacyState, splitLegacyState } from '../store/legacy-projection.js'
import { createOwnerCloudController } from './owner-cloud-controller.js'
import { createOwnerDocumentPersistence } from './owner-document-persistence.js'
import { createOwnerPigTargets } from './owner-pig-targets.js'
import { createOwnerRouteBridge } from './owner-route-bridge.js'
import { isRecord } from './owner-runtime-json.js'
import { createRuntimeGuards, createOwnerRuntimeState } from './owner-runtime-state.js'
import { createOwnerSessionRegistry } from './owner-session-registry.js'
import { createOwnerWorkEventIngest } from './owner-work-event-ingest.js'
import { createOwnerWorkLedger } from './owner-work-ledger-runtime.js'
import { SESSION_BOUNDARY, SESSION_TRANSPORT, SessionBoundaryError, bindRuntimeSession } from './session-context.js'

const OWNER_PERSISTENCE = 'owner-document-multi-target'

/**
 * @typedef {object} OwnerRuntimeOptions
 * @property {string} ownerDocumentPath
 * @property {string} [legacyStatePath]
 * @property {string} [ownerId]
 * @property {string} pigId
 * @property {string} [command]
 * @property {() => number} [now]
 * @property {typeof fetch} [fetch]
 * @property {() => void} [onStateChanged]
 * @property {(view:unknown)=>void} [onSnapshot]
 * @property {object} [journalHeader]
 * @property {{kind:string,origin:string}} [transport]
 * @property {{enabled?:boolean,remote?:string,branch?:string,provider?:string,device?:string,debounceMs?:number,syncReady?:boolean,cloudBaseHead?:string|null}|null} [cloudSave]
 */

/**
 * Build a multi-target runtime only when the caller explicitly supplies an owner-document path.
 * No default path is inferred and the legacy v15 file is never modified.
 * @param {OwnerRuntimeOptions} options
 */
export function createOwnerDocumentRuntime(options) {
  if (!isRecord(options) || typeof options.ownerDocumentPath !== 'string' || options.ownerDocumentPath.trim() === '') {
    throw new TypeError('owner-document opt-in needs an explicit ownerDocumentPath')
  }
  if (typeof options.pigId !== 'string' || options.pigId.trim() === '') {
    throw new TypeError('owner-document opt-in needs an explicit pigId target')
  }
  const now = options.now ?? (() => Date.now())
  const requestedPath = resolve(options.ownerDocumentPath)
  mkdirSync(dirname(requestedPath), { recursive: true, mode: 0o700 })
  const ownerDocumentPath = join(realpathSync(dirname(requestedPath)), basename(requestedPath))
  const workDirectory = `${ownerDocumentPath}.work-events`
  const ownerWorkLockPath = `${ownerDocumentPath}.owner-work-ledger`
  const receiptPath = join(workDirectory, 'receipts.json')
  const walPath = join(workDirectory, 'transaction.json')

  const state = createOwnerRuntimeState()
  const targetById = new Map()
  const ownerStores = new Map()
  const sessions = new Map()
  const runtimeId = randomUUID()
  const generation = 1
  const guards = createRuntimeGuards(state)
  const journal = createJournal({ dir: dirname(ownerDocumentPath), now })
  const ledger = createOwnerWorkLedger({
    ownerDocumentPath, receiptPath, walPath, now, getOwnerId: () => state.ownerId,
  })
  const persistence = createOwnerDocumentPersistence({
    ownerDocumentPath,
    options,
    now,
    ownerWorkLockPath,
    state,
    ledger,
    guards,
    getOwner: () => state.owner,
    getTargets: () => targetById,
  })
  const sessionRegistry = createOwnerSessionRegistry({
    state, guards, targetById, ownerStores, sessions, runtimeId, generation,
  })
  const routeBridge = createOwnerRouteBridge({
    state,
    options,
    selectTargetSession: sessionRegistry.selectTargetSession,
    onStateChanged: options.onStateChanged,
  })
  const pigTargets = createOwnerPigTargets({
    state,
    guards,
    now,
    ownerDocumentPath,
    persistenceKind: OWNER_PERSISTENCE,
    journal,
    targetById,
    ownerStores,
    documentPersistence: persistence,
    openPigSession: sessionRegistry.openPigSession,
  })
  const workEvents = createOwnerWorkEventIngest({
    state,
    guards,
    now,
    ownerDocumentPath,
    walPath,
    ledger,
    persistence,
    selectTargetSession: sessionRegistry.selectTargetSession,
    onStateChanged: options.onStateChanged,
  })
  const cloudController = createOwnerCloudController({
    ownerDocumentPath, options, now, state, guards, journal,
  })

  try {
    const initial = persistence.loadOrMigrate()
    state.ownerId = initial.document.ownerId
    mkdirSync(workDirectory, { recursive: true, mode: 0o700 })
    persistence.withOwnerWorkLock(() => ledger.recover())
    const opened = persistence.inspectCurrent()
    state.ownerId = opened.document.ownerId
    state.revision = opened.revision
    if (!opened.document.pigs.some(pig => pig.pigId === options.pigId)) {
      throw new SessionBoundaryError(SESSION_BOUNDARY.TARGET_UNUSABLE, 'requested pigId is absent after work recovery')
    }
    const owner = createOwnerResources()
    state.owner = owner
    const first = opened.document.pigs[0]
    if (first === undefined) throw new Error('owner document has no pig records')
    const firstTarget = owner.mountLegacyTarget(projectOwnerDocumentToLegacyV15(opened.document, first.pigId))
    targetById.set(first.pigId, firstTarget)
    for (const pig of opened.document.pigs.slice(1)) targetById.set(pig.pigId, owner.attachPig({ body: pig.body }))

    const ownerPersistence = Object.freeze({ kind: OWNER_PERSISTENCE, ownerId: state.ownerId, targets: opened.document.pigs.length })
    for (const [pigId, target] of targetById) {
      const store = createOwnerDocumentStore({
        filePath: ownerDocumentPath,
        owner,
        target,
        now,
        journal,
        persistence: ownerPersistence,
        persist: () => persistence.persistDocument(),
      })
      ownerStores.set(pigId, store)
    }
    if (typeof options.journalHeader === 'object' && options.journalHeader !== null) journal.header(options.journalHeader)
    state.defaultSession = sessionRegistry.openPigSession(options.pigId, options.transport ?? { kind: SESSION_TRANSPORT.EMBEDDED, origin: 'in-process' })
    cloudController.init()
  } catch (error) {
    try { for (const store of ownerStores.values()) store.dispose() } catch { /* preserve startup failure */ }
    try { state.owner?.dispose() } catch { /* preserve startup failure */ }
    throw error
  }

  function record(level, scope, message, fields) {
    journal.record(level, scope, message, fields)
  }

  const defaultEntry = sessions.get(/** @type {any} */ (state.defaultSession))
  if (defaultEntry === undefined) throw new Error('owner document runtime default target registration failed')
  let disposePromise = null
  const runtime = {
    kind: OWNER_PERSISTENCE,
    persistence: Object.freeze({ kind: OWNER_PERSISTENCE, ownerId: state.ownerId }),
    statePath: ownerDocumentPath,
    ownerDocumentPath,
    store: defaultEntry.view,
    session: state.defaultSession,
    runtimeId: () => runtimeId,
    epoch: () => state.epoch,
    record,
    openPigSession: sessionRegistry.openPigSession,
    addPigTarget: pigTargets.addPigTarget,
    listPigTargets: pigTargets.listPigTargets,
    createPigTarget: pigTargets.createPigTarget,
    storeForSession(binding) { return sessionRegistry.selectTargetSession(binding).view },
    stateForSession(binding) {
      const entry = sessionRegistry.selectTargetSession(binding)
      const current = entry.store.state
      return current === null ? null : composeLegacyState(splitLegacyState(current))
    },
    mountRoutes: routeBridge.mountRoutes,
    handle: routeBridge.handle,
    dispatchCommand(command, input, binding = state.defaultSession) {
      guards.assertHealthy()
      const entry = sessionRegistry.selectTargetSession(binding)
      const result = dispatch(entry.store, command, input)
      if (state.fault !== null) throw Object.assign(new Error('owner document revision conflict; reopen before issuing another command'), { status: 409 })
      if (result?.kind !== 'error') state.epoch += 1
      return result
    },
    acceptWorkEvent: workEvents.acceptWorkEvent,
    workEventSources: workEvents.sources,
    configureCloudSave: cloudController.configure,
    testCloudSave: cloudController.test,
    firstSyncCloud: cloudController.firstSync,
    ownerCloudHistory(targetBranch) {
      return cloudController.history(targetBranch)
    },
    ownerCloudStatus() {
      return cloudController.status()
    },
    metadata() { return { persistence: OWNER_PERSISTENCE, ownerId: state.ownerId, targets: targetById.size } },
    dispose() {
      if (disposePromise !== null) return disposePromise
      if (state.closed) return Promise.resolve({ localPersisted: true, cloudPush: 'disabled' })
      state.accepting = false
      if (cloudController.pendingConfigures() > 0) {
        disposePromise = cloudController.whenConfiguresSettled().then(() => {
          disposePromise = null
          return runtime.dispose()
        })
        return disposePromise
      }
      cloudController.stopTimer()
      disposePromise = (async () => {
        await routeBridge.drain()
        if (state.fault === null) for (const store of ownerStores.values()) store.flush()
        const cloudPush = await cloudController.pushAndClose(state.fault === null)
        for (const store of ownerStores.values()) store.dispose()
        for (const session of sessions.keys()) session.dispose()
        routeBridge.unmountAll()
        const owner = /** @type {import('../store/owner-resources.js').OwnerAuthority} */ (state.owner)
        owner.dispose()
        state.closed = true
        return { localPersisted: true, cloudPush }
      })().catch(error => {
        state.accepting = true
        disposePromise = null
        throw error
      })
      return disposePromise
    },
  }
  bindRuntimeSession(runtime, state.defaultSession)
  return runtime
}
