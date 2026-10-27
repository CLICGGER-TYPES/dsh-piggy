// @ts-check
/**
 * 外部桌宠的收尾动作：切回、只恢复内嵌猪、撤销合并、重试退役。
 *
 * 从状态机拆出来，避免单文件超过 400 行；只通过 hooks 回调改界面，
 * 每个动作都按契约检查真实返回，不谎称两边都完成。
 * @module dsh-piggy/client/external-runtime
 */
import { connect, disconnect, mergeStatus, normalizeResult, restore, retireRetry, rollback } from './external-api.js'
import { str } from './values.js'

export async function runWithdraw(session, hooks, discard, confirmChanged) {
  const queued = session.status?.queued ?? 0
  if (!discard && !confirmChanged && queued > 0) {
    session.withdrawDiscard = true
    hooks.repaint()
    return
  }
  session.busy = true
  session.error = ''
  hooks.repaint()
  try {
    const result = await disconnect({ discardQueue: discard === true, confirmChanged: confirmChanged === true })
    if (!result.ok) {
      const code = result.error?.code ?? 'network'
      if (code === 'queue-not-empty') { session.withdrawDiscard = true; session.error = ''; return }
      if (code === 'state-changed') { session.withdrawChanged = true; session.error = ''; session.step = 'withdrawChanged'; return }
      session.error = code
      return
    }
    await hooks.reload()
    hooks.close()
    hooks.bubble('已切回内嵌猪', 3000)
  } finally {
    session.busy = false
    hooks.repaint()
    hooks.render()
  }
}

export async function runRecover(session, hooks) {
  session.busy = true
  session.error = ''
  hooks.repaint()
  try {
    const result = await restore()
    if (!result.ok) { session.error = result.error?.code ?? 'network'; return }
    await hooks.reload()
    hooks.close()
    hooks.bubble('内嵌猪已恢复', 3200)
  } finally {
    session.busy = false
    hooks.repaint()
    hooks.render()
  }
}

export async function runRetireRetry(session, hooks) {
  session.busy = true
  session.error = ''
  hooks.repaint()
  try {
    const result = await retireRetry()
    const normalized = normalizeResult(result.data ?? {})
    session.result = normalized
    if (result.ok && normalized.ok) {
      session.step = 'success'
      await hooks.reload()
    } else {
      session.error = result.error?.code ?? 'retire-failed'
      session.step = 'failure'
    }
  } finally {
    session.busy = false
    hooks.repaint()
    hooks.render()
  }
}

export async function runRollback(session, hooks) {
  const mergeId = session.result?.mergeId ?? session.status?.mergeId ?? str(session.status?.merge?.mergeId, '')
  session.busy = true
  session.error = ''
  session.step = 'rollingBack'
  hooks.repaint()
  try {
    const result = await rollback(mergeId)
    const normalized = normalizeResult(result.data ?? {})
    session.result = normalized
    if (result.ok && normalized.restored.target && normalized.restored.source) {
      await hooks.reload()
      hooks.close()
      hooks.bubble('已撤销合并', 3200)
      return
    }
    session.error = result.error?.code ?? normalized.status ?? 'rollback-partial'
    const partial = normalized.restored.target || normalized.restored.source
    session.step = partial ? 'rollbackPartial' : 'rollback'
  } finally {
    session.busy = false
    hooks.repaint()
    hooks.render()
  }
}

/** 契约里两猪选择页数据来自 connect {mode:'merge'}；这一步不冻结、不写配置。 */
export async function loadMergePage(session, hooks) {
  const result = await connect('merge')
  if (!result.ok) {
    session.error = result.error?.code ?? 'network'
    session.step = 'detectError'
    hooks.repaint()
    return false
  }
  session.status = {
    ...session.status,
    target: result.page.target,
    local: result.page.source,
    canMerge: true,
  }
  session.blockers = result.page.blockers
  session.step = 'choose'
  hooks.repaint()
  return true
}

/** merge-unknown：只轮询 status，不恢复内嵌猪；2 分钟仍未知才显示失败。 */
export async function pollMergeUnknown(session, hooks) {
  const mergeId = session.result?.mergeId ?? session.preview?.mergeId ?? ''
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    const result = await mergeStatus(mergeId)
    const body = result.data ?? {}
    const statusText = String(body.reason ?? body.status ?? '')
    if (!result.ok && statusText === '') continue
    if (statusText === 'committed') {
      session.result = normalizeResult(result.data ?? {})
      await hooks.reload()
      session.step = 'success'
      hooks.repaint()
      return
    }
    if (statusText === 'failed' || statusText === 'rolled-back' || statusText === 'restored') {
      session.error = statusText
      session.step = 'failure'
      await hooks.reload()
      hooks.repaint()
      return
    }
  }
  session.error = 'merge-unknown'
  session.step = 'failure'
  hooks.repaint()
}
