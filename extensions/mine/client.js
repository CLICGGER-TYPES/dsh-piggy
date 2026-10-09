// 矿洞面板 2.1：每次重画按动作时间续接动画，旧动作不重新播放。
// 交互照任天堂的思路：点格子就敲；连挖时冒「连挖 ×N」；底下一个主按钮管下楼——缺镐时直接说缺哪把、点了去商店。
// 视觉是插画版第 3 稿（用户 2026-10-10 定）：矿格在一扇洞窟窗里，洞顶散下暖光、纸面颗粒；不放循环动画，只有敲下去的反馈。
;(function () {
  'use strict'
  var STYLE_ID = 'dsh-piggy-mine-style'
  var lastAnimationId = null
  var lastAnimationAt = 0
  var bombing = false
  var drawer = null
  // 洞窟底图：岩层渐变、两道岩脉、洞顶的暖光。
  var CAVE = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 268 300' preserveAspectRatio='none'>"
    + "<defs><linearGradient id='r' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#76624e'/><stop offset='1' stop-color='#433629'/></linearGradient>"
    + "<radialGradient id='l' cx='.5' cy='.06' r='.7'><stop offset='0' stop-color='#ffdf9a' stop-opacity='.5'/><stop offset='.55' stop-color='#ffdf9a' stop-opacity='.08'/><stop offset='1' stop-color='#ffdf9a' stop-opacity='0'/></radialGradient></defs>"
    + "<rect width='268' height='300' fill='url(#r)'/>"
    + "<path d='M0 70 C60 62 120 74 180 68 S240 64 268 68 V80 C200 86 140 78 80 84 S20 82 0 84Z' fill='#8a745d' opacity='.4'/>"
    + "<path d='M0 190 C70 182 150 194 268 186 V198 C180 206 90 198 0 204Z' fill='#5a4a3b' opacity='.55'/>"
    + "<rect width='268' height='300' fill='url(#l)'/>"
    + "<path d='M0 0 H268 V10 C240 16 214 6 190 12 S140 6 110 12 S60 4 34 12 S10 8 0 10Z' fill='#2f261f' opacity='.85'/></svg>"
  var GRAIN = "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/>"
    + "<feColorMatrix values='0 0 0 0 .35 0 0 0 0 .27 0 0 0 0 .18 0 0 0 .55 0'/></filter><rect width='160' height='160' filter='url(#n)'/></svg>"
  var svgUrl = function (svg) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")' }
  var CSS = [
    '.mn{display:grid;gap:10px;color:var(--ac-text,#794f27)}',
    '.mn-window{position:relative;border-radius:18px;overflow:hidden;padding:44px 30px 12px;background:' + svgUrl(CAVE) + ' center/100% 100% no-repeat;box-shadow:inset 0 0 0 2px rgba(121,79,39,.12)}',
    '.mn-window:after{content:"";position:absolute;inset:0;background-image:' + svgUrl(GRAIN) + ';opacity:.16;mix-blend-mode:multiply;pointer-events:none}',
    '.mn-pill{position:absolute;top:10px;z-index:3;display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font:inherit;font-size:10.5px;font-weight:800;',
    'color:#fff3d6;background:rgba(43,35,28,.64);border:1.5px solid rgba(255,236,196,.25);font-variant-numeric:tabular-nums}',
    '.mn-badge{left:10px;padding-left:4px;cursor:pointer;white-space:nowrap}.mn-badge:disabled{cursor:default}',
    '.mn-badge b{font-weight:900;color:#ffd77a}',
    '.mn-face{flex:none;width:24px;height:24px;border-radius:50%;background:#f6d7c3;display:grid;place-items:center;font-size:15px}',
    '.mn-depth{right:10px}',
    '.mn-track{width:40px;height:4px;border-radius:4px;background:rgba(255,236,196,.22);overflow:hidden}.mn-track>i{display:block;height:100%;border-radius:4px;background:#ffd77a}',
    '.mn-combo{left:50%;top:auto;bottom:10px;transform:translateX(-50%);background:rgba(240,160,75,.92);color:#fff;border-color:rgba(255,255,255,.4);animation:mn-pulse .6s ease-out}',
    '.mn-grid{position:relative;z-index:2;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}',
    '.mn-cell{position:relative;aspect-ratio:1;border:0;border-radius:9px;padding:0;font:inherit;font-size:14px;color:#fff4d7;display:grid;place-items:center;cursor:default;',
    'background:linear-gradient(150deg,#c7ab86,#a28663);box-shadow:inset 2px 2px 0 rgba(255,255,255,.22),inset -2px -3px 0 rgba(0,0,0,.2);transition:transform .15s cubic-bezier(.4,0,.2,1)}',
    '.mn-cell[data-cover="rock"]{background:linear-gradient(150deg,#b5a28a,#8e7b65)}.mn-cell[data-cover="deep"]{background:linear-gradient(150deg,#8f7f6e,#6c5d4f)}',
    '.mn-cell[data-open="true"]{background:rgba(28,20,14,.4);box-shadow:inset 0 3px 6px rgba(0,0,0,.42)}',
    '.mn-cell[data-kind="entrance"]{background:rgba(214,236,190,.75);box-shadow:none}',
    '.mn-cell[data-dig="true"]{cursor:pointer;box-shadow:inset 2px 2px 0 rgba(255,255,255,.3),inset -2px -3px 0 rgba(0,0,0,.2),0 0 0 1.5px rgba(255,236,196,.75)}',
    '.mn-cell[data-dig="true"]:active{transform:scale(.94)}',
    '.mn-cell[data-bomb="true"]{box-shadow:inset 2px 2px 0 rgba(255,255,255,.3),0 0 0 2px #f08d5a}',
    '.mn-cell[data-hits="true"]:after{content:"";position:absolute;inset:24%;border-top:2px solid rgba(255,245,220,.6);border-left:2px solid rgba(255,245,220,.6);transform:rotate(18deg);border-radius:2px;pointer-events:none}',
    '.mn-remain{position:absolute;right:2px;bottom:1px;z-index:1;border-radius:4px;padding:0 3px;background:rgba(255,247,229,.92);color:#624226;font-size:9.5px;font-weight:900;line-height:1.35}',
    '.mn-cell[data-animate="true"]{animation:mn-crack .45s ease-out both;animation-delay:var(--mn-elapsed)}',
    '.mn-pop{position:absolute;left:50%;top:-4px;z-index:5;transform:translateX(-50%);white-space:nowrap;pointer-events:none;font-size:11px;font-weight:900;color:#fff;',
    'background:#f0a04b;border-radius:999px;padding:1px 6px;animation:mn-up .9s ease-out both;animation-delay:var(--mn-elapsed)}',
    '.mn-pocket{display:flex;gap:8px;padding:1px 1px 3px}',
    '.mn-slot{position:relative;flex:none;width:44px;height:44px;border-radius:50%;padding:0;font:inherit;font-size:20px;cursor:pointer;display:grid;place-items:center;',
    'background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6);color:var(--ac-text,#794f27)}',
    '.mn-slot[data-on="true"],.mn-slot[aria-expanded="true"]{border-color:var(--ac-primary,#19c8b9);background:var(--ac-primary-bg,#e6f9f6)}',
    '.mn-n{position:absolute;right:-4px;bottom:-3px;min-width:18px;height:17px;padding:0 4px;border-radius:9px;display:grid;place-items:center;font-size:9.5px;font-weight:900;',
    'background:var(--ac-bg,#f8f8f0);border:1.5px solid var(--ac-border,#c4b89e);color:var(--ac-text,#794f27);font-variant-numeric:tabular-nums}',
    '.mn-tip{min-height:14px;font-size:10.5px;font-weight:700;color:var(--ac-text-muted,#8a7b66);padding:0 2px}',
    '.mn-acts{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}',
    '.mn .mn-main{width:100%;padding:11px 12px;font-size:12px}',
    '.mn-round{position:relative;width:42px;height:42px;border-radius:50%;padding:0;font:inherit;font-size:18px;cursor:pointer;display:grid;place-items:center;',
    'background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6)}',
    '.mn-round[aria-expanded="true"]{border-color:var(--ac-primary,#19c8b9);background:var(--ac-primary-bg,#e6f9f6)}',
    '.mn-round .mn-n{top:-4px;bottom:auto;right:-5px}',
    '.mn-drawer{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:9px;border-radius:16px;background:var(--ac-bg-content,#f7f3df);border:2px solid var(--ac-border-light,#e5dcc6)}',
    '.mn-chip{display:inline-flex;align-items:center;gap:3px;border-radius:999px;background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6);padding:3px 9px;font:inherit;font-size:10.5px;font-weight:800;color:inherit}',
    'button.mn-chip{cursor:pointer}.mn-chip[data-on="true"]{border-color:var(--ac-primary,#19c8b9);background:var(--ac-primary-bg,#e6f9f6)}',
    '.mn-drawer select{width:84px;padding:3px 6px;font-size:10px}',
    '.mn-muted{color:var(--ac-text-muted,#8a7b66);font-size:10.5px;line-height:1.45}',
    '.mn-drawer .dp-mini{margin-left:auto;padding:4px 10px;font-size:10px}',
    '.mn-cell:focus-visible,.mn-slot:focus-visible,.mn-round:focus-visible,.mn-badge:focus-visible{outline:3px solid var(--ac-primary,#19c8b9);outline-offset:2px}',
    '@keyframes mn-crack{0%{transform:scale(.95);filter:brightness(.8)}40%{transform:scale(1.07);filter:brightness(1.15)}100%{transform:scale(1);filter:none}}',
    '@keyframes mn-up{0%{opacity:0;transform:translate(-50%,6px)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-22px)}}',
    '@keyframes mn-pulse{0%{transform:translateX(-50%) scale(1.2)}100%{transform:translateX(-50%) scale(1)}}',
    '@media (prefers-reduced-motion:reduce){.mn-cell,.mn-pop,.mn-combo{animation:none!important;transition:none!important}.mn-pop{opacity:0}}',
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

  /** 窗左上角的小矿工牌：没雇时是「雇小矿工猪」；雇了显示矿车里有多少，有矿 / 歇了时点它收或叫它接着干。 */
  function renderBadge(app, d, win) {
    var helper = d.helper
    if (!helper) return
    var badge
    if (!helper.hired) {
      badge = app.button('mn-pill mn-badge', { 'data-mine-helper': 'hire' }, function () { app.send('hire', {}) })
      badge.appendChild(app.el('span', 'mn-face', '🐖'))
      badge.appendChild(app.el('span', null, '雇小矿工 3000'))
    } else {
      var ready = helper.stored > 0
      badge = app.button('mn-pill mn-badge', { 'data-mine-helper': 'collect' }, function () { if (ready || helper.full) app.send('collect', {}) })
      badge.disabled = !ready && !helper.full
      badge.appendChild(app.el('span', 'mn-face', '🐖'))
      badge.appendChild(app.el('span', null, helper.full ? ready ? '矿车满了' : '矿工歇了' : '矿车 ' + helper.stored))
      if (ready || helper.full) badge.appendChild(app.el('b', null, ready ? '收一下' : '接着干'))
    }
    win.appendChild(badge)
  }

  function renderGrid(app, d, win) {
    var grid = app.el('div', 'mn-grid')
    var current = d.last && d.last.layer === d.layer ? d.last : null
    if (current && current.id !== lastAnimationId) { lastAnimationId = current.id; lastAnimationAt = current.at }
    var elapsed = current ? Math.max(0, Date.now() - lastAnimationAt) : 9999
    var animate = elapsed < 900
    d.cells.forEach(function (cell) {
      var active = !cell.open && cell.adjacent
      var row = Math.floor(cell.index / 6)
      var node = app.button('mn-cell', { 'data-mine-cell': String(cell.index), 'aria-label': cell.open ? '已挖开' : active ? '挖第 ' + (cell.index + 1) + ' 格' : '还挖不到' }, function () {
        if (!active) return
        if (bombing) { bombing = d.bombs > 1; app.send('bomb', { cell: cell.index }) } else app.send('dig', { cell: cell.index })
      })
      node.disabled = !active
      node.setAttribute('data-open', String(cell.open))
      node.setAttribute('data-kind', cell.open ? cell.kind : 'covered')
      node.setAttribute('data-cover', row < 4 ? 'soil' : row < 6 ? 'rock' : 'deep')
      node.setAttribute('data-dig', String(active))
      node.setAttribute('data-bomb', String(active && bombing))
      node.setAttribute('data-hits', String(!cell.open && cell.hits > 0))
      var here = animate && current.index === cell.index
      node.setAttribute('data-animate', String(!!here))
      if (here) node.style.setProperty('--mn-elapsed', '-' + elapsed + 'ms')
      if (cell.open) node.textContent = cell.kind === 'entrance' ? '🌿' : cell.kind === 'ladder' ? '🪜' : cell.kind === 'chest' ? '🧰' : cell.emoji || ''
      if (!cell.open && cell.hits > 0) node.appendChild(app.el('span', 'mn-remain', String(cell.remaining)))
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
  function renderPocket(app, d, root) {
    var row = app.el('div', 'mn-pocket')
    var pick = button(app, 'mn-slot', d.pickaxe.emoji, { 'data-mine-pickaxe': String(d.pickaxe.level), 'aria-label': d.pickaxe.label + '，去商店换更好的' }, function () { goShop(app) })
    row.appendChild(pick)
    var bomb = button(app, 'mn-slot', '💣', { 'data-mine-bomb': 'toggle', 'data-on': String(bombing), 'aria-label': '炸弹 ' + d.bombs + ' 个' }, function () {
      if (d.bombs < 1) { goShop(app); return }
      bombing = !bombing
      app.rerender()
    })
    bomb.appendChild(app.el('span', 'mn-n', String(d.bombs)))
    row.appendChild(bomb)
    var lifts = d.checkpoints.filter(function (stop) { return stop.unlocked && stop.floor !== 1 })
    if (lifts.length > 0 || (d.helper && d.helper.hired)) {
      row.appendChild(button(app, 'mn-slot', '🛗', { 'data-mine-panel': 'lift', 'aria-expanded': String(drawer === 'lift'), 'aria-label': '电梯' }, function () {
        drawer = drawer === 'lift' ? null : 'lift'
        app.rerender()
      }))
    }
    root.appendChild(row)
  }

  /** 电梯抽屉：到过的电梯站、小矿工在哪层干活、从第 1 层再下一趟。 */
  function renderLift(app, d, box) {
    box.appendChild(app.el('span', 'mn-muted', '🛗 坐到'))
    d.checkpoints.forEach(function (stop) {
      if (!stop.unlocked) return
      box.appendChild(button(app, 'mn-chip', '第 ' + stop.floor + ' 层', { 'data-mine-lift': String(stop.floor), 'data-on': String(stop.floor === d.layer) }, function () { drawer = null; app.send('newRun', { floor: stop.floor }) }))
    })
    var helper = d.helper
    if (helper && helper.hired && helper.stops.length > 1) {
      box.appendChild(app.el('span', 'mn-muted', '🐖 矿工在'))
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
    box.appendChild(app.el('span', null, '🎒'))
    if (d.bag.length === 0) box.appendChild(app.el('span', 'mn-muted', '还没挖到矿。挖到一块，旁边多半还有。'))
    d.bag.forEach(function (ore) { box.appendChild(app.el('span', 'mn-chip', ore.emoji + ' ×' + ore.count)) })
    if (d.bagValue > 0) box.appendChild(button(app, 'dp-mini', '全卖 ' + (d.currency ? d.currency.emoji : '🪙') + ' ' + d.bagValue, { 'data-mine-op': 'sell' }, function () { app.send('sell', {}) }))
  }

  /** 主按钮：能下就下；缺镐就说缺哪把（点了去商店）；到底了再下一趟。右边是矿石袋。 */
  function renderActions(app, d, root) {
    var row = app.el('div', 'mn-acts')
    var main
    if (d.canDescend) main = button(app, 'dp-mini mn-main', '下到第 ' + (d.layer + 1) + ' 层', { 'data-mine-op': 'descend' }, function () { app.send('descend', {}) })
    else if (d.needPickaxe) main = button(app, 'dp-mini mn-main', '🔒 要' + d.needPickaxe + '才挖得动下一层', { 'data-mine-op': 'need-pickaxe' }, function () { goShop(app) })
    else if (d.atBottom) main = button(app, 'dp-mini mn-main', '再下一趟', { 'data-mine-op': 'newRun' }, function () { app.send('newRun', { floor: 1 }) })
    else { main = button(app, 'dp-mini mn-main', '先找到梯子 🪜', { 'data-mine-op': 'find-ladder' }, function () {}); main.disabled = true }
    row.appendChild(main)
    var count = d.bag.reduce(function (sum, ore) { return sum + ore.count }, 0)
    var bag = button(app, 'mn-round', '🎒', { 'data-mine-panel': 'bag', 'aria-expanded': String(drawer === 'bag'), 'aria-label': '矿石袋' }, function () {
      drawer = drawer === 'bag' ? null : 'bag'
      app.rerender()
    })
    if (count > 0) bag.appendChild(app.el('span', 'mn-n', String(count)))
    row.appendChild(bag)
    root.appendChild(row)
    if (drawer === null) return
    var box = app.el('div', 'mn-drawer')
    if (drawer === 'bag') renderBag(app, d, box)
    else renderLift(app, d, box)
    if (d.needPickaxe && drawer === 'lift') box.appendChild(button(app, 'mn-chip', '🔄 从第 1 层再下一趟', { 'data-mine-op': 'newRun' }, function () { drawer = null; app.send('newRun', { floor: 1 }) }))
    root.appendChild(box)
  }

  function render(app) {
    style()
    var d = app.data
    if (!d || !Array.isArray(d.cells)) { app.content.appendChild(app.el('div', 'dp-empty', '矿洞还在准备……')); return }
    if (d.bombs < 1) bombing = false
    var root = app.el('div', 'mn')
    var win = app.el('div', 'mn-window')
    renderBadge(app, d, win)
    var depth = app.el('span', 'mn-pill mn-depth', '第 ' + d.layer + ' / ' + d.floors + ' 层')
    var track = app.el('span', 'mn-track')
    var fill = app.el('i')
    fill.style.width = Math.round(d.layer / d.floors * 100) + '%'
    track.appendChild(fill)
    depth.appendChild(track)
    win.appendChild(depth)
    renderGrid(app, d, win)
    if (d.combo && d.combo.n >= 2) win.appendChild(app.el('span', 'mn-pill mn-combo', '🔥 连挖 ×' + d.combo.n))
    root.appendChild(win)
    renderPocket(app, d, root)
    root.appendChild(app.el('div', 'mn-tip', bombing ? '点一个能挖的格子，把它周围 3×3 一起炸开；再点 💣 取消' : d.pickaxe.label + ' · 点亮边的石头就敲'))
    renderActions(app, d, root)
    app.content.appendChild(root)
  }

  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('mine', { render: render })
})()
