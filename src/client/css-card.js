// @ts-check
/**
 * 居民卡的样式（B9）—— 照 animal-island-ui 的 Card `pattern-*`：淡色底上两层点点
 * （28px / 14px 网格），1.5px 同色描边，圆角 20px；「标签：值」的值放在米白胶囊里。
 * 女孩用 pattern-app-pink，男孩用 pattern-app-blue（参数取自它的 card.module.less）。
 * @module dsh-piggy/client/css-card
 */

export const CSS_CARD = [
  '.dp-vcard{position:relative;padding:14px 14px 12px;border-radius:20px;color:var(--ac-text-body);',
  '--vc-dot:rgba(196,184,158,.15);--vc-dot2:rgba(196,184,158,.1);--vc-bg:rgb(247,243,223);--vc-line:#d4c4a8;',
  'background:radial-gradient(circle,var(--vc-dot) 1.5px,transparent 1.5px),',
  'radial-gradient(circle,var(--vc-dot2) 1px,transparent 1px),var(--vc-bg);',
  'background-size:28px 28px,14px 14px;background-position:0 0,7px 7px;border:1.5px solid var(--vc-line)}',

  // Top: the photo and who it is.
  '.dp-vcard-top{display:flex;align-items:center;gap:12px;margin-bottom:12px}',
  '.dp-vcard-avatar{flex:none;width:72px;height:72px;border-radius:18px;display:flex;align-items:center;',
  'justify-content:center;background:#fffbe7;border:2px solid var(--vc-line);box-shadow:0 3px 0 rgba(61,52,40,.12)}',
  '.dp-vcard-img{width:56px;height:56px;display:block}',
  '.dp-vcard-e{font-size:40px;line-height:1}',
  '.dp-vcard-who{display:flex;flex-direction:column;gap:3px;min-width:0}',
  '.dp-vcard-name{font-size:15px;font-weight:800;color:var(--ac-text);white-space:normal;overflow-wrap:anywhere;line-height:1.35}',
  // 名字旁边的蜡笔：平时藏着，鼠标移到名字这行才出来；没有鼠标的设备一直淡淡显示。
  '.dp-vcard-nameline{display:flex;align-items:center;gap:6px;min-width:0}',
  '.dp-vcard-name-edit{width:22px;height:22px;font-size:11px}',
  // 名字、叫你、口头禅、签名：笔平时藏着，鼠标移到那一行才出来（rc.1 反馈）。
  '.dp-vcard-nameline .dp-vcard-edit,.dp-vcard-row .dp-vcard-edit{opacity:0;transition:opacity .15s}',
  // 笔浮在输入框右端、不占宽度：生日、星座这些没有笔的行和叫你、口头禅、签名一样长（rc.3 反馈）。
  '.dp-vcard-row{position:relative}.dp-vcard-row .dp-vcard-edit{position:absolute;right:3px;top:50%;margin-top:-12px}',
  '.dp-vcard-row.dp-vcard-motto-row .dp-vcard-edit{top:3px;margin-top:0}',
  '.dp-vcard-nameline:hover .dp-vcard-edit,.dp-vcard-row:hover .dp-vcard-edit,.dp-vcard-edit:focus-visible{opacity:1}',
  '@media (hover:none){.dp-vcard-nameline .dp-vcard-edit,.dp-vcard-row .dp-vcard-edit{opacity:.6}}',
  '.dp-vcard-sub{font-size:10.5px;font-weight:600;color:var(--ac-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',

  // 「标签：值」 rows.
  '.dp-vcard-row{display:flex;align-items:center;gap:6px;margin-top:7px;min-width:0}',
  '.dp-vcard-once{flex-direction:column;align-items:stretch;gap:6px}.dp-vcard-once-line{display:flex;align-items:center;gap:6px}.dp-vcard-once select{flex:1;min-width:0}',
  '.dp-vcard-once .dp-vcard-date{width:52px;height:26px;border-radius:8px;padding:0 6px;text-align:center}',
  '.dp-vcard-label{flex:none;width:44px;font-size:10.5px;font-weight:700;color:var(--ac-text)}',
  '.dp-vcard-value{flex:1;min-width:0;padding:5px 11px;border-radius:var(--ac-pill);background:#faf8f2;',
  'font-size:11px;font-weight:600;color:var(--ac-text-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  // The motto is the pig talking: a bubble that may take two lines.
  '.dp-vcard-motto-row{align-items:flex-start}',
  '.dp-vcard-motto-row .dp-vcard-label{margin-top:6px}',
  '.dp-vcard-value.dp-vcard-motto{border-radius:12px;white-space:normal;line-height:1.45}',
  '.dp-vcard-edit{flex:none;font:inherit;font-size:12px;line-height:1;width:24px;height:24px;padding:0;cursor:pointer;',
  'border-radius:50%;border:2px solid var(--vc-line);background:#fffbe7}',
  '.dp-vcard-edit:hover{background:var(--ac-hover)}',
  '.dp-vcard-input{flex:1;min-width:0;padding:3px 9px;font-size:11px}',
  // 性格下拉：照 animal-island-ui Select 的触发器——奶油底、2px 暖边框、
  // 12px 圆角、自绘 chevron；列表也是自绘的黄色面板，不会在松手时消失。
  '.dp-vcard-select-wrap{position:relative;display:flex;flex:1;min-width:0}',
  '.dp-vcard-select-wrap::after{content:"";position:absolute;right:12px;top:50%;width:7px;height:7px;',
  'border-right:2px solid var(--ac-text-2);border-bottom:2px solid var(--ac-text-2);',
  'transform:translateY(-70%) rotate(45deg);pointer-events:none}',
  '.dp-vcard-row .dp-vcard-select{display:flex;align-items:center;width:100%;height:30px;box-sizing:border-box;',
  'padding:0 28px 0 12px;border:2px solid var(--ac-border-light);border-radius:12px;',
  'background:var(--ac-bg-input);color:var(--ac-text-body);font:inherit;font-size:11.5px;font-weight:700;',
  'text-align:left;cursor:pointer;transition:border-color .2s var(--ac-ease),box-shadow .2s var(--ac-ease)}',
  '.dp-vcard-row .dp-vcard-select:hover{border-color:var(--ac-border-hover)}',
  '.dp-vcard-row .dp-vcard-select:focus-visible{outline:none;border-color:var(--ac-primary);',
  'box-shadow:0 0 0 3px rgba(25,200,185,.16)}',
  '.dp-vcard-select-value{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dp-vcard-select-menu{position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:20;',
  'max-height:200px;overflow-y:auto;padding:6px;background:#ffeea0;border:2px solid #e8dcc8;',
  'border-radius:18px;box-shadow:0 6px 14px rgba(61,52,40,.16);animation:dp-vcard-menu-in .16s var(--ac-ease)}',
  '@keyframes dp-vcard-menu-in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}',
  '.dp-vcard-select-option{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;',
  'border:0;border-radius:10px;background:transparent;color:var(--ac-text-body);font:inherit;',
  'font-size:11.5px;font-weight:600;text-align:left;cursor:pointer}',
  '.dp-vcard-select-option:hover,.dp-vcard-select-option[data-active="true"]{background:rgba(255,204,0,.4);font-weight:700}',
  '.dp-vcard-select-emoji{flex:none;width:16px;text-align:center}',
  '.dp-vcard-select-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  // 生日编辑：日期框保持 50×28 的小尺寸；好/算了放得下就同行，放不下自动换行。
  '.dp-vcard-birthday{flex-wrap:wrap}',
  '.dp-vcard-date-fields{display:flex;align-items:center;gap:6px;flex:none}',
  // 保留 number 输入框的上下箭头：之前用户就是用箭头选月/日的。
  '.dp-vcard-row .dp-vcard-date{flex:0 0 50px;width:50px;height:28px;box-sizing:border-box;',
  'border-radius:9px;padding:0 4px;text-align:center;font-size:12px;font-weight:700;user-select:text}',
  '.dp-vcard-edit-actions{display:flex;gap:6px;margin-left:auto}',
  // In-place editing: the two buttons stay as small as the pencil they replace.
  '.dp-vcard-row .dp-mini,.dp-vcard-nameline .dp-mini{flex:none;padding:3px 9px;font-size:10px;box-shadow:none}',
  '[data-dsh-pig] .dp-vcard-row .dp-mini.dp-mini-plain,[data-dsh-pig] .dp-vcard-nameline .dp-mini.dp-mini-plain{background:#fffbe7;color:var(--ac-text);border:2px solid var(--vc-line);box-shadow:none}',

  '.dp-vcard-foot{margin-top:12px;padding-top:9px;border-top:1.5px dashed var(--vc-line);',
  'font-size:10px;font-weight:600;color:var(--ac-text-2);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',

  // 加冕 App: one cream box per form, its picture on the left, conditions as small chips.
  '.dp-crown{margin-bottom:10px;padding:10px 12px;border-radius:16px;background:#fffbe7;border:2px dashed #e8c66a}',
  '.dp-crown.dp-crown-now{border-style:solid;background:#fdf3d0}',
  '.dp-crown-top{display:flex;gap:10px;align-items:flex-start}',
  '.dp-crown-pic{flex:none;width:58px;height:58px;border-radius:14px;display:flex;align-items:center;justify-content:center;',
  'background:#fff;border:2px solid #f0dca0;font-size:30px}',
  '.dp-crown-img{width:50px;height:50px;display:block}',
  '.dp-crown-side{flex:1;min-width:0}',
  '.dp-crown-head{font-size:12px;font-weight:800;color:var(--ac-text);margin-bottom:6px}',
  '.dp-crown-done{font-size:11px;font-weight:700;color:#3f8a62}',
  '.dp-crown-reqs{display:flex;flex-wrap:wrap;gap:4px}',
  '.dp-crown-req{padding:2px 7px;border-radius:var(--ac-pill);font-size:10px;font-weight:700;white-space:nowrap;',
  'background:#f3ece0;color:var(--ac-text-2)}',
  '.dp-crown-req.dp-crown-ok{background:#dff3e8;color:#3f8a62}',
  '.dp-crown .dp-btn{width:100%;margin-top:9px}',
].join('')
