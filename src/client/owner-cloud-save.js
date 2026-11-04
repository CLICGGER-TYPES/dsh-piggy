// @ts-check
/**
 * Desktop-only complete-owner-archive cloud sync.
 *
 * The flat cloud-save settings above only configure a Git repository. This
 * section is the explicit first-sync/restore flow for an OwnerDocument: the
 * user chooses a direction, cloud restore always shows a preview first, and
 * the remote history is read-only because the host exposes no per-commit
 * restore route.
 */
import { button, el } from './dom.js'
import { desktopShell } from './desktop-shell.js'
import { renderOwnerCloudHistory, renderOwnerCloudPreview } from './owner-cloud-view.js'

const UPLOADING = '正在上传完整档…'
const READING = '正在读取云端存档…'

/** Conflict codes are hints, not retryable transport failures. */
const REASON_TEXT = Object.freeze({
  'remote-has-history': '云端这个分支已有其他完整档历史，不能直接上传覆盖；请换一个空分支，或改为从云端恢复。',
  'remote-owner-mismatch': '云端存档属于另一份完整档，不能与当前完整档混用。',
  'remote-branch-empty': '云端这个分支还没有完整档；可以先上传本机完整档。',
  'remote-advanced': '云端已经有更新的存档，本机没有覆盖它。请先在另一台设备完成同步后再试。',
  'first-sync-required': '这个完整档还没有首次同步记录；请先完成一次首次同步。',
})

/** @typedef {{available:boolean, ready:boolean, enabled:boolean, branch:string}} OwnerCloudStatus */
/** @typedef {{hash?:string, at?:string, subject?:string, manual?:boolean}} OwnerCloudCommit */
/** @typedef {{ok:boolean, manual?:OwnerCloudCommit|null, auto?:OwnerCloudCommit[], reason?:string}} OwnerCloudHistory */
/** @typedef {{token:string, summary:any, warnings:string[]}} OwnerCloudPreview */

const state = {
  /** @type {OwnerCloudStatus|null} */
  status: null,
  /** @type {Promise<OwnerCloudStatus>|null} */
  statusPromise: null,
  /** @type {OwnerCloudHistory|null} */
  history: null,
  /** @type {Promise<OwnerCloudHistory>|null} */
  historyPromise: null,
  /** @type {string|null} */
  historyBranch: null,
  /** @type {OwnerCloudPreview|null} */
  preview: null,
  acknowledgeWarnings: false,
  /** @type {''|'upload'|'download'|'import'} */
  busy: '',
  /** @type {''|'legacy'|'dead'} */
  errorKind: '',
  error: '',
  /** @type {string|null} */
  errorCode: null,
  switching: false,
  /** @type {any} */
  ui: null,
  generation: 0,
}

/** The owner bridge only exists in the desktop shell; DSH and old shells have no ownerStatus. */
function ownerCloudApi() {
  const api = desktopShell()?.cloudSave
  return api !== null && typeof api === 'object' &&
    typeof api.ownerStatus === 'function' &&
    typeof api.firstSync === 'function' &&
    typeof api.importFirstSync === 'function' &&
    typeof api.ownerHistory === 'function' ? api : null
}

function rerender() {
  state.ui?.renderContent?.()
}

function reasonOf(result) {
  return typeof result?.reason === 'string' && result.reason !== '' ? result.reason : ''
}

function friendlyReason(reason, fallback) {
  if (reason === '') return fallback
  return REASON_TEXT[reason] ?? reason
}

function clearError() {
  state.error = ''
  state.errorKind = ''
  state.errorCode = null
}

function setFailure(result, fallback) {
  const reason = reasonOf(result)
  state.error = friendlyReason(reason, fallback)
  state.errorKind = Object.hasOwn(REASON_TEXT, reason) ? 'legacy' : 'dead'
  state.errorCode = reason === '' ? null : reason
}

function setOperationError(text) {
  state.error = text
  state.errorKind = 'dead'
  state.errorCode = null
}

function normalizeStatus(result) {
  if (result === null || typeof result !== 'object' || result.available !== true) {
    return { available: false, ready: false, enabled: false, branch: 'main' }
  }
  return {
    available: true,
    ready: result.ready === true,
    enabled: result.enabled === true,
    branch: typeof result.branch === 'string' && result.branch !== '' ? result.branch : 'main',
  }
}

/** Cache status: the panel repaints every four seconds and must not poll IPC each time. */
async function requestStatus(ui) {
  if (state.statusPromise !== null || state.switching) return
  const api = ownerCloudApi()
  if (api === null) return
  const generation = state.generation
  const promise = (async () => {
    try {
      return normalizeStatus(await api.ownerStatus())
    } catch {
      return normalizeStatus(null)
    }
  })()
  state.statusPromise = promise
  const status = await promise
  if (state.statusPromise === promise) state.statusPromise = null
  if (generation !== state.generation || state.switching) return
  state.status = status
  if (state.ui === ui) rerender()
  if (status.available && status.ready) void requestHistory(ui)
}

function normalizeCommit(value) {
  if (value === null || typeof value !== 'object') return null
  return {
    hash: typeof value.hash === 'string' ? value.hash : '',
    at: typeof value.at === 'string' ? value.at : '',
    subject: typeof value.subject === 'string' ? value.subject : '',
    manual: value.manual === true,
  }
}

/** History is immutable for this paint; only a first sync or a branch change refreshes it. */
async function requestHistory(ui) {
  const status = state.status
  if (status === null || !status.available || !status.ready || state.switching) return
  if (state.historyPromise !== null) return
  if (state.historyBranch !== status.branch) {
    state.history = null
    state.historyBranch = status.branch
  }
  if (state.history !== null) return
  const api = ownerCloudApi()
  if (api === null) return
  const branch = status.branch
  const generation = state.generation
  const promise = (async () => {
    try {
      const result = await api.ownerHistory(branch)
      if (result?.ok !== true) {
        return { ok: false, reason: friendlyReason(reasonOf(result), '云端历史暂时无法读取') }
      }
      const manual = normalizeCommit(result.manual)
      const auto = Array.isArray(result.auto)
        ? result.auto.map(normalizeCommit).filter(commit => commit !== null)
        : []
      return { ok: true, manual, auto }
    } catch {
      return { ok: false, reason: '云端历史暂时无法读取' }
    }
  })()
  state.historyPromise = promise
  const history = await promise
  if (state.historyPromise === promise) state.historyPromise = null
  if (generation !== state.generation || state.switching || state.historyBranch !== branch) return
  state.history = history
  if (state.ui === ui) rerender()
}

async function startFirstSync(ui, direction) {
  if (state.busy !== '' || state.switching) return
  const api = ownerCloudApi()
  if (api === null) return
  state.busy = direction === 'local-to-cloud' ? 'upload' : 'download'
  state.preview = null
  state.acknowledgeWarnings = false
  clearError()
  rerender()

  let result = null
  try {
    result = await api.firstSync(direction)
  } catch (error) {
    setOperationError((direction === 'local-to-cloud' ? '上传没有完成：' : '读取云端存档没有完成：') +
      (error instanceof Error ? error.message : '请稍后重试'))
  }
  if (state.switching) return
  state.busy = ''
  if (result === null) {
    rerender()
    return
  }
  if (result?.ok !== true) {
    setFailure(result, direction === 'local-to-cloud' ? '上传没有完成' : '读取云端存档没有完成')
    rerender()
    return
  }

  if (direction === 'local-to-cloud') {
    const current = state.status ?? { available: true, ready: false, enabled: true, branch: 'main' }
    state.status = { ...current, available: true, ready: true, enabled: true }
    state.history = null
    state.historyBranch = null
    rerender()
    void requestHistory(ui)
    return
  }

  const token = typeof result.token === 'string' ? result.token : ''
  if (token === '' || result.summary === null || typeof result.summary !== 'object') {
    setOperationError('云端预览格式不正确；当前存档没有改变')
    rerender()
    return
  }
  state.preview = {
    token,
    summary: result.summary,
    warnings: Array.isArray(result.warnings)
      ? result.warnings.filter(warning => typeof warning === 'string')
      : [],
  }
  state.acknowledgeWarnings = false
  rerender()
}

async function importPreview(ui) {
  if (state.busy !== '' || state.switching || state.preview === null) return
  if (state.preview.warnings.length > 0 && !state.acknowledgeWarnings) return
  const api = ownerCloudApi()
  if (api === null) return
  const token = state.preview.token
  state.busy = 'import'
  clearError()
  rerender()

  let result = null
  try {
    result = await api.importFirstSync(token, { acceptWarnings: state.acknowledgeWarnings === true })
  } catch (error) {
    setOperationError('恢复没有完成：' + (error instanceof Error ? error.message : '请稍后重试'))
  }
  state.busy = ''
  if (result?.ok !== true) {
    if (result !== null) {
      const prefix = result.imported === true ? '副本已建立，但没有切换。' : '恢复没有完成。'
      setOperationError(prefix + (reasonOf(result) || '当前存档保持不变'))
    }
    state.preview = null
    state.acknowledgeWarnings = false
    rerender()
    return
  }
  // The host saves the current archive, switches to the restored copy and restarts.
  state.switching = true
  rerender()
}

function clearPreview(ui) {
  if (state.switching) return
  state.preview = null
  state.acknowledgeWarnings = false
  clearError()
  rerender()
}

function renderDirections(ui, box, status) {
  box.appendChild(el('p', 'dp-dim', '首次同步要手动选择方向；不会自动覆盖云端或本机。'))
  if (!status.enabled) {
    box.appendChild(el('div', 'dp-alert dp-legacy', '先在上面的「云存档」启用并填写仓库地址，才能做首次同步。'))
  }
  const actions = el('div', 'dp-actions')
  const upload = button('dp-mini dp-btn-wide', { 'data-owner-cloud-first-sync': 'local-to-cloud' }, () => {
    void startFirstSync(ui, 'local-to-cloud')
  })
  upload.textContent = state.busy === 'upload' ? UPLOADING : '本机完整档上传到云端'
  upload.disabled = state.busy !== '' || !status.enabled
  actions.appendChild(upload)
  const download = button('dp-btn dp-btn-wide', { 'data-owner-cloud-first-sync': 'cloud-to-local' }, () => {
    void startFirstSync(ui, 'cloud-to-local')
  })
  download.textContent = state.busy === 'download' ? READING : '从云端恢复到本机副本'
  download.disabled = state.busy !== '' || !status.enabled
  actions.appendChild(download)
  box.appendChild(actions)
}

/**
 * Called on each settings paint. Module state keeps status, history and the
 * preview token between the panel's timed repaints, so polling does not send
 * duplicate IPC or drop the warning acknowledgement.
 * @param {any} ui
 * @param {(ui:any,title:string,note:string)=>{box:HTMLElement,head:HTMLElement}} section
 */
export function renderOwnerCloudSaveSettings(ui, section) {
  state.ui = ui
  // DSH, the web page, old shells and legacy single-pig saves have no owner cloud bridge.
  if (ownerCloudApi() === null) return
  if (state.status === null) {
    void requestStatus(ui)
    const loading = section(ui, '完整档云同步', '整份完整档：所有小猪与共享资产')
    loading.box.appendChild(el('p', 'dp-dim', '正在读取完整档云同步…'))
    return
  }
  if (state.status.available !== true) return

  const status = state.status
  const setting = section(ui, '完整档云同步', '整份完整档：所有小猪与共享资产；只同步这一份')
  const box = setting.box

  const stateKey = state.switching ? 'switching' : status.ready ? 'connected' : status.enabled ? 'pending' : 'disconnected'
  const stateLabel = state.switching ? '正在切换' : status.ready ? '已连接' : status.enabled ? '待首次同步' : '未连接'
  const summary = el('div', 'dp-cloud-summary')
  summary.setAttribute('data-owner-cloud-status', stateKey)
  summary.appendChild(el('b', null, stateLabel))
  summary.appendChild(el('span', 'dp-cloud-note', '分支 · ' + status.branch))
  summary.appendChild(el('span', 'dp-cloud-note', state.switching
    ? '正在保存当前存档并切换；应用会自动重启。'
    : status.ready ? '自动同步已启用' : status.enabled ? '尚未完成首次同步' : '先在上面的「云存档」启用'))
  box.appendChild(summary)

  if (state.error !== '') {
    const alert = el('div', state.errorKind === 'legacy' ? 'dp-alert dp-legacy' : 'dp-alert dp-dead', state.error)
    if (state.errorCode !== null) alert.setAttribute('data-owner-cloud-error', state.errorCode)
    box.appendChild(alert)
  }

  if (state.preview !== null) {
    renderOwnerCloudPreview(box, {
      preview: state.preview,
      acknowledgeWarnings: state.acknowledgeWarnings,
      switching: state.switching,
      busy: state.busy,
      onToggleWarnings: checked => {
        state.acknowledgeWarnings = checked
        rerender()
      },
      onCancel: () => { clearPreview(ui) },
      onImport: () => { void importPreview(ui) },
    })
    return
  }
  if (!status.ready) {
    renderDirections(ui, box, status)
    return
  }
  renderOwnerCloudHistory(box, state.history)
}
