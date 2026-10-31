// @ts-check
/**
 * 旧扁平存档与“主人资源 + 每猪本体”之间的无损适配层。
 *
 * 纯 core 仍收到它熟悉的一个扁平对象；这个对象只是 facade：
 * - 主人路径的读写落到 OwnerAuthority 的 canonical resources；
 * - 猪路径的读写落到当前 PigTarget.body；
 * - 未裁决字段留在主人文档的 legacy-opaque 桶里，只保留一份，不按猪复制。
 *
 * 这里不是第二个资源权威，也不缓存每猪资源。真正提交/回滚由
 * store/owner-resources.js 的事务负责。
 *
 * @module dsh-piggy/store/legacy-state
 */
import { isDeepStrictEqual } from 'node:util'

import {
  FORMAT_PATHS,
  MIXED_CONTAINER_KEYS,
  MIXED_CONTAINER_RULES,
  OWNER_TOP_LEVEL_KEYS,
  PIG_TOP_LEVEL_KEYS,
  isFormatKey,
  isMixedContainer,
  isOwnerTopLevel,
  isPigTopLevel,
} from './state-ownership.js'

/** @param {unknown} value */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
const clone = value => structuredClone(value)
/** @param {Record<string, unknown>} object @param {string} key */
const hasOwn = (object, key) => Object.hasOwn(object, key)
/** @param {Record<string, unknown>} object @param {string} key */
const getOwn = (object, key) => Object.getOwnPropertyDescriptor(object, key)?.value
/**
 * Define an own data property even for `__proto__`/`constructor` keys coming
 * from an old save. Plain assignment would hit the prototype setter.
 * @param {Record<string, unknown>} object @param {string} key @param {unknown} value
 */
function put(object, key, value) {
  Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true })
}
/** @param {unknown} value @returns {Record<string, unknown>|null} */
const asRecord = value => isObject(value) ? /** @type {Record<string, unknown>} */ (value) : null
const OPAQUE_WRITE_ERROR = 'undeclared owner namespace is read-only for this target; declare ownership before writing it'

/** @param {unknown} value @returns {unknown} */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value
  const record = /** @type {Record<string, unknown>|unknown[]} */ (value)
  for (const key of Object.keys(record)) deepFreeze(/** @type {Record<string, unknown>} */ (record)[key])
  return Object.freeze(value)
}

/**
 * Read-only projection of an undeclared legacy namespace for a non-legacy
 * multi-target context. It is a frozen copy, not a writable per-pig resource
 * and never written back to the owner.
 * @param {unknown} value
 * @returns {unknown}
 */
function readonlyProjection(value) {
  if (value === null || typeof value !== 'object') return value
  return deepFreeze(structuredClone(value))
}
const LEGACY_VIEW = Symbol('dsh-piggy-legacy-view')
/** @param {unknown} value */
export const isLegacyView = value => isObject(value) && /** @type {Record<symbol, unknown>} */ (value)[LEGACY_VIEW] === true

/**
 * @typedef {object} SplitLegacyState
 * @property {Record<string, unknown>} resources
 * @property {Record<string, unknown>} body
 * @property {Record<string, unknown>} opaque
 * @property {Record<string, unknown>} format
 */

/**
 * 把一份旧 v15 扁平状态拆成主人资源、单猪本体、legacy-opaque 和格式元数据。
 * 只在这里做一次深层复制；之后 canonical 对象就是唯一可写集合。
 * @param {Record<string, unknown>} state
 * @returns {SplitLegacyState}
 */
export function splitLegacyState(state) {
  if (!isObject(state)) throw new TypeError('legacy state must be a plain object')
  /** @type {Record<string, unknown>} */
  const resources = {}
  /** @type {Record<string, unknown>} */
  const body = {}
  /** @type {Record<string, unknown>} */
  const opaque = {}
  /** @type {Record<string, unknown>} */
  const format = {}
  for (const key of Object.keys(state)) {
    const value = state[key]
    if (isFormatKey(key)) {
      format[key] = clone(value)
      continue
    }
    if (isMixedContainer(key)) {
      splitMixed(key, value, resources, body, opaque)
      continue
    }
    if (isOwnerTopLevel(key)) {
      resources[key] = clone(value)
      continue
    }
    if (isPigTopLevel(key)) {
      body[key] = clone(value)
      continue
    }
    put(opaque, key, clone(value))
  }
  return { resources, body, opaque, format }
}

/**
 * @param {string} container
 * @param {unknown} value
 * @param {Record<string, unknown>} resources
 * @param {Record<string, unknown>} body
 * @param {Record<string, unknown>} opaque
 */
function splitMixed(container, value, resources, body, opaque) {
  const source = asRecord(value)
  if (source === null) {
    // 坏形状不丢：整块保留为不透明数据，等 core 的 ensureXxx 正常修复。
    put(opaque, container, clone(value))
    return
  }
  const ownerKeys = new Set(MIXED_CONTAINER_RULES[container].owner)
  const pigKeys = new Set(MIXED_CONTAINER_RULES[container].pig)
  /** @type {Record<string, unknown>} */
  const ownerPart = {}
  /** @type {Record<string, unknown>} */
  const pigPart = {}
  /** @type {Record<string, unknown>} */
  const unknownPart = {}
  for (const [key, item] of Object.entries(source)) {
    if (ownerKeys.has(key)) put(ownerPart, key, clone(item))
    else if (pigKeys.has(key)) put(pigPart, key, clone(item))
    else put(unknownPart, key, clone(item))
  }
  if (Object.keys(ownerPart).length > 0 || (Object.keys(pigPart).length === 0 && Object.keys(unknownPart).length === 0)) {
    resources[container] = ownerPart
  }
  if (Object.keys(pigPart).length > 0) body[container] = pigPart
  if (Object.keys(unknownPart).length > 0) opaque[container] = unknownPart
}

/**
 * 把 canonical 部分组合回一份普通扁平状态。只用于无损 round-trip / 快照，
 * 不直接给 core 写入；core 写的是 live facade。
 * @param {{resources?: Record<string, unknown>, body?: Record<string, unknown>, opaque?: Record<string, unknown>, format?: Record<string, unknown>}} parts
 * @returns {Record<string, unknown>}
 */
export function composeLegacyState(parts) {
  const resources = parts.resources ?? {}
  const body = parts.body ?? {}
  const opaque = parts.opaque ?? {}
  const format = parts.format ?? {}
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const key of FORMAT_PATHS) if (hasOwn(format, key)) out[key] = clone(format[key])
  for (const key of OWNER_TOP_LEVEL_KEYS) if (hasOwn(resources, key)) out[key] = clone(resources[key])
  for (const key of PIG_TOP_LEVEL_KEYS) if (hasOwn(body, key)) out[key] = clone(body[key])
  for (const key of MIXED_CONTAINER_KEYS) {
    const mixed = composeMixed(key, resources[key], body[key], opaque[key])
    if (mixed !== undefined) out[key] = mixed
  }
  for (const key of Object.keys(opaque)) {
    if (!isMixedContainer(key)) put(out, key, clone(opaque[key]))
  }
  return out
}

/**
 * @param {string} container
 * @param {unknown} resourcesPart
 * @param {unknown} bodyPart
 * @param {unknown} opaquePart
 * @returns {unknown}
 */
function composeMixed(container, resourcesPart, bodyPart, opaquePart) {
  const owner = asRecord(resourcesPart)
  const pig = asRecord(bodyPart)
  const opaque = asRecord(opaquePart)
  if (owner === null && pig === null && opaque === null) {
    return opaquePart === undefined ? undefined : clone(opaquePart)
  }
  const ownerKnown = new Set(MIXED_CONTAINER_RULES[container].owner)
  const pigKnown = new Set(MIXED_CONTAINER_RULES[container].pig)
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [key, value] of Object.entries(owner ?? {})) if (ownerKnown.has(key)) put(out, key, clone(value))
  for (const [key, value] of Object.entries(pig ?? {})) if (pigKnown.has(key)) put(out, key, clone(value))
  for (const [key, value] of Object.entries(owner ?? {})) if (!ownerKnown.has(key) && !hasOwn(out, key)) put(out, key, clone(value))
  for (const [key, value] of Object.entries(pig ?? {})) if (!pigKnown.has(key) && !hasOwn(out, key)) put(out, key, clone(value))
  for (const [key, value] of Object.entries(opaque ?? {})) if (!hasOwn(out, key)) put(out, key, clone(value))
  return out
}

/**
 * Live flat facade。返回的 view 是稳定的普通对象：属性访问器把主人路径写到
 * `getResources()`，猪路径写到 `getBody()`；未知路径写到 legacy-opaque。
 *
 * `sync()` 把调用方直接塞进 facade 的未声明属性搬回 canonical/opaque 桶，
 * 使“直接 store.state.foo = ... 后再保存”仍不丢数据。
 *
 * @param {{
 *   getResources: () => Record<string, unknown>,
 *   getBody: () => Record<string, unknown>|null,
 *   getOpaque: () => Record<string, unknown>,
 *   getFormat: () => Record<string, unknown>,
 *   base?: Record<string, unknown>|null,
 *   opaqueWritable?: boolean,
 * }} options
 * @returns {{view: Record<string, unknown>|null, sync: () => void}}
 */
export function createLegacyStateAdapter({ getResources, getBody, getOpaque, getFormat, base = null, opaqueWritable = true }) {
  // Capture the canonical objects this view was built from. A later whole-state
  // replacement creates a new adapter and new canonical objects, so old facade
  // references stay detached (like the old store.state object) instead of
  // silently following another pig's body or a new save.
  const resourcesRef = getResources()
  const bodyRef = getBody()
  if (bodyRef === null) return { view: null, sync: () => {} }
  const opaqueRef = getOpaque()
  const formatRef = getFormat()

  const snapshot = composeLegacyState({
    resources: resourcesRef,
    body: bodyRef,
    opaque: opaqueRef,
    format: formatRef,
  })
  /** @type {string[]} */
  const keys = []
  if (isObject(base)) for (const key of Object.keys(base)) keys.push(key)
  for (const key of Object.keys(snapshot)) if (!keys.includes(key)) keys.push(key)

  /** @type {Record<string, unknown>} */
  let view = isObject(base) ? /** @type {Record<string, unknown>} */ (base) : {}
  /** @type {Map<string, PropertyDescriptor>} */
  const topDescriptors = new Map()
  /** @type {Map<string, ReturnType<typeof createMixedAdapter>>} */
  const mixedAdapters = new Map()

  if (isObject(base)) {
    for (const key of Object.keys(view)) {
      if (!Reflect.deleteProperty(view, key)) throw new TypeError(`legacy state property is not configurable: ${key}`)
    }
  }

  /**
   * @param {string} container
   */
  function mixedAdapter(container) {
    const existing = mixedAdapters.get(container)
    if (existing !== undefined) return existing
    const created = createMixedAdapter(container, {
      getResources: () => resourcesRef,
      getBody: () => bodyRef,
      getOpaque: () => opaqueRef,
      opaqueWritable,
    })
    mixedAdapters.set(container, created)
    return created
  }

  /**
   * @param {string} key
   */
  function defineTop(key) {
    if (topDescriptors.has(key)) return
    let descriptor
    if (isMixedContainer(key)) {
      const adapter = mixedAdapter(key)
      descriptor = {
        enumerable: true,
        configurable: true,
        get() {
          adapter.sync()
          const raw = opaqueRef[key]
          if (!isObject(raw) && !isObject(resourcesRef[key]) && !isObject(bodyRef[key])) {
            return opaqueWritable ? raw : readonlyProjection(raw)
          }
          return adapter.view
        },
        set(value) { adapter.assign(value) },
      }
    } else if (isOwnerTopLevel(key)) {
      descriptor = {
        enumerable: true,
        configurable: true,
        get() { return resourcesRef[key] },
        set(value) { resourcesRef[key] = value },
      }
    } else if (isPigTopLevel(key)) {
      descriptor = {
        enumerable: true,
        configurable: true,
        get() { return bodyRef[key] },
        set(value) { bodyRef[key] = value },
      }
    } else if (isFormatKey(key)) {
      descriptor = {
        enumerable: true,
        configurable: true,
        get() { return formatRef[key] },
        set(value) { formatRef[key] = value },
      }
    } else {
      descriptor = {
        enumerable: true,
        configurable: true,
        get() {
          const value = getOwn(opaqueRef, key)
          return opaqueWritable ? value : readonlyProjection(value)
        },
        set(value) {
          if (!opaqueWritable) throw new Error(OPAQUE_WRITE_ERROR)
          put(opaqueRef, key, value)
        },
      }
    }
    topDescriptors.set(key, descriptor)
    Object.defineProperty(view, key, descriptor)
  }

  for (const key of keys) defineTop(key)
  if (!Object.hasOwn(view, LEGACY_VIEW)) Object.defineProperty(view, LEGACY_VIEW, { value: true, enumerable: false, configurable: false })

  /** @param {string} key */
  function descriptorIntact(key) {
    const descriptor = topDescriptors.get(key)
    if (descriptor === undefined) return false
    const own = Object.getOwnPropertyDescriptor(view, key)
    return own !== undefined && own.get === descriptor.get && own.set === descriptor.set
  }

  function sync() {
    if (!opaqueWritable) {
      const forbidden = Object.keys(view).filter(key =>
        !descriptorIntact(key) &&
        !isOwnerTopLevel(key) && !isPigTopLevel(key) && !isFormatKey(key) && !isMixedContainer(key))
      if (forbidden.length > 0) {
        for (const key of forbidden) Reflect.deleteProperty(view, key)
        throw new Error(OPAQUE_WRITE_ERROR)
      }
    }
    for (const adapter of mixedAdapters.values()) adapter.sync()
    // A legacy consumer (notably store/ext-install.js rollback) may delete every
    // own key and then Object.assign a plain snapshot back onto this facade.
    // That removes our accessors and leaves data properties. Re-route those
    // values to canonical resources/body/opaque and restore the accessors.
    for (const key of Object.keys(view)) {
      if (descriptorIntact(key)) continue
      const value = view[key]
      if (isMixedContainer(key)) {
        Reflect.deleteProperty(view, key)
        const adapter = mixedAdapter(key)
        adapter.assign(value)
        topDescriptors.delete(key)
        defineTop(key)
      } else {
        if (isOwnerTopLevel(key)) resourcesRef[key] = value
        else if (isPigTopLevel(key)) bodyRef[key] = value
        else if (isFormatKey(key)) formatRef[key] = value
        else put(opaqueRef, key, value)
        Reflect.deleteProperty(view, key)
        topDescriptors.delete(key)
        defineTop(key)
      }
    }
    // A core function may delete one top-level property (`delete state.birthday`
    // in egg/profile). With an accessor that removes only the facade property,
    // so mirror the deletion into canonical and leave the property absent.
    for (const key of [...topDescriptors.keys()]) {
      if (Object.getOwnPropertyDescriptor(view, key) !== undefined) continue
      const unknown = !isOwnerTopLevel(key) && !isPigTopLevel(key) && !isFormatKey(key) && !isMixedContainer(key)
      if (!opaqueWritable && isMixedContainer(key)) {
        const previousOpaque = opaqueRef[key]
        const opaquePart = asRecord(previousOpaque)
        if (previousOpaque !== undefined && (opaquePart === null || Object.keys(opaquePart).length > 0)) {
          topDescriptors.delete(key)
          defineTop(key)
          throw new Error(OPAQUE_WRITE_ERROR)
        }
      } else if (!opaqueWritable && unknown) {
        topDescriptors.delete(key)
        defineTop(key)
        throw new Error(OPAQUE_WRITE_ERROR)
      }
      if (isMixedContainer(key)) mixedAdapter(key).clear()
      else if (isOwnerTopLevel(key)) delete resourcesRef[key]
      else if (isPigTopLevel(key)) delete bodyRef[key]
      else if (isFormatKey(key)) delete formatRef[key]
      else delete opaqueRef[key]
      topDescriptors.delete(key)
    }
  }

  return { view, sync }
}

/**
 * 混合容器（economy/fishing）的稳定 facade。已知子路径按声明路由，
 * 未声明子路径保留到 opaque[container]，绝不默认复制或猜测归属。
 *
 * @param {string} container
 * @param {{
 *   getResources: () => Record<string, unknown>,
 *   getBody: () => Record<string, unknown>|null,
 *   getOpaque: () => Record<string, unknown>,
 *   opaqueWritable?: boolean,
 * }} deps
 * @returns {{view: Record<string, unknown>, sync: () => void, assign: (value: unknown) => void, clear: () => void}}
 */
function createMixedAdapter(container, deps) {
  const rule = MIXED_CONTAINER_RULES[container]
  const ownerKnown = new Set(rule.owner)
  const pigKnown = new Set(rule.pig)
  const opaqueWritable = deps.opaqueWritable !== false
  /** @type {Record<string, unknown>} */
  const view = {}
  /** @type {Map<string, PropertyDescriptor>} */
  const descriptors = new Map()

  /** @returns {Record<string, unknown>|null} */
  function ownerPart() { return asRecord(deps.getResources()[container]) }
  /** @returns {Record<string, unknown>|null} */
  function pigPart() { return asRecord((deps.getBody() ?? {})[container]) }
  /** @returns {Record<string, unknown>|null} */
  function opaquePart() { return asRecord(deps.getOpaque()[container]) }

  /** @param {'owner'|'pig'|'opaque'} part @param {string} key */
  function read(part, key) {
    const object = part === 'owner' ? ownerPart() : part === 'pig' ? pigPart() : opaquePart()
    const value = object === null ? undefined : getOwn(object, key)
    return part === 'opaque' && !opaqueWritable ? readonlyProjection(value) : value
  }

  /** @param {'owner'|'pig'|'opaque'} part @param {string} key @param {unknown} value */
  function write(part, key, value) {
    if (part === 'opaque' && !opaqueWritable) throw new Error(OPAQUE_WRITE_ERROR)
    if (part === 'owner') {
      const root = deps.getResources()
      const current = asRecord(root[container])
      if (current === null) {
        /** @type {Record<string, unknown>} */
        const next = {}
        put(next, key, value)
        root[container] = next
      } else put(current, key, value)
      return
    }
    if (part === 'pig') {
      const currentBody = deps.getBody()
      if (currentBody === null) return
      const current = asRecord(currentBody[container])
      if (current === null) {
        /** @type {Record<string, unknown>} */
        const next = {}
        put(next, key, value)
        currentBody[container] = next
      } else put(current, key, value)
      return
    }
    const root = deps.getOpaque()
    const current = asRecord(root[container])
    if (current === null) {
      /** @type {Record<string, unknown>} */
      const next = {}
      put(next, key, value)
      root[container] = next
    } else put(current, key, value)
  }

  /** @param {string} key @returns {'owner'|'pig'|'opaque'} */
  function route(key) {
    if (ownerKnown.has(key)) return 'owner'
    if (pigKnown.has(key)) return 'pig'
    if (ownerPart() !== null && hasOwn(ownerPart() ?? {}, key)) return 'owner'
    if (pigPart() !== null && hasOwn(pigPart() ?? {}, key)) return 'pig'
    return 'opaque'
  }

  function rebuild() {
    const keys = []
    if (rule.materializeKnownKeys !== false) {
      for (const key of rule.owner) keys.push(key)
      for (const key of rule.pig) keys.push(key)
    }
    for (const part of [ownerPart(), pigPart(), opaquePart()]) {
      if (part === null) continue
      for (const key of Object.keys(part)) if (!keys.includes(key)) keys.push(key)
    }
    for (const key of Object.keys(view)) Reflect.deleteProperty(view, key)
    descriptors.clear()
    for (const key of keys) {
      const part = route(key)
      const descriptor = {
        enumerable: true,
        configurable: true,
        get() { return read(part, key) },
        set(value) { write(part, key, value) },
      }
      descriptors.set(key, descriptor)
      Object.defineProperty(view, key, descriptor)
    }
  }

  /** @param {'owner'|'pig'|'opaque'} part @param {string} key */
  function remove(part, key) {
    if (part === 'owner') {
      const current = ownerPart()
      if (current !== null) delete current[key]
      return
    }
    if (part === 'pig') {
      const current = pigPart()
      if (current !== null) delete current[key]
      return
    }
    const current = opaquePart()
    if (current !== null) delete current[key]
  }

  /** @param {string} key */
  function descriptorIntact(key) {
    const descriptor = descriptors.get(key)
    if (descriptor === undefined) return false
    const own = Object.getOwnPropertyDescriptor(view, key)
    return own !== undefined && own.get === descriptor.get && own.set === descriptor.set
  }

  function sync() {
    let changed = false
    if (!opaqueWritable) {
      const forbidden = Object.keys(view).filter(key => !descriptorIntact(key) && !ownerKnown.has(key) && !pigKnown.has(key))
      if (forbidden.length > 0) {
        for (const key of forbidden) Reflect.deleteProperty(view, key)
        throw new Error(OPAQUE_WRITE_ERROR)
      }
    }
    for (const key of Object.keys(view)) {
      if (descriptorIntact(key)) continue
      const value = view[key]
      write(route(key), key, value)
      Reflect.deleteProperty(view, key)
      descriptors.delete(key)
      changed = true
    }
    let forbiddenMissing = false
    for (const key of [...descriptors.keys()]) {
      if (Object.getOwnPropertyDescriptor(view, key) !== undefined) continue
      if (!opaqueWritable && !ownerKnown.has(key) && !pigKnown.has(key)) {
        forbiddenMissing = true
        continue
      }
      remove(route(key), key)
      changed = true
    }
    if (forbiddenMissing) changed = true
    if (changed) rebuild()
    if (forbiddenMissing) throw new Error(OPAQUE_WRITE_ERROR)
  }

  /** @param {unknown} value */
  function assign(value) {
    if (value === view) { sync(); return }
    if (!opaqueWritable) {
      const previousOpaque = deps.getOpaque()[container]
      if (previousOpaque !== undefined && !isObject(previousOpaque)) throw new Error(OPAQUE_WRITE_ERROR)
    }
    if (!isObject(value)) {
      if (!opaqueWritable) throw new Error(OPAQUE_WRITE_ERROR)
      put(deps.getOpaque(), container, value)
      delete deps.getResources()[container]
      const currentBody = deps.getBody()
      if (currentBody !== null) delete currentBody[container]
      rebuild()
      return
    }
    /** @type {Record<string, unknown>} */
    const owner = {}
    /** @type {Record<string, unknown>} */
    const pig = {}
    /** @type {Record<string, unknown>} */
    const opaque = {}
    for (const [key, item] of Object.entries(value)) {
      if (ownerKnown.has(key)) put(owner, key, item)
      else if (pigKnown.has(key)) put(pig, key, item)
      else put(opaque, key, item)
    }
    if (!opaqueWritable) {
      const previousOpaque = asRecord(deps.getOpaque()[container])
      const incomingKeys = Object.keys(opaque)
      if (incomingKeys.length > 0) {
        // A normalizer (e.g. ensureEconomy) may emit the existing opaque fields
        // back unchanged. Accept that projection but keep the canonical legacy
        // values rather than letting B write/replace the namespace. Any added,
        // removed or changed opaque key is refused.
        if (previousOpaque === null || Object.keys(previousOpaque).length !== incomingKeys.length) {
          throw new Error(OPAQUE_WRITE_ERROR)
        }
        for (const key of incomingKeys) {
          if (!hasOwn(previousOpaque, key) || !isDeepStrictEqual(getOwn(opaque, key), getOwn(previousOpaque, key))) {
            throw new Error(OPAQUE_WRITE_ERROR)
          }
        }
        for (const key of incomingKeys) Reflect.deleteProperty(opaque, key)
        for (const [key, item] of Object.entries(previousOpaque)) put(opaque, key, item)
      } else if (previousOpaque !== null) {
        // Known-only assignments are allowed but cannot delete legacy opaque
        // keys, including when the target is B.
        for (const [key, item] of Object.entries(previousOpaque)) put(opaque, key, item)
      }
    }
    if (Object.keys(owner).length > 0 || (Object.keys(pig).length === 0 && Object.keys(opaque).length === 0)) {
      deps.getResources()[container] = owner
    } else delete deps.getResources()[container]
    const currentBody = deps.getBody()
    if (currentBody !== null) {
      if (Object.keys(pig).length > 0) currentBody[container] = pig
      else delete currentBody[container]
    }
    if (Object.keys(opaque).length > 0) deps.getOpaque()[container] = opaque
    else delete deps.getOpaque()[container]
    rebuild()
  }

  function clear() {
    if (!opaqueWritable) {
      const previousRaw = deps.getOpaque()[container]
      const previousOpaque = asRecord(previousRaw)
      if (previousRaw !== undefined && (previousOpaque === null || Object.keys(previousOpaque).length > 0)) {
        throw new Error(OPAQUE_WRITE_ERROR)
      }
    }
    delete deps.getResources()[container]
    const currentBody = deps.getBody()
    if (currentBody !== null) delete currentBody[container]
    delete deps.getOpaque()[container]
    rebuild()
  }

  rebuild()
  return { view, sync, assign, clear }
}
