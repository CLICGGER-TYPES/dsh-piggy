// @ts-check
/** 记录本局开过枪，供牌桌整枪图区分停轮/开枪后；换局或回到装弹时清掉。 */
export function trackGunState(ui, match) {
  if (match === null || match.stage === 'arming') ui.firedRound = 0
  else if (match.lastEvent === 'hit' || match.lastEvent === 'blank') ui.firedRound = match.round
}

/** 房间关闭/离开后清掉房间和上一场的界面状态，避免重进房间被旧对局挡住。 */
export function clearRoomUi(ui) {
  ui.room = null
  ui.matchView = null
  ui.matchId = ''
  ui.waiting = false
  ui.settled = ''
  ui.net = null
  ui.opponentGone = false
}
