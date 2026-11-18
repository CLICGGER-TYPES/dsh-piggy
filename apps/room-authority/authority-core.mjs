// @ts-check
/** 公网权威的核心：按房间维护一局 1v1，纯内存，不做持久化。 */
import { applyAction, createMatch, initialEvent, publicView } from '../../src/extensions/roulette/online.js'

export const MATCH_TTL_MS = 30 * 60 * 1000
export const SILENCE_MS = 20000

function envelope(event) {
  return { ext: 'roulette', op: event.op, data: event }
}

export function createAuthority({ now = Date.now, random = Math.random, silenceMs = SILENCE_MS } = {}) {
  /** @type {Map<string, { state: any, at: number, seen: Record<string, number> }>} */
  const matches = new Map()

  function create(room, from, data) {
    if (typeof data?.matchId !== 'string' || data.matchId === '' || data.matchId.length > 64) return null
    if (typeof data.guestId !== 'string' || data.guestId === '' || data.guestId === from) return null
    if (data.settings === null || typeof data.settings !== 'object') return null
    const existing = matches.get(room)
    if (existing && existing.state.stage !== 'matchOver') return null
    const state = createMatch({
      matchId: data.matchId,
      hostId: from,
      guestId: data.guestId,
      lives: data.settings.lives,
      format: data.settings.format,
      stake: data.settings.stake,
      loadCount: data.settings.loadCount,
    }, random)
    const at = now()
    const entry = { state, at, seen: { [state.hostId]: at, [state.guestId]: at } }
    matches.set(room, entry)
    return {
      ok: true,
      events: [
        envelope(initialEvent(state)),
        envelope({ op: 'round-start', round: 1, stake: state.settings.stake, pot: state.pot, view: publicView(state) }),
      ],
    }
  }

  /** 一位玩家的心跳沉默超过 20 秒：由公网权威替对手判认输，房间里的对局才会真正结束。 */
  function settleIdle(entry, from) {
    const state = entry.state
    if (state.stage === 'matchOver') return []
    const other = from === state.hostId ? state.guestId : state.hostId
    if (now() - (entry.seen[other] ?? entry.at) < silenceMs) return []
    const seat = other === state.hostId ? 'host' : 'guest'
    const result = applyAction(state, { from: other, seq: (state.lastSeq[seat] ?? 0) + 1, op: 'leave', data: { force: true } })
    entry.at = now()
    return result.ok ? (result.events ?? []).map(envelope) : []
  }

  function handle(body) {
    const { room, from, seq, ext, op, data } = body
    if (typeof room !== 'string' || room === '') return { ok: false, reason: 'bad-room' }
    if (typeof from !== 'string' || from === '') return { ok: false, reason: 'bad-from' }
    if (!Number.isSafeInteger(seq) || seq <= 0) return { ok: false, reason: 'bad-seq' }
    if (ext !== 'roulette') return { ok: false, reason: 'bad-ext' }
    if (op === 'create') {
      return create(room, from, data) ?? { ok: false, reason: 'create-rejected' }
    }
    const entry = matches.get(room)
    if (!entry) return { ok: false, reason: 'no-match' }
    if (from !== entry.state.hostId && from !== entry.state.guestId) return { ok: false, reason: 'not-seat' }
    entry.seen[from] = now()
    if (op === 'snapshot') {
      entry.at = now()
      return { ok: true, events: [envelope({ op: 'snapshot', view: publicView(entry.state) }), ...settleIdle(entry, from)] }
    }
    // 心跳只用来让对端知道人还在；from 必须带到房间事件里，
    // 否则两端都看到 from=authority，会把对端的心跳当成自己的。
    if (op === 'ping') {
      entry.at = now()
      return {
        ok: true,
        events: [{ ext: 'roulette', op: 'ping', from, data: { op: 'ping' } }, ...settleIdle(entry, from)],
      }
    }
    if (op !== 'action') return { ok: false, reason: 'bad-op' }
    if (data === null || typeof data !== 'object' || typeof data.op !== 'string') {
      return { ok: false, reason: 'bad-action' }
    }
    const result = applyAction(entry.state, { from, seq, op: data.op, data }, random)
    entry.at = now()
    if (!result.ok) return result
    return { ok: true, events: (result.events ?? []).map(envelope) }
  }

  function sweep() {
    const cutoff = now() - MATCH_TTL_MS
    for (const [room, entry] of matches) if (entry.at < cutoff) matches.delete(room)
  }

  return { handle, sweep, matches }
}
