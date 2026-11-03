// @ts-check
/** 从专用私有目录读取可选 TLS 材料；证书/密钥内容永不写日志。 */
import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createSecureContext } from 'node:tls'

import { secureDirectory } from './work-directory.js'

const MAX_TLS_FILE_BYTES = 1024 * 1024

/** @param {string} directory @returns {Promise<{key:Buffer,cert:Buffer}|null>} */
export async function readOwnerNetworkTls(directory) {
  await secureDirectory(directory)
  const keyPath = join(directory, 'tls.key')
  const certPath = join(directory, 'tls.crt')
  const keyStat = await lstat(keyPath).catch(error => {
    if (error?.code === 'ENOENT') return null
    throw new Error('owner network TLS key cannot be inspected')
  })
  const certStat = await lstat(certPath).catch(error => {
    if (error?.code === 'ENOENT') return null
    throw new Error('owner network TLS certificate cannot be inspected')
  })
  if (keyStat === null && certStat === null) return null
  if (keyStat === null || certStat === null) throw new Error('owner network TLS certificate and key must both exist')
  for (const stat of [keyStat, certStat]) {
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > MAX_TLS_FILE_BYTES) {
      throw new Error('owner network TLS files must be bounded regular files')
    }
    if (process.platform !== 'win32' &&
        (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0)) {
      throw new Error('owner network TLS files must be private to the current user')
    }
  }
  const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)])
  try { createSecureContext({ key, cert }) }
  catch { throw new Error('owner network TLS certificate and key do not form a valid pair') }
  return Object.freeze({ key, cert })
}
