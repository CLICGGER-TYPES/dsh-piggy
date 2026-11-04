// @ts-check
/**
 * 第三方动作包的 `pack.json` 读取与转换（M3 第三刀）。
 *
 * 宿主静态路由只发原始 pack.json；这里把它转成 registry 能注册的
 * `ArtResourcePackInput`。命名空间、base 和文件路径都由扩展 key/pack 推导，
 * 不信任 pack.json 里的 namespace，也不接受外链。
 * @module dsh-piggy/client/ext-actions-pack
 */
import { EXT_URL } from './constants.js'

export const EXT_KEY = /^[a-z0-9-]{2,24}$/
export const EXT_PACK = /^[a-z][a-z0-9-]{0,31}$/
const ACTION = /^[a-z][a-z0-9-]{0,47}$/
const SOUND_REF = /^(?:[a-z][a-z0-9-]{0,31}\/)?[a-z][a-z0-9-]{0,47}$/
const REVISION = /^[A-Za-z0-9._-]{1,128}$/

/** @param {string} key @param {string} pack */
export function extensionPackBase(key, pack) {
  return EXT_URL + 'ext/' + key + '/actions/' + pack + '/'
}

/** Small deterministic content tag, so new bytes under the same version still bust image caches. */
function hashText(value) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** @param {unknown} value */
function revisionOf(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return String(value)
  if (typeof value === 'string' && REVISION.test(value)) return value
  return null
}

/** @param {string} declared @param {string} body */
function packRevision(declared, body) {
  const safe = declared.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96)
  return (safe === '' ? '1' : safe) + '-' + hashText(body)
}

/** @param {number} value @param {string} label */
function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(label + ' must be a positive integer')
  return value
}

/**
 * Convert one authored frame path into the host-relative form stored by the
 * registry. Authors normally write `<action>/00.png`; the generated first-party
 * shape uses `actions/<pack>/<action>/00.png`; already-prefixed paths pass.
 * @param {string} key @param {string} pack @param {unknown} value
 */
function extPath(key, pack, value) {
  if (typeof value !== 'string' || value === '' || value.length > 200) throw new Error('invalid frame path')
  if (value.startsWith('/') || value.includes('..') || value.includes('//')
    || value.includes('\\') || value.includes('?') || value.includes('#')) {
    throw new Error('unsafe frame path')
  }
  if (value.startsWith('ext/')) {
    if (!value.startsWith('ext/' + key + '/actions/' + pack + '/')) throw new Error('frame path escapes this action pack')
    return value
  }
  if (value.startsWith('actions/')) {
    if (!value.startsWith('actions/' + pack + '/')) throw new Error('frame path escapes this action pack')
    return 'ext/' + key + '/' + value
  }
  return 'ext/' + key + '/actions/' + pack + '/' + value.replace(/^\.\//, '')
}

/**
 * Authored action sounds are `beep` or `<sound-pack>/beep`; the runtime table
 * is namespaced, so prefix this extension. A bare key becomes
 * `ext-<key>/<sound>` and resolves inside the extension (ambiguous cross-pack
 * short names are rejected at play time).
 * @param {string} key
 * @param {unknown} value
 */
function actionSound(key, value) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !SOUND_REF.test(value)) throw new Error('invalid action sound')
  return 'ext-' + key + '/' + value
}

/**
 * Per-frame durations for the authored `frames: { fps } | { durationsMs: [] }`
 * shape. fps uses cumulative rounding so the total is exactly `durationMs`,
 * matching the installer.
 * @param {any} frames
 * @param {number} duration
 * @returns {number[]}
 */
function durationsFrom(frames, duration) {
  if (frames.fps !== undefined && frames.durationsMs !== undefined) throw new Error('frames need exactly one of fps or durationsMs')
  if (Array.isArray(frames.durationsMs)) {
    const durations = frames.durationsMs
    if (durations.length < 2 || durations.length > 48) throw new Error('invalid frame count')
    let total = 0
    for (const value of durations) total += positiveInteger(value, 'frame duration')
    if (total !== duration) throw new Error('frame durations do not add up to durationMs')
    return durations
  }
  if (Number.isInteger(frames.fps) && frames.fps >= 1 && frames.fps <= 60) {
    const count = Math.round(duration * frames.fps / 1000)
    if (count < 2 || count > 48) throw new Error('invalid frame count')
    /** @type {number[]} */
    const durations = []
    let previous = 0
    for (let index = 0; index < count; index += 1) {
      const boundary = Math.round((index + 1) * 1000 / frames.fps)
      durations.push(boundary - previous)
      previous = boundary
    }
    if (previous !== duration) throw new Error('frame durations do not add up to durationMs')
    return durations
  }
  throw new Error('frames need fps or durationsMs')
}

/** @param {any} value @param {string} namespace @param {string} pack */
function fallbackOf(value, namespace, pack) {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return { namespace: namespace, pack: pack, key: value }
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value.namespace !== undefined && value.namespace !== namespace) throw new Error('fallback namespace must match this extension')
    return {
      namespace: namespace,
      pack: typeof value.pack === 'string' ? value.pack : pack,
      key: value.key,
    }
  }
  throw new Error('invalid action fallback')
}

/**
 * Probe the actual frame format. pack.json only declares timing, while the
 * installer accepts PNG and WebP; the two names are mutually exclusive. A GET
 * is used because the static route answers GET only; cancel its body once the
 * status line tells us which file exists.
 * @param {(url: string, init?: any) => Promise<any>} fetchImpl
 * @param {string} base
 * @param {string} actionKey
 * @returns {Promise<'png' | 'webp'>}
 */
async function detectFrameFormat(fetchImpl, base, actionKey) {
  for (const ext of ['png', 'webp']) {
    try {
      const response = await fetchImpl(base + actionKey + '/00.' + ext, { cache: 'no-store', method: 'GET' })
      if (response !== null && response !== undefined && response.ok === true) {
        try { await response.body?.cancel?.() } catch { /* already consumed/aborted */ }
        return /** @type {'png' | 'webp'} */ (ext)
      }
    } catch { /* try the next accepted format */ }
  }
  throw new Error('找不到帧文件')
}

/**
 * @param {{
 *   key: string,
 *   pack: string,
 *   version: string,
 *   value: any,
 *   body: string,
 *   fetch: (url: string, init?: any) => Promise<any>,
 * }} input
 * @returns {Promise<import('./art-resources.js').ArtResourcePackInput & { triggers: Record<string, string> }>}
 */
export async function buildExtensionActionPack(input) {
  const { key, pack } = input
  const namespace = 'ext-' + key
  const value = input.value
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('pack.json must be an object')
  if (value.pack !== undefined && value.pack !== pack) throw new Error('pack.json pack does not match the directory')
  if (!Array.isArray(value.actions) || value.actions.length === 0) throw new Error('pack.json needs actions')
  const declared = value.revision === undefined ? input.version : revisionOf(value.revision)
  const revision = packRevision(typeof declared === 'string' && declared !== '' ? declared : input.version, input.body)
  const base = extensionPackBase(key, pack)
  /** @type {import('./art-resources.js').ArtResourceDeclaration[]} */
  const resources = []
  /** @type {Record<string, string>} */
  const triggers = {}
  const seen = new Set()
  for (const action of value.actions) {
    if (action === null || typeof action !== 'object' || Array.isArray(action)) throw new Error('action must be an object')
    if (!ACTION.test(action.key)) throw new Error('invalid action key')
    if (seen.has(action.key)) throw new Error('duplicate action key: ' + action.key)
    seen.add(action.key)
    if (action.kind !== undefined && action.kind !== 'action') throw new Error('action kind must be action')
    const duration = action.duration !== undefined ? action.duration : action.durationMs
    if (!Number.isInteger(duration) || duration <= 0) throw new Error('action needs durationMs')
    /** @type {import('./art-resources.js').ArtResourceDeclaration} */
    const declaration = { key: action.key, kind: 'action', duration: duration }
    if (action.frames !== undefined) {
      if (action.source !== undefined) throw new Error('action cannot have both source and frames')
      /** @type {import('./art-resources.js').ArtFrameInput[]} */
      let frames
      if (Array.isArray(action.frames)) {
        // Generated/client shape: one entry per frame, path already decided.
        frames = action.frames.map((/** @type {any} */ entry) => {
          if (entry === null || typeof entry !== 'object') throw new Error('invalid frame entry')
          return {
            path: extPath(key, pack, entry.path),
            revision: revisionOf(entry.revision) ?? revision,
            durationMs: positiveInteger(entry.durationMs, 'frame duration'),
          }
        })
        const total = frames.reduce((sum, frame) => sum + frame.durationMs, 0)
        if (total !== duration) throw new Error('frame durations do not add up to durationMs')
      } else if (action.frames !== null && typeof action.frames === 'object') {
        const durations = durationsFrom(action.frames, duration)
        const format = action.format === 'webp' ? 'webp' : action.format === 'png' ? 'png' : await detectFrameFormat(input.fetch, base, action.key)
        frames = durations.map((durationMs, index) => ({
          path: extPath(key, pack, action.key + '/' + String(index).padStart(2, '0') + '.' + format),
          revision: revision,
          durationMs: durationMs,
        }))
      } else {
        throw new Error('invalid frames')
      }
      declaration.frames = frames
    } else if (action.source !== undefined) {
      const source = action.source
      /** @type {string} */
      let path
      if (typeof source === 'string') path = source
      else if (source !== null && typeof source === 'object' && !Array.isArray(source)) {
        if (source.scheme !== undefined && source.scheme !== 'path') throw new Error('third-party actions must be self-contained')
        path = source.path
      } else {
        throw new Error('invalid action source')
      }
      declaration.source = { scheme: 'ext', path: extPath(key, pack, path) }
      const actionRevision = revisionOf(action.revision)
      if (actionRevision !== null) declaration.revision = actionRevision
    } else {
      throw new Error('action needs source or frames')
    }
    if (action.eligibility !== undefined && action.eligibility !== null) declaration.eligibility = action.eligibility
    const fallback = fallbackOf(action.fallback, namespace, pack)
    if (fallback !== undefined) declaration.fallback = fallback
    // 动作 sound 在运行时查本扩展音效表；没注册时静音，绝不落到第一方同名 key。
    const sound = actionSound(key, action.sound)
    if (sound !== undefined) declaration.sound = sound
    resources.push(declaration)
    const trigger = action.trigger !== null && typeof action.trigger === 'object' ? action.trigger.on : null
    if (typeof trigger === 'string' && trigger !== '') triggers[namespace + '/' + pack + '/' + action.key] = trigger
  }
  return { namespace: namespace, pack: pack, revision: revision, resources: resources, triggers: triggers }
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
 * Fetch and convert one installed action pack. Any error rejects the whole
 * pack; callers keep the failure isolated per extension/pack.
 * @param {{
 *   key: string, pack: string, version: string, base: string,
 *   fetch: (url: string, init?: any) => Promise<any>,
 * }} input
 */
export async function readExtensionActionPack(input) {
  const { value, body } = await readJson(input.fetch, input.base + 'pack.json')
  return buildExtensionActionPack({
    key: input.key, pack: input.pack, version: input.version,
    value: value, body: body, fetch: input.fetch,
  })
}
