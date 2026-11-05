// @ts-check
/** 桌面版的联机房间桥；网页版没有这个能力，返回 null。 */
export function roomBridge() {
  var shell = typeof window !== 'undefined' ? (/** @type {any} */ (window)).piggyShell : null
  var room = shell !== null && typeof shell === 'object' ? shell.room : null
  if (room === null || typeof room !== 'object') return null
  if (typeof room.status !== 'function' || typeof room.host !== 'function' || typeof room.join !== 'function') return null
  return room
}
