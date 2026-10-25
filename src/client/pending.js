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
var URGENT_KINDS = ['sick', 'worse', 'death', 'cured', 'revived', 'weak']

// Remember received IDs rather than only the largest: different responses can
// arrive out of order. Consecutive IDs share a range; a context releases its
// history when its window is disposed. The initial watermark keeps old hosts'
// already-consumed history excluded.
const receivedByContext = new WeakMap()
function receiptFor(ctx) {
  if (!receivedByContext.has(ctx)) receivedByContext.set(ctx, { floor: ctx.lastPendingId || 0, ranges: [] })
  return receivedByContext.get(ctx)
}
function received(receipt, id) {
  return id <= receipt.floor || receipt.ranges.some(range => id >= range[0] && id <= range[1])
}
function rememberId(receipt, id) {
  const merged = []
  const ranges = receipt.ranges.concat([[id, id]]).sort((a, b) => a[0] - b[0])
  for (const range of ranges) {
    const previous = merged[merged.length - 1]
    if (previous && range[0] <= previous[1] + 1) previous[1] = Math.max(previous[1], range[1])
    else merged.push(range.slice())
  }
  if (merged.length && merged[0][0] === receipt.floor + 1) receipt.floor = merged.shift()[1]
  receipt.ranges = merged
}


/**
 * @param {any} ctx
 * @param {(event: any) => void} showPigLine 猪说的话（带回复按钮）
 * @param {any[]} [pending] 要处理的消息；默认是当前快照里的。晚到的轮询补演时直接传入。
 */
export function processPending(ctx, showPigLine, pending = ctx.view.pending) {
  // 拆窗口后两边都在处理排队的消息：猪的反应和猪说的话只在猪窗口演，
  // 提示条只在面板窗口出（猪窗口里没有面板）。
  var receivedIds = receiptFor(ctx)
  var role = desktopRole()
  var pigSide = role !== 'panel' && role !== 'ext'
  var cardSide = role !== 'pet' && role !== 'ext'
  var offlineSummary = null
  var rewards = []
  var rewardLine = null
  // 同批奖励和台词一次展示，不能在 render 后用领取回执抹掉台词/回复。
  var ordered = pending.slice().sort(function (a, b) {
    // 正常快照本来就是按 id 递增的；合并/晚到的消息可能乱序，不能因为先看到
    // 更大的 id 就把更小的接话当成旧的丢掉（见 test/client.test.js 的轮到晚到用例）。
    return (a.id || 0) - (b.id || 0) || (a.at || 0) - (b.at || 0)
  })
  var hasReward = pigSide && ordered.some(function (event) {
    return event.kind === 'gift' && (event.id > 0 ? !received(receivedIds, event.id) : event.at > ctx.lastPendingAt)
  })
  for (var i = 0; i < ordered.length; i += 1) {
    var event = ordered[i]
    // Messages carry an id that only goes up; two from the same instant
    // ("病情加重" then "走了") used to collapse into the first one.
    // Hosts older than the id still dedupe on the timestamp.
    if (event.id > 0 ? received(receivedIds, event.id) : event.at <= ctx.lastPendingAt) continue
    if (event.id > 0) { rememberId(receivedIds, event.id); ctx.lastPendingId = Math.max(ctx.lastPendingId, event.id) }
    ctx.lastPendingAt = Math.max(ctx.lastPendingAt, event.at)
    if (event.kind === 'line') {
      if (pigSide) { if (hasReward) rewardLine = event; else showPigLine(event) }
      continue
    }
    if (event.kind === 'gift') { if (pigSide) rewards.push(str(event.text, '')); continue }
    // 免打扰: routine news stays quiet; illness and death still speak.
    if (ctx.view.dialogue.quiet && URGENT_KINDS.indexOf(event.kind) < 0) continue
    if (event.kind === 'achievement' || event.kind === 'interest') {
      if (pigSide) showMilestoneNotice(ctx, event)
      continue
    }
    if (cardSide) ctx.toast(str(event.text, '猪有新消息'))
    if (pigSide && event.kind === 'offline-food') offlineSummary = event.text
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
  if (hasReward && rewards.length > 0) {
    var receipt = rewards.join('；')
    if (rewardLine !== null) showPigLine({ ...rewardLine, text: receipt + ' · ' + rewardLine.text, displayMs: 4000 })
    else ctx.showBubble(receipt, 4000)
    return
  }
  // 同次结算还可能解锁徽章：最后显示离线摘要，不能在回来的一瞬间被徽章盖掉。
  if (offlineSummary !== null && (role === 'pet' || !ctx.isOpen)) ctx.showBubble(offlineSummary, 8000)
  else if (pigSide) ctx.updateNotice?.maybeBubble()
}
