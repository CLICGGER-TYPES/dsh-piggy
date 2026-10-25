/** Keep a farm trigger, puzzle cell or diary disclosure focused when panel polling replaces its DOM. */
export function preserveFarmTriggerFocus(content, paint) {
  const doc = content.ownerDocument || (typeof document === 'undefined' ? null : document)
  if (!doc) return paint()
  const active = doc.activeElement
  if (!content.contains(active)) return paint()
  // data-puzzle-cell is the extension's own namespace; never match the generic data-cell.
  const key = ['data-farm-item', 'data-farm-plot', 'data-puzzle-cell', 'data-diary-care'].map(attr => ({ attr, value: active.getAttribute?.(attr) })).find(entry => entry.value !== null && entry.value !== undefined)
  const result = paint()
  if (!key) return result
  const next = doc.activeElement
  if (content.contains(next) || next !== null && next !== undefined && next !== doc.body && next !== active) return result
  if (next === active && content.contains(active)) return result
  const target = Array.from(content.querySelectorAll('[data-farm-item], [data-farm-plot], [data-puzzle-cell], [data-diary-care]')).find(node =>
    node.tagName?.toLowerCase() === 'button' && !node.disabled && node.getAttribute(key.attr) === key.value)
  if (target) target.focus({ preventScroll: true })
  return result
}
