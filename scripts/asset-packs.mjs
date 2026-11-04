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

/** @param {any} action @param {string} label @param {string[]} problems */
function checkAction(action, label, problems) {
  if (!onlyFields(action, ACTION_FIELDS, label, problems)) return null
  if (typeof action.key !== 'string' || !KEY.test(action.key)) {
    problems.push(`${label}.key: 必须匹配 ^[a-z][a-z0-9-]{0,47}$`)
    return null
  }
  const at = `${label}(${action.key})`
  if (action.kind !== 'action') problems.push(`${at}.kind: 只能是 "action"`)
  if (action.frames !== undefined || action.frame !== undefined) {
    problems.push(`${at}.frames: 帧序列尚未接入（M2）；当前只支持单图动作`)
  }
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
  if (!Number.isInteger(action.durationMs) || action.durationMs <= 0) {
    problems.push(`${at}.durationMs: 必须是正整数毫秒`)
  }
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
  return action
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
      const checked = checkAction(action, label, problems)
      if (checked === null) return
      const handle = `${packId}/${checked.key}`
      if (seenKeys.has(handle)) problems.push(`${label}.key: 动作 "${handle}" 重复`)
      seenKeys.set(handle, true)
      /** @type {any} */
      const resource = {
        key: checked.key,
        kind: 'action',
        source: checked.source,
        duration: checked.durationMs,
      }
      if (checked.eligibility !== undefined) resource.eligibility = checked.eligibility
      if (checked.fallback !== undefined) resource.fallback = checked.fallback
      resources.push(resource)
      if (checked.trigger !== undefined) triggers[`${packId}/${checked.key}`] = Object.freeze({ ...checked.trigger })
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
const SOUND_FIELDS = new Set(['key', 'synth', 'file', 'gain', 'debounceMs', 'priority', 'maxVoices', 'loop', 'fallback'])
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
 * @returns {{ recipes: Record<string, any>, problems: string[] }}
 */
export function loadSoundPacks(root) {
  /** @type {string[]} */
  const problems = []
  /** @type {Record<string, any>} */
  const recipes = {}
  const base = join(root, 'assets/sounds')
  if (!existsSync(base)) return { recipes, problems: ['assets/sounds: 目录不存在'] }
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
        problems.push(`${at}.file: 音频文件尚未接入（M2b）；当前请用 synth`)
      } else if (sound.synth === undefined) {
        problems.push(`${at}: 需要 synth（或 M2b 的 file）`)
      } else {
        checkSynth(sound.synth, `${at}.synth`, problems)
        recipes[sound.key] = sound.synth
      }
      if (sound.gain !== undefined) inRange(sound.gain, `${at}.gain`, 0, 1, problems)
      if (sound.debounceMs !== undefined) inRange(sound.debounceMs, `${at}.debounceMs`, 0, 2000, problems)
      if (sound.priority !== undefined) inRange(sound.priority, `${at}.priority`, 0, 100, problems)
      if (sound.maxVoices !== undefined) inRange(sound.maxVoices, `${at}.maxVoices`, 1, 2, problems)
      if (sound.loop !== undefined && typeof sound.loop !== 'boolean') problems.push(`${at}.loop: 必须是布尔值`)
    })
  }
  return { recipes, problems }
}

/**
 * 生成 `src/client/sounds.generated.js` 的文本。
 * @param {string} root
 * @returns {string}
 */
export function buildSoundPacks(root) {
  const { recipes, problems } = loadSoundPacks(root)
  if (problems.length > 0) throw new Error('sound packs are invalid:\n' + problems.join('\n'))
  return [
    '// @ts-check',
    '/**',
    ' * 由 scripts/build-asset-packs.mjs 从 assets/sounds 下各包的 pack.json 生成，勿手改。',
    ' * 新增音效只需改 pack.json；音效文件（M2b）接入前只支持 synth 配方。',
    ' * @module dsh-piggy/client/sounds.generated',
    ' */',
    "  /** @type {Record<string, { tones: Array<{ type: string, from: number, to: number, ms: number, gain: number, delay?: number, sweep?: string }>, noise?: { from: number, to: number, ms: number, gain: number, type?: string } }>} */",
    `export const SOUND_RECIPES = Object.freeze(${JSON.stringify(recipes, null, 2)})`,
    '',
  ].join('\n')
}
