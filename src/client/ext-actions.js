// @ts-check
/**
 * 第三方动作包的客户端注册与公开播放入口（M3 第三刀）。
 *
 * `/state` 的 `extensions[].assetPacks.actions` 只有摘要；这里按摘要里的
 * `base` 取 `pack.json`（见 `ext-actions-pack.js`），注册到挂载时的可写
 * registry。命名空间固定为 `ext-<extension-key>`，第一方 `dsh-piggy`
 * 永远在父级 registry 里，扩展包不会覆盖它。
 *
 * 扩展自己的 `client.js` 在面板/大界面里派发
 * `dsh-piggy:action`（detail `{ key: 'ext-<key>/<pack>/<action>' }`）；
 * 这里只接受已注册的 handle，位置由 `split.js` 的 `playAction` 转发到猪窗口。
 * @module dsh-piggy/client/ext-actions
 */
import { playPigAction } from './pig-actions.js'
import { EXT_KEY, EXT_PACK, extensionPackBase, readExtensionActionPack } from './ext-actions-pack.js'

/** Public DOM event for extension-authored actions. */
export const EXT_ACTION_EVENT = 'dsh-piggy:action'

/**
 * @typedef {{
 *   namespace: string,
 *   pack: string,
 *   key: string,
 *   signature: string,
 *   triggers: Record<string, string>,
 *   input?: import('./art-resources.js').ArtResourcePackInput & { triggers: Record<string, string> },
 * }} ActivePack
 */

/**
 * @param {{
 *   registry: import('./art-resources.js').ArtResourceRegistry,
 *   play: (key: string) => any,
 *   target?: { addEventListener?: Function, removeEventListener?: Function } | null,
 *   fetch?: (url: string, init?: any) => Promise<any>,
 *   warn?: (message: string, error?: any) => void,
 * }} options
 */
export function createExtensionActionRuntime(options) {
  const registry = options.registry
  const play = options.play
  const fetchImpl = options.fetch ?? (/** @type {any} */ (globalThis).fetch)
  const warn = options.warn ?? ((message, error) => console.warn('[dsh-piggy] ' + message, error))
  const target = options.target === undefined
    ? (typeof document === 'undefined' ? null : /** @type {any} */ (document))
    : options.target
  /** @type {Map<string, ActivePack>} */
  const active = new Map()
  /** @type {Map<string, string>} */
  const failed = new Map()
  let disposed = false
  /** @type {Promise<any>} */
  let tail = Promise.resolve()

  /** @param {string} id */
  function removeActive(id) {
    const entry = active.get(id)
    if (entry === undefined) return
    active.delete(id)
    try { registry.unregisterPack(entry.namespace, entry.pack) } catch (error) { warn('第三方动作包注销失败：' + entry.namespace + '/' + entry.pack, error) }
  }

  /**
   * Read and register one wanted pack. Callers keep failures isolated.
   * @param {NonNullable<ReturnType<typeof wanted>>} item
   */
  async function install(item) {
    const input = await readExtensionActionPack({
      key: item.key, pack: item.pack, version: item.version || '1', base: item.base, fetch: fetchImpl,
    })
    if (disposed) return null
    // Remove the old revision before installing the new one so actions that
    // disappeared from pack.json do not linger in the registry.
    if (active.has(item.id)) removeActive(item.id)
    registry.registerPack(input, { replace: true })
    active.set(item.id, { namespace: item.namespace, pack: item.pack, key: item.key, signature: item.signature, triggers: input.triggers ?? {}, input: input })
    failed.delete(item.id)
    return input
  }

  /**
   * First action handle of a registered pack, or '' when it is not loaded yet.
   * @param {NonNullable<ReturnType<typeof wanted>>} item
   */
  function firstKey(item) {
    const entry = active.get(item.id)
    const first = entry?.input?.resources?.find(resource => resource.kind === 'action')
    return first === undefined ? '' : item.namespace + '/' + item.pack + '/' + first.key
  }

  /**
   * Resolve the first action handle for the read-only preview button. Uses the
   * already registered pack when possible, otherwise fetches pack.json once.
   * Never throws: a preview failure is silent in the UI.
   * @param {any} extension
   * @param {any} summary
   */
  async function previewKey(extension, summary) {
    if (extension === null || typeof extension !== 'object') return ''
    if (extension.installed === false || extension.on === false) return ''
    const item = wanted(extension, summary)
    if (item === null) return ''
    const cached = firstKey(item)
    if (cached !== '') return cached
    const run = tail.then(async () => {
      const again = firstKey(item)
      if (again !== '') return again
      if (disposed || registry.readonly === true) return ''
      try {
        const input = await install(item)
        if (input === null) return ''
        const first = input.resources.find(resource => resource.kind === 'action')
        return first === undefined ? '' : item.namespace + '/' + item.pack + '/' + first.key
      } catch {
        return ''
      }
    }).catch(() => '')
    tail = run
    return run
  }

  /**
   * @param {any} extension
   * @param {any} summary
   * @returns {{ id: string, namespace: string, pack: string, key: string, version: string, base: string, signature: string } | null}
   */
  function wanted(extension, summary) {
    if (summary === null || typeof summary !== 'object' || summary.kind !== 'actions' || summary.available !== true) return null
    const key = extension.key
    const pack = summary.pack
    if (typeof key !== 'string' || !EXT_KEY.test(key) || typeof pack !== 'string' || !EXT_PACK.test(pack)) return null
    const base = extensionPackBase(key, pack)
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
      signature: [key, pack, version, summary.entries ?? 0, summary.frames ?? 0, summary.files ?? 0, summary.bytes ?? 0].join('|'),
    }
  }

  /** @param {any[]} extensions */
  async function apply(extensions) {
    if (disposed || registry.readonly === true) return
    /** @type {Map<string, ReturnType<typeof wanted>>} */
    const desired = new Map()
    for (const extension of extensions) {
      if (extension === null || typeof extension !== 'object') continue
      if (extension.installed === false || extension.on === false) continue
      const packs = extension.assetPacks !== null && typeof extension.assetPacks === 'object' ? extension.assetPacks.actions : null
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
      if (current !== undefined && current.signature === item.signature && current.input !== undefined) continue
      if (failed.get(id) === item.signature) continue
      try {
        if (await install(item) === null) return
      } catch (error) {
        failed.set(id, item.signature)
        const message = error instanceof Error ? error.message : String(error)
        warn('第三方动作包加载失败：' + item.namespace + '/' + item.pack + '（' + message + '）')
      }
    }
  }

  /**
   * Reconcile registered packs with one normalized `/state` extensions list.
   * Sync is serialized so rapid polls cannot interleave register/unregister.
   * @param {any} extensions
   */
  function sync(extensions) {
    const snapshot = Array.isArray(extensions) ? extensions.slice() : []
    tail = tail.then(() => apply(snapshot)).catch(error => {
      warn('第三方动作包同步失败', error)
    })
    return tail
  }

  /** @param {string} key */
  function owns(key) {
    if (typeof key !== 'string' || key.length > 200) return false
    const parts = key.split('/')
    if (parts.length !== 3 || !parts[0].startsWith('ext-')) return false
    const namespace = parts[0]
    const entry = active.get(namespace + '/' + parts[1])
    if (entry === undefined) return false
    const resolved = registry.resolveRef({ namespace: namespace, pack: parts[1], key: parts[2] })
    return resolved !== null
      && resolved.descriptor.kind === 'action'
      && resolved.descriptor.namespace === namespace
      && resolved.descriptor.pack === parts[1]
  }

  /** @param {any} detail */
  function handle(detail) {
    const key = detail !== null && typeof detail === 'object' ? detail.key : null
    if (!owns(key)) return false
    try { return play(key) !== false } catch (error) { warn('第三方动作播放失败：' + String(key), error); return false }
  }

  function onActionEvent(/** @type {any} */ event) {
    handle(event?.detail)
  }

  /** Play the first installed action whose pack declares this trigger. */
  function trigger(/** @type {string} */ event) {
    if (typeof event !== 'string' || event === '') return false
    for (const entry of active.values()) {
      for (const [key, on] of Object.entries(entry.triggers)) {
        if (on === event) return handle({ key: key })
      }
    }
    return false
  }

  target?.addEventListener?.(EXT_ACTION_EVENT, onActionEvent)

  return {
    sync: sync,
    owns: owns,
    handle: handle,
    trigger: trigger,
    previewKey: previewKey,
    dispose: function () {
      if (disposed) return
      disposed = true
      target?.removeEventListener?.(EXT_ACTION_EVENT, onActionEvent)
      for (const id of [...active.keys()]) removeActive(id)
      failed.clear()
    },
  }
}

/**
 * Mount the public entry for one presentation: install `ctx.playAction` (the
 * split bridge may replace it before an event arrives) and start listening.
 * @param {{
 *   ctx: any,
 *   pig: any,
 *   registry: import('./art-resources.js').ArtResourceRegistry,
 *   target?: { addEventListener?: Function, removeEventListener?: Function } | null,
 *   fetch?: (url: string, init?: any) => Promise<any>,
 *   warn?: (message: string, error?: any) => void,
 * }} options
 */
export function attachExtensionActions(options) {
  options.ctx.playAction = function (/** @type {string} */ key) { return playPigAction(options.pig, key) }
  return createExtensionActionRuntime({
    registry: options.registry, play: key => options.ctx.playAction(key),
    target: options.target, fetch: options.fetch, warn: options.warn,
  })
}
