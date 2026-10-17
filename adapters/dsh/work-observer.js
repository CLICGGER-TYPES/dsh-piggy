// @ts-check
import { randomUUID } from 'node:crypto'

const MAX_RETRY_MS = 5000
const DEFAULT_QUEUE_LIMIT = 128

/** Retain each host callback's identity while the runtime temporarily freezes writes. */
export function createWorkObserver({ accept, source = 'dsh', producer = randomUUID(), now = Date.now,
  setTimer = setTimeout, clearTimer = clearTimeout, warn = (_message) => {}, maxQueue = DEFAULT_QUEUE_LIMIT }) {
  if (typeof accept !== 'function') throw new TypeError('accept must be a function')
  const limit = Number.isSafeInteger(maxQueue) && maxQueue > 0 ? maxQueue : DEFAULT_QUEUE_LIMIT
  const pending = []
  let sequence = 0, attempts = 0, timer = null, disposed = false

  function schedule() {
    if (timer !== null || disposed) return
    const delay = Math.min(MAX_RETRY_MS, 100 * 2 ** Math.min(Math.max(attempts - 1, 0), 6))
    timer = setTimer(() => { timer = null; drain() }, delay)
    timer?.unref?.()
  }

  function drain() {
    if (disposed) return
    while (pending.length > 0) {
      try {
        accept(pending[0])
        pending.shift()
        attempts = 0
      } catch (error) {
        if (error?.status === 503) { attempts += 1; schedule(); return }
        pending.shift()
        attempts = 0
        warn('[dsh-piggy] DSH work event failed; evidence preserved')
      }
    }
  }

  function observe(type) {
    if (disposed) return false
    const event = { version: 1, source, id: `${producer}:${++sequence}`, type, at: now() }
    if (pending.length > 0) {
      if (pending.length >= limit) {
        warn('[dsh-piggy] DSH work event queue full; newest event dropped')
        return false
      }
      pending.push(event)
      return true
    }
    try { accept(event); return true }
    catch (error) {
      if (error?.status === 503) {
        pending.push(event)
        attempts = 1
        schedule()
        return true
      }
      warn('[dsh-piggy] DSH work event failed; evidence preserved')
      return false
    }
  }

  function dispose() {
    if (disposed) return
    disposed = true
    if (timer !== null) clearTimer(timer)
    timer = null
    pending.length = 0
  }

  return { observe, dispose, pendingCount: () => pending.length }
}
