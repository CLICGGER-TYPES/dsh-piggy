// @ts-check
/** 按下到松开期间保留真实按钮，轮询重绘等点击事件处理完再执行，避免浏览器丢 click。 */

/** @param {HTMLElement} card @param {any} [environment] */
export function createRenderHold(card, environment = window) {
  const active = new Set()
  let pending = null
  let frame = null
  let isDisposed = false

  function schedule() {
    if (active.size || !pending || frame !== null || isDisposed) return
    frame = environment.requestAnimationFrame(() => {
      frame = null
      if (active.size || !pending || isDisposed) return
      const render = pending
      pending = null
      render()
    })
  }
  function down(event) { if (event.button === 0) active.add(event.pointerId) }
  function up(event) { active.delete(event.pointerId); schedule() }
  function blur() { active.clear(); schedule() }

  card.addEventListener('pointerdown', down, true)
  environment.addEventListener?.('pointerup', up, true)
  environment.addEventListener?.('pointercancel', up, true)
  environment.addEventListener?.('blur', blur)

  return {
    /** 已经有完整的新快照，但按键还没松开时只保留一次最新重绘。 */
    defer(render) {
      if (active.size) { pending = render; return true }
      // 点击处理自身已经重绘时，不再执行松开前那一次旧的排队重绘。
      pending = null
      if (frame !== null) environment.cancelAnimationFrame(frame)
      frame = null
      return false
    },
    dispose() {
      isDisposed = true
      active.clear()
      pending = null
      if (frame !== null) environment.cancelAnimationFrame(frame)
      card.removeEventListener('pointerdown', down, true)
      environment.removeEventListener?.('pointerup', up, true)
      environment.removeEventListener?.('pointercancel', up, true)
      environment.removeEventListener?.('blur', blur)
    },
  }
}
