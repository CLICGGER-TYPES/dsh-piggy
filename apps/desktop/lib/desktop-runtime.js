// @ts-check
/** Owns the main-process host and versions handles and their startup promises. */

/**
 * @param {{
 *   startHostWorker: (gameDir: string, statePath: string, options: any) => Promise<any>,
 *   startVersionsWorker: (options: any) => Promise<any>,
 * }} deps
 */
export function createDesktopRuntime({ startHostWorker, startVersionsWorker }) {
  /** @type {any} */
  let host = null
  /** @type {Promise<any> | null} */
  let hostStarting = null
  /** @type {any} */
  let versions = null
  /** @type {Promise<any> | null} */
  let versionsStarting = null

  /** @param {any} options */
  function startVersions(options) {
    if (versionsStarting !== null) return versionsStarting
    const starting = Promise.resolve(startVersionsWorker(options)).then(handle => {
      versions = handle
      return handle
    })
    versionsStarting = starting
    return starting
  }

  /** @param {string} gameDir @param {string} statePath @param {any} options */
  function startHost(gameDir, statePath, options) {
    if (hostStarting !== null) return hostStarting
    const starting = Promise.resolve(startHostWorker(gameDir, statePath, options)).then(handle => {
      host = handle
      return handle
    })
    hostStarting = starting
    return starting
  }

  function getShutdownResources() {
    return { host, hostStarting, versions, versionsStarting }
  }

  return {
    startVersions,
    startHost,
    getHost: () => host,
    getVersions: () => versions,
    getShutdownResources,
  }
}
