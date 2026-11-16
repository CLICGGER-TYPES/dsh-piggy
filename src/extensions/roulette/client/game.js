// @ts-check
/**
 * 左轮轮盘的本地对局状态机（AI 1v1、三局两胜、6 巢 1 发）。
 *
 * 所有金币、AI 金库和比分都只活在这个闭包里，不写主存档，也不调用 app.send；
 * 宿主轮询重绘时由 render 读同一份状态，所以规则子页、装弹页和牌桌能互相返回。
 * 计时用注入的 schedule，测试可以手动推进，不依赖真实时钟。
 */

export const STAKE_MIN = 500
export const STAKE_MAX = 10000
export const STAKE_STEP = 500
export const CHAMBERS = 6
export const CHAMBER_X = [0, 33, 33, 0, -32, -32]
export const CHAMBER_Y = [-32, -15, 17, 34, 17, -15]

/** 演示局初始值：金币是玩家自己的，金库是 AI 的。 */
export function createState() {
  return {
    page: 'lobby',
    stage: 'idle',
    rulesFrom: 'lobby',
    stake: 1000,
    coins: 12500,
    vault: 100000,
    matched: 0,
    pot: 0,
    you: 0,
    ai: 0,
    round: 1,
    bullet: -1,
    chamber: 0,
    primer: -1,
    primerPop: false,
    arming: false,
    pendingFresh: false,
    settled: false,
    spinning: false,
    flash: '',
    outcome: '',
    status: '先下注，再开始。转轮结果不会提前显示。',
    toast: '',
  }
}

/** 金额按原型用千分位；只有展示层用，不参与结算。 */
export function money(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US')
}

/** AI 金库配注上限：1%，向下取整到百位，最低 500。 */
export function aiCap(vault) {
  return Math.max(STAKE_MIN, Math.floor((Number(vault) || 0) * 0.01 / 100) * 100)
}

/** 这一场实际锁定的底注；高出配注上限的部分不扣。 */
export function matchStake(state) {
  return Math.min(state.stake, aiCap(state.vault))
}

/**
 * @param {{
 *   rerender?: () => void,
 *   random?: () => number,
 *   schedule?: (fn: () => void, ms: number) => any,
 *   cancel?: (id: any) => void,
 * }} [options]
 */
export function createGame(options = {}) {
  const state = createState()
  const rerender = options.rerender ?? function () {}
  const random = options.random ?? Math.random
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms))
  const cancel = options.cancel ?? (id => clearTimeout(id))
  const timers = []
  let toastTimer = null

  function commit() {
    rerender()
  }

  function later(fn, ms) {
    const id = schedule(function () {
      const at = timers.indexOf(id)
      if (at >= 0) timers.splice(at, 1)
      fn()
    }, ms)
    timers.push(id)
    return id
  }

  function stopTimers() {
    while (timers.length > 0) cancel(timers.pop())
    if (toastTimer !== null) {
      cancel(toastTimer)
      toastTimer = null
    }
  }

  function toast(text) {
    state.toast = text
    if (toastTimer !== null) cancel(toastTimer)
    toastTimer = schedule(function () {
      toastTimer = null
      state.toast = ''
      commit()
    }, 1900)
  }

  function randomChamber() {
    const value = Math.floor(Number(random()) * CHAMBERS)
    return Math.max(0, Math.min(CHAMBERS - 1, value))
  }

  function resetMatch() {
    stopTimers()
    state.stage = 'idle'
    state.you = 0
    state.ai = 0
    state.round = 1
    state.matched = 0
    state.pot = 0
    state.bullet = -1
    state.chamber = 0
    state.primer = -1
    state.primerPop = false
    state.arming = false
    state.pendingFresh = false
    state.settled = false
    state.spinning = false
    state.flash = ''
    state.outcome = ''
    state.status = '先下注，再开始。转轮结果不会提前显示。'
    state.toast = ''
  }

  function enterTable() {
    resetMatch()
    state.page = 'table'
    commit()
  }

  function leaveTable() {
    // 只有新一场的第 1 局、还没开枪时装弹退出才退款；第 2/3 局离开按本场作废。
    const refund = state.pot > 0 && !state.settled && state.round === 1 && state.you === 0 && state.ai === 0 &&
      (state.page === 'loading' || state.stage === 'arming')
    const forfeit = state.pot > 0 && !state.settled && !refund
    if (refund) state.coins += state.matched
    resetMatch()
    state.page = 'lobby'
    if (refund) toast('已取消装弹，底注退回')
    else if (forfeit) toast('已退出牌桌，本场作废')
    else toast('已回到大厅')
    commit()
  }

  function backToTable() {
    if (state.page !== 'loading') return
    state.page = 'table'
    state.stage = state.pendingFresh ? 'idle' : 'roundOver'
    state.pendingFresh = false
    state.status = state.stage === 'idle'
      ? '先下注，再开始。转轮结果不会提前显示。'
      : '本局结束。点「下一局」继续。'
    commit()
  }

  function openRules(from) {
    state.rulesFrom = from || state.page
    state.page = 'rules'
    commit()
  }

  function closeRules() {
    const back = state.rulesFrom === 'rules' ? 'lobby' : state.rulesFrom
    state.page = back
    state.rulesFrom = 'lobby'
    commit()
  }

  function setStake(delta) {
    if (state.page !== 'table' || state.stage !== 'idle') return
    state.stake = Math.max(STAKE_MIN, Math.min(STAKE_MAX, state.stake + delta))
    commit()
  }

  function startMatch() {
    if (state.stage !== 'idle' && state.stage !== 'roundOver' && state.stage !== 'matchOver') return
    const fresh = state.stage === 'idle' || state.stage === 'matchOver'
    if (fresh) {
      state.you = 0
      state.ai = 0
      state.round = 1
      state.matched = 0
      state.pot = 0
      state.bullet = -1
      state.chamber = 0
      state.primer = -1
      state.primerPop = false
      state.arming = false
      state.spinning = false
      state.flash = ''
      state.settled = false
      state.outcome = ''
    }
    state.pendingFresh = fresh
    state.page = 'loading'
    commit()
  }

  function beginLoad(auto) {
    if (state.page !== 'loading') return
    if (state.pendingFresh) {
      const need = matchStake(state)
      if (state.coins < need) {
        toast('金币不足')
        commit()
        return
      }
      state.matched = need
      state.coins -= need
      state.pot = need * 2
      state.pendingFresh = false
    }
    if (state.pot <= 0) {
      toast('先下注')
      commit()
      return
    }
    state.page = 'table'
    state.stage = 'arming'
    state.arming = true
    state.bullet = -1
    state.chamber = 0
    state.primer = -1
    state.primerPop = false
    state.spinning = false
    state.flash = ''
    state.outcome = ''
    state.status = auto ? '系统随机装弹…' : '点一个弹孔，把子弹装进去。'
    commit()
    if (auto) {
      later(function () {
        if (state.stage === 'arming') seat(randomChamber())
      }, 520)
    }
  }

  function seat(index) {
    if (state.stage !== 'arming' || !state.arming) return
    if (!Number.isInteger(index) || index < 0 || index >= CHAMBERS) return
    state.arming = false
    state.bullet = index
    // 不转轮直接开枪时，玩家选的孔就是准星下的孔；转轮会重新随机。
    state.chamber = index
    state.primer = index
    state.primerPop = true
    state.stage = 'ready'
    state.status = '第 ' + (index + 1) + ' 巢已装弹 · 直接开枪按该孔，或转轮。'
    toast('第 ' + (index + 1) + ' 巢已装弹')
    commit()
    later(function () {
      if (state.primer !== index) return
      state.primerPop = false
      commit()
    }, 320)
  }

  function randomArm() {
    if (state.stage !== 'arming' || !state.arming) return
    seat(randomChamber())
  }
  function spin() {
    if (state.stage !== 'ready') return
    state.stage = 'spinning'
    state.spinning = true
    state.primer = -1
    state.primerPop = false
    state.status = '转轮中… 子弹位置不会显示。'
    commit()
    later(function () {
      state.bullet = randomChamber()
      state.chamber = 0
      state.spinning = false
      state.stage = 'choice'
      state.status = '转轮完成。你先手：对自己开枪，或不开枪。'
      commit()
    }, 950)
  }

  function flash(live) {
    state.flash = live ? 'live' : 'blank'
    later(function () {
      state.flash = ''
      commit()
    }, 450)
  }

  function finishRound(winner) {
    if (winner === 'you') state.you += 1
    else state.ai += 1
    if (state.you >= 2 || state.ai >= 2) {
      if (state.you >= 2) {
        state.vault = Math.max(0, state.vault - state.matched)
        state.coins += state.pot
        state.outcome = 'win'
        state.status = '你赢下整场，拿走底池 ' + money(state.pot) + '。'
      } else {
        state.vault += state.matched
        state.outcome = 'lose'
        state.status = 'AI 赢下整场。底池进了 AI 金库。'
      }
      state.settled = true
      state.stage = 'matchOver'
      toast(state.outcome === 'win' ? '整场胜利' : '整场结束')
    } else {
      state.round += 1
      state.stage = 'roundOver'
      state.status = '本局结束。比分 ' + state.you + ' : ' + state.ai + '。点「下一局」继续。'
      toast('本局结束')
    }
    commit()
  }

  function fire(shooter) {
    if (shooter === 'you' && state.stage !== 'ready' && state.stage !== 'choice') return
    if (shooter === 'ai' && state.stage !== 'ai') return
    if (state.chamber === state.bullet) {
      state.primer = -1
      state.primerPop = false
      flash(true)
      state.status = '中弹！'
      finishRound(shooter === 'you' ? 'ai' : 'you')
      return
    }
    flash(false)
    state.chamber = (state.chamber + 1) % CHAMBERS
    state.primer = -1
    state.primerPop = false
    if (shooter === 'you') {
      state.stage = 'ai'
      state.status = '空枪。你把枪交给 AI。'
      commit()
      later(aiTurn, 650)
      return
    }
    state.stage = 'choice'
    state.status = 'AI 空枪。枪回到你手里。'
    commit()
  }

  function aiTurn() {
    if (state.stage !== 'ai') return
    state.spinning = true
    state.primer = -1
    state.primerPop = false
    state.status = 'AI 转轮…'
    commit()
    later(function () {
      state.bullet = randomChamber()
      state.chamber = 0
      state.spinning = false
      fire('ai')
    }, 900)
  }

  function pass() {
    if (state.stage !== 'ready' && state.stage !== 'choice') return
    state.stage = 'ai'
    state.primer = -1
    state.primerPop = false
    state.status = '你选择不开枪。枪交给 AI。'
    commit()
    later(aiTurn, 500)
  }

  return {
    state,
    later,
    notify: function (text) {
      toast(text)
      commit()
    },
    enterTable,
    leaveTable,
    backToTable,
    openRules,
    closeRules,
    setStake,
    startMatch,
    beginLoad,
    seat,
    randomArm,
    spin,
    fire,
    pass,
    aiTurn,
    stopTimers,
  }
}
