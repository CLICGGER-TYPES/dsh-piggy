// @ts-check
/**
 * Per-image resource selection lifetime for the art controller.
 *
 * A presentation context selects one registered resource per image. A registry
 * replacement invalidates that image's selection token even when the URL and
 * revision stay the same; a queued apply re-resolves the descriptor before it
 * writes DOM. A same-URL frame replacement is still written by the next normal
 * sync, and removing a frame restores its built-in fallback.
 *
 * This module owns no presentation context, timer or global "current pig".
 * @module dsh-piggy/client/art-selection
 */
import { applyFrame } from './art-framing.js'

/** Per-image selection token; a new sync replaces it and stale callbacks compare identity. */
const ART_SELECTION = new WeakMap()
/** Registered resource currently selected by one image, for revision-aware invalidation. */
const SELECTED_RESOURCE = new WeakMap()
/** Frame actually written to one image, so a same-URL sync only rewrites changed metadata. */
const RENDERED_FRAME = new WeakMap()

/** @param {import('./art-resources.js').ResolvedArtResource} resource */
function resourceHandleOf(resource) {
  const descriptor = resource.descriptor
  return descriptor.namespace + '/' + descriptor.pack + '/' + descriptor.key
}

/** @param {any} image @param {object} selection @param {import('./art-resources.js').ResolvedArtResource | null} resource */
function trackSelectedResource(image, selection, resource) {
  if (image === null || resource === null || resource.legacy) {
    SELECTED_RESOURCE.delete(image)
    return
  }
  SELECTED_RESOURCE.set(image, {
    selection: selection,
    handle: resourceHandleOf(resource),
    descriptor: resource.descriptor,
  })
}

/** @param {import('./art-resources.js').ArtResourceRegistry} artResources @param {import('./art-resources.js').ResolvedArtResource} resource */
function resourceIsCurrent(artResources, resource) {
  if (resource.legacy) return true
  const descriptor = resource.descriptor
  const current = artResources.resolveRef({
    namespace: descriptor.namespace,
    pack: descriptor.pack,
    key: descriptor.key,
  })
  return current !== null && current.descriptor === descriptor
}

/** @param {readonly [number, number, number] | null} left @param {readonly [number, number, number] | null} right */
function sameFrame(left, right) {
  if (left === right) return true
  return left !== null && right !== null
    && left[0] === right[0] && left[1] === right[1] && left[2] === right[2]
}

/** @param {any} image @param {import('./art-resources.js').ResolvedArtResource} resource @param {readonly [number, number, number] | null} fallback @param {string} src */
function renderResourceFrame(image, resource, fallback, src) {
  const frame = resource.descriptor.frame ?? fallback
  applyFrame(image, frame)
  RENDERED_FRAME.set(image, { src: src, frame: frame })
}

/** @param {any} image @param {import('./art-resources.js').ResolvedArtResource} resource @param {readonly [number, number, number] | null} fallback @param {string} src */
function frameNeedsRender(image, resource, fallback, src) {
  const rendered = RENDERED_FRAME.get(image)
  return rendered === undefined || rendered.src !== src
    || !sameFrame(rendered.frame, resource.descriptor.frame ?? fallback)
}

/** @param {any} image @param {object} selection */
export function setSelection(image, selection) {
  ART_SELECTION.set(image, selection)
}

/** @param {any} image @param {object} selection */
export function isSelection(image, selection) {
  return image !== null && ART_SELECTION.get(image) === selection
}

/** Drop all selection lifetime for an image. @param {any} image */
export function clearSelection(image) {
  if (image === null) return
  ART_SELECTION.delete(image)
  SELECTED_RESOURCE.delete(image)
  RENDERED_FRAME.delete(image)
}

/** Drop only the registered-resource and frame tracking; the current token stays. @param {any} image */
export function clearSelectedResource(image) {
  if (image === null) return
  SELECTED_RESOURCE.delete(image)
  RENDERED_FRAME.delete(image)
}

/** @param {any} image @param {object} selection */
function invalidateSelection(image, selection) {
  if (image === null || ART_SELECTION.get(image) !== selection) return
  ART_SELECTION.delete(image)
  const selected = SELECTED_RESOURCE.get(image)
  if (selected !== undefined && selected.selection === selection) SELECTED_RESOURCE.delete(image)
}

/**
 * Track one selected resource and, when needed, apply its image/frame through
 * the caller's selection guard. `onLoaded` runs after `src` changes and before
 * the descriptor frame (base art uses it for custom-image measurement).
 * @param {{
 *   image: any,
 *   selection: object,
 *   resource: import('./art-resources.js').ResolvedArtResource,
 *   fallback: readonly [number, number, number] | null,
 *   artResources: import('./art-resources.js').ArtResourceRegistry,
 *   applySelected: (apply: () => void, isCurrent: (() => boolean) | null) => void,
 *   onLoaded?: (() => void) | null,
 *   renderDescriptorFrame?: boolean,
 * }} options
 */
export function applyResourceSelection(options) {
  const { image, selection, resource, fallback, artResources, applySelected } = options
  const src = resource.url
  const renderDescriptorFrame = options.renderDescriptorFrame !== false
  trackSelectedResource(image, selection, resource)
  const isCurrent = resource.legacy ? null : function () { return resourceIsCurrent(artResources, resource) }
  if (image.getAttribute('src') !== src) {
    applySelected(function () {
      image.src = src
      if (typeof options.onLoaded === 'function') options.onLoaded()
      if (renderDescriptorFrame) renderResourceFrame(image, resource, fallback, src)
    }, isCurrent)
  } else if (renderDescriptorFrame && frameNeedsRender(image, resource, fallback, src)) {
    applySelected(function () {
      renderResourceFrame(image, resource, fallback, src)
    }, isCurrent)
  }
}

/**
 * Invalidate the current selection only when the announced handle is the one it
 * selected and the stored descriptor is no longer the registry's current one.
 * Same-revision metadata replacement therefore invalidates too.
 * @param {any} image
 * @param {import('./art-resources.js').ArtResourceChange} change
 * @param {import('./art-resources.js').ArtResourceChange['changes'][number]} item
 * @param {import('./art-resources.js').ArtResourceRegistry} artResources
 */
export function invalidateChangedResource(image, change, item, artResources) {
  const selection = ART_SELECTION.get(image)
  const selected = SELECTED_RESOURCE.get(image)
  if (selection === undefined || selected === undefined || selected.selection !== selection) return
  if (selected.handle !== change.namespace + '/' + change.pack + '/' + item.key) return
  const current = artResources.resolveRef({ namespace: change.namespace, pack: change.pack, key: item.key })
  if (current === null || current.descriptor !== selected.descriptor) invalidateSelection(image, selection)
}
