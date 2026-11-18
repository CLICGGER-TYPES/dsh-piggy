// @ts-check
/**
 * 联机 1v1 的纯规则模块。房主客户端和公网权威进程共用这一份：
 * 输入动作，输出脱敏快照；子弹数组只留在内部状态，不进任何返回值。
 *
 * 规则与单机 AI 模式同源，但座位是 host/guest，没有 AI 金库；
 * 让枪费进底池，结算由各客户端本地钱包处理。
 */

export const ONLINE_CHAMBERS = 6
export const ONLINE_LOAD_MIN = 1
export const ONLINE_LOAD_MAX = 5
export const ONLINE_LIVES = [1, 3]
export const ONLINE_FORMATS = ['single', 'bestOf3']
export const ONLINE_STAKE_MIN = 100
export const ONLINE_STAKE_MAX = 10000
export const ONLINE_PASS_RATE = 0.5
export const ONLINE_SEATS = ['host', 'guest']

function shuffle(n, random) {
  const out = Array.from({ length: n }, (_, index) => index)
  for (let index = out.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1))
    const swap = out[index]
    out[index] = out[pick]
    out[pick] = swap
  }
  return out
}

function randomInt(n, random) {
  return Math.floor(random() * n)
}

/** @param {unknown} value */
function clampInt(value, min, max, fallback) {
  const n = Math.floor(Number(value))
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

function otherSeat(seat) {
  return seat === 'host' ? 'guest' : 'host'
}

export function passFee(stake) {
  return Math.max(1, Math.ceil(stake * ONLINE_PASS_RATE))
}

/**
 * @param {{ matchId: string, hostId: string, guestId: string,
 *   lives?: any, format?: any, stake?: any, loadCount?: any }} input
 * @param {() => number} [random]
 */
export function createMatch(input, random = Math.random) {
  if (typeof input?.matchId !== 'string' || input.matchId === '') throw new Error('matchId required')
  if (typeof input.hostId !== 'string' || typeof input.guestId !== 'string' || input.hostId === input.guestId) {
    throw new Error('two distinct seats required')
  }
  const state = {
    matchId: input.matchId,
    hostId: input.hostId,
    guestId: input.guestId,
    settings: {
      lives: ONLINE_LIVES.includes(input.lives) ? input.lives : 1,
      format: ONLINE_FORMATS.includes(input.format) ? input.format : 'single',
      stake: clampInt(input.stake, ONLINE_STAKE_MIN, ONLINE_STAKE_MAX, 1000),
      loadCount: clampInt(input.loadCount, ONLINE_LOAD_MIN, ONLINE_LOAD_MAX, 1),
    },
    seats: {
      host: { lives: 0, wins: 0, paid: 0, fees: 0 },
      guest: { lives: 0, wins: 0, paid: 0, fees: 0 },
    },
    pot: 0,
    round: 0,
    stage: 'arming',
    turn: 'host',
    loader: 'host',
    bulletCount: 1,
    bullets: [],
    chamber: 0,
    fired: 0,
    passBy: '',
    mustShoot: '',
    outcome: '',
    winner: '',
    settled: false,
    lastEvent: '',
    lastShooter: '',
    rev: 0,
    lastSeq: { host: 0, guest: 0 },
  }
  startRound(state, random)
  return state
}

function startRound(state, random) {
  const { stake, lives, loadCount } = state.settings
  const seat = state.seats.host
  const guest = state.seats.guest
  seat.lives = lives
  guest.lives = lives
  seat.paid += stake
  guest.paid += stake
  state.pot += stake * 2
  state.round += 1
  state.bulletCount = loadCount
  state.bullets = []
  state.chamber = 0
  state.fired = 0
  state.stage = 'arming'
  state.turn = 'host'
  state.loader = 'host'
  state.passBy = ''
  state.mustShoot = ''
  state.outcome = ''
  state.lastEvent = 'bet'
  state.lastShooter = ''
  state.rev += 1
  return { op: 'round-start', round: state.round, stake, pot: state.pot }
}

function reload(state, random, first) {
  state.bullets = shuffle(ONLINE_CHAMBERS, random).slice(0, state.bulletCount)
  state.chamber = randomInt(ONLINE_CHAMBERS, random)
  state.fired = 0
  state.turn = first
  state.stage = 'choice'
  state.passBy = ''
  state.mustShoot = ''
  state.lastEvent = 'reload'
  state.lastShooter = ''
}

function finishRound(state, winner) {
  state.seats[winner].wins += 1
  const over = state.settings.format === 'single' ||
    state.seats.host.wins >= 2 || state.seats.guest.wins >= 2
  if (over) {
    state.stage = 'matchOver'
    state.winner = winner
    state.outcome = winner === 'host' ? 'host-win' : 'guest-win'
    state.settled = true
    state.lastEvent = 'settled'
    return { op: 'match-over', winner, pot: state.pot }
  }
  state.stage = 'roundOver'
  state.outcome = winner === 'host' ? 'host-round' : 'guest-round'
  state.lastEvent = 'round-over'
  return { op: 'round-over', winner, pot: state.pot }
}

function shoot(state, who, random) {
  state.passBy = ''
  state.mustShoot = ''
  const firedChamber = state.chamber
  const hit = state.bullets.includes(state.chamber)
  state.lastShooter = who
  state.fired = Math.min(ONLINE_CHAMBERS, state.fired + 1)
  if (hit) {
    state.bullets = state.bullets.filter(index => index !== state.chamber)
    state.seats[who].lives -= 1
    state.lastEvent = 'hit'
    if (state.seats[who].lives <= 0) return finishRound(state, otherSeat(who))
    if (state.bulletCount === 1) {
      reload(state, random, otherSeat(who))
      return { op: 'reload' }
    }
    if (state.bullets.length === 0) {
      reload(state, random, random() < 0.5 ? 'host' : 'guest')
      return { op: 'reload' }
    }
    state.chamber = (state.chamber + 1) % ONLINE_CHAMBERS
    state.turn = otherSeat(who)
    state.stage = 'choice'
    return { op: 'hit', who, chamber: firedChamber }
  }
  state.chamber = (state.chamber + 1) % ONLINE_CHAMBERS
  state.lastEvent = 'blank'
  state.turn = otherSeat(who)
  state.stage = 'choice'
  return { op: 'blank', who, chamber: firedChamber }
}

function doPass(state, who) {
  const fee = passFee(state.settings.stake)
  state.seats[who].fees += fee
  state.pot += fee
  const previous = state.passBy
  if (previous !== '' && previous !== who) {
    state.passBy = ''
    state.mustShoot = previous
    state.turn = previous
  } else {
    state.passBy = who
    state.mustShoot = ''
    state.turn = otherSeat(who)
  }
  state.stage = 'choice'
  state.lastEvent = who === 'host' ? 'host-pass' : 'guest-pass'
  state.lastShooter = who
  return { op: 'pass', who, fee }
}

export function publicView(state) {
  return {
    matchId: state.matchId,
    hostId: state.hostId,
    guestId: state.guestId,
    rev: state.rev,
    settings: { ...state.settings },
    seats: {
      host: { lives: state.seats.host.lives, wins: state.seats.host.wins, paid: state.seats.host.paid, fees: state.seats.host.fees },
      guest: { lives: state.seats.guest.lives, wins: state.seats.guest.wins, paid: state.seats.guest.paid, fees: state.seats.guest.fees },
    },
    pot: state.pot,
    round: state.round,
    stage: state.stage,
    turn: state.turn,
    loader: state.loader,
    bulletCount: state.bulletCount,
    bulletsLeft: state.bullets.length,
    chamber: state.chamber,
    fired: state.fired,
    passBy: state.passBy,
    mustShoot: state.mustShoot,
    outcome: state.outcome,
    winner: state.winner,
    settled: state.settled,
    lastEvent: state.lastEvent,
    lastShooter: state.lastShooter,
  }
}

export function initialEvent(state) {
  return { op: 'match-start', view: publicView(state) }
}

function seatOf(state, from) {
  if (from === 'host' || from === 'guest') return from
  if (from === state.hostId) return 'host'
  if (from === state.guestId) return 'guest'
  return ''
}

/**
 * @param {any} state
 * @param {{ from: string, seq: number, op: string, data?: any }} input
 * @param {() => number} [random]
 */
export function applyAction(state, input, random = Math.random) {
  const from = seatOf(state, input?.from)
  if (from === '') return { ok: false, reason: 'bad-seat' }
  if (!Number.isSafeInteger(input.seq) || input.seq <= 0) return { ok: false, reason: 'bad-seq' }
  if (input.seq <= state.lastSeq[from]) return { ok: true, duplicate: true, events: [] }
  const op = input.op
  if (state.stage === 'matchOver') return { ok: false, reason: 'match-over' }
  if (state.stage === 'roundOver' && op !== 'next' && op !== 'leave') return { ok: false, reason: 'not-playing' }

  if (op === 'arm') {
    if (from !== state.loader) return { ok: false, reason: 'not-loader' }
    if (state.stage !== 'arming') return { ok: false, reason: 'not-arming' }
    state.bullets = shuffle(ONLINE_CHAMBERS, random).slice(0, state.bulletCount)
    state.chamber = randomInt(ONLINE_CHAMBERS, random)
    state.fired = 0
    state.turn = random() < 0.5 ? 'host' : 'guest'
    state.stage = 'choice'
    state.passBy = ''
    state.mustShoot = ''
    state.lastEvent = 'armed'
    state.lastShooter = ''
    state.rev += 1
  } else if (op === 'fire') {
    if (state.stage !== 'choice') return { ok: false, reason: 'not-choice' }
    if (state.turn !== from) return { ok: false, reason: 'not-your-turn' }
    const event = shoot(state, from, random)
    state.rev += 1
    state.lastSeq[from] = input.seq
    return { ok: true, events: [{ ...event, view: publicView(state) }] }
  } else if (op === 'pass') {
    if (state.stage !== 'choice') return { ok: false, reason: 'not-choice' }
    if (state.turn !== from) return { ok: false, reason: 'not-your-turn' }
    if (state.mustShoot === from) return { ok: false, reason: 'must-shoot' }
    const event = doPass(state, from)
    state.rev += 1
    state.lastSeq[from] = input.seq
    return { ok: true, events: [{ ...event, view: publicView(state) }] }
  } else if (op === 'next') {
    if (from !== 'host') return { ok: false, reason: 'not-host' }
    if (state.stage !== 'roundOver') return { ok: false, reason: 'not-round-over' }
    const event = startRound(state, random)
    state.lastSeq[from] = input.seq
    return { ok: true, events: [{ ...event, view: publicView(state) }] }
  } else if (op === 'leave') {
    state.lastSeq[from] = input.seq
    // data.force：对面窗口没了的心跳超时，按认输算；主动点「离开牌桌」才保留第一局装弹前的取消退注。
    if (state.round === 1 && state.stage === 'arming' && !state.fired && input.data?.force !== true) {
      state.stage = 'matchOver'
      state.outcome = 'cancelled'
      state.settled = true
      state.lastEvent = 'cancelled'
      state.rev += 1
      return { ok: true, events: [{ op: 'cancelled', view: publicView(state) }] }
    }
    const winner = otherSeat(from)
    state.seats[winner].wins = Math.max(state.seats[winner].wins, state.settings.format === 'bestOf3' ? 2 : 1)
    state.stage = 'matchOver'
    state.winner = winner
    state.outcome = 'forfeit'
    state.settled = true
    state.lastEvent = 'forfeit'
    state.rev += 1
    return { ok: true, events: [{ op: 'forfeit', who: from, winner, view: publicView(state) }] }
  } else {
    return { ok: false, reason: 'bad-op' }
  }
  state.lastSeq[from] = input.seq
  return { ok: true, events: [{ op, view: publicView(state) }] }
}
