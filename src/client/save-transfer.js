// @ts-check
/** Complete-save transfer controls for Settings. */
import { button, el } from './dom.js'
import { desktopShell } from './desktop-shell.js'
import { isExternalMode, MIRROR_NOTE } from './external-link.js'

const EXPORT_URL = '/dsh-piggy/save/export'
const PREVIEW_URL = '/dsh-piggy/save/preview'
const IMPORT_URL = '/dsh-piggy/save/import'

const state = {
  open: false,
  preview: null,
  loading: false,
  busy: false,
  error: '',
  focus: 'cancel',
  ui: null,
  trigger: null,
  controller: null,
  keyHandler: null,
}

const cancelError = error => error?.name === 'AbortError' || error?.name === 'NotAllowedError'
const messageOf = error => error instanceof Error ? error.message : String(error)

function defaultName() {
  const d = new Date(), p = n => String(n).padStart(2, '0')
  return `piggy-save-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.zip`
}

function responseName(response) {
  const value = response.headers?.get?.('content-disposition') || ''
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) { try { return decodeURIComponent(encoded) } catch { /* use plain filename */ } }
  return value.match(/filename="?([^";]+)"?/i)?.[1] || defaultName()
}

async function saveBytes(name, bytes) {
  const shell = desktopShell()
  if (typeof shell?.saves?.save === 'function') {
    const result = await shell.saves.save(name, new Uint8Array(bytes))
    if (result?.ok) return { ok: true }
    if (result?.canceled) return { canceled: true }
    throw new Error(String(result?.reason || '桌面外壳没能保存存档'))
  }
  const picker = typeof window === 'object' ? /** @type {any} */ (window).showSaveFilePicker : null
  if (typeof picker === 'function') {
    let handle = null
    try {
      handle = await picker({ suggestedName: name, types: [{ description: '小猪存档', accept: { 'application/zip': ['.zip'] } }] })
    } catch (error) {
      // AbortError 是用户取消；NotAllowedError/SecurityError 表示选择器存在但这里用不了，继续走普通下载。
      if (error?.name === 'AbortError') return { canceled: true }
    }
    if (handle !== null && handle !== undefined) {
      try {
        const writable = await handle.createWritable()
        await writable.write(bytes)
        await writable.close()
        return { ok: true }
      } catch (error) {
        // 用户已经选好目标路径；写盘失败必须报出来，不能再偷偷下载一份。
        if (error?.name === 'AbortError') return { canceled: true }
        throw error
      }
    }
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { ok: true, downloaded: true }
}

function status(ui, text, ms = 3500) {
  if (typeof ui.showBubble === 'function') ui.showBubble(text, ms)
}

function rerender() {
  if (typeof state.ui?.renderContent === 'function') state.ui.renderContent()
}

async function exportSave(ui) {
  if (state.busy) return
  state.busy = true
  rerender()
  try {
    const response = await fetch(EXPORT_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error(`宿主返回 HTTP ${response.status}`)
    const bytes = await response.arrayBuffer()
    const result = await saveBytes(responseName(response), bytes)
    if (result.canceled) return
    status(ui, result.downloaded ? '存档已下载' : '存档已导出')
  } catch (error) {
    status(ui, '存档没导出：' + messageOf(error), 5000)
  } finally {
    state.busy = false
    rerender()
  }
}

function focusTrigger() {
  const ui = state.ui
  const trigger = ui?.content?.querySelector?.('[data-save-trigger="import"]')
  if (trigger?.focus) trigger.focus()
}

function closeDialog() {
  state.controller?.abort()
  state.controller = null
  state.open = false
  state.preview = null
  state.error = ''
  state.loading = false
  state.busy = false
  if (state.keyHandler && typeof document === 'object') document.removeEventListener('keydown', state.keyHandler, true)
  state.keyHandler = null
  rerender()
  focusTrigger()
}

function trapKeys() {
  if (state.keyHandler || typeof document !== 'object') return
  state.keyHandler = event => {
    if (!state.open) return
    if (event.key === 'Escape') {
      if (state.busy) return
      event.preventDefault()
      closeDialog()
      return
    }
    if (event.key !== 'Tab') return
    const dialog = state.ui?.content?.querySelector?.('[data-save-dialog="true"]')
    const items = Array.from(dialog?.querySelectorAll?.('button:not([disabled]),input:not([disabled])') || [])
    if (!items.length) { event.preventDefault(); dialog?.focus?.(); return }
    const first = items[0], last = items[items.length - 1], active = document.activeElement
    if (event.shiftKey && (active === first || !dialog.contains(active))) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (active === last || !dialog.contains(active))) { event.preventDefault(); first.focus() }
  }
  document.addEventListener('keydown', state.keyHandler, true)
}

async function previewFile(file) {
  if (!file) return
  state.preview = null
  state.error = ''
  state.loading = true
  state.controller?.abort()
  const controller = new AbortController()
  state.controller = controller
  rerender()
  try {
    const response = await fetch(PREVIEW_URL, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: await file.arrayBuffer(), signal: controller.signal })
    const result = await response.json().catch(() => null)
    if (state.controller !== controller) return
    if (!response.ok || result?.ok !== true || !result.token || !result.summary) throw new Error(result?.error || result?.reason || `宿主返回 HTTP ${response.status}`)
    state.preview = result
  } catch (error) {
    if (state.controller === controller && !cancelError(error)) state.error = '没能读取这个存档：' + messageOf(error)
  } finally {
    if (state.controller === controller) {
      state.loading = false
      state.controller = null
      rerender()
    }
  }
}

async function commitImport(ui) {
  if (state.busy || !state.preview?.token) return
  state.busy = true
  state.error = ''
  rerender()
  try {
    const response = await fetch(IMPORT_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: state.preview.token }) })
    const result = await response.json().catch(() => null)
    if (!response.ok || result?.ok !== true) throw new Error(result?.error || result?.reason || `宿主返回 HTTP ${response.status}`)
    state.open = false
    if (state.keyHandler) document.removeEventListener('keydown', state.keyHandler, true)
    state.keyHandler = null
    status(ui, '存档已导入')
    window.setTimeout(() => window.location.reload(), 500)
  } catch (error) {
    state.error = '导入失败：' + messageOf(error)
    state.busy = false
    rerender()
  }
}

/** Called on each settings paint; state is module-owned so polling can rebuild the DOM safely. */
export function renderSaveTransferSettings(ui, section) {
  state.ui = ui
  // 外部桌宠：存档导入导出归桌面版管，这里禁用并说明（设计 4.9 白名单）。
  if (isExternalMode(ui.view)) {
    const box = section(ui, '存档', '备份进度，或把小猪带到另一台设备')
    const actions = el('div', 'dp-actions')
    for (const [key, label] of [['export', '导出存档'], ['import', '导入存档']]) {
      const node = button('dp-mini', { 'data-save-trigger': key, 'data-external-disabled': 'true' }, function () { status(ui, MIRROR_NOTE, 3600) })
      node.textContent = label
      node.disabled = true
      actions.appendChild(node)
    }
    box.box.appendChild(actions)
    box.box.appendChild(el('p', 'dp-dim', MIRROR_NOTE))
    return
  }
  const transfer = section(ui, '存档', '备份进度，或把小猪带到另一台设备')
  transfer.box.setAttribute('data-save-transfer-active', String(state.open || state.busy || state.loading))
  const actions = el('div', 'dp-actions')
  const exportButton = button('dp-mini', { 'data-save-trigger': 'export' }, () => exportSave(ui))
  exportButton.textContent = state.busy && !state.open ? '导出中…' : '导出存档'
  exportButton.disabled = state.busy || !ui.view?.pig
  if (!ui.view?.pig) exportButton.title = '接到小猪后即可备份'
  const importButton = button('dp-mini', { 'data-save-trigger': 'import' }, () => {
    if (state.busy) return
    state.open = true
    state.preview = null
    state.error = ''
    state.trigger = 'import'
    rerender()
    trapKeys()
    const input = ui.content.querySelector('[data-save-file="true"]')
    input?.click()
  })
  importButton.textContent = '导入存档'
  importButton.disabled = state.busy || state.loading
  actions.appendChild(exportButton)
  actions.appendChild(importButton)
  transfer.box.appendChild(actions)
  renderCloud(ui, transfer.box)

  if (!state.open) return
  const overlay = el('div', 'dp-save-overlay')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(70,48,25,.38);padding:12px;box-sizing:border-box'
  const dialog = el('div', 'dp-set')
  dialog.style.cssText = 'width:min(268px,100%);max-height:90vh;overflow:auto;background:var(--ac-bg-content);border:2px solid var(--ac-border);border-radius:var(--ac-radius-card);padding:12px;box-shadow:var(--ac-shadow-lg)'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', '导入存档')
  dialog.setAttribute('data-save-dialog', 'true')
  dialog.tabIndex = -1
  overlay.appendChild(dialog)
  dialog.appendChild(el('b', null, '导入存档'))
  if (state.loading) dialog.appendChild(el('p', 'dp-dim', '正在检查存档…'))
  else if (state.preview) {
    const summary = state.preview.summary
    rowTo(dialog, '小猪', `${summary.name || '未命名'} · Lv.${summary.level ?? '—'}`)
    rowTo(dialog, '备份时间', displayDate(summary.createdAt))
    rowTo(dialog, '游戏版本', summary.gameVersion || '未知')
    rowTo(dialog, '内容', `养成进度、${summary.extensions || 0} 个扩展、${summary.skins || 0} 个自定义皮肤`)
    if (summary.legacy) dialog.appendChild(alert('这是旧版 JSON 存档，部分资源可能未包含。'))
    for (const warning of state.preview.warnings || []) dialog.appendChild(alert(warning))
    dialog.appendChild(el('p', 'dp-dim', '将替换当前这只猪。当前存档会先自动备份，导入后两边不会自动同步。'))
  } else {
    dialog.appendChild(el('p', 'dp-dim', '选择 ZIP 备份或已有的 state.json。选取后只检查和预览，不会修改当前存档。'))
    const picker = el('input', 'dp-input')
    picker.type = 'file'
    picker.accept = '.zip,.json,application/zip,application/json'
    picker.setAttribute('data-save-file', 'true')
    picker.setAttribute('aria-label', '选择存档文件')
    picker.addEventListener('change', () => { const file = picker.files?.[0]; if (file) previewFile(file) })
    picker.addEventListener('cancel', closeDialog)
    dialog.appendChild(picker)
  }
  if (state.error) dialog.appendChild(alert(state.error, 'dp-alert dp-dead'))
  const buttons = el('div', 'dp-actions')
  const cancel = button('dp-btn', { 'data-save-focus': 'cancel', 'data-save-cancel': 'true' }, closeDialog)
  cancel.textContent = '取消'
  cancel.disabled = state.busy
  buttons.appendChild(cancel)
  if (state.preview) {
    const confirm = button('dp-mini', { 'data-save-focus': 'confirm', 'data-save-confirm': 'true' }, () => commitImport(ui))
    confirm.textContent = state.busy ? '导入中…' : '备份并导入'
    confirm.disabled = state.busy
    buttons.appendChild(confirm)
  }
  dialog.appendChild(buttons)
  ui.content.appendChild(overlay)
  const desired = dialog.querySelector(`[data-save-focus="${state.focus}"]`) || dialog.querySelector('input') || cancel
  if (document.activeElement === document.body || !dialog.contains(document.activeElement)) desired.focus()
  dialog.addEventListener('focusin', event => {
    const key = event.target?.getAttribute?.('data-save-focus')
    if (key) state.focus = key
  })
}

function rowTo(parent, label, value) {
  const line = el('div', 'dp-set-head')
  line.appendChild(el('b', null, label))
  line.appendChild(el('small', 'dp-dim', String(value)))
  parent.appendChild(line)
}

function displayDate(value) {
  if (value === null || value === undefined || value === '') return '未记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const p = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`
}

function alert(text, className = 'dp-alert dp-legacy') {
  return el('div', className, String(text))
}

// --- 云存档（git） ---
const CLOUD_URL = {
  status: '/dsh-piggy/cloud/status',
  pull: '/dsh-piggy/cloud/pull',
  commit: '/dsh-piggy/cloud/commit',
  history: '/dsh-piggy/cloud/history',
}

const cloud = { loaded: false, loading: false, status: null, history: null, error: '', notice: '', armPull: 0, pick: '', listOpen: false, paint: null }

async function cloudFetch(url, options) {
  const response = await fetch(url, { cache: 'no-store', ...(options ?? {}) })
  const body = await response.json().catch(() => null)
  if (!response.ok || body === null) throw new Error(body?.message || ('HTTP ' + response.status))
  if (body.ok === false) throw new Error(body.message || body.reason || '云存档操作失败')
  return body
}

function cloudTime(value) {
  if (!value) return '—'
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return String(value)
  const pad = n => String(n).padStart(2, '0')
  return pad(at.getMonth() + 1) + '-' + pad(at.getDate()) + ' ' + pad(at.getHours()) + ':' + pad(at.getMinutes())
}

function cloudRow(label, value) {
  const row = el('div', 'dp-row')
  row.appendChild(el('span', null, label))
  row.appendChild(el('b', null, String(value)))
  return row
}

async function loadCloud(ui) {
  if (cloud.loading) return
  cloud.loading = true
  cloud.error = ''
  try {
    cloud.status = await cloudFetch(CLOUD_URL.status)
    if (cloud.status.enabled) {
      cloud.history = await cloudFetch(CLOUD_URL.history + '?branch=' + encodeURIComponent(cloud.status.branch || ''))
      cloud.loaded = true
    }
  } catch (error) {
    cloud.error = messageOf(error)
  } finally {
    cloud.loading = false
    if (typeof cloud.paint === 'function') cloud.paint()
  }
}

async function cloudAction(ui, url, body) {
  if (state.busy) return
  state.busy = true
  cloud.notice = '处理中…'
  cloud.error = ''
  if (typeof cloud.paint === 'function') cloud.paint()
  try {
    await cloudFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })
    cloud.notice = '完成'
    await loadCloud(ui)
  } catch (error) {
    cloud.error = messageOf(error)
    cloud.notice = ''
  } finally {
    state.busy = false
    if (typeof cloud.paint === 'function') cloud.paint()
  }
}

function renderCloud(ui, parent) {
  const box = el('div', 'dp-cloud')
  // 和上面的导出/导入按钮隔开，读起来是一块独立功能区。
  box.style.marginTop = '14px'
  box.style.paddingTop = '12px'
  box.style.borderTop = '1.5px dashed rgba(0,0,0,0.12)'
  parent.appendChild(box)
  cloud.paint = function paint() {
    box.textContent = ''
    const head = el('div', 'dp-row')
    head.appendChild(el('b', null, '云存档（git）'))
    head.appendChild(el('span', 'dp-dim', cloud.status?.enabled ? (cloud.status.remote || '') : '未启用'))
    box.appendChild(head)

    if (cloud.error !== '') box.appendChild(el('div', 'dp-dim', '云存档：' + cloud.error))
    if (cloud.status === null || cloud.status.enabled !== true) {
      box.appendChild(el('p', 'dp-dim', cloud.loading ? '正在读取云存档状态…' : '在配置里打开 cloudSave 后可用（remote 指向存存档的私有仓库）。'))
      return
    }
    if (!cloud.loaded) {
      box.appendChild(el('p', 'dp-dim', '正在读取存档列表…'))
      return
    }

    const actions = el('div', 'dp-actions')
    const commit = button('dp-mini', { 'data-cloud': 'commit' }, () => cloudAction(ui, CLOUD_URL.commit, {}))
    commit.textContent = '保存到云端'
    const pull = button('dp-mini', { 'data-cloud': 'pull' }, () => {
      const now = Date.now()
      if (now - cloud.armPull > 4000) {
        cloud.armPull = now
        cloud.notice = '再点一次确认覆盖本地存档'
        paint()
        return
      }
      cloud.armPull = 0
      void cloudAction(ui, CLOUD_URL.pull, { branch: cloud.status.branch, hash: cloud.pick })
    })
    pull.textContent = '从云端拉取'
    for (const node of [commit, pull]) { node.disabled = state.busy; actions.appendChild(node) }
    box.appendChild(actions)
    if (cloud.notice !== '') box.appendChild(el('div', 'dp-dim', cloud.notice))

    const history = cloud.history
    if (!history) return
    const rows = [history.manual, ...(history.auto ?? [])].filter(Boolean)
    if (rows.length === 0) {
      box.appendChild(el('div', 'dp-dim', '云端还没有存档'))
      return
    }
    if (cloud.pick === '') cloud.pick = rows[0].hash
    const details = el('details', 'dp-cloud-list')
    if (cloud.listOpen) details.open = true
    details.addEventListener('toggle', function () { cloud.listOpen = details.open })
    details.appendChild(el('summary', null, '存档列表（' + rows.length + '）'))
    for (const item of rows) {
      const row = cloudRow((cloud.pick === item.hash ? '● ' : '○ ') + cloudTime(item.at), item.subject.replace(/^save(-manual)?:\s*/, ''))
      row.style.cursor = 'pointer'
      row.addEventListener('click', function () { cloud.pick = item.hash; paint() })
      details.appendChild(row)
    }
    box.appendChild(details)
  }
  cloud.paint()
  if (!cloud.loaded && !cloud.loading) void loadCloud(ui)
}