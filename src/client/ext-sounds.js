// @ts-check
/**
 * 第三方音效包的客户端注册与公开播放入口（M3 第四刀）。
 *
 * `/state` 的 `extensions[].assetPacks.sounds` 只有摘要；这里按摘要里的
 * `base` 取 `pack.json`，注册到 audio-context 的可写扩展音效表。命名空间
 * 固定为 `ext-<extension-key>`，第一方 RECIPES / SOUND_FILES 永远先命中。
 *
 * 扩展自己的 `client.js` 在面板/大界面里派发
 * `dsh-piggy:sound`（detail `{ key: 'ext-<key>/<pack>/<sound>' }`）；
 * 这里只接受已注册的 key。拆窗口时由 `split.js` 的 `playSound` 转发到猪窗口。
 * @module dsh-piggy/client/ext-sounds
 */
import {
  registerExtensionSoundPack, resolveExtensionSound, unregisterExtensionSoundPack,
} from './audio-context.js'
import { EXT_KEY, EXT_PACK } from './ext-actions-pack.js'
import { extensionSoundPackBase, readExtensionSoundPack } from './ext-sounds-pack.js'

/** Public DOM event for extension-authored sounds. */
export const EXT_SOUND_EVENT = 'dsh-piggy:sound'

/**
 * @typedef {{
 *   namespace: string,
 *   pack: string,
 *   key: string,
 *   signature: string,
 *   keys: string[],
 * }} ActiveSoundPack
 */

/**
 * @param {{
 *   play: (key: string) => any,
 *   target?: { addEventListener?: Function, removeEventListener?: Function } | null,
 *   fetch?: (url: string, init?: any) => Promise<any>,
 *   warn?: (message: string, error?: any) => void,
 * }} options
 */
export function createExtensionSoundRuntime(options) {
  const play = options.play
  const fetchImpl = options.fetch ?? (/** @type {any} */ (globalThis).fetch)
  const warn = options.warn ?? ((message, error) => console.warn('[dsh-piggy] ' + message, error))
  const target = options.target === undefined
    ? (typeof document === 'undefined' ? null : /** @type {any} */ (document))
    : options.target
  /** @type {Map<string, ActiveSoundPack>} */
  const active = new Map()
  /** @type {Map<string, string>} */
  const failed = new Map()
  let disposed = false
  let tail = Promise.resolve()

  /** @param {string} id */
  function removeActive(id) {
    const entry = active.get(id)
    if (entry === undefined) return
    active.delete(id)
    try { unregisterExtensionSoundPack(entry.namespace, entry.pack) } catch (error) { warn('第三方音效包注销失败：' + entry.namespace + '/' + entry.pack, error) }
  }

  /**
   * @param {any} extension
   * @param {any} summary
   * @returns {{ id: string, namespace: string, pack: string, key: string, version: string, base: string, tag: string, signature: string } | null}
   */
  function wanted(extension, summary) {
    if (summary === null || typeof summary !== 'object' || summary.kind !== 'sounds' || summary.available !== true) return null
    const key = extension.key
    const pack = summary.pack
    if (typeof key !== 'string' || !EXT_KEY.test(key) || typeof pack !== 'string' || !EXT_PACK.test(pack)) return null
    const base = extensionSoundPackBase(key, pack)
    if (summary.base !== base) return null
    const namespace = 'ext-' + key
    const version = typeof extension.version === 'string' ? extension.version : ''
    return {
      id: namespace + '/' + pack,
      namespace: namespace,
      pack: pack,
      key: key,
      version: version,
      base: base,
      tag: [version, summary.entries ?? 0, summary.files ?? 0, summary.bytes ?? 0].join('|'),
      signature: [key, pack, version, summary.entries ?? 0, summary.files ?? 0, summary.bytes ?? 0].join('|'),
    }
  }

  /** @param {any[]} extensions */
  async function apply(extensions) {
    if (disposed) return
    /** @type {Map<string, ReturnType<typeof wanted>>} */
    const desired = new Map()
    for (const extension of extensions) {
      if (extension === null || typeof extension !== 'object') continue
      if (extension.installed === false || extension.on === false) continue
      const packs = extension.assetPacks !== null && typeof extension.assetPacks === 'object' ? extension.assetPacks.sounds : null
      if (!Array.isArray(packs)) continue
      for (const summary of packs) {
        const item = wanted(extension, summary)
        if (item !== null) desired.set(item.id, item)
      }
    }
    // Drop packs that are gone, disabled or no longer available.
    for (const id of [...failed.keys()]) if (!desired.has(id)) failed.delete(id)
    for (const id of [...active.keys()]) if (!desired.has(id)) removeActive(id)
    for (const [id, item] of desired) {
      const current = active.get(id)
      if (current !== undefined && current.signature === item.signature) continue
      if (failed.get(id) === item.signature) continue
      try {
        const input = await readExtensionSoundPack({
          key: item.key, pack: item.pack, base: item.base, fetch: fetchImpl, tag: item.tag,
        })
        if (disposed) return
        // Remove the old revision before installing the new one so sounds that
        // disappeared from pack.json do not linger in the table.
        if (active.has(id)) removeActive(id)
        const keys = registerExtensionSoundPack({ namespace: input.namespace, pack: input.pack, sounds: input.sounds })
        active.set(id, { namespace: item.namespace, pack: item.pack, key: item.key, signature: item.signature, keys: keys })
        failed.delete(id)
      } catch (error) {
        failed.set(id, item.signature)
        const message = error instanceof Error ? error.message : String(error)
        warn('第三方音效包加载失败：' + item.namespace + '/' + item.pack + '（' + message + '）')
      }
    }
  }

  /**
   * Reconcile registered sound packs with one normalized `/state` extensions list.
   * Sync is serialized so rapid polls cannot interleave register/unregister.
   * @param {any} extensions
   */
  function sync(extensions) {
    const snapshot = Array.isArray(extensions) ? extensions.slice() : []
    tail = tail.then(() => apply(snapshot)).catch(error => {
      warn('第三方音效包同步失败', error)
    })
    return tail
  }

  /** @param {string} key */
  function owns(key) {
    if (typeof key !== 'string' || key.length > 200) return false
    if (!key.startsWith('ext-')) return false
    const entry = resolveExtensionSound(key)
    if (entry === null) return false
    return active.has(entry.namespace + '/' + entry.pack)
  }

  /** @param {any} detail */
  function handle(detail) {
    const key = detail !== null && typeof detail === 'object' ? detail.key : null
    if (!owns(key)) return false
    try { return play(key) !== false } catch (error) { warn('第三方音效播放失败：' + String(key), error); return false }
  }

  function onSoundEvent(/** @type {any} */ event) {
    handle(event?.detail)
  }

  target?.addEventListener?.(EXT_SOUND_EVENT, onSoundEvent)

  return {
    sync: sync,
    owns: owns,
    handle: handle,
    dispose: function () {
      if (disposed) return
      disposed = true
      target?.removeEventListener?.(EXT_SOUND_EVENT, onSoundEvent)
      for (const id of [...active.keys()]) removeActive(id)
      failed.clear()
    },
  }
}

/**
 * Mount the public entry for one presentation: install `ctx.playSound` (the
 * split bridge may replace it before an event arrives) and start listening.
 * @param {{
 *   ctx: any,
 *   audio: { play: (key: string, options?: { soft?: boolean }) => any },
 *   target?: { addEventListener?: Function, removeEventListener?: Function } | null,
 *   fetch?: (url: string, init?: any) => Promise<any>,
 *   warn?: (message: string, error?: any) => void,
 * }} options
 */
export function attachExtensionSounds(options) {
  options.ctx.playSound = function (/** @type {string} */ key) { return options.audio.play(key) }
  return createExtensionSoundRuntime({
    play: key => options.ctx.playSound(key),
    target: options.target, fetch: options.fetch, warn: options.warn,
  })
}
