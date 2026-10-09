// 菜园面板 2.1：地块和仓库只根据宿主快照绘制，手里拿的种子、展开的抽屉、动画留在本页。
// 交互照任天堂的思路：点地块就做「这块地现在该做的事」（空地种手里的种子、干了浇水、熟了收获）；
// 底下一个主按钮自动做最该做的事——有一键工具就一次做完，没有就做一块（工具在商店买，增量游戏的路子）。
// 视觉是插画版第 3 稿（用户 2026-10-10 定）：场景收进一扇窗、纸面颗粒、柔和配色；不放循环动画，只有按下去的反馈。
;(function () {
  'use strict'
  var hand = null
  var fertilizing = false
  var openCrop = null
  var drawer = null
  var tip = null
  var effects = {}
  var styleId = 'dsh-piggy-farm-style'
  // 场景背景（天、远山、树、篱笆、地面），画成一张 SVG 当窗的底图；田和地块是真按钮，叠在上面。
  var SCENE = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 268 206' preserveAspectRatio='none'>"
    + "<defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#cfe9ee'/><stop offset='.55' stop-color='#eef5e4'/></linearGradient>"
    + "<radialGradient id='u' cx='.82' cy='.1' r='.5'><stop offset='0' stop-color='#fff6d6' stop-opacity='.95'/><stop offset='1' stop-color='#fff6d6' stop-opacity='0'/></radialGradient>"
    + "<linearGradient id='h' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#b9d8a2'/><stop offset='1' stop-color='#a2c98a'/></linearGradient>"
    + "<linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#a6cf8c'/><stop offset='1' stop-color='#8fbf76'/></linearGradient>"
    + "<radialGradient id='t' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='#9ccb7f'/><stop offset='1' stop-color='#6fa75a'/></radialGradient></defs>"
    + "<rect width='268' height='206' fill='url(#s)'/><rect width='268' height='206' fill='url(#u)'/>"
    + "<path d='M0 54 C40 38 86 42 120 50 S206 38 268 46 V206 H0Z' fill='url(#h)'/>"
    + "<path d='M0 70 C60 58 120 64 170 70 S240 62 268 66 V206 H0Z' fill='url(#g)'/>"
    + "<ellipse cx='30' cy='60' rx='15' ry='13' fill='url(#t)'/><rect x='28' y='69' width='4' height='9' rx='2' fill='#8c6a48'/>"
    + "<ellipse cx='238' cy='56' rx='12' ry='11' fill='url(#t)'/><rect x='236' y='64' width='4' height='8' rx='2' fill='#8c6a48'/>"
    + "<g opacity='.55' stroke='#f3e5c5' stroke-width='2.4' stroke-linecap='round'><path d='M64 78 H206'/><path d='M64 84 H206'/></g>"
    + "<g fill='#f3e5c5' opacity='.7'><rect x='62' y='74' width='4' height='14' rx='2'/><rect x='110' y='74' width='4' height='14' rx='2'/><rect x='158' y='74' width='4' height='14' rx='2'/><rect x='204' y='74' width='4' height='14' rx='2'/></g>"
    + "<path d='M0 86 C80 80 190 80 268 86 V206 H0Z' fill='#cdb48a'/></svg>"
  // 一层很淡的纸面颗粒，让场景不像贴图。
  var GRAIN = "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/>"
    + "<feColorMatrix values='0 0 0 0 .35 0 0 0 0 .27 0 0 0 0 .18 0 0 0 .55 0'/></filter><rect width='160' height='160' filter='url(#n)'/></svg>"
  var svgUrl = function (svg) { return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")' }
  var css = [
    '.fm{display:grid;gap:10px;color:var(--ac-text,#794f27)}',
    // 场景窗
    '.fm-window{position:relative;border-radius:18px;overflow:hidden;padding:78px 12px 12px;background:' + svgUrl(SCENE) + ' center/100% 100% no-repeat;',
    'box-shadow:inset 0 0 0 2px rgba(121,79,39,.08)}',
    '.fm-window:after{content:"";position:absolute;inset:0;background-image:' + svgUrl(GRAIN) + ';opacity:.18;mix-blend-mode:multiply;pointer-events:none}',
    '.fm-badge{position:absolute;left:10px;top:10px;z-index:3;display:flex;align-items:center;gap:7px;padding:4px 10px 4px 4px;border-radius:999px;font:inherit;font-size:10.5px;font-weight:800;',
    'color:var(--ac-text,#794f27);background:rgba(255,251,231,.88);border:1.5px solid rgba(214,202,174,.9);cursor:pointer;max-width:calc(100% - 20px)}',
    '.fm-badge:disabled{cursor:default}',
    '.fm-face{flex:none;width:24px;height:24px;border-radius:50%;background:#fde3e3;display:grid;place-items:center;font-size:15px}',
    '.fm-meter{flex:none;width:34px;height:5px;border-radius:5px;background:rgba(121,79,39,.14);overflow:hidden}',
    '.fm-meter>i{display:block;height:100%;border-radius:5px;background:var(--ac-primary,#19c8b9)}',
    '.fm-badge b{font-weight:900;color:var(--ac-primary-active,#11a89b)}',
    // 木框田和地块
    '.fm-bed{position:relative;z-index:2;padding:9px;border-radius:16px;background:linear-gradient(#a98157,#8d6a46);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;',
    'box-shadow:inset 0 2px 0 rgba(255,255,255,.18),inset 0 -4px 0 rgba(0,0,0,.12),0 3px 0 rgba(84,60,34,.18)}',
    '.fm-plot{position:relative;aspect-ratio:1/.92;border:0;padding:0;border-radius:12px;font:inherit;color:#fff;cursor:pointer;display:grid;place-items:center;',
    'background:linear-gradient(#946c45,#7d5a38);box-shadow:inset 0 3px 5px rgba(0,0,0,.18),inset 0 -1px 0 rgba(255,255,255,.1);transition:transform .15s cubic-bezier(.4,0,.2,1)}',
    '.fm-plot:active{transform:scale(.96)}',
    '.fm-plot:before{content:"";position:absolute;left:18%;right:18%;top:34%;height:2px;border-radius:2px;background:rgba(50,30,12,.22);box-shadow:0 7px 0 rgba(50,30,12,.18)}',
    '.fm-plot[data-soil="wet"]{background:linear-gradient(#7d5a37,#644529)}.fm-plot[data-soil="dry"]{background:linear-gradient(#bf9a6c,#a8845a)}',
    '.fm-plot.fm-ripe{box-shadow:inset 0 3px 5px rgba(0,0,0,.18),0 0 0 2px rgba(255,244,196,.95),0 0 12px rgba(255,236,150,.55)}',
    '.fm-plot.fm-locked{background:repeating-linear-gradient(-45deg,rgba(160,196,138,.6) 0 5px,rgba(146,184,124,.6) 5px 10px);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35)}',
    '.fm-plot.fm-locked:before{display:none}',
    '.fm-crop{position:relative;line-height:1;filter:drop-shadow(0 2px 1px rgba(40,24,8,.3))}',
    '.fm-crop[data-seed="true"]{font-size:11px!important;opacity:.7}.fm-crop[data-size="1"]{font-size:14px}.fm-crop[data-size="2"]{font-size:18px}.fm-crop[data-size="3"]{font-size:23px}',
    '.fm-price{font-size:10px;font-weight:900;text-shadow:0 1px 0 rgba(0,0,0,.25)}',
    '.fm-drop{position:absolute;right:4px;top:4px;width:9px;height:9px;border-radius:50%;background:#6cb7e3;box-shadow:0 0 0 1.5px rgba(255,255,255,.7)}',
    '.fm-mark{position:absolute;left:3px;top:2px;font-size:9px}',
    '.fm-prog{position:absolute;left:20%;right:20%;bottom:6px;height:3px;border-radius:3px;background:rgba(255,255,255,.22);overflow:hidden}',
    '.fm-prog>i{display:block;height:100%;background:rgba(255,243,190,.9)}',
    // 口袋格、提示、主按钮、抽屉
    '.fm-pocket{display:flex;gap:8px;overflow-x:auto;padding:1px 1px 3px;scrollbar-width:none}.fm-pocket::-webkit-scrollbar{display:none}',
    '.fm-slot{position:relative;flex:none;width:44px;height:44px;border-radius:50%;padding:0;font:inherit;font-size:21px;cursor:pointer;display:grid;place-items:center;',
    'background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6);color:var(--ac-text,#794f27)}',
    '.fm-slot[aria-pressed="true"]{border-color:var(--ac-primary,#19c8b9);background:var(--ac-primary-bg,#e6f9f6)}',
    '.fm-slot.fm-add{border-style:dashed;font-size:17px;font-weight:900;color:var(--ac-text-muted,#8a7b66)}',
    '.fm-n{position:absolute;right:-4px;bottom:-3px;min-width:18px;height:17px;padding:0 4px;border-radius:9px;display:grid;place-items:center;font-size:9.5px;font-weight:900;',
    'background:var(--ac-bg,#f8f8f0);border:1.5px solid var(--ac-border,#c4b89e);color:var(--ac-text,#794f27);font-variant-numeric:tabular-nums}',
    '.fm-tip{min-height:14px;font-size:10.5px;font-weight:700;color:var(--ac-text-muted,#8a7b66);padding:0 2px}',
    '.fm-acts{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center}',
    '.fm-main{width:100%;padding:11px 12px;font-size:12px}.fm-main small{font-weight:800;opacity:.88;font-size:10.5px}',
    '.fm-round{position:relative;width:42px;height:42px;border-radius:50%;padding:0;font:inherit;font-size:18px;cursor:pointer;display:grid;place-items:center;',
    'background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6)}',
    '.fm-round[aria-expanded="true"]{border-color:var(--ac-primary,#19c8b9);background:var(--ac-primary-bg,#e6f9f6)}',
    '.fm-round .fm-n{top:-4px;bottom:auto;right:-5px}',
    '.fm-drawer{display:grid;gap:8px;padding:9px;border-radius:16px;background:var(--ac-bg-content,#f7f3df);border:2px solid var(--ac-border-light,#e5dcc6)}',
    '.fm-tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}',
    '.fm-tool{position:relative;display:grid;justify-items:center;gap:2px;padding:7px 2px 6px;border-radius:14px;font:inherit;cursor:pointer;',
    'background:var(--ac-bg-input,#fffbe7);color:inherit;border:2px solid var(--ac-border-light,#e5dcc6)}',
    '.fm-tool b{font-size:19px;line-height:1.1}.fm-tool span{font-size:10px;font-weight:800}',
    '.fm-tool[data-locked="true"]{opacity:.62}.fm-tool[data-on="true"]{border-color:var(--ac-primary,#19c8b9);background:var(--ac-primary-bg,#e6f9f6)}',
    '.fm-tool i{position:absolute;top:-6px;right:-3px;min-width:16px;padding:0 4px;border-radius:999px;font-style:normal;font-size:9.5px;font-weight:800;line-height:16px;color:#fff;background:#f0a04b}',
    '.fm-section{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;font-weight:800}',
    '.fm-section small{font-weight:700;color:var(--ac-text-muted,#8a7b66)}',
    '.fm-stock{display:flex;flex-wrap:wrap;gap:6px}',
    '.fm-cropbtn{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:14px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;',
    'background:var(--ac-bg-input,#fffbe7);color:inherit;border:2px solid var(--ac-border-light,#e5dcc6)}',
    '.fm-cropbtn[aria-expanded="true"]{border-color:#f0a04b}',
    '.fm-sellbar{width:100%;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:7px 9px;border-radius:14px;background:var(--ac-bg-input,#fffbe7);',
    'border:2px solid var(--ac-border-light,#e5dcc6);font-size:10.5px}',
    '.fm-note{font-size:10px;color:var(--ac-text-muted,#8a7b66);line-height:1.4}',
    '.fm .dp-mini{padding:4px 10px;font-size:10px}.fm .fm-main.dp-mini{padding:11px 12px;font-size:12px}',
    '.fm-plot:focus-visible,.fm-slot:focus-visible,.fm-round:focus-visible,.fm-badge:focus-visible{outline:3px solid var(--ac-primary,#19c8b9);outline-offset:2px}',
    // 点了以后的一下反馈（只播一次，不循环）
    '.fm-effect{position:absolute;inset:0;pointer-events:none;display:grid;place-items:center;font-size:22px;z-index:2}',
    '.fm-effect[data-kind="water"]{animation:fm-water .6s cubic-bezier(.4,0,.2,1) both}.fm-effect[data-kind="harvest"],.fm-effect[data-kind="plant"]{animation:fm-pop .6s cubic-bezier(.4,0,.2,1) both}',
    '@keyframes fm-water{0%{opacity:0;transform:translateY(-18px) scale(.7)}35%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(8px) scale(.8)}}',
    '@keyframes fm-pop{0%{opacity:0;transform:translateY(6px) scale(.7)}35%{opacity:1;transform:translateY(-6px) scale(1.1)}100%{opacity:0;transform:translateY(-18px) scale(.9)}}',
    '@media (prefers-reduced-motion:reduce){.fm-effect,.fm-plot{animation:none!important;transition:none!important}.fm-effect{opacity:0}}',
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

  /** 窗左上角的帮工小牌：没雇时是「雇帮工猪」，雇了显示状态和还能干多久；有收成 / 歇了时点它收或叫它接着干。 */
  function renderBadge(app, data, win) {
    var helper = data.helper
    if (!helper) return
    var badge
    if (!helper.hired) {
      badge = app.button('fm-badge', { 'data-farm-helper': 'hire' }, function () { app.send('hire', {}) })
      badge.appendChild(app.el('span', 'fm-face', '🐖'))
      badge.appendChild(app.el('span', null, '雇帮工猪 · ' + (data.currency.emoji || '') + ' 2500'))
      win.appendChild(badge)
      return
    }
    var ready = helper.stored > 0
    var state = helper.full ? ready ? '谷仓满了' : '帮工歇了' : helper.missing.length ? '没有' + helper.missing.join('、') + '种子了' : '帮工 · ' + helper.plots + ' 块地'
    badge = app.button('fm-badge', { 'data-farm-helper': 'collect', 'aria-label': state }, function () {
      if (ready || helper.full) app.send('collect', {})
      else if (helper.missing.length) goShop(app)
    })
    badge.disabled = !ready && !helper.full && helper.missing.length === 0
    badge.appendChild(app.el('span', 'fm-face', '🐖'))
    badge.appendChild(app.el('span', null, state))
    if (ready || helper.full) badge.appendChild(app.el('b', null, ready ? '收一下' : '接着干'))
    else {
      var meter = app.el('span', 'fm-meter')
      meter.setAttribute('title', '还能干 ' + Math.max(0, helper.capacityHours - helper.usedHours).toFixed(1) + ' 小时')
      var fill = app.el('i')
      fill.style.width = Math.round(Math.max(0, 1 - helper.usedHours / helper.capacityHours) * 100) + '%'
      meter.appendChild(fill)
      badge.appendChild(meter)
    }
    win.appendChild(badge)
  }

  function toolOf(data, key) {
    return (data.tools || []).find(function (tool) { return tool.key === key }) || { owned: false, emoji: '', label: key }
  }

  /** 这块地现在的情况，给主按钮和提示行用。 */
  function survey(data) {
    var unlocked = data.plots.slice(0, data.unlocked)
    var pick = function (test) { var out = []; unlocked.forEach(function (plot, index) { if (test(plot)) out.push(index) }); return out }
    return {
      ripe: pick(function (plot) { return plot && (plot.manualRipe || plot.stage === 3) }),
      thirsty: pick(function (plot) { return plot && !(plot.manualRipe || plot.stage === 3) && (plot.manualThirsty || plot.thirsty) }),
      empty: pick(function (plot) { return plot === null }),
      growing: pick(function (plot) { return plot && plot.stage < 3 && !plot.fertilized }),
      soonest: unlocked.filter(function (plot) { return plot && plot.stage < 3 && !(plot.manualThirsty || plot.thirsty) })
        .reduce(function (min, plot) { return Math.min(min, plot.remainingMs || Infinity) }, Infinity),
    }
  }

  /** 一块地：点它就做这块地现在该做的事；没事可做时在提示行说它还要多久。 */
  function renderPlot(app, data, bed, index) {
    var plot = data.plots[index]
    var locked = index >= data.unlocked
    var ripe = plot && (plot.manualRipe || plot.stage === 3)
    var thirsty = plot && !ripe && (plot.manualThirsty || plot.thirsty)
    var cls = 'fm-plot' + (locked ? ' fm-locked' : ripe ? ' fm-ripe' : '')
    var label = locked ? (index === data.unlocked ? data.prices[index] + ' 开垦' : '先开前一块') : plot === null ? '空地' : plot.label + (ripe ? ' 熟了' : thirsty ? ' 渴了' : '')
    var card = app.button(cls, { 'data-farm-plot': String(index), 'aria-label': label }, function () {
      if (locked) { if (index === data.unlocked) app.send('unlock', { plot: index }); else { tip = '要先开前一块地'; app.rerender() } return }
      if (plot === null) {
        if (hand === null) { goShop(app); return }
        effect(index, 'plant')
        app.send('plant', { plot: index, item: hand })
      } else if (fertilizing && plot.stage < 3 && !plot.fertilized) {
        fertilizing = data.fertilizer > 1
        app.send('fertilize', { plot: index })
      } else if (ripe) {
        effect(index, 'harvest')
        app.send('harvest', { plot: index })
      } else if (thirsty) {
        effect(index, 'water')
        app.send('water', { plot: index })
      } else {
        tip = plot.cropEmoji + ' ' + plot.label + ' · ' + (plot.helperManaged ? plot.helperNote + (plot.helperNote === '帮工处理中' ? ' · ' + shortTime(plot.remainingMs) : '') : '还要 ' + shortTime(plot.remainingMs))
        app.rerender()
      }
    })
    if (!locked) card.setAttribute('data-soil', plot === null ? 'tilled' : thirsty ? 'dry' : 'wet')
    if (locked) {
      card.appendChild(app.el('span', 'fm-price', index === data.unlocked ? String(data.prices[index]) : '🔒'))
    } else if (plot !== null) {
      var seedling = plot.emoji === '🟫' // 刚种下：画一棵淡淡的小芽，别在田里摆一块方砖
      var crop = app.el('span', 'fm-crop', ripe ? plot.cropEmoji || plot.emoji : seedling ? '🌱' : plot.emoji)
      crop.setAttribute('data-size', ripe ? '3' : plot.stage >= 2 ? '2' : '1')
      if (seedling) crop.setAttribute('data-seed', 'true')
      card.appendChild(crop)
      if (!ripe && !thirsty && plot.progress > 0) {
        var bar = app.el('span', 'fm-prog')
        var fill = app.el('i')
        fill.style.width = Math.round(plot.progress * 100) + '%'
        bar.appendChild(fill)
        card.appendChild(bar)
      }
      if (thirsty) card.appendChild(app.el('span', 'fm-drop'))
      if (plot.fertilized) card.appendChild(app.el('span', 'fm-mark', '🧪'))
    }
    if (!locked && data.sprinklers && data.sprinklers[index] && !(plot && plot.fertilized)) card.appendChild(app.el('span', 'fm-mark', '💦'))
    attachEffect(app, card, index)
    bed.appendChild(card)
  }

  /** 口袋：手里能种的种子，一格一种；手里那种用完了就自动换成下一种有的。最后一格去买。 */
  function renderPocket(app, data, root) {
    var owned = data.seeds.filter(function (seed) { return seed.count > 0 })
    if (hand !== null && !owned.some(function (seed) { return seed.key === hand })) hand = null
    if (hand === null && owned.length > 0) hand = owned[0].key
    var row = app.el('div', 'fm-pocket')
    row.setAttribute('role', 'group')
    row.setAttribute('aria-label', '手里的种子')
    owned.forEach(function (seed) {
      var slot = app.button('fm-slot', { 'data-farm-seed': seed.key, 'aria-pressed': String(hand === seed.key), 'aria-label': seed.label + ' ' + seed.count + ' 颗' }, function () {
        hand = seed.key
        fertilizing = false
        app.rerender()
      })
      slot.textContent = seed.emoji
      slot.appendChild(app.el('span', 'fm-n', String(seed.count)))
      row.appendChild(slot)
    })
    row.appendChild(button(app, 'fm-slot fm-add', { 'data-farm-shop': 'seed', 'aria-label': '买种子' }, '＋', function () { goShop(app) }))
    root.appendChild(row)
  }

  /** 主按钮：收获 > 浇水 > 种 > 去买种子；有对应的一键工具就一次做完，没有就做一块。 */
  function mainAction(data, look) {
    var owns = function (key) { return toolOf(data, key).owned }
    var more = look.thirsty.length > 0 ? '再浇 ' + look.thirsty.length + ' 块' : ''
    if (look.ripe.length > 0) {
      return owns('sickle')
        ? { label: '收获 ' + look.ripe.length + ' 块', sub: more, op: 'harvestAll', payload: {} }
        : { label: '收获', sub: look.ripe.length > 1 ? '还有 ' + (look.ripe.length - 1) + ' 块熟了' : more, op: 'harvest', payload: { plot: look.ripe[0] }, plot: look.ripe[0], fx: 'harvest' }
    }
    if (look.thirsty.length > 0) {
      return owns('can')
        ? { label: '浇水 ' + look.thirsty.length + ' 块', op: 'waterAll', payload: {} }
        : { label: '浇水', sub: look.thirsty.length > 1 ? '还有 ' + (look.thirsty.length - 1) + ' 块渴了' : '', op: 'water', payload: { plot: look.thirsty[0] }, plot: look.thirsty[0], fx: 'water' }
    }
    if (look.empty.length > 0 && hand !== null) {
      var seed = data.seeds.find(function (entry) { return entry.key === hand })
      return owns('planter')
        ? { label: '种满 ' + seed.emoji, sub: look.empty.length + ' 块空地', op: 'plantAll', payload: { item: hand } }
        : { label: '种 ' + seed.emoji + ' ' + seed.label, sub: look.empty.length > 1 ? '还有 ' + (look.empty.length - 1) + ' 块空地' : '', op: 'plant', payload: { plot: look.empty[0], item: hand }, plot: look.empty[0], fx: 'plant' }
    }
    if (look.empty.length > 0) return { label: '去买种子', shop: true }
    return { label: '都在长', sub: look.soonest < Infinity ? '最快 ' + shortTime(look.soonest) : '', idle: true }
  }

  /** 工具抽屉：四个一键工具；锁着的点了去商店买；角标是现在有几块地用得上。 */
  function renderTools(app, data, look, box) {
    var specs = [
      { key: 'can', op: 'waterAll', label: '浇全部', count: look.thirsty.length },
      { key: 'sickle', op: 'harvestAll', label: '收全部', count: look.ripe.length },
      { key: 'planter', op: 'plantAll', label: '种满', count: hand === null ? 0 : look.empty.length },
      { key: 'fertilizer', op: null, label: fertilizing ? '点地施肥' : '施肥 ×' + data.fertilizer, count: data.fertilizer > 0 ? look.growing.length : 0 },
    ]
    var bar = app.el('div', 'fm-tools')
    specs.forEach(function (spec) {
      var tool = toolOf(data, spec.key)
      var locked = !tool.owned
      var node = button(app, 'fm-tool', { 'data-farm-tool': spec.key, 'data-locked': String(locked), 'data-on': String(spec.key === 'fertilizer' && fertilizing) }, '', function () {
        if (locked) { goShop(app); return }
        if (spec.key === 'fertilizer') { fertilizing = !fertilizing; tip = fertilizing ? '点一块在长的地施肥' : null; app.rerender(); return }
        if (spec.key === 'planter') { if (hand !== null) app.send('plantAll', { item: hand }); return }
        app.send(spec.op, {})
      })
      node.appendChild(app.el('b', null, locked ? '🔒' : tool.emoji))
      node.appendChild(app.el('span', null, locked ? tool.label : spec.label))
      if (!locked && spec.count > 0) node.appendChild(app.el('i', null, String(spec.count)))
      bar.appendChild(node)
    })
    box.appendChild(bar)
  }

  /** 仓库抽屉：一种作物一块，点开才出卖 / 放背包。 */
  function renderStock(app, data, box) {
    var owned = data.harvest.filter(function (crop) { return crop.count > 0 })
    var head = app.el('div', 'fm-section')
    head.appendChild(app.el('span', null, '🧺 仓库'))
    var worth = owned.reduce(function (sum, crop) { return sum + crop.count * crop.sell }, 0)
    if (worth > 0) head.appendChild(app.el('small', null, '全部能卖 ' + data.currency.emoji + ' ' + worth))
    box.appendChild(head)
    var stock = app.el('div', 'fm-stock')
    if (owned.length === 0) stock.appendChild(app.el('div', 'fm-note', '还没有收成。'))
    owned.forEach(function (crop) {
      var open = openCrop === crop.key
      stock.appendChild(button(app, 'fm-cropbtn', { 'data-farm-crop': crop.key, 'aria-expanded': String(open) }, crop.emoji + ' ×' + crop.count, function () {
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
    box.appendChild(stock)
  }

  function renderActions(app, data, look, root) {
    var action = mainAction(data, look)
    var row = app.el('div', 'fm-acts')
    var main = app.button('dp-mini fm-main', { 'data-farm-main': action.op || (action.shop ? 'shop' : 'idle') }, function () {
      if (action.shop) { goShop(app); return }
      if (action.idle) return
      if (action.fx && action.plot !== undefined) effect(action.plot, action.fx)
      tip = null
      app.send(action.op, action.payload)
    })
    main.textContent = action.label
    if (action.sub) main.appendChild(app.el('small', null, ' · ' + action.sub))
    main.disabled = action.idle === true
    row.appendChild(main)
    var stocked = data.harvest.reduce(function (sum, crop) { return sum + crop.count }, 0)
    ;[{ key: 'tools', emoji: '🧰', label: '工具', count: 0 }, { key: 'stock', emoji: '🧺', label: '仓库', count: stocked }].forEach(function (spec) {
      var round = app.button('fm-round', { 'data-farm-panel': spec.key, 'aria-expanded': String(drawer === spec.key), 'aria-label': spec.label }, function () {
        drawer = drawer === spec.key ? null : spec.key
        app.rerender()
      })
      round.textContent = spec.emoji
      if (spec.count > 0) round.appendChild(app.el('span', 'fm-n', String(spec.count)))
      row.appendChild(round)
    })
    root.appendChild(row)
    if (drawer === null) return
    var box = app.el('div', 'fm-drawer')
    if (drawer === 'tools') renderTools(app, data, look, box)
    else renderStock(app, data, box)
    root.appendChild(box)
  }

  function render(app) {
    ensureStyle()
    var data = app.data
    if (!data || !Array.isArray(data.plots)) { app.content.appendChild(app.el('div', 'dp-empty', '菜园还在准备……')); return }
    if (!data.currency) data.currency = { emoji: '🪙', label: '金币' }
    var root = app.el('div', 'fm')
    var look = survey(data)
    var win = app.el('div', 'fm-window')
    renderBadge(app, data, win)
    var bed = app.el('div', 'fm-bed')
    for (var index = 0; index < data.plots.length; index += 1) renderPlot(app, data, bed, index)
    win.appendChild(bed)
    root.appendChild(win)
    renderPocket(app, data, root)
    var summary = look.ripe.length + look.thirsty.length === 0 && look.empty.length === 0 ? '' : [
      look.ripe.length ? look.ripe.length + ' 块熟了' : '', look.thirsty.length ? look.thirsty.length + ' 块渴了' : '', look.empty.length ? look.empty.length + ' 块空地' : '',
    ].filter(Boolean).join(' · ')
    root.appendChild(app.el('div', 'fm-tip', tip || summary))
    tip = null
    renderActions(app, data, look, root)
    app.content.appendChild(root)
  }

  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('farm', { render: render })
})()
