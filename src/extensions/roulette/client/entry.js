// @ts-check
/**
 * 下载扩展入口：注入样式，首次渲染时创建客户端控制器，再按 game.ui.page
 * 画大堂、牌桌或规则页。每次宿主重绘都会 sync 一次服务端快照。
 */

import { createGame } from './game.js'
import { createOnline } from './online-game.js'
import { renderOnlineLobby, renderOnlineTable } from './online-pages.js'
import { renderRules, renderTable } from './pages.js'
import { CSS } from './styles.js'

const STYLE_ID = 'dsh-piggy-roulette-style'
let game = null
let online = null
let activeApp = null
/** 宿主每次重绘都会重建 .rt；记住同一页面的滚动位置，别让玩家一往下滑就弹回顶部。 */
let scroll = { key: '', top: 0 }

function style() {
  const existing = typeof document.getElementById === 'function' ? document.getElementById(STYLE_ID) : null
  if (existing) {
    if (existing.textContent !== CSS) existing.textContent = CSS
    return
  }
  const node = document.createElement('style')
  node.id = STYLE_ID
  node.textContent = CSS
  ;(document.head || document.body).appendChild(node)
}

function ensureGame() {
  if (game !== null) return game
  game = createGame({
    getApp: function () { return activeApp },
    rerender: function () {
      if (activeApp !== null && typeof activeApp.rerender === 'function') activeApp.rerender()
    },
  })
  online = createOnline({
    getApp: function () { return activeApp },
    rerender: function () {
      if (activeApp !== null && typeof activeApp.rerender === 'function') activeApp.rerender()
    },
  })
  return game
}

function pageNode(app, current) {
  if (current.ui.page === 'online') {
    online.sync()
    return online.ui.page === 'table' ? renderOnlineTable(app, online, current) : renderOnlineLobby(app, online, current)
  }
  if (current.ui.page === 'rules') return renderRules(app, current)
  return renderTable(app, current)
}

function toastNode(app, text) {
  const node = app.el('div', 'rt-toast', text)
  node.setAttribute('role', 'status')
  node.setAttribute('aria-live', 'polite')
  return node
}

function pageKey(current) {
  if (current.ui.page === 'online') return 'online:' + (online !== null ? online.ui.page : 'lobby')
  return current.ui.page
}

function render(app) {
  style()
  activeApp = app
  const current = ensureGame()
  current.sync()
  const shell = app.el('div', app.mode === 'big' ? 'rt rt-big' : 'rt')
  shell.appendChild(pageNode(app, current))
  if (current.ui.toast) shell.appendChild(toastNode(app, current.ui.toast))
  const key = pageKey(current)
  if (scroll.key !== key) scroll = { key: key, top: 0 }
  shell.addEventListener('scroll', function () {
    scroll = { key: key, top: shell.scrollTop }
  })
  app.content.appendChild(shell)
  if (scroll.top > 0) shell.scrollTop = scroll.top
}

function register() {
  const host = /** @type {any} */ (window)
  if (!host.dshPiggyExtensions || typeof host.dshPiggyExtensions.register !== 'function') return
  host.dshPiggyExtensions.register('roulette', { render: render })
}

register()
