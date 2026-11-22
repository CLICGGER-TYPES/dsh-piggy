// @ts-check
/**
 * 房间游戏事件通道：只做格式、大小、速率和 seq 校验，不解析牌局内容。
 * 事件由发送者的 token 推导 from，客户端不能伪造。
 */

export const GAME_EVENT_LIMIT = 32
export const GAME_MAX_DATA = 1536
export const GAME_MAX_DEPTH = 4
export const GAME_MAX_STRING = 256
export const GAME_RATE_WINDOW_MS = 1000
export const GAME_RATE_LIMIT = 20

const EXT_RE = /^[a-z0-9-]{1,32}$/u
const OP_RE = /^[a-z][a-z0-9-]{0,31}$/u

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

function validValue(value, depth) {
  if (depth > GAME_MAX_DEPTH) return false
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.length <= GAME_MAX_STRING
  if (Array.isArray(value)) return value.length <= 32 && value.every(item => validValue(item, depth + 1))
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    return keys.length <= 32 && keys.every(key => key.length <= 32 && validValue(value[key], depth + 1))
  }
  return false
}

/**
 * @param {{ now: () => number, send: Function, fail: Function, readJson: Function,
 *   exactKeys: Function, findPlayer: Function, bump: Function, version: () => number }} deps
 */
export function createRoomGame(deps) {
  const { now, send, fail, readJson, exactKeys, findPlayer, bump, version } = deps
  /** @type {{ id: number, from: string, ext: string, op: string, data: any, at: number }[]} */
  const events = []
  let eventId = 0

  function eventsView() {
    return events.slice(-GAME_EVENT_LIMIT)
  }

  function checkRate(player) {
    const at = now()
    const window = player.gameWindow
    if (!window || at - window.started >= GAME_RATE_WINDOW_MS) {
      player.gameWindow = { started: at, count: 1 }
      return
    }
    window.count += 1
    if (window.count > GAME_RATE_LIMIT) throw fail(429, 'game-rate-limited')
  }

  function game(request, response) {
    const { player } = findPlayer(request)
    return readJson(request).then(input => {
      if (!exactKeys(input, ['seq', 'ext', 'op', 'data'])) throw fail(400, 'game-shape-invalid')
      if (!Number.isSafeInteger(input.seq) || input.seq <= 0) throw fail(400, 'game-seq-invalid')
      if (typeof input.ext !== 'string' || !EXT_RE.test(input.ext)) throw fail(400, 'game-ext-invalid')
      if (typeof input.op !== 'string' || !OP_RE.test(input.op)) throw fail(400, 'game-op-invalid')
      if (input.data === null || typeof input.data !== 'object' || Array.isArray(input.data)) throw fail(400, 'game-data-invalid')
      if (!validValue(input.data, 0)) throw fail(400, 'game-data-invalid')
      if (byteLength(input.data) > GAME_MAX_DATA) throw fail(413, 'game-data-too-large')
      checkRate(player)
      if (!Number.isSafeInteger(player.gameSeq)) player.gameSeq = 0
      if (input.seq <= player.gameSeq) {
        return send(response, 200, { ok: true, duplicate: true, version: version() })
      }
      player.gameSeq = input.seq
      eventId += 1
      events.push({ id: eventId, from: player.id, ext: input.ext, op: input.op, data: input.data, at: now() })
      while (events.length > GAME_EVENT_LIMIT) events.shift()
      bump()
      return send(response, 200, { ok: true, version: version(), eventId })
    })
  }

  return { game, eventsView }
}
