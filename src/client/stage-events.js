// @ts-check
/** Stage window events, including the same editable/modal Escape rules as split views. */
function editable(target) {
  for (let node = target; node; node = node.parentElement) {
    if (['input', 'textarea', 'select'].includes(String(node.tagName || '').toLowerCase())) return true
    if (node.isContentEditable || node.getAttribute?.('role') === 'textbox') return true
    if (['', 'true', 'plaintext-only'].includes(node.getAttribute?.('contenteditable'))) return true
  }
  return false
}

export function bindStageEvents(target, ctx, setOpen, onPointerUp, onResize) {
  const doc = target.document ?? document
  function escape(event) {
    if (event.key !== 'Escape' || event.repeat || event.defaultPrevented || !ctx.isOpen) return
    if (editable(event.target) || editable(doc.activeElement)) return
    for (const layer of doc.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-farm-overlay]')) {
      if (layer.getClientRects().length === 0) continue
      if (!['hidden', 'collapse'].includes(target.getComputedStyle(layer).visibility)) return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    setOpen(false)
  }
  target.addEventListener('keydown', escape)
  target.addEventListener('pointerup', onPointerUp, true)
  target.addEventListener('pointercancel', onPointerUp, true)
  target.addEventListener('resize', onResize, { passive: true })
  return () => {
    target.removeEventListener('keydown', escape)
    target.removeEventListener('pointerup', onPointerUp, true)
    target.removeEventListener('pointercancel', onPointerUp, true)
    target.removeEventListener('resize', onResize)
  }
}
