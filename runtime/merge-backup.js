// @ts-check
/**
 * 合并备份、合并记录与「只保留最新一份合并备份」的清理。
 *
 * 顺序永远是：新备份写成功并校验 → 合并提交成功 → 才删更早的合并备份。
 * 只删 registry 里登记过的合并备份；registry 缺失/损坏时一个都不删。
 *
 * @module dsh-piggy/runtime/merge-backup
 */

import { createHash } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { createSaveArchive, parseSaveArchive } from './save-archive.js'

const HISTORY_VERSION = 1
const SAFE_NAME = /^[A-Za-z0-9._-]{1,120}$/

export const backupsDir = statePath => join(dirname(statePath), 'backups')
export const historyPath = statePath => join(backupsDir(statePath), 'merge-history.json')

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function syncDirectory(directory) {
  if (process.platform === 'win32') return
  let descriptor
  try { descriptor = openSync(directory, 'r'); fsyncSync(descriptor) }
  catch (error) { if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(error.code)) throw error }
  finally { if (descriptor !== undefined) closeSync(descriptor) }
}

function atomicWrite(file, bytes, mode = 0o600) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  const descriptor = openSync(temp, 'wx', mode)
  try { writeSync(descriptor, bytes); fsyncSync(descriptor) }
  finally { closeSync(descriptor) }
  try { renameSync(temp, file) }
  catch (error) {
    try { unlinkSync(temp) } catch { /* keep the original error */ }
    throw error
  }
  syncDirectory(dirname(file))
}

/** 合并备份的时间戳与 mergeId8；成功页显示实际文件名，不手写示例。 */
export function mergeBackupName(nowMs, mergeId, prefix = 'piggy-save', suffix = '') {
  const date = new Date(nowMs)
  const pad = value => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
  return `${prefix}-${stamp}-${String(mergeId).slice(0, 8)}${suffix}.zip`
}

/** 读 registry；损坏返回 {ok:false}，调用方据此一个都不删。 */
export function readMergeHistory(statePath) {
  const file = historyPath(statePath)
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (parsed?.version !== HISTORY_VERSION || !Array.isArray(parsed.merges)) return { ok: false, history: null, reason: 'schema' }
    return { ok: true, history: parsed, reason: null }
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: true, history: { version: HISTORY_VERSION, activeMergeId: null, merges: [] }, reason: null }
    return { ok: false, history: null, reason: error instanceof Error ? error.message : String(error) }
  }
}

export function writeMergeHistory(statePath, history) {
  const next = { version: HISTORY_VERSION, activeMergeId: history.activeMergeId ?? null, merges: Array.isArray(history.merges) ? history.merges : [] }
  atomicWrite(historyPath(statePath), JSON.stringify(next, null, 2))
  return next
}

/** 写一份新的合并备份并重新解压校验；失败不删任何旧备份。 */
export function createMergeBackup({ statePath, state, gameVersion = '', nowMs, mergeId, suffix = '' }) {
  const archive = createSaveArchive({ statePath, state, gameVersion, nowMs })
  const name = mergeBackupName(nowMs, mergeId, 'piggy-save', suffix)
  const directory = backupsDir(statePath)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const path = join(directory, name)
  if (existsSync(path)) throw new Error(`合并备份已存在，不覆盖：${name}`)
  atomicWrite(path, archive.buffer)
  const bytes = readFileSync(path)
  const parsed = parseSaveArchive(bytes, { nowMs })
  if (!parsed || parsed.summary === undefined) throw new Error('合并备份校验失败')
  return { name, path, bytes, sha256: sha256(bytes) }
}

/** 重新打开并校验任意备份文件。 */
export function verifyBackup(path, nowMs) {
  if (!existsSync(path)) throw new Error('备份文件不存在')
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('备份不是普通文件')
  return { bytes: readFileSync(path), parsed: parseSaveArchive(readFileSync(path), { nowMs }) }
}

function safeBackupPath(statePath, name) {
  if (typeof name !== 'string' || !SAFE_NAME.test(name) || basename(name) !== name) return null
  return join(backupsDir(statePath), name)
}

function removeFile(path) {
  try { unlinkSync(path) } catch (error) { if (error?.code !== 'ENOENT') throw error }
}

/** 提交成功后的记录：record.json（不含令牌/绝对路径）+ source.zip。 */
export function writeMergeRecord({ statePath, mergeId, record, sourceBytes }) {
  const directory = join(backupsDir(statePath), `merge-${mergeId}`)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  atomicWrite(join(directory, 'record.json'), Buffer.from(JSON.stringify(record, null, 2)))
  if (Buffer.isBuffer(sourceBytes) && sourceBytes.length > 0) atomicWrite(join(directory, 'source.zip'), sourceBytes)
  syncDirectory(directory)
  return directory
}

/**
 * 删更早的合并备份集。只碰 registry 里登记的 targetBackup/sourceBackup 和
 * merge-<id>/ 目录；手动导出/导入备份永远不碰。
 * @returns {{removed:string[], warnings:string[], skipped:boolean}}
 */
export function cleanupOldMerges({ statePath, keepMergeId }) {
  const read = readMergeHistory(statePath)
  if (!read.ok) return { removed: [], warnings: ['合并备份记录损坏，这次不清理旧备份，等人工处理'], skipped: true }
  const warnings = []
  const removed = []
  const history = read.history
  const keep = history.merges.find(entry => entry.mergeId === keepMergeId) ?? null
  const candidates = history.merges.filter(entry => entry.mergeId !== keepMergeId && entry.status !== 'preview')
  for (const entry of candidates) {
    for (const key of ['targetBackup', 'sourceBackup']) {
      const name = entry[key]
      const path = safeBackupPath(statePath, name)
      if (path === null) continue
      try { removeFile(path); removed.push(name) }
      catch (error) { warnings.push(`旧合并备份 ${name} 没删掉：${error instanceof Error ? error.message : String(error)}`) }
    }
    const directory = join(backupsDir(statePath), `merge-${entry.mergeId}`)
    try { rmSync(directory, { recursive: true, force: true }); removed.push(`merge-${entry.mergeId}`) }
    catch (error) { warnings.push(`旧合并记录 merge-${entry.mergeId} 没删掉：${error instanceof Error ? error.message : String(error)}`) }
  }
  if (keep !== null) keep.backupsPruned = true
  // 回滚仍需要最近一次的记录和备份；更早的条目只保留 lineage 元数据。
  for (const entry of candidates) entry.backupsPruned = true
  writeMergeHistory(statePath, history)
  return { removed, warnings, skipped: false }
}

/** 回滚时记录「合并后的存档」另存为下一次可清理的备份。 */
export function registerPendingBackup(statePath, mergeId, backupName) {
  const read = readMergeHistory(statePath)
  if (!read.ok) return false
  const history = read.history
  const entry = history.merges.find(item => item.mergeId === mergeId)
  if (entry === undefined) return false
  entry.rollbackBackup = backupName
  writeMergeHistory(statePath, history)
  return true
}

/** 合并完成后登记本次记录；activeMergeId 表示当前存档来自哪次合并。 */
export function registerCommittedMerge(statePath, entry) {
  const read = readMergeHistory(statePath)
  const history = read.ok ? read.history : { version: HISTORY_VERSION, activeMergeId: null, merges: [] }
  history.merges = history.merges.filter(item => item.mergeId !== entry.mergeId)
  history.merges.push(entry)
  history.activeMergeId = entry.mergeId
  return writeMergeHistory(statePath, history)
}

/** 回滚成功后清 lineage，并把本次改成 rolled-back。 */
export function markRolledBack(statePath, mergeId, rolledBackAt) {
  const read = readMergeHistory(statePath)
  if (!read.ok) return { ok: false, reason: 'history-corrupt' }
  const history = read.history
  const entry = history.merges.find(item => item.mergeId === mergeId)
  if (entry === undefined) return { ok: false, reason: 'unknown' }
  entry.status = 'rolled-back'
  entry.rolledBackAt = rolledBackAt
  if (history.activeMergeId === mergeId) history.activeMergeId = null
  writeMergeHistory(statePath, history)
  return { ok: true, entry }
}
