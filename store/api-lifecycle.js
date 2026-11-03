// @ts-check
/**
 * 孵化、时间、重置与待播报命令。
 * createApi 负责唯一的公开对象与 context 校验；这里仅返回原签名方法。
 * @module dsh-piggy/store/api-lifecycle
 */
import {
  ageFromNow as coreAgeFromNow,
  applyDevPatch as coreDevPatch,
  adopt as coreAdopt,
  drainPending,
  hatch as coreHatch,
  hatchEgg,
  rename as coreRename,
  reset as coreReset,
  setTimeScale as coreSetTimeScale,
} from '../core.js'

/** @typedef {import('./api.js').ApiRuntime} ApiRuntime */

/** @param {ApiRuntime} runtime */
export function createApiLifecycle(runtime) {
  const { commands, getState, mutate, now, setState, settleAndSave } = runtime
  return {
    /** Open the box. Only works when there is no living pig yet. */
    hatch() {
      const state = getState()
      // A save that exists but is not hatched is a box — reset and adopt both
      // produce one. Refusing because `state !== null` left the box unopenable.
      if (state !== null && state.hatched === true) return false
      setState(state === null ? hatchEgg(now()) : coreHatch(state, now()))
      settleAndSave()
      return true
    },

    /** Change how fast the pig ages. */
    setTimeScale(scale) {
      const state = getState()
      if (state === null) return false
      return mutate(live => { coreSetTimeScale(live, scale, now()); return true }) === true
    },

    /** Put the age back on the real clock. */
    ageFromNow() {
      const state = getState()
      if (state === null) return false
      return mutate(live => { coreAgeFromNow(live, now()); return true }) === true
    },

    /** Developer mode: force the pig into any state. */
    dev(patch) {
      // Through mutate(): a patch that blows up halfway must not be written.
      return mutate(live => { coreDevPatch(live, patch, now()); return true }) === true
    },

    /** Start from a brand new box, living pig or not. */
    reset() {
      setState(coreReset(now()))
      settleAndSave()
      return true
    },

    /**
     * Start over with a fresh box, keeping the old pig's memories. Only offered
     * once a pig has died — you cannot throw a living one away.
     */
    adopt() {
      const state = getState()
      if (state === null) return false
      if (state.dead !== true) return false
      setState(coreAdopt(state, now()))
      settleAndSave()
      return true
    },

    /** Rename the pig; null when the name is unusable or the pig is absent. */
    rename(rawName) {
      const state = getState()
      if (state === null) return null
      try {
        const result = commands.runFor(
          commands.scope,
          live => ({ cleaned: coreRename(live, rawName, now()) }),
          { saveWhen: value => value.cleaned !== null },
        )
        if (typeof result?.cleaned === 'string') return result.cleaned
        if (result?.reason === 'error') {
          console.warn(`[dsh-piggy] rename failed: reason="${result.message ?? 'error'}"`)
        }
        return null
      } catch (error) {
        console.warn(`[dsh-piggy] rename failed: reason="${error instanceof Error ? error.message : String(error)}"`)
        return null
      }
    },

    /** Take the queued announcements (work done, got sick, got better…). */
    drainPending() {
      const state = getState()
      if (state === null) return []
      try {
        const result = commands.runFor(
          commands.scope,
          live => ({ events: drainPending(live) }),
          { saveWhen: value => value.events.length > 0 },
        )
        if (Array.isArray(result?.events)) return result.events
        if (result?.reason === 'error') {
          console.warn(`[dsh-piggy] drainPending failed: reason="${result.message ?? 'error'}"`)
        }
        return []
      } catch (error) {
        console.warn(`[dsh-piggy] drainPending failed: reason="${error instanceof Error ? error.message : String(error)}"`)
        return []
      }
    },
  }
}
