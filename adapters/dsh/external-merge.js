// @ts-check
/**
 * DSH 侧的合并备份、退役、恢复与回滚。
 *
 * 合并成功后源端退休：先写退役标记和配置，再退出内嵌运行时，最后把
 * state/work-events 分别幂等改名；启动只认原路径，看到标记就不打开 merged-*。
 *
 * @module dsh-piggy/adapters/dsh/external-merge
 */

import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { createSaveArchive, parseSaveArchive } from '../../runtime/save-archive.js'
import { mergeBackupName } from '../../runtime/merge-backup.js'
import { readStateFile } from '../../store/state-file.js'
import {
  markerPath, readMarker, removeMarker, retiredEventsPath, retiredStatePath, safeBaseName, writeMarker,
} from './external-files.js'

const HISTORY_VERSION = 1
const HISTORY = 'merge-history.json'

export const dsBackupsDir = statePath => join(dirname(statePath), 'backups')
export const dsHistoryPath = statePath => join(dsBackupsDir(statePath), HISTORY)

function syncDir(directory) {
  if (process.platform === 'win32') return
  let descriptor
  try { descriptor = openSync(directory, 'r'); fsyncSync(descriptor) }
  catch (error) { if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(error.code)) throw error }
  finally { if (descriptor !== undefined) closeSync(descriptor) }
}

function atomic(file, bytes, mode = 0o600) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  const descriptor = openSync(temp, 'wx', mode)
  try { writeSync(descriptor, bytes); fsyncSync(descriptor) } finally { closeSync(descriptor) }
  try { renameSync(temp, file) } catch (error) { try { rmSync(temp, { force: true }) } catch { /* keep */ } throw error }
  syncDir(dirname(file))
}

export function readDsHistory(statePath) {
  try {
    const parsed = JSON.parse(readFileSync(dsHistoryPath(statePath), 'utf8'))
    if (parsed?.version !== HISTORY_VERSION || !Array.isArray(parsed.merges)) return { ok: false, history: null }
    return { ok: true, history: parsed }
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, history: { version: HISTORY_VERSION, activeMergeId: null, merges: [] } }
    return { ok: false, history: null }
  }
}

export function writeDsHistory(statePath, history) {
  const next = { version: HISTORY_VERSION, activeMergeId: history.activeMergeId ?? null, merges: Array.isArray(history.merges) ? history.merges : [] }
  atomic(dsHistoryPath(statePath), Buffer.from(JSON.stringify(next, null, 2)))
  return next
}

export function registerDsMerge(statePath, entry) {
  const read = readDsHistory(statePath)
  const history = read.ok ? read.history : { version: HISTORY_VERSION, activeMergeId: null, merges: [] }
  history.merges = history.merges.filter(item => item.mergeId !== entry.mergeId)
  history.merges.push(entry)
  history.activeMergeId = entry.mergeId
  return writeDsHistory(statePath, history)
}

/** 预览后结算并 flush 的源端完整备份；写成功并重新解压校验才算数。 */
export function createSourceBackup({ statePath, state, gameVersion = '', nowMs, mergeId }) {
  const archive = createSaveArchive({ statePath, state, gameVersion, nowMs })
  const name = mergeBackupName(nowMs, mergeId, 'external')
  const file = join(dsBackupsDir(statePath), name)
  if (existsSync(file)) throw new Error(`源端备份已存在，不覆盖：${name}`)
  atomic(file, archive.buffer)
  const parsed = parseSaveArchive(readFileSync(file), { nowMs })
  if (!parsed) throw new Error('源端备份校验失败')
  return { name, file, buffer: archive.buffer }
}

/** 只删登记过的旧合并集；history 损坏时一个都不删。 */
export function cleanupDsOldMerges(statePath, keepMergeId) {
  const read = readDsHistory(statePath)
  if (!read.ok) return { removed: [], warnings: ['DSH 合并记录损坏，这次不清理旧备份'], skipped: true }
  const warnings = []
  const removed = []
  for (const entry of read.history.merges.filter(item => item.mergeId !== keepMergeId)) {
    const name = safeBaseName(entry.sourceBackup)
    if (name !== null) {
      try { rmSync(join(dsBackupsDir(statePath), name), { force: true }); removed.push(name) }
      catch (error) { warnings.push(`旧源端备份 ${name} 没删掉：${error.message}`) }
    }
    for (const path of [entry.retiredState, entry.retiredEvents]) {
      if (typeof path !== 'string') continue
      try { rmSync(path, { recursive: true, force: true }); removed.push(path.slice(dirname(statePath).length + 1)) }
      catch (error) { warnings.push(`旧退役存档没删掉：${error.message}`) }
    }
    entry.backupsPruned = true
  }
  writeDsHistory(statePath, read.history)
  return { removed, warnings, skipped: false }
}

function renameIfPresent(from, to) {
  if (!existsSync(from)) return false
  if (existsSync(to)) throw Object.assign(new Error('退役目标已存在，不覆盖'), { code: 'retired-exists' })
  renameSync(from, to)
  syncDir(dirname(from))
  return true
}

/**
 * 源端退役：标记 → 退出运行时 → 两个改名分别幂等。已完成的步骤不重复做。
 * @param {{statePath:string, mergeId:string, backupName:string, stopRuntime?:()=>void, now?:()=>number, config?:any, saveConfig?:(config:any)=>void}} options
 */
export function retireEmbedded(options) {
  const { statePath, mergeId } = options
  const now = options.now ?? (() => Date.now())
  let marker = readMarker(statePath).marker
  if (marker === null || marker.mergeId !== mergeId) {
    marker = { version: 1, mergeId, retiredAt: now(), backup: options.backupName ?? null, stateRenamed: false, workEventsRenamed: false }
    writeMarker(statePath, marker)
  }
  options.saveConfig?.({
    ...(options.config ?? {}),
    pigState: 'merged',
    connection: options.config?.connection ?? 'connected',
    mergeId,
    retired: { state: retiredStatePath(statePath, mergeId), workEvents: retiredEventsPath(statePath, mergeId) },
    backup: options.backupName ?? null,
    updatedAt: now(),
  })
  options.stopRuntime?.()
  if (!marker.stateRenamed) {
    marker.stateRenamed = renameIfPresent(statePath, retiredStatePath(statePath, mergeId))
    writeMarker(statePath, marker)
  }
  if (!marker.workEventsRenamed) {
    marker.workEventsRenamed = renameIfPresent(`${statePath}.work-events`, retiredEventsPath(statePath, mergeId))
    writeMarker(statePath, marker)
  }
  marker.complete = marker.stateRenamed || marker.workEventsRenamed || !existsSync(statePath)
  writeMarker(statePath, marker)
  return marker
}

/** 启动时补齐半截退役：只补缺的那一步，不打开 merged-*。 */
export function recoverRetirement(statePath) {
  const read = readMarker(statePath)
  if (!read.exists) return { retired: false, marker: null }
  if (read.corrupt || read.marker === null) return { retired: true, marker: null, incomplete: false, corrupt: true }
  const marker = read.marker
  if (typeof marker.mergeId !== 'string' || !/^[a-f0-9-]{36}$/.test(marker.mergeId)) {
    return { retired: true, marker, incomplete: false, corrupt: true }
  }
  let changed = false
  try {
    if (marker.stateRenamed !== true && existsSync(statePath)) {
      if (existsSync(retiredStatePath(statePath, marker.mergeId))) return { retired: true, marker, incomplete: true, conflict: true }
      renameSync(statePath, retiredStatePath(statePath, marker.mergeId))
      marker.stateRenamed = true; changed = true
    }
    if (marker.workEventsRenamed !== true && existsSync(`${statePath}.work-events`)) {
      if (existsSync(retiredEventsPath(statePath, marker.mergeId))) return { retired: true, marker, incomplete: true, conflict: true }
      renameSync(`${statePath}.work-events`, retiredEventsPath(statePath, marker.mergeId))
      marker.workEventsRenamed = true; changed = true
    }
  } catch (error) {
    return { retired: true, marker, incomplete: true, error: error instanceof Error ? error.message : String(error) }
  }
  if (changed) { marker.complete = true; writeMarker(statePath, marker) }
  return { retired: true, marker, incomplete: false, conflict: false }
}

/** 备份包校验：state.json 可读出且迁移成功。 */
export function validateBackup(statePath, backupName, nowMs) {
  const name = safeBaseName(backupName)
  if (name === null) throw new Error('备份文件名无效')
  const file = join(dsBackupsDir(statePath), name)
  const stat = lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('备份不是普通文件')
  const parsed = parseSaveArchive(readFileSync(file), { nowMs })
  if (!parsed) throw new Error('备份不可读')
  return { file, parsed, name }
}

/** 只恢复内嵌猪：备份 → 临时读到能迁移 → 原子放回 state + receipts。 */
export function restoreEmbeddedFromBackup({ statePath, backupName, nowMs }) {
  const validated = validateBackup(statePath, backupName, nowMs)
  const stateBytes = validated.parsed.files.get('state.json')
  if (stateBytes === undefined) throw new Error('备份里没有 state.json')
  const receiptsBytes = validated.parsed.files.get('state.json.work-events/receipts.json')
  const temp = `${statePath}.restore-${nowMs}.tmp`
  atomic(temp, stateBytes)
  const read = readStateFile(temp, nowMs)
  if (read.state === null) { rmSync(temp, { force: true }); throw new Error('备份里的存档读不出来') }
  renameSync(temp, statePath)
  syncDir(dirname(statePath))
  if (receiptsBytes !== undefined) atomic(join(`${statePath}.work-events`, 'receipts.json'), receiptsBytes)
  removeMarker(statePath)
  return { ok: true, backup: validated.name, summary: validated.parsed.summary }
}

/** 回滚用：按 mergeId 找回源端备份。 */
export function dsBackupForMerge(statePath, mergeId) {
  const read = readDsHistory(statePath)
  if (!read.ok) return null
  const entry = read.history.merges.find(item => item.mergeId === mergeId)
  return entry?.sourceBackup ?? null
}

/** 合并成功后的 DSH 侧记录。 */
export function recordDsMerge({ statePath, mergeId, backupName, targetBackup, nowMs, retired }) {
  return registerDsMerge(statePath, {
    mergeId,
    createdAt: nowMs,
    status: 'committed',
    ruleVersion: 1,
    rolledBackAt: null,
    sourceBackup: backupName,
    targetBackup: targetBackup ?? null,
    retiredState: retired?.state ?? null,
    retiredEvents: retired?.workEvents ?? null,
  })
}

export function markDsRolledBack(statePath, mergeId, nowMs) {
  const read = readDsHistory(statePath)
  if (!read.ok) return { ok: false, reason: 'history-corrupt' }
  const entry = read.history.merges.find(item => item.mergeId === mergeId)
  if (entry === undefined) return { ok: false, reason: 'unknown' }
  entry.status = 'rolled-back'
  entry.rolledBackAt = nowMs
  if (read.history.activeMergeId === mergeId) read.history.activeMergeId = null
  writeDsHistory(statePath, read.history)
  return { ok: true, entry }
}

/** 列出 DSH backups 里可恢复的源端备份（恢复页用，不按通配符删）。 */
export function listSourceBackups(statePath) {
  try {
    return readdirSync(dsBackupsDir(statePath)).filter(name => /^external-[A-Za-z0-9._-]+\.zip$/.test(name)).sort()
  } catch { return [] }
}

export { markerPath, readMarker, removeMarker }
