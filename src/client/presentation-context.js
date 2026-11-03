// @ts-check
/**
 * F03 presentation instance: one pig's DOM, art/feedback selection, effects,
 * feel and birthday timer, with an explicit state binding and transport seam.
 *
 * This is the factory consumed by the normal `mountGame()` path. A private
 * dual-instance fixture uses the same factory with two different roots and two
 * different state objects; it never depends on "the last mounted pig" or on a
 * module-global mounted selector.
 *
 * Optional owner/pig IDs label a caller-bound instance; they are not credentials
 * or a source of state/permission. A host may bind them once from the same
 * session-bound state response; an established presentation cannot be retargeted.
 * The caller shares one art registry across an
 * owner's presentations, while this context owns only its art binding and audio
 * channel. There is no process-global active pig.
 * @module dsh-piggy/client/presentation-context
 */
import { createArtContext } from './art.js'
import { createAudioChannel } from './audio-context.js'
import { createBirthday } from './birthday.js'
import { createEffects } from './effects.js'
import { createFeel } from './feel/index.js'
import { createScene } from './scene.js'

function noop() {}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/** @typedef {{ ownerId: string, pigId: string }} PresentationIdentity */

/** @param {unknown} value @returns {PresentationIdentity|null} */
function normalizeIdentity(value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('presentation identity must be an ownerId/pigId pair')
  const record = /** @type {Record<string, unknown>} */ (value)
  if (Object.keys(record).sort().join(',') !== 'ownerId,pigId' ||
      typeof record.ownerId !== 'string' || !ID_PATTERN.test(record.ownerId) ||
      typeof record.pigId !== 'string' || !ID_PATTERN.test(record.pigId)) {
    throw new TypeError('presentation identity must contain valid ownerId and pigId values')
  }
  return Object.freeze({ ownerId: record.ownerId, pigId: record.pigId })
}

/**
 * @param {{
 *   root?: any,
 *   parts?: any,
 *   state?: { getView?: () => any, isStopped?: () => boolean, isAway?: () => boolean, isQuiet?: () => boolean },
 *   transport?: { send?: (action: string, extra?: object) => any },
 *   getShell?: () => any,
 *   onGeometry?: () => void,
 *   artResources?: import('./art-resources.js').ArtResourceRegistry | null,
 *   identity?: PresentationIdentity | null,
 * }} [options]
 */
export function createPresentationContext(options) {
  const opts = options ?? {}
  const root = opts.root ?? null
  const state = opts.state ?? {}
  const transport = opts.transport ?? {}
  let identity = normalizeIdentity(opts.identity)
  const parts = opts.parts ?? createScene({ root: root })
  const art = createArtContext({
    pig: parts.pig,
    image: parts.pigArt,
    emoji: parts.pigEmoji,
    artResources: opts.artResources ?? null,
  })
  let disposed = false
  let birthday = null

  function getView() {
    if (typeof state.getView === 'function') return state.getView()
    return null
  }

  function isStopped() {
    if (disposed) return true
    return typeof state.isStopped === 'function' ? state.isStopped() === true : false
  }

  function isAway() {
    return typeof state.isAway === 'function' ? state.isAway() === true : false
  }

  function isQuiet() {
    return typeof state.isQuiet === 'function' ? state.isQuiet() === true : false
  }

  /** Bind identity from a session-bound host response only if this context has none yet. */
  function bindIdentity(value) {
    let next
    try { next = normalizeIdentity(value) } catch { return false }
    if (next === null) return identity === null
    if (identity !== null) return identity.ownerId === next.ownerId && identity.pigId === next.pigId
    identity = next
    return true
  }

  const audio = createAudioChannel({ isQuiet: isQuiet })

  const effects = createEffects({
    scene: parts.scene,
    pig: parts.pig,
    pigArt: parts.pigArt,
    pigEmoji: parts.pigEmoji,
    card: parts.card,
    bubble: parts.bubble,
    pomoHint: parts.pomoHint,
    root: root,
    art: art,
    isStopped: isStopped,
    isAway: isAway,
  })

  const feel = createFeel({
    pig: parts.pig,
    pigHold: parts.pigHold,
    pigBody: parts.pigBody,
    scene: parts.scene,
    host: parts.host,
    pigArt: parts.pigArt,
    pigEmoji: parts.pigEmoji,
    burst: effects.burst,
    getShell: typeof opts.getShell === 'function' ? opts.getShell : function () { return null },
    isQuiet: isQuiet,
    onGeometry: typeof opts.onGeometry === 'function' ? opts.onGeometry : noop,
    art: art,
    audio: audio,
  })

  art.setArtSwapHook(function (apply) { feel.coverSwap(apply) })
  effects.setFeel(feel)

  const context = {
    parts: parts,
    art: art,
    artResources: art.artResources,
    audio: audio,
    effects: effects,
    feel: feel,
    state: state,
    transport: transport,
    get identity() { return identity },
    get disposed() { return disposed },
    bindIdentity: bindIdentity,
    getView: getView,
    /**
     * Create the optional birthday controller once the caller's UI context is
     * ready. The presentation owns its timer and disposes it with the instance.
     */
    createBirthday: function (ui, render) {
      if (disposed) return { celebrate: noop, dispose: noop }
      if (birthday !== null) birthday.dispose()
      birthday = createBirthday({
        ctx: ui !== null && ui !== undefined ? ui : {},
        pig: parts.pig,
        pigArt: parts.pigArt,
        pigEmoji: parts.pigEmoji,
        burst: effects.burst,
        render: typeof render === 'function' ? render : noop,
        art: art,
      })
      return birthday
    },
    dispose: function () {
      if (disposed) return
      disposed = true
      if (birthday !== null) birthday.dispose()
      birthday = null
      audio.dispose()
      art.dispose()
      effects.dispose()
      feel.dispose()
      parts.host.remove()
      parts.style.remove()
      parts.font.remove()
    },
  }
  return context
}
