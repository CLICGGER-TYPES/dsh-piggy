// @ts-check
/**
 * legacy projection/facade 共用的小型无损对象操作，不定义或保存状态。
 * 只供 store 内部模块使用；legacy-state.js 不对外转出这些 helper。
 * @module dsh-piggy/store/legacy-utils
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
/** @template T @param {T} value @returns {T} */
export const clone = value => structuredClone(value)
/** @param {Record<string, unknown>} object @param {string} key */
export const hasOwn = (object, key) => Object.hasOwn(object, key)
/** @param {Record<string, unknown>} object @param {string} key */
export const getOwn = (object, key) => Object.getOwnPropertyDescriptor(object, key)?.value
/** @param {Record<string, unknown>} object @param {string} key @param {unknown} value */
export function put(object, key, value) {
  Object.defineProperty(object, key, { value, writable: true, enumerable: true, configurable: true })
}
/** @param {unknown} value @returns {Record<string, unknown>|null} */
export const asRecord = value => isObject(value) ? value : null
export const OPAQUE_WRITE_ERROR = 'undeclared owner namespace is read-only for this target; declare ownership before writing it'

/** @param {unknown} value @returns {unknown} */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value
  const record = /** @type {Record<string, unknown>|unknown[]} */ (value)
  for (const key of Object.keys(record)) deepFreeze(/** @type {Record<string, unknown>} */ (record)[key])
  return Object.freeze(value)
}

/** @param {unknown} value @returns {unknown} */
export function readonlyProjection(value) {
  if (value === null || typeof value !== 'object') return value
  return deepFreeze(structuredClone(value))
}
