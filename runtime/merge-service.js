// @ts-check
/**
 * 桌面端的合并服务：预览、提交、状态、回滚、备份和事务。
 *
 * 所有写操作都在 runtime.exclusive() 里完成；预览只读取并计算，不改合并结果。
 * 源 ZIP 由 DSH 在冻结源端后生成，预览和提交用同一份缓存。
 *
 * @module dsh-piggy/runtime/merge-service
 */

import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { MERGE_RULES_VERSION, MergeError, STATE_VERSION, duplicateOf, mergeSaveStates, mergeSummary, missingMergeRules } from '../core.js'
import { archiveSkinHashes, emptyMergeTarget, mapSkinFiles, safeSourceBackup, skinHashes } from './merge-source.js'
import { assertMergedReceipts, assertMergedState } from '../packages/pet-core/src/core/merge-validate.js'
import { createMergeBackup, cleanupOldMerges, readMergeHistory, registerCommittedMerge, registerPendingBackup, markRolledBack, verifyBackup, writeMergeRecord } from './merge-backup.js'
import { commitMergeSync, restoreMergeFilesSync, rollbackCopiedSkinsSync } from './merge-transaction.js'
import { parseSaveArchive } from './save-archive.js'

const PREVIEW_TTL_MS = 10 * 60_000
const MAX_SOURCE_BYTES = 32 * 1024 * 1024
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

/** 提交校验类失败（改一下选择/重开预览就能再来）不写进 failures，免得同一 mergeId 永远失败。 */
const RETRYABLE = new Set(['invalid-choices', 'duplicate-choice-required', 'unknown-source-fields',
  'unknown-source-aborted', 'declined', 'explicit-change', 'runtime-changed', 'unknown-preview',
  'bad-token', 'preview-expired', 'source-changed', 'backup-failed'])

function failure(reason, status, message, details = null) {
  return Object.assign(new Error(message ?? reason), { code: reason, status, details })
}

/** 纯合并规则抛出的 MergeError 统一按 409 返回，details 原样给界面。 */
function mergeFailure(error) {
  if (error instanceof MergeError) return failure(error.code, 409, error.message, error.details)
  return error
}

export function createMergeService(options) {
  const { runtime, statePath } = options
  const now = options.now ?? (() => Date.now())
  const log = options.log ?? (message => console.warn(`[dsh-piggy] ${message}`))
  const gameVersion = options.gameVersion ?? ''
  const appVersion = options.appVersion ?? ''
  let preview = null
  const requests = new Map()
  const committed = new Map()
  const failures = new Map()
  let timer = null

  function scheduleExpiry() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (preview === null) return
    const delay = Math.max(0, preview.expiresAt - now())
    timer = setTimeout(() => {
      if (preview !== null && now() >= preview.expiresAt) {
        preview = null
        log('merge preview expired; source side must cancel and resume')
      }
    }, Math.min(delay, 2 ** 31 - 1))
    timer.unref?.()
  }

  function capture() {
    if (runtime.snapshotForWrite === undefined) throw new Error('runtime does not support merge')
    return runtime.snapshotForWrite()
  }

  function targetStateOf(snapshot, nowMs) {
    return snapshot.state === null ? emptyMergeTarget(nowMs) : snapshot.state
  }

  function hooks() {
    try { return runtime.mergeHooks?.() ?? {} } catch { return {} }
  }

  function installed() {
    try { return runtime.targetInstalled?.() ?? [] } catch { return [] }
  }

  function unknownSourceFields(state) {
    return missingMergeRules(state).filter(path => !path.includes('='))
  }

  function buildReport({ snapshot, source, sourceMeta, choices, requestId, sourceSha256 }) {
    const nowMs = now()
    const target = targetStateOf(snapshot, nowMs)
    const sourceSkins = /** @type {Record<string,string>} */ (archiveSkinHashes(source.files, source.state.customSkins))
    const targetSkins = snapshot.state === null ? /** @type {Record<string,string>} */ ({}) : skinHashes(statePath, snapshot.state.customSkins)
    const merged = mergeSaveStates(target, source.state, {
      nowMs,
      choices,
      targetSkins,
      sourceSkins,
      targetReceipts: snapshot.receipts,
      sourceReceipts: source.receipts,
      hooks: hooks(),
      targetInstalled: installed(),
      silentBadges: true,
      hasTargetPresent: snapshot.state !== null,
    })
    assertMergedState(merged.state, nowMs)
    assertMergedReceipts(merged.receipts, nowMs)
    const unknown = unknownSourceFields(source.state)
    const report = merged.report

    if (unknown.length > 0) {
      report.warnings.push(`内嵌存档里有当前版本不认识的字段：${unknown.slice(0, 8).join('、')}${unknown.length > 8 ? ' 等' : ''}；请选择丢弃或中止`)
      report.conflicts.push({ key: 'unknownSource', level: 'warning', options: ['discard', 'abort'], default: null, paths: unknown.slice(0, 24) })
    }
    const targetMeta = snapshot.state === null ? null : { summary: mergeSummary(snapshot.state) }
    return {
      mergeId: null,
      previewToken: null,
      expiresAt: null,
      target: {
        pid: process.pid,
        appVersion,
        gameVersion,
        stateVersion: STATE_VERSION,
        mergeRulesVersion: MERGE_RULES_VERSION,
        runtimeId: snapshot.runtimeId,
        epoch: snapshot.epoch,
        ...targetMeta,
      },
      source: { summary: mergeSummary(source.state), stateVersion: source.stateVersion, mergeRulesVersion: source.mergeRulesVersion, warnings: source.warnings ?? [] },
      result: report.result,
      choices: report.choices,
      conflicts: report.conflicts,
      warnings: report.warnings,
      autoMerge: report.autoMerge,
      editors: report.editors,
      sides: report.sides,
      duplicate: report.duplicate,
      blocked: false,
      unknownSourceFields: unknown,
      sourceSha256,
      ...(requestId === undefined ? {} : { requestId }),
      _merged: merged,
      _sourceMeta: sourceMeta,
    }
  }

  function parseSource(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw failure('bad-source', 400, '合并需要一份源存档 ZIP')
    if (buffer.length > MAX_SOURCE_BYTES) throw failure('source-too-large', 413, '源存档 ZIP 超过 32MB')
    let archived
    try { archived = parseSaveArchive(buffer, { nowMs: now() }) } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // 存档解析层用「版本高于当前支持版本」拒绝更高版本；契约要 version-too-new，别混成坏 ZIP。
      const newer = /版本高于|version.*(?:newer|higher)/i.test(message)
      throw failure(newer ? 'version-too-new' : 'bad-source', newer ? 409 : 400, message)
    }
    const parsed = /** @type {any} */ (archived)
    if (!parsed?.state) throw failure('bad-source', 400, '源存档里没有猪')
    if (parsed.stateVersion > STATE_VERSION) throw failure('version-too-new', 409, '内嵌存档版本比桌面版新，请先更新桌面版')
    if ((parsed.mergeRulesVersion ?? MERGE_RULES_VERSION) > MERGE_RULES_VERSION) throw failure('rules-too-new', 409, '内嵌版的合并规则比桌面版新，请先更新桌面版')
    const receipts = []
    const receiptBytes = parsed.files?.get('state.json.work-events/receipts.json')
    if (receiptBytes !== undefined) {
      try { receipts.push(...JSON.parse(receiptBytes.toString('utf8')).receipts) } catch { throw failure('bad-source', 400, '源存档的工作收据无效') }
    }
    return { state: parsed.state, files: parsed.files ?? new Map(), receipts, stateVersion: parsed.stateVersion, mergeRulesVersion: parsed.mergeRulesVersion ?? MERGE_RULES_VERSION, warnings: parsed.warnings ?? [] }
  }

  /** @param {Buffer} buffer @param {{requestId?:string, choices?:any}} [options] */
  async function previewWith(buffer, { requestId, choices } = {}) {
    if (typeof requestId === 'string' && requests.has(requestId)) {
      const prior = requests.get(requestId)
      if (preview !== null && preview.mergeId === prior && now() < preview.expiresAt) return publicPreview(preview)
    }
    if (preview !== null && now() < preview.expiresAt && (requestId === undefined || requests.get(requestId) !== preview.mergeId)) {
      // 只保留一个预览：新的预览替换旧的；DSH 侧旧预览会按 expiresAt 取消恢复。
      preview = null
    }
    const source = parseSource(buffer)
    const snapshot = await runtime.exclusive(async () => capture())
    const report = (() => {
      try { return buildReport({ snapshot, source, sourceMeta: { stateVersion: source.stateVersion, mergeRulesVersion: source.mergeRulesVersion }, choices, requestId, sourceSha256: sha256(buffer) }) }
      catch (error) { throw mergeFailure(error) }
    })()
    const mergeId = randomUUID()
    preview = {
      mergeId,
      previewToken: randomUUID(),
      expiresAt: now() + PREVIEW_TTL_MS,
      createdAt: now(),
      requestId: requestId ?? null,
      sourceBuffer: buffer,
      sourceSha256: sha256(buffer),
      source: { state: source.state, files: source.files, receipts: source.receipts, stateVersion: source.stateVersion, mergeRulesVersion: source.mergeRulesVersion, warnings: source.warnings },
      snapshot: { runtimeId: snapshot.runtimeId, epoch: snapshot.epoch, targetState: snapshot.state },
      choices: choices ?? null,
      report,
    }
    preview.report.mergeId = mergeId
    preview.report.previewToken = preview.previewToken
    preview.report.expiresAt = preview.expiresAt
    if (typeof requestId === 'string') requests.set(requestId, mergeId)
    scheduleExpiry()
    return publicPreview(preview)
  }

  function publicPreview(current) {
    const { _merged, _sourceMeta, ...report } = current.report
    return report
  }

  function invalidate() {
    preview = null
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  async function commitWith({ mergeId, previewToken, choices, sourceBackup, sourceSha256 }) {
    if (committed.has(mergeId)) return committed.get(mergeId)
    if (failures.has(mergeId)) throw failures.get(mergeId)
    const current = preview
    if (current === null || current.mergeId !== mergeId) throw failure('unknown-preview', 409, '这份预览已失效，请重新预览')
    if (current.previewToken !== previewToken) throw failure('bad-token', 409, '预览令牌不对，请重新预览')
    if (now() >= current.expiresAt) { invalidate(); throw failure('preview-expired', 409, '预览已过期，请重新预览')
    }
    if (typeof sourceSha256 === 'string' && sourceSha256 !== current.sourceSha256) {
      throw failure('source-changed', 409, '源存档和预览时不是同一份，请重新预览')
    }
    if (current.report.duplicate?.suspected === true && !['target', 'source', 'merge'].includes(choices?.duplicate)) {
      throw failure('duplicate-choice-required', 409, '疑似同一份存档的副本，请先选择「只保留桌宠 / 只保留内嵌猪 / 仍然合并」')
    }
    const unknown = unknownSourceFields(current.source.state)
    if (unknown.length > 0 && choices?.unknownSource === undefined) throw failure('unknown-source-fields', 409, '内嵌存档有未知字段，请选择丢弃或中止')
    if (unknown.length > 0 && choices?.unknownSource === 'abort') throw failure('unknown-source-aborted', 409, '因为内嵌存档含未知字段，已中止合并')
    const result = await runtime.exclusive(async () => {
      const replacement = capture()
      if (replacement.runtimeId !== current.snapshot.runtimeId) throw failure('runtime-changed', 409, '桌面运行时重新加载过，请重新预览')
      if (replacement.epoch !== current.snapshot.epoch) throw failure('explicit-change', 409, '预览后桌面猪又有新操作，请重新预览')
      const nowMs = now()
      const target = targetStateOf(replacement, nowMs)
      const sourceSkins = /** @type {Record<string,string>} */ (archiveSkinHashes(current.source.files, current.source.state.customSkins))
      const targetSkins = replacement.state === null ? /** @type {Record<string,string>} */ ({}) : skinHashes(statePath, replacement.state.customSkins)
      const merged = (() => {
        try {
          return mergeSaveStates(target, current.source.state, {
            nowMs,
            choices,
            targetSkins,
            sourceSkins,
            targetReceipts: replacement.receipts,
            sourceReceipts: current.source.receipts,
            hooks: hooks(),
            targetInstalled: installed(),
            silentBadges: false,
            hasTargetPresent: replacement.state !== null,
          })
        } catch (error) { throw mergeFailure(error) }
      })()
      assertMergedState(merged.state, nowMs)
      assertMergedReceipts(merged.receipts, nowMs)
      const plan = {
        target: replacement.state === null ? null : mergeSummary(replacement.state),
        source: mergeSummary(current.source.state),
        result: merged.report.result,
        mergeId,
      }
      const allowed = options.confirm === undefined ? false : await options.confirm(plan)
      if (allowed !== true) throw failure('declined', 409, '桌面版拒绝了这次合并')
      // 结算后的状态先写一份完整备份并重新解压校验；失败不写合并结果、不删旧备份。
      let backup
      try {
        backup = createMergeBackup({ statePath, state: replacement.state, gameVersion, nowMs, mergeId })
      } catch (error) {
        throw failure('backup-failed', 409, `合并前备份失败：${error instanceof Error ? error.message : String(error)}`)
      }
      const skinFiles = mapSkinFiles(current.source.files, merged.skinCopies)
      const copiedFiles = [...skinFiles].map(([name, body]) => ({ name, sha256: sha256(body) }))
      commitMergeSync({ statePath, mergeId, state: merged.state, receipts: merged.receipts, skinFiles })
      try { runtime.restart() } catch (error) {
        // 重载失败：用刚写的备份恢复合并前的状态，再试着重新打开。
        try {
          const parsed = verifyBackup(backup.path, now())
          const stateBytes = parsed.parsed.files.get('state.json')
          const receiptsBytes = parsed.parsed.files.get('state.json.work-events/receipts.json')
          restoreMergeFilesSync({ statePath, stateBytes, receiptsBytes })
          rollbackCopiedSkinsSync({ statePath, copied: copiedFiles, hashOf: sha256 })
          runtime.restart()
        } catch (rollbackError) {
          log(`merge reload failed and rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
        }
        throw failure('reload-failed', 500, '合并写入后重载失败，已尝试恢复合并前的存档', { reason: error instanceof Error ? error.message : String(error) })
      }
      const sourceName = safeSourceBackup(sourceBackup)
      const entry = {
        mergeId,
        createdAt: nowMs,
        status: 'committed',
        ruleVersion: MERGE_RULES_VERSION,
        rolledBackAt: null,
        targetBackup: backup.name,
        sourceBackup: sourceName,
        targetStateId: sha256(JSON.stringify(merged.state)),
        choices: merged.choices,
        copiedFiles,
      }
      const bookkeeping = []
      try { writeMergeRecord({ statePath, mergeId, record: { ...entry, sourceBytes: undefined }, sourceBytes: current.sourceBuffer }) }
      catch (error) { bookkeeping.push(`合并记录没写成：${error instanceof Error ? error.message : String(error)}`) }
      try { registerCommittedMerge(statePath, entry) }
      catch (error) { bookkeeping.push(`合并历史没写成：${error instanceof Error ? error.message : String(error)}`) }
      let cleanup = { removed: [], warnings: [], skipped: true }
      try { cleanup = cleanupOldMerges({ statePath, keepMergeId: mergeId }) }
      catch (error) { cleanup.warnings.push(`旧合并备份清理失败：${error instanceof Error ? error.message : String(error)}`) }
      const response = {
        ok: true,
        mergeId,
        target: { summary: mergeSummary(replacement.state), stateVersion: STATE_VERSION, mergeRulesVersion: MERGE_RULES_VERSION },
        source: { summary: mergeSummary(current.source.state) },
        result: merged.report.result,
        warnings: [...new Set([...merged.report.warnings, ...bookkeeping, ...cleanup.warnings])],
        conflicts: merged.report.conflicts,
        backups: { target: backup.name, source: sourceName, cleanup: cleanup.skipped ? 'not-run' : (cleanup.warnings.length > 0 ? 'failed' : 'done') },
        hashes: { sourceSha256: current.sourceSha256, targetStateId: entry.targetStateId },
      }
      committed.set(mergeId, response)
      invalidate()
      return response
    })
    return result
  }

  async function statusWith(mergeId) {
    if (committed.has(mergeId)) return { status: 'committed', mergeId, result: committed.get(mergeId).result, backups: committed.get(mergeId).backups }
    if (failures.has(mergeId)) return { status: 'failed', mergeId, reason: failures.get(mergeId).code, message: failures.get(mergeId).message }
    const read = readMergeHistory(statePath)
    const entry = read.ok ? read.history.merges.find(item => item.mergeId === mergeId) : null
    if (entry !== undefined) return { status: entry.status, mergeId, result: null, backups: { target: entry.targetBackup, source: entry.sourceBackup } }
    if (preview !== null && preview.mergeId === mergeId) return { status: 'preview', mergeId, result: preview.report.result, backups: {} }
    return { status: 'unknown', mergeId, result: null, backups: {} }
  }

  async function rollbackWith(mergeId, requestId) {
    const read = readMergeHistory(statePath)
    if (!read.ok) throw failure('history-corrupt', 500, '合并记录读不出来，先不撤销')
    const history = read.history
    const entry = history.merges.find(item => item.mergeId === mergeId)
    if (entry === undefined) throw failure('unknown-merge', 404, '没有这次合并的记录')
    if (entry.status === 'rolled-back' && entry.rollbackTargetRestored === true) {
      return { ok: true, mergeId, restored: { target: true, source: false }, backups: { target: entry.targetBackup, source: entry.sourceBackup, after: entry.rollbackBackup ?? null } }
    }
    if (history.activeMergeId !== mergeId) throw failure('not-active', 409, '只能撤销最近一次合并')
    return runtime.exclusive(async () => {
      const current = await runtime.snapshotForWrite()
      const backupPath = join(dirname(statePath), 'backups', entry.targetBackup)
      const parsed = verifyBackup(backupPath, now())
      const stateBytes = parsed.parsed.files.get('state.json')
      const receiptsBytes = parsed.parsed.files.get('state.json.work-events/receipts.json')
      if (!stateBytes) throw failure('backup-bad', 500, '合并前备份里没有存档')
      const after = createMergeBackup({ statePath, state: current.state, gameVersion, nowMs: now(), mergeId, suffix: '-after' })
      restoreMergeFilesSync({ statePath, stateBytes, receiptsBytes })
      const warnings = rollbackCopiedSkinsSync({ statePath, copied: entry.copiedFiles, hashOf: sha256 })
      runtime.restart()
      markRolledBack(statePath, mergeId, now())
      registerPendingBackup(statePath, mergeId, after.name)
      const updated = readMergeHistory(statePath)
      if (updated.ok) {
        const saved = updated.history.merges.find(item => item.mergeId === mergeId)
        if (saved !== undefined) { saved.rollbackTargetRestored = true; saved.rollbackBackup = after.name; await import('./merge-backup.js').then(module => module.writeMergeHistory(statePath, updated.history)) }
      }
      return { ok: true, mergeId, warnings, restored: { target: true, source: false }, backups: { target: entry.targetBackup, source: entry.sourceBackup, after: after.name }, requestId }
    })
  }

  return {
    preview: previewWith,
    commit: async input => {
      try { return await commitWith(input) } catch (error) {
        if (input?.mergeId !== undefined && error?.code !== undefined && !RETRYABLE.has(error.code)) failures.set(input.mergeId, error)
        throw error
      }
    },
    status: statusWith,
    rollback: async input => {
      try { return await rollbackWith(input.mergeId, input.requestId) } catch (error) { throw error }
    },
    invalidate,
    activePreview: () => (preview === null ? null : { mergeId: preview.mergeId, expiresAt: preview.expiresAt }),
    close() { invalidate() },
  }
}

export { PREVIEW_TTL_MS, MAX_SOURCE_BYTES, duplicateOf }
