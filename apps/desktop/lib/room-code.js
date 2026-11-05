// @ts-check
/** 房间码：4 位，字符集去掉 0/O/1/I，显示成 PIG-XXXX。 */
import { randomBytes as nodeRandomBytes } from 'node:crypto'

/** 32 个字符，正好整除 256，取模不会偏。 */
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const ROOM_CODE_LENGTH = 4
export const ROOM_CODE_DISPLAY_PREFIX = 'PIG-'

/**
 * @param {(size:number)=>Buffer} [random]
 * @returns {string}
 */
export function generateRoomCode(random = nodeRandomBytes) {
  const bytes = random(ROOM_CODE_LENGTH)
  if (!Buffer.isBuffer(bytes) || bytes.length !== ROOM_CODE_LENGTH) {
    throw new Error('room code generator returned the wrong number of bytes')
  }
  let code = ''
  for (const byte of bytes) code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]
  return code
}

/**
 * 接受 `7K2M`、`PIG-7K2M`、`pig 7k2m` 这类写法；不合法返回 null。
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeRoomCode(value) {
  if (typeof value !== 'string') return null
  let text = value.trim().toUpperCase().replace(/[\s_-]+/gu, '')
  if (text.startsWith('PIG') && text.length > 3) text = text.slice(3)
  if (text.length !== ROOM_CODE_LENGTH) return null
  for (const character of text) {
    if (!ROOM_CODE_ALPHABET.includes(character)) return null
  }
  return text
}

/** @param {string} code */
export function formatRoomCode(code) {
  return ROOM_CODE_DISPLAY_PREFIX + code
}
