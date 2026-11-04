// @ts-check
/**
 * 本机可用的联机地址：只来自主进程的网卡枚举，渲染层永远不能自带地址。
 *
 * 第一版只开放具体私有 IPv4（RFC1918 与 link-local）和回环地址；公网、通配、
 * 网段、主机名一律不产出，之后也不放行（TLS/公网留到后续版本）。
 */
import { isIP } from 'node:net'

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u

/** @param {string} address */
function octets(address) {
  const match = IPV4.exec(address)
  if (match === null) return null
  const parts = match.slice(1).map(Number)
  return parts.every(part => part >= 0 && part <= 255) ? parts : null
}

/**
 * `loopback` / `private` / `link-local` / `public`；不是 IPv4 时为 null。
 * @param {string} address
 * @returns {'loopback'|'private'|'link-local'|'public'|null}
 */
export function ownerNetworkAddressKind(address) {
  if (typeof address !== 'string' || isIP(address) !== 4) return null
  const parts = octets(address)
  if (parts === null) return null
  const [a, b] = parts
  if (a === 127) return 'loopback'
  if (a === 10) return 'private'
  if (a === 172 && b >= 16 && b <= 31) return 'private'
  if (a === 192 && b === 168) return 'private'
  if (a === 169 && b === 254) return 'link-local'
  return 'public'
}

/** 第一版允许监听的地址：具体私有 IPv4 与回环。 */
export function isOwnerNetworkListenAddress(address) {
  const kind = ownerNetworkAddressKind(address)
  return kind === 'loopback' || kind === 'private' || kind === 'link-local'
}

/**
 * 枚举 `os.networkInterfaces()` 的结果，保持网卡与地址原有顺序，去重。
 * 公网地址不返回；回环地址保留（标 `loopback`，界面上写“仅本机”）。
 * @param {Record<string, any[]>|undefined|null} interfaces
 * @returns {Array<{address:string, interface:string, kind:'loopback'|'private'|'link-local'}>}
 */
export function enumerateOwnerNetworkAddresses(interfaces) {
  /** @type {Array<{address:string, interface:string, kind:'loopback'|'private'|'link-local'}>} */
  const out = []
  const seen = new Set()
  if (interfaces === null || typeof interfaces !== 'object') return out
  for (const [name, entries] of Object.entries(interfaces)) {
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object') continue
      if (entry.family !== 'IPv4' && entry.family !== 4) continue
      const address = typeof entry.address === 'string' ? entry.address : ''
      const kind = ownerNetworkAddressKind(address)
      // 公网与非 IPv4 一样不进入候选；通配串（0.0.0.0）本身也不是合法具体地址。
      if (kind === null || kind === 'public') continue
      if (seen.has(address)) continue
      seen.add(address)
      out.push({ address, interface: typeof name === 'string' ? name : '', kind })
    }
  }
  return out
}
