// 菜园：大小窗口共用已确认的平涂纸感场景、地块、详情与工具，只是两种看法（用户 2026-10-12）。
// 小农场顶栏左边进大农场、右边菜币（唯一换币入口），底部只有工具 / 背包 / 商店；工具是带 aria-expanded 的下方抽屉，选中后收起回菜地。
// 大农场保留 6×3 地块，详情、等级与图文工具在菜地下方；不挪到侧栏。
// 场景与画风按用户 2026-10-24 选定的 A 方案（平涂纸片）；数值、台词、成熟时间都只看宿主快照，页面不自己算。
;(function () {
  'use strict'
  /** 手里拿的东西：auto（手套：只收成熟作物）、seed、care（浇水 / 除草 / 杀虫）、shovel、fert。 */
  var hand = { kind: 'auto', key: null }
  var popup = null, revealTools = false, drawerOpen = false, openCrop = null, selectedPlot = null
  var confirmClear = null
  var tip = null
  var tipAt = 0, tipPlot = null, shopTab = 'seed', bagTab = 'seed', purchase = null, quantity = 1
  var currentApp = null, keyboardBound = false, pendingAction = null, cancelLayer = null, inflight = null, lessonRewardAt = 0, fx = null, modalOpen = false, modalFocus = null, modalReturn = null
  var styleId = 'dsh-piggy-farm-style-5', SMALL_PLOTS = 6
  var scrollMemory = {}, currentKey = '', watchingContent = false, lastRoot = null
  var PEST_LABEL = { dry: '干了', weed: '长草', bug: '生虫' }
  var ONE_CLICK = [{ key: 'sickle', op: 'harvestAll', label: '一键收获', tool: '收割镰' }, { key: 'sprayer', op: 'careAll', label: '一键照料', tool: '喷雾桶' },
    { key: 'rake', op: 'clearAll', label: '一键铲除', tool: '平地耙' }, { key: 'planter', op: 'plantAll', label: '一键播种', tool: '播种器' }]
  var AUTO = { kind: 'auto', key: null }
  var css = [
    ".fm{--animal-primary:var(--ac-primary,#19c8b9);--animal-text:var(--ac-text,#794f27);--animal-text-body:var(--ac-text-body,#725d42);--animal-bg:var(--ac-bg,#f8f8f0);--animal-bg-content:var(--ac-bg-content,#fff8e3);--animal-border:var(--ac-border,#c4b89e);--animal-ease:var(--ac-ease,cubic-bezier(.4,0,.2,1));display:flex;flex-direction:column;gap:6px;position:relative;min-width:0;font:500 12px/1.35 var(--ac-font,sans-serif);color:var(--animal-text-body);background:var(--animal-bg);font-variant-numeric:tabular-nums}" + ".fm *{box-sizing:border-box}.fm img{object-fit:contain;pointer-events:none}.fm button:not(.dp-drill-back),.fm input{font:inherit;font-weight:700;cursor:pointer;min-width:32px;min-height:32px}.fm button:disabled{cursor:default}.fm button:not(.dp-drill-back):focus-visible,.fm input:focus-visible{outline:2px solid var(--animal-primary);outline-offset:2px}" + ".fm .dp-btn{padding:6px 12px}.fm .dp-mini{padding:8px 14px}.fm .fm-main,.fm .fm-confirm{color:var(--ac-bg-content,#fff8e3)}.fm .fm-main:disabled,.fm .fm-confirm:disabled{color:var(--ac-text-disabled,#a99d86)}",
    ".fm-s-header{display:flex;align-items:center;gap:8px;min-height:32px}.fm[data-farm-integrated]>.fm-s-header{display:none}.fm-garden-title{font-size:20px;color:var(--animal-text);margin-right:auto}.fm-stat{display:flex;align-items:center;gap:4px;white-space:nowrap;font-size:12px}.fm-stat>img{width:20px;height:20px}.fm-exp{display:block;width:32px;height:8px;border-radius:var(--ac-pill,50px);background:var(--ac-border-light,#e5dcc6);overflow:hidden}.fm-exp>i{display:block;height:100%;background:var(--ac-success,#87c96d)}.fm-s-header .fm-coin{margin-left:auto}.fm-big-open{font-size:11px;padding:5px 10px}" + ".dp-content:has(>.fm[data-farm-integrated])>.dp-drill{gap:6px;padding:8px 0 4px;margin-bottom:4px;align-items:center}.dp-content:has(>.fm[data-farm-integrated])>.dp-drill .dp-drill-title{margin-right:auto;flex:none}.dp-content:has(>.fm[data-farm-integrated] [data-farm-overlay])>.dp-drill .dp-drill-back,.dp-content:has(>.fm[data-farm-integrated] .fm-mask)>.dp-drill .dp-drill-back{display:none}.dp-content:has(>.fm[data-farm-integrated])>.dp-drill .fm-big-open{flex:none;padding:4px 6px}.dp-drill .fm-coin{margin-left:0;font-size:12px;padding:4px 6px;min-width:0;flex-shrink:1}.dp-drill .fm-coin>span{min-width:0;overflow:hidden;text-overflow:ellipsis}.dp-content:has(>.fm[data-farm-integrated])>.dp-drill .fm-coin>img{width:18px;height:18px}",
    ".fm-s-goal{min-height:20px;font-size:13px;font-weight:800;color:var(--animal-text);padding:0 2px}.fm-s-scene{position:relative;aspect-ratio:1.45;flex:none;min-height:0;border-radius:var(--ac-radius-card,20px);background:var(--ac-success-bg,#e4eed2);isolation:isolate;overflow:hidden}.fm-s-field{position:absolute;inset:23% 5% 7%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:minmax(0,1fr);gap:8px}" + ".fm-plot{position:relative;min-width:0;min-height:0!important;padding:0;border:0;background:none;box-shadow:none;border-radius:var(--ac-radius-sm,12px);cursor:pointer;color:var(--animal-text)}.fm-plot[data-farm-target=\"true\"]{outline:2px solid var(--animal-primary);outline-offset:2px;z-index:2}.fm-plot[data-farm-valid=\"true\"]{box-shadow:0 0 0 2px var(--ac-primary-bg,#d7f5ef)}.fm-soil{position:absolute;inset:0;width:100%;height:100%}.fm-crop,.fm-pest{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);width:58%;height:86%}.fm-pest{width:30%;height:45%;left:70%}.fm-bubble{position:absolute;top:-6px;right:0;width:22px;height:22px}.fm-ghost{position:absolute;inset:20%;opacity:.4;pointer-events:none}.fm-ghost>img{width:100%;height:100%}.fm-chip{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);background:var(--animal-bg-content);padding:2px 6px;border-radius:var(--ac-pill,50px);font-size:10px;white-space:nowrap}.fm .fm-expand{top:50%;bottom:auto;transform:translate(-50%,-50%);font-size:11px;padding:4px 8px;white-space:normal;max-width:100%;height:auto}" + ".fm-crop[src*=paper-stubble]{height:202.3%;width:auto;max-width:none;bottom:-64.8%}.fm-pest[src*=paper-weed]{height:97.4%;width:auto;max-width:none;bottom:-26.1%}.fm-s-field img.fm-soil{inset:auto;left:50%;bottom:-26.60%;width:auto;height:149.09%;max-width:none;border-radius:0;object-fit:contain;transform:translateX(-50.44%)}.fm-s-scene[data-paper=\"true\"] .fm-s-field .fm-plot:not([data-farm-soil=\"wild\"]){background:none;box-shadow:none}.fm-s-lesson .fm-crop[data-paper-stage=\"seed\"]{height:205.78%;width:auto;max-width:none;bottom:-34.86%;transform:translateX(-50.52%)}.fm-s-lesson .fm-crop[data-paper-stage=\"seedling\"]{height:83.41%;width:auto;max-width:none;bottom:-2.92%;transform:translateX(-51.31%)}.fm-s-lesson .fm-crop[data-paper-stage=\"ripe\"]{height:93.81%;width:auto;max-width:none;bottom:0.06%;transform:translateX(-51.09%)}" + ".fm-plot[data-farm-soil=\"wild\"]{background:none}.fm-plot[data-farm-soil=\"wild\"] .fm-soil{filter:grayscale(1) brightness(.52) saturate(.35);opacity:.95}.fm-plot[data-farm-soil=\"wild\"] .fm-lock{right:6px;top:6px;background-size:14px;opacity:.9}.fm-plot[data-farm-soil=\"wild\"] .fm-chip{background:var(--animal-bg-content)}",
    ".fm-s-detail{display:grid;grid-template-rows:24px 18px minmax(30px,auto);gap:4px;padding:2px 4px;min-height:80px;align-content:start}.fm-s-detail-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-height:24px;color:var(--animal-text)}.fm-s-detail-head>b{font-size:16px}.fm-s-phase{color:var(--animal-primary);font-weight:800}.fm-s-progress{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;min-height:18px;font-size:12px}.fm-s-track{display:block;height:10px;border-radius:var(--ac-pill,50px);background:var(--ac-border-light,#e5dcc6);overflow:hidden}.fm-s-track>i{display:block;height:100%;border-radius:inherit;background:var(--ac-success,#87c96d)}.fm-s-detail>small{display:block;font-size:11px;line-height:1.45;min-height:30px}.fm-s-note{font-size:11px;padding:2px 4px;min-height:18px}" + ".fm-s-plank{display:grid;gap:6px;border-top:2px solid var(--ac-border-light,#e5dcc6);padding-top:6px}.fm-s-acts{display:grid;grid-template-columns:minmax(0,1fr);align-items:stretch;gap:6px;padding-bottom:2px}.fm .fm-main{display:grid;place-content:center;gap:2px;min-height:54px;font-size:16px;line-height:1.25;white-space:normal}.fm-main>small{font-size:11px;min-height:14px}" + ".fm .fm-slot{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:auto;height:72px;min-width:0;padding:5px 2px;border-radius:var(--ac-radius-sm,12px);box-shadow:none}.fm .fm-slot>img{width:40px;height:40px;flex:none}.fm .fm-slot[aria-pressed=\"true\"]{border-color:var(--animal-primary);background:var(--ac-primary-bg,#d7f5ef)}.fm-tool-label{position:static;font-size:12px;line-height:1.2;white-space:nowrap}.fm-n,.fm-lock{position:absolute;right:2px;top:2px;font-size:10px;font-style:normal;line-height:16px;min-width:16px;height:16px;border-radius:var(--ac-pill,50px);background:var(--ac-warning-bg,#fff2c9);color:var(--animal-text);text-align:center;pointer-events:none}.fm-lock{background-size:12px;background-repeat:no-repeat;background-position:center}.fm-slot[data-locked=\"true\"]>img{opacity:.55}" + ".fm-dock{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;scroll-margin-top:46px}.fm .fm-dock-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:68px;font-size:12px;padding:6px 4px;white-space:nowrap}.fm-dock-btn>img{width:40px;height:40px}.fm-dock-btn[aria-expanded=\"true\"]{border-color:var(--animal-primary);background:var(--ac-primary-bg,#d7f5ef)}.fm-drawer{display:grid;gap:8px;border-top:2px solid var(--ac-border-light,#e5dcc6);padding-top:8px}.fm-advanced-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;overflow:visible;max-height:none}.fm .fm-advanced-grid>.fm-slot{height:72px;gap:4px}.fm-advanced-grid .fm-slot>img{width:40px;height:40px}.fm-advanced-actions{display:grid;gap:8px}.fm .fm-nav-action{width:100%;min-height:36px;font-size:12px}.fm-advanced-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.fm-meta{font-size:11px;color:var(--ac-text-2,#968468)}.fm .fm-weather{justify-self:start;padding:2px 8px;min-height:28px;font-size:11px}",
    ".fm-pop{position:relative;display:grid;align-content:start;gap:8px;width:100%;max-width:760px;margin:0 auto;padding:2px 0 0;min-height:0}.fm.fm-big>.fm-pop{flex:1}.fm:has(>.fm-pop)>:not(.fm-pop):not(.fm-mask):not(.fm-s-header),.fm:has(>.fm-mask)>:not(.fm-mask):not(.fm-s-header){display:none}.fm-paper{background:var(--animal-bg)}.fm-page-head{display:flex;align-items:center;gap:8px;min-height:34px}.fm-title{font-size:16px;line-height:1.4;color:var(--animal-text);font-weight:800;background:none;border:0}.fm-page-head>.fm-title{margin-right:auto}" + ".fm-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.fm-tabs-3{grid-template-columns:repeat(3,minmax(0,1fr))}.fm .fm-tab{padding:4px 2px;font-size:12px;min-width:0}.fm-tab>img{width:18px;height:18px;flex:none}.fm-tab[aria-selected=\"true\"]{background:var(--ac-primary-bg,#d7f5ef);border-color:var(--animal-primary)}" + ".fm-tiles{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:2px}.fm .fm-tile{padding:2px 0}.fm-tile .dp-tile-icon{width:44px;height:44px;border-radius:13px}.fm-tile .dp-tile-e{font-size:21px}.fm-tile .dp-tile-icon>img{width:32px;height:32px;flex:none}.fm-tile .fm-packet{width:34px;height:34px;justify-self:center}.fm-tile .fm-packet img{left:19%;top:26%;width:63%;height:58%}.fm-tile .dp-tile-n{white-space:normal;text-align:center;line-height:1.2;max-height:2.4em;overflow:hidden}.fm-tile .dp-tile-note{white-space:normal;text-align:center;line-height:1.2;margin-top:0}.fm-tile[aria-disabled=\"true\"] .dp-tile-icon,.fm-tile[data-dim=\"true\"] .dp-tile-icon{opacity:.55}.fm-tile[aria-pressed=\"true\"] .dp-tile-icon{outline:3px solid var(--animal-primary);outline-offset:2px}" + ".fm-shop-wallet{display:flex;align-items:center;gap:5px;font-size:12px}.fm-shop-coin{width:20px;height:20px}.fm-bag-tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.fm-bag-tools>.fm-note{flex:1;min-width:120px}.fm-note{font-size:11px;white-space:pre-line}.fm-sellbar{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px;border-radius:var(--ac-radius-sm,12px);background:var(--animal-bg-content)}.fm-sellbar>.fm-note{width:100%}",
    ".fm-packet{display:block;position:relative;aspect-ratio:247/256;background:center/contain no-repeat}.fm-packet img{position:absolute;left:19%;top:30%;width:63%;height:55%;object-fit:contain}" + ".fm-mask{position:relative;display:block;width:100%;max-width:760px;margin:0 auto;padding:0;background:none}.fm-buy,.fm-clear-confirm{position:relative;width:100%;max-height:none;padding:4px 0;overflow:visible;display:block}.fm-buy>.fm-title,.fm-clear-confirm>.fm-title{display:block;margin:0 0 12px}.fm-buy-columns{display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px;margin:8px 0}.fm-buy-art{width:64px;height:80px;object-fit:contain}.fm-buy-info{display:grid;gap:4px;overflow:visible}.fm-info-row{font-size:11px;line-height:1.5}.fm-stepper{display:flex;align-items:center;justify-content:center;gap:8px;margin:12px 0}.fm .fm-step{width:32px;height:32px;padding:0;font-size:20px}.fm-quantity{width:52px;height:32px;text-align:center;border:2px solid var(--animal-border);border-radius:var(--ac-pill,50px);background:var(--animal-bg-content);color:var(--animal-text)}.fm-total{text-align:center;font-size:14px;font-weight:800;margin:8px 0}.fm-modal-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.fm .fm-confirm,.fm .fm-cancel{min-height:36px}.fm-clear-art{display:block;width:80px;height:80px;object-fit:contain;margin:12px auto}.fm-big .fm-buy-columns{grid-template-columns:120px minmax(0,1fr);gap:24px}.fm-big .fm-buy-art{width:120px;height:140px}.fm-big .fm-info-row{font-size:14px}" + ".fm-toast{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);width:max-content;max-width:220px;pointer-events:none;padding:6px 10px;border:2px solid var(--animal-border);border-radius:var(--ac-radius-sm,12px);background:var(--animal-bg-content);font-size:12px;z-index:10;animation:fm-toast 2.4s var(--animal-ease) both}.fm>.fm-toast{bottom:40%}@keyframes fm-toast{0%,100%{opacity:0}10%,75%{opacity:1}}" + ".fm-plot[data-farm-fx]::after{position:absolute;content:\"\";left:50%;bottom:38%;font-size:26px;line-height:1;opacity:0;pointer-events:none;z-index:8;animation:fm-act .62s var(--animal-ease) var(--fm-fx-delay,0ms) both}.fm-plot[data-farm-fx=\"sow\"]::after{content:\"🌱\"}.fm-plot[data-farm-fx=\"water\"]::after{content:\"💧\"}.fm-plot[data-farm-fx=\"harvest\"]::after{content:\"✨\"}.fm-s-scene[data-farm-fx]::after{content:\"✨\";position:absolute;left:50%;top:50%;font-size:28px;pointer-events:none;animation:fm-act .62s var(--animal-ease) var(--fm-fx-delay,0ms) both}.fm-plot[data-farm-fx=\"sow\"]>.fm-crop{animation:fm-sprout .5s var(--animal-ease) var(--fm-fx-delay,0ms) both}@keyframes fm-sprout{0%{opacity:.2;translate:0 6px;scale:.8}100%{opacity:1;translate:0 0;scale:1}}@keyframes fm-act{0%{opacity:0;transform:translate(-50%,8px) scale(.7)}30%{opacity:1;transform:translate(-50%,-4px) scale(1.12)}100%{opacity:0;transform:translate(-50%,-20px) scale(.9)}}",
    ".fm-big{display:flex;flex-direction:column;width:100%;max-width:1180px;min-height:100%;height:100%;margin:0 auto;padding:16px;gap:10px;overflow:auto}.fm-big>*{flex-shrink:0}.fm-big .fm-s-header{min-height:40px}.fm-big .fm-exp{width:80px}.fm-b-body{display:flex;flex-direction:column;gap:10px;flex:1 0 auto;min-height:0}.fm-b-stage{display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0;flex:1 0 auto}.fm-big .fm-s-goal{font-size:16px;min-height:22px}.fm-big .fm-s-scene{flex:1 1 auto;min-height:340px;aspect-ratio:auto}.fm-big .fm-s-field{grid-template-columns:repeat(6,minmax(0,1fr));gap:14px 12px;height:70%;width:auto;aspect-ratio:2.9;max-width:90%;left:50%;right:auto;top:auto;bottom:7%;transform:translateX(-50%)}.fm-b-controls{display:flex;flex-direction:column;gap:8px;min-width:0;width:100%;max-width:760px;margin:0 auto;flex:none}.fm-b-controls .fm-s-detail,.fm-b-controls .fm-s-plank{width:100%}.fm-b-controls .fm-dock{width:100%;max-width:254px;align-self:center}.fm-b-controls .fm-advanced-grid{grid-template-columns:repeat(auto-fit,minmax(88px,1fr))}.fm-big .fm-s-detail{grid-template-rows:28px 20px minmax(34px,auto);min-height:94px}.fm-big .fm-s-detail-head>b{font-size:18px}.fm-big .fm-s-detail>small{font-size:12px}.fm-b-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.fm-big .fm-bubble{width:24px;height:24px}",
    "@media(max-width:820px){.fm-b-body{display:flex;flex-direction:column;flex:none;min-height:auto}.fm-b-stage,.fm-b-controls{flex:none;width:100%}.fm-big .fm-s-scene{min-height:640px;flex:none}.fm-big .fm-s-field{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;aspect-ratio:.725;max-width:100%;min-height:540px}.fm-big .fm-exp{width:32px}}" + "@media(prefers-reduced-motion:reduce){.fm *{animation:none!important;transition:none!important}.fm-plot[data-farm-fx]::after{opacity:0!important}.fm-s-scene[data-farm-fx]::after{opacity:0!important}.fm-toast{opacity:1}}",
    '.dp-content:has(>.fm[data-farm-integrated]){scrollbar-gutter:stable}.fm-big{scrollbar-gutter:stable}.dp-content:has(>.fm[data-farm-integrated]>.fm-pop)>.dp-drill,.dp-content:has(>.fm[data-farm-integrated]>.fm-mask)>.dp-drill,.fm:has(>.fm-pop)>.fm-s-header,.fm:has(>.fm-mask)>.fm-s-header{display:none}',
    '.fm-s-detail{position:relative}.fm-s-detail[data-has-action]>small{padding-right:98px}.fm-s-detail .fm-s-acts{position:absolute;right:4px;bottom:4px;display:block;padding:0;max-width:48%}.fm .fm-s-detail .fm-main{min-height:30px;font-size:12px;padding:4px 8px;display:block;white-space:normal}.fm-s-detail .fm-main>small{display:none}' + '.fm:not(.fm-big) .fm-dock-btn{min-height:56px;padding:4px;gap:2px}.fm:not(.fm-big) .fm-dock-btn>img{width:32px;height:32px}.fm .fm-s-field .fm-plot[data-farm-target="true"],.fm .fm-s-field .fm-plot:focus-visible{outline:none;box-shadow:none;border:0}.fm .fm-plot[data-farm-target="true"]::before,.fm .fm-plot:focus-visible::before{content:"";position:absolute;inset:-3px;box-sizing:border-box;border:2px solid var(--ac-bg-input,#fffbe7);border-radius:8px;box-shadow:inset 0 0 0 2px var(--animal-primary);mask:linear-gradient(var(--animal-primary) 0 0) left top/12px 12px no-repeat,linear-gradient(var(--animal-primary) 0 0) right top/12px 12px no-repeat,linear-gradient(var(--animal-primary) 0 0) right bottom/12px 12px no-repeat,linear-gradient(var(--animal-primary) 0 0) left bottom/12px 12px no-repeat;pointer-events:none;z-index:1}.fm-bubble{z-index:2}',
  ].join('')
  function ensureStyle() {
    var style = document.getElementById(styleId)
    if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style) }
    if (style.textContent !== css) style.textContent = css
  }
  /** 扩展自带图片的地址；老宿主没有 app.asset 时给空串，界面退回 emoji。 */
  var cssArt = {"ui-slot": true, "ui-button": true, "ui-main": true, "ui-note": true, "ui-small-plank": true, "ui-big-toolbar": true, "ui-big-topbar": true, "ui-exp-frame": true, "progress-track": true, "progress-fill": true, "shop-title": true, "buy-title": true, "pack-title": true, "shop-tab": true, "shop-tab-active": true, "shop-item": true, "shop-item-locked": true, "pack-slot": true, "pack-slot-selected": true, "info-row": true, "stepper-field": true, "btn-confirm": true, "btn-cancel": true, "status-chip": true, "status-chip-active": true, "big-sign-expand": true, "card-tail": true, "stepper-plus": true, "stepper-minus": true}
  var controlArt = { "lock-badge": "redraw-lock.webp", "weed": "paper-weed.png", "withered": "paper-stubble.png" }
  var paperControls = { 'tool-planter': 'paper-push-seeder.png', 'tool-rake': 'paper-leveling-rake.png', 'tool-sprayer': 'paper-backpack-sprayer.png', 'tool-sickle': 'paper-harvest-sickle.png', 'fert-1': 'paper-fertilizer-bag.png', 'tool-pesticide': 'paper-insect-spray.png', 'tool-weedkiller': 'paper-weed-spray.png', 'tool-gloves': 'paper-glove.png', 'tool-seedbag': 'paper-seed-bag.png', 'tool-can': 'paper-watering-can.png', 'tool-shovel': 'paper-shovel.png', 'ui-storage': 'paper-backpack.png', 'ui-shop': 'paper-shop.png' }
  function art(app, name) { return cssArt[name] || typeof app.asset !== 'function' ? '' : app.asset((paperControls[name] && typeof app.hasAsset === 'function' && app.hasAsset(paperControls[name]) ? paperControls[name] : controlArt[name] || name + '.webp')) }
  function bg(app, node, name) { if (!name) return node; var url = art(app, name); if (url) node.style.backgroundImage = 'url("' + url + '")'; if (url && typeof app.paintAsset === 'function') app.paintAsset(node, (controlArt[name] || name + '.webp')); return node }
  /** 新平涂素材只在宿主登记过时加载；没登记（旧宿主 / 尚未发版）就退回 CSS 土色和旧作物图。 */
  function paper(app, name) { return typeof app.hasAsset === 'function' && app.hasAsset(name + '.png') ? app.asset(name + '.png') : '' }
  function paint(node, url) { if (url) { node.style.backgroundImage = 'url("' + url + '")'; node.style.backgroundSize = 'cover'; node.style.backgroundRepeat = 'no-repeat'; node.setAttribute('data-paper', 'true') } return node }
  function picture(app, className, url, fallback) {
    if (!url) return app.el('span', className, fallback || '')
    var node = app.el('img', className); node.src = url; node.alt = ''; return node
  }
  function img(app, className, name, fallback) { return picture(app, className, art(app, name), fallback) }
  function put(parent, child) { parent.appendChild(child); return child }
  function button(app, className, attrs, label, onClick) { var node = app.button((className.indexOf('dp-') >= 0 ? '' : 'dp-btn ') + className, attrs, onClick); node.textContent = label; return node }
  function say(app, text, index) { tip = text; tipAt = Date.now(); tipPlot = index; app.rerender() }
  function pageKey(app) {
    var mode = (app || currentApp || {}).mode === 'big' ? 'farm-large' : 'farm'
    if (purchase) return mode + ':buy:' + purchase.key
    if (confirmClear !== null) return mode + ':clear:' + confirmClear
    if (popup) return mode + ':page:' + popup + ':' + (popup === 'shop' ? shopTab : popup === 'bag' ? bagTab : '')
    return mode + ':field'
  }
  function scrollNode(app) { return app.mode === 'big' ? lastRoot : app.content }
  function rememberScroll(app, key) { var node = scrollNode(app); if (node) scrollMemory[key] = node.scrollTop || 0 }
  function restoreScroll(app, key) {
    var node = scrollNode(app); if (!node) return
    var top = scrollMemory[key] || 0
    // 宿主写完自己的滚动位置之后再落，避免被它按上一页重置掉（只影响子页返回时的位置）。
    if (typeof Promise === 'function') Promise.resolve().then(function () {
      if (node.scrollTop !== top) node.scrollTop = top
      if (revealTools && drawerOpen) {
        revealTools = false
        var dock = node.querySelector('.fm-dock')
        if (dock && typeof dock.scrollIntoView === 'function') dock.scrollIntoView({ block: 'start', behavior: 'instant' })
      }
    })
  }
  function watchScroll(node) { if (node && typeof node.addEventListener === 'function') node.addEventListener('scroll', function () { if (currentKey) scrollMemory[currentKey] = node.scrollTop }) }
  function goPage(app, name) { rememberScroll(app, pageKey(app)); popup = name; purchase = null; confirmClear = null; app.rerender() }
  function closePage(app) { rememberScroll(app, pageKey(app)); popup = null; purchase = null; confirmClear = null; app.rerender() }
  function goShop(app, tab) { rememberScroll(app, pageKey(app)); if (tab) shopTab = tab; popup = 'shop'; purchase = null; app.rerender() }
  function goBag(app, tab) { rememberScroll(app, pageKey(app)); if (tab) bagTab = tab; popup = 'bag'; app.rerender() }
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
  function cropArt(plot) { return plot.withered ? 'withered' : plot.stage === 'seed' || plot.stage === 'sprout' ? plot.stage : 'crop-' + plot.crop + '-' + plot.stage }
  function survey(data, from, to) {
    var pick = function (test) { var out = []; for (var i = from; i < to; i += 1) if (test(data.plots[i])) out.push(i); return out }
    return {
      ripe: pick(function (p) { return p.ripe }), pests: pick(function (p) { return pestsOf(p).length > 0 && !p.ripe }),
      withered: pick(function (p) { return p.withered }), empty: pick(function (p) { return p.empty }),
      soonest: data.plots.slice(from, to).reduce(function (min, p) { return p.remainingMs > 0 ? Math.min(min, p.remainingMs) : min }, Infinity),
    }
  }
  function validPlot(plot) {
    if (plot.wild) return false
    if (hand.kind === 'auto') return plot.ripe === true
    if (hand.kind === 'shovel') return !plot.empty || plot.stubble || plot.withered
    if (hand.kind === 'care') return pestsOf(plot).indexOf(hand.key) >= 0
    if (hand.kind === 'seed') return plot.empty === true && !plot.stubble && pestsOf(plot).indexOf('weed') < 0
    return false
  }
  function syncHand(data) {
    var seed = hand.kind === 'seed' ? seedOf(data, hand.key) : null
    if (hand.kind === 'seed' && (!seed || seed.count < 1 || seed.locked)) hand = AUTO
    var fert = hand.kind === 'fert' ? (data.fert || []).find(function (f) { return f.key === hand.key }) : null
    if (hand.kind === 'fert' && (!fert || fert.count < 1)) hand = AUTO
  }
  function sendAction(app, op, payload) {
    if (inflight) return null
    var result = app.send(op, payload), ticket = {}
    if (!result || typeof result.then !== 'function') return result
    inflight = ticket; if (pendingAction && pendingAction.op === op) pendingAction.awaiting = ticket; app.rerender()
    var settle = function (next) { if (inflight !== ticket) return; inflight = null; if (!next || next.ok === false) { pendingAction = null; return app.rerender() } if (pendingAction && pendingAction.awaiting === ticket) { pendingAction.awaiting = null; finishAction(app, app.data) } app.rerender() }
    result.then(settle, function () { settle(null) })
    return result
  }
  function act(app, index, emoji, op, payload) { if (inflight) return; fx = null; pendingAction = { op: op, plot: index, before: app.data, fx: emoji }; sendAction(app, op, payload) }
  function clickPlot(app, data, index) {
    if (inflight) return
    selectedPlot = index
    var plot = data.plots[index]
    var shovel = hand.kind === 'shovel'
    if (plot.wild) return say(app, plot.next ? '点木牌开垦' : '要先开前一块荒地')
    if (shovel && plot.empty && !plot.stubble) return say(app, '这块地是空的', index)
    if (shovel && !plot.empty && !plot.withered) { rememberScroll(app, pageKey(app)); confirmClear = index; modalReturn = { attr: 'data-farm-plot', value: String(index) }; return app.rerender() }
    if (shovel) { confirmClear = null; return act(app, index, '🪏', 'clear', plot.withered || plot.stubble ? { plot: index } : { plot: index, force: true }) }
    confirmClear = null
    if (hand.kind === 'care') {
      if (pestsOf(plot).indexOf(hand.key) >= 0) return act(app, index, hand.key === 'dry' ? '💧' : '✨', 'care', { plot: index, kind: hand.key })
      return say(app, hand.key === 'dry' ? '这块地不用浇水' : '这块地没有' + PEST_LABEL[hand.key], index)
    }
    if (hand.kind === 'fert') return plot.empty || plot.ripe || plot.withered ? say(app, '肥料要施在正在长的地上') : app.send('fertilize', { plot: index, item: hand.key })
    if (hand.kind === 'auto') {
      if (plot.ripe) return act(app, index, '✨', 'harvest', { plot: index })
      tip = null; return app.rerender()
    }
    if (plot.empty && (plot.stubble || pestsOf(plot).indexOf('weed') >= 0)) return say(app, '先除草 / 铲掉杂草', index)
    if (plot.empty) { var seed = seedInHand(data); return seed ? act(app, index, '🌱', 'plant', { plot: index, item: seed.key }) : goShop(app, 'seed') }
    say(app, '这块地不是空地', index)
  }
  function reclaimSign(app, data, index) {
    var node = button(app, 'fm-chip fm-expand', { 'data-farm-reclaim': String(index), 'aria-label': '开垦这块荒地 ' + data.reclaimPrice + ' 菜币' }, '开垦 ' + data.reclaimPrice, function (event) { event.stopPropagation(); if (node.parentNode) node.parentNode.removeAttribute('data-farm-hover'); if (!data.plots[index].next) return say(app, '要先开前一块荒地'); if (data.balance < data.reclaimPrice) return say(app, '开垦要 ' + data.currency.emoji + ' ' + data.reclaimPrice); app.send('unlock', { plot: index }) })
    return bg(app, node, 'big-sign-expand')
  }
  function plotCard(app, data, index, kind) {
    var plot = data.plots[index]
    var attrs = { 'data-farm-plot': String(index), 'aria-label': plotLabel(plot) }
    var card = plot.wild ? app.el('div', 'fm-plot') : app.button('fm-plot' + (plot.ripe ? ' fm-ripe' : ''), attrs, function () { clickPlot(app, data, index) })
    if (plot.wild) card.setAttribute('role', 'group')
    if (plot.wild) Object.keys(attrs).forEach(function (key) { card.setAttribute(key, attrs[key]) })
    if (plot.wild) card.addEventListener('click', function () { clickPlot(app, data, index) })
    put(card, picture(app, 'fm-soil', paper(app, 'paper-soil-patch')))
    var pointerFocus = false
    card.addEventListener('pointerdown', function () { pointerFocus = true })
    card.addEventListener('focus', function () { if (pointerFocus) { pointerFocus = false; return } if (selectedPlot !== index) { selectedPlot = index; app.rerender() } })
    card.addEventListener('blur', function () { pointerFocus = false })
    card.addEventListener('mousemove', function () { card.setAttribute('data-farm-hover', 'true') })
    card.addEventListener('mouseleave', function () { card.removeAttribute('data-farm-hover') })
    card.addEventListener('click', function () { card.removeAttribute('data-farm-hover') })
    card.setAttribute('data-farm-soil', plot.wild ? 'wild' : pestsOf(plot).indexOf('dry') >= 0 ? 'dry' : 'farmed')
    card.setAttribute('data-farm-valid', String(validPlot(plot)))
    if (fx && !fx.lesson && fx.plot === index) { card.setAttribute('data-farm-fx', fx.kind); card.style.setProperty('--fm-fx-delay', -(Date.now() - fx.at) + 'ms') }
    if (plot.wild) {
      if (plot.next) put(card, reclaimSign(app, data, index))
      else put(card, bg(app, app.el('span', 'fm-lock'), 'lock-badge'))
      return card
    }
    if (plot.empty && hand.kind === 'seed' && !plot.stubble && pestsOf(plot).indexOf('weed') < 0) {
      var ghost = put(card, bg(app, app.el('span', 'fm-ghost'), 'plot-ghost-seed'))
      put(ghost, img(app, null, 'produce-' + hand.key))
    }
    if (plot.stubble) put(card, img(app, 'fm-crop', 'withered'))
    if (plot.empty && pestsOf(plot).indexOf('weed') >= 0) put(card, img(app, 'fm-pest', 'weed')).setAttribute('data-pest', 'weed')
    pestsOf(plot).forEach(function (pest, n) { var bubble = put(card, img(app, 'fm-bubble', 'plot-bubble-' + (pest === 'dry' ? 'water' : pest))); bubble.style.right = kind === 'big' ? 'calc(50% - 36px + ' + n * 24 + 'px)' : (n * 23) + '%'; bubble.setAttribute('data-farm-bubble', pest) })
    if (tip && tipPlot === index && Date.now() - tipAt < 2400) renderTip(app, card)
    if (plot.empty) return card
    put(card, img(app, 'fm-crop', cropArt(plot), plot.emoji))
    if (pestsOf(plot).indexOf('weed') >= 0) put(card, img(app, 'fm-pest', 'weed')).setAttribute('data-pest', 'weed')
    var chip = plot.ripe ? '收 ' + plot.yield + ' 个' : plot.withered ? '枯了' : ''
    if (chip) put(card, app.el('span', 'fm-chip', chip))
    return card
  }
  function plotLabel(plot) {
    if (plot.wild) return plot.next ? '荒地，点木牌开垦' : '荒地，要先开垦前一块'
    if (plot.empty) return '空地'
    return plot.label + (plot.withered ? ' 枯了' : plot.ripe ? ' 熟了' : pestsOf(plot).length ? ' ' + pestText(plot, '、') : '')
  }
  function levelBadge(app, data) {
    var node = app.button('dp-btn fm-stat fm-level', { 'data-farm-level': 'info', 'aria-label': '等级与经验' }, function () { say(app, '等级 ' + data.level + ' · 经验 ' + data.exp + ' / ' + data.need) })
    put(node, app.el('b', null, 'Lv.' + data.level))
    var exp = put(node, bg(app, app.el('span', 'fm-exp'), 'ui-exp-frame')); exp.setAttribute('title', '经验 ' + data.exp + ' / ' + data.need)
    put(exp, app.el('i')).style.width = Math.max(0, Math.min(90, data.exp / data.need * 90)) + '%'
    return node
  }
  function metaRow(app, data, box) {
    var meta = put(box, app.el('div', 'fm-advanced-meta')); put(meta, levelBadge(app, data))
    put(meta, button(app, 'fm-meta fm-weather', { 'data-farm-weather': 'info' }, '天气：' + (data.weather === 'rain' ? '下雨' : '晴天'), function () { say(app, '天气：' + (data.weather === 'rain' ? '下雨' : '晴天')) }))
    return meta
  }
  function toolSlot(app, spec) {
    var pressed = spec.pressed === true || !!spec.hand && hand.kind === spec.hand.kind && hand.key === spec.hand.key
    var node = app.button('dp-btn fm-slot', { 'data-farm-tool': spec.key, 'aria-pressed': String(pressed), 'data-locked': String(!!spec.locked), 'aria-label': spec.label, title: spec.label }, function () {
      rememberScroll(app, pageKey(app))
      confirmClear = null
      drawerOpen = false
      if (spec.locked) return goShop(app, 'tool')
      if (spec.run) return spec.run()
      hand = pressed ? AUTO : spec.hand
      popup = null
      app.rerender()
    })
    node.addEventListener('mousemove', function () { node.setAttribute('data-farm-hover', 'true') }); node.addEventListener('mouseleave', function () { node.removeAttribute('data-farm-hover') }); node.addEventListener('click', function () { node.removeAttribute('data-farm-hover') })
    put(node, img(app, null, spec.art, spec.emoji))
    put(node, app.el('span', 'fm-tool-label', spec.label.split('：')[0].split('（')[0]))
    if (spec.locked) put(node, bg(app, app.el('span', 'fm-lock'), 'lock-badge'))
    else if (spec.count > 0) put(node, app.el('i', 'fm-n', String(spec.count)))
    return node
  }
  var CARE_TOOLS = [
    { key: 'can', art: 'tool-can', emoji: '💧', label: '浇水：点干了的地', hand: { kind: 'care', key: 'dry' }, hint: '点干了的地浇水' },
    { key: 'weedkiller', art: 'tool-weedkiller', emoji: '🌿', label: '除草：点长草的地', hand: { kind: 'care', key: 'weed' }, hint: '点长草的地除草' },
    { key: 'pesticide', art: 'tool-pesticide', emoji: '🐛', label: '杀虫：点生虫的地', hand: { kind: 'care', key: 'bug' }, hint: '点生虫的地杀虫' },
    { key: 'gloves', art: 'tool-gloves', emoji: '🧤', label: '手套：只收成熟作物', hand: AUTO },
  ]
  function careCount(data, kind) { return data.plots.slice(0, data.unlocked).filter(function (plot) { return pestsOf(plot).indexOf(kind) >= 0 }).length }
  function fertCount(data) { return (data.fert || []).reduce(function (sum, fert) { return sum + fert.count }, 0) }
  function allTools(app, data) {
    var all = survey(data, 0, data.unlocked)
    var seed = hand.kind === 'seed' ? seedOf(data, hand.key) : null
    var specs = [
      Object.assign({}, CARE_TOOLS[3], { count: all.ripe.length }),
      { key: 'seedbag', art: 'tool-seedbag', emoji: '🌰', label: '种子袋：选种子播种', run: function () { goBag(app, 'seed') }, count: seed ? seed.count : 0 },
      Object.assign({}, CARE_TOOLS[0], { count: careCount(data, 'dry') }),
      { key: 'shovel', art: 'tool-shovel', emoji: '🪏', label: '铁锹：点地铲掉，正在长的作物要确认', hand: { kind: 'shovel', key: null }, count: all.withered.length },
      Object.assign({}, CARE_TOOLS[1], { count: careCount(data, 'weed') }),
      Object.assign({}, CARE_TOOLS[2], { count: careCount(data, 'bug') }),
    ]
    ONE_CLICK.forEach(function (spec) {
      var owned = owns(data, spec.key)
      specs.push({ key: spec.key, art: 'tool-' + spec.key, emoji: '🧰', locked: !owned, count: all[{ harvestAll: 'ripe', careAll: 'pests', clearAll: 'withered', plantAll: 'empty' }[spec.op]].length,
        label: owned ? spec.label : spec.label + '（去商店买' + spec.tool + '）', run: function () { if (spec.op !== 'plantAll') return sendAction(app, spec.op, {}); var seed = seedInHand(data); return seed ? sendAction(app, 'plantAll', { item: seed.key }) : goShop(app, 'seed') } })
    })
    specs.push({ key: 'fert', art: 'fert-1', emoji: '🧪', label: '肥料：点正在长的地', run: function () { return fertCount(data) > 0 ? goBag(app, 'item') : goShop(app, 'fert') }, count: fertCount(data) })
    return specs
  }
  function renderDrawer(app, data, box) {
    var drawer = put(box, app.el('div', 'fm-drawer'))
    drawer.id = 'dsh-piggy-farm-tools'; drawer.setAttribute('data-farm-drawer', 'tools')
    var grid = put(drawer, app.el('div', 'fm-advanced-grid'))
    allTools(app, data).forEach(function (spec) { put(grid, toolSlot(app, spec)) })
    var actions = put(drawer, app.el('div', 'fm-advanced-actions'))
    if (data.helper) put(actions, button(app, 'fm-nav-action', { 'data-farm-helper': data.helper.hired ? 'collect' : 'hire', 'aria-label': helperText(data.helper) }, helperText(data.helper), function () { rememberScroll(app, pageKey(app)); helperClick(app, data.helper) }))
    if (app.mode !== 'big') metaRow(app, data, drawer)
  }
  function dock(app, data, box) {
    var bar = put(box, app.el('div', 'fm-dock'))
    function entry(attrs, label, artwork, run) {
      var node = put(bar, button(app, 'fm-dock-btn', attrs, '', run))
      put(node, img(app, null, artwork)); put(node, app.el('span', null, label))
    }
    entry({ 'data-farm-tools': 'toggle', 'aria-expanded': String(drawerOpen), 'aria-controls': 'dsh-piggy-farm-tools', 'aria-label': '工具' }, '工具', 'tool-gloves', function () { rememberScroll(app, pageKey(app)); drawerOpen = !drawerOpen; revealTools = drawerOpen; app.rerender() })
    entry({ 'data-farm-bag': 'open', 'aria-label': '背包' }, '背包', 'ui-storage', function () { goBag(app) })
    entry({ 'data-farm-shop': 'shelf', 'aria-label': '商店' }, '商店', 'ui-shop', function () { goShop(app) })
    return bar
  }
  function header(app, data, big, box) {
    if (big && typeof app.closeBig === 'function') put(box, button(app, 'dp-drill-back fm-back', { 'data-farm-big': 'close', 'aria-label': '回小农场' }, '‹', function () { rememberScroll(app, pageKey(app)); app.closeBig() }))
    if (big || !app.header) put(box, app.el('b', 'fm-garden-title', '菜园'))
    if (!big && typeof app.openBig === 'function') put(box, button(app, 'fm-big-open', { 'data-farm-big': 'open', 'aria-label': '打开大农场' }, '大农场', function () { rememberScroll(app, pageKey(app)); app.openBig() }))
    var coin = put(box, app.button('dp-btn fm-stat fm-coin', { 'data-farm-coin': 'open', 'aria-label': '菜币余额 ' + data.balance + '，去换菜币' }, function () { goPage(app, 'wallet') }))
    put(coin, img(app, null, 'coin-veg', data.currency.emoji)); put(coin, app.el('span', null, '菜币 ' + data.balance))
  }
  function mainAction(data, look) {
    if (selectedPlot !== null && data.plots[selectedPlot].wild) { var wild = data.plots[selectedPlot]; return { label: wild.next ? '开垦这块地' : '尚未解锁', sub: wild.next ? '需要 ' + data.reclaimPrice + ' 菜币' : '先开前一块地', op: 'unlock', payload: { plot: selectedPlot }, plot: selectedPlot, idle: !wild.next || data.balance < data.reclaimPrice } }
    var one = function (list, label, op, fx, rest) { return { label: label, sub: list.length > 1 ? '还有 ' + (list.length - 1) + ' 块' + rest : '', op: op, payload: { plot: list[0] }, plot: list[0], fx: fx } }
    if (look.ripe.length) return one(look.ripe, '收菜', 'harvest', '✨', '熟了')
    if (look.pests.length) {
      var index = look.pests[0], kind = pestsOf(data.plots[index])[0]
      return { label: { dry: '浇这块地', weed: '给这块地除草', bug: '给这块地除虫' }[kind], op: 'care', plot: index, payload: { plot: index, kind: kind }, fx: kind === 'dry' ? '💧' : '✨' }
    }
    if (look.withered.length) return one(look.withered, '铲枯苗', 'clear', '🪏', '枯了')
    var stubble = look.empty.find(function (index) { return data.plots[index].stubble })
    if (stubble >= 0) return { label: '铲杂草', op: 'clear', payload: { plot: stubble }, plot: stubble, fx: '🪏' }
    if (look.empty.length) {
      var seed = seedInHand(data)
      if (!seed) return { label: '去买种子', shop: true, plot: look.empty[0] }
      return { label: '种' + seed.label, op: 'plant', payload: { plot: look.empty[0], item: seed.key }, plot: look.empty[0], fx: '🌱' }
    }
    return { label: '都在长', sub: look.soonest < Infinity ? '最快 ' + shortTime(look.soonest) : '', idle: true }
  }
  function lessonOf(data) { var on = data.onboarding; return on && !on.legacy && on.step !== 'done' ? on : null }
  function lessonText(on) { return on.canPlant ? '待播种' : on.canHarvest ? '可以收了' : on.canWater ? '待浇水' : '生长中' }
  function lessonAction(on) {
    if (on.canPlant) return { label: '种下第一课', sub: '课内' + on.seed.label + ' ×' + on.seed.count, lesson: true }
    if (on.canHarvest) return { label: '收获第一课', sub: on.reward.currency + ' 菜币 + ' + on.seed.label + ' ×1', lesson: true }
    if (on.canWater) return { label: '浇这块地', sub: '浇水后 2 分钟成熟', lesson: true }
    return { label: '等它长大', sub: '还剩 ' + shortTime(on.remainingMs), idle: true }
  }
  function goalText(data, look) {
    var on = data.onboarding
    if (on && !on.legacy && on.step === 'offer') return '先试种一轮。'
    if (on && !on.legacy && on.step === 'planted') return on.canHarvest ? '第一课熟了，收下吧。' : '第一课 · 小葱 · ' + lessonText(on) + '。'
    if (on && !on.legacy && lessonRewardAt && Date.now() - lessonRewardAt < 60000) return '第一课完成：' + on.reward.currency + ' 菜币 + ' + on.seed.label + ' ×1'
    if (look.ripe.length) return '有 ' + look.ripe.length + ' 块菜能收了。'
    if (look.pests.length) return look.pests.length + ' 块地要照料。'
    if (look.withered.length) return '有枯苗要铲掉。'
    if (look.empty.length) return '点空地种点新菜。'
    return look.soonest < Infinity ? '都在长，最快 ' + shortTime(look.soonest) + '。' : ''
  }
  function lessonTile(app, on) {
    var card = app.button('fm-plot fm-s-lesson', { 'data-farm-lesson': on.step, 'data-farm-lesson-plot': 'true', 'data-farm-target': String(selectedPlot === null), 'data-farm-next': 'true', 'aria-label': '第一课 小葱 ' + lessonText(on) }, function () { selectedPlot = null; doLesson(app, on); app.rerender() })
    if (fx && fx.lesson) { card.setAttribute('data-farm-fx', fx.kind); card.style.setProperty('--fm-fx-delay', -(Date.now() - fx.at) + 'ms') }
    put(card, picture(app, 'fm-soil', paper(app, 'paper-soil-patch')))
    if (on.canPlant) {
      var ghost = put(card, bg(app, app.el('span', 'fm-ghost'), 'plot-ghost-seed'))
      put(ghost, img(app, null, 'produce-scallion'))
    } else {
      var stage = on.progress >= 1 ? 'ripe' : on.progress >= 2 / 6 ? 'seedling' : 'seed' // 只用服务器给的 progress 选课内三段图，不在页面里重算成熟时间。
      var paperCrop = paper(app, 'paper-scallion-' + stage)
      var crop = put(card, picture(app, 'fm-crop', paperCrop || art(app, cropArt({ crop: 'scallion', stage: stage })), '🌱'))
      if (paperCrop) crop.setAttribute('data-paper-stage', stage)
    }
    if (on.canWater) put(card, img(app, 'fm-bubble', 'plot-bubble-water', '💧'))
    put(card, app.el('span', 'fm-chip', on.canPlant ? '试种' : on.canHarvest ? '可收' : on.canWater ? '待浇水' : '生长中'))
    return card
  }
  function doLesson(app, on) {
    var op = on.canPlant ? 'plant' : on.canHarvest ? 'harvest' : on.canWater ? 'water' : null
    if (!op || inflight) return
    fx = null; pendingAction = { op: 'onboarding', before: app.data, lessonOp: op }
    return sendAction(app, 'onboarding', { op: op })
  }
  function detailCard(app, root, data, on, index) {
    var plot = on ? null : data.plots[index]
    var box = put(root, app.el('div', 'fm-s-detail')); box.setAttribute('data-farm-detail', on ? 'lesson' : String(index))
    var head = put(box, app.el('div', 'fm-s-detail-head'))
    put(head, app.el('b', null, on ? '小葱' : plot.wild ? '荒地' : plot.empty ? '空地' : plot.label))
    put(head, app.el('span', 'fm-s-phase', on ? lessonText(on) : plot.wild ? plot.next ? '可开垦' : '尚未解锁' : plot.empty ? plot.stubble ? '剩茬' : '空地' : plot.withered ? '枯了' : plot.ripe ? '可以收了' : pestsOf(plot).length ? '要照料 · ' + pestText(plot, '、') : { seed: '种子', sprout: '发芽', seedling: '小苗', growing: '长大', flowering: '开花' }[plot.stage] || '生长中'))
    if (plot && plot.wild) {
      var order = put(box, app.el('div', 'fm-s-progress'))
      put(order, app.el('span', null, '开垦顺序 · ' + (plot.next ? '下一块' : '第 ' + (index - data.unlocked + 1) + ' 块')))
      put(box, app.el('small', null, plot.next ? '需要 ' + data.reclaimPrice + ' 菜币 · 点木牌开垦' : '先开前面 ' + (index - data.unlocked) + ' 块 · 价格同样 ' + data.reclaimPrice + ' 菜币'))
      return box
    }
    var progress = Math.max(0, Math.min(1, on ? on.progress : plot.progress || 0))
    var line = put(box, app.el('div', 'fm-s-progress')); line.setAttribute('data-farm-progress', String(Math.round(progress * 100)))
    put(line, app.el('span', null, '生长进度'))
    var track = put(line, app.el('span', 'fm-s-track')); put(track, app.el('i')).style.width = Math.round(progress * 100) + '%'
    var text = on ? on.canPlant ? '课内' + on.seed.label + ' ×' + on.seed.count : on.canHarvest ? '点主按钮收获' : on.canWater ? '浇水后 2 分钟成熟' : '还剩 ' + shortTime(on.remainingMs) : plot.empty ? '先选种子 / 去商店买' : plot.ripe ? '收 ' + plot.yield + ' 个 · 等主按钮' : plot.withered ? '用铁锹铲掉' : '还剩 ' + shortTime(plot.remainingMs)
    put(box, app.el('small', null, text))
    return box
  }
  function renderGarden(app, data) {
    var big = app.mode === 'big'
    var root = app.el('div', big ? 'fm fm-big' : 'fm'); root.setAttribute('data-scroll-page', big ? 'farm-large' : 'farm')
    if (big) root.setAttribute('data-scroll-key', 'farm-large:page')
    var panel = typeof app.content.closest === 'function' ? app.content.closest('.dp-card') : null
    if (panel && parseFloat(panel.style.maxHeight) < 450) root.setAttribute('data-farm-compact', 'true')
    var lesson = lessonOf(data), on = selectedPlot === null ? lesson : null, shown = Math.min(big ? data.total - (lesson ? 1 : 0) : lesson ? SMALL_PLOTS - 1 : SMALL_PLOTS, data.total)
    var all = survey(data, 0, data.unlocked)
    var action = on ? lessonAction(on) : mainAction(data, survey(data, selectedPlot === null ? 0 : selectedPlot, selectedPlot === null ? shown : selectedPlot + 1))
    var focus = selectedPlot === null ? action.plot : selectedPlot
    if (focus === undefined) { focus = 0; for (var at = 0; at < shown; at += 1) if (data.plots[at] && !data.plots[at].empty) { focus = at; break } }
    var head = put(root, app.el('div', 'fm-s-header'))
    header(app, data, big, head)
    if (!big && app.header) { root.setAttribute('data-farm-integrated', 'true'); while (head.firstChild) app.header.appendChild(head.firstChild) }
    var body = big ? put(root, app.el('div', 'fm-b-body')) : root
    var stage = big ? put(body, app.el('div', 'fm-b-stage')) : body
    put(stage, app.el('div', 'fm-s-goal', goalText(data, all)))
    var scene = put(stage, paint(app.el('div', 'fm-s-scene'), paper(app, big ? 'paper-garden-wide' : 'paper-garden-background')))
    var field = put(scene, app.el('div', 'fm-s-field')); field.setAttribute('data-farm-grid', big ? 'expanded' : 'compact')
    if (lesson) put(field, lessonTile(app, lesson))
    for (var index = 0; index < shown; index += 1) {
      var card = put(field, plotCard(app, data, index, big ? 'big' : 'small'))
      if (!on && focus === index) { card.setAttribute('data-farm-next', 'true'); card.setAttribute('data-farm-target', 'true') }
    }
    if (fx && fx.lesson && !on) { scene.setAttribute('data-farm-fx', fx.kind); scene.style.setProperty('--fm-fx-delay', -(Date.now() - fx.at) + 'ms') }
    var noteFrom = shown
    if (!big && data.unlocked > noteFrom) {
      var rest = survey(data, noteFrom, data.unlocked)
      var parts = [[rest.ripe, ' 块熟了'], [rest.pests, ' 块要照料'], [rest.withered, ' 块枯了'], [rest.empty, ' 块空着']].filter(function (p) { return p[0].length }).map(function (p) { return p[0].length + p[1] })
      put(stage, app.el('div', 'fm-s-note', '另外 ' + (data.unlocked - noteFrom) + ' 块地：' + (parts.join('，') || '都在长')))
    }
    var side = big ? put(body, app.el('div', 'fm-b-controls')) : stage
    var detail = detailCard(app, side, data, on, focus)
    var plank = put(side, app.el('div', 'fm-s-plank'))
    if (!action.shop && !action.idle) {
    detail.setAttribute('data-has-action', 'true')
    var row = put(detail, app.el('div', 'fm-s-acts'))
    var main = put(row, app.button('dp-mini fm-main', { 'data-farm-main': action.lesson ? 'onboarding' : action.op || (action.shop ? 'shop' : 'idle') }, function () {
      if (action.lesson) return doLesson(app, on)
      if (action.shop) return goShop(app, 'seed')
      if (!action.idle) act(app, action.plot, action.fx, action.op, action.payload)
    }))
    put(main, app.el('span', null, action.label))
    put(main, app.el('small', null, inflight ? '处理中…' : action.sub || ''))
    main.disabled = action.idle === true || !!inflight
    if (inflight) main.setAttribute('aria-busy', 'true')
    }
    if (big) metaRow(app, data, side)
    dock(app, data, side)
    if (drawerOpen) renderDrawer(app, data, side)
    renderLayers(app, data, root)
    if (tip && tipPlot == null && Date.now() - tipAt < 2400) renderTip(app, root)
    app.content.appendChild(root)
    return root
  }
  function helperText(helper) { return !helper.hired ? '雇帮工猪' : helper.full ? '帮工仓库满了' : helper.stored > 0 ? '帮工收了 ' + helper.stored + ' 个' : helper.missing.length ? '缺' + helper.missing.join('、') + '种子' : helper.seedless ? '帮工没种子' : '帮工 · ' + helper.plots + ' 块地' }
  function helperClick(app, helper) { if (!helper.hired) return sendAction(app, 'hire', {}); if (helper.stored > 0 || helper.full) return sendAction(app, 'collect', {}); if (helper.missing.length || helper.seedless) return goShop(app, 'seed'); say(app, '帮工正在照顾 ' + helper.plots + ' 块地') }
  function frame(app, node) {
    node.className += ' fm-paper'; node.setAttribute('data-farm-frame', 'css-paper')
    return node
  }
  function renderTip(app, box) {
    var node = put(box, app.el('div', 'fm-toast', tip)); node.setAttribute('role', 'status'); node.style.animationDelay = '-' + Math.max(0, Date.now() - tipAt) + 'ms'
  }
  function finishAction(app, data) {
    if (fx && Date.now() - fx.at >= 620) fx = null
    if (!pendingAction || pendingAction.before === data || pendingAction.awaiting) return
    var action = pendingAction, old = action.before, plot = action.plot, text = null
    pendingAction = null
    if (action.op === 'onboarding') {
      var now = data.onboarding || {}
      if (action.lessonOp === 'plant' && now.step === 'planted') text = '第一课种下了'
      if (action.lessonOp === 'water' && now.watered && !(old.onboarding && old.onboarding.watered)) text = '浇水成功'
      if (action.lessonOp === 'harvest' && now.step === 'done') { lessonRewardAt = Date.now(); text = '第一课完成：' + now.reward.currency + ' 菜币 + ' + now.seed.label + ' ×1' }
    }
    if (action.op === 'plant' && old.plots[plot].empty && !data.plots[plot].empty) text = '播种成功'
    if (action.op === 'harvest' && old.plots[plot].ripe && !data.plots[plot].ripe) text = '收获 ' + old.plots[plot].yield + ' 个'
    if (action.op === 'care' && pestsOf(data.plots[plot]).length < pestsOf(old.plots[plot]).length) text = '照料成功'
    if (action.op === 'clear' && (data.plots[plot].empty || !data.plots[plot].stubble)) text = '铲除成功'
    if (/All$/.test(action.op) && JSON.stringify(old.plots) !== JSON.stringify(data.plots)) text = '操作成功'
    if (action.item && old.balance - data.balance === action.item.price * action.count) text = '购买成功！' + action.item.label + ' ×' + action.count + '，花费 ' + action.item.price * action.count + ' 菜币'
    if (text) {
      tip = text; tipAt = Date.now(); tipPlot = plot
      var kind = action.op === 'onboarding' ? { plant: 'sow', water: 'water', harvest: 'harvest' }[action.lessonOp] : action.op === 'plant' ? 'sow' : action.op === 'harvest' ? 'harvest' : action.op === 'care' && action.fx === '💧' ? 'water' : null
      if (kind) fx = { plot: plot, lesson: action.op === 'onboarding', kind: kind, at: Date.now() }
    }
  }
  function bindKeyboard() {
    if (keyboardBound) return
    keyboardBound = true
    document.addEventListener('focusin', function (event) { if (modalOpen && inDialog(event.target)) modalFocus = focusDescriptor(event.target) || modalFocus })
    document.addEventListener('keydown', function (event) {
      var dialog = currentApp && currentApp.content.querySelector('[role="dialog"]')
      if (dialog && event.key === 'Tab') {
        var focusable = Array.prototype.filter.call(dialog.querySelectorAll('button,input,select,textarea,a'), function (node) { return !node.disabled && node.getAttribute('tabindex') !== '-1' })
        if (!focusable.length) { event.preventDefault(); dialog.focus(); return }
        var active = document.activeElement, first = focusable[0], last = focusable[focusable.length - 1]
        if (!inDialog(active) || event.shiftKey && active === first || !event.shiftKey && active === last) {
          event.preventDefault(); (event.shiftKey ? last : first).focus()
        }
        return
      }
      if (currentApp && event.key === 'Escape') {
        if (cancelLayer) cancelLayer()
        else if (popup) closePage(currentApp)
        else if (drawerOpen) { drawerOpen = false; currentApp.rerender() }
        return
      }
      if (!currentApp || currentApp.mode !== 'big' || !currentApp.content.querySelector('.fm-big') || event.ctrlKey || event.altKey || event.metaKey || event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(event.target.tagName)) return
      var tools = { q: { kind: 'care', key: 'dry' }, w: { kind: 'care', key: 'weed' }, e: { kind: 'care', key: 'bug' }, r: AUTO }
      var chosen = tools[String(event.key).toLowerCase()]
      if (chosen) { event.preventDefault(); hand = chosen; currentApp.rerender() }
    })
  }
  function product(app, item, className) {
    if (item.category !== 'seed') return img(app, className, itemArt(item), item.emoji)
    var packet = bg(app, app.el('span', className + ' fm-packet'), 'seed-packet')
    put(packet, img(app, null, itemArt(item), item.emoji))
    return packet
  }
  function itemArt(item) { return item.key.indexOf('helper-') === 0 ? 'tab-icon-helper' : item.key.indexOf('fert-') === 0 ? item.key : item.category === 'tool' ? 'tool-' + item.key : 'produce-' + item.key }
  function shopItems(data) {
    return data.shelf.items.map(function (entry) {
      var seed = seedOf(data, entry.key), tool = data.tools.find(function (item) { return item.key === entry.key })
      return Object.assign({}, entry, seed || {}, { label: entry.label, category: seed ? 'seed' : tool ? 'tool' : entry.key.indexOf('helper-') === 0 ? 'helper' : 'fert', owned: tool && tool.owned })
    })
  }
  function tileNode(app, spec) {
    var node = app.button('dp-tile fm-tile' + (spec.soft === false ? '' : ' dp-tile-soft'), spec.data || {}, function () { spec.onPick() })
    node.setAttribute('data-color', spec.color || 'green'); if (spec.locked) node.setAttribute('data-locked', 'true'); if (spec.dim) node.setAttribute('data-dim', 'true')
    var icon = put(node, app.el('span', 'dp-tile-icon'))
    if (spec.art) put(icon, spec.art)
    else put(icon, app.el('span', 'dp-tile-e', spec.emoji || '🌱'))
    if (spec.badge) put(icon, app.el('b', 'dp-tile-badge', spec.badge))
    put(node, app.el('span', 'dp-tile-n', spec.label)); if (spec.note) put(node, app.el('span', 'dp-tile-note', spec.note))
    return node
  }
  function emptyTile(app, text, extra) {
    var node = app.el('div', 'fm-note', text); if (extra) extra.forEach(function (child) { put(node, child) })
    return node
  }
  function renderShop(app, data, box) {
    var wallet = put(box, app.el('div', 'fm-shop-wallet'))
    put(wallet, img(app, 'fm-shop-coin', 'coin-veg')); put(wallet, app.el('span', null, '菜币 ' + data.balance))
    var tabs = put(box, app.el('div', 'fm-tabs')); tabs.setAttribute('role', 'tablist')
    ;[['seed', '种子'], ['tool', '工具'], ['fert', '肥料'], ['helper', '帮工']].forEach(function (tab) {
      var node = put(tabs, bg(app, app.button('dp-btn fm-tab', { role: 'tab', 'data-farm-tab': tab[0], 'aria-selected': String(shopTab === tab[0]) }, function () { rememberScroll(app, pageKey(app)); shopTab = tab[0]; app.rerender() }), shopTab === tab[0] ? 'shop-tab-active' : 'shop-tab'))
      put(node, img(app, null, 'tab-icon-' + tab[0])); put(node, app.el('span', null, tab[1]))
    })
    var grid = put(box, app.el('div', 'dp-tiles fm-tiles')); grid.setAttribute('role', 'tabpanel')
    grid.setAttribute('data-scroll-key', 'farm-shop:' + shopTab)
    shopItems(data).filter(function (item) { return item.category === shopTab }).sort(function (a, b) { return Number(a.disabled) - Number(b.disabled) }).forEach(function (item) {
      var seed = seedOf(data, item.key)
      var note = item.price + ' 菜币' + (item.locked ? ' · 需要 ' + item.level + ' 级' : item.owned ? ' · 已拥有' : item.disabled ? ' · 菜币不足' : '')
      put(grid, tileNode(app, { color: { seed: 'green', tool: 'blue', fert: 'teal', helper: 'purple' }[item.category], emoji: item.emoji, art: product(app, item, 'fm-product'), label: item.label, note: note, badge: seed && seed.count > 0 ? '×' + seed.count : '', locked: item.locked, dim: !!item.disabled, data: { 'data-farm-item': item.key, 'aria-disabled': String(!!item.disabled) },
        onPick: function () { rememberScroll(app, pageKey(app)); purchase = item; quantity = 1; modalReturn = { attr: 'data-farm-item', value: item.key }; app.rerender() } }))
    })
  }
  function renderBag(app, data, box) {
    var tabs = put(box, app.el('div', 'fm-tabs fm-tabs-3')); tabs.setAttribute('role', 'tablist')
    ;[['seed', '种子'], ['crop', '蔬菜'], ['item', '道具']].forEach(function (tab) {
      put(tabs, app.button('dp-btn fm-tab', { role: 'tab', 'data-farm-bag-tab': tab[0], 'aria-selected': String(bagTab === tab[0]) }, function () { rememberScroll(app, pageKey(app)); bagTab = tab[0]; app.rerender() })).appendChild(app.el('span', null, tab[1]))
    })
    if (data.helper && data.helper.stored > 0) put(box, button(app, 'dp-mini', { 'data-farm-helper': 'collect' }, '把帮工仓库的 ' + data.helper.stored + ' 个搬进来', function () { sendAction(app, 'collect', {}) }))
    var crops = data.harvest.filter(function (crop) { return crop.count > 0 })
    var worth = crops.reduce(function (sum, crop) { return sum + crop.count * crop.sell }, 0)
    if (bagTab === 'crop' && crops.length) {
      var bar = put(box, app.el('div', 'fm-bag-tools'))
      put(bar, app.el('span', 'fm-note', '蔬菜共值 ' + worth + ' 菜币'))
      put(bar, button(app, 'dp-mini', { 'data-farm-sell-everything': 'true' }, '全部卖掉 ' + data.currency.emoji + ' ' + worth, function () { openCrop = null; app.send('sell', { item: '*' }) }))
    }
    var grid = put(box, app.el('div', 'dp-tiles fm-tiles')); grid.setAttribute('role', 'tabpanel')
    grid.setAttribute('data-scroll-key', 'farm-bag:' + bagTab)
    if (bagTab === 'seed') {
      var seeds = data.seeds.filter(function (seed) { return seed.count > 0 })
      if (!seeds.length) { put(grid, emptyTile(app, '还没有种子，去商店看看。', [button(app, 'dp-mini', { 'data-farm-shop': 'seed' }, '去买种子', function () { goShop(app, 'seed') })])); return }
      seeds.forEach(function (seed) { put(grid, tileNode(app, { color: 'green', art: product(app, { key: seed.key, category: 'seed', emoji: seed.emoji }, 'fm-product'), label: seed.label, badge: '×' + seed.count, data: { 'data-farm-seed': seed.key, 'aria-pressed': String(hand.kind === 'seed' && hand.key === seed.key) },
        onPick: function () { hand = { kind: 'seed', key: seed.key }; popup = null; app.rerender() } })) })
      return
    }
    if (bagTab === 'crop') {
      if (!crops.length) { put(grid, emptyTile(app, '还没有收成。')); return }
      crops.forEach(function (item) {
        var open = openCrop === item.key
        put(grid, tileNode(app, { color: 'orange', art: product(app, item, 'fm-product'), label: item.label, note: '卖 ' + item.sell + '/个', badge: '×' + item.count, data: { 'data-farm-crop': item.key, 'aria-expanded': String(open), 'aria-label': item.label + ' ' + item.count + ' 个' },
          onPick: function () { openCrop = open ? null : item.key; app.rerender() } }))
        if (!open) return
        var sell = put(grid, app.el('div', 'fm-sellbar'))
        put(sell, app.el('span', 'fm-note', item.label + ' · 一个卖 ' + item.sell))
        put(sell, button(app, 'dp-mini', { 'data-farm-sell': item.key }, '卖一个', function () { app.send('sell', { item: item.key }) }))
        if (item.count > 1) put(sell, button(app, 'dp-mini', { 'data-farm-sell-all': item.key }, '全卖 ' + data.currency.emoji + ' ' + item.count * item.sell, function () { openCrop = null; app.send('sell', { item: item.key, count: item.count }) }))
        if (item.food) put(sell, button(app, 'dp-mini dp-mini-plain', { 'data-farm-store': item.key }, '放进背包 · ' + item.foodLabel, function () { app.send('store', { item: item.key }) }))
      })
      return
    }
    var ferts = data.fert.filter(function (fert) { return fert.count > 0 })
    ferts.forEach(function (item) { put(grid, tileNode(app, { color: 'teal', art: img(app, 'fm-product', item.key, '🧪'), label: item.label, note: '多长 ' + item.hours + ' 小时', badge: '×' + item.count, data: { 'data-farm-fert': item.key, 'aria-pressed': String(hand.kind === 'fert' && hand.key === item.key) },
      onPick: function () { hand = { kind: 'fert', key: item.key }; popup = null; say(app, '点正在长的地施' + item.label) } })) })
    data.tools.filter(function (tool) { return tool.owned }).forEach(function (tool) {
      put(grid, tileNode(app, { color: 'blue', art: img(app, 'fm-product', 'tool-' + tool.key, '🧰'), label: tool.label, note: '已拥有 · 工具里用', data: { 'data-farm-owned-tool': tool.key },
        onPick: function () { drawerOpen = true; popup = null; app.rerender() } }))
    })
    if (!ferts.length && !data.tools.some(function (tool) { return tool.owned })) put(grid, emptyTile(app, '还没有肥料或道具。', [button(app, 'dp-mini', { 'data-farm-shop': 'fert' }, '去买肥料', function () { goShop(app, 'fert') })]))
  }
  function modal(app, root, className, cancel) {
    cancelLayer = cancel
    var mask = put(root, app.el('div', 'fm-mask')); mask.addEventListener('click', function (event) { if (event.target === mask) { event.stopPropagation(); cancel() } })
    var box = put(mask, frame(app, app.el('div', className)))
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true')
    box.setAttribute('data-scroll-key', 'farm-dialog:' + (purchase ? purchase.key : 'clear'))
    return box
  }
  function modalButtons(app, box, run, cancel, disabled) {
    var row = put(box, app.el('div', 'fm-modal-buttons')); put(row, bg(app, button(app, 'dp-mini fm-confirm', { 'data-farm-confirm': 'true' }, '确定', run), 'btn-confirm')).disabled = !!disabled
    put(row, bg(app, button(app, 'fm-cancel', { 'data-farm-cancel': 'true' }, '取消', cancel), 'btn-cancel'))
  }
  function renderPurchase(app, data, root) {
    var item = purchase
    var cancel = function () { rememberScroll(app, pageKey(app)); purchase = null; app.rerender() }
    var box = modal(app, root, 'fm-buy', cancel); box.setAttribute('aria-label', item.label)
    put(box, bg(app, app.el('b', 'fm-title', item.label), 'buy-title'))
    var columns = put(box, app.el('div', 'fm-buy-columns'))
    put(columns, product(app, item, 'fm-buy-art'))
    var info = put(columns, app.el('div', 'fm-buy-info'))
    var rows = item.category === 'seed' ? [['成熟时间', item.hours + ' 小时'], ['能收几季', item.seasons + ' 季'], ['预计产量', item.yield + ' 个 / 季'], ['果实售价', item.sell + ' 菜币 / 个'], ['预计收入', item.yield * item.sell * item.seasons + ' 菜币'], ['收获经验', item.exp + ' / 季'], ['需要等级', item.level + ' 级']] : [['说明', item.note]]
    rows.forEach(function (row) { put(info, bg(app, app.el('div', 'fm-info-row', row[0] + '　' + row[1]), 'info-row')) })
    var many = item.category === 'seed' || item.category === 'fert'
    var stepper = put(box, app.el('div', 'fm-stepper'))
    put(stepper, app.el('span', null, '数量'))
    put(stepper, bg(app, button(app, 'fm-step', { 'data-farm-quantity': 'minus', 'aria-label': '减少数量' }, '−', function () { quantity = Math.max(1, quantity - 1); app.rerender() }), 'stepper-minus')).disabled = !many || quantity === 1
    var field = put(stepper, bg(app, app.el('input', 'fm-quantity'), 'stepper-field')); field.type = 'number'; field.min = '1'; field.max = many ? '99' : '1'; field.value = String(quantity); field.disabled = !many; field.setAttribute('aria-label', '数量'); field.setAttribute('data-farm-quantity-field', 'true')
    ;['input', 'change'].forEach(function (type) { field.addEventListener(type, function () {
      quantity = Math.max(1, Math.min(many ? 99 : 1, Math.floor(Number(field.value) || 1)))
      total.textContent = '总价 ' + quantity * item.price + ' 菜币'; total.setAttribute('data-farm-total', String(quantity * item.price))
      box.querySelector('[data-farm-confirm]').disabled = item.disabled || quantity * item.price > data.balance
      ;['minus', 'plus'].forEach(function (key) { box.querySelector('[data-farm-quantity="' + key + '"]').disabled = !many || quantity === (key === 'minus' ? 1 : 99) })
      if (type === 'change') field.value = String(quantity)
    }) })
    put(stepper, bg(app, button(app, 'fm-step', { 'data-farm-quantity': 'plus', 'aria-label': '增加数量' }, '+', function () { quantity = Math.min(99, quantity + 1); app.rerender() }), 'stepper-plus')).disabled = !many || quantity === 99
    var total = put(box, app.el('div', 'fm-total', '总价 ' + quantity * item.price + ' 菜币' + (item.price > data.balance ? ' · 菜币不足' : item.level > data.level ? ' · 需要 ' + item.level + ' 级' : ''))); total.setAttribute('data-farm-total', String(quantity * item.price))
    modalButtons(app, box, function () { pendingAction = { op: 'buy', item: item, count: quantity, before: data }; rememberScroll(app, pageKey(app)); app.send('buy', { item: item.key, count: quantity }); purchase = null; app.rerender() }, cancel, item.disabled || quantity * item.price > data.balance)
  }
  function pageHead(app, box, title) {
    var head = put(box, app.el('div', 'fm-page-head'))
    put(head, button(app, 'dp-drill-back fm-page-back', { 'data-farm-back': 'true', 'aria-label': '返回菜地' }, '‹', function () { closePage(app) }))
    put(head, app.el('b', 'fm-title', title))
    return head
  }
  function renderLayers(app, data, root) {
    cancelLayer = null
    if (popup) {
      var box = put(root, app.el('div', 'fm-pop' + (popup === 'shop' ? ' fm-shop' : '')))
      box.setAttribute('data-scroll-key', 'farm-popup:' + popup + ':' + (popup === 'shop' ? shopTab : popup === 'bag' ? bagTab : 'wallet'))
      box.setAttribute('data-farm-overlay', popup)
      frame(app, box)
      pageHead(app, box, { shop: '农场商店', bag: '背包', wallet: '菜币' }[popup])
      if (popup === 'shop') renderShop(app, data, box)
      else if (popup === 'bag') renderBag(app, data, box)
      else if (app.walletContent) put(box, app.walletContent())
      else put(box, app.el('div', 'fm-note', '钱包在设置里。'))
    }
    if (purchase) renderPurchase(app, data, root)
    if (confirmClear !== null) {
      var index = confirmClear, cancel = function () { rememberScroll(app, pageKey(app)); confirmClear = null; app.rerender() }
      var box = modal(app, root, 'fm-clear-confirm', cancel); box.setAttribute('aria-label', '铲除确认')
      put(box, bg(app, app.el('b', 'fm-title', '铲掉正在长的' + data.plots[index].label + '？'), 'shop-title'))
      put(box, img(app, 'fm-clear-art', 'produce-' + data.plots[index].crop))
      modalButtons(app, box, function () { rememberScroll(app, pageKey(app)); confirmClear = null; act(app, index, '🪏', 'clear', { plot: index, force: true }) }, cancel)
    }
  }
  function focusDescriptor(node) {
    if (!node) return null
    var attrs = ['data-farm-quantity-field', 'data-farm-quantity', 'data-farm-back', 'data-farm-confirm', 'data-farm-cancel']
    for (var i = 0; i < attrs.length; i += 1) if (node.getAttribute(attrs[i]) !== null) return { attr: attrs[i], value: node.getAttribute(attrs[i]) }
    return null
  }
  function inDialog(node) {
    while (node) { if (node.getAttribute && node.getAttribute('role') === 'dialog') return true; node = node.parentNode }
    return false
  }
  function syncModalFocus(app, root) {
    var dialog = root.querySelector('[role="dialog"]')
    if (dialog) {
      var target = null
      if (modalOpen && modalFocus) target = dialog.querySelector('[' + modalFocus.attr + '="' + modalFocus.value + '"]')
      if (target && target.disabled) target = null
      if (!modalOpen || !target) {
        var field = dialog.querySelector('[data-farm-quantity-field="true"]'), confirm = dialog.querySelector('[data-farm-confirm="true"]')
        target = field && !field.disabled ? field : confirm && !confirm.disabled ? confirm : dialog.querySelector('[data-farm-cancel="true"]')
      }
      modalOpen = true
      if (target && document.activeElement !== target) target.focus()
      modalFocus = focusDescriptor(target) || modalFocus
      return
    }
    if (modalOpen) {
      var trigger = modalReturn && root.querySelector('[' + modalReturn.attr + '="' + modalReturn.value + '"]')
      modalOpen = false; modalFocus = null; modalReturn = null
      if (trigger) trigger.focus()
    }
  }
  function render(app) {
    ensureStyle(app)
    var data = app.data
    if (!data || !Array.isArray(data.plots) || !data.plots.length || data.plots[0] === null || typeof data.plots[0] !== 'object') { app.content.appendChild(app.el('div', 'dp-empty', '菜园还在准备……')); return }
    if (!data.currency) data.currency = { emoji: '🪙', label: '金币' }
    currentApp = app
    bindKeyboard()
    finishAction(app, data)
    syncHand(data)
    renderGarden(app, data)
    var root = app.content.querySelector('.fm')
    if (root) {
      currentKey = pageKey(app)
      if (app.mode === 'big') { lastRoot = root; watchScroll(root) } else if (!watchingContent) { watchingContent = true; watchScroll(app.content) }
      restoreScroll(app, currentKey)
      syncModalFocus(app, root)
      root.addEventListener('click', function (event) { if (popup && !purchase && !event.target.closest('.fm-pop,button,input')) closePage(app) })
    }
  }
  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('farm', { render: render })
})()
