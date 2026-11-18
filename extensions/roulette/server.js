// @ts-check
/**
 * 左轮轮盘 0.2.0：服务端权威对局 + 真实金币。
 *
 * 规则见 docs/design/roulette-rules-20261118.md。对局状态、AI 金库、底池和
 * 子弹位置全部存在 extData；客户端只发动作，view 回吐可以公开的快照。
 * 子弹数组绝不进 view，客户端拿不到实弹位置。
 */

export const CHAMBERS = 6
export const LOAD_MIN = 1
export const LOAD_MAX = 5
export const LIVES_OPTIONS = [1, 3]
export const FORMATS = ['single', 'bestOf3']
export const STAKE_LEVELS = [100, 500, 1000, 5000]
export const STAKE_MIN = 100
export const STAKE_MAX = 10000
export const PASS_RATE = 0.5
/** 中弹概率到这个阈值时，任何 AI 策略都不主动开枪，避免高装弹下自杀送钱。 */
export const RISK_PASS_AT = 0.75
export const VAULT_INIT = 100000
export const VAULT_FLOOR = 10000
export const VAULT_REFILL = 50000
export const AI_STRATEGIES = ['always', 'expected', 'bluff', 'bayes', 'monteCarlo']

/** 本地日（06:00 换日），和扭蛋扩展保持同一口径。 */
function dayKey(now) {
  const date = new Date(now)
  date.setHours(date.getHours() - 6)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function clampInt(value, min, max, fallback) {
  const n = Math.floor(Number(value))
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

function normalize(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return newData()
  if (data.version !== 1) data.version = 1
  const settings = data.settings !== null && typeof data.settings === 'object' ? data.settings : {}
  data.settings = {
    lives: LIVES_OPTIONS.includes(settings.lives) ? settings.lives : 1,
    format: FORMATS.includes(settings.format) ? settings.format : 'single',
    loadCount: clampInt(settings.loadCount, LOAD_MIN, LOAD_MAX, 1),
    stake: clampInt(settings.stake, STAKE_MIN, STAKE_MAX, 1000),
    ai: AI_STRATEGIES.includes(settings.ai) ? settings.ai : 'always',
  }
  data.vault = clampInt(data.vault, 0, Number.MAX_SAFE_INTEGER, VAULT_INIT)
  if (typeof data.vaultDay !== 'string') data.vaultDay = ''
  data.seq = clampInt(data.seq, 0, Number.MAX_SAFE_INTEGER, 0)
  if (data.match !== null && typeof data.match !== 'object') data.match = null
  if (data.match) normalizeMatch(data.match)
  // handId 必须跨对局单调递增：离开牌桌会把 match 清成 null，
  // 若下一场又从 1 开始，延迟的旧 leave 会误命中新一场。
  const lastHandId = data.match ? data.match.handId : 0
  data.handSeq = Math.max(clampInt(data.handSeq, 0, Number.MAX_SAFE_INTEGER, 0), lastHandId)
  return data
}

function normalizeMatch(match) {
  match.handId = clampInt(match.handId, 1, Number.MAX_SAFE_INTEGER, 1)
  match.round = clampInt(match.round, 1, 99, 1)
  match.winsYou = clampInt(match.winsYou, 0, 2, 0)
  match.winsAi = clampInt(match.winsAi, 0, 2, 0)
  match.pot = clampInt(match.pot, 0, Number.MAX_SAFE_INTEGER, 0)
  match.matchedYou = clampInt(match.matchedYou, 0, STAKE_MAX, 0)
  match.matchedAi = clampInt(match.matchedAi, 0, Number.MAX_SAFE_INTEGER, 0)
  match.paidYou = clampInt(match.paidYou, 0, Number.MAX_SAFE_INTEGER, 0)
  match.feesYou = clampInt(match.feesYou, 0, Number.MAX_SAFE_INTEGER, 0)
  match.feesAi = clampInt(match.feesAi, 0, Number.MAX_SAFE_INTEGER, 0)
  match.livesYou = clampInt(match.livesYou, 0, 3, 0)
  match.livesAi = clampInt(match.livesAi, 0, 3, 0)
  match.bulletCount = clampInt(match.bulletCount, LOAD_MIN, LOAD_MAX, 1)
  match.bullets = Array.isArray(match.bullets) ? match.bullets.filter(n => Number.isInteger(n) && n >= 0 && n < CHAMBERS) : []
  match.chamber = clampInt(match.chamber, 0, CHAMBERS - 1, 0)
  match.fired = clampInt(match.fired, 0, CHAMBERS, 0)
  match.turn = match.turn === 'ai' ? 'ai' : 'you'
  match.stage = ['idle', 'arming', 'choice', 'ai', 'roundOver', 'matchOver'].includes(match.stage) ? match.stage : 'idle'
  match.passBy = match.passBy === 'ai' ? 'ai' : match.passBy === 'you' ? 'you' : ''
  match.mustShoot = match.mustShoot === 'ai' ? 'ai' : match.mustShoot === 'you' ? 'you' : ''
  if (typeof match.outcome !== 'string') match.outcome = ''
  if (typeof match.lastEvent !== 'string') match.lastEvent = ''
  match.lastShooter = match.lastShooter === 'ai' ? 'ai' : match.lastShooter === 'you' ? 'you' : ''
  match.settled = match.settled === true
  return match
}

function newData() {
  return {
    version: 1,
    vault: VAULT_INIT,
    vaultDay: '',
    seq: 0,
    handSeq: 0,
    settings: { lives: 1, format: 'single', loadCount: 1, stake: 1000, ai: 'always' },
    match: null,
  }
}

function newMatch(handId) {
  return {
    handId,
    round: 1,
    winsYou: 0,
    winsAi: 0,
    pot: 0,
    matchedYou: 0,
    matchedAi: 0,
    paidYou: 0,
    feesYou: 0,
    feesAi: 0,
    livesYou: 0,
    livesAi: 0,
    bulletCount: 1,
    bullets: [],
    chamber: 0,
    fired: 0,
    turn: 'you',
    stage: 'idle',
    passBy: '',
    mustShoot: '',
    outcome: '',
    lastEvent: '',
    lastShooter: '',
    settled: false,
  }
}

/** 每天第一次动作时给穷光了的 AI 金库补到 VAULT_REFILL；只影响虚拟金库。 */
function ensureVault(data, now) {
  const today = dayKey(now)
  if (data.vaultDay === today) return
  data.vaultDay = today
  if (data.vault < VAULT_FLOOR) data.vault = VAULT_REFILL
}

function shuffle(count, random) {
  const list = []
  for (let i = 0; i < count; i += 1) list.push(i)
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const tmp = list[i]
    list[i] = list[j]
    list[j] = tmp
  }
  return list
}

function randomInt(count, random) {
  return Math.max(0, Math.min(count - 1, Math.floor(random() * count)))
}

/** 已经击发过的弹巢不会再装弹；AI 只用公开信息估当前这一枪的中弹概率。 */
function remainingChambers(match) {
  return Math.max(1, CHAMBERS - match.fired)
}

export function hitChance(match) {
  return Math.min(1, match.bullets.length / remainingChambers(match))
}

function monteCarloHitChance(match, random) {
  const remaining = remainingChambers(match)
  const bullets = Math.min(match.bullets.length, remaining)
  if (bullets <= 0) return 0
  if (bullets >= remaining) return 1
  const samples = 48
  let hits = 0
  for (let sample = 0; sample < samples; sample += 1) {
    const list = []
    for (let i = 0; i < remaining; i += 1) list.push(i)
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      const tmp = list[i]
      list[i] = list[j]
      list[j] = tmp
    }
    for (let i = 0; i < bullets; i += 1) {
      if (list[i] === 0) {
        hits += 1
        break
      }
    }
  }
  return hits / samples
}

/**
 * AI 决策。所有策略都只读公开量（剩余子弹数、已击发格数、双方命数），
 * 不读 bullets 的位置；返回 shoot 或 pass。
 */
export function decideAi(match, strategy, random = Math.random) {
  // 被回让后没有选择：只能开枪。
  if (match.mustShoot === 'ai') return 'shoot'
  // 所有策略共用的保命线：中弹概率太高时别主动扣扳机。
  if (hitChance(match) >= RISK_PASS_AT) return 'pass'
  if (strategy === 'bluff') return random() < 0.65 ? 'shoot' : 'pass'
  if (strategy === 'expected') return hitChance(match) < PASS_RATE ? 'shoot' : 'pass'
  if (strategy === 'bayes') {
    const p = (match.bullets.length + 1) / (remainingChambers(match) + 2)
    return p < 0.5 ? 'shoot' : 'pass'
  }
  if (strategy === 'monteCarlo') return monteCarloHitChance(match, random) < 0.45 ? 'shoot' : 'pass'
  return 'shoot'
}

function guardSeq(data, payload) {
  if (payload === null || typeof payload !== 'object' || !Number.isInteger(payload.seq)) {
    return { ok: false, reason: 'stale' }
  }
  if (payload.seq !== data.seq) return { ok: false, reason: 'stale' }
  return null
}

function isBusy(match) {
  return match !== null && match.stage !== 'matchOver'
}

function startRound(data, api, random, loadCount = data.settings.loadCount) {
  const settings = data.settings
  if (data.match === null) return { ok: false, reason: 'no-match' }
  const match = data.match
  if (!api.spend(settings.stake, 'roulette-bet')) return { ok: false, reason: 'poor' }
  const matchedAi = Math.min(settings.stake, data.vault)
  data.vault -= matchedAi
  match.matchedYou = settings.stake
  match.matchedAi = matchedAi
  match.paidYou += settings.stake
  match.pot += settings.stake + matchedAi
  match.livesYou = settings.lives
  match.livesAi = settings.lives
  match.bulletCount = loadCount
  match.bullets = []
  match.chamber = 0
  match.fired = 0
  match.turn = 'you'
  match.stage = 'arming'
  match.passBy = ''
  match.mustShoot = ''
  match.outcome = ''
  match.lastEvent = 'bet'
  match.lastShooter = ''
  match.settled = false
  data.seq += 1
  return { ok: true }
}

/** 重装同一发数并强制转轮；first 决定谁先手。 */
function reload(data, random, first) {
  const match = data.match
  match.bullets = shuffle(CHAMBERS, random).slice(0, match.bulletCount)
  match.chamber = randomInt(CHAMBERS, random)
  match.fired = 0
  match.turn = first
  match.stage = first === 'you' ? 'choice' : 'ai'
  match.passBy = ''
  match.mustShoot = ''
  match.lastEvent = 'reload'
  match.lastShooter = ''
}

function finishRound(data, api, winner) {
  const match = data.match
  if (winner === 'you') match.winsYou += 1
  else match.winsAi += 1
  const over = data.settings.format === 'single' || match.winsYou >= 2 || match.winsAi >= 2
  if (over) {
    if (winner === 'you') {
      api.earn(match.pot, 'roulette-win')
      match.outcome = 'win'
    } else {
      data.vault += match.pot
      match.outcome = 'lose'
    }
    match.stage = 'matchOver'
    match.settled = true
    match.lastEvent = 'settled'
    return
  }
  match.round += 1
  match.stage = 'roundOver'
  match.outcome = winner === 'you' ? 'round-win' : 'round-lose'
  match.lastEvent = 'round-over'
}

function shoot(data, api, who, random) {
  const match = data.match
  // 开枪就结束这次让枪链：不管结果如何，都不再要求谁必须开枪。
  match.passBy = ''
  match.mustShoot = ''
  const hit = match.bullets.includes(match.chamber)
  match.lastShooter = who
  match.fired = Math.min(CHAMBERS, match.fired + 1)
  if (hit) {
    match.bullets = match.bullets.filter(index => index !== match.chamber)
    if (who === 'you') match.livesYou -= 1
    else match.livesAi -= 1
    match.lastEvent = 'hit'
    if ((who === 'you' ? match.livesYou : match.livesAi) <= 0) {
      finishRound(data, api, who === 'you' ? 'ai' : 'you')
      return
    }
    if (match.bulletCount === 1) {
      reload(data, random, who === 'you' ? 'ai' : 'you')
      return
    }
    if (match.bullets.length === 0) {
      reload(data, random, random() < 0.5 ? 'you' : 'ai')
      return
    }
    match.chamber = (match.chamber + 1) % CHAMBERS
    match.turn = who === 'you' ? 'ai' : 'you'
    match.stage = match.turn === 'you' ? 'choice' : 'ai'
    return
  }
  match.chamber = (match.chamber + 1) % CHAMBERS
  match.lastEvent = 'blank'
  match.turn = who === 'you' ? 'ai' : 'you'
  match.stage = match.turn === 'you' ? 'choice' : 'ai'
}

function doPass(data, api, who) {
  const match = data.match
  // 定稿是「当前底注 50%」，不是各自实际配注；否则 AI 金库少配时
  // 会让一手只付 50，而玩家同样一手要付 500。
  const fee = Math.max(1, Math.ceil(data.settings.stake * PASS_RATE))
  if (who === 'you') {
    if (!api.spend(fee, 'roulette-pass')) return { ok: false, reason: 'poor' }
    data.vault += fee
    match.feesYou += fee
  } else {
    if (data.vault < fee) return { ok: false, reason: 'ai-poor' }
    data.vault -= fee
    // AI 的让枪费进底池，不直接打给玩家：否则玩家可以靠“必输但收让枪费”套钱。
    match.pot += fee
    match.feesAi += fee
  }
  const previous = match.passBy
  if (previous !== '' && previous !== who) {
    // 回让：A 让枪、B 让回来，枪回到 A，A 这一手只能开枪。
    match.passBy = ''
    match.mustShoot = previous
    match.turn = previous
  } else {
    match.passBy = who
    match.mustShoot = ''
    match.turn = who === 'you' ? 'ai' : 'you'
  }
  match.stage = match.turn === 'you' ? 'choice' : 'ai'
  match.lastEvent = who === 'you' ? 'you-pass' : 'ai-pass'
  match.lastShooter = who
  data.seq += 1
  return { ok: true }
}

export default {
  init() {
    return newData()
  },

  actions: {
    config(data, payload, api) {
      normalize(data)
      const stale = guardSeq(data, payload)
      if (stale) return stale
      if (isBusy(data.match)) return { ok: false, reason: 'busy' }
      const next = data.settings
      if (payload.lives !== undefined) {
        if (!LIVES_OPTIONS.includes(payload.lives)) return { ok: false, reason: 'bad-lives' }
        next.lives = payload.lives
      }
      if (payload.format !== undefined) {
        if (!FORMATS.includes(payload.format)) return { ok: false, reason: 'bad-format' }
        next.format = payload.format
      }
      if (payload.loadCount !== undefined) {
        if (!Number.isInteger(payload.loadCount) || payload.loadCount < LOAD_MIN || payload.loadCount > LOAD_MAX) return { ok: false, reason: 'bad-load' }
        next.loadCount = payload.loadCount
      }
      if (payload.stake !== undefined) {
        if (!Number.isInteger(payload.stake) || payload.stake < STAKE_MIN || payload.stake > STAKE_MAX) return { ok: false, reason: 'bad-stake' }
        next.stake = payload.stake
      }
      if (payload.ai !== undefined) {
        if (!AI_STRATEGIES.includes(payload.ai)) return { ok: false, reason: 'bad-ai' }
        next.ai = payload.ai
      }
      data.seq += 1
      return { ok: true }
    },

    start(data, payload, api, random = Math.random) {
      normalize(data)
      const stale = guardSeq(data, payload)
      if (stale) return stale
      ensureVault(data, api.now)
      if (isBusy(data.match)) return { ok: false, reason: 'busy' }
      if (api.coins() < data.settings.stake) return { ok: false, reason: 'poor' }
      const handId = Math.max(data.handSeq + 1, data.match === null ? 1 : data.match.handId + 1)
      const previous = data.match
      data.handSeq = handId
      data.match = newMatch(handId)
      const result = startRound(data, api, random)
      if (!result.ok) data.match = previous
      return result
    },

    next(data, payload, api, random = Math.random) {
      normalize(data)
      const stale = guardSeq(data, payload)
      if (stale) return stale
      if (data.match === null || data.match.stage !== 'roundOver') return { ok: false, reason: 'not-round-over' }
      let loadCount = data.settings.loadCount
      if (payload.loadCount !== undefined) {
        if (!Number.isInteger(payload.loadCount) || payload.loadCount < LOAD_MIN || payload.loadCount > LOAD_MAX) return { ok: false, reason: 'bad-load' }
        loadCount = payload.loadCount
      }
      ensureVault(data, api.now)
      const result = startRound(data, api, random, loadCount)
      if (result.ok) data.settings.loadCount = loadCount
      return result
    },

    arm(data, payload, api, random = Math.random) {
      normalize(data)
      const stale = guardSeq(data, payload)
      if (stale) return stale
      const match = data.match
      if (match === null || match.stage !== 'arming') return { ok: false, reason: 'not-arming' }
      match.bullets = shuffle(CHAMBERS, random).slice(0, match.bulletCount)
      match.chamber = randomInt(CHAMBERS, random)
      match.fired = 0
      match.turn = random() < 0.5 ? 'you' : 'ai'
      match.stage = match.turn === 'you' ? 'choice' : 'ai'
      match.passBy = ''
      match.mustShoot = ''
      match.lastEvent = 'armed'
      match.lastShooter = ''
      data.seq += 1
      return { ok: true }
    },

    fire(data, payload, api, random = Math.random) {
      normalize(data)
      const stale = guardSeq(data, payload)
      if (stale) return stale
      const match = data.match
      if (match === null || match.stage !== 'choice' || match.turn !== 'you') return { ok: false, reason: 'not-your-turn' }
      shoot(data, api, 'you', random)
      data.seq += 1
      return { ok: true }
    },

    pass(data, payload, api) {
      normalize(data)
      const stale = guardSeq(data, payload)
      if (stale) return stale
      const match = data.match
      if (match === null || match.stage !== 'choice' || match.turn !== 'you') return { ok: false, reason: 'not-your-turn' }
      if (match.mustShoot === 'you') return { ok: false, reason: 'must-shoot' }
      return doPass(data, api, 'you')
    },

    ai(data, payload, api, random = Math.random) {
      normalize(data)
      const stale = guardSeq(data, payload)
      if (stale) return stale
      const match = data.match
      if (match === null || match.stage !== 'ai' || match.turn !== 'ai') return { ok: false, reason: 'not-ai-turn' }
      if (decideAi(match, data.settings.ai, random) === 'pass') {
        const passed = doPass(data, api, 'ai')
        if (passed.ok) return passed
      }
      shoot(data, api, 'ai', random)
      data.seq += 1
      return { ok: true }
    },

    leave(data, payload, api) {
      normalize(data)
      const match = data.match
      const info = payload !== null && typeof payload === 'object' ? payload : {}
      // 对局已清掉时 leave 是幂等的，不推进 seq，避免延迟包打乱后续动作。
      if (match === null) return { ok: true }
      // 带 handId 的请求必须是当前这一场；这样旧 leave 重投不会清掉新一场。
      if (info.handId !== undefined && info.handId !== match.handId) return { ok: false, reason: 'stale' }
      // 当前 seq 或当前 handId 至少命中一个才放行：
      // - 当前 seq 覆盖正常点击；
      // - handId 覆盖“动作刚提交、seq 还没回来”时点返回的重试。
      // 两者都不匹配的旧包不能认输，否则会误伤之后新开的一场。
      const seqOk = Number.isInteger(info.seq) && info.seq === data.seq
      const handOk = info.handId !== undefined && info.handId === match.handId
      if (!seqOk && !handOk) return { ok: false, reason: 'stale' }
      if (match.stage === 'matchOver') {
        data.match = null
        data.seq += 1
        return { ok: true }
      }
      // 只有第一局还没装弹时才是无损失取消；第二/三局装弹前退出
      // 必须把前面累积的底池判给 AI，否则这部分钱会凭空消失。
      if (match.round === 1 && match.stage === 'arming') {
        api.earn(match.matchedYou, 'roulette-refund')
        data.vault += match.matchedAi
        data.match = null
        data.seq += 1
        return { ok: true }
      }
      // 其余情况视为认输：本场底池进 AI 金库，玩家已下的底注不退。
      data.vault += match.pot
      data.match = null
      data.seq += 1
      return { ok: true }
    },
  },

  view(data, api) {
    const d = normalize(structuredClone(data))
    const match = d.match
    return {
      coins: api.coins(),
      vault: d.vault,
      settings: d.settings,
      seq: d.seq,
      passRate: PASS_RATE,
      match: match === null ? null : {
        handId: match.handId,
        round: match.round,
        winsYou: match.winsYou,
        winsAi: match.winsAi,
        pot: match.pot,
        matchedYou: match.matchedYou,
        matchedAi: match.matchedAi,
        paidYou: match.paidYou,
        feesYou: match.feesYou,
        feesAi: match.feesAi,
        livesYou: match.livesYou,
        livesAi: match.livesAi,
        bulletCount: match.bulletCount,
        bulletsLeft: match.bullets.length,
        chamber: match.chamber,
        turn: match.turn,
        stage: match.stage,
        passBy: match.passBy,
        mustShoot: match.mustShoot,
        outcome: match.outcome,
        lastEvent: match.lastEvent,
        lastShooter: match.lastShooter,
        settled: match.settled,
      },
    }
  },
}
