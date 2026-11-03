// @ts-check
/** Desktop-only explicit opt-in loader for an isolated OwnerDocument candidate. */
import { lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

const CONFIG_ENV = 'PIGGY_OWNER_DOCUMENT_CONFIG'
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/**
 * @typedef {{ownerDocumentPath:string,legacyStatePath?:string,ownerId?:string,pigId:string}} OwnerDocumentConfig
 */

/**
 * No file is read unless the child process explicitly opts in through the named environment variable.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {OwnerDocumentConfig|null}
 */
export function readOwnerDocumentConfig(env = process.env) {
  const configPath = env[CONFIG_ENV]
  if (configPath === undefined || configPath === '') return null
  if (!isAbsolute(configPath)) throw new TypeError(`${CONFIG_ENV} must name an absolute task config file`)
  let stat
  try { stat = lstatSync(configPath) } catch { throw new Error(`${CONFIG_ENV} config file is unavailable`) }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${CONFIG_ENV} must name a regular non-symlink file`)
  let value
  try { value = JSON.parse(readFileSync(configPath, 'utf8')) }
  catch { throw new Error(`${CONFIG_ENV} config file is invalid JSON`) }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${CONFIG_ENV} config must be an object`)
  }
  const allowed = new Set(['ownerDocumentPath', 'legacyStatePath', 'ownerId', 'pigId'])
  if (Object.keys(value).some(key => !allowed.has(key)) ||
      typeof value.ownerDocumentPath !== 'string' || !isAbsolute(value.ownerDocumentPath) ||
      typeof value.pigId !== 'string' || !ID_PATTERN.test(value.pigId) ||
      (value.legacyStatePath !== undefined && (typeof value.legacyStatePath !== 'string' || !isAbsolute(value.legacyStatePath))) ||
      (value.ownerId !== undefined && (typeof value.ownerId !== 'string' || !ID_PATTERN.test(value.ownerId)))) {
    throw new TypeError(`${CONFIG_ENV} config has an invalid shape`)
  }
  return Object.freeze({
    ownerDocumentPath: resolve(value.ownerDocumentPath),
    ...(typeof value.legacyStatePath === 'string' ? { legacyStatePath: resolve(value.legacyStatePath) } : {}),
    ...(typeof value.ownerId === 'string' ? { ownerId: value.ownerId } : {}),
    pigId: value.pigId,
  })
}
