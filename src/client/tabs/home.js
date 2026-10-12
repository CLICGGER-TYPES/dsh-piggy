// @ts-check
/**
 * 主屏（B9，照动森手机）：打开面板先看到一格格 App 方块，点进去是那个页签，
 * 页签顶上「‹」回主屏。原来挂在底部图标上的提醒，改挂在方块左上角。
 * @module dsh-piggy/client/tabs/home
 */

import { button, el } from '../dom.js'
import { tile, tileGrid } from '../widgets.js'
import { appIcon } from '../icon-style.js'
import { extensionUpdateAvailable } from './extensions.js'

/** One colour per app, so the home screen reads at a glance. */
var APP_COLOR = {
  status: 'green', card: 'pink', dex: 'purple', skins: 'purple', study: 'yellow', work: 'orange',
  shop: 'red', travel: 'blue', bag: 'teal', pomodoro: 'red', fishing: 'blue', settings: 'peach', update: 'lime', quit: 'peach', dev: 'brown',
}

/** 新 App 统一排在设置之前，末尾顺序不依赖注册或拼接时机。 */
export function orderHomeApps(apps) {
  // 末尾固定：设置 → 调试（开发者模式）→ 退出。
  const rank = key => key === 'quit' ? 4 : key === 'dev' ? 3 : key === 'settings' ? 2 : key.startsWith('ext:') ? 1 : 0
  return apps.slice().sort((a, b) => rank(a.key) - rank(b.key))
}

/** The home screen: who the pig is, its money, and one tile per app. */
export function renderHome(ui, apps) {
  var p = ui.view.pig
  var head = el('div', 'dp-title')
  head.appendChild(el('b', null, p.name + ' Lv.' + p.level.level))
  head.appendChild(el('span', null, '🪙 ' + p.coins))
  ui.content.appendChild(head)
  const pages = Math.max(1, Math.ceil(apps.length / 9))
  ui.homePage = Math.max(0, Math.min(pages - 1, ui.homePage ?? 0))
  const clip = el('div', 'dp-home-clip')
  clip.setAttribute('data-home-swipe', 'true')
  const track = el('div', 'dp-home-track')
  const grids = []
  const dots = []
  for (let page = 0; page < pages; page += 1) {
    const grid = tileGrid()
    grid.className += ' dp-home-page'
    grid.setAttribute('data-home-page', String(page))
    for (const app of apps.slice(page * 9, page * 9 + 9)) {
      grid.appendChild(tile({
        emoji: app.emoji, icon: appIcon(app.key, app.emoji, 'dp-tile-e'), label: app.label, color: APP_COLOR[app.key] ?? 'blue',
        // 更新入口收进了设置：有新正式版时设置格子冒红点（G 批次）。
        tag: app.key === 'update' || app.key === 'settings' ? '' : alertFor(ui, app.key),
        badge: app.key === 'settings' ? (alertFor(ui, 'update') || (extensionUpdateAvailable(ui) ? '!' : '')) : '',
        data: { 'data-app': app.key },
        onPick: function () { ui.select(app.key) },
      }))
    }
    grids.push(grid)
    track.appendChild(grid)
  }
  clip.appendChild(track)
  ui.content.appendChild(clip)
  let dotRow = null
  if (pages > 1) {
    dotRow = el('div', 'dp-home-dots')
    for (let page = 0; page < pages; page += 1) {
      const dot = button('dp-home-dot', { 'data-home-dot': String(page), 'aria-label': '第 ' + (page + 1) + ' 页' }, function () { showPage(page) })
      dots.push(dot)
      dotRow.appendChild(dot)
    }
    ui.content.appendChild(dotRow)
  }
  function showPage(page) {
    const next = Math.max(0, Math.min(pages - 1, page))
    ui.homePage = next
    track.style.transform = 'translateX(-' + next * 100 + '%)'
    grids.forEach((grid, index) => { grid.setAttribute('data-active', String(index === next)); grid.setAttribute('aria-hidden', String(index !== next)); grid.inert = index !== next })
    dots.forEach((dot, index) => dot.setAttribute('aria-pressed', String(index === next)))
  }
  showPage(ui.homePage)
  // 翻页：左键（或手指）按住左右拖，页面跟着手走，松手超过 40px 就翻；拖过的这一下不算点开 App。
  let drag = null
  let swallowClick = false
  clip.addEventListener('pointerdown', event => {
    if (pages < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false }
  })
  clip.addEventListener('pointermove', event => {
    if (drag === null || event.pointerId !== drag.id) return
    const dx = event.clientX - drag.x
    if (!drag.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(event.clientY - drag.y)) return
      drag.moved = true
      clip.setPointerCapture?.(event.pointerId)
      track.style.transition = 'none'
    }
    const atEdge = (ui.homePage === 0 && dx > 0) || (ui.homePage === pages - 1 && dx < 0)
    track.style.transform = 'translateX(calc(-' + ui.homePage * 100 + '% + ' + (atEdge ? dx / 3 : dx) + 'px))'
  })
  function endDrag(event) {
    if (drag === null || event.pointerId !== drag.id) return
    const dx = event.clientX - drag.x
    const moved = drag.moved || Math.abs(dx) > 40 // 很快的一划可能没有 pointermove
    drag = null
    track.style.transition = ''
    if (!moved) return
    swallowClick = true
    setTimeout(() => { swallowClick = false }, 0)
    showPage(Math.abs(dx) > 40 ? ui.homePage + (dx < 0 ? 1 : -1) : ui.homePage)
  }
  clip.addEventListener('pointerup', endDrag)
  clip.addEventListener('pointercancel', event => { if (drag !== null) { drag.moved = true; endDrag(event) } })
  clip.addEventListener('click', event => { if (swallowClick) { event.stopPropagation(); event.preventDefault() } }, true)
  // 鼠标滚轮：往下/往右滚翻到下一页，往上/往左回上一页；一下滚轮只翻一页。
  let wheelLock = 0
  clip.addEventListener('wheel', event => {
    if (pages < 2) return
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (Math.abs(delta) < 4) return
    const next = ui.homePage + (delta > 0 ? 1 : -1)
    if (next < 0 || next >= pages) return
    event.preventDefault()
    const now = Date.now()
    if (now < wheelLock) return
    wheelLock = now + 450
    showPage(next)
  }, { passive: false })
  // 版本号（C1）：一行小灰字，不占格子；3 秒内连点 7 次解锁调试模式。
  var version = el('div', 'dp-version', 'v' + (ui.view.version === '' ? '未知' : ui.view.version))
  version.setAttribute('data-version', 'true')
  version.addEventListener('click', function (event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
    ui.tapVersion()
  })
  ui.content.appendChild(version)
}

/**
 * The little word on an app's corner: what needs looking at in there. The
 * status app speaks for the pig itself (gone, ill, out); the others reuse the
 * alerts the panel already works out for the hidden icon bar.
 */
function alertFor(ui, key) {
  if (key === 'update') return ui.updateNotice?.unread ? '!' : ''
  var p = ui.view.pig
  if (key === 'status') {
    if (ui.view.dead) return '走了'
    if (p.illness !== null) return '生病'
    if (ui.view.activity !== null) return '在外面'
    return ''
  }
  var icon = ui.icons[key]
  return icon !== undefined && icon.getAttribute('data-alert') === 'true' ? '!' : ''
}

/**
 * An app's top row: 「‹」 back to the home screen, the app's name, and one grey
 * line on the right (the shop's money, say).
 */
export function appHeader(ui, app, info) {
  var row = el('div', 'dp-drill dp-app-head')
  var back = el('button', 'dp-drill-back')
  back.setAttribute('data-home', 'true')
  back.textContent = '‹'
  back.addEventListener('click', function (event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
    ui.select(app.key === 'extensions' ? 'settings' : 'home')
  })
  row.appendChild(back)
  var title = el('b', 'dp-drill-title dp-app-title')
  title.appendChild(appIcon(app.key, app.emoji, 'dp-app-title-icon'))
  title.appendChild(el('span', null, app.label))
  row.appendChild(title)
  if (info) row.appendChild(el('span', 'dp-drill-info', info))
  ui.content.appendChild(row)
}
