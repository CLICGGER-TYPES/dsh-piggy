/** Keep a button/trigger focused when panel polling replaces its DOM. */
const FOCUS_ATTRS = ['data-farm-item', 'data-farm-plot', 'data-puzzle-cell', 'data-diary-care', 'data-fish-auto', 'data-fish-gear', 'data-op', 'data-switch-go', 'data-app', 'data-bait']

function walk(node, visit) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function contains(root, node) {
  for (let at = node; at; at = at.parentElement ?? at.parentNode) if (at === root) return true
  return false
}

export function preserveFarmTriggerFocus(content, paint) {
  const doc = content.ownerDocument || (typeof document === 'undefined' ? null : document)
  if (!doc) return paint()
  const active = doc.activeElement
  if (!active || !contains(content, active)) return paint()
  const key = FOCUS_ATTRS.map(attr => ({ attr, value: active.getAttribute?.(attr) })).find(entry => entry.value !== null && entry.value !== undefined)
  const result = paint()
  if (!key) return result
  const next = doc.activeElement
  // paint 自己把焦点交给了宿主其他控件：不要抢回旧按钮。
  if (contains(content, next) || (next && next !== doc.body && next !== active)) return result
  const found = []
  walk(content, node => {
    if (found.length === 0 && node.tagName?.toLowerCase() === 'button' && !node.disabled && node.getAttribute(key.attr) === key.value) found.push(node)
  })
  if (found.length > 0) found[0].focus({ preventScroll: true })
  return result
}
