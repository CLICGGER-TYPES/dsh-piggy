// @ts-check
/**
 * One capability check for complete-owner-archive cloud restore.
 *
 * The desktop shell exposes `cloudSave` on `__dshPiggyShell`; the DSH web page
 * injects `__dshPiggyOwnerCloud` from `adapters/dsh/client.js`. They share the
 * same four-method contract, so the settings UI can reuse one renderer.
 */
import { desktopShell } from './desktop-shell.js'

/** @param {any} value */
export function isOwnerCloudApi(value) {
  return value !== null && typeof value === 'object' &&
    typeof value.ownerStatus === 'function' &&
    typeof value.firstSync === 'function' &&
    typeof value.importFirstSync === 'function' &&
    typeof value.ownerHistory === 'function'
}

/**
 * Desktop first, DSH second. Returns null when neither host exposes the API.
 * @returns {{api:any, transport:'desktop'|'dsh', restartAfterImport:boolean}|null}
 */
export function resolveOwnerCloudBinding() {
  const desktop = desktopShell()?.cloudSave
  if (isOwnerCloudApi(desktop)) {
    return { api: desktop, transport: 'desktop', restartAfterImport: true }
  }
  const dsh = typeof window === 'undefined' ? null : /** @type {any} */ (window).__dshPiggyOwnerCloud
  if (isOwnerCloudApi(dsh)) {
    return { api: dsh, transport: 'dsh', restartAfterImport: dsh.restartAfterImport === true }
  }
  return null
}
