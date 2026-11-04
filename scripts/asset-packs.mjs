// @ts-check
/**
 * 动作 / 音效素材包的校验与生成。
 *
 * 人手只写 `assets/actions/<dir>/pack.json`；这里校验字段、引用和预算，
 * 再生成 `src/client/packs.generated.js` 供 `art-path.js` 注册。
 *
 * 目录名只用于组织；包 id 以 pack.json 的 `pack` 为准（默认取目录名）。
 * 这样历史包 `actions` 可以放在 `base/` 下，cache key 与旧版完全一致。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'

import { PIG_ART_ASSETS } from '../packages/pet-core/src/data/art-assets.js'

const PACK_ID = /^[a-z][a-z0-9-]{0,31}$/
const KEY = /^[a-z][a-z0-9-]{0,47}$/
const TRIGGERS = new Set(['pet', 'feed', 'play', 'tap', 'idle', 'manual'])
const ELEGIBILITY_KEYS = new Set(['art', 'stageNot', 'absent', 'react', 'moodNot', 'party'])
const ACTION_FIELDS = new Set(['key', 'kind', 'source', 'durationMs', 'frame', 'eligibility', 'fallback', 'trigger', 'sound', 'motion', 'frames'])
const SOURCE_SCHEMES = new Set(['builtin', 'custom', 'path'])
const MAX_PACK_FILES = 256
const MAX_PACK_BYTES = 6 * 1024 * 1024
const FRAME_FILE = /^(\d{2})\.(png|webp)$/
const MIN_FRAMES = 2
const MAX_FRAMES = 48
const MAX_FRAME_BYTES = 128 * 1024
const MAX_FRAME_EDGE = 512
const MAX_FRAME_MS = 60_000
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** @param {string} path @param {string} label @param {string[]} problems */
function readJson(path, label, problems) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    problems.push(`${label}: 无法解析 JSON（${error instanceof Error ? error.message : String(error)}）`)
    return null
  }
}

/** @param {unknown} value */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** @param {unknown} value @param {Set<string>} allowed @param {string} label @param {string[]} problems */
function onlyFields(value, allowed, label, problems) {
  if (!isRecord(value)) {
    problems.push(`${label}: 必须是对象`)
    return false
  }
  for (const name of Object.keys(value)) {
    if (!allowed.has(name)) problems.push(`${label}.${name}: 不认识的字段`)
  }
  return true
}

/** @param {any} value @param {string} label @param {string[]} problems */
function checkEligibility(value, label, problems) {
  if (value === undefined) return
  if (!onlyFields(value, ELEGIBILITY_KEYS, label, problems)) return
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

/** @param {Buffer} body @param {string} ext @returns {{ width: number, height: number } | null} */
function imageSize(body, ext) {
  if (ext === 'png') {
    if (body.length < 24 || !body.subarray(0, 8).equals(PNG_MAGIC)) return null
    if (body.subarray(12, 16).toString('ascii') !== 'IHDR') return null
    return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) }
  }
  if (body.length < 30
    || body.subarray(0, 4).toString('ascii') !== 'RIFF'
    || body.subarray(8, 12).toString('ascii') !== 'WEBP') return null
  const chunk = body.subarray(12, 16).toString('ascii')
  if (chunk === 'VP8X') {
    return { width: body.readUIntLE(24, 3) + 1, height: body.readUIntLE(27, 3) + 1 }
  }
  if (chunk === 'VP8L') {
    if (body[20] !== 0x2f) return null
    const bits = body.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8 ') {
    if (body[23] !== 0x9d || body[24] !== 0x01 || body[25] !== 0x2a) return null
    return { width: body.readUInt16LE(26) & 0x3fff, height: body.readUInt16LE(28) & 0x3fff }
  }
  return null
}

/**
 * Turn `fps` or `durationsMs` into one integer duration per frame. The
 * cumulative rounding keeps the sum exactly `round(count * 1000 / fps)`, so a
 * 12fps three-frame action is 83+84+83 = 250ms rather than 249 or 251.
 * @param {any} value
 * @param {number} count
 * @param {string} at
 * @param {string[]} problems
 * @returns {{ durations: number[], total: number } | null}
 */
function frameTiming(value, count, at, problems) {
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

/**
 * Validate one frame sequence and return its generated metadata. Files live in
 * `assets/actions/<dir>/<key>/00.png` (or `.webp`); only per-frame content
 * revisions and computed durations are emitted, never authored bounds.
 * @param {any} action
 * @param {string} at
 * @param {string} dir
 * @param {string} dirPath
 * @param {string[]} problems
 * @returns {Array<{ path: string, revision: string, durationMs: number }> | null}
 */
function checkFrames(action, at, dir, dirPath, problems) {
  const frameDir = join(dirPath, action.key)
  if (!existsSync(frameDir) || !statSync(frameDir).isDirectory()) {
    problems.push(`${at}.frames: 找不到帧目录 assets/actions/${dir}/${action.key}`)
    return null
  }
  /** @type {Array<{ name: string, index: number, ext: string }>} */
  const entries = []
  for (const name of readdirSync(frameDir).sort()) {
    const info = statSync(join(frameDir, name))
    if (info.isDirectory()) {
      problems.push(`${at}.frames: 帧目录里不能再有子目录 "${name}"`)
      continue
    }
    const match = FRAME_FILE.exec(name)
    if (match === null) {
      problems.push(`${at}.frames: 不认识的帧文件 "${name}"（应为 00.png …，2 位连续）`)
      continue
    }
    entries.push({ name, index: Number(match[1]), ext: match[2] })
  }
  if (entries.length === 0) {
    problems.push(`${at}.frames: 帧目录里没有 00.png`)
    return null
  }
  if (entries.length < MIN_FRAMES) problems.push(`${at}.frames: 至少需要 ${MIN_FRAMES} 帧，当前只有 ${entries.length} 帧`)
  if (entries.length > MAX_FRAMES) problems.push(`${at}.frames: 最多 ${MAX_FRAMES} 帧，当前有 ${entries.length} 帧`)
  const ext = entries[0].ext
  const timing = frameTiming(action.frames, entries.length, at, problems)
  /** @type {Array<{ path: string, revision: string, durationMs: number }>} */
  const frames = []
  entries.forEach((entry, position) => {
    if (entry.index !== position) {
      problems.push(`${at}.frames: 帧序号必须从 00 连续，缺少 ${String(position).padStart(2, '0')}.${ext}`)
      return
    }
    if (entry.ext !== ext) {
      problems.push(`${at}.frames: ${entry.name} 与 ${entries[0].name} 扩展名不一致，一个动作只能用一种格式`)
      return
    }
    const path = join(frameDir, entry.name)
    const info = statSync(path)
    if (info.size > MAX_FRAME_BYTES) {
      problems.push(`${at}.frames: ${entry.name} 有 ${info.size} B，超过单帧上限 ${MAX_FRAME_BYTES} B`)
      return
    }
    const body = readFileSync(path)
    const size = imageSize(body, entry.ext)
    if (size === null) {
      problems.push(`${at}.frames: ${entry.name} 内容不是有效的 ${entry.ext.toUpperCase()}`)
      return
    }
    if (Math.max(size.width, size.height) > MAX_FRAME_EDGE) {
      problems.push(`${at}.frames: ${entry.name} 是 ${size.width}×${size.height}，长边超过 ${MAX_FRAME_EDGE}`)
      return
    }
    frames.push({
      path: `actions/${dir}/${action.key}/${entry.name}`,
      revision: createHash('sha256').update(body).digest('hex').slice(0, 12),
      durationMs: timing === null ? 0 : timing.durations[position],
    })
  })
  if (timing === null) return null
  if (frames.length !== entries.length) return null
  if (action.durationMs !== timing.total) {
    problems.push(`${at}.durationMs: 是 ${action.durationMs}ms，但 ${entries.length} 帧总时长为 ${timing.total}ms`)
  }
  return frames
}

/**
 * @param {any} action
 * @param {string} label
 * @param {string[]} problems
 * @param {string} dir
 * @param {string} dirPath
 * @returns {{ action: any, frames: Array<{ path: string, revision: string, durationMs: number }> | null } | null}
 */
function checkAction(action, label, problems, dir, dirPath) {
  if (!onlyFields(action, ACTION_FIELDS, label, problems)) return null
  if (typeof action.key !== 'string' || !KEY.test(action.key)) {
    problems.push(`${label}.key: 必须匹配 ^[a-z][a-z0-9-]{0,47}$`)
    return null
  }
  const at = `${label}(${action.key})`
  if (action.kind !== 'action') problems.push(`${at}.kind: 只能是 "action"`)
  if (action.frame !== undefined) {
    problems.push(`${at}.frame: 不要手写取景/命中框；帧序列元数据由生成器计算`)
  }
  if (!Number.isInteger(action.durationMs) || action.durationMs <= 0) {
    problems.push(`${at}.durationMs: 必须是正整数毫秒`)
  }
  const hasFrames = action.frames !== undefined
  if (hasFrames && action.source !== undefined) {
    problems.push(`${at}: source 与 frames 只能二选一`)
  }
  if (hasFrames && action.motion !== undefined) {
    problems.push(`${at}: motion 与 frames 只能二选一`)
  }
  if (!hasFrames && action.source === undefined) {
    problems.push(`${at}: 需要 source（单图）或 frames（帧序列）`)
  }
  if (!hasFrames) {
    if (!isRecord(action.source)) {
      problems.push(`${at}.source: 必须是对象`)
    } else {
      onlyFields(action.source, new Set(['scheme', 'key', 'path']), `${at}.source`, problems)
      if (!SOURCE_SCHEMES.has(action.source.scheme)) {
        problems.push(`${at}.source.scheme: 只能是 builtin / custom / path`)
      } else if (action.source.scheme === 'builtin') {
        if (typeof action.source.key !== 'string' || !Object.hasOwn(PIG_ART_ASSETS, action.source.key)) {
          problems.push(`${at}.source.key: 内置素材表里没有 "${action.source.key}"`)
        }
      } else if (action.source.scheme === 'path') {
        const path = action.source.path
        if (typeof path !== 'string' || path.startsWith('/') || path.includes('..') || path.includes('\\')
          || path.includes('?') || path.includes('#') || !/\.(?:png|webp|svg)$/.test(path)) {
          problems.push(`${at}.source.path: 必须是安全的相对图片路径`)
        }
      } else if (typeof action.source.key !== 'string' || !/^custom-[a-z0-9-]{1,41}$/.test(action.source.key)) {
        problems.push(`${at}.source.key: custom key 必须匹配 custom-<短名>`)
      }
    }
  }
  /** @type {Array<{ path: string, revision: string, durationMs: number }> | null} */
  let frames = null
  if (hasFrames) frames = checkFrames(action, at, dir, dirPath, problems)
  checkEligibility(action.eligibility, `${at}.eligibility`, problems)
  if (action.trigger !== undefined) {
    if (!onlyFields(action.trigger, new Set(['on']), `${at}.trigger`, problems)) {
      // 已记录字段错误
    } else if (!TRIGGERS.has(action.trigger.on)) {
      problems.push(`${at}.trigger.on: 只能是 ${[...TRIGGERS].join(' / ')}`)
    }
  }
  if (action.sound !== undefined && (typeof action.sound !== 'string' || !/^[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(action.sound))) {
    problems.push(`${at}.sound: 必须是 sfx/<key> 或同包 <key>`)
  }
  if (action.motion !== undefined && (typeof action.motion !== 'string' || !/^dp-[a-z0-9-]+$/.test(action.motion))) {
    problems.push(`${at}.motion: 必须引用已有 dp-* 动效名`)
  }
  if (action.fallback !== undefined && !isRecord(action.fallback) && typeof action.fallback !== 'string') {
    problems.push(`${at}.fallback: 必须是字符串或引用对象`)
  }
  return { action, frames }
}

/**
 * 读取并校验所有动作包。
 * @param {string} root 仓库根目录
 * @param {{ only?: string }} [options]
 * @returns {{ packs: any[], triggers: Record<string, any>, problems: string[] }}
 */
export function loadActionPacks(root, options = {}) {
  /** @type {string[]} */
  const problems = []
  /** @type {any[]} */
  const packs = []
  /** @type {Record<string, any>} */
  const triggers = {}
  const base = join(root, 'assets/actions')
  const seenPackIds = new Set()
  const seenKeys = new Map()
  if (!existsSync(base)) return { packs, triggers, problems: ['assets/actions: 目录不存在'] }
  for (const dir of readdirSync(base).sort()) {
    if (dir.startsWith('_') || dir.startsWith('.')) continue
    const dirPath = join(base, dir)
    if (!statSync(dirPath).isDirectory()) continue
    const manifestPath = join(dirPath, 'pack.json')
    if (!existsSync(manifestPath)) {
      problems.push(`${relative(root, manifestPath)}: 缺少 pack.json`)
      continue
    }
    const manifest = readJson(manifestPath, relative(root, manifestPath), problems)
    if (manifest === null) continue
    if (!onlyFields(manifest, new Set(['pack', 'revision', 'actions']), relative(root, manifestPath), problems)) continue
    const packId = manifest.pack ?? dir
    if (options.only !== undefined && options.only !== dir && options.only !== packId) continue
    if (typeof packId !== 'string' || !PACK_ID.test(packId)) {
      problems.push(`${relative(root, manifestPath)}.pack: 必须匹配 ^[a-z][a-z0-9-]{0,31}$`)
      continue
    }
    if (seenPackIds.has(packId)) problems.push(`${relative(root, manifestPath)}.pack: 包 id "${packId}" 重复`)
    seenPackIds.add(packId)
    const revision = manifest.revision ?? 1
    if (!(typeof revision === 'string' ? /^[A-Za-z0-9._-]{1,128}$/.test(revision) : Number.isInteger(revision) && revision >= 0)) {
      problems.push(`${relative(root, manifestPath)}.revision: 必须是字符串或非负整数`)
    }
    if (!Array.isArray(manifest.actions) || manifest.actions.length === 0) {
      problems.push(`${relative(root, manifestPath)}.actions: 至少要有一个动作`)
      continue
    }
    /** @type {any[]} */
    const resources = []
    manifest.actions.forEach((/** @type {any} */ action, /** @type {number} */ index) => {
      const label = `${relative(root, manifestPath)} actions[${index}]`
      const checked = checkAction(action, label, problems, dir, dirPath)
      if (checked === null) return
      const declared = checked.action
      const handle = `${packId}/${declared.key}`
      if (seenKeys.has(handle)) problems.push(`${label}.key: 动作 "${handle}" 重复`)
      seenKeys.set(handle, true)
      /** @type {any} */
      const resource = {
        key: declared.key,
        kind: 'action',
        duration: declared.durationMs,
      }
      if (checked.frames === null) resource.source = declared.source
      else resource.frames = checked.frames
      if (declared.eligibility !== undefined) resource.eligibility = declared.eligibility
      if (declared.fallback !== undefined) resource.fallback = declared.fallback
      if (declared.sound !== undefined) resource.sound = declared.sound
      resources.push(resource)
      if (declared.trigger !== undefined) triggers[`${packId}/${declared.key}`] = Object.freeze({ ...declared.trigger })
    })
    packs.push({ namespace: 'dsh-piggy', pack: packId, revision, resources })
    // 体积预算：只算 pack 目录里的普通文件。
    let files = 0
    let bytes = 0
    const walk = (/** @type {string} */ dir2) => {
      for (const name of readdirSync(dir2)) {
        const path = join(dir2, name)
        const info = statSync(path)
        if (info.isDirectory()) walk(path)
        else { files += 1; bytes += info.size }
      }
    }
    walk(dirPath)
    if (files > MAX_PACK_FILES) problems.push(`${relative(root, dirPath)}: ${files} 个文件，超过上限 ${MAX_PACK_FILES}`)
    if (bytes > MAX_PACK_BYTES) problems.push(`${relative(root, dirPath)}: ${Math.round(bytes / 1024)}KB，超过上限 6MB`)
  }
  return { packs, triggers, problems }
}

/**
 * 生成 `src/client/packs.generated.js` 的文本。
 * @param {string} root
 * @returns {string}
 */
export function buildAssetPacks(root) {
  const { packs, triggers, problems } = loadActionPacks(root)
  if (problems.length > 0) throw new Error('asset packs are invalid:\n' + problems.join('\n'))
  return [
    '// @ts-check',
    '/**',
    ' * 由 scripts/build-asset-packs.mjs 从 assets/actions 下各包的 pack.json 生成，勿手改。',
    ' * 新增动作只需改 pack.json；这里由 `npm run build` 或 `npm run assets:sync` 更新。',
    ' * @module dsh-piggy/client/packs.generated',
    ' */',
    "  /** @type {ReadonlyArray<import('./art-resources.js').ArtResourcePackInput>} */",
    `export const ACTION_PACKS = Object.freeze(${JSON.stringify(packs, null, 2)})`,
    `export const ACTION_TRIGGERS = Object.freeze(${JSON.stringify(triggers, null, 2)})`,
    '',
  ].join('\n')
}

/**
 * 校验并把问题格式化成可直接定位的文本。
 * @param {string} root
 * @param {{ only?: string, generatedPath?: string, generatedSoundPath?: string }} [options]
 * @returns {string[]}
 */
export function checkAssets(root, options = {}) {
  const { problems } = loadActionPacks(root, { only: options.only })
  const { problems: soundProblems } = loadSoundPacks(root)
  const out = [...problems, ...soundProblems]
  if (options.generatedPath !== undefined && problems.length === 0 && options.only === undefined) {
    if (!existsSync(options.generatedPath)) {
      out.push(`${relative(root, options.generatedPath)}: 尚未生成；运行 npm run assets:sync`)
    } else {
      const expected = buildAssetPacks(root)
      const actual = readFileSync(options.generatedPath, 'utf8')
      if (actual !== expected) out.push(`${relative(root, options.generatedPath)}: 已过期；运行 npm run assets:sync`)
    }
  }
  if (options.generatedSoundPath !== undefined && soundProblems.length === 0) {
    if (!existsSync(options.generatedSoundPath)) {
      out.push(`${relative(root, options.generatedSoundPath)}: 尚未生成；运行 npm run assets:sync`)
    } else {
      const expected = buildSoundPacks(root)
      const actual = readFileSync(options.generatedSoundPath, 'utf8')
      if (actual !== expected) out.push(`${relative(root, options.generatedSoundPath)}: 已过期；运行 npm run assets:sync`)
    }
  }
  return out
}

const TONE_TYPES = new Set(['sine', 'triangle', 'sawtooth', 'square'])
const FILTER_TYPES = new Set(['lowpass', 'highpass', 'bandpass'])
const SOUND_FIELDS = new Set(['key', 'synth', 'file', 'durationMs', 'codec', 'gain', 'debounceMs', 'priority', 'maxVoices', 'loop', 'fallback'])
const SYNTH_FIELDS = new Set(['tones', 'noise'])

/** @param {any} value @param {string} label @param {number} min @param {number} max @param {string[]} problems */
function inRange(value, label, min, max, problems) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    problems.push(`${label}: 必须在 ${min}–${max} 之间`)
    return false
  }
  return true
}

/** @param {any} synth @param {string} label @param {string[]} problems */
function checkSynth(synth, label, problems) {
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
 * 读取并校验所有音效包。M2a 只接受 `synth`；音频文件留给 M2b。
 * @param {string} root
 * @returns {{ recipes: Record<string, any>, files: Record<string, any>, problems: string[] }}
 */
export function loadSoundPacks(root) {
  /** @type {string[]} */
  const problems = []
  /** @type {Record<string, any>} */
  const recipes = {}
  /** @type {Record<string, any>} */
  const files = {}
  const base = join(root, 'assets/sounds')
  if (!existsSync(base)) return { recipes, files, problems: ['assets/sounds: 目录不存在'] }
  const seen = new Set()
  for (const dir of readdirSync(base).sort()) {
    if (dir.startsWith('_') || dir.startsWith('.')) continue
    const dirPath = join(base, dir)
    if (!statSync(dirPath).isDirectory()) continue
    const manifestPath = join(dirPath, 'pack.json')
    if (!existsSync(manifestPath)) {
      problems.push(`${relative(root, manifestPath)}: 缺少 pack.json`)
      continue
    }
    const manifest = readJson(manifestPath, relative(root, manifestPath), problems)
    if (manifest === null) continue
    if (!onlyFields(manifest, new Set(['pack', 'revision', 'sounds']), relative(root, manifestPath), problems)) continue
    if (!Array.isArray(manifest.sounds) || manifest.sounds.length === 0) {
      problems.push(`${relative(root, manifestPath)}.sounds: 至少要有一个音效`)
      continue
    }
    manifest.sounds.forEach((/** @type {any} */ sound, /** @type {number} */ index) => {
      const label = `${relative(root, manifestPath)} sounds[${index}]`
      if (!onlyFields(sound, SOUND_FIELDS, label, problems)) return
      if (typeof sound.key !== 'string' || !KEY.test(sound.key)) {
        problems.push(`${label}.key: 必须匹配 ^[a-z][a-z0-9-]{0,47}$`)
        return
      }
      const at = `${label}(${sound.key})`
      if (seen.has(sound.key)) problems.push(`${at}.key: 音效 "${sound.key}" 重复`)
      seen.add(sound.key)
      if (sound.file !== undefined) {
        const entry = checkSoundFile(join(dirPath, sound.file), dir, sound, at, problems)
        if (entry !== null) files[sound.key] = entry
      } else if (sound.synth === undefined) {
        problems.push(`${at}: 需要 synth 或 file`)
      } else {
        checkSynth(sound.synth, `${at}.synth`, problems)
        recipes[sound.key] = sound.synth
      }
      if (sound.gain !== undefined) inRange(sound.gain, `${at}.gain`, 0, 1, problems)
      if (sound.debounceMs !== undefined) inRange(sound.debounceMs, `${at}.debounceMs`, 0, 2000, problems)
      if (sound.priority !== undefined) inRange(sound.priority, `${at}.priority`, 0, 100, problems)
      if (sound.maxVoices !== undefined) inRange(sound.maxVoices, `${at}.maxVoices`, 1, 2, problems)
      if (sound.loop !== undefined && typeof sound.loop !== 'boolean') problems.push(`${at}.loop: 必须是布尔值`)
      if (sound.fallback !== undefined && (typeof sound.fallback !== 'string' || !/^(?:synth:)?[a-z][a-z0-9-]{0,47}$/.test(sound.fallback))) {
        problems.push(`${at}.fallback: 必须是 key 或 synth:<key>`)
      }
    })
  }
  return { recipes, files, problems }
}

const MAX_SOUND_BYTES = 30 * 1024
const AUDIO_EXTENSIONS = new Set(['ogg', 'wav'])

/**
 * 校验一个音频文件：扩展名、大小、magic、时长字段。
 * 返回运行时要用的 URL 与内容哈希（用于缓存失效）。
 * @param {string} path
 * @param {string} packDir
 * @param {any} sound
 * @param {string} at
 * @param {string[]} problems
 * @returns {{ url: string, bytes: number, revision: string, durationMs: number, gain?: number, debounceMs?: number, maxVoices?: number, fallback?: string } | null}
 */
function checkSoundFile(path, packDir, sound, at, problems) {
  const file = sound.file
  if (typeof file !== 'string' || !/^[a-z][a-z0-9-]{0,47}\.(?:ogg|wav)$/.test(file)) {
    problems.push(`${at}.file: 必须是 <key>.ogg 或 <key>.wav`)
    return null
  }
  if (!Number.isInteger(sound.durationMs) || sound.durationMs < 20 || sound.durationMs > 1500) {
    problems.push(`${at}.durationMs: 文件音效必须写 20–1500 的整数毫秒`)
    return null
  }
  if (!existsSync(path)) {
    problems.push(`${at}.file: 找不到 assets/sounds/${packDir}/${file}`)
    return null
  }
  const info = statSync(path)
  if (info.size > MAX_SOUND_BYTES) {
    problems.push(`${at}.file: ${info.size} B，超过上限 ${MAX_SOUND_BYTES} B（建议 Opus ≤1.5s）`)
    return null
  }
  const body = readFileSync(path)
  const ext = file.slice(file.lastIndexOf('.') + 1)
  const ogg = body.subarray(0, 4).toString('ascii') === 'OggS'
  const wav = body.subarray(0, 4).toString('ascii') === 'RIFF' && body.subarray(8, 12).toString('ascii') === 'WAVE'
  if ((ext === 'ogg' && !ogg) || (ext === 'wav' && !wav)) {
    problems.push(`${at}.file: 内容不是有效的 ${ext.toUpperCase()} 音频`)
    return null
  }
  const revision = createHash('sha256').update(body).digest('hex').slice(0, 12)
  /** @type {any} */
  const entry = {
    url: `sounds/${packDir}/${file}?v=${revision}`,
    bytes: info.size,
    revision,
    durationMs: sound.durationMs,
  }
  if (sound.gain !== undefined) entry.gain = sound.gain
  if (sound.debounceMs !== undefined) entry.debounceMs = sound.debounceMs
  if (sound.maxVoices !== undefined) entry.maxVoices = sound.maxVoices
  if (sound.fallback !== undefined) entry.fallback = sound.fallback
  return entry
}

/**
 * 生成 `src/client/sounds.generated.js` 的文本。
 * @param {string} root
 * @returns {string}
 */
export function buildSoundPacks(root) {
  const { recipes, files, problems } = loadSoundPacks(root)
  if (problems.length > 0) throw new Error('sound packs are invalid:\n' + problems.join('\n'))
  return [
    '// @ts-check',
    '/**',
    ' * 由 scripts/build-asset-packs.mjs 从 assets/sounds 下各包的 pack.json 生成，勿手改。',
    ' * synth 是程序合成回退；file 是可选音频文件（相对 /dsh-piggy/art/）。',
    ' * @module dsh-piggy/client/sounds.generated',
    ' */',
    "  /** @type {Record<string, { tones: Array<{ type: string, from: number, to: number, ms: number, gain: number, delay?: number, sweep?: string }>, noise?: { from: number, to: number, ms: number, gain: number, type?: string } }>} */",
    `export const SOUND_RECIPES = Object.freeze(${JSON.stringify(recipes, null, 2)})`,
    "  /** @type {Record<string, { url: string, bytes: number, revision: string, durationMs: number, gain?: number, debounceMs?: number, maxVoices?: number, fallback?: string }>} */",
    `export const SOUND_FILES = Object.freeze(${JSON.stringify(files, null, 2)})`,
    '',
  ].join('\n')
}
