// @ts-check
/**
 * 合并的可恢复事务。
 *
 * 只碰 state.json、work-events/receipts.json 和本次复制/改名的皮肤文件；
 * extensions/、日志、锁、窗口位置都不动。复用存档导入的「快照 → 临时区 →
 * 日志 → 替换 → 清理」思路，但独立实现，避免整目录替换删掉桌宠自己的皮肤。
 *
 * @module dsh-piggy/runtime/merge-transaction
 */

import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { writeStateFile } from '../store/state-file.js'
import { syncDirectory, writeWorkJson } from './work-files.js'

const PREFIX = '.piggy-merge-'
const JOURNAL = 'journal.json'

function atomicWrite(file, bytes, mode = 0o600) {
  mkdirSync(dirname(file), { recursive: true, mode: mode === 0o600 ? 0o700 : 0o755 })
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

const receiptsPath = statePath => join(`${statePath}.work-events`, 'receipts.json')
const skinPath = (statePath, name) => join(dirname(statePath), 'skins', basename(name))

function snapshot(file, target, had) {
  if (!existsSync(file)) return false
  const stat = lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`合并事务快照遇到非普通文件：${file}`)
  atomicWrite(target, readFileSync(file))
  return true
}

function writeJournal(tx, journal) {
  atomicWrite(join(tx, JOURNAL), Buffer.from(JSON.stringify(journal)))
}

function readJournal(tx) {
  let parsed
  try { parsed = JSON.parse(readFileSync(join(tx, JOURNAL), 'utf8')) }
  catch { throw new Error('合并事务日志格式无效，保留现场') }
  if (parsed?.version !== 1 || !['applying', 'committed'].includes(parsed.phase) ||
    typeof parsed.statePath !== 'string' || typeof parsed.mergeId !== 'string' ||
    !Array.isArray(parsed.skins) || !Array.isArray(parsed.hadSkins)) throw new Error('合并事务日志格式无效，保留现场')
  return parsed
}

function restore(tx, journal) {
  const old = join(tx, 'old')
  if (journal.hadState) atomicWrite(journal.statePath, readFileSync(join(old, 'state.json')))
  else removeFile(journal.statePath)
  if (journal.hadReceipts) atomicWrite(receiptsPath(journal.statePath), readFileSync(join(old, 'receipts.json')))
  else removeFile(receiptsPath(journal.statePath))
  for (let index = 0; index < journal.skins.length; index += 1) {
    const target = skinPath(journal.statePath, journal.skins[index])
    if (journal.hadSkins[index]) atomicWrite(target, readFileSync(join(old, `skin-${index}`)), 0o644)
    else removeFile(target)
  }
}

function removeFile(file) {
  try { unlinkSync(file) } catch (error) { if (error?.code !== 'ENOENT') throw error }
}

function transactionDirs(statePath) {
  const parent = dirname(statePath)
  return readdirSync(parent).filter(name => name.startsWith(PREFIX) && name.length > PREFIX.length)
    .map(name => join(parent, name)).filter(path => {
      try { return lstatSync(path).isDirectory() } catch { return false }
    })
}

/** 启动/打开运行时时先恢复半截合并：applying 回滚，committed 只清理。 */
export function recoverMergeSync(statePath) {
  const recovered = []
  for (const tx of transactionDirs(statePath)) {
    const journalFile = join(tx, JOURNAL)
    if (!existsSync(journalFile)) {
      // 还没写日志就崩溃：临时区可以整个丢掉，目标尚未被替换。
      rmSync(tx, { recursive: true, force: true })
      continue
    }
    const journal = readJournal(tx)
    if (journal.phase === 'applying') restore(tx, journal)
    rmSync(tx, { recursive: true, force: true })
    syncDirectory(dirname(statePath))
    recovered.push({ mergeId: journal.mergeId, phase: journal.phase })
  }
  return recovered
}

/**
 * 提交合并结果。成功返回 {ok:true}；失败会先回滚已替换的文件再抛出。
 * @param {{statePath:string, mergeId:string, state:any, receipts:any[], skinFiles:Map<string,Buffer>}} input
 */
export function commitMergeSync(input) {
  const { statePath, mergeId, state, receipts } = input
  const skins = [...(input.skinFiles ?? new Map()).keys()]
  const tx = join(dirname(statePath), `${PREFIX}${mergeId}`)
  rmSync(tx, { recursive: true, force: true })
  mkdirSync(join(tx, 'old'), { recursive: true, mode: 0o700 })
  mkdirSync(join(tx, 'new'), { recursive: true, mode: 0o700 })
  const journal = { version: 1, phase: 'applying', mergeId, statePath, skins, hadState: false, hadReceipts: false, hadSkins: [] }
  let published = false
  try {
    journal.hadState = snapshot(statePath, join(tx, 'old', 'state.json'), true)
    journal.hadReceipts = snapshot(receiptsPath(statePath), join(tx, 'old', 'receipts.json'), true)
    journal.hadSkins = skins.map((name, index) => snapshot(skinPath(statePath, name), join(tx, 'old', `skin-${index}`), true))
    writeJournal(tx, journal)
    published = true
    writeStateFile(statePath, state)
    mkdirSync(dirname(receiptsPath(statePath)), { recursive: true, mode: 0o700 })
    writeWorkJson(receiptsPath(statePath), { version: 1, receipts })
    for (const [name, bytes] of input.skinFiles ?? new Map()) atomicWrite(skinPath(statePath, name), bytes, 0o644)
    writeJournal(tx, { ...journal, phase: 'committed' })
    rmSync(tx, { recursive: true, force: true })
    syncDirectory(dirname(statePath))
    return { ok: true, skins: skins.slice() }
  } catch (error) {
    if (published) {
      try { restore(tx, journal) } catch { /* 回滚失败保留临时区，下次启动再试；不清掉证据 */ return (() => { throw error })() }
      try { rmSync(tx, { recursive: true, force: true }) } catch { /* evidence kept */ }
    } else {
      try { rmSync(tx, { recursive: true, force: true }) } catch { /* evidence kept */ }
    }
    throw error
  }
}

/** 回滚：用备份包里的 state/receipts 覆盖，不整目录替换。 */
export function restoreMergeFilesSync({ statePath, stateBytes, receiptsBytes }) {
  atomicWrite(statePath, stateBytes)
  if (Buffer.isBuffer(receiptsBytes)) {
    mkdirSync(dirname(receiptsPath(statePath)), { recursive: true, mode: 0o700 })
    writeWorkJson(receiptsPath(statePath), JSON.parse(receiptsBytes.toString('utf8')))
  }
  syncDirectory(dirname(statePath))
}

/** 只删本次合并复制/改名清单里的皮肤；已被玩家改过（哈希变了）就保留并返回警告。 */
export function rollbackCopiedSkinsSync({ statePath, copied, hashOf }) {
  const warnings = []
  for (const entry of Array.isArray(copied) ? copied : []) {
    if (typeof entry?.name !== 'string' || !entry.name.startsWith('skins/')) continue
    const target = join(dirname(statePath), entry.name)
    try {
      const stat = lstatSync(target)
      if (!stat.isFile() || stat.isSymbolicLink()) continue
      if (typeof entry.sha256 === 'string' && hashOf(readFileSync(target)) !== entry.sha256) {
        warnings.push(`皮肤文件 ${entry.name} 合并后被改过，保留不删`)
        continue
      }
      unlinkSync(target)
      syncDirectory(dirname(target))
    } catch (error) {
      if (error?.code !== 'ENOENT') warnings.push(`皮肤文件 ${entry.name} 没删掉：${error.message}`)
    }
  }
  return warnings
}

export { atomicWrite, receiptsPath }
