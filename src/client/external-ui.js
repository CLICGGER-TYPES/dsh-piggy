// @ts-check
/**
 * 外部桌宠弹层的共用零件：只搭 DOM，不决定流程。
 *
 * 沿用存读档弹层那套做法（fixed overlay + dp-set 对话框 + dp-actions 按钮），
 * 不另造主菜单或加宽面板；按钮只用 dp-btn / dp-mini 和现有药丸样式。
 * @module dsh-piggy/client/external-ui
 */
import { button, el } from './dom.js'

/** 打开一个居中的弹层，Esc / Tab 焦点收在框里。 */
export function createOverlay(ui, options) {
  const overlay = el('div', 'dp-save-overlay dp-ext-overlay')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(70,48,25,.38);padding:12px;box-sizing:border-box'
  const dialog = el('div', 'dp-set dp-ext-dialog')
  dialog.style.cssText = 'width:min(268px,100%);max-height:90vh;overflow:auto;background:var(--ac-bg-content);border:2px solid var(--ac-border);border-radius:var(--ac-radius-card);padding:12px;box-shadow:var(--ac-shadow-lg)'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', options.label)
  dialog.setAttribute('data-external-dialog', options.step)
  dialog.tabIndex = -1
  overlay.appendChild(dialog)
  ui.content.appendChild(overlay)
  const keyHandler = event => {
    if (!overlay.isConnected && overlay.parentNode === null) return
    if (event.key === 'Escape') {
      if (options.busy === true) return
      event.preventDefault()
      options.onCancel?.()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialog.querySelectorAll?.('button:not([disabled]),input:not([disabled]),select:not([disabled])') || [])
    if (items.length === 0) { event.preventDefault(); dialog.focus?.(); return }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || !dialog.contains(active))) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (active === last || !dialog.contains(active))) { event.preventDefault(); first.focus() }
  }
  if (typeof document === 'object' && document !== null) document.addEventListener('keydown', keyHandler, true)
  return {
    overlay, dialog,
    dispose() {
      if (typeof document === 'object' && document !== null) document.removeEventListener('keydown', keyHandler, true)
      overlay.remove?.()
    },
    focus(selector) {
      const target = dialog.querySelector?.(selector) ?? dialog
      if (target?.focus) target.focus()
    },
  }
}

/** 弹层标题：一行粗体，下面可选一句小字。 */
export function heading(dialog, title, note) {
  dialog.appendChild(el('b', 'dp-ext-title', title))
  if (note !== undefined && note !== '') dialog.appendChild(el('p', 'dp-dim dp-ext-sub', note))
}

/** 一行「标签 — 值」，沿用设置页的 dp-set-head。 */
export function row(parent, label, value) {
  const line = el('div', 'dp-set-head dp-ext-row')
  line.appendChild(el('b', null, label))
  line.appendChild(el('small', 'dp-dim', String(value)))
  parent.appendChild(line)
  return line
}

/** 一段说明或警告；warning 用现有警告色，不新造色。 */
export function note(parent, text, warning) {
  const node = el('div', warning === true ? 'dp-alert dp-legacy dp-ext-warn' : 'dp-ext-note', String(text))
  parent.appendChild(node)
  return node
}

/** 底部按钮排：primary 用 dp-mini，其余用 dp-btn，和存读档弹层一致。 */
export function actions(parent, specs) {
  const rowNode = el('div', 'dp-actions dp-ext-actions')
  for (const spec of specs) {
    if (spec === null || spec === undefined) continue
    const node = button(spec.primary === true ? 'dp-mini' : 'dp-btn', {
      'data-external-action': spec.key,
      ...(spec.attrs ?? {}),
    }, function () { spec.onPick?.() })
    node.textContent = spec.label
    node.disabled = spec.disabled === true
    rowNode.appendChild(node)
  }
  parent.appendChild(rowNode)
  return rowNode
}

/**
 * 单选卡片：整行可点，显示 aria-checked。用卡片圆角而不是额外药丸，
 * 和设置页的分段按钮保持同一套视觉。
 */
export function choiceRow(parent, spec) {
  const node = button('dp-ext-choice', {
    'data-external-choice': spec.key,
    'aria-pressed': String(spec.checked === true),
    role: 'radio',
    'aria-checked': String(spec.checked === true),
  }, function () { spec.onPick?.() })
  node.appendChild(el('span', 'dp-ext-choice-dot', spec.checked === true ? '●' : '○'))
  const copy = el('span', 'dp-ext-choice-copy')
  copy.appendChild(el('b', null, spec.label))
  if (spec.note !== undefined && spec.note !== '') copy.appendChild(el('small', 'dp-dim', spec.note))
  node.appendChild(copy)
  parent.appendChild(node)
  return node
}

/** 一个输入项：小标题 + 输入框 + 可选计数。 */
export function field(parent, spec) {
  const wrap = el('label', 'dp-ext-field')
  wrap.appendChild(el('span', 'dp-ext-field-label', spec.label))
  const input = el('input', 'dp-input dp-setting-field')
  input.value = spec.value ?? ''
  if (spec.type === 'number') { input.type = 'number'; input.min = spec.min ?? ''; input.max = spec.max ?? '' }
  else { input.type = 'text' }
  if (spec.maxLength) input.maxLength = spec.maxLength
  if (spec.placeholder) input.placeholder = spec.placeholder
  input.setAttribute('data-external-field', spec.key)
  input.disabled = spec.disabled === true
  if (spec.onInput) input.addEventListener('input', event => spec.onInput(event?.target?.value ?? input.value))
  wrap.appendChild(input)
  if (spec.maxLength) {
    const counter = el('small', 'dp-ext-counter', String(String(spec.value ?? '').length) + '/' + spec.maxLength)
    wrap.appendChild(counter)
    input.addEventListener('input', function () { counter.textContent = String(input.value.length) + '/' + spec.maxLength })
  }
  parent.appendChild(wrap)
  return input
}

/** 下拉选择；没有候选就禁用，并说明是后端没给可选项。 */
export function select(parent, spec) {
  const wrap = el('label', 'dp-ext-field')
  wrap.appendChild(el('span', 'dp-ext-field-label', spec.label))
  const node = el('select', 'dp-input dp-setting-field dp-ext-select')
  node.setAttribute('data-external-select', spec.key)
  for (const option of spec.options ?? []) {
    const item = el('option', null, option.label)
    item.value = option.key
    if (option.key === spec.value) item.selected = true
    node.appendChild(item)
  }
  node.disabled = spec.disabled === true || (spec.options ?? []).length === 0
  node.addEventListener('change', event => spec.onChange?.(event?.target?.value ?? node.value))
  wrap.appendChild(node)
  parent.appendChild(wrap)
  return node
}

/** 多选（穿戴）：一排小开关，仍然用现成的 dp-switch 视觉。 */
export function checkList(parent, spec) {
  const wrap = el('div', 'dp-ext-field')
  wrap.appendChild(el('span', 'dp-ext-field-label', spec.label))
  const rowNode = el('div', 'dp-ext-checks')
  for (const option of spec.options ?? []) {
    const on = (spec.value ?? []).includes(option.key)
    const node = button('dp-mini dp-mini-plain', { 'data-external-check': option.key, 'aria-pressed': String(on) }, function () { spec.onToggle?.(option.key) })
    node.textContent = (on ? '✓ ' : '') + option.label
    rowNode.appendChild(node)
  }
  wrap.appendChild(rowNode)
  parent.appendChild(wrap)
  return wrap
}
