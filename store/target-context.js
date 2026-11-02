// @ts-check
/**
 * 应用上下文：一条应用命令针对哪只猪、共用资源属于哪位主人，以及本运行时
 * 注入的时钟。
 *
 * F02 起真实边界由 store/owner-resources.js 承担：
 * - owner 是 OwnerAuthority，`owner.state` 只暴露 canonical shared resources；
 * - target 是 PigTarget，`target.body` 是每猪独立本体；
 * - `target.state` 是给旧 pure core 的 live 扁平 facade（资源部分直接指向
 *   owner canonical，猪部分指向该 target 的 body）。
 *
 * 两个 target 可以绑定同一 owner，并各自有不同 body；不同 owner 完全隔离。
 * 这些句柄都是进程内能力对象，按引用识别，不是可持久化的 ownerId/pigId；
 * 文件名、昵称、runtimeId、状态对象地址都不能冒充跨设备身份。
 *
 * `createApplicationContext({getState,setState,now})` 的旧单扁平状态入口仍保留，
 * 供直接调用 createApi 的兼容路径使用；createStore 走新的 owner/target 入口。
 *
 * @module dsh-piggy/store/target-context
 */
import { OWNER_RESOURCE_PATHS, PIG_BODY_PATHS } from './state-ownership.js'

export { OWNER_RESOURCE_PATHS, PIG_BODY_PATHS }

/**
 * 类型只从 owner-resources 借用，不产生运行时依赖/循环。
 * @typedef {import('./owner-resources.js').OwnerAuthority} OwnerAuthority
 * @typedef {import('./owner-resources.js').PigTarget} AuthorityPigTarget
 */

/**
 * @typedef {object} ApplicationContextOptions
 * @property {() => object|null} [getState] - 旧入口：当前 live 扁平状态
 * @property {(next: object|null) => void} [setState] - 旧入口：替换 live 状态
 * @property {OwnerAuthority} [owner] - 新入口：每主人唯一资源权威
 * @property {AuthorityPigTarget} [target] - 新入口：绑定到该 owner 的目标猪
 * @property {() => number} now - 注入的时钟
 */

/**
 * 进程内的资源主人句柄。新路径是 OwnerAuthority（额外带事务方法）；
 * 旧路径是等价的 live 视图。`state` 不缓存旧状态。
 * @typedef {object} OwnerResources
 * @property {'owner-resources'} kind
 * @property {readonly string[]} sharedPaths
 * @property {object|null} state
 * @property {boolean} present
 * @property {number} onlineCursor - nonpersistent owner-runtime polling cursor
 */

/**
 * 绑定到某位主人的目标猪句柄。
 * @typedef {object} PigTarget
 * @property {'pig-target'} kind
 * @property {OwnerResources} owner
 * @property {readonly string[]} bodyPaths
 * @property {object|null} [body] - 新路径：每猪 canonical body（旧路径没有独立 body）
 * @property {object|null} state - live 扁平 facade
 * @property {boolean} present
 */

/**
 * 显式的应用作用域。`kind` 是判别字段，`assertScope` 会校验它。
 * @typedef {object} ApplicationScope
 * @property {'application-scope'} kind
 * @property {OwnerResources} owner
 * @property {PigTarget} target
 */

/**
 * 每个 store/runtime 一个的应用上下文。
 * @typedef {object} ApplicationContext
 * @property {'application-context'} kind
 * @property {OwnerResources} owner
 * @property {PigTarget} target
 * @property {ApplicationScope} scope
 * @property {() => number} now
 * @property {object|null} state
 * @property {(next: Record<string, unknown>|null) => void} replaceState
 * @property {(candidate: ApplicationScope) => ApplicationScope} assertScope
 */

/**
 * 建立一个运行时的应用上下文。新入口要求显式 owner+target；旧入口要求
 * getState+setState。两套入口不能混用。
 * @param {ApplicationContextOptions} options
 * @returns {ApplicationContext}
 */
export function createApplicationContext(options) {
  const authority = options.owner !== undefined || options.target !== undefined
  if (authority) {
    if (options.owner === undefined || options.target === undefined) {
      throw new TypeError('application context needs both owner and target')
    }
    if (options.getState !== undefined || options.setState !== undefined) {
      throw new TypeError('application context refuses legacy getState/setState when owner and target are supplied')
    }
    if (typeof options.now !== 'function') throw new TypeError('application context needs now')
    const owner = options.owner
    const target = options.target
    if (target.owner !== owner) throw new Error('pig target belongs to another owner; refusing to mix them')
    /** @type {ApplicationScope} */
    const scope = { kind: 'application-scope', owner, target }
    Object.freeze(scope)
    /** @type {ApplicationContext} */
    const context = {
      kind: 'application-context',
      owner,
      target,
      scope,
      now: options.now,
      get state() { return target.state },
      /** 旧 lifecycle 的整份替换；仍保留“整份旧档”语义，不是新增一只猪的流程。 */
      replaceState(next) { owner.replaceLegacyState(target, next) },
      /**
       * 拒绝来自另一 store/猪/主人的 scope，而不是回退到当前猪。
       * @param {ApplicationScope} candidate
       * @returns {ApplicationScope}
       */
      assertScope(candidate) {
        const belongs = candidate !== null &&
          typeof candidate === 'object' &&
          candidate.kind === 'application-scope' &&
          candidate.owner === owner &&
          candidate.target === target &&
          candidate.target.owner === candidate.owner
        if (!belongs) {
          throw new Error('application scope does not belong to this store; refusing to fall back to another pig or owner')
        }
        return candidate
      },
    }
    Object.freeze(context)
    return context
  }

  const getState = options.getState
  const setState = options.setState
  if (typeof getState !== 'function' || typeof setState !== 'function' || typeof options.now !== 'function') {
    throw new TypeError('application context needs getState, setState and now')
  }

  /** 旧入口的在线游标按上下文隔离，等价于原 createApi 的 lastPollMs。 */
  let legacyOnlineCursor = 0
  /** 家当引用；旧入口仍指向旧存档的扁平根对象。 @type {OwnerResources} */
  const owner = {
    kind: 'owner-resources',
    sharedPaths: OWNER_RESOURCE_PATHS,
    /** live 引用；旧单扁平状态没有独立家当对象。 */
    get state() { return getState() },
    get present() { return getState() !== null },
    get onlineCursor() { return legacyOnlineCursor },
    set onlineCursor(next) {
      legacyOnlineCursor = typeof next === 'number' && Number.isFinite(next) && next > 0 ? next : 0
    },
  }
  Object.freeze(owner)

  /** 目标猪；旧入口没有独立 body。 @type {PigTarget} */
  const target = {
    kind: 'pig-target',
    owner,
    bodyPaths: PIG_BODY_PATHS,
    /** live 引用；旧单扁平状态把家当和猪适配在同一对象里。 */
    get state() { return getState() },
    get present() { return getState() !== null },
  }
  Object.freeze(target)

  /** @type {ApplicationScope} */
  const scope = { kind: 'application-scope', owner, target }
  Object.freeze(scope)

  /** @type {ApplicationContext} */
  const context = {
    kind: 'application-context',
    owner,
    target,
    scope,
    now: options.now,
    /** 旧入口的 live 扁平根对象。 */
    get state() { return getState() },
    /** 替换目标状态（hatch/reset/adopt/import）；句柄仍然读 live 状态。 */
    replaceState(next) { setState(next) },
    /**
     * 拒绝来自另一 store/猪/主人的 scope，而不是回退到当前猪。
     * `kind` 必须先匹配 typedef；缺 discriminator 的 {{owner, target}}
     * 也一律拒绝。句柄按引用识别，所以外部伪造对象无法混入。
     * @param {ApplicationScope} candidate
     * @returns {ApplicationScope}
     */
    assertScope(candidate) {
      const belongs = candidate !== null &&
        typeof candidate === 'object' &&
        candidate.kind === 'application-scope' &&
        candidate.owner === owner &&
        candidate.target === target &&
        candidate.target.owner === candidate.owner
      if (!belongs) {
        throw new Error('application scope does not belong to this store; refusing to fall back to another pig or owner')
      }
      return candidate
    },
  }
  Object.freeze(context)
  return context
}
