// @ts-check
/**
 * 局域网联机的能力判定。
 *
 * 桌面外壳把 `ownerNetwork` 挂在 `__dshPiggyShell` 上（面板窗口有效）；
 * DSH 网页版目前不注入，整段分区因此自动隐藏。判定位留给后续 DSH 接入：
 * `window.__dshPiggyOwnerNetwork`，形状与桌面相同。
 */
import { desktopShell } from './desktop-shell.js'

const METHODS = ['status', 'addresses', 'start', 'stop', 'invite', 'join', 'joinStatus', 'leave']

/** @param {any} value */
export function isOwnerNetworkApi(value) {
  return value !== null && typeof value === 'object' &&
    METHODS.every(name => typeof value[name] === 'function')
}

/**
 * 桌面优先、DSH 次之；两边都没有能力时返回 null（分区整段隐藏）。
 * @returns {{api:any, transport:'desktop'|'dsh'}|null}
 */
export function resolveOwnerNetworkBinding() {
  const desktop = desktopShell()?.ownerNetwork
  if (isOwnerNetworkApi(desktop)) return { api: desktop, transport: 'desktop' }
  const dsh = typeof window === 'undefined' ? null : /** @type {any} */ (window).__dshPiggyOwnerNetwork
  if (isOwnerNetworkApi(dsh)) return { api: dsh, transport: 'dsh' }
  return null
}
