// @ts-check
/**
 * 方块页（学习 / 商店 / 背包）的样式 —— B8，照动森手机主屏：
 * 3 列彩色圆角大方块、大图标、方块下面一行小字；点进去整屏换成同色浅一档的小方块。
 *
 * 配色取 animal-island-ui 的 app 方块色（docs/design-system/design-tokens.md），
 * 声明在组件根节点上，不碰宿主页面的 :root。
 * @module dsh-piggy/client/css-tiles
 */

export const CSS_TILES = [
  // 番茄钟角标（C2 返工）：贴在猪立绘右上角，跟着猪一起动。
  // 高度 = 13 + 2 = 15px，再往上 2px，所以顶多高出猪头 17px（要求 20px 以内）；
  // z-index:4 高于装扮层（3）：戴帽子时帽子会压住角标（用户反馈「有东西挡住了」）。
  // 角标挂在猪立绘里（猪有 transform 动画，自成一层），这个层级只跟装扮比，不会盖到面板上；
  // 猪说话时角标先藏起来，不跟气泡抢位置。
  '.dp-pomo{position:absolute;bottom:calc(100% + 2px);right:-4px;z-index:4;',
  'font-size:9.5px;font-weight:800;color:#fff;background:var(--tile-red);',
  'border-radius:var(--ac-pill);padding:1px 5px;line-height:13px;white-space:nowrap;pointer-events:none;',
  'box-shadow:0 2px 0 rgba(61,52,40,.16)}',
  '.dp-pomo-live{display:flex;flex-direction:column;align-items:center;gap:3px;margin:6px 0 10px}',
  '.dp-pomo-clock{font-size:26px;font-weight:800;color:var(--ac-text);letter-spacing:1px}',

  // 主屏底部的版本号：一行灰字，不占格子（连点 7 次解锁调试模式，见 C1）。
  '.dp-version{margin-top:8px;text-align:center;font-size:9.5px;font-weight:600;',
  'color:var(--ac-text-muted);cursor:default;user-select:none}',
  '[data-dsh-pig]{--tile-pink:#f8a6b2;--tile-purple:#b77dee;--tile-blue:#889df0;',
  '--tile-yellow:#f7cd67;--tile-orange:#e59266;--tile-teal:#82d5bb;--tile-green:#8ac68a;',
  '--tile-red:#fc736d;--tile-lime:#d1da49;--tile-peach:#e18c6f;--tile-brown:#9a835a}',
  '.dp-tile[data-color="pink"]{--tile-c:var(--tile-pink)}',
  '.dp-tile[data-color="purple"]{--tile-c:var(--tile-purple)}',
  '.dp-tile[data-color="blue"]{--tile-c:var(--tile-blue)}',
  '.dp-tile[data-color="yellow"]{--tile-c:var(--tile-yellow)}',
  '.dp-tile[data-color="orange"]{--tile-c:var(--tile-orange)}',
  '.dp-tile[data-color="teal"]{--tile-c:var(--tile-teal)}',
  '.dp-tile[data-color="green"]{--tile-c:var(--tile-green)}',
  '.dp-tile[data-color="red"]{--tile-c:var(--tile-red)}',
  '.dp-tile[data-color="lime"]{--tile-c:var(--tile-lime)}',
  '.dp-tile[data-color="peach"]{--tile-c:var(--tile-peach)}',
  '.dp-tile[data-color="brown"]{--tile-c:var(--tile-brown)}',

  // The grid: three columns that can never be widened by their content.
  '.dp-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 8px;padding:4px 2px 2px}',
  '.dp-home-clip{overflow:hidden;touch-action:pan-y}.dp-home-track{display:flex;transition:transform .25s ease;will-change:transform}',
  '.dp-home-page{box-sizing:border-box;flex:0 0 100%;grid-template-rows:repeat(3,72px);align-content:start}.dp-home-page[data-active="false"]{pointer-events:none}',
  '.dp-home-dots{display:flex;justify-content:center;gap:8px;margin:9px 0 2px}.dp-home-dot{width:9px;height:9px;padding:0;border:1.5px solid var(--ac-primary);border-radius:50%;background:transparent;cursor:pointer}.dp-home-dot[aria-pressed="true"]{background:var(--ac-primary)}',
  '@media (prefers-reduced-motion:reduce){.dp-home-track{transition:none}}',

  // A tile is a column: the coloured square, then its name, then a note.
  '.dp-tile{font:inherit;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;',
  'padding:0;margin:0;border:0;background:none;cursor:pointer;color:var(--ac-text)}',
  '.dp-tile-icon{position:relative;display:flex;align-items:center;justify-content:center;',
  'width:50px;height:50px;border-radius:15px;background:var(--tile-c,var(--ac-bg-content));',
  'box-shadow:0 3px 0 rgba(61,52,40,.16);transition:transform .15s var(--ac-ease),box-shadow .15s var(--ac-ease)}',
  '.dp-tile-e{font-size:24px;line-height:1;filter:drop-shadow(0 1px 1px rgba(61,52,40,.18))}',
  '.dp-tile-svg{width:27px;height:27px;object-fit:contain}',
  '.dp-app-title{display:inline-flex;align-items:center;gap:5px}',
  '.dp-app-title-icon{font-size:14px;line-height:1}',
  '.dp-app-title-icon.dp-tile-svg{width:17px;height:17px}',
  '.dp-setting-row{margin-top:8px}',
  // 状态页体重条：填充到现在的体重，三个刻度标理想 / 圆润 / 胖胖。
  '.dp-hint{margin:2px 0 8px;font-size:10px;line-height:1.5;color:var(--ac-text-2)}',
  // 调试页：顶上页签可横向滚动，左右箭头；每个按钮下面一行小字说明。
  '.dp-dev-nav{display:flex;align-items:center;gap:4px;margin:6px 0 8px}',
  '.dp-dev-tabs{position:relative;display:flex;gap:4px;overflow-x:auto;flex:1;scrollbar-width:none}.dp-dev-tabs::-webkit-scrollbar{display:none}',
  '.dp-dev-tab{flex:none;font:inherit;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:var(--ac-pill);cursor:pointer;',
  'border:2px solid var(--ac-border-light);background:var(--ac-bg-content);color:var(--ac-text-2)}',
  '.dp-dev-tab[aria-pressed="true"]{background:var(--ac-primary);border-color:var(--ac-primary-active);color:#fff}',
  // 一行一个：左边小按钮、右边一句说明（按钮别拉满宽）。
  '.dp-dev-list{display:flex;flex-direction:column;gap:5px;margin:4px 0 10px}',
  '.dp-dev-item{display:flex;align-items:center;gap:8px;min-width:0}',
  '.dp-dev-item .dp-dev-btn{flex:none;min-width:78px;justify-content:center;box-shadow:none}',
  '.dp-dev-desc{flex:1;min-width:0;font-size:9.5px;line-height:1.35;color:var(--ac-text-2)}',
  // 换肤「怎么做皮肤」页：两列图卡（缩略图 + 文件名 + 必须/可选 + 用途），规格和 skin.json 示例。
  '.dp-guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0 10px}',
  '.dp-guide-cell{display:grid;grid-template-columns:40px 1fr;grid-template-rows:auto auto auto;column-gap:6px;align-items:center;align-content:center;',
  'padding:6px;border-radius:var(--ac-radius-sm);border:2px solid var(--ac-border-light);background:var(--ac-bg-input)}',
  '.dp-guide-img{grid-row:1 / 4;width:40px;height:40px;object-fit:contain}.dp-guide-cell b{font-size:11px}',
  '.dp-guide-need{font-size:9.5px;font-weight:800;color:#c7781a}.dp-guide-optional .dp-guide-need{color:var(--ac-text-2)}',
  '.dp-guide-cell small{font-size:9.5px;line-height:1.35;color:var(--ac-text-2)}',
  '.dp-guide-rule{font-size:10.5px;line-height:1.6}',
  '.dp-switch-ask{display:grid;gap:6px;margin-bottom:10px}.dp-switch-ask-row{display:flex;gap:8px}',
  '.dp-guide-links{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0 10px}',
  '.dp-guide-links .dp-btn{justify-content:center;font-size:12px}',
  '.dp-guide-code{margin:4px 0;padding:6px 8px;border-radius:8px;background:var(--ac-bg-content);font-size:10px;line-height:1.5;white-space:pre-wrap}',
  // 背包顶上的状态条：两列四格 + 一行体重。
  '.dp-statstrip{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin:0 0 10px;padding:8px 10px;',
  'border-radius:var(--ac-radius-sm);background:var(--ac-bg-content);border:2px solid var(--ac-border-light)}',
  '.dp-statcell .dp-row{margin:0 0 3px;font-size:10.5px}.dp-statcell .dp-meter{height:7px}',
  '.dp-statweight{grid-column:1 / -1;font-size:10.5px;color:var(--ac-text-2)}',
  // 设置页：每项一块，标题+说明，下面一排分段按钮；开关放在标题右边。
  '.dp-set{padding:10px 0;border-bottom:1.5px dashed var(--ac-border-light)}',
  // 扩展 App：每个扩展一块，图标 + 名称 + 开关，下面一句说明；进行中的提醒用暖色小字。
  '.dp-ext-intro{font-size:10.5px;line-height:1.5;color:var(--ac-text-2);margin:0 0 4px}',
  '.dp-ext-emoji{font-size:20px;line-height:1;margin-right:2px}',
  '.dp-ext-note{margin-top:6px;font-size:10px;font-weight:700;color:#c7781a}',
  '.dp-ext-later{margin-top:12px;text-align:center;font-size:10px;color:var(--ac-text-2)}',
  '.dp-ext-section{display:flex;align-items:center;justify-content:space-between;margin:12px 2px 6px;font-size:11px;font-weight:800;color:var(--ac-text-2);letter-spacing:.04em}',
  '.dp-ext-actions{display:flex;align-items:center;justify-content:flex-start;gap:8px;margin-top:8px;flex-wrap:wrap}',
  '.dp-ext-actions .dp-switch{margin:0}',
  '.dp-ext-warn{flex-basis:100%;order:-1;font-size:10px;font-weight:700;color:#c0503f}',
  '.dp-mini.dp-ext-danger{background:#e05a5a;box-shadow:none}',
  '.dp-mini.dp-ext-remove{padding:4px 12px}',
  '.dp-mini.dp-ext-remove:hover:not(:disabled){color:#c0503f;border-color:#e3a79c}',
  '.dp-ext-card [data-ext-install]{margin-left:auto;flex:none}',
  '.dp-set:first-child{padding-top:2px}.dp-set:last-child{border-bottom:0}',
  '.dp-set-head{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px}',
  '.dp-set-head b{font-size:12px;color:var(--ac-text)}',
  // 设置行里的按钮一律挂在最右边：标题和小字占左边，右边的操作顶到卡片边缘。
  '.dp-set-head>.dp-mini{margin-left:auto;flex:none}',
  '.dp-set-head small{flex-basis:100%;order:3;font-size:10px;line-height:1.45}',
  '.dp-seg{display:flex;gap:4px;margin-top:8px;padding:3px;border-radius:var(--ac-pill);background:var(--ac-bg-content);',
  'border:2px solid var(--ac-border-light)}',
  '.dp-seg-btn{flex:1;min-width:0;font:inherit;font-size:11px;font-weight:700;padding:5px 0;cursor:pointer;',
  'border:0;border-radius:var(--ac-pill);background:transparent;color:var(--ac-text-2);',
  'transition:background-color .15s var(--ac-ease),color .15s var(--ac-ease)}',
  '.dp-seg-btn:hover:not(:disabled){background:var(--ac-bg-input);color:var(--ac-text)}',
  '.dp-seg-btn[aria-pressed="true"]{background:var(--ac-primary);color:#fff;cursor:default;',
  'box-shadow:0 2px 0 var(--ac-primary-active)}',
  '.dp-seg-btn:focus-visible,.dp-switch:focus-visible{outline:2px solid var(--ac-yellow, #ffcf45);outline-offset:1px}',
  '.dp-switch{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:10.5px;font-weight:700;',
  'padding:2px 8px 2px 2px;cursor:pointer;border-radius:var(--ac-pill);border:2px solid var(--ac-border-light);',
  'background:var(--ac-bg-content);color:var(--ac-text-2);transition:background-color .15s var(--ac-ease)}',
  '.dp-switch-knob{width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--ac-border-light);',
  'transition:transform .15s var(--ac-ease)}',
  '.dp-switch[aria-pressed="true"]{background:var(--ac-primary);border-color:var(--ac-primary-active);color:#fff;',
  'flex-direction:row-reverse;padding:2px 2px 2px 8px}',
  '.dp-setting-emoji{font-size:22px;line-height:1;width:28px;text-align:center}',
  '.dp-tile:hover:not(:disabled) .dp-tile-icon{transform:translateY(-2px);box-shadow:0 5px 0 rgba(61,52,40,.16)}',
  '.dp-tile:active:not(:disabled) .dp-tile-icon{transform:translateY(2px);box-shadow:0 1px 0 rgba(61,52,40,.16)}',
  '.dp-tile:focus-visible{outline:none}',
  '.dp-tile:focus-visible .dp-tile-icon{outline:2px solid var(--ac-primary);outline-offset:2px}',
  // One line each, never wrapping: every tile in a row stays the same height.
  '.dp-tile-n,.dp-tile-note{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.25}',
  '.dp-tile-n{font-size:10.5px;font-weight:700}',
  '.dp-tile-note{font-size:9.5px;font-weight:600;color:var(--ac-text-2);margin-top:-2px}',
  // Corner marks on the square: a count top-right, a word top-left.
  '.dp-tile-badge,.dp-tile-tag{position:absolute;top:-5px;font-size:9px;font-weight:800;line-height:1;',
  'padding:3px 5px;border-radius:var(--ac-pill);white-space:nowrap;border:2px solid var(--ac-bg)}',
  '.dp-tile-badge{right:-6px;background:var(--ac-primary);color:#fff}',
  '.dp-tile[data-app="update"] .dp-tile-badge,.dp-tile[data-app="settings"] .dp-tile-badge,.dp-update-dot{background:var(--tile-red)}',
  '.dp-tile-tag{left:-6px;background:var(--ac-warning);color:var(--ac-text)}',
  // Second layer: the same colour, a shade paler and a little smaller.
  // Sizes trimmed on 2026-10-01 (owner: the tiles were too big): 50px / 44px.
  '.dp-tile-soft .dp-tile-icon{width:44px;height:44px;border-radius:13px;',
  'background:color-mix(in srgb,var(--tile-c) 42%,#fffbe7)}',
  '.dp-tile-soft .dp-tile-e{font-size:21px}',
  // Locked: greyed but still openable (a stage can be looked into before it opens).
  '.dp-tile[data-locked="true"] .dp-tile-icon{filter:grayscale(.75);opacity:.6}',
  '.dp-tile[data-dim="true"] .dp-tile-icon,.dp-tile:disabled .dp-tile-icon{opacity:.45;box-shadow:none}',
  '.dp-tile[data-dim="true"] .dp-tile-n,.dp-tile:disabled .dp-tile-n{color:var(--ac-text-2)}',
  '.dp-tile:disabled{cursor:default}',
  '.dp-tile[data-active="true"] .dp-tile-icon{outline:3px solid var(--ac-active);outline-offset:2px}',

  // The second layer's top row: back, title, one grey line.
  '.dp-drill{position:sticky;top:-12px;z-index:5;display:flex;align-items:center;gap:7px;',
  'margin:-12px 0 10px;padding:12px 0 0;background:var(--ac-bg)}',
  '.dp-drill-back{padding:0;margin:0;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font:inherit;font-size:16px;font-weight:800;line-height:1;width:26px;height:26px;',
  'flex:none;cursor:pointer;color:var(--ac-text);border-radius:50%;',
  'border:2px solid var(--ac-border-light);background:var(--ac-bg-input)}',
  '.dp-drill-back:hover{border-color:var(--ac-border-hover)}',
  '.dp-drill-title{font-size:12px;font-weight:800;color:var(--ac-text);white-space:nowrap}',
  '.dp-drill-info{flex:1;min-width:0;text-align:right;font-size:10px;font-weight:600;',
  'color:var(--ac-text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  // B9: the home screen replaces the bottom icon bar. The bar still exists
  // (its icons carry the alert state the home tiles read) but is not shown.
  '[data-dsh-pig] .dp-card .dp-bar{display:none}',
  '.dp-app-head{margin-bottom:12px}',
  // Out working, the collapsed scene shrinks to pig + prop; open, it must stay
  // as wide as the panel, or the name plate is squeezed onto the pig.
  '[data-dsh-pig][data-open="true"][data-away] .dp-scene{width:var(--panel-width)}',
  // Banners only live on the status tab now, with room to breathe below.
  '[data-dsh-pig] .dp-alert{margin-bottom:14px}',
  '[data-dsh-pig] .dp-alert + .dp-actions{margin-bottom:14px}',
  '.dp-job-go,.dp-job-short{display:block;width:100%;margin-top:9px}',
  '.dp-job-short{margin-top:6px;font-size:.92em}',
  // A picked tile's details (a diary page, a souvenir's story) sit under the grid.
  '.dp-tile-card{margin-top:12px}',
  // 更新 App: the release notes keep their line breaks but stay short.
  '.dp-update-notes{white-space:pre-wrap;font-size:10.5px;line-height:1.5;color:var(--ac-text-2);max-height:120px;overflow:auto;margin:4px 0 6px}',
  '.dp-update-back{margin-top:10px;width:100%}',
  '.dp-update-now{margin-bottom:12px}',
  // 设置页的更新入口：小按钮右上角挂红点。
  '.dp-update-entry{position:relative;margin-left:auto}.dp-update-dot{position:absolute;top:-6px;right:-6px}',
  // 更新面板：按正式版分组的列表，测试版折叠在组里。
  '.dp-rel{border:2px solid var(--ac-border-light);border-radius:var(--ac-radius-sm);background:var(--ac-bg-input);margin:0 0 8px;overflow:hidden}',
  '.dp-rel-head{display:flex;align-items:center;gap:6px;width:100%;padding:8px 10px;border:0;background:transparent;font:inherit;cursor:pointer;text-align:left;color:var(--ac-text)}',
  '.dp-rel-head b{font-size:12px}.dp-rel-head small{color:var(--ac-text-2);font-size:10px}.dp-rel-tags{margin-left:auto;display:flex;gap:4px}',
  '.dp-rel-tag{font-size:9.5px;font-weight:800;padding:1px 6px;border-radius:var(--ac-pill);background:var(--ac-bg-content);color:var(--ac-text-2)}',
  '.dp-rel-tag[data-tag="current"]{background:#ffd65c;color:#6b4a00}.dp-rel-tag[data-tag="latest"]{background:var(--ac-primary);color:#fff}',
  '.dp-rel-body{padding:0 10px 10px}.dp-rel-pre{margin-top:6px;border-top:1.5px dashed var(--ac-border-light);padding-top:6px}',
  '.dp-rel-pre-row{display:flex;align-items:center;gap:6px;padding:4px 0;font-size:10.5px}.dp-rel-pre-row .dp-mini{margin-left:auto}',
  '.dp-update-top{display:flex;align-items:center;gap:8px}',
  '.dp-update-top .dp-pick-head{flex:1;min-width:0}',
  '.dp-update-refresh{flex:none}',
  '.dp-update-now .dp-btn,.dp-update-detail .dp-btn{width:100%;margin-top:8px}',
  '.dp-ext-shelf-note{font-size:11px;color:var(--ac-text-2);margin:6px 2px 10px}.dp-ext-goods{display:grid;gap:7px}',
  '.dp-ext-good{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 10px;border-radius:16px;background:var(--ac-bg-input);border:2px solid var(--ac-border-light)}',
  '.dp-ext-good-emoji{width:42px;height:42px;border-radius:12px;background:#fff3c4;display:grid;place-items:center;font-size:22px}',
  '.dp-ext-good-copy b{font-size:12px;color:var(--ac-text)}.dp-ext-good-copy small{display:block;font-size:10px;color:var(--ac-text-2)}',
  '.dp-ext-picks{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:5px}.dp-ext-good .dp-mini{white-space:nowrap}',
].join('')
