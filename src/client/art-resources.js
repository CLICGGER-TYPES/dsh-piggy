// @ts-check
/**
 * Explicit art/action resource descriptors and the validating registry core.
 *
 * A descriptor's identity is `namespace/pack/key` plus a content `revision`.
 * The revision is resource content identity only: it is not a save schema, a
 * player id, a pig id or a runtime instance id.
 *
 * This module intentionally knows nothing about PIG_ART_ASSETS or the legacy
 * `artSource()` strings. `src/client/art-path.js` owns that adapter, including
 * the read-only default registry, so every existing legacy key keeps its old
 * URL and cache behaviour.
 * @module dsh-piggy/client/art-resources
 */
import { ART_URL } from './constants.js'

/** Internal descriptor schema number. Never written to saves. */
export const ART_RESOURCE_SCHEMA = 1
/** Namespace of the product's own built-in artwork and default actions. */
export const LEGACY_NAMESPACE = 'dsh-piggy'

const DEFAULT_PACK_REVISION = '1'
const HANDLE = /^([a-z0-9][a-z0-9._-]{0,63})\/([a-z0-9][a-z0-9._-]{0,63})\/([A-Za-z0-9][A-Za-z0-9._/-]{0,199})(?:@([A-Za-z0-9._-]{1,128}))?$/

/**
 * @typedef {'art' | 'action' | 'skin'} ArtResourceKind
 * @typedef {'builtin' | 'custom' | 'path' | 'legacy'} ArtSourceScheme
 * @typedef {{ scheme: 'builtin', key: string } | { scheme: 'custom', key: string } | { scheme: 'path', path: string }} ArtResourceSourceInput
 * @typedef {{ scheme: 'builtin', key: string, path: string } | { scheme: 'custom', key: string, path: string } | { scheme: 'path', path: string } | { scheme: 'legacy', path: string }} ArtResourceSource
 * @typedef {{
 *   art?: string,
 *   stageNot?: readonly string[],
 *   absent?: readonly string[],
 *   react?: readonly string[],
 *   moodNot?: readonly string[],
 *   party?: boolean,
 * }} ArtEligibility
 * @typedef {{ namespace: string, pack: string, key: string, revision?: string | number }} ArtResourceRefInput
 * @typedef {{ namespace: string, pack: string, key: string, revision: string }} ArtResourceRef
 * @typedef {{
 *   namespace: string,
 *   pack: string,
 *   key: string,
 *   revision: string,
 *   kind: ArtResourceKind,
 *   source: ArtResourceSource,
 *   frame: readonly [number, number, number] | null,
 *   duration: number | null,
 *   eligibility: ArtEligibility | null,
 *   fallback: ArtResourceRef | null,
 *   sound?: string,
 *   schema: number,
 * }} ArtResourceDescriptor
 * @typedef {{
 *   descriptor: ArtResourceDescriptor,
 *   ref: ArtResourceRef,
 *   id: string,
 *   cacheKey: string,
 *   url: string,
 *   artKey: string,
 *   scheme: ArtSourceScheme,
 *   exists: boolean,
 *   legacy: boolean,
 * }} ResolvedArtResource
 * @typedef {{
 *   key: string,
 *   kind?: ArtResourceKind,
 *   source: ArtResourceSourceInput,
 *   revision?: string | number,
 *   frame?: readonly [number, number, number] | null,
 *   duration?: number,
 *   eligibility?: ArtEligibility,
 *   fallback?: ArtResourceRefInput | string | null,
 *   sound?: string,
 * }} ArtResourceDeclaration
 * @typedef {{ namespace: string, pack: string, revision?: string | number, resources: readonly ArtResourceDeclaration[] }} ArtResourcePackInput
 * @typedef {{
 *   namespace: string,
 *   pack: string,
 *   changes: readonly {
 *     key: string,
 *     revision: string,
 *     previousRevision: string | null,
 *     cacheKey: string,
 *     previousCacheKey: string | null,
 *   }[],
 * }} ArtResourceChange
 * @typedef {{
 *   readonly: boolean,
 *   registerPack: (pack: ArtResourcePackInput, options?: { replace?: boolean }) => readonly ArtResourceDescriptor[],
 *   resolve: (value: string | ArtResourceRefInput) => ResolvedArtResource | null,
 *   resolveRef: (ref: ArtResourceRefInput) => ResolvedArtResource | null,
 *   resolveString: (value: string) => ResolvedArtResource | null,
 *   list: (options?: { kind?: ArtResourceKind, includeParent?: boolean }) => readonly ResolvedArtResource[],
 *   has: (value: string | ArtResourceRefInput) => boolean,
 *   subscribe: (listener: (change: ArtResourceChange) => void) => () => void,
 * }} ArtResourceRegistry
 * @typedef {(declaration: ArtResourceDeclaration, namespace: string, pack: string, packRevision: string) => ArtResourceDescriptor} ArtResourceBuilder
 * @typedef {ReturnType<typeof createState>} RegistryState
 */

/** @param {string} namespace @param {string} pack @param {string} key */
function handleOf(namespace, pack, key) {
  return namespace + '/' + pack + '/' + key
}

/** @param {ArtResourceDescriptor} descriptor */
function idOf(descriptor) {
  return handleOf(descriptor.namespace, descriptor.pack, descriptor.key)
}

/** @param {ArtResourceDescriptor} descriptor */
function urlOf(descriptor) {
  return ART_URL + descriptor.source.path + (descriptor.revision === '' ? '' : '?v=' + descriptor.revision)
}

/** @param {ArtResourceDescriptor} descriptor */
function registeredCacheKey(descriptor) {
  return idOf(descriptor) + '@' + descriptor.revision
}

/** @param {ArtResourceDescriptor} descriptor */
function artKeyOf(descriptor) {
  const source = descriptor.source
  if (source.scheme === 'builtin' || source.scheme === 'custom') return source.key
  if (source.scheme === 'path') return handleOf(descriptor.namespace, descriptor.pack, descriptor.key)
  return descriptor.key
}

/**
 * @param {ArtResourceDescriptor} descriptor
 * @param {boolean} legacy
 * @returns {ResolvedArtResource}
 */
function resolved(descriptor, legacy) {
  const id = idOf(descriptor)
  const url = urlOf(descriptor)
  const scheme = descriptor.source.scheme
  return Object.freeze({
    descriptor: descriptor,
    ref: Object.freeze({
      namespace: descriptor.namespace,
      pack: descriptor.pack,
      key: descriptor.key,
      revision: descriptor.revision,
    }),
    id: id,
    cacheKey: legacy ? url : registeredCacheKey(descriptor),
    url: url,
    artKey: artKeyOf(descriptor),
    scheme: scheme,
    exists: scheme !== 'legacy',
    legacy: legacy,
  })
}

/** @param {string} value @returns {ArtResourceRef | null} */
function parseHandle(value) {
  if (value.includes('..') || value.includes('//')) return null
  const match = HANDLE.exec(value)
  if (match === null) return null
  return Object.freeze({
    namespace: match[1],
    pack: match[2],
    key: match[3],
    revision: match[4] ?? '',
  })
}

/**
 * @param {ArtResourceRegistry | null} parent
 * @param {((key: string) => ArtResourceDescriptor | null) | null} legacy
 * @param {ArtResourceBuilder} buildDescriptor
 */
function createState(parent, legacy, buildDescriptor) {
  /** @type {Map<string, ArtResourceDescriptor>} */
  const records = new Map()
  /** @type {Map<string, string>} */
  const shortKeys = new Map()
  const listeners = new Set()
  let locked = false

  function rebuildShortKeys() {
    shortKeys.clear()
    /** @type {Map<string, string[]>} */
    const seen = new Map()
    for (const descriptor of records.values()) {
      const list = seen.get(descriptor.key) ?? []
      list.push(idOf(descriptor))
      seen.set(descriptor.key, list)
    }
    for (const [key, ids] of seen) if (ids.length === 1) shortKeys.set(key, ids[0])
  }

  /** @param {ArtResourceRefInput} ref @returns {ResolvedArtResource | null} */
  function resolveRef(ref) {
    if (ref === null || typeof ref !== 'object') return null
    const { namespace, pack, key } = ref
    if (typeof namespace !== 'string' || typeof pack !== 'string' || typeof key !== 'string') return null
    const descriptor = records.get(handleOf(namespace, pack, key))
    if (descriptor === undefined) return parent === null ? null : parent.resolveRef(ref)
    if (ref.revision !== undefined && ref.revision !== '' && String(ref.revision) !== descriptor.revision) return null
    return resolved(descriptor, false)
  }

  /** @param {string} value @returns {ResolvedArtResource | null} */
  function resolveString(value) {
    if (typeof value !== 'string') return null
    const short = shortKeys.get(value)
    if (short !== undefined) {
      const descriptor = records.get(short)
      if (descriptor !== undefined) return resolved(descriptor, false)
    }
    const ref = parseHandle(value)
    if (ref !== null) {
      const own = resolveRef(ref)
      if (own !== null) return own
      const inherited = legacy === null ? null : legacy(value)
      return inherited === null ? null : resolved(inherited, true)
    }
    if (parent !== null) {
      const inherited = parent.resolveString(value)
      if (inherited !== null) return inherited
    }
    const fallback = legacy === null ? null : legacy(value)
    return fallback === null ? null : resolved(fallback, true)
  }

  /** @param {ArtResourceChange} change */
  function notify(change) {
    for (const listener of [...listeners]) {
      try { listener(change) } catch (error) { console.warn('艺术资源变更通知失败', error) }
    }
  }

  /** @param {(change: ArtResourceChange) => void} listener */
  function subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('[dsh-piggy] art resource listener must be a function')
    listeners.add(listener)
    return function () { listeners.delete(listener) }
  }

  /**
   * @param {ArtResourcePackInput} pack
   * @param {{ replace?: boolean }} [options]
   * @returns {readonly ArtResourceDescriptor[]}
   */
  function registerPack(pack, options) {
    if (locked) throw new Error('[dsh-piggy] art resource registry is locked')
    if (pack === null || typeof pack !== 'object') throw new Error('[dsh-piggy] art resource pack must be an object')
    if (!Array.isArray(pack.resources) || pack.resources.length === 0) throw new Error('[dsh-piggy] art resource pack needs resources')
    const namespace = pack.namespace
    const packName = pack.pack
    if (typeof namespace !== 'string' || typeof packName !== 'string' || namespace === '' || packName === '') {
      throw new Error('[dsh-piggy] art resource pack needs namespace/pack')
    }
    const packRevision = pack.revision === undefined ? DEFAULT_PACK_REVISION : String(pack.revision)
    const replace = options?.replace === true
    /** @type {Map<string, ArtResourceDescriptor>} */
    const prepared = new Map()
    for (const declaration of pack.resources) {
      const descriptor = buildDescriptor(declaration, namespace, packName, packRevision)
      const handle = idOf(descriptor)
      if (prepared.has(handle)) throw new Error('[dsh-piggy] duplicate art resource in pack: ' + handle)
      if (records.has(handle) && !replace) throw new Error('[dsh-piggy] duplicate art resource: ' + handle)
      prepared.set(handle, descriptor)
    }
    /** @type {Array<{ key: string, revision: string, previousRevision: string | null, cacheKey: string, previousCacheKey: string | null }>} */
    const changes = []
    for (const [handle, descriptor] of prepared) {
      const previous = records.get(handle)
      records.set(handle, descriptor)
      changes.push(Object.freeze({
        key: descriptor.key,
        revision: descriptor.revision,
        previousRevision: previous === undefined ? null : previous.revision,
        cacheKey: registeredCacheKey(descriptor),
        previousCacheKey: previous === undefined ? null : registeredCacheKey(previous),
      }))
    }
    rebuildShortKeys()
    if (changes.length > 0) notify(Object.freeze({ namespace: namespace, pack: packName, changes: Object.freeze(changes) }))
    return Object.freeze([...prepared.values()])
  }

  return { registerPack, resolveRef, resolveString, subscribe, records, parent, lock: function () { locked = true } }
}

/** @type {WeakMap<ArtResourceRegistry, RegistryState>} */
const STATE_OF = new WeakMap()

/** @param {RegistryState} state @param {boolean} readonly @returns {ArtResourceRegistry} */
function publicRegistry(state, readonly) {
  /** @type {ArtResourceRegistry} */
  const api = {
    readonly: readonly,
    registerPack: readonly
      ? function () { throw new Error('[dsh-piggy] the default art resource registry is read-only') }
      : state.registerPack,
    resolve: function (value) {
      if (typeof value === 'string') return state.resolveString(value)
      if (value !== null && typeof value === 'object') return state.resolveRef(value)
      return null
    },
    resolveRef: state.resolveRef,
    resolveString: state.resolveString,
    list: function (options) {
      const kind = options?.kind
      const includeParent = options?.includeParent !== false
      /** @type {Map<string, ResolvedArtResource>} */
      const found = new Map()
      for (const descriptor of state.records.values()) {
        if (kind !== undefined && descriptor.kind !== kind) continue
        found.set(idOf(descriptor), resolved(descriptor, false))
      }
      if (includeParent && state.parent !== null) {
        for (const entry of state.parent.list({ kind: kind, includeParent: true })) {
          if (!found.has(entry.id)) found.set(entry.id, entry)
        }
      }
      return Object.freeze([...found.values()])
    },
    has: function (value) {
      const entry = typeof value === 'string' ? state.resolveString(value) : state.resolveRef(value)
      return entry !== null && entry.exists
    },
    subscribe: state.subscribe,
  }
  STATE_OF.set(api, state)
  return Object.freeze(api)
}

/**
 * Turn a writable registry into its read-only public form. Used by the default
 * adapter after its action pack is installed; the original writable object
 * keeps its own state but is no longer exposed.
 * @param {ArtResourceRegistry} registry
 * @returns {ArtResourceRegistry}
 */
export function sealArtResourceRegistry(registry) {
  const state = STATE_OF.get(registry)
  if (state === undefined) throw new Error('[dsh-piggy] unknown art resource registry')
  state.lock()
  return publicRegistry(state, true)
}

/**
 * Registry core. `legacy` is the only hook the URL adapter supplies: it turns
 * an unknown/legacy string into a frozen legacy descriptor (or null). The
 * `buildDescriptor` hook validates one declaration before any map mutation.
 * A parent must already be read-only: this registry notifies only its own
 * records, so accepting a writable parent would silently miss parent changes.
 * @param {{
 *   parent?: ArtResourceRegistry | null,
 *   legacy?: ((key: string) => ArtResourceDescriptor | null) | null,
 *   buildDescriptor: ArtResourceBuilder,
 * }} options
 * @returns {ArtResourceRegistry}
 */
export function createArtResourceRegistryBase(options) {
  if (typeof options.buildDescriptor !== 'function') throw new Error('[dsh-piggy] art resource builder is required')
  const parent = options.parent ?? null
  if (parent !== null && (typeof parent !== 'object' || typeof parent.resolveRef !== 'function' || typeof parent.resolveString !== 'function')) {
    throw new Error('[dsh-piggy] invalid art resource parent registry')
  }
  if (parent !== null && parent.readonly !== true) {
    throw new Error('[dsh-piggy] art resource parent registry must be read-only')
  }
  const legacy = typeof options.legacy === 'function' ? options.legacy : null
  return publicRegistry(createState(parent, legacy, options.buildDescriptor), false)
}
