// 菜园面板 3.1（兼容新版数据）：地块和仓库只根据宿主快照绘制，手里拿的种子、展开的抽屉、动画留在本页。
// 交互照任天堂的思路：点地块就做「这块地现在该做的事」（空地种手里的种子、干了浇水、熟了收获）；
// 底下一个主按钮自动做最该做的事——有一键工具就一次做完，没有就做一块（工具在商店买，增量游戏的路子）。
// 视觉是动森风素材（用户 2026-10-11 定稿 ca-v3）：图片在扩展自带的 assets/ 里（app.asset），
// 猪用玩家现在的猪图（app.pigArt）；不放循环动画，只有按下去的反馈。
;(function () {
  'use strict'
  /* CLASSIC_DATA_BRIDGE */
  var hand = null
  var fertilizing = false
  var openCrop = null
  var drawer = null
  var tip = null
  var effects = {}
  var styleId = 'dsh-piggy-farm-classic-style-31'
  var TOOL_ORDER = ['can', 'planter', 'sickle', 'fertilizer']
  var TOOL_ART = { can: 'tool-can', planter: 'tool-planter', sickle: 'tool-sickle', fertilizer: 'tool-fertilizer' }
  var css = [
    '.fc{display:grid;gap:8px;color:#6b4a2b}',
    // 场景：背景图铺满，顶上吊着计分板，中间两列菜畦，右边站着猪
    '.fc-scene{position:relative;border-radius:18px;overflow:hidden;padding:58px 64px 14px 12px;background:#a8d07c center/cover no-repeat;box-shadow:inset 0 0 0 2px rgba(121,79,39,.12)}',
    '.fc-board{position:absolute;left:8%;right:8%;top:-34px;aspect-ratio:600/257;background:center/100% 100% no-repeat;z-index:3}',
    '.fc-board-in{position:absolute;left:12%;right:11%;top:52%;bottom:16%;display:flex;align-items:center;justify-content:center;gap:6px}',
    '.fc-helper{display:flex;align-items:center;gap:5px;min-width:0;padding:0;border:0;background:none;font:inherit;font-size:10px;font-weight:800;color:#6b4a2b;cursor:pointer}',
    '.fc-helper:disabled{cursor:default}.fc-helper>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fc-helper b{color:#3f8f3a;font-weight:900}',
    '.fc-face{flex:none;width:22px;height:22px;object-fit:contain;font-size:15px;line-height:22px;text-align:center}',
    '.fc-meter{flex:none;width:28px;height:5px;border-radius:5px;background:rgba(107,74,43,.18);overflow:hidden}.fc-meter>i{display:block;height:100%;background:#7fbf55}',
    '.fc-field{position:relative;z-index:2;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 8px}',
    '.fc-plot{position:relative;aspect-ratio:240/150;border:0;padding:0;font:inherit;color:#fff;cursor:pointer;background:center/100% 100% no-repeat;transition:transform .15s cubic-bezier(.4,0,.2,1)}.fc-plot:active{transform:scale(.96)}',
    '.fc-crop{position:absolute;left:50%;bottom:22%;width:74%;transform:translateX(-50%);pointer-events:none;filter:drop-shadow(0 2px 1px rgba(40,24,8,.25))}',
    '.fc-plot.fc-ripe .fc-crop{filter:drop-shadow(0 0 4px rgba(255,240,160,.95)) drop-shadow(0 2px 1px rgba(40,24,8,.25))}',
    '.fc-price{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);padding:1px 7px;border-radius:8px;font-size:9.5px;font-weight:900;color:#6b4a2b;background:#fff6dc;box-shadow:0 1px 0 rgba(107,74,43,.3)}',
    '.fc-drop{position:absolute;right:9%;top:12%;width:9px;height:9px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#5fb2e6;box-shadow:0 0 0 1.5px #fff}.fc-mark{position:absolute;left:4%;top:4%;width:22%;pointer-events:none}',
    '.fc-prog{position:absolute;left:26%;right:26%;bottom:9%;height:3px;border-radius:3px;background:rgba(60,36,14,.35);overflow:hidden}.fc-prog>i{display:block;height:100%;background:#ffe9a0}',
    '.fc-pig{position:absolute;right:6px;top:44%;width:54px;height:54px;object-fit:contain;z-index:2;pointer-events:none;font-size:36px;line-height:54px;text-align:center}',
    // 种子袋（手里拿哪种）和提示
    '.fc-pocket{display:flex;gap:6px;overflow-x:auto;padding:4px 2px 3px;scrollbar-width:none}.fc-pocket::-webkit-scrollbar{display:none}',
    '.fc-slot{position:relative;flex:none;width:40px;height:40px;border:0;border-radius:50%;padding:7px;cursor:pointer;background:center/100% 100% no-repeat;font:inherit;font-size:18px;color:#8a6a46}',
    '.fc-slot img{width:100%;height:100%;object-fit:contain;pointer-events:none}.fc-slot[aria-pressed="true"],.fc-slot[data-on="true"]{box-shadow:0 0 0 2.5px #7fbf55}.fc-slot[data-locked="true"] img{opacity:.4;filter:grayscale(.6)}',
    '.fc-n{position:absolute;right:-4px;bottom:-3px;min-width:17px;height:16px;padding:0 4px;border-radius:8px;display:grid;place-items:center;font-size:9.5px;font-weight:900;font-style:normal;',
    'background:#fff8e6;border:1.5px solid #c9a676;color:#6b4a2b;font-variant-numeric:tabular-nums}.fc-lock{position:absolute;right:-2px;top:-3px;font-size:11px}.fc-tip{min-height:14px;font-size:10.5px;font-weight:700;color:#8a6a46;padding:0 2px}',
    // 底部木排：四个工具圆格，下面「仓库 / 主按钮 / 商店」
    '.fc-plank{display:grid;gap:8px;padding:12px 10px 13px;background:center/100% 100% no-repeat}.fc-tools{display:flex;justify-content:space-around}.fc-tools .fc-slot{width:46px;height:46px;padding:8px}',
    '.fc-acts{display:grid;grid-template-columns:1fr 1.55fr 1fr;gap:6px;align-items:center}.fc-sign{position:relative;aspect-ratio:240/101;border:0;padding:0 4px;display:flex;align-items:center;justify-content:center;gap:2px;cursor:pointer;',
    'background:center/100% 100% no-repeat;font:inherit;font-size:10.5px;font-weight:900;color:#6b4a2b}.fc-sign img{width:22px;height:20px;object-fit:contain}.fc-sign[aria-expanded="true"]{filter:brightness(1.08) drop-shadow(0 0 2px #7fbf55)}',
    '.fc-sign .fc-n{top:-5px;bottom:auto;right:-3px}.fc-main{aspect-ratio:256/101;border:0;padding:0 8px;display:grid;place-content:center;cursor:pointer;background:center/100% 100% no-repeat;font:inherit;',
    'font-size:12.5px;font-weight:900;color:#fff;text-shadow:0 1px 0 rgba(30,80,30,.55);line-height:1.15}.fc-main small{display:block;font-size:9px;font-weight:800;opacity:.95}.fc-main:disabled{filter:saturate(.45) brightness(1.05);cursor:default}',
    '.fc-main:active,.fc-sign:active,.fc-slot:active{transform:scale(.96)}',
    // 仓库抽屉：纸面木框
    '.fc-drawer{display:grid;gap:8px;padding:10px;border-radius:14px;background:#fff8e3;border:3px solid #c39a63;box-shadow:inset 0 0 0 2px #f3e6c4}',
    '.fc-section{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;font-weight:800}.fc-section small{font-weight:700;color:#8a6a46}.fc-stock{display:flex;flex-wrap:wrap;gap:6px}',
    '.fc-cropbtn{display:inline-flex;align-items:center;gap:3px;padding:3px 9px 3px 4px;border-radius:14px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;',
    'background:#fffdf3;color:inherit;border:2px solid #e5d3ad}.fc-cropbtn img{width:22px;height:22px;object-fit:contain}.fc-cropbtn[aria-expanded="true"]{border-color:#f0a04b}',
    '.fc-sellbar{width:100%;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:7px 9px;border-radius:12px;background:#fffdf3;border:2px solid #e5d3ad;font-size:10.5px}.fc-note{font-size:10px;color:#8a6a46;line-height:1.4}',
    '.fc .dp-mini{padding:4px 10px;font-size:10px}.fc-plot:focus-visible,.fc-slot:focus-visible,.fc-sign:focus-visible,.fc-main:focus-visible,.fc-helper:focus-visible{outline:3px solid #7fbf55;outline-offset:2px}',
    // 点了以后的一下反馈（只播一次，不循环）
    '.fc-effect{position:absolute;inset:0;pointer-events:none;display:grid;place-items:center;font-size:22px;z-index:2}',
    '.fc-effect[data-kind="water"]{animation:fc-water .6s cubic-bezier(.4,0,.2,1) both}.fc-effect[data-kind="harvest"],.fc-effect[data-kind="plant"]{animation:fc-pop .6s cubic-bezier(.4,0,.2,1) both}',
    '@keyframes fc-water{0%{opacity:0;transform:translateY(-18px) scale(.7)}35%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(8px) scale(.8)}}',
    '@keyframes fc-pop{0%{opacity:0;transform:translateY(6px) scale(.7)}35%{opacity:1;transform:translateY(-6px) scale(1.1)}100%{opacity:0;transform:translateY(-18px) scale(.9)}}',
    '@media (prefers-reduced-motion:reduce){.fc-effect,.fc-plot,.fc-main,.fc-sign,.fc-slot{animation:none!important;transition:none!important}.fc-effect{opacity:0}}',
  ].join('')

  function helperContinuous(data) { return data.helper && data.helper.continuous === true }
  function ensureStyle() {
    if (document.getElementById(styleId)) return
    var style = document.createElement('style'); style.id = styleId; style.textContent = css; document.head.appendChild(style)
  }

  /** 扩展自带图片的地址；老宿主没有 app.asset 时给空串，界面退回纯色 + emoji。 */
  function art(app, name) {
    if (app.hasAsset && !app.hasAsset(name + '.webp')) {
      var crop = /^crop-(.+)-([123])$/.exec(name)
      if (crop) name = 'crop-' + crop[1] + '-' + ({ 1: 'seedling', 2: 'growing', 3: 'ripe' }[crop[2]])
      if (!app.hasAsset(name + '.webp')) return ''
    }
    return typeof app.asset === 'function' ? app.asset(name + '.webp') : ''
  }
  function bg(app, node, name) { var url = art(app, name); if (url) node.style.backgroundImage = 'url("' + url + '")' }
  function picture(app, className, url, fallback) {
    if (!url) return app.el('span', className, fallback || '')
    var node = app.el('img', className); node.src = url; node.alt = ''; return node
  }
  function img(app, className, name, fallback) { return picture(app, className, art(app, name), fallback) }

  function effect(index, kind) { effects[index] = { kind: kind, at: Date.now() } }
  function attachEffect(app, card, index) {
    var current = effects[index]
    if (!current) return
    var elapsed = Date.now() - current.at
    if (elapsed >= 650) { delete effects[index]; return }
    var icon = app.el('span', 'fc-effect', current.kind === 'water' ? '💧' : current.kind === 'plant' ? '🌱' : '✨')
    icon.setAttribute('data-kind', current.kind)
    icon.style.animationDelay = '-' + Math.max(0, elapsed) + 'ms'
    card.appendChild(icon)
  }

  function button(app, className, attrs, label, onClick) { var node = app.button(className, attrs, onClick); node.textContent = label; return node }
  function shortTime(ms) {
    var minutes = Math.ceil(ms / 60000)
    if (minutes < 60) return minutes + ' 分钟'
    return Math.floor(minutes / 60) + ' 小时' + (minutes % 60 ? ' ' + minutes % 60 + ' 分' : '')
  }

  /** 去商店的种子 / 工具货架。 */
  function goShop(app) { if (typeof app.openShop === 'function') app.openShop() }

  /** 玩家现在的猪图，没有立绘时用 🐖。 */
  function pigOf(app, className) { return picture(app, className, typeof app.pigArt === 'function' ? app.pigArt() : null, '🐖') }

  /** 吊牌计分板：帮工（没雇时是「雇帮工猪」）；菜币余额宿主在页顶已经给了，这里不重复。有收成 / 歇了时点帮工收或叫它接着干。 */
  function renderBoard(app, data, scene) {
    var board = app.el('div', 'fc-board')
    bg(app, board, 'ui-scoreboard')
    var inner = app.el('div', 'fc-board-in')
    var helper = data.helper
    if (helper && !helper.hired) {
      var hire = app.button('fc-helper', { 'data-farm-helper': 'hire' }, function () { app.send('hire', {}) })
      hire.appendChild(pigOf(app, 'fc-face'))
      hire.appendChild(app.el('span', null, '雇帮工猪 · ' + (data.currency.emoji || '') + ' 2500'))
      inner.appendChild(hire)
    } else if (helper) {
      var ready = helper.stored > 0
      var state = helper.full ? ready ? '谷仓满了' : '帮工歇了' : helper.missing.length ? '没有' + helper.missing.join('、') + '种子了' : '帮工 · ' + helper.plots + ' 块地'
      var badge = app.button('fc-helper', { 'data-farm-helper': 'collect', 'aria-label': state }, function () {
        if (ready || helper.full) app.send('collect', {})
        else if (helper.missing.length) goShop(app)
      })
      badge.disabled = !ready && !helper.full && helper.missing.length === 0
      badge.appendChild(pigOf(app, 'fc-face'))
      badge.appendChild(app.el('span', null, state))
      if (ready || helper.full) badge.appendChild(app.el('b', null, ready ? '收一下' : '接着干'))
      else if (helper.continuous) badge.appendChild(app.el('span', null, '持续照料'))
      else {
        var meter = app.el('span', 'fc-meter')
        meter.setAttribute('title', '还能干 ' + Math.max(0, helper.capacityHours - helper.usedHours).toFixed(1) + ' 小时')
        var fill = app.el('i')
        fill.style.width = Math.round(Math.max(0, 1 - helper.usedHours / helper.capacityHours) * 100) + '%'
        meter.appendChild(fill)
        badge.appendChild(meter)
      }
      inner.appendChild(badge)
    }
    board.appendChild(inner)
    scene.appendChild(board)
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
      clear: pick(function (plot) { return plot && plot.needsClear }),
      growing: pick(function (plot) { return plot && plot.stage < 3 && !plot.fertilized }),
      soonest: unlocked.filter(function (plot) { return plot && plot.stage < 3 && !(plot.manualThirsty || plot.thirsty) })
        .reduce(function (min, plot) { return Math.min(min, plot.remainingMs || Infinity) }, Infinity),
    }
  }

  /** 一块地：点它就做这块地现在该做的事；没事可做时在提示行说它还要多久。 */
  function renderPlot(app, data, field, index) {
    var plot = data.plots[index]
    var locked = index >= data.unlocked
    var ripe = plot && (plot.manualRipe || plot.stage === 3)
    var thirsty = plot && !ripe && (plot.manualThirsty || plot.thirsty)
    var label = locked ? (index === data.unlocked ? data.prices[index] + ' 开垦' : '先开前一块') : plot === null ? '空地' : plot.label + (plot.needsClear ? ' · 铲除' : ripe ? ' 熟了' : thirsty ? ' · 要照料' : '')
    var card = app.button('fc-plot' + (ripe ? ' fc-ripe' : ''), { 'data-farm-plot': String(index), 'aria-label': label }, function () {
      if (locked) { if (index === data.unlocked) app.send('unlock', { plot: index }); else { tip = '要先开前一块地'; app.rerender() } return }
      if (plot && plot.needsClear) { app.send('clear', { plot: index }); return }
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
        tip = plot.cropEmoji + ' ' + plot.label + ' · ' + (plot.helperManaged ? (plot.helperNote || '帮工照料') + (helperContinuous(data) || plot.helperNote === '帮工处理中' ? ' · ' + shortTime(plot.remainingMs) : '') : '还要 ' + shortTime(plot.remainingMs))
        app.rerender()
      }
    })
    var soil = locked ? 'locked' : plot === null ? 'tilled' : thirsty ? 'dry' : plot.stage === 0 ? 'seeded' : 'wet'
    card.setAttribute('data-soil', soil)
    bg(app, card, { locked: 'plot-locked', tilled: 'plot-wet', dry: 'plot-dry', seeded: 'plot-seeded', wet: 'plot-wet' }[soil])
    if (locked) {
      if (index === data.unlocked) card.appendChild(app.el('span', 'fc-price', (data.currency.emoji || '') + ' ' + data.prices[index]))
    } else if (plot !== null) {
      if (plot.needsClear) card.appendChild(img(app, 'fc-crop', 'withered', '🥀'))
      else if (plot.empty) card.appendChild(img(app, 'fc-crop', 'weed', '🌿'))
      else if (plot.stage > 0) card.appendChild(img(app, 'fc-crop', 'crop-' + plot.crop + '-' + Math.min(3, plot.stage), ripe ? plot.cropEmoji : plot.emoji))
      if (!ripe && !thirsty && plot.progress > 0) {
        var bar = app.el('span', 'fc-prog')
        var fill = app.el('i')
        fill.style.width = Math.round(plot.progress * 100) + '%'
        bar.appendChild(fill)
        card.appendChild(bar)
      }
      if (thirsty) card.appendChild(app.el('span', 'fc-drop'))
      if (plot.fertilized) card.appendChild(img(app, 'fc-mark', 'plot-fertilized', '🧪'))
    }
    if (!locked && data.sprinklers && data.sprinklers[index] && !(plot && plot.fertilized)) card.appendChild(img(app, 'fc-mark', 'tool-sprinkler', '💦'))
    attachEffect(app, card, index)
    field.appendChild(card)
  }

  /** 种子袋：手里能种的种子，一格一种；手里那种用完了就自动换成下一种有的。最后一格去买。 */
  function renderPocket(app, data, root) {
    var owned = data.seeds.filter(function (seed) { return seed.count > 0 })
    if (hand !== null && !owned.some(function (seed) { return seed.key === hand })) hand = null
    if (hand === null && owned.length > 0) hand = owned[0].key
    var row = app.el('div', 'fc-pocket')
    row.setAttribute('role', 'group')
    row.setAttribute('aria-label', '手里的种子')
    owned.forEach(function (seed) {
      var slot = app.button('fc-slot', { 'data-farm-seed': seed.key, 'aria-pressed': String(hand === seed.key), 'aria-label': seed.label + '种子 ' + seed.count + ' 颗', title: seed.label + '种子' }, function () {
        hand = seed.key
        fertilizing = false
        app.rerender()
      })
      bg(app, slot, 'ui-slot')
      slot.appendChild(img(app, null, 'produce-' + seed.key, seed.emoji))
      slot.appendChild(app.el('span', 'fc-n', String(seed.count)))
      row.appendChild(slot)
    })
    var add = button(app, 'fc-slot', { 'data-farm-shop': 'seed', 'aria-label': '买种子', title: '买种子' }, '＋', function () { goShop(app) })
    bg(app, add, 'ui-slot')
    row.appendChild(add)
    root.appendChild(row)
  }

  /** 主按钮：收获 > 浇水 > 种 > 去买种子；有对应的一键工具就一次做完，没有就做一块。 */
  function mainAction(data, look) {
    var owns = function (key) { return toolOf(data, key).owned }
    var more = look.thirsty.length > 0 ? '再照料 ' + look.thirsty.length + ' 块' : ''
    if (look.ripe.length > 0) {
      return owns('sickle')
        ? { label: '收获 ' + look.ripe.length + ' 块', sub: more, op: 'harvestAll', payload: {} }
        : { label: '收获', sub: look.ripe.length > 1 ? '还有 ' + (look.ripe.length - 1) + ' 块熟了' : more, op: 'harvest', payload: { plot: look.ripe[0] }, plot: look.ripe[0], fx: 'harvest' }
    }
    if (look.clear.length > 0) return { label: '铲枯苗', op: 'clear', payload: { plot: look.clear[0] } }
    if (look.thirsty.length > 0) {
      return owns('can')
        ? { label: '照料 ' + look.thirsty.length + ' 块', op: 'waterAll', payload: {} }
        : { label: '照料', sub: look.thirsty.length > 1 ? '还有 ' + (look.thirsty.length - 1) + ' 块要照料' : '', op: 'water', payload: { plot: look.thirsty[0] }, plot: look.thirsty[0], fx: 'water' }
    }
    if (look.empty.length > 0 && hand !== null) {
      var seed = data.seeds.find(function (entry) { return entry.key === hand })
      return owns('planter')
        ? { label: '种满' + seed.label, sub: look.empty.length + ' 块空地', op: 'plantAll', payload: { item: hand } }
        : { label: '种' + seed.label, sub: look.empty.length > 1 ? '还有 ' + (look.empty.length - 1) + ' 块空地' : '', op: 'plant', payload: { plot: look.empty[0], item: hand }, plot: look.empty[0], fx: 'plant' }
    }
    if (look.empty.length > 0) return { label: '去买种子', shop: true }
    return { label: '都在长', sub: look.soonest < Infinity ? '最快 ' + shortTime(look.soonest) : '', idle: true }
  }

  /** 四个一键工具（水壶、播种器、镰刀、肥料）：锁着的点了去商店买；角标是现在有几块地用得上。 */
  function renderTools(app, data, look, plank) {
    var specs = {
      can: { op: 'waterAll', label: '照料全部', count: look.thirsty.length },
      planter: { op: 'plantAll', label: '种满', count: hand === null ? 0 : look.empty.length },
      sickle: { op: 'harvestAll', label: '收全部', count: look.ripe.length },
      fertilizer: { op: null, label: fertilizing ? '点地施肥' : '施肥 ×' + data.fertilizer, count: data.fertilizer > 0 ? look.growing.length : 0 },
    }
    var bar = app.el('div', 'fc-tools')
    TOOL_ORDER.forEach(function (key) {
      var spec = specs[key]
      var tool = toolOf(data, key)
      var locked = !tool.owned
      var name = locked ? tool.label + '（去商店买）' : spec.label
      var node = app.button('fc-slot', { 'data-farm-tool': key, 'data-locked': String(locked), 'data-on': String(key === 'fertilizer' && fertilizing), 'aria-label': name, title: name }, function () {
        if (locked) { goShop(app); return }
        if (key === 'fertilizer') { fertilizing = !fertilizing; tip = fertilizing ? '点一块在长的地施肥' : null; app.rerender(); return }
        if (key === 'planter') { if (hand !== null) app.send('plantAll', { item: hand }); return }
        app.send(spec.op, {})
      })
      bg(app, node, 'ui-slot')
      node.appendChild(img(app, null, TOOL_ART[key], tool.emoji))
      if (locked) node.appendChild(app.el('span', 'fc-lock', '🔒'))
      else if (spec.count > 0) node.appendChild(app.el('i', 'fc-n', String(spec.count)))
      bar.appendChild(node)
    })
    plank.appendChild(bar)
  }

  /** 仓库抽屉：一种作物一块，点开才出卖 / 放背包。 */
  function renderStock(app, data, box) {
    var owned = data.harvest.filter(function (crop) { return crop.count > 0 })
    var head = app.el('div', 'fc-section')
    head.appendChild(app.el('span', null, '仓库'))
    var worth = owned.reduce(function (sum, crop) { return sum + crop.count * crop.sell }, 0)
    if (worth > 0) head.appendChild(app.el('small', null, '全部能卖 ' + data.currency.emoji + ' ' + worth))
    box.appendChild(head)
    var stock = app.el('div', 'fc-stock')
    if (owned.length === 0) stock.appendChild(app.el('div', 'fc-note', '还没有收成。'))
    owned.forEach(function (crop) {
      var open = openCrop === crop.key
      var chip = app.button('fc-cropbtn', { 'data-farm-crop': crop.key, 'aria-expanded': String(open), 'aria-label': crop.label + ' ' + crop.count + ' 个' }, function () {
        openCrop = open ? null : crop.key
        app.rerender()
      })
      chip.appendChild(img(app, null, 'produce-' + crop.key, crop.emoji))
      chip.appendChild(app.el('span', null, '×' + crop.count))
      stock.appendChild(chip)
      if (!open) return
      var sell = app.el('div', 'fc-sellbar')
      sell.appendChild(app.el('span', 'fc-note', crop.label + ' · 一个卖 ' + crop.sell))
      sell.appendChild(button(app, 'dp-mini', { 'data-farm-sell': crop.key }, '卖一个', function () { app.send('sell', { item: crop.key }) }))
      if (crop.count > 1) sell.appendChild(button(app, 'dp-mini', { 'data-farm-sell-all': crop.key }, '全卖 ' + data.currency.emoji + ' ' + crop.count * crop.sell, function () { openCrop = null; app.send('sell', { item: crop.key, count: crop.count }) }))
      if (crop.food) sell.appendChild(button(app, 'dp-mini dp-mini-plain', { 'data-farm-store': crop.key }, '放进背包 · ' + crop.foodLabel, function () { app.send('store', { item: crop.key }) }))
      stock.appendChild(sell)
    })
    box.appendChild(stock)
  }

  /** 木排下面一行：仓库、主按钮、商店。 */
  function renderActions(app, data, look, plank) {
    var action = mainAction(data, look)
    var row = app.el('div', 'fc-acts')
    var stocked = data.harvest.reduce(function (sum, crop) { return sum + crop.count }, 0)
    var store = app.button('fc-sign', { 'data-farm-panel': 'stock', 'aria-expanded': String(drawer === 'stock'), 'aria-label': '仓库' }, function () {
      drawer = drawer === 'stock' ? null : 'stock'
      app.rerender()
    })
    bg(app, store, 'ui-sign')
    store.appendChild(img(app, null, 'ui-storage', '🧺'))
    store.appendChild(app.el('span', null, '仓库'))
    if (stocked > 0) store.appendChild(app.el('span', 'fc-n', String(stocked)))
    row.appendChild(store)
    var main = app.button('fc-main', { 'data-farm-main': action.op || (action.shop ? 'shop' : 'idle') }, function () {
      if (action.shop) { goShop(app); return }
      if (action.idle) return
      if (action.fx && action.plot !== undefined) effect(action.plot, action.fx)
      tip = null
      app.send(action.op, action.payload)
    })
    bg(app, main, 'ui-main')
    main.appendChild(app.el('span', null, action.label))
    if (action.sub) main.appendChild(app.el('small', null, action.sub))
    main.disabled = action.idle === true
    row.appendChild(main)
    var shop = app.button('fc-sign', { 'data-farm-shop': 'shelf', 'aria-label': '商店' }, function () { goShop(app) })
    bg(app, shop, 'ui-sign')
    shop.appendChild(img(app, null, 'ui-shop', ''))
    shop.appendChild(app.el('span', null, '商店'))
    row.appendChild(shop)
    plank.appendChild(row)
  }

  function render(app) {
    ensureStyle()
    app = classicApp(app)
    var data = app.data
    if (!data || !Array.isArray(data.plots)) { app.content.appendChild(app.el('div', 'dp-empty', '菜园还在准备……')); return }
    if (!data.currency) data.currency = { emoji: '🪙', label: '金币' }
    if (app.walletContent && !app.content.querySelector('[data-wallet="farm"]')) {
      app.content.appendChild(button(app, 'dp-mini', { 'data-farm-wallet': 'toggle' }, data.balance + ' 菜币 · 换', function () { drawer = drawer === 'wallet' ? null : 'wallet'; app.rerender() }))
      if (drawer === 'wallet') app.content.appendChild(app.walletContent())
    }
    var root = app.el('div', 'fc')
    var look = survey(data)
    var scene = app.el('div', 'fc-scene')
    bg(app, scene, 'bg')
    renderBoard(app, data, scene)
    var field = app.el('div', 'fc-field')
    for (var index = 0; index < data.plots.length; index += 1) renderPlot(app, data, field, index)
    scene.appendChild(field)
    scene.appendChild(pigOf(app, 'fc-pig'))
    root.appendChild(scene)
    var summary = look.ripe.length + look.thirsty.length === 0 && look.empty.length === 0 ? '' : [
      look.ripe.length ? look.ripe.length + ' 块熟了' : '', look.thirsty.length ? look.thirsty.length + ' 块要照料' : '', look.empty.length ? look.empty.length + ' 块空地' : '',
    ].filter(Boolean).join(' · ')
    root.appendChild(app.el('div', 'fc-tip', tip || summary))
    tip = null
    renderPocket(app, data, root)
    var plank = app.el('div', 'fc-plank')
    bg(app, plank, 'ui-plank')
    renderTools(app, data, look, plank)
    renderActions(app, data, look, plank)
    root.appendChild(plank)
    if (drawer === 'stock') {
      var box = app.el('div', 'fc-drawer'); box.setAttribute('data-scroll-key', 'farm-classic-stock')
      renderStock(app, data, box)
      root.appendChild(box)
    }
    app.content.appendChild(root)
  }

  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('farm', { render: render })
})()
