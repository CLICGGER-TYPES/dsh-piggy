// @ts-check
/** 公网房间地址的解析：只接受 http(s)://host[:port]/，不要路径、查询或账号。 */
import { validRoomHost } from './room-protocol.js'

function isIpv4(value) {
  return typeof value === 'string' && /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(value)
}

/**
 * @param {unknown} value
 * @returns {{ protocol: 'http'|'https', host: string, port: number, origin: string }|null}
 */
export function parseRoomPublicUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  let url
  try { url = new URL(value.trim()) } catch { return null }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '' ||
      (url.pathname !== '/' && url.pathname !== '')) return null
  const host = url.hostname.toLowerCase()
  if (!validRoomHost(host)) return null
  const protocol = url.protocol === 'https:' ? 'https' : 'http'
  const port = url.port === '' ? (protocol === 'https' ? 443 : 80) : Number(url.port)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) return null
  return { protocol, host, port, origin: url.origin }
}

export { isIpv4 }
