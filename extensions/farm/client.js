// GENERATED FILE. Edit src/extensions/farm/client/ and run `npm run build`; do not edit by hand.
(() => {
  // src/extensions/farm/client/state.js
  function createFarmState() {
    const AUTO = { kind: "auto", key: null };
    const CARE_TOOLS = [
      { key: "can", art: "tool-can", emoji: "\u{1F4A7}", label: "\u6D47\u6C34\uFF1A\u70B9\u5E72\u4E86\u7684\u5730", hand: { kind: "care", key: "dry" }, hint: "\u70B9\u5E72\u4E86\u7684\u5730\u6D47\u6C34" },
      { key: "weedkiller", art: "tool-weedkiller", emoji: "\u{1F33F}", label: "\u9664\u8349\uFF1A\u70B9\u957F\u8349\u7684\u5730", hand: { kind: "care", key: "weed" }, hint: "\u70B9\u957F\u8349\u7684\u5730\u9664\u8349" },
      { key: "pesticide", art: "tool-pesticide", emoji: "\u{1F41B}", label: "\u6740\u866B\uFF1A\u70B9\u751F\u866B\u7684\u5730", hand: { kind: "care", key: "bug" }, hint: "\u70B9\u751F\u866B\u7684\u5730\u6740\u866B" },
      { key: "gloves", art: "tool-gloves", emoji: "\u{1F9E4}", label: "\u624B\u5957\uFF1A\u53EA\u6536\u6210\u719F\u4F5C\u7269", hand: AUTO }
    ];
    const ONE_CLICK = [
      { key: "sickle", op: "harvestAll", label: "\u4E00\u952E\u6536\u83B7", tool: "\u6536\u5272\u9570" },
      { key: "sprayer", op: "careAll", label: "\u4E00\u952E\u7167\u6599", tool: "\u55B7\u96FE\u6876" },
      { key: "rake", op: "clearAll", label: "\u4E00\u952E\u94F2\u9664", tool: "\u5E73\u5730\u8019" },
      { key: "planter", op: "plantAll", label: "\u4E00\u952E\u64AD\u79CD", tool: "\u64AD\u79CD\u5668" }
    ];
    return {
      hand: { kind: "auto", key: null },
      popup: null,
      revealTools: false,
      drawerOpen: false,
      openCrop: null,
      selectedPlot: null,
      confirmClear: null,
      tip: null,
      tipAt: 0,
      tipPlot: null,
      shopTab: "seed",
      bagTab: "seed",
      purchase: null,
      quantity: 1,
      currentApp: null,
      keyboardBound: false,
      pendingAction: null,
      cancelLayer: null,
      inflight: null,
      lessonRewardAt: 0,
      fx: null,
      modalOpen: false,
      modalFocus: null,
      modalReturn: null,
      SMALL_PLOTS: 6,
      scrollMemory: {},
      currentKey: "",
      watchingContent: false,
      lastRoot: null,
      PEST_LABEL: { dry: "\u5E72\u4E86", weed: "\u957F\u8349", bug: "\u751F\u866B" },
      ONE_CLICK,
      AUTO,
      CARE_TOOLS
    };
  }

  // src/extensions/farm/client/host.js
  function createFarmHostTools() {
    const styleId = "dsh-piggy-farm-style-5";
    const css = [
      ".fm{--animal-primary:var(--ac-primary,#19c8b9);--animal-text:var(--ac-text,#794f27);--animal-text-body:var(--ac-text-body,#725d42);--animal-bg:var(--ac-bg,#f8f8f0);--animal-bg-content:var(--ac-bg-content,#fff8e3);--animal-border:var(--ac-border,#c4b89e);--animal-ease:var(--ac-ease,cubic-bezier(.4,0,.2,1));display:flex;flex-direction:column;gap:6px;position:relative;min-width:0;font:500 12px/1.35 var(--ac-font,sans-serif);color:var(--animal-text-body);background:var(--animal-bg);font-variant-numeric:tabular-nums}.fm *{box-sizing:border-box}.fm img{object-fit:contain;pointer-events:none}.fm button:not(.dp-drill-back),.fm input{font:inherit;font-weight:700;cursor:pointer;min-width:32px;min-height:32px}.fm button:disabled{cursor:default}.fm button:not(.dp-drill-back):focus-visible,.fm input:focus-visible{outline:2px solid var(--animal-primary);outline-offset:2px}.fm .dp-btn{padding:6px 12px}.fm .dp-mini{padding:8px 14px}.fm .fm-main,.fm .fm-confirm{color:var(--ac-bg-content,#fff8e3)}.fm .fm-main:disabled,.fm .fm-confirm:disabled{color:var(--ac-text-disabled,#a99d86)}",
      ".fm-s-header{display:flex;align-items:center;gap:8px;min-height:32px}.fm[data-farm-integrated]>.fm-s-header{display:none}.fm-garden-title{font-size:20px;color:var(--animal-text);margin-right:auto}.fm-stat{display:flex;align-items:center;gap:4px;white-space:nowrap;font-size:12px}.fm-stat>img{width:20px;height:20px}.fm-exp{display:block;width:32px;height:8px;border-radius:var(--ac-pill,50px);background:var(--ac-border-light,#e5dcc6);overflow:hidden}.fm-exp>i{display:block;height:100%;background:var(--ac-success,#87c96d)}.fm-s-header .fm-coin{margin-left:auto}.fm-big-open{font-size:11px;padding:5px 10px}.dp-content:has(>.fm[data-farm-integrated])>.dp-drill{gap:6px;padding:8px 0 4px;margin-bottom:4px;align-items:center}.dp-content:has(>.fm[data-farm-integrated])>.dp-drill .dp-drill-title{margin-right:auto;flex:none}.dp-content:has(>.fm[data-farm-integrated] [data-farm-overlay])>.dp-drill .dp-drill-back,.dp-content:has(>.fm[data-farm-integrated] .fm-mask)>.dp-drill .dp-drill-back{display:none}.dp-content:has(>.fm[data-farm-integrated])>.dp-drill .fm-big-open{flex:none;padding:4px 6px}.dp-drill .fm-coin{margin-left:0;font-size:12px;padding:4px 6px;min-width:0;flex-shrink:1}.dp-drill .fm-coin>span{min-width:0;overflow:hidden;text-overflow:ellipsis}.dp-content:has(>.fm[data-farm-integrated])>.dp-drill .fm-coin>img{width:18px;height:18px}",
      '.fm-s-goal{min-height:20px;font-size:13px;font-weight:800;color:var(--animal-text);padding:0 2px}.fm-s-scene{position:relative;aspect-ratio:1.45;flex:none;min-height:0;border-radius:var(--ac-radius-card,20px);background:var(--ac-success-bg,#e4eed2);isolation:isolate;overflow:hidden}.fm-s-field{position:absolute;inset:23% 5% 7%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:minmax(0,1fr);gap:8px}.fm-plot{position:relative;min-width:0;min-height:0!important;padding:0;border:0;background:none;box-shadow:none;border-radius:var(--ac-radius-sm,12px);cursor:pointer;color:var(--animal-text)}.fm-plot[data-farm-target="true"]{outline:2px solid var(--animal-primary);outline-offset:2px;z-index:2}.fm-plot[data-farm-valid="true"]{box-shadow:0 0 0 2px var(--ac-primary-bg,#d7f5ef)}.fm-soil{position:absolute;inset:0;width:100%;height:100%}.fm-crop,.fm-pest{position:absolute;left:50%;bottom:6%;transform:translateX(-50%);width:58%;height:86%}.fm-pest{width:30%;height:45%;left:70%}.fm-bubble{position:absolute;top:-6px;right:0;width:22px;height:22px}.fm-ghost{position:absolute;inset:20%;opacity:.4;pointer-events:none}.fm-ghost>img{width:100%;height:100%}.fm-chip{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);background:var(--animal-bg-content);padding:2px 6px;border-radius:var(--ac-pill,50px);font-size:10px;white-space:nowrap}.fm .fm-expand{top:50%;bottom:auto;transform:translate(-50%,-50%);font-size:11px;padding:4px 8px;white-space:normal;max-width:100%;height:auto}.fm-crop[src*=paper-stubble]{height:202.3%;width:auto;max-width:none;bottom:-64.8%}.fm-pest[src*=paper-weed]{height:97.4%;width:auto;max-width:none;bottom:-26.1%}.fm-s-field img.fm-soil{inset:auto;left:50%;bottom:-26.60%;width:auto;height:149.09%;max-width:none;border-radius:0;object-fit:contain;transform:translateX(-50.44%)}.fm-s-scene[data-paper="true"] .fm-s-field .fm-plot:not([data-farm-soil="wild"]){background:none;box-shadow:none}.fm-s-lesson .fm-crop[data-paper-stage="seed"]{height:205.78%;width:auto;max-width:none;bottom:-34.86%;transform:translateX(-50.52%)}.fm-s-lesson .fm-crop[data-paper-stage="seedling"]{height:83.41%;width:auto;max-width:none;bottom:-2.92%;transform:translateX(-51.31%)}.fm-s-lesson .fm-crop[data-paper-stage="ripe"]{height:93.81%;width:auto;max-width:none;bottom:0.06%;transform:translateX(-51.09%)}.fm-plot[data-farm-soil="wild"]{background:none}.fm-plot[data-farm-soil="wild"] .fm-soil{filter:grayscale(1) brightness(.52) saturate(.35);opacity:.95}.fm-plot[data-farm-soil="wild"] .fm-lock{right:6px;top:6px;background-size:14px;opacity:.9}.fm-plot[data-farm-soil="wild"] .fm-chip{background:var(--animal-bg-content)}',
      '.fm-s-detail{display:grid;grid-template-rows:24px 18px minmax(30px,auto);gap:4px;padding:2px 4px;min-height:80px;align-content:start}.fm-s-detail-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-height:24px;color:var(--animal-text)}.fm-s-detail-head>b{font-size:16px}.fm-s-phase{color:var(--animal-primary);font-weight:800}.fm-s-progress{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;min-height:18px;font-size:12px}.fm-s-track{display:block;height:10px;border-radius:var(--ac-pill,50px);background:var(--ac-border-light,#e5dcc6);overflow:hidden}.fm-s-track>i{display:block;height:100%;border-radius:inherit;background:var(--ac-success,#87c96d)}.fm-s-detail>small{display:block;font-size:11px;line-height:1.45;min-height:30px}.fm-s-note{font-size:11px;padding:2px 4px;min-height:18px}.fm-s-plank{display:grid;gap:6px;border-top:2px solid var(--ac-border-light,#e5dcc6);padding-top:6px}.fm-s-acts{display:grid;grid-template-columns:minmax(0,1fr);align-items:stretch;gap:6px;padding-bottom:2px}.fm .fm-main{display:grid;place-content:center;gap:2px;min-height:54px;font-size:16px;line-height:1.25;white-space:normal}.fm-main>small{font-size:11px;min-height:14px}.fm .fm-slot{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:auto;height:72px;min-width:0;padding:5px 2px;border-radius:var(--ac-radius-sm,12px);box-shadow:none}.fm .fm-slot>img{width:40px;height:40px;flex:none}.fm .fm-slot[aria-pressed="true"]{border-color:var(--animal-primary);background:var(--ac-primary-bg,#d7f5ef)}.fm-tool-label{position:static;font-size:12px;line-height:1.2;white-space:nowrap}.fm-n,.fm-lock{position:absolute;right:2px;top:2px;font-size:10px;font-style:normal;line-height:16px;min-width:16px;height:16px;border-radius:var(--ac-pill,50px);background:var(--ac-warning-bg,#fff2c9);color:var(--animal-text);text-align:center;pointer-events:none}.fm-lock{background-size:12px;background-repeat:no-repeat;background-position:center}.fm-slot[data-locked="true"]>img{opacity:.55}.fm-dock{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;scroll-margin-top:46px}.fm .fm-dock-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:68px;font-size:12px;padding:6px 4px;white-space:nowrap}.fm-dock-btn>img{width:40px;height:40px}.fm-dock-btn[aria-expanded="true"]{border-color:var(--animal-primary);background:var(--ac-primary-bg,#d7f5ef)}.fm-drawer{display:grid;gap:8px;border-top:2px solid var(--ac-border-light,#e5dcc6);padding-top:8px}.fm-advanced-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;overflow:visible;max-height:none}.fm .fm-advanced-grid>.fm-slot{height:72px;gap:4px}.fm-advanced-grid .fm-slot>img{width:40px;height:40px}.fm-advanced-actions{display:grid;gap:8px}.fm .fm-nav-action{width:100%;min-height:36px;font-size:12px}.fm-advanced-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.fm-meta{font-size:11px;color:var(--ac-text-2,#968468)}.fm .fm-weather{justify-self:start;padding:2px 8px;min-height:28px;font-size:11px}',
      '.fm-pop{position:relative;display:grid;align-content:start;gap:8px;width:100%;max-width:760px;margin:0 auto;padding:2px 0 0;min-height:0}.fm.fm-big>.fm-pop{flex:1}.fm:has(>.fm-pop)>:not(.fm-pop):not(.fm-mask):not(.fm-s-header),.fm:has(>.fm-mask)>:not(.fm-mask):not(.fm-s-header){display:none}.fm-paper{background:var(--animal-bg)}.fm-page-head{display:flex;align-items:center;gap:8px;min-height:34px}.fm-title{font-size:16px;line-height:1.4;color:var(--animal-text);font-weight:800;background:none;border:0}.fm-page-head>.fm-title{margin-right:auto}.fm-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.fm-tabs-3{grid-template-columns:repeat(3,minmax(0,1fr))}.fm .fm-tab{padding:4px 2px;font-size:12px;min-width:0}.fm-tab>img{width:18px;height:18px;flex:none}.fm-tab[aria-selected="true"]{background:var(--ac-primary-bg,#d7f5ef);border-color:var(--animal-primary)}.fm-tiles{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:2px}.fm .fm-tile{padding:2px 0}.fm-tile .dp-tile-icon{width:44px;height:44px;border-radius:13px}.fm-tile .dp-tile-e{font-size:21px}.fm-tile .dp-tile-icon>img{width:32px;height:32px;flex:none}.fm-tile .fm-packet{width:34px;height:34px;justify-self:center}.fm-tile .fm-packet img{left:19%;top:26%;width:63%;height:58%}.fm-tile .dp-tile-n{white-space:normal;text-align:center;line-height:1.2;max-height:2.4em;overflow:hidden}.fm-tile .dp-tile-note{white-space:normal;text-align:center;line-height:1.2;margin-top:0}.fm-tile[aria-disabled="true"] .dp-tile-icon,.fm-tile[data-dim="true"] .dp-tile-icon{opacity:.55}.fm-tile[aria-pressed="true"] .dp-tile-icon{outline:3px solid var(--animal-primary);outline-offset:2px}.fm-shop-wallet{display:flex;align-items:center;gap:5px;font-size:12px}.fm-shop-coin{width:20px;height:20px}.fm-bag-tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.fm-bag-tools>.fm-note{flex:1;min-width:120px}.fm-note{font-size:11px;white-space:pre-line}.fm-sellbar{grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px;border-radius:var(--ac-radius-sm,12px);background:var(--animal-bg-content)}.fm-sellbar>.fm-note{width:100%}',
      '.fm-packet{display:block;position:relative;aspect-ratio:247/256;background:center/contain no-repeat}.fm-packet img{position:absolute;left:19%;top:30%;width:63%;height:55%;object-fit:contain}.fm-mask{position:relative;display:block;width:100%;max-width:760px;margin:0 auto;padding:0;background:none}.fm-buy,.fm-clear-confirm{position:relative;width:100%;max-height:none;padding:4px 0;overflow:visible;display:block}.fm-buy>.fm-title,.fm-clear-confirm>.fm-title{display:block;margin:0 0 12px}.fm-buy-columns{display:grid;grid-template-columns:64px minmax(0,1fr);gap:10px;margin:8px 0}.fm-buy-art{width:64px;height:80px;object-fit:contain}.fm-buy-info{display:grid;gap:4px;overflow:visible}.fm-info-row{font-size:11px;line-height:1.5}.fm-stepper{display:flex;align-items:center;justify-content:center;gap:8px;margin:12px 0}.fm .fm-step{width:32px;height:32px;padding:0;font-size:20px}.fm-quantity{width:52px;height:32px;text-align:center;border:2px solid var(--animal-border);border-radius:var(--ac-pill,50px);background:var(--animal-bg-content);color:var(--animal-text)}.fm-total{text-align:center;font-size:14px;font-weight:800;margin:8px 0}.fm-modal-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.fm .fm-confirm,.fm .fm-cancel{min-height:36px}.fm-clear-art{display:block;width:80px;height:80px;object-fit:contain;margin:12px auto}.fm-big .fm-buy-columns{grid-template-columns:120px minmax(0,1fr);gap:24px}.fm-big .fm-buy-art{width:120px;height:140px}.fm-big .fm-info-row{font-size:14px}.fm-toast{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);width:max-content;max-width:220px;pointer-events:none;padding:6px 10px;border:2px solid var(--animal-border);border-radius:var(--ac-radius-sm,12px);background:var(--animal-bg-content);font-size:12px;z-index:10;animation:fm-toast 2.4s var(--animal-ease) both}.fm>.fm-toast{bottom:40%}@keyframes fm-toast{0%,100%{opacity:0}10%,75%{opacity:1}}.fm-plot[data-farm-fx]::after{position:absolute;content:"";left:50%;bottom:38%;font-size:26px;line-height:1;opacity:0;pointer-events:none;z-index:8;animation:fm-act .62s var(--animal-ease) var(--fm-fx-delay,0ms) both}.fm-plot[data-farm-fx="sow"]::after{content:"\u{1F331}"}.fm-plot[data-farm-fx="water"]::after{content:"\u{1F4A7}"}.fm-plot[data-farm-fx="harvest"]::after{content:"\u2728"}.fm-s-scene[data-farm-fx]::after{content:"\u2728";position:absolute;left:50%;top:50%;font-size:28px;pointer-events:none;animation:fm-act .62s var(--animal-ease) var(--fm-fx-delay,0ms) both}.fm-plot[data-farm-fx="sow"]>.fm-crop{animation:fm-sprout .5s var(--animal-ease) var(--fm-fx-delay,0ms) both}@keyframes fm-sprout{0%{opacity:.2;translate:0 6px;scale:.8}100%{opacity:1;translate:0 0;scale:1}}@keyframes fm-act{0%{opacity:0;transform:translate(-50%,8px) scale(.7)}30%{opacity:1;transform:translate(-50%,-4px) scale(1.12)}100%{opacity:0;transform:translate(-50%,-20px) scale(.9)}}',
      ".fm-big{display:flex;flex-direction:column;width:100%;max-width:1180px;min-height:100%;height:100%;margin:0 auto;padding:16px;gap:10px;overflow:auto}.fm-big>*{flex-shrink:0}.fm-big .fm-s-header{min-height:40px}.fm-big .fm-exp{width:80px}.fm-b-body{display:flex;flex-direction:column;gap:10px;flex:1 0 auto;min-height:0}.fm-b-stage{display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0;flex:1 0 auto}.fm-big .fm-s-goal{font-size:16px;min-height:22px}.fm-big .fm-s-scene{flex:1 1 auto;min-height:340px;aspect-ratio:auto}.fm-big .fm-s-field{grid-template-columns:repeat(6,minmax(0,1fr));gap:14px 12px;height:70%;width:auto;aspect-ratio:2.9;max-width:90%;left:50%;right:auto;top:auto;bottom:7%;transform:translateX(-50%)}.fm-b-controls{display:flex;flex-direction:column;gap:8px;min-width:0;width:100%;max-width:760px;margin:0 auto;flex:none}.fm-b-controls .fm-s-detail,.fm-b-controls .fm-s-plank{width:100%}.fm-b-controls .fm-dock{width:100%;max-width:254px;align-self:center}.fm-b-controls .fm-advanced-grid{grid-template-columns:repeat(auto-fit,minmax(88px,1fr))}.fm-big .fm-s-detail{grid-template-rows:28px 20px minmax(34px,auto);min-height:94px}.fm-big .fm-s-detail-head>b{font-size:18px}.fm-big .fm-s-detail>small{font-size:12px}.fm-b-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.fm-big .fm-bubble{width:24px;height:24px}",
      "@media(max-width:820px){.fm-b-body{display:flex;flex-direction:column;flex:none;min-height:auto}.fm-b-stage,.fm-b-controls{flex:none;width:100%}.fm-big .fm-s-scene{min-height:640px;flex:none}.fm-big .fm-s-field{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;aspect-ratio:.725;max-width:100%;min-height:540px}.fm-big .fm-exp{width:32px}}@media(prefers-reduced-motion:reduce){.fm *{animation:none!important;transition:none!important}.fm-plot[data-farm-fx]::after{opacity:0!important}.fm-s-scene[data-farm-fx]::after{opacity:0!important}.fm-toast{opacity:1}}",
      ".dp-content:has(>.fm[data-farm-integrated]){scrollbar-gutter:stable}.fm-big{scrollbar-gutter:stable}.dp-content:has(>.fm[data-farm-integrated]>.fm-pop)>.dp-drill,.dp-content:has(>.fm[data-farm-integrated]>.fm-mask)>.dp-drill,.fm:has(>.fm-pop)>.fm-s-header,.fm:has(>.fm-mask)>.fm-s-header{display:none}",
      '.fm-helper-panel{display:grid;gap:8px}.fm-helper-card{display:grid;gap:6px;min-width:0;padding:8px;border:1px solid var(--animal-border);border-radius:var(--ac-radius-card,16px);background:var(--animal-bg-content)}.fm-helper-status,.fm-helper-storage,.fm-helper-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.fm-helper-status-main{display:flex;align-items:center;gap:8px;min-width:0}.fm-helper-status-icon{width:34px;height:34px;flex:none}.fm-helper-copy{display:grid;gap:2px;min-width:0}.fm-helper-copy>b{font-size:13px;color:var(--animal-text)}.fm-helper-copy>small{font-size:11px;color:var(--animal-text-body)}.fm-helper-badge,.fm-helper-price{border-radius:var(--ac-pill,50px);padding:4px 8px;font-size:10px;white-space:nowrap;background:var(--ac-warning-bg,#fff2c9);color:var(--animal-text)}.fm-helper-badge[data-enabled="true"]{background:var(--ac-primary-bg,#d7f5ef)}.fm-helper-price{font-weight:800}.fm-helper-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:48px;padding:8px 10px;text-align:left}.fm-helper-toggle-copy{display:grid;gap:2px}.fm-helper-toggle-copy>b{font-size:12px;color:var(--animal-text)}.fm-helper-toggle-copy>small,.fm-helper-footer{font-size:10px;color:var(--animal-text-body)}.fm-helper-switch{position:relative;display:block;width:40px;height:24px;flex:none;border-radius:var(--ac-pill,50px);background:var(--ac-border,#c4b89e);transition:background .16s var(--animal-ease)}.fm-helper-switch>i{position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:var(--ac-bg-content,#fff8e3);transition:transform .16s var(--animal-ease)}.fm-helper-toggle[aria-checked="true"] .fm-helper-switch{background:var(--animal-primary)}.fm-helper-toggle[aria-checked="true"] .fm-helper-switch>i{transform:translateX(16px)}.fm-helper-action{justify-self:end;flex:none;min-height:30px;padding:4px 10px;font-size:11px}.fm-helper-footer{line-height:1.45;padding:0 2px;text-align:center}',
      '.fm-helper-workers{display:grid;gap:6px;min-width:0}.fm-helper-worker{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-width:0;padding:6px 8px;border:1px solid var(--ac-border-light,#e5dcc6);border-radius:var(--ac-radius-sm,12px);background:var(--animal-bg,#f8f8f0)}.fm-helper-worker-id{flex:none;font-size:12px;font-weight:800;color:var(--animal-text)}.fm-role-badge{flex:none;border-radius:var(--ac-pill,50px);padding:3px 8px;font-size:10px;line-height:1.4;white-space:nowrap;background:var(--ac-primary-bg,#d7f5ef);color:var(--animal-text)}.fm-role-badge[data-role="patrol"]{background:var(--ac-warning-bg,#fff2c9)}.fm-helper-worker-plots{flex:1 1 auto;min-width:0;font-size:11px;color:var(--animal-text-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fm-role-btn{flex:none;margin-left:auto;min-height:28px;padding:3px 10px;font-size:11px;white-space:nowrap}.fm-helper-warning{font-size:11px;line-height:1.45;padding:2px 2px 0;color:var(--animal-text)}',
      '.fm-s-detail{position:relative}.fm-s-detail[data-has-action]>small{padding-right:98px}.fm-s-detail .fm-s-acts{position:absolute;right:4px;bottom:4px;display:block;padding:0;max-width:48%}.fm .fm-s-detail .fm-main{min-height:30px;font-size:12px;padding:4px 8px;display:block;white-space:normal}.fm-s-detail .fm-main>small{display:none}.fm:not(.fm-big) .fm-dock-btn{min-height:56px;padding:4px;gap:2px}.fm:not(.fm-big) .fm-dock-btn>img{width:32px;height:32px}.fm .fm-s-field .fm-plot[data-farm-target="true"],.fm .fm-s-field .fm-plot:focus-visible{outline:none;box-shadow:none;border:0}.fm .fm-plot[data-farm-target="true"]::before,.fm .fm-plot:focus-visible::before{content:"";position:absolute;inset:-3px;box-sizing:border-box;border:2px solid var(--ac-bg-input,#fffbe7);border-radius:8px;box-shadow:inset 0 0 0 2px var(--animal-primary);mask:linear-gradient(var(--animal-primary) 0 0) left top/12px 12px no-repeat,linear-gradient(var(--animal-primary) 0 0) right top/12px 12px no-repeat,linear-gradient(var(--animal-primary) 0 0) right bottom/12px 12px no-repeat,linear-gradient(var(--animal-primary) 0 0) left bottom/12px 12px no-repeat;pointer-events:none;z-index:1}.fm-bubble{z-index:2}'
    ].join("");
    const cssArt = { "ui-slot": true, "ui-button": true, "ui-main": true, "ui-note": true, "ui-small-plank": true, "ui-big-toolbar": true, "ui-big-topbar": true, "ui-exp-frame": true, "progress-track": true, "progress-fill": true, "shop-title": true, "buy-title": true, "pack-title": true, "shop-tab": true, "shop-tab-active": true, "shop-item": true, "shop-item-locked": true, "pack-slot": true, "pack-slot-selected": true, "info-row": true, "stepper-field": true, "btn-confirm": true, "btn-cancel": true, "status-chip": true, "status-chip-active": true, "big-sign-expand": true, "card-tail": true, "stepper-plus": true, "stepper-minus": true };
    const controlArt = { "lock-badge": "redraw-lock.webp", "weed": "paper-weed.png", "withered": "paper-stubble.png" };
    const paperControls = { "tool-planter": "paper-push-seeder.png", "tool-rake": "paper-leveling-rake.png", "tool-sprayer": "paper-backpack-sprayer.png", "tool-sickle": "paper-harvest-sickle.png", "fert-1": "paper-fertilizer-bag.png", "tool-pesticide": "paper-insect-spray.png", "tool-weedkiller": "paper-weed-spray.png", "tool-gloves": "paper-glove.png", "tool-seedbag": "paper-seed-bag.png", "tool-can": "paper-watering-can.png", "tool-shovel": "paper-shovel.png", "ui-storage": "paper-backpack.png", "ui-shop": "paper-shop.png" };
    function ensureStyle() {
      var style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        document.head.appendChild(style);
      }
      if (style.textContent !== css) style.textContent = css;
    }
    function art(app, name) {
      return cssArt[name] || typeof app.asset !== "function" ? "" : app.asset(paperControls[name] && typeof app.hasAsset === "function" && app.hasAsset(paperControls[name]) ? paperControls[name] : controlArt[name] || name + ".webp");
    }
    function bg(app, node, name) {
      if (!name) return node;
      var url = art(app, name);
      if (url) node.style.backgroundImage = 'url("' + url + '")';
      if (url && typeof app.paintAsset === "function") app.paintAsset(node, controlArt[name] || name + ".webp");
      return node;
    }
    function paper(app, name) {
      return typeof app.hasAsset === "function" && app.hasAsset(name + ".png") ? app.asset(name + ".png") : "";
    }
    function paint(node, url) {
      if (url) {
        node.style.backgroundImage = 'url("' + url + '")';
        node.style.backgroundSize = "cover";
        node.style.backgroundRepeat = "no-repeat";
        node.setAttribute("data-paper", "true");
      }
      return node;
    }
    function picture(app, className, url, fallback) {
      if (!url) return app.el("span", className, fallback || "");
      var node = app.el("img", className);
      node.src = url;
      node.alt = "";
      return node;
    }
    function img(app, className, name, fallback) {
      return picture(app, className, art(app, name), fallback);
    }
    function put(parent, child) {
      parent.appendChild(child);
      return child;
    }
    function button(app, className, attrs, label, onClick) {
      var node = app.button((className.indexOf("dp-") >= 0 ? "" : "dp-btn ") + className, attrs, onClick);
      node.textContent = label;
      return node;
    }
    function frame(app, node) {
      node.className += " fm-paper";
      node.setAttribute("data-farm-frame", "css-paper");
      return node;
    }
    return { ensureStyle, art, bg, paper, paint, picture, img, put, button, frame };
  }

  // src/extensions/farm/client/events.js
  function createFarmEvents(state, modules) {
    function say(app, text, index) {
      state.tip = text;
      state.tipAt = Date.now();
      state.tipPlot = index;
      app.rerender();
    }
    function pageKey(app) {
      var mode = (app || state.currentApp || {}).mode === "big" ? "farm-large" : "farm";
      if (state.purchase) return mode + ":buy:" + state.purchase.key;
      if (state.confirmClear !== null) return mode + ":clear:" + state.confirmClear;
      if (state.popup) return mode + ":page:" + state.popup + ":" + (state.popup === "shop" ? state.shopTab : state.popup === "bag" ? state.bagTab : "");
      return mode + ":field";
    }
    function scrollNode(app) {
      return app.mode === "big" ? state.lastRoot : app.content;
    }
    function rememberScroll(app, key) {
      var node = scrollNode(app);
      if (node) state.scrollMemory[key] = node.scrollTop || 0;
    }
    function restoreScroll(app, key) {
      var node = scrollNode(app);
      if (!node) return;
      var top = state.scrollMemory[key] || 0;
      if (typeof Promise === "function") Promise.resolve().then(function() {
        if (node.scrollTop !== top) node.scrollTop = top;
        if (state.revealTools && state.drawerOpen) {
          state.revealTools = false;
          var dock = node.querySelector(".fm-dock");
          if (dock && typeof dock.scrollIntoView === "function") dock.scrollIntoView({ block: "start", behavior: "instant" });
        }
      });
    }
    function watchScroll(node) {
      if (node && typeof node.addEventListener === "function") node.addEventListener("scroll", function() {
        if (state.currentKey) state.scrollMemory[state.currentKey] = node.scrollTop;
      });
    }
    function goPage(app, name) {
      rememberScroll(app, pageKey(app));
      state.popup = name;
      state.purchase = null;
      state.confirmClear = null;
      app.rerender();
    }
    function closePage(app) {
      rememberScroll(app, pageKey(app));
      state.popup = null;
      state.purchase = null;
      state.confirmClear = null;
      app.rerender();
    }
    function goShop(app, tab) {
      rememberScroll(app, pageKey(app));
      if (tab) state.shopTab = tab;
      state.popup = "shop";
      state.purchase = null;
      app.rerender();
    }
    function goBag(app, tab) {
      rememberScroll(app, pageKey(app));
      if (tab) state.bagTab = tab;
      state.popup = "bag";
      app.rerender();
    }
    function shortTime(ms) {
      var minutes = Math.ceil(ms / 6e4);
      return minutes < 60 ? minutes + " \u5206\u949F" : Math.floor(minutes / 60) + " \u5C0F\u65F6" + (minutes % 60 ? " " + minutes % 60 + " \u5206" : "");
    }
    function owns(data, key) {
      return (data.tools || []).some(function(tool) {
        return tool.key === key && tool.owned;
      });
    }
    function seedOf(data, key) {
      return (data.seeds || []).find(function(seed) {
        return seed.key === key;
      }) || null;
    }
    function firstSeed(data) {
      return (data.seeds || []).find(function(seed) {
        return seed.count > 0 && !seed.locked;
      }) || null;
    }
    function seedInHand(data) {
      return state.hand.kind === "seed" ? seedOf(data, state.hand.key) : firstSeed(data);
    }
    function pestsOf(plot) {
      return plot.pests || [];
    }
    function pestText(plot, sep) {
      return pestsOf(plot).map(function(p) {
        return state.PEST_LABEL[p];
      }).join(sep);
    }
    function cropArt(plot) {
      return plot.withered ? "withered" : plot.stage === "seed" || plot.stage === "sprout" ? plot.stage : "crop-" + plot.crop + "-" + plot.stage;
    }
    function survey(data, from, to) {
      var pick = function(test) {
        var out = [];
        for (var i = from; i < to; i += 1) if (test(data.plots[i])) out.push(i);
        return out;
      };
      return {
        ripe: pick(function(p) {
          return p.ripe;
        }),
        pests: pick(function(p) {
          return pestsOf(p).length > 0 && !p.ripe;
        }),
        withered: pick(function(p) {
          return p.withered;
        }),
        empty: pick(function(p) {
          return p.empty;
        }),
        soonest: data.plots.slice(from, to).reduce(function(min, p) {
          return p.remainingMs > 0 ? Math.min(min, p.remainingMs) : min;
        }, Infinity)
      };
    }
    function validPlot(plot) {
      if (plot.wild) return false;
      if (state.hand.kind === "auto") return plot.ripe === true;
      if (state.hand.kind === "shovel") return !plot.empty || plot.stubble || plot.withered;
      if (state.hand.kind === "care") return pestsOf(plot).indexOf(state.hand.key) >= 0;
      if (state.hand.kind === "seed") return plot.empty === true && !plot.stubble && pestsOf(plot).indexOf("weed") < 0;
      return false;
    }
    function syncHand(data) {
      var seed = state.hand.kind === "seed" ? seedOf(data, state.hand.key) : null;
      if (state.hand.kind === "seed" && (!seed || seed.count < 1 || seed.locked)) state.hand = state.AUTO;
      var fert = state.hand.kind === "fert" ? (data.fert || []).find(function(f) {
        return f.key === state.hand.key;
      }) : null;
      if (state.hand.kind === "fert" && (!fert || fert.count < 1)) state.hand = state.AUTO;
    }
    function sendAction(app, op, payload) {
      if (state.inflight) return null;
      var result = app.send(op, payload), ticket = {};
      if (!result || typeof result.then !== "function") return result;
      state.inflight = ticket;
      if (state.pendingAction && state.pendingAction.op === op) state.pendingAction.awaiting = ticket;
      app.rerender();
      var settle = function(next) {
        if (state.inflight !== ticket) return;
        state.inflight = null;
        if (!next || next.ok === false) {
          state.pendingAction = null;
          return app.rerender();
        }
        if (state.pendingAction && state.pendingAction.awaiting === ticket) {
          state.pendingAction.awaiting = null;
          finishAction(app, app.data);
        }
        app.rerender();
      };
      result.then(settle, function() {
        settle(null);
      });
      return result;
    }
    function act(app, index, emoji, op, payload) {
      if (state.inflight) return;
      state.fx = null;
      state.pendingAction = { op, plot: index, before: app.data, fx: emoji };
      sendAction(app, op, payload);
    }
    function clickPlot(app, data, index) {
      if (state.inflight) return;
      state.selectedPlot = index;
      var plot = data.plots[index];
      var shovel = state.hand.kind === "shovel";
      if (plot.wild) return say(app, plot.next ? "\u70B9\u6728\u724C\u5F00\u57A6" : "\u8981\u5148\u5F00\u524D\u4E00\u5757\u8352\u5730");
      if (shovel && plot.empty && !plot.stubble) return say(app, "\u8FD9\u5757\u5730\u662F\u7A7A\u7684", index);
      if (shovel && !plot.empty && !plot.withered) {
        rememberScroll(app, pageKey(app));
        state.confirmClear = index;
        state.modalReturn = { attr: "data-farm-plot", value: String(index) };
        return app.rerender();
      }
      if (shovel) {
        state.confirmClear = null;
        return act(app, index, "\u{1FA8F}", "clear", plot.withered || plot.stubble ? { plot: index } : { plot: index, force: true });
      }
      state.confirmClear = null;
      if (state.hand.kind === "care") {
        if (pestsOf(plot).indexOf(state.hand.key) >= 0) return act(app, index, state.hand.key === "dry" ? "\u{1F4A7}" : "\u2728", "care", { plot: index, kind: state.hand.key });
        return say(app, state.hand.key === "dry" ? "\u8FD9\u5757\u5730\u4E0D\u7528\u6D47\u6C34" : "\u8FD9\u5757\u5730\u6CA1\u6709" + state.PEST_LABEL[state.hand.key], index);
      }
      if (state.hand.kind === "fert") return plot.empty || plot.ripe || plot.withered ? say(app, "\u80A5\u6599\u8981\u65BD\u5728\u6B63\u5728\u957F\u7684\u5730\u4E0A") : app.send("fertilize", { plot: index, item: state.hand.key });
      if (state.hand.kind === "auto") {
        if (plot.ripe) return act(app, index, "\u2728", "harvest", { plot: index });
        state.tip = null;
        return app.rerender();
      }
      if (plot.empty && (plot.stubble || pestsOf(plot).indexOf("weed") >= 0)) return say(app, "\u5148\u9664\u8349 / \u94F2\u6389\u6742\u8349", index);
      if (plot.empty) {
        var seed = seedInHand(data);
        return seed ? act(app, index, "\u{1F331}", "plant", { plot: index, item: seed.key }) : goShop(app, "seed");
      }
      say(app, "\u8FD9\u5757\u5730\u4E0D\u662F\u7A7A\u5730", index);
    }
    function finishAction(app, data) {
      if (state.fx && Date.now() - state.fx.at >= 620) state.fx = null;
      if (!state.pendingAction || state.pendingAction.before === data || state.pendingAction.awaiting) return;
      var action = state.pendingAction, old = action.before, plot = action.plot, text = null;
      state.pendingAction = null;
      if (action.op === "onboarding") {
        var now = data.onboarding || {};
        if (action.lessonOp === "plant" && now.step === "planted") text = "\u7B2C\u4E00\u8BFE\u79CD\u4E0B\u4E86";
        if (action.lessonOp === "water" && now.watered && !(old.onboarding && old.onboarding.watered)) text = "\u6D47\u6C34\u6210\u529F";
        if (action.lessonOp === "harvest" && now.step === "done") {
          state.lessonRewardAt = Date.now();
          text = "\u7B2C\u4E00\u8BFE\u5B8C\u6210\uFF1A" + now.reward.currency + " \u83DC\u5E01 + " + now.seed.label + " \xD71";
        }
      }
      if (action.op === "plant" && old.plots[plot].empty && !data.plots[plot].empty) text = "\u64AD\u79CD\u6210\u529F";
      if (action.op === "harvest" && old.plots[plot].ripe && !data.plots[plot].ripe) text = "\u6536\u83B7 " + old.plots[plot].yield + " \u4E2A";
      if (action.op === "care" && pestsOf(data.plots[plot]).length < pestsOf(old.plots[plot]).length) text = "\u7167\u6599\u6210\u529F";
      if (action.op === "clear" && (data.plots[plot].empty || !data.plots[plot].stubble)) text = "\u94F2\u9664\u6210\u529F";
      if (/All$/.test(action.op) && JSON.stringify(old.plots) !== JSON.stringify(data.plots)) text = "\u64CD\u4F5C\u6210\u529F";
      if (action.item && old.balance - data.balance === action.item.price * action.count) text = "\u8D2D\u4E70\u6210\u529F\uFF01" + action.item.label + " \xD7" + action.count + "\uFF0C\u82B1\u8D39 " + action.item.price * action.count + " \u83DC\u5E01";
      if (text) {
        state.tip = text;
        state.tipAt = Date.now();
        state.tipPlot = plot;
        var kind = action.op === "onboarding" ? { plant: "sow", water: "water", harvest: "harvest" }[action.lessonOp] : action.op === "plant" ? "sow" : action.op === "harvest" ? "harvest" : action.op === "care" && action.fx === "\u{1F4A7}" ? "water" : null;
        if (kind) state.fx = { plot, lesson: action.op === "onboarding", kind, at: Date.now() };
      }
    }
    function bindKeyboard() {
      if (state.keyboardBound) return;
      state.keyboardBound = true;
      document.addEventListener("focusin", function(event) {
        if (state.modalOpen && inDialog(event.target)) state.modalFocus = focusDescriptor(event.target) || state.modalFocus;
      });
      document.addEventListener("keydown", function(event) {
        var dialog = state.currentApp && state.currentApp.content.querySelector('[role="dialog"]');
        if (dialog && event.key === "Tab") {
          var focusable = Array.prototype.filter.call(dialog.querySelectorAll("button,input,select,textarea,a"), function(node) {
            return !node.disabled && node.getAttribute("tabindex") !== "-1";
          });
          if (!focusable.length) {
            event.preventDefault();
            dialog.focus();
            return;
          }
          var active = document.activeElement, first = focusable[0], last = focusable[focusable.length - 1];
          if (!inDialog(active) || event.shiftKey && active === first || !event.shiftKey && active === last) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
          }
          return;
        }
        if (state.currentApp && event.key === "Escape") {
          if (state.cancelLayer) state.cancelLayer();
          else if (state.popup) closePage(state.currentApp);
          else if (state.drawerOpen) {
            state.drawerOpen = false;
            state.currentApp.rerender();
          }
          return;
        }
        if (!state.currentApp || state.currentApp.mode !== "big" || !state.currentApp.content.querySelector(".fm-big") || event.ctrlKey || event.altKey || event.metaKey || /** @type {HTMLElement} */
        event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(
          /** @type {HTMLElement} */
          event.target.tagName
        )) return;
        var tools = { q: { kind: "care", key: "dry" }, w: { kind: "care", key: "weed" }, e: { kind: "care", key: "bug" }, r: state.AUTO };
        var chosen = tools[String(event.key).toLowerCase()];
        if (chosen) {
          event.preventDefault();
          state.hand = chosen;
          state.currentApp.rerender();
        }
      });
    }
    function focusDescriptor(node) {
      if (!node) return null;
      var attrs = ["data-farm-quantity-field", "data-farm-quantity", "data-farm-back", "data-farm-confirm", "data-farm-cancel"];
      for (var i = 0; i < attrs.length; i += 1) if (node.getAttribute(attrs[i]) !== null) return { attr: attrs[i], value: node.getAttribute(attrs[i]) };
      return null;
    }
    function inDialog(node) {
      while (node) {
        if (node.getAttribute && node.getAttribute("role") === "dialog") return true;
        node = node.parentNode;
      }
      return false;
    }
    function syncModalFocus(app, root) {
      var dialog = root.querySelector('[role="dialog"]');
      if (dialog) {
        var target = null;
        if (state.modalOpen && state.modalFocus) target = dialog.querySelector("[" + state.modalFocus.attr + '="' + state.modalFocus.value + '"]');
        if (target && target.disabled) target = null;
        if (!state.modalOpen || !target) {
          var field = dialog.querySelector('[data-farm-quantity-field="true"]'), confirm = dialog.querySelector('[data-farm-confirm="true"]');
          target = field && !field.disabled ? field : confirm && !confirm.disabled ? confirm : dialog.querySelector('[data-farm-cancel="true"]');
        }
        state.modalOpen = true;
        if (target && document.activeElement !== target) target.focus();
        state.modalFocus = focusDescriptor(target) || state.modalFocus;
        return;
      }
      if (state.modalOpen) {
        var trigger = state.modalReturn && root.querySelector("[" + state.modalReturn.attr + '="' + state.modalReturn.value + '"]');
        state.modalOpen = false;
        state.modalFocus = null;
        state.modalReturn = null;
        if (trigger) trigger.focus();
      }
    }
    function setRole(app, id, role) {
      if (state.inflight) return null;
      var result = sendAction(app, "setHelperRole", { id, role });
      if (result && typeof result.then === "function") result.then(function(next) {
        if (!next || next.ok !== false) return;
        if (next.reason === "already") return;
        if (next.reason === "unavailable") say(app, "\u8FD9\u53EA\u5E2E\u5DE5\u73B0\u5728\u6362\u4E0D\u4E86\u89D2\u8272");
      });
      return result;
    }
    function helperCount(helper) {
      return Number(helper.count) || (Array.isArray(helper.workers) ? helper.workers.length : 1);
    }
    function helperText(helper) {
      if (!helper.hired) return "\u96C7\u5E2E\u5DE5\u732A";
      if (helper.full) return "\u5E2E\u5DE5\u4ED3\u5E93\u6EE1\u4E86";
      if (helper.stored > 0) return "\u5E2E\u5DE5\u6536\u4E86 " + helper.stored + " \u4E2A";
      if (!helper.enabled) return "\u5E2E\u5DE5\u5DF2\u6682\u505C";
      if (helper.missing.length) return "\u7F3A" + helper.missing.join("\u3001") + "\u79CD\u5B50";
      if (helper.seedless) return "\u5E2E\u5DE5\u6CA1\u79CD\u5B50";
      if (helper.plots === 0) return "\u6CA1\u6709\u6536\u83DC\u5E2E\u5DE5\uFF0C\u83DC\u4E0D\u4F1A\u81EA\u52A8\u6536";
      return helperCount(helper) > 1 ? "\u5E2E\u5DE5 \xD7" + helperCount(helper) + " \xB7 \u6536 " + helper.plots + " \u5757" : "\u5E2E\u5DE5 \xB7 " + helper.plots + " \u5757\u5730";
    }
    function helperClick(app, helper) {
      if (!helper.hired) return sendAction(app, "hire", {});
      if (helper.stored > 0 || helper.full) return sendAction(app, "collect", {});
      if (!helper.enabled) return goShop(app, "helper");
      if (helper.missing.length || helper.seedless) return goShop(app, "seed");
      if (helper.plots === 0) return goShop(app, "helper");
      say(app, helperCount(helper) > 1 ? "\u5E2E\u5DE5 \xD7" + helperCount(helper) + " \u6B63\u5728\u7167\u987E " + helper.plots + " \u5757\u5730" : "\u5E2E\u5DE5\u6B63\u5728\u7167\u987E " + helper.plots + " \u5757\u5730");
    }
    return { say, pageKey, scrollNode, rememberScroll, restoreScroll, watchScroll, goPage, closePage, goShop, goBag, shortTime, owns, seedOf, firstSeed, seedInHand, pestsOf, pestText, cropArt, survey, validPlot, syncHand, sendAction, setRole, act, clickPlot, finishAction, bindKeyboard, focusDescriptor, inDialog, syncModalFocus, helperText, helperClick };
  }

  // src/extensions/farm/client/render-garden.js
  function createFarmGardenRenderer(state, modules) {
    function reclaimSign(app, data, index) {
      var node = modules.host.button(app, "fm-chip fm-expand", { "data-farm-reclaim": String(index), "aria-label": "\u5F00\u57A6\u8FD9\u5757\u8352\u5730 " + data.reclaimPrice + " \u83DC\u5E01" }, "\u5F00\u57A6 " + data.reclaimPrice, function(event) {
        event.stopPropagation();
        if (node.parentNode) node.parentNode.removeAttribute("data-farm-hover");
        if (!data.plots[index].next) return modules.events.say(app, "\u8981\u5148\u5F00\u524D\u4E00\u5757\u8352\u5730");
        if (data.balance < data.reclaimPrice) return modules.events.say(app, "\u5F00\u57A6\u8981 " + data.currency.emoji + " " + data.reclaimPrice);
        app.send("unlock", { plot: index });
      });
      return modules.host.bg(app, node, "big-sign-expand");
    }
    function plotCard(app, data, index, kind) {
      var plot = data.plots[index];
      var attrs = { "data-farm-plot": String(index), "aria-label": plotLabel(plot) };
      var card = plot.wild ? app.el("div", "fm-plot") : app.button("fm-plot" + (plot.ripe ? " fm-ripe" : ""), attrs, function() {
        modules.events.clickPlot(app, data, index);
      });
      if (plot.wild) card.setAttribute("role", "group");
      if (plot.wild) Object.keys(attrs).forEach(function(key) {
        card.setAttribute(key, attrs[key]);
      });
      if (plot.wild) card.addEventListener("click", function() {
        modules.events.clickPlot(app, data, index);
      });
      modules.host.put(card, modules.host.picture(app, "fm-soil", modules.host.paper(app, "paper-soil-patch")));
      var pointerFocus = false;
      card.addEventListener("pointerdown", function() {
        pointerFocus = true;
      });
      card.addEventListener("focus", function() {
        if (pointerFocus) {
          pointerFocus = false;
          return;
        }
        if (state.selectedPlot !== index) {
          state.selectedPlot = index;
          app.rerender();
        }
      });
      card.addEventListener("blur", function() {
        pointerFocus = false;
      });
      card.addEventListener("mousemove", function() {
        card.setAttribute("data-farm-hover", "true");
      });
      card.addEventListener("mouseleave", function() {
        card.removeAttribute("data-farm-hover");
      });
      card.addEventListener("click", function() {
        card.removeAttribute("data-farm-hover");
      });
      card.setAttribute("data-farm-soil", plot.wild ? "wild" : modules.events.pestsOf(plot).indexOf("dry") >= 0 ? "dry" : "farmed");
      card.setAttribute("data-farm-valid", String(modules.events.validPlot(plot)));
      if (state.fx && !state.fx.lesson && state.fx.plot === index) {
        card.setAttribute("data-farm-fx", state.fx.kind);
        card.style.setProperty("--fm-fx-delay", -(Date.now() - state.fx.at) + "ms");
      }
      if (plot.wild) {
        if (plot.next) modules.host.put(card, reclaimSign(app, data, index));
        else modules.host.put(card, modules.host.bg(app, app.el("span", "fm-lock"), "lock-badge"));
        return card;
      }
      if (plot.empty && state.hand.kind === "seed" && !plot.stubble && modules.events.pestsOf(plot).indexOf("weed") < 0) {
        var ghost = modules.host.put(card, modules.host.bg(app, app.el("span", "fm-ghost"), "plot-ghost-seed"));
        modules.host.put(ghost, modules.host.img(app, null, "produce-" + state.hand.key));
      }
      if (plot.stubble) modules.host.put(card, modules.host.img(app, "fm-crop", "withered"));
      if (plot.empty && modules.events.pestsOf(plot).indexOf("weed") >= 0) modules.host.put(card, modules.host.img(app, "fm-pest", "weed")).setAttribute("data-pest", "weed");
      modules.events.pestsOf(plot).forEach(function(pest, n) {
        var bubble = modules.host.put(card, modules.host.img(app, "fm-bubble", "plot-bubble-" + (pest === "dry" ? "water" : pest)));
        bubble.style.right = kind === "big" ? "calc(50% - 36px + " + n * 24 + "px)" : n * 23 + "%";
        bubble.setAttribute("data-farm-bubble", pest);
      });
      if (state.tip && state.tipPlot === index && Date.now() - state.tipAt < 2400) renderTip(app, card);
      if (plot.empty) return card;
      modules.host.put(card, modules.host.img(app, "fm-crop", modules.events.cropArt(plot), plot.emoji));
      if (modules.events.pestsOf(plot).indexOf("weed") >= 0) modules.host.put(card, modules.host.img(app, "fm-pest", "weed")).setAttribute("data-pest", "weed");
      var chip = plot.ripe ? "\u6536 " + plot.yield + " \u4E2A" : plot.withered ? "\u67AF\u4E86" : "";
      if (chip) modules.host.put(card, app.el("span", "fm-chip", chip));
      return card;
    }
    function plotLabel(plot) {
      if (plot.wild) return plot.next ? "\u8352\u5730\uFF0C\u70B9\u6728\u724C\u5F00\u57A6" : "\u8352\u5730\uFF0C\u8981\u5148\u5F00\u57A6\u524D\u4E00\u5757";
      if (plot.empty) return "\u7A7A\u5730";
      return plot.label + (plot.withered ? " \u67AF\u4E86" : plot.ripe ? " \u719F\u4E86" : modules.events.pestsOf(plot).length ? " " + modules.events.pestText(plot, "\u3001") : "");
    }
    function levelBadge(app, data) {
      var node = app.button("dp-btn fm-stat fm-level", { "data-farm-level": "info", "aria-label": "\u7B49\u7EA7\u4E0E\u7ECF\u9A8C" }, function() {
        modules.events.say(app, "\u7B49\u7EA7 " + data.level + " \xB7 \u7ECF\u9A8C " + data.exp + " / " + data.need);
      });
      modules.host.put(node, app.el("b", null, "Lv." + data.level));
      var exp = modules.host.put(node, modules.host.bg(app, app.el("span", "fm-exp"), "ui-exp-frame"));
      exp.setAttribute("title", "\u7ECF\u9A8C " + data.exp + " / " + data.need);
      modules.host.put(exp, app.el("i")).style.width = Math.max(0, Math.min(90, data.exp / data.need * 90)) + "%";
      return node;
    }
    function metaRow(app, data, box) {
      var meta = modules.host.put(box, app.el("div", "fm-advanced-meta"));
      modules.host.put(meta, levelBadge(app, data));
      modules.host.put(meta, modules.host.button(app, "fm-meta fm-weather", { "data-farm-weather": "info" }, "\u5929\u6C14\uFF1A" + (data.weather === "rain" ? "\u4E0B\u96E8" : "\u6674\u5929"), function() {
        modules.events.say(app, "\u5929\u6C14\uFF1A" + (data.weather === "rain" ? "\u4E0B\u96E8" : "\u6674\u5929"));
      }));
      return meta;
    }
    function toolSlot(app, spec) {
      var pressed = spec.pressed === true || !!spec.hand && state.hand.kind === spec.hand.kind && state.hand.key === spec.hand.key;
      var node = app.button("dp-btn fm-slot", { "data-farm-tool": spec.key, "aria-pressed": String(pressed), "data-locked": String(!!spec.locked), "aria-label": spec.label, title: spec.label }, function() {
        modules.events.rememberScroll(app, modules.events.pageKey(app));
        state.confirmClear = null;
        state.drawerOpen = false;
        if (spec.locked) return modules.events.goShop(app, "tool");
        if (spec.run) return spec.run();
        state.hand = pressed ? state.AUTO : spec.hand;
        state.popup = null;
        app.rerender();
      });
      node.addEventListener("mousemove", function() {
        node.setAttribute("data-farm-hover", "true");
      });
      node.addEventListener("mouseleave", function() {
        node.removeAttribute("data-farm-hover");
      });
      node.addEventListener("click", function() {
        node.removeAttribute("data-farm-hover");
      });
      modules.host.put(node, modules.host.img(app, null, spec.art, spec.emoji));
      modules.host.put(node, app.el("span", "fm-tool-label", spec.label.split("\uFF1A")[0].split("\uFF08")[0]));
      if (spec.locked) modules.host.put(node, modules.host.bg(app, app.el("span", "fm-lock"), "lock-badge"));
      else if (spec.count > 0) modules.host.put(node, app.el("i", "fm-n", String(spec.count)));
      return node;
    }
    function careCount(data, kind) {
      return data.plots.slice(0, data.unlocked).filter(function(plot) {
        return modules.events.pestsOf(plot).indexOf(kind) >= 0;
      }).length;
    }
    function fertCount(data) {
      return (data.fert || []).reduce(function(sum, fert) {
        return sum + fert.count;
      }, 0);
    }
    function allTools(app, data) {
      var all = modules.events.survey(data, 0, data.unlocked);
      var seed = state.hand.kind === "seed" ? modules.events.seedOf(data, state.hand.key) : null;
      var specs = [
        Object.assign({}, state.CARE_TOOLS[3], { count: all.ripe.length }),
        { key: "seedbag", art: "tool-seedbag", emoji: "\u{1F330}", label: "\u79CD\u5B50\u888B\uFF1A\u9009\u79CD\u5B50\u64AD\u79CD", run: function() {
          modules.events.goBag(app, "seed");
        }, count: seed ? seed.count : 0 },
        Object.assign({}, state.CARE_TOOLS[0], { count: careCount(data, "dry") }),
        { key: "shovel", art: "tool-shovel", emoji: "\u{1FA8F}", label: "\u94C1\u9539\uFF1A\u70B9\u5730\u94F2\u6389\uFF0C\u6B63\u5728\u957F\u7684\u4F5C\u7269\u8981\u786E\u8BA4", hand: { kind: "shovel", key: null }, count: all.withered.length },
        Object.assign({}, state.CARE_TOOLS[1], { count: careCount(data, "weed") }),
        Object.assign({}, state.CARE_TOOLS[2], { count: careCount(data, "bug") })
      ];
      state.ONE_CLICK.forEach(function(spec) {
        var owned = modules.events.owns(data, spec.key);
        specs.push({
          key: spec.key,
          art: "tool-" + spec.key,
          emoji: "\u{1F9F0}",
          locked: !owned,
          count: all[{ harvestAll: "ripe", careAll: "pests", clearAll: "withered", plantAll: "empty" }[spec.op]].length,
          label: owned ? spec.label : spec.label + "\uFF08\u53BB\u5546\u5E97\u4E70" + spec.tool + "\uFF09",
          run: function() {
            if (spec.op !== "plantAll") return modules.events.sendAction(app, spec.op, {});
            var seed2 = modules.events.seedInHand(data);
            return seed2 ? modules.events.sendAction(app, "plantAll", { item: seed2.key }) : modules.events.goShop(app, "seed");
          }
        });
      });
      specs.push({ key: "fert", art: "fert-1", emoji: "\u{1F9EA}", label: "\u80A5\u6599\uFF1A\u70B9\u6B63\u5728\u957F\u7684\u5730", run: function() {
        return fertCount(data) > 0 ? modules.events.goBag(app, "item") : modules.events.goShop(app, "fert");
      }, count: fertCount(data) });
      return specs;
    }
    function renderDrawer(app, data, box) {
      var drawer = modules.host.put(box, app.el("div", "fm-drawer"));
      drawer.id = "dsh-piggy-farm-tools";
      drawer.setAttribute("data-farm-drawer", "tools");
      var grid = modules.host.put(drawer, app.el("div", "fm-advanced-grid"));
      allTools(app, data).forEach(function(spec) {
        modules.host.put(grid, toolSlot(app, spec));
      });
      var actions = modules.host.put(drawer, app.el("div", "fm-advanced-actions"));
      if (data.helper) modules.host.put(actions, modules.host.button(app, "fm-nav-action", { "data-farm-helper": data.helper.hired ? "collect" : "hire", "aria-label": modules.events.helperText(data.helper) }, modules.events.helperText(data.helper), function() {
        modules.events.rememberScroll(app, modules.events.pageKey(app));
        modules.events.helperClick(app, data.helper);
      }));
      if (app.mode !== "big") metaRow(app, data, drawer);
    }
    function dock(app, data, box) {
      var bar = modules.host.put(box, app.el("div", "fm-dock"));
      function entry(attrs, label, artwork, run) {
        var node = modules.host.put(bar, modules.host.button(app, "fm-dock-btn", attrs, "", run));
        modules.host.put(node, modules.host.img(app, null, artwork));
        modules.host.put(node, app.el("span", null, label));
      }
      entry({ "data-farm-tools": "toggle", "aria-expanded": String(state.drawerOpen), "aria-controls": "dsh-piggy-farm-tools", "aria-label": "\u5DE5\u5177" }, "\u5DE5\u5177", "tool-gloves", function() {
        modules.events.rememberScroll(app, modules.events.pageKey(app));
        state.drawerOpen = !state.drawerOpen;
        state.revealTools = state.drawerOpen;
        app.rerender();
      });
      entry({ "data-farm-bag": "open", "aria-label": "\u80CC\u5305" }, "\u80CC\u5305", "ui-storage", function() {
        modules.events.goBag(app);
      });
      entry({ "data-farm-shop": "shelf", "aria-label": "\u5546\u5E97" }, "\u5546\u5E97", "ui-shop", function() {
        modules.events.goShop(app);
      });
      return bar;
    }
    function header(app, data, big, box) {
      if (big && typeof app.closeBig === "function") modules.host.put(box, modules.host.button(app, "dp-drill-back fm-back", { "data-farm-big": "close", "aria-label": "\u56DE\u5C0F\u519C\u573A" }, "\u2039", function() {
        modules.events.rememberScroll(app, modules.events.pageKey(app));
        app.closeBig();
      }));
      if (big || !app.header) modules.host.put(box, app.el("b", "fm-garden-title", "\u83DC\u56ED"));
      if (!big && typeof app.openBig === "function") modules.host.put(box, modules.host.button(app, "fm-big-open", { "data-farm-big": "open", "aria-label": "\u6253\u5F00\u5927\u519C\u573A" }, "\u5927\u519C\u573A", function() {
        modules.events.rememberScroll(app, modules.events.pageKey(app));
        app.openBig();
      }));
      var coin = modules.host.put(box, app.button("dp-btn fm-stat fm-coin", { "data-farm-coin": "open", "aria-label": "\u83DC\u5E01\u4F59\u989D " + data.balance + "\uFF0C\u53BB\u6362\u83DC\u5E01" }, function() {
        modules.events.goPage(app, "wallet");
      }));
      modules.host.put(coin, modules.host.img(app, null, "coin-veg", data.currency.emoji));
      modules.host.put(coin, app.el("span", null, "\u83DC\u5E01 " + data.balance));
    }
    function mainAction(data, look) {
      if (state.selectedPlot !== null && data.plots[state.selectedPlot].wild) {
        var wild = data.plots[state.selectedPlot];
        return { label: wild.next ? "\u5F00\u57A6\u8FD9\u5757\u5730" : "\u5C1A\u672A\u89E3\u9501", sub: wild.next ? "\u9700\u8981 " + data.reclaimPrice + " \u83DC\u5E01" : "\u5148\u5F00\u524D\u4E00\u5757\u5730", op: "unlock", payload: { plot: state.selectedPlot }, plot: state.selectedPlot, idle: !wild.next || data.balance < data.reclaimPrice };
      }
      var one = function(list, label, op, fx, rest) {
        return { label, sub: list.length > 1 ? "\u8FD8\u6709 " + (list.length - 1) + " \u5757" + rest : "", op, payload: { plot: list[0] }, plot: list[0], fx };
      };
      if (look.ripe.length) return one(look.ripe, "\u6536\u83DC", "harvest", "\u2728", "\u719F\u4E86");
      if (look.pests.length) {
        var index = look.pests[0], kind = modules.events.pestsOf(data.plots[index])[0];
        return { label: { dry: "\u6D47\u8FD9\u5757\u5730", weed: "\u7ED9\u8FD9\u5757\u5730\u9664\u8349", bug: "\u7ED9\u8FD9\u5757\u5730\u9664\u866B" }[kind], op: "care", plot: index, payload: { plot: index, kind }, fx: kind === "dry" ? "\u{1F4A7}" : "\u2728" };
      }
      if (look.withered.length) return one(look.withered, "\u94F2\u67AF\u82D7", "clear", "\u{1FA8F}", "\u67AF\u4E86");
      var stubble = look.empty.find(function(index2) {
        return data.plots[index2].stubble;
      });
      if (stubble >= 0) return { label: "\u94F2\u6742\u8349", op: "clear", payload: { plot: stubble }, plot: stubble, fx: "\u{1FA8F}" };
      if (look.empty.length) {
        var seed = modules.events.seedInHand(data);
        if (!seed) return { label: "\u53BB\u4E70\u79CD\u5B50", shop: true, plot: look.empty[0] };
        return { label: "\u79CD" + seed.label, op: "plant", payload: { plot: look.empty[0], item: seed.key }, plot: look.empty[0], fx: "\u{1F331}" };
      }
      return { label: "\u90FD\u5728\u957F", sub: look.soonest < Infinity ? "\u6700\u5FEB " + modules.events.shortTime(look.soonest) : "", idle: true };
    }
    function lessonOf(data) {
      var on = data.onboarding;
      return on && !on.legacy && on.step !== "done" ? on : null;
    }
    function lessonText(on) {
      return on.canPlant ? "\u5F85\u64AD\u79CD" : on.canHarvest ? "\u53EF\u4EE5\u6536\u4E86" : on.canWater ? "\u5F85\u6D47\u6C34" : "\u751F\u957F\u4E2D";
    }
    function lessonAction(on) {
      if (on.canPlant) return { label: "\u79CD\u4E0B\u7B2C\u4E00\u8BFE", sub: "\u8BFE\u5185" + on.seed.label + " \xD7" + on.seed.count, lesson: true };
      if (on.canHarvest) return { label: "\u6536\u83B7\u7B2C\u4E00\u8BFE", sub: on.reward.currency + " \u83DC\u5E01 + " + on.seed.label + " \xD71", lesson: true };
      if (on.canWater) return { label: "\u6D47\u8FD9\u5757\u5730", sub: "\u6D47\u6C34\u540E 2 \u5206\u949F\u6210\u719F", lesson: true };
      return { label: "\u7B49\u5B83\u957F\u5927", sub: "\u8FD8\u5269 " + modules.events.shortTime(on.remainingMs), idle: true };
    }
    function goalText(data, look) {
      var on = data.onboarding;
      if (on && !on.legacy && on.step === "offer") return "\u5148\u8BD5\u79CD\u4E00\u8F6E\u3002";
      if (on && !on.legacy && on.step === "planted") return on.canHarvest ? "\u7B2C\u4E00\u8BFE\u719F\u4E86\uFF0C\u6536\u4E0B\u5427\u3002" : "\u7B2C\u4E00\u8BFE \xB7 \u5C0F\u8471 \xB7 " + lessonText(on) + "\u3002";
      if (on && !on.legacy && state.lessonRewardAt && Date.now() - state.lessonRewardAt < 6e4) return "\u7B2C\u4E00\u8BFE\u5B8C\u6210\uFF1A" + on.reward.currency + " \u83DC\u5E01 + " + on.seed.label + " \xD71";
      if (look.ripe.length) return "\u6709 " + look.ripe.length + " \u5757\u83DC\u80FD\u6536\u4E86\u3002";
      if (look.pests.length) return look.pests.length + " \u5757\u5730\u8981\u7167\u6599\u3002";
      if (look.withered.length) return "\u6709\u67AF\u82D7\u8981\u94F2\u6389\u3002";
      if (look.empty.length) return "\u70B9\u7A7A\u5730\u79CD\u70B9\u65B0\u83DC\u3002";
      return look.soonest < Infinity ? "\u90FD\u5728\u957F\uFF0C\u6700\u5FEB " + modules.events.shortTime(look.soonest) + "\u3002" : "";
    }
    function lessonTile(app, on) {
      var card = app.button("fm-plot fm-s-lesson", { "data-farm-lesson": on.step, "data-farm-lesson-plot": "true", "data-farm-target": String(state.selectedPlot === null), "data-farm-next": "true", "aria-label": "\u7B2C\u4E00\u8BFE \u5C0F\u8471 " + lessonText(on) }, function() {
        state.selectedPlot = null;
        doLesson(app, on);
        app.rerender();
      });
      if (state.fx && state.fx.lesson) {
        card.setAttribute("data-farm-fx", state.fx.kind);
        card.style.setProperty("--fm-fx-delay", -(Date.now() - state.fx.at) + "ms");
      }
      modules.host.put(card, modules.host.picture(app, "fm-soil", modules.host.paper(app, "paper-soil-patch")));
      if (on.canPlant) {
        var ghost = modules.host.put(card, modules.host.bg(app, app.el("span", "fm-ghost"), "plot-ghost-seed"));
        modules.host.put(ghost, modules.host.img(app, null, "produce-scallion"));
      } else {
        var stage = on.progress >= 1 ? "ripe" : on.progress >= 2 / 6 ? "seedling" : "seed";
        var paperCrop = modules.host.paper(app, "paper-scallion-" + stage);
        var crop = modules.host.put(card, modules.host.picture(app, "fm-crop", paperCrop || modules.host.art(app, modules.events.cropArt({ crop: "scallion", stage })), "\u{1F331}"));
        if (paperCrop) crop.setAttribute("data-paper-stage", stage);
      }
      if (on.canWater) modules.host.put(card, modules.host.img(app, "fm-bubble", "plot-bubble-water", "\u{1F4A7}"));
      modules.host.put(card, app.el("span", "fm-chip", on.canPlant ? "\u8BD5\u79CD" : on.canHarvest ? "\u53EF\u6536" : on.canWater ? "\u5F85\u6D47\u6C34" : "\u751F\u957F\u4E2D"));
      return card;
    }
    function doLesson(app, on) {
      var op = on.canPlant ? "plant" : on.canHarvest ? "harvest" : on.canWater ? "water" : null;
      if (!op || state.inflight) return;
      state.fx = null;
      state.pendingAction = { op: "onboarding", before: app.data, lessonOp: op };
      return modules.events.sendAction(app, "onboarding", { op });
    }
    function detailCard(app, root, data, on, index) {
      var plot = on ? null : data.plots[index];
      var box = modules.host.put(root, app.el("div", "fm-s-detail"));
      box.setAttribute("data-farm-detail", on ? "lesson" : String(index));
      var head = modules.host.put(box, app.el("div", "fm-s-detail-head"));
      modules.host.put(head, app.el("b", null, on ? "\u5C0F\u8471" : plot.wild ? "\u8352\u5730" : plot.empty ? "\u7A7A\u5730" : plot.label));
      modules.host.put(head, app.el("span", "fm-s-phase", on ? lessonText(on) : plot.wild ? plot.next ? "\u53EF\u5F00\u57A6" : "\u5C1A\u672A\u89E3\u9501" : plot.empty ? plot.stubble ? "\u5269\u832C" : "\u7A7A\u5730" : plot.withered ? "\u67AF\u4E86" : plot.ripe ? "\u53EF\u4EE5\u6536\u4E86" : modules.events.pestsOf(plot).length ? "\u8981\u7167\u6599 \xB7 " + modules.events.pestText(plot, "\u3001") : { seed: "\u79CD\u5B50", sprout: "\u53D1\u82BD", seedling: "\u5C0F\u82D7", growing: "\u957F\u5927", flowering: "\u5F00\u82B1" }[plot.stage] || "\u751F\u957F\u4E2D"));
      if (plot && plot.wild) {
        var order = modules.host.put(box, app.el("div", "fm-s-progress"));
        modules.host.put(order, app.el("span", null, "\u5F00\u57A6\u987A\u5E8F \xB7 " + (plot.next ? "\u4E0B\u4E00\u5757" : "\u7B2C " + (index - data.unlocked + 1) + " \u5757")));
        modules.host.put(box, app.el("small", null, plot.next ? "\u9700\u8981 " + data.reclaimPrice + " \u83DC\u5E01 \xB7 \u70B9\u6728\u724C\u5F00\u57A6" : "\u5148\u5F00\u524D\u9762 " + (index - data.unlocked) + " \u5757 \xB7 \u4EF7\u683C\u540C\u6837 " + data.reclaimPrice + " \u83DC\u5E01"));
        return box;
      }
      var progress = Math.max(0, Math.min(1, on ? on.progress : plot.progress || 0));
      var line = modules.host.put(box, app.el("div", "fm-s-progress"));
      line.setAttribute("data-farm-progress", String(Math.round(progress * 100)));
      modules.host.put(line, app.el("span", null, "\u751F\u957F\u8FDB\u5EA6"));
      var track = modules.host.put(line, app.el("span", "fm-s-track"));
      modules.host.put(track, app.el("i")).style.width = Math.round(progress * 100) + "%";
      var text = on ? on.canPlant ? "\u8BFE\u5185" + on.seed.label + " \xD7" + on.seed.count : on.canHarvest ? "\u70B9\u4E3B\u6309\u94AE\u6536\u83B7" : on.canWater ? "\u6D47\u6C34\u540E 2 \u5206\u949F\u6210\u719F" : "\u8FD8\u5269 " + modules.events.shortTime(on.remainingMs) : plot.empty ? "\u5148\u9009\u79CD\u5B50 / \u53BB\u5546\u5E97\u4E70" : plot.ripe ? "\u6536 " + plot.yield + " \u4E2A \xB7 \u7B49\u4E3B\u6309\u94AE" : plot.withered ? "\u7528\u94C1\u9539\u94F2\u6389" : (plot.helper && data.helper && data.helper.continuous ? "\u5E2E\u5DE5\u7167\u6599 \xB7 " : "") + "\u8FD8\u5269 " + modules.events.shortTime(plot.remainingMs);
      modules.host.put(box, app.el("small", null, text));
      return box;
    }
    function renderGarden(app, data) {
      var big = app.mode === "big";
      var root = app.el("div", big ? "fm fm-big" : "fm");
      root.setAttribute("data-scroll-page", big ? "farm-large" : "farm");
      if (big) root.setAttribute("data-scroll-key", "farm-large:page");
      var panel = typeof app.content.closest === "function" ? app.content.closest(".dp-card") : null;
      if (panel && parseFloat(panel.style.maxHeight) < 450) root.setAttribute("data-farm-compact", "true");
      var lesson = lessonOf(data), on = state.selectedPlot === null ? lesson : null, shown = Math.min(big ? data.total - (lesson ? 1 : 0) : lesson ? state.SMALL_PLOTS - 1 : state.SMALL_PLOTS, data.total);
      var all = modules.events.survey(data, 0, data.unlocked);
      var action = on ? lessonAction(on) : mainAction(data, modules.events.survey(data, state.selectedPlot === null ? 0 : state.selectedPlot, state.selectedPlot === null ? shown : state.selectedPlot + 1));
      var focus = state.selectedPlot === null ? action.plot : state.selectedPlot;
      if (focus === void 0) {
        focus = 0;
        for (var at = 0; at < shown; at += 1) if (data.plots[at] && !data.plots[at].empty) {
          focus = at;
          break;
        }
      }
      var head = modules.host.put(root, app.el("div", "fm-s-header"));
      header(app, data, big, head);
      if (!big && app.header) {
        root.setAttribute("data-farm-integrated", "true");
        while (head.firstChild) app.header.appendChild(head.firstChild);
      }
      var body = big ? modules.host.put(root, app.el("div", "fm-b-body")) : root;
      var stage = big ? modules.host.put(body, app.el("div", "fm-b-stage")) : body;
      modules.host.put(stage, app.el("div", "fm-s-goal", goalText(data, all)));
      var scene = modules.host.put(stage, modules.host.paint(app.el("div", "fm-s-scene"), modules.host.paper(app, big ? "paper-garden-wide" : "paper-garden-background")));
      var field = modules.host.put(scene, app.el("div", "fm-s-field"));
      field.setAttribute("data-farm-grid", big ? "expanded" : "compact");
      if (lesson) modules.host.put(field, lessonTile(app, lesson));
      for (var index = 0; index < shown; index += 1) {
        var card = modules.host.put(field, plotCard(app, data, index, big ? "big" : "small"));
        if (!on && focus === index) {
          card.setAttribute("data-farm-next", "true");
          card.setAttribute("data-farm-target", "true");
        }
      }
      if (state.fx && state.fx.lesson && !on) {
        scene.setAttribute("data-farm-fx", state.fx.kind);
        scene.style.setProperty("--fm-fx-delay", -(Date.now() - state.fx.at) + "ms");
      }
      var noteFrom = shown;
      if (!big && data.unlocked > noteFrom) {
        var rest = modules.events.survey(data, noteFrom, data.unlocked);
        var parts = [[rest.ripe, " \u5757\u719F\u4E86"], [rest.pests, " \u5757\u8981\u7167\u6599"], [rest.withered, " \u5757\u67AF\u4E86"], [rest.empty, " \u5757\u7A7A\u7740"]].filter(function(p) {
          return p[0].length;
        }).map(function(p) {
          return p[0].length + p[1];
        });
        modules.host.put(stage, app.el("div", "fm-s-note", "\u53E6\u5916 " + (data.unlocked - noteFrom) + " \u5757\u5730\uFF1A" + (parts.join("\uFF0C") || "\u90FD\u5728\u957F")));
      }
      var side = big ? modules.host.put(body, app.el("div", "fm-b-controls")) : stage;
      var detail = detailCard(app, side, data, on, focus);
      var plank = modules.host.put(side, app.el("div", "fm-s-plank"));
      if (!action.shop && !action.idle) {
        detail.setAttribute("data-has-action", "true");
        var row = modules.host.put(detail, app.el("div", "fm-s-acts"));
        var main = modules.host.put(row, app.button("dp-mini fm-main", { "data-farm-main": action.lesson ? "onboarding" : action.op || (action.shop ? "shop" : "idle") }, function() {
          if (action.lesson) return doLesson(app, on);
          if (action.shop) return modules.events.goShop(app, "seed");
          if (!action.idle) modules.events.act(app, action.plot, action.fx, action.op, action.payload);
        }));
        modules.host.put(main, app.el("span", null, action.label));
        modules.host.put(main, app.el("small", null, state.inflight ? "\u5904\u7406\u4E2D\u2026" : action.sub || ""));
        main.disabled = action.idle === true || !!state.inflight;
        if (state.inflight) main.setAttribute("aria-busy", "true");
      }
      if (big) metaRow(app, data, side);
      dock(app, data, side);
      if (state.drawerOpen) renderDrawer(app, data, side);
      modules.commerce.renderLayers(app, data, root);
      if (state.tip && state.tipPlot == null && Date.now() - state.tipAt < 2400) renderTip(app, root);
      app.content.appendChild(root);
      return root;
    }
    function renderTip(app, box) {
      var node = modules.host.put(box, app.el("div", "fm-toast", state.tip));
      node.setAttribute("role", "status");
      node.style.animationDelay = "-" + Math.max(0, Date.now() - state.tipAt) + "ms";
    }
    return { reclaimSign, plotCard, plotLabel, levelBadge, metaRow, toolSlot, careCount, fertCount, allTools, renderDrawer, dock, header, mainAction, lessonOf, lessonText, lessonAction, goalText, lessonTile, doLesson, detailCard, renderGarden, renderTip };
  }

  // src/extensions/farm/client/render-commerce.js
  function createFarmCommerceRenderer(state, modules) {
    function product(app, item, className) {
      if (item.category !== "seed") return modules.host.img(app, className, itemArt(item), item.emoji);
      var packet = modules.host.bg(app, app.el("span", className + " fm-packet"), "seed-packet");
      modules.host.put(packet, modules.host.img(app, null, itemArt(item), item.emoji));
      return packet;
    }
    function itemArt(item) {
      return item.key.indexOf("helper-") === 0 ? "tab-icon-helper" : item.key.indexOf("fert-") === 0 ? item.key : item.category === "tool" ? "tool-" + item.key : "produce-" + item.key;
    }
    function shopItems(data) {
      return data.shelf.items.map(function(entry) {
        var seed = modules.events.seedOf(data, entry.key), tool = data.tools.find(function(item) {
          return item.key === entry.key;
        });
        return Object.assign({}, entry, seed || {}, { label: entry.label, category: seed ? "seed" : tool ? "tool" : entry.key.indexOf("helper-") === 0 ? "helper" : "fert", owned: tool && tool.owned });
      });
    }
    function tileNode(app, spec) {
      var node = app.button("dp-tile fm-tile" + (spec.soft === false ? "" : " dp-tile-soft"), spec.data || {}, function() {
        spec.onPick();
      });
      node.setAttribute("data-color", spec.color || "green");
      if (spec.locked) node.setAttribute("data-locked", "true");
      if (spec.dim) node.setAttribute("data-dim", "true");
      var icon = modules.host.put(node, app.el("span", "dp-tile-icon"));
      if (spec.art) modules.host.put(icon, spec.art);
      else modules.host.put(icon, app.el("span", "dp-tile-e", spec.emoji || "\u{1F331}"));
      if (spec.badge) modules.host.put(icon, app.el("b", "dp-tile-badge", spec.badge));
      modules.host.put(node, app.el("span", "dp-tile-n", spec.label));
      if (spec.note) modules.host.put(node, app.el("span", "dp-tile-note", spec.note));
      return node;
    }
    function emptyTile(app, text, extra) {
      var node = app.el("div", "fm-note", text);
      if (extra) extra.forEach(function(child) {
        modules.host.put(node, child);
      });
      return node;
    }
    function helperToggle(app, panel, enabled) {
      var toggle = modules.host.put(panel, app.button("dp-btn fm-helper-card fm-helper-toggle", {
        type: "button",
        role: "switch",
        "aria-checked": String(enabled),
        "aria-label": enabled ? "\u6682\u505C\u5E2E\u5DE5\u6258\u7BA1" : "\u5F00\u542F\u5E2E\u5DE5\u6258\u7BA1",
        "data-farm-helper-toggle": "true"
      }, function() {
        if (state.inflight) return;
        modules.events.rememberScroll(app, modules.events.pageKey(app));
        modules.events.sendAction(app, "toggleHelper", { enabled: !enabled });
      }));
      var toggleCopy = modules.host.put(toggle, app.el("span", "fm-helper-toggle-copy"));
      modules.host.put(toggleCopy, app.el("b", null, "\u6258\u7BA1\u5F00\u5173 \xB7 " + (enabled ? "\u5F00\u542F\u4E2D" : "\u6682\u505C\u4E2D")));
      modules.host.put(toggleCopy, app.el("small", null, "\u63A7\u5236\u6574\u4E2A\u5E2E\u5DE5\u6258\u7BA1"));
      var switchTrack = modules.host.put(toggle, app.el("span", "fm-helper-switch"));
      switchTrack.setAttribute("aria-hidden", "true");
      modules.host.put(switchTrack, app.el("i"));
      toggle.disabled = !!state.inflight;
      return toggle;
    }
    function helperStorage(app, panel, helper) {
      var storage = modules.host.put(panel, app.el("div", "fm-helper-card fm-helper-storage"));
      var storageCopy = modules.host.put(storage, app.el("div", "fm-helper-copy"));
      modules.host.put(storageCopy, app.el("b", null, "\u5E2E\u5DE5\u4ED3"));
      modules.host.put(storageCopy, app.el("small", null, helper.stored > 0 ? helper.stored + " \u4E2A\u5F85\u9886\u53D6 \xB7 \u5E93\u5B58\u4F1A\u4FDD\u7559" : "\u6682\u65F6\u6CA1\u6709\u5F85\u9886\u53D6"));
      if (helper.stored > 0) modules.host.put(storage, modules.host.button(app, "fm-helper-action", { "data-farm-helper-storage": "open" }, "\u53BB\u80CC\u5305", function() {
        modules.events.goBag(app, "crop");
      }));
      return storage;
    }
    function helperFooter(app, panel, enabled) {
      modules.host.put(panel, app.el("small", "fm-helper-footer", enabled ? "\u5E2E\u5DE5\u7167\u6599\u3001\u6536\u83B7\u540E\u5165\u4ED3\u5E76\u6309\u73B0\u6709\u79CD\u5B50\u8865\u79CD\uFF1B\u4F5C\u7269\u6309\u539F\u65F6\u95F4\u81EA\u7136\u751F\u957F\u3002" : "\u6682\u505C\u65F6\u7167\u6599\u3001\u6536\u83B7\u4E0E\u8865\u79CD\u505C\u6B62\uFF1B\u4F5C\u7269\u81EA\u7136\u751F\u957F\uFF0C\u5E2E\u5DE5\u4ED3\u5E93\u5B58\u4ECD\u53EF\u9886\u53D6\u3002"));
    }
    function helperStatus(app, panel, title, note, enabled) {
      var status = modules.host.put(panel, app.el("div", "fm-helper-card fm-helper-status"));
      var main = modules.host.put(status, app.el("div", "fm-helper-status-main"));
      modules.host.put(main, modules.host.img(app, "fm-helper-status-icon", "tab-icon-helper"));
      var copy = modules.host.put(main, app.el("div", "fm-helper-copy"));
      modules.host.put(copy, app.el("b", null, title));
      modules.host.put(copy, app.el("small", null, note));
      var badge = modules.host.put(status, app.el("span", "fm-helper-badge", enabled ? "\u6B63\u5728\u6258\u7BA1" : "\u5DF2\u6682\u505C"));
      badge.setAttribute("data-enabled", String(enabled));
      return status;
    }
    function renderHelperSingle(app, data, box, items) {
      var helper = data.helper, enabled = helper.enabled === true;
      var panel = modules.host.put(box, app.el("section", "fm-helper-panel"));
      panel.setAttribute("aria-label", "\u5E2E\u5DE5\u6258\u7BA1");
      helperStatus(app, panel, "\u5E2E\u5DE5\u732A", "\u5DF2\u96C7\u7528 \xB7 \u7BA1 " + helper.plots + " \u5757\u5730", enabled);
      helperToggle(app, panel, enabled);
      var upgrade = items.find(function(item) {
        return item.key === "helper-level";
      });
      if (upgrade) {
        var upgradeCard = modules.host.put(panel, app.el("div", "fm-helper-card fm-helper-upgrade"));
        var upgradeHead = modules.host.put(upgradeCard, app.el("div", "fm-helper-card-head"));
        modules.host.put(upgradeHead, app.el("b", "fm-helper-label", "\u5E2E\u5DE5\u5347\u7EA7"));
        modules.host.put(upgradeHead, app.el("span", "fm-helper-price", upgrade.price.toLocaleString("zh-CN") + " \u83DC\u5E01"));
        modules.host.put(upgradeCard, app.el("small", "fm-helper-desc", "\u4E0B\u4E00\u6863\uFF1A" + upgrade.label + " \xB7 " + upgrade.note));
        var upgradeButton = modules.host.put(upgradeCard, modules.host.button(app, "fm-helper-action", { "data-farm-item": upgrade.key, "aria-label": "\u67E5\u770B\u5E2E\u5DE5\u5347\u7EA7" }, "\u67E5\u770B\u5347\u7EA7", function() {
          modules.events.rememberScroll(app, modules.events.pageKey(app));
          state.purchase = upgrade;
          state.quantity = 1;
          state.modalReturn = { attr: "data-farm-item", value: upgrade.key };
          app.rerender();
        }));
        upgradeButton.setAttribute("aria-disabled", String(!!upgrade.disabled));
      }
      helperStorage(app, panel, helper);
      helperFooter(app, panel, enabled);
    }
    function renderHelperCrew(app, data, box, items) {
      var helper = data.helper, enabled = helper.enabled === true, workers = helper.workers;
      var max = helper.max || 5;
      var patrol = workers.filter(function(worker) {
        return worker.role === "patrol";
      }).length;
      var harvest = workers.length - patrol;
      var panel = modules.host.put(box, app.el("section", "fm-helper-panel"));
      panel.setAttribute("aria-label", "\u5E2E\u5DE5\u6258\u7BA1");
      helperStatus(
        app,
        panel,
        "\u5E2E\u5DE5 " + workers.length + "/" + max,
        "\u6536\u83DC " + harvest + " \u53EA \xB7 \u5DE1\u903B " + patrol + " \u53EA \xB7 \u5171\u7BA1 " + helper.plots + " \u5757\u5730",
        enabled
      );
      var list = modules.host.put(panel, app.el("div", "fm-helper-workers"));
      list.setAttribute("role", "list");
      list.setAttribute("aria-label", "\u5E2E\u5DE5\u5217\u8868");
      workers.forEach(function(worker) {
        var row = modules.host.put(list, app.el("div", "fm-helper-worker"));
        row.setAttribute("role", "listitem");
        row.setAttribute("data-farm-helper-worker", String(worker.id));
        modules.host.put(row, app.el("b", "fm-helper-worker-id", "#" + worker.id));
        var badge = modules.host.put(row, app.el("span", "fm-role-badge", worker.roleLabel || (worker.role === "patrol" ? "\u5DE1\u903B" : "\u6536\u83DC")));
        badge.setAttribute("data-role", worker.role === "patrol" ? "patrol" : "harvest");
        modules.host.put(row, app.el("span", "fm-helper-worker-plots", worker.role === "patrol" ? "\u4E0D\u5360\u5730" : "\u6536 " + (worker.plotCount || 0) + " \u5757"));
        var target = worker.role === "patrol" ? "harvest" : "patrol";
        var button = modules.host.put(row, modules.host.button(app, "fm-role-btn", {
          type: "button",
          "data-farm-role": target,
          "data-farm-helper-id": String(worker.id),
          "aria-label": "\u628A #" + worker.id + " \u5E2E\u5DE5\u6539\u6210" + (target === "harvest" ? "\u6536\u83DC" : "\u5DE1\u903B"),
          "aria-disabled": String(!!state.inflight)
        }, target === "harvest" ? "\u6539\u6536\u83DC" : "\u6539\u5DE1\u903B", function() {
          if (state.inflight) return;
          modules.events.rememberScroll(app, modules.events.pageKey(app));
          modules.events.setRole(app, worker.id, target);
        }));
        button.disabled = !!state.inflight;
      });
      if (helper.plots === 0) modules.host.put(panel, app.el("small", "fm-helper-warning", "\u6CA1\u6709\u6536\u83DC\u5E2E\u5DE5\uFF0C\u83DC\u4E0D\u4F1A\u81EA\u52A8\u6536"));
      helperToggle(app, panel, enabled);
      var additional = items.find(function(item) {
        return item.key === "helper-additional";
      });
      if (additional) {
        var hireCard = modules.host.put(panel, app.el("div", "fm-helper-card"));
        var hireHead = modules.host.put(hireCard, app.el("div", "fm-helper-card-head"));
        modules.host.put(hireHead, app.el("b", "fm-helper-label", "\u518D\u96C7\u4E00\u53EA\u5E2E\u5DE5\u732A"));
        modules.host.put(hireHead, app.el("span", "fm-helper-price", additional.price.toLocaleString("zh-CN") + " \u83DC\u5E01"));
        modules.host.put(hireCard, app.el("small", "fm-helper-desc", "\u9ED8\u8BA4\u6536\u83DC 4 \u5757\u5730\uFF0C\u96C7\u6765\u540E\u53EF\u968F\u65F6\u6539\u6210\u5DE1\u903B\u3002"));
        var hireButton = modules.host.put(hireCard, modules.host.button(app, "fm-helper-action", { "data-farm-item": additional.key, "aria-label": "\u8FFD\u52A0\u96C7\u4F63\u5E2E\u5DE5\u732A" }, "\u53BB\u96C7\u4F63", function() {
          if (state.inflight) return;
          modules.events.rememberScroll(app, modules.events.pageKey(app));
          state.purchase = additional;
          state.quantity = 1;
          state.modalReturn = { attr: "data-farm-item", value: additional.key };
          app.rerender();
        }));
        hireButton.setAttribute("aria-disabled", String(!!state.inflight || !!additional.disabled));
        hireButton.disabled = !!state.inflight;
      }
      helperStorage(app, panel, helper);
      helperFooter(app, panel, enabled);
    }
    function renderHelperControls(app, data, box, items) {
      if (Array.isArray(data.helper.workers) && data.helper.workers.length) return renderHelperCrew(app, data, box, items);
      return renderHelperSingle(app, data, box, items);
    }
    function renderShop(app, data, box) {
      var wallet = modules.host.put(box, app.el("div", "fm-shop-wallet"));
      modules.host.put(wallet, modules.host.img(app, "fm-shop-coin", "coin-veg"));
      modules.host.put(wallet, app.el("span", null, "\u83DC\u5E01 " + data.balance));
      var tabs = modules.host.put(box, app.el("div", "fm-tabs"));
      tabs.setAttribute("role", "tablist");
      [["seed", "\u79CD\u5B50"], ["tool", "\u5DE5\u5177"], ["fert", "\u80A5\u6599"], ["helper", "\u5E2E\u5DE5"]].forEach(function(tab) {
        var node = modules.host.put(tabs, modules.host.bg(app, app.button("dp-btn fm-tab", { role: "tab", "data-farm-tab": tab[0], "aria-selected": String(state.shopTab === tab[0]) }, function() {
          modules.events.rememberScroll(app, modules.events.pageKey(app));
          state.shopTab = tab[0];
          app.rerender();
        }), state.shopTab === tab[0] ? "shop-tab-active" : "shop-tab"));
        modules.host.put(node, modules.host.img(app, null, "tab-icon-" + tab[0]));
        modules.host.put(node, app.el("span", null, tab[1]));
      });
      var items = shopItems(data);
      if (state.shopTab === "helper" && data.helper && data.helper.hired) renderHelperControls(app, data, box, items);
      var crew = data.helper && data.helper.hired && Array.isArray(data.helper.workers) && data.helper.workers.length > 0;
      var visibleItems = items.filter(function(item) {
        if (item.category !== state.shopTab) return false;
        if (!(state.shopTab === "helper" && data.helper && data.helper.hired)) return true;
        return item.key !== "helper-level" && !(crew && item.key === "helper-additional");
      });
      if (visibleItems.length) {
        var grid = modules.host.put(box, app.el("div", "dp-tiles fm-tiles"));
        grid.setAttribute("role", "tabpanel");
        grid.setAttribute("data-scroll-key", "farm-shop:" + state.shopTab);
        visibleItems.sort(function(a, b) {
          return Number(a.disabled) - Number(b.disabled);
        }).forEach(function(item) {
          var seed = modules.events.seedOf(data, item.key);
          var note = item.price + " \u83DC\u5E01" + (item.locked ? " \xB7 \u9700\u8981 " + item.level + " \u7EA7" : item.owned ? " \xB7 \u5DF2\u62E5\u6709" : item.disabled ? " \xB7 \u83DC\u5E01\u4E0D\u8DB3" : "");
          modules.host.put(grid, tileNode(app, {
            color: { seed: "green", tool: "blue", fert: "teal", helper: "purple" }[item.category],
            emoji: item.emoji,
            art: product(app, item, "fm-product"),
            label: item.label,
            note,
            badge: seed && seed.count > 0 ? "\xD7" + seed.count : "",
            locked: item.locked,
            dim: !!item.disabled,
            data: { "data-farm-item": item.key, "aria-disabled": String(!!item.disabled) },
            onPick: function() {
              modules.events.rememberScroll(app, modules.events.pageKey(app));
              state.purchase = item;
              state.quantity = 1;
              state.modalReturn = { attr: "data-farm-item", value: item.key };
              app.rerender();
            }
          }));
        });
      }
    }
    function renderBag(app, data, box) {
      var tabs = modules.host.put(box, app.el("div", "fm-tabs fm-tabs-3"));
      tabs.setAttribute("role", "tablist");
      [["seed", "\u79CD\u5B50"], ["crop", "\u852C\u83DC"], ["item", "\u9053\u5177"]].forEach(function(tab) {
        modules.host.put(tabs, app.button("dp-btn fm-tab", { role: "tab", "data-farm-bag-tab": tab[0], "aria-selected": String(state.bagTab === tab[0]) }, function() {
          modules.events.rememberScroll(app, modules.events.pageKey(app));
          state.bagTab = tab[0];
          app.rerender();
        })).appendChild(app.el("span", null, tab[1]));
      });
      if (data.helper && data.helper.stored > 0) modules.host.put(box, modules.host.button(app, "dp-mini", { "data-farm-helper": "collect" }, "\u628A\u5E2E\u5DE5\u4ED3\u5E93\u7684 " + data.helper.stored + " \u4E2A\u642C\u8FDB\u6765", function() {
        modules.events.sendAction(app, "collect", {});
      }));
      var crops = data.harvest.filter(function(crop) {
        return crop.count > 0;
      });
      var worth = crops.reduce(function(sum, crop) {
        return sum + crop.count * crop.sell;
      }, 0);
      if (state.bagTab === "crop" && crops.length) {
        var bar = modules.host.put(box, app.el("div", "fm-bag-tools"));
        modules.host.put(bar, app.el("span", "fm-note", "\u852C\u83DC\u5171\u503C " + worth + " \u83DC\u5E01"));
        modules.host.put(bar, modules.host.button(app, "dp-mini", { "data-farm-sell-everything": "true" }, "\u5168\u90E8\u5356\u6389 " + data.currency.emoji + " " + worth, function() {
          state.openCrop = null;
          app.send("sell", { item: "*" });
        }));
      }
      var grid = modules.host.put(box, app.el("div", "dp-tiles fm-tiles"));
      grid.setAttribute("role", "tabpanel");
      grid.setAttribute("data-scroll-key", "farm-bag:" + state.bagTab);
      if (state.bagTab === "seed") {
        var seeds = data.seeds.filter(function(seed) {
          return seed.count > 0;
        });
        if (!seeds.length) {
          modules.host.put(grid, emptyTile(app, "\u8FD8\u6CA1\u6709\u79CD\u5B50\uFF0C\u53BB\u5546\u5E97\u770B\u770B\u3002", [modules.host.button(app, "dp-mini", { "data-farm-shop": "seed" }, "\u53BB\u4E70\u79CD\u5B50", function() {
            modules.events.goShop(app, "seed");
          })]));
          return;
        }
        seeds.forEach(function(seed) {
          modules.host.put(grid, tileNode(app, {
            color: "green",
            art: product(app, { key: seed.key, category: "seed", emoji: seed.emoji }, "fm-product"),
            label: seed.label,
            badge: "\xD7" + seed.count,
            data: { "data-farm-seed": seed.key, "aria-pressed": String(state.hand.kind === "seed" && state.hand.key === seed.key) },
            onPick: function() {
              state.hand = { kind: "seed", key: seed.key };
              state.popup = null;
              app.rerender();
            }
          }));
        });
        return;
      }
      if (state.bagTab === "crop") {
        if (!crops.length) {
          modules.host.put(grid, emptyTile(app, "\u8FD8\u6CA1\u6709\u6536\u6210\u3002"));
          return;
        }
        crops.forEach(function(item) {
          var open = state.openCrop === item.key;
          modules.host.put(grid, tileNode(app, {
            color: "orange",
            art: product(app, item, "fm-product"),
            label: item.label,
            note: "\u5356 " + item.sell + "/\u4E2A",
            badge: "\xD7" + item.count,
            data: { "data-farm-crop": item.key, "aria-expanded": String(open), "aria-label": item.label + " " + item.count + " \u4E2A" },
            onPick: function() {
              state.openCrop = open ? null : item.key;
              app.rerender();
            }
          }));
          if (!open) return;
          var sell = modules.host.put(grid, app.el("div", "fm-sellbar"));
          modules.host.put(sell, app.el("span", "fm-note", item.label + " \xB7 \u4E00\u4E2A\u5356 " + item.sell));
          modules.host.put(sell, modules.host.button(app, "dp-mini", { "data-farm-sell": item.key }, "\u5356\u4E00\u4E2A", function() {
            app.send("sell", { item: item.key });
          }));
          if (item.count > 1) modules.host.put(sell, modules.host.button(app, "dp-mini", { "data-farm-sell-all": item.key }, "\u5168\u5356 " + data.currency.emoji + " " + item.count * item.sell, function() {
            state.openCrop = null;
            app.send("sell", { item: item.key, count: item.count });
          }));
          if (item.food) modules.host.put(sell, modules.host.button(app, "dp-mini dp-mini-plain", { "data-farm-store": item.key }, "\u653E\u8FDB\u80CC\u5305 \xB7 " + item.foodLabel, function() {
            app.send("store", { item: item.key });
          }));
        });
        return;
      }
      var ferts = data.fert.filter(function(fert) {
        return fert.count > 0;
      });
      ferts.forEach(function(item) {
        modules.host.put(grid, tileNode(app, {
          color: "teal",
          art: modules.host.img(app, "fm-product", item.key, "\u{1F9EA}"),
          label: item.label,
          note: "\u591A\u957F " + item.hours + " \u5C0F\u65F6",
          badge: "\xD7" + item.count,
          data: { "data-farm-fert": item.key, "aria-pressed": String(state.hand.kind === "fert" && state.hand.key === item.key) },
          onPick: function() {
            state.hand = { kind: "fert", key: item.key };
            state.popup = null;
            modules.events.say(app, "\u70B9\u6B63\u5728\u957F\u7684\u5730\u65BD" + item.label);
          }
        }));
      });
      data.tools.filter(function(tool) {
        return tool.owned;
      }).forEach(function(tool) {
        modules.host.put(grid, tileNode(app, {
          color: "blue",
          art: modules.host.img(app, "fm-product", "tool-" + tool.key, "\u{1F9F0}"),
          label: tool.label,
          note: "\u5DF2\u62E5\u6709 \xB7 \u5DE5\u5177\u91CC\u7528",
          data: { "data-farm-owned-tool": tool.key },
          onPick: function() {
            state.drawerOpen = true;
            state.popup = null;
            app.rerender();
          }
        }));
      });
      if (!ferts.length && !data.tools.some(function(tool) {
        return tool.owned;
      })) modules.host.put(grid, emptyTile(app, "\u8FD8\u6CA1\u6709\u80A5\u6599\u6216\u9053\u5177\u3002", [modules.host.button(app, "dp-mini", { "data-farm-shop": "fert" }, "\u53BB\u4E70\u80A5\u6599", function() {
        modules.events.goShop(app, "fert");
      })]));
    }
    function modal(app, root, className, cancel) {
      state.cancelLayer = cancel;
      var mask = modules.host.put(root, app.el("div", "fm-mask"));
      mask.addEventListener("click", function(event) {
        if (event.target === mask) {
          event.stopPropagation();
          cancel();
        }
      });
      var box = modules.host.put(mask, modules.host.frame(app, app.el("div", className)));
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("data-scroll-key", "farm-dialog:" + (state.purchase ? state.purchase.key : "clear"));
      return box;
    }
    function modalButtons(app, box, run, cancel, disabled) {
      var row = modules.host.put(box, app.el("div", "fm-modal-buttons"));
      modules.host.put(row, modules.host.bg(app, modules.host.button(app, "dp-mini fm-confirm", { "data-farm-confirm": "true" }, "\u786E\u5B9A", run), "btn-confirm")).disabled = !!disabled;
      modules.host.put(row, modules.host.bg(app, modules.host.button(app, "fm-cancel", { "data-farm-cancel": "true" }, "\u53D6\u6D88", cancel), "btn-cancel"));
    }
    function renderPurchase(app, data, root) {
      var item = state.purchase;
      var cancel = function() {
        modules.events.rememberScroll(app, modules.events.pageKey(app));
        state.purchase = null;
        app.rerender();
      };
      var box = modal(app, root, "fm-buy", cancel);
      box.setAttribute("aria-label", item.label);
      modules.host.put(box, modules.host.bg(app, app.el("b", "fm-title", item.label), "buy-title"));
      var columns = modules.host.put(box, app.el("div", "fm-buy-columns"));
      modules.host.put(columns, product(app, item, "fm-buy-art"));
      var info = modules.host.put(columns, app.el("div", "fm-buy-info"));
      var rows = item.category === "seed" ? [["\u6210\u719F\u65F6\u95F4", item.hours + " \u5C0F\u65F6"], ["\u80FD\u6536\u51E0\u5B63", item.seasons + " \u5B63"], ["\u9884\u8BA1\u4EA7\u91CF", item.yield + " \u4E2A / \u5B63"], ["\u679C\u5B9E\u552E\u4EF7", item.sell + " \u83DC\u5E01 / \u4E2A"], ["\u9884\u8BA1\u6536\u5165", item.yield * item.sell * item.seasons + " \u83DC\u5E01"], ["\u6536\u83B7\u7ECF\u9A8C", item.exp + " / \u5B63"], ["\u9700\u8981\u7B49\u7EA7", item.level + " \u7EA7"]] : [["\u8BF4\u660E", item.note]];
      rows.forEach(function(row) {
        modules.host.put(info, modules.host.bg(app, app.el("div", "fm-info-row", row[0] + "\u3000" + row[1]), "info-row"));
      });
      var many = item.category === "seed" || item.category === "fert";
      var stepper = modules.host.put(box, app.el("div", "fm-stepper"));
      modules.host.put(stepper, app.el("span", null, "\u6570\u91CF"));
      modules.host.put(stepper, modules.host.bg(app, modules.host.button(app, "fm-step", { "data-farm-quantity": "minus", "aria-label": "\u51CF\u5C11\u6570\u91CF" }, "\u2212", function() {
        state.quantity = Math.max(1, state.quantity - 1);
        app.rerender();
      }), "stepper-minus")).disabled = !many || state.quantity === 1;
      var field = modules.host.put(stepper, modules.host.bg(app, app.el("input", "fm-quantity"), "stepper-field"));
      field.type = "number";
      field.min = "1";
      field.max = many ? "99" : "1";
      field.value = String(state.quantity);
      field.disabled = !many;
      field.setAttribute("aria-label", "\u6570\u91CF");
      field.setAttribute("data-farm-quantity-field", "true");
      ["input", "change"].forEach(function(type) {
        field.addEventListener(type, function() {
          state.quantity = Math.max(1, Math.min(many ? 99 : 1, Math.floor(Number(field.value) || 1)));
          total.textContent = "\u603B\u4EF7 " + state.quantity * item.price + " \u83DC\u5E01";
          total.setAttribute("data-farm-total", String(state.quantity * item.price));
          box.querySelector("[data-farm-confirm]").disabled = item.disabled || state.quantity * item.price > data.balance;
          ["minus", "plus"].forEach(function(key) {
            box.querySelector('[data-farm-quantity="' + key + '"]').disabled = !many || state.quantity === (key === "minus" ? 1 : 99);
          });
          if (type === "change") field.value = String(state.quantity);
        });
      });
      modules.host.put(stepper, modules.host.bg(app, modules.host.button(app, "fm-step", { "data-farm-quantity": "plus", "aria-label": "\u589E\u52A0\u6570\u91CF" }, "+", function() {
        state.quantity = Math.min(99, state.quantity + 1);
        app.rerender();
      }), "stepper-plus")).disabled = !many || state.quantity === 99;
      var total = modules.host.put(box, app.el("div", "fm-total", "\u603B\u4EF7 " + state.quantity * item.price + " \u83DC\u5E01" + (item.price > data.balance ? " \xB7 \u83DC\u5E01\u4E0D\u8DB3" : item.level > data.level ? " \xB7 \u9700\u8981 " + item.level + " \u7EA7" : "")));
      total.setAttribute("data-farm-total", String(state.quantity * item.price));
      modalButtons(app, box, function() {
        state.pendingAction = { op: "buy", item, count: state.quantity, before: data };
        modules.events.rememberScroll(app, modules.events.pageKey(app));
        app.send("buy", { item: item.key, count: state.quantity });
        state.purchase = null;
        app.rerender();
      }, cancel, item.disabled || state.quantity * item.price > data.balance);
    }
    function pageHead(app, box, title) {
      var head = modules.host.put(box, app.el("div", "fm-page-head"));
      modules.host.put(head, modules.host.button(app, "dp-drill-back fm-page-back", { "data-farm-back": "true", "aria-label": "\u8FD4\u56DE\u83DC\u5730" }, "\u2039", function() {
        modules.events.closePage(app);
      }));
      modules.host.put(head, app.el("b", "fm-title", title));
      return head;
    }
    function renderLayers(app, data, root) {
      state.cancelLayer = null;
      if (state.popup) {
        var box = modules.host.put(root, app.el("div", "fm-pop" + (state.popup === "shop" ? " fm-shop" : "")));
        box.setAttribute("data-scroll-key", "farm-popup:" + state.popup + ":" + (state.popup === "shop" ? state.shopTab : state.popup === "bag" ? state.bagTab : "wallet"));
        box.setAttribute("data-farm-overlay", state.popup);
        modules.host.frame(app, box);
        pageHead(app, box, { shop: "\u519C\u573A\u5546\u5E97", bag: "\u80CC\u5305", wallet: "\u83DC\u5E01" }[state.popup]);
        if (state.popup === "shop") renderShop(app, data, box);
        else if (state.popup === "bag") renderBag(app, data, box);
        else if (app.walletContent) modules.host.put(box, app.walletContent());
        else modules.host.put(box, app.el("div", "fm-note", "\u94B1\u5305\u5728\u8BBE\u7F6E\u91CC\u3002"));
      }
      if (state.purchase) renderPurchase(app, data, root);
      if (state.confirmClear !== null) {
        var index = state.confirmClear, cancel = function() {
          modules.events.rememberScroll(app, modules.events.pageKey(app));
          state.confirmClear = null;
          app.rerender();
        };
        var box = modal(app, root, "fm-clear-confirm", cancel);
        box.setAttribute("aria-label", "\u94F2\u9664\u786E\u8BA4");
        modules.host.put(box, modules.host.bg(app, app.el("b", "fm-title", "\u94F2\u6389\u6B63\u5728\u957F\u7684" + data.plots[index].label + "\uFF1F"), "shop-title"));
        modules.host.put(box, modules.host.img(app, "fm-clear-art", "produce-" + data.plots[index].crop));
        modalButtons(app, box, function() {
          modules.events.rememberScroll(app, modules.events.pageKey(app));
          state.confirmClear = null;
          modules.events.act(app, index, "\u{1FA8F}", "clear", { plot: index, force: true });
        }, cancel);
      }
    }
    return { product, itemArt, shopItems, tileNode, emptyTile, renderHelperControls, renderShop, renderBag, modal, modalButtons, renderPurchase, pageHead, renderLayers };
  }

  // src/extensions/farm/client/entry.js
  function createFarmClient() {
    const state = createFarmState();
    const modules = {};
    modules.host = createFarmHostTools();
    modules.events = createFarmEvents(state, modules);
    modules.garden = createFarmGardenRenderer(state, modules);
    modules.commerce = createFarmCommerceRenderer(state, modules);
    function render(app) {
      modules.host.ensureStyle(app);
      const data = app.data;
      if (!data || !Array.isArray(data.plots) || !data.plots.length || data.plots[0] === null || typeof data.plots[0] !== "object") {
        app.content.appendChild(app.el("div", "dp-empty", "\u83DC\u56ED\u8FD8\u5728\u51C6\u5907\u2026\u2026"));
        return;
      }
      if (!data.currency) data.currency = { emoji: "\u{1FA99}", label: "\u91D1\u5E01" };
      state.currentApp = app;
      modules.events.bindKeyboard();
      modules.events.finishAction(app, data);
      modules.events.syncHand(data);
      modules.garden.renderGarden(app, data);
      const root = app.content.querySelector(".fm");
      if (root) {
        state.currentKey = modules.events.pageKey(app);
        if (app.mode === "big") {
          state.lastRoot = root;
          modules.events.watchScroll(root);
        } else if (!state.watchingContent) {
          state.watchingContent = true;
          modules.events.watchScroll(app.content);
        }
        modules.events.restoreScroll(app, state.currentKey);
        modules.events.syncModalFocus(app, root);
        root.addEventListener("click", function(event) {
          if (state.popup && !state.purchase && !/** @type {Element} */
          event.target.closest(".fm-pop,button,input")) modules.events.closePage(app);
        });
      }
    }
    return { render };
  }
  var client = createFarmClient();
  var extensionHost = (
    /** @type {any} */
    window
  );
  if (extensionHost.dshPiggyExtensions) extensionHost.dshPiggyExtensions.register("farm", { render: client.render });
})();
