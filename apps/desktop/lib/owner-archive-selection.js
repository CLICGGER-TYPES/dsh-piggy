// @ts-check
/** Device-local active owner selection with a recoverable switch intent. */
import { randomUUID } from 'node:crypto'
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const VERSION = 1
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/** @returns {never} */
function fail(message) { throw Object.assign(new Error(message), { code: 'OWNER_ARCHIVE_SELECTION_INVALID' }) }

/** @param {unknown} value @param {string} archiveRoot @param {boolean} [requireExisting] */
function normalizeSelection(value, archiveRoot, requireExisting = true) {
  if (value === null) return null
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'ownerDocumentPath,ownerId,pigId') fail('存档选择记录格式无效')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (typeof record.ownerDocumentPath !== 'string' || !isAbsolute(record.ownerDocumentPath) ||
      typeof record.ownerId !== 'string' || !ID_PATTERN.test(record.ownerId) ||
      typeof record.pigId !== 'string' || !ID_PATTERN.test(record.pigId)) fail('存档选择记录格式无效')
  const ownerDocumentPath = resolve(record.ownerDocumentPath)
  const rel = relative(resolve(archiveRoot), ownerDocumentPath)
  if (rel === '' || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel) ||
      rel.split(sep).includes('..') || rel.split(sep).at(-1) !== 'owner-document.json') {
    fail('所选存档不在本机独立存档目录内')
  }
  let rootStat
  try { rootStat = lstatSync(resolve(archiveRoot)) } catch (error) {
    if (!requireExisting && /** @type {any} */ (error)?.code === 'ENOENT') {
      return Object.freeze({ ownerDocumentPath, ownerId: record.ownerId, pigId: record.pigId })
    }
    fail('所选存档目录不存在，已保留原选择记录')
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('所选存档目录无效，已保留原选择记录')
  let stat
  let cursor = resolve(archiveRoot)
  const parts = rel.split(sep)
  for (const [index, part] of parts.entries()) {
    cursor = join(cursor, part)
    try { stat = lstatSync(cursor) } catch (error) {
      if (!requireExisting && /** @type {any} */ (error)?.code === 'ENOENT') break
      fail('所选存档文件不存在，已保留原选择记录')
    }
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      fail('所选存档文件无效，已保留原选择记录')
    }
  }
  return Object.freeze({ ownerDocumentPath, ownerId: record.ownerId, pigId: record.pigId })
}

/** @param {unknown} value @param {string} archiveRoot */
function normalizeState(value, archiveRoot) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('本机存档选择文件损坏，未更改当前存档')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (Object.keys(record).sort().join(',') !== 'active,pending,version' || record.version !== VERSION) {
    fail('本机存档选择文件损坏，未更改当前存档')
  }
  const active = normalizeSelection(record.active, archiveRoot)
  let pending = null
  if (record.pending !== null) {
    if (record.pending === null || typeof record.pending !== 'object' || Array.isArray(record.pending) ||
        Object.keys(record.pending).sort().join(',') !== 'next,previous') fail('本机存档切换记录损坏，未更改当前存档')
    const change = /** @type {Record<string, unknown>} */ (record.pending)
    const previous = normalizeSelection(change.previous, archiveRoot)
    const next = normalizeSelection(change.next, archiveRoot, false)
    if (next === null || JSON.stringify(previous) !== JSON.stringify(active)) fail('本机存档切换记录与当前选择不一致')
    pending = Object.freeze({ previous, next })
  }
  return Object.freeze({ version: VERSION, active, pending })
}

function syncDirectory(directory) {
  let fd
  try { fd = openSync(directory, 'r'); fsyncSync(fd) }
  catch (error) { const cause = /** @type {any} */ (error); if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(cause?.code)) throw error }
  finally { if (fd !== undefined) closeSync(fd) }
}

/**
 * Active archive choice is separate from every game save/archive and from localStorage.
 * @param {string} userData
 */
export function createOwnerArchiveSelectionStore(userData) {
  const directory = resolve(userData)
  const archiveRoot = join(directory, 'owner-archives')
  const file = join(directory, 'owner-archive-selection.json')
  function read() {
    let stat
    try { stat = lstatSync(file) } catch (error) {
      if (/** @type {any} */ (error)?.code === 'ENOENT') return Object.freeze({ version: VERSION, active: null, pending: null, missing: true })
      throw error
    }
    if (!stat.isFile() || stat.isSymbolicLink()) fail('本机存档选择文件无效，未更改当前存档')
    try { return Object.freeze({ ...normalizeState(JSON.parse(readFileSync(file, 'utf8')), archiveRoot), missing: false }) }
    catch (error) {
      if (/** @type {any} */ (error)?.code === 'OWNER_ARCHIVE_SELECTION_INVALID') throw error
      fail('本机存档选择文件无法读取，未更改当前存档')
    }
  }
  function write(state) {
    const normalized = normalizeState(state, archiveRoot)
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`
    const fd = openSync(temp, 'wx', 0o600)
    try { writeFileSync(fd, JSON.stringify(normalized) + '\n'); fsyncSync(fd) }
    catch (error) { try { unlinkSync(temp) } catch { /* preserve original error */ }; throw error }
    finally { closeSync(fd) }
    try { renameSync(temp, file); syncDirectory(directory) }
    catch (error) { try { unlinkSync(temp) } catch { /* preserve original error */ }; throw error }
    return normalized
  }
  return Object.freeze({
    file,
    archiveRoot,
    read,
    stage(next) {
      const current = read()
      if (current.pending !== null) fail('已有存档切换正在恢复')
      const selected = normalizeSelection(next, archiveRoot)
      if (selected === null) fail('新的存档选择无效')
      return write({ version: VERSION, active: current.active, pending: { previous: current.active, next: selected } })
    },
    commitPending() {
      const current = read()
      if (current.pending === null) fail('没有待完成的存档切换')
      return write({ version: VERSION, active: current.pending.next, pending: null })
    },
    rollbackPending() {
      const current = read()
      if (current.pending === null) return current
      return write({ version: VERSION, active: current.pending.previous, pending: null })
    },
  })
}
