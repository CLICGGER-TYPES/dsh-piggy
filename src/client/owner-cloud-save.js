// @ts-check
/**
 * Complete-owner-archive cloud sync.
 *
 * The flat cloud-save settings above only configure a Git repository. This
 * section is the explicit restore flow for an OwnerDocument: cloud restore
 * always shows a preview first, and remote history is read-only because the
 * host exposes no per-commit restore route.
 *
 * Desktop exposes the bridge on the desktop shell. The DSH web page injects
 * `__dshPiggyOwnerCloud`; it can only restore cloud-to-local and switches
 * owners in-process instead of restarting the app.
 */
import { el } from './dom.js'
import { resolveOwnerCloudBinding } from './owner-cloud-bridge.js'
import { renderDesktopDirections } from './owner-cloud-desktop.js'
import { DSH_REASON_TEXT, renderDshRestoreEntry, renderDshUnavailable } from './owner-cloud-dsh.js'
import { describeFailure, normalizeCommit, normalizeStatus, REASON_TEXT } from './owner-cloud-state.js'
import { renderOwnerCloudHistory, renderOwnerCloudPreview } from './owner-cloud-view.js'

const POLL_PAUSE_MS = 60_000

/** @typedef {{available:boolean, ready:boolean, enabled:boolean, branch:string, code:string|null, reason:string}} OwnerCloudStatus */
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
  /** @type {'desktop'|'dsh'} */
  transport: 'desktop',
  restartAfterImport: true,
  switching: false,
  /** Result unknown after a restore request: never retry the same token. */
  unknown: false,
  notice: '',
  /** @type {any} */
  ui: null,
  generation: 0,
}

function rerender() {
  state.ui?.renderContent?.()
}

function reasonOf(result) {
  return typeof result?.reason === 'string' && result.reason !== '' ? result.reason : ''
}

function clearError() {
  state.error = ''
  state.errorKind = ''
  state.errorCode = null
  state.unknown = false
}

function setFailure(result, fallback) {
  const described = describeFailure(state.transport, result, fallback)
  state.error = described.text
  state.errorKind = Object.hasOwn(REASON_TEXT, reasonOf(result)) ? 'legacy' : 'dead'
  state.errorCode = described.code
}

function setOperationError(text, code = null) {
  state.error = text
  state.errorKind = 'dead'
  state.errorCode = code
}

/** Cache status: the panel repaints every four seconds and must not poll each time. */
async function requestStatus(ui) {
  if (state.statusPromise !== null || state.switching) return
  const binding = resolveOwnerCloudBinding()
  if (binding === null) return
  state.transport = binding.transport
  state.restartAfterImport = binding.restartAfterImport
  const generation = state.generation
  const promise = (async () => {
    try {
      return normalizeStatus(await binding.api.ownerStatus())
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
  const binding = resolveOwnerCloudBinding()
  if (binding === null) return
  const branch = status.branch
  const generation = state.generation
  const promise = (async () => {
    try {
      const result = await binding.api.ownerHistory(branch)
      if (result?.ok !== true) return { ok: false, reason: describeFailure(state.transport, result, '云端历史暂时无法读取').text }
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

function pausePolling() {
  if (typeof window !== 'undefined') /** @type {any} */ (window).__dshPiggyPollPauseUntil = Date.now() + POLL_PAUSE_MS
}

function resumePolling() {
  if (typeof window !== 'undefined') delete /** @type {any} */ (window).__dshPiggyPollPauseUntil
}

async function startFirstSync(ui, direction) {
  if (state.busy !== '' || state.switching || state.unknown) return
  if (state.transport === 'dsh' && direction !== 'cloud-to-local') return
  const binding = resolveOwnerCloudBinding()
  if (binding === null) return
  state.busy = direction === 'local-to-cloud' ? 'upload' : 'download'
  state.preview = null
  state.acknowledgeWarnings = false
  state.notice = ''
  clearError()
  rerender()

  let result = null
  try {
    result = await binding.api.firstSync(direction)
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
    const current = state.status ?? { available: true, ready: false, enabled: true, branch: 'main', code: null, reason: '' }
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
  const binding = resolveOwnerCloudBinding()
  if (binding === null) return
  const token = state.preview.token
  const dsh = state.transport === 'dsh'
  state.busy = 'import'
  clearError()
  rerender()
  if (dsh) pausePolling()

  let result = null
  try {
    result = await binding.api.importFirstSync(token, { acceptWarnings: state.acknowledgeWarnings === true })
  } catch (error) {
    if (dsh) {
      state.unknown = true
      setOperationError(DSH_REASON_TEXT.unknown, 'unknown')
    } else {
      setOperationError('恢复没有完成：' + (error instanceof Error ? error.message : '请稍后重试'))
    }
  } finally {
    if (dsh) resumePolling()
  }
  state.busy = ''
  if (dsh && state.switching) return
  if (result?.ok !== true) {
    if (result !== null) {
      if (dsh && result.unknown === true) {
        state.unknown = true
        setFailure(result, '恢复请求的结果未知')
      } else {
        const described = describeFailure(state.transport, result, '当前存档保持不变')
        const prefix = result.imported === true ? '副本已建立，但没有切换。' : '恢复没有完成。'
        setOperationError(prefix + described.text, described.code)
      }
    }
    state.preview = null
    state.acknowledgeWarnings = false
    rerender()
    return
  }

  if (dsh) {
    const current = state.status ?? { available: true, ready: true, enabled: true, branch: 'main', code: null, reason: '' }
    state.preview = null
    state.acknowledgeWarnings = false
    clearError()
    state.status = { ...current, available: true, enabled: true, ready: true }
    state.history = null
    state.historyBranch = state.status.branch
    state.notice = '已切换到新副本，正在刷新…'
    rerender()
    ui.refresh?.()
    void requestHistory(ui)
    return
  }
  // The desktop host saves the current archive, switches to the restored copy and restarts.
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

/** Manual re-probe after a transient failure; no automatic retry loop. */
function retryStatus(ui) {
  state.generation += 1
  state.statusPromise = null
  state.status = null
  state.history = null
  state.historyBranch = null
  state.notice = ''
  clearError()
  rerender()
  void requestStatus(ui)
}

/**
 * Called on each settings paint. Module state keeps status, history and the
 * preview token between the panel's timed repaints, so polling does not send
 * duplicate requests or drop the warning acknowledgement.
 * @param {any} ui
 * @param {(ui:any,title:string,note:string)=>{box:HTMLElement,head:HTMLElement}} section
 */
export function renderOwnerCloudSaveSettings(ui, section) {
  state.ui = ui
  const binding = resolveOwnerCloudBinding()
  if (binding === null) return
  state.transport = binding.transport
  state.restartAfterImport = binding.restartAfterImport
  if (state.status === null) {
    void requestStatus(ui)
    const loading = section(ui, '完整档云同步', '整份完整档：所有小猪与共享资产')
    loading.box.appendChild(el('p', 'dp-dim', '正在读取完整档云同步…'))
    return
  }
  if (state.status.available !== true) {
    if (state.transport !== 'dsh') return
    const offline = section(ui, '完整档云同步', '整份完整档：所有小猪与共享资产；只在本机可用')
    renderDshUnavailable(offline.box, state.status, () => retryStatus(ui))
    return
  }

  const status = state.status
  const dsh = state.transport === 'dsh'
  const setting = section(ui, '完整档云同步', dsh
    ? '整份完整档：所有小猪与共享资产；从云端恢复到新副本'
    : '整份完整档：所有小猪与共享资产；只同步这一份')
  const box = setting.box

  const stateKey = state.switching ? 'switching' : status.ready ? 'connected' : status.enabled ? 'pending' : 'disconnected'
  const stateLabel = state.switching ? '正在切换' : status.ready ? '已连接'
    : dsh ? (status.enabled ? '待从云端恢复' : '未配置') : (status.enabled ? '待首次同步' : '未连接')
  const summary = el('div', 'dp-cloud-summary')
  summary.setAttribute('data-owner-cloud-status', stateKey)
  summary.appendChild(el('b', null, stateLabel))
  summary.appendChild(el('span', 'dp-cloud-note', '分支 · ' + status.branch))
  summary.appendChild(el('span', 'dp-cloud-note', state.switching
    ? '正在保存当前存档并切换；应用会自动重启。'
    : status.ready ? '自动同步已启用'
      : dsh ? (status.enabled ? '尚未从云端恢复' : '在 DSH 插件配置里启用 ownerCloud')
        : status.enabled ? '尚未完成首次同步' : '先在上面的「云存档」启用'))
  box.appendChild(summary)

  if (state.notice !== '') {
    const notice = el('div', 'dp-cloud-status', state.notice)
    notice.setAttribute('data-owner-cloud-notice', 'true')
    box.appendChild(notice)
  }
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
      restartAfterImport: state.restartAfterImport,
      onToggleWarnings: checked => {
        state.acknowledgeWarnings = checked
        rerender()
      },
      onCancel: () => { clearPreview(ui) },
      onImport: () => { void importPreview(ui) },
    })
    return
  }
  if (dsh) {
    renderDshRestoreEntry(box, status, {
      busy: state.busy,
      unknown: state.unknown,
      onRestore: () => { void startFirstSync(ui, 'cloud-to-local') },
      onCheck: () => retryStatus(ui),
    })
    if (status.ready) {
      if (state.history === null && state.historyPromise === null) void requestHistory(ui)
      renderOwnerCloudHistory(box, state.history)
    }
    return
  }
  if (!status.ready) {
    renderDesktopDirections(box, status, state.busy, direction => { void startFirstSync(ui, direction) })
    return
  }
  renderOwnerCloudHistory(box, state.history)
}
