// @ts-check
/**
 * 照料、活动与回家命令。
 * createApi 负责唯一的公开对象与 context 校验；这里仅返回原签名方法。
 * @module dsh-piggy/store/api-actions
 */
import {
  act as coreAct,
  applyGuestCare as coreApplyGuestCare,
  applyGuestMedicine as coreApplyGuestMedicine,
  callOffActivity as coreCallOff,
  decay,
  feed as coreFeed,
  grantAll as coreGrantAll,
  recordOnline as coreRecordOnline,
  sayAfter as coreSayAfter,
  settlePomodoro as coreSettlePomodoro,
  startInterest as coreStartInterest,
  startStudy as coreStartStudy,
  startTrip as coreStartTrip,
  startWork as coreStartWork,
  touch as coreTouch,
  takeCareItem as coreTakeCareItem,
  refundCareItem as coreRefundCareItem,
  writeDiaryIfNewDay as coreWriteDiary,
  extensionOn as coreExtensionOn,
} from '../src/host/core.js'

/** @typedef {import('./api.js').ApiRuntime} ApiRuntime */

/** @param {ApiRuntime} runtime */
export function createApiActions(runtime) {
  const { application, commands, getState, mutate, now } = runtime
  return {
    /** Digest one observed harness event; silently ignored before hatching. */
    feed(event) {
      const state = getState()
      if (state === null) return []
      try {
        const result = commands.runFor(commands.scope, live => ({ crossed: coreFeed(live, event, now()) }))
        if (Array.isArray(result?.crossed)) return result.crossed
        if (result?.reason === 'error') {
          console.warn(`[dsh-piggy] feed failed: event="${event}" reason="${result.message ?? 'error'}"`)
        }
        return []
      } catch (error) {
        console.warn(`[dsh-piggy] feed failed: event="${event}" reason="${error instanceof Error ? error.message : String(error)}"`)
        return []
      }
    },

    /** Fold wall-clock decay in (and resolve work/illness) then hand back state. */
    freshen() {
      const state = getState()
      if (state === null) return null
      try {
        const nowMs = now()
        const cursor = application.owner.onlineCursor
        const result = commands.runFor(commands.scope, live => {
          // 在线时长按真实时间累计（与调试页的时间倍率无关）；每次读状态就是
          // 一次「面板还在轮询」的证据。共享 owner 的 cursor 让 A/B 同一段
          // 真实时间只计一次；旧 createApi 上下文仍各自拥有等价游标。
          coreRecordOnline(live, cursor, nowMs)
          decay(live, nowMs)
          // 离线活动先按发生时间逐段结算、翻页；最后再归到当前游戏日。
          coreWriteDiary(live, nowMs)
          // 番茄钟到点就在下一次请求结算（关着面板也算），奖励与计数都在核心侧。
          // 番茄钟扩展关着就不结算（关的时候进行中的那一个已经放弃）。
          if (coreExtensionOn(live, 'pomodoro')) coreSettlePomodoro(live, nowMs)
          return { ok: true }
        })
        const failed = result !== null && typeof result === 'object' && result.ok === false
        if (!failed) {
          // Legacy createApi commits may return undefined/false even though the
          // callback ran; only a structured failure withholds the cursor.
          application.owner.onlineCursor = nowMs
        } else if (result.reason === 'error') {
          // Keep the stale-but-valid state, but say why it is stale.
          console.warn(`[dsh-piggy] decay failed: reason="${result.message ?? 'error'}"`)
        }
      } catch (error) {
        console.warn(`[dsh-piggy] decay failed: reason="${error instanceof Error ? error.message : String(error)}"`)
      }
      return getState()
    },

    /** Apply one care action with its cooldown, spending `itemKey` when given. */
    act: (action, itemKey) => mutate(live => coreAct(live, action, now(), itemKey)),

    /** Guest care: apply a friend's item to this pig without spending this pig's bag. */
    guestCare: (action, itemKey) => mutate(live => action === 'medicine'
      ? coreApplyGuestMedicine(live, itemKey, now())
      : coreApplyGuestCare(live, action, now(), itemKey)),

    /** Guest side: take one item from the local bag before sending the care intent. */
    takeCareItem: (action, itemKey) => mutate(live => coreTakeCareItem(live, action, itemKey)),

    /** Guest side: give it back if the target never accepted it. */
    refundCareItem: (action, itemKey) => mutate(live => coreRefundCareItem(live, action, itemKey)),

    /** 拿起/抛出/戳一下：只刷新活跃时间，不消耗物品、不加心情。 */
    touch: () => mutate(live => coreTouch(live, now())),

    /** Send the pig out to work. */
    startWork: (jobKey, short = false) => mutate(live => coreSayAfter(live, coreStartWork(live, jobKey, now(), short === true), 'workStart', now())),

    /** Send the pig to class. */
    startStudy: (subjectKey, stageKey) => mutate(live => coreSayAfter(live, coreStartStudy(live, subjectKey, stageKey, now()), 'studyStart', now())),

    /** Send the pig to an 兴趣课. */
    startInterest: interestKey => mutate(live => coreSayAfter(live, coreStartInterest(live, interestKey, now()), 'studyStart', now())),

    /** Debug: one of everything (consumables, 装扮, coins). */
    grantAll: () => mutate(live => coreGrantAll(live, now())),

    /** Send the pig travelling. */
    startTrip: tripKey => mutate(live => coreSayAfter(live, coreStartTrip(live, tripKey, now()), 'tripStart', now())),
    /** Bring the pig home early (work forfeits pay; study/trips are refunded). */
    callOffActivity: () => mutate(live => coreCallOff(live, now())),

    /** Back-compat alias. */
    callOffWork: () => mutate(live => coreCallOff(live, now())),

  }
}
