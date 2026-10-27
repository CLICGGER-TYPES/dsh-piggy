// @ts-check
/**
 * 合并执行与收尾页面：等待桌面确认、成功页、失败分支、切回、撤销。
 *
 * 文案照设计 4.6 / 4.8 / 4.11。成功页只写桌面端真实返回的备份名；
 * 撤销只针对最近一次合并，失败就明说「部分撤销」，不谎称两边都恢复。
 * @module dsh-piggy/client/external-result
 */
import { el } from './dom.js'
import { formatNumber, reasonText } from './external-rules.js'
import { actions, heading, note, row } from './external-ui.js'

const backupName = (backups, key) => (typeof backups?.[key] === 'string' && backups[key] !== '' ? backups[key] : '—')

/** 4.6：桌面端正在弹确认框。取消只关闭 DSH 弹层，不假装没发生。 */
export function renderCommitting(dialog, state, handlers) {
  heading(dialog, '正在合并…')
  note(dialog, '桌面版会弹出一个确认框，请在那边点「允许合并」。')
  if (state.error !== '') note(dialog, reasonText(state.error), true)
  actions(dialog, [{ key: 'commit-cancel', label: '取消', onPick: handlers.dismiss, disabled: false }])
}

/** 成功页：数字、本次两个备份、清理结果。 */
export function renderSuccess(dialog, state, handlers) {
  const result = state.result?.result ?? { name: '', level: 0, coins: 0, items: 0, badges: 0 }
  heading(dialog, '合并完成')
  if (result.name === '') {
    // 成功后没拿到摘要时不补 0：让用户刷新面板看真实状态。
    note(dialog, '桌面版没有返回最终摘要，请关闭后刷新面板确认；备份名见下。', true)
  } else {
    const line = el('span', 'dp-ext-result', '桌面上的' + result.name + '现在有：')
    line.appendChild(el('small', null, 'Lv.' + result.level + ' · 🪙' + formatNumber(result.coins) + ' · 🎒' + result.items + ' 件 · 🏅' + result.badges + ' 枚'))
    dialog.appendChild(line)
  }
  dialog.appendChild(el('b', 'dp-ext-group-head', '本次备份：'))
  row(dialog, '桌面', backupName(state.result?.backups, 'target'))
  row(dialog, '内嵌', backupName(state.result?.backups, 'source'))
  if (state.result?.cleanup === 'failed') note(dialog, '旧合并备份没清理掉，不影响这次合并，下次会再试。', true)
  else note(dialog, '更早的合并备份已清理，只保留这一次。手动备份不会被清理。')
  note(dialog, 'DSH 的工作现在会喂给桌面猪。')
  actions(dialog, [
    { key: 'success-done', label: '好的', onPick: handlers.done },
    { key: 'success-rollback', label: '撤销合并', primary: true, onPick: handlers.rollback, disabled: state.busy === true },
  ])
}

/** 4.11：失败分支只给能做的事，不说「已恢复」以外的结果。 */
export function renderFailure(dialog, state, handlers) {
  heading(dialog, state.result?.status === 'retire-failed' ? '桌宠已合并' : '合并没有完成')
  const code = state.error === '' ? state.result?.status ?? 'unknown' : state.error
  note(dialog, reasonText(code), true)
  if (code === 'retire-failed') note(dialog, '桌面猪已经合并成功；内嵌猪退役没完成，会保持外部模式重试，不会重新打开内嵌猪。')
  if (code === 'backup-failed') note(dialog, '没有改动任何存档。')
  if (code === 'declined') note(dialog, '两边都没有改动。')
  if (code === 'tx-failed') note(dialog, '桌面猪已恢复到合并前；新备份保留。')
  if (code === 'cleanup-failed') note(dialog, '合并已成功，旧备份稍后再清理。')
  for (const error of state.result?.errors ?? []) note(dialog, error.path + '：' + (error.reason === '' ? '不合法' : error.reason), true)
  actions(dialog, [
    { key: 'failure-close', label: '取消', onPick: handlers.close },
    { key: 'failure-retry', label: '重试', primary: true, onPick: handlers.retry, disabled: state.busy === true },
  ])
}

/** 4.8：连接模式切回；有队列时先问等待还是丢弃。 */
export function renderWithdraw(dialog, state, handlers) {
  const status = state.status
  if (status !== null && status.merged) {
    heading(dialog, '切回内嵌猪？')
    note(dialog, '内嵌猪已经合并到桌宠并退役（不在默认存档路径）。')
    note(dialog, '切回会从备份恢复合并前的内嵌猪，桌面猪保持现状（会出现两只相似的猪）。')
    note(dialog, '如果你想连桌面猪一起恢复到合并前，请用「撤销合并」。')
    actions(dialog, [
      { key: 'withdraw-cancel', label: '取消', onPick: handlers.close },
      { key: 'withdraw-recover', label: '只恢复内嵌猪', onPick: handlers.recoverLocal },
      { key: 'withdraw-rollback', label: '撤销合并', primary: true, onPick: handlers.rollback, disabled: status.connection !== 'connected' || !status.canRollback },
    ])
    return
  }
  if (state.withdrawDiscard === true) {
    heading(dialog, '还有 ' + (status?.queued ?? 0) + ' 条工作没送到')
    note(dialog, '现在切回，这 ' + (status?.queued ?? 0) + ' 条会留在 outbox，不会再喂给桌面猪。')
    actions(dialog, [
      { key: 'discard-cancel', label: '取消', onPick: handlers.close },
      { key: 'discard-wait', label: '等待送达', onPick: handlers.waitDeliver },
      { key: 'discard-go', label: '丢弃并切回', primary: true, onPick: () => handlers.withdrawNow(true) },
    ])
    return
  }
  heading(dialog, '切回内嵌猪？')
  note(dialog, '桌面猪会留在桌面，DSH 的工作和面板不再投给它。')
  note(dialog, '内嵌猪从暂存时接着养：暂存期间不饿、不病、不长大。')
  if ((status?.queued ?? 0) > 0) note(dialog, '还有 ' + status.queued + ' 条工作没送到；切回前会让你确认。', true)
  actions(dialog, [
    { key: 'withdraw-cancel', label: '取消', onPick: handlers.close },
    { key: 'withdraw-go', label: '切回', primary: true, onPick: () => handlers.withdrawNow(false), disabled: state.busy === true },
  ])
}

/** 4.8：撤销确认，说明新增进度会丢、皮肤只撤回本次复制。 */
export function renderRollbackConfirm(dialog, state, handlers) {
  heading(dialog, '撤销合并？')
  note(dialog, '将把桌面猪和 DSH 内嵌猪都恢复到合并前的存档。合并后新增的进度会丢失。')
  note(dialog, '合并时从内嵌猪复制过来的皮肤会撤回；合并后新导入的皮肤保留。')
  note(dialog, '桌面合并后的存档会先另存一份备份，不会无声丢掉。')
  if (state.error !== '') note(dialog, reasonText(state.error), true)
  actions(dialog, [
    { key: 'rollback-cancel', label: '取消', onPick: handlers.close },
    { key: 'rollback-go', label: '确认撤销', primary: true, onPick: handlers.rollbackGo, disabled: state.busy === true },
  ])
}

/** 撤销中。 */
export function renderRollingBack(dialog) {
  heading(dialog, '正在撤销…')
  note(dialog, '先把桌面合并后的存档另存一份，再恢复两边；不要操作。')
}

/** 撤销失败只恢复了一边。 */
export function renderRollbackPartial(dialog, state, handlers) {
  heading(dialog, '部分撤销')
  const restored = state.result?.restored ?? { target: false, source: false }
  note(dialog, (restored.target ? '桌面猪已恢复。' : '桌面猪没恢复。') + (restored.source ? '内嵌猪已恢复。' : '内嵌猪没恢复。'), true)
  row(dialog, '桌面备份', backupName(state.result?.backups, 'target'))
  row(dialog, '内嵌备份', backupName(state.result?.backups, 'source'))
  note(dialog, '重试只会补没恢复的一边，不会重复覆盖已经恢复的一边。')
  actions(dialog, [
    { key: 'partial-close', label: '关闭', onPick: handlers.close },
    { key: 'partial-retry', label: '重试', primary: true, onPick: handlers.rollbackGo, disabled: state.busy === true },
  ])
}

/** 「只恢复内嵌猪」的二次确认；桌面保持合并后的猪。 */
export function renderRecoverConfirm(dialog, state, handlers) {
  heading(dialog, '只恢复内嵌猪？')
  note(dialog, '会从 DSH 本地备份恢复合并前的内嵌猪，桌面猪保持合并后的样子（会出现两只相似的猪）。')
  note(dialog, '先把备份恢复到临时位置并校验，再放回 state.json；失败会保留退役标记。')
  if (state.error !== '') note(dialog, reasonText(state.error), true)
  actions(dialog, [
    { key: 'recover-cancel', label: '取消', onPick: handlers.close },
    { key: 'recover-go', label: '恢复内嵌猪', primary: true, onPick: handlers.recoverGo, disabled: state.busy === true },
  ])
}

/** 5.6 / 4.11：暂存期间存档被改过，切回前明确说会按正常离线结算。 */
export function renderWithdrawChanged(dialog, state, handlers) {
  heading(dialog, '暂存期间存档被改过')
  note(dialog, '切回会按正常离线结算，可能变饿、生病。内嵌猪不会按暂存时刻后移时间。', true)
  if (state.error !== '') note(dialog, reasonText(state.error), true)
  actions(dialog, [
    { key: 'withdraw-changed-cancel', label: '取消', onPick: handlers.close },
    { key: 'withdraw-changed-go', label: '仍要切回', primary: true, onPick: handlers.withdrawChangedGo, disabled: state.busy === true },
  ])
}
