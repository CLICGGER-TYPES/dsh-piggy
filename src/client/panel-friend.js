// @ts-check
/** 朋友猪的面板：复用本地猪的状态/居民卡渲染，只换 view。 */
import { button, el } from './dom.js'
import { desktopShell } from './desktop-shell.js'
import { friendViewOf } from './friend-view.js'
import { renderCardTab } from './tabs/card.js'
import { renderHome } from './tabs/home.js'
import { renderStatusTab } from './tabs/status.js'

/** 朋友菜单和本地猪一样只做导航；喂食/洗澡/玩耍/药品仍在状态页里。 */
var FRIEND_APPS = [
  { key: 'status', label: '状态', emoji: '📋' },
  { key: 'card', label: '居民卡', emoji: '🪪' },
]

function closeFriendPanel() {
  var shell = desktopShell()
  if (shell?.panel?.close) shell.panel.close()
}

/** @param {any} ui */
export function renderFriendHome(ui) {
  var right = el('span', 'dp-friend-menu-right')
  right.appendChild(el('span', null, '朋友'))
  var close = button('dp-drill-back dp-friend-close', { 'data-friend-close': 'true' }, closeFriendPanel)
  close.textContent = '×'
  right.appendChild(close)
  renderHome(ui, FRIEND_APPS, {
    view: ui.friendView ?? ui.view,
    coins: false,
    alerts: false,
    compact: true,
    trailing: right,
  })
}

/** 朋友面板的统一入口：菜单/状态/居民卡，画了返回 true。 */
export function renderFriendAny(ui) {
  if (ui.friend === null || ui.friend === undefined) return false
  if (ui.tab === 'friend-home' && ui.friendWindow === true) {
    renderFriendHome(ui)
    ui.fitPanel()
    return true
  }
  if (ui.tab === 'status' || ui.tab === 'card') {
    renderFriendPanel(ui)
    ui.fitPanel()
    return true
  }
  return false
}

/** @param {any} ui */
export function renderFriendPanel(ui) {
  var friend = ui.friend
  var head = el('div', 'dp-drill')
  var back = button('dp-drill-back', { 'data-friend-back': 'true' }, function () {
    if (ui.friendWindow === true) {
      ui.tab = 'friend-home'
      ui.renderContent()
      ui.fitPanel()
      return
    }
    ui.friend = null
    ui.friendView = null
    ui.friendMode = false
    ui.friendWindow = false
    ui.tab = ui.friendFromTab || 'status'
    ui.host.removeAttribute?.('data-friend')
    ui.renderContent()
    ui.fitPanel()
  })
  back.textContent = '‹'
  head.appendChild(back)
  head.appendChild(el('b', 'dp-drill-title', '🐖 ' + friend.name))
  head.appendChild(el('span', 'dp-drill-info', '朋友'))
  ui.content.appendChild(head)
  var real = ui.view
  ui.view = ui.friendView !== null ? ui.friendView : friendViewOf(real, friend)
  ui.friendMode = true
  if (ui.tab === 'card') renderCardTab(ui)
  else renderStatusTab(ui)
  ui.friendMode = false
  ui.view = real
}
