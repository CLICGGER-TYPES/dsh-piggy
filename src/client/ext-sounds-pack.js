// @ts-check
/**
 * 第三方音效包的 `pack.json` 读取与转换（M3 第四刀）。
 *
 * 宿主静态路由只发原始 pack.json；这里把它转成音频注册表能吃的条目。
 * 命名空间和文件 URL 都由扩展 key / pack 推导，不信任 pack.json 里的
 * namespace，也不接受外链。任何坏字段都让该包整体失败，由调用方隔离。
 * @module dsh-piggy/client/ext-sounds-pack
 */
import { EXT_URL } from './constants.js'
import { EXT_KEY, EXT_PACK } from './ext-actions-pack.js'

const SOUND_KEY = /^[a-z][a-z0-9-]{0,47}$/
const SOUND_FILE = /^([a-z][a-z0-9-]{0,47})\.(ogg|wav)$/
const FALLBACK = /^(?:synth:)?[a-z][a-z0-9-]{0,47}$/
const TONE_TYPES = new Set(['sine', 'triangle', 'sawtooth', 'square'])
const FILTER_TYPES = new Set(['lowpass', 'highpass', 'bandpass'])
const SOUND_FIELDS = new Set(['key', 'synth', 'file', 'durationMs', 'codec', 'gain', 'debounceMs', 'priority', 'maxVoices', 'loop', 'fallback'])
const SYNTH_FIELDS = new Set(['tones', 'noise'])
const TONE_FIELDS = new Set(['type', 'from', 'to', 'ms', 'gain', 'delay', 'sweep'])
const NOISE_FIELDS = new Set(['from', 'to', 'ms', 'gain', 'type'])

/** @param {string} key @param {string} pack */
export function extensionSoundPackBase(key, pack) {
  return EXT_URL + 'ext/' + key + '/sounds/' + pack + '/'
}

/** Small deterministic content tag, so a new pack body gets a fresh decode cache. */
function hashText(value) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** @param {Record<string, any>} value @param {Set<string>} allowed @param {string} label */
function fields(value, allowed, label) {
  for (const name of Object.keys(value)) {
    if (!allowed.has(name)) throw new Error(label + '.' + name + ' is not supported')
  }
}

/** @param {unknown} value @param {string} label @param {number} min @param {number} max */
function numberIn(value, label, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(label + ' must be between ' + min + ' and ' + max)
  }
  return value
}

/** @param {any} synth @param {string} label */
function synthOf(synth, label) {
  if (!record(synth)) throw new Error(label + ' must be an object')
  fields(synth, SYNTH_FIELDS, label)
  if (!Array.isArray(synth.tones)) throw new Error(label + '.tones must be an array')
  const tones = synth.tones.map((/** @type {any} */ tone, /** @type {number} */ index) => {
    const at = label + '.tones[' + index + ']'
    if (!record(tone)) throw new Error(at + ' must be an object')
    fields(tone, TONE_FIELDS, at)
    if (!TONE_TYPES.has(tone.type)) throw new Error(at + '.type is invalid')
    /** @type {any} */
    const out = {
      type: tone.type,
      from: numberIn(tone.from, at + '.from', 20, 20000),
      to: numberIn(tone.to, at + '.to', 20, 20000),
      ms: numberIn(tone.ms, at + '.ms', 10, 5000),
      gain: numberIn(tone.gain, at + '.gain', 0, 1),
    }
    if (tone.delay !== undefined) out.delay = numberIn(tone.delay, at + '.delay', 0, 5000)
    if (tone.sweep !== undefined) {
      if (typeof tone.sweep !== 'string') throw new Error(at + '.sweep must be a string')
      out.sweep = tone.sweep
    }
    return out
  })
  /** @type {any} */
  const out = { tones: tones }
  if (synth.noise !== undefined) {
    const noise = synth.noise
    const at = label + '.noise'
    if (!record(noise)) throw new Error(at + ' must be an object')
    fields(noise, NOISE_FIELDS, at)
    out.noise = {
      from: numberIn(noise.from, at + '.from', 20, 20000),
      to: numberIn(noise.to, at + '.to', 20, 20000),
      ms: numberIn(noise.ms, at + '.ms', 10, 5000),
      gain: numberIn(noise.gain, at + '.gain', 0, 1),
    }
    if (noise.type !== undefined) {
      if (!FILTER_TYPES.has(noise.type)) throw new Error(at + '.type is invalid')
      out.noise.type = noise.type
    }
  }
  return out
}

/**
 * @param {any} sound
 * @param {string} base
 * @param {string} namespace
 * @param {string} pack
 * @param {string} tag
 */
function soundOf(sound, base, namespace, pack, tag) {
  if (!record(sound)) throw new Error('sound must be an object')
  fields(sound, SOUND_FIELDS, 'sound')
  if (typeof sound.key !== 'string' || !SOUND_KEY.test(sound.key)) throw new Error('invalid sound key')
  if (sound.file !== undefined && sound.synth !== undefined) throw new Error('sound needs exactly one of file or synth')
  if (sound.file === undefined && sound.synth === undefined) throw new Error('sound needs file or synth')
  /** @type {any} */
  const entry = { key: sound.key }
  if (sound.synth !== undefined) {
    entry.synth = synthOf(sound.synth, 'sound(' + sound.key + ').synth')
  } else {
    if (typeof sound.file !== 'string') throw new Error('sound.file must be <key>.ogg or <key>.wav')
    const match = SOUND_FILE.exec(sound.file)
    if (match === null || match[1] !== sound.key) throw new Error('sound.file must match the sound key and use .ogg or .wav')
    if (!Number.isInteger(sound.durationMs) || sound.durationMs < 20 || sound.durationMs > 1500) {
      throw new Error('sound.durationMs must be an integer between 20 and 1500')
    }
    entry.url = base + sound.file
    entry.durationMs = sound.durationMs
    entry.cacheKey = namespace + '/' + pack + '/' + sound.key + '@' + tag
  }
  if (sound.gain !== undefined) entry.gain = numberIn(sound.gain, 'sound(' + sound.key + ').gain', 0, 1)
  if (sound.debounceMs !== undefined) {
    entry.debounceMs = numberIn(sound.debounceMs, 'sound(' + sound.key + ').debounceMs', 0, 2000)
  }
  if (sound.fallback !== undefined) {
    if (typeof sound.fallback !== 'string' || !FALLBACK.test(sound.fallback)) {
      throw new Error('sound.fallback must be a sound key or synth:<key>')
    }
    entry.fallback = sound.fallback
  }
  return entry
}

/**
 * @param {{ key: string, pack: string, value: any, body: string, tag?: string }} input
 */
export function buildExtensionSoundPack(input) {
  if (!EXT_KEY.test(input.key)) throw new Error('invalid extension key')
  if (!EXT_PACK.test(input.pack)) throw new Error('invalid sound pack')
  const value = input.value
  if (!record(value)) throw new Error('pack.json must be an object')
  for (const name of Object.keys(value)) {
    if (name !== 'pack' && name !== 'revision' && name !== 'sounds') throw new Error('pack.json.' + name + ' is not supported')
  }
  if (value.pack !== undefined && value.pack !== input.pack) throw new Error('pack.json pack does not match the directory')
  if (!Array.isArray(value.sounds) || value.sounds.length === 0) throw new Error('pack.json needs sounds')
  const namespace = 'ext-' + input.key
  const base = extensionSoundPackBase(input.key, input.pack)
  const tag = typeof input.tag === 'string' && input.tag !== '' ? input.tag : hashText(input.body)
  const seen = new Set()
  const sounds = value.sounds.map((/** @type {any} */ sound) => {
    const entry = soundOf(sound, base, namespace, input.pack, tag)
    if (seen.has(entry.key)) throw new Error('duplicate sound key: ' + entry.key)
    seen.add(entry.key)
    return entry
  })
  return { namespace: namespace, pack: input.pack, sounds: sounds }
}

/** @param {(url: string, init?: any) => Promise<any>} fetchImpl @param {string} url */
async function readJson(fetchImpl, url) {
  const response = await fetchImpl(url, { cache: 'no-cache' })
  if (response === null || response === undefined || response.ok !== true) {
    throw new Error('HTTP ' + String(response?.status ?? 'error'))
  }
  if (typeof response.text === 'function') {
    const body = await response.text()
    try { return { value: JSON.parse(body), body: body } } catch { throw new Error('pack.json is not valid JSON') }
  }
  if (typeof response.json === 'function') {
    const value = await response.json()
    return { value: value, body: JSON.stringify(value) }
  }
  throw new Error('pack.json response has no body')
}

/**
 * Fetch and convert one installed sound pack. Any error rejects the whole pack;
 * callers keep the failure isolated per extension/pack.
 * @param {{
 *   key: string, pack: string, base: string,
 *   fetch: (url: string, init?: any) => Promise<any>,
 *   tag?: string,
 * }} input
 */
export async function readExtensionSoundPack(input) {
  const { value, body } = await readJson(input.fetch, input.base + 'pack.json')
  return buildExtensionSoundPack({
    key: input.key, pack: input.pack, value: value, body: body, tag: input.tag,
  })
}
