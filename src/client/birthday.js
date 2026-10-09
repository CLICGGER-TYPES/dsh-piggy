// @ts-check
/**
 * 猪的生日（用户 2026-10-09）：当天头顶冒蛋糕，点一下猪短暂换成生日派对图，再冒几个彩带。
 * 点没点过只记在这台设备上、按本地日期算，第二天自动清零；不进存档、不发奖励（奖励以后另定）。
 * @module dsh-piggy/client/birthday
 */
import { syncPigArt } from './art.js'
import { readStore, writeStore } from './storage.js'

var CAKE_KEY = 'dsh-piggy:cake'
/** 生日图显示多久（「一小会」）。 */
export var PARTY_MS = 15_000

function today() {
  var now = new Date()
  return now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate()
}

/** 今天的蛋糕点过了吗。 */
export function cakeTakenToday() { return readStore(CAKE_KEY) === today() }

/**
 * 点蛋糕的动作；顺带在 ctx 上挂调试页「过生日」用的 birthdayNow。
 * @param {{ ctx: any, pig: any, pigArt: any, pigEmoji: any, burst: Function, render: () => void }} c render 是「重新取状态再画」
 */
export function createBirthday(c) {
  var timer = null
  // 调试页「过生日」：不管是不是生日，先把蛋糕冒出来。桌面版面板窗口里 split.js 会把它换成转给猪窗口。
  c.ctx.birthdayNow = function () { c.ctx.cakeForced = true; c.render() }
  return {
    /** 点了蛋糕：猪短暂换成生日图、冒彩带，蛋糕今天不再冒。 */
    celebrate: function () {
      writeStore(CAKE_KEY, today())
      c.ctx.cakeForced = false
      c.pig.setAttribute('data-party', 'true')
      syncPigArt(c.pig, c.pigArt, c.pigEmoji)
      c.burst(['\u{1F382}', '\u{1F389}', '\u{1F388}'], 6)
      c.render()
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(function () {
        timer = null
        c.pig.removeAttribute('data-party')
        syncPigArt(c.pig, c.pigArt, c.pigEmoji)
      }, PARTY_MS)
    },
  }
}
