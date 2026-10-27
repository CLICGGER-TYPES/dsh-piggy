// @ts-check
/**
 * 外部桌宠向导的前三步：检测失败说明、两边的猪怎么处理、合并前先结束进行中活动。
 *
 * 文案照设计 4.2 / 4.3 / 4.4；强制终结的后果和二次确认都来自 external-rules，
 * 界面不自己另写一套说法。
 * @module dsh-piggy/client/external-wizard
 */
import { el } from './dom.js'
import { blockerCopy, canForce, mergeOptions, reasonText, summaryLine } from './external-rules.js'
import { actions, choiceRow, heading, note, row } from './external-ui.js'

/** 4.2：找不到桌面版时的说明页，原样列出三条排查。 */
export function renderDetectError(dialog, state, handlers) {
  const desktop = state.status?.desktop
  heading(dialog, desktop?.found ? (desktop.enabled ? '桌面版已就绪' : '桌面版还没准备好') : '没找到桌面上的小猪')
  if (state.error !== '') note(dialog, reasonText(state.error), true)
  const steps = el('ol', 'dp-ext-list')
  ;[
    '桌面版和 DSH 在同一台电脑上运行',
    '桌面版「设置 → 外部连接」已打开「允许 DSH 联动」',
    '桌面版没有停在存档导入/合并中',
  ].forEach(text => steps.appendChild(el('li', null, text)))
  dialog.appendChild(steps)
  if (state.error === 'disabled' || state.status?.desktop.reason === 'external-disabled') note(dialog, '桌面版在运行，但没开联动。')
  if (state.error === 'no-pair' || state.error === 'pair-not-offered') note(dialog, '桌面版只开了工作接口，需要在桌面设置里允许 DSH 联动。')
  actions(dialog, [
    { key: 'detect-cancel', label: '取消', onPick: handlers.close },
    { key: 'detect-retry', label: '重新检测', primary: true, disabled: state.busy === true, onPick: handlers.recheck },
  ])
}

/** 4.3：只连接还是合并；默认只连接，合并要用户明确选。 */
export function renderChoose(dialog, state, handlers) {
  const status = state.status
  const options = mergeOptions(status.target, status.local)
  heading(dialog, '连接桌面猪')
  row(dialog, '桌面上的猪', summaryLine(status.target))
  row(dialog, 'DSH 里的猪', summaryLine(status.local))
  dialog.appendChild(el('b', 'dp-ext-group-head', '怎么处理？'))
  const mode = state.mode
  choiceRow(dialog, {
    key: 'connect', label: '只把工作和面板交给桌面猪',
    note: '内嵌猪暂存，不饿不病；东西不合并',
    checked: mode === 'connect', onPick: () => handlers.setMode('connect'),
  })
  if (options.canMerge) {
    choiceRow(dialog, {
      key: 'merge', label: options.mergeLabel === '搬到桌宠' ? '把内嵌猪搬到桌宠' : '把内嵌猪合并到桌面猪',
      note: '资产相加，进度取更高，身份由你选',
      checked: mode === 'merge', onPick: () => handlers.setMode('merge'),
    })
  }
  choiceRow(dialog, {
    key: 'cancel', label: '先不连接',
    checked: mode === 'cancel', onPick: () => handlers.setMode('cancel'),
  })
  if (options.note !== '') note(dialog, options.note)
  if (state.error !== '') note(dialog, reasonText(state.error), true)
  actions(dialog, [
    { key: 'choose-back', label: '上一步', onPick: handlers.backToDetect, disabled: state.busy === true },
    { key: 'choose-next', label: '下一步', primary: true, onPick: handlers.chooseNext, disabled: state.busy === true || (mode === 'merge' && !options.canMerge) },
  ])
}

/** 4.4：进行中的活动逐项列出；每项终结后重新检查。 */
export function renderBlockers(dialog, state, handlers) {
  heading(dialog, '合并前要先结束这些')
  const blockers = state.blockers ?? []
  if (blockers.length === 0) {
    note(dialog, reasonText(state.error === '' ? 'blocked-activity' : state.error), true)
  }
  for (const blocker of blockers) {
    const block = el('div', 'dp-ext-block')
    block.setAttribute('data-external-blocker', blocker.kind)
    block.appendChild(el('b', null, (blocker.side === 'target' ? '桌面上的猪' : '内嵌的猪') + ' · ' + (blocker.label === '' ? blocker.kind : blocker.label)))
    const copy = blockerCopy(blocker)
    block.appendChild(el('small', null, copy.title))
    const rowNode = el('div', 'dp-ext-block-actions')
    const goLabel = blocker.side === 'target' ? '去桌面处理' : '去处理'
    const go = el('button', 'dp-btn', goLabel)
    go.setAttribute('data-external-goto', blocker.side)
    go.addEventListener('click', function (event) { event.stopPropagation(); handlers.goHandle(blocker) })
    rowNode.appendChild(go)
    if (canForce(blocker)) {
      const force = el('button', 'dp-mini', copy.done ? '先结算' : '强制终结')
      force.setAttribute('data-external-force', blocker.kind)
      force.addEventListener('click', function (event) { event.stopPropagation(); handlers.askForce(blocker) })
      rowNode.appendChild(force)
    }
    block.appendChild(rowNode)
    dialog.appendChild(block)
  }
  if (state.error !== '' && blockers.length > 0) note(dialog, reasonText(state.error), true)
  actions(dialog, [
    { key: 'blocked-cancel', label: '取消', onPick: handlers.close },
    { key: 'blocked-recheck', label: '重新检查', primary: true, disabled: state.busy === true, onPick: handlers.recheck },
  ])
}

/** 强制终结的二次确认页；确认后立即执行，不可撤销（但还没写合并）。 */
export function renderForceConfirm(dialog, state, handlers) {
  const blocker = state.terminate
  if (blocker === null || blocker === undefined) {
    heading(dialog, '这项活动已经处理过了')
    note(dialog, '重新检查一下两边的状态。')
    actions(dialog, [{ key: 'force-back', label: '返回', onPick: handlers.cancelForce }])
    return
  }
  heading(dialog, '强制终结？')
  const copy = blockerCopy(blocker)
  note(dialog, copy.title)
  note(dialog, blocker.side === 'target' ? '这一步会在桌面版上执行，执行完重新检查。' : '这一步会在 DSH 的内嵌猪上执行，执行完重新检查。')
  if (state.error !== '') note(dialog, reasonText(state.error), true)
  actions(dialog, [
    { key: 'force-cancel', label: '取消', onPick: handlers.cancelForce },
    { key: 'force-go', label: '强制结束', primary: true, disabled: state.busy === true, onPick: handlers.force },
  ])
}
