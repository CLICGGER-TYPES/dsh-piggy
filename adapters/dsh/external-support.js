// @ts-check
/**
 * 外部模式的小工具：源端/桌面端的合并前置条件，带 #14 4.4 需要的真实细节
 * （活动类型、phase、退款、鱼饵、是否已到点）。
 *
 * @module dsh-piggy/adapters/dsh/external-support
 */

import { mergeBlockers } from '../../core.js'

const integer = value => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0)

/** 源端（本地存档）的阻塞项；`nowMs` 用这一端的猪时钟（暂存时传 suspendedAt）。 */
export function sourceBlockers(state, nowMs = Date.now()) {
  if (state === null) return []
  return mergeBlockers(null, state, nowMs).filter(blocker => blocker.side === 'source')
}

/**
 * 桌面端的阻塞项。数据来自面板快照（`/pair/state`），不是猜的：
 * activity.secondsLeft===0 表示已到点（先结算再继续），cost 是退款额，bait 是自动钓鱼鱼饵。
 */
export function targetBlockers(view) {
  if (view === null || typeof view !== 'object') return []
  const out = []
  const activity = view.activity
  if (activity !== null && activity !== undefined) {
    const auto = activity.kind === 'fishing'
    out.push({
      side: 'target',
      reason: auto ? 'fishing' : 'activity',
      kind: auto ? 'fishing-auto' : String(activity.kind ?? 'activity'),
      label: typeof activity.label === 'string' ? activity.label : '',
      phase: auto ? 'auto' : '',
      finished: integer(activity.secondsLeft) === 0,
      refund: auto || activity.kind === 'work' ? 0 : integer(activity.cost),
      bait: auto ? integer(activity.bait) : 0,
      minutes: Math.ceil(integer(activity.secondsLeft) / 60),
    })
  }
  const pomodoro = view.pomodoro
  if (pomodoro?.active === true) {
    out.push({
      side: 'target', reason: 'pomodoro', kind: 'pomodoro', label: '番茄钟', phase: '',
      finished: integer(pomodoro.secondsLeft) === 0, refund: 0, bait: 0,
      minutes: Math.ceil(integer(pomodoro.secondsLeft) / 60),
    })
  }
  const pending = view.fishing?.pending ?? null
  if (pending !== null) {
    out.push({
      side: 'target', reason: 'fishing', kind: 'fishing-manual', label: '钓鱼',
      phase: typeof pending.phase === 'string' ? pending.phase : '',
      finished: pending.phase === 'caught', refund: 0, bait: 0, minutes: 0,
    })
  }
  return out
}

/** 预览被桌面端挡住时，把拒绝详情翻成同形状的阻塞项（客户端按这个显示精确文案）。 */
export function blockersFromDetails(reason, details) {
  if (!['activity', 'pomodoro', 'fishing'].includes(reason)) return []
  if (details === null || typeof details !== 'object') return []
  const side = details.side === 'source' ? 'source' : 'target'
  const kind = typeof details.kind === 'string' && details.kind !== ''
    ? details.kind
    : reason === 'pomodoro' ? 'pomodoro' : reason === 'fishing' ? 'fishing-manual' : 'activity'
  return [{
    side, reason, kind,
    label: typeof details.label === 'string' ? details.label : '',
    phase: typeof details.phase === 'string' ? details.phase : '',
    finished: details.finished === true,
    refund: integer(details.refund),
    bait: integer(details.bait),
    minutes: integer(details.minutes),
  }]
}
