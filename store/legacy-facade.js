// @ts-check
/**
 * 把 canonical owner/body/opaque 数据暴露为旧 core 可读写的 live flat facade。
 * 此层不拥有事务，也不裁定字段归属。
 * @module dsh-piggy/store/legacy-facade
 */
import { createMixedAdapter } from './legacy-mixed-adapter.js'
import { LEGACY_VIEW } from './legacy-view-brand.js'
import { composeLegacyState } from './legacy-projection.js'
import {
  isFormatKey,
  isMixedContainer,
  isOwnerTopLevel,
  isPigTopLevel,
} from './state-ownership.js'
import { OPAQUE_WRITE_ERROR, asRecord, getOwn, hasOwn, isObject, put, readonlyProjection } from './legacy-utils.js'

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
