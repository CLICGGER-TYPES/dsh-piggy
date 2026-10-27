// @ts-check
/**
 * 外部模式的生命周期：连接、预览冻结、取消、切回内嵌猪。
 *
 * @module dsh-piggy/adapters/dsh/external-lifecycle
 */

import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { mergeSummary, migrate, resumeSuspendedPig } from '../../core.js'
import { createSaveArchive } from '../../runtime/save-archive.js'
import { readStateFile, writeStateFile } from '../../store/state-file.js'
import { removeConfig, stateFingerprint } from './external-files.js'
import { createSourceBackup } from './external-merge.js'
import { blockersFromDetails, sourceBlockers, targetBlockers } from './external-support.js'

export function readReceipts(statePath) {
  try {
    const parsed = JSON.parse(readFileSync(`${statePath}.work-events/receipts.json`, 'utf8'))
    return Array.isArray(parsed?.receipts) ? parsed.receipts : []
  } catch (error) { if (error?.code === 'ENOENT') return []; throw error }
}

export function createLifecycle(ctx) {
  const { statePath, now, options, outbox, client } = ctx

  async function resumeSource(suspendedAt, { verifyHash = true } = {}) {
    if (ctx.getMode() === 'normal' && ctx.embedded().runtime() !== null) { ctx.setPreview(null); return { ok: true } }
    const loaded = readStateFile(statePath, now())
    if (loaded.state === null) {
      removeConfig(statePath)
      ctx.setMode('normal')
      ctx.embedded().ensure()
      return { ok: true, empty: true }
    }
    const config = ctx.getConfig()
    if (verifyHash && typeof config?.stateHash === 'string') {
      const actual = stateFingerprint(loaded.state, readReceipts(statePath))
      if (actual !== config.stateHash) return { ok: false, reason: 'state-changed' }
    }
    const result = resumeSuspendedPig(loaded.state, { suspendedAt: Number.isFinite(suspendedAt) ? suspendedAt : now(), nowMs: now() })
    if (result.ok !== true) return { ok: false, reason: result.reason }
    writeStateFile(statePath, result.state)
    removeConfig(statePath)
    ctx.setConfig(null)
    ctx.setPreview(null)
    outbox.resume()
    ctx.setMode('normal')
    ctx.embedded().ensure()
    ctx.scheduleDelivery(0)
    return { ok: true, elapsed: result.elapsed }
  }

  async function cancelPreview(reason) {
    if (ctx.getExpiry() !== null) { clearTimeout(ctx.getExpiry()); ctx.setExpiry(null) }
    const previous = ctx.getPreview()
    if (previous === null) return { ok: true, reason }
    ctx.setPreview(null)
    outbox.resume()
    if (previous.previousMode === 'paused') {
      const config = ctx.getConfig()
      if (config !== null) ctx.saveConfig({ ...config, connection: 'connected', pigState: 'paused', mergeId: null, suspendedAt: previous.previousSuspendedAt ?? previous.frozenAt })
      ctx.setMode('external')
      return { ok: true, reason, restored: 'paused' }
    }
    const result = await resumeSource(previous.frozenAt, { verifyHash: false })
    return { ...result, reason }
  }

  async function connect(connectMode = 'connect') {
    if (connectMode === 'merge') {
      const config = ctx.getConfig()
      if (ctx.getMode() === 'external' && config?.pigState === 'merged') return { ok: false, reason: 'already-merged' }
      const detected = await ctx.refresh()
      if (!detected.ok) return { ok: false, reason: detected.reason, target: null }
      const latest = ctx.getConfig()
      const sourceAt = latest?.pigState === 'paused' && Number.isFinite(latest.suspendedAt) ? latest.suspendedAt : now()
      const sourceState = readStateFile(statePath, sourceAt).state
      // 桌面端阻塞项要真实细节：用面板快照里的活动/番茄/钓鱼，不猜。
      const pending = ctx.getPanel?.()?.state?.()
      const view = pending !== undefined && typeof pending.catch === 'function' ? await pending.catch(() => null) : null
      const desktopBlockers = view !== null && view.ok !== false ? targetBlockers(view) : []
      return {
        ok: true,
        mode: 'merge',
        target: { ...ctx.getTarget(), summary: detected.info?.summary ?? null },
        source: { summary: sourceState === null ? null : mergeSummary(sourceState) },
        blockers: [...sourceBlockers(sourceState, sourceAt), ...desktopBlockers],
      }
    }
    const config = ctx.getConfig()
    if (ctx.getMode() === 'external' && config?.pigState === 'paused') {
      await ctx.refresh()
      return { ok: true, ...ctx.status() }
    }
    if (ctx.getMode() === 'external' && config?.pigState === 'merged') return { ok: false, reason: 'already-merged' }
    const detected = await ctx.refresh()
    if (!detected.ok) return { ok: false, reason: detected.reason }
    const runtime = ctx.embedded().ensure()
    let frozen = null
    await runtime.exclusive(async () => { frozen = runtime.snapshotForWrite(); return null })
    const snapshot = /** @type {any} */ (frozen)
    if (snapshot === null) throw new Error('embedded runtime returned no state')
    const next = {
      ...ctx.baseConfig(),
      pigState: snapshot.state === null ? 'none' : 'paused',
      connection: 'connected',
      clientId: config?.clientId ?? randomUUID(),
      target: ctx.getTarget(),
      suspendedAt: snapshot.state === null ? null : now(),
      // 指纹按磁盘读回后的规范形状算：新装 DSH 现场孵化时内存里是 hatchEgg 的原始形状，
      // 缺 migrate 补的默认字段；直接用它会和重启后 readStateFile() 迁移过的同一份存档
      // 算出不同指纹，断线切回被误判成「暂存期间存档被改过」。
      stateHash: snapshot.state === null ? null : stateFingerprint(migrate(snapshot.state, now()), snapshot.receipts),
      mergeId: null,
      lastSummary: snapshot.state === null ? null : mergeSummary(snapshot.state),
      localSummary: snapshot.state === null ? null : mergeSummary(snapshot.state),
      updatedAt: now(),
    }
    ctx.saveConfig(next)
    ctx.stopEmbedded()
    ctx.setMode('external')
    outbox.resume()
    ctx.scheduleDelivery(0)
    ctx.markSeen()
    return { ok: true, ...ctx.status() }
  }

  async function previewMerge() {
    const config = ctx.getConfig()
    if (ctx.getMode() === 'external' && config !== null && config.pigState !== 'paused') {
      return { ok: false, reason: config.pigState === 'merged' ? 'already-merged' : 'busy' }
    }
    const detected = await ctx.refresh()
    if (!detected.ok) return { ok: false, reason: detected.reason }
    const previousMode = ctx.getMode() === 'external' && config?.pigState === 'paused' ? 'paused' : 'embedded'
    const previousSuspendedAt = previousMode === 'paused' ? config?.suspendedAt ?? now() : null
    const frozen = /** @type {any} */ (await ctx.freezeSource())
    if (frozen === null || frozen.state === null) return { ok: false, reason: 'no-source-pig' }
    const frozenAt = now()
    let archive
    try { archive = createSaveArchive({ statePath, state: frozen.state, gameVersion: options.gameVersion ?? '', nowMs: frozenAt }) }
    catch (error) { return { ok: false, reason: 'source-backup-failed', message: error instanceof Error ? error.message : String(error) } }
    let response
    try { response = await client.preview(archive.buffer, randomUUID()) }
    catch (cause) { return { ok: false, reason: 'disconnected', message: cause instanceof Error ? cause.message : String(cause) } }
    if (response.status !== 200 || response.json?.ok !== true) {
      const reason = response.json?.reason ?? 'preview-failed'
      const details = response.json?.details ?? null
      return { ok: false, reason, status: response.status, details, blockers: blockersFromDetails(reason, details) }
    }
    const report = response.json
    let backup
    try { backup = createSourceBackup({ statePath, state: frozen.state, gameVersion: options.gameVersion ?? '', nowMs: frozenAt, mergeId: report.mergeId }) }
    catch (cause) { return { ok: false, reason: 'source-backup-failed', message: cause instanceof Error ? cause.message : String(cause) } }
    const sourceSha256 = createHash('sha256').update(archive.buffer).digest('hex')
    ctx.saveConfig({
      ...ctx.baseConfig(),
      pigState: 'paused',
      connection: 'connected',
      target: ctx.getTarget(),
      suspendedAt: previousMode === 'paused' ? previousSuspendedAt : frozenAt,
      stateHash: stateFingerprint(frozen.state, frozen.receipts),
      mergeId: report.mergeId,
      previewToken: report.previewToken,
      sourceSha256,
      lastSummary: mergeSummary(frozen.state),
      localSummary: report.source?.summary ?? mergeSummary(frozen.state),
      updatedAt: frozenAt,
    })
    ctx.stopEmbedded()
    ctx.setMode('external')
    ctx.setConnection('connected')
    outbox.pause()
    ctx.setPreview({
      mergeId: report.mergeId,
      previewToken: report.previewToken,
      sourceSha256,
      expiresAt: report.expiresAt,
      frozenAt,
      previousSuspendedAt,
      backupName: backup.name,
      previousMode,
      report,
    })
    if (ctx.getExpiry() !== null) clearTimeout(ctx.getExpiry())
    const delay = Math.max(0, Math.min(report.expiresAt - now(), 2 ** 31 - 1))
    ctx.setExpiry(setTimeout(() => { void cancelPreview('expired') }, delay))
    ctx.getExpiry()?.unref?.()
    return { ok: true, ...report, link: ctx.link(), sourceBackup: backup.name }
  }

  async function disconnect(flags = {}) {
    const config = ctx.getConfig()
    if (ctx.getPreview() !== null || (config !== null && ['merging', 'rolling-back', 'merge-unknown'].includes(config.pigState))) return { ok: false, reason: 'busy' }
    if (ctx.isConfigCorrupt()) return { ok: false, reason: 'config-corrupt' }
    if (config?.pigState === 'merged') return { ok: false, reason: 'already-merged' }
    const queued = outbox.status().queued
    if (queued > 0 && flags.discardQueue !== true) return { ok: false, reason: 'queue-not-empty', queued }
    if (flags.discardQueue === true) outbox.clear()
    if (config?.pigState === 'paused') {
      const result = await resumeSource(config.suspendedAt, { verifyHash: true })
      if (result.ok !== true) {
        if (result.reason !== 'state-changed') return result
        if (flags.confirmChanged !== true) return { ok: false, reason: 'state-changed' }
        const forced = await resumeSource(config.suspendedAt, { verifyHash: false })
        if (forced.ok !== true) return forced
      }
    } else if (config !== null) {
      removeConfig(statePath)
      ctx.setConfig(null)
    }
    outbox.clear()
    outbox.removeFile()
    ctx.setMode('normal')
    ctx.embedded().ensure()
    return { ok: true, ...ctx.status() }
  }

  return { resumeSource, cancelPreview, connect, previewMerge, disconnect }
}
