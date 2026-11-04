// @ts-check
/**
 * 已安装第三方素材包的只读文件读取（GET /dsh-piggy/ext/<key>/actions|sounds/...）。
 *
 * 只认 manifest 声明过、pack.json 里确实列出的文件；文件名走固定白名单，
 * 解析后的真实路径还必须留在该包的目录里（挡 `..`、反斜杠、符号链接逃逸）。
 * 这里不注册播放器资源，也不改扩展目录。
 * @module dsh-piggy/store/ext-asset-file
 */
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

import {
  ASSET_KEY, MAX_FRAME_BYTES, MAX_FRAME_EDGE, MAX_PACK_JSON_BYTES, MAX_SOUND_BYTES,
  PACK_ID, SINGLE_FILE, SOUND_FILE, declaredAssetPacks, imageSize,
} from './ext-asset-schema.js'

const ACTION_FRAME = /^([a-z][a-z0-9-]{0,47})\/(\d{2})\.(png|webp)$/
const PACK_JSON = 'pack.json'
const TYPES = Object.freeze({
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  webp: 'image/webp',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
})

/** @param {number} status */
function fail(status) {
  return { ok: /** @type {false} */ (false), status }
}

/**
 * 路径段本身是否安全。返回 null 表示拒绝（403），返回数组表示可继续解析。
 * @param {string} kind
 * @param {string} file
 * @returns {string[]|null}
 */
function safeParts(kind, file) {
  if (typeof file !== 'string' || file.length === 0 || file.length > 200) return null
  if (file.includes('\0') || file.includes('\\') || file.includes('?') || file.includes('#')) return null
  const parts = file.split('/')
  if (parts.some(part => part === '' || part === '.' || part === '..')) return null
  if (!parts.every(part => /^[a-z0-9][a-z0-9._-]*$/.test(part))) return null
  if (file === PACK_JSON) return parts
  if (kind === 'actions') {
    if (parts.length === 1 && SINGLE_FILE.test(parts[0])) return parts
    return parts.length === 2 && ASSET_KEY.test(parts[0]) && (/^\d{2}\.(?:png|webp)$/.test(parts[1]) || SINGLE_FILE.test(parts[1])) ? parts : null
  }
  return parts.length === 1 && SOUND_FILE.test(parts[0]) ? parts : null
}

/** @param {string} file */
function typeFor(file) {
  if (file === PACK_JSON) return TYPES.json
  const ext = file.slice(file.lastIndexOf('.') + 1)
  return TYPES[/** @type {keyof typeof TYPES} */ (ext)] ?? null
}

/** @param {string} packDir @param {string} target */
function inside(packDir, target) {
  return target === packDir || target.startsWith(packDir + sep)
}

/**
 * @param {string} root 扩展根目录（.../extensions）
 * @param {{ manifest: any }} entry 已加载扩展（manifest 是声明的唯一来源）
 * @param {string} key
 * @param {string} kind 'actions' | 'sounds'
 * @param {string} pack
 * @param {string} file 相对素材包目录的路径
 * @returns {{ ok: true, body: Buffer, type: string, etag: string, cache: string } | { ok: false, status: number }}
 */
export function readAssetPackFile(root, entry, key, kind, pack, file) {
  if (typeof root !== 'string' || root === '') return fail(404)
  if (kind !== 'actions' && kind !== 'sounds') return fail(404)
  if (!PACK_ID.test(pack) || !ASSET_KEY.test(key)) return fail(404)
  const declared = declaredAssetPacks(entry?.manifest)
  if (declared.problems.length > 0) return fail(404)
  const list = kind === 'actions' ? declared.actions : declared.sounds
  if (!list.includes(pack)) return fail(404)
  const parts = safeParts(kind, file)
  if (parts === null) return fail(403)
  const type = typeFor(file)
  if (type === null) return fail(403)

  const packDir = resolve(root, key, kind, pack)
  const target = resolve(packDir, ...parts)
  if (!inside(packDir, target)) return fail(403)
  try {
    const stat = lstatSync(target)
    if (stat.isSymbolicLink()) return fail(403)
    if (!stat.isFile()) return fail(404)
  } catch { return fail(404) }
  // 目录本身也可能是符号链接：真实路径必须仍在这个扩展目录里，且包目录不是链接。
  let rootReal
  let packReal
  let targetReal
  try {
    const packStat = lstatSync(packDir)
    if (packStat.isSymbolicLink() || !packStat.isDirectory()) return fail(403)
    rootReal = realpathSync(root)
    packReal = realpathSync(packDir)
    targetReal = realpathSync(target)
  } catch { return fail(404) }
  if (!inside(rootReal, packReal) || !inside(packReal, targetReal)) return fail(403)

  let packJson
  try {
    const packStat = lstatSync(join(packDir, PACK_JSON))
    if (!packStat.isFile() || packStat.isSymbolicLink()) return fail(404)
    packJson = JSON.parse(readFileSync(join(packDir, PACK_JSON), 'utf8'))
  } catch { return fail(404) }
  if (packJson === null || typeof packJson !== 'object' || Array.isArray(packJson)) return fail(404)
  if (packJson.pack !== undefined && packJson.pack !== pack) return fail(404)
  const entries = kind === 'actions' ? packJson.actions : packJson.sounds
  if (!Array.isArray(entries) || entries.length === 0) return fail(404)

  if (file !== PACK_JSON) {
    if (kind === 'actions') {
      const match = ACTION_FRAME.exec(file)
      if (match === null) {
        const action = entries.find((/** @type {any} */ item) => {
          if (item === null || typeof item !== 'object' || item.kind !== 'action') return false
          const source = item.source
          if (typeof source === 'string') return source === file
          return source !== null && typeof source === 'object' && source.scheme === 'path' && source.path === file
        })
        if (action === undefined) return fail(404)
      } else {
        const actionKey = match[1]
        const frameIndex = Number(match[2])
        const action = entries.find((/** @type {any} */ item) => item !== null && typeof item === 'object' && item.key === actionKey)
        if (action === undefined || action.kind !== 'action' || action.frames === null
          || typeof action.frames !== 'object' || Array.isArray(action.frames)) return fail(404)
        // durationsMs 直接给出帧数；fps + durationMs 也能反推出安装时校验过的帧数。
        let count = null
        if (Array.isArray(action.frames.durationsMs)) count = action.frames.durationsMs.length
        else if (Number.isInteger(action.frames.fps) && Number.isInteger(action.durationMs) && action.durationMs > 0) {
          count = Math.round(action.durationMs * action.frames.fps / 1000)
        }
        if (count !== null && frameIndex >= count) return fail(404)
      }
    } else {
      const soundKey = file.slice(0, file.lastIndexOf('.'))
      const sound = entries.find((/** @type {any} */ item) => item !== null && typeof item === 'object' && item.key === soundKey && item.file === file)
      if (sound === undefined) return fail(404)
    }
  }

  let body
  try { body = readFileSync(target) } catch { return fail(404) }
  // 安装时已经校验过；这里再做一次轻量内容检查，手动改坏的帧/音频不往外发。
  if (file === PACK_JSON) {
    if (body.length > MAX_PACK_JSON_BYTES) return fail(404)
  } else if (kind === 'actions') {
    const ext = file.slice(file.lastIndexOf('.') + 1)
    const size = imageSize(body, ext)
    if (body.length > MAX_FRAME_BYTES || size === null || size.width <= 0 || size.height <= 0
      || Math.max(size.width, size.height) > MAX_FRAME_EDGE) return fail(404)
  } else {
    const ext = file.slice(file.lastIndexOf('.') + 1)
    const ogg = body.subarray(0, 4).toString('ascii') === 'OggS'
    const wav = body.subarray(0, 4).toString('ascii') === 'RIFF' && body.subarray(8, 12).toString('ascii') === 'WAVE'
    if (body.length > MAX_SOUND_BYTES || (ext === 'ogg' ? !ogg : !wav)) return fail(404)
  }
  const etag = '"' + createHash('sha256').update(body).digest('hex').slice(0, 32) + '"'
  return { ok: true, body, type, etag, cache: 'no-cache' }
}
