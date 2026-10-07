// @ts-check
/**
 * 存档里排队的消息（pending）：生病、升级、打工回来、猪说的话……按 id 只处理一次。
 * 从 panel.js 拆出来；拆窗口后（外壳 0.6.0 起）猪窗口和面板窗口各处理自己那一半。
 * @module dsh-piggy/client/pending
 */
import { desktopRole } from './desktop-shell.js'
import { showMilestoneNotice } from './milestone-notice.js'
import { str } from './values.js'

/** News that gets through 免打扰. */
var URGENT_KINDS = ['sick', 'worse', 'death', 'cured', 'revived']

/**
 * @param {any} ctx
 * @param {(event: any) => void} showPigLine 猪说的话（带回复按钮）
 */
export function processPending(ctx, showPigLine) {
  // 拆窗口后两边都在处理排队的消息：猪的反应和猪说的话只在猪窗口演，
  // 提示条只在面板窗口出（猪窗口里没有面板）。
  var role = desktopRole()
  var pigSide = role !== 'panel'
  var cardSide = role !== 'pet'
  for (var i = 0; i < ctx.view.pending.length; i += 1) {
    var event = ctx.view.pending[i]
    // Messages carry an id that only goes up; two from the same instant
    // ("病情加重" then "走了") used to collapse into the first one.
    // Hosts older than the id still dedupe on the timestamp.
    if (event.id > 0 ? event.id <= ctx.lastPendingId : event.at <= ctx.lastPendingAt) continue
    if (event.id > 0) ctx.lastPendingId = event.id
    ctx.lastPendingAt = Math.max(ctx.lastPendingAt, event.at)
    if (event.kind === 'line') {
      if (pigSide) showPigLine(event)
      continue
    }
    // 免打扰: routine news stays quiet; illness and death still speak.
    if (ctx.view.dialogue.quiet && URGENT_KINDS.indexOf(event.kind) < 0) continue
    if (event.kind === 'achievement' || event.kind === 'interest') {
      if (pigSide) showMilestoneNotice(ctx, event)
      continue
    }
    if (event.kind === 'gift') continue // 签到/礼包的结果由猪头气泡说（io.js），不重复弹提示条
    if (cardSide) ctx.toast(str(event.text, '猪有新消息'))
    if (!pigSide) continue
    if (event.kind === 'coronation') { ctx.react('levelup', 950); ctx.transform('crown') }
    else if (event.kind === 'contract') { ctx.react('levelup', 950); ctx.transform('contract') }
    else if (event.kind === 'levelup') { ctx.react('levelup', 950); ctx.burst(['✨', '🎉'], 3) }
    else if (event.kind === 'cured') { ctx.react('cure', 900); ctx.burst(['💚', '✨'], 3) }
    else if (event.kind === 'death') ctx.react('refuse', 700)
    else if (event.kind === 'work') { ctx.react('away', 900); ctx.burst(['🪙', '💰'], 3) }
    else if (event.kind === 'study') { ctx.react('away', 900); ctx.burst(['📚', '✨'], 3) }
    else if (event.kind === 'trip') { ctx.react('away', 900); ctx.burst(['🧳', '🎁'], 3) }
  }
  if (pigSide) ctx.updateNotice?.maybeBubble()
}
