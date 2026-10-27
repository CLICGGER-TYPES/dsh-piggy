// @ts-check
/**
 * 外部桌宠的样式：设置卡片、连接标签、弹层里的选择行和字段。
 *
 * 只用 --ac-* 变量和现有零件（dp-set / dp-actions / dp-btn / dp-mini / dp-alert），
 * 不新造按钮画风，也不加宽面板。
 * @module dsh-piggy/client/external-css
 */

export const CSS_EXTERNAL = [
  /* ---------- panel link bar: one strip above the app content ---------- */
  '.dp-link{display:flex;align-items:center;gap:6px;margin:0 12px 8px;padding:5px 9px;',
  'border-radius:var(--ac-radius-sm);border:2px solid var(--ac-border-light);background:var(--ac-bg-content);',
  'font-size:10.5px;font-weight:700;color:var(--ac-text);line-height:1.4}',
  '.dp-link[hidden]{display:none}',
  '.dp-link-dot{flex:none;font-size:9px;line-height:1}',
  '.dp-link[data-link="connected"]{border-color:#bfe8dc;background:#eefaf6}',
  '.dp-link[data-link="connected"] .dp-link-dot{color:var(--ac-primary)}',
  '.dp-link[data-link="connecting"] .dp-link-dot,',
  '.dp-link[data-link="reconnecting"] .dp-link-dot,',
  '.dp-link[data-link="disconnected"] .dp-link-dot{color:var(--ac-warning)}',
  '.dp-link[data-link="merging"] .dp-link-dot{color:var(--ac-primary)}',
  '.dp-link[data-dead="true"]{border-color:var(--ac-border);color:var(--ac-text-2)}',
  '.dp-link-note{margin:0 12px 8px;padding:5px 9px;border-radius:var(--ac-radius-sm);',
  'background:var(--ac-bg-disabled);border:2px solid var(--ac-border-light);',
  'font-size:9.5px;line-height:1.5;color:var(--ac-text-2)}',
  '.dp-link-note[hidden]{display:none}',
  '.dp-link-note .dp-mini{margin-top:4px}',
  // 外部模式断线且没有快照：不摆内嵌纸盒，猪占位去色并收起互动提示。
  '[data-dsh-pig][data-external-offline="true"] .dp-pig-emoji{filter:grayscale(.7) opacity(.55)}',
  '[data-dsh-pig][data-external-offline="true"] .dp-hud{opacity:.75}',
  // 断线/合并中：动作看起来就是不能用的（真正的拦截在 io.js，导航和返回保持正常）。
  '[data-dsh-pig][data-link="disconnected"] .dp-content button:not(.dp-drill-back):not(.dp-home-dot):not(.dp-seg-btn):not(.dp-tile):not([data-home]):not([data-skin-guide]){opacity:.55}',
  '[data-dsh-pig][data-link="reconnecting"] .dp-content button:not(.dp-drill-back):not(.dp-home-dot):not(.dp-seg-btn):not(.dp-tile):not([data-home]):not([data-skin-guide]){opacity:.55}',
  '[data-dsh-pig][data-link="merging"] .dp-content button:not(.dp-drill-back):not(.dp-home-dot):not(.dp-seg-btn):not(.dp-tile):not([data-home]):not([data-skin-guide]){opacity:.55}',

  /* ---------- settings card ---------- */
  '.dp-ext-card .dp-set-head small{flex-basis:auto}',
  '.dp-ext-state{display:block;font-size:10.5px;line-height:1.5;color:var(--ac-text-2);margin-top:2px}',
  '.dp-ext-state[data-tone="ok"]{color:var(--ac-text)}',
  '.dp-ext-state[data-tone="warn"]{color:var(--ac-text-2)}',
  '.dp-ext-card-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}',
  '.dp-ext-card-actions .dp-mini,.dp-ext-card-actions .dp-btn{justify-content:center;width:100%}',
  '.dp-ext-card-actions .dp-btn-wide{grid-column:1 / -1}',

  /* ---------- overlay dialog ---------- */
  '.dp-ext-dialog .dp-ext-title{display:block;font-size:13px;color:var(--ac-text);margin:0 0 2px}',
  '.dp-ext-sub{margin:0 0 8px;font-size:10.5px;line-height:1.5}',
  '.dp-ext-row{margin:3px 0}',
  '.dp-ext-row small{flex-basis:auto}',
  '.dp-ext-row b{font-size:11px;min-width:58px}',
  '.dp-ext-note{display:block;margin:6px 0 0;font-size:10px;line-height:1.55;color:var(--ac-text-2)}',
  '.dp-ext-warn{margin:8px 0 0;font-size:10.5px}',
  '.dp-ext-actions{margin-top:12px}',
  '.dp-ext-actions .dp-btn,.dp-ext-actions .dp-mini{justify-content:center;width:100%}',
  '.dp-ext-block{display:block;margin:8px 0 0;padding:8px 10px;border-radius:var(--ac-radius-sm);',
  'border:2px solid var(--ac-border-light);background:var(--ac-bg-input)}',
  '.dp-ext-block b{display:block;font-size:11px;color:var(--ac-text)}',
  '.dp-ext-block small{display:block;margin-top:2px;font-size:10px;line-height:1.5;color:var(--ac-text-2)}',
  '.dp-ext-block-actions{display:flex;gap:6px;margin-top:6px}',
  '.dp-ext-block-actions .dp-mini,.dp-ext-block-actions .dp-btn{flex:1;justify-content:center;font-size:10px;padding:4px 6px}',

  /* ---------- radio cards (two pigs / identity / conflicts) ---------- */
  '.dp-ext-choice{display:flex;align-items:flex-start;gap:6px;width:100%;box-sizing:border-box;margin:6px 0 0;',
  'padding:7px 9px;font:inherit;text-align:left;cursor:pointer;color:var(--ac-text);',
  'border:2px solid var(--ac-border-light);border-radius:var(--ac-radius-sm);background:var(--ac-bg-input);',
  'transition:border-color .15s var(--ac-ease),background-color .15s var(--ac-ease)}',
  '.dp-ext-choice:hover{border-color:var(--ac-border-hover)}',
  '.dp-ext-choice[aria-pressed="true"]{border-color:var(--ac-primary);background:var(--ac-primary-bg)}',
  '.dp-ext-choice:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}',
  '.dp-ext-choice-dot{flex:none;font-size:10px;line-height:1.5;color:var(--ac-primary)}',
  '.dp-ext-choice-copy{display:flex;flex-direction:column;min-width:0}',
  '.dp-ext-choice-copy b{font-size:10.5px;line-height:1.45}',
  '.dp-ext-choice-copy small{font-size:9.5px;line-height:1.45;color:var(--ac-text-2)}',
  '.dp-ext-group{margin-top:10px;padding-top:8px;border-top:1.5px dashed var(--ac-border-light)}',
  '.dp-ext-group-head{display:flex;align-items:center;gap:6px;margin-bottom:2px}',
  '.dp-ext-group-head b{font-size:11px}',
  '.dp-ext-group-head small{font-size:9.5px;color:var(--ac-text-2)}',
  '.dp-ext-group-head .dp-mini{margin-left:auto;flex:none;font-size:9.5px;padding:2px 8px}',
  '.dp-ext-inline{display:flex;gap:4px;margin-top:4px}',
  '.dp-ext-inline .dp-ext-choice{flex:1;margin:0;justify-content:center;padding:5px 4px}',
  '.dp-ext-inline .dp-ext-choice-copy{align-items:center}',
  '.dp-ext-inline .dp-ext-choice-dot{display:none}',

  /* ---------- fields ---------- */
  '.dp-ext-field{display:block;margin:6px 0 0}',
  '.dp-ext-field-label{display:block;font-size:9.5px;font-weight:700;color:var(--ac-text-2);margin-bottom:2px}',
  '.dp-ext-select{appearance:auto}',
  '.dp-ext-counter{display:block;margin-top:1px;font-size:9px;color:var(--ac-text-muted);text-align:right}',
  '.dp-ext-checks{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}',
  '.dp-ext-checks .dp-mini{font-size:9.5px;padding:3px 8px}',
  '.dp-ext-flag{display:block;margin-top:3px;font-size:9.5px;line-height:1.45;color:var(--ac-warning,#c0503f)}',
  '.dp-ext-result{display:block;margin:6px 0 0;font-size:12px;font-weight:800;color:var(--ac-text);line-height:1.5}',
  '.dp-ext-result small{display:block;font-size:10px;font-weight:600;color:var(--ac-text-2)}',
  '.dp-ext-list{margin:4px 0 0;padding:0;list-style:none}',
  '.dp-ext-list li{position:relative;padding-left:10px;font-size:9.5px;line-height:1.5;color:var(--ac-text-2)}',
  '.dp-ext-list li::before{content:"·";position:absolute;left:2px}',
  '.dp-ext-count{font-size:9.5px;color:var(--ac-text-muted)}',
].join('')
