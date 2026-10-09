// 菜园面板 2.0：地块和仓库只根据宿主快照绘制，手里拿的种子、展开的作物、动画留在本页。
// 交互照任天堂的思路：点地块就做「这块地现在该做的事」（空地种手里的种子、干了浇水、熟了收获），
// 一键工具一开始锁着、点了去商店买；视觉沿用项目的动森风格（--ac-* 变量、圆角卡片）。
;(function () {
  'use strict'
  var hand = null
  var fertilizing = false
  var openCrop = null
  var effects = {}
  var styleId = 'dsh-piggy-farm-style'
  var css = [
    '.fm{display:grid;gap:10px;color:var(--ac-text,#794f27)}',
    '.fm-hand{display:flex;align-items:center;gap:6px;overflow-x:auto;padding:2px 1px 4px;scrollbar-width:none}',
    '.fm-hand::-webkit-scrollbar{display:none}',
    '.fm-hand-label{flex:none;font-size:10.5px;font-weight:800;color:var(--ac-text-2,#9f927d)}',
    '.fm-seed{flex:none;display:inline-flex;align-items:center;gap:3px;padding:5px 10px;border-radius:999px;font:inherit;font-size:11px;font-weight:800;',
    'background:var(--ac-bg-input,#fffbe7);color:inherit;border:2px solid var(--ac-border-light,#e5dcc6);cursor:pointer}',
    '.fm-seed[aria-pressed="true"]{background:#e6f6dc;border-color:#8ccf7e;box-shadow:0 2px 0 #8ccf7e}',
    '.fm-seed.fm-buy{border-style:dashed}',
    '.fm-tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}',
    '.fm-tool{position:relative;display:grid;justify-items:center;gap:2px;padding:7px 2px 6px;border-radius:16px;font:inherit;cursor:pointer;',
    'background:var(--ac-bg-content,#f7f3df);color:inherit;border:2px solid var(--ac-border-light,#e5dcc6);box-shadow:0 3px 0 var(--ac-border-light,#e5dcc6)}',
    '.fm-tool:active{transform:translateY(2px);box-shadow:0 1px 0 var(--ac-border-light,#e5dcc6)}',
    '.fm-tool b{font-size:20px;line-height:1.1}.fm-tool span{font-size:10px;font-weight:800}',
    '.fm-tool[data-locked="true"]{opacity:.62}.fm-tool[data-on="true"]{background:#e6f6dc;border-color:#8ccf7e}',
    '.fm-tool i{position:absolute;top:-6px;right:-3px;min-width:16px;padding:0 4px;border-radius:999px;font-style:normal;font-size:9.5px;font-weight:800;',
    'line-height:16px;color:#fff;background:#f0a04b}',
    '.fm-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}',
    '.fm-plot{position:relative;overflow:hidden;min-height:92px;padding:8px 4px 7px;border-radius:16px;font:inherit;color:inherit;cursor:pointer;',
    'background:#efe4c8;border:2px solid #dccaa0;display:grid;justify-items:center;align-content:center;gap:3px;text-align:center}',
    '.fm-plot.fm-ripe{background:#f1fae9;border-color:#9fd7a9;animation:fm-bob 1.6s ease-in-out infinite}',
    '.fm-plot.fm-thirsty{border-color:#8fc3e8}.fm-plot.fm-locked{background:var(--ac-bg-content,#f7f3df);border-style:dashed;opacity:.8}',
    '.fm-emoji{font-size:28px;line-height:1.05}.fm-name{font-size:10px;font-weight:800}',
    '.fm-note{font-size:9.5px;color:var(--ac-text-2,#9f927d);min-height:12px;line-height:1.25}',
    '.fm-bar{width:78%;height:5px;border-radius:999px;background:rgba(121,79,39,.14);overflow:hidden}',
    '.fm-bar>span{display:block;height:100%;border-radius:inherit;background:#8ccf7e}',
    '.fm-badge{position:absolute;top:4px;right:5px;font-size:11px}.fm-badge-left{left:5px;right:auto}',
    '.fm-section{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;font-weight:800;margin:2px 2px -3px}',
    '.fm-section small{font-weight:700;color:var(--ac-text-2,#9f927d)}',
    '.fm-stock{display:flex;flex-wrap:wrap;gap:6px}',
    '.fm-crop{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:14px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;',
    'background:var(--ac-bg-content,#f7f3df);color:inherit;border:2px solid var(--ac-border-light,#e5dcc6)}',
    '.fm-crop[aria-expanded="true"]{border-color:#f0a04b}',
    '.fm-sellbar{width:100%;display:flex;flex-wrap:wrap;gap:6px;padding:7px 9px;border-radius:14px;background:var(--ac-bg-input,#fffbe7);',
    'border:2px solid var(--ac-border-light,#e5dcc6);font-size:10.5px}',
    '.fm .dp-mini{padding:4px 10px;font-size:10px}',
    '.fm-effect{position:absolute;inset:0;pointer-events:none;display:grid;place-items:center;font-size:26px;z-index:2}',
    '.fm-effect[data-kind="water"]{animation:fm-water .65s ease-out both}.fm-effect[data-kind="harvest"],.fm-effect[data-kind="plant"]{animation:fm-pop .65s ease-out both}',
    '@keyframes fm-water{0%{opacity:0;transform:translateY(-30px) scale(.7)}35%{opacity:1;transform:translateY(0) scale(1.15)}100%{opacity:0;transform:translateY(12px) scale(.7)}}',
    '@keyframes fm-pop{0%{opacity:0;transform:translateY(8px) scale(.6)}35%{opacity:1;transform:translateY(-10px) scale(1.25)}100%{opacity:0;transform:translateY(-30px) scale(.8)}}',
    '@keyframes fm-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}',
    '@media (prefers-reduced-motion:reduce){.fm-effect,.fm-plot.fm-ripe{animation:none!important}.fm-effect{opacity:0}}',
  ].join('')

  function ensureStyle() {
    if (document.getElementById(styleId)) return
    var style = document.createElement('style')
    style.id = styleId
    style.textContent = css
    document.head.appendChild(style)
  }

  function effect(index, kind) { effects[index] = { kind: kind, at: Date.now() } }
  function attachEffect(app, card, index) {
    var current = effects[index]
    if (!current) return
    var elapsed = Date.now() - current.at
    if (elapsed >= 650) { delete effects[index]; return }
    var icon = app.el('span', 'fm-effect', current.kind === 'water' ? '💧' : current.kind === 'plant' ? '🌱' : '✨')
    icon.setAttribute('data-kind', current.kind)
    icon.style.animationDelay = '-' + Math.max(0, elapsed) + 'ms'
    card.appendChild(icon)
  }

  function button(app, className, attrs, label, onClick) {
    var node = app.button(className, attrs, onClick)
    node.textContent = label
    return node
  }

  function shortTime(ms) {
    var minutes = Math.ceil(ms / 60000)
    if (minutes < 60) return minutes + ' 分钟'
    return Math.floor(minutes / 60) + ' 小时' + (minutes % 60 ? ' ' + minutes % 60 + ' 分' : '')
  }

  /** 去商店的种子 / 工具货架；老游戏没有 openShop 就提示怎么走。 */
  function goShop(app) {
    if (typeof app.openShop === 'function') app.openShop()
  }

  function renderHelper(app, data, root) {
    var helper = data.helper
    if (!helper) return
    var row = app.el('div', 'fm-stock')
    if (!helper.hired) {
      row.appendChild(button(app, 'dp-mini', { 'data-farm-helper': 'hire' }, '雇帮工猪 2500 🥬', function () { app.send('hire', {}) }))
    } else {
      var state = helper.full ? '谷仓满了' : helper.missing.length ? '没有' + helper.missing.join('、') + '种子了' : '帮工猪在干活'
      row.appendChild(app.el('span', 'fm-note', '🐷 ' + state + ' · 谷仓 ' + helper.usedHours.toFixed(1) + '/6时'))
      var collect = button(app, 'dp-mini', { 'data-farm-helper': 'collect' }, '收一下', function () { app.send('collect', {}) })
      collect.disabled = helper.stored === 0 && helper.usedHours === 0
      row.appendChild(collect)
      if (helper.missing.length) row.appendChild(button(app, 'dp-mini dp-mini-plain', { 'data-farm-helper': 'seed' }, '买种子', function () { goShop(app) }))
    }
    root.appendChild(row)
  }

  function toolOf(data, key) {
    return (data.tools || []).find(function (tool) { return tool.key === key }) || { owned: false, emoji: '', label: key }
  }

  /** 手里拿的种子：只列有的；手里那种用完了就自动换成下一种有的。 */
  function renderHand(app, data, root) {
    var owned = data.seeds.filter(function (seed) { return seed.count > 0 })
    if (hand !== null && !owned.some(function (seed) { return seed.key === hand })) hand = null
    if (hand === null && owned.length > 0) hand = owned[0].key
    var row = app.el('div', 'fm-hand')
    row.appendChild(app.el('span', 'fm-hand-label', '手里'))
    owned.forEach(function (seed) {
      var chip = button(app, 'fm-seed', { 'data-farm-seed': seed.key, 'aria-pressed': String(hand === seed.key) }, seed.emoji + ' ' + seed.label + ' ×' + seed.count, function () {
        hand = seed.key
        fertilizing = false
        app.rerender()
      })
      row.appendChild(chip)
    })
    row.appendChild(button(app, 'fm-seed fm-buy', { 'data-farm-shop': 'seed' }, owned.length === 0 ? '＋ 去买种子' : '＋ 买种子', function () { goShop(app) }))
    root.appendChild(row)
  }

  /** 四个一键工具：锁着的点了去商店买；角标是现在有几块地用得上。 */
  function renderTools(app, data, root) {
    var unlocked = data.plots.slice(0, data.unlocked)
    var thirsty = unlocked.filter(function (plot) { return plot && plot.thirsty }).length
    var ripe = unlocked.filter(function (plot) { return plot && plot.stage === 3 }).length
    var empty = unlocked.filter(function (plot) { return plot === null }).length
    var growing = unlocked.filter(function (plot) { return plot && plot.stage < 3 && !plot.fertilized }).length
    var specs = [
      { key: 'can', op: 'waterAll', label: '浇全部', count: thirsty },
      { key: 'sickle', op: 'harvestAll', label: '收全部', count: ripe },
      { key: 'planter', op: 'plantAll', label: '种满', count: hand === null ? 0 : empty },
      { key: 'fertilizer', op: null, label: fertilizing ? '点地施肥' : '施肥 ×' + data.fertilizer, count: data.fertilizer > 0 ? growing : 0 },
    ]
    var bar = app.el('div', 'fm-tools')
    specs.forEach(function (spec) {
      var tool = toolOf(data, spec.key)
      var locked = !tool.owned
      var node = button(app, 'fm-tool', { 'data-farm-tool': spec.key, 'data-locked': String(locked), 'data-on': String(spec.key === 'fertilizer' && fertilizing) }, '', function () {
        if (locked) { goShop(app); return }
        if (spec.key === 'fertilizer') { fertilizing = !fertilizing; app.rerender(); return }
        if (spec.key === 'planter') { if (hand !== null) app.send('plantAll', { item: hand }); return }
        app.send(spec.op, {})
      })
      node.appendChild(app.el('b', null, locked ? '🔒' : tool.emoji))
      node.appendChild(app.el('span', null, locked ? tool.label : spec.label))
      if (!locked && spec.count > 0) node.appendChild(app.el('i', null, String(spec.count)))
      bar.appendChild(node)
    })
    root.appendChild(bar)
  }

  /** 一块地：点它就做这块地现在该做的事。 */
  function renderPlot(app, data, grid, index) {
    var plot = data.plots[index]
    var locked = index >= data.unlocked
    var cls = 'fm-plot' + (locked ? ' fm-locked' : plot && plot.stage === 3 ? ' fm-ripe' : plot && plot.thirsty ? ' fm-thirsty' : '')
    var card = button(app, cls, { 'data-farm-plot': String(index) }, '', function () {
      if (locked) { if (index === data.unlocked) app.send('unlock', { plot: index }); return }
      if (plot === null) {
        if (hand === null) { goShop(app); return }
        effect(index, 'plant')
        app.send('plant', { plot: index, item: hand })
      } else if (fertilizing && plot.stage < 3 && !plot.fertilized) {
        fertilizing = data.fertilizer > 1
        app.send('fertilize', { plot: index })
      } else if (plot.stage === 3) {
        effect(index, 'harvest')
        app.send('harvest', { plot: index })
      } else if (plot.thirsty) {
        effect(index, 'water')
        app.send('water', { plot: index })
      }
    })
    if (locked) {
      card.appendChild(app.el('div', 'fm-emoji', index === data.unlocked ? '🪧' : '🔒'))
      card.appendChild(app.el('div', 'fm-note', index === data.unlocked ? data.currency.emoji + ' ' + data.prices[index] + ' 开垦' : '先开前一块'))
    } else if (plot === null) {
      card.appendChild(app.el('div', 'fm-emoji', '🟫'))
      var seed = data.seeds.find(function (entry) { return entry.key === hand })
      card.appendChild(app.el('div', 'fm-note', seed ? '点一下种' + seed.label : '空地'))
    } else {
      card.appendChild(app.el('div', 'fm-emoji', plot.emoji))
      card.appendChild(app.el('div', 'fm-name', plot.label))
      var bar = app.el('div', 'fm-bar')
      var fill = app.el('span')
      fill.style.width = Math.round(plot.progress * 100) + '%'
      bar.appendChild(fill)
      card.appendChild(bar)
      card.appendChild(app.el('div', 'fm-note', plot.stage === 3 ? '熟了，点一下收' : plot.thirsty ? '渴了，点一下浇' : '还要 ' + shortTime(plot.remainingMs)))
      if (plot.fertilized) card.appendChild(app.el('span', 'fm-badge fm-badge-left', '🧪'))
    }
    if (!locked && data.sprinklers && data.sprinklers[index]) card.appendChild(app.el('span', 'fm-badge', '💦'))
    attachEffect(app, card, index)
    grid.appendChild(card)
  }

  /** 仓库：一种作物一块，点开才出卖 / 放背包，平时很清爽。 */
  function renderStock(app, data, root) {
    var owned = data.harvest.filter(function (crop) { return crop.count > 0 })
    var head = app.el('div', 'fm-section')
    head.appendChild(app.el('span', null, '🧺 仓库'))
    var worth = owned.reduce(function (sum, crop) { return sum + crop.count * crop.sell }, 0)
    if (worth > 0) head.appendChild(app.el('small', null, '全部能卖 ' + data.currency.emoji + ' ' + worth))
    root.appendChild(head)
    var stock = app.el('div', 'fm-stock')
    if (owned.length === 0) stock.appendChild(app.el('div', 'fm-note', '还没有收成。熟了的地会轻轻晃，点一下就收。'))
    owned.forEach(function (crop) {
      var open = openCrop === crop.key
      stock.appendChild(button(app, 'fm-crop', { 'data-farm-crop': crop.key, 'aria-expanded': String(open) }, crop.emoji + ' ×' + crop.count, function () {
        openCrop = open ? null : crop.key
        app.rerender()
      }))
      if (!open) return
      var sell = app.el('div', 'fm-sellbar')
      sell.appendChild(app.el('span', 'fm-note', crop.label + ' · 一个卖 ' + crop.sell))
      sell.appendChild(button(app, 'dp-mini', { 'data-farm-sell': crop.key }, '卖一个', function () { app.send('sell', { item: crop.key }) }))
      if (crop.count > 1) sell.appendChild(button(app, 'dp-mini', { 'data-farm-sell-all': crop.key }, '全卖 ' + data.currency.emoji + ' ' + crop.count * crop.sell, function () { openCrop = null; app.send('sell', { item: crop.key, count: crop.count }) }))
      if (crop.food) sell.appendChild(button(app, 'dp-mini dp-mini-plain', { 'data-farm-store': crop.key }, '放进背包 · ' + crop.foodLabel, function () { app.send('store', { item: crop.key }) }))
      stock.appendChild(sell)
    })
    root.appendChild(stock)
  }

  function render(app) {
    ensureStyle()
    var data = app.data
    if (!data || !Array.isArray(data.plots)) { app.content.appendChild(app.el('div', 'dp-empty', '菜园还在准备……')); return }
    if (!data.currency) data.currency = { emoji: '🪙', label: '金币' }
    var root = app.el('div', 'fm')
    renderHelper(app, data, root)
    renderHand(app, data, root)
    renderTools(app, data, root)
    var grid = app.el('div', 'fm-grid')
    for (var index = 0; index < data.plots.length; index += 1) renderPlot(app, data, grid, index)
    root.appendChild(grid)
    renderStock(app, data, root)
    app.content.appendChild(root)
  }

  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('farm', { render: render })
})()
