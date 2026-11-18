// @ts-check
/**
 * 左轮轮盘客户端控制器。
 *
 * 权威对局在扩展服务端（extensions/roulette/server.js），这里只做三件事：
 * 读 app.data 画界面、把点击变成 app.send、保留装弹/转轮/火光这些瞬时动画。
 * 子弹位置不会出现在 app.data 里，客户端拿不到。
 */

import { createAiRunner } from './ai.js'
import { createArm } from './arm.js'
import { createUiActions } from './ui-actions.js'

export const CHAMBERS = 6
export const CHAMBER_X = [0, 39, 39, 0, -38, -38]
export const CHAMBER_Y = [-38, -18, 20, 40, 20, -18]
export const LOAD_MIN = 1
export const LOAD_MAX = 5
export const LIVES_OPTIONS = [1, 3]
export const STAKE_LEVELS = [100, 500, 1000, 5000]
export const STAKE_MIN = 100
export const STAKE_MAX = 10000
export const AI_STRATEGIES = [
  { key: 'always', label: '莽夫' },
  { key: 'expected', label: '期望值' },
  { key: 'bluff', label: '随机诈唬' },
  { key: 'bayes', label: '贝叶斯' },
  { key: 'monteCarlo', label: '蒙特卡洛' },
]
export const PASS_RATE = 0.5

const EMPTY = {
  coins: 0,
  vault: 0,
  settings: { lives: 1, format: 'single', loadCount: 1, stake: 1000, ai: 'always' },
  seq: 0,
  passRate: PASS_RATE,
  match: null,
}

export function money(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US')
}

/**
 * @param {{
 *   app?: any,
 *   getApp?: () => any,
 *   rerender?: () => void,
 *   schedule?: (fn: () => void, ms: number) => any,
 *   cancel?: (id: any) => void,
 * }} [options]
 */
export function createGame(options = {}) {
  const getApp = options.getApp ?? (() => options.app)
  const rerender = options.rerender ?? function () {}
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms))
  const cancel = options.cancel ?? (id => clearTimeout(id))
  const timers = []
  let toastTimer = null

  const ui = {
    page: 'lobby',
    rulesFrom: 'lobby',
    toast: '',
    arming: false,
    spinning: false,
    primer: -1,
    primerPop: false,
    flash: '',
    lastSeq: -1,
    aiKey: '',
    aiError: false,
    nextLoad: null,
    leaveConfirm: false,
    armTimer: null,
    armPending: false,
    armUncertain: false,
    armToken: 0,
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

  const uiActions = createUiActions({ ui, rerender })
  const ai = createAiRunner({ ui, later, send, rerender })
  const arm = createArm({ ui, chambers: CHAMBERS, cancel, later, send, rerender, toast })

  function data() {
    const app = getApp()
    const value = app && app.data
    if (!value || typeof value !== 'object' || value.settings === undefined) return EMPTY
    return value
  }

  function app() {
    return getApp()
  }

  function seq() {
    const value = data().seq
    return Number.isInteger(value) ? value : 0
  }

  function send(op, payload) {
    const current = app()
    if (!current || typeof current.send !== 'function') {
      toast('宿主没有连接，暂时不能行动')
      return null
    }
    return current.send(op, Object.assign({}, payload ?? {}, { seq: seq() }))
  }

  function toast(text) {
    ui.toast = text
    if (toastTimer !== null) cancel(toastTimer)
    toastTimer = schedule(function () {
      toastTimer = null
      ui.toast = ''
      rerender()
    }, 1900)
  }

  function notify(text) {
    toast(text)
    rerender()
  }

  function clearFlash(ms) {
    later(function () {
      ui.flash = ''
      rerender()
    }, ms)
  }

  /** 每次宿主重绘时同步服务端快照，并按 lastEvent 触发一次动画。 */
  function sync() {
    const value = data()
    if (!Number.isInteger(value.seq)) return
    if (ui.lastSeq !== value.seq) {
      ui.lastSeq = value.seq
      ui.leaveConfirm = false
      ui.nextLoad = null
      if (ui.armTimer !== null) {
        cancel(ui.armTimer)
        ui.armTimer = null
      }
      ui.arming = false
      ui.spinning = false
      ui.primer = -1
      ui.primerPop = false
      ui.armPending = false
      ui.armUncertain = false
      const match = value.match
      if (match !== null) {
        if (match.lastEvent === 'hit' && match.lastShooter === 'you') {
          ui.flash = 'live'
          clearFlash(450)
        } else if (match.lastEvent === 'blank' && match.lastShooter === 'you') {
          ui.flash = 'blank'
          clearFlash(450)
        }
        if (match.lastEvent === 'armed' || match.lastEvent === 'reload') {
          ui.spinning = false
          ui.arming = false
        }
      }
    }
    const match = value.match
    if (match !== null && match.stage === 'ai') {
      // seq 必须进 key：AI 让枪后玩家再让枪，弹巢和剩余子弹可能完全没变，
      // 只靠 hand/round/chamber/turn/bulletsLeft 会误判成同一次 AI 回合而卡住。
      const key = value.seq + ':' + match.handId + ':' + match.round + ':' + match.chamber + ':' + match.turn + ':' + match.bulletsLeft
      if (ui.aiKey !== key) {
        ui.aiKey = key
        ui.aiError = false
        ai.schedule(key, 0)
      }
    }
  }

  function enterTable() {
    ui.page = 'table'
    rerender()
  }

  /** 切到另一个页面；好友联机入口用它进联机大厅。 */
  function showPage(next) {
    ui.page = next
    ui.flash = ''
    rerender()
  }

  function leaveTable() {
    const match = data().match
    send('leave', { handId: match === null ? undefined : match.handId })
    stopTimers()
    arm.reset()
    ui.page = 'lobby'
    ui.flash = ''
    ui.aiKey = ''
    ui.aiError = false
    ui.nextLoad = null
    ui.leaveConfirm = false
    toast('已回到大厅')
    rerender()
  }

  /** 返回大厅前先确认：装弹后退出是认输，底池归 AI。 */
  function requestLeave() {
    const match = data().match
    if (match === null || match.stage === 'matchOver') {
      leaveTable()
      return
    }
    // 装弹请求已经发出、回包还没到：此时服务端可能已经进入 choice，
    // 不能拿旧的 arming 快照当“免费取消”，先挡住。
    if (ui.armPending) {
      notify('装弹请求提交中，稍等一下')
      return
    }
    // 还在装弹动画里（arm 尚未发出）：取消动画，仍按装弹前退出全额退。
    if (ui.arming && ui.armTimer !== null) {
      cancel(ui.armTimer)
      ui.armTimer = null
      ui.arming = false
      ui.spinning = false
      ui.primer = -1
      ui.primerPop = false
      leaveTable()
      return
    }
    if (match.stage === 'arming' && match.round === 1 && !ui.armUncertain) {
      leaveTable()
      return
    }
    ui.leaveConfirm = true
    rerender()
  }

  function start() {
    const value = data()
    // 服务端还有一场没结算（例如上一次离开请求失败）时，先回到牌桌，
    // 不能因为金币不够底注把人挡在大厅里；matchOver 要正常开新一场。
    if (value.match !== null && value.match.stage !== 'matchOver') {
      ui.page = 'table'
      ui.leaveConfirm = false
      ui.nextLoad = null
      arm.reset()
      rerender()
      return
    }
    if (value.coins < value.settings.stake) {
      notify('金币不够本局底注')
      return
    }
    send('start')
    ui.page = 'table'
    ui.aiKey = ''
    ui.aiError = false
    ui.leaveConfirm = false
    ui.nextLoad = null
    arm.reset()
    rerender()
  }

  function next() {
    const value = data()
    if (value.coins < value.settings.stake) {
      notify('金币不够下一局底注')
      return
    }
    const loadCount = ui.nextLoad ?? value.settings.loadCount
    send('next', { loadCount: loadCount })
    ui.aiKey = ''
    ui.aiError = false
    arm.reset()
    rerender()
  }

  function setNextLoad(value) {
    const count = Math.floor(Number(value))
    if (!Number.isInteger(count) || count < LOAD_MIN || count > LOAD_MAX) {
      notify('装弹数 ' + LOAD_MIN + '–' + LOAD_MAX + ' 发')
      return false
    }
    ui.nextLoad = count
    rerender()
    return true
  }

  function config(patch) {
    send('config', patch)
    rerender()
  }

  function setStake(value) {
    const amount = Math.floor(Number(value))
    if (!Number.isInteger(amount) || amount < STAKE_MIN || amount > STAKE_MAX) {
      notify('底注范围 ' + money(STAKE_MIN) + '–' + money(STAKE_MAX))
      return false
    }
    config({ stake: amount })
    return true
  }

  function load(index) {
    const match = data().match
    if (match === null || match.stage !== 'arming') return
    arm.load(index)
  }

  function randomLoad() {
    arm.load(Math.floor(Math.random() * CHAMBERS))
  }

  function fire() {
    const match = data().match
    if (match === null || match.stage !== 'choice' || match.turn !== 'you') return
    send('fire')
    rerender()
  }

  function pass() {
    const value = data()
    const match = value.match
    if (match === null || match.stage !== 'choice' || match.turn !== 'you') return
    if (match.mustShoot === 'you') {
      notify('回让后必须开枪')
      return
    }
    const fee = Math.max(1, Math.ceil(value.settings.stake * (value.passRate || PASS_RATE)))
    if (value.coins < fee) {
      notify('金币不够让枪费 ' + money(fee))
      return
    }
    send('pass')
    rerender()
  }

  function openRules(from) {
    ui.rulesFrom = from || ui.page
    ui.page = 'rules'
    rerender()
  }

  function closeRules() {
    ui.page = ui.rulesFrom === 'rules' ? 'lobby' : ui.rulesFrom
    ui.rulesFrom = 'lobby'
    rerender()
  }

  return {
    ui,
    data,
    sync,
    enterTable,
    showPage,
    leaveTable,
    requestLeave,
    ...uiActions,
    start,
    next,
    setNextLoad,
    config,
    setStake,
    load,
    randomLoad,
    fire,
    pass,
    openRules,
    closeRules,
    notify,
    toast,
    stopTimers,
    seq,
  }
}
