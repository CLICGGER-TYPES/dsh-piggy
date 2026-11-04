// @ts-check
/**
 * 第三方素材包（actions / sounds）的声明、路径白名单与安装前校验。
 *
 * 设计见 docs/design/asset-packs-m3.md。这里只做“能不能装”和“装进来是什么”：
 * 不注册运行时资源、不读播放器、不碰扩展存档。扩展目录里的布局沿用第一方：
 *
 *   actions/<pack>/pack.json
 *   actions/<pack>/<action>/00.png …
 *   sounds/<pack>/pack.json
 *   sounds/<pack>/<sound>.ogg|wav
 *
 * 命名空间由扩展 key 推导为 `ext-<key>`，不信任 pack.json 里的任何 namespace 字段；
 * 音效对外 id 是 `ext-<key>/<sound>`，因此不会覆盖第一方 `dsh-piggy` 或内置音效。
 *
 * 本文件只放常量、路径和 schema 基础校验；安装流程在 ext-asset-validate.js，
 * 已安装摘要 ext-asset-summary.js。ext-asset-packs.js 是稳定入口。
 * @module dsh-piggy/store/ext-asset-schema
 */
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const MAX_PACK_FILES = 256
export const MAX_PACK_BYTES = 6 * 1024 * 1024
export const MAX_EXTENSION_PACK_FILES = 384
export const MAX_EXTENSION_PACK_BYTES = 8 * 1024 * 1024
export const MAX_ACTIONS_PER_PACK = 64
export const MAX_SOUNDS_PER_PACK = 64
export const MAX_PACK_JSON_BYTES = 512 * 1024
export const MIN_FRAMES = 2
export const MAX_FRAMES = 48
export const MAX_FRAME_BYTES = 128 * 1024
export const MAX_FRAME_EDGE = 512
export const MAX_ACTION_MS = 10_000
export const MAX_FRAME_MS = 60_000
export const MAX_SOUND_BYTES = 30 * 1024
export const MAX_SOUND_MS = 1500

export const PACK_ID = /^[a-z][a-z0-9-]{0,31}$/
export const ASSET_KEY = /^[a-z][a-z0-9-]{0,47}$/
/** 素材包在宿主里的只读基址；key/pack 都已被 schema 限制为小写安全字符。 */
export function assetPackBase(key, kind, pack) {
  return `/dsh-piggy/ext/${key}/${kind}/${pack}/`
}
export const FRAME_FILE = /^(\d{2})\.(png|webp)$/
export const SOUND_FILE = /^([a-z][a-z0-9-]{0,47})\.(ogg|wav)$/
export const SOUND_REF = /^(?:[a-z][a-z0-9-]{0,31}\/)?[a-z][a-z0-9-]{0,47}$/
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
export const ACTION_FIELDS = new Set(['key', 'kind', 'source', 'durationMs', 'frame', 'eligibility', 'fallback', 'trigger', 'sound', 'motion', 'frames'])
export const SOUND_FIELDS = new Set(['key', 'synth', 'file', 'durationMs', 'codec', 'gain', 'debounceMs', 'priority', 'maxVoices', 'loop', 'fallback'])
export const SYNTH_FIELDS = new Set(['tones', 'noise'])
export const ELIGIBILITY_KEYS = new Set(['art', 'stageNot', 'absent', 'react', 'moodNot', 'party'])
export const TRIGGERS = new Set(['pet', 'feed', 'play', 'tap', 'idle', 'manual'])
export const TONE_TYPES = new Set(['sine', 'triangle', 'sawtooth', 'square'])
export const FILTER_TYPES = new Set(['lowpass', 'highpass', 'bandpass'])

/** @param {unknown} value */
export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** @param {unknown} value @param {string} label @param {string[]} problems */
export function onlyFields(value, allowed, label, problems) {
  if (!isRecord(value)) {
    problems.push(`${label}: 必须是对象`)
    return false
  }
  for (const name of Object.keys(value)) {
    if (!allowed.has(name)) problems.push(`${label}.${name}: 不认识的字段`)
  }
  return true
}

/** @param {any} value @param {string} label @param {number} min @param {number} max @param {string[]} problems */
export function inRange(value, label, min, max, problems) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    problems.push(`${label}: 必须在 ${min}–${max} 之间`)
    return false
  }
  return true
}

/** @param {unknown} value @param {string} label @param {string[]} problems @returns {any} */
export function readJson(value, label, problems) {
  try {
    return JSON.parse(String(value))
  } catch (error) {
    problems.push(`${label}: 无法解析 JSON（${error instanceof Error ? error.message : String(error)}）`)
    return null
  }
}

/**
 * 扩展包里允许出现的素材文件路径。脚本、HTML、SVG、外链和任意其它文件都不匹配。
 * @param {string} name
 */
export function isAssetPackPath(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 200) return false
  const parts = name.split('/')
  if (parts.length === 3 && parts[0] === 'sounds') {
    return PACK_ID.test(parts[1]) && (parts[2] === 'pack.json' || SOUND_FILE.test(parts[2]))
  }
  if (parts.length === 3 && parts[0] === 'actions') {
    return PACK_ID.test(parts[1]) && parts[2] === 'pack.json'
  }
  if (parts.length === 4 && parts[0] === 'actions') {
    return PACK_ID.test(parts[1]) && ASSET_KEY.test(parts[2]) && FRAME_FILE.test(parts[3])
  }
  return false
}

/**
 * 路径本身是否安全（不依赖它在扩展目录里的用途）。检查逃逸、绝对路径、反斜杠、
 * 大小写混用和不可见字符；大小写冲突由调用方再按整包去重。
 * @param {string} name
 * @param {string[]} problems
 */
export function checkPathName(name, problems) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 200) {
    problems.push(`文件路径无效：${String(name)}`)
    return false
  }
  if (name.startsWith('/') || name.includes('\\') || name.includes('\0') || name.includes('?') || name.includes('#')) {
    problems.push(`文件路径不能是绝对路径或外链：${name}`)
    return false
  }
  if (/^[A-Za-z]:/.test(name)) {
    problems.push(`文件路径不能带盘符：${name}`)
    return false
  }
  const parts = name.split('/')
  if (parts.some(part => part === '' || part === '.' || part === '..')) {
    problems.push(`文件路径不能包含空段、. 或 ..：${name}`)
    return false
  }
  if (!/^[a-z0-9][a-z0-9._/-]*$/.test(name)) {
    problems.push(`文件路径只能用小写字母、数字、点、下划线、横线和斜杠：${name}`)
    return false
  }
  return true
}

/** @param {Buffer} body @param {string} ext @returns {{ width: number, height: number } | null} */
export function imageSize(body, ext) {
  if (ext === 'png') {
    if (body.length < 24 || !body.subarray(0, 8).equals(PNG_MAGIC)) return null
    if (body.subarray(12, 16).toString('ascii') !== 'IHDR') return null
    return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) }
  }
  if (ext === 'webp') {
    if (body.length < 30
      || body.subarray(0, 4).toString('ascii') !== 'RIFF'
      || body.subarray(8, 12).toString('ascii') !== 'WEBP') return null
    const chunk = body.subarray(12, 16).toString('ascii')
    if (chunk === 'VP8X') return { width: body.readUIntLE(24, 3) + 1, height: body.readUIntLE(27, 3) + 1 }
    if (chunk === 'VP8L') {
      if (body[20] !== 0x2f) return null
      const bits = body.readUInt32LE(21)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    if (chunk === 'VP8 ') {
      if (body[23] !== 0x9d || body[24] !== 0x01 || body[25] !== 0x2a) return null
      return { width: body.readUInt16LE(26) & 0x3fff, height: body.readUInt16LE(28) & 0x3fff }
    }
  }
  return null
}

/**
 * manifest.assetPacks 的声明。缺省 = 这个扩展没有素材包；写了就必须是
 * `{ actions?: string[], sounds?: string[] }`，未知字段和重复名字直接拒绝。
 * @param {any} manifest
 * @returns {{ actions: string[], sounds: string[], problems: string[] }}
 */
export function declaredAssetPacks(manifest) {
  const problems = []
  /** @type {string[]} */
  const actions = []
  /** @type {string[]} */
  const sounds = []
  const value = manifest?.assetPacks
  if (value === undefined) return { actions, sounds, problems }
  if (!isRecord(value)) {
    problems.push('manifest.assetPacks 必须是对象')
    return { actions, sounds, problems }
  }
  for (const name of Object.keys(value)) {
    if (name !== 'actions' && name !== 'sounds') problems.push(`manifest.assetPacks.${name}: 不认识的字段`)
  }
  for (const kind of ['actions', 'sounds']) {
    const list = value[kind]
    if (list === undefined) continue
    if (!Array.isArray(list)) {
      problems.push(`manifest.assetPacks.${kind}: 必须是数组`)
      continue
    }
    const seen = new Set()
    for (const [index, pack] of list.entries()) {
      const label = `manifest.assetPacks.${kind}[${index}]`
      if (typeof pack !== 'string' || !PACK_ID.test(pack)) {
        problems.push(`${label}: 必须是 ${PACK_ID} 的包名`)
        continue
      }
      if (seen.has(pack)) {
        problems.push(`${label}: 包名 ${pack} 重复`)
        continue
      }
      seen.add(pack)
      if (kind === 'actions') actions.push(pack)
      else sounds.push(pack)
    }
  }
  return { actions, sounds, problems }
}

/** @param {any} value @param {number} count @param {string} at @param {string[]} problems */
export function frameTiming(value, count, at, problems) {
  if (!onlyFields(value, new Set(['fps', 'durationsMs']), `${at}.frames`, problems)) return null
  const hasFps = value.fps !== undefined
  const hasDurations = value.durationsMs !== undefined
  if (hasFps === hasDurations) {
    problems.push(`${at}.frames: 需要 fps 或 durationsMs 之一（不能同时写）`)
    return null
  }
  if (hasFps) {
    if (!Number.isInteger(value.fps) || value.fps < 1 || value.fps > 60) {
      problems.push(`${at}.frames.fps: 必须是 1–60 的整数`)
      return null
    }
    /** @type {number[]} */
    const durations = []
    let previous = 0
    for (let index = 0; index < count; index += 1) {
      const boundary = Math.round((index + 1) * 1000 / value.fps)
      durations.push(boundary - previous)
      previous = boundary
    }
    return { durations, total: previous }
  }
  if (!Array.isArray(value.durationsMs)) {
    problems.push(`${at}.frames.durationsMs: 必须是数组`)
    return null
  }
  if (value.durationsMs.length !== count) {
    problems.push(`${at}.frames.durationsMs: 有 ${value.durationsMs.length} 项，但帧文件有 ${count} 张`)
    return null
  }
  /** @type {number[]} */
  const durations = []
  let total = 0
  value.durationsMs.forEach((/** @type {any} */ ms, /** @type {number} */ index) => {
    if (!Number.isInteger(ms) || ms <= 0 || ms > MAX_FRAME_MS) {
      problems.push(`${at}.frames.durationsMs[${index}]: 必须是 1–${MAX_FRAME_MS} 的整数毫秒`)
      return
    }
    durations.push(ms)
    total += ms
  })
  return durations.length === count ? { durations, total } : null
}

/** @param {any} value @param {string} label @param {string[]} problems */
export function checkEligibility(value, label, problems) {
  if (value === undefined) return
  if (!onlyFields(value, ELIGIBILITY_KEYS, label, problems)) return
  if (value.art !== undefined && (typeof value.art !== 'string' || !/^[a-z0-9-]{1,64}$/.test(value.art))) {
    problems.push(`${label}.art: 必须是小写短名`)
  }
  for (const name of ['stageNot', 'absent', 'react', 'moodNot']) {
    if (value[name] === undefined) continue
    if (!Array.isArray(value[name])) {
      problems.push(`${label}.${name}: 必须是数组`)
      continue
    }
    for (const item of value[name]) {
      if (typeof item !== 'string' || !/^[a-z0-9-]{0,64}$/.test(item)) problems.push(`${label}.${name}: 含非法项`)
    }
  }
  if (value.party !== undefined && typeof value.party !== 'boolean') problems.push(`${label}.party: 必须是布尔值`)
}

/** @param {any} synth @param {string} label @param {string[]} problems */
export function checkSynth(synth, label, problems) {
  if (!onlyFields(synth, SYNTH_FIELDS, label, problems)) return
  if (!Array.isArray(synth.tones)) {
    problems.push(`${label}.tones: 必须是数组`)
  } else {
    synth.tones.forEach((/** @type {any} */ tone, /** @type {number} */ index) => {
      const at = `${label}.tones[${index}]`
      if (!onlyFields(tone, new Set(['type', 'from', 'to', 'ms', 'gain', 'delay', 'sweep']), at, problems)) return
      if (!TONE_TYPES.has(tone.type)) problems.push(`${at}.type: 只能是 ${[...TONE_TYPES].join(' / ')}`)
      inRange(tone.from, `${at}.from`, 20, 20000, problems)
      inRange(tone.to, `${at}.to`, 20, 20000, problems)
      inRange(tone.ms, `${at}.ms`, 10, 5000, problems)
      inRange(tone.gain, `${at}.gain`, 0, 1, problems)
      if (tone.delay !== undefined) inRange(tone.delay, `${at}.delay`, 0, 5000, problems)
      if (tone.sweep !== undefined && typeof tone.sweep !== 'string') problems.push(`${at}.sweep: 必须是字符串`)
    })
  }
  if (synth.noise !== undefined) {
    const noise = synth.noise
    if (!onlyFields(noise, new Set(['from', 'to', 'ms', 'gain', 'type']), `${label}.noise`, problems)) return
    inRange(noise.from, `${label}.noise.from`, 20, 20000, problems)
    inRange(noise.to, `${label}.noise.to`, 20, 20000, problems)
    inRange(noise.ms, `${label}.noise.ms`, 10, 5000, problems)
    inRange(noise.gain, `${label}.noise.gain`, 0, 1, problems)
    if (noise.type !== undefined && !FILTER_TYPES.has(noise.type)) problems.push(`${label}.noise.type: 只能是 ${[...FILTER_TYPES].join(' / ')}`)
  }
}

/**
 * 校验一个动作目录里的帧文件，返回帧总时长和字节数。
 * @param {Map<string, Buffer>} frames
 * @param {string} at
 * @param {string[]} problems
 * @returns {{ count: number, bytes: number, ext: string } | null}
 */
export function checkFrameFiles(frames, at, problems) {
  if (frames.size < MIN_FRAMES) problems.push(`${at}.frames: 至少需要 ${MIN_FRAMES} 帧，当前只有 ${frames.size} 帧`)
  if (frames.size > MAX_FRAMES) problems.push(`${at}.frames: 最多 ${MAX_FRAMES} 帧，当前有 ${frames.size} 帧`)
  /** @type {Array<{ index: number, ext: string, name: string, body: Buffer }>} */
  const entries = []
  for (const [name, body] of frames) {
    const match = FRAME_FILE.exec(name)
    if (match === null) {
      problems.push(`${at}.frames: 不认识的文件 ${name}（应为 00.png …，2 位连续）`)
      continue
    }
    entries.push({ index: Number(match[1]), ext: match[2], name, body })
  }
  entries.sort((a, b) => a.index - b.index)
  if (entries.length === 0) {
    problems.push(`${at}.frames: 没有帧文件`)
    return null
  }
  const ext = entries[0].ext
  let bytes = 0
  entries.forEach((entry, position) => {
    if (entry.index !== position) problems.push(`${at}.frames: 帧序号必须从 00 连续，缺少 ${String(position).padStart(2, '0')}.${ext}`)
    if (entry.ext !== ext) problems.push(`${at}.frames: ${entry.name} 与 ${entries[0].name} 扩展名不一致，一个动作只能用一种格式`)
    if (entry.body.length > MAX_FRAME_BYTES) problems.push(`${at}.frames: ${entry.name} 有 ${entry.body.length} B，超过单帧上限 ${MAX_FRAME_BYTES} B`)
    const size = imageSize(entry.body, entry.ext)
    if (size === null || size.width <= 0 || size.height <= 0) {
      problems.push(`${at}.frames: ${entry.name} 内容不是有效的 ${entry.ext.toUpperCase()}`)
    } else if (Math.max(size.width, size.height) > MAX_FRAME_EDGE) {
      problems.push(`${at}.frames: ${entry.name} 是 ${size.width}×${size.height}，长边超过 ${MAX_FRAME_EDGE}`)
    }
    bytes += entry.body.length
  })
  return { count: entries.length, bytes, ext }
}

