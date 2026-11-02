// @ts-check
/**
 * 只处理 economy/fishing 等已声明混合容器的 live accessor 与 opaque 路由。
 * 资源对象仍由调用方传入，不在这里缓存或替换 owner。
 * @module dsh-piggy/store/legacy-mixed-adapter
 */
import { isDeepStrictEqual } from 'node:util'
import { MIXED_CONTAINER_RULES } from './state-ownership.js'
import { OPAQUE_WRITE_ERROR, asRecord, getOwn, hasOwn, isObject, put, readonlyProjection } from './legacy-utils.js'

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
export function createMixedAdapter(container, deps) {
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
