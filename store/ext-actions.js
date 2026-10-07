// @ts-check
/** Progress is staged alongside money/inventory; refusal never commits either. */
import { ensureExtensions, extensionOn, recordExtensionEvent, settleAchievements, validateExtensionEvent } from '../core.js'
import { EXTENSION_EVENT_LIMITS } from '../packages/pet-core/src/data/extension-events.js'
import { apiFor } from './ext-api.js'

/** @param {string} key @returns {object} */
function reporter(key) {
  const events = []
  return {
    emit(name, payload) {
      const event = validateExtensionEvent(key, name, payload)
      if (event === null || events.length >= EXTENSION_EVENT_LIMITS.batch) return false
      events.push(event)
      return true
    },
    commit(state) { for (const event of events) recordExtensionEvent(state, key, event) },
  }
}

/** Optional read-only historical hook; called at load/update, never in view().
 * @param {any} store @param {any} entry @param {{key:string, nowMs:number}} context */
export function backfillExtensionEvents(store, entry, context) {
  if (typeof entry?.module?.progress !== 'function' || store.state?.extData?.[context.key] === undefined) return
  store.mutate(state => {
    const reports = entry.module.progress(structuredClone(state.extData[context.key]))
    if (!Array.isArray(reports) || reports.length > EXTENSION_EVENT_LIMITS.batch) throw new Error('Invalid extension progress: ' + context.key)
    for (const event of reports) {
      if (!recordExtensionEvent(state, context.key, event)) throw new Error('Invalid extension progress event: ' + context.key)
    }
    settleAchievements(state, context.nowMs, { silent: true })
    return { ok: true }
  })
}

/** Synchronous extension actions execute against a private transaction copy.
 * @param {any} state @param {any} handler @param {any} context @returns {object} */
export function runExtensionAction(state, handler, context) {
  ensureExtensions(state)
  if (state.extData[context.key] === undefined) return { ok: false, reason: 'not-installed' }
  if (!extensionOn(state, context.key)) return { ok: false, reason: 'extension-off' }
  const working = structuredClone(state)
  const reports = reporter(context.key)
  let result
  try {
    result = handler(working.extData[context.key], context.payload ?? {}, apiFor(working, context.key, { nowMs: context.nowMs, emit: reports.emit }))
    if (typeof result?.then === 'function') {
      Promise.resolve(result).catch(error => console.warn('[dsh-piggy] rejected async extension action: key=' + context.key + ' reason=' + String(error)))
      throw new Error('Extension actions must be synchronous')
    }
    if (result?.ok === false) return result
    reports.commit(working)
  } catch (error) {
    return { ok: false, reason: 'extension-error', message: error instanceof Error ? error.message : String(error) }
  }
  Object.assign(state, working)
  return result !== null && typeof result === 'object' ? { ...result, ok: true } : { ok: true }
}
