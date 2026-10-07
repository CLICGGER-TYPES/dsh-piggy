// @ts-check
/** Cumulative reports make repeated checkpoint/reload settlement idempotent. */
import { EXTENSION_EVENTS, EXTENSION_EVENT_LIMITS } from '../data/extension-events.js'
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
const validCount = value => Number.isSafeInteger(value) && value >= 0
const count = value => validCount(value) ? value : 0
const itemKey = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(value)
const fieldsFor = (source, name) => Object.hasOwn(EXTENSION_EVENTS, source) && Object.hasOwn(EXTENSION_EVENTS[source], name) ? EXTENSION_EVENTS[source][name] : null

/** Validate reports before they enter an action transaction.
 * @param {string} source @param {string} name @param {unknown} payload
 * @returns {object|null} */
export function validateExtensionEvent(source, name, payload) {
  const fields = fieldsFor(source, name)
  if (fields === null || payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null
  const raw = /** @type {any} */ (payload)
  if (Object.keys(raw).some(key => !fields.includes(key))) return null
  const event = { name }
  for (const field of fields) {
    if (field === 'items') {
      if (!Array.isArray(raw.items) || raw.items.length > EXTENSION_EVENT_LIMITS.items || !raw.items.every(itemKey)) return null
      event.items = [...new Set(raw.items)].sort()
    } else {
      if (!validCount(raw[field])) return null
      event[field] = raw[field]
    }
  }
  return event
}

function cleanRecord(raw) {
  const record = object(raw)
  return { total: count(record.total), seen: count(record.seen), maximum: count(record.maximum),
    items: [...new Set(Array.isArray(record.items) ? record.items.filter(itemKey) : [])].sort().slice(0, EXTENSION_EVENT_LIMITS.items) }
}

/** Sanitize only known sources/events; optional save data needs no version bump.
 * @param {any} state @returns {object} */
export function ensureExtensionEvents(state) {
  const saved = object(state.achievements)
  const raw = object(saved.events)
  const events = {}
  for (const [source, definitions] of Object.entries(EXTENSION_EVENTS)) {
    if (!Object.hasOwn(raw, source)) continue
    events[source] = {}
    for (const name of Object.keys(definitions)) {
      if (Object.hasOwn(object(raw[source]), name)) events[source][name] = cleanRecord(raw[source][name])
    }
  }
  saved.events = events
  state.achievements = saved
  return events
}

/** Called by the host only after the extension action has succeeded.
 * @param {any} state @param {string} source @param {any} event @returns {boolean} */
export function recordExtensionEvent(state, source, event) {
  const { name, ...payload } = object(event)
  const checked = validateExtensionEvent(source, name, payload)
  if (checked === null) return false
  const events = ensureExtensionEvents(state)
  const stream = events[source] ?? (events[source] = {})
  const record = stream[name] ?? (stream[name] = cleanRecord(null))
  if (checked.total !== undefined) {
    const delta = Math.max(0, checked.total - record.seen)
    record.total = Math.min(EXTENSION_EVENT_LIMITS.count, record.total + delta)
    record.seen = Math.max(record.seen, checked.total)
  }
  if (checked.maximum !== undefined) record.maximum = Math.max(record.maximum, checked.maximum)
  if (checked.items !== undefined) record.items = [...new Set([...record.items, ...checked.items])].sort().slice(0, EXTENSION_EVENT_LIMITS.items)
  return true
}

/** Read-only progress; callers need not understand private extension saves.
 * @param {any} state @param {any} item @returns {number} */
export function extensionEventProgress(state, item) {
  const record = cleanRecord(state?.achievements?.events?.[item.extension]?.[item.event])
  return item.mode === 'kinds' ? record.items.length : item.mode === 'maximum' ? record.maximum : record.total
}

/** A genuinely new installation/generation starts a new counter baseline.
 * @param {any} state @param {string} [source] */
export function resetExtensionEventBaselines(state, source) {
  if (state.achievements === undefined) return
  const events = ensureExtensionEvents(state)
  for (const [key, stream] of Object.entries(events)) {
    if (source !== undefined && key !== source) continue
    for (const record of Object.values(stream)) record.seen = 0
  }
}
