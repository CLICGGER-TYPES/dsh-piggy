// 左轮轮盘 0.2.0 服务端规则引擎：真实金币、强制转轮、1/3 命、让枪、三局两胜。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import roulette, {
  CHAMBERS,
  LIVES_OPTIONS,
  LOAD_MAX,
  PASS_RATE,
  VAULT_INIT,
  decideAi,
} from '../../../extensions/roulette/server.js'

function wallet(initial = 12500, now = 0) {
  const state = { coins: initial, log: [] }
  const api = {
    now,
    coins: () => state.coins,
    spend(n, sink) {
      const amount = Math.max(0, Math.floor(Number(n) || 0))
      if (state.coins < amount) return false
      state.coins -= amount
      state.log.push(['spend', amount, sink])
      return true
    },
    earn(n, source) {
      const amount = Math.min(Math.max(0, Math.floor(Number(n) || 0)), 1000000)
      state.coins += amount
      state.log.push(['earn', amount, source])
      return amount
    },
  }
  return { state, api }
}

function configured(overrides = {}) {
  const { state, api } = wallet(overrides.coins ?? 12500)
  const data = roulette.init()
  const settings = { stake: 1000, lives: 1, format: 'single', loadCount: 1, ...overrides }
  const result = roulette.actions.config(data, { seq: data.seq, seq: data.seq, ...settings }, api)
  assert.equal(result.ok, true, 'config 应该成功')
  return { data, api, state }
}

function started(overrides = {}) {
  const ctx = configured(overrides)
  const result = roulette.actions.start(ctx.data, { seq: ctx.data.seq }, ctx.api, () => 0.5)
  assert.equal(result.ok, true, 'start 应该成功')
  return ctx
}

function setMatch(data, patch) {
  Object.assign(data.match, patch)
}

test('init 与 view：不泄露子弹数组，也不改原数据', () => {
  const { data, api } = started({ loadCount: 3 })
  setMatch(data, { stage: 'arming' })
  roulette.actions.arm(data, { seq: data.seq }, api, () => 0.5)
  const before = structuredClone(data)
  const view = roulette.view(data, api)
  assert.equal(view.match.bulletCount, 3)
  assert.equal(view.match.bulletsLeft, 3)
  assert.equal('bullets' in view.match, false, 'view 不能回吐子弹位置')
  assert.doesNotMatch(JSON.stringify(view), /"bullets"/)
  assert.deepEqual(data, before, 'view 必须纯读')
})

test('config 校验命数、赛制、装弹数和底注', () => {
  const { data, api } = configured()
  assert.equal(roulette.actions.config(data, { seq: data.seq, lives: 2 }, api).ok, false)
  assert.equal(roulette.actions.config(data, { seq: data.seq, format: 'bestOf5' }, api).ok, false)
  assert.equal(roulette.actions.config(data, { seq: data.seq, loadCount: 0 }, api).ok, false)
  assert.equal(roulette.actions.config(data, { seq: data.seq, loadCount: LOAD_MAX + 1 }, api).ok, false)
  assert.equal(roulette.actions.config(data, { seq: data.seq, stake: 99 }, api).ok, false)
  assert.equal(roulette.actions.config(data, { seq: data.seq, stake: 10001 }, api).ok, false)
  assert.equal(roulette.actions.config(data, { seq: data.seq, ai: 'cheat' }, api).ok, false)
  assert.equal(roulette.actions.config(data, { seq: data.seq, lives: 3, format: 'bestOf3', loadCount: 5, stake: 5000, ai: 'monteCarlo' }, api).ok, true)
  assert.deepEqual(
    { lives: data.settings.lives, format: data.settings.format, loadCount: data.settings.loadCount, stake: data.settings.stake, ai: data.settings.ai },
    { lives: 3, format: 'bestOf3', loadCount: 5, stake: 5000, ai: 'monteCarlo' },
  )
})

test('start 扣玩家底注、AI 按金库上限配注、底池入账', () => {
  const { data, api, state } = started({ stake: 1000 })
  assert.equal(state.coins, 11500)
  assert.equal(data.vault, VAULT_INIT - 1000)
  assert.equal(data.match.matchedYou, 1000)
  assert.equal(data.match.matchedAi, 1000)
  assert.equal(data.match.pot, 2000)
  assert.equal(data.match.stage, 'arming')
  assert.equal(state.log[0][0], 'spend')
  assert.equal(state.log[0][1], 1000)
})

test('AI 金库不足时只配剩余金库，玩家底注不超扣', () => {
  const { data, api, state } = started({ stake: 5000 })
  data.vault = 1200
  // 重新开一场，让 AI 按 1200 配注
  data.match = null
  data.settings.stake = 5000
  const fresh = { data, api, state }
  const result = roulette.actions.start(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(result.ok, true)
  assert.equal(data.match.matchedYou, 5000)
  assert.equal(data.match.matchedAi, 1200)
  assert.equal(data.match.pot, 6200)
  assert.equal(data.vault, 0)
})

test('arm 强制转轮：装弹数正确、位置不重复、先手只能是你或 AI', () => {
  const { data, api } = started({ loadCount: 4 })
  const result = roulette.actions.arm(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(result.ok, true)
  assert.equal(data.match.bullets.length, 4)
  assert.equal(new Set(data.match.bullets).size, 4)
  assert.ok(data.match.bullets.every(index => index >= 0 && index < CHAMBERS))
  assert.ok(['choice', 'ai'].includes(data.match.stage))
  assert.equal(data.match.stage === 'choice' ? 'you' : 'ai', data.match.turn)
})

test('空枪换手并推进一格', () => {
  const { data, api } = started()
  setMatch(data, { stage: 'choice', turn: 'you', bulletCount: 1, bullets: [3], chamber: 0, livesYou: 1, livesAi: 1 })
  const result = roulette.actions.fire(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(result.ok, true)
  assert.equal(data.match.chamber, 1)
  assert.equal(data.match.turn, 'ai')
  assert.equal(data.match.stage, 'ai')
  assert.equal(data.match.lastEvent, 'blank')
  assert.equal(data.match.lastShooter, 'you')
})

test('1 条命中弹即结算，AI 拿走底池', () => {
  const { data, api, state } = started()
  const coinsBefore = state.coins
  setMatch(data, { stage: 'choice', turn: 'you', bulletCount: 1, bullets: [0], chamber: 0, livesYou: 1, livesAi: 1 })
  roulette.actions.fire(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(data.match.stage, 'matchOver')
  assert.equal(data.match.outcome, 'lose')
  assert.equal(data.match.livesYou, 0)
  assert.equal(data.match.settled, true)
  assert.equal(state.coins, coinsBefore, '玩家已扣底注，输了不再扣')
  assert.equal(data.vault, VAULT_INIT + data.match.matchedYou, 'AI 拿回配注并赢走玩家底注')
})

test('3 条命、装 1 发：中弹扣命后重装并换对手先手', () => {
  const { data, api } = started({ lives: 3, format: 'bestOf3', loadCount: 1 })
  setMatch(data, { stage: 'choice', turn: 'you', bulletCount: 1, bullets: [0], chamber: 0, livesYou: 3, livesAi: 3 })
  roulette.actions.fire(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(data.match.livesYou, 2)
  assert.equal(data.match.lastEvent, 'reload')
  assert.equal(data.match.turn, 'ai')
  assert.equal(data.match.stage, 'ai')
  assert.equal(data.match.bullets.length, 1)
  assert.equal(data.match.settled, false)
})

test('3 条命、装多发：中弹后继续打当前弹巢并推进一格', () => {
  const { data, api } = started({ lives: 3, format: 'bestOf3', loadCount: 3 })
  setMatch(data, {
    stage: 'choice', turn: 'you', bulletCount: 3, bullets: [0, 2, 4], chamber: 0,
    livesYou: 3, livesAi: 3,
  })
  roulette.actions.fire(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(data.match.livesYou, 2)
  assert.deepEqual(data.match.bullets, [2, 4])
  assert.equal(data.match.chamber, 1, '中弹后弹巢也要推进，下一枪不能打已击发的孔')
  assert.equal(data.match.turn, 'ai')
  assert.equal(data.match.lastEvent, 'hit')
})

test('3 条命、子弹打完但双方都没死：重装同样发数并重新随机先手', () => {
  const { data, api } = started({ lives: 3, format: 'bestOf3', loadCount: 3 })
  setMatch(data, {
    stage: 'choice', turn: 'you', bulletCount: 3, bullets: [0], chamber: 0,
    livesYou: 3, livesAi: 3,
  })
  roulette.actions.fire(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(data.match.livesYou, 2)
  assert.equal(data.match.bullets.length, 3)
  assert.equal(data.match.lastEvent, 'reload')
  assert.equal(data.match.turn, 'ai')
})

test('让枪付底注 50% 直接给对手，本回合结束', () => {
  const { data, api, state } = started({ stake: 1000 })
  setMatch(data, { stage: 'choice', turn: 'you', matchedYou: 1000, matchedAi: 1000 })
  const coinsBefore = state.coins
  const vaultBefore = data.vault
  const fee = Math.max(1, Math.ceil(1000 * PASS_RATE))
  const result = roulette.actions.pass(data, { seq: data.seq }, api)
  assert.equal(result.ok, true)
  assert.equal(state.coins, coinsBefore - fee)
  assert.equal(data.vault, vaultBefore + fee)
  assert.equal(data.match.turn, 'ai')
  assert.equal(data.match.stage, 'ai')
  assert.equal(data.match.lastEvent, 'you-pass')
})

test('让枪余额不足时拒绝', () => {
  const { data, api, state } = started({ stake: 1000 })
  state.coins = 100
  setMatch(data, { stage: 'choice', turn: 'you', matchedYou: 1000 })
  const result = roulette.actions.pass(data, { seq: data.seq }, api)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'poor')
  assert.equal(state.coins, 100)
})

test('AI 当前必开枪，且不知道子弹位置也能按服务端判定结算', () => {
  const { data, api } = started({ format: 'single' })
  setMatch(data, { stage: 'ai', turn: 'ai', bulletCount: 1, bullets: [0], chamber: 0, livesAi: 1, livesYou: 1 })
  const result = roulette.actions.ai(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(result.ok, true)
  assert.equal(data.match.stage, 'matchOver')
  assert.equal(data.match.outcome, 'win')
  assert.equal(data.match.lastShooter, 'ai')
})

function seeded(seed = 1) {
  return function () {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

test('五种 AI 策略只读公开量，中弹概率≥75% 时一律让枪', () => {
  const risky = { bullets: [0, 1, 2, 3, 4], fired: 0, matchedAi: 1000, matchedYou: 1000 }
  const medium = { bullets: [0, 1, 2, 3], fired: 0, matchedAi: 1000, matchedYou: 1000 }
  const safe = { bullets: [0], fired: 0, matchedAi: 1000, matchedYou: 1000 }
  assert.equal(decideAi(risky, 'always', () => 0.9), 'pass', '莽夫也不在 5/6 概率下自杀')
  assert.equal(decideAi(medium, 'always', () => 0.9), 'shoot')
  assert.equal(decideAi(risky, 'expected', () => 0.5), 'pass')
  assert.equal(decideAi(safe, 'expected', () => 0.5), 'shoot')
  assert.equal(decideAi(risky, 'bluff', () => 0.1), 'pass', '保命线优先于诈唬随机')
  assert.equal(decideAi(medium, 'bluff', () => 0.9), 'pass')
  assert.equal(decideAi(medium, 'bluff', () => 0.1), 'shoot')
  assert.equal(decideAi(risky, 'bayes', () => 0.5), 'pass')
  assert.equal(decideAi(safe, 'bayes', () => 0.5), 'shoot')
  assert.equal(decideAi(risky, 'monteCarlo', seeded()), 'pass')
  assert.equal(decideAi(safe, 'monteCarlo', seeded()), 'shoot')
  assert.equal(decideAi({ ...risky, mustShoot: 'ai' }, 'expected', () => 0.5), 'shoot', '被回让后必须开枪')
})

test('AI 让枪真扣金库并进底池，不直接给玩家', () => {
  const { data, api, state } = started({ ai: 'bluff', stake: 1000 })
  setMatch(data, { stage: 'ai', turn: 'ai', bulletCount: 1, bullets: [0], chamber: 0, livesAi: 1, livesYou: 1 })
  const coinsBefore = state.coins
  const vaultBefore = data.vault
  const potBefore = data.match.pot
  // 0.9 让 bluff 选择让枪；让枪费 500
  const result = roulette.actions.ai(data, { seq: data.seq }, api, () => 0.9)
  assert.equal(result.ok, true)
  assert.equal(data.match.lastEvent, 'ai-pass')
  assert.equal(data.match.turn, 'you')
  assert.equal(data.match.stage, 'choice')
  assert.equal(state.coins, coinsBefore, 'AI 让枪费不直接给玩家')
  assert.equal(data.vault, vaultBefore - 500)
  assert.equal(data.match.pot, potBefore + 500, '让枪费进底池')
  assert.equal(data.match.feesAi, 500)
})

test('玩家让枪、AI 回让：枪回到玩家，必须开枪且不能再让', () => {
  const { data, api, state } = started({ ai: 'bluff', stake: 1000 })
  setMatch(data, { stage: 'choice', turn: 'you', bulletCount: 1, bullets: [0], chamber: 0, livesYou: 1, livesAi: 1 })
  const coinsBefore = state.coins
  const vaultBefore = data.vault
  const potBefore = data.match.pot
  assert.equal(roulette.actions.pass(data, { seq: data.seq }, api).ok, true)
  assert.equal(data.match.passBy, 'you')
  assert.equal(data.match.stage, 'ai')
  assert.equal(roulette.actions.ai(data, { seq: data.seq }, api, () => 0.9).ok, true)
  assert.equal(data.match.mustShoot, 'you', '回让后先让者必须开枪')
  assert.equal(data.match.passBy, '')
  assert.equal(data.match.turn, 'you')
  assert.equal(data.match.stage, 'choice')
  assert.equal(state.coins, coinsBefore - 500, '玩家让枪费付给 AI')
  assert.equal(data.vault, vaultBefore)
  assert.equal(data.match.pot, potBefore + 500, 'AI 回让费进底池')
  const blocked = roulette.actions.pass(data, { seq: data.seq }, api)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.reason, 'must-shoot')
  assert.equal(roulette.actions.fire(data, { seq: data.seq }, api, () => 0.5).ok, true)
  assert.equal(data.match.mustShoot, '')
})

test('AI 让枪、玩家回让：AI 被回让后必须开枪，哪怕策略本来会让枪', () => {
  const { data, api, state } = started({ ai: 'bluff', stake: 1000 })
  setMatch(data, { stage: 'ai', turn: 'ai', bulletCount: 1, bullets: [0], chamber: 0, livesYou: 1, livesAi: 1 })
  assert.equal(roulette.actions.ai(data, { seq: data.seq }, api, () => 0.9).ok, true)
  assert.equal(data.match.passBy, 'ai')
  assert.equal(data.match.stage, 'choice')
  assert.equal(roulette.actions.pass(data, { seq: data.seq }, api).ok, true)
  assert.equal(data.match.mustShoot, 'ai')
  assert.equal(data.match.turn, 'ai')
  assert.equal(data.match.stage, 'ai')
  assert.equal(state.coins + data.vault + data.match.pot, 112500, '两次让枪费互相抵消但账本守恒')
  assert.equal(roulette.actions.ai(data, { seq: data.seq }, api, () => 0.9).ok, true)
  assert.equal(data.match.lastShooter, 'ai')
  assert.equal(data.match.mustShoot, '')
  assert.equal(data.match.stage, 'matchOver', 'AI 自射中弹，玩家赢下单局')
  assert.equal(data.match.outcome, 'win')
})

test('开枪/重装/新一局都会清掉让枪链', () => {
  const { data, api } = started({ ai: 'bluff', stake: 1000 })
  setMatch(data, { stage: 'ai', turn: 'ai', bulletCount: 1, bullets: [], chamber: 0, livesYou: 1, livesAi: 1 })
  assert.equal(roulette.actions.ai(data, { seq: data.seq }, api, () => 0.9).ok, true)
  assert.equal(data.match.passBy, 'ai')
  assert.equal(roulette.actions.fire(data, { seq: data.seq }, api, () => 0.5).ok, true)
  assert.equal(data.match.passBy, '')
  assert.equal(data.match.mustShoot, '')
})

test('AI 金库不够让枪费时改为开枪', () => {
  const { data, api } = started({ ai: 'bluff', stake: 1000 })
  setMatch(data, { stage: 'ai', turn: 'ai', bulletCount: 1, bullets: [], chamber: 0, livesAi: 1, livesYou: 1 })
  data.vault = 0
  const result = roulette.actions.ai(data, { seq: data.seq }, api, () => 0.9)
  assert.equal(result.ok, true)
  assert.equal(data.match.lastShooter, 'ai')
  assert.equal(data.match.lastEvent, 'blank')
})

test('三局两胜：每局下注、底池累积、最后赢家通吃', () => {
  const { data, api, state } = configured({ coins: 20000, stake: 1000, format: 'bestOf3', lives: 1, loadCount: 1 })
  roulette.actions.start(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(state.coins, 19000)
  assert.equal(data.match.pot, 2000)

  // 第 1 局玩家中弹，AI 赢
  setMatch(data, { stage: 'choice', turn: 'you', bulletCount: 1, bullets: [0], chamber: 0, livesYou: 1, livesAi: 1 })
  roulette.actions.fire(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(data.match.stage, 'roundOver')
  assert.equal(data.match.winsAi, 1)
  assert.equal(data.match.pot, 2000, '本局不结算，底池保留')

  // 第 2 局
  assert.equal(roulette.actions.next(data, { seq: data.seq }, api, () => 0.5).ok, true)
  assert.equal(state.coins, 18000)
  assert.equal(data.match.pot, 4000)
  setMatch(data, { stage: 'ai', turn: 'ai', bulletCount: 1, bullets: [0], chamber: 0, livesAi: 1, livesYou: 1 })
  roulette.actions.ai(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(data.match.winsYou, 1)
  assert.equal(data.match.stage, 'roundOver')

  // 第 3 局，玩家赢下整场
  assert.equal(roulette.actions.next(data, { seq: data.seq }, api, () => 0.5).ok, true)
  assert.equal(state.coins, 17000)
  assert.equal(data.match.pot, 6000)
  setMatch(data, { stage: 'ai', turn: 'ai', bulletCount: 1, bullets: [0], chamber: 0, livesAi: 1, livesYou: 1 })
  roulette.actions.ai(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(data.match.stage, 'matchOver')
  assert.equal(data.match.outcome, 'win')
  assert.equal(state.coins, 23000, '17000 + 6000 底池')
  assert.equal(data.vault, VAULT_INIT - 3000, 'AI 三局配注全输')
})

test('金币不足时 start 拒绝且不留下半场对局', () => {
  const { data, api, state } = configured({ coins: 500, stake: 1000 })
  const result = roulette.actions.start(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'poor')
  assert.equal(state.coins, 500)
  assert.equal(data.match, null)
})

test('装弹前退出退本局底注；装弹后退出底池进 AI 金库', () => {
  const first = started({ stake: 1000 })
  assert.equal(first.state.coins, 11500)
  roulette.actions.leave(first.data, { seq: first.data.seq }, first.api)
  assert.equal(first.state.coins, 12500)
  assert.equal(first.data.vault, VAULT_INIT)
  assert.equal(first.data.match, null)

  const second = started({ stake: 1000 })
  setMatch(second.data, { stage: 'choice', turn: 'you' })
  roulette.actions.leave(second.data, { seq: second.data.seq }, second.api)
  assert.equal(second.state.coins, 11500, '已装弹退出不退底注')
  assert.equal(second.data.vault, VAULT_INIT + 1000, '底池归 AI 金库')
  assert.equal(second.data.match, null)
})

test('配置只允许在无进行中对局时修改', () => {
  const { data, api } = started()
  const result = roulette.actions.config(data, { seq: data.seq, loadCount: 2 }, api)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'busy')
})

test('动作序号不符时拒绝，防止重复 POST', () => {
  const { data, api } = started()
  const result = roulette.actions.arm(data, { seq: data.seq - 1 }, api, () => 0.5)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'stale')
})

test('缺少 seq 或 seq 非整数一律拒绝，不能重复开枪', () => {
  const { data, api } = started()
  setMatch(data, { stage: 'choice', turn: 'you', bulletCount: 1, bullets: [0], chamber: 0, livesYou: 1, livesAi: 1 })
  const before = structuredClone(data)
  assert.equal(roulette.actions.fire(data, {}, api, () => 0.5).reason, 'stale')
  assert.equal(roulette.actions.fire(data, { seq: '2' }, api, () => 0.5).reason, 'stale')
  assert.deepEqual(data, before, '被拒绝的动作不能改状态')
  assert.equal(roulette.actions.config(data, { loadCount: 2 }, api).reason, 'stale')
})

test('leave 当前 seq 或当前 handId 至少一个匹配才放行', () => {
  const { data, api, state } = started({ stake: 1000 })
  const handId = data.match.handId
  assert.equal(roulette.actions.leave(data, { seq: data.seq - 1 }, api).reason, 'stale', '无 handId 的旧 seq 拒绝')
  assert.equal(data.match.handId, handId, '被拒绝的 leave 不能改状态')
  assert.equal(roulette.actions.leave(data, { seq: data.seq - 1, handId }, api).ok, true, '当前 handId 的重试可退出')
  assert.equal(data.match, null)
  assert.equal(state.coins, 12500)
  const seqAfter = data.seq
  assert.equal(roulette.actions.leave(data, { seq: 0 }, api).ok, true)
  assert.equal(data.seq, seqAfter, '对局已清空时 leave 幂等，不推进 seq')
})

test('延迟/重复的旧 leave 带 handId 时，不能清掉新一场', () => {
  const { data, api, state } = configured({ coins: 20000, stake: 1000 })
  roulette.actions.start(data, { seq: data.seq }, api, () => 0.5)
  const firstHand = data.match.handId
  assert.equal(roulette.actions.leave(data, { handId: firstHand }, api).ok, true)
  assert.equal(data.match, null)
  const coinsAfterFirstLeave = state.coins

  roulette.actions.start(data, { seq: data.seq }, api, () => 0.5)
  const secondHand = data.match.handId
  assert.equal(secondHand, firstHand + 1)
  setMatch(data, { stage: 'choice', turn: 'you' })
  const stale = roulette.actions.leave(data, { handId: firstHand }, api)
  assert.equal(stale.ok, false)
  assert.equal(stale.reason, 'stale')
  assert.equal(data.match.handId, secondHand, '新一场必须还在')
  assert.equal(state.coins, coinsAfterFirstLeave - 1000)

  setMatch(data, { stage: 'choice', turn: 'you' })
  assert.equal(roulette.actions.leave(data, { handId: secondHand }, api).ok, true)
  assert.equal(data.match, null)
})

test('三局两胜第 2 局装弹前退出：底池判给 AI，金币不凭空消失', () => {
  const { data, api, state } = configured({ coins: 20000, stake: 1000, format: 'bestOf3', lives: 1, loadCount: 1 })
  roulette.actions.start(data, { seq: data.seq }, api, () => 0.5)
  setMatch(data, { stage: 'choice', turn: 'you', bulletCount: 1, bullets: [0], chamber: 0, livesYou: 1, livesAi: 1 })
  roulette.actions.fire(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(data.match.stage, 'roundOver')
  assert.equal(roulette.actions.next(data, { seq: data.seq }, api, () => 0.5).ok, true)
  assert.equal(data.match.stage, 'arming')
  assert.equal(data.match.pot, 4000)
  assert.equal(state.coins, 18000)
  assert.equal(data.vault, 98000)

  roulette.actions.leave(data, { seq: data.seq }, api)
  assert.equal(data.match, null)
  assert.equal(state.coins, 18000, '玩家两局底注都不退')
  assert.equal(data.vault, 102000, '整场底池归 AI，不能烧掉')
  assert.equal(state.coins + data.vault, 120000, '金币总量守恒')
})

test('AI 让枪费按当前底注 50%，不按 AI 少配后的金额', () => {
  const { data, api, state } = started({ ai: 'bluff', stake: 1000 })
  setMatch(data, { stage: 'ai', turn: 'ai', bulletCount: 1, bullets: [0], chamber: 0, livesAi: 1, livesYou: 1, matchedAi: 100 })
  data.vault = 1000
  const coinsBefore = state.coins
  const potBefore = data.match.pot
  const result = roulette.actions.ai(data, { seq: data.seq }, api, () => 0.9)
  assert.equal(result.ok, true)
  assert.equal(data.match.lastEvent, 'ai-pass')
  assert.equal(state.coins, coinsBefore, '玩家不直接收 AI 让枪费')
  assert.equal(data.vault, 500)
  assert.equal(data.match.pot, potBefore + 500, '按底注 1000 的 50% 进池，不是配注 100 的 50%')
  assert.equal(data.match.feesAi, 500)
})

test('next 可以重新选下一局装弹数，并写回设置', () => {
  const { data, api } = configured({ coins: 20000, stake: 1000, format: 'bestOf3', loadCount: 1 })
  roulette.actions.start(data, { seq: data.seq }, api, () => 0.5)
  setMatch(data, { stage: 'roundOver', round: 1, winsYou: 1, winsAi: 0 })
  const result = roulette.actions.next(data, { seq: data.seq, loadCount: 4 }, api, () => 0.5)
  assert.equal(result.ok, true)
  assert.equal(data.match.bulletCount, 4)
  assert.equal(data.settings.loadCount, 4)

  setMatch(data, { stage: 'roundOver' })
  const bad = roulette.actions.next(data, { seq: data.seq, loadCount: 6 }, api, () => 0.5)
  assert.equal(bad.ok, false)
  assert.equal(bad.reason, 'bad-load')
  assert.equal(data.match.bulletCount, 4)
})

test('next 也触发每日金库补给，且同一天不重复补', () => {
  const { data, api } = configured({ coins: 20000, stake: 1000, format: 'bestOf3' })
  roulette.actions.start(data, { seq: data.seq }, api, () => 0.5)
  setMatch(data, { stage: 'roundOver' })
  data.vault = 100
  data.vaultDay = ''
  assert.equal(roulette.actions.next(data, { seq: data.seq }, api, () => 0.5).ok, true)
  assert.equal(data.vault, 49000, '先补到 50000，再扣本局配注 1000')

  setMatch(data, { stage: 'roundOver' })
  data.vault = 100
  assert.equal(roulette.actions.next(data, { seq: data.seq }, api, () => 0.5).ok, true)
  assert.equal(data.vault, 0, '同一天不再补，只按 100 配注')
})

test('paidYou、让枪费累计进 view，供结算卡算净赢', () => {
  const { data, api, state } = started({ stake: 1000, format: 'bestOf3', ai: 'bluff' })
  assert.equal(data.match.paidYou, 1000)
  setMatch(data, { stage: 'choice', turn: 'you', matchedYou: 1000 })
  roulette.actions.pass(data, { seq: data.seq }, api)
  assert.equal(data.match.feesYou, 500)
  setMatch(data, { stage: 'roundOver' })
  roulette.actions.next(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(data.match.paidYou, 2000)
  setMatch(data, { stage: 'ai', turn: 'ai', bulletCount: 1, bullets: [0], chamber: 0, livesAi: 1, livesYou: 1, matchedAi: 1000 })
  data.vault = 1000
  roulette.actions.ai(data, { seq: data.seq }, api, () => 0.9)
  assert.equal(data.match.feesAi, 500)
  const view = roulette.view(data, api)
  assert.equal(view.match.paidYou, 2000)
  assert.equal(view.match.feesYou, 500)
  assert.equal(view.match.feesAi, 500)
  const net = view.match.pot - view.match.paidYou - view.match.feesYou
  assert.equal(net, 4500 - 2000 - 500)
  assert.equal(state.coins, 10000, '12500 - 两局底注 2000 - 玩家让枪 500；AI 让枪费进池')
})

test('每日补给只给穷 AI 金库补一次，不直接给玩家铸币', () => {
  const { data, api, state } = configured({ coins: 12500, stake: 1000 })
  data.vault = 100
  data.vaultDay = ''
  const coinsBefore = state.coins
  const result = roulette.actions.start(data, { seq: data.seq }, api, () => 0.5)
  assert.equal(result.ok, true)
  assert.equal(state.coins, coinsBefore - 1000, '补给只进金库，不直接给玩家金币')
  assert.equal(data.vault, 49000, '金库先补到 50000，再扣掉本局配注')
  const today = data.vaultDay
  setMatch(data, { stage: 'matchOver' })
  data.vault = 100
  assert.equal(roulette.actions.start(data, { seq: data.seq }, api, () => 0.5).ok, true)
  assert.equal(data.vault, 0, '同一天不再补，只按 100 配注')
  assert.equal(data.vaultDay, today)
})
