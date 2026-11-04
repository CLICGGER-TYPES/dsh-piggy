// @ts-check
/**
 * 旧版单 target runtime 的运行态守卫与会话选择。
 *
 * 这里只做检查，不写盘：closed/fault 的 503 优先级必须早于会话探测和任何
 * prepare/flush，正常运行时也不能因此产生写入。会话只认本运行时自己发放的
 * 那一份绑定，不复用同路径的别的猪或运行时。
 */
import { STORE_INTERNALS } from '../store.js'
import {
  SESSION_BOUNDARY, SessionBoundaryError, assertApplicationUsable, assertLiveSession,
} from './session-context.js'

/**
 * @param {{
 *   state:{closed:boolean,accepting:boolean,busy:boolean,fault:unknown},
 *   getLedger:() => any,
 *   getStore:() => any,
 *   getSession:() => any,
 *   getRuntimeId:() => string,
 *   getGeneration:() => number,
 * }} deps
 */
export function createRuntimeGuards(deps) {
  const { state, getLedger, getStore, getSession, getRuntimeId, getGeneration } = deps

  function assertOperational() {
    if (state.closed) throw new Error('game runtime closed')
    if (state.fault) throw Object.assign(new Error('存档恢复未完成，请检查磁盘后重新启动'), { status: 503 })
  }
  function assertAccepting() {
    assertOperational()
    if (!state.accepting) throw Object.assign(new Error('game runtime closing'), { status: 503 })
  }
  function prepare() {
    assertOperational()
    getLedger().finish(getStore())
  }
  function available(allowClosing = false) {
    if (state.busy) throw Object.assign(new Error('正在处理存档，请稍后重试'), { status: 503 })
    if (allowClosing) assertOperational()
    else assertAccepting()
    prepare()
  }

  /**
   * 显式带来的会话必须就是当前这一代运行时；缺省只使用运行时自己的 embedded
   * 会话，不回退到“同路径的别的猪/别的运行时”。
   * @param {unknown} [binding]
   */
  function selectSession(binding) {
    const session = getSession()
    if (session === null) throw new Error('game runtime has no session')
    /** @type {import('./session-context.js').SessionBinding} */
    const active = /** @type {any} */ (binding === undefined || binding === null ? session : binding)
    if (active !== session) {
      const store = getStore()
      const internals = /** @type {any} */ (store)[STORE_INTERNALS]
      if (internals === undefined || internals === null) throw new Error('store internals missing')
      // 先给出处置/过期/外来的精确原因；再用对象身份拒绝“复制了同样元数据”
      // 的另一个已发放绑定。运行时的能力只认自己的那一份句柄。
      assertLiveSession(active, {
        runtimeId: getRuntimeId(),
        generation: getGeneration(),
        application: internals.application,
        commandScope: internals.commands.scope,
        owner: internals.application.owner,
        target: internals.application.target,
      })
      throw new SessionBoundaryError(SESSION_BOUNDARY.FOREIGN, 'session is not this runtime binding')
    }
    active.assertLive()
    // 会话身份/liveness 还不够：target 可能已被 release，owner 可能已 dispose。
    // 在 ledger/WAL/resource/body/save 之前用 F02 权威能力拒绝。
    assertApplicationUsable(active.assertApplication())
    return active
  }

  return { assertOperational, assertAccepting, prepare, available, selectSession }
}
