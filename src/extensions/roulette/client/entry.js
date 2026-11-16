// @ts-check
/**
 * 下载扩展入口：注入样式，首次渲染时创建一局本地游戏，再按 page 画大堂、
 * 牌桌、装弹页或规则页。游戏对象挂在闭包里，宿主轮询重绘不会重置对局。
 */

import { createGame } from './game.js'
import { renderLoading, renderLobby, renderRules } from './pages.js'
import { renderTable } from './table.js'
import { CSS } from './styles.js'

const STYLE_ID = 'dsh-piggy-roulette-style'
let game = null
let activeApp = null

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
    rerender: function () {
      if (activeApp !== null && typeof activeApp.rerender === 'function') activeApp.rerender()
    },
  })
  return game
}

function pageNode(app, game) {
  const page = game.state.page
  if (page === 'table') return renderTable(app, game)
  if (page === 'loading') return renderLoading(app, game)
  if (page === 'rules') return renderRules(app, game)
  return renderLobby(app, game)
}

function toastNode(app, current) {
  const node = app.el('div', 'rt-toast', current.toast)
  node.setAttribute('role', 'status')
  node.setAttribute('aria-live', 'polite')
  return node
}

function render(app) {
  style()
  activeApp = app
  const current = ensureGame()
  const shell = app.el('div', 'rt')
  shell.appendChild(pageNode(app, current))
  if (current.state.toast) shell.appendChild(toastNode(app, current.state))
  app.content.appendChild(shell)
}

function register() {
  const host = /** @type {any} */ (window)
  if (!host.dshPiggyExtensions || typeof host.dshPiggyExtensions.register !== 'function') return
  host.dshPiggyExtensions.register('roulette', { render: render })
}

register()
