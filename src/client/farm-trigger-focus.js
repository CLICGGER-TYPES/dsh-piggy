/** Keep a farm shop item or plot focused when panel polling replaces its DOM. */
export function preserveFarmTriggerFocus(content, paint) {
  const doc = content.ownerDocument || (typeof document === 'undefined' ? null : document)
  if (!doc) return paint()
  const active = doc.activeElement
  if (!content.contains(active)) return paint()
  const key = ['data-farm-item', 'data-farm-plot'].map(attr => ({ attr, value: active.getAttribute?.(attr) })).find(entry => entry.value !== null && entry.value !== undefined)
  const result = paint()
  if (!key) return result
  const next = doc.activeElement
  if (content.contains(next) || next !== null && next !== undefined && next !== doc.body && next !== active) return result
  if (next === active && content.contains(active)) return result
  const target = Array.from(content.querySelectorAll('[data-farm-item], [data-farm-plot]')).find(node =>
    node.tagName?.toLowerCase() === 'button' && !node.disabled && node.getAttribute(key.attr) === key.value)
  if (target) target.focus({ preventScroll: true })
  return result
}
