// @ts-check
/**
 * 联机 1v1 的界面动作与大厅设置。房间事件、房主权威和钱包在 online-session.js；
 * 这里只做按钮前置校验、页面切换和状态文案用的字段。
 */

import { passFee, ONLINE_STAKE_MAX, ONLINE_STAKE_MIN } from '../online.js'
import { createOnlineSession } from './online-session.js'

const LOAD_MIN = 1
const LOAD_MAX = 5

function numberIn(value, min, max, fallback) {
  const n = Math.floor(Number(value))
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

export function createOnline(deps) {
  const getApp = deps.getApp
  const rerender = deps.rerender ?? function () {}

  /** @type {any} 会话和界面共用的一份状态；会话只改房间/对局字段。 */
  const ui = {
    page: 'lobby',
    room: null,
    roomError: '',
    matchView: null,
    matchId: '',
    settings: { lives: 1, format: 'single', stake: 1000, loadCount: 1 },
    error: '',
    waiting: false,
    flash: '',
    spinning: false,
    leaveConfirm: false,
    net: null,
    settled: '',
    opponentGone: false,
  }

  const session = createOnlineSession({ ui, getApp, rerender, schedule: deps.schedule, cancel: deps.cancel, now: deps.now })

  function app() {
    return getApp()
  }

  function coinsNow() {
    const coins = app()?.data?.coins
    return Number.isFinite(coins) ? coins : 0
  }

  function players() {
    return ui.room !== null && Array.isArray(ui.room.players) ? ui.room.players : []
  }

  function opponent() {
    return players().find(player => player.id !== ui.room?.selfId) ?? null
  }

  /** 公网房间的房主由房间服务器指定（players[].host），本地房间则看 hosting。 */
  function roomHost() {
    if (ui.room === null) return false
    if (ui.room.hosting === true) return true
    const me = players().find(player => player.id === ui.room.selfId)
    return me !== undefined && me.host === true
  }

  function openLobby() {
    session.sync()
    ui.page = 'lobby'
    ui.leaveConfirm = false
    session.refresh()
    rerender()
  }

  function back() {
    ui.page = 'lobby'
    ui.error = ''
    session.refresh()
    rerender()
  }

  function enterTable() {
    session.enterTable()
    ui.leaveConfirm = false
    rerender()
  }

  function setSetting(key, value) {
    const settings = ui.settings
    if (key === 'lives' && (value === 1 || value === 3)) settings.lives = value
    else if (key === 'format' && (value === 'single' || value === 'bestOf3')) settings.format = value
    else if (key === 'loadCount') settings.loadCount = numberIn(value, LOAD_MIN, LOAD_MAX, settings.loadCount)
    else if (key === 'stake') settings.stake = numberIn(value, ONLINE_STAKE_MIN, ONLINE_STAKE_MAX, settings.stake)
    else return
    rerender()
  }

  function createTable() {
    if (session.active()) {
      ui.error = '这一场还没结束'
      rerender()
      return
    }
    if (ui.room === null || !roomHost()) {
      // 公网模式也由房主发起 create，权威进程负责建局。
      ui.error = '等房主创建牌桌'
      rerender()
      return
    }
    const guest = opponent()
    if (guest === null) {
      ui.error = '等另一位朋友进房间后再开局'
      rerender()
      return
    }
    if (players().length > 2) {
      ui.error = '联机 1v1 只支持两个人，请其他人先离开房间'
      rerender()
      return
    }
    if (coinsNow() < ui.settings.stake) {
      ui.error = '金币不够本局底注'
      rerender()
      return
    }
    const matchId = 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
    session.reset()
    ui.matchId = matchId
    ui.matchView = null
    ui.settled = ''
    ui.net = null
    ui.opponentGone = false
    ui.error = ''
    session.create(matchId, guest.id, ui.settings)
    rerender()
  }

  function arm(index) {
    const view = ui.matchView
    if (view === null || view.stage !== 'arming' || session.seat() !== 'host') return
    const chamber = numberIn(index, 0, 5, Math.floor(Math.random() * 6))
    session.sendAction('arm', { chamber })
    ui.flash = ''
    rerender()
  }

  function randomArm() {
    arm(Math.floor(Math.random() * 6))
  }

  function fire() {
    const view = ui.matchView
    if (view === null || view.stage !== 'choice' || view.turn !== session.seat()) return
    session.sendAction('fire')
    rerender()
  }

  function pass() {
    const view = ui.matchView
    if (view === null || view.stage !== 'choice' || view.turn !== session.seat()) return
    if (view.mustShoot === session.seat()) {
      ui.error = '回让后必须开枪'
      rerender()
      return
    }
    const fee = passFee(view.settings.stake)
    if (coinsNow() < fee) {
      ui.error = '金币不够让枪费 ' + fee
      rerender()
      return
    }
    session.sendAction('pass')
    rerender()
  }

  function next() {
    const view = ui.matchView
    if (view === null || view.stage !== 'roundOver' || session.seat() !== 'host') return
    session.sendAction('next', { loadCount: ui.settings.loadCount })
    rerender()
  }

  function requestLeave() {
    if (!session.active()) {
      confirmLeave()
      return
    }
    ui.leaveConfirm = true
    rerender()
  }

  function cancelLeave() {
    ui.leaveConfirm = false
    rerender()
  }

  function confirmLeave() {
    ui.leaveConfirm = false
    if (ui.room !== null && session.active()) {
      // 让权威把认输事件广播给对手；等终局事件回来再清状态。
      session.sendAction('leave')
      ui.page = 'lobby'
    } else {
      session.reset()
      ui.page = 'lobby'
      ui.matchView = null
    }
    rerender()
  }

  function sync() {
    session.sync()
  }

  return {
    ui,
    sync,
    openLobby,
    enterTable,
    back,
    refresh: session.refresh,
    setSetting,
    createTable,
    arm,
    randomArm,
    fire,
    pass,
    next,
    requestLeave,
    cancelLeave,
    confirmLeave,
    players,
    opponent,
    roomHost,
  }
}
