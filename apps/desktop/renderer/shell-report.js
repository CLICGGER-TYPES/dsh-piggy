// @ts-check
/**
 * 桌面旧外壳的上报模块：内容/可点区域变了才把窗口尺寸和猪的位置报给主进程。
 *
 * 同时维护 Windows 穿透模式的命中状态：鼠标在可点矩形里才可交互。DOM 变化、窗口
 * 改大小、松手时按帧合并量一次，拖动中不量；另留 1 秒兜底。
 */
;(function () {
  /** @type {any} */
  var w = window
  var parts = w.__dshPiggyShellParts || (w.__dshPiggyShellParts = {})

  /**
   * @param {{
   *   shell: any,
   *   boxes: (anchor: { vertical: string, horizontal: string }) => any,
   *   currentAnchor: () => { vertical: string, horizontal: string },
   *   sides: (host: any) => { vertical: string, horizontal: string },
   *   pinPig: (vertical: string, horizontal: string, hostBox: any, contentBox: any) => void,
   *   keyOf: (content: any, shape: any, pig: any, pigBox: any) => string,
   * }} deps
   */
  parts.createReport = function (deps) {
    var shell = deps.shell
    var lastKey = null

    /** 最近一次量出来的可见/可点矩形（窗口坐标），Windows 穿透模式按它判断鼠标在不在内容上。 */
    var hitRects = []
    var lastHit = null
    var mouseX = -1
    var mouseY = -1

    /**
     * @param {number} x
     * @param {number} y
     */
    function updateHit(x, y) {
      mouseX = x
      mouseY = y
      if (typeof shell.setHit !== 'function') return
      var inside = dragging()
      for (var i = 0; !inside && i < hitRects.length; i += 1) {
        var r = hitRects[i]
        inside = x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
      }
      if (inside === lastHit) return
      lastHit = inside
      shell.setHit(inside)
    }

    /** 注册命中跟踪；必须在 client 挂载前完成，页面一出来就能判断穿透。 */
    function install() {
      if (typeof document.addEventListener === 'function') document.addEventListener('mousemove', function (event) { updateHit(event.clientX, event.clientY) }, true)
      var root = /** @type {any} */ (document.documentElement)
      if (root && typeof root.addEventListener === 'function') root.addEventListener('mouseleave', function () {
        if (dragging()) return
        mouseX = -1
        mouseY = -1
        lastHit = false
        if (typeof shell.setHit === 'function') shell.setHit(false)
      })
    }

    /**
     * @param {boolean} [immediate]
     */
    function tick(immediate) {
      var next = deps.boxes(deps.currentAnchor())
      if (next.content === null) return
      var host = /** @type {any} */ (document.querySelector('[data-dsh-pig]'))
      var side = deps.sides(host)
      deps.pinPig(side.vertical, side.horizontal, next.hostBox, next.contentBox)
      // pinPig writes CSS position. Measure again in this same turn so the main
      // process receives the pig's final window-local position before resizing.
      next = deps.boxes(deps.currentAnchor())
      if (next.content === null) return
      var windowInfo = shell.geometry ? shell.geometry() : null
      var oldWidth = Number(windowInfo?.window?.width) || next.content.width
      var oldHeight = Number(windowInfo?.window?.height) || next.content.height
      // A right/bottom-pinned pig moves inside the window as it grows. Send its
      // post-resize local coordinate now, instead of waiting 120ms to measure it.
      var futurePigX = next.pigBox.x + (side.horizontal === 'right' ? next.content.width - oldWidth : 0)
      var futurePigY = next.pigBox.y + (side.vertical === 'bottom' ? next.content.height - oldHeight : 0)
      hitRects = next.shape
      // 内容变了（比如面板收起）而鼠标没动：按最后的鼠标位置重新判断，免得透明处还挡着点击。
      if (mouseX >= 0) updateHit(mouseX, mouseY)
      var key = deps.keyOf(next.content, next.shape, next.pig, next.pigBox)
      if (key === lastKey) return
      lastKey = key
      shell.setContent({
        width: next.content.width,
        height: next.content.height,
        pig: next.pig,
        pigWindow: { x: futurePigX, y: futurePigY },
        // 猪**现在**在窗口里的位置（还没按新内容改窗口）。主进程第一次收到上报时只能靠它
        // 算猪在屏幕上的原位 —— 拿上面那个「改完窗口后」的预测值去算，启动时面板开着
        // 猪就会被挪走（上次退出时面板没关的话，猪会跑到屏幕外）。
        pigNow: { x: next.pigBox.x, y: next.pigBox.y },
        panelOpen: host.getAttribute('data-open') === 'true',
        anchor: side,
        shape: next.shape,
      }, immediate === true)
    }

    // 只在内容真的变了时量：DOM 变了（MutationObserver）、窗口改了大小、松手。
    // 以前是每 120ms 一次 + 每次鼠标移动一次，Windows 上「一卡一卡」的主要来源之一。
    // 拖动中不量：拖动只挪窗口，内容不变。另留 1 秒一次的兜底。
    var scheduled = false

    /** @returns {boolean} */
    function dragging() {
      var scene = document.querySelector('[data-dsh-pig] .dp-scene')
      return scene !== null && scene.getAttribute('data-dragging') === 'true'
    }

    function schedule() {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(function () {
        scheduled = false
        if (!dragging()) tick()
      })
    }

    /** client 挂载完再开始观察 DOM 和兜底轮询。 */
    function start() {
      var host = document.querySelector('[data-dsh-pig]')
      if (host !== null && typeof MutationObserver === 'function') {
        new MutationObserver(schedule).observe(host, { subtree: true, childList: true, attributes: true, characterData: true })
      }
      w.addEventListener('resize', schedule)
      w.addEventListener('pointerup', schedule)
      setInterval(function () { if (!dragging()) tick() }, 1000)
      tick()
    }

    return { install: install, tick: tick, start: start }
  }
})()
