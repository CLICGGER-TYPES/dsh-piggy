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

export function writeWorkJson(path, value, onPublished = () => {}) {
  const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`
  const descriptor = openSync(temporary, 'wx', 0o600)
  try { writeFileSync(descriptor, JSON.stringify(value)); fsyncSync(descriptor) }
  finally { closeSync(descriptor) }
  try { renameSync(temporary, path) }
  catch (error) {
    // 清理失败不能掩盖发布失败的原始错误。
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
