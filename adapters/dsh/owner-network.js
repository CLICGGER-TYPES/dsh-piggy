// @ts-check
/** DSH OwnerDocument opt-in LAN service. It never starts until the local control route requests it. */
import { dirname } from 'node:path'

import { readOwnerNetworkTls } from '../../runtime/owner-network-tls.js'
import { startOwnerLanServer } from '../../runtime/owner-lan-server.js'

/** @param {{ownerDocumentPath:string,runtime:any,config:any}} options */
export function createDshOwnerNetworkService({ ownerDocumentPath, runtime, config }) {
  const configured = config?.ownerNetwork
  const enabled = configured?.enabled === true
  if (configured !== undefined && (configured === null || typeof configured !== 'object' || Array.isArray(configured))) {
    throw new TypeError('ownerNetwork must be an object')
  }
  const directory = `${ownerDocumentPath}.network`
  let listener = null
  let starting = null
  let closed = false

  function status() {
    const current = listener?.status() ?? { running: false, pairedClients: 0 }
    return { available: enabled && !closed, enabled, ...current }
  }

  async function start() {
    if (!enabled) throw Object.assign(new Error('DSH OwnerDocument network is disabled in plugin config'), { code: 'owner-network-disabled' })
    if (closed) throw Object.assign(new Error('DSH OwnerDocument network service is closed'), { code: 'owner-network-closed' })
    if (listener !== null) return status()
    if (starting !== null) return starting
    starting = (async () => {
      let candidate
      try {
        const tls = await readOwnerNetworkTls(directory)
        candidate = await startOwnerLanServer({
          runtime,
          directory,
          listenAddress: typeof configured.listenAddress === 'string' ? configured.listenAddress : undefined,
          advertisedHost: typeof configured.advertisedHost === 'string' ? configured.advertisedHost : undefined,
          ...(tls === null ? {} : { tls }),
        })
      } catch {
        throw Object.assign(new Error('Owner network address or private TLS configuration is invalid'), {
          code: 'owner-network-config-invalid',
        })
      }
      if (closed) {
        await candidate.close()
        throw Object.assign(new Error('DSH OwnerDocument network service closed during start'), { code: 'owner-network-closed' })
      }
      listener = candidate
      return status()
    })()
    try { return await starting } finally { starting = null }
  }

  function invite(pigId) {
    if (closed) throw Object.assign(new Error('DSH OwnerDocument network service is closed'), { code: 'owner-network-closed' })
    if (!enabled) throw Object.assign(new Error('DSH OwnerDocument network is disabled in plugin config'), { code: 'owner-network-disabled' })
    if (listener === null) throw Object.assign(new Error('Start the DSH OwnerDocument network before creating an invitation'), { code: 'owner-network-not-running' })
    return listener.createInvitation(pigId)
  }

  async function stop() {
    const pendingStart = starting
    if (pendingStart !== null) await pendingStart.catch(() => {})
    const current = listener
    listener = null
    if (current !== null) await current.close()
    return status()
  }

  async function close() {
    closed = true
    return stop()
  }

  return Object.freeze({ status, start, invite, stop, close, directory })
}
