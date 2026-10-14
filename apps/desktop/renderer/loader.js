// @ts-check
/**
 * 桌面版页面的加载器（外壳 0.3.0 起）。
 *
 * 量尺寸、钉位置、窗口摆哪、哪里可点、拖动交接这些逻辑都放在**游戏包**里（client.js 导出的
 * `desktop` 模块），桌面程序只提供「设窗口」「设可点区域/穿透」「拖动跟鼠标」这些基础动作。
 * 这样以后窗口类的修复只发游戏包、热更新就能到，不用每次让玩家重装桌面程序。
 *
 * 回退到老游戏包（没有 desktop 模块）时，改用桌面程序里冻结的旧逻辑 shell.js，照样能用。
 */
;(function () {
  /** @type {any} */
  var w = window
  var entry = null
  w.__ModuleLoader__ = { load: function (e) { entry = e } }

  function legacy() {
    var old = document.createElement('script')
    old.src = 'shell.js'
    document.head.appendChild(old)
  }

  var script = document.createElement('script')
  script.onload = function () {
    var game = w.piggyGame
    if (game && game.desktop && typeof game.mount === 'function') {
      document.documentElement.setAttribute('data-piggy-desktop', String(game.desktop.version || 1))
      game.desktop.install(w.piggyShell)
      game.mount()
      game.desktop.start()
      return
    }
    if (entry === null) { legacy(); return }
    var plugin = entry.factory(function () { return {} })
    if (plugin && plugin.desktop && typeof plugin.desktop.install === 'function') {
      document.documentElement.setAttribute('data-piggy-desktop', String(plugin.desktop.version || 1))
      plugin.desktop.install(w.piggyShell)
      plugin.apply({})
      plugin.desktop.start()
      return
    }
    legacy()
  }
  script.onerror = legacy
  script.src = 'client.js'
  document.head.appendChild(script)
})()
