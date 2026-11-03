// @ts-check
/** Device-local opt-in linking one OwnerDocument identity to one cloud branch. */
import { createHash, randomUUID } from 'node:crypto'
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const VERSION = 1
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const DIGEST = /^[a-f0-9]{64}$/

function configDigest(config) {
  return createHash('sha256').update(JSON.stringify([config.provider, config.remote, config.branch])).digest('hex')
}

function syncDirectory(directory) {
  let fd
  try { fd = openSync(directory, 'r'); fsyncSync(fd) }
  catch (error) { const cause = /** @type {any} */ (error); if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(cause?.code)) throw error }
  finally { if (fd !== undefined) closeSync(fd) }
}

/** @param {string} userData */
export function createOwnerCloudReadyStore(userData) {
  const directory = userData
  const file = join(directory, 'owner-cloud-ready.json')
  function read() {
    let stat
    try { stat = lstatSync(file) } catch (error) { if (/** @type {any} */ (error)?.code === 'ENOENT') return { ok: true, missing: true, value: null }; return { ok: false, reason: 'owner cloud marker cannot be read' } }
    if (!stat.isFile() || stat.isSymbolicLink()) return { ok: false, reason: 'owner cloud marker is not a regular file' }
    try {
      const value = JSON.parse(readFileSync(file, 'utf8'))
      if (value === null || typeof value !== 'object' || Array.isArray(value) ||
          Object.keys(value).sort().join(',') !== 'branch,configDigest,ownerId,version' || value.version !== VERSION ||
          typeof value.ownerId !== 'string' || !ID.test(value.ownerId) || typeof value.branch !== 'string' ||
          typeof value.configDigest !== 'string' || !DIGEST.test(value.configDigest)) {
        return { ok: false, reason: 'owner cloud marker is invalid' }
      }
      return { ok: true, missing: false, value }
    } catch { return { ok: false, reason: 'owner cloud marker is invalid' } }
  }
  function write(ownerId, config) {
    if (typeof ownerId !== 'string' || !ID.test(ownerId) || typeof config?.branch !== 'string' ||
        typeof config?.remote !== 'string' || typeof config?.provider !== 'string') throw new TypeError('owner cloud marker identity is invalid')
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const value = { version: VERSION, ownerId, branch: config.branch, configDigest: configDigest(config) }
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`
    const fd = openSync(temp, 'wx', 0o600)
    try { writeFileSync(fd, JSON.stringify(value) + '\n'); fsyncSync(fd) }
    catch (error) { try { unlinkSync(temp) } catch { /* keep the write failure */ }; throw error }
    finally { closeSync(fd) }
    try { renameSync(temp, file); syncDirectory(directory) }
    catch (error) { try { unlinkSync(temp) } catch { /* keep the rename failure */ }; throw error }
    return value
  }
  function clear(ownerId, config) {
    const current = read()
    if (current.ok !== true || current.value === null) return
    if (ownerId !== undefined && current.value.ownerId !== ownerId) return
    if (config !== undefined && current.value.configDigest !== configDigest(config)) return
    unlinkSync(file)
    syncDirectory(directory)
  }
  function matches(ownerId, config) {
    const current = read()
    return current.ok === true && current.value !== null && current.value.ownerId === ownerId &&
      config?.enabled === true && current.value.branch === config.branch && current.value.configDigest === configDigest(config)
  }
  return Object.freeze({ file, read, write, clear, matches })
}
