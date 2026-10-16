// 菜园 4.0 的界面（照 QQ 农场改版，设计见 docs/design/farm-qqfarm.md）：
// - 小农场（app.mode 'panel'，面板里）：竖版，显示前 6 块地，下面一个主按钮做最该做的事；
// - 大农场（app.mode 'big'，单独的大窗口）：横版，18 块菱形地斜着排，底部工具栏，点地块用手里的工具。
// 两边是同一份数据，只是两种看法（用户 2026-10-12）。地块和仓库只根据宿主快照绘制；
// 手里拿的工具 / 种子、开着的弹层留在本页。素材是用户选定的大农场 B 羊皮纸与浅木纹、小农场 C1，猪用玩家现在的猪图。
;(function () {
  'use strict'
  /** 手里拿的东西：auto（手套：只收成熟作物）、seed、care（浇水 / 除草 / 杀虫）、shovel、fert。 */
  var hand = { kind: 'auto', key: null }
  var popup = null
  var openCrop = null
  var confirmClear = null
  var tip = null
  var tipAt = 0, tipPlot = null, shopTab = 'seed', purchase = null, quantity = 1
  var currentApp = null, keyboardBound = false, pendingAction = null, paintedPopup = null, cancelLayer = null
  var modalOpen = false, modalFocus = null, modalReturn = null
  var effects = {}
  var styleId = 'dsh-piggy-farm-style-4'
  var SMALL_PLOTS = 6
  var PEST_LABEL = { dry: '干了', weed: '长草', bug: '生虫' }
  var ONE_CLICK = [{ key: 'sickle', op: 'harvestAll', label: '一键收获', tool: '收割镰' }, { key: 'sprayer', op: 'careAll', label: '一键照料', tool: '喷雾桶' },
    { key: 'rake', op: 'clearAll', label: '一键铲除', tool: '平地耙' }, { key: 'planter', op: 'plantAll', label: '一键播种', tool: '播种器' }]
  var WEATHER = { sunny: '☀️', rain: '🌧️', night: '🌙' }
  var AUTO = { kind: 'auto', key: null }
  // 样式：通用件、弹层、小农场（fm-s-）、大农场（fm-b-，整幅 3:2 场景按窗口缩放，里面按百分比摆）
  var css = [
    ".fm{--animal-primary:var(--ac-primary,#19c8b9);--animal-text:var(--ac-text,#794f27);--animal-text-body:var(--ac-text-body,#725d42);--animal-bg:var(--ac-bg,#f8f8f0);--animal-bg-content:var(--ac-bg-content,#f7f3df);--animal-border:var(--ac-border,#c4b89e);--animal-focus-yellow:#ffcc00;--animal-ease:cubic-bezier(.4,0,.2,1);--animal-duration:.25s;--fm-panel-limit:min(var(--ext-panel-height,100%),var(--fm-panel-avail,9999px));font:500 12px/1.35 var(--ac-font,Nunito,\"Noto Sans SC\",\"Microsoft YaHei UI\",sans-serif);position:relative;display:grid;gap:8px;padding:8px;box-sizing:border-box;color:var(--animal-text-body);background:var(--animal-bg);font-variant-numeric:tabular-nums}.fm:not(.fm-big){padding:0;grid-template-columns:minmax(0,1fr);grid-template-rows:54px minmax(140px,1fr) 150px;height:min(calc(var(--ext-panel-height,480px) - var(--fm-content-top,0px)),var(--fm-panel-avail,9999px))}.fm:not(.fm-big):has(.fm-s-note){grid-template-rows:54px minmax(140px,1fr) 32px 150px}.dp-content:has(>.dp-drill)>.fm{--fm-content-top:56px}.fm *{box-sizing:border-box}.fm img{object-fit:contain;pointer-events:none}.fm button,.fm input{font:inherit;font-weight:700;color:inherit;border-radius:50px;min-width:32px;min-height:32px;transition:translate .25s var(--animal-ease),background-color .25s var(--animal-ease);cursor:pointer}.fm button:active{translate:0 2px}.fm button:focus-visible,.fm input:focus-visible{outline:2px solid var(--animal-primary);outline-offset:2px}.fm button:disabled{cursor:default}",
    ".fm-paper{position:relative;isolation:isolate;border:0;padding:48px 48px 32px;color:var(--animal-text-body);background:var(--animal-bg-content);clip-path:url(#farm-redraw-paper)}.fm-paper::after{content:\"\";position:absolute;inset:8px;z-index:-1;pointer-events:none;background-image:var(--fm-flower-left),var(--fm-flower-right);background-size:32px auto,32px auto;background-position:left top,right bottom;background-repeat:no-repeat}.fm-paper .fm-close{position:absolute;right:48px;top:48px;width:32px;height:32px;border:2px solid var(--animal-border);background-color:var(--animal-bg);background-position:center;background-repeat:no-repeat;background-size:18px 18px;z-index:2}.fm-title{position:relative;isolation:isolate;display:inline-flex;justify-content:center;align-items:center;min-height:40px;padding:8px 24px;border-radius:4px;background:linear-gradient(#3dd4c6,var(--animal-primary));color:#fff9e3;font-size:20px;font-weight:800;line-height:1.35;text-align:center;max-width:calc(100% - 40px)}.fm-title::before,.fm-title::after{content:\"\";position:absolute;z-index:-1;top:8px;width:22px;height:100%;background:#11a89b;pointer-events:none}.fm-title::before{left:-14px;clip-path:polygon(100% 0,100% 100%,0 100%,30% 50%,0 0)}.fm-title::after{right:-14px;clip-path:polygon(0 0,100% 0,70% 50%,100% 100%,0 100%)}",
    ".fm-slot{position:relative;flex:none;width:44px;height:44px;border:2px solid var(--animal-border);padding:8px;background:var(--animal-bg-content)}.fm-slot>img{width:100%;height:100%;object-fit:contain}.fm-slot[aria-pressed=\"true\"]{background:#e6f9f6;border:2px solid var(--animal-primary)}.fm-slot[data-locked=\"true\"]>img{opacity:.55}.fm-n,.fm-lock{position:absolute;right:0;top:-13px;min-width:20px;height:20px;border:2px solid var(--animal-bg-content);border-radius:50px;background-color:#f7cd67;color:var(--animal-text);display:grid;place-items:center;padding:0 3px;font-size:12px;font-weight:800;font-style:normal;line-height:1;pointer-events:none}.fm-lock{width:20px;background-color:var(--animal-bg-content);background-size:16px 16px;background-position:center;background-repeat:no-repeat}.fm-tool-label{position:absolute;top:calc(100% + 3px);left:50%;transform:translateX(-50%);font-size:12px;line-height:1.3;white-space:nowrap}.fm-tooltip{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);padding:8px 12px;border-radius:16px;background:var(--animal-bg-content);border:2px solid var(--animal-border);font-size:12px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s var(--animal-ease);z-index:50}.fm-slot[data-farm-hover=\"true\"] .fm-tooltip,.fm-slot:focus-visible .fm-tooltip{opacity:1}.fm:not(.fm-big) .fm-tooltip{display:none}.fm-b-bar>.fm-slot:nth-child(-n+3) .fm-tooltip{left:0;transform:none}",
    ".fm-plot{position:absolute;display:block;border-radius:12px!important;border:0;padding:0;background:center/contain no-repeat;overflow:visible;cursor:pointer}.fm-crop{position:absolute;bottom:10%;left:50%;transform:translateX(-50%);width:48%;height:88%;object-fit:contain;pointer-events:none}.fm-pest{position:absolute;bottom:15%;left:50%;transform:translateX(-50%);width:24px;height:24px;object-fit:contain;pointer-events:none}.fm-bubble{position:absolute;z-index:3;top:0;width:24px;height:24px;object-fit:contain;pointer-events:none}.fm-hover{position:absolute;inset:0;width:100%;height:100%;opacity:0;object-fit:contain;pointer-events:none}.fm-plot[data-farm-hover=\"true\"]>.fm-hover{opacity:1}.fm-ghost{position:absolute;inset:0;display:grid;place-items:center;background:center/contain no-repeat;pointer-events:none}.fm-ghost img{width:32%;height:50%;opacity:.45;object-fit:contain}.fm-chip{position:absolute;left:50%;bottom:3%;transform:translateX(-50%);padding:2px 6px;border-radius:12px;font-size:12px;font-weight:700;white-space:nowrap;background:var(--animal-bg-content);pointer-events:none}.fm-ripe>.fm-crop{filter:drop-shadow(0 0 4px #f5c31c)}",
    ".fm-stat{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800}.fm-stat img{width:24px;height:24px;object-fit:contain}.fm-exp{position:relative;display:block;width:60px;height:14px;border:2px solid #e2d6bd;border-radius:50px;background:var(--animal-bg);overflow:hidden}.fm-exp>i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(#3dd4c6,var(--animal-primary));border-radius:50px}.fm-coin{border:0;background:none;padding:0}.fm-sign{position:relative;border:2px solid var(--animal-border);padding:8px;display:flex;align-items:center;justify-content:center;gap:4px;background:var(--animal-bg-content);font-size:12px!important;font-weight:700;white-space:nowrap}.fm-sign img{width:24px;height:24px;object-fit:contain}.fm-main,.fm-confirm{border:0;background:var(--animal-primary);box-shadow:0 5px 0 #bdaea0;color:#fff9e3!important;font-weight:800}.fm-main{padding:8px;display:grid;place-content:center;gap:3px;white-space:normal;overflow-wrap:anywhere;font-size:16px!important;line-height:1.3}.fm-main small{font-size:12px}.fm-main:not(:disabled):hover,.fm-confirm:not(:disabled):hover{translate:0 -1px;box-shadow:0 6px 0 #bdaea0}.fm-main:not(:disabled):active,.fm-confirm:not(:disabled):active{translate:0 2px;box-shadow:0 1px 0 #bdaea0}.fm-main:disabled{background:#f0ece2;color:var(--animal-text-body)!important;box-shadow:none}",
    ".fm-s-header{position:relative;isolation:isolate;display:flex;align-items:center;justify-content:space-between;gap:4px;min-height:54px;padding:6px 6px;background:var(--animal-bg-content);border:2px solid var(--animal-border);border-bottom:5px solid #d5b185;border-radius:20px}.fm-s-header>[data-farm-level]{display:grid;gap:3px}.fm-s-face{width:24px;height:28px;object-fit:contain}.fm-s-weather{width:32px;height:32px;flex:none}.fm-s-big{border:2px solid var(--animal-border);position:static;width:58px;height:36px;font-size:12px!important;padding:0;background:var(--animal-bg)}.fm-s-header .fm-exp{width:44px}.fm-s-scene{position:relative;border-radius:20px;overflow:hidden;height:100%;min-height:0;aspect-ratio:auto;background:#a8d07c center top/cover no-repeat;border:2px solid var(--animal-bg-content)}.fm-s-field{position:absolute;left:4%;right:4%;top:23%;bottom:3%}.fm-s-field .fm-plot{width:49%;height:31%}.fm-s-field .fm-crop{bottom:9%;width:48%;height:88%}.fm-s-field .fm-bubble{top:0;width:24px;height:24px}.fm-s-pig{min-width:24px;min-height:24px;position:absolute;right:6%;top:3%;width:11%;max-height:15%;object-fit:contain}.fm-s-note{font-size:12px;text-align:center;min-height:32px;padding:7px 10px;border:2px solid var(--animal-border);border-radius:16px;background:var(--animal-bg-content)}",
    ".fm-s-plank{position:relative;isolation:isolate;display:grid;gap:8px;padding:10px 8px 8px;background:var(--animal-bg-content);border:2px solid var(--animal-border);border-bottom:4px solid #d5b185;border-radius:20px}.fm-s-tools{display:flex;justify-content:space-between;gap:4px;padding-bottom:18px}.fm-s-acts{display:grid;grid-template-columns:62px minmax(0,1fr) 62px;gap:8px}.fm-s-acts>.fm-sign{flex-direction:column;gap:2px;padding:5px 4px}.fm-s-acts>.fm-main{min-height:54px}.fm-s-header::after,.fm-s-plank::after{content:\"\";position:absolute;width:28px;height:28px;right:-3px;top:-5px;background:var(--fm-flower-right) center/contain no-repeat;pointer-events:none}.fm-s-plank::before{content:\"\";position:absolute;inset:auto 6px -6px;height:6px;background:var(--fm-wood) center/auto 12px repeat-x;pointer-events:none}",
    ".fm.fm-big{width:100%;height:100%;padding:0;display:grid;place-items:center;background:var(--animal-bg-content) center/cover no-repeat;overflow:hidden}.fm-b-scene{position:relative;width:min(100%,150vh);aspect-ratio:3/2;max-height:100%;background:center/contain no-repeat;overflow:hidden;container-type:inline-size}.fm-b-top{position:absolute;left:1.5%;top:1.5%;width:clamp(260px,36%,560px);max-width:calc(100% - 24px);min-height:64px;background:var(--animal-bg-content);border:2px solid var(--animal-border);border-bottom:5px solid #d5b185;border-radius:50px;display:flex;align-items:center;gap:3%;padding:10px 16px;z-index:4}.fm-b-top .fm-stat{font-size:clamp(14px,1.6cqw,24px)}.fm-b-top .fm-stat img{width:clamp(24px,2.4cqw,36px);height:auto}.fm-b-top .fm-exp{width:7cqw;height:14px}.fm-b-face{width:clamp(28px,4cqw,50px);height:clamp(28px,4cqw,50px);object-fit:contain}.fm-b-weather{position:absolute;left:46%;top:1%;width:7%;min-width:40px;z-index:4}.fm-b-helper{position:absolute;right:2%;top:15%;width:clamp(156px,18%,240px);z-index:4;border:2px solid var(--animal-border);padding:8px 10px;font-size:clamp(12px,1cqw,15px)!important;white-space:nowrap;background:var(--animal-bg-content);display:flex;align-items:center;gap:6px}.fm-b-helper span{white-space:normal;min-width:0}.fm-b-helper img{width:28px;height:28px;object-fit:contain}",
    ".fm-hit{position:absolute;inset:0;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);pointer-events:auto;cursor:inherit;z-index:5}.fm-b-field{position:absolute;inset:0;z-index:1;pointer-events:none}.fm-b-field .fm-plot{pointer-events:none;background-size:0 0!important;background-color:transparent}.fm-b-field .fm-plot::before{content:\"\";position:absolute;inset:0;background-image:inherit;background-position:center;background-size:contain;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);pointer-events:none}.fm-b-field .fm-hover{clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}.fm-b-field .fm-plot[data-farm-hover=\"true\"]{z-index:40!important}.fm-b-field .fm-plot:has(.fm-expand){z-index:2}.fm-b-field .fm-crop{z-index:2;bottom:24%;width:42%;height:54%}.fm-b-field .fm-pest{z-index:2;left:calc(50% - 12px);bottom:32%;width:24px;height:24px;transform:none}.fm-b-field .fm-bubble{top:10%;width:24px;height:24px}.fm-b-field .fm-chip{z-index:4;bottom:2%;max-width:calc(100% - 4px);padding:2px 8px;text-align:center;line-height:1.1;font-size:clamp(12px,1.1cqw,14px)}.fm-b-field .fm-expand{top:70%;bottom:auto;width:112px;max-width:calc(100% - 4px);height:34px;min-height:32px;transform:translate(-50%,-50%);padding:0;border:2px solid var(--animal-border);z-index:6;pointer-events:auto;display:grid;place-content:center;background:var(--animal-bg-content);box-shadow:0 3px 0 #bdaea0}.fm-b-pig{position:absolute;left:79%;top:31%;width:7%;z-index:3;object-fit:contain}",
    ".fm-b-bar{position:absolute;left:1.5%;right:1.5%;bottom:1.5%;height:max(90px,15%);background:var(--animal-bg-content);border:2px solid var(--animal-border);border-bottom:7px solid #d5b185;border-radius:24px;display:grid;grid-template-columns:repeat(7,minmax(38px,1fr)) repeat(4,minmax(50px,1.1fr)) repeat(3,minmax(58px,1.2fr));align-items:center;gap:2px;padding:12px 8px 20px;z-index:4}.fm-b-bar::before{content:\"\";position:absolute;inset:auto 8px -7px;height:7px;background:var(--fm-wood) center/auto 18px repeat-x;pointer-events:none}.fm-b-bar::after,.fm-b-top::after{content:\"\";position:absolute;right:0;top:-5px;width:32px;height:32px;background:var(--fm-flower-right) center/contain no-repeat;pointer-events:none}.fm-b-bar .fm-slot{width:100%;max-width:54px;height:auto;aspect-ratio:1;padding:5px;justify-self:center}.fm-b-bar .fm-tool-label{font-size:clamp(12px,1.1cqw,14px)}.fm-b-bar .fm-n,.fm-b-bar .fm-lock{top:-13px}.fm-b-gap{display:none}.fm-b-bar .fm-sign{width:100%;height:60px;padding:6px;flex-direction:column;gap:3px;font-size:clamp(12px,1.1cqw,15px)!important}.fm-b-bar .fm-sign img{width:24px;height:24px;flex:none}",
    ".fm-pop{position:absolute;display:grid;gap:16px;z-index:8;grid-template-rows:auto minmax(0,1fr)}.fm-pop:has(>[data-farm-helper]){grid-template-rows:max-content max-content minmax(0,1fr)}.fm-b-pop{left:15%;right:15%;bottom:17%;max-height:68%}.fm-pop.fm-shop{height:70%;grid-template-rows:auto auto minmax(0,1fr)}.fm:not(.fm-big)>.fm-mask{bottom:auto;height:min(var(--ext-panel-height,100%),var(--fm-panel-avail,9999px))}.fm-s-pop{left:0;right:0;top:0;bottom:auto;max-height:min(var(--ext-panel-height,100%),var(--fm-panel-avail,9999px));padding:24px 16px;grid-template-rows:max-content max-content max-content;overflow:auto;gap:12px}.fm-s-pop.fm-shop{height:var(--fm-panel-limit);display:block}.fm-s-pop.fm-shop .fm-shop-grid{overflow:visible;margin-top:12px}.fm-shop-head,.fm-section{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding-right:40px;min-height:40px;font-size:14px}.fm-shop-head>.fm-title{grid-column:2;grid-row:1;justify-self:center;max-width:none;white-space:nowrap}.fm-shop-head>.dp-mini{grid-column:1;grid-row:1;justify-self:start}.fm-shop-wallet{grid-column:1;grid-row:1;justify-self:start;display:flex;align-items:center;gap:6px;white-space:nowrap;font-size:14px}.fm-shop-coin{flex:none;width:24px;height:24px}.fm-shop-grid,.fm-stock{--fm-cols:3;--fm-grid-gap:12px;container-type:inline-size;align-content:start;display:grid;grid-template-columns:repeat(var(--fm-cols),minmax(0,1fr));gap:var(--fm-grid-gap);overflow:auto;min-height:0;max-height:50cqw;padding:3px;grid-auto-rows:max-content}.fm:not(.fm-big) .fm-shop-grid,.fm:not(.fm-big) .fm-stock{--fm-cols:2;--fm-grid-gap:8px;max-height:240px}.fm .fm-shop-item,.fm .fm-pack-slot,.fm .fm-cropbtn{border-radius:20px;display:grid;grid-template-rows:minmax(40px,1fr) auto auto;gap:8px;align-items:center;justify-items:center;text-align:center;width:auto;height:auto;min-height:clamp(128px,20cqw,240px);padding:16px 10px;border:2px solid var(--animal-border);background:var(--animal-bg);font-size:14px!important;box-shadow:none}.fm:not(.fm-big) .fm-shop-item,.fm:not(.fm-big) .fm-pack-slot,.fm:not(.fm-big) .fm-cropbtn{padding:10px;gap:5px;min-height:148px;font-size:12px!important}.fm-shop-item[aria-disabled=\"true\"]>.fm-product{opacity:.5;filter:grayscale(.6)}.fm-shop-item[aria-pressed=\"true\"],.fm-cropbtn[aria-pressed=\"true\"]{border:2px solid var(--animal-primary);background:#e6f9f6}.fm-pack-title{display:none}",
    ".fm-product{width:75%;height:80px;max-height:100%;object-fit:contain}.fm-packet{display:block;position:relative;aspect-ratio:247/256;background:center/contain no-repeat}.fm-product.fm-packet{width:min(75%,84px);height:auto}.fm-buy-art.fm-packet{width:min(100%,18cqw*247/256);height:auto;justify-self:center}.fm:not(.fm-big) .fm-buy-art.fm-packet{width:min(100%,110px);height:auto}.fm-packet img{position:absolute;left:19%;top:30%;width:63%;height:55%;object-fit:contain}.fm-price,.fm-unavailable,.fm-seed-name{font-size:14px;line-height:1.3;overflow-wrap:anywhere}.fm-unavailable{background:#f0e8d8;border-radius:50px;padding:4px 8px;color:var(--animal-text-body)}.fm-sellbar{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--animal-bg);padding:8px;border-radius:18px}.fm .dp-mini{font-size:12px;padding:8px 12px;min-height:36px}.fm-note{font-size:12px;line-height:1.4}.fm-stock .fm-note{grid-column:1/-1}[data-farm-fert]>b{white-space:pre-line}.fm-count{position:static;width:auto;height:auto;background:none;color:inherit;font-size:12px;padding:0}.fm-shop-item>img{min-width:24px;min-height:24px}.fm:not(.fm-big) .fm-price,.fm:not(.fm-big) .fm-unavailable,.fm:not(.fm-big) .fm-seed-name{font-size:12px}",
    ".fm-tabs{display:flex;gap:8px;padding:4px;border:2px solid var(--animal-border);border-radius:50px;background:var(--animal-bg)}.fm-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:transparent;border:0;min-height:40px;padding:6px;font-size:14px!important;white-space:nowrap}.fm-tab[aria-selected=\"true\"]{background:var(--animal-primary);color:#fff9e3}.fm-tab img{flex:none;width:24px;height:24px;object-fit:contain}.fm:not(.fm-big) .fm-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-radius:20px;gap:4px}.fm:not(.fm-big) .fm-tab{font-size:12px!important;padding:6px 2px;gap:4px}.fm:not(.fm-big) .fm-shop-head,.fm:not(.fm-big) .fm-section{display:flex;flex-wrap:wrap;gap:24px}.fm:not(.fm-big) .fm-paper .fm-close{right:24px;top:24px}.fm:not(.fm-big) .fm-title{font-size:16px;min-height:36px;padding:6px 14px}.fm:not(.fm-big) .fm-shop-wallet{font-size:12px}[data-dsh-pig]:has(.fm) .dp-drill-back{width:32px;height:32px;font-size:24px}[data-dsh-pig]:has(.fm) .dp-drill,[data-dsh-pig]:has(.fm) .dp-hud,[data-dsh-pig]:has(.fm) .dp-drill-info{font-size:12px}",
    ".fm-mask{position:absolute;inset:0;z-index:15;background:rgba(61,52,40,.35);display:grid;place-items:center;padding:8px}.fm-buy,.fm-clear-confirm{width:62%;max-height:94%;overflow:auto}.fm-buy{display:flex;flex-direction:column;overflow:hidden;gap:8px}.fm-buy-columns{overflow:auto;min-height:0;flex-shrink:1;display:grid;grid-template-columns:40% 1fr;gap:20px;margin:8px 0}.fm-buy>.fm-title,.fm-buy>.fm-stepper,.fm-buy>.fm-total,.fm-buy>.fm-modal-buttons{flex-shrink:0}.fm-clear-confirm{width:48%;text-align:center;font-size:16px;padding:36px}.fm-buy>.fm-title,.fm-clear-confirm>.fm-title{margin-right:64px;max-width:calc(100% - 64px);display:block}.fm-buy-art{width:100%;height:clamp(110px,18cqw,220px);object-fit:contain}.fm-buy-info{display:grid;gap:6px;min-width:0}.fm-info-row{padding:6px 10px;font-size:14px;border-radius:50px;background:#f0e8d8}.fm:not(.fm-big) .fm-buy,.fm:not(.fm-big) .fm-clear-confirm{width:100%;padding:24px 16px}.fm:not(.fm-big) .fm-buy-columns{grid-template-columns:30% 1fr;gap:8px}.fm:not(.fm-big) .fm-buy-art{height:110px}.fm:not(.fm-big) .fm-info-row{font-size:12px;padding:4px 6px}",
    ".fm-stepper{display:flex;align-items:center;justify-content:center;gap:8px;margin:4px 0}.fm-step{width:36px;height:36px;border:2px solid var(--animal-border);background-color:var(--animal-bg);background-size:18px 18px;background-position:center;background-repeat:no-repeat}.fm-step:disabled{opacity:.5}.fm-quantity{width:56px;height:36px;box-sizing:border-box;border:2px solid var(--animal-border);background:var(--animal-bg);text-align:center;appearance:textfield}.fm-quantity::-webkit-inner-spin-button{appearance:none}.fm-total{text-align:center;font-size:20px;font-weight:800;margin:4px}.fm-modal-buttons{display:flex;justify-content:center;gap:12px;margin-top:8px}.fm-confirm,.fm-cancel{width:45%;min-height:44px;border:2px solid var(--animal-border);padding:8px 12px;font-size:14px!important}.fm-confirm{border-color:var(--animal-primary)}.fm-confirm:disabled{background:#f0ece2;color:var(--animal-text-body)!important;box-shadow:none}.fm-cancel{background:var(--animal-bg)}.fm-clear-art{display:block;width:128px;height:128px;margin:16px auto;border-radius:50%;padding:12px;background:#e6f9f6;object-fit:contain}.fm-clear-confirm .fm-confirm:hover{box-shadow:0 6px 0 #c94444}.fm-clear-confirm .fm-confirm:active{box-shadow:0 1px 0 #c94444}.fm-clear-confirm .fm-confirm{background:var(--ac-error,#e05a5a);border-color:var(--ac-error,#e05a5a);box-shadow:0 5px 0 #c94444}",
    ".fm-hover-card{clip-path:none;border-radius:24px;position:absolute;width:max(220px,28%);z-index:6;pointer-events:none;font-size:clamp(12px,1.2cqw,18px);padding:22px}.fm-card-crop{float:left;width:24%;height:5cqw;object-fit:contain;margin-right:8px}.fm-card-progress{overflow:hidden;border-radius:50px;height:14px;border:2px solid #e2d6bd;background:var(--animal-bg);margin:8px 0;clear:both}.fm-card-progress>i{display:block;height:100%;background:var(--animal-primary);border-radius:50px}.fm-card-status{display:flex;gap:6px;clear:both}.fm-status{flex:1;display:flex;flex-direction:column-reverse;align-items:center;white-space:nowrap;font-size:12px;background:var(--animal-bg);border-radius:50px;padding:6px}.fm-status img{width:24px;height:24px;object-fit:contain}.fm-status[data-active=\"true\"]{background:#fff2c9}.fm-status[data-active=\"false\"] img{opacity:.5}.fm-hover-card::after{content:\"\";position:absolute;left:var(--fm-tail-x,50%);top:calc(100% - 2px);width:24px;height:14px;transform:translateX(-50%);background:var(--animal-bg-content);clip-path:polygon(0 0,100% 0,50% 100%)}.fm-hover-card[data-farm-below=\"true\"]::after{top:auto;bottom:calc(100% - 2px);transform:translateX(-50%) rotate(180deg)}",
    ".fm-toast::after{display:none}.fm-toast{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);min-width:100px;max-width:250px;text-align:center;font-size:12px;font-weight:700;white-space:normal;overflow-wrap:anywhere;z-index:30;pointer-events:none;padding:16px 22px;animation:fm-toast 2.4s var(--animal-ease) both}.fm-b-scene>.fm-toast,.fm>.fm-toast{bottom:38%}.fm-effect{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;font-size:22px;animation:fm-pop .6s var(--animal-ease) both}.fm-enter{animation:fm-rise .25s var(--animal-ease)}@keyframes fm-pop{0%{opacity:0;transform:translateY(6px) scale(.7)}35%{opacity:1;transform:translateY(-6px) scale(1.1)}100%{opacity:0;transform:translateY(-18px) scale(.9)}}@keyframes fm-toast{0%{opacity:0}10%,75%{opacity:1}100%{opacity:0}}@keyframes fm-rise{from{opacity:0;translate:0 8px}to{opacity:1;translate:0 0}}@media(prefers-reduced-motion:reduce){.fm *{animation:none!important;transition:none!important}.fm button:hover,.fm button:active{translate:none!important}.fm-toast{opacity:1}}",
    "@container(max-width:850px){.fm-big .fm-pop{padding:32px}.fm-big .fm-shop-head{display:flex;flex-direction:column;gap:8px}.fm-big .fm-shop-head>.fm-title{align-self:center}.fm-big .fm-shop-wallet{align-self:flex-start}.fm-big .fm-buy{padding:24px;gap:4px}.fm-big .fm-buy>.fm-title{margin-right:80px;max-width:calc(100% - 80px);font-size:18px;min-height:36px;padding:6px 12px}.fm-big .fm-buy-columns{gap:12px;margin:4px 0}.fm-big .fm-info-row{font-size:12px;padding:3px 8px;line-height:1.25}.fm-big .fm-buy-info{gap:4px}.fm-big .fm-buy-art{height:150px}}.fm:not(.fm-big)[data-farm-compact=\"true\"]{height:auto;grid-template-rows:none;grid-auto-rows:max-content}.fm[data-farm-compact=\"true\"] .fm-buy{display:block;overflow:auto}.fm[data-farm-compact=\"true\"] .fm-buy>.fm-title{display:block}.fm[data-farm-compact=\"true\"] .fm-buy-columns{grid-template-columns:1fr}.fm[data-farm-compact=\"true\"] .fm-buy-art{max-width:96px;max-height:100px;justify-self:center}.fm[data-farm-compact=\"true\"] .fm-s-header{padding:4px}.fm[data-farm-compact=\"true\"] .fm-s-scene{height:auto;aspect-ratio:1.55}.fm[data-farm-compact=\"true\"] .fm-s-field{top:20%;bottom:2%}.fm[data-farm-compact=\"true\"] .fm-s-pig{top:1%;width:11%;max-height:16%}.fm[data-farm-compact=\"true\"] .fm-s-plank{gap:10px;padding:8px}.fm[data-farm-compact=\"true\"] .fm-s-tools .fm-slot{width:38px;height:38px;padding:5px}.fm[data-farm-tight] .fm-s-pop:not(.fm-shop)>.fm-stock{overflow:visible;max-height:none}",
  ].join('')
  function ensureStyle(app) {
    var style = document.getElementById(styleId)
    if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style) }
    var themed = css + '.fm{--fm-flower-left:url("' + art(app, 'redraw-flower-left') + '");--fm-flower-right:url("' + art(app, 'redraw-flower-right') + '");--fm-wood:url("' + art(app, 'redraw-wood-strip') + '")}'
    if (style.textContent !== themed) style.textContent = themed
    if (!document.getElementById('farm-redraw-shape')) { var shape = document.createElement('div'); shape.id = 'farm-redraw-shape'; shape.style.position = 'absolute'; shape.style.width = '0'; shape.style.height = '0'; shape.innerHTML = "<svg width=\"0\" height=\"0\" aria-hidden=\"true\"><defs><clipPath id=\"farm-redraw-paper\" clipPathUnits=\"objectBoundingBox\"><path d=\"M0.501,0.005 L0.523,0.005 L0.549,0.006 C0.704,0.01,0.796,0.017,0.825,0.027 L0.827,0.028 C0.872,0.045,0.939,0.044,0.978,0.17 C1,0.254,1,0.365,0.99,0.505 L0.988,0.513 C0.979,0.558,0.971,0.598,0.965,0.633 C0.956,0.689,0.979,0.77,0.964,0.865 C0.953,0.928,0.921,0.966,0.869,0.979 C0.821,0.986,0.773,0.992,0.726,0.995 L0.712,0.996 L0.694,0.997 C0.648,1,0.586,1,0.507,1 L0.501,1 L0.464,1 C0.385,1,0.325,0.998,0.283,0.995 C0.234,0.992,0.184,0.987,0.133,0.979 C0.081,0.966,0.05,0.928,0.039,0.865 C0.023,0.77,0.047,0.689,0.037,0.633 C0.031,0.595,0.023,0.552,0.013,0.505 C-0.006,0.365,-0.002,0.254,0.024,0.17 C0.064,0.045,0.13,0.045,0.174,0.028 L0.175,0.028 C0.204,0.017,0.303,0.009,0.474,0.005 L0.501,0.005 Z\"/></clipPath></defs></svg>"; document.body.appendChild(shape) }
  }
  /** 扩展自带图片的地址；老宿主没有 app.asset 时给空串，界面退回 emoji。 */
  var cssArt = {"ui-slot": true, "ui-button": true, "ui-main": true, "ui-note": true, "ui-small-plank": true, "ui-big-toolbar": true, "ui-big-topbar": true, "ui-exp-frame": true, "progress-track": true, "progress-fill": true, "shop-title": true, "buy-title": true, "pack-title": true, "shop-tab": true, "shop-tab-active": true, "shop-item": true, "shop-item-locked": true, "pack-slot": true, "pack-slot-selected": true, "info-row": true, "stepper-field": true, "btn-confirm": true, "btn-cancel": true, "status-chip": true, "status-chip-active": true, "big-sign-expand": true, "card-tail": true}
  var controlArt = { "btn-close": "redraw-close", "stepper-plus": "redraw-plus", "stepper-minus": "redraw-minus", "lock-badge": "redraw-lock" }
  function art(app, name) { return cssArt[name] || typeof app.asset !== 'function' ? '' : app.asset((controlArt[name] || name) + '.webp') }
  function bg(app, node, name) { if (!name) return node; var url = art(app, name); if (url) node.style.backgroundImage = 'url("' + url + '")'; if (url && typeof app.paintAsset === 'function') app.paintAsset(node, (controlArt[name] || name) + '.webp'); return node }
  function picture(app, className, url, fallback) {
    if (!url) return app.el('span', className, fallback || '')
    var node = app.el('img', className); node.src = url; node.alt = ''; return node
  }
  function img(app, className, name, fallback) { return picture(app, className, art(app, name), fallback) }
  function put(parent, child) { parent.appendChild(child); return child }
  function button(app, className, attrs, label, onClick) { var node = app.button(className, attrs, onClick); node.textContent = label; return node }
  function pigOf(app, className) { return picture(app, className, typeof app.pigArt === 'function' ? app.pigArt() : null, '🐖') }
  function say(app, text, index) { tip = text; tipAt = Date.now(); tipPlot = index; app.rerender() }
  function goShop(app) { popup = 'shop'; purchase = null; app.rerender() }
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
  /** 手里的种子 / 肥料用完了就放下（空手 = 手套）。 */
  function syncHand(data) {
    var seed = hand.kind === 'seed' ? seedOf(data, hand.key) : null
    if (hand.kind === 'seed' && (!seed || seed.count < 1 || seed.locked)) hand = AUTO
    var fert = hand.kind === 'fert' ? (data.fert || []).find(function (f) { return f.key === hand.key }) : null
    if (hand.kind === 'fert' && (!fert || fert.count < 1)) hand = AUTO
  }
  function act(app, index, emoji, op, payload) { if (emoji) effect(index, emoji); pendingAction = { op: op, plot: index, before: app.data }; app.send(op, payload) }
  /** 点一块地：按手里拿的东西做事；手套（auto）只收成熟作物。 */
  function clickPlot(app, data, index) {
    var plot = data.plots[index]
    var shovel = hand.kind === 'shovel'
    if (plot.wild) return say(app, plot.next ? '点木牌开垦' : '要先开前一块荒地')
    if (shovel && plot.empty && !plot.stubble) return say(app, '这块地是空的', index)
    if (shovel && !plot.empty && !plot.withered) { confirmClear = index; modalReturn = { attr: 'data-farm-plot', value: String(index) }; return app.rerender() }
    if (shovel) { confirmClear = null; return act(app, index, '🪏', 'clear', plot.withered || plot.stubble ? { plot: index } : { plot: index, force: true }) }
    confirmClear = null
    if (hand.kind === 'care') {
      if (pestsOf(plot).indexOf(hand.key) >= 0) return act(app, index, hand.key === 'dry' ? '💧' : '✨', 'care', { plot: index, kind: hand.key })
      return say(app, hand.key === 'dry' ? '这块地不用浇水' : '这块地没有' + PEST_LABEL[hand.key], index)
    }
    if (hand.kind === 'fert') return plot.empty || plot.ripe || plot.withered ? say(app, '肥料要施在正在长的地上') : app.send('fertilize', { plot: index, item: hand.key })
    if (hand.kind === 'auto') {
      if (plot.ripe) return act(app, index, '✨', 'harvest', { plot: index })
      return say(app, plot.withered ? '用铁锹铲掉枯苗' : plot.stubble ? '用铁锹铲掉杂草' : pestsOf(plot).length ? { dry: '干了，用浇水壶', weed: '长草了，用除草剂', bug: '生虫了，用杀虫剂' }[pestsOf(plot)[0]] : plot.empty ? '拿种子播种' : '作物还没成熟', index)
    }
    if (plot.empty && (plot.stubble || pestsOf(plot).indexOf('weed') >= 0)) return say(app, '先除草 / 铲掉杂草', index)
    if (plot.empty) { var seed = seedInHand(data); return seed ? act(app, index, '🌱', 'plant', { plot: index, item: seed.key }) : goShop(app) }
    say(app, '这块地不是空地', index)
  }
  function reclaimPlot(app, data, index) {
    if (!data.plots[index].next) return say(app, '要先开前一块荒地')
    if (data.balance < data.reclaimPrice) return say(app, '开垦要 ' + data.currency.emoji + ' ' + data.reclaimPrice)
    app.send('unlock', { plot: index })
  }
  function reclaimSign(app, data, index) {
    var node = button(app, 'fm-chip fm-expand', { 'data-farm-reclaim': String(index), 'aria-label': '开垦这块荒地 ' + data.reclaimPrice + ' 菜币' }, '开垦 ' + data.reclaimPrice, function (event) { event.stopPropagation(); if (node.parentNode) node.parentNode.removeAttribute('data-farm-hover'); reclaimPlot(app, data, index) })
    return bg(app, node, 'big-sign-expand')
  }
  /** 一块地的按钮：土、作物、灾害与提示条；进度只在悬停卡中显示。 */
  function plotCard(app, data, index, kind) {
    var plot = data.plots[index]
    var attrs = { 'data-farm-plot': String(index), 'aria-label': plotLabel(plot) }
    var card = plot.wild ? app.el('div', 'fm-plot') : app.button('fm-plot' + (plot.ripe ? ' fm-ripe' : ''), attrs, function () { clickPlot(app, data, index) })
    if (plot.wild) card.setAttribute('role', 'group')
    if (plot.wild) Object.keys(attrs).forEach(function (key) { card.setAttribute(key, attrs[key]) })
    if (plot.wild) card.addEventListener('click', function () { clickPlot(app, data, index) })
    // 2026-10-13：只记录真实移动；点击和新节点不继承 CSS :hover 的常亮状态。
    card.addEventListener('mousemove', function () { card.setAttribute('data-farm-hover', 'true') })
    card.addEventListener('mouseleave', function () { card.removeAttribute('data-farm-hover') })
    card.addEventListener('click', function () { card.removeAttribute('data-farm-hover') })
    if (kind === 'big') { put(card, app.el('span', 'fm-hit')); attachHover(app, card, plot) }
    if (plot.wild) {
      bg(app, card, kind === 'big' ? 'big-plot-wild' : 'small-plot-farmed')
      put(card, img(app, 'fm-hover', kind + '-plot-hover'))
      if (plot.next) put(card, reclaimSign(app, data, index))
      return card
    }
    bg(app, card, kind + '-plot-' + (pestsOf(plot).indexOf('dry') >= 0 ? 'dry' : 'farmed'))
    put(card, img(app, 'fm-hover', kind + '-plot-hover'))
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
    attachEffect(app, card, index)
    return card
  }
  function plotLabel(plot) {
    if (plot.wild) return plot.next ? '荒地，点木牌开垦' : '荒地'
    if (plot.empty) return '空地'
    return plot.label + (plot.withered ? ' 枯了' : plot.ripe ? ' 熟了' : pestsOf(plot).length ? ' ' + pestText(plot, '、') : '')
  }
  /** 等级、经验条、菜币。 */
  function stats(app, data, box) {
    var level = put(box, app.button('fm-stat fm-coin', { 'data-farm-level': 'info', 'aria-label': '等级与经验' }, function () { say(app, '等级 ' + data.level + ' · 经验 ' + data.exp + ' / ' + data.need) }))
    put(level, app.el('b', null, 'Lv.' + data.level))
    var exp = put(level, bg(app, app.el('span', 'fm-exp'), 'ui-exp-frame'))
    exp.setAttribute('title', '经验 ' + data.exp + ' / ' + data.need)
    put(exp, app.el('i')).style.width = Math.max(0, Math.min(90, data.exp / data.need * 90)) + '%'
    var coin = put(box, app.button('fm-stat fm-coin', { 'data-farm-exchange': 'open', 'aria-label': '换菜币' }, function () { popup = popup === 'wallet' ? null : 'wallet'; app.rerender() }))
    put(coin, img(app, null, 'coin-veg', data.currency.emoji))
    put(coin, app.el('span', null, String(data.balance)))
  }
  function weatherButton(app, data, className) {
    var scene = sceneArt(app, app.mode === 'big' ? 'big' : 'small').split('-'), weather = scene.length === 4 ? scene[3] === 'rain' ? 'rain' : scene[2] === 'night' ? 'night' : 'sunny' : data.weather
    var node = app.button(className + ' fm-coin', { 'data-farm-weather': 'info', 'aria-label': '天气' }, function () { say(app, '天气：' + ({ sunny: '晴天', rain: '下雨', night: '夜晚' }[weather] || weather)) })
    var image = put(node, img(app, null, 'weather-' + weather, WEATHER[weather])); image.style.width = '100%'; image.style.height = '100%'
    return node
  }
  /** 工具格：选中就拿在手里；锁着的一键工具点了去商店。 */
  function toolSlot(app, spec) {
    var pressed = !!spec.hand && hand.kind === spec.hand.kind && hand.key === spec.hand.key
    var node = bg(app, app.button('fm-slot', { 'data-farm-tool': spec.key, 'aria-pressed': String(pressed), 'data-locked': String(!!spec.locked), 'aria-label': spec.label, title: spec.label }, function () {
      confirmClear = null
      if (spec.locked) return goShop(app)
      if (spec.run) return spec.run()
      hand = pressed ? AUTO : spec.hand
      app.rerender()
    }), 'ui-slot')
    node.addEventListener('mousemove', function () { node.setAttribute('data-farm-hover', 'true') })
    node.addEventListener('mouseleave', function () { node.removeAttribute('data-farm-hover') })
    node.addEventListener('click', function () { node.removeAttribute('data-farm-hover') })
    put(node, img(app, null, spec.art, spec.emoji))
    put(node, app.el('span', 'fm-tool-label', spec.label.split('：')[0].split('（')[0]))
    put(node, app.el('span', 'fm-tooltip', spec.label + (spec.hint ? ' · ' + spec.hint : ''))).setAttribute('role', 'tooltip')
    if (spec.locked) put(node, bg(app, app.el('span', 'fm-lock'), 'lock-badge'))
    else if (spec.count > 0) put(node, app.el('i', 'fm-n', String(spec.count)))
    return node
  }
  /** 木牌按钮（仓库、商店、大小农场）。 */
  function sign(app, attrs, artName, emoji, label, count, onClick) {
    var node = bg(app, app.button('fm-sign', attrs, onClick), 'ui-button')
    put(node, artName.indexOf('seed:') === 0 ? product(app, { key: artName.slice(5), category: 'seed' }, 'fm-product') : img(app, 'fm-product', artName, emoji))
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
    { key: 'can', art: 'tool-can', emoji: '💧', label: '浇水：点干了的地', hand: { kind: 'care', key: 'dry' }, hint: '点干了的地浇水' },
    { key: 'weedkiller', art: 'tool-weedkiller', emoji: '🌿', label: '除草：点长草的地', hand: { kind: 'care', key: 'weed' }, hint: '点长草的地除草' },
    { key: 'pesticide', art: 'tool-pesticide', emoji: '🐛', label: '杀虫：点生虫的地', hand: { kind: 'care', key: 'bug' }, hint: '点生虫的地杀虫' },
    { key: 'gloves', art: 'tool-gloves', emoji: '🧤', label: '手套：只收成熟作物', hand: AUTO },
  ]
  function careTools(app, data, to, ripe) {
    return CARE_TOOLS.map(function (spec) {
      var n = data.plots.slice(0, to).filter(function (plot) { return pestsOf(plot).indexOf(spec.hand.key) >= 0 }).length
      return toolSlot(app, Object.assign({}, spec, { count: spec.hand.kind === 'care' ? n : ripe }))
    })
  }
  /** 弹层里的一颗按钮（种子、肥料、作物）。 */
  function chip(app, attrs, artName, emoji, text, onClick) {
    var node = bg(app, app.button('fm-shop-item fm-cropbtn', attrs, onClick), 'shop-item')
    put(node, artName.indexOf('seed:') === 0 ? product(app, { key: artName.slice(5), category: 'seed' }, 'fm-product') : img(app, 'fm-product', artName, emoji))
    put(node, app.el('b', null, text))
    return node
  }
  /** 种子 / 肥料 / 仓库弹层。 */
  function renderPopup(app, data, box) {
    var head = put(box, app.el('div', 'fm-shop-head'))
    put(head, bg(app, app.el('b', 'fm-title', { seeds: '种子袋', fert: '肥料', stock: '仓库' }[popup]), 'shop-title'))
    var list = app.el('div', 'fm-stock fm-shop-grid')
    list.setAttribute('data-scroll-key', 'farm-stock:' + popup)
    var items = (popup === 'seeds' ? data.seeds : popup === 'fert' ? data.fert : data.harvest).filter(function (item) { return popup === 'fert' || item.count > 0 })
    var worth = popup === 'stock' ? items.reduce(function (sum, crop) { return sum + crop.count * crop.sell }, 0) : 0
    if (popup === 'seeds') put(head, button(app, 'dp-mini', { 'data-farm-shop': 'seed' }, '去买', function () { goShop(app) }))
    if (worth > 0) put(head, button(app, 'dp-mini', { 'data-farm-sell-everything': 'true' }, '全部卖掉 ' + data.currency.emoji + ' ' + worth, function () { openCrop = null; app.send('sell', { item: '*' }) }))
    if (popup === 'stock' && data.helper && data.helper.stored > 0) put(box, button(app, 'dp-mini', { 'data-farm-helper': 'collect' }, '把帮工仓库的 ' + data.helper.stored + ' 个搬进来', function () { app.send('collect', {}) }))
    if (!items.length) put(list, app.el('div', 'fm-note', popup === 'seeds' ? '还没有种子。' : '还没有收成。'))
    items.forEach(function (item, i) {
      if (popup === 'seeds') return put(list, seedSlot(app, item))
      if (popup === 'fert') return put(list, chip(app, { 'data-farm-fert': item.key, 'aria-pressed': String(hand.kind === 'fert' && hand.key === item.key) }, 'fert-' + (i + 1), '🧪', item.label + '\n× ' + item.count + '\n多长 ' + item.hours + ' 小时', function () {
        if (item.count < 1) return goShop(app)
        hand = { kind: 'fert', key: item.key }; popup = null; say(app, '点正在长的地施' + item.label)
      }))
      var open = openCrop === item.key
      put(list, chip(app, { 'data-farm-crop': item.key, 'aria-expanded': String(open), 'aria-label': item.label + ' ' + item.count + ' 个' }, 'produce-' + item.key, item.emoji, item.label + ' ×' + item.count, function () { openCrop = open ? null : item.key; app.rerender() }))
      if (!open) return
      var sell = put(list, app.el('div', 'fm-sellbar'))
      put(sell, app.el('span', 'fm-note', item.label + ' · 一个卖 ' + item.sell))
      put(sell, button(app, 'dp-mini', { 'data-farm-sell': item.key }, '卖一个', function () { app.send('sell', { item: item.key }) }))
      if (item.count > 1) put(sell, button(app, 'dp-mini', { 'data-farm-sell-all': item.key }, '全卖 ' + data.currency.emoji + ' ' + item.count * item.sell, function () { openCrop = null; app.send('sell', { item: item.key, count: item.count }) }))
      if (item.food) put(sell, button(app, 'dp-mini dp-mini-plain', { 'data-farm-store': item.key }, '放进背包 · ' + item.foodLabel, function () { app.send('store', { item: item.key }) }))
    })
    put(box, list)
  }
  // ---- 小农场（面板） ----
  /** 主按钮只操作一块；照料先拿工具，批量动作只能明确点击一键工具。 */
  function mainAction(data, look) {
    var one = function (list, label, op, fx, rest) { return { label: label, sub: list.length > 1 ? '还有 ' + (list.length - 1) + ' 块' + rest : '', op: op, payload: { plot: list[0] }, plot: list[0], fx: fx } }
    if (look.ripe.length) return one(look.ripe, '收菜', 'harvest', '✨', '熟了')
    if (look.pests.length) {
      var index = look.pests[0], kind = pestsOf(data.plots[index])[0]
      return { label: '照料', op: 'care', plot: index, hand: { kind: 'care', key: kind }, hint: '点这块地' + { dry: '浇水', weed: '除草', bug: '杀虫' }[kind] }
    }
    if (look.withered.length) return one(look.withered, '铲枯苗', 'clear', '🪏', '枯了')
    var stubble = look.empty.find(function (index) { return data.plots[index].stubble })
    if (stubble >= 0) return { label: '铲杂草', op: 'clear', payload: { plot: stubble }, plot: stubble, fx: '🪏' }
    if (look.empty.length) {
      var seed = seedInHand(data)
      if (!seed) return { label: '去买种子', shop: true }
      return { label: '种' + seed.label, op: 'plant', payload: { plot: look.empty[0], item: seed.key }, plot: look.empty[0], fx: '🌱' }
    }
    return { label: '都在长', sub: look.soonest < Infinity ? '最快 ' + shortTime(look.soonest) : '', idle: true }
  }
  function sceneArt(app, size) { // 场景图只挑 manifest 里登记过的图（旧图 bg-big / bg-small 没登记，请求它必 404）；退路是同晴雨的白天图，一张都没有就不铺底图。
    var date = new Date(app.data.now), hour = date.getHours(), sky = app.data.weather === 'rain' ? 'rain' : 'sunny'
    var phase = hour < 5 || hour >= 19 ? 'night' : hour < 8 ? 'dawn' : hour < 17 ? 'day' : 'dusk'
    var names = ['bg-' + size + '-' + phase + '-' + sky, 'bg-' + size + '-day-' + sky]
    return typeof app.hasAsset !== 'function' ? names[0] : names.find(function (name) { return app.hasAsset(name + '.webp') }) || ''
  }
  function renderSmall(app, data) {
    var root = app.el('div', 'fm')
    // 按宿主给的可用高度选紧凑布局，不能按会被自己内容撑缩的窗口高度反复切换。
    var panel = typeof app.content.closest === 'function' ? app.content.closest('.dp-card') : null
    if (panel && parseFloat(panel.style.maxHeight) < 450) root.setAttribute('data-farm-compact', 'true')
    var shown = Math.min(SMALL_PLOTS, data.total)
    var inner = put(root, app.el('div', 'fm-s-header'))
    put(inner, pigOf(app, 'fm-s-face'))
    stats(app, data, inner)
    put(inner, weatherButton(app, data, 'fm-s-weather'))
    if (typeof app.openBig === 'function') put(inner, bg(app, button(app, 'fm-s-big', { 'data-farm-big': 'open', 'aria-label': '打开大农场' }, '大农场', function () { app.openBig() }), 'shop-tab'))
    var scene = put(root, bg(app, app.el('div', 'fm-s-scene'), sceneArt(app, 'small')))
    var field = put(scene, app.el('div', 'fm-s-field'))
    var action = mainAction(data, survey(data, 0, shown))
    for (var index = 0; index < shown; index += 1) {
      var card = put(field, plotCard(app, data, index, 'small'))
      card.style.left = (index % 2 ? 51 : 0) + '%'
      if (action.plot === index) card.setAttribute('data-farm-next', 'true')
      card.style.top = Math.floor(index / 2) * 34 + '%'
    }
    put(scene, pigOf(app, 'fm-s-pig'))
    // 第 7 块以后的地（开了的）在小农场里看不见：用一行字报一下。
    if (data.unlocked > shown) {
      var rest = survey(data, shown, data.unlocked)
      var parts = [[rest.ripe, ' 块熟了'], [rest.pests, ' 块要照料'], [rest.withered, ' 块枯了'], [rest.empty, ' 块空着']].filter(function (p) { return p[0].length }).map(function (p) { return p[0].length + p[1] })
      put(root, bg(app, app.el('div', 'fm-s-note', '另外 ' + (data.unlocked - shown) + ' 块地：' + (parts.join('，') || '都在长')), 'ui-note'))
    }
    var plank = put(root, bg(app, app.el('div', 'fm-s-plank'), 'ui-small-plank'))
    var tools = put(plank, app.el('div', 'fm-s-tools'))
    careTools(app, data, shown, 0).forEach(function (node) { put(tools, node) })
    put(tools, toolSlot(app, { key: 'seedbag', art: 'tool-seedbag', label: '种子袋', run: function () { popup = popup === 'seeds' ? null : 'seeds'; app.rerender() } })).setAttribute('data-farm-panel', 'seeds')
    var row = put(plank, app.el('div', 'fm-s-acts'))
    put(row, stockSign(app, data))
    var main = put(row, bg(app, app.button('fm-main', { 'data-farm-main': action.op || (action.shop ? 'shop' : 'idle') }, function () {
      if (action.shop) return goShop(app)
      if (action.hand) { hand = action.hand; return say(app, action.hint, action.plot) }
      if (!action.idle) act(app, action.plot, action.fx, action.op, action.payload)
    }), 'ui-main'))
    put(main, app.el('span', null, action.label))
    if (action.sub) put(main, app.el('small', null, action.sub))
    main.disabled = action.idle === true
    put(row, shopSign(app))
    renderLayers(app, data, root)
    if (tip && tipPlot == null && Date.now() - tipAt < 2400) renderTip(app, root)
    setCursor(app, root)
    app.content.appendChild(root)
    if (panel && typeof panel.getBoundingClientRect === 'function' && typeof root.getBoundingClientRect === 'function') { var box = app.content.getBoundingClientRect(), top = Math.max(root.getBoundingClientRect().top, box.top); root.style.setProperty('--fm-panel-avail', Math.max(0, Math.min(panel.getBoundingClientRect().bottom, box.bottom) - top) + 'px'); var pop = root.querySelector('.fm-s-pop:not(.fm-shop)'); if (pop && pop.scrollHeight > pop.clientHeight + 1) root.setAttribute('data-farm-tight', '') } // 弹层不许高过面板可视底边（120px 高的面板里商店页签会点不到）；弹层装不下内容时（data-farm-tight）连列表一起改由弹层滚动，不再套第二层滚动条
  }
  // ---- 大农场（单独窗口） ----
  /** 18 块等距菱形地：3 列 × 6 行；尺寸和半格步长一起算，不能放大贴图却保留旧行距。 */
  function bigSpot(index) {
    var row = Math.floor(index / 3)
    var width = 13.6, height = width * 0.6 * 1.5
    return { left: 34, top: 25, width: width, height: height, translate: (row - index % 3) * 50 + '% ' + (row + index % 3) * 50 + '%' }
  }
  function renderBig(app, data) {
    var root = bg(app, app.el('div', 'fm fm-big'), sceneArt(app, 'big'))
    var scene = put(root, bg(app, app.el('div', 'fm-b-scene'), sceneArt(app, 'big')))
    var top = put(scene, bg(app, app.el('div', 'fm-b-top'), 'ui-big-topbar'))
    put(top, pigOf(app, 'fm-b-face'))
    stats(app, data, top)
    put(scene, weatherButton(app, data, 'fm-b-weather'))
    var field = put(scene, app.el('div', 'fm-b-field'))
    for (var index = 0; index < data.total; index += 1) {
      var card = put(field, plotCard(app, data, index, 'big'))
      var spot = bigSpot(index)
      card.style.width = spot.width + '%'; card.style.height = spot.height + '%'
      card.style.left = spot.left + '%'
      card.style.top = spot.top + '%'
      card.style.translate = spot.translate
    }
    put(scene, pigOf(app, 'fm-b-pig'))
    // 帮工猪住在右上角的猪窝（替原版的狗窝）
    var helper = data.helper
    if (helper) {
      var label = !helper.hired ? '雇帮工猪' : helper.full ? '帮工仓库满了' : helper.stored > 0 ? '帮工收了 ' + helper.stored + ' 个' : helper.missing.length ? '缺' + helper.missing.join('、') + '种子' : helper.seedless ? '帮工没种子' : '帮工 · ' + helper.plots + ' 块地'
      var badge = put(scene, app.button('fm-b-helper', { 'data-farm-helper': helper.hired ? 'collect' : 'hire', 'aria-label': label }, function () {
        if (!helper.hired) app.send('hire', {})
        else if (helper.stored > 0 || helper.full) app.send('collect', {})
        else if (helper.missing.length || helper.seedless) goShop(app)
        else say(app, '帮工正在照顾 ' + helper.plots + ' 块地')
      }))
      put(badge, pigOf(app, null))
      put(badge, app.el('span', null, label))
    }
    // 底部工具栏：拿在手里的工具 | 一键工具 | 商店、仓库、小农场
    var bar = put(scene, bg(app, app.el('div', 'fm-b-bar'), 'ui-big-toolbar'))
    var all = survey(data, 0, data.unlocked)
    var toggle = function (name) { return function () { popup = popup === name ? null : name; app.rerender() } }
    put(bar, toolSlot(app, CARE_TOOLS[3]))
    put(bar, toolSlot(app, { key: 'seedbag', art: 'tool-seedbag', emoji: '🌰', label: '种子袋', run: toggle('seeds'), count: hand.kind === 'seed' ? (seedOf(data, hand.key) || { count: 0 }).count : 0 }))
    put(bar, toolSlot(app, { key: 'shovel', art: 'tool-shovel', emoji: '🪏', label: '铁锹：铲地', hand: { kind: 'shovel', key: null }, hint: '点地铲掉，正在长的作物要确认', count: all.withered.length }))
    careTools(app, data, data.unlocked, all.ripe.length).slice(0, 3).forEach(function (node) { put(bar, node) })
    put(bar, toolSlot(app, { key: 'fert', art: 'fert-1', emoji: '🧪', label: '肥料', run: toggle('fert'), count: data.fert.reduce(function (s, f) { return s + f.count }, 0) }))
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
    put(bar, shopSign(app))
    put(bar, stockSign(app, data))
    if (typeof app.closeBig === 'function') put(bar, sign(app, { 'data-farm-big': 'close', 'aria-label': '回小农场' }, 'ui-small-farm', '', '小农场', 0, function () { app.closeBig() }))
    renderLayers(app, data, scene)
    if (tip && tipPlot == null && Date.now() - tipAt < 2400) renderTip(app, scene)
    setCursor(app, root)
    app.content.appendChild(root)
  }
  /** 用户选定纸面外壳：几何交给 CSS，不再叠旧木框图片。 */
  function frame(app, node, name) {
    node.className += ' fm-paper'; node.setAttribute('data-farm-frame', 'css-paper')
    return node
  }
  function closeButton(app, box, run) { put(box, bg(app, button(app, 'fm-close', { 'aria-label': '关闭', 'data-farm-close': 'true' }, '', run), 'btn-close')) }
  function seedSlot(app, seed) {
    var selected = hand.kind === 'seed' && hand.key === seed.key
    var slot = chip(app, { 'data-farm-seed': seed.key, 'aria-pressed': String(selected), 'aria-label': seed.label + '种子 ×' + seed.count }, 'seed:' + seed.key, seed.emoji, seed.label, function () { hand = { kind: 'seed', key: seed.key }; app.rerender() })
    put(slot, app.el('span', 'fm-count', '×' + seed.count))
    return slot
  }
  function renderTip(app, box) {
    var node = put(box, frame(app, app.el('div', 'fm-toast', tip), 'shop-frame'))
    node.setAttribute('role', 'status'); node.style.animationDelay = '-' + Math.max(0, Date.now() - tipAt) + 'ms'
  }
  /** 只在新快照证实动作成功后提示，不把发送请求当成功。 */
  function finishAction(app, data) {
    if (!pendingAction || pendingAction.before === data) return
    var action = pendingAction, old = action.before, plot = action.plot, text = null
    pendingAction = null
    if (action.op === 'plant' && old.plots[plot].empty && !data.plots[plot].empty) text = '播种成功'
    if (action.op === 'harvest' && old.plots[plot].ripe && !data.plots[plot].ripe) text = '收获 ' + old.plots[plot].yield + ' 个'
    if (action.op === 'care' && pestsOf(data.plots[plot]).length < pestsOf(old.plots[plot]).length) text = '照料成功'
    if (action.op === 'clear' && (data.plots[plot].empty || !data.plots[plot].stubble)) text = '铲除成功'
    if (/All$/.test(action.op) && JSON.stringify(old.plots) !== JSON.stringify(data.plots)) text = '操作成功'
    if (action.item && old.balance - data.balance === action.item.price * action.count) text = '购买成功！' + action.item.label + ' ×' + action.count + '，花费 ' + action.item.price * action.count + ' 菜币'
    if (text) { tip = text; tipAt = Date.now(); tipPlot = plot }
  }
  function setCursor(app, root) {
    var name = hand.kind === 'seed' ? 'seed' : hand.kind === 'shovel' ? 'shovel' : hand.kind === 'fert' ? 'fert' : hand.kind === 'care' ? { dry: 'can', weed: 'spray', bug: 'pesticide' }[hand.key] : 'glove'
    var hotspots = { seed: [11, 3], shovel: [4, 2], fert: [6, 2], can: [5, 4], spray: [4, 2], pesticide: [4, 2], glove: [5, 2] }
    var url = art(app, 'cursor-' + name)
    if (url) root.style.setProperty('--fm-cursor', 'url("' + url + '") ' + hotspots[name].join(' ') + ', pointer')
    root.addEventListener('click', function (event) { if (popup && !purchase && !event.target.closest('.fm-pop,button,input')) { popup = null; app.rerender() } })
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
      if (currentApp && event.key === 'Escape') { if (cancelLayer) cancelLayer(); else { popup = null; currentApp.rerender() } return }
      if (!currentApp || currentApp.mode !== 'big' || !currentApp.content.querySelector('.fm-big') || event.ctrlKey || event.altKey || event.metaKey || event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(event.target.tagName)) return
      var tools = { q: { kind: 'care', key: 'dry' }, w: { kind: 'care', key: 'weed' }, e: { kind: 'care', key: 'bug' }, r: AUTO }
      var chosen = tools[String(event.key).toLowerCase()]
      if (chosen) { event.preventDefault(); hand = chosen; currentApp.rerender() }
    })
  }
  /** 悬停卡留在场景层，避免被后排地块遮住；离开即移除。 */
  function attachHover(app, card, plot) {
    if (plot.empty || plot.wild) return
    var hover = null
    card.addEventListener('mousemove', function (event) {
      if (hover || popup || purchase || confirmClear !== null || event.movementX === 0 && event.movementY === 0) return
      if (tip && tipPlot === plot.index && Date.now() - tipAt < 2400) return
      var scene = card.parentNode.parentNode
      hover = put(scene, frame(app, app.el('div', 'fm-hover-card'), 'card-frame'))
      hover.setAttribute('data-farm-card', String(plot.index))
      put(hover, img(app, 'fm-card-crop', 'produce-' + plot.crop, plot.emoji))
      put(hover, app.el('b', null, plot.label))
      put(hover, app.el('div', null, '阶段：' + ({ seed: '种子', sprout: '发芽', seedling: '小苗', growing: '长大', flowering: '开花', ripe: '熟了', withered: '枯了' }[plot.stage] || plot.stage)))
      put(hover, app.el('div', null, plot.ripe ? '收 ' + plot.yield + ' 个' : plot.withered ? '枯了' : '剩余 ' + shortTime(plot.remainingMs)))
      var progress = put(hover, bg(app, app.el('div', 'fm-card-progress'), 'progress-track'))
      put(progress, app.el('i')).style.width = Math.round(plot.progress * 100) + '%'
      var statuses = put(hover, app.el('div', 'fm-card-status'))
      ;['dry', 'weed', 'bug'].forEach(function (kind) {
        var active = pestsOf(plot).indexOf(kind) >= 0
        var chip = put(statuses, bg(app, app.el('span', 'fm-status', PEST_LABEL[kind]), active ? 'status-chip-active' : 'status-chip'))
        put(chip, img(app, null, 'status-icon-' + (kind === 'dry' ? 'water' : kind)))
        chip.setAttribute('data-active', String(active))
      })
      var target = card.getBoundingClientRect(), canvas = scene.getBoundingClientRect(), bounds = hover.getBoundingClientRect()
      hover.style.left = Math.max(8, Math.min(canvas.width - bounds.width - 8, target.left - canvas.left)) + 'px'
      hover.setAttribute('data-farm-below', String(target.top - canvas.top < bounds.height + 8))
      hover.style.top = (hover.getAttribute('data-farm-below') === 'true' ? Math.min(canvas.height - bounds.height - 8, target.bottom - canvas.top + 8) : Math.max(8, target.top - canvas.top - bounds.height - 8)) + 'px'
      hover.style.setProperty('--fm-tail-x', Math.max(24, Math.min(bounds.width - (hover.clientLeft || 0) * 2 - 24, target.left - canvas.left + target.width / 2 - parseFloat(hover.style.left) - (hover.clientLeft || 0))) + 'px')
    })
    var clearHover = function () { if (hover) hover.remove(); hover = null }
    card.addEventListener('mouseleave', clearHover)
    card.addEventListener('click', clearHover)
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
  function renderShop(app, data, box) {
    var head = put(box, app.el('div', 'fm-shop-head'))
    put(head, bg(app, app.el('b', 'fm-title', '农场商店'), 'shop-title'))
    var wallet = put(head, app.el('div', 'fm-shop-wallet'))
    put(wallet, img(app, 'fm-shop-coin', 'coin-veg')); put(wallet, app.el('span', null, '菜币 ' + data.balance + ' · 等级 ' + data.level))
    var tabs = put(box, app.el('div', 'fm-tabs')); tabs.setAttribute('role', 'tablist')
    ;[['seed', '种子'], ['tool', '工具'], ['fert', '肥料'], ['helper', '帮工']].forEach(function (tab) {
      var node = put(tabs, bg(app, app.button('fm-tab', { role: 'tab', 'data-farm-tab': tab[0], 'aria-selected': String(shopTab === tab[0]) }, function () { shopTab = tab[0]; app.rerender() }), shopTab === tab[0] ? 'shop-tab-active' : 'shop-tab'))
      put(node, img(app, null, 'tab-icon-' + tab[0])); put(node, app.el('span', null, tab[1]))
    })
    var grid = put(box, app.el('div', 'fm-shop-grid')); grid.setAttribute('role', 'tabpanel')
    grid.setAttribute('data-scroll-key', 'farm-shop:' + shopTab)
    shopItems(data).filter(function (item) { return item.category === shopTab }).sort(function (a, b) { return Number(a.disabled) - Number(b.disabled) }).forEach(function (item) {
      var node = put(grid, bg(app, app.button('fm-shop-item', { 'data-farm-item': item.key, 'aria-disabled': String(!!item.disabled) }, function () { purchase = item; quantity = 1; modalReturn = { attr: 'data-farm-item', value: item.key }; app.rerender() }), item.disabled ? 'shop-item-locked' : 'shop-item'))
      put(node, product(app, item, 'fm-product')); put(node, app.el('b', null, item.label))
      put(node, app.el('span', 'fm-price', item.price + ' 菜币'))
      if (item.disabled) put(node, app.el('small', 'fm-unavailable', item.locked ? '需要 ' + item.level + ' 级' : item.owned ? '已拥有' : '菜币不足'))
    })
  }
  function modal(app, root, className, cancel) {
    cancelLayer = cancel
    var mask = put(root, app.el('div', 'fm-mask')); mask.addEventListener('click', function (event) { if (event.target === mask) { event.stopPropagation(); cancel() } })
    var box = put(mask, frame(app, app.el('div', className), 'shop-frame'))
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); closeButton(app, box, cancel)
    box.setAttribute('data-scroll-key', 'farm-dialog:' + (purchase ? purchase.key : 'clear'))
    return box
  }
  function modalButtons(app, box, run, cancel, disabled) {
    var row = put(box, app.el('div', 'fm-modal-buttons'))
    put(row, bg(app, button(app, 'fm-confirm', { 'data-farm-confirm': 'true' }, '确定', run), 'btn-confirm')).disabled = !!disabled
    put(row, bg(app, button(app, 'fm-cancel', { 'data-farm-cancel': 'true' }, '取消', cancel), 'btn-cancel'))
  }
  function renderPurchase(app, data, root) {
    var item = purchase, cancel = function () { purchase = null; app.rerender() }
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
    put(stepper, bg(app, button(app, 'fm-step', { 'data-farm-quantity': 'minus', 'aria-label': '减少数量' }, '', function () { quantity = Math.max(1, quantity - 1); app.rerender() }), 'stepper-minus')).disabled = !many || quantity === 1
    var field = put(stepper, bg(app, app.el('input', 'fm-quantity'), 'stepper-field')); field.type = 'number'; field.min = '1'; field.max = many ? '99' : '1'; field.value = String(quantity); field.disabled = !many; field.setAttribute('aria-label', '数量'); field.setAttribute('data-farm-quantity-field', 'true')
    ;['input', 'change'].forEach(function (type) { field.addEventListener(type, function () {
      quantity = Math.max(1, Math.min(many ? 99 : 1, Math.floor(Number(field.value) || 1)))
      total.textContent = '总价 ' + quantity * item.price + ' 菜币'; total.setAttribute('data-farm-total', String(quantity * item.price))
      box.querySelector('[data-farm-confirm]').disabled = item.disabled || quantity * item.price > data.balance
      ;['minus', 'plus'].forEach(function (key) { box.querySelector('[data-farm-quantity="' + key + '"]').disabled = !many || quantity === (key === 'minus' ? 1 : 99) })
      if (type === 'change') field.value = String(quantity)
    }) })
    put(stepper, bg(app, button(app, 'fm-step', { 'data-farm-quantity': 'plus', 'aria-label': '增加数量' }, '', function () { quantity = Math.min(99, quantity + 1); app.rerender() }), 'stepper-plus')).disabled = !many || quantity === 99
    var total = put(box, app.el('div', 'fm-total', '总价 ' + quantity * item.price + ' 菜币')); total.setAttribute('data-farm-total', String(quantity * item.price))
    modalButtons(app, box, function () { pendingAction = { op: 'buy', item: item, count: quantity, before: data }; app.send('buy', { item: item.key, count: quantity }); purchase = null; app.rerender() }, cancel, item.disabled || quantity * item.price > data.balance)
  }
  function renderLayers(app, data, root) {
    cancelLayer = null
    if (popup) {
      var box = put(root, app.el('div', 'fm-pop' + (app.mode === 'big' ? ' fm-b-pop' : ' fm-s-pop') + (popup === 'shop' ? ' fm-shop' : '')))
      if (paintedPopup !== popup) box.className += ' fm-enter'
      box.setAttribute('data-farm-overlay', popup)
      frame(app, box, 'shop-frame'); closeButton(app, box, function () { popup = null; app.rerender() })
      if (popup === 'shop' || popup === 'wallet') {
        if (popup === 'shop') renderShop(app, data, box)
        else if (app.walletContent) put(box, app.walletContent())
      } else renderPopup(app, data, box)
      if (popup === 'seeds') box.addEventListener('mouseleave', function () { popup = null; app.rerender() })
    }
    paintedPopup = popup
    if (purchase) renderPurchase(app, data, root)
    if (confirmClear !== null) {
      var index = confirmClear, cancel = function () { confirmClear = null; app.rerender() }
      var box = modal(app, root, 'fm-clear-confirm', cancel); box.setAttribute('aria-label', '铲除确认')
      put(box, bg(app, app.el('b', 'fm-title', '铲掉正在长的' + data.plots[index].label + '？'), 'shop-title'))
      put(box, img(app, 'fm-clear-art', 'produce-' + data.plots[index].crop))
      modalButtons(app, box, function () { confirmClear = null; act(app, index, '🪏', 'clear', { plot: index, force: true }) }, cancel)
    }
  }
  function focusDescriptor(node) {
    if (!node) return null
    var attrs = ['data-farm-quantity-field', 'data-farm-quantity', 'data-farm-close', 'data-farm-confirm', 'data-farm-cancel']
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
        var field = dialog.querySelector('[data-farm-quantity-field="true"]')
        target = field && !field.disabled ? field : dialog.querySelector('[data-farm-close="true"]')
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
    if (app.mode === 'big') renderBig(app, data)
    else renderSmall(app, data)
    var root = app.content.querySelector('.fm')
    if (root) syncModalFocus(app, root)
  }
  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('farm', { render: render })
})()
