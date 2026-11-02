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
 * Out of scope here: owner/currency resources, save identity, network rooms,
 * a public multi-pig selector, sound policy and action/skin descriptors. Those
 * stay in F01/F02/F04/F05 or a later integration task.
 * @module dsh-piggy/client/presentation-context
 */
import { createArtContext } from './art.js'
import { createAudioChannel } from './audio-context.js'
import { createBirthday } from './birthday.js'
import { createEffects } from './effects.js'
import { createFeel } from './feel/index.js'
import { createScene } from './scene.js'

function noop() {}

/**
 * @param {{
 *   root?: any,
 *   parts?: any,
 *   state?: { getView?: () => any, isStopped?: () => boolean, isAway?: () => boolean, isQuiet?: () => boolean },
 *   transport?: { send?: (action: string, extra?: object) => any },
 *   getShell?: () => any,
 *   onGeometry?: () => void,
 *   artResources?: import('./art-resources.js').ArtResourceRegistry | null,
 * }} [options]
 */
export function createPresentationContext(options) {
  const opts = options ?? {}
  const root = opts.root ?? null
  const state = opts.state ?? {}
  const transport = opts.transport ?? {}
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
    audio: audio,
    effects: effects,
    feel: feel,
    state: state,
    transport: transport,
    get disposed() { return disposed },
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
