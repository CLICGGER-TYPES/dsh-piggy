// @ts-check
/** DSH OwnerDocument cloud bridge; the legacy flat cloud path remains unchanged. */
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { removeWorkFile, readWorkJson, writeWorkJson } from '../../runtime/work-files.js'
import { secureDirectory } from '../../runtime/work-directory.js'
import { DEFAULT_CLOUD_SETTINGS, normalizeCloudSaveSettings } from '../../runtime/cloud-save-settings.js'

const READY_VERSION = 1
const READY_FILE = 'owner-cloud-ready.json'
const HEAD = /^[a-f0-9]{40,64}$/iu

/** @param {any} config */
function settingsOf(config) {
  return normalizeCloudSaveSettings(config ?? { ...DEFAULT_CLOUD_SETTINGS })
}

/** @param {any} config */
function configDigest(config) {
  return createHash('sha256').update(JSON.stringify([config.provider, config.remote, config.branch])).digest('hex')
}

/** Stable identity of the cloud connection a readiness record belongs to. @param {any} config */
export function ownerCloudConfigDigest(config) {
  return configDigest(settingsOf(config))
}

/** @param {unknown} value @returns {value is {version:1,ownerId:string,configDigest:string,baseHead:string|null}} */
function isReadyRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = /** @type {Record<string, unknown>} */ (value)
  return Object.keys(record).sort().join(',') === 'baseHead,configDigest,ownerId,version' &&
    record.version === READY_VERSION && typeof record.ownerId === 'string' &&
    typeof record.configDigest === 'string' && /^[a-f0-9]{64}$/iu.test(record.configDigest) &&
    (record.baseHead === null || (typeof record.baseHead === 'string' && HEAD.test(record.baseHead)))
}

/** Write the device-local readiness record for one exact owner/archive root.
 * @param {{readyDirectory:string,ownerId:string,config:any,baseHead:string|null}} input
 * @returns {Promise<{version:1,ownerId:string,configDigest:string,baseHead:string|null}>} */
export async function writeOwnerCloudReady({ readyDirectory, ownerId, config, baseHead }) {
  if (typeof ownerId !== 'string' || ownerId === '') throw new TypeError('owner cloud readiness needs an ownerId')
  if (!(baseHead === null || (typeof baseHead === 'string' && HEAD.test(baseHead)))) {
    throw new TypeError('owner cloud readiness needs a verified remote head')
  }
  const settings = settingsOf(config)
  /** @type {{version:1,ownerId:string,configDigest:string,baseHead:string|null}} */
  const record = { version: READY_VERSION, ownerId, configDigest: configDigest(settings), baseHead }
  await secureDirectory(readyDirectory)
  writeWorkJson(join(readyDirectory, READY_FILE), record)
  return record
}

/** Clear only this owner/connection's readiness record; other records are evidence and stay. */
export function clearOwnerCloudReady({ readyDirectory, ownerId, config }) {
  const path = join(readyDirectory, READY_FILE)
  let current
  try { current = readWorkJson(path) } catch { return false }
  if (!isReadyRecord(current) || current.ownerId !== ownerId ||
      current.configDigest !== configDigest(settingsOf(config))) return false
  removeWorkFile(path)
  return true
}

/**
 * @param {{readyDirectory:string,ownerId:string|null,config:any,restore?:(runtime:any)=>Promise<any>}} options
 */
export function createDshOwnerCloudBridge({ readyDirectory, ownerId, config, restore = null }) {
  const settings = settingsOf(config)
  const readyPath = join(readyDirectory, READY_FILE)
  let markerError = null
  /** @type {{version:1,ownerId:string,configDigest:string,baseHead:string|null}|null} */
  let marker = null
  try {
    marker = readWorkJson(readyPath)
    if (marker !== null && !isReadyRecord(marker)) {
      markerError = 'DSH OwnerDocument cloud readiness record is invalid; evidence was kept'
      marker = null
    }
  } catch {
    markerError = 'DSH OwnerDocument cloud readiness record cannot be read; evidence was kept'
    marker = null
  }

  function matches(actualOwnerId = ownerId) {
    return markerError === null && settings.enabled === true && actualOwnerId !== null && marker !== null &&
      marker.ownerId === actualOwnerId && marker.configDigest === configDigest(settings)
  }

  function runtimeConfig(actualOwnerId = ownerId) {
    const ready = matches(actualOwnerId)
    return { ...settings, syncReady: ready, ...(ready && marker.baseHead !== null ? { cloudBaseHead: marker.baseHead } : {}) }
  }

  function status(runtime) {
    return { configured: settings.enabled && settings.remote !== '', directionRequired: settings.enabled && !matches(runtime?.metadata?.().ownerId),
      markerError, ...(runtime?.ownerCloudStatus?.() ?? { enabled: false, ready: false, branch: settings.branch }) }
  }

  async function firstSync(runtime, direction) {
    if (direction === 'cloud-to-local') {
      if (!settings.enabled || settings.remote === '') return { ok: false, reason: 'Configure and enable ownerCloud in the DSH plugin settings first' }
      if (typeof restore !== 'function') return { ok: false, reason: 'Owner cloud restore is not available in this DSH runtime' }
      try { return await restore(runtime) } catch { return { ok: false, reason: 'Owner cloud restore could not validate the remote archive' } }
    }
    if (direction !== 'local-to-cloud') {
      return { ok: false, reason: 'First sync direction is required' }
    }
    if (!settings.enabled || settings.remote === '') return { ok: false, reason: 'Configure and enable ownerCloud in the DSH plugin settings first' }
    if (markerError !== null) return { ok: false, reason: markerError }
    const actualOwnerId = runtime?.metadata?.().ownerId ?? ownerId
    if (actualOwnerId === null || matches(actualOwnerId)) return { ok: false, reason: 'Owner cloud is already ready or the owner identity is unavailable' }
    let result
    try { result = await runtime.firstSyncCloud('local-to-cloud') }
    catch { return { ok: false, reason: 'Owner cloud first sync failed' } }
    if (result?.ok !== true || typeof result.remoteHead !== 'string' || !HEAD.test(result.remoteHead)) return result?.ok === false ? result : { ok: false, reason: 'Owner cloud did not return a verified remote head' }
    try {
      marker = await writeOwnerCloudReady({ readyDirectory, ownerId: actualOwnerId, config: settings, baseHead: result.remoteHead })
      const applied = await runtime.configureCloudSave({ ...settings, syncReady: true, cloudBaseHead: result.remoteHead })
      if (applied?.ok !== true) {
        marker = null
        clearOwnerCloudReady({ readyDirectory, ownerId: actualOwnerId, config: settings })
        return { ok: false, reason: 'Remote first sync succeeded, but local automatic sync could not be activated' }
      }
      return { ok: true, direction, created: result.created === true, alreadyCurrent: result.alreadyCurrent === true,
        automaticPushEnabled: true }
    } catch {
      marker = null
      try { clearOwnerCloudReady({ readyDirectory, ownerId: actualOwnerId, config: settings }) } catch { /* keep evidence; no secret is stored */ }
      return { ok: false, reason: 'Remote first sync succeeded, but local readiness could not be saved' }
    }
  }

  async function history(runtime) {
    if (!matches(runtime?.metadata?.().ownerId)) return { ok: false, reason: markerError ?? 'Complete the explicit local-to-cloud first sync first' }
    try { return await runtime.ownerCloudHistory(settings.branch) }
    catch { return { ok: false, reason: 'Owner cloud history is unavailable' } }
  }

  return Object.freeze({ settings, runtimeConfig, status, firstSync, history, readyPath })
}
