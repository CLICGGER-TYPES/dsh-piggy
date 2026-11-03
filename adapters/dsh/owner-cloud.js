// @ts-check
/** DSH OwnerDocument cloud bridge; the legacy flat cloud path remains unchanged. */
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { removeWorkFile, readWorkJson, writeWorkJson } from '../../runtime/work-files.js'
import { secureDirectory } from '../../runtime/work-directory.js'
import { DEFAULT_CLOUD_SETTINGS, normalizeCloudSaveSettings } from '../../runtime/cloud-save-settings.js'

const READY_VERSION = 1
const HEAD = /^[a-f0-9]{40,64}$/iu

function configDigest(config) {
  return createHash('sha256').update(JSON.stringify([config.provider, config.remote, config.branch])).digest('hex')
}

/** @param {{readyDirectory:string,ownerId:string|null,config:any}} options */
export function createDshOwnerCloudBridge({ readyDirectory, ownerId, config }) {
  const settings = normalizeCloudSaveSettings(config ?? { ...DEFAULT_CLOUD_SETTINGS })
  const readyPath = join(readyDirectory, 'owner-cloud-ready.json')
  let markerError = null
  let marker = null
  try {
    marker = readWorkJson(readyPath)
    if (marker !== null && (Object.keys(marker).sort().join(',') !== 'baseHead,configDigest,ownerId,version' ||
        marker.version !== READY_VERSION || typeof marker.ownerId !== 'string' ||
        typeof marker.configDigest !== 'string' || !/^[a-f0-9]{64}$/iu.test(marker.configDigest) ||
        !(marker.baseHead === null || (typeof marker.baseHead === 'string' && HEAD.test(marker.baseHead))))) {
      markerError = 'DSH OwnerDocument cloud readiness record is invalid; evidence was kept'
      marker = null
    }
  } catch {
    markerError = 'DSH OwnerDocument cloud readiness record cannot be read; evidence was kept'
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
    if (direction !== 'local-to-cloud') {
      return { ok: false, reason: 'DSH currently supports first sync from this local owner to an empty cloud branch; cloud restore needs copy-and-switch support' }
    }
    if (!settings.enabled || settings.remote === '') return { ok: false, reason: 'Configure and enable ownerCloud in the DSH plugin settings first' }
    if (markerError !== null) return { ok: false, reason: markerError }
    const actualOwnerId = runtime?.metadata?.().ownerId ?? ownerId
    if (actualOwnerId === null || matches(actualOwnerId)) return { ok: false, reason: 'Owner cloud is already ready or the owner identity is unavailable' }
    let result
    try { result = await runtime.firstSyncCloud('local-to-cloud') }
    catch { return { ok: false, reason: 'Owner cloud first sync failed' } }
    if (result?.ok !== true || typeof result.remoteHead !== 'string' || !HEAD.test(result.remoteHead)) return result?.ok === false ? result : { ok: false, reason: 'Owner cloud did not return a verified remote head' }
    const next = { version: READY_VERSION, ownerId: actualOwnerId, configDigest: configDigest(settings), baseHead: result.remoteHead }
    try {
      await secureDirectory(readyDirectory)
      writeWorkJson(readyPath, next)
      marker = next
      const applied = await runtime.configureCloudSave({ ...settings, syncReady: true, cloudBaseHead: result.remoteHead })
      if (applied?.ok !== true) {
        marker = null
        removeWorkFile(readyPath)
        return { ok: false, reason: 'Remote first sync succeeded, but local automatic sync could not be activated' }
      }
      return { ok: true, direction, created: result.created === true, alreadyCurrent: result.alreadyCurrent === true,
        automaticPushEnabled: true }
    } catch {
      marker = null
      try { removeWorkFile(readyPath) } catch { /* keep corrupt/read-only evidence; no secret is stored */ }
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
