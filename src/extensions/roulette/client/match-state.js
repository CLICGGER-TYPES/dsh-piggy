// @ts-check
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
