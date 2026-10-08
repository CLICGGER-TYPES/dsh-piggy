// @ts-check
/**
 * 基础样式：设计令牌、宿主容器、猪、图标栏与气泡。
 *
 * @module dsh-piggy/client/css-base
 */


import { el } from './dom.js'

export const CSS_BASE = [
  // ---------------------------------------------------------------------
  // Animal Crossing design language, transcribed from
  // guokaigdg/animal-island-ui docs/design-system (design-tokens.md and the
  // standalone css-variables.md template).
  //
  // The tokens are declared on the widget root rather than :root: the host
  // page must not inherit them, and they must not be clobbered by it.
  //
  // The rules that shape everything below:
  //   · warm earth-brown text on cream parchment, never pure black or grey
  //   · 12px minimum radius; buttons and inputs are 50px pills
  //   · the thick 3D bottom shadow belongs to primary buttons only
  //   · cards carry a border, not an elevation shadow
  //   · motion is 0.15-0.35s on cubic-bezier(.4,0,.2,1)
  //   · focus rings are yellow or teal, never blue
  // ---------------------------------------------------------------------
  // 设置 → Emoji 样式 → 系统自带：去掉内置那套，用这台设备的 emoji。
  '[data-dsh-pig][data-dsh-pig][data-emoji="system"]{--ac-font:Nunito,"Noto Sans SC",-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif;}',
  '[data-dsh-pig]{',
  // 内置 emoji 排在前面：它只有表情字形，普通文字会自然落到后面的字体。
  // 桌面版的外壳提供同一个字体家族；网页版由 scene.js 注入 @font-face（assets/piggy-emoji.woff2）。
  '--ac-font:"Piggy Emoji",Nunito,"Noto Sans SC",-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif;',
  '--ac-primary:#19c8b9;--ac-primary-hover:#3dd4c6;--ac-primary-active:#11a89b;',
  '--ac-primary-bg:#e6f9f6;',
  '--ac-text:#794f27;--ac-text-body:#725d42;--ac-text-2:#9f927d;--ac-text-muted:#8a7b66;',
  '--ac-text-disabled:#c4b89e;',
  '--ac-bg:#f8f8f0;--ac-bg-content:rgb(247,243,223);--ac-bg-input:#fffbe7;',
  '--ac-bg-disabled:#f0ece2;',
  '--ac-border:#c4b89e;--ac-border-light:#e5dcc6;--ac-border-hover:#a89878;',
  '--ac-radius-sm:12px;--ac-radius-card:20px;--ac-pill:50px;',
  '--ac-shadow-sm:0 2px 4px 0 rgba(61,52,40,.06);',
  '--ac-shadow:0 3px 10px 0 rgba(61,52,40,.1);',
  '--ac-shadow-lg:0 8px 24px 0 rgba(61,52,40,.16);',
  '--ac-inset:inset 0 2px 4px rgba(114,93,66,.15);',
  // sidebar tokens: the library uses these for the selected menu row, which
  // is exactly the role the icon bar plays here.
  '--ac-active:#b7c6e5;--ac-hover:#d6dff0;',
  '--ac-success:#6fba2c;--ac-warning:#f5c31c;--ac-error:#e05a5a;',
  '--ac-ease:cubic-bezier(.4,0,.2,1);',
  // One place to size the pig; the scene and the panel cap derive from it.
  '--pig-size:56px;--pig-gap-below:12px;--scene-open:132px;--panel-width:292px;',
  'position:fixed;right:18px;bottom:18px;z-index:2147483000;',
  'font-family:var(--ac-font);font-weight:500;letter-spacing:.01em;',
  '-webkit-user-select:none;user-select:none;touch-action:none;',
  // The wrapper spans a column wider and taller than what it paints (the
  // scene's padding, the gap above the panel). Without this it swallows
  // clicks aimed at the page underneath — which once looked like "sending a
  // message does nothing" while the whole stack was healthy.
  'pointer-events:none;',
  // The pig is the only in-flow child, so the wrapper's box is exactly the
  // pig's box and the panel can be parked anywhere around it without ever
  // nudging the pig. `fitPanel` places the panel.
  'display:block}',
  '[data-dsh-pig] *{box-sizing:border-box}',
  '[data-dsh-pig]>*{pointer-events:auto}',
  // `hidden` MUST win. The UA sheet's `[hidden]{display:none}` ties on
  // specificity with a single class, so any `.dp-x{display:grid|flex}` rule
  // below silently beats it and the element keeps rendering. That is exactly
  // how a collapsed panel ended up showing the icon bar and the hud while
  // every `el.hidden === true` assertion still passed.
  '[data-dsh-pig] .dp-card[hidden],[data-dsh-pig] .dp-bar[hidden],',
  '[data-dsh-pig] .dp-content[hidden],[data-dsh-pig] .dp-hud[hidden],',
  '[data-dsh-pig] .dp-bubble[hidden],[data-dsh-pig] .dp-scene[hidden],',
  '[data-dsh-pig] .dp-work[hidden],[data-dsh-pig] .dp-soul[hidden],',
  '[data-dsh-pig] .dp-poke-hint[hidden],[data-dsh-pig] .dp-daily[hidden],',
  '[data-dsh-pig] .dp-pomo[hidden],',
  '[data-dsh-pig] .dp-pig-img[hidden],[data-dsh-pig] .dp-pig-emoji[hidden]{display:none}',

  /* ---------- the panel: cream parchment, border not shadow ---------- */
  // Taken out of flow on purpose. In flow it would widen the wrapper, and a
  // wider wrapper moves the pig — the exact thing this layout exists to
  // prevent. Absolutely positioned, the wrapper's box stays the pig's box
  // and `fitPanel` can put the panel on whichever side has room.
  '.dp-card{position:absolute;right:0;bottom:calc(100% + 8px);width:var(--panel-width);',
  'border-radius:var(--ac-radius-card);overflow:hidden;',
  'display:flex;flex-direction:column;',
  'background:var(--ac-bg);border:2px solid var(--ac-border-light);',
  // 面板自己钉住基准字号与字体：不钉就会继承宿主页面的 16px，
  // 详情框那种「没写 font-size 的容器」就会比周围大一倍（用户反馈 #2）。
  'box-shadow:var(--ac-shadow-lg);color:var(--ac-text-body);font-family:var(--ac-font);font-size:11px}',

  /* ---------- the pig: never moved, never boxed ---------- */
  '.dp-scene{position:relative;height:var(--scene-open);background:none;cursor:grab;',
  'overflow:visible;display:flex;align-items:flex-end;justify-content:flex-end;',
  'padding:0 6px var(--pig-gap-below);width:max-content}',
  '.dp-scene[data-dragging="true"]{cursor:grabbing}',
  // Collapsed the scene is exactly the pig, so the wrapper paints nothing
  // extra to click through. Open it widens to the panel so the hud and the
  // speech bubble have somewhere to sit — the pig is right-aligned either
  // way, so widening costs it no movement.
  '[data-dsh-pig][data-open="true"] .dp-scene{width:var(--panel-width)}',
  // Near the desktop's top edge the panel opens below. Keep the pig at the
  // same foot line as the collapsed scene instead of dropping it by 64px.
  '[data-dsh-pig][data-panel-vertical="below"][data-open="true"] .dp-scene{height:calc(var(--pig-size) + var(--pig-gap-below))}',
  // 面板朝下开时场景只有猪那么高，名牌从顶上往下排会贴着面板（用户反馈「状态栏和菜单贴太近」）。
  // 改成名牌底边对齐猪脚上方一点，和下面的面板留出 16px，跟朝上开时一样宽。
  '[data-dsh-pig][data-panel-vertical="below"][data-open="true"] .dp-hud{top:auto;bottom:8px}',
  // 桌面版面板朝右开时（外壳把窗口贴着猪、右边有地方），猪改待在场景左端，
  // 跟着猪定位的气泡和打工道具也要镜像 —— 网页版没有这个属性，规则不命中。
  '[data-dsh-pig][data-panel-side="right"] .dp-scene{justify-content:flex-start}',
  '[data-dsh-pig][data-panel-side="right"] .dp-work{margin:0 0 6px 2px}',
  // Collapsed the scene shrinks to just the pig. An explicit height rather
  // than `auto` keeps the pig's line box identical in both states, so
  // opening moves it by exactly zero pixels.
  '[data-dsh-pig][data-open="false"] .dp-scene{height:calc(var(--pig-size) + var(--pig-gap-below));',
  'cursor:pointer}',
  // 阴影挂在立绘（不动的元素）上，而不是做 bob/breathe 的 .dp-pig 上：
  // 动画只改 transform，滤镜跟着每帧重算在 Windows 上很贵（D1 第 4 条）。
  '.dp-pig{line-height:1;transform-origin:50% 85%;cursor:pointer;position:relative;',
  'animation:dp-bob 1.8s ease-in-out infinite}',
  '.dp-pig-img,.dp-pig-emoji{filter:drop-shadow(0 4px 6px rgba(61,52,40,.28))}',
  // 装扮点位：猪身上固定的几个锚点，每个点位挂一件。
  // 以后换真立绘时，只改这里的偏移/尺寸，逻辑和存档都不用动。
  '.dp-dress{position:absolute;inset:0;pointer-events:none;z-index:3}',
  '.dp-slot{position:absolute;line-height:1;font-size:15px;transform:translate(-50%,-50%)}',
  '.dp-slot[data-slot="head"]{left:50%;top:2%}',
  '.dp-slot[data-slot="face"]{left:50%;top:32%}',
  '.dp-slot[data-slot="neck"]{left:50%;top:60%}',
  '.dp-slot[data-slot="body"]{left:50%;top:78%;font-size:19px}',
  '.dp-slot[data-slot="back"]{left:14%;top:42%;font-size:19px}',
  '.dp-slot[data-slot="feet"]{left:50%;top:99%}',
  '[data-dsh-pig][data-open="false"] .dp-pig{filter:drop-shadow(0 5px 9px rgba(61,52,40,.26))}',
  // A petting hand rather than an arrow. Drawn inline as an SVG data URI so
  // it needs no asset and can carry the palette's warm outline; the hotspot
  // sits in the palm, which is where a pat actually lands. The `pointer`
  // after it is the fallback for browsers that refuse a custom cursor.
  // 运行时会用 canvas 画好挥手 emoji 写进 --pat-cursor（见 pat-cursor.js）；下面的手画手掌只是兜底。
  '.dp-pig{cursor:var(--pat-cursor, url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" '
    + 'width="30" height="30" viewBox="0 0 30 30"><g fill="%23F7C9B6" stroke="%23794F27" '
    + 'stroke-width="1.7" stroke-linejoin="round"><rect x="10" y="13.5" width="14" height="12" '
    + 'rx="4.8"/><rect x="10.6" y="6.6" width="3.6" height="10" rx="1.8"/><rect x="14.9" '
    + 'y="5.1" width="3.6" height="11.5" rx="1.8"/><rect x="19.2" y="6.6" width="3.6" '
    + 'height="10" rx="1.8"/><rect x="5.7" y="12.4" width="3.4" height="7.8" rx="1.7" '
    + 'transform="rotate(-27 7.4 16.3)"/></g></svg>\') 16 24, pointer)}',
  // Transform-only keyframes: the pig is an ordinary flex item, so there is
  // no translateX(-50%) centring to preserve.
  '@keyframes dp-bob{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-7px) rotate(-2.5deg)}}',
  '@keyframes dp-breathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(1px) scale(1.09)}}',
  '@keyframes dp-shake{0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(-4px) rotate(-5deg)}60%{transform:translateX(4px) rotate(5deg)}}',
  '@keyframes dp-spin{0%{transform:rotate(0)}50%{transform:rotate(180deg) scale(1.2)}100%{transform:rotate(360deg)}}',
  '@keyframes dp-jump{0%{transform:translateY(0)}30%{transform:translateY(-26px) scale(1.12)}60%{transform:translateY(0) scale(.92)}100%{transform:translateY(0)}}',
  // G 批次：猪自己找事做（life.js 设 data-idle），桌面散步时朝走的方向。
  '.dp-pig[data-idle="roll"]:not([data-react]){animation:dp-spin 1.4s ease-in-out}',
  '.dp-pig[data-idle="nap"]:not([data-react]){animation:dp-idle-nod 2s ease-in-out 2}',
  '.dp-pig[data-idle="butterfly"]:not([data-react]){animation:dp-jump .9s ease-out 3}',
  '.dp-pig[data-idle="scratch"]:not([data-react]){animation:dp-shake .5s ease-in-out 4}',
  '.dp-pig[data-idle="stretch"]:not([data-react]){animation:dp-idle-stretch 1.8s ease-in-out}',
  '.dp-pig[data-idle="look"]:not([data-react]){animation:dp-idle-look 2.6s ease-in-out}',
  '.dp-pig[data-idle="bubbles"]:not([data-react]){animation:dp-breathe .8s ease-in-out 3}',
  '.dp-pig[data-idle="walk"]:not([data-react]){animation:dp-walking .6s ease-in-out infinite}',
  '.dp-pig[data-walk="right"] .dp-pig-img{transform:scaleX(-1)}',
  '@keyframes dp-idle-nod{0%,100%{transform:rotate(0)}40%,60%{transform:translateY(3px) rotate(6deg)}}',
  '@keyframes dp-idle-stretch{0%,100%{transform:scale(1)}45%{transform:scaleX(1.16) scaleY(.88)}}',
  '@keyframes dp-idle-look{0%,100%{transform:rotate(0)}30%,70%{transform:rotate(-8deg) translateX(-3px)}}',
  '@media (prefers-reduced-motion:reduce){.dp-pig[data-idle]{animation:none!important}}',
  '@keyframes dp-wobble{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}55%{transform:rotate(14deg)}}',
  '@keyframes dp-cough{0%,100%{transform:translateX(0)}30%{transform:translateX(-4px) rotate(-7deg)}70%{transform:translateX(4px) rotate(6deg)}}',
  '.dp-pig[data-mood="happy"]{animation-duration:1.15s}',
  '.dp-pig[data-mood="sleepy"]{animation-name:dp-breathe;animation-duration:3.6s}',
  '.dp-pig[data-mood="hungry"]{animation-name:dp-shake;animation-duration:2.4s}',
  '.dp-pig[data-mood="dirty"]{animation-name:dp-breathe;animation-duration:2.6s}'
  ,'.dp-pig[data-mood="dirty"] .dp-pig-img,.dp-pig[data-mood="dirty"] .dp-pig-emoji{filter:sepia(.4) drop-shadow(0 4px 6px rgba(61,52,40,.28))}',
  // 脏了绕着苍蝇、病了绕着病毒（用户 2026-10-08）：变色之外再给一眼能认的记号，两只错开快慢和方向。
  '.dp-pig[data-mood="dirty"]::before,.dp-pig[data-mood="dirty"]::after,',
  '.dp-pig[data-mood="sick"]::before,.dp-pig[data-mood="sick"]::after{content:"🪰";position:absolute;z-index:4;',
  'font-size:calc(var(--pig-size) * .16);line-height:1;pointer-events:none;',
  'top:6%;left:22%;animation:dp-fly 2.4s ease-in-out infinite}',
  '.dp-pig[data-mood="sick"]::before,.dp-pig[data-mood="sick"]::after{content:"🦠";animation-duration:3.2s}',
  '.dp-pig[data-mood="dirty"]::after,.dp-pig[data-mood="sick"]::after{top:20%;left:62%;animation-duration:3.1s;animation-direction:reverse;animation-delay:-.9s}',
  '@keyframes dp-fly{0%,100%{transform:translate(0,0) rotate(-10deg)}25%{transform:translate(14px,-6px) rotate(15deg)}',
  '50%{transform:translate(22px,4px) rotate(-5deg)}75%{transform:translate(6px,8px) rotate(20deg)}}',
  '@media (prefers-reduced-motion:reduce){.dp-pig[data-mood]::before,.dp-pig[data-mood]::after{animation:none}}',
  '.dp-pig[data-mood="sick"]{animation-name:dp-cough;animation-duration:2.2s}'
  ,'.dp-pig[data-mood="sick"] .dp-pig-img,.dp-pig[data-mood="sick"] .dp-pig-emoji{filter:hue-rotate(-28deg) saturate(.75) drop-shadow(0 4px 6px rgba(61,52,40,.28))}',
  // One pose per activity, so being away reads as a thing the pig is doing.
  '@keyframes dp-typing{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-2px) rotate(-1.5deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-2px) rotate(1.5deg)}}',
  '@keyframes dp-reading{0%,100%{transform:translateY(0) rotate(0)}35%{transform:translateY(1px) rotate(-5deg)}70%{transform:translateY(1px) rotate(-2deg)}}',
  '@keyframes dp-walking{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-6px) rotate(-4deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-6px) rotate(4deg)}}',
  '.dp-pig[data-mood="working"]{animation-name:dp-typing;animation-duration:.7s}',
  '.dp-pig[data-mood="studying"]{animation-name:dp-reading;animation-duration:2.4s}',
  '.dp-pig[data-mood="traveling"]{animation-name:dp-walking;animation-duration:1s}',
  '.dp-pig[data-mood="dead"]{animation:none}'
  ,'.dp-pig[data-mood="dead"] .dp-pig-img,.dp-pig[data-mood="dead"] .dp-pig-emoji{filter:grayscale(1) drop-shadow(0 4px 6px rgba(61,52,40,.28))}',
  '.dp-pig[data-react]{animation-duration:.85s;animation-iteration-count:1}',
  '.dp-pig[data-react="feed"]{animation-name:dp-jump}',
  '.dp-pig[data-react="bathe"]{animation-name:dp-wobble;animation-duration:1.05s}',
  '.dp-pig[data-react="play"]{animation-name:dp-spin;animation-duration:.9s}',
  '.dp-pig[data-react="away"]{animation-name:dp-jump;animation-duration:.9s}',
  '.dp-pig[data-react="cure"]{animation-name:dp-spin;animation-duration:.9s}',
  '.dp-pig[data-react="levelup"]{animation-name:dp-jump;animation-duration:.95s}',
  '.dp-pig[data-react="refuse"]{animation-name:dp-shake;animation-duration:.5s}',

  /* ---------- what the pig is off doing ---------- */
  '[data-dsh-pig] .dp-work{display:flex;flex-direction:column;align-items:center;gap:4px;',
  'margin:0 2px 6px 0}',
  '.dp-prop{font-size:26px;line-height:1;filter:drop-shadow(0 3px 5px rgba(61,52,40,.22));',
  'animation:dp-prop-bob 2.4s ease-in-out infinite}',
  '[data-dsh-pig][data-away="study"] .dp-prop{animation-duration:3.4s}',
  '[data-dsh-pig][data-away="trip"] .dp-prop{animation-name:dp-prop-swing;animation-duration:1.6s}',
  '[data-dsh-pig][data-away="interest"] .dp-prop{animation-duration:3.4s}',
  '@keyframes dp-prop-bob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-3px) rotate(3deg)}}',
  '@keyframes dp-prop-swing{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-4px) rotate(8deg)}}',
  '.dp-progress{width:42px;height:7px;border-radius:var(--ac-pill);background:var(--ac-bg-disabled);',
  'box-shadow:var(--ac-inset);overflow:hidden}',
  '.dp-progress i{display:block;height:100%;border-radius:var(--ac-pill);',
  'background:var(--ac-primary);transition:width .5s var(--ac-ease)}',
  // The scene needs room for the prop; it grows leftward, so the pig stays put.
  '[data-dsh-pig][data-away="work"] .dp-scene,[data-dsh-pig][data-away="study"] .dp-scene,',
  '[data-dsh-pig][data-away="interest"] .dp-scene,',
  '[data-dsh-pig][data-away="trip"] .dp-scene{width:max-content;min-width:132px}',
  // 加冕后的形态有动作立绘（桌子、书、行李都画在图里）：不再摆 emoji 道具，
  // 动作也收小，免得把画里的东西甩来甩去（立绘与动作来自 PR #2）。
  '[data-dsh-pig][data-art-actions="true"] .dp-prop{display:none}',
  '.dp-pig[data-art-actions="true"][data-mood="working"]:not([data-react]){animation:dp-king-work 1.4s ease-in-out infinite}',
  '.dp-pig[data-art-actions="true"][data-mood="studying"]:not([data-react]){animation:dp-king-study 2.4s ease-in-out infinite}',
  '.dp-pig[data-art-actions="true"][data-mood="traveling"]:not([data-react]){animation:dp-king-walk .8s ease-in-out infinite}',
  '@keyframes dp-king-work{0%,100%{transform:translateY(0)}50%{transform:translateY(1px) rotate(1deg)}}',
  '@keyframes dp-king-study{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}',
  '@keyframes dp-king-walk{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-3px) rotate(2deg)}}',

  /* ---------- hud: a cream tag beside the pig ---------- */
  '.dp-hud{position:absolute;left:9px;top:7px;display:flex;flex-direction:column;gap:1px;',
  'font-size:10.5px;font-weight:600;line-height:1.45;color:var(--ac-text);',
  'background:var(--ac-bg);border:2px solid var(--ac-border-light);padding:5px 10px;',
  'border-radius:var(--ac-radius-sm);box-shadow:var(--ac-shadow-sm)}',
  '.dp-hud b{font-weight:700}',

  // A drawn sprite is sized by the same variable as the emoji, so growing up
  // works identically either way.
  '.dp-pig-img{width:var(--pig-size);height:var(--pig-size);display:block;',
  '-webkit-user-drag:none;user-select:none}',
  '.dp-pig-emoji{font-size:var(--pig-size);line-height:1}',

  // No drawings yet — every stage is the same pig, so age reads as size plus
  // a faded coat on the last one.
  '[data-dsh-pig][data-faded="true"] .dp-pig-emoji{filter:grayscale(.5) opacity(.72)}',

  // The box advertises itself: a slow breathing glow plus a label, so it
  // does not read as scenery.
  '[data-dsh-pig][data-unhatched="true"] .dp-pig{cursor:pointer;',
  'animation:dp-box-breathe 2.4s ease-in-out infinite}',
  '[data-dsh-pig][data-unhatched="true"] .dp-pig-emoji{',
  'filter:drop-shadow(0 0 0 rgba(255,214,102,0)) drop-shadow(0 4px 6px rgba(61,52,40,.28))}',
  '@keyframes dp-box-breathe{0%,100%{transform:translateY(0) scale(1)}',
  '50%{transform:translateY(-3px) scale(1.06)}}',
  '.dp-poke-hint{position:absolute;right:2px;bottom:-2px;display:flex;align-items:center;gap:3px;',
  'font-size:9.5px;font-weight:700;color:var(--ac-text);background:var(--ac-bg);',
  'border:1.5px solid var(--ac-border-light);border-radius:var(--ac-pill);padding:1px 7px;',
  'box-shadow:0 2px 0 rgba(61,52,40,.12);pointer-events:none;white-space:nowrap;z-index:3;',
  'animation:dp-hint-bob 1.6s ease-in-out infinite}',
  '@keyframes dp-hint-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
  // Each poke shakes it harder; the third one opens it instead.
  '[data-dsh-pig] .dp-pig[data-mood="poke"],',
  '[data-dsh-pig][data-poke] .dp-pig{animation-name:dp-poke-shake}',
  '[data-dsh-pig][data-poke="2"] .dp-pig{animation-duration:.28s}',
  '@keyframes dp-poke-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}',
  '50%{transform:rotate(6deg)}75%{transform:rotate(-4deg)}}',

  // The shop's tiles live in css-tiles.js since B8.
].join('')
