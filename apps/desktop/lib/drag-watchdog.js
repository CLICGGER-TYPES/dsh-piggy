// @ts-check
/**
 * 页面拖动时每 250ms（以及每次 pointermove）发一次心跳。超过 2 秒没收到，说明页面卡死或
 * 松手事件丢了，主进程就松开窗口，免得猪一直粘在鼠标上。给 2 秒而不是 1 秒：
 * 页面偶尔忙一下（比如面板整块重画）不该把正在进行的拖动掐断。
 */
export const DRAG_HEARTBEAT_TIMEOUT = 2000

export function dragHeartbeatExpired(lastHeartbeat, now) {
  return now - lastHeartbeat > DRAG_HEARTBEAT_TIMEOUT
}
