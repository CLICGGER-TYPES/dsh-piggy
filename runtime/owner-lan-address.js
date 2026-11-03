// @ts-check
/** LAN listener/client 共用的具体私有 IPv4 边界。 */
import { isIP } from 'node:net'

/** @param {string} address */
export function isPrivateIpv4(address) {
  if (isIP(address) !== 4) return false
  const [a, b] = address.split('.').map(Number)
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 169 && b === 254)
}
