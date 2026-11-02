// @ts-check
/**
 * Legacy art URL adapter, the read-only default registry and the public
 * resource API consumed by selection/player/skin normalization.
 *
 * Every existing string keeps its old URL and cache semantics here; the
 * registry core lives in `art-resources.js` and never invents remote sources.
 * @module dsh-piggy/client/art-path
 */
import { PIG_ART_ASSETS } from '../../packages/pet-core/src/data/art-assets.js'
import { PIG_ART_REVISIONS } from '../../packages/pet-core/src/data/art-revisions.js'
import { builtinArtPath } from './art-style.js'
import { customArtVersion } from './custom-art.js'
import { ART_RESOURCE_SCHEMA, LEGACY_NAMESPACE, createArtResourceRegistryBase, sealArtResourceRegistry } from './art-resources.js'

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,63}$/
const KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/
const CUSTOM_KEY = /^custom-[a-z0-9-]{1,41}$/
const SOURCE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}\.(?:png|svg|webp)$/
const SAFE_ART_STRING = /^[A-Za-z0-9._/@-]+$/
const LEGACY_ELIGIBILITY = Object.freeze({
  art: 'piglet',
  stageNot: Object.freeze(['box', 'grave', 'dead-day']),
  absent: Object.freeze(['activity', 'idle', 'illness']),
  moodNot: Object.freeze(['sick', 'dirty', 'sleepy', 'dead', 'hungry', 'lonely']),
  react: Object.freeze([]),
  party: false,
})

/** @param {unknown} value @param {string} label @returns {string} */
function token(value, label) {
  if (typeof value !== 'string' || !TOKEN.test(value)) throw new Error('[dsh-piggy] invalid art resource ' + label)
  return value
}

/** @param {unknown} value @param {string} label @returns {string} */
function resourceKey(value, label) {
  if (typeof value !== 'string' || value === '' || value.length > 200 || value.startsWith('/')
    || value.endsWith('/') || value.includes('..') || value.includes('//') || !KEY.test(value)) {
    throw new Error('[dsh-piggy] invalid art resource ' + label)
  }
  return value
}

/** @param {unknown} value @returns {string} */
function revisionString(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) throw new Error('[dsh-piggy] invalid art resource revision')
    return String(value)
  }
  if (typeof value !== 'string' || value === '' || value.length > 128 || !/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error('[dsh-piggy] invalid art resource revision')
  }
  return value
}

/** @param {unknown} value @returns {import('./art-resources.js').ArtResourceSource} */
function normalizeSource(value) {
  if (value === null || typeof value !== 'object') throw new Error('[dsh-piggy] art resource source must be an object')
  const source = /** @type {import('./art-resources.js').ArtResourceSourceInput} */ (value)
  if (source.scheme === 'builtin') {
    if (typeof source.key !== 'string' || !Object.hasOwn(PIG_ART_ASSETS, source.key)) {
      throw new Error('[dsh-piggy] builtin art resource key is not in PIG_ART_ASSETS')
    }
    const path = builtinArtPath(source.key)
    if (path === undefined || PIG_ART_REVISIONS[source.key] === undefined) {
      throw new Error('[dsh-piggy] builtin art resource has no path/revision')
    }
    return Object.freeze({ scheme: 'builtin', key: source.key, path: path })
  }
  if (source.scheme === 'custom') {
    if (typeof source.key !== 'string' || !CUSTOM_KEY.test(source.key)) throw new Error('[dsh-piggy] invalid custom art resource key')
    return Object.freeze({ scheme: 'custom', key: source.key, path: source.key })
  }
  if (source.scheme === 'path') {
    if (typeof source.path !== 'string' || source.path.length > 256 || source.path.startsWith('/')
      || source.path.includes('..') || source.path.includes('//') || source.path.includes('\\')
      || source.path.includes('?') || source.path.includes('#') || !SOURCE_PATH.test(source.path)) {
      throw new Error('[dsh-piggy] invalid art resource path')
    }
    return Object.freeze({ scheme: 'path', path: source.path })
  }
  throw new Error('[dsh-piggy] unsupported art resource source scheme')
}

/** @param {unknown} value @param {boolean} [allowEmpty] @returns {readonly string[]} */
function tokenList(value, allowEmpty = false) {
  if (!Array.isArray(value)) throw new Error('[dsh-piggy] art eligibility lists must be arrays')
  const list = value.map(item => {
    if (typeof item !== 'string' || (!(allowEmpty && item === '') && !/^[a-z0-9-]{1,64}$/.test(item))) {
      throw new Error('[dsh-piggy] invalid art eligibility token')
    }
    return item
  })
  return Object.freeze(list)
}

/** @param {unknown} value @returns {readonly [number, number, number] | null} */
function normalizeFrame(value) {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value) || value.length !== 3) throw new Error('[dsh-piggy] art resource frame must have three numbers')
  const frame = value.map(Number)
  if (!frame.every(Number.isFinite)) throw new Error('[dsh-piggy] art resource frame must have three finite numbers')
  return Object.freeze(/** @type {[number, number, number]} */ ([frame[0], frame[1], frame[2]]))
}

/** @param {unknown} value @returns {import('./art-resources.js').ArtEligibility | null} */
function normalizeEligibility(value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('[dsh-piggy] art eligibility must be an object')
  const input = /** @type {import('./art-resources.js').ArtEligibility} */ (value)
  for (const name of Object.keys(input)) {
    if (!['art', 'stageNot', 'absent', 'react', 'moodNot', 'party'].includes(name)) {
      throw new Error('[dsh-piggy] unsupported art eligibility field: ' + name)
    }
  }
  /** @type {{ art?: string, stageNot?: readonly string[], absent?: readonly string[], react?: readonly string[], moodNot?: readonly string[], party?: boolean }} */
  const out = {}
  if (input.art !== undefined) out.art = resourceKey(input.art, 'eligibility art')
  if (input.stageNot !== undefined) out.stageNot = tokenList(input.stageNot)
  if (input.absent !== undefined) out.absent = tokenList(input.absent)
  if (input.react !== undefined) out.react = tokenList(input.react, true)
  if (input.moodNot !== undefined) out.moodNot = tokenList(input.moodNot)
  if (input.party !== undefined) {
    if (typeof input.party !== 'boolean') throw new Error('[dsh-piggy] art eligibility party must be a boolean')
    out.party = input.party
  }
  return Object.freeze(out)
}

/** @param {unknown} value @returns {import('./art-resources.js').ArtResourceRef | null} */
function normalizeFallback(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') {
    return Object.freeze({ namespace: LEGACY_NAMESPACE, pack: 'actions', key: resourceKey(value, 'fallback key'), revision: '' })
  }
  if (typeof value !== 'object') throw new Error('[dsh-piggy] art resource fallback must be a reference or action key')
  const input = /** @type {import('./art-resources.js').ArtResourceRefInput} */ (value)
  return Object.freeze({
    namespace: token(input.namespace, 'fallback namespace'),
    pack: token(input.pack, 'fallback pack'),
    key: resourceKey(input.key, 'fallback key'),
    revision: input.revision === undefined ? '' : revisionString(input.revision),
  })
}

/**
 * Validate one declaration completely, then return a frozen descriptor. The
 * registry only starts committing after every declaration in the pack passed
 * this function, so a bad entry cannot half-install.
 * @type {import('./art-resources.js').ArtResourceBuilder}
 */
function buildDescriptor(declaration, namespace, pack, packRevision) {
  if (declaration === null || typeof declaration !== 'object') throw new Error('[dsh-piggy] art resource must be an object')
  for (const name of Object.keys(declaration)) {
    if (!['key', 'kind', 'source', 'revision', 'frame', 'duration', 'eligibility', 'fallback'].includes(name)) {
      throw new Error('[dsh-piggy] unsupported art resource field: ' + name)
    }
  }
  const ns = token(namespace, 'namespace')
  const packName = token(pack, 'pack')
  const key = resourceKey(declaration.key, 'key')
  const kind = declaration.kind ?? 'art'
  if (!['art', 'action', 'skin'].includes(kind)) throw new Error('[dsh-piggy] unsupported art resource kind')
  const source = normalizeSource(declaration.source)
  const revision = source.scheme === 'builtin'
    ? PIG_ART_REVISIONS[source.key] ?? ''
    : revisionString(declaration.revision === undefined ? packRevision : declaration.revision)
  if (revision === '') throw new Error('[dsh-piggy] art resource needs a non-empty revision')

  /** @type {number | null} */
  let duration = null
  if (declaration.duration !== undefined) {
    if (!Number.isFinite(declaration.duration) || declaration.duration <= 0) throw new Error('[dsh-piggy] art action duration must be positive')
    duration = declaration.duration
  }
  if (kind === 'action' && duration === null) throw new Error('[dsh-piggy] art action needs a duration')
  if (kind !== 'action' && duration !== null) throw new Error('[dsh-piggy] duration is only valid for art actions')

  const eligibility = normalizeEligibility(declaration.eligibility)
  if (kind !== 'action' && eligibility !== null) throw new Error('[dsh-piggy] eligibility is only valid for art actions')
  const fallback = normalizeFallback(declaration.fallback)
  if (kind !== 'action' && fallback !== null) throw new Error('[dsh-piggy] fallback is only valid for art actions')

  return Object.freeze({
    namespace: ns,
    pack: packName,
    key: key,
    revision: revision,
    kind: kind,
    source: source,
    frame: normalizeFrame(declaration.frame),
    duration: duration,
    eligibility: eligibility,
    fallback: fallback,
    schema: ART_RESOURCE_SCHEMA,
  })
}

/**
 * The unchanged legacy adapter. Every existing string keeps today's URL:
 * built-in table key -> path + content revision; custom-* -> local version;
 * anything else -> the historical `key + '.svg'` route fallback.
 * @param {string} key
 * @returns {import('./art-resources.js').ArtResourceDescriptor}
 */
function legacyDescriptor(key) {
  const path = builtinArtPath(key)
  if (path !== undefined) {
    return Object.freeze({
      namespace: LEGACY_NAMESPACE,
      pack: 'builtin',
      key: key,
      revision: PIG_ART_REVISIONS[key] ?? '',
      kind: 'art',
      source: Object.freeze({ scheme: 'builtin', key: key, path: path }),
      frame: null,
      duration: null,
      eligibility: null,
      fallback: null,
      schema: ART_RESOURCE_SCHEMA,
    })
  }
  if (key.startsWith('custom-')) {
    const version = customArtVersion(key)
    return Object.freeze({
      namespace: LEGACY_NAMESPACE,
      pack: 'custom',
      key: key,
      revision: version > 0 ? String(version) : '',
      kind: 'art',
      source: Object.freeze({ scheme: 'custom', key: key, path: key }),
      frame: null,
      duration: null,
      eligibility: null,
      fallback: null,
      schema: ART_RESOURCE_SCHEMA,
    })
  }
  return Object.freeze({
    namespace: LEGACY_NAMESPACE,
    pack: 'legacy',
    key: key,
    revision: '',
    kind: 'art',
    source: Object.freeze({ scheme: 'legacy', path: key + '.svg' }),
    frame: null,
    duration: null,
    eligibility: null,
    fallback: null,
    schema: ART_RESOURCE_SCHEMA,
  })
}

const DEFAULT_ACTION_PACK = Object.freeze({
  namespace: LEGACY_NAMESPACE,
  pack: 'actions',
  revision: '1',
  resources: Object.freeze([
    Object.freeze({
      key: 'blink',
      kind: 'action',
      source: Object.freeze({ scheme: 'builtin', key: 'piglet-blink' }),
      duration: 100,
      eligibility: LEGACY_ELIGIBILITY,
    }),
    Object.freeze({
      key: 'shy-pet',
      kind: 'action',
      source: Object.freeze({ scheme: 'builtin', key: 'piglet-shy-pet' }),
      duration: 420,
      eligibility: Object.freeze({ ...LEGACY_ELIGIBILITY, react: Object.freeze(['', 'pet']) }),
    }),
  ]),
})

const defaultState = createArtResourceRegistryBase({ parent: null, legacy: legacyDescriptor, buildDescriptor })
defaultState.registerPack(DEFAULT_ACTION_PACK)
/** Read-only default registry: built-in actions plus the exact legacy adapter. */
export const defaultArtResources = sealArtResourceRegistry(defaultState)

/**
 * Isolated writable registry. It falls back to the read-only default for
 * legacy strings and never mutates the default registry.
 * @param {{ parent?: import('./art-resources.js').ArtResourceRegistry | null }} [options]
 * @returns {import('./art-resources.js').ArtResourceRegistry}
 */
export function createArtResourceRegistry(options) {
  const opts = options ?? {}
  const parent = opts.parent === undefined ? defaultArtResources : opts.parent
  return createArtResourceRegistryBase({ parent: parent, legacy: legacyDescriptor, buildDescriptor })
}

/**
 * Resolve a legacy string, a namespaced `namespace/pack/key[@revision]`
 * handle, or a structured resource reference. Strings keep the historical
 * `.svg` fallback; explicit refs must actually exist.
 * @param {string | import('./art-resources.js').ArtResourceRefInput} value
 * @param {import('./art-resources.js').ArtResourceRegistry} [registry]
 * @returns {import('./art-resources.js').ResolvedArtResource | null}
 */
export function resolveArtResource(value, registry) {
  const target = registry ?? defaultArtResources
  if (typeof value === 'string') return target.resolveString(value)
  if (value !== null && typeof value === 'object') return target.resolveRef(value)
  return null
}

/**
 * Resolve one art key to the URL/cache identity actually consumed by selection
 * and players. Non-string keys keep the old hard failure instead of silently
 * rendering a bogus path.
 * @param {string} key
 * @param {import('./art-resources.js').ArtResourceRegistry} [registry]
 * @returns {import('./art-resources.js').ResolvedArtResource}
 */
export function resolveArtSource(key, registry) {
  if (typeof key !== 'string') throw new TypeError('art key must be a string')
  const entry = resolveArtResource(key, registry)
  if (entry === null) throw new Error('[dsh-piggy] unresolved art resource: ' + key)
  return entry
}

/**
 * The public URL form used by every existing tab and image consumer.
 * @param {string} key
 * @param {import('./art-resources.js').ArtResourceRegistry} [registry]
 */
export function artSource(key, registry) {
  return resolveArtSource(key, registry).url
}

/** Exact legacy table lookup retained for compatibility. */
export function hasBuiltinArt(key) {
  return Object.hasOwn(PIG_ART_ASSETS, key)
}

/**
 * True when the key resolves to a real built-in, custom or explicitly
 * registered resource. The historical `.svg` fallback is not "has art".
 * @param {string} key
 * @param {import('./art-resources.js').ArtResourceRegistry} [registry]
 */
export function hasArtResource(key, registry) {
  return resolveArtSource(key, registry).exists
}

/**
 * Normalize an art string coming from a skin snapshot. Recognized and legacy
 * keys keep their exact current spelling; values that could escape the
 * existing art route or carry a URL/query fall back to ''.
 * @param {unknown} value
 * @param {import('./art-resources.js').ArtResourceRegistry} [registry]
 * @returns {string}
 */
export function normalizeArtKey(value, registry) {
  if (typeof value !== 'string' || value === '' || value.length > 200) return ''
  if (value.startsWith('/') || value.includes('..') || value.includes('//') || value.includes('\\')
    || value.includes('?') || value.includes('#') || !SAFE_ART_STRING.test(value)) return ''
  const target = registry ?? defaultArtResources
  return target.resolveString(value) === null ? '' : value
}

/** Per-pig presentation binding: the art context and the player resolve the same registry. */
/** @type {WeakMap<object, import('./art-resources.js').ArtResourceRegistry>} */
const PIG_RESOURCES = new WeakMap()

/**
 * @param {unknown} pig
 * @param {import('./art-resources.js').ArtResourceRegistry} registry
 */
export function bindArtResources(pig, registry) {
  if (pig !== null && typeof pig === 'object') PIG_RESOURCES.set(pig, registry)
}

/**
 * @param {unknown} pig
 * @param {import('./art-resources.js').ArtResourceRegistry} registry
 */
export function unbindArtResources(pig, registry) {
  if (pig !== null && typeof pig === 'object' && PIG_RESOURCES.get(pig) === registry) PIG_RESOURCES.delete(pig)
}

/**
 * @param {unknown} pig
 * @returns {import('./art-resources.js').ArtResourceRegistry | null}
 */
export function artResourcesForPig(pig) {
  if (pig === null || typeof pig !== 'object') return null
  return PIG_RESOURCES.get(pig) ?? null
}

export { ART_RESOURCE_SCHEMA, LEGACY_NAMESPACE }
