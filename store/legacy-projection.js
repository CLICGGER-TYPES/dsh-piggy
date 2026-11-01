// @ts-check
/**
 * 旧 v15 扁平存档的纯归属拆分与无损组合。
 * 该模块只复制/投影数据，不创建 live facade 或持有事务。
 * @module dsh-piggy/store/legacy-projection
 */
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
import { LEGACY_VIEW } from './legacy-view-brand.js'
import { asRecord, clone, hasOwn, isObject, put } from './legacy-utils.js'

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
