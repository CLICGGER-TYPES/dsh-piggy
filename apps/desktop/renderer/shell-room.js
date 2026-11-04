// @ts-check
/**
 * 桌面旧外壳的屏幕空间模块：给页面里的猪算「屏幕上还有多少地方」，决定面板朝哪边开。
 *
 * 只读几何和布局，不写样式。收起时的结果会缓存，面板打开过程中不随窗口变化重算。
 */
;(function () {
  /** @type {any} */
  var w = window
  var parts = w.__dshPiggyShellParts || (w.__dshPiggyShellParts = {})

  /**
   * @param {{
   *   geometry: () => any,
   *   layoutBox: (node: any) => { x: number, y: number, width: number, height: number },
   * }} deps
   */
  parts.createRoom = function (deps) {
    var closedRoom = null

    /**
     * 猪在屏幕上的位置与可用空间：页面里的布局按这个算面板朝哪边开。
     * @returns {any}
     */
    function room() {
      var host = /** @type {any} */ (document.querySelector('[data-dsh-pig]'))
      if (host !== null && host.getAttribute('data-open') === 'true' && closedRoom !== null) return closedRoom
      var info = deps.geometry()
      if (info === null) return null
      var pigNode = host === null || host.querySelector === undefined ? null : host.querySelector('.dp-pig')
      if (pigNode === null) return null
      var pigBox = deps.layoutBox(pigNode)
      // 猪在屏幕上的矩形（窗口原点 + 猪在窗口里的位置）
      var pig = {
        left: info.window.x + pigBox.x,
        top: info.window.y + pigBox.y,
        right: info.window.x + pigBox.x + pigBox.width,
        bottom: info.window.y + pigBox.y + pigBox.height,
      }
      var result = {
        above: Math.round(pig.top - info.workArea.y),
        below: Math.round(info.workArea.y + info.workArea.height - pig.bottom),
        left: Math.round(pig.left - info.workArea.x),
        right: Math.round(info.workArea.x + info.workArea.width - pig.right),
        width: info.workArea.width,
        height: info.workArea.height,
      }
      if (host.getAttribute('data-open') === 'false') closedRoom = result
      return result
    }

    /** 位置或内容变了：下次 room() 重新量。 */
    function refresh() { closedRoom = null }

    return { room: room, refresh: refresh }
  }
})()
