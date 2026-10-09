// @ts-check
/**
 * 面板内部样式：页签、列表、格子、装扮点位与调试页。
 *
 * @module dsh-piggy/client/css-tabs
 */


import { button, meter } from './dom.js'

export const CSS_TABS = [
  /* ---------- developer tab ---------- */
  '.dp-dev-note{font-size:10px;color:var(--ac-text-2);margin:4px 0 2px;line-height:1.5}',
  '.dp-dev-row{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 2px}',
  '.dp-dev-btn{flex:0 0 auto;font-size:10px;padding:3px 8px}',
  '.dp-on{background:var(--ac-primary);color:#fff;border-color:var(--ac-primary)}',
  '[data-dsh-pig][data-dev="true"] .dp-ico[data-tab="dev"]{color:var(--ac-primary)}',

  /* ---------- the soul that settles on an unclaimed grave ---------- */
  '.dp-soul{position:absolute;left:50%;transform:translateX(-50%);top:-4px;font-size:22px;',
  'line-height:1;opacity:.9;pointer-events:none;z-index:1;',
  'animation:dp-haunt 3.4s ease-in-out infinite}',
  '@keyframes dp-haunt{0%,100%{transform:translate(-50%,0) scale(1);opacity:.75}',
  '50%{transform:translate(-50%,-9px) scale(1.08);opacity:1}}',
  // A grave does not bob about like a living pig.
  '.dp-pig[data-stage="grave"]{animation:none;filter:grayscale(.35) drop-shadow(0 4px 6px rgba(61,52,40,.3))}',
  '.dp-pig[data-stage="grave"][data-feedback="true"]{filter:none}',
  '.dp-pig[data-stage="box"]{animation:dp-box-wobble 3.2s ease-in-out infinite}',
  '@keyframes dp-box-wobble{0%,100%{transform:rotate(0)}30%{transform:rotate(-4deg)}',
  '45%{transform:rotate(3deg)}60%{transform:rotate(-2deg)}}',

  // 摸头时先压扁再轻轻回弹；保留短时长，连续点击也能每次从头播放。
  '[data-dsh-pig] .dp-pig[data-react="pet"]{animation-name:dp-squash;animation-duration:.42s}',
  '@keyframes dp-squash{0%,100%{transform:translateY(0) scale(1)}',
  '16%{transform:translateY(1px) scale(1.04,.95)}38%{transform:translateY(3px) scale(1.14,.82)}',
  '67%{transform:translateY(-4px) scale(.95,1.09)}84%{transform:translateY(0) scale(1.04,.97)}}',

  /* ---------- speech bubble ---------- */
  // `z-index` matters: the pig comes later in the DOM, so without it the pig
  // paints over the bubble whenever the two boxes overlap — which is exactly
  // what happened when collapsed and the scene was only as wide as the pig.
  // 气泡钉在猪头上：右边和猪的右边对齐（场景左右各 6px 内边距，猪贴着它），底边在猪头上方 10px，
  // 尾巴指着猪头正中。收起/打开、面板朝左/朝右都是这一个位置（用户 2026-10-04：「不要飘来飘去」）。
  '.dp-bubble{position:absolute;right:6px;left:auto;top:auto;bottom:calc(var(--pig-gap-below) + var(--pig-size) + 10px);',
  'z-index:2;width:max-content;max-width:calc(var(--panel-width) - 24px);box-sizing:border-box;padding:6px 10px;',
  'border-radius:var(--ac-radius-sm);font-size:10.5px;font-weight:600;line-height:1.45;',
  'color:var(--ac-text-body);background:var(--ac-bg-input);',
  'border:2px solid var(--ac-border-light);box-shadow:var(--ac-shadow-sm)}',
  '.dp-bubble-text{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;',
  'overflow:hidden;white-space:normal;overflow-wrap:anywhere}',
  // Tail drawn as a small rotated square so the 2px border stays continuous.
  '.dp-bubble::after{content:"";position:absolute;left:auto;right:calc(var(--pig-size) / 2 - 5px);top:100%;bottom:auto;',
  'margin-top:-4px;width:8px;height:8px;',
  'background:var(--ac-bg-input);border-right:2px solid var(--ac-border-light);',
  'border-bottom:2px solid var(--ac-border-light);transform:rotate(45deg)}',
  '[data-dsh-pig][data-panel-side="right"] .dp-bubble{right:auto;left:6px}',
  '[data-dsh-pig][data-panel-side="right"] .dp-bubble::after{right:auto;left:calc(var(--pig-size) / 2 - 5px)}',
  // Reply buttons under a line: small pills, the mint of the primary colour
  // without the 3D base, which the spec keeps for real primary buttons.
  '.dp-bubble-replies{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}',
  // 猪头上的日常气泡（签到 / 礼包）：不用新颜色，沿用主色与卡片底色。
  // 挂在场景**上方**（不是 top 边缘）：折叠时场景就是猪本身，用 top:-6px
  // 会让气泡叠在猪头上（用户反馈 #6）。
  '.dp-daily{position:absolute;bottom:calc(100% + 7px);left:50%;width:36px;margin-left:-18px;',
  'font:inherit;font-size:15px;line-height:1;padding:3px 0;cursor:pointer;text-align:center;',
  'border:2px solid var(--ac-border);border-radius:50px;background:var(--ac-bg-input);',
  'box-shadow:0 3px 0 rgba(61,52,40,.14);animation:dp-daily-bob 2.4s var(--ac-ease) infinite}',
  // 折叠时场景就剩猪本身（而且它还在上下浮动 ±7px），再多让开一点。
  '[data-dsh-pig][data-open="false"] .dp-daily{bottom:calc(100% + 16px)}',
  // 展开时场景有面板那么宽、那么高，挂在场景上方会压到图标栏（B8 截图里压在「商店」上）：
  // 改成蹲在猪左边、贴着猪身子（再高会碰到左边的名字框）。
  '[data-dsh-pig][data-open="true"] .dp-daily{left:auto;margin-left:0;',
  'right:calc(6px + var(--pig-size) + 10px);bottom:calc(var(--pig-gap-below) + var(--pig-size) / 2 - 18px)}',
  // 桌面版面板朝右开时猪在左端：日历跟着镜像到猪右边。
  '[data-dsh-pig][data-panel-side="right"][data-open="true"] .dp-daily{right:auto;left:calc(6px + var(--pig-size) + 10px)}',
  '.dp-daily:hover{border-color:var(--ac-border-hover)}',
  '.dp-daily:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}',
  // 名字必须独占：叫 dp-bob 会覆盖猪的待机动画（css-base.js），
  // 而那个动画的 transform 一被替掉，猪就会横跳半个身位。
  // 只上下浮：横向居中改用 margin，展开时才能挪到猪旁边。
  '@keyframes dp-daily-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
  // 收起时礼包按钮也在猪头上方：猪说话时先藏起来，和番茄钟角标一样，不跟气泡抢位置。
  '[data-dsh-pig][data-open="false"]:has(.dp-bubble:not([hidden])) .dp-daily{visibility:hidden}',
  // 日记：折叠时只有首句，展开是全文。
  '.dp-diary{cursor:pointer}',
  '.dp-diary[data-open="true"] .dp-diary-full{display:block}',
  '.dp-diary-full{margin-top:4px;line-height:1.5}',
  '.dp-reply{font:inherit;font-size:10px;font-weight:700;padding:2px 9px;cursor:pointer;',
  'border-radius:var(--ac-pill);border:2px solid var(--ac-border-light);background:var(--ac-bg);',
  'color:var(--ac-text);transition:border-color .15s var(--ac-ease)}',
  '.dp-reply:hover{border-color:var(--ac-border-hover)}',
  '.dp-reply:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}',

  /* ---------- icon bar: the library sidebar, laid on its side ---------- */
  '.dp-bar{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:8px;',
  'background:var(--ac-bg-content);border-top:2px solid var(--ac-border-light);',
  'border-bottom:2px solid var(--ac-border-light)}',
  '.dp-ico{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;',
  'font:inherit;font-size:9.5px;font-weight:600;color:var(--ac-text-muted);background:none;',
  'border:2px solid transparent;border-radius:var(--ac-radius-sm);padding:5px 1px;',
  'transition:all .2s var(--ac-ease)}',
  '.dp-ico span.dp-ico-e{font-size:18px;line-height:1}',
  '.dp-ico:hover{background:var(--ac-hover)}',
  '.dp-ico[data-active="true"]{background:var(--ac-active);border-color:#9db0d6;',
  'color:var(--ac-text);font-weight:700}',
  '.dp-ico:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}',
  '@keyframes dp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}',
  '.dp-ico[data-alert="true"] span.dp-ico-e{animation:dp-pulse 1.4s ease-in-out infinite}',

  /* ---------- content ---------- */
  '.dp-content{padding:12px 13px 13px;overflow-y:auto;flex:1 1 auto;min-height:0}',
  '[data-dsh-pig] .dp-panel-footer[hidden]{display:none}',
  '.dp-panel-footer{flex:none;max-height:min(42vh,270px);overflow-y:auto;padding:10px 13px 12px;',
  'border-top:2px solid var(--ac-border-light);background:var(--ac-bg)}',
  '.dp-panel-footer .dp-job-detail{margin:0}',
  '.dp-content::-webkit-scrollbar{width:8px}',
  '.dp-content::-webkit-scrollbar-thumb{background:var(--ac-border-light);border-radius:4px}',
  '.dp-content::-webkit-scrollbar-track{background:transparent}',
  '.dp-title{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;',
  'margin-bottom:8px}',
  '.dp-title b{font-weight:700;color:var(--ac-text)}',
  '.dp-title span{color:var(--ac-text-2);font-size:10.5px;font-weight:600}',
  '.dp-row{display:flex;justify-content:space-between;font-size:11px;font-weight:600;',
  'color:var(--ac-text-body);margin:2px 0}',
  '.dp-row b{font-weight:700;color:var(--ac-text)}',

  /* ---------- attribute bars: pill track with an inset well ---------- */
  '.dp-meter{height:9px;border-radius:var(--ac-pill);background:var(--ac-bg-disabled);',
  'box-shadow:var(--ac-inset);overflow:hidden;margin:3px 0 8px}',
  '.dp-meter i{display:block;height:100%;border-radius:var(--ac-pill);',
  'background:var(--ac-warning);transition:width .35s var(--ac-ease)}',
  '.dp-meter.dp-mood i{background:#f8a6b2}',
  '.dp-meter.dp-clean i{background:#82d5bb}',
  '.dp-meter.dp-health i{background:#8ac68a}',
  '.dp-traits{display:flex;gap:10px;font-size:10.5px;font-weight:600;color:var(--ac-text-2);',
  'margin:8px 0 3px}',

  /* ---------- banners ---------- */
  '.dp-alert{margin:0 0 9px;padding:8px 10px;border-radius:var(--ac-radius-sm);',
  'font-size:10.5px;font-weight:600;line-height:1.55;border:2px solid}',
  '.dp-alert b{font-weight:700;color:var(--ac-text)}',
  '.dp-alert.dp-sick{background:#fdeeee;border-color:#f2c2c2}',
  '.dp-alert.dp-work{background:#eef1fb;border-color:#c3cdf0}',
  '.dp-alert.dp-dead{background:var(--ac-bg-disabled);border-color:var(--ac-border-light)}',
  '.dp-alert.dp-legacy{background:#fdf7e2;border-color:#f0dfa8}',

  /* ---------- buttons: secondary is a cream pill with soft elevation ---- */
  '.dp-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}',
  '.dp-btn{display:flex;align-items:center;justify-content:center;gap:5px;font:inherit;',
  'font-size:11px;font-weight:700;letter-spacing:.02em;color:var(--ac-text-body);',
  'cursor:pointer;padding:8px 6px;border-radius:var(--ac-pill);',
  'border:2px solid var(--ac-border);background:var(--ac-bg-input);',
  'box-shadow:var(--ac-shadow-sm);transition:all .2s var(--ac-ease)}',
  '.dp-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--ac-shadow);',
  'border-color:var(--ac-border-hover)}',
  '.dp-btn:active:not(:disabled){transform:translateY(2px);box-shadow:var(--ac-shadow-sm)}',
  '.dp-btn:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}',
  '.dp-btn:disabled{background:var(--ac-bg-disabled);color:var(--ac-text-disabled);',
  'border-color:var(--ac-border-light);box-shadow:none;cursor:not-allowed}',
  '.dp-btn-wide{grid-column:1/-1}',
  '.dp-btn .dp-wait{color:var(--ac-text-2);font-size:10px;font-weight:600}',

  /* ---------- settings inputs ---------- */
  '.dp-size-control{display:flex;align-items:center;width:max-content;gap:8px;margin:4px 0 8px}',
  '.dp-size-step{width:34px;height:34px;border:1px solid var(--ac-border-light);border-radius:10px;',
  'background:var(--ac-bg-input);color:var(--ac-text-body);font:inherit;font-size:20px;cursor:pointer}',
  '.dp-size-step:hover{border-color:var(--ac-primary);color:var(--ac-primary)}',
  '.dp-size-percent{display:flex;align-items:center;gap:3px;color:var(--ac-text-muted)}',
  '.dp-size-value{width:64px;text-align:center;appearance:textfield;border:0;border-bottom:1px solid var(--ac-border-light);',
  'background:transparent;color:var(--ac-text-body);font:inherit;font-size:15px;padding:5px 0}',
  '.dp-size-value::-webkit-inner-spin-button,.dp-size-value::-webkit-outer-spin-button{appearance:none;margin:0}',
  '.dp-size-value:focus{outline:none;border-color:var(--ac-primary)}',
  '.dp-proxy-form{display:grid;gap:10px;margin:4px 0 12px}',
  '.dp-setting-field{width:100%;box-sizing:border-box;font:inherit;font-size:11px;color:var(--ac-text-body);',
  'background:var(--ac-bg-input);border:1px solid var(--ac-border-light);border-radius:9px;padding:8px 10px}',
  '.dp-setting-field:focus{outline:2px solid var(--ac-primary);outline-offset:1px}',
  '.dp-proxy-endpoint{display:grid;gap:5px;font-size:10px}',
  '.dp-proxy-endpoint[hidden]{display:none}',
  '.dp-proxy-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.dp-proxy-actions .dp-mini{border-radius:8px;box-shadow:none;padding:6px 10px;font-size:10px}',
  '.dp-proxy-actions .dp-proxy-save{background:var(--ac-primary);border-color:var(--ac-primary);color:#fff}',
  '.dp-proxy-actions .dp-proxy-clear{margin-left:auto;border-color:transparent;background:transparent;color:var(--ac-text-muted)}',
  '.dp-proxy-status{font-size:10px;line-height:1.5;margin-top:9px;color:var(--ac-text-muted);overflow-wrap:anywhere}',
  '.dp-proxy-actions .dp-proxy-test{background:transparent;border-color:var(--ac-border-light);color:var(--ac-text-body)}',
  '.dp-proxy-error{color:var(--ac-error)}',

  /* ---------- segmented control ---------- */
  '.dp-seg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:9px}',
  '.dp-seg button{font:inherit;font-size:10.5px;font-weight:600;color:var(--ac-text-muted);',
  'cursor:pointer;padding:6px 2px;border-radius:var(--ac-pill);',
  'border:2px solid var(--ac-border-light);background:var(--ac-bg-input);',
  // One line, always: a label that wraps makes its button taller than the rest.
  'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
  'transition:all .2s var(--ac-ease)}',
  // The work tab has three skills, not four stages.
  '.dp-seg.dp-seg-3{grid-template-columns:repeat(3,minmax(0,1fr))}',
  // Work rows: two small buttons on the right, 详情 opens the checklist below.
  '.dp-job-locked{opacity:.75}',
  '.dp-job-detail{margin-top:-2px}',
  '.dp-req{font-size:10.5px;font-weight:600;color:var(--ac-error);line-height:1.6}',
  '.dp-req.dp-req-ok{color:var(--ac-success)}',

  /* ---------- list rows ---------- */
  // minmax(0,1fr): a long nowrap line must ellipsize, not widen the panel.
  '.dp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}',
  '.dp-list{display:flex;flex-direction:column;gap:7px}',
  '.dp-shelf{margin:9px 0 1px;font-size:10px;font-weight:700;color:var(--ac-text-2);',
  'letter-spacing:.04em}',
  '.dp-shelf:first-child{margin-top:0}',
  '.dp-item{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;',
  'color:var(--ac-text-body);padding:7px 9px;border-radius:var(--ac-radius-sm);',
  'background:var(--ac-bg-content);border:2px solid var(--ac-border-light)}',
  '.dp-item .dp-grow{flex:1;min-width:0}',
  '.dp-item .dp-dim{color:var(--ac-text-2);font-size:10px;font-weight:500;overflow:hidden;',
  'text-overflow:ellipsis;white-space:nowrap}',
  '.dp-item.dp-wanted{background:#fdf7e2;border-color:var(--ac-warning)}',
  // B6 talk row: name + 改 + 免打扰, and the inline name input.
  '.dp-talk{gap:6px;margin-top:8px}',
  '.dp-talk>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dp-mini.dp-mini-plain{background:var(--ac-bg-input);color:var(--ac-text);border:2px solid var(--ac-border-light);box-shadow:none}',
  '.dp-mini.dp-mini-plain:hover:not(:disabled){background:var(--ac-hover)}',
  '.dp-input{flex:1;min-width:0;font:inherit;font-size:11px;padding:3px 8px;border-radius:var(--ac-pill);',
  'border:2px solid var(--ac-border);background:var(--ac-bg-input);color:var(--ac-text)}',
  '.dp-input:focus{outline:2px solid var(--ac-primary);outline-offset:1px}',

  /* ---------- primary buttons: teal pill with the game 3D bottom edge --- */
  '.dp-mini{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.02em;color:#fff;',
  'cursor:pointer;padding:6px 13px;border-radius:var(--ac-pill);',
  'border:2px solid var(--ac-primary-active);background:var(--ac-primary);',
  'box-shadow:0 3px 0 0 var(--ac-primary-active);transition:all .15s var(--ac-ease)}',
  '.dp-mini:hover:not(:disabled){background:var(--ac-primary-hover);transform:translateY(-1px);',
  'box-shadow:0 4px 0 0 var(--ac-primary-active)}',
  '.dp-mini:active:not(:disabled){transform:translateY(2px);',
  'box-shadow:0 1px 0 0 var(--ac-primary-active)}',
  '.dp-mini:focus-visible{outline:2px solid var(--ac-primary);outline-offset:2px}',
  '.dp-mini:disabled{background:var(--ac-bg-disabled);color:var(--ac-text-disabled);',
  'border-color:var(--ac-border-light);box-shadow:none;cursor:not-allowed}',

  /* ---------- the care item picker ---------- */
  '.dp-pick{margin-top:9px;padding:9px 10px;border-radius:var(--ac-radius-sm);font-size:10.5px;',
  'background:var(--ac-bg-content);border:2px solid var(--ac-border-light)}',
  '.dp-pick-head{font-size:10.5px;font-weight:700;color:var(--ac-text);margin-bottom:7px}',
  '.dp-cancel{display:block;width:100%;margin-top:8px;font:inherit;font-size:10.5px;',
  'font-weight:600;color:var(--ac-text-2);cursor:pointer;padding:5px;',
  'border-radius:var(--ac-pill);border:2px solid var(--ac-border-light);',
  'background:var(--ac-bg-input);transition:all .2s var(--ac-ease)}',
  '.dp-cancel:hover{background:var(--ac-hover);color:var(--ac-text)}',
  '.dp-count{margin-left:2px;font-size:9px;font-weight:700;color:var(--ac-text-2);',
  'background:var(--ac-bg-content);border-radius:var(--ac-pill);padding:0 5px}',
  '.dp-btn[data-open-picker="true"]{background:var(--ac-active);border-color:#9db0d6}',
  '.dp-seg button[data-locked="true"]{color:var(--ac-text-disabled);',
  'border-style:dashed;background:var(--ac-bg-disabled)}',
  '.dp-seg button[data-locked="true"]:hover{background:var(--ac-bg-disabled)}',
  '.dp-locked{margin:0 0 8px;font-size:10.5px;font-weight:600;line-height:1.5;',
  'color:var(--ac-text-body);background:#fdf7e2;border:2px solid #f0dfa8;',
  'border-radius:var(--ac-radius-sm);padding:6px 9px}',
  // The per-job gate reads as a lock, not as another grey stat line: a
  // threshold the pig cannot see is indistinguishable from a broken button.
  '.dp-lock{font-size:10px;font-weight:700;line-height:1.5;color:#9a6b1f}',

  '.dp-empty{color:var(--ac-text-2);font-size:10.5px;font-weight:500;line-height:1.65;',
  'margin-top:4px}',
  '.dp-memo{margin-top:9px;padding-top:8px;border-top:2px solid var(--ac-border-light);',
  'color:var(--ac-text-muted);font-size:10px;font-weight:500;line-height:1.55;',
  'white-space:pre-wrap;word-break:break-word}',

  /* ---------- particles and toast ---------- */
  '.dp-transform{position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden}',
  '.dp-transform-fall{position:absolute;top:-48px;font-size:28px;opacity:0;',
  'animation:dp-transform-fall 1.35s var(--delay) ease-in forwards}',
  '@keyframes dp-transform-fall{0%{opacity:0;transform:translate3d(0,-20px,0) rotate(-15deg)}',
  '12%{opacity:1}100%{opacity:0;transform:translate3d(var(--drift),105vh,0) rotate(30deg)}}',
  '.dp-transform-pop{position:absolute;font-size:72px;line-height:1;filter:drop-shadow(0 3px 8px #fff);',
  'animation:dp-transform-pop 1.3s ease-out forwards}',
  '@keyframes dp-transform-pop{0%{opacity:0;transform:translate(-50%,-50%) scale(.15)}',
  '35%{opacity:1;transform:translate(-50%,-50%) scale(1.25)}',
  '70%{opacity:1;transform:translate(-50%,-50%) scale(1)}',
  '100%{opacity:0;transform:translate(-50%,-50%) scale(1.1)}}',
  '.dp-fx{position:absolute;z-index:1;pointer-events:none;font-size:17px;',
  'animation:dp-rise 1.1s ease-out forwards}',
  '@keyframes dp-rise{0%{opacity:0;transform:translate(var(--dx0,0),4px) scale(.5)}18%{opacity:1}',
  '100%{opacity:0;transform:translate(var(--dx,0),-56px) scale(1.15)}}',
  // 提示条插在面板最上面、把内容往下推，不再浮在面板上压住标题和第一排图标（用户 2026-10-05 反馈）。
  '.dp-toast{position:relative;flex:none;margin:8px 9px 0;padding:8px 11px;box-sizing:border-box;overflow:hidden;',
  'border-radius:var(--ac-radius-sm);font-size:10.5px;font-weight:600;line-height:1.5;',
  'color:var(--ac-text);background:var(--ac-bg-input);border:2px solid var(--ac-border);',
  'box-shadow:var(--ac-shadow);pointer-events:none;white-space:normal;',
  'animation:dp-toast 4.6s var(--ac-ease) forwards}',
  '@keyframes dp-toast{0%{opacity:0;max-height:0;margin-top:0;padding-top:0;padding-bottom:0}',
  '7%{opacity:1;max-height:72px;margin-top:8px;padding-top:8px;padding-bottom:8px}',
  '86%{opacity:1;max-height:72px;margin-top:8px;padding-top:8px;padding-bottom:8px}',
  '100%{opacity:0;max-height:0;margin-top:0;padding-top:0;padding-bottom:0;border-width:0}}',
].join('')
