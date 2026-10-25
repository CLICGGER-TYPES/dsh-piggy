// @ts-check
/**
 * 轻量互动：拿起、抛出、戳/点猪。
 *
 * 这些动作不消耗物品、不加心情、不记 pets，只刷新 lastActiveAt。
 * 用户已取消长时间无互动自动睡着，不再据此触发叫醒台词。
 *
 * 走正常 core 通道（routes 的 touch → store.touch），页面不直接改存档。
 * @module dsh-piggy/core/interaction
 */

/**
 * @param {object|null} state
 * @param {number} nowMs
 * @returns {{ok:boolean, woke?:boolean, reason?:string}}
 */
export function touch(state, nowMs) {
  if (state === null || state === undefined || state.hatched !== true || state.dead === true) {
    return { ok: false, reason: 'silent' }
  }
  state.lastActiveAt = nowMs
  return { ok: true, woke: false }
}
