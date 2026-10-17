// Durable, rollback-capable replacement of the files owned by a save import.
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

const TX_NAME = '.piggy-save-import'
const ROOTS = ['state', 'skins', 'extensions', 'work-events']

function pathsFor(statePath) {
  const absolute = path.resolve(statePath)
  const identity = createHash('sha256').update(absolute).digest('hex').slice(0, 20)
  return {
    absolute,
    parent: path.dirname(absolute),
    roots: [absolute, path.join(path.dirname(absolute), 'skins'),
      path.join(path.dirname(absolute), 'extensions'), `${absolute}.work-events`],
    tx: path.join(path.dirname(absolute), `${TX_NAME}-${identity}`),
  }
}

async function syncDir(dir, io) {
  let handle
  try { handle = await io.open(dir, 'r'); await handle.sync() }
  catch (error) { if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(error.code)) throw error }
  finally { await handle?.close() }
}

async function durableWrite(file, data, io) {
  await io.mkdir(path.dirname(file), { recursive: true })
  const handle = await io.open(file, 'wx', 0o600)
  try { await handle.writeFile(data); await handle.sync() } finally { await handle.close() }
  await syncDir(path.dirname(file), io)
}

async function exists(file, io) {
  try { return await io.lstat(file) } catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

async function copyTree(source, destination, io) {
  const stat = await io.lstat(source)
  if (stat.isSymbolicLink()) throw new Error(`拒绝导入符号链接：${source}`)
  if (stat.isDirectory()) {
    await io.mkdir(destination, { recursive: true, mode: stat.mode & 0o777 })
    for (const name of await io.readdir(source)) await copyTree(path.join(source, name), path.join(destination, name), io)
    await syncDir(destination, io)
  } else if (stat.isFile()) {
    await io.mkdir(path.dirname(destination), { recursive: true })
    await io.copyFile(source, destination)
    const handle = await io.open(destination, 'r+'); try { await handle.sync() } finally { await handle.close() }
  } else throw new Error(`不支持的存档文件类型：${source}`)
}

async function writeJournal(tx, journal, io, onPublished) {
  const temp = path.join(tx, 'journal.next')
  await io.rm(temp, { force: true })
  await durableWrite(temp, JSON.stringify(journal), io)
  await io.rename(temp, path.join(tx, 'journal.json'))
  onPublished?.()
  await syncDir(tx, io)
}

function validateFiles(files) {
  if (!(files instanceof Map) || !files.has('state.json')) throw new Error('导入包缺少 state.json')
  const entries = [...files]
  for (const [name, value] of entries) {
    if (typeof name !== 'string' || name.startsWith('/') || name.includes('\\') || name.includes(':') ||
      name.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('导入包路径无效')
    if (!(Buffer.isBuffer(value) || value instanceof Uint8Array)) throw new Error(`导入文件内容无效：${name}`)
    if (!['state.json', 'state.json.work-events/receipts.json'].includes(name) &&
      !name.startsWith('skins/') && !name.startsWith('extensions/')) throw new Error(`不允许导入此文件：${name}`)
    if (name.startsWith('skins/') && name.length === 6 || name.startsWith('extensions/') && name.length === 11)
      throw new Error('导入包路径无效')
  }
  return entries
}

async function ensureSafeRoot(target, io, stateFile = false) {
  const stat = await exists(target, io)
  if (!stat) return false
  if (stat.isSymbolicLink()) throw new Error(`拒绝替换符号链接目录：${target}`)
  if ((!stat.isFile() && !stat.isDirectory()) || (stateFile && !stat.isFile()))
    throw new Error(`存档路径类型无效：${target}`)
  return true
}

async function removeTarget(target, io) { await io.rm(target, { recursive: true, force: true }) }

function validateJournal(journal, statePath) {
  if (journal?.version !== 1 || !Array.isArray(journal.had) || journal.had.length !== ROOTS.length ||
    journal.had.some(value => typeof value !== 'boolean') || !['applying', 'committed'].includes(journal.phase) ||
    journal.statePath !== statePath)
    throw new Error('存档事务日志格式无效，拒绝启动')
}

async function validateTree(root, io) {
  const stat = await io.lstat(root)
  if (stat.isSymbolicLink()) throw new Error(`事务快照含符号链接，拒绝启动：${root}`)
  if (!stat.isFile() && !stat.isDirectory()) throw new Error(`事务快照类型无效，拒绝启动：${root}`)
  if (stat.isDirectory()) for (const name of await io.readdir(root)) await validateTree(path.join(root, name), io)
}

async function validateSnapshots(tx, journal, io) {
  if (!journal.had.some(Boolean)) return
  const oldRoot = path.join(tx, 'old')
  const oldStat = await exists(oldRoot, io)
  if (!oldStat) throw new Error('事务旧存档快照缺失，拒绝启动')
  if (!oldStat.isDirectory() || oldStat.isSymbolicLink()) throw new Error('事务旧存档快照目录无效，拒绝启动')
  await validateTree(oldRoot, io)
  for (let i = 0; i < ROOTS.length; i += 1) {
    if (!journal.had[i]) continue
    const snapshot = path.join(tx, 'old', String(i))
    const stat = await exists(snapshot, io)
    if (!stat) throw new Error(`事务旧存档快照缺失，拒绝启动：${i}`)
    await validateTree(snapshot, io)
    if (i === 0 && !stat.isFile()) throw new Error('state.json 事务快照类型无效，拒绝启动')
  }
}

async function restore(tx, targets, journal, io) {
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i]
    await removeTarget(target, io)
    if (journal.had[i]) await copyTree(path.join(tx, 'old', String(i)), target, io)
    await syncDir(path.dirname(target), io)
  }
}

function syncDirSync(dir) {
  let fd
  try { fd = fsSync.openSync(dir, 'r'); fsSync.fsyncSync(fd) }
  catch (error) { if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(error.code)) throw error }
  finally { if (fd !== undefined) fsSync.closeSync(fd) }
}

function copyTreeSync(source, destination) {
  const stat = fsSync.lstatSync(source)
  if (stat.isSymbolicLink()) throw new Error(`拒绝导入符号链接：${source}`)
  if (stat.isDirectory()) {
    fsSync.mkdirSync(destination, { recursive: true, mode: stat.mode & 0o777 })
    for (const name of fsSync.readdirSync(source)) copyTreeSync(path.join(source, name), path.join(destination, name))
    syncDirSync(destination)
  } else if (stat.isFile()) {
    fsSync.mkdirSync(path.dirname(destination), { recursive: true })
    fsSync.copyFileSync(source, destination)
    const fd = fsSync.openSync(destination, 'r+'); try { fsSync.fsyncSync(fd) } finally { fsSync.closeSync(fd) }
  } else throw new Error(`不支持的存档文件类型：${source}`)
}

function validateTreeSync(root) {
  const stat = fsSync.lstatSync(root)
  if (stat.isSymbolicLink()) throw new Error(`事务快照含符号链接，拒绝启动：${root}`)
  if (!stat.isFile() && !stat.isDirectory()) throw new Error(`事务快照类型无效，拒绝启动：${root}`)
  if (stat.isDirectory()) for (const name of fsSync.readdirSync(root)) validateTreeSync(path.join(root, name))
}

function cleanupTxSync(tx) {
  const journal = path.join(tx, 'journal.json')
  try { fsSync.unlinkSync(journal); syncDirSync(tx) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  fsSync.rmSync(tx, { recursive: true, force: true })
  syncDirSync(path.dirname(tx))
}

function restoreSync(tx, targets, journal) {
  for (let i = 0; i < targets.length; i += 1) {
    fsSync.rmSync(targets[i], { recursive: true, force: true })
    if (journal.had[i]) copyTreeSync(path.join(tx, 'old', String(i)), targets[i])
    syncDirSync(path.dirname(targets[i]))
  }
}

/** Run before opening the ledger/store, after acquiring the process-owned game lock. */
export async function recoverSaveImport(statePath, { io = fs } = {}) {
  const { tx, roots } = pathsFor(statePath)
  const txStat = await exists(tx, io)
  if (!txStat) return { recovered: false }
  if (!txStat.isDirectory() || txStat.isSymbolicLink()) throw new Error('存档事务目录无效，拒绝启动')
  const journalPath = path.join(tx, 'journal.json')
  const journalStat = await exists(journalPath, io)
  if (!journalStat) { await io.rm(tx, { recursive: true, force: true }); return { recovered: false } }
  if (!journalStat.isFile() || journalStat.isSymbolicLink()) throw new Error('存档事务日志类型无效，拒绝启动')
  let journal
  try { journal = JSON.parse(await io.readFile(journalPath, 'utf8')) } catch (error) {
    throw new Error(`存档事务日志损坏，拒绝启动：${error.message}`)
  }
  validateJournal(journal, path.resolve(statePath))
  if (journal.phase !== 'committed') await validateSnapshots(tx, journal, io)
  if (journal.phase !== 'committed') await restore(tx, roots, journal, io)
  await io.rm(journalPath, { force: true })
  await syncDir(tx, io)
  await io.rm(tx, { recursive: true, force: true })
  await syncDir(path.dirname(tx), io)
  return { recovered: journal.phase !== 'committed' }
}

/** Synchronous counterpart for the synchronous createGameRuntime startup path. */
export function recoverSaveImportSync(statePath) {
  const { tx, roots } = pathsFor(statePath)
  let txStat
  try { txStat = fsSync.lstatSync(tx) } catch (error) { if (error.code === 'ENOENT') return { recovered: false }; throw error }
  if (!txStat.isDirectory() || txStat.isSymbolicLink()) throw new Error('存档事务目录无效，拒绝启动')
  const journalPath = path.join(tx, 'journal.json')
  let journalStat
  try { journalStat = fsSync.lstatSync(journalPath) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    fsSync.rmSync(tx, { recursive: true, force: true }); return { recovered: false }
  }
  if (!journalStat.isFile() || journalStat.isSymbolicLink()) throw new Error('存档事务日志类型无效，拒绝启动')
  let journal
  try { journal = JSON.parse(fsSync.readFileSync(journalPath, 'utf8')) } catch (error) {
    throw new Error(`存档事务日志损坏，拒绝启动：${error.message}`)
  }
  validateJournal(journal, path.resolve(statePath))
  if (journal.phase !== 'committed') {
    if (journal.had.some(Boolean)) {
      const oldRoot = path.join(tx, 'old')
      let oldStat
      try { oldStat = fsSync.lstatSync(oldRoot) } catch (error) {
        if (error.code === 'ENOENT') throw new Error('事务旧存档快照缺失，拒绝启动')
        throw error
      }
      if (!oldStat.isDirectory() || oldStat.isSymbolicLink()) throw new Error('事务旧存档快照目录无效，拒绝启动')
      validateTreeSync(oldRoot)
    }
    for (let i = 0; i < ROOTS.length; i += 1) {
      if (!journal.had[i]) continue
      const snapshot = path.join(tx, 'old', String(i))
      let snapshotStat
      try { snapshotStat = fsSync.lstatSync(snapshot); validateTreeSync(snapshot) } catch (error) {
        if (error.code === 'ENOENT') throw new Error(`事务旧存档快照缺失，拒绝启动：${i}`)
        throw error
      }
      if (i === 0 && !snapshotStat.isFile()) throw new Error('state.json 事务快照类型无效，拒绝启动')
    }
    restoreSync(tx, roots, journal)
  }
  cleanupTxSync(tx)
  return { recovered: journal.phase !== 'committed' }
}

/** backup is the complete pre-import ZIP; it is made durable before touching save files. */
export async function commitSaveImport({ statePath, files, backup, nowMs = Date.now(), io = fs, activate }) {
  if (!Buffer.isBuffer(backup) && !(backup instanceof Uint8Array)) throw new Error('缺少当前存档备份')
  if (activate !== undefined && typeof activate !== 'function') throw new TypeError('activate 必须是函数')
  const entries = validateFiles(files)
  const { absolute, parent, tx, roots } = pathsFor(statePath)
  await recoverSaveImport(absolute, { io })

  const backupDir = path.join(parent, 'backups')
  const previousBackupDir = await exists(backupDir, io)
  if (previousBackupDir && (!previousBackupDir.isDirectory() || previousBackupDir.isSymbolicLink()))
    throw new Error('存档备份目录无效，拒绝写入')
  await io.mkdir(backupDir, { recursive: true })
  const backupDirStat = await io.lstat(backupDir)
  if (!backupDirStat.isDirectory() || backupDirStat.isSymbolicLink()) throw new Error('存档备份目录无效，拒绝写入')
  await syncDir(parent, io)
  const backupName = `piggy-save-${nowMs}-${randomUUID()}.zip`
  const backupPath = path.join(backupDir, backupName)
  try { await durableWrite(backupPath, backup, io); await syncDir(backupDir, io) }
  catch (error) { await io.rm(backupPath, { force: true }).catch(() => {}); throw error }

  await io.mkdir(tx, { recursive: false })
  const had = []
  let committed = false
  try {
    await syncDir(parent, io)
    for (let i = 0; i < roots.length; i += 1) {
      had.push(await ensureSafeRoot(roots[i], io, i === 0))
      if (had[i]) await copyTree(roots[i], path.join(tx, 'old', String(i)), io)
    }
    const staged = ROOTS.map((_, i) => path.join(tx, 'new', String(i)))
    for (const [name, data] of entries) {
      let target, relative
      if (name === 'state.json') { target = staged[0]; relative = '' }
      else if (name.startsWith('skins/')) { target = staged[1]; relative = name.slice(6) }
      else if (name.startsWith('extensions/')) { target = staged[2]; relative = name.slice(11) }
      else { target = staged[3]; relative = 'receipts.json' }
      const file = relative ? path.join(target, relative) : target
      await io.mkdir(path.dirname(file), { recursive: true })
      await durableWrite(file, data, io)
    }
    // Empty managed directories are valid and replace prior contents as part of this import.
    for (const i of [1, 2, 3]) await io.mkdir(staged[i], { recursive: true })
    const journal = { version: 1, phase: 'applying', statePath: absolute, had }
    await writeJournal(tx, journal, io)
    for (let i = 0; i < roots.length; i += 1) {
      await removeTarget(roots[i], io)
      await io.rename(staged[i], roots[i])
      await syncDir(path.dirname(roots[i]), io)
    }
    await activate?.()
    await writeJournal(tx, { ...journal, phase: 'committed' }, io, () => { committed = true })
  } catch (error) {
    if (!committed) {
      try { committed = await isCommittedJournal(tx, absolute, io) } catch { /* Preserve the original failure. */ }
    }
    if (committed) return { backupName, cleanupDeferred: true }
    try {
      if (await exists(path.join(tx, 'journal.json'), io)) await recoverSaveImport(absolute, { io })
      else await io.rm(tx, { recursive: true, force: true })
    }
    catch (recoveryError) { error.recoveryError = recoveryError }
    throw error
  }
  try {
    await io.rm(tx, { recursive: true, force: true })
    await syncDir(parent, io)
    return { backupName }
  } catch {
    // The commit marker is durable. Leave any remaining journal for startup cleanup.
    return { backupName, cleanupDeferred: true }
  }
}

async function isCommittedJournal(tx, statePath, io) {
  const file = path.join(tx, 'journal.json')
  const stat = await exists(file, io)
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) return false
  const journal = JSON.parse(await io.readFile(file, 'utf8'))
  validateJournal(journal, statePath)
  return journal.phase === 'committed'
}
