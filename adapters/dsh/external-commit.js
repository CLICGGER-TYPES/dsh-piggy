// @ts-check
/**
 * 外部模式的提交、结果确认、撤销与只恢复内嵌猪。
 *
 * @module dsh-piggy/adapters/dsh/external-commit
 */

import { randomUUID } from 'node:crypto'

import { SESSION_BOUNDARY } from '../../runtime/session-context.js'
import { pendingMergeConfig } from './external-lifecycle.js'
import { readDsHistory, dsBackupForMerge, markDsRolledBack, recordDsMerge, restoreEmbeddedFromBackup, retireEmbedded, cleanupDsOldMerges, listSourceBackups } from './external-merge.js'
import { removeConfig } from './external-files.js'

export const UNKNOWN_TIMEOUT_MS = 2 * 60_000

const MERGE_ID = /^[a-f0-9-]{36}$/

export function createCommitFlow(ctx) {
  const { statePath, now, outbox, client } = ctx
  let pollTimer = null

  /** 结果未知/预览尚未结算时持续只读查询；不重新提交、不再相加。 */
  function schedulePoll() {
    if (pollTimer !== null) return
    pollTimer = setTimeout(() => { pollTimer = null; void pollMergeStatus() }, 1000)
    pollTimer.unref?.()
  }

  /** 控制器会话已处置后不再写存档/配置；调用方拿到现有风格的 reason。 */
  function sessionProblem() {
    const session = ctx.getSession?.()
    if (session === undefined || session === null) return SESSION_BOUNDARY.FOREIGN
    return session.disposed ? SESSION_BOUNDARY.DISPOSED : null
  }

  async function finalizeCommit(body, previous) {
    const config = ctx.getConfig()
    const mergeId = body.mergeId ?? previous?.mergeId ?? config?.mergeId
    const problem = sessionProblem()
    if (problem !== null) {
      // 桌面可能已经提交；这里只报告“目标已提交但本会话不能落盘”，下一次 init
      // 会按 merging/merge-unknown 只查询原事务，不重新相加。
      return { ok: false, reason: problem, targetCommitted: true, mergeId, target: body.result ?? null, backups: body.backups ?? null }
    }
    const backupName = previous?.backupName ?? config?.backup ?? dsBackupForMerge(statePath, mergeId)
    let retired
    try {
      retired = await retireEmbedded({
        statePath, mergeId, backupName, now, stopRuntime: () => ctx.stopEmbedded(),
        config: config === null ? ctx.baseConfig() : config, saveConfig: ctx.saveConfig,
      })
    } catch (cause) {
      ctx.saveConfig({ ...(ctx.getConfig() ?? ctx.baseConfig()), pigState: 'merged', connection: 'connected', mergeId, target: ctx.getTarget(), retirementPending: true })
      await ctx.setMode('external')
      return {
        ok: false, reason: 'retire-failed', targetCommitted: true, mergeId,
        message: cause instanceof Error ? cause.message : String(cause),
        target: body.result ?? null, backups: body.backups ?? null,
      }
    }
    const warnings = []
    let record = null
    try { record = recordDsMerge({ statePath, mergeId, backupName, targetBackup: body.backups?.target ?? null, nowMs: now(), retired }) }
    catch (cause) { warnings.push(`DSH 合并记录没写成：${cause instanceof Error ? cause.message : String(cause)}`) }
    let cleanup = { removed: [], warnings: [], skipped: true }
    try { cleanup = cleanupDsOldMerges(statePath, mergeId) } catch (cause) { cleanup.warnings.push(`旧合并备份清理失败：${cause instanceof Error ? cause.message : String(cause)}`) }
    ctx.saveConfig({
      ...(ctx.getConfig() ?? ctx.baseConfig()), pigState: 'merged', connection: 'connected', mergeId,
      backup: backupName, target: ctx.getTarget(), lastSummary: body.result ?? config?.lastSummary ?? null,
      retired: { state: retired.stateRenamed ? `${statePath}.merged-${mergeId}` : null, workEvents: retired.workEventsRenamed ? `${statePath}.work-events.merged-${mergeId}` : null },
      updatedAt: now(),
    })
    ctx.setPreview(null)
    if (ctx.getExpiry() !== null) { clearTimeout(ctx.getExpiry()); ctx.setExpiry(null) }
    await ctx.setMode('external')
    ctx.setConnection('connected')
    outbox.resume()
    ctx.scheduleDelivery(0)
    await ctx.refreshTargetSummary().catch(() => {})
    return { ...body, ok: true, warnings: [...new Set([...(Array.isArray(body.warnings) ? body.warnings : []), ...warnings, ...cleanup.warnings])], dsh: { retired, record: record?.merges?.at(-1) ?? null, cleanup } }
  }

  async function commitMerge(choices) {
    const problem = sessionProblem()
    if (problem !== null) return { ok: false, reason: problem }
    const preview = ctx.getPreview()
    if (preview === null) return { ok: false, reason: 'unknown-preview' }
    if (typeof preview.sessionId !== 'string' || preview.sessionId !== ctx.getSession().id) {
      return { ok: false, reason: SESSION_BOUNDARY.STALE, mergeId: preview.mergeId }
    }
    if (now() >= preview.expiresAt) { await ctx.cancelPreview('expired'); return { ok: false, reason: 'preview-expired' } }
    const config = ctx.getConfig()
    ctx.saveConfig({
      ...(config ?? ctx.baseConfig()), connection: 'merging', mergeId: preview.mergeId,
      mergeStartedAt: now(), pigState: config?.pigState ?? 'paused',
    })
    ctx.setConnection('merging')
    outbox.pause()
    let response
    try {
      response = await client.commit({
        mergeId: preview.mergeId, previewToken: preview.previewToken, choices: choices ?? {},
        sourceBackup: preview.backupName, sourceSha256: preview.sourceSha256 ?? undefined,
      })
    } catch (cause) {
      const latest = ctx.getConfig()
      ctx.saveConfig({ ...(latest ?? ctx.baseConfig()), pigState: 'merge-unknown', connection: 'disconnected', mergeId: preview.mergeId, mergeStartedAt: now(), target: ctx.getTarget(), lastSummary: preview.report?.result ?? null })
      ctx.setConnection('disconnected')
      return { ok: false, reason: 'merge-unknown', mergeId: preview.mergeId, message: cause instanceof Error ? cause.message : String(cause) }
    }
    if (response.status === 200 && response.json?.ok === true) return finalizeCommit(response.json, preview)
    if (response.status >= 500 || response.json === null) {
      const latest = ctx.getConfig()
      ctx.saveConfig({ ...(latest ?? ctx.baseConfig()), pigState: 'merge-unknown', connection: 'disconnected', mergeId: preview.mergeId, mergeStartedAt: now(), target: ctx.getTarget(), lastSummary: preview.report?.result ?? null })
      ctx.setConnection('disconnected')
      return { ok: false, reason: 'merge-unknown', mergeId: preview.mergeId, status: response.status }
    }
    // 桌面明确拒绝/显式变化：源端恢复，不写合并结果。
    const reason = response.json?.reason ?? 'commit-refused'
    await ctx.cancelPreview(reason)
    return { ok: false, reason, status: response.status, details: response.json?.details ?? null }
  }

  async function pollMergeStatus() {
    const problem = sessionProblem()
    if (problem !== null) return { ok: false, reason: problem }
    const config = ctx.getConfig()
    // merge-unknown（提交失败/断线）和 connection=merging（请求发出后崩溃）都只
    // 查询桌面原事务；不拿旧预览重新提交，也不把源端再次相加。
    if (config?.pigState !== 'merge-unknown' && config?.connection !== 'merging') return { ok: true, ...ctx.status() }
    const mergeId = config.mergeId
    if (typeof mergeId !== 'string' || !MERGE_ID.test(mergeId)) return { ok: false, reason: 'bad-state' }
    let response
    try { response = await client.mergeStatus(mergeId) } catch { return { ok: false, reason: 'disconnected' } }
    if (response.status !== 200 || response.json === null) return { ok: false, reason: 'disconnected' }
    const state = typeof response.json.status === 'string' ? response.json.status : 'unknown'
    if (state === 'committed') return finalizeCommit({ ok: true, mergeId, result: response.json.result, backups: response.json.backups }, null)
    if (state === 'failed' || state === 'rolled-back' || state === 'unknown') {
      const since = Number(config.mergeStartedAt ?? config.updatedAt ?? 0)
      if (now() - since >= UNKNOWN_TIMEOUT_MS || state !== 'unknown') {
        const result = await ctx.resumeSource(config.suspendedAt, { verifyHash: false })
        return { ok: false, reason: state, restored: result.ok === true }
      }
    }
    schedulePoll()
    return { ok: false, reason: 'pending', status: state }
  }

  async function rollbackMerge(mergeId) {
    if (typeof mergeId !== 'string' || !MERGE_ID.test(mergeId)) return { ok: false, reason: 'bad-merge-id' }
    const problem = sessionProblem()
    if (problem !== null) return { ok: false, reason: problem, mergeId }
    const config = ctx.getConfig()
    if (config === null) {
      const history = readDsHistory(statePath)
      const entry = history.ok ? history.history.merges.find(item => item.mergeId === mergeId) : null
      if (entry?.status === 'rolled-back') return { ok: true, mergeId, restored: { target: true, source: true }, already: true }
    }
    let targetRestored = config?.rollback?.mergeId === mergeId && config.rollback.targetRestored === true
    if (!targetRestored) {
      let response
      try { response = await client.rollback({ mergeId, requestId: randomUUID() }) } catch { return { ok: false, reason: 'disconnected' } }
      if (response.status !== 200 || response.json?.ok !== true) {
        let state = null
        try { state = await client.mergeStatus(mergeId) } catch { state = null }
        const rolled = state?.json?.status === 'rolled-back'
        if (!rolled) return { ok: false, reason: response.json?.reason ?? 'target-rollback-failed', partial: false }
        targetRestored = true
      } else targetRestored = true
    }
    const backupName = config?.backup ?? dsBackupForMerge(statePath, mergeId)
    if (backupName === null || backupName === undefined) return { ok: false, reason: 'source-backup-missing', partial: true, restored: { target: targetRestored, source: false } }
    const problemAfterTarget = sessionProblem()
    if (problemAfterTarget !== null) {
      return { ok: false, reason: problemAfterTarget, partial: true, restored: { target: targetRestored, source: false } }
    }
    try {
      restoreEmbeddedFromBackup({ statePath, backupName, nowMs: now(), authority: ctx.persistence?.() ?? null })
      removeConfig(statePath)
      ctx.setConfig(null)
      markDsRolledBack(statePath, mergeId, now())
      ctx.setPreview(null)
      await ctx.setMode('normal')
      outbox.resume()
      ctx.embedded().ensure()
      await ctx.refreshTargetSummary().catch(() => {})
      return { ok: true, mergeId, restored: { target: true, source: true }, backups: { source: backupName } }
    } catch (cause) {
      ctx.saveConfig({ ...(config ?? ctx.baseConfig()), pigState: 'rolling-back', connection: 'disconnected', mergeId, rollback: { mergeId, targetRestored: true } })
      await ctx.setMode('external')
      return { ok: false, reason: 'partial', restored: { target: true, source: false }, message: cause instanceof Error ? cause.message : String(cause) }
    }
  }

  async function restoreEmbedded(backupName) {
    const problem = sessionProblem()
    if (problem !== null) return { ok: false, reason: problem }
    // 目标合并事务未到终态时只允许读/查原事务，不能恢复/覆盖源端。
    if (pendingMergeConfig(ctx.getConfig())) return { ok: false, reason: 'busy' }
    const history = readDsHistory(statePath)
    const entry = history.ok ? history.history.merges.at(-1) : null
    const name = typeof backupName === 'string' && backupName !== '' ? backupName : (entry?.sourceBackup ?? listSourceBackups(statePath).at(-1) ?? null)
    if (name === null) return { ok: false, reason: 'no-backup' }
    try {
      const restored = restoreEmbeddedFromBackup({ statePath, backupName: name, nowMs: now(), authority: ctx.persistence?.() ?? null })
      removeConfig(statePath)
      ctx.setConfig(null)
      await ctx.setMode('normal')
      outbox.resume()
      ctx.embedded().ensure()
      return { ok: true, restored, ...ctx.status() }
    } catch (cause) {
      return { ok: false, reason: 'restore-failed', message: cause instanceof Error ? cause.message : String(cause) }
    }
  }

  async function retryRetirement() {
    const config = ctx.getConfig()
    if (config?.pigState !== 'merged' || config.retirementPending !== true) return { ok: false, reason: 'nothing-to-retry' }
    return finalizeCommit({ ok: true, mergeId: config.mergeId, result: config.lastSummary, backups: { target: null, source: config.backup } }, null)
  }

  return { finalizeCommit, commitMerge, pollMergeStatus, rollbackMerge, restoreEmbedded, retryRetirement }
}
