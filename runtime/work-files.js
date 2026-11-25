// @ts-check
/** 游戏工作账本的旁路文件；存档结构不变，写入仍由唯一运行时负责。 */
import { randomBytes } from 'node:crypto'
import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function readWorkJson(path) {
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('work file must be a real file')
    const value = JSON.parse(readFileSync(path, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid work file; evidence preserved')
    return value
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

export function syncDirectory(directory) {
  if (process.platform === 'win32') return
  const descriptor = openSync(directory, 'r')
  try { fsyncSync(descriptor) } finally { closeSync(descriptor) }
}

/**
 * @param {string} path
 * @param {unknown} value
 * @param {(() => void)|{onPublished?:() => void,writeFileSync?:typeof writeFileSync,fsyncSync?:typeof fsyncSync}} [onPublishedOrOptions]
 */
export function writeWorkJson(path, value, onPublishedOrOptions = () => {}) {
  const options = typeof onPublishedOrOptions === 'object' && onPublishedOrOptions !== null ? onPublishedOrOptions : {}
  const onPublished = typeof onPublishedOrOptions === 'function' ? onPublishedOrOptions : (options.onPublished ?? (() => {}))
  const write = options.writeFileSync ?? writeFileSync
  const sync = options.fsyncSync ?? fsyncSync
  const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`
  const descriptor = openSync(temporary, 'wx', 0o600)
  let closed = false
  try {
    write(descriptor, JSON.stringify(value))
    sync(descriptor)
    closeSync(descriptor)
    closed = true
    renameSync(temporary, path)
  } catch (error) {
    // 先关句柄再删临时文件（Windows 未关句柄无法 unlink），清理失败不能掩盖原始错误。
    if (!closed) {
      try { closeSync(descriptor) } catch { /* 保留原始错误 */ }
    }
    try { unlinkSync(temporary) } catch { /* 保留原始错误 */ }
    throw error
  }
  // rename 已发布文件，即使目录同步失败也必须保留这笔事务。
  onPublished()
  syncDirectory(dirname(path))
}

export function removeWorkFile(path) {
  try { unlinkSync(path) } catch (error) { if (error?.code !== 'ENOENT') throw error }
  syncDirectory(dirname(path))
}
