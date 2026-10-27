// @ts-check
/**
 * 设置页「外部桌宠」入口和弹层渲染。
 *
 * 状态机和网络动作在 external-session.js；这里负责在设置页重画时
 * 把卡片和开着的弹层重新挂回去，并保证输入框的光标不因轮询丢失。
 * @module dsh-piggy/client/external-pet
 */
import { renderExternalCard, renderManageDialog } from './external-card.js'
import { el } from './dom.js'
import { renderCommitting, renderFailure, renderRecoverConfirm, renderRollbackConfirm, renderRollingBack, renderRollbackPartial, renderSuccess, renderWithdraw, renderWithdrawChanged } from './external-result.js'
import { renderPreview } from './external-preview.js'
import { handler, session } from './external-session.js'
import { ensureStatus } from './external-status.js'
import { createOverlay } from './external-ui.js'
import { renderBlockers, renderChoose, renderDetectError, renderForceConfirm } from './external-wizard.js'

export { session }

/** 弹层被面板重画清掉时就地重挂；已经开着就只重画内容。 */
export function repaint() {
  if (!session.open) return
  if (session.overlay === null || session.overlay.overlay.parentNode === null) {
    session.overlay = createOverlay(/** @type {any} */ (session.ui), {
      label: '外部桌宠',
      step: session.step,
      busy: session.busy,
      onCancel: () => handler.close(),
    })
  }
  const dialog = session.overlay.dialog
  const focused = typeof document === 'object' ? document.activeElement : null
  const keep = focused?.getAttribute?.('data-external-field') ?? focused?.getAttribute?.('data-external-select') ?? ''
  const keepAttr = focused?.getAttribute?.('data-external-field') != null ? 'data-external-field' : 'data-external-select'
  dialog.textContent = ''
  renderStep(dialog)
  if (keep !== '') {
    const again = keep === '' ? null : dialog.querySelector?.('[' + keepAttr + '="' + keep + '"]')
    if (again?.focus) {
      again.focus()
      if (typeof again.setSelectionRange === 'function') again.setSelectionRange(again.value.length, again.value.length)
    }
  }
}

function renderStep(dialog) {
  switch (session.step) {
    case 'loading':
      dialog.appendChild(el('b', 'dp-ext-title', '正在检查桌面版…'))
      dialog.appendChild(el('p', 'dp-dim dp-ext-sub', '只读桌面版的发现文件，不改存档。'))
      break
    case 'detect':
    case 'detectError':
      renderDetectError(dialog, session, handler)
      break
    case 'choose':
      renderChoose(dialog, session, handler)
      break
    case 'blockers':
      renderBlockers(dialog, session, handler)
      break
    case 'force':
      renderForceConfirm(dialog, session, handler)
      break
    case 'preview':
      renderPreview(dialog, session, handler)
      break
    case 'committing':
      renderCommitting(dialog, session, handler)
      break
    case 'success':
      renderSuccess(dialog, session, handler)
      break
    case 'failure':
      renderFailure(dialog, session, handler)
      break
    case 'withdraw':
      renderWithdraw(dialog, session, handler)
      break
    case 'withdrawChanged':
      renderWithdrawChanged(dialog, session, handler)
      break
    case 'rollback':
      renderRollbackConfirm(dialog, session, handler)
      break
    case 'rollingBack':
      renderRollingBack(dialog)
      break
    case 'rollbackPartial':
      renderRollbackPartial(dialog, session, handler)
      break
    case 'recover':
      renderRecoverConfirm(dialog, session, handler)
      break
    case 'manage':
      renderManageDialog(/** @type {any} */ (session.ui), session, handler, session.overlay)
      break
    default:
      break
  }
}

// 状态机只通过这两个回调碰界面；关弹层时把句柄清掉，避免残留键盘监听。
session.repaint = repaint
session.closeOverlay = function closeOverlay() {
  session.overlay?.dispose?.()
  session.overlay = null
}

/**
 * 设置页每次重画都会调到这里：先画卡片，再按需恢复弹层。
 * @param {any} ui
 * @param {(ui: any, title: string, note?: string) => {box: any, head: any}} section
 */
export function renderExternalPetSettings(ui, section) {
  session.ui = ui
  renderExternalCard(ui, section, session, handler)
  if (session.open) repaint()
  ensureStatus(session)
}
