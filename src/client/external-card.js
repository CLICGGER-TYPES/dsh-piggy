// @ts-check
/**
 * 设置页「外部桌宠」卡片（设计 4.1）和「管理」弹层。
 *
 * 卡片只按 pigState + connection 两个字段切换文案，不把两者合成一个 mode；
 * 断线时明确写「没连上」和队列条数，不用「已连接」蒙混过去。
 * @module dsh-piggy/client/external-card
 */
import { button, el } from './dom.js'
import { clockText, reasonText, summaryLine } from './external-rules.js'
import { createOverlay, actions, note, row } from './external-ui.js'

const lastAtText = status => {
  const at = clockText(status.lastAt)
  return at === '' ? '' : ' · 上次 ' + at
}

function statusLine(card, text, tone) {
  const line = el('span', 'dp-ext-state', text)
  line.setAttribute('data-tone', tone)
  card.appendChild(line)
  return line
}

function cardActions(card, specs) {
  const rowNode = el('div', 'dp-ext-card-actions')
  for (const spec of specs) {
    if (spec === null || spec === undefined) continue
    const node = button(spec.primary === true ? 'dp-mini' : 'dp-btn', { 'data-external-action': spec.key }, function () { spec.onPick?.() })
    node.textContent = spec.label
    node.disabled = spec.disabled === true
    if (spec.wide === true) node.className += ' dp-btn-wide'
    rowNode.appendChild(node)
  }
  card.appendChild(rowNode)
}

/**
 * 画卡片。状态对象来自 /external/status；还没读到时只说「正在检查」。
 * @param {any} ui
 * @param {(ui: any, title: string, note?: string) => {box: any, head: any}} section
 * @param {any} state
 * @param {any} handlers
 */
export function renderExternalCard(ui, section, state, handlers) {
  const status = state.status
  const entry = section(ui, '外部桌宠')
  const box = entry.box
  box.setAttribute('data-external-pet', 'true')
  const busy = state.busy === true

  if (status === null) {
    statusLine(box, state.error === '' ? '正在检查桌面版…' : '读不到外部桌宠状态', state.error === '' ? 'warn' : 'warn')
    if (state.error !== '') note(box, state.error, true)
    cardActions(box, [{ key: 'recheck', label: '重新检测', onPick: handlers.recheck, disabled: busy, wide: true }])
    return
  }

  const desktop = status.desktop
  const target = status.target
  if (status.retirementPending) note(box, '内嵌猪退役还没完成，正在重试；桌面猪已经合并，不会重新打开内嵌猪。', true)
  if (status.configCorrupt) {
    statusLine(box, '外部桌宠配置读不出来', 'warn')
    note(box, '配置文件损坏或读不了；原文件会改名留证，不会自动删除，也不会打开已合并的旧存档。', true)
    cardActions(box, [
      { key: 'recheck', label: '重试读取', onPick: handlers.recheck, disabled: busy },
      { key: 'restore-backup', label: '从最近合并备份恢复', onPick: handlers.restoreBackup, disabled: busy },
      status.pigState === 'merged'
        ? { key: 'recover-local', label: '只恢复内嵌猪', onPick: handlers.recoverLocal, disabled: busy, wide: true }
        : { key: 'withdraw', label: '切回内嵌猪', onPick: handlers.withdraw, disabled: busy, wide: true },
    ])
    return
  }
  // 连接前（内嵌模式）才需要「找到桌面版/开了联动」这两步。
  // 已经连过的外部模式只看 connection/pigState：持久化的 target 摘要在桌面没开时
  // 仍然存在，不能拿它判断「桌面版在运行」，否则 DSH 重启后会被画成「没开联动」。
  if (status.mode === 'internal') {
    if (!desktop.found) {
      statusLine(box, '没找到已开启联动的桌面版', 'warn')
      if (status.error === 'disabled' || desktop.reason === 'external-disabled') note(box, '桌面版在运行，但没开联动。去桌面版「设置 → 外部连接」打开「允许 DSH 联动」。')
      else if (status.error === 'no-pair' || status.error === 'pair-not-offered' || desktop.reason === 'pair-unavailable') note(box, '桌面版只开了工作接口，请在桌面设置里允许 DSH 联动。')
      cardActions(box, [{ key: 'recheck', label: '重新检测', onPick: handlers.recheck, disabled: busy, wide: true }])
      return
    }
    if (!desktop.enabled) {
      statusLine(box, '桌面版在运行，但没开联动', 'warn')
      note(box, '去桌面版「设置 → 外部连接」打开「允许 DSH 联动」，再回来重新检测。')
      cardActions(box, [{ key: 'recheck', label: '重新检测', onPick: handlers.recheck, disabled: busy, wide: true }])
      return
    }
    statusLine(box, '桌面版已就绪 · ' + summaryLine(target), 'ok')
    note(box, '连接后，DSH 的工作和面板操作都交给桌面上的猪。')
    cardActions(box, [{ key: 'connect', label: '连接桌面猪', primary: true, onPick: handlers.connect, disabled: busy, wide: true }])
    return
  }

  if (status.merged) {
    if (status.connection === 'connected') {
      statusLine(box, '● 已合并到桌宠 · ' + summaryLine(target), 'ok')
      note(box, '内嵌猪已收进备份并退役；只能撤销最近一次合并。')
      cardActions(box, [
        { key: 'manage', label: '管理', onPick: handlers.manage, disabled: busy },
        { key: 'rollback', label: '撤销合并', onPick: handlers.rollback, disabled: busy || !status.canRollback },
      ])
    } else {
      statusLine(box, '○ 已合并 · 桌面版没开' + lastAtText(status), 'warn')
      note(box, '内嵌猪已收进备份并退役；工作事件在排队（' + status.queued + ' 条）。')
      note(box, '撤销合并要等桌面版连上；仍可选择「只恢复内嵌猪」。')
      cardActions(box, [
        { key: 'recheck', label: '重新连接', onPick: handlers.recheck, disabled: busy },
        { key: 'manage', label: '管理', onPick: handlers.manage, disabled: busy },
      ])
    }
    return
  }

  if (status.connection === 'connected') {
    statusLine(box, '● 已连接 · ' + summaryLine(target), 'ok')
    note(box, 'DSH 的工作正在投给桌面上的猪。')
    cardActions(box, [
      { key: 'manage', label: '管理', onPick: handlers.manage, disabled: busy },
      status.pigState === 'paused'
        ? { key: 'withdraw', label: '切回内嵌猪', onPick: handlers.withdraw, disabled: busy }
        : null,
    ])
    return
  }

  if (status.pigState === 'merging' || status.pigState === 'merge-unknown' || status.pigState === 'rolling-back') {
    const text = status.pigState === 'rolling-back' ? '正在撤销…' : status.pigState === 'merging' ? '正在合并…' : '正在确认合并结果…'
    statusLine(box, text, 'warn')
    note(box, '先等桌面版处理完，不要操作。')
    cardActions(box, [{ key: 'recheck', label: '重新连接', onPick: handlers.recheck, disabled: true, wide: true }])
    return
  }

  statusLine(box, '○ 没连上桌面版' + lastAtText(status), 'warn')
  note(box, '工作事件在排队（' + status.queued + ' 条）；面板显示最后一次同步的状态。')
  cardActions(box, [
    { key: 'recheck', label: '重新连接', onPick: handlers.recheck, disabled: busy },
    { key: 'manage', label: '管理', onPick: handlers.manage, disabled: busy },
  ])
}

/**
 * 「管理」弹层：看队列、暂存的内嵌猪去哪、合并/切回/只恢复。
 * @param {any} ui
 * @param {any} state
 * @param {any} handlers
 * @param {any} [view] overlay 句柄，关闭时由调用方释放
 */
export function renderManageDialog(ui, state, handlers, view) {
  const dialog = view.dialog
  dialog.setAttribute('data-external-dialog', 'manage')
  dialog.appendChild(el('b', 'dp-ext-title', '管理桌面连接'))
  const status = state.status
  const target = status?.target ?? null
  row(dialog, '桌面猪', summaryLine(target))
  row(dialog, '内嵌猪', status?.pigState === 'merged' ? '已合并并退役' : status?.pigState === 'paused' ? '暂存中，不饿不病' : '没有内嵌猪')
  row(dialog, '连接', status?.connection === 'connected' ? '已连接' : '没连上')
  if (status !== null && status.queued > 0) row(dialog, '工作队列', status.queued + ' 条')

  if (state.manageStep === 'discard') {
    note(dialog, '还有 ' + status.queued + ' 条工作没送到')
    note(dialog, '现在切回，这 ' + status.queued + ' 条会留在 outbox，不会再喂给桌面猪。', true)
    actions(dialog, [
      { key: 'discard-cancel', label: '取消', onPick: () => handlers.setManageStep('') },
      { key: 'discard-wait', label: '等待送达', primary: true, onPick: () => { handlers.setManageStep(''); handlers.closeManage() } },
      { key: 'discard-go', label: '丢弃并切回', onPick: () => handlers.withdraw(true) },
    ])
    return
  }

  if (status !== null && status.merged) {
    note(dialog, '内嵌猪已经合并到桌宠并退役（不在默认存档路径）。只能撤销最近一次合并，或把合并前的内嵌猪单独恢复。')
    actions(dialog, [
      { key: 'manage-close', label: '取消', onPick: handlers.closeManage },
      { key: 'recover-local', label: '只恢复内嵌猪', onPick: () => handlers.recoverLocal() },
      { key: 'manage-rollback', label: '撤销合并', primary: true, disabled: status.connection !== 'connected' || !status.canRollback, onPick: () => handlers.rollback() },
    ])
    return
  }

  if (status !== null && status.pigState === 'paused') {
    note(dialog, status.connection === 'connected'
      ? '想只改投递就把面板交给桌面猪；想连数据一起带过去，就用合并。'
      : '桌面版没开，暂存的内嵌猪先保持不动；工作事件在排队。')
    actions(dialog, [
      { key: 'manage-close', label: '取消', onPick: handlers.closeManage },
      { key: 'manage-merge', label: '合并到桌面猪', primary: true, disabled: status.connection !== 'connected' || !status.canMerge, onPick: () => handlers.mergeStaged() },
      { key: 'manage-withdraw', label: '切回内嵌猪', onPick: () => handlers.withdraw() },
    ])
    return
  }

  note(dialog, 'DSH 里没有内嵌猪可合并；切回会显示纸盒。')
  actions(dialog, [
    { key: 'manage-close', label: '关闭', primary: true, onPick: handlers.closeManage },
  ])
}

/** 打开管理弹层，返回句柄给状态机保存。 */
export function openManage(ui, state, handlers) {
  const view = createOverlay(ui, {
    label: '管理桌面连接',
    step: 'manage',
    busy: state.busy === true,
    onCancel: handlers.closeManage,
  })
  renderManageDialog(ui, state, handlers, view)
  return view
}
