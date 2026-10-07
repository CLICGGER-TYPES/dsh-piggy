// @ts-check
/**
 * 图标栏与布局：钳制位置、贴边放下、图标的建立与高亮
 *
 * 只通过 ctx 读写外壳的状态与元素（getter/setter 转发），不直接碰全局。
 * @module dsh-piggy/client/layout
 */
import { DEV_TAB, PANEL_GAP, PANEL_MARGIN, PANEL_MAX_HEIGHT, PANEL_MIN_HEIGHT, PANEL_WIDTH, PIG_PADDING_X, SCENE_RESERVE, TABS } from './constants.js'
import { desktopRole, desktopShell } from './desktop-shell.js'
import { fitPanelWindow } from './desktop/panel-window.js'
import { enabledTabs } from './extensions.js'
import { button, el } from './dom.js'

export function createLayout(ctx) {
      function clampPig() {
        // 桌面版：猪在窗口里的位置是固定的（外壳设好的内边距），拖动改的是窗口位置。
        if (desktopShell() !== null) return
        var vw = window.innerWidth || 0
        var vh = window.innerHeight || 0
        if (vw <= 0 || vh <= 0) return
        // Bound by the pig, not by the scene. The scene widens to the panel when
        // open, and clamping against that would shove the pig sideways on any
        // window resize; the panel's own overflow is `fitPanel`'s problem.
        var pigRect = ctx.pig.getBoundingClientRect ? ctx.pig.getBoundingClientRect() : null
        var w = (pigRect ? pigRect.width || 0 : 0) + 2 * PIG_PADDING_X
        // Vertically reserve the OPEN scene, or a pig parked high up pushes its
        // own hud off the top of the window the moment the panel opens.
        var sceneRect = ctx.scene.getBoundingClientRect ? ctx.scene.getBoundingClientRect() : null
        var h = Math.max(sceneRect ? sceneRect.height || 0 : 0, SCENE_RESERVE)
        var right = Math.min(Math.max(4, ctx.userRight), Math.max(4, vw - w - 4))
        // Only the pig anchors vertically. Clamping by the open panel would move
        // the pig when the panel appears, which is the one thing the layout
        // exists to prevent — `fitPanel` shrinks the panel instead.
        var bottom = Math.min(Math.max(4, ctx.userBottom), Math.max(4, vh - h - 4))
        ctx.host.style.right = Math.round(right) + 'px'
        ctx.host.style.bottom = Math.round(bottom) + 'px'
      }

      function fitPanel() {
        if (!ctx.isOpen) return
        // 外壳 0.6.0 起面板有自己的窗口：窗口贴在猪哪边由主进程定，这里只按给的高度排版。
        if (desktopRole() === 'panel') { fitPanelWindow(ctx); return }
        // 猪窗口里没有面板：isOpen 只表示另一个窗口开着，这里什么都不排（排了会把气泡区挪到另一边、撑大猪窗口）
        if (desktopRole() === 'pet') return
        var shell = desktopShell()
        if (shell !== null) {
          if (ctx.host.getAttribute('data-panel-side-locked') === 'true') return
          // 桌面版：窗口就贴着猪，`innerWidth` 是窗口不是屏幕 —— 用外壳报来的屏幕几何
          // 决定面板朝哪边开。窗口会自己长到装下面板，所以不需要横向挪。
          var room = shell.room()
          if (room !== null) {
            var opensBelow = room.above < room.below
            // 桌面版面板最高 520（列表再长也在面板里滚）。窗口按这个最高值留位置
            // （见 apps/desktop/renderer/shell.js 的 PANEL_RESERVE），切换 App 时面板变矮变高
            // 只改可点区域、不改窗口大小 —— Windows 上透明窗口改一次大小会有一帧画在旧位置。
            var fixedHeight = function (space) {
              return Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, Math.round(space - PANEL_GAP - PANEL_MARGIN - 42))) + 'px'
            }
            ctx.host.setAttribute('data-panel-vertical', opensBelow ? 'below' : 'above')
            if (!opensBelow) {
              ctx.card.style.top = 'auto'
              ctx.card.style.bottom = 'calc(100% + ' + PANEL_GAP + 'px)'
              ctx.card.style.maxHeight = fixedHeight(room.above)
            } else {
              ctx.card.style.bottom = 'auto'
              ctx.card.style.top = 'calc(100% + ' + PANEL_GAP + 'px)'
              ctx.card.style.maxHeight = fixedHeight(room.below)
            }
            // 横向同理：猪靠屏幕右边就朝左开（默认），靠左边就改成朝右开。
            var width = Math.round(Math.min(PANEL_WIDTH, room.width - 2 * PANEL_MARGIN))
            var opensRight = typeof room.left === 'number' && typeof room.right === 'number'
              && room.left < width + PANEL_MARGIN && room.right > room.left
            // 面板朝哪边开，猪就待在场景的哪一端。老 CSS 是「场景一开就撑到面板那么宽，
            // 猪永远靠右」（[data-open] .dp-scene{width:...} + justify-content:flex-end），
            // 朝右开时猪已经贴在右端了，一展开就横移整个面板宽度。
            ctx.host.setAttribute('data-panel-side', opensRight ? 'right' : 'left')
            if (opensRight) {
              ctx.card.style.right = 'auto'
              ctx.card.style.left = '0px'
            } else {
              ctx.card.style.left = 'auto'
              ctx.card.style.right = '0px'
            }
            ctx.card.style.maxWidth = width + 'px'
            // HUD 贴着猪：朝右开时猪在场景左端，HUD 也从左边起。
            // 朝右开时猪在场景左端：名字框放到猪的右边，不然正好压在猪身上。
            ctx.hud.style.left = (opensRight
              ? Math.round((ctx.pig.offsetLeft || 0) + (ctx.pig.offsetWidth || 0) + 8)
              : 9) + 'px'
            ctx.host.setAttribute('data-panel-side-locked', 'true')
            return
          }
        }
        var vw = window.innerWidth || 0
        var vh = window.innerHeight || 0
        if (vw <= 0 || vh <= 0) return

        var rect = ctx.scene.getBoundingClientRect()
        var roomAbove = rect.top - PANEL_GAP - PANEL_MARGIN
        var roomBelow = vh - rect.bottom - PANEL_GAP - PANEL_MARGIN

        // Open on whichever side has space. Ties go above, which is where a
        // bottom-docked pig expects its menu — but a pig parked near the top
        // must flip, otherwise its own menu opens off the screen.
        // Exactly one of top/bottom may apply. Clearing with '' would fall back
        // to the stylesheet's `bottom`, leaving both set — and an absolutely
        // positioned box with both edges pinned collapses to zero height.
        if (roomAbove >= roomBelow) {
          ctx.card.style.top = 'auto'
          ctx.card.style.bottom = 'calc(100% + ' + PANEL_GAP + 'px)'
          ctx.card.style.maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, Math.round(roomAbove))) + 'px'
        } else {
          ctx.card.style.bottom = 'auto'
          ctx.card.style.top = 'calc(100% + ' + PANEL_GAP + 'px)'
          ctx.card.style.maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, Math.round(roomBelow))) + 'px'
        }

        // Horizontal: the panel is wider than the pig, so anchoring its right
        // edge to the pig can push it off the left of the window. A negative
        // `right` moves the panel without touching the wrapper's width, so the
        // pig stays exactly where it was put.
        var width = Math.min(PANEL_WIDTH, vw - 2 * PANEL_MARGIN)
        ctx.card.style.maxWidth = Math.round(width) + 'px'
        var shift = PANEL_MARGIN - (rect.right - width)
        ctx.card.style.right = shift > 0 ? -Math.round(shift) + 'px' : '0px'

        // The hud lives inside the scene, which runs past the left edge whenever
        // the panel above had to be shifted back into view. Line it up with the
        // panel's left edge so it stays visible too.
        var cardLeft = Math.max(rect.right - width, PANEL_MARGIN)
        ctx.hud.style.left = Math.max(9, Math.round(cardLeft - rect.left)) + 'px'
      }

      function visibleTabs() {
        const tabs = enabledTabs(ctx, TABS)
        return ctx.devMode ? tabs.concat([DEV_TAB]) : tabs
      }

      function paintBar() {
        while (ctx.bar.firstChild) ctx.bar.removeChild(ctx.bar.firstChild)
        var list = visibleTabs()
        for (var t = 0; t < list.length; t += 1) ctx.buildIcon(list[t])
        // The home screen has no icon of its own; only a vanished app (dev off) falls back.
        if (ctx.icons[ctx.tab] === undefined && ctx.tab !== 'home') ctx.tab = 'home'
        for (var k in ctx.icons) ctx.icons[k].setAttribute('data-active', k === ctx.tab ? 'true' : 'false')
      }

      function buildIcon(entry) {
        (function (entry) {
          var btn = button('dp-ico', { 'data-tab': entry.key }, function () {
            if (ctx.host.getAttribute('data-open') !== 'true') ctx.setOpen(true)
            ctx.select(entry.key)
          })
          btn.appendChild(el('span', 'dp-ico-e', entry.emoji))
          btn.appendChild(el('span', null, entry.label))
          ctx.icons[entry.key] = btn
          ctx.bar.appendChild(btn)
        })(entry)
      }

  function attachResize() {
    // The desktop shell resizes itself in response to the panel. Re-fitting
    // during that resize reads a transient pig position and can flip sides.
    // The drag-end path still calls fitPanel after the window has settled.
    function onResize() { clampPig(); if (desktopShell() === null) fitPanel() }
    window.addEventListener?.('resize', onResize)
    return function () { window.removeEventListener?.('resize', onResize) }
  }

  return { clampPig, fitPanel, visibleTabs, paintBar, buildIcon, attachResize }
}
