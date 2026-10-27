// @ts-check
/**
 * DSH 外部模式的文件：配置、发现文件、退役标记和原子写。
 *
 * 令牌只在宿主进程里读，不写日志、不传给浏览器。目录 0700、文件 0600
 * （Windows 由桌面端已有的 ACL 逻辑负责 work-endpoint 目录）。
 *
 * @module dsh-piggy/adapters/dsh/external-files
 */

import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

export const CONFIG_VERSION = 1

export const configPath = statePath => `${statePath}.external-pet.json`
export const outboxPath = statePath => `${statePath}.work-outbox.json`
export const markerPath = statePath => `${statePath}.merged`
export const retiredStatePath = (statePath, mergeId) => `${statePath}.merged-${mergeId}`
export const retiredEventsPath = (statePath, mergeId) => `${statePath}.work-events.merged-${mergeId}`

/** 默认 DSH_HOME 与自定义 DSH_HOME 两份应用标记都可能存在。 */
export function dshHomes(configured = process.env.DSH_HOME) {
  const custom = typeof configured === 'string' && configured.trim() !== '' ? resolve(configured.trim()) : null
  const fallback = join(homedir(), '.dsh')
  return [...new Set([custom, fallback].filter(Boolean))]
}

export function desktopMarkerPaths(homes = dshHomes()) {
  return homes.map(home => join(home, 'dsh-piggy', 'desktop-app.json'))
}

export function readJson(file) {
  try {
    const stat = lstatSync(file)
    if (!stat.isFile() || stat.isSymbolicLink()) return { ok: false, reason: 'not-a-file' }
    return { ok: true, value: JSON.parse(readFileSync(file, 'utf8')) }
  } catch (error) {
    if (error?.code === 'ENOENT') return { ok: false, reason: 'missing' }
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

function syncDir(directory) {
  if (process.platform === 'win32') return
  let descriptor
  try { descriptor = openSync(directory, 'r'); fsyncSync(descriptor) }
  catch (error) { if (!['EINVAL', 'ENOTSUP', 'EISDIR', 'EPERM'].includes(error.code)) throw error }
  finally { if (descriptor !== undefined) closeSync(descriptor) }
}

/** 临时文件 + fsync + rename + 目录 fsync；和 work-files 同一套原子写。 */
export function writeJsonAtomic(file, value, mode = 0o600) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  const descriptor = openSync(temp, 'wx', mode)
  try { writeSync(descriptor, JSON.stringify(value)); fsyncSync(descriptor) }
  finally { closeSync(descriptor) }
  try { renameSync(temp, file) }
  catch (error) {
    try { unlinkSync(temp) } catch { /* keep original error */ }
    throw error
  }
  syncDir(dirname(file))
}

export function removeFile(file) {
  try { unlinkSync(file) } catch (error) { if (error?.code !== 'ENOENT') throw error }
  syncDir(dirname(file))
}

/** pid 存活检查；不回收任何别人的文件。 */
export function pidAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true }
  catch (error) { return error?.code === 'EPERM' }
}

export function readConfig(statePath) {
  const file = configPath(statePath)
  const read = readJson(file)
  if (!read.ok) return { ok: read.reason === 'missing', missing: read.reason === 'missing', reason: read.reason, config: null }
  const config = read.value
  if (config?.version !== CONFIG_VERSION || !['none', 'paused', 'merged', 'rolling-back', 'merge-unknown'].includes(config.pigState)) {
    return { ok: false, missing: false, reason: 'schema', config: null }
  }
  return { ok: true, missing: false, reason: null, config }
}

export function writeConfig(statePath, config) {
  const next = { ...config, version: CONFIG_VERSION, updatedAt: Number.isFinite(config.updatedAt) ? config.updatedAt : Date.now() }
  writeJsonAtomic(configPath(statePath), next)
  return next
}

export function removeConfig(statePath) { removeFile(configPath(statePath)) }

export function readMarker(statePath) {
  const read = readJson(markerPath(statePath))
  return read.ok ? { exists: true, marker: read.value, corrupt: false } : { exists: read.reason !== 'missing', marker: null, corrupt: read.reason !== 'missing' }
}

export function writeMarker(statePath, marker) { writeJsonAtomic(markerPath(statePath), marker) }

export function removeMarker(statePath) { removeFile(markerPath(statePath)) }

export function sha256(text) { return createHash('sha256').update(text).digest('hex') }

/** 状态指纹：state + receipts 的规范化 JSON（配置里的 stateHash 用它）。 */
export function stateFingerprint(state, receipts) {
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  }
  return sha256(JSON.stringify({ state: canonical(state), receipts: canonical(Array.isArray(receipts) ? receipts : []) }))
}

/** 从标记/配置推出现在该不该打开内嵌存档；返回原因给恢复页。 */
export function retirementState(statePath) {
  const marker = readMarker(statePath)
  const config = readConfig(statePath)
  if (marker.exists) return { retired: true, marker: marker.marker, corrupt: marker.corrupt, config: config.config }
  if (config.config?.pigState === 'merged') return { retired: true, marker: null, corrupt: false, config: config.config }
  return { retired: false, marker: null, corrupt: false, config: config.config }
}

/** 安全文件名：只用 basename，挡住配置/记录里的路径。 */
export function safeBaseName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9._-]{1,140}$/.test(name) && basename(name) === name ? name : null
}

export function retiredExists(statePath, mergeId) {
  return existsSync(retiredStatePath(statePath, mergeId)) || existsSync(retiredEventsPath(statePath, mergeId))
}
