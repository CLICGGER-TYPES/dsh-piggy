// @ts-check
/** A short, bounded, deduplicated log window for startup-only state traces. */
const WINDOW_MS = 20_000
const MAX_ENTRIES = 16

/** @param {(...parts: any[]) => unknown} log @param {() => number} [now] */
export function createStartupTrace(log, now = Date.now) {
  let deadline = null
  let entries = 0
  const seen = new Set()

  function begin() {
    if (deadline !== null) return false
    deadline = now() + WINDOW_MS
    return true
  }

  /** @param {string} key @param {...any} parts */
  function record(key, ...parts) {
    if (deadline === null || now() >= deadline || entries >= MAX_ENTRIES || seen.has(key)) return false
    seen.add(key)
    entries += 1
    try { log(...parts) } catch { /* diagnostics must not change application behavior */ }
    return true
  }

  return { begin, record }
}
