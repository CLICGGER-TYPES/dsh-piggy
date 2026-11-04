// @ts-check
/**
 * Generated action-frame metadata: validation, URL form and the per-frame
 * resolved-resource adapter used by the player.
 *
 * Frame paths and content revisions come from `scripts/asset-packs.mjs`; this
 * module never invents bounds or downloads anything. A frame action still has
 * one descriptor; only the currently displayed frame is resolved at render
 * time, which keeps the art controller on its normal resource path.
 * @module dsh-piggy/client/art-frames
 */
import { ART_RESOURCE_SCHEMA } from './art-resources.js'
import { ART_URL } from './constants.js'

const FRAME_PATH = /^actions\/[a-z][a-z0-9-]{0,31}\/[a-z][a-z0-9-]{0,47}\/\d{2}\.(?:png|webp)$/
const MIN_FRAMES = 2
const MAX_FRAMES = 48

/** @param {unknown} value @returns {string} */
export function normalizeRevision(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) throw new Error('[dsh-piggy] invalid art resource revision')
    return String(value)
  }
  if (typeof value !== 'string' || value === '' || value.length > 128 || !/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error('[dsh-piggy] invalid art resource revision')
  }
  return value
}

/**
 * Validate generated frame metadata. Each entry is already resolved to a
 * relative frame path plus its content revision; the player only needs the
 * exact per-frame duration to advance. Authored bounds are deliberately not
 * part of this shape.
 * @param {unknown} value
 * @returns {readonly import('./art-resources.js').ArtFrame[] | null}
 */
export function normalizeFrames(value) {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value)) throw new Error('[dsh-piggy] art resource frames must be an array')
  if (value.length < MIN_FRAMES || value.length > MAX_FRAMES) {
    throw new Error('[dsh-piggy] art resource frames must have ' + MIN_FRAMES + '–' + MAX_FRAMES + ' entries')
  }
  const frames = value.map(entry => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('[dsh-piggy] art frame must be an object')
    }
    const input = /** @type {import('./art-resources.js').ArtFrameInput} */ (entry)
    for (const name of Object.keys(input)) {
      if (!['path', 'revision', 'durationMs'].includes(name)) throw new Error('[dsh-piggy] unsupported art frame field: ' + name)
    }
    if (typeof input.path !== 'string' || !FRAME_PATH.test(input.path)) throw new Error('[dsh-piggy] invalid art frame path')
    if (!Number.isInteger(input.durationMs) || input.durationMs <= 0) throw new Error('[dsh-piggy] art frame duration must be a positive integer')
    return Object.freeze({
      path: input.path,
      revision: normalizeRevision(input.revision),
      durationMs: input.durationMs,
    })
  })
  return Object.freeze(frames)
}

/**
 * URL of one generated frame.
 * @param {import('./art-resources.js').ArtFrame} frame
 */
export function artFrameUrl(frame) {
  return ART_URL + frame.path + (frame.revision === '' ? '' : '?v=' + frame.revision)
}

/**
 * Resolve the frame currently displayed by one playing frame action. The
 * result is a normal resolved-resource shape for the art controller, but it is
 * marked legacy because individual frames are not separate registry entries.
 * @param {import('./art-resources.js').ResolvedArtResource} action
 * @param {number} index
 * @returns {import('./art-resources.js').ResolvedArtResource | null}
 */
export function resolveActionFrame(action, index) {
  if (action === null || typeof action !== 'object') return null
  const descriptor = action.descriptor
  const frames = descriptor.frames
  if (!Array.isArray(frames) || !Number.isInteger(index) || index < 0 || index >= frames.length) return null
  const frame = frames[index]
  const url = artFrameUrl(frame)
  const frameDescriptor = Object.freeze({
    namespace: descriptor.namespace,
    pack: descriptor.pack,
    key: descriptor.key,
    revision: frame.revision,
    kind: 'action',
    source: Object.freeze({ scheme: 'path', path: frame.path }),
    frame: descriptor.frame,
    frames: null,
    duration: frame.durationMs,
    eligibility: descriptor.eligibility,
    fallback: descriptor.fallback,
    ...(descriptor.sound === undefined ? {} : { sound: descriptor.sound }),
    schema: ART_RESOURCE_SCHEMA,
  })
  return Object.freeze({
    descriptor: frameDescriptor,
    ref: Object.freeze({
      namespace: descriptor.namespace,
      pack: descriptor.pack,
      key: descriptor.key,
      revision: frame.revision,
    }),
    id: action.id + '#' + String(index).padStart(2, '0'),
    cacheKey: url,
    url: url,
    artKey: descriptor.key,
    scheme: 'path',
    exists: true,
    legacy: true,
  })
}
