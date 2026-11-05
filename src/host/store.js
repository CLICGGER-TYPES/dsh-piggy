// @ts-check
/**
 * The pig's save: open it, keep the pig's whole state in memory, and write it
 * back on a throttle.
 *
 * Only IO and lifetime live here — the method table is in store/api.js and the
 * actual game rules are in core/ (see docs/CONVENTIONS.md).
 *
 * F02: the live state is a legacy flat facade owned by a real per-owner
 * resource authority (store/owner-resources.js). Shared resources and the
 * selected pig body are separate canonical objects; the facade is only the
 * compatibility shape pure core expects. One synchronous owner transaction
 * commits/rolls back both parts, and one existing timer writes the single v15
 * flat save. No per-pig save writer, file, ID or resource copy is introduced.
 *
 * @module dsh-piggy/store
 */
import { dirname } from 'node:path'

import { settleAchievements } from './core.js'
import { createApi } from '../../store/api.js'
import { createCommandContext } from '../../store/command-context.js'
import { createOwnerResources, isExplicitRefusal } from '../../store/owner-resources.js'
import { createApplicationContext } from '../../store/target-context.js'
import { createJournal } from '../../store/journal.js'
import { defaultStatePath, dshHome, moveLegacySaveDir, readStateFile, writeStateFile } from '../../store/state-file.js'

export { defaultStatePath, dshHome, moveLegacySaveDir }

const SAVE_THROTTLE_MS = 1500

/**
 * 内部组合句柄：运行时要把同一个 application/command 边界登记到会话能力上，
 * 而不是另建一套 owner/target。它不是新的公共 store 方法；属性不可枚举，
 * `Object.keys(store)` 和旧调用方看到的形状不变。
 */
export const STORE_INTERNALS = Symbol.for('dsh-piggy.store.internals')

/** @param {unknown} value */
const isThenable = value => value !== null &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (/** @type {{then?: unknown}} */ (value).then) === 'function'

/**
 * Open (or lazily create on first hatch) the save file.
 * @param {string} [filePath] - where the save lives.
 * @param {object} [options] - test seams and explicit owner-backed target injection.
 * @param {() => number} [options.now] - injectable clock.
 * @param {Function} [options.setTimer] - injectable scheduler.
 * @param {Function} [options.clearTimer] - injectable canceller.
 * @param {object} [options.journal] - 自定义日志本（测试或桌面外壳用）。
 * @param {import('../../store/owner-resources.js').OwnerAuthority} [options.ownerAuthority] - explicit OwnerDocument owner
 * @param {import('../../store/owner-resources.js').PigTarget} [options.pigTarget] - target already registered with ownerAuthority
 * @param {(target: import('../../store/owner-resources.js').PigTarget) => void} [options.persistOwnerDocument] - synchronous owner-document CAS writer
 * @param {(target: import('../../store/owner-resources.js').PigTarget, next: Record<string, unknown>|null) => void|(() => void)} [options.replaceState] - optional target-scoped lifecycle replacement; may return an undo for settle failure
 * @param {(target: import('../../store/owner-resources.js').PigTarget) => object|null} [options.readState] - optional isolated live-state read adapter
 * @param {{kind:string,targets?:number,ownerId?:string}} [options.persistence] - explicit persistence capability metadata
 */
export function createStore(filePath = defaultStatePath(), options = {}) {
  const now = options.now ?? (() => Date.now())
  const setTimer = options.setTimer ?? setTimeout
  const clearTimer = options.clearTimer ?? clearTimeout
  // 日志落在存档旁边：用户报问题时要的就是这个目录里的东西。
  const journal = options.journal ?? createJournal({ dir: typeof filePath === 'string' ? dirname(filePath) : '', now })
  const report = (level, scope, message, fields) => journal.record(level, scope, message, fields)

  let dirty = false
  let timer = null
  let closed = false
  let pendingReplacementRollback = null

  const suppliedOwner = options.ownerAuthority ?? null
  const suppliedTarget = options.pigTarget ?? null
  if ((suppliedOwner === null) !== (suppliedTarget === null)) {
    throw new TypeError('owner-backed store needs both ownerAuthority and pigTarget')
  }
  if (suppliedOwner !== null && (typeof options.persistOwnerDocument !== 'function' ||
      typeof options.replaceState !== 'function' || typeof options.readState !== 'function' ||
      options.persistence?.kind !== 'owner-document-multi-target')) {
    throw new TypeError('owner-backed store needs its document writer, isolated state adapter, and explicit persistence capability')
  }
  const opened = suppliedOwner === null
    ? readStateFile(filePath, now(), journal)
    : { state: null, needsSave: false }
  // 一个 owner 权威 + 旧单猪存档适配出的一个 target。资源/本体在内存里分开，
  // 但对外仍是一份 v15 扁平存档和同一个 createStore 形状。
  const ownsOwner = suppliedOwner === null
  const owner = suppliedOwner ?? createOwnerResources()
  const target = suppliedTarget ?? owner.mountLegacyTarget(opened.state)
  dirty = opened.needsSave
  report('info', 'save', '存档打开', { path: filePath, version: target.state?.version ?? null, hatched: target.state !== null, needsSave: dirty })

  function scheduleSave() {
    dirty = true
    if (typeof options.persistOwnerDocument === 'function') {
      writeNow()
      return
    }
    if (timer !== null) return
    timer = setTimer(() => {
      timer = null
      try {
        writeNow()
      } catch (error) {
        // A failed write must not break the harness, but it must not be silent
        // either: the player would keep playing against a save that is not there.
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[dsh-piggy] save failed: path="${filePath}" reason="${reason}"`)
        report('error', 'save', '存档写入失败', { path: filePath, reason })
      }
    }, SAVE_THROTTLE_MS)
    if (typeof timer?.unref === 'function') timer.unref()
  }

  function writeNow() {
    // target.state 是 live facade，读取前会把直接塞进 facade 的未声明属性
    // 同步回 canonical/opaque；写盘仍然只写一个 v15 扁平对象。
    const state = target.state
    if (!dirty || state === null) return
    if (typeof options.persistOwnerDocument === 'function') options.persistOwnerDocument(target)
    else writeStateFile(filePath, state)
    dirty = false
  }

  /**
   * 同步 owner 事务：资源与目标猪 body 一致提交/回滚；成功时在同一个事务里
   * 结算成就，然后只排原来的一个节流保存。公共 store.mutate 仍只给回调一个
   * live flat state 参数。
   * @param {(state: object) => object} fn
   * @param {import('../../store/command-context.js').CommandRunOptions} [options]
   * @returns {object}
   */
  function commit(fn, options = {}) {
    const current = target.state
    if (current === null) return { ok: false, reason: 'absent' }
    let save = true
    try {
      return owner.transact(target, live => {
        const value = fn(live)
        if (isThenable(value)) {
          Promise.resolve(value).catch(() => {})
          throw new Error('store command refuses a thenable result')
        }
        if (isExplicitRefusal(value)) return value
        save = options.saveWhen === undefined ? true : options.saveWhen(value)
        return value
      }, {
        afterSuccess: (_value, live) => {
          if (!save) return
          settleAchievements(live, now())
          // Schedule inside the transaction so a throwing custom scheduler is
          // rolled back with the command (baseline mutate did the same).
          scheduleSave()
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // 这里以前什么都不留：规则抛错时用户只看到「没成」，事后无从查起。
      console.warn(`[dsh-piggy] core mutator threw and the change was rolled back: reason="${message}"`)
      report('error', 'core', '规则抛错，改动已回滚', { reason: message, stack: error instanceof Error ? error.stack : '' })
      return { ok: false, reason: 'error', message }
    }
  }

  /**
   * lifecycle 替换后的结算入口：hatch/reset/adopt 等已经通过 application
   * replaceState 做了 owner 资源+body 的同步替换；这里在单独事务里结算成就
   * 并排一次保存。它不改变这些方法原有的返回值和时钟调用顺序。
   */
  function settle() {
    if (target.state === null) return
    try {
      const execute = live => {
        settleAchievements(live, now())
        return { ok: true }
      }
      if (typeof options.persistOwnerDocument === 'function') {
        owner.transact(target, execute, { afterSuccess: () => scheduleSave() })
      } else {
        owner.transact(target, execute)
        scheduleSave()
      }
      pendingReplacementRollback = null
    } catch (error) {
      const rollback = pendingReplacementRollback
      pendingReplacementRollback = null
      try { rollback?.() } catch (rollbackError) {
        if (error instanceof Error) /** @type {Error & {rollbackError?: unknown}} */ (error).rollbackError = rollbackError
      }
      throw error
    }
  }

  // 每个 store/runtime 一个应用上下文。新路径的 owner/target 是真实权威；
  // 句柄读取 live facade，所以 hatch/reset/import/replace 会立刻被看到。
  const application = createApplicationContext({
    owner,
    target,
    now,
    ...(typeof options.readState === 'function' ? { readState: () => options.readState(target) } : {}),
    ...(typeof options.replaceState === 'function'
      ? { replaceState: next => {
        const undo = options.replaceState(target, next)
        if (typeof undo === 'function') pendingReplacementRollback = undo
      } }
      : {}),
  })
  const commands = createCommandContext({ context: application, commit })

  const api = createApi({
    filePath,
    journal,
    application,
    commands,
    scheduleSave,
    settle,
    dispose() {
      closed = true
      if (timer !== null) {
        clearTimer(timer)
        timer = null
      }
      try {
        // OwnerDocument commits are synchronous inside the owner transaction. A
        // remaining dirty flag means that commit failed and the runtime is already
        // faulted; a dispose-time retry must not turn a failed command into a late write.
        if (typeof options.persistOwnerDocument === 'function') dirty = false
        else writeNow()
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`[dsh-piggy] final save failed: path="${filePath}" reason="${reason}"`)
        report('error', 'save', '退出前最后一次写入失败', { path: filePath, reason })
      } finally {
        if (ownsOwner) owner.dispose()
      }
    },
  })
  // 显式的持久化能力声明：当前只有旧单目标扁平档。运行时用它判断是否允许
  // 全平持久化；不从存档字段名推断多目标（未知旧字段仍原样保留）。
  // 名字与 runtime/session-context.js 的 FLAT_PERSISTENCE.LEGACY_SINGLE_TARGET 一致。
  const persistence = options.persistence ?? Object.freeze({ kind: 'legacy-flat-single-target', targets: 1, legacyTarget: true })
  const store = Object.assign(api, {
    /** 工作事务先保存基线并撤下节流计时器，失败后不能再写回旧状态。 */
    flush(force = false) {
      if (timer !== null) { clearTimer(timer); timer = null }
      if (force && target.state !== null) dirty = true
      writeNow()
    },
    /** 仅由游戏运行时在持久提交后安装状态，不重新结算或安排写盘。 */
    installCommittedState(next) {
      // runtime 在导入失败路径里会先 dispose 旧 store 再 install(null)。旧 store
      // 已经停表且 owner 生命周期结束，这时不应再重开/替换目标；保持关闭语义。
      if (closed) { dirty = false; return }
      application.replaceState(next)
      dirty = false
    },
  })
  Object.defineProperty(store, STORE_INTERNALS, {
    value: Object.freeze({ application, commands, persistence }),
    enumerable: false,
    writable: false,
    configurable: false,
  })
  return store
}
