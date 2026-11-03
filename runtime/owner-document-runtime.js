// @ts-check
/** 显式 opt-in 的多 target OwnerDocument runtime；默认 createGameRuntime 仍是 v15 单 target。 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { dispatch } from '../commands.js'
import { feed, settleAchievements } from '../core.js'
import { PACKAGE_VERSION } from '../snapshot.js'
import { createOwnerDocumentStore } from '../store/owner-document-store.js'
import { OWNER_DOCUMENT_VERSION, projectOwnerDocumentToLegacyV15, serializeOwnerDocument, validateOwnerDocument } from '../store/owner-document.js'
import { composeLegacyState, splitLegacyState } from '../store/legacy-projection.js'
import { createOwnerResources } from '../store/owner-resources.js'
import { isMixedContainer } from '../store/state-ownership.js'
import { STORE_INTERNALS } from '../store.js'
import { createJournal } from '../store/journal.js'
import { registerGameRoutes } from '../routes.js'
import {
  inspectOwnerDocumentFile,
  migrateLegacyV15File,
  recoverOwnerDocumentTransaction,
  writeOwnerDocumentFile,
} from './owner-document-file.js'
import { acquireGameLock } from './owner-lock.js'
import {
  SESSION_BOUNDARY,
  SESSION_SCOPE,
  SESSION_TRANSPORT,
  SessionBoundaryError,
  assertApplicationUsable,
  assertLiveSession,
  bindRuntimeSession,
  createSessionBinding,
} from './session-context.js'
import { WORK_EVENT_WINDOW_MS, validateWorkEvent, workError } from './work-events.js'
import { readWorkJson, removeWorkFile, writeWorkJson } from './work-files.js'

const OWNER_PERSISTENCE = 'owner-document-multi-target'
const RECEIPT_LIMIT = 20_000

/** @param {string} text */
function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

/** @param {unknown} value */
function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
}

/** @param {unknown} value */
function stableText(value) {
  return JSON.stringify(stable(value))
}

/** Match the JSON persistence boundary: object undefineds disappear and array gaps become null. @param {unknown} value */
function jsonClone(value) {
  const text = JSON.stringify(value)
  if (text === undefined) throw new TypeError('owner snapshot is not JSON data')
  return JSON.parse(text)
}

/** @param {string} ownerId @param {string} pigId @param {{source:string,id:string}} event */
function receiptKey(ownerId, pigId, event) {
  return JSON.stringify([ownerId, pigId, event.source, event.id])
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

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
 */

/** @param {unknown} value @param {string} label */
function assertReceipt(value, label = 'owner work receipt') {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'at,disposition,id,ownerId,pigId,source,type,version' ||
      typeof value.ownerId !== 'string' || typeof value.pigId !== 'string' ||
      (value.disposition !== 'applied' && value.disposition !== 'ignored')) {
    throw new Error(`${label} is invalid; evidence preserved`)
  }
  const event = { version: value.version, source: value.source, id: value.id, type: value.type, at: value.at }
  try { validateWorkEvent(event) } catch { throw new Error(`${label} is invalid; evidence preserved`) }
  return /** @type {OwnerWorkReceipt} */ ({ ...event, ownerId: value.ownerId, pigId: value.pigId, disposition: value.disposition })
}

/** @typedef {{version:1,source:string,id:string,type:string,at:number,ownerId:string,pigId:string,disposition:'applied'|'ignored'}} OwnerWorkReceipt */

/** @param {unknown} value @returns {Map<string, OwnerWorkReceipt>} */
function loadReceipts(value) {
  const receipts = new Map()
  if (value === null) return receipts
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'receipts,version' || value.version !== 2 ||
      !Array.isArray(value.receipts) || value.receipts.length > RECEIPT_LIMIT) {
    throw new Error('owner work receipts are invalid; evidence preserved')
  }
  for (const raw of value.receipts) {
    const receipt = assertReceipt(raw)
    const key = receiptKey(receipt.ownerId, receipt.pigId, receipt)
    if (receipts.has(key)) throw new Error('duplicate owner work receipt; evidence preserved')
    receipts.set(key, receipt)
  }
  return receipts
}

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

  let revision = ''
  let fault = null
  let closed = false
  let accepting = true
  let epoch = 0
  let disposePromise = null
  const runtimeId = randomUUID()
  const generation = 1
  const ownerStores = new Map()
  const targetById = new Map()
  const sessions = new Map()
  const routeSets = new WeakMap()
  const mountedRoutes = new Set()
  const activeRouteCounts = new Map()
  const activeRouteTasks = new Set()
  const journal = createJournal({ dir: dirname(ownerDocumentPath), now })
  let owner = null
  let ownerId = ''
  let receipts = new Map()
  let defaultSession = null

  function assertHealthy() {
    if (closed) throw new Error('owner document runtime closed')
    if (fault !== null) throw Object.assign(new Error('owner document runtime is faulted; reopen after inspecting the saved document'), { status: 503 })
  }

  function assertAccepting() {
    assertHealthy()
    if (!accepting) throw Object.assign(new Error('owner document runtime is closing'), { status: 503 })
  }

  function inspectCurrent() {
    const status = inspectOwnerDocumentFile(ownerDocumentPath)
    if (status.kind !== 'owner-document') {
      throw new Error(`owner document is not readable (${status.kind}); refusing to open an empty owner`)
    }
    return status
  }

  function withOwnerWorkLock(action) {
    let release
    try { release = acquireGameLock(ownerWorkLockPath) }
    catch {
      throw Object.assign(new Error('owner document writer is busy; retry after its current commit'), { status: 503, code: 'OWNER_WRITE_BUSY' })
    }
    try { return action() }
    finally { release() }
  }

  function writeReceiptSet(next) {
    const list = [...next.values()].slice(-RECEIPT_LIMIT)
    writeWorkJson(receiptPath, { version: 2, receipts: list })
    receipts = new Map(list.map(receipt => [receiptKey(receipt.ownerId, receipt.pigId, receipt), receipt]))
  }

  function recoverWorkTransaction() {
    const saved = readWorkJson(receiptPath)
    receipts = loadReceipts(saved)
    const pending = readWorkJson(walPath)
    if (pending === null) return
    const required = ['beforeDocument', 'beforeRevision', 'event', 'generation', 'nextDocument', 'nextRevision', 'ownerId', 'pigId', 'receipt', 'sessionId', 'version']
    if (!isRecord(pending) || Object.keys(pending).sort().join(',') !== required.sort().join(',') ||
        pending.version !== 1 || pending.ownerId !== ownerId || typeof pending.pigId !== 'string' ||
        typeof pending.sessionId !== 'string' || !Number.isSafeInteger(pending.generation) ||
        typeof pending.beforeRevision !== 'string' || typeof pending.nextRevision !== 'string') {
      throw new Error('owner work transaction is invalid; evidence preserved')
    }
    const before = validateOwnerDocument(pending.beforeDocument)
    const next = validateOwnerDocument(pending.nextDocument)
    const receipt = assertReceipt(pending.receipt, 'owner work transaction receipt')
    const eventValue = pending.event
    if (!isRecord(eventValue) || Object.keys(eventValue).sort().join(',') !== 'at,id,source,type,version') {
      throw new Error('owner work transaction event is invalid; evidence preserved')
    }
    const event = { version: eventValue.version, source: eventValue.source, id: eventValue.id, type: eventValue.type, at: eventValue.at }
    try { validateWorkEvent(event) } catch { throw new Error('owner work transaction event is invalid; evidence preserved') }
    if (receipt.ownerId !== ownerId || receipt.pigId !== pending.pigId ||
        receiptKey(ownerId, pending.pigId, event) !== receiptKey(receipt.ownerId, receipt.pigId, receipt) ||
        stableText(event) !== stableText({ version: receipt.version, source: receipt.source, id: receipt.id, type: receipt.type, at: receipt.at }) ||
        before.ownerId !== ownerId || next.ownerId !== ownerId ||
        !before.pigs.some(pig => pig.pigId === pending.pigId) || !next.pigs.some(pig => pig.pigId === pending.pigId) ||
        sha256(serializeOwnerDocument(before)) !== pending.beforeRevision ||
        sha256(serializeOwnerDocument(next)) !== pending.nextRevision) {
      throw new Error('owner work transaction target or revision mismatch; evidence preserved')
    }
    const current = inspectCurrent()
    if (current.revision === pending.beforeRevision && pending.nextRevision !== pending.beforeRevision) {
      writeOwnerDocumentFile({ filePath: ownerDocumentPath, document: next, expectedRevision: pending.beforeRevision })
    } else if (current.revision !== pending.nextRevision && current.revision !== pending.beforeRevision) {
      throw new Error('owner work transaction conflicts with a newer document; evidence preserved')
    }
    const key = receiptKey(receipt.ownerId, receipt.pigId, receipt)
    const existing = receipts.get(key)
    if (existing !== undefined && stableText(existing) !== stableText(receipt)) {
      throw new Error('owner work receipt conflicts during recovery; evidence preserved')
    }
    if (existing === undefined) {
      const nextReceipts = new Map(receipts)
      nextReceipts.set(key, receipt)
      writeReceiptSet(nextReceipts)
    }
    removeWorkFile(walPath)
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
    const entries = [...targetById.entries()]
    if (entries.length === 0) throw new Error('owner document has no registered pig targets')
    const firstTarget = entries[0][1]
    const firstState = firstTarget.state
    if (firstState === null) throw new Error('owner document target has no legacy projection')
    const canonical = splitLegacyState(firstState)
    const resources = jsonClone(owner.state ?? {})
    const opaque = jsonClone(canonical.opaque)
    const format = jsonClone(canonical.format)
    const pigs = entries.map(([pigId, target]) => {
      const state = target.state
      if (state === null || target.body === null) throw new Error(`owner target ${pigId} is absent`)
      const parts = splitLegacyState(state)
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
      ownerId,
      legacyFormat: format,
      resources,
      pigs,
      opaque,
    })
  }

  function persistDocument(document = snapshotDocument()) {
    assertHealthy()
    const validated = validateOwnerDocument(document)
    const text = serializeOwnerDocument(validated)
    const nextRevision = sha256(text)
    try {
      return withOwnerWorkLock(() => {
        recoverWorkTransaction()
        const current = inspectCurrent()
        if (current.revision !== revision) {
          const error = new SessionBoundaryError(SESSION_BOUNDARY.SOURCE_CHANGED, 'owner document revision changed; reopen this runtime before writing')
          fault = error
          throw error
        }
        if (nextRevision === revision) return { document: validated, revision }
        const result = writeOwnerDocumentFile({ filePath: ownerDocumentPath, document: validated, expectedRevision: revision })
        revision = result.revision
        return result
      })
    } catch (error) {
      if (fault === null && error?.code !== 'OWNER_WRITE_BUSY' &&
          !(error instanceof SessionBoundaryError && error.code === SESSION_BOUNDARY.SOURCE_CHANGED)) fault = error
      throw error
    }
  }

  /** @param {string} pigId @param {{kind:string,origin:string}} transport */
  function openPigSession(pigId, transport) {
    assertAccepting()
    const target = targetById.get(pigId)
    const store = ownerStores.get(pigId)
    if (target === undefined || store === undefined) {
      throw new SessionBoundaryError(SESSION_BOUNDARY.TARGET_UNUSABLE, 'pigId is not registered in this owner runtime')
    }
    const internals = store[STORE_INTERNALS]
    if (internals === undefined || internals === null) throw new Error('owner target store internals missing')
    const session = createSessionBinding({
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

  /** @param {object} session @param {object} store */
  function createSessionStoreView(session, store) {
    /** @type {Record<string, unknown>} */
    const view = {}
    Object.defineProperties(view, {
      state: {
        enumerable: true,
        get() {
          selectTargetSession(session)
          const state = store.state
          return state === null ? null : composeLegacyState(splitLegacyState(state))
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

  /** @param {unknown} binding */
  function selectTargetSession(binding, allowClosing = false) {
    if (allowClosing) assertHealthy()
    else assertAccepting()
    const active = binding === undefined || binding === null ? defaultSession : binding
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
    assertHealthy()
    return { session: active, ...entry }
  }

  function registerOwnerModeRefusalRoutes(webServer) {
    const paths = [
      '/dsh-piggy/save/export', '/dsh-piggy/save/preview', '/dsh-piggy/save/import',
      '/dsh-piggy/cloud/status', '/dsh-piggy/cloud/branches', '/dsh-piggy/cloud/pull',
      '/dsh-piggy/cloud/push', '/dsh-piggy/cloud/commit', '/dsh-piggy/cloud/history',
    ]
    const disposers = []
    for (const path of paths) {
      disposers.push(webServer.register({ kind: 'exact', path, handler: async (_req, res) => {
        res.writeHead(409, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify({ ok: false, error: 'owner-document mode does not support flat archive or cloud operations' }))
      } }))
    }
    return () => { for (const dispose of disposers) { try { dispose() } catch { /* best effort */ } } }
  }

  function scopedStore(entry) {
    return new Proxy(entry.store, {
      get(target, property) {
        selectTargetSession(entry.session, (activeRouteCounts.get(entry.session) ?? 0) > 0)
        const value = Reflect.get(target, property, target)
        if (typeof value !== 'function') return value
        return (...args) => {
          selectTargetSession(entry.session, (activeRouteCounts.get(entry.session) ?? 0) > 0)
          return Reflect.apply(value, target, args)
        }
      },
    })
  }

  function runRoute(session, handler, req, res) {
    selectTargetSession(session)
    activeRouteCounts.set(session, (activeRouteCounts.get(session) ?? 0) + 1)
    let task
    task = Promise.resolve().then(() => handler(req, res)).finally(() => {
      const count = (activeRouteCounts.get(session) ?? 1) - 1
      if (count <= 0) activeRouteCounts.delete(session)
      else activeRouteCounts.set(session, count)
      activeRouteTasks.delete(task)
    })
    activeRouteTasks.add(task)
    return task
  }

  function routesFor(session, entry) {
    const existing = routeSets.get(session)
    if (existing !== undefined) return existing
    /** @type {{kind:string,path:string,handler:Function}[]} */
    const routes = []
    const routeStore = scopedStore(entry)
    registerGameRoutes({ register(route) { routes.push(route); return () => {} } }, routeStore, {
      fetch: options.fetch,
      // The state route is already pinned to this one session. Attach its data
      // identity to that response; IDs label the presentation but do not select
      // or authorize the target.
      presentationIdentity: { ownerId, pigId: entry.pigId },
    })
    const webServer = { register(route) { routes.push(route); return () => {} } }
    registerOwnerModeRefusalRoutes(webServer)
    routeSets.set(session, routes)
    return routes
  }

  function mountRoutes(webServer, binding = defaultSession) {
    const entry = selectTargetSession(binding)
    const disposers = []
    for (const route of routesFor(entry.session, entry)) {
      disposers.push(webServer.register({
        ...route,
        handler: (req, res) => runRoute(entry.session, route.handler, req, res),
      }))
    }
    const dispose = () => {
      for (const unmount of disposers) { try { unmount?.() } catch { /* best effort */ } }
      mountedRoutes.delete(dispose)
    }
    mountedRoutes.add(dispose)
    return dispose
  }

  async function handle(method, url, body, binding = defaultSession) {
    const entry = selectTargetSession(binding)
    const path = String(url).split('?')[0]
    const route = routesFor(entry.session, entry).find(candidate => candidate.kind === 'prefix'
      ? path.startsWith(candidate.path + '/') : path === candidate.path)
    if (route === undefined) return { status: 404, headers: {}, body: '' }
    const result = await new Promise((resolveResponse, rejectResponse) => {
      let status = 200
      /** @type {Record<string,string>} */
      let headers = {}
      const req = { method, url, async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body) } }
      const res = {
        writeHead(code, extra) { status = code; headers = { ...headers, ...(extra ?? {}) }; return res },
        setHeader(name, value) { headers[name.toLowerCase()] = String(value) },
        end(chunk) { resolveResponse({ status, headers, body: chunk ?? '' }) },
      }
      Promise.resolve(runRoute(entry.session, route.handler, req, res)).catch(rejectResponse)
    })
    if (method === 'POST' && result.status === 200) options.onStateChanged?.()
    return result
  }

  function writeEventReceipt(receipt) {
    const key = receiptKey(receipt.ownerId, receipt.pigId, receipt)
    const existing = receipts.get(key)
    if (existing !== undefined) {
      if (existing.at !== receipt.at || existing.type !== receipt.type) throw workError('owner work event id conflict', 409)
      return
    }
    const next = new Map([...receipts].filter(([, entry]) => entry.at >= now() - WORK_EVENT_WINDOW_MS))
    if (next.size >= RECEIPT_LIMIT) throw workError('owner work receipt capacity reached', 429)
    next.set(key, receipt)
    writeReceiptSet(next)
  }

  function acceptWorkEvent(event, binding) {
    assertAccepting()
    const entry = selectTargetSession(binding)
    const nowMs = now()
    validateWorkEvent(event, nowMs)
    return withOwnerWorkLock(() => {
    try { recoverWorkTransaction() } catch (error) { fault = error; throw error }
    const current = inspectCurrent()
    if (current.revision !== revision) {
      const error = new SessionBoundaryError(SESSION_BOUNDARY.SOURCE_CHANGED, 'owner document revision changed; reopen this runtime before receiving work')
      fault = error
      throw error
    }
    const key = receiptKey(ownerId, entry.pigId, event)
    const existing = receipts.get(key)
    if (existing !== undefined) {
      if (existing.at !== event.at || existing.type !== event.type) throw workError('work event id conflict', 409)
      return { ok: true, status: 'duplicate', disposition: existing.disposition }
    }
    const kept = new Map([...receipts].filter(([, receipt]) => receipt.at >= nowMs - WORK_EVENT_WINDOW_MS))
    if (kept.size !== receipts.size) writeReceiptSet(kept)
    if (receipts.size >= RECEIPT_LIMIT) throw workError('owner work receipt capacity reached', 429)
    const beforeDocument = snapshotDocument()
    const beforeRevision = revision
    let disposition = 'ignored'
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
          const nextDocument = snapshotDocument()
          const nextText = serializeOwnerDocument(nextDocument)
          const nextRevision = sha256(nextText)
          const receipt = { ...event, ownerId, pigId: entry.pigId, disposition }
          const wal = {
            version: 1,
            ownerId,
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
              revision = written.revision
            }
          } catch (error) {
            fault = error
            throw error
          }
          try {
            writeEventReceipt(receipt)
            removeWorkFile(walPath)
          } catch (error) {
            fault = error
            postCommitError = error
          }
        },
      })
    } catch (error) {
      fault = error
      throw error
    }
    if (postCommitError !== null) throw postCommitError
    epoch += 1
    options.onStateChanged?.()
    return { ok: true, status: 'applied', disposition }
    })
  }

  function record(level, scope, message, fields) {
    journal.record(level, scope, message, fields)
  }

  try {
    const initial = loadOrMigrate()
    ownerId = initial.document.ownerId
    mkdirSync(workDirectory, { recursive: true, mode: 0o700 })
    withOwnerWorkLock(() => recoverWorkTransaction())
    const opened = inspectCurrent()
    ownerId = opened.document.ownerId
    revision = opened.revision
    if (!opened.document.pigs.some(pig => pig.pigId === options.pigId)) {
      throw new SessionBoundaryError(SESSION_BOUNDARY.TARGET_UNUSABLE, 'requested pigId is absent after work recovery')
    }
    owner = createOwnerResources()
    const first = opened.document.pigs[0]
    if (first === undefined) throw new Error('owner document has no pig records')
    const firstTarget = owner.mountLegacyTarget(projectOwnerDocumentToLegacyV15(opened.document, first.pigId))
    targetById.set(first.pigId, firstTarget)
    for (const pig of opened.document.pigs.slice(1)) targetById.set(pig.pigId, owner.attachPig({ body: pig.body }))

    const persistence = Object.freeze({ kind: OWNER_PERSISTENCE, ownerId, targets: opened.document.pigs.length })
    for (const [pigId, target] of targetById) {
      const store = createOwnerDocumentStore({
        filePath: ownerDocumentPath,
        owner,
        target,
        now,
        journal,
        persistence,
        persist: () => persistDocument(),
      })
      ownerStores.set(pigId, store)
    }
    if (typeof options.journalHeader === 'object' && options.journalHeader !== null) journal.header(options.journalHeader)
    defaultSession = openPigSession(options.pigId, options.transport ?? { kind: SESSION_TRANSPORT.EMBEDDED, origin: 'in-process' })
  } catch (error) {
    try { for (const store of ownerStores.values()) store.dispose() } catch { /* preserve startup failure */ }
    try { owner?.dispose() } catch { /* preserve startup failure */ }
    throw error
  }

  function addPigTarget(pigId, body) {
    assertAccepting()
    if (typeof pigId !== 'string' || targetById.has(pigId)) throw new TypeError('new pigId must be explicit and unused')
    if (!isRecord(body)) throw new TypeError('new pig body must be an explicit object')
    const target = owner.attachPig({ body })
    targetById.set(pigId, target)
    const persistence = Object.freeze({ kind: OWNER_PERSISTENCE, ownerId, targets: targetById.size })
    const store = createOwnerDocumentStore({
      filePath: ownerDocumentPath, owner, target, now, journal, persistence,
      persist: () => persistDocument(),
    })
    ownerStores.set(pigId, store)
    try { persistDocument() }
    catch (error) {
      ownerStores.delete(pigId)
      targetById.delete(pigId)
      try { store.dispose() } catch { /* keep the persistence error */ }
      try { target.release() } catch { /* keep the persistence error */ }
      throw error
    }
    return openPigSession(pigId, { kind: SESSION_TRANSPORT.EMBEDDED, origin: 'in-process' })
  }

  const defaultEntry = sessions.get(defaultSession)
  if (defaultEntry === undefined) throw new Error('owner document runtime default target registration failed')
  const runtime = {
    kind: OWNER_PERSISTENCE,
    persistence: Object.freeze({ kind: OWNER_PERSISTENCE, ownerId }),
    statePath: ownerDocumentPath,
    ownerDocumentPath,
    store: defaultEntry.view,
    session: defaultSession,
    runtimeId: () => runtimeId,
    epoch: () => epoch,
    record,
    openPigSession,
    addPigTarget,
    storeForSession(binding) { return selectTargetSession(binding).view },
    stateForSession(binding) {
      const entry = selectTargetSession(binding)
      const state = entry.store.state
      return state === null ? null : composeLegacyState(splitLegacyState(state))
    },
    mountRoutes,
    handle,
    dispatchCommand(command, input, binding = defaultSession) {
      assertHealthy()
      const entry = selectTargetSession(binding)
      const result = dispatch(entry.store, command, input)
      if (fault !== null) throw Object.assign(new Error('owner document revision conflict; reopen before issuing another command'), { status: 409 })
      if (result?.kind !== 'error') epoch += 1
      return result
    },
    acceptWorkEvent,
    configureCloudSave() { return Promise.resolve({ ok: false, reason: 'owner-document mode does not support cloud saves' }) },
    testCloudSave() { return Promise.resolve({ ok: false, reason: 'owner-document mode does not support cloud saves' }) },
    metadata() { return { persistence: OWNER_PERSISTENCE, ownerId, targets: targetById.size } },
    dispose() {
      if (disposePromise !== null) return disposePromise
      if (closed) return Promise.resolve({ localPersisted: true, cloudPush: 'disabled' })
      accepting = false
      disposePromise = (async () => {
        await Promise.allSettled([...activeRouteTasks])
        if (fault === null) for (const store of ownerStores.values()) store.flush()
        for (const store of ownerStores.values()) store.dispose()
        for (const session of sessions.keys()) session.dispose()
        for (const unmount of [...mountedRoutes]) unmount()
        owner.dispose()
        closed = true
        return { localPersisted: true, cloudPush: 'disabled' }
      })().catch(error => {
        accepting = true
        disposePromise = null
        throw error
      })
      return disposePromise
    },
  }
  bindRuntimeSession(runtime, defaultSession)
  return runtime
}
