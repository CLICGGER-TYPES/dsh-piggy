// @ts-check
/** 快照留到按下、松开和 click 完成后应用，保留用户按住的 DOM。 */
/** @param {EventTarget} root @param {EventTarget} events */
export function attachPointerRepaint(root, events) {
  let held = false, readyAt = 0, pending = null, timer = null
  function schedule() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (held || pending === null) return
    timer = setTimeout(() => {
      timer = null
      const run = pending; pending = null
      run?.()
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
    defer(run) {
      if (!held && Date.now() >= readyAt) return false
      pending = run; schedule(); return true
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
