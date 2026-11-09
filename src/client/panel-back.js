// @ts-check
/**
 * 面板里的右键返回：先收选择器，再回来源页，最后回当前页签的上一层。
 * 输入框保留系统右键菜单；其余位置一右键就返回上一页。
 * @module dsh-piggy/client/panel-back
 */

import { desktopShell } from './desktop-shell.js'

export function attachPanelBack(ctx) {
  function backOneLevel() {
    if (ctx.drill.pick !== null && ctx.drill.pick !== undefined) {
      ctx.drill.pick = null
      ctx.renderContent()
      return true
    }
    if (ctx.drill.from) {
      ctx.select(ctx.drill.from)
      return true
    }
    if (ctx.picker !== null && ctx.picker !== undefined) {
      ctx.picker = null
      ctx.renderContent()
      return true
    }
    var tab = ctx.tab
    if (tab in ctx.drill && ctx.drill[tab] !== null && ctx.drill[tab] !== undefined) {
      ctx.drill[tab] = null
      ctx.drill.pick = null
      ctx.renderContent()
      ctx.content.scrollTop = 0
      return true
    }
    if (ctx.friendWindow === true) {
      if (ctx.tab === 'friend-home') {
        var shell = desktopShell()
        if (shell?.panel?.close) { shell.panel.close(); return true }
        return false
      }
      ctx.tab = 'friend-home'
      ctx.renderContent()
      return true
    }
    if (ctx.friend !== null && ctx.friend !== undefined) {
      if (ctx.tab === 'card') {
        ctx.tab = 'status'
        ctx.renderContent()
        return true
      }
      ctx.friend = null
      ctx.friendView = null
      ctx.friendMode = false
      ctx.careTarget = null
      ctx.host.removeAttribute?.('data-friend')
      ctx.tab = ctx.friendFromTab || 'status'
      ctx.renderContent()
      return true
    }
    // 所有一级 App 页都能右键回主菜单；主菜单本身没有上一页。
    if (ctx.tab !== 'home') {
      ctx.select('home')
      return true
    }
    return false
  }

  ctx.card.addEventListener('contextmenu', function (event) {
    var target = event.target
    var tag = target && target.tagName ? String(target.tagName).toLowerCase() : ''
    if (tag === 'input' || tag === 'textarea' || tag === 'select' ||
      (target && target.isContentEditable === true)) return
    if (typeof event.preventDefault === 'function') event.preventDefault()
    backOneLevel()
  })
}
