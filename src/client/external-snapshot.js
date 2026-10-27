// @ts-check
/**
 * 快照里的 link 字段（附录 A.3）：只有宿主明确给了合法 state 才进入镜像模式。
 * 旧宿主没有这个字段就返回 null，面板完全按内嵌猪走，不猜。
 * @module dsh-piggy/client/external-snapshot
 */
import { num, obj, str } from './values.js'

const STATES = ['connecting', 'connected', 'reconnecting', 'disconnected', 'merging']

/** @returns {null | {state: string, lastAt: number, queued: number, merged: boolean, dead: boolean}} */
export function normalizeLink(raw) {
  const link = obj(raw)
  const state = str(link.state, '')
  if (!STATES.includes(state)) return null
  return {
    state,
    lastAt: num(link.lastAt, 0),
    queued: num(link.queued, 0),
    merged: link.merged === true,
    dead: link.dead === true,
  }
}
