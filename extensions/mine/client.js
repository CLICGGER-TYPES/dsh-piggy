// 矿洞面板 2.0：每次重画按动作时间续接动画，旧动作不重新播放。
// 交互照任天堂的思路：点格子就敲；连挖时顶上冒「连挖 ×N」；下不去时直接说缺哪把镐、点了去商店；
// 视觉沿用项目的动森风格（--ac-* 变量、圆角卡片、土色矿格）。
;(function () {
  'use strict'
  var STYLE_ID = 'dsh-piggy-mine-style'
  var lastAnimationId = null
  var lastAnimationAt = 0
  var bombing = false
  var CSS = [
    '.mn{display:grid;gap:9px;color:var(--ac-text,#794f27)}',
    '.mn-top{display:flex;align-items:center;flex-wrap:wrap;gap:6px}',
    '.mn-top select{width:78px;flex:none;padding:3px 6px;font-size:10px}',
    '.mn-chip{display:inline-flex;align-items:center;gap:3px;border-radius:999px;background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6);padding:3px 9px;font-size:10.5px;font-weight:800}',
    '.mn-chip.mn-floor{font-size:12px}',
    '.mn-combo{background:#fff1c9;border-color:#f0c35a;animation:mn-pulse .6s ease-out}',
    '.mn-chip[data-on="true"]{background:#ffe4d6;border-color:#f08d5a}',
    'button.mn-chip{font:inherit;font-size:10.5px;font-weight:800;color:inherit;cursor:pointer}',
    '.mn-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:3px;padding:7px;border-radius:16px;background:#8a6a4a;border:2px solid #74563a}',
    '.mn-cell{position:relative;aspect-ratio:1;border:0;border-radius:8px;background:#d9ac79;color:#5d432d;display:grid;place-items:center;padding:0;overflow:visible;font:inherit;font-size:19px;cursor:default;box-shadow:inset 0 -3px 0 rgba(93,67,45,.25)}',
    '.mn-cell[data-cover="rock"]{background:#bfa184}.mn-cell[data-cover="deep"]{background:#a98a6c}',
    '.mn-cell[data-open="true"]{background:#5d432d;box-shadow:inset 0 3px 7px rgba(30,18,8,.45);color:#fff4d7}',
    '.mn-cell[data-kind="entrance"]{background:#e8f3d0;box-shadow:none}',
    '.mn-cell[data-dig="true"]{cursor:pointer;outline:2px solid rgba(120,203,187,.85);outline-offset:-2px}',
    '.mn-cell[data-dig="true"]:hover{filter:brightness(1.08)}',
    '.mn-cell[data-bomb="true"]{outline-color:#f08d5a}',
    '.mn-cell[data-hits="true"]:after{content:"╳";position:absolute;inset:0;display:grid;place-items:center;color:#76533e;font-size:19px;opacity:.6;pointer-events:none}',
    '.mn-remain{position:absolute;right:2px;bottom:1px;z-index:1;border-radius:4px;padding:0 3px;background:#fff7e5;color:#624226;font-size:10px;font-weight:900;line-height:1.35}',
    '.mn-cell[data-animate="true"]{animation:mn-crack .45s ease-out both;animation-delay:var(--mn-elapsed)}',
    '.mn-pop{position:absolute;left:50%;top:-4px;z-index:5;transform:translateX(-50%);white-space:nowrap;pointer-events:none;font-size:11px;font-weight:900;color:#fff;',
    'background:#f0a04b;border-radius:999px;padding:1px 6px;animation:mn-up .9s ease-out both;animation-delay:var(--mn-elapsed)}',
    '.mn-bag{display:flex;align-items:center;flex-wrap:wrap;gap:5px;padding:8px 10px;border-radius:16px;background:var(--ac-bg-content,#f7f3df);border:2px solid var(--ac-border-light,#e5dcc6)}',
    '.mn-bag-title{font-size:11px;font-weight:800;margin-right:2px}.mn-bag .dp-mini{margin-left:auto}',
    '.mn-muted{color:var(--ac-text-2,#9f927d);font-size:10.5px;line-height:1.45}',
    '.mn-actions{display:flex;flex-wrap:wrap;gap:6px}',
    '.mn-actions .dp-btn{flex:1;min-width:110px}',
    '@keyframes mn-crack{0%{transform:scale(.95);filter:brightness(.8)}40%{transform:scale(1.09);filter:brightness(1.2)}100%{transform:scale(1);filter:none}}',
    '@keyframes mn-up{0%{opacity:0;transform:translate(-50%,6px)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-22px)}}',
    '@keyframes mn-pulse{0%{transform:scale(1.25)}100%{transform:scale(1)}}',
    '@media (prefers-reduced-motion:reduce){.mn-cell,.mn-pop,.mn-combo{animation:none!important}.mn-pop{opacity:0}}',
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

  function renderHelper(app, d, root) {
    var helper = d.helper
    if (!helper) return
    var row = app.el('div', 'mn-top')
    if (!helper.hired) {
      row.appendChild(button(app, 'dp-mini', '雇小矿工猪 3000 ⛏️', { 'data-mine-helper': 'hire' }, function () { app.send('hire', {}) }))
    } else {
      row.appendChild(app.el('span', 'mn-muted', '⛏️ ' + (helper.full ? '仓满' : '干活中') + ' · ' + helper.usedHours.toFixed(1) + '/6时'))
      var floor = app.el('select', 'dp-input')
      floor.setAttribute('aria-label', '矿工电梯站')
      helper.stops.forEach(function (stop) {
        var option = app.el('option', null, '第 ' + stop + ' 层')
        option.value = String(stop); option.selected = stop === helper.floor
        floor.appendChild(option)
      })
      floor.addEventListener('change', function () { app.send('workerFloor', { floor: Number(floor.value) }) })
      row.appendChild(floor)
      var collect = button(app, 'dp-mini', '收一下', { 'data-mine-helper': 'collect' }, function () { app.send('collect', {}) })
      collect.disabled = helper.stored === 0 && helper.usedHours === 0
      row.appendChild(collect)
    }
    root.appendChild(row)
  }

  /** 顶上一行：第几层、镐、炸弹（点了进入炸格子模式）、连挖。 */
  function renderTop(app, d, root) {
    var top = app.el('div', 'mn-top')
    top.appendChild(app.el('span', 'mn-chip mn-floor', '🕳️ 第 ' + d.layer + ' / ' + d.floors + ' 层'))
    top.appendChild(button(app, 'mn-chip', d.pickaxe.emoji + ' ' + d.pickaxe.label, { 'data-mine-pickaxe': String(d.pickaxe.level) }, function () { goShop(app) }))
    var bomb = button(app, 'mn-chip', '💣 ×' + d.bombs, { 'data-mine-bomb': 'toggle', 'data-on': String(bombing) }, function () {
      if (d.bombs < 1) { goShop(app); return }
      bombing = !bombing
      app.rerender()
    })
    top.appendChild(bomb)
    if (d.combo && d.combo.n >= 2) top.appendChild(app.el('span', 'mn-chip mn-combo', '🔥 连挖 ×' + d.combo.n))
    root.appendChild(top)
    if (bombing) root.appendChild(app.el('div', 'mn-muted', '点一个能挖的格子，把它周围 3×3 一起炸开。再点一下 💣 取消。'))
  }

  function renderGrid(app, d, root) {
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
    root.appendChild(grid)
  }

  /** 矿石袋：随时能卖，按钮上写能卖多少。 */
  function renderBag(app, d, root) {
    var bag = app.el('div', 'mn-bag')
    bag.appendChild(app.el('span', 'mn-bag-title', '🎒'))
    if (d.bag.length === 0) bag.appendChild(app.el('span', 'mn-muted', '还没挖到矿。挖到一块，旁边多半还有。'))
    d.bag.forEach(function (ore) { bag.appendChild(app.el('span', 'mn-chip', ore.emoji + ' ×' + ore.count)) })
    if (d.bagValue > 0) bag.appendChild(button(app, 'dp-mini', '全卖 ' + (d.currency ? d.currency.emoji : '🪙') + ' ' + d.bagValue, { 'data-mine-op': 'sell' }, function () { app.send('sell', {}) }))
    root.appendChild(bag)
  }

  /** 底下：下一层 / 缺镐提示 / 电梯 / 再下一趟。 */
  function renderActions(app, d, root) {
    var actions = app.el('div', 'mn-actions')
    if (d.canDescend) actions.appendChild(button(app, 'dp-btn', '↓ 下到第 ' + (d.layer + 1) + ' 层', { 'data-mine-op': 'descend' }, function () { app.send('descend', {}) }))
    else if (d.needPickaxe) actions.appendChild(button(app, 'dp-btn', '🔒 要' + d.needPickaxe + '才挖得动下一层', { 'data-mine-op': 'need-pickaxe' }, function () { goShop(app) }))
    if (d.atBottom || d.needPickaxe) actions.appendChild(button(app, 'dp-btn', '🔄 再下一趟', { 'data-mine-op': 'newRun' }, function () { app.send('newRun', { floor: 1 }) }))
    root.appendChild(actions)
    var lifts = d.checkpoints.filter(function (stop) { return stop.unlocked && stop.floor !== 1 })
    if (lifts.length > 0) {
      var row = app.el('div', 'mn-top')
      row.appendChild(app.el('span', 'mn-muted', '🛗 电梯'))
      d.checkpoints.forEach(function (stop) {
        if (!stop.unlocked) return
        row.appendChild(button(app, 'mn-chip', '第 ' + stop.floor + ' 层', { 'data-mine-lift': String(stop.floor), 'data-on': String(stop.floor === d.layer) }, function () { app.send('newRun', { floor: stop.floor }) }))
      })
      root.appendChild(row)
    }
  }

  function render(app) {
    style()
    var d = app.data
    if (!d || !Array.isArray(d.cells)) { app.content.appendChild(app.el('div', 'dp-empty', '矿洞还在准备……')); return }
    if (d.bombs < 1) bombing = false
    var root = app.el('div', 'mn')
    renderHelper(app, d, root)
    renderTop(app, d, root)
    renderGrid(app, d, root)
    renderBag(app, d, root)
    renderActions(app, d, root)
    app.content.appendChild(root)
  }

  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('mine', { render: render })
})()
