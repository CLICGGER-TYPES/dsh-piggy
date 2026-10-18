// @ts-check
/**
 * 轻量互动：拿起、抛出、戳/点猪。
 *
 * 这些动作不消耗物品、不加心情、不记 pets，只表示「主人刚碰过猪」：
 * - 刷新 lastActiveAt，让 sleepy 心情立刻回到正常；
 * - 如果之前已经超过 SLEEPY_AFTER_MINUTES，顺手说一句被吵醒的话（免打扰时不说）。
 *
 * 走正常 core 通道（routes 的 touch → store.touch），页面不直接改存档。
 * @module dsh-piggy/core/interaction
 */
import { SLEEPY_AFTER_MINUTES } from '../data.js'
import { say } from './lines.js'

/**
 * @param {object|null} state
 * @param {number} nowMs
 * @returns {{ok:boolean, woke?:boolean, reason?:string}}
 */
export function touch(state, nowMs) {
  if (state === null || state === undefined || state.hatched !== true || state.dead === true) {
    return { ok: false, reason: 'silent' }
  }
  const woke = Number.isFinite(state.lastActiveAt) && nowMs - state.lastActiveAt > SLEEPY_AFTER_MINUTES * 60000
  state.lastActiveAt = nowMs
  if (woke && state.dialogue?.quiet !== true) say(state, 'wake', nowMs)
  return { ok: true, woke }
}
