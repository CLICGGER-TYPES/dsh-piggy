// @ts-check
/**
 * 外部模式的工作事件 outbox：持久化、7 天窗口、2048 条 / 512 KiB 上限。
 *
 * 只存协议五字段；丢弃时保留「按类型/按天」的计数摘要用于告知，不伪造事件。
 * 原子写、250ms 防抖；队列满时保留最新、丢最旧（#14 5.4）。
 *
 * @module dsh-piggy/adapters/dsh/external-outbox
 */

import { existsSync, readFileSync, renameSync } from 'node:fs'

import { outboxPath, readJson, removeFile, writeJsonAtomic } from './external-files.js'

const VERSION = 1
const MAX_EVENTS = 2048
const MAX_BYTES = 512 * 1024
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const SAVE_DEBOUNCE_MS = 250

const sizeOf = events => Buffer.byteLength(JSON.stringify({ version: VERSION, events }))

function emptyDropped() {
  return { count: 0, types: {}, days: {} }
}

/** 丢弃摘要：按天（本地日期）和类型各记一笔。 */
function noteDropped(dropped, event, count, now) {
  dropped.count += count
  const type = typeof event?.type === 'string' ? event.type : 'unknown'
  dropped.types[type] = (dropped.types[type] ?? 0) + count
  const day = new Date(now()).toISOString().slice(0, 10)
  dropped.days[day] = (dropped.days[day] ?? 0) + count
}

function validEvent(value) {
  return value !== null && typeof value === 'object' && value.version === 1 &&
    typeof value.source === 'string' && typeof value.id === 'string' &&
    ['message', 'turn', 'tool', 'toolError', 'agentError'].includes(value.type) &&
    Number.isSafeInteger(value.at) && value.at >= 0
}

/**
 * @param {{statePath:string, now?:()=>number, setTimer?:Function, clearTimer?:Function, warn?:Function}} options
 */
export function createOutbox(options) {
  const statePath = options.statePath
  const now = options.now ?? (() => Date.now())
  const setTimer = options.setTimer ?? setTimeout
  const clearTimer = options.clearTimer ?? clearTimeout
  const warn = options.warn ?? (() => {})
  const file = outboxPath(statePath)
  let events = []
  let dropped = emptyDropped()
  let paused = false
  let timer = null
  let dirty = false
  const listeners = new Set()

  function load() {
    if (!existsSync(file)) return
    const read = readJson(file)
    if (!read.ok) {
      try { renameSync(file, `${file}.corrupt-${now()}`) } catch { /* evidence kept by rename failure */ }
      warn('[dsh-piggy] outbox unreadable; kept a copy and started empty')
      return
    }
    if (read.value?.version !== VERSION || !Array.isArray(read.value.events)) {
      try { renameSync(file, `${file}.corrupt-${now()}`) } catch { /* evidence kept */ }
      warn('[dsh-piggy] outbox schema invalid; kept a copy and started empty')
      return
    }
    const cutoff = now() - WINDOW_MS
    let expired = 0
    events = []
    for (const event of read.value.events) {
      if (!validEvent(event)) continue
      if (event.at < cutoff) { expired += 1; continue }
      events.push(event)
    }
    dropped = read.value.dropped !== null && typeof read.value.dropped === 'object'
      ? { count: Number.isFinite(read.value.dropped.count) ? read.value.dropped.count : 0,
          types: read.value.dropped.types ?? {}, days: read.value.dropped.days ?? {} }
      : emptyDropped()
    if (expired > 0) noteDropped(dropped, { type: 'expired' }, expired, now)
    enforceLimits()
    notify()
  }

  function notify() { for (const listener of listeners) { try { listener(status()) } catch { /* noop */ } } }

  function schedule() {
    dirty = true
    if (timer !== null) return
    timer = setTimer(() => { timer = null; persist() }, SAVE_DEBOUNCE_MS)
    timer?.unref?.()
  }

  function persist() {
    if (!dirty) return
    writeJsonAtomic(file, { version: VERSION, events, dropped })
    dirty = false
  }

  function enforceLimits() {
    const cutoff = now() - WINDOW_MS
    const fresh = events.filter(event => event.at >= cutoff)
    if (fresh.length !== events.length) {
      noteDropped(dropped, { type: 'expired' }, events.length - fresh.length, now)
      events = fresh
    }
    while (events.length > MAX_EVENTS || sizeOf(events) > MAX_BYTES) {
      const removed = events.shift()
      if (removed === undefined) break
      noteDropped(dropped, removed, 1, now)
    }
  }

  function status() {
    return {
      queued: events.length,
      bytes: sizeOf(events),
      paused,
      dropped: { count: dropped.count, types: { ...dropped.types }, days: { ...dropped.days } },
      oldestAt: events.length > 0 ? events[0].at : null,
    }
  }

  return {
    load,
    add(event) {
      if (!validEvent(event)) return { ok: false, reason: 'invalid-event' }
      events.push(event)
      enforceLimits()
      schedule()
      notify()
      return { ok: true, queued: events.length }
    },
    head() { return events.length > 0 ? events[0] : null },
    shift() {
      const removed = events.shift()
      if (removed !== undefined) { schedule(); notify() }
      return removed ?? null
    },
    /** 因 422/过期丢弃队首：只记摘要，不伪造事件。 */
    dropHead(reason = 'dropped') {
      const removed = events.shift()
      if (removed !== undefined) {
        noteDropped(dropped, { ...removed, type: reason === 'expired' ? 'expired' : removed.type }, 1, now)
        schedule(); notify()
      }
      return removed ?? null
    },
    clear() {
      const count = events.length
      events = []
      dropped = emptyDropped()
      dirty = true
      persist()
      notify()
      return count
    },
    pause() { paused = true; notify() },
    resume() { paused = false; notify() },
    status,
    flush() { if (timer !== null) { clearTimer(timer); timer = null } persist() },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    get events() { return events.slice() },
    get file() { return file },
    removeFile() { removeFile(file) },
  }
}

/** 给 DSH 路由和测试用的上限常量。 */
export const OUTBOX_LIMITS = Object.freeze({ maxEvents: MAX_EVENTS, maxBytes: MAX_BYTES, windowMs: WINDOW_MS })
