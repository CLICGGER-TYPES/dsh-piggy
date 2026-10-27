// @ts-check
/**
 * 外部桌宠向导的状态机和异步动作。
 *
 * 卡片永远按宿主状态画；向导只在用户点开时接管，所有网络请求都走 external-api，
 * 失败就留在当前页说清原因，不跳成功页、不写假数据。浏览器不接触配对令牌。
 * @module dsh-piggy/client/external-session
 */
import { cancel, commit, connect, disconnect, normalizePreview, normalizeResult, prepare, preview, recheck } from './external-api.js'
import { loadMergePage, pollMergeUnknown, runRecover, runRetireRetry, runRollback, runWithdraw } from './external-runtime.js'
import { ensureStatus, loadStatus } from './external-status.js'
import { choicesPayload, defaultChoices, validateChoices } from './external-rules.js'
import { str } from './values.js'

export const session = {
  ui: null,
  open: false,
  step: '',
  status: null,
  error: '',
  busy: false,
  loading: false,
  mode: 'connect',
  blockers: [],
  terminate: null,
  preview: null,
  choices: null,
  result: null,
  manageStep: '',
  withdrawDiscard: false,
  withdrawChanged: false,
  overlay: null,
  lastLoad: 0,
  timer: null,
  repaint: null,
  closeOverlay: null,
}

const TAB_FOR_KIND = { work: 'work', study: 'study', interest: 'study', trip: 'travel', 'fishing-auto': 'fishing', 'fishing-manual': 'fishing', pomodoro: 'pomodoro' }

export const handler = {
  recheck: () => runRecheck(),
  connect: () => openWizard('detect'),
  manage: () => openManageStep(),
  withdraw: () => openStep('withdraw'),
  rollback: () => openStep('rollback'),
  close: () => closeWizard(),
  dismiss: () => closeWizard(),
  setMode: mode => { session.mode = mode; session.error = ''; repaint() },
  backToDetect: () => { session.step = 'detect'; repaint() },
  chooseNext: () => chooseNext(),
  recheckBlocker: () => recheckBlockers(),
  goHandle: blocker => goHandle(blocker),
  askForce: blocker => { session.terminate = blocker; session.error = ''; session.step = 'force'; repaint() },
  cancelForce: () => { session.terminate = null; session.error = ''; session.step = 'blockers'; repaint() },
  force: () => runForce(),
  submit: () => submit(),
  cancelPreview: () => cancelPreview(false),
  refresh: () => repaint(),
  done: () => { closeWizard(); session.ui?.renderContent?.() },
  retry: () => retry(),
  withdrawNow: discard => runWithdraw(session, hooks, discard, false),
  waitDeliver: () => closeWizard(),
  recoverLocal: () => openStep('recover'),
  recoverGo: () => runRecover(session, hooks),
  restoreBackup: () => openStep('recover'),
  withdrawChangedGo: () => runWithdraw(session, hooks, false, true),
  retireRetry: () => runRetireRetry(session, hooks),
  rollbackGo: () => runRollback(session, hooks),
  setManageStep: step => { session.manageStep = step; repaint() },
  closeManage: () => closeWizard(),
  mergeStaged: () => {
    openWizard('loading', 'merge')
    session.busy = true
    loadMergePage(session, hooks).finally(() => { session.busy = false; repaint() })
  },
}

const hooks = {
  repaint: () => repaint(),
  close: () => closeWizard(),
  reload: () => loadStatus(session),
  bubble: (text, ms) => session.ui?.showBubble?.(text, ms),
  render: () => session.ui?.renderContent?.(),
}

/** 卡片上的「重新检测」：只读发现文件，不改存档。 */
async function runRecheck() {
  session.busy = true
  session.error = ''
  repaint()
  try {
    const result = await recheck()
    session.status = result.status
    session.lastLoad = Date.now()
    if (!result.ok) session.error = result.error?.code ?? 'network'
    const ready = session.status.desktop.found && session.status.desktop.enabled
    if (session.open) {
      if (!ready) {
        session.step = 'detectError'
        return
      }
      if (session.status.merged) {
        session.step = 'manage'
        return
      }
      if (session.status.mode === 'external') {
        session.step = 'manage'
        return
      }
      await loadMergePage(session, hooks)
    }
  } finally {
    session.busy = false
    session.ui?.renderContent?.()
    if (session.open) repaint()
  }
}

function openWizard(step, mode) {
  session.open = true
  session.step = step
  session.error = ''
  session.blockers = []
  session.preview = null
  session.choices = null
  session.result = null
  session.terminate = null
  session.withdrawDiscard = false
  session.withdrawChanged = false
  if (mode === 'connect' || mode === 'merge') session.mode = mode
  if (step === 'detect') session.step = 'loading'
  repaint()
  if (step === 'detect') runRecheck()
}

function openStep(step) {
  session.open = true
  session.step = step
  session.error = ''
  session.withdrawDiscard = false
  session.withdrawChanged = false
  repaint()
}

function openManageStep() {
  session.open = true
  session.step = 'manage'
  session.manageStep = ''
  repaint()
}

export function repaint() {
  session.repaint?.()
}

function closeWizard() {
  session.open = false
  session.step = ''
  session.error = ''
  session.busy = false
  session.blockers = []
  session.terminate = null
  session.withdrawDiscard = false
  session.withdrawChanged = false
  session.manageStep = ''
  if (session.timer !== null) { clearInterval(session.timer); session.timer = null }
  session.closeOverlay?.()
  const ui = /** @type {any} */ (session.ui)
  ui?.renderContent?.()
}

function goHandle(blocker) {
  if (blocker.side === 'target') {
    session.ui?.showBubble?.('去桌面版结束这项活动，完成后回来再合并', 4200)
    closeWizard()
    return
  }
  const tab = TAB_FOR_KIND[blocker.kind] ?? ''
  closeWizard()
  if (tab !== '') session.ui?.select?.(tab)
  session.ui?.showBubble?.('先结束这项活动，再回来合并', 3800)
}

async function chooseNext() {
  if (session.mode === 'cancel') { closeWizard(); return }
  if (session.mode === 'connect') { await confirmConnect(); return }
  if (session.blockers.length > 0) { session.step = 'blockers'; repaint(); return }
  await startPreview()
}

/** 阻塞页的「重新检查」：源端阻塞要重新问 merge 页，目标端阻塞重新预览。 */
async function recheckBlockers() {
  const sourceBlocked = session.blockers.some(blocker => blocker.side === 'source')
  if (sourceBlocked) {
    session.busy = true
    session.error = ''
    repaint()
    try {
      const page = await connect('merge')
      if (!page.ok) { session.error = page.error?.code ?? 'network'; return }
      session.blockers = page.page.blockers
      session.step = session.blockers.length > 0 ? 'blockers' : 'choose'
    } finally {
      session.busy = false
      repaint()
    }
    return
  }
  await startPreview()
}

async function confirmConnect() {
  session.busy = true
  session.error = ''
  repaint()
  try {
    const result = await connect('connect')
    if (!result.ok) { session.error = 'connect-failed'; return }
    if (result.page.status !== null) session.status = result.page.status
    else await loadStatus(session)
    session.ui?.showBubble?.('已连接桌面猪', 3000)
    closeWizard()
  } finally {
    session.busy = false
    repaint()
    session.ui?.renderContent?.()
  }
}

async function startPreview() {
  session.busy = true
  session.error = ''
  const backTo = session.step === 'blockers' ? 'blockers' : 'choose'
  session.step = 'loading'
  repaint()
  try {
    const result = await preview()
    const normalized = normalizePreview(result.data ?? {})
    if (!result.ok) {
      const reason = result.error?.code ?? normalized.reason ?? 'unknown'
      session.error = reason
      if (reason === 'activity' || reason === 'pomodoro' || reason === 'fishing') {
        session.blockers = [{ side: 'target', reason, kind: reason === 'pomodoro' ? 'pomodoro' : reason === 'fishing' ? 'fishing-auto' : 'activity', label: reason === 'activity' ? '正在外面活动' : reason === 'pomodoro' ? '正在专注' : '正在钓鱼', finished: false, phase: '', refund: 0, bait: 0, minutes: 0, raw: {} }]
        session.step = 'blockers'
      } else {
        session.step = backTo
      }
      return
    }
    if (normalized.blocked) {
      session.blockers = normalized.blockers
      session.step = normalized.blockers.length > 0 ? 'blockers' : backTo
      if (normalized.blockers.length === 0) session.error = normalized.reason === '' ? 'blocked-activity' : normalized.reason
      return
    }
    session.preview = normalized
    session.status = { ...session.status, target: normalized.target, local: normalized.source }
    session.blockers = []
    session.choices = defaultChoices(normalized)
    session.step = 'preview'
    startExpiryWatch(normalized)
  } finally {
    session.busy = false
    repaint()
  }
}

async function runForce() {
  const blocker = session.terminate
  if (blocker === null) return
  session.busy = true
  session.error = ''
  repaint()
  try {
    const result = await prepare(blocker)
    if (!result.ok) { session.error = result.error?.code ?? 'network'; return }
    if (result.data !== null && result.data !== undefined && result.data.alreadyFinished === true) session.ui?.showBubble?.('这项已经到点，按完成结算后继续', 3200)
    session.terminate = null
    session.step = blocker.side === 'source' ? 'blockers' : 'loading'
    if (blocker.side === 'source') await recheckBlockers()
    else await startPreview()
  } finally {
    session.busy = false
    repaint()
  }
}

async function submit() {
  const found = validateChoices(session.preview, session.choices)
  if (!found.ok) { session.error = 'invalid-choices'; repaint(); return }
  session.busy = true
  session.step = 'committing'
  session.error = ''
  repaint()
  try {
    const result = await commit(choicesPayload(session.choices))
    if (session.timer !== null) { clearInterval(session.timer); session.timer = null }
    const normalized = normalizeResult(result.data ?? {})
    session.result = normalized
    if (result.ok && normalized.ok) {
      session.step = 'success'
      await loadStatus(session)
    } else {
      session.error = result.error?.code ?? normalized.status ?? normalized.error ?? 'unknown'
      session.step = 'failure'
      if (session.error === 'merge-unknown') await pollMergeUnknown(session, hooks)
    }
  } finally {
    session.busy = false
    repaint()
    session.ui?.renderContent?.()
  }
}

async function retry() {
  if (session.error === 'retire-failed') { await runRetireRetry(); return }
  if (session.error === 'merge-unknown') { await pollMergeUnknown(session, hooks); return }
  if (['explicit-change', 'preview-expired', 'runtime-changed', 'unknown-preview', 'unknown-source-fields', 'unknown-source-aborted', 'version-too-new', 'rules-too-new'].includes(session.error)) {
    session.preview = null
    session.choices = null
    session.error = ''
    await startPreview()
    return
  }
  if (session.error === 'invalid-choices' && session.preview !== null) { session.error = ''; session.step = 'preview'; repaint(); return }
  if (session.preview !== null) { await submit(); return }
  session.step = 'choose'
  session.error = ''
  repaint()
}

function startExpiryWatch(previewResult) {
  if (session.timer !== null) { clearInterval(session.timer); session.timer = null }
  if (!(previewResult.expiresAt > 0)) return
  session.timer = setInterval(function () {
    if (session.step !== 'preview' || session.preview === null) return
    if (Date.now() >= session.preview.expiresAt) {
      clearInterval(/** @type {any} */ (session.timer))
      session.timer = null
      cancelPreview(true)
    }
  }, 1000)
}

async function cancelPreview(byExpiry) {
  if (session.busy) return
  session.busy = true
  session.error = ''
  try {
    const result = await cancel()
    if (!result.ok) {
      session.error = result.error?.code ?? 'network'
      return
    }
    await loadStatus(session)
    closeWizard()
    session.ui?.showBubble?.(byExpiry ? '预览过期了，内嵌猪已恢复' : '已取消合并预览', 3200)
  } finally {
    session.busy = false
    repaint()
  }
}

