// @ts-check
import { join } from 'node:path'
import { DEFAULT_CLOUD_SETTINGS, readCloudSaveSettings, writeCloudSaveSettings } from '../../../runtime/cloud-save-settings.js'

/** Device-local settings file; deliberately outside state.json and save archives. */
export function createCloudSaveConfigStore(userData) {
  const file = join(userData, 'cloud-save-settings.json')
  let loaded = false
  /** @type {{version:number,enabled:boolean,provider:string,remote:string,branch:string}} */
  let config = { ...DEFAULT_CLOUD_SETTINGS }
  let failure = ''

  function load() {
    if (loaded) return failure ? { ok: false, reason: failure } : { ok: true, config: { ...config } }
    loaded = true
    const result = readCloudSaveSettings(file)
    if (result.ok === false) { failure = result.reason; return { ok: false, reason: failure } }
    config = result.config
    failure = ''
    return { ok: true, config: { ...config } }
  }

  function save(value) {
    const next = writeCloudSaveSettings(file, value)
    config = next
    loaded = true
    failure = ''
    return { ...config }
  }

  return { file, load, save, current: () => ({ ...config }) }
}
