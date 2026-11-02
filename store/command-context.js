// @ts-check
/**
 * 应用命令边界：把当前 store 的命令固定在显式的 target/owner 作用域上，
 * 统一走原来的 mutate 事务（成功后排保存、抛错回滚），读路径拿同一个 live
 * 状态。
 *
 * F02 的 createStore 把 commit 接到 OwnerAuthority.transact：一次命令对
 * shared resources 和目标猪 body 的修改由同一同步事务提交/回滚。这里仍不
 * 增加命令 ID、持久 revision、异步队列、网络认证或“最多一次”承诺；这些属于
 * 后续 transport/迁移契约。
 *
 * @module dsh-piggy/store/command-context
 */

/**
 * 只借用类型，不引入运行时依赖。
 * @typedef {import('./target-context.js').ApplicationContext} ApplicationContext
 * @typedef {import('./target-context.js').ApplicationScope} ApplicationScope
 */

/**
 * @typedef {object} CommandRunOptions
 * @property {(result: object) => boolean} [saveWhen] - 内部保存条件；用于
 *   保持“无效改名/空 pending 队列不排保存”的基线行为。
 */

/**
 * @typedef {object} CommandContextOptions
 * @property {ApplicationContext} context - createApplicationContext 的返回值
 * @property {(fn: (state: object) => object, options?: CommandRunOptions) => object} commit - store commit
 */

/**
 * @typedef {object} CommandScope
 * @property {ApplicationScope} scope - 显式的 owner/target 作用域
 * @property {() => number} now - 应用上下文里的注入时钟
 */

/**
 * 命令边界对 createApi 暴露的完整形状。
 * @typedef {object} CommandContext
 * @property {'command-context'} kind
 * @property {ApplicationScope} scope
 * @property {() => number} now
 * @property {(candidate: ApplicationScope, execute: (state: object, command: CommandScope) => object, options?: CommandRunOptions) => object} runFor
 * @property {(candidate: ApplicationScope) => object|null} readFor
 */

/**
 * 为一个应用上下文建立命令边界。
 * @param {CommandContextOptions} options
 * @returns {CommandContext}
 */
export function createCommandContext({ context, commit }) {
  if (context === null || typeof context?.assertScope !== 'function' || typeof context.now !== 'function') {
    throw new TypeError('command context needs an application context')
  }
  if (typeof commit !== 'function') throw new TypeError('command context needs the store commit')

  const scope = context.scope
  /** @type {CommandScope} */
  const commandScope = { scope, now: context.now }
  Object.freeze(commandScope)

  /**
   * 只对显式目标执行改状态命令。外来 scope 在这里直接抛错；
   * 没有“只剩一只猪就用它”的回退。
   *
   * 这是内部直接 API：execute 会收到 (state, commandScope) 两个参数。
   * 公共 store.mutate / 旧 createApi 回调的单参数契约由 store/api.js
   * 的别名层另行保证，二者不要混为一谈。
   * @param {ApplicationScope} candidate
   * @param {(state: object, command: CommandScope) => object} execute
   * @param {CommandRunOptions} [options]
   * @returns {object}
   */
  function runFor(candidate, execute, options) {
    context.assertScope(candidate)
    return options === undefined
      ? commit(state => execute(state, commandScope))
      : commit(state => execute(state, commandScope), options)
  }

  /**
   * 读/被动结算路径拿 live 状态；没有目标时返回 null。
   * 外来 scope 会在读取任何状态之前被拒绝。
   * @param {ApplicationScope} candidate
   * @returns {object|null}
   */
  function readFor(candidate) {
    context.assertScope(candidate)
    return context.state
  }

  /** @type {CommandContext} */
  const commands = {
    kind: 'command-context',
    scope,
    now: context.now,
    runFor,
    readFor,
  }
  Object.freeze(commands)
  return commands
}
