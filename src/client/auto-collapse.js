// @ts-check
/** Device-local panel preference; old installs default to closing on outside clicks. */
import { readStore, writeStore } from './storage.js'
import { desktopRole } from './desktop-shell.js'

export const AUTO_COLLAPSE_KEY = 'dsh-piggy:auto-collapse'

export function autoCollapseEnabled() {
  return readStore(AUTO_COLLAPSE_KEY) !== 'false'
}

export function setAutoCollapse(enabled) {
  writeStore(AUTO_COLLAPSE_KEY, enabled ? 'true' : 'false')
}

/** Keep outside-click behavior separate from the scene's drag and menu code. */
export function attachAutoCollapse(context) {
  function focusedInput() {
    const active = document.activeElement
    const tag = active?.tagName?.toLowerCase?.() ?? ''
    return tag === 'input' || tag === 'textarea' || active?.getAttribute?.('contenteditable') === 'true'
  }
  function canClose() {
    return context.isOpen() && autoCollapseEnabled() && !context.isDragging()
      && !focusedInput() && !context.isFishing()
  }
  function onOutsidePointer(event) {
    if (!canClose() || event.button !== 0) return
    for (let node = event.target; node !== null && node !== undefined; node = node.parentNode) {
      if (node === context.host) return
    }
    context.setOpen(false)
  }
  function onWindowBlur() {
    // 拆分面板的焦点归属由主进程判定；原生 blur 不知道是否去了大农场。
    if (context.isDesktop() && desktopRole() !== 'panel' && canClose()) context.setOpen(false)
  }
  document.addEventListener('pointerdown', onOutsidePointer, true)
  window.addEventListener?.('blur', onWindowBlur)
  return {
    dispose() {
      document.removeEventListener('pointerdown', onOutsidePointer, true)
      window.removeEventListener?.('blur', onWindowBlur)
    },
  }
}
