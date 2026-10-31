// @ts-check
/**
 * 每位主人唯一的资源权威与每猪本体的生命周期/事务所有者。
 *
 * 这里持有 canonical shared resources；PigTarget 只持有自己的 body。旧 core
 * 通过每个 target 的 live flat facade 读写，facade 的主人物性直接落到本模块
 * 的 resources，猪属性落到该 target 的 body。事务是同步的：同一 owner 上两次
 * 操作不会在“读余额”和“扣余额”之间交错；失败/拒绝/异常/thenable/重入都会
 * 恢复事务前的 resources + 当前 body，不会半更新另一只猪或另一位主人。
 *
 * 不新增持久化格式、ID、revision、文件或每猪保存器。旧单猪存档通过
 * mountLegacyTarget 一次性拆成 owner + 一只猪；attachPig 是私有的内存多目标
 * 构造入口，不是产品多猪功能，也不会复制/重置家当。
 *
 * @module dsh-piggy/store/owner-resources
 */
import { composeLegacyState, createLegacyStateAdapter, isLegacyView, splitLegacyState } from './legacy-state.js'
import { OWNER_RESOURCE_PATHS, PIG_BODY_PATHS } from './state-ownership.js'

/** @param {unknown} value */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
const clone = value => structuredClone(value)
/** @param {unknown} value */
const isThenable = value => value !== null &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (/** @type {{then?: unknown}} */ (value).then) === 'function'

/**
 * The exact structured business-refusal marker used by command callbacks:
 * an object with `ok === false` and a string `reason`. Plain falsy returns,
 * `{ok:false}` without a reason, arrays and exceptions are not this marker.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExplicitRefusal(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = /** @type {{ok?: unknown, reason?: unknown}} */ (value)
  return record.ok === false && typeof record.reason === 'string'
}

/**
 * @typedef {object} PigHolder
 * @property {Record<string, unknown>|null} body
 * @property {Record<string, unknown>|null} view
 * @property {() => void} sync
 * @property {number} generation
 * @property {boolean} disposed
 * @property {boolean} opaqueWritable
 */

/**
 * @typedef {object} TransactOptions
 * @property {(result: unknown, state: Record<string, unknown>) => void} [afterSuccess]
 *   Runs inside the owner transaction only after a non-refusal result and facade
 *   sync. A throw here rolls back resources/body/cursor like any other failure.
 */

/**
 * 进程内的 owner capability。`state` 只是 canonical shared-resource 集合，
 * 不是整只猪；`target.state` 才是给旧 core 的扁平 facade。
 * @typedef {object} OwnerAuthority
 * @property {'owner-resources'} kind
 * @property {readonly string[]} sharedPaths
 * @property {Record<string, unknown>|null} state
 * @property {boolean} present
 * @property {number} onlineCursor
 * @property {(state: Record<string, unknown>|null) => PigTarget} mountLegacyTarget
 * @property {(options: {body: Record<string, unknown>}) => PigTarget} attachPig
 * @property {(target: PigTarget, execute: (state: Record<string, unknown>) => unknown, options?: TransactOptions) => unknown} transact
 * @property {(target: PigTarget, next: Record<string, unknown>|null) => void} replaceLegacyState
 * @property {(target: PigTarget) => void} releaseTarget
 * @property {() => void} dispose
 */

/**
 * @typedef {object} PigTarget
 * @property {'pig-target'} kind
 * @property {OwnerAuthority} owner
 * @property {Record<string, unknown>|null} body
 * @property {readonly string[]} bodyPaths
 * @property {Record<string, unknown>|null} state
 * @property {boolean} present
 * @property {() => void} release
 */

/**
 * 建立一个空 owner 权威。随后用 `mountLegacyTarget(state)` 接入旧单猪存档，
 * 或用 `attachPig({body})` 建立私有内存目标。owner 生命周期由调用方显式
 * `dispose()`；释放一个 target 不会释放 owner 或其他 target。
 * @returns {OwnerAuthority}
 */
export function createOwnerResources() {
  /** @type {Record<string, unknown>} */
  let resources = {}
  /** @type {Record<string, unknown>} */
  let opaque = {}
  /** @type {Record<string, unknown>} */
  let format = {}
  let hasDocument = false
  let disposed = false
  let active = false
  let onlineCursor = 0
  /** @type {Set<PigTarget>} */
  const targets = new Set()
  /** @type {Map<PigTarget, PigHolder>} */
  const holders = new Map()
  /** @type {WeakSet<PigTarget>} */
  const released = new WeakSet()

  /** @returns {Record<string, unknown>} */
  const getResources = () => resources
  /** @returns {Record<string, unknown>} */
  const getOpaque = () => opaque
  /** @returns {Record<string, unknown>} */
  const getFormat = () => format

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
    if (disposed) throw new Error('owner resources disposed')
    const holder = holderOf(target)
    if (holder.disposed) throw new Error('pig target released')
    if (target.owner !== owner) throw new Error('pig target belongs to another owner')
    return holder
  }

  /** Route any pending direct facade writes for live targets before a copy. @param {PigHolder|null} except */
  function syncLiveTargets(except) {
    for (const holder of holders.values()) {
      if (holder === except || holder.disposed || holder.body === null || holder.view === null) continue
      holder.sync()
    }
  }

  /**
   * Rebuild every other live target's facade key set after shared resources
   * changed shape. Their bodies and view object identities stay unchanged.
   * @param {PigHolder|null} except
   */
  function refreshViews(except) {
    for (const holder of holders.values()) {
      if (holder === except || holder.disposed || holder.body === null || holder.view === null) continue
      holder.sync()
      const adapter = createLegacyStateAdapter({
        getResources,
        getBody: () => holder.body,
        getOpaque,
        getFormat,
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
      getResources,
      getBody: () => holder.body,
      getOpaque,
      getFormat,
      base,
      opaqueWritable,
    })
    holder.view = adapter.view
    holder.sync = adapter.sync
    /** @type {PigTarget} */
    const target = {
      kind: 'pig-target',
      owner,
      get body() { return holder.disposed ? null : holder.body },
      bodyPaths: PIG_BODY_PATHS,
      get state() {
        if (disposed || holder.disposed) return null
        if (holder.view === null) return null
        holder.sync()
        return holder.view
      },
      get present() { return !disposed && !holder.disposed && holder.body !== null },
      release() { owner.releaseTarget(target) },
    }
    holders.set(target, holder)
    targets.add(target)
    Object.freeze(target)
    return target
  }

  /**
   * Replace only this target's body and the single owner document. Legacy
   * reset/adopt/import/work-ledger use this; it is NOT an add-pig flow.
   * @param {PigTarget} target
   * @param {Record<string, unknown>|null} next
   */
  function replaceTarget(target, next) {
    const holder = assertUsable(target)
    if (next === null) {
      const hasOthers = [...targets].some(targetEntry => {
        if (targetEntry === target) return false
        const other = holders.get(targetEntry)
        return other !== undefined && !other.disposed && other.body !== null
      })
      if (hasOthers) {
        // Detach any stale view of the released target: the owner keeps its
        // resources, but the old facade must not remain a writable alias into
        // B's shared wallet/backpack/farm. Copy once and refresh live targets.
        syncLiveTargets(holder)
        const nextResources = clone(resources)
        const nextOpaque = clone(opaque)
        const nextFormat = clone(format)
        holder.body = null
        holder.view = null
        holder.sync = () => {}
        holder.generation += 1
        resources = nextResources
        opaque = nextOpaque
        format = nextFormat
        refreshViews(holder)
      } else {
        holder.body = null
        holder.view = null
        holder.sync = () => {}
        holder.generation += 1
        resources = {}
        opaque = {}
        format = {}
        hasDocument = false
      }
      return
    }
    if (next === holder.view) {
      holder.sync()
      refreshViews(holder)
      return
    }
    if (!isObject(next)) throw new TypeError('legacy state replacement must be an object or null')
    if (isLegacyView(next)) throw new Error('refusing to install a live legacy view; pass a plain state snapshot instead')
    const parts = splitLegacyState(next)
    resources = parts.resources
    opaque = parts.opaque
    format = parts.format
    holder.body = parts.body
    holder.generation += 1
    hasDocument = true
    const adapter = createLegacyStateAdapter({
      getResources,
      getBody: () => holder.body,
      getOpaque,
      getFormat,
      base: next,
      opaqueWritable: holder.opaqueWritable,
    })
    holder.view = adapter.view
    holder.sync = adapter.sync
    refreshViews(holder)
  }

  /**
   * @param {PigTarget} target
   * @param {Record<string, unknown>} snapshot
   */
  function restoreTarget(target, snapshot) {
    replaceTarget(target, snapshot)
  }

  /** @type {OwnerAuthority} */
  const owner = {
    kind: 'owner-resources',
    sharedPaths: OWNER_RESOURCE_PATHS,
    get state() { return disposed || !hasDocument ? null : resources },
    get present() { return !disposed && hasDocument },
    /** Nonpersistent owner-runtime polling cursor. Never written to the save. */
    get onlineCursor() { return onlineCursor },
    set onlineCursor(next) {
      onlineCursor = typeof next === 'number' && Number.isFinite(next) && next > 0 ? next : 0
    },
    /**
     * 旧单猪存档入口。只允许在还没有任何 target 时调用，避免把一次重置/
     * 导入误当成“新增一只猪”。
     * @param {Record<string, unknown>|null} state
     * @returns {PigTarget}
     */
    mountLegacyTarget(state) {
      if (disposed) throw new Error('owner resources disposed')
      if (active) throw new Error('owner resource transaction is not reentrant')
      if (targets.size > 0) throw new Error('legacy owner document already has a pig target')
      if (state !== null && !isObject(state)) throw new TypeError('legacy state must be an object or null')
      if (isLegacyView(state)) throw new Error('refusing to mount a live legacy view; pass a plain state snapshot instead')
      onlineCursor = 0
      if (state === null) {
        resources = {}
        opaque = {}
        format = {}
        hasDocument = false
        return createTarget(null, null, true)
      }
      const parts = splitLegacyState(state)
      resources = parts.resources
      opaque = parts.opaque
      format = parts.format
      hasDocument = true
      return createTarget(parts.body, state, true)
    },
    /**
     * 私有的内存多目标构造：只接收完整猪本体，不初始化/复制 shared resources，
     * 不调用 hatch/reset/adopt，不再发 500 初始金币，也不写第二份存档。
     * @param {{body: Record<string, unknown>}} options
     * @returns {PigTarget}
     */
    attachPig(options) {
      if (disposed) throw new Error('owner resources disposed')
      if (active) throw new Error('owner resource transaction is not reentrant')
      const body = options?.body
      if (!isObject(body)) throw new TypeError('attachPig needs an explicit pig body object')
      const parts = splitLegacyState(body)
      if (Object.keys(parts.resources).length > 0 || Object.keys(parts.format).length > 0 || Object.keys(parts.opaque).length > 0) {
        throw new TypeError('attachPig body must contain only classified pig-body fields; it must not carry owner resources or format metadata')
      }
      hasDocument = true
      return createTarget(parts.body, null, false)
    },
    /**
     * 同一 owner 的同步事务。execute 收到 live flat facade；成功返回它的结果，
     * 失败/拒绝/thenable/重入/过期 target 会恢复 resources + 当前 body + 在线游标；
 * 显式业务拒绝恢复后原样返回拒绝对象，异常失败则抛错。
     * @param {PigTarget} target
     * @param {(state: Record<string, unknown>) => unknown} execute
     * @param {TransactOptions} [options]
     * @returns {unknown}
     */
    transact(target, execute, options = {}) {
      const holder = assertUsable(target)
      if (holder.body === null || holder.view === null) return { ok: false, reason: 'absent' }
      if (active) throw new Error('owner resource transaction is not reentrant')
      syncLiveTargets(null)
      // Snapshot the full owner resources + this pig body, not only the keys
      // present in this facade: a sibling facade may have introduced a new
      // shared key that this view has not materialised yet.
      const snapshot = composeLegacyState({ resources, body: holder.body, opaque, format })
      const generation = holder.generation
      const cursorBefore = onlineCursor
      active = true
      try {
        const result = execute(holder.view)
        if (isThenable(result)) {
          // Swallow the late rejection so a rejected async core result cannot
          // become an unhandled host error after we already rolled back.
          Promise.resolve(result).catch(() => {})
          throw new Error('owner transaction refuses a thenable result')
        }
        if (disposed) throw new Error('owner resources disposed during transaction')
        const current = holderOf(target)
        if (current.generation !== generation) throw new Error('pig target changed during transaction')
        // Explicit business refusal is a rollback, not an exception: return the
        // caller's exact {ok:false,reason} object after restoring both parts.
        // This check happens before facade sync so a refused callback cannot
        // publish a data-property write either.
        if (isExplicitRefusal(result)) {
          onlineCursor = cursorBefore
          restoreTarget(target, snapshot)
          return result
        }
        holder.sync()
        if (options.afterSuccess !== undefined) options.afterSuccess(result, holder.view)
        // One legacy target has no sibling view to refresh. With an internal
        // multi-target owner, keep every sibling facade's key set in sync with
        // shared resources (e.g. a first-time wallets/achievements/extData key).
        if (targets.size > 1) refreshViews(holder)
        return result
      } catch (error) {
        onlineCursor = cursorBefore
        restoreTarget(target, snapshot)
        throw error
      } finally {
        active = false
      }
    },
    /** @param {PigTarget} target @param {Record<string, unknown>|null} next */
    replaceLegacyState(target, next) {
      assertUsable(target)
      if (active) throw new Error('owner resource transaction is not reentrant')
      replaceTarget(target, next)
    },
    /** @param {PigTarget} target */
    releaseTarget(target) {
      if (active) throw new Error('owner resource transaction is not reentrant')
      if (released.has(target)) return
      const holder = holderOf(target)
      // Detach this target's stale view without destroying the owner or other
      // pigs: keep the same values under a new canonical object and refresh B.
      syncLiveTargets(null)
      const nextResources = clone(resources)
      const nextOpaque = clone(opaque)
      const nextFormat = clone(format)
      holder.disposed = true
      holder.generation += 1
      targets.delete(target)
      resources = nextResources
      opaque = nextOpaque
      format = nextFormat
      try {
        refreshViews(null)
      } finally {
        released.add(target)
        holders.delete(target)
        holder.body = null
        holder.view = null
        holder.sync = () => {}
      }
    },
    dispose() {
      if (disposed) return
      if (active) throw new Error('owner resource transaction is not reentrant')
      disposed = true
      active = false
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
      // Old facade references keep their captured objects; the owner no longer
      // exposes or writes them after dispose.
      resources = {}
      opaque = {}
      format = {}
      onlineCursor = 0
      hasDocument = false
    },
  }
  Object.freeze(owner)
  return owner
}
