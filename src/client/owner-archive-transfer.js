// @ts-check
/** Desktop-only complete OwnerDocument archive controls. */
import { button, el } from './dom.js'
import { desktopShell } from './desktop-shell.js'

const EXPORTING = '正在导出…'
const IMPORTING = '正在导入并切换…'
const ownerState = {
  status: null,
  statusPromise: null,
  open: false,
  busy: false,
  loading: false,
  preview: null,
  acknowledgeWarnings: false,
  error: '',
  ui: null,
  generation: 0,
  keyHandler: null,
}

/** @returns {any|null} */
export function ownerArchiveStatus() { return ownerState.status }

function rerender() { ownerState.ui?.renderContent?.() }

function notify(ui, text, ms = 4000) {
  if (typeof ui?.showBubble === 'function') ui.showBubble(text, ms)
}

function requestStatus(ui) {
  if (ownerState.statusPromise !== null) return
  const api = desktopShell()?.ownerArchives
  if (!api || typeof api.status !== 'function') return
  ownerState.statusPromise = Promise.resolve(api.status()).then(result => {
    ownerState.status = result?.ok === true ? result : { ok: false, available: false }
  }, () => { ownerState.status = { ok: false, available: false } }).finally(() => {
    ownerState.statusPromise = null
    if (ownerState.ui === ui) rerender()
  })
}

async function exportArchive(ui) {
  if (ownerState.busy) return
  const api = desktopShell()?.ownerArchives
  if (!api) return
  ownerState.busy = true
  rerender()
  try {
    const result = await api.export()
    if (result?.canceled) return
    if (result?.ok !== true) throw new Error(result?.reason || '完整存档导出失败')
    notify(ui, '完整存档已导出')
  } catch (error) {
    notify(ui, '完整存档没导出：' + (error instanceof Error ? error.message : '请稍后重试'), 5000)
  } finally {
    ownerState.busy = false
    rerender()
  }
}

function closeDialog() {
  const ui = ownerState.ui
  ownerState.generation += 1
  ownerState.open = false
  ownerState.loading = false
  ownerState.busy = false
  ownerState.preview = null
  ownerState.acknowledgeWarnings = false
  ownerState.error = ''
  if (ownerState.keyHandler && typeof document === 'object') document.removeEventListener('keydown', ownerState.keyHandler, true)
  ownerState.keyHandler = null
  rerender()
  ui?.content?.querySelector?.('[data-owner-archive-import="true"]')?.focus?.()
}

function installEscape() {
  if (ownerState.keyHandler || typeof document !== 'object') return
  ownerState.keyHandler = event => {
    if (!ownerState.open || event.key !== 'Escape' || ownerState.busy || ownerState.loading) return
    event.preventDefault()
    closeDialog()
  }
  document.addEventListener('keydown', ownerState.keyHandler, true)
}

async function previewFile(file) {
  if (!file || ownerState.busy) return
  const generation = ++ownerState.generation
  ownerState.loading = true
  ownerState.preview = null
  ownerState.acknowledgeWarnings = false
  ownerState.error = ''
  rerender()
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (generation !== ownerState.generation) return
    const result = await desktopShell()?.ownerArchives?.preview(bytes)
    if (generation !== ownerState.generation) return
    if (result?.ok !== true || typeof result.token !== 'string' || !result.summary) {
      throw new Error(result?.reason || '这不是可用的完整存档')
    }
    ownerState.preview = result
  } catch (error) {
    if (generation === ownerState.generation) ownerState.error = '没能读取这个完整存档：' + (error instanceof Error ? error.message : '文件无效')
  } finally {
    if (generation === ownerState.generation) {
      ownerState.loading = false
      rerender()
    }
  }
}

async function importAndSwitch(ui) {
  if (ownerState.busy || !ownerState.preview) return
  const token = ownerState.preview.token
  ownerState.busy = true
  ownerState.error = ''
  rerender()
  try {
    const result = await desktopShell()?.ownerArchives?.importAndSwitch(token, { acceptWarnings: ownerState.acknowledgeWarnings })
    if (result?.ok !== true) {
      const prefix = result?.imported === true ? '副本已建立，但没有切换。' : '导入没有完成。'
      throw new Error(prefix + (result?.reason || '当前存档保持不变'))
    }
    closeDialog()
    notify(ui, '正在保存当前存档并切换到新副本…', 5000)
  } catch (error) {
    ownerState.error = error instanceof Error ? error.message : '导入没有完成，当前存档保持不变'
    ownerState.busy = false
    rerender()
  }
}

/** @param {HTMLElement} parent @param {string} label @param {string} value */
function summaryRow(parent, label, value) {
  const row = el('div', 'dp-set-head')
  row.appendChild(el('b', null, label))
  row.appendChild(el('small', 'dp-dim', value))
  parent.appendChild(row)
}

function count(value) { return Number.isSafeInteger(value) && value >= 0 ? value : null }

function gardenSummary(garden) {
  if (!garden || typeof garden !== 'object') return '未包含菜园数据'
  const unlocked = count(garden.unlocked), planted = count(garden.planted)
  if (unlocked === null && planted === null) return '已包含菜园资料'
  return `已开垦 ${unlocked ?? '—'} 块 · 种植中 ${planted ?? '—'} 块`
}

function renderPreviewDialog(ui) {
  const overlay = el('div', 'dp-save-overlay')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(70,48,25,.38);padding:12px;box-sizing:border-box'
  const dialog = el('div', 'dp-set')
  dialog.style.cssText = 'width:min(292px,100%);max-height:90vh;overflow:auto;background:var(--ac-bg-content);border:2px solid var(--ac-border);border-radius:var(--ac-radius-card);padding:12px;box-shadow:var(--ac-shadow-lg)'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', '导入完整档预览')
  dialog.setAttribute('data-owner-archive-dialog', 'true')
  dialog.tabIndex = -1
  overlay.appendChild(dialog)
  dialog.appendChild(el('b', null, '导入完整档预览'))

  if (ownerState.loading) {
    dialog.appendChild(el('p', 'dp-dim', '正在检查完整存档…'))
  } else if (ownerState.preview) {
    const summary = ownerState.preview.summary
    const pigs = Array.isArray(summary.pigs) ? summary.pigs : []
    const pigCount = count(summary.pigCount) ?? pigs.length
    const pigTitle = el('b', 'dp-set-head', `包含 ${pigCount} 只小猪`)
    dialog.appendChild(pigTitle)
    for (const [index, pig] of pigs.entries()) {
      const name = typeof pig?.name === 'string' && pig.name.trim() ? pig.name : `小猪 ${index + 1}`
      const details = []
      const ageMs = typeof pig?.ageMs === 'number' && Number.isFinite(pig.ageMs) && pig.ageMs >= 0 ? pig.ageMs : null
      const xp = count(pig?.xp)
      const weight = typeof pig?.weightG === 'number' && Number.isFinite(pig.weightG) && pig.weightG >= 0 ? pig.weightG : null
      if (ageMs !== null) details.push(`成长 ${(ageMs / 86_400_000).toFixed(1)} 天`)
      if (xp !== null) details.push(`经验 ${xp}`)
      if (weight !== null) details.push(`体重 ${weight} 克`)
      if (count(pig?.wornCount) !== null) details.push(`穿戴 ${pig.wornCount} 件`)
      summaryRow(dialog, name, details.length ? details.join(' · ') : '包含独立成长与数值')
    }
    if (pigCount > pigs.length) dialog.appendChild(el('p', 'dp-dim', `列表显示前 ${pigs.length} 只；其余 ${pigCount - pigs.length} 只也包含在完整档中。`))
    dialog.appendChild(el('b', 'dp-set-head', '共享资产'))
    const shared = summary.shared ?? {}
    const coins = typeof shared.coins === 'number' && Number.isFinite(shared.coins)
      ? new Intl.NumberFormat('zh-CN').format(shared.coins) : '未记录'
    summaryRow(dialog, '金币', coins)
    const inventoryCount = count(shared.inventoryCount)
    summaryRow(dialog, '背包', inventoryCount === null ? '未记录' : `${inventoryCount} 件物品`)
    summaryRow(dialog, '菜园', gardenSummary(shared.garden))
    dialog.appendChild(el('p', 'dp-dim', '本机显示与声音偏好保留在此设备，不随存档覆盖。'))
    dialog.appendChild(el('p', 'dp-dim', '将建立独立存档副本，当前存档保留；导入后切换到新副本并重启应用。'))
    const warnings = Array.isArray(ownerState.preview.warnings) ? ownerState.preview.warnings : []
    for (const warning of warnings) {
      dialog.appendChild(el('div', 'dp-alert dp-legacy', String(warning)))
    }
    if (warnings.length > 0) {
      const label = el('label', 'dp-dim')
      const check = el('input')
      check.type = 'checkbox'
      check.style.cssText = 'width:auto;margin:0 6px 0 0;accent-color:var(--animal-primary)'
      check.checked = ownerState.acknowledgeWarnings
      check.setAttribute('data-owner-archive-warnings', 'true')
      check.addEventListener('change', () => {
        ownerState.acknowledgeWarnings = check.checked
        rerender()
      })
      label.appendChild(check)
      label.appendChild(el('span', null, '我已阅读提示，仍要导入'))
      dialog.appendChild(label)
    }
  } else {
    dialog.appendChild(el('p', 'dp-dim', '选择完整存档 ZIP。选取后只检查和预览，不会修改当前存档。'))
    const picker = el('input', 'dp-input')
    picker.type = 'file'
    picker.accept = '.zip,application/zip'
    picker.setAttribute('data-owner-archive-file', 'true')
    picker.setAttribute('aria-label', '选择完整存档 ZIP')
    picker.addEventListener('change', () => { const file = picker.files?.[0]; if (file) void previewFile(file) })
    picker.addEventListener('cancel', closeDialog)
    dialog.appendChild(picker)
  }

  if (ownerState.error) dialog.appendChild(el('div', 'dp-alert dp-dead', ownerState.error))
  const actions = el('div', 'dp-actions')
  const cancel = button('dp-btn', { 'data-owner-archive-cancel': 'true' }, closeDialog)
  cancel.textContent = '取消'
  cancel.disabled = ownerState.busy
  actions.appendChild(cancel)
  if (ownerState.preview) {
    const confirm = button('dp-mini', { 'data-owner-archive-confirm': 'true' }, () => { void importAndSwitch(ui) })
    confirm.textContent = ownerState.busy ? IMPORTING : '导入并切换'
    confirm.disabled = ownerState.busy || (Array.isArray(ownerState.preview.warnings) && ownerState.preview.warnings.length > 0 && !ownerState.acknowledgeWarnings)
    actions.appendChild(confirm)
  }
  dialog.appendChild(actions)
  ui.content.appendChild(overlay)
  if (document.activeElement === document.body || !dialog.contains(document.activeElement)) (dialog.querySelector('input') || dialog).focus()
}

/** @param {any} ui @param {(ui:any,title:string,note:string)=>{box:HTMLElement,head:HTMLElement}} section */
export function renderOwnerArchiveSettings(ui, section) {
  ownerState.ui = ui
  const shell = desktopShell()
  if (typeof shell?.ownerArchives?.status !== 'function') return
  if (ownerState.status === null) { requestStatus(ui); return }
  if (ownerState.status.available !== true) return

  const transfer = section(ui, '全部小猪与共享资产', ownerState.status.mode === 'owner'
    ? '完整档包含当前存档中的所有小猪与共用资源'
    : '当前存档只有这只小猪；完整档会包含它与共用资源')
  const actions = el('div', 'dp-actions')
  const exportButton = button('dp-mini', { 'data-owner-archive-export': 'true' }, () => { void exportArchive(ui) })
  exportButton.textContent = ownerState.busy ? EXPORTING : '导出完整档'
  exportButton.disabled = ownerState.busy || !ui.view?.pig
  const importButton = button('dp-mini', { 'data-owner-archive-import': 'true' }, () => {
    if (ownerState.busy || ownerState.loading) return
    ownerState.open = true
    ownerState.preview = null
    ownerState.error = ''
    rerender()
    installEscape()
    ui.content.querySelector('[data-owner-archive-file="true"]')?.click()
  })
  importButton.textContent = '导入完整档'
  importButton.disabled = ownerState.busy || ownerState.loading
  actions.appendChild(exportButton)
  actions.appendChild(importButton)
  transfer.box.appendChild(actions)
  transfer.box.appendChild(el('p', 'dp-dim', '导入会建立独立存档副本并切换到新副本；当前存档保留，本机显示与声音偏好不覆盖。'))

  if (ownerState.open) {
    transfer.box.setAttribute('data-owner-archive-transfer-active', 'true')
    renderPreviewDialog(ui)
  }
}
