// @ts-check
/** 房间服务的 TLS 材料校验：只接受 key + cert，错误在启动时直接抛。 */
import { createSecureContext } from 'node:tls'

/**
 * @param {{key?:Buffer|string,cert?:Buffer|string}|null|undefined} value
 * @returns {{key:Buffer,cert:Buffer}|null}
 */
export function normalizeRoomTls(value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value) ||
      !(Buffer.isBuffer(value.key) || typeof value.key === 'string') ||
      !(Buffer.isBuffer(value.cert) || typeof value.cert === 'string')) {
    throw new Error('room TLS requires both a certificate and private key')
  }
  const key = Buffer.isBuffer(value.key) ? value.key : Buffer.from(value.key)
  const cert = Buffer.isBuffer(value.cert) ? value.cert : Buffer.from(value.cert)
  if (key.length === 0 || cert.length === 0) throw new Error('room TLS materials are empty')
  try { createSecureContext({ key, cert }) }
  catch { throw new Error('room TLS certificate and key do not form a valid pair') }
  return { key, cert }
}
