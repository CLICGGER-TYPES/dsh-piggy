// 矿洞面板 3.0：每次重画按动作时间续接动画，旧动作不重新播放。
// 交互照任天堂的思路：点格子就敲；连挖时冒「连挖 ×N」；底下一个主按钮管下楼——缺镐时直接说缺哪把、点了去商店。
// 视觉是动森风木牌手账素材（用户 2026-10-11 定稿 c-v2）：图片在扩展自带的 assets/ 里（app.asset）。
// 没挖开的格子一律是同样的岩块，矿和化石挖开才看得到；够不着的格子调暗（用户同意程序调暗，不另画）。
;(function () {
  'use strict'
  var STYLE_ID = 'dsh-piggy-mine-style-3'
  var PICKS = ['wood', 'iron', 'steel', 'diamond', 'star']
  var lastAnimationId = null
  var lastAnimationAt = 0
  var bombing = false
  var drawer = null
  var CSS = [
    '.mn{display:grid;gap:8px;color:#5c3d22}',
    // 洞窟：背景图铺满，顶上木牌计分板，中间 6×8 格
    '.mn-window{position:relative;border-radius:18px;overflow:hidden;padding:62px 30px 16px;background:#5a4030 center/cover no-repeat;box-shadow:inset 0 0 0 2px rgba(60,36,14,.3)}',
    '.mn-board{position:absolute;left:5%;right:5%;top:8px;aspect-ratio:600/148;background:center/100% 100% no-repeat;z-index:3;display:flex;align-items:center;gap:6px;padding:0 9% 0 8%}',
    '.mn-badge{display:flex;align-items:center;gap:4px;min-width:0;padding:0;border:0;background:none;font:inherit;font-size:10px;font-weight:800;color:#5c3d22;cursor:pointer;white-space:nowrap}',
    '.mn-badge:disabled{cursor:default}.mn-badge b{color:#b8641e;font-weight:900}',
    '.mn-face{flex:none;width:20px;height:20px;object-fit:contain;font-size:14px;line-height:20px;text-align:center}',
    '.mn-depth{margin-left:auto;display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.mn-track{width:30px;height:4px;border-radius:4px;background:rgba(92,61,34,.2);overflow:hidden}.mn-track>i{display:block;height:100%;border-radius:4px;background:#d98b3a}',
    '.mn-combo{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);z-index:3;padding:2px 10px;border-radius:999px;font-size:10.5px;font-weight:900;color:#fff;background:rgba(217,120,50,.94);animation:mn-pulse .6s ease-out}',
    '.mn-grid{position:relative;z-index:2;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:3px}',
    '.mn-cell{position:relative;aspect-ratio:1;border:0;padding:0;font:inherit;font-size:13px;color:#fff4d7;display:grid;place-items:center;cursor:default;',
    'background:center/100% 100% no-repeat;transition:transform .15s cubic-bezier(.4,0,.2,1)}',
    '.mn-cell[data-reach="far"]{filter:brightness(.62) saturate(.8)}',
    '.mn-cell[data-dig="true"]{cursor:pointer;filter:drop-shadow(0 0 2px rgba(255,226,160,.95))}.mn-cell[data-dig="true"]:active{transform:scale(.94)}',
    '.mn-cell[data-bomb="true"]{filter:drop-shadow(0 0 3px #f08d5a)}',
    '.mn-thing{position:absolute;inset:14%;width:72%;height:72%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(40,24,8,.35))}',
    '.mn-pig{position:absolute;left:4%;bottom:6%;width:92%;height:92%;object-fit:contain;pointer-events:none;z-index:2;font-size:18px;line-height:1;display:grid;place-items:end center}',
    '.mn-remain{position:absolute;right:1px;top:1px;z-index:1;min-width:13px;height:13px;border-radius:50%;display:grid;place-items:center;background:#fff6dc;color:#5c3d22;font-size:8.5px;font-weight:900;box-shadow:0 0 0 1px #b48a5a}',
    '.mn-cell[data-animate="true"]{animation:mn-crack .45s ease-out both;animation-delay:var(--mn-elapsed)}',
    '.mn-pop{position:absolute;left:50%;top:-4px;z-index:5;transform:translateX(-50%);white-space:nowrap;pointer-events:none;font-size:11px;font-weight:900;color:#fff;',
    'background:#f0a04b;border-radius:999px;padding:1px 6px;animation:mn-up .9s ease-out both;animation-delay:var(--mn-elapsed)}',
    '.mn-tip{min-height:14px;font-size:10.5px;font-weight:700;color:#8a6a46;padding:0 2px}',
    // 底部木板：镐、炸弹、电梯，主按钮，背包
    '.mn-plank{display:flex;align-items:center;gap:6px;padding:10px 10px 11px;background:center/100% 100% no-repeat}',
    '.mn-slot{position:relative;flex:none;width:40px;height:40px;border:0;border-radius:50%;padding:7px;font:inherit;font-size:18px;cursor:pointer;background:center/100% 100% no-repeat;color:#5c3d22}',
    '.mn-slot img,.mn-bag img{width:100%;height:100%;object-fit:contain;pointer-events:none}',
    '.mn-slot[data-on="true"],.mn-slot[aria-expanded="true"],.mn-bag[aria-expanded="true"]{box-shadow:0 0 0 2.5px #e3a24f}',
    '.mn-n{position:absolute;right:-4px;bottom:-3px;min-width:16px;height:15px;padding:0 3px;border-radius:8px;display:grid;place-items:center;font-size:9px;font-weight:900;',
    'background:#fff6dc;border:1.5px solid #b48a5a;color:#5c3d22;font-variant-numeric:tabular-nums}',
    '.mn-main{flex:1;min-width:0;aspect-ratio:256/94;border:0;padding:0 6px;cursor:pointer;background:center/100% 100% no-repeat;font:inherit;font-size:11.5px;font-weight:900;color:#5c3d22;line-height:1.2}',
    '.mn-main:disabled{filter:saturate(.5) brightness(.95);cursor:default}',
    '.mn-bag{position:relative;flex:none;width:38px;height:38px;border:0;border-radius:10px;padding:2px;cursor:pointer;background:none}.mn-bag .mn-n{top:-5px;bottom:auto}',
    '.mn-main:active,.mn-slot:active,.mn-bag:active{transform:scale(.96)}',
    // 抽屉：纸面木框
    '.mn-drawer{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:9px;border-radius:14px;background:#fff8e3;border:3px solid #a8794a;box-shadow:inset 0 0 0 2px #f3e6c4}',
    '.mn-chip{display:inline-flex;align-items:center;gap:3px;border-radius:999px;background:#fffdf3;border:2px solid #e5d3ad;padding:2px 9px 2px 3px;font:inherit;font-size:10.5px;font-weight:800;color:inherit}',
    '.mn-chip img{width:20px;height:20px;object-fit:contain}button.mn-chip{cursor:pointer;padding-left:9px}.mn-chip[data-on="true"]{border-color:#e3a24f}',
    '.mn-drawer select{width:84px;padding:3px 6px;font-size:10px}',
    '.mn-muted{color:#8a6a46;font-size:10.5px;line-height:1.45}',
    '.mn-drawer .dp-mini{margin-left:auto;padding:4px 10px;font-size:10px}',
    '.mn-cell:focus-visible,.mn-slot:focus-visible,.mn-main:focus-visible,.mn-bag:focus-visible,.mn-badge:focus-visible{outline:3px solid #e3a24f;outline-offset:2px}',
    '@keyframes mn-crack{0%{transform:scale(.95);filter:brightness(.8)}40%{transform:scale(1.07);filter:brightness(1.15)}100%{transform:scale(1);filter:none}}',
    '@keyframes mn-up{0%{opacity:0;transform:translate(-50%,6px)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-22px)}}',
    '@keyframes mn-pulse{0%{transform:translateX(-50%) scale(1.2)}100%{transform:translateX(-50%) scale(1)}}',
    '@media (prefers-reduced-motion:reduce){.mn-cell,.mn-pop,.mn-combo,.mn-main,.mn-slot{animation:none!important;transition:none!important}.mn-pop{opacity:0}}',
  ].join('\n')

  function style() {
    if (document.getElementById(STYLE_ID)) return
    var node = document.createElement('style')
    node.id = STYLE_ID; node.textContent = CSS
    ;(document.head || document.body).appendChild(node)
  }

  function button(app, name, label, attrs, onClick) {
    var node = app.button(name, attrs, onClick)
    node.textContent = label
    return node
  }

  function goShop(app) { if (typeof app.openShop === 'function') app.openShop() }

  /** 扩展自带图片；老宿主没有 app.asset 时退回 emoji。 */
  function art(app, name) { return typeof app.asset === 'function' ? app.asset(name + '.webp') : '' }
  function bg(app, node, name) { var url = art(app, name); if (url) node.style.backgroundImage = 'url("' + url + '")' }
  function picture(app, className, url, fallback) {
    if (!url) return app.el('span', className, fallback || '')
    var node = app.el('img', className); node.src = url; node.alt = ''; return node
  }
  function img(app, className, name, fallback) { return picture(app, className, art(app, name), fallback) }
  function pigOf(app, className) { return picture(app, className, typeof app.pigArt === 'function' ? app.pigArt() : null, '🐖') }

  /** 木牌计分板：左边小矿工（没雇时是「雇小矿工」），右边第几层。有矿 / 歇了时点它收或叫它接着干。 */
  function renderBoard(app, d, win) {
    var board = app.el('div', 'mn-board')
    bg(app, board, 'ui-scoreboard')
    var helper = d.helper
    if (helper) {
      var badge
      if (!helper.hired) {
        badge = app.button('mn-badge', { 'data-mine-helper': 'hire' }, function () { app.send('hire', {}) })
        badge.appendChild(pigOf(app, 'mn-face'))
        badge.appendChild(app.el('span', null, '雇小矿工 3000'))
      } else {
        var ready = helper.stored > 0
        badge = app.button('mn-badge', { 'data-mine-helper': 'collect' }, function () { if (ready || helper.full) app.send('collect', {}) })
        badge.disabled = !ready && !helper.full
        badge.appendChild(pigOf(app, 'mn-face'))
        badge.appendChild(app.el('span', null, helper.full ? ready ? '矿车满了' : '矿工歇了' : '矿车 ' + helper.stored))
        if (ready || helper.full) badge.appendChild(app.el('b', null, ready ? '收一下' : '接着干'))
      }
      board.appendChild(badge)
    }
    var depth = app.el('span', 'mn-depth', '第 ' + d.layer + ' / ' + d.floors + ' 层')
    var track = app.el('span', 'mn-track')
    var fill = app.el('i')
    fill.style.width = Math.round(d.layer / d.floors * 100) + '%'
    track.appendChild(fill)
    depth.appendChild(track)
    board.appendChild(depth)
    win.appendChild(board)
  }

  /** 挖开的格子底下是什么图。 */
  function openTile(cell) { return cell.kind === 'entrance' ? 'tile-entrance' : cell.kind === 'ladder' ? 'tile-ladder' : 'tile-dirt' }
  function openThing(cell) { return cell.kind === 'ore' ? 'ore-' + cell.key : cell.kind === 'fossil' ? 'fossil-' + cell.key : cell.kind === 'chest' ? 'tile-chest-open' : null }

  function renderGrid(app, d, win) {
    var grid = app.el('div', 'mn-grid')
    var current = d.last && d.last.layer === d.layer ? d.last : null
    if (current && current.id !== lastAnimationId) { lastAnimationId = current.id; lastAnimationAt = current.at }
    var elapsed = current ? Math.max(0, Date.now() - lastAnimationAt) : 9999
    var animate = elapsed < 900
    // 猪站在最后挖开的那格（效果图 c-v2）；这一层还没挖就站在洞口中间。
    var stand = current && d.cells[current.index] && d.cells[current.index].open ? current.index : 2
    d.cells.forEach(function (cell) {
      var active = !cell.open && cell.adjacent
      var node = app.button('mn-cell', { 'data-mine-cell': String(cell.index), 'aria-label': cell.open ? '已挖开' : active ? '挖第 ' + (cell.index + 1) + ' 格' : '还挖不到' }, function () {
        if (!active) return
        if (bombing) { bombing = d.bombs > 1; app.send('bomb', { cell: cell.index }) } else app.send('dig', { cell: cell.index })
      })
      node.disabled = !active
      node.setAttribute('data-open', String(cell.open))
      node.setAttribute('data-kind', cell.open ? cell.kind : 'covered')
      node.setAttribute('data-reach', cell.open ? 'open' : active ? 'near' : 'far')
      node.setAttribute('data-dig', String(active))
      node.setAttribute('data-bomb', String(active && bombing))
      node.setAttribute('data-hits', String(!cell.open && cell.hits > 0))
      bg(app, node, cell.open ? openTile(cell) : cell.hits >= 2 ? 'tile-rock-crack2' : cell.hits === 1 ? 'tile-rock-crack1' : 'tile-rock')
      var here = animate && current.index === cell.index
      node.setAttribute('data-animate', String(!!here))
      if (here) node.style.setProperty('--mn-elapsed', '-' + elapsed + 'ms')
      var thing = cell.open ? openThing(cell) : null
      if (thing) node.appendChild(img(app, 'mn-thing', thing, cell.kind === 'chest' ? '🧰' : cell.emoji || ''))
      else if (cell.open && !art(app, 'tile-dirt')) node.textContent = cell.kind === 'entrance' ? '🌿' : cell.kind === 'ladder' ? '🪜' : ''
      if (!cell.open && cell.hits > 0) node.appendChild(app.el('span', 'mn-remain', String(cell.remaining)))
      if (cell.index === stand && !thing) node.appendChild(pigOf(app, 'mn-pig'))
      if (here && current.bonus > 0) {
        var pop = app.el('span', 'mn-pop', '+' + current.bonus)
        pop.style.setProperty('--mn-elapsed', '-' + elapsed + 'ms')
        node.appendChild(pop)
      }
      grid.appendChild(node)
    })
    win.appendChild(grid)
  }

  /** 口袋：镐（点了去商店换更好的）、炸弹（点了进入炸格子模式）、电梯（点开选从哪层下）。 */
  function renderPocket(app, d, plank) {
    var pick = app.button('mn-slot', { 'data-mine-pickaxe': String(d.pickaxe.level), 'aria-label': d.pickaxe.label + '，去商店换更好的', title: d.pickaxe.label }, function () { goShop(app) })
    bg(app, pick, 'ui-slot')
    pick.appendChild(img(app, null, 'pick-' + (PICKS[d.pickaxe.level - 1] || 'wood'), d.pickaxe.emoji))
    plank.appendChild(pick)
    var bomb = app.button('mn-slot', { 'data-mine-bomb': 'toggle', 'data-on': String(bombing), 'aria-label': '炸弹 ' + d.bombs + ' 个', title: '炸弹' }, function () {
      if (d.bombs < 1) { goShop(app); return }
      bombing = !bombing
      app.rerender()
    })
    bg(app, bomb, 'ui-slot')
    bomb.appendChild(img(app, null, 'tool-bomb', '💣'))
    bomb.appendChild(app.el('span', 'mn-n', String(d.bombs)))
    plank.appendChild(bomb)
    var lifts = d.checkpoints.filter(function (stop) { return stop.unlocked && stop.floor !== 1 })
    if (lifts.length > 0 || (d.helper && d.helper.hired)) {
      var lift = app.button('mn-slot', { 'data-mine-panel': 'lift', 'aria-expanded': String(drawer === 'lift'), 'aria-label': '电梯', title: '电梯' }, function () {
        drawer = drawer === 'lift' ? null : 'lift'
        app.rerender()
      })
      bg(app, lift, 'ui-slot')
      lift.appendChild(img(app, null, 'tool-lift', '🛗'))
      plank.appendChild(lift)
    }
  }

  /** 电梯抽屉：到过的电梯站、小矿工在哪层干活、从第 1 层再下一趟。 */
  function renderLift(app, d, box) {
    box.appendChild(app.el('span', 'mn-muted', '坐电梯到'))
    d.checkpoints.forEach(function (stop) {
      if (!stop.unlocked) return
      box.appendChild(button(app, 'mn-chip', '第 ' + stop.floor + ' 层', { 'data-mine-lift': String(stop.floor), 'data-on': String(stop.floor === d.layer) }, function () { drawer = null; app.send('newRun', { floor: stop.floor }) }))
    })
    var helper = d.helper
    if (helper && helper.hired && helper.stops.length > 1) {
      box.appendChild(app.el('span', 'mn-muted', '矿工在'))
      var floor = app.el('select', 'dp-input')
      floor.setAttribute('aria-label', '矿工电梯站')
      helper.stops.forEach(function (stop) {
        var option = app.el('option', null, '第 ' + stop + ' 层')
        option.value = String(stop); option.selected = stop === helper.floor
        floor.appendChild(option)
      })
      floor.addEventListener('change', function () { app.send('workerFloor', { floor: Number(floor.value) }) })
      box.appendChild(floor)
    }
  }

  /** 矿石袋抽屉：随时能卖，按钮上写能卖多少。 */
  function renderBag(app, d, box) {
    box.appendChild(app.el('span', 'mn-muted', '背包'))
    if (d.bag.length === 0) box.appendChild(app.el('span', 'mn-muted', '还没挖到矿。挖到一块，旁边多半还有。'))
    d.bag.forEach(function (ore) {
      var chip = app.el('span', 'mn-chip')
      chip.setAttribute('title', ore.label)
      chip.appendChild(img(app, null, 'ore-' + ore.key, ore.emoji))
      chip.appendChild(app.el('span', null, '×' + ore.count))
      box.appendChild(chip)
    })
    if (d.bagValue > 0) box.appendChild(button(app, 'dp-mini', '全卖 ' + (d.currency ? d.currency.emoji : '🪙') + ' ' + d.bagValue, { 'data-mine-op': 'sell' }, function () { app.send('sell', {}) }))
  }

  /** 主按钮：能下就下；缺镐就说缺哪把（点了去商店）；到底了再下一趟。右边是背包。 */
  function renderActions(app, d, plank) {
    var main
    if (d.canDescend) main = button(app, 'mn-main', '下到第 ' + (d.layer + 1) + ' 层', { 'data-mine-op': 'descend' }, function () { app.send('descend', {}) })
    else if (d.needPickaxe) main = button(app, 'mn-main', '🔒 要' + d.needPickaxe + '才挖得动下一层', { 'data-mine-op': 'need-pickaxe' }, function () { goShop(app) })
    else if (d.atBottom) main = button(app, 'mn-main', '再下一趟', { 'data-mine-op': 'newRun' }, function () { app.send('newRun', { floor: 1 }) })
    else { main = button(app, 'mn-main', '先找到梯子', { 'data-mine-op': 'find-ladder' }, function () {}); main.disabled = true }
    bg(app, main, 'ui-main')
    plank.appendChild(main)
    var count = d.bag.reduce(function (sum, ore) { return sum + ore.count }, 0)
    var bag = app.button('mn-bag', { 'data-mine-panel': 'bag', 'aria-expanded': String(drawer === 'bag'), 'aria-label': '背包', title: '背包' }, function () {
      drawer = drawer === 'bag' ? null : 'bag'
      app.rerender()
    })
    bag.appendChild(img(app, null, 'ui-bag', '🎒'))
    if (count > 0) bag.appendChild(app.el('span', 'mn-n', String(count)))
    plank.appendChild(bag)
  }

  function render(app) {
    style()
    var d = app.data
    if (!d || !Array.isArray(d.cells)) { app.content.appendChild(app.el('div', 'dp-empty', '矿洞还在准备……')); return }
    if (d.bombs < 1) bombing = false
    var root = app.el('div', 'mn')
    var win = app.el('div', 'mn-window')
    bg(app, win, 'bg')
    renderBoard(app, d, win)
    renderGrid(app, d, win)
    if (d.combo && d.combo.n >= 2) win.appendChild(app.el('span', 'mn-combo', '连挖 ×' + d.combo.n))
    root.appendChild(win)
    root.appendChild(app.el('div', 'mn-tip', bombing ? '点一个能挖的格子，把它周围 3×3 一起炸开；再点炸弹取消' : d.pickaxe.label + ' · 点亮边的石头就敲'))
    var plank = app.el('div', 'mn-plank')
    bg(app, plank, 'ui-plank')
    renderPocket(app, d, plank)
    renderActions(app, d, plank)
    root.appendChild(plank)
    if (drawer !== null) {
      var box = app.el('div', 'mn-drawer')
      if (drawer === 'bag') renderBag(app, d, box)
      else renderLift(app, d, box)
      if (d.needPickaxe && drawer === 'lift') box.appendChild(button(app, 'mn-chip', '从第 1 层再下一趟', { 'data-mine-op': 'newRun' }, function () { drawer = null; app.send('newRun', { floor: 1 }) }))
      root.appendChild(box)
    }
    app.content.appendChild(root)
  }

  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('mine', { render: render })
})()
