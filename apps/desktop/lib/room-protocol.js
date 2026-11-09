// @ts-check
/** 房间协议里跨进程 / 跨设备共用的字段校验。 */
import { isIP } from 'node:net'

import { ownerNetworkAddressKind } from './owner-network-addresses.js'
import { normalizeRoomCode } from './room-code.js'

export const ROOM_MAX_PLAYERS = 32
export const ROOM_MAX_NAME = 24
export const ROOM_MAX_BODY = 4096
export const ROOM_EMOTES = Object.freeze(['wave', 'pat', 'jump'])
export const ROOM_CARE_OPS = Object.freeze(['feed', 'bathe', 'play', 'medicine'])
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

function whole(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
}

function publicLevel(value) {
  const input = record(value)
  const level = whole(input?.level, 1, 999, 1)
  return {
    level,
    percent: whole(input?.percent, 0, 100, 0),
    toNext: whole(input?.toNext, 0, 1e9, 0),
    maxed: input?.maxed === true,
    titleEmoji: cleanText(input?.titleEmoji, 8),
    titleLabel: cleanText(input?.titleLabel, 16),
  }
}

function publicStatus(value) {
  const input = record(value)
  const traits = record(input?.traits)
  const body = record(input?.bodyWeight)
  return {
    level: publicLevel(input?.level),
    health: whole(input?.health, 0, 9, 5),
    healthPercent: whole(input?.healthPercent, 0, 100, 100),
    maxHealth: whole(input?.maxHealth, 1, 9, 5),
    traits: {
      intel: whole(traits?.intel, 0, 999, 0),
      charm: whole(traits?.charm, 0, 999, 0),
      strong: whole(traits?.strong, 0, 999, 0),
    },
    weight: cleanText(input?.weight, 32),
    bodyWeight: body === null ? null : { label: cleanText(body.label, 24), locked: body.locked === true },
    mood: cleanText(input?.mood, 24),
    moodLabel: cleanText(input?.moodLabel, 24),
    illness: (() => {
      const ill = record(input?.illness)
      if (ill === null) return null
      return {
        name: cleanText(ill.name, 24), stage: whole(ill.stage, 1, 4, 1),
        cure: cleanText(ill.cure, 24), cureKey: cleanText(ill.cureKey, 40),
        cureEmoji: cleanText(ill.cureEmoji, 8), doctorFee: whole(ill.doctorFee, 0, 1e9, 0),
      }
    })(),
  }
}

function publicCard(value) {
  const input = record(value)
  const zodiac = record(input?.zodiac)
  const personality = record(input?.personality)
  const counts = record(input?.counts)
  return {
    birthday: cleanText(input?.birthday, 32),
    zodiac: zodiac === null ? null : { emoji: cleanText(zodiac.emoji, 8), label: cleanText(zodiac.label, 16) },
    personality: personality === null ? null : { emoji: cleanText(personality.emoji, 8), label: cleanText(personality.label, 16) },
    catchphrase: cleanText(input?.catchphrase, 32),
    motto: cleanText(input?.motto, 80),
    counts: counts === null ? null : {
      days: whole(counts.days, 0, 1e9, 0),
      certificates: whole(counts.certificates, 0, 1e9, 0),
      souvenirs: whole(counts.souvenirs, 0, 1e9, 0),
      graduations: whole(counts.graduations, 0, 1e9, 0),
    },
  }
}

/**
 * 玩家外观摘要。只用于房间显示，不是存档，也不包含 owner/pig 身份。
 * @param {unknown} value
 * @returns {{name:string,level:number,stage:string,art:string,emoji:string,size:number,label:string,mood:string,moodLabel:string,care:{satiety:number,cleanliness:number,happiness:number},actions:any,status:any,card:any}}
 */
/** 朋友面板的照顾按钮只看这几项就绪状态；不传别的行动或存档字段。 */
function publicActions(value) {
  const input = record(value)
  const out = {}
  for (const key of ['feed', 'bathe', 'play', 'pet']) {
    const source = input?.[key] !== null && typeof input?.[key] === 'object' && !Array.isArray(input[key]) ? input[key] : {}
    const wait = Number(source.waitSeconds)
    out[key] = {
      ready: source.ready !== false,
      waitSeconds: Number.isFinite(wait) ? Math.min(3600, Math.max(0, Math.round(wait))) : 0,
      blocked: source.blocked === 'away' || source.blocked === 'hungry' ? source.blocked : null,
    }
  }
  return out
}

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
  const careInput = input.care !== null && typeof input.care === 'object' && !Array.isArray(input.care) ? input.care : {}
  const careValue = key => {
    const value = Number(careInput[key])
    return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 60
  }
  const care = { satiety: careValue('satiety'), cleanliness: careValue('cleanliness'), happiness: careValue('happiness') }
  const actions = publicActions(input.actions)
  const mood = cleanText(input.mood, 24)
  const moodLabel = cleanText(input.moodLabel, 24)
  const status = publicStatus(input.status)
  const card = publicCard(input.card)
  return { name, level, stage, art, emoji, size, label, care, actions, mood, moodLabel, status, card }
}

/** @param {unknown} value */
export function normalizeClientId(value) {
  return typeof value === 'string' && CLIENT_ID.test(value) ? value : null
}

/**
 * 位置统一成房间地面上的 0..1：x 左右，y 前后（0 最前、1 最后）。
 * @param {unknown} x
 * @param {unknown} y
 * @param {unknown} facing
 */
export function normalizePosition(x, y, facing) {
  const nx = Number(x)
  const ny = Number(y)
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) throw new TypeError('room position is invalid')
  return {
    x: Math.round(Math.min(1, Math.max(0, nx)) * 1000) / 1000,
    y: Math.round(Math.min(1, Math.max(0, ny)) * 1000) / 1000,
    facing: Number(facing) < 0 ? -1 : 1,
  }
}

/** @param {unknown} value */
export function normalizeEmote(value) {
  return typeof value === 'string' && ROOM_EMOTES.includes(value) ? value : ''
}

const ITEM_KEY = /^[a-z0-9-]{1,48}$/u
const CARE_NONCE = /^[A-Za-z0-9._:-]{1,80}$/u

/**
 * 联机照顾意图：谁、用哪个物品、对谁做哪种照顾。
 * @param {unknown} value
 */
export function normalizeCareIntent(value) {
  const input = record(value)
  if (input === null) throw new TypeError('care must be an object')
  const targetId = typeof input.targetId === 'string' ? input.targetId : ''
  const itemKey = typeof input.itemKey === 'string' ? input.itemKey : ''
  const op = typeof input.op === 'string' ? input.op : ''
  const nonce = typeof input.nonce === 'string' ? input.nonce : ''
  if (targetId === '' || targetId.length > 80) throw new TypeError('care target is invalid')
  if (!ITEM_KEY.test(itemKey)) throw new TypeError('care item is invalid')
  if (!ROOM_CARE_OPS.includes(op)) throw new TypeError('care op is invalid')
  if (!CARE_NONCE.test(nonce)) throw new TypeError('care nonce is invalid')
  return { targetId, itemKey, op, nonce }
}

/** 三位状态只用于公开照顾；不接受别的字段。 */
export function normalizeCareStats(value) {
  const input = record(value)
  if (input === null) return null
  const out = {}
  for (const key of ['satiety', 'cleanliness', 'happiness']) {
    const number = Number(input[key])
    if (!Number.isFinite(number)) return null
    out[key] = Math.min(100, Math.max(0, Math.round(number)))
  }
  return out
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
    mood: player.mood,
    moodLabel: player.moodLabel,
    care: player.care,
    status: player.status,
    card: player.card,
    x: player.x,
    y: Number.isFinite(Number(player.y)) ? Math.min(1, Math.max(0, Number(player.y))) : 0.2,
    facing: player.facing,
    row: player.row === 1 || player.row === 2 ? player.row : 0,
    emote: player.emote,
    emoteTarget: player.emoteTarget,
    emoteAt: player.emoteAt,
    host: player.host === true,
  }
}
