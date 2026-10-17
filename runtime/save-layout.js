// @ts-check
/**
 * 存档文件与它旁边的资源目录（skins、extensions、backups）不能重名。
 * 存档文件名可配置；如果正好叫这些名字，导入时的“替换目录”会把状态文件本身换掉。
 */
import { basename } from 'node:path'

export const RESERVED_STATE_NAMES = Object.freeze(['skins', 'extensions', 'backups'])

/**
 * 拒绝会把状态文件和资源目录指向同一路径的 statePath。
 * Windows/macOS 默认大小写不敏感，因此按小写比较，避免跨平台备份互相踩掉。
 * @param {string} statePath
 */
export function assertStatePathLayout(statePath) {
  // Windows 会忽略文件名末尾的点和空格，先按它实际落盘的名字比较。
  const name = basename(statePath).replace(/[. ]+$/, '').toLowerCase()
  if (RESERVED_STATE_NAMES.includes(name)) {
    throw new Error('存档文件名不能与 skins、extensions 或 backups 目录重名')
  }
}
