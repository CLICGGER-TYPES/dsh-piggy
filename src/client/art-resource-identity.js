// @ts-check
/**
 * Identity and URL helpers shared by the art-resource registry core.
 *
 * Keeping these here leaves the registry state machine under the 400-line
 * module limit. A descriptor's identity is its namespace/pack/key; `ext/`
 * paths belong to third-party packs and are served from the host root.
 * @module dsh-piggy/client/art-resource-identity
 */
import { ART_URL, EXT_URL } from './constants.js'

/** @param {string} namespace @param {string} pack @param {string} key */
export function handleOf(namespace, pack, key) {
  return namespace + '/' + pack + '/' + key
}

/** @param {import('./art-resources.js').ArtResourceDescriptor} descriptor */
export function idOf(descriptor) {
  return handleOf(descriptor.namespace, descriptor.pack, descriptor.key)
}

/** @param {import('./art-resources.js').ArtResourceDescriptor} descriptor */
export function registeredCacheKey(descriptor) {
  return idOf(descriptor) + '@' + descriptor.revision
}

/** @param {import('./art-resources.js').ArtResourceDescriptor} descriptor */
export function artKeyOf(descriptor) {
  const source = descriptor.source
  if (source === null) return descriptor.key
  if (source.scheme === 'builtin' || source.scheme === 'custom') return source.key
  if (source.scheme === 'path' || source.scheme === 'ext') {
    return handleOf(descriptor.namespace, descriptor.pack, descriptor.key)
  }
  return descriptor.key
}

/**
 * URL of one stored art path. First-party resources are relative to ART_URL;
 * third-party resources start with `ext/` and are served from the host root.
 * @param {string} path
 * @param {string} revision
 */
export function artPathUrl(path, revision) {
  const root = path.startsWith('ext/') ? EXT_URL : ART_URL
  return root + path + (revision === '' ? '' : '?v=' + revision)
}
