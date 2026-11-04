// @ts-check
/**
 * 旧版单 target runtime 的合并前结算。
 *
 * 终结活动/番茄/钓鱼也是 owner 事务：活动、退款、番茄和鱼必须在目标猪的
 * 同一个 body 里一致提交或回滚，不能先改 store.state 再 flush。这里只依赖
 * 组合根提供的 exclusive 和会话检查，不直接读写文件。
 */
import { STORE_INTERNALS } from '../store.js'
import { abandonPomodoro, callOffActivity, keepFish } from '../core.js'
import { persistenceIssue } from './session-context.js'

/**
 * @param {{
 *   options:any,
 *   state:{closed:boolean},
 *   getStore:() => any,
 *   assertAccepting:() => void,
 *   selectSession:(binding?:unknown) => any,
 *   exclusive:(operation:() => Promise<any>, allowClosing?: boolean) => Promise<any>,
 * }} deps
 */
export function createRuntimeMerge(deps) {
  const { options, state, getStore, assertAccepting, selectSession, exclusive } = deps

  function prepareMerge(target, binding) {
    // 在 exclusive 的例行 flush 之前就拒绝故障/过期/外来会话，避免旧句柄碰这份存档。
    assertAccepting()
    selectSession(binding)
    return exclusive(async () => {
      selectSession(binding)
      if (state.closed) throw new Error('game runtime closed')
      const store = getStore()
      const runtimeState = store.state
      if (runtimeState === null) return { ok: false, reason: 'absent', alreadyFinished: true }
      const internals = /** @type {any} */ (store)[STORE_INTERNALS]
      if (internals === undefined || internals === null) throw new Error('store internals missing')
      // 只按显式持久化能力判断，不按存档里的 pigs/pigBodies 等旧字段名猜。
      const persistence = persistenceIssue(internals.persistence)
      if (persistence !== null) return { ok: false, reason: persistence }
      const nowMs = options.now?.() ?? Date.now()
      /** @type {{ok:boolean, [key:string]: unknown}|null} */
      let result = null
      const application = internals.application
      // 终结也是 owner 事务：活动/退款/番茄/钓鱼与目标猪 body 一致提交或回滚，
      // 不再直接改 store.state 后 flush。
      application.owner.transact(application.target, live => {
        if (target === 'activity') {
          const had = live.activity !== null && live.activity !== undefined
          const called = callOffActivity(live, nowMs)
          result = { ok: true, alreadyFinished: had && called.ok !== true, summary: { had, result: called } }
        } else if (target === 'pomodoro') {
          const had = live.pomodoro?.startedAt !== null && live.pomodoro?.startedAt !== undefined
          const abandoned = abandonPomodoro(live, nowMs)
          result = { ok: true, alreadyFinished: had && abandoned.ok === true && abandoned.abandoned === false, summary: { had, result: abandoned } }
        } else if (target === 'fishing') {
          const pending = live.fishing?.pending ?? null
          if (pending === null) result = { ok: true, alreadyFinished: true, summary: { kept: false } }
          else if (pending.phase === 'caught') {
            const kept = keepFish(live, nowMs)
            result = { ok: true, alreadyFinished: true, summary: { kept: kept.ok === true, result: kept } }
          } else {
            // 手动钓鱼等待/搏斗：鱼跑掉，抛竿用掉的鱼饵不退。
            live.fishing.pending = null
            result = { ok: true, alreadyFinished: false, summary: { kept: false, escaped: true } }
          }
        } else result = { ok: false, reason: 'unknown-target' }
        return result
      })
      if (result === null) throw new Error('prepareMerge produced no result')
      if (result.ok !== false) store.flush(true)
      return result
    })
  }

  return { prepareMerge }
}
