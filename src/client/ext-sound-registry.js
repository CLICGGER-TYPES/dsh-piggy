// @ts-check
/**
 * 第三方扩展音效表（M3 第四刀）。
 *
 * key 固定 `ext-<extension-key>/<pack>/<sound>`；第一方 RECIPES / SOUND_FILES
 * 由 audio-context 先查，扩展只能占用 `ext-` 前缀。这里只管注册/解析，不碰
 * AudioContext、设备、通道或播放状态。
 * @module dsh-piggy/client/ext-sound-registry
 */
import { RECIPES } from './sounds.js'

/**
 * @type {Map<string, any>}
 */
const extensionSounds = new Map()

const EXTENSION_NAMESPACE = /^ext-[a-z0-9-]{2,24}$/
const EXTENSION_PACK = /^[a-z][a-z0-9-]{0,31}$/
const EXTENSION_SOUND_KEY = /^[a-z][a-z0-9-]{0,47}$/
const EXTENSION_SOUND_ALIAS = /^ext-[a-z0-9-]{2,24}\/[a-z][a-z0-9-]{0,47}$/

/**
 * 替换一个扩展音效包的全部条目（同 namespace/pack 先整体移除，避免更新后
 * pack.json 里删掉的 key 残留）。条目 key 是短名；对外完整 key 由这里拼。
 * @param {{ namespace: string, pack: string, sounds: any[] }} input
 * @returns {string[]} 注册后的完整 key
 */
export function registerExtensionSoundPack(input) {
  const namespace = input !== null && typeof input === 'object' ? input.namespace : null
  const pack = input !== null && typeof input === 'object' ? input.pack : null
  if (typeof namespace !== 'string' || !EXTENSION_NAMESPACE.test(namespace)
    || typeof pack !== 'string' || !EXTENSION_PACK.test(pack)) {
    throw new Error('invalid extension sound pack')
  }
  if (!Array.isArray(input.sounds)) throw new Error('extension sound pack needs sounds')
  unregisterExtensionSoundPack(namespace, pack)
  /** @type {string[]} */
  const keys = []
  for (const sound of input.sounds) {
    if (sound === null || typeof sound !== 'object' || typeof sound.key !== 'string' || !EXTENSION_SOUND_KEY.test(sound.key)) {
      unregisterExtensionSoundPack(namespace, pack)
      throw new Error('invalid extension sound key')
    }
    const key = namespace + '/' + pack + '/' + sound.key
    if (extensionSounds.has(key)) {
      unregisterExtensionSoundPack(namespace, pack)
      throw new Error('duplicate extension sound key')
    }
    const entry = {
      key: key,
      namespace: namespace,
      pack: pack,
      shortKey: sound.key,
      ...(sound.synth === undefined ? {} : { synth: sound.synth }),
      ...(typeof sound.url === 'string' ? { url: sound.url, durationMs: sound.durationMs } : {}),
      ...(typeof sound.gain === 'number' ? { gain: sound.gain } : {}),
      ...(typeof sound.debounceMs === 'number' ? { debounceMs: sound.debounceMs } : {}),
      ...(typeof sound.fallback === 'string' ? { fallback: sound.fallback } : {}),
      ...(typeof sound.cacheKey === 'string' ? { cacheKey: sound.cacheKey } : {}),
    }
    extensionSounds.set(key, Object.freeze(entry))
    keys.push(key)
  }
  return keys
}

/** 移除一个扩展音效包；停用、卸载、available:false 都走这里。 */
export function unregisterExtensionSoundPack(namespace, pack) {
  const prefix = String(namespace) + '/' + String(pack) + '/'
  let removed = 0
  for (const key of [...extensionSounds.keys()]) {
    if (!key.startsWith(prefix)) continue
    extensionSounds.delete(key)
    removed += 1
  }
  return removed
}

/**
 * 解析完整 `ext-<key>/<pack>/<sound>`；也接受省略 pack 的
 * `ext-<key>/<sound>`（动作 sound 只写裸 key 时使用），但同名跨包有歧义时返回 null。
 * @param {string} key
 * @returns {any|null}
 */
export function resolveExtensionSound(key) {
  if (typeof key !== 'string' || key.length > 200) return null
  const exact = extensionSounds.get(key)
  if (exact !== undefined) return exact
  if (!EXTENSION_SOUND_ALIAS.test(key)) return null
  const slash = key.indexOf('/')
  const namespace = key.slice(0, slash)
  const shortKey = key.slice(slash + 1)
  /** @type {any|null} */
  let found = null
  for (const entry of extensionSounds.values()) {
    if (entry.namespace !== namespace || entry.shortKey !== shortKey) continue
    if (found !== null && found.key !== entry.key) return null
    found = entry
  }
  return found
}

/** @param {string} key */
export function hasExtensionSound(key) {
  return resolveExtensionSound(key) !== null
}

/** 测试/热更新用：清空扩展音效表。 */
export function clearExtensionSounds() {
  extensionSounds.clear()
}

/**
 * 文件失败时的合成回退：本扩展同包 → 本扩展短名 → 内置 RECIPES。
 * @param {any} entry
 * @returns {any|undefined}
 */
export function extensionFallbackRecipe(entry) {
  const name = typeof entry.fallback === 'string' ? entry.fallback.replace(/^synth:/, '') : ''
  if (name === '') return undefined
  const samePack = extensionSounds.get(entry.namespace + '/' + entry.pack + '/' + name)
  if (samePack !== undefined && samePack.synth !== undefined) return samePack.synth
  const alias = resolveExtensionSound(entry.namespace + '/' + name)
  if (alias !== null && alias.synth !== undefined) return alias.synth
  return RECIPES[name]
}
