// @ts-check
/**
 * 页签共用的小组件：属性条、道具选择器、效果行。
 *
 * 只负责画，不决定业务规则。
 * @module dsh-piggy/client/widgets
 */

import { button, el, meter } from './dom.js'
import { num } from './values.js'

export function labelledBar(ui, label, value, valueText, variant) {
  var row = el('div', 'dp-row')
  row.appendChild(el('span', null, label))
  row.appendChild(el('b', null, valueText))
  ui.content.appendChild(row)
  ui.content.appendChild(meter(value, variant))
}

/**
 * 猪现在怎么样：饱食 / 心情 / 清洁 / 健康四个小条 + 体重，两列排开。
 * 背包顶上用（G 批次：照料改成在背包里用东西，用之前得看得到状态）。
 */
export function statStrip(ui) {
  var p = ui.view.pig
  if (p === null) return
  var strip = el('div', 'dp-statstrip')
  var cells = [
    ['🍚 饱食', p.satiety, p.satiety + '%', ''],
    ['❤️ 心情', p.happiness, p.happiness + '%', 'dp-mood'],
    ['🫧 清洁', p.cleanliness, p.cleanliness + '%', 'dp-clean'],
    ['💚 健康', p.healthPercent, p.health + '/' + ui.view.maxHealth, 'dp-health'],
  ]
  for (var i = 0; i < cells.length; i += 1) {
    var cell = el('div', 'dp-statcell')
    var head = el('div', 'dp-row')
    head.appendChild(el('span', null, cells[i][0]))
    head.appendChild(el('b', null, cells[i][2]))
    cell.appendChild(head)
    cell.appendChild(meter(cells[i][1], cells[i][3]))
    strip.appendChild(cell)
  }
  strip.appendChild(el('div', 'dp-statweight', '⚖️ 体重 ' + p.weight))
  ui.content.appendChild(strip)
}

export function pickerPanel(ui, action) {
  var wrap = el('div', 'dp-pick')
  var asks = { feed: '喂点什么？', bathe: '用哪个洗澡？', play: '拿哪个玩具？' }
  wrap.appendChild(el('div', 'dp-pick-head', asks[action] ?? '用哪个？'))
  var list = el('div', 'dp-list')
  var shelf = ui.view.care[action] ?? []
  for (var i = 0; i < shelf.length; i += 1) {
    (function (item) {
      var row = el('div', 'dp-item')
      row.appendChild(el('span', null, item.emoji))
      var grow = el('div', 'dp-grow')
      grow.appendChild(el('div', null, item.label + (item.default ? '（自带）' : ' ×' + num(item.count, 0))))
      grow.appendChild(el('div', 'dp-dim', careEffectLine(action, item)))
      row.appendChild(grow)
      var use = button('dp-mini', { 'data-care': action + ':' + item.key }, function () {
        ui.picker = null
        ui.send(action, { item: item.key })
      })
      use.textContent = '用'
      row.appendChild(use)
      list.appendChild(row)
    })(shelf[i])
  }
  wrap.appendChild(list)
  var cancel = button('dp-cancel', {}, function () { ui.picker = null; ui.renderContent() })
  cancel.textContent = '算了'
  wrap.appendChild(cancel)
  return wrap
}

export function careEffectLine(action, item) {
  var parts = []
  if (action === 'feed') {
    parts.push('饱食 +' + item.satiety)
    if (item.happiness) parts.push('心情 +' + item.happiness)
  } else if (action === 'bathe') {
    parts.push('清洁 +' + item.cleanliness)
    if (item.happiness) parts.push('心情 +' + item.happiness)
  } else {
    parts.push('心情 +' + item.happiness)
    if (item.satiety) parts.push('饱食 ' + item.satiety)
  }
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// 方块（动森手机那种）：学习 / 商店 / 背包的两层都用它（B8，用户 2026-10-01）。
// 第一层是彩色大方块；点进去整屏换成第二层，左上角「‹ 返回」。
// ---------------------------------------------------------------------------

/** The grid tiles sit in: always three columns. */
export function tileGrid() {
  return el('div', 'dp-tiles')
}

/**
 * 九宫格放不下时按主屏那样分页：每页 9 个，底部小圆点 + 左右拖 / 滚轮切换。
 * 同一个 key 的页码记在 ui.pagerPage 上，轮询重画后还停在原页。
 * @param {any} ui
 * @param {string} key
 * @param {HTMLElement[]} tiles
 */
export function pagedTiles(ui, key, tiles) {
  var size = 9
  var pages = Math.max(1, Math.ceil(tiles.length / size))
  if (!ui.pagerPage) ui.pagerPage = Object.create(null)
  var active = Math.max(0, Math.min(pages - 1, ui.pagerPage[key] ?? 0))
  var clip = el('div', 'dp-home-clip')
  var track = el('div', 'dp-home-track')
  var grids = []
  var dots = []
  for (var page = 0; page < pages; page += 1) {
    var grid = tileGrid()
    grid.className += ' dp-pager-page'
    grid.setAttribute('data-pager-page', String(page))
    var slice = tiles.slice(page * size, page * size + size)
    for (var i = 0; i < slice.length; i += 1) grid.appendChild(slice[i])
    grids.push(grid)
    track.appendChild(grid)
  }
  clip.appendChild(track)
  var dotRow = null
  if (pages > 1) {
    dotRow = el('div', 'dp-home-dots')
    for (var p = 0; p < pages; p += 1) {
      (function (index) {
        var dot = button('dp-home-dot', { 'data-pager-dot': key + ':' + index, 'aria-label': '第 ' + (index + 1) + ' 页' }, function () { showPage(index) })
        dots.push(dot)
        dotRow.appendChild(dot)
      })(p)
    }
  }
  function showPage(next) {
    active = Math.max(0, Math.min(pages - 1, next))
    ui.pagerPage[key] = active
    track.style.transform = 'translateX(-' + active * 100 + '%)'
    grids.forEach(function (grid, index) {
      grid.setAttribute('data-active', String(index === active))
      grid.setAttribute('aria-hidden', String(index !== active))
      grid.inert = index !== active
    })
    dots.forEach(function (dot, index) { dot.setAttribute('aria-pressed', String(index === active)) })
  }
  showPage(active)
  var drag = null
  var swallowClick = false
  clip.addEventListener('pointerdown', function (event) {
    if (pages < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false }
  })
  clip.addEventListener('pointermove', function (event) {
    if (drag === null || event.pointerId !== drag.id) return
    var dx = event.clientX - drag.x
    if (!drag.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(event.clientY - drag.y)) return
      drag.moved = true
      clip.setPointerCapture?.(event.pointerId)
      track.style.transition = 'none'
    }
    var atEdge = (active === 0 && dx > 0) || (active === pages - 1 && dx < 0)
    track.style.transform = 'translateX(calc(-' + active * 100 + '% + ' + (atEdge ? dx / 3 : dx) + 'px))'
  })
  function endDrag(event) {
    if (drag === null || event.pointerId !== drag.id) return
    var dx = event.clientX - drag.x
    var moved = drag.moved || Math.abs(dx) > 40
    drag = null
    track.style.transition = ''
    if (!moved) return
    swallowClick = true
    setTimeout(function () { swallowClick = false }, 0)
    showPage(Math.abs(dx) > 40 ? active + (dx < 0 ? 1 : -1) : active)
  }
  clip.addEventListener('pointerup', endDrag)
  clip.addEventListener('pointercancel', function (event) { if (drag !== null) { drag.moved = true; endDrag(event) } })
  clip.addEventListener('click', function (event) { if (swallowClick) { event.stopPropagation(); event.preventDefault() } }, true)
  var wheelLock = 0
  clip.addEventListener('wheel', function (event) {
    if (pages < 2) return
    var delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (Math.abs(delta) < 4) return
    var next = active + (delta > 0 ? 1 : -1)
    if (next < 0 || next >= pages) return
    event.preventDefault()
    var now = Date.now()
    if (now < wheelLock) return
    wheelLock = now + 450
    showPage(next)
  }, { passive: false })
  var wrap = el('div', 'dp-pager')
  wrap.appendChild(clip)
  if (dotRow !== null) wrap.appendChild(dotRow)
  return wrap
}

/**
 * One tile: a coloured rounded square with a big emoji, one short line under
 * it, an optional second line, a count in the top-right corner and a small
 * tag in the top-left. `soft` is the paler second-layer look.
 * @param {{ emoji: string, icon?: HTMLElement, label: string, color: string, note?: string, badge?: string, tag?: string,
 *   soft?: boolean, locked?: boolean, dim?: boolean, disabled?: boolean, active?: boolean,
 *   data?: Record<string, string>, onPick: () => void }} spec
 */
export function tile(spec) {
  var node = button('dp-tile' + (spec.soft ? ' dp-tile-soft' : ''), spec.data ?? {}, function () { spec.onPick() })
  node.setAttribute('data-color', spec.color)
  if (spec.locked) node.setAttribute('data-locked', 'true')
  if (spec.dim) node.setAttribute('data-dim', 'true')
  if (spec.active) node.setAttribute('data-active', 'true')
  if (spec.disabled === true) node.disabled = true
  var icon = el('span', 'dp-tile-icon')
  icon.appendChild(spec.icon ?? el('span', 'dp-tile-e', spec.emoji))
  if (spec.badge) icon.appendChild(el('b', 'dp-tile-badge', spec.badge))
  if (spec.tag) icon.appendChild(el('b', 'dp-tile-tag', spec.tag))
  node.appendChild(icon)
  node.appendChild(el('span', 'dp-tile-n', spec.label))
  if (spec.note) node.appendChild(el('span', 'dp-tile-note', spec.note))
  return node
}

/**
 * Open a category (or go back with `key` null). The new layer starts at the
 * top: the old scroll offset belonged to a different screen.
 * @param {object} ui
 * @param {'study'|'shop'|'bag'|'work'|'dex'|'skins'} tab
 * @param {string|null} key
 */
export function drillTo(ui, tab, key) {
  ui.drill[tab] = key
  ui.drill.pick = null
  ui.renderContent()
  ui.content.scrollTop = 0
}

/**
 * The second layer's top row: 「‹」 back, the category's name, and one grey
 * line of what is true for everything in it (so no tile has to repeat it).
 */
export function drillHeader(ui, tab, title, info) {
  var row = el('div', 'dp-drill')
  // 从别的 App 跳进来的（状态页点喂食 → 背包食物），返回回到原来那个 App。
  var back = button('dp-drill-back', { 'data-back': tab }, function () {
    if (ui.drill.from) ui.select(ui.drill.from)
    else drillTo(ui, tab, null)
  })
  back.textContent = '‹'
  row.appendChild(back)
  row.appendChild(el('b', 'dp-drill-title', title))
  if (info) row.appendChild(el('span', 'dp-drill-info', info))
  ui.content.appendChild(row)
}
