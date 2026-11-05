// @ts-check
/** 房间协议里跨进程 / 跨设备共用的字段校验。 */
import { isIP } from 'node:net'

import { ownerNetworkAddressKind } from './owner-network-addresses.js'
import { normalizeRoomCode } from './room-code.js'

export const ROOM_MAX_PLAYERS = 32
export const ROOM_MAX_NAME = 24
export const ROOM_MAX_BODY = 4096
export const ROOM_EMOTES = Object.freeze(['wave', 'pat', 'jump'])
export const ROOM_STATE_HOLD_MS = 15_000
export const ROOM_IDLE_MS = 30_000
export const ROOM_UPDATE_MIN_MS = 30

const CLIENT_ID = /^[A-Za-z0-9_.:-]{1,80}$/u
const STAGE = /^[a-z][a-z0-9-]{0,31}$/u
const ART = /^(?:pigs\/[A-Za-z0-9._/-]{1,160}\.(?:png|webp)|custom-[a-z0-9-]{1,41})(?:\?v=[a-f0-9]{1,32})?$/u
const INVITE = /^piggy:\/\/([^/?#\s]+):(\d{1,5})#([^#\s]+)$/u

/** @param {unknown} value @returns {Record<string, any>|null} */
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? /** @type {Record<string, any>} */ (value) : null
}

/** @param {unknown} value */
function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  const text = value.replace(/[\u0000-\u001f\u007f]+/gu, ' ').replace(/\s+/gu, ' ').trim()
  return [...text].slice(0, max).join('')
}

/**
 * 玩家外观摘要。只用于房间显示，不是存档，也不包含 owner/pig 身份。
 * @param {unknown} value
 * @returns {{name:string,level:number,stage:string,art:string,emoji:string,size:number,label:string}}
 */
export function normalizeProfile(value) {
  const input = record(value)
  if (input === null) throw new TypeError('room profile must be an object')
  const name = cleanText(input.name, ROOM_MAX_NAME)
  if (name === '') throw new TypeError('room profile needs a name')
  const level = Number(input.level)
  if (!Number.isSafeInteger(level) || level < 1 || level > 999) throw new TypeError('room profile level is invalid')
  const stage = typeof input.stage === 'string' && STAGE.test(input.stage) ? input.stage : 'piglet'
  const art = typeof input.art === 'string' && ART.test(input.art) ? input.art : ''
  const emoji = cleanText(input.emoji, 8) || '🐖'
  const size = Number.isFinite(Number(input.size)) ? Math.min(1.6, Math.max(0.5, Number(input.size))) : 1
  const label = cleanText(input.label, 16)
  return { name, level, stage, art, emoji, size, label }
}

/** @param {unknown} value */
export function normalizeClientId(value) {
  return typeof value === 'string' && CLIENT_ID.test(value) ? value : null
}

/**
 * 位置统一成草地上的 0..1；y 不开放，猪都站在同一条地平线上。
 * @param {unknown} x
 * @param {unknown} facing
 */
export function normalizePosition(x, facing) {
  const nx = Number(x)
  if (!Number.isFinite(nx)) throw new TypeError('room position is invalid')
  return {
    x: Math.round(Math.min(1, Math.max(0, nx)) * 1000) / 1000,
    facing: Number(facing) < 0 ? -1 : 1,
  }
}

/** @param {unknown} value */
export function normalizeEmote(value) {
  return typeof value === 'string' && ROOM_EMOTES.includes(value) ? value : ''
}

/**
 * 加入输入：房间码，或完整邀请串 `piggy://<私有 IPv4>:<端口>#<房间码>`。
 * @param {unknown} value
 * @returns {{ok:false,reason:string}|{ok:true,code:string,address?:string,port?:number}}
 */
export function parseRoomInput(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text === '') return { ok: false, reason: '请输入房间码' }
  if (/^piggy:\/\//iu.test(text)) {
    const match = INVITE.exec(text)
    if (match === null) return { ok: false, reason: '邀请串格式不对' }
    const address = match[1]
    const port = Number(match[2])
    const code = normalizeRoomCode(match[3])
    if (isIP(address) !== 4 || ownerNetworkAddressKind(address) === 'public') return { ok: false, reason: '邀请串里不是局域网地址' }
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) return { ok: false, reason: '邀请串端口不对' }
    if (code === null) return { ok: false, reason: '邀请串里的房间码不对' }
    return { ok: true, code, address, port }
  }
  const code = normalizeRoomCode(text)
  if (code === null) return { ok: false, reason: '房间码是 4 位，例如 7K2M' }
  return { ok: true, code }
}

/** 只把界面需要的玩家字段送出去。 */
export function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    level: player.level,
    stage: player.stage,
    art: player.art,
    emoji: player.emoji,
    size: player.size,
    label: player.label,
    x: player.x,
    facing: player.facing,
    row: player.row === 1 || player.row === 2 ? player.row : 0,
    emote: player.emote,
    emoteTarget: player.emoteTarget,
    emoteAt: player.emoteAt,
    host: player.host === true,
  }
}
