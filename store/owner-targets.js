// @ts-check
/**
 * Owner 的私有 PigTarget/holder 集合与旧 facade 生命周期。
 * canonical resources、事务标志和 owner 对象仍由 owner-resources 唯一持有；
 * 本模块只在每次调用时通过访问器读它们，不保存副本。
 * @module dsh-piggy/store/owner-targets
 */
import { createLegacyStateAdapter, isLegacyView, splitLegacyState } from './legacy-state.js'
import { PIG_BODY_PATHS } from './state-ownership.js'

/**
 * @typedef {import('./owner-resources.js').OwnerAuthority} OwnerAuthority
 * @typedef {import('./owner-resources.js').PigTarget} PigTarget
 */

/** @typedef {object} PigHolder
 * @property {Record<string, unknown>|null} body
 * @property {Record<string, unknown>|null} view
 * @property {() => void} sync
 * @property {number} generation
 * @property {boolean} disposed
 * @property {boolean} opaqueWritable
 */

/**
 * @typedef {object} OwnerTargetLifecycle
 * @property {(target: PigTarget) => PigHolder} holderOf
 * @property {(target: PigTarget) => PigHolder} assertUsable
 * @property {(except: PigHolder|null) => void} syncLiveTargets
 * @property {(except: PigHolder|null) => void} refreshViews
 * @property {(body: Record<string, unknown>|null, base: Record<string, unknown>|null, opaqueWritable: boolean) => PigTarget} createTarget
 * @property {(target: PigTarget) => boolean} hasOtherLiveTargets
 * @property {() => number} targetCount
 * @property {(target: PigTarget, detachCanonicalState: () => void) => void} releaseTarget
 * @property {() => void} disposeTargets
 */

/**
 * @typedef {object} OwnerTargetLifecycleOptions
 * @property {() => OwnerAuthority} getOwner
 * @property {() => boolean} isOwnerDisposed
 * @property {() => boolean} isTransactionActive
 * @property {() => Record<string, unknown>} getResources
 * @property {() => Record<string, unknown>} getOpaque
 * @property {() => Record<string, unknown>} getFormat
 */

/** @param {unknown} value */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/** @param {unknown} value */
const clone = value => structuredClone(value)

/**
 * 建立仅持有目标 holder 的私有 lifecycle。owner 和 canonical 对象始终由外层提供。
 * @param {OwnerTargetLifecycleOptions} deps
 * @returns {OwnerTargetLifecycle}
 */
export function createOwnerTargetLifecycle(deps) {
  /** @type {Set<PigTarget>} */
  const targets = new Set()
  /** @type {Map<PigTarget, PigHolder>} */
  const holders = new Map()
  /** @type {WeakSet<PigTarget>} */
  const released = new WeakSet()

  /** @param {PigTarget} target @returns {PigHolder} */
  function holderOf(target) {
    if (!isObject(target)) throw new TypeError('owner transaction needs a pig target')
    if (released.has(target)) throw new Error('pig target released')
    const holder = holders.get(target)
    if (holder === undefined) throw new Error('pig target does not belong to this owner')
    return holder
  }

  /** @param {PigTarget} target */
  function assertUsable(target) {
    if (deps.isOwnerDisposed()) throw new Error('owner resources disposed')
    const holder = holderOf(target)
    if (holder.disposed) throw new Error('pig target released')
    if (target.owner !== deps.getOwner()) throw new Error('pig target belongs to another owner')
    return holder
  }

  /** Route pending direct facade writes before the owner copies its canonical objects. @param {PigHolder|null} except */
  function syncLiveTargets(except) {
    for (const holder of holders.values()) {
      if (holder === except || holder.disposed || holder.body === null || holder.view === null) continue
      holder.sync()
    }
  }

  /** Rebuild sibling facade descriptors after shared resources change shape. @param {PigHolder|null} except */
  function refreshViews(except) {
    for (const holder of holders.values()) {
      if (holder === except || holder.disposed || holder.body === null || holder.view === null) continue
      holder.sync()
      const adapter = createLegacyStateAdapter({
        getResources: deps.getResources,
        getBody: () => holder.body,
        getOpaque: deps.getOpaque,
        getFormat: deps.getFormat,
        base: holder.view,
        opaqueWritable: holder.opaqueWritable,
      })
      holder.view = adapter.view
      holder.sync = adapter.sync
    }
  }

  /**
   * @param {Record<string, unknown>|null} body
   * @param {Record<string, unknown>|null} base
   * @param {boolean} opaqueWritable
   * @returns {PigTarget}
   */
  function createTarget(body, base, opaqueWritable) {
    /** @type {PigHolder} */
    const holder = { body, view: null, sync: () => {}, generation: 0, disposed: false, opaqueWritable }
    const adapter = createLegacyStateAdapter({
      getResources: deps.getResources,
      getBody: () => holder.body,
      getOpaque: deps.getOpaque,
      getFormat: deps.getFormat,
      base,
      opaqueWritable,
    })
    holder.view = adapter.view
    holder.sync = adapter.sync
    /** @type {PigTarget} */
    const target = {
      kind: 'pig-target',
      owner: deps.getOwner(),
      get body() { return holder.disposed ? null : holder.body },
      bodyPaths: PIG_BODY_PATHS,
      get state() {
        if (deps.isOwnerDisposed() || holder.disposed) return null
        if (holder.view === null) return null
        holder.sync()
        return holder.view
      },
      get present() { return !deps.isOwnerDisposed() && !holder.disposed && holder.body !== null },
      release() { deps.getOwner().releaseTarget(target) },
    }
    holders.set(target, holder)
    targets.add(target)
    Object.freeze(target)
    return target
  }

  /** @param {PigTarget} target */
  function hasOtherLiveTargets(target) {
    return [...targets].some(targetEntry => {
      if (targetEntry === target) return false
      const other = holders.get(targetEntry)
      return other !== undefined && !other.disposed && other.body !== null
    })
  }

  /**
   * The caller alone copies/replaces canonical owner values. This module only
   * detaches and retires the target holder around that operation.
   * @param {PigTarget} target
   * @param {() => void} detachCanonicalState
   */
  function releaseTarget(target, detachCanonicalState) {
    if (deps.isTransactionActive()) throw new Error('owner resource transaction is not reentrant')
    if (released.has(target)) return
    const holder = holderOf(target)
    syncLiveTargets(null)
    detachCanonicalState()
    holder.disposed = true
    holder.generation += 1
    targets.delete(target)
    try {
      refreshViews(null)
    } finally {
      released.add(target)
      holders.delete(target)
      holder.body = null
      holder.view = null
      holder.sync = () => {}
    }
  }

  function disposeTargets() {
    for (const [target, holder] of holders) {
      holder.disposed = true
      holder.generation += 1
      holder.body = null
      holder.view = null
      holder.sync = () => {}
      released.add(target)
    }
    holders.clear()
    targets.clear()
  }

  return {
    holderOf,
    assertUsable,
    syncLiveTargets,
    refreshViews,
    createTarget,
    hasOtherLiveTargets,
    targetCount: () => targets.size,
    releaseTarget,
    disposeTargets,
  }
}
