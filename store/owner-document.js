// @ts-check
/**
 * 把旧 v15 扁平状态投影为纯内存 owner document，并按显式 pigId 还原旧视图。
 * 本模块不持久化、不接 runtime/route，也不保存当前目标状态。
 * @module dsh-piggy/store/owner-document
 */
import { STATE_VERSION } from '../packages/pet-core/src/core/constants.js'
import { composeLegacyState, splitLegacyState } from './legacy-projection.js'
import {
  FORMAT_PATHS,
  MIXED_CONTAINER_RULES,
  isFormatKey,
  isMixedContainer,
  isOwnerTopLevel,
  isPigTopLevel,
} from './state-ownership.js'

export const OWNER_DOCUMENT_VERSION = 1

const OWNER_DOCUMENT_KEYS = new Set([
  'documentVersion',
  'ownerId',
  'legacyFormat',
  'resources',
  'pigs',
  'opaque',
])
const PIG_RECORD_KEYS = new Set(['pigId', 'body'])
const FORMAT_KEY_SET = new Set(FORMAT_PATHS)
const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/**
 * @typedef {{pigId: string, body: Record<string, unknown>}} OwnerPigRecord
 * @typedef {{
 *   documentVersion: number,
 *   ownerId: string,
 *   legacyFormat: Record<string, unknown>,
 *   resources: Record<string, unknown>,
 *   pigs: OwnerPigRecord[],
 *   opaque: Record<string, unknown>,
 * }} OwnerDocument
 */

/**
 * 仅接受普通 JSON 数据；检查属性描述符而非读取 getter，拒绝危险键且不改输入。
 * @param {unknown} value
 * @param {Set<object>} [ancestors]
 */
function assertJsonData(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('owner document contains a non-finite number')
    return
  }
  if (typeof value !== 'object') throw new TypeError('owner document must contain only JSON data')
  if (ancestors.has(value)) throw new TypeError('owner document must not contain cycles')
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length > 0) {
        throw new TypeError('owner document arrays must be plain JSON arrays')
      }
      const ownKeys = Reflect.ownKeys(value)
      if (ownKeys.some(key => typeof key !== 'string' || (key !== 'length' && !/^(0|[1-9]\d*)$/.test(key)))) {
        throw new TypeError('owner document arrays must not have extra properties')
      }
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (descriptor === undefined || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
          throw new TypeError('owner document arrays must be dense JSON arrays')
        }
        assertJsonData(descriptor.value, ancestors)
      }
      return
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('owner document objects must be plain JSON objects')
    }
    if (Object.getOwnPropertySymbols(value).length > 0) throw new TypeError('owner document must not contain symbol keys')
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') throw new TypeError('owner document keys must be strings')
      if (RESERVED_KEYS.has(key)) throw new TypeError('owner document contains a reserved key')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
        throw new TypeError('owner document properties must be enumerable data fields')
      }
      assertJsonData(descriptor.value, ancestors)
    }
  } finally {
    ancestors.delete(value)
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** @param {string} key @returns {key is keyof typeof MIXED_CONTAINER_RULES} */
function isKnownMixedContainer(key) {
  return isMixedContainer(key)
}

/** @param {Record<string, unknown>} value @param {Set<string>} allowed @param {string} label */
function assertExactKeys(value, allowed, label) {
  const keys = Object.keys(value)
  if (keys.length !== allowed.size || keys.some(key => !allowed.has(key))) {
    throw new TypeError(`${label} has an invalid shape`)
  }
}

/** @param {unknown} value @param {string} label @returns {asserts value is string} */
function assertId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value) || RESERVED_KEYS.has(value)) {
    throw new TypeError(`${label} is invalid`)
  }
}

/** @param {unknown} value @param {string} label @returns {asserts value is Record<string, unknown>} */
function assertPlainPart(value, label) {
  if (!isPlainRecord(value)) throw new TypeError(`${label} must be a plain object`)
}

/**
 * 校验归属桶与 splitLegacyState() 的输出一致，避免还原时丢失错放字段，
 * 或让 opaque 数据覆盖 owner 的正式字段。
 * @param {Record<string, unknown>} resources
 */
function assertCanonicalResources(resources) {
  for (const [key, value] of Object.entries(resources)) {
    if (isOwnerTopLevel(key)) continue
    if (!isKnownMixedContainer(key)) throw new TypeError('owner resources contain a non-owner field')
    assertCanonicalMixedPart(key, value, 'owner', 'owner resources')
  }
}

/** @param {Record<string, unknown>} body */
function assertCanonicalPigBody(body) {
  for (const [key, value] of Object.entries(body)) {
    if (isPigTopLevel(key)) continue
    if (!isKnownMixedContainer(key)) throw new TypeError('pig body contains a non-pig field')
    assertCanonicalMixedPart(key, value, 'pig', 'pig body')
  }
}

/**
 * @param {keyof typeof MIXED_CONTAINER_RULES} container
 * @param {unknown} value
 * @param {'owner'|'pig'} side
 * @param {string} label
 */
function assertCanonicalMixedPart(container, value, side, label) {
  if (!isPlainRecord(value)) throw new TypeError(`${label} mixed fields must be plain objects`)
  const allowed = new Set(MIXED_CONTAINER_RULES[container][side])
  const keys = Object.keys(value)
  if (keys.some(key => !allowed.has(key))) throw new TypeError(`${label} mixed field is in the wrong ownership bucket`)
  if (side === 'pig' && keys.length === 0) throw new TypeError(`${label} has an empty non-canonical mixed field`)
}

/** @param {Record<string, unknown>} opaque */
function assertCanonicalOpaque(opaque) {
  for (const [key, value] of Object.entries(opaque)) {
    if (isFormatKey(key) || isOwnerTopLevel(key) || isPigTopLevel(key)) {
      throw new TypeError('legacy opaque data overlaps a declared state field')
    }
    if (!isKnownMixedContainer(key)) continue
    if (!isPlainRecord(value)) continue // splitLegacyState 会把形状错误的旧混合容器整体留在 opaque。
    const rules = MIXED_CONTAINER_RULES[/** @type {keyof typeof MIXED_CONTAINER_RULES} */ (key)]
    const declared = new Set([...rules.owner, ...rules.pig])
    const keys = Object.keys(value)
    if (keys.length === 0 || keys.some(nestedKey => declared.has(nestedKey))) {
      throw new TypeError('legacy opaque mixed field is in the wrong ownership bucket')
    }
  }
}

/**
 * 校验结构并返回独立 JSON 副本。本函数只检查单文档；跨文档 ownerId 唯一性
 * 由后续持久化层负责。
 * @param {unknown} value
 * @returns {OwnerDocument}
 */
export function validateOwnerDocument(value) {
  assertJsonData(value)
  if (!isPlainRecord(value)) throw new TypeError('owner document must be a plain object')
  assertExactKeys(value, OWNER_DOCUMENT_KEYS, 'owner document')

  if (value.documentVersion !== OWNER_DOCUMENT_VERSION) {
    throw new TypeError('owner document version is unsupported')
  }
  const ownerId = value.ownerId
  assertId(ownerId, 'ownerId')
  const legacyFormat = value.legacyFormat
  assertPlainPart(legacyFormat, 'legacyFormat')
  if (Object.keys(legacyFormat).some(key => !FORMAT_KEY_SET.has(key))) {
    throw new TypeError('legacy format contains an undeclared field')
  }
  if (legacyFormat.version !== STATE_VERSION) throw new TypeError('legacy format version is unsupported')
  const resources = value.resources
  assertPlainPart(resources, 'resources')
  const opaque = value.opaque
  assertPlainPart(opaque, 'opaque')
  assertCanonicalResources(resources)
  assertCanonicalOpaque(opaque)
  if (!Array.isArray(value.pigs)) throw new TypeError('owner document pigs must be an array')

  const pigIds = new Set()
  for (const pig of value.pigs) {
    if (!isPlainRecord(pig)) throw new TypeError('owner document pig record must be a plain object')
    assertExactKeys(pig, PIG_RECORD_KEYS, 'owner document pig record')
    const pigId = pig.pigId
    assertId(pigId, 'pigId')
    if (pigIds.has(pigId)) throw new TypeError('owner document contains duplicate pigId')
    pigIds.add(pigId)
    const body = pig.body
    assertPlainPart(body, 'pig body')
    assertCanonicalPigBody(body)
  }

  return /** @type {OwnerDocument} */ (structuredClone(value))
}

/**
 * 解析 owner document JSON 并验证，不产生副作用。
 * @param {string} text
 * @returns {OwnerDocument}
 */
export function parseOwnerDocument(text) {
  if (typeof text !== 'string') throw new TypeError('owner document input must be JSON text')
  let value
  try {
    value = JSON.parse(text)
  } catch {
    throw new TypeError('owner document JSON is invalid')
  }
  return validateOwnerDocument(value)
}

/**
 * 验证 owner document 后序列化为 JSON 文本。
 * @param {unknown} value
 * @returns {string}
 */
export function serializeOwnerDocument(value) {
  return JSON.stringify(validateOwnerDocument(value))
}

/**
 * 把已规范化的旧 v15 状态投影成内存 owner document。
 * ID 由调用者显式提供且只作数据身份；本函数不生成、不持久化 ID，也不把 ID 当权限。
 * @param {Record<string, unknown>} flatV15
 * @param {{ownerId: string, pigId: string}} ids
 * @returns {OwnerDocument}
 */
export function ownerDocumentFromLegacyV15(flatV15, ids) {
  assertJsonData(flatV15)
  if (!isPlainRecord(flatV15)) throw new TypeError('legacy v15 state must be a plain object')
  if (!isPlainRecord(ids)) throw new TypeError('owner and pig IDs must be supplied explicitly')
  assertExactKeys(ids, new Set(['ownerId', 'pigId']), 'owner and pig IDs')
  assertId(ids.ownerId, 'ownerId')
  assertId(ids.pigId, 'pigId')
  if (flatV15.version !== STATE_VERSION) throw new TypeError('legacy state version is unsupported')

  const parts = splitLegacyState(flatV15)
  return validateOwnerDocument({
    documentVersion: OWNER_DOCUMENT_VERSION,
    ownerId: ids.ownerId,
    legacyFormat: parts.format,
    resources: parts.resources,
    pigs: [{ pigId: ids.pigId, body: parts.body }],
    opaque: parts.opaque,
  })
}

/**
 * 按显式 pigId 取一只猪的本体，与共享 owner 资源组合成旧 core 使用的 v15 扁平形状。
 * @param {unknown} value
 * @param {string} pigId
 * @returns {Record<string, unknown>}
 */
export function projectOwnerDocumentToLegacyV15(value, pigId) {
  const document = validateOwnerDocument(value)
  assertId(pigId, 'pigId')
  const matches = document.pigs.filter(pig => pig.pigId === pigId)
  if (matches.length !== 1) throw new TypeError('requested pigId is missing or ambiguous')
  return composeLegacyState({
    resources: document.resources,
    body: matches[0].body,
    opaque: document.opaque,
    format: document.legacyFormat,
  })
}
