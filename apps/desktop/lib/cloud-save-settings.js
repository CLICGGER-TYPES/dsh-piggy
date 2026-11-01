// @ts-check
/** Device-local cloud settings. This file is deliberately separate from save state/archive files. */
import { randomUUID } from 'node:crypto'
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'

export const CLOUD_SETTINGS_VERSION = 1
export const DEFAULT_CLOUD_SETTINGS = Object.freeze({
  version: CLOUD_SETTINGS_VERSION,
  enabled: false,
  provider: 'github',
  remote: '',
  branch: 'main',
})

/** @typedef {{version:number,enabled:boolean,provider:'github'|'gitee'|'git',remote:string,branch:string}} CloudSaveSettings */

const PROVIDERS = new Set(['github', 'gitee', 'git'])

/** @returns {never} */
function fail(message) { throw Object.assign(new Error(message), { code: 'CLOUD_SETTINGS_INVALID' }) }

function remoteHost(remote) {
  if (typeof remote !== 'string' || remote.trim() !== remote || remote.length > 2048 || /[\u0000-\u0020\u007f]/u.test(remote)) fail('请填写有效的 Git 仓库地址')
  if (remote === '') return ''
  const scp = /^git@([A-Za-z0-9.-]+):([^\s:][^\s]*)$/u.exec(remote)
  if (scp !== null) return scp[1].toLowerCase()
  /** @type {URL} */
  let url
  try { url = new URL(remote) } catch { fail('请填写 HTTPS 或 SSH 仓库地址') }
  if (!['https:', 'http:', 'ssh:'].includes(url.protocol)) fail('请填写 HTTPS 或 SSH 仓库地址')
  if (!url.hostname || (url.protocol !== 'ssh:' && url.username !== '') || url.password !== '' ||
      url.search !== '' || url.hash !== '' || url.pathname === '/' || !url.pathname.startsWith('/')) {
    fail('仓库地址不能包含账号、令牌、查询参数或片段')
  }
  return url.hostname.toLowerCase()
}

function validBranch(branch) {
  if (typeof branch !== 'string' || branch.trim() !== branch || branch.length < 1 || branch.length > 255 ||
      branch.startsWith('-') || branch.endsWith('/') || branch.endsWith('.') || branch.includes('..') ||
      branch.includes('//') || branch.includes('@{') || /[\u0000-\u0020\u007f~^:?*[\\]/u.test(branch)) return false
  return branch.split('/').every(part => part !== '' && !part.startsWith('.') && !part.endsWith('.lock'))
}

/** Validate and copy only the public configuration fields. Credentials are never part of this shape. */
/** @param {any} value @returns {CloudSaveSettings} */
export function normalizeCloudSaveSettings(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('云存档设置格式无效')
  if (value.version !== undefined && value.version !== CLOUD_SETTINGS_VERSION) fail('云存档设置版本不支持')
  if (typeof value.enabled !== 'boolean') fail('云存档开关无效')
  const rawProvider = value.provider === undefined ? 'github' : value.provider
  if (typeof rawProvider !== 'string' || !PROVIDERS.has(rawProvider)) fail('请选择有效的 Git 平台')
  const provider = /** @type {CloudSaveSettings['provider']} */ (rawProvider)
  const remote = value.remote === undefined ? '' : value.remote
  const host = remoteHost(remote)
  if (provider === 'github' && host !== '' && host !== 'github.com') fail('GitHub 地址应使用 github.com')
  if (provider === 'gitee' && host !== '' && host !== 'gitee.com') fail('Gitee 地址应使用 gitee.com')
  const branch = value.branch === undefined ? 'main' : value.branch
  if (!validBranch(branch)) fail('分支名称无效')
  return { version: CLOUD_SETTINGS_VERSION, enabled: value.enabled, provider, remote, branch }
}

/** @param {string} file @returns {{ok:true,missing:boolean,config:CloudSaveSettings}|{ok:false,missing:false,reason:string}} */
export function readCloudSaveSettings(file) {
  try {
    const stat = lstatSync(file)
    if (!stat.isFile() || stat.isSymbolicLink()) return { ok: false, missing: false, reason: '云存档设置文件无效' }
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    return { ok: true, missing: false, config: normalizeCloudSaveSettings(parsed) }
  } catch (error) {
    const cause = /** @type {any} */ (error)
    if (cause?.code === 'ENOENT') return { ok: true, missing: true, config: { ...DEFAULT_CLOUD_SETTINGS } }
    return { ok: false, missing: false, reason: cause?.code === 'CLOUD_SETTINGS_INVALID' ? cause.message : '云存档设置无法读取' }
  }
}

function syncDirectory(directory) {
  let fd
  try { fd = openSync(directory, 'r'); fsyncSync(fd) }
  catch (error) { const cause = /** @type {any} */ (error); if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(cause?.code)) throw error }
  finally { if (fd !== undefined) closeSync(fd) }
}

/** Atomically persist settings with owner-only permissions. */
export function writeCloudSaveSettings(file, value) {
  const config = normalizeCloudSaveSettings(value)
  const directory = dirname(file)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`
  const fd = openSync(temp, 'wx', 0o600)
  try { writeSync(fd, JSON.stringify(config) + '\n'); fsyncSync(fd) }
  catch (error) { try { unlinkSync(temp) } catch { /* preserve original error */ }; throw error }
  finally { closeSync(fd) }
  try { renameSync(temp, file); syncDirectory(directory) }
  catch (error) { try { unlinkSync(temp) } catch { /* preserve original error */ }; throw error }
  return config
}
