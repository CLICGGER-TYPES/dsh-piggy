// @ts-check
/** Owner 运行时的内部 JSON 工具：与持久化边界一致的克隆、稳定文本和摘要。 */
import { createHash } from 'node:crypto'

/** @param {string} text */
export function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

/** @param {unknown} value */
export function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
}

/** @param {unknown} value */
export function stableText(value) {
  return JSON.stringify(stable(value))
}

/** Match the JSON persistence boundary: object undefineds disappear and array gaps become null. @param {unknown} value */
export function jsonClone(value) {
  const text = JSON.stringify(value)
  if (text === undefined) throw new TypeError('owner snapshot is not JSON data')
  return JSON.parse(text)
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
