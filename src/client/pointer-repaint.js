// @ts-check
/** 快照留到按下、松开和 click 完成后应用，保留用户按住的 DOM。 */
/** @param {EventTarget} root @param {EventTarget} events */
export function attachPointerRepaint(root, events) {
  let held = false, readyAt = 0, timer = null
  /** @type {{run: (snapshot?: any) => void, snapshot?: any, hasSnapshot: boolean}|null} */
  let pending = null
  function mergeSnapshots(previous, next) {
    const merged = { ...next }
    if (Array.isArray(previous?.pending) || Array.isArray(next?.pending)) {
      merged.pending = [...(Array.isArray(previous?.pending) ? previous.pending : []),
        ...(Array.isArray(next?.pending) ? next.pending : [])]
    }
    return merged
  }
  function schedule() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (held || pending === null) return
    timer = setTimeout(() => {
      timer = null
      const task = pending; pending = null
      if (task !== null) task.run(task.hasSnapshot ? task.snapshot : undefined)
    }, Math.max(0, readyAt - Date.now()))
  }
  function down() { held = true; schedule() }
  function up() {
    if (!held) return
    held = false; readyAt = Date.now() + 150; schedule()
  }
  function blur() { held = false; readyAt = 0; schedule() }
  root.addEventListener('pointerdown', down, true)
  events.addEventListener('pointerup', up, true)
  events.addEventListener('pointercancel', blur, true)
  events.addEventListener('blur', blur)
  return {
    /**
     * Keep the old callback-only, latest-wins form for other callers. When a
     * snapshot is supplied, keep its newest state while accumulating pending
     * events until the protected pointer interaction has finished.
     * @param {(snapshot?: any) => void} run
     * @param {any} [snapshot]
     */
    defer(run, snapshot) {
      const hasSnapshot = arguments.length > 1
      if (!held && Date.now() >= readyAt && pending === null) return false
      if (hasSnapshot) {
        const accumulated = pending?.hasSnapshot ? mergeSnapshots(pending.snapshot, snapshot) : snapshot
        pending = { run, snapshot: accumulated, hasSnapshot: true }
      } else pending = { run, snapshot: undefined, hasSnapshot: false }
      schedule()
      return true
    },
    dispose() {
      if (timer !== null) clearTimeout(timer)
      pending = null
      root.removeEventListener('pointerdown', down, true)
      events.removeEventListener('pointerup', up, true)
      events.removeEventListener('pointercancel', blur, true)
      events.removeEventListener('blur', blur)
    },
  }
}
