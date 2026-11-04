// @ts-check
/**
 * 桌面旧外壳的装配入口（D1）。
 *
 * 窗口不再铺满屏幕：页面把「猪 + 面板 + 气泡」的**布局外接框**报给主进程，主进程把窗口
 * 调成那个大小再四周留 16px；拖猪的时候主进程按固定起点读取鼠标位置，页面自己不动位置。
 *
 * 具体逻辑拆在同目录的模块里：shell-measure.js（量框）、shell-anchor.js（锚边/定位）、
 * shell-room.js（屏幕空间）、shell-report.js（上报/命中）、shell-tooltip.js（原生提示）。
 * 依赖单向：本文件 → 各模块；shell-anchor / shell-room / shell-report 只依赖量框结果，
 * 模块之间不互相引用。这里只负责按顺序装起来、在 client.js 挂载前交出
 * __dshPiggyShell，然后启动上报。
 */
;(function () {
  /** @type {any} */
  var w = window
  var shell = w.piggyShell
  var parts = w.__dshPiggyShellParts

  if (parts === undefined) {
    console.error('shell.js: missing shell-*.js modules; check renderer/index.html load order')
    return
  }

  /** 读主进程推来的窗口位置 + 工作区；还没有几何时返回 null。 */
  function geometry() { return shell.geometry ? shell.geometry() : null }

  var measure = parts.createMeasure({ geometry: geometry, platform: shell.platform })
  var anchor = parts.createAnchor({ layoutBox: measure.layoutBox, step: measure.STEP, padding: measure.PAD })
  var report = parts.createReport({
    shell: shell,
    boxes: measure.boxes,
    currentAnchor: anchor.current,
    sides: anchor.sides,
    pinPig: anchor.pinPig,
    keyOf: anchor.keyOf,
  })
  var room = parts.createRoom({ geometry: geometry, layoutBox: measure.layoutBox })
  var tooltip = parts.createTooltip()

  // 先把外壳挂上：client.js 在挂载那一刻（apply 里）就会读 __dshPiggyShell，
  // 晚一步它就把桌面版当网页版 —— 拖动只挪页面里的猪、窗口不跟。几何还没到时
  // room() 返回 null，页面会先用自己那套算，等几何到了再改。
  // 几何（窗口位置 + 工作区）靠主进程推过来：不订阅的话 room() 永远是 null，
  // 桌面版的分支就跑不到（面板会按小窗口的 innerWidth 乱开）。
  if (typeof shell.onGeometry === 'function') shell.onGeometry(function () {})
  if (typeof shell.askGeometry === 'function') shell.askGeometry()

  w.__dshPiggyShell = {
    /** 猪在屏幕上的位置与可用空间：页面里的布局按这个算面板朝哪边开。 */
    room: room.room,
    refreshRoom: room.refresh,
    beginDrag: function () { shell.beginDrag() },
    /** 旧游戏包（0.27.2 及以前）只认 moveBy：回退到旧版本时拖动照样能用。 */
    moveBy: function (dx, dy) { if (typeof shell.moveBy === 'function') shell.moveBy(dx, dy) },
    dragHeartbeat: function () { shell.dragHeartbeat?.() },
    endDrag: function () { shell.endDrag() },
    syncGeometry: function () { report.tick(true) },
  }

  var entry = null
  w.__ModuleLoader__ = { load: function (e) { entry = e } }

  var script = document.createElement('script')
  script.onload = function () {
    if (entry === null) return
    entry.factory(function () { return {} }).apply({})
    report.start()
  }
  script.src = 'client.js'
  document.head.appendChild(script)

  report.install()
  tooltip.install()
})()
