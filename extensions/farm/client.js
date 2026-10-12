// 菜园 4.0 的界面（照 QQ 农场改版，设计见 docs/design/farm-qqfarm.md）：
// - 小农场（app.mode 'panel'，面板里）：竖版，显示前 6 块地，下面一个主按钮做最该做的事；
// - 大农场（app.mode 'big'，单独的大窗口）：横版，18 块菱形地斜着排，底部工具栏，点地块用手里的工具。
// 两边是同一份数据，只是两种看法（用户 2026-10-12）。地块和仓库只根据宿主快照绘制；
// 手里拿的工具 / 种子、开着的弹层留在本页。素材是动森风（用户选 a-v2），猪用玩家现在的猪图。
;(function () {
  'use strict'
  /** 手里拿的东西：auto（手套：熟了收、有病治、枯了铲）、seed、care（浇水 / 除草 / 杀虫）、shovel、fert。 */
  var hand = { kind: 'auto', key: null }
  var popup = null
  var openCrop = null
  var confirmClear = null
  var tip = null
  var effects = {}
  var styleId = 'dsh-piggy-farm-style-4'
  var SMALL_PLOTS = 6
  var PEST_ART = { weed: 'weed', bug: 'bug' }
  var PEST_LABEL = { dry: '干了', weed: '长草', bug: '生虫' }
  var ONE_CLICK = [{ key: 'sickle', op: 'harvestAll', label: '一键收获', tool: '收割镰' }, { key: 'sprayer', op: 'careAll', label: '一键照料', tool: '喷雾桶' },
    { key: 'rake', op: 'clearAll', label: '一键铲除', tool: '平地耙' }, { key: 'planter', op: 'plantAll', label: '一键播种', tool: '播种器' }]
  var WEATHER = { sunny: '☀️', rain: '🌧️', night: '🌙' }
  var AUTO = { kind: 'auto', key: null }
  // 样式：通用件、弹层、小农场（fm-s-）、大农场（fm-b-，整幅 3:2 场景按窗口缩放，里面按百分比摆）
  var css = [
    '.fm{display:grid;gap:8px;color:#6b4a2b;font-variant-numeric:tabular-nums}.fm img{pointer-events:none;-webkit-user-drag:none}.fm-n{position:absolute;right:-4px;bottom:-3px;min-width:17px;height:16px;padding:0 4px;border-radius:8px;display:grid;place-items:center;font-size:9.5px;font-weight:900;font-style:normal;background:#fff8e6;border:1.5px solid #c9a676;color:#6b4a2b}',
    '.fm-lock{position:absolute;right:-2px;top:-3px;font-size:11px}.fm-slot{position:relative;flex:none;width:44px;height:44px;border:0;border-radius:50%;padding:7px;cursor:pointer;background:center/100% 100% no-repeat;font:inherit;font-size:18px;color:#8a6a46}',
    '.fm-slot img{width:100%;height:100%;object-fit:contain}.fm-slot[aria-pressed="true"]{box-shadow:0 0 0 3px #7fbf55}.fm-slot[data-locked="true"] img{opacity:.4;filter:grayscale(.6)}.fm-slot:active,.fm-main:active,.fm-sign:active,.fm-plot:active{transform:scale(.96)}.fm-plot{position:absolute;border:0;padding:0;background:center/100% 100% no-repeat;cursor:pointer;font:inherit}',
    '.fm-plot>img{position:absolute;pointer-events:none}.fm-plot.fm-ripe>.fm-crop{filter:drop-shadow(0 0 5px rgba(255,240,160,.95)) drop-shadow(0 2px 1px rgba(40,24,8,.25))}.fm-crop{left:50%;transform:translateX(-50%);filter:drop-shadow(0 2px 1px rgba(40,24,8,.25))}.fm-pest{width:30%}',
    '.fm-chip{position:absolute;left:50%;transform:translateX(-50%);padding:1px 7px;border-radius:8px;font-size:10px;font-weight:900;white-space:nowrap;color:#6b4a2b;background:#fff6dc;box-shadow:0 1px 0 rgba(107,74,43,.3);pointer-events:none}',
    '.fm-prog{position:absolute;left:30%;right:30%;height:4px;border-radius:3px;background:rgba(60,36,14,.35);overflow:hidden;pointer-events:none}.fm-prog>i{display:block;height:100%;background:#ffe9a0}.fm-tip{min-height:15px;font-size:11px;font-weight:700;color:#8a6a46;padding:0 2px}',
    '.fm-exp{position:relative;display:inline-block;width:64px;height:12px;background:center/100% 100% no-repeat;vertical-align:middle}.fm-exp>i{position:absolute;left:5%;top:18%;bottom:20%;background:center/100% 100% no-repeat;border-radius:4px}',
    '.fm-stat{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#6b4a2b}.fm-stat img{width:22px;height:22px;object-fit:contain}.fm-main{border:0;padding:0 10px;display:grid;place-content:center;cursor:pointer;background:center/100% 100% no-repeat;font:inherit;font-size:13px;font-weight:900;color:#fff;',
    'text-shadow:0 1px 0 rgba(30,80,30,.55);line-height:1.15}.fm-main small{display:block;font-size:9.5px;font-weight:800;opacity:.95}.fm-main:disabled{filter:saturate(.45) brightness(1.05);cursor:default}',
    '.fm-sign{position:relative;border:0;padding:0 6px;display:flex;align-items:center;justify-content:center;gap:3px;cursor:pointer;background:center/100% 100% no-repeat;font:inherit;font-size:11px;font-weight:900;color:#6b4a2b}.fm-sign img{width:24px;height:22px;object-fit:contain}.fm-sign .fm-n{top:-5px;bottom:auto;right:-3px}',
    '.fm-pop{display:grid;gap:8px;padding:12px;border-radius:14px;background:#fff8e3;border:3px solid #c39a63;box-shadow:inset 0 0 0 2px #f3e6c4,0 6px 18px rgba(60,36,14,.25)}.fm-section{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:12px;font-weight:900}.fm-section small{font-weight:700;color:#8a6a46}',
    '.fm-stock{display:flex;flex-wrap:wrap;gap:6px}.fm-note{font-size:10.5px;color:#8a6a46;line-height:1.4}.fm-cropbtn{display:inline-flex;align-items:center;gap:3px;padding:3px 9px 3px 4px;border-radius:14px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;background:#fffdf3;color:inherit;border:2px solid #e5d3ad}',
    '.fm-cropbtn img{width:24px;height:24px;object-fit:contain}.fm-cropbtn[aria-pressed="true"],.fm-cropbtn[aria-expanded="true"]{border-color:#7fbf55;box-shadow:0 0 0 1px #7fbf55}.fm-cropbtn:disabled{opacity:.45;cursor:default}',
    '.fm-sellbar{width:100%;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:7px 9px;border-radius:12px;background:#fffdf3;border:2px solid #e5d3ad;font-size:10.5px}.fm .dp-mini{padding:4px 10px;font-size:10px}.fm-plot:focus-visible,.fm-slot:focus-visible,.fm-sign:focus-visible,.fm-main:focus-visible{outline:3px solid #7fbf55;outline-offset:2px}',
    '.fm-s-scene{position:relative;border-radius:18px;overflow:hidden;aspect-ratio:760/600;background:#a8d07c center top/cover no-repeat;box-shadow:inset 0 0 0 2px rgba(121,79,39,.12)}.fm-s-board{position:absolute;left:3%;width:75%;top:-1%;aspect-ratio:1200/476;background:center/100% 100% no-repeat;z-index:3}',
    '.fm-s-weather{flex:none;width:24px;height:24px;object-fit:contain;font-size:16px;line-height:24px}.fm-s-board-in{position:absolute;left:12%;right:9%;top:44%;bottom:15%;display:flex;align-items:center;justify-content:space-between;gap:6px}.fm-s-big{position:absolute;right:3%;top:0;width:19%;aspect-ratio:225/206;background:center/100% 100% no-repeat;z-index:3;border:0;padding:0 0 9px;display:flex;align-items:flex-end;justify-content:center;font:inherit;font-size:10px;line-height:1;white-space:nowrap;letter-spacing:-.5px;font-weight:900;color:#6b4a2b;cursor:pointer}',
    '.fm-s-field{position:absolute;left:5%;right:22%;top:33%;bottom:2%}.fm-s-field .fm-plot{width:48%;height:31%}.fm-s-field .fm-crop{bottom:26%;width:56%}.fm-s-field .fm-pest{left:6%;top:8%;width:26%}.fm-s-field .fm-pest[data-pest="bug"]{left:auto;right:8%;top:16%;width:22%}.fm-s-field .fm-chip{bottom:4%}.fm-s-field .fm-prog{bottom:12%}',
    '.fm-s-pig{position:absolute;right:3%;top:52%;width:17%;object-fit:contain;z-index:2;font-size:34px;text-align:center}.fm-s-note{position:relative;justify-self:center;width:78%;aspect-ratio:256/52;background:center/100% 100% no-repeat;display:grid;place-items:center;font-size:11px;font-weight:900;color:#6b4a2b;margin-top:-4px}',
    '.fm-pocket{display:flex;gap:6px;overflow-x:auto;padding:4px 2px 3px;scrollbar-width:none}.fm-pocket::-webkit-scrollbar{display:none}.fm-pocket .fm-slot{width:40px;height:40px}.fm-s-plank{display:grid;gap:8px;padding:12px 10px 13px;background:center/100% 100% no-repeat}.fm-s-tools{display:flex;justify-content:space-around}',
    '.fm-s-acts{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:6px;align-items:center}.fm-s-acts .fm-sign{aspect-ratio:256/101}.fm-s-acts .fm-main{aspect-ratio:256/102}.fm-big{width:100%;height:100%;display:grid;place-items:center;background:#7fae5a}',
    '.fm-b-scene{position:relative;width:min(100%,150vh);aspect-ratio:3/2;max-height:100%;background:center/100% 100% no-repeat;overflow:hidden;container-type:inline-size}.fm-b-top{position:absolute;left:1.5%;top:1.5%;width:34%;aspect-ratio:1200/297;background:center/100% 100% no-repeat;display:flex;align-items:center;gap:3%;padding:0 4% 0 3%;box-sizing:border-box;z-index:4}',
    '.fm-b-top .fm-stat{font-size:clamp(11px,1.5cqw,22px)}.fm-b-top .fm-stat img{width:clamp(18px,2.4cqw,36px);height:clamp(18px,2.4cqw,36px)}.fm-b-top .fm-exp{width:clamp(50px,7cqw,110px);height:clamp(10px,1.2cqw,18px)}.fm-b-face{width:clamp(26px,4cqw,60px);height:clamp(26px,4cqw,60px);object-fit:contain;font-size:26px}',
    '.fm-b-weather{position:absolute;left:46%;top:1%;width:7%;z-index:4}.fm-b-field{position:absolute;inset:0;z-index:1}.fm-b-field .fm-plot{width:13.2%;aspect-ratio:512/336;background-color:transparent}.fm-b-field .fm-crop{bottom:26%;width:60%}.fm-b-field .fm-pest{left:10%;top:6%;width:26%}.fm-b-field .fm-pest[data-pest="bug"]{left:auto;right:14%;top:18%;width:20%}',
    '.fm-b-field .fm-chip{bottom:2%;font-size:clamp(9px,.95cqw,14px)}.fm-b-field .fm-prog{bottom:14%}.fm-b-sign{width:34%;left:33%;bottom:34%}.fm-b-pig{position:absolute;left:79%;top:31%;width:7%;z-index:3;object-fit:contain;font-size:34px}',
    '.fm-b-helper{position:absolute;left:84%;top:15%;width:13%;z-index:4;border:0;padding:4px 6px;border-radius:10px;font:inherit;font-size:clamp(10px,1cqw,15px);font-weight:900;color:#6b4a2b;',
    'background:#fff6dc;box-shadow:0 1px 0 rgba(107,74,43,.3);cursor:pointer;display:flex;align-items:center;gap:4px;justify-content:center}.fm-b-helper img{width:30%;object-fit:contain}.fm-b-helper:disabled{cursor:default}',
    '.fm-b-bar{position:absolute;left:1.5%;right:1.5%;bottom:1.5%;aspect-ratio:1200/110;background:center/100% 100% no-repeat;display:flex;align-items:center;gap:1%;padding:0 2%;box-sizing:border-box;z-index:4}.fm-b-bar .fm-slot{width:6.2%;height:auto;aspect-ratio:1;padding:.7%}.fm-b-gap{flex:1}.fm-b-bar .fm-sign{width:9.5%;aspect-ratio:256/101;white-space:nowrap;padding:0 2px;font-size:clamp(9px,1cqw,15px)}.fm-b-bar .fm-sign img{width:30%;height:auto}',
    '.fm-b-tip{position:absolute;left:50%;bottom:12%;transform:translateX(-50%);padding:3px 12px;border-radius:12px;background:rgba(255,248,227,.92);font-size:clamp(11px,1.1cqw,16px);font-weight:900;z-index:5;pointer-events:none}.fm-b-pop{position:absolute;right:2%;bottom:12%;width:38%;max-height:70%;overflow:auto;z-index:6}',
    '.fm-effect{position:absolute;inset:0;pointer-events:none;display:grid;place-items:center;font-size:22px;z-index:2;animation:fm-pop .6s cubic-bezier(.4,0,.2,1) both}@keyframes fm-pop{0%{opacity:0;transform:translateY(6px) scale(.7)}35%{opacity:1;transform:translateY(-6px) scale(1.1)}100%{opacity:0;transform:translateY(-18px) scale(.9)}}',
    '@media (prefers-reduced-motion:reduce){.fm-effect,.fm-plot,.fm-main,.fm-sign,.fm-slot{animation:none!important;transition:none!important}.fm-effect{opacity:0}}',
  ].join('')
  function ensureStyle() {
    if (document.getElementById(styleId)) return
    var style = document.createElement('style'); style.id = styleId; style.textContent = css; document.head.appendChild(style)
  }
  /** 扩展自带图片的地址；老宿主没有 app.asset 时给空串，界面退回 emoji。 */
  function art(app, name) { return typeof app.asset === 'function' ? app.asset(name + '.webp') : '' }
  function bg(app, node, name) { var url = art(app, name); if (url) node.style.backgroundImage = 'url("' + url + '")'; return node }
  function picture(app, className, url, fallback) {
    if (!url) return app.el('span', className, fallback || '')
    var node = app.el('img', className); node.src = url; node.alt = ''; return node
  }
  function img(app, className, name, fallback) { return picture(app, className, art(app, name), fallback) }
  function put(parent, child) { parent.appendChild(child); return child }
  function button(app, className, attrs, label, onClick) { var node = app.button(className, attrs, onClick); node.textContent = label; return node }
  function pigOf(app, className) { return picture(app, className, typeof app.pigArt === 'function' ? app.pigArt() : null, '🐖') }
  function say(app, text) { tip = text; app.rerender() }
  function goShop(app) { if (typeof app.openShop === 'function') app.openShop(); else say(app, '去商店的菜园货架买') }
  function effect(index, emoji) { effects[index] = { emoji: emoji, at: Date.now() } }
  function attachEffect(app, card, index) {
    var current = effects[index]
    if (!current) return
    var elapsed = Date.now() - current.at
    if (elapsed >= 650) { delete effects[index]; return }
    put(card, app.el('span', 'fm-effect', current.emoji)).style.animationDelay = '-' + Math.max(0, elapsed) + 'ms'
  }
  function shortTime(ms) {
    var minutes = Math.ceil(ms / 60000)
    return minutes < 60 ? minutes + ' 分钟' : Math.floor(minutes / 60) + ' 小时' + (minutes % 60 ? ' ' + minutes % 60 + ' 分' : '')
  }
  function owns(data, key) { return (data.tools || []).some(function (tool) { return tool.key === key && tool.owned }) }
  function seedOf(data, key) { return (data.seeds || []).find(function (seed) { return seed.key === key }) || null }
  function firstSeed(data) { return (data.seeds || []).find(function (seed) { return seed.count > 0 && !seed.locked }) || null }
  function seedInHand(data) { return hand.kind === 'seed' ? seedOf(data, hand.key) : firstSeed(data) }
  function pestsOf(plot) { return plot.pests || [] }
  function pestText(plot, sep) { return pestsOf(plot).map(function (p) { return PEST_LABEL[p] }).join(sep) }
  /** 这块地上的作物图：种子、发芽共用，后四个阶段每种作物各一张，枯萎共用。 */
  function cropArt(plot) { return plot.withered ? 'withered' : plot.stage === 'seed' || plot.stage === 'sprout' ? plot.stage : 'crop-' + plot.crop + '-' + plot.stage }
  /** 地块数一数，给主按钮、提示行、小农场的字条用。 */
  function survey(data, from, to) {
    var pick = function (test) { var out = []; for (var i = from; i < to; i += 1) if (test(data.plots[i])) out.push(i); return out }
    return {
      ripe: pick(function (p) { return p.ripe }), pests: pick(function (p) { return pestsOf(p).length > 0 && !p.ripe }),
      withered: pick(function (p) { return p.withered }), empty: pick(function (p) { return p.empty }),
      soonest: data.plots.slice(from, to).reduce(function (min, p) { return p.remainingMs > 0 ? Math.min(min, p.remainingMs) : min }, Infinity),
    }
  }
  /** 手里的种子 / 化肥用完了就放下（空手 = 手套）。 */
  function syncHand(data) {
    var seed = hand.kind === 'seed' ? seedOf(data, hand.key) : null
    if (hand.kind === 'seed' && (!seed || seed.count < 1 || seed.locked)) hand = AUTO
    var fert = hand.kind === 'fert' ? (data.fert || []).find(function (f) { return f.key === hand.key }) : null
    if (hand.kind === 'fert' && (!fert || fert.count < 1)) hand = AUTO
  }
  function act(app, index, emoji, op, payload) { if (emoji) effect(index, emoji); app.send(op, payload) }
  /** 点一块地：按手里拿的东西做事；拿手套（auto）时做这块地现在该做的事。 */
  function clickPlot(app, data, index) {
    var plot = data.plots[index]
    var shovel = hand.kind === 'shovel'
    if (plot.wild) {
      if (!plot.next) return say(app, '要先开前一块荒地')
      if (data.balance < data.reclaimPrice) return say(app, '开垦要 ' + data.currency.emoji + ' ' + data.reclaimPrice)
      return app.send('unlock', { plot: index })
    }
    if (shovel && plot.empty) return say(app, '这块地是空的')
    if (shovel && !plot.withered && confirmClear !== index) { confirmClear = index; return say(app, '正在长的' + plot.label + '，再点一次铲掉') }
    if (shovel) { confirmClear = null; return act(app, index, '🪏', 'clear', plot.withered ? { plot: index } : { plot: index, force: true }) }
    confirmClear = null
    if (hand.kind === 'care') {
      if (pestsOf(plot).indexOf(hand.key) >= 0) return act(app, index, hand.key === 'dry' ? '💧' : '✨', 'care', { plot: index, kind: hand.key })
      return say(app, '这块地没有' + PEST_LABEL[hand.key])
    }
    if (hand.kind === 'fert') return plot.empty || plot.ripe || plot.withered ? say(app, '化肥要施在正在长的地上') : app.send('fertilize', { plot: index, item: hand.key })
    if (plot.empty) { var seed = seedInHand(data); return seed ? act(app, index, '🌱', 'plant', { plot: index, item: seed.key }) : goShop(app) }
    if (plot.ripe) return act(app, index, '✨', 'harvest', { plot: index })
    if (plot.withered) return act(app, index, '🪏', 'clear', { plot: index })
    if (pestsOf(plot).length) return act(app, index, '✨', 'care', { plot: index })
    say(app, plot.label + (plot.seasons > 1 ? ' 第 ' + plot.season + '/' + plot.seasons + ' 季' : '') + ' · ' + (plot.helperNote ? plot.helperNote + ' · ' : '') + '还要 ' + shortTime(plot.remainingMs))
  }
  /** 一块地的按钮：土、作物、灾害、提示条、进度。 */
  function plotCard(app, data, index, kind) {
    var plot = data.plots[index]
    var card = app.button('fm-plot' + (plot.ripe ? ' fm-ripe' : ''), { 'data-farm-plot': String(index), 'aria-label': plotLabel(plot) }, function () { clickPlot(app, data, index) })
    if (plot.wild) {
      bg(app, card, kind === 'big' ? 'big-plot-wild' : 'small-plot-farmed')
      if (plot.next && kind === 'big') put(card, img(app, 'fm-b-sign', 'big-sign-expand', '🪧'))
      if (plot.next) put(card, app.el('span', 'fm-chip', '开垦 ' + data.currency.emoji + ' ' + data.reclaimPrice))
      return card
    }
    bg(app, card, kind + '-plot-' + (pestsOf(plot).indexOf('dry') >= 0 ? 'dry' : 'farmed'))
    if (plot.empty) return card
    put(card, img(app, 'fm-crop', cropArt(plot), plot.emoji))
    pestsOf(plot).forEach(function (pest) { if (PEST_ART[pest]) put(card, img(app, 'fm-pest', PEST_ART[pest], pest === 'weed' ? '🌿' : '🐛')).setAttribute('data-pest', pest) })
    var chip = plot.ripe ? '收 ' + plot.yield + ' 个' : plot.withered ? '枯了' : pestText(plot, '·')
    if (chip) put(card, app.el('span', 'fm-chip', chip))
    else put(put(card, app.el('span', 'fm-prog')), app.el('i')).style.width = Math.round(plot.progress * 100) + '%'
    attachEffect(app, card, index)
    return card
  }
  function plotLabel(plot) {
    if (plot.wild) return plot.next ? '荒地，点一下开垦' : '荒地'
    if (plot.empty) return '空地'
    return plot.label + (plot.withered ? ' 枯了' : plot.ripe ? ' 熟了' : pestsOf(plot).length ? ' ' + pestText(plot, '、') : '')
  }
  /** 等级、经验条、菜币。 */
  function stats(app, data, box) {
    var level = put(box, app.el('span', 'fm-stat'))
    put(level, app.el('b', null, 'Lv.' + data.level))
    var exp = put(level, bg(app, app.el('span', 'fm-exp'), 'ui-exp-frame'))
    exp.setAttribute('title', '经验 ' + data.exp + ' / ' + data.need)
    put(exp, bg(app, app.el('i'), 'ui-exp-fill')).style.width = Math.max(4, Math.round(data.exp / data.need * 90)) + '%'
    var coin = put(box, app.el('span', 'fm-stat'))
    put(coin, img(app, null, 'coin', data.currency.emoji))
    put(coin, app.el('span', null, String(data.balance)))
  }
  /** 工具格：选中就拿在手里；锁着的一键工具点了去商店。 */
  function toolSlot(app, spec) {
    var pressed = !!spec.hand && hand.kind === spec.hand.kind && hand.key === spec.hand.key
    var node = bg(app, app.button('fm-slot', { 'data-farm-tool': spec.key, 'aria-pressed': String(pressed), 'data-locked': String(!!spec.locked), 'aria-label': spec.label, title: spec.label }, function () {
      confirmClear = null
      if (spec.locked) return goShop(app)
      if (spec.run) return spec.run()
      hand = pressed ? AUTO : spec.hand
      say(app, pressed ? null : spec.hint || null)
    }), 'ui-slot')
    put(node, img(app, null, spec.art, spec.emoji))
    if (spec.locked) put(node, app.el('span', 'fm-lock', '🔒'))
    else if (spec.count > 0) put(node, app.el('i', 'fm-n', String(spec.count)))
    return node
  }
  /** 木牌按钮（仓库、商店、大小农场）。 */
  function sign(app, attrs, artName, emoji, label, count, onClick) {
    var node = bg(app, app.button('fm-sign', attrs, onClick), 'ui-button')
    put(node, img(app, null, artName, emoji))
    put(node, app.el('span', null, label))
    if (count > 0) put(node, app.el('span', 'fm-n', String(count)))
    return node
  }
  function stockSign(app, data) {
    var stocked = data.harvest.reduce(function (sum, crop) { return sum + crop.count }, 0)
    return sign(app, { 'data-farm-panel': 'stock', 'aria-expanded': String(popup === 'stock'), 'aria-label': '仓库' }, 'ui-storage', '🧺', '仓库', stocked, function () { popup = popup === 'stock' ? null : 'stock'; app.rerender() })
  }
  function shopSign(app) { return sign(app, { 'data-farm-shop': 'shelf', 'aria-label': '商店' }, 'ui-shop', '', '商店', 0, function () { goShop(app) }) }
  var CARE_TOOLS = [
    { key: 'can', art: 'tool-can', emoji: '💧', label: '浇水壶：点干了的地', hand: { kind: 'care', key: 'dry' }, hint: '点干了的地浇水' },
    { key: 'weedkiller', art: 'tool-weedkiller', emoji: '🌿', label: '除草剂：点长草的地', hand: { kind: 'care', key: 'weed' }, hint: '点长草的地除草' },
    { key: 'pesticide', art: 'tool-pesticide', emoji: '🐛', label: '杀虫剂：点生虫的地', hand: { kind: 'care', key: 'bug' }, hint: '点生虫的地杀虫' },
    { key: 'gloves', art: 'tool-gloves', emoji: '🧤', label: '手套：熟了收、有毛病治、枯了铲', hand: AUTO },
  ]
  function careTools(app, data, to, ripe) {
    return CARE_TOOLS.map(function (spec) {
      var n = 0
      for (var i = 0; i < to; i += 1) if (pestsOf(data.plots[i]).indexOf(spec.hand.key) >= 0) n += 1
      return toolSlot(app, Object.assign({}, spec, { count: spec.hand.kind === 'care' ? n : ripe }))
    })
  }
  /** 弹层里的一颗按钮（种子、化肥、作物）。 */
  function chip(app, attrs, artName, emoji, text, onClick) {
    var node = app.button('fm-cropbtn', attrs, onClick)
    put(node, img(app, null, artName, emoji))
    put(node, app.el('span', null, text))
    return node
  }
  /** 种子 / 化肥 / 仓库弹层。 */
  function renderPopup(app, data, box) {
    var head = put(box, app.el('div', 'fm-section'))
    var list = app.el('div', 'fm-stock')
    if (popup === 'seeds') {
      put(head, app.el('span', null, '拿哪种种子'))
      put(head, button(app, 'dp-mini', { 'data-farm-shop': 'seed' }, '去买', function () { goShop(app) }))
      var seeds = data.seeds.filter(function (seed) { return seed.count > 0 })
      if (!seeds.length) put(list, app.el('div', 'fm-note', '还没有种子。'))
      seeds.forEach(function (seed) {
        put(list, chip(app, { 'data-farm-seed': seed.key, 'aria-pressed': String(hand.kind === 'seed' && hand.key === seed.key) }, 'produce-' + seed.key, seed.emoji, seed.label + ' ×' + seed.count, function () {
          hand = { kind: 'seed', key: seed.key }; popup = null; say(app, '点空地种' + seed.label)
        })).disabled = seed.locked
      })
    } else if (popup === 'fert') {
      put(head, app.el('span', null, '化肥'))
      data.fert.forEach(function (fert, i) {
        put(list, chip(app, { 'data-farm-fert': fert.key, 'aria-pressed': String(hand.kind === 'fert' && hand.key === fert.key) }, 'fert-' + (i + 1), '🧪', fert.label + ' ×' + fert.count + ' · 多长 ' + fert.hours + ' 小时', function () {
          if (fert.count < 1) return goShop(app)
          hand = { kind: 'fert', key: fert.key }; popup = null; say(app, '点正在长的地施' + fert.label)
        }))
      })
    } else {
      var crops = data.harvest.filter(function (crop) { return crop.count > 0 })
      var worth = crops.reduce(function (sum, crop) { return sum + crop.count * crop.sell }, 0)
      put(head, app.el('span', null, '仓库'))
      if (worth > 0) put(head, button(app, 'dp-mini', { 'data-farm-sell-everything': 'true' }, '全部卖掉 ' + data.currency.emoji + ' ' + worth, function () { openCrop = null; app.send('sell', { item: '*' }) }))
      if (data.helper && data.helper.stored > 0) put(box, button(app, 'dp-mini', { 'data-farm-helper': 'collect' }, '把帮工谷仓的 ' + data.helper.stored + ' 个搬进来', function () { app.send('collect', {}) }))
      if (!crops.length) put(list, app.el('div', 'fm-note', '还没有收成。'))
      crops.forEach(function (crop) {
        var open = openCrop === crop.key
        put(list, chip(app, { 'data-farm-crop': crop.key, 'aria-expanded': String(open), 'aria-label': crop.label + ' ' + crop.count + ' 个' }, 'produce-' + crop.key, crop.emoji, '×' + crop.count, function () { openCrop = open ? null : crop.key; app.rerender() }))
        if (!open) return
        var sell = put(list, app.el('div', 'fm-sellbar'))
        put(sell, app.el('span', 'fm-note', crop.label + ' · 一个卖 ' + crop.sell))
        put(sell, button(app, 'dp-mini', { 'data-farm-sell': crop.key }, '卖一个', function () { app.send('sell', { item: crop.key }) }))
        if (crop.count > 1) put(sell, button(app, 'dp-mini', { 'data-farm-sell-all': crop.key }, '全卖 ' + data.currency.emoji + ' ' + crop.count * crop.sell, function () { openCrop = null; app.send('sell', { item: crop.key, count: crop.count }) }))
        if (crop.food) put(sell, button(app, 'dp-mini dp-mini-plain', { 'data-farm-store': crop.key }, '放进背包 · ' + crop.foodLabel, function () { app.send('store', { item: crop.key }) }))
      })
    }
    put(box, list)
  }
  // ---- 小农场（面板） ----
  /** 主按钮：收获 > 照料 > 铲枯萎 > 种 > 去买种子；买了对应一键工具就一次做完全部地，没有就做一块。 */
  function mainAction(data, look, all) {
    var one = function (list, label, op, fx, rest) { return { label: label, sub: list.length > 1 ? '还有 ' + (list.length - 1) + ' 块' + rest : '', op: op, payload: { plot: list[0] }, plot: list[0], fx: fx } }
    if (look.ripe.length) return owns(data, 'sickle') && all.ripe.length > 1 ? { label: '收菜 ' + all.ripe.length + ' 块', op: 'harvestAll', payload: {} } : one(look.ripe, '收菜', 'harvest', '✨', '熟了')
    if (look.pests.length) return owns(data, 'sprayer') && all.pests.length > 1 ? { label: '照料 ' + all.pests.length + ' 块', op: 'careAll', payload: {} } : one(look.pests, '照料', 'care', '✨', '')
    if (look.withered.length) return owns(data, 'rake') && all.withered.length > 1 ? { label: '铲掉 ' + all.withered.length + ' 块枯苗', op: 'clearAll', payload: {} } : one(look.withered, '铲枯苗', 'clear', '🪏', '枯了')
    if (look.empty.length) {
      var seed = seedInHand(data)
      if (!seed) return { label: '去买种子', shop: true }
      if (owns(data, 'planter') && all.empty.length > 1) return { label: '种满' + seed.label, sub: all.empty.length + ' 块空地', op: 'plantAll', payload: { item: seed.key } }
      return { label: '种' + seed.label, op: 'plant', payload: { plot: look.empty[0], item: seed.key }, plot: look.empty[0], fx: '🌱' }
    }
    return { label: '都在长', sub: look.soonest < Infinity ? '最快 ' + shortTime(look.soonest) : '', idle: true }
  }
  function renderSmall(app, data) {
    var root = app.el('div', 'fm')
    var shown = Math.min(SMALL_PLOTS, data.total)
    var all = survey(data, 0, data.unlocked)
    var scene = put(root, bg(app, app.el('div', 'fm-s-scene'), 'bg-small'))
    var inner = put(put(scene, bg(app, app.el('div', 'fm-s-board'), 'ui-small-scoreboard')), app.el('div', 'fm-s-board-in'))
    stats(app, data, inner)
    put(inner, img(app, 'fm-s-weather', 'weather-' + data.weather, WEATHER[data.weather]))
    if (typeof app.openBig === 'function') put(scene, bg(app, button(app, 'fm-s-big', { 'data-farm-big': 'open', 'aria-label': '打开大农场' }, '大农场', function () { app.openBig() }), 'ui-hang-sign'))
    var field = put(scene, app.el('div', 'fm-s-field'))
    for (var index = 0; index < shown; index += 1) {
      var card = put(field, plotCard(app, data, index, 'small'))
      card.style.left = (index % 2 ? 52 : 0) + '%'
      card.style.top = Math.floor(index / 2) * 34 + '%'
    }
    put(scene, pigOf(app, 'fm-s-pig'))
    // 第 7 块以后的地（开了的）在小农场里看不见：用一行字报一下。
    if (data.unlocked > shown) {
      var rest = survey(data, shown, data.unlocked)
      var parts = [[rest.ripe, ' 块熟了'], [rest.pests, ' 块要照料'], [rest.withered, ' 块枯了'], [rest.empty, ' 块空着']].filter(function (p) { return p[0].length }).map(function (p) { return p[0].length + p[1] })
      put(root, bg(app, app.el('div', 'fm-s-note', '另外 ' + (data.unlocked - shown) + ' 块地：' + (parts.join('，') || '都在长')), 'ui-note'))
    }
    if (tip) put(root, app.el('div', 'fm-tip', tip))
    tip = null
    var owned = data.seeds.filter(function (seed) { return seed.count > 0 && !seed.locked })
    var pocket = owned.length ? put(root, app.el('div', 'fm-pocket')) : app.el('div')
    owned.forEach(function (seed) {
      put(pocket, toolSlot(app, { key: 'seed-' + seed.key, art: 'produce-' + seed.key, emoji: seed.emoji, label: seed.label + '种子 ' + seed.count + ' 颗', hand: { kind: 'seed', key: seed.key }, count: seed.count, hint: '点空地种' + seed.label }))
    })
    put(pocket, bg(app, button(app, 'fm-slot', { 'data-farm-shop': 'seed', 'aria-label': '买种子', title: '买种子' }, '＋', function () { goShop(app) }), 'ui-slot'))
    var plank = put(root, bg(app, app.el('div', 'fm-s-plank'), 'ui-small-plank'))
    var tools = put(plank, app.el('div', 'fm-s-tools'))
    careTools(app, data, shown, 0).forEach(function (node) { put(tools, node) })
    var row = put(plank, app.el('div', 'fm-s-acts'))
    put(row, stockSign(app, data))
    var action = mainAction(data, survey(data, 0, shown), all)
    var main = put(row, bg(app, app.button('fm-main', { 'data-farm-main': action.op || (action.shop ? 'shop' : 'idle') }, function () {
      if (action.shop) return goShop(app)
      if (!action.idle) act(app, action.plot, action.fx, action.op, action.payload)
    }), 'ui-main'))
    put(main, app.el('span', null, action.label))
    if (action.sub) put(main, app.el('small', null, action.sub))
    main.disabled = action.idle === true
    put(row, shopSign(app))
    if (popup) renderPopup(app, data, put(root, app.el('div', 'fm-pop')))
    app.content.appendChild(root)
  }
  // ---- 大农场（单独窗口） ----
  /** 18 块菱形地的位置（照原版 InstallFace.farmland 的公式：3 列 × 6 行斜着排），百分比，以地块左上角计。 */
  function bigSpot(index) {
    var col = index % 3
    var row = Math.floor(index / 3)
    return { left: 36.5 - col * 6.6 + row * 6.6, top: 28 + row * 5.6 + col * 5.6 }
  }
  function renderBig(app, data) {
    var root = app.el('div', 'fm fm-big')
    var scene = put(root, bg(app, app.el('div', 'fm-b-scene'), 'bg-big'))
    var top = put(scene, bg(app, app.el('div', 'fm-b-top'), 'ui-big-topbar'))
    put(top, pigOf(app, 'fm-b-face'))
    stats(app, data, top)
    put(scene, img(app, 'fm-b-weather', 'weather-' + data.weather, WEATHER[data.weather]))
    var field = put(scene, app.el('div', 'fm-b-field'))
    for (var index = 0; index < data.total; index += 1) {
      var card = put(field, plotCard(app, data, index, 'big'))
      var spot = bigSpot(index)
      card.style.left = spot.left + '%'
      card.style.top = spot.top + '%'
      card.style.zIndex = String(data.plots[index].next ? 30 : 1 + Math.floor(index / 3) + index % 3)
    }
    put(scene, pigOf(app, 'fm-b-pig'))
    // 帮工猪住在右上角的猪窝（替原版的狗窝）
    var helper = data.helper
    if (helper) {
      var label = !helper.hired ? '雇帮工猪' : helper.full ? '谷仓满了' : helper.missing.length ? '缺' + helper.missing.join('、') + '种子' : helper.stored > 0 ? '帮工收了 ' + helper.stored + ' 个' : '帮工 · ' + helper.plots + ' 块地'
      var badge = put(scene, app.button('fm-b-helper', { 'data-farm-helper': helper.hired ? 'collect' : 'hire', 'aria-label': label }, function () {
        if (!helper.hired) app.send('hire', {})
        else if (helper.stored > 0 || helper.full) app.send('collect', {})
        else if (helper.missing.length) goShop(app)
      }))
      put(badge, pigOf(app, null))
      put(badge, app.el('span', null, label))
      badge.disabled = helper.hired && helper.stored === 0 && !helper.full && helper.missing.length === 0
    }
    // 底部工具栏：拿在手里的工具 | 一键工具 | 商店、仓库、小农场
    var bar = put(scene, bg(app, app.el('div', 'fm-b-bar'), 'ui-big-toolbar'))
    var all = survey(data, 0, data.unlocked)
    var toggle = function (name) { return function () { popup = popup === name ? null : name; app.rerender() } }
    put(bar, toolSlot(app, { key: 'seedbag', art: 'tool-seedbag', emoji: '🌰', label: '种子袋', run: toggle('seeds'), count: hand.kind === 'seed' ? (seedOf(data, hand.key) || { count: 0 }).count : 0 }))
    put(bar, toolSlot(app, { key: 'shovel', art: 'tool-shovel', emoji: '🪏', label: '铁锹：铲地', hand: { kind: 'shovel', key: null }, hint: '点地铲掉（枯苗直接铲，长着的要点两次）', count: all.withered.length }))
    careTools(app, data, data.unlocked, all.ripe.length).forEach(function (node) { put(bar, node) })
    put(bar, toolSlot(app, { key: 'fert', art: 'fert-1', emoji: '🧪', label: '化肥', run: toggle('fert'), count: data.fert.reduce(function (s, f) { return s + f.count }, 0) }))
    put(bar, app.el('span', 'fm-b-gap'))
    ONE_CLICK.forEach(function (spec) {
      var owned = owns(data, spec.key)
      put(bar, toolSlot(app, {
        key: spec.key, art: 'tool-' + spec.key, label: owned ? spec.label : spec.label + '（去商店买' + spec.tool + '）', locked: !owned,
        count: { harvestAll: all.ripe, careAll: all.pests, clearAll: all.withered, plantAll: all.empty }[spec.op].length,
        run: function () {
          if (spec.op !== 'plantAll') return app.send(spec.op, {})
          var seed = seedInHand(data)
          return seed ? app.send('plantAll', { item: seed.key }) : goShop(app)
        },
      }))
    })
    put(bar, app.el('span', 'fm-b-gap'))
    put(bar, shopSign(app))
    put(bar, stockSign(app, data))
    if (typeof app.closeBig === 'function') put(bar, sign(app, { 'data-farm-big': 'close', 'aria-label': '回小农场' }, 'ui-small-farm', '', '小农场', 0, function () { app.closeBig() }))
    var line = tip || (hand.kind === 'seed' ? '手里：' + (seedOf(data, hand.key) || {}).label + '种子，点空地种' : '')
    if (line) put(scene, app.el('div', 'fm-b-tip', line))
    tip = null
    if (popup) renderPopup(app, data, put(scene, app.el('div', 'fm-pop fm-b-pop')))
    app.content.appendChild(root)
  }
  function render(app) {
    ensureStyle()
    var data = app.data
    if (!data || !Array.isArray(data.plots) || !data.plots.length || data.plots[0] === null || typeof data.plots[0] !== 'object') { app.content.appendChild(app.el('div', 'dp-empty', '菜园还在准备……')); return }
    if (!data.currency) data.currency = { emoji: '🪙', label: '金币' }
    syncHand(data)
    if (app.mode === 'big') renderBig(app, data)
    else renderSmall(app, data)
  }
  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('farm', { render: render })
})()
