// @ts-check
/**
 * 猪自己过日子（G 批次，docs/tasks/numbers/G4-lines.md）：
 *
 * - 说话：打开时打个招呼，闲着每 20–40 分钟冒一句，每 5 分钟问一次核心「现在有没有按时间该说的」
 *   （时段问候、喝水休息提醒、节日；核心决定说不说，一天一次）；
 * - 找事做：面板收着、猪在家闲着时，每 3–8 分钟做一个小动作（打滚、打盹、追蝴蝶……）；
 * - 桌面散步：设置里打开（默认关），每 10–20 分钟沿屏幕底边走一段再走回来。
 * @module dsh-piggy/client/life
 */
import { GREET_DELAY_MS, IDLE_CHAT_MINUTES } from './constants.js'
import { readStore, writeStore } from './storage.js'
import { syncPigArt } from './art.js'

var TIME_TALK_MS = 5 * 60_000
var WALK_KEY = 'dsh-piggy:walk'

/** 小动作：样子（CSS 里的 data-idle）、冒的东西、偶尔配的一句。 */
export var IDLE_ACTIONS = [
  { key: 'roll', fx: ['💫'], say: '（滚了一圈）这样比较舒服', ms: 1400 },
  { key: 'nap', fx: [], say: '我就眯一下……', ms: 4000 },
  { key: 'butterfly', fx: ['🦋'], say: '等等我！', ms: 3000 },
  { key: 'scratch', fx: ['〰️'], say: '背上痒痒的', ms: 2000 },
  { key: 'stretch', fx: ['✨'], say: '嗯——伸个懒腰', ms: 1800 },
  { key: 'look', fx: ['❓'], say: '你在写什么呀', ms: 2600 },
  { key: 'bubbles', fx: ['🫧', '🫧', '🫧'], say: '噗噜噜……', ms: 2400 },
]

/** 桌面散步开没开（只存在这台设备）。默认关。 */
export function walkEnabled() { return readStore(WALK_KEY) === 'on' }
export function setWalk(on) { writeStore(WALK_KEY, on ? 'on' : 'off') }

/**
 * @param {object} c
 * @param {(action: string, extra?: object) => void} c.send
 * @param {() => boolean} c.isStopped
 * @param {() => boolean} c.isBusy
 * @param {() => boolean} c.isOpen
 * @param {() => any} c.getView
 * @param {() => boolean} c.isDragging
 * @param {Element} c.pig
 * @param {Element} c.pigArt
 * @param {Element} c.pigEmoji
 * @param {(fx: string[], count: number) => void} c.burst
 * @param {(text: string, ms?: number) => void} c.showBubble
 * @param {() => any} c.desktopShell
 */
export function attachLife(c) {
  var timers = []
  var later = function (fn, ms) { var id = window.setTimeout(fn, ms); timers.push(id); return id }
  var between = function (min, max) { return (min + Math.random() * (max - min)) * 60_000 }
  var hasPig = function () { return c.getView().pig !== null && c.getView().hatched === true && !c.getView().dead }
  var home = function () { return hasPig() && c.getView().activity === null && !c.isOpen() && !c.isDragging() }
  var quiet = function () { return c.getView().dialogue?.quiet === true }

  later(function () { if (!c.isStopped() && hasPig()) c.send('chat', { reason: 'enter' }) }, GREET_DELAY_MS)
  later(timeTalk, GREET_DELAY_MS + 4000)
  scheduleChat()
  scheduleIdle()
  scheduleWalk()

  function scheduleChat() {
    later(function () {
      if (!c.isStopped() && !c.isBusy() && hasPig()) c.send('chat', { reason: 'idle' })
      scheduleChat()
    }, between(IDLE_CHAT_MINUTES.min, IDLE_CHAT_MINUTES.max))
  }

  function timeTalk() {
    if (c.isStopped()) return
    if (!c.isBusy() && hasPig()) c.send('chat', { reason: 'time' })
    later(timeTalk, TIME_TALK_MS)
  }

  function scheduleIdle() {
    later(function () {
      if (c.isStopped()) return
      if (home()) doIdle(IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)])
      scheduleIdle()
    }, between(3, 8))
  }

  function doIdle(action) {
    c.pig.setAttribute('data-idle', action.key)
    syncPigArt(c.pig, c.pigArt, c.pigEmoji)
    if (action.fx.length > 0) c.burst(action.fx, action.fx.length)
    if (!quiet() && Math.random() < 0.35) c.showBubble(action.say, Math.min(3000, action.ms))
    later(function () { c.pig.removeAttribute('data-idle'); syncPigArt(c.pig, c.pigArt, c.pigEmoji) }, action.ms)
  }

  function scheduleWalk() {
    later(function () {
      if (c.isStopped()) return
      var shell = c.desktopShell()
      if (walkEnabled() && !quiet() && home() && shell !== null && typeof shell.moveBy === 'function') walk(shell)
      scheduleWalk()
    }, between(10, 20))
  }

  /** 沿屏幕底边走一段（不超过 300 像素，朝屏幕中间走），再原路走回来。 */
  function walk(shell) {
    var screenWidth = window.screen?.availWidth ?? 0
    var toLeft = screenWidth > 0 && (window.screenX ?? 0) > screenWidth / 2
    var distance = 120 + Math.floor(Math.random() * 180)
    var step = toLeft ? -2 : 2
    var walked = 0
    var back = false
    c.pig.setAttribute('data-idle', 'walk')
    syncPigArt(c.pig, c.pigArt, c.pigEmoji)
    c.pig.setAttribute('data-walk', toLeft ? 'left' : 'right')
    if (!quiet() && Math.random() < 0.5) c.showBubble('我去巡逻一下', 2000)
    var timer = window.setInterval(function () {
      // 你一拖它、一开面板，就停在原地不走了。
      if (c.isStopped() || c.isOpen() || c.isDragging()) return stop()
      shell.moveBy(back ? -step : step, 0)
      walked += 2
      if (!back && walked >= distance) { back = true; walked = 0; c.pig.setAttribute('data-walk', toLeft ? 'right' : 'left') }
      else if (back && walked >= distance) stop()
    }, 16)
    timers.push(timer)
    function stop() {
      window.clearInterval(timer)
      c.pig.removeAttribute('data-idle')
      syncPigArt(c.pig, c.pigArt, c.pigEmoji)
      c.pig.removeAttribute('data-walk')
    }
  }

  return {
    /** 调试页「散步一次」：不等计时，马上走一趟（只有桌面版能走）。 */
    walkNow: function () {
      var shell = c.desktopShell()
      if (shell === null || typeof shell.moveBy !== 'function') return false
      walk(shell)
      return true
    },
    /** 调试页「做个小动作」。 */
    idleNow: function () { doIdle(IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)]) },
    dispose: function () {
      for (var i = 0; i < timers.length; i += 1) { window.clearTimeout(timers[i]); window.clearInterval(timers[i]) }
      timers = []
    },
  }
}
