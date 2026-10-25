// 盲盒扩展 4.0.3 · 薄卡寻访：卡池/单抽/十连共用 CSS 3D 薄卡队列，十连一张一张抖翻停留。
;(function () {
  'use strict'
  var STYLE_ID = 'dsh-piggy-blindbox4-style'
  var SHAKE = 0.6 // 卡背左右抖动：用户要求 0.5~0.7s
  var FLIP = 0.46 // 抖动结束后翻到正面
  var HOLD = 0.7 // 十连每张正面至少停留，再换下一张
  var STEP = SHAKE + FLIP + HOLD // 十连一张的完整时长：抖 → 翻 → 停留
  var MID = FLIP / 2 // 对称缓动在半时长恰好转过90度，此时才建正面
  var SINGLE_END = SHAKE + FLIP
  var DELAY_LIMIT = 3600 // 只防坏值：单卡本地时间最多 STEP(1.76s)，别把后段的负延迟夹成 -9s
  var WINGS = [
    { x: -0.68, y: 0.08, z: -18, ry: 15, sc: 0.94, frost: 0.82 },
    { x: -1.22, y: 0.16, z: -78, ry: 27, sc: 0.86, frost: 0.92 },
    { x: 0.68, y: 0.08, z: -18, ry: -15, sc: 0.94, frost: 0.82 },
    { x: 1.22, y: 0.16, z: -78, ry: -27, sc: 0.86, frost: 0.92 },
  ]
  var SPARKS = [[18, 22], [78, 18], [30, 46], [70, 40], [12, 62], [86, 58], [40, 12], [60, 70]]
  var CSS = [
    '.bx{font-size:12px;--soft:var(--ac-text-2,#9f927d);--line:var(--ac-border-light,#e5dcc6);--paper:var(--ac-bg-input,#fffbe7);position:relative;display:grid;gap:10px;color:var(--ac-text,#794f27);font-variant-numeric:tabular-nums}','.bx *{box-sizing:border-box;min-width:0}.bx :where(button){min-height:32px;min-width:32px;font:inherit;color:inherit;touch-action:manipulation}','.bx-chips{display:flex;flex-wrap:wrap;gap:5px}.bx-chip{padding:4px 10px;border-radius:50px;font-size:12px;font-weight:800;color:var(--ac-text,#794f27);background:var(--paper);border:1.5px solid var(--line);white-space:nowrap}',
    '.bx-head{display:flex;align-items:center;gap:6px}.bx-tabs{display:flex;flex:1;min-width:0;gap:3px;padding:3px;border-radius:50px;background:var(--paper);border:1.5px solid var(--line)}','.bx-tab{flex:1;min-width:0;border:0;background:none;border-radius:50px;padding:5px 4px;font-size:12px;font-weight:800;color:var(--soft);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}','.bx-tab[aria-pressed="true"]{background:var(--ac-primary,#19c8b9);color:#fff;box-shadow:0 2px 0 var(--ac-primary-active,#11a89b)}',
    '.bx-mini{flex:none;border:1.5px solid var(--line);background:var(--paper);border-radius:16px;font-size:12px;font-weight:800;color:var(--ac-text,#794f27);padding:5px 9px;cursor:pointer;white-space:nowrap;box-shadow:0 3px 0 var(--line)}','.bx-pool-name{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:900}.bx-pool-name b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}','.bx-ribbon{flex:none;padding:2px 8px;border-radius:50px;background:#8fb9e8;color:#fff;font-size:12px;font-weight:900}.bx-pool-name[data-b="limited"] .bx-ribbon{background:#f38bab}.bx-days{flex:none;font-size:12px;font-weight:800;color:var(--soft)}',
    '.bx-stage{position:relative;overflow:hidden;border-radius:20px;border:2px solid var(--line);background:linear-gradient(180deg,#fffdf6,var(--paper));box-shadow:0 3px 0 var(--line);padding:10px 0 0;touch-action:pan-y}','.bx-stage[data-b="limited"]{background:linear-gradient(180deg,#fff8fa,#fff0f4 55%,var(--paper));border-color:#f3c8d4;box-shadow:0 3px 0 #f3c8d4}','.bx-rail{position:relative;height:172px;perspective:620px;perspective-origin:50% 34%;transform-style:preserve-3d}',
    '.bx-big .bx-rail{height:330px}','.bx-card{--cw:88px;position:absolute;left:50%;top:10px;width:var(--cw);height:calc(var(--cw) * 1.43);margin-left:calc(var(--cw) / -2);border-radius:10px;transform-style:preserve-3d;transform:translate3d(calc(var(--x,0) * var(--cw)),calc(var(--y,0) * var(--cw)),var(--z,0px)) rotateY(var(--ry,0deg)) rotateX(var(--rx,0deg)) scale(var(--sc,1));background:linear-gradient(158deg,rgba(255,255,255,.94),rgba(244,239,229,.8));border:1px solid rgba(255,255,255,.9);box-shadow:0 10px 20px rgba(96,84,66,.13),inset 0 0 0 1px rgba(120,108,90,.05)}','.bx-card::before{content:"";position:absolute;inset:3px;border-radius:8px;border:1px solid rgba(255,255,255,.8);pointer-events:none}',
    '.bx-card.bx-live{background:none;border:0;box-shadow:none}.bx-card.bx-live::before{content:none}.bx-draw .bx-card.bx-main{--z:0px;--sc:1;--y:0;top:12px}','.bx-card[data-s="3"]{--bc:#aeb9c4}.bx-card[data-s="4"]{--bc:#b48cf2}.bx-card[data-s="5"]{--bc:#f2b632}.bx-card[data-s="6"]{--bc:#ff7a2f}','.bx-card[data-lit="true"]{border-color:var(--bc,#d8c9a6);box-shadow:0 14px 26px rgba(96,84,66,.18),0 0 0 1px var(--bc,#d8c9a6),0 0 26px -8px var(--bc,#d8c9a6)}',
    '.bx-shake{position:absolute;inset:0;border-radius:inherit;transform-style:preserve-3d;perspective:520px}','.bx-flip{position:absolute;inset:0;border-radius:inherit;transform-style:preserve-3d}','.bx-side{position:absolute;inset:0;border-radius:inherit;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:1px solid rgba(255,255,255,.9);box-shadow:0 9px 18px rgba(96,84,66,.15)}',
    '.bx-back{display:grid;place-items:center;background:linear-gradient(152deg,#fffdf8,#eee7d9 55%,#f7f2e6)}','.bx-back::before{content:"";position:absolute;inset:4px;border-radius:8px;border:1px solid rgba(255,255,255,.9);box-shadow:inset 0 0 0 1px rgba(120,108,90,.14),inset 0 0 22px rgba(176,158,124,.18)}','.bx-back::after{content:"✦";position:relative;font-size:18px;line-height:1;color:#c9b48a;text-shadow:0 1px 0 #fff}',
    '.bx-front{transform:rotateY(180deg);display:grid;justify-items:center;align-content:end;gap:2px;padding:8px 4px 7px;background:linear-gradient(158deg,#fffdf8,#f4efe6);box-shadow:0 9px 18px rgba(96,84,66,.15),inset 0 0 0 2px var(--bc,#d8c9a6),inset 0 0 0 3px rgba(255,255,255,.7)}','.bx-front[data-s="3"]{--bc:#aeb9c4}.bx-front[data-s="4"]{--bc:#b48cf2}.bx-front[data-s="5"]{--bc:#f2b632}.bx-front[data-s="6"]{--bc:#ff7a2f}','.bx-em{font-size:36px;line-height:1.05;filter:drop-shadow(0 3px 2px rgba(84,70,50,.16))}.bx-face b,.bx-front b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:900}.bx-stars{font-size:12px;letter-spacing:.5px;color:#b99a5c;white-space:nowrap}',
    '.bx-face{position:absolute;inset:0;display:grid;justify-items:center;align-content:end;gap:2px;padding:8px 4px 7px;overflow:hidden;border-radius:10px;background:linear-gradient(158deg,#fffdf8,#f4efe6)}','.bx-frost{position:absolute;inset:0;border-radius:10px;pointer-events:none;background:linear-gradient(150deg,rgba(255,255,255,.95) 0%,rgba(240,236,228,.9) 55%,rgba(255,255,255,.82) 100%)}','.bx-card.bx-main{--x:0;--y:-0.04;--z:34px;--sc:1.08;z-index:3}',
    '.bx .bx-rail>.bx-card:not(.bx-main) .bx-face b,.bx .bx-rail>.bx-card:not(.bx-main) .bx-stars{font-size:14px}.bx-big .bx-card{--cw:150px;top:14px}.bx-big .bx-em{font-size:62px}.bx-big .bx-face b,.bx-big .bx-front b{font-size:14px}.bx-big .bx-stars{font-size:12px}','.bx-upflag{position:absolute;top:4px;right:4px;padding:0 5px;border-radius:50px;background:#d8b26a;color:#fff;font-size:12px;font-weight:900;letter-spacing:.06em;z-index:2}','.bx-own{position:absolute;left:4px;top:4px;padding:0 4px;border-radius:50px;background:rgba(121,79,39,.45);color:#fff;font-size:12px;font-weight:800;z-index:2}',
    '.bx-draw[data-settled="false"] .bx-shake{animation:bx-shake .6s cubic-bezier(.36,.07,.19,.97) both;animation-delay:var(--ts,0s)}','.bx-draw[data-settled="false"] .bx-flip{animation:bx-flip .46s cubic-bezier(.4,0,.6,1) both;animation-delay:var(--tf,0s)}','.bx-draw[data-settled="true"] .bx-flip{transform:rotateY(180deg)}',
    '.bx-ten{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:10px 4px 4px;perspective:900px}','.bx-tcard{position:relative;display:grid;min-width:0;min-height:112px;border-radius:9px}','.bx-tcard .bx-side{border-radius:9px;box-shadow:0 4px 10px rgba(96,84,66,.12)}.bx-tcard .bx-front{box-shadow:0 4px 10px rgba(96,84,66,.12),inset 0 0 0 2px var(--bc,#d8c9a6),inset 0 0 0 3px rgba(255,255,255,.7)}',
    '.bx-tcard .bx-em{font-size:28px;line-height:1.35}.bx-tcard b{max-width:100%;overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere;line-height:1.35;text-align:center;font-size:12px;font-weight:900}.bx-tcard .bx-stars{font-size:12px;white-space:nowrap}.bx-tcard .bx-back::after{font-size:13px}.bx-tcard .bx-front{border-radius:9px;align-content:center;gap:4px;padding:6px 3px}','.bx-new{position:absolute;top:2px;right:2px;padding:0 3px;border-radius:50px;background:#cf5f43;color:#fff;font-size:12px;font-weight:900;line-height:1.5;z-index:2}','.bx-spark{position:absolute;left:var(--sx);top:var(--sy);width:5px;height:5px;border-radius:50%;background:#f0cf8a;box-shadow:0 0 8px 2px rgba(240,207,138,.8);opacity:0;animation:bx-twinkle 1.2s ease-out both;animation-delay:var(--t,0s);pointer-events:none;z-index:4}',
    '.bx-res{display:grid;gap:3px;justify-items:center;text-align:center;padding:4px 2px 0}','.bx-res-name{font-size:16px;font-weight:900;letter-spacing:.03em}.bx-res-line{font-size:12px;font-weight:800;color:var(--soft);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}','.bx-res-six{font-size:12px;font-weight:900;color:#c96a1e;letter-spacing:.08em}.bx-hint{font-size:12px;font-weight:700;color:var(--soft);letter-spacing:.06em}',
    '.bx-res-acts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;width:100%}.bx-res-acts.one{grid-template-columns:1fr}','.bx-btn{display:grid;gap:1px;place-items:center;min-height:38px;padding:8px 4px;border:0;border-radius:16px;background:var(--ac-primary,#19c8b9);color:#fff;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 3px 0 var(--ac-primary-active,#11a89b)}','.bx-btn small{font-size:12px;font-weight:700;opacity:.8}',
    '.bx-btn.ghost{background:var(--paper);color:var(--ac-text,#794f27);border:2px solid var(--line);box-shadow:0 3px 0 var(--line)}','.bx-btn[data-bx-ticket]{grid-column:1/-1;width:100%;background:var(--paper);color:#7a4a00;border:2px solid #dfb949;box-shadow:0 3px 0 #e6cf92}','.bx-btn:disabled{opacity:.45;cursor:not-allowed}.bx-btn:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 var(--ac-primary-active,#11a89b)}',
    '.bx-acts{display:grid;grid-template-columns:1fr 1fr;gap:6px}.bx-btn[data-bx-ticket]{grid-column:1/-1}','.bx-pity-box{display:grid;gap:4px}.bx-pity{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--soft)}.bx-pity span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bx-pity b{flex:none;color:#b9822c}','.bx-meter{height:8px;border-radius:50px;background:#efe6cf;overflow:hidden}.bx-meter i{display:block;height:100%;border-radius:50px;background:linear-gradient(90deg,#ffd27a,#ff8f5a)}',
    '.bx-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;color:var(--soft)}.bx-link{border:0;background:none;font:inherit;font-weight:900;color:#8a6a2f;text-decoration:underline;cursor:pointer;padding:2px 0}','.bx-bar{display:flex;align-items:center;gap:6px;min-width:0}','.bx-back-btn{flex:none;width:32px;height:32px;border-radius:16px;border:1.5px solid var(--line);background:var(--paper);color:var(--ac-text,#794f27);font-size:16px;font-weight:900;line-height:1;cursor:pointer;box-shadow:0 3px 0 var(--line)}',
    '.bx-bar b{flex:1;min-width:0;font-size:12px;letter-spacing:.1em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}','.bx-skip{flex:none;border:1.5px solid var(--line);background:var(--paper);color:var(--ac-text,#794f27);border-radius:16px;font-size:12px;font-weight:800;padding:4px 10px;cursor:pointer;box-shadow:0 3px 0 var(--line)}','.bx-step{flex:none;font-size:12px;font-weight:800;color:var(--soft);letter-spacing:.06em}',
    '.bx-shake[data-still="true"],.bx-flip[data-still="true"]{animation:none!important}','.bx-big{background:var(--ac-bg-content,#fff8e3);border-radius:0;box-sizing:border-box;width:100%;min-height:100%;margin:0;align-content:start;padding:16px;gap:12px}.bx-big .bx-stage{padding:14px 0 0;border-radius:22px;min-height:clamp(300px,calc(100vh - 330px),400px)}','.bx-big .bx-draw{display:grid;grid-template-columns:minmax(0,1fr) 280px;grid-template-rows:auto minmax(0,1fr);column-gap:24px;row-gap:10px;align-items:start}.bx-big .bx-bar{grid-column:1/-1}',
    '.bx-big .bx-ten{grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;padding:16px 18px}.bx-big .bx-tcard{min-height:clamp(140px,16vw,210px)}.bx-big .bx-tcard .bx-em{font-size:32px}.bx-big .bx-tcard b{font-size:12px}.bx-big .bx-tcard .bx-stars{font-size:12px}','.bx-big .bx-res{align-content:center;justify-items:start;text-align:left;gap:8px;padding-top:20px}.bx-big .bx-res-name{font-size:28px}.bx-big .bx-res-line{font-size:14px}.bx-big .bx-res-six{font-size:14px}','.bx-big .bx-res-acts{grid-template-columns:1fr;margin-top:10px}.bx-big .bx-btn{min-height:44px;font-size:14px}.bx-big .bx-btn small{font-size:12px}',
    '.bx-big .bx-pity,.bx-big .bx-foot{font-size:12px}.bx-big .bx-pool-name{font-size:13px}','.bx-reveal:not(.bx-big){height:var(--bx-avail,auto);min-height:0;overflow:hidden}','.bx-reveal:not(.bx-big)>.bx-draw{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:8px;height:100%;min-height:0}',
    '.bx-reveal:not(.bx-big)>.bx-draw>.bx-stage{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}','.bx[data-asleep="true"] *{animation-play-state:paused!important}','@keyframes bx-shake{0%,100%{transform:translateX(0) rotate(0deg)}15%{transform:translateX(-3px) rotate(-2.6deg)}30%{transform:translateX(3px) rotate(2.6deg)}45%{transform:translateX(-2px) rotate(-1.8deg)}60%{transform:translateX(2px) rotate(1.8deg)}80%{transform:translateX(-1px) rotate(-.9deg)}}',
    '@keyframes bx-flip{from{transform:rotateY(0deg)}to{transform:rotateY(180deg)}}','@keyframes bx-twinkle{0%{opacity:0;transform:scale(.4)}35%{opacity:1;transform:scale(1.1)}100%{opacity:0;transform:scale(.6)}}','.bx-reveal[data-compact="true"] .bx-res-name,.bx-reveal[data-compact="true"] .bx-res-count,.bx-reveal[data-compact="true"] .bx-res-stars,.bx-reveal[data-compact="true"] .bx-res-six{display:none}.bx-reveal[data-compact="true"] .bx-stage{padding:0}.bx-reveal[data-compact="true"] .bx-ten{padding:4px}.bx-reveal[data-compact="true"] .bx-tcard{min-height:108px}.bx-reveal[data-compact="true"] .bx-rail{height:132px}.bx-reveal[data-compact="true"]>.bx-draw{gap:6px}.bx-reveal[data-compact="true"] .bx-live{--cw:88px;height:104px;top:11px;--z:0px;--sc:1;--y:0}',
    '@media (prefers-reduced-motion:reduce){.bx *,.bx *::before,.bx *::after{animation-duration:.001s!important;animation-delay:0s!important;transition:none!important}}'
  ].join('\n')
  var state = {
    seenId: null, startedId: null, startedAt: 0, skipped: {}, fresh: false,
    banner: null, hover: false, bannerTimer: 0, phaseTimer: 0, busy: false, busyLast: null, busyToken: null, asleep: false, pausedAt: null,
    scrollId: null, scrollTop: 0, app: null, root: null, bound: false, listeners: [], timers: [], observer: null, synced: false,
  }
  /** 隐藏时冻结播放时钟；Date.now 只由 onVisibility 记录暂停点，别让轮询重绘推进进度。 */ function nowMs() { return state.asleep && state.pausedAt !== null ? state.pausedAt : Date.now() }
  function num(value) { return typeof value === 'number' && isFinite(value) ? value : 0 }
  /** fakeDom 没有布局 API：量不到就当 0，别让补高度把渲染打断。 */
  function styleNum(node, prop) {
    var view = null; try { if (typeof window.getComputedStyle === 'function') view = window.getComputedStyle(node) } catch (error) { view = null }
    return view ? Math.max(0, num(parseFloat(view[prop]))) : 0
  }
  function elementHeight(node) {
    if (!node) return 0
    if (typeof node.offsetHeight === 'number' && node.offsetHeight > 0) return node.offsetHeight
    if (typeof node.getBoundingClientRect === 'function') try { var rect = node.getBoundingClientRect(); if (rect && num(rect.height) > 0) return rect.height } catch (error) { return 0 }
    return 0
  }
  function previousElements(node) {
    var out = []
    var at = node && node.previousElementSibling
    while (at) { out.unshift(at); at = at.previousElementSibling }
    if (out.length || !node || !node.parentNode) return out
    var siblings = node.parentNode.children || []
    for (var i = 0; i < siblings.length && siblings[i] !== node; i += 1) if (siblings[i]) out.push(siblings[i])
    return out
  }
  /** 宿主给的是整个内容区高度；减掉 root 前面实际占位的钱包等，才是结果页能用的高度。 */
  function fitPanel(root) {
    var outer = root && root.parentNode
    if (!outer || !outer.style || typeof outer.style.getPropertyValue !== 'function') return
    var raw = parseFloat(outer.style.getPropertyValue('--ext-panel-height'))
    if (!(raw > 0)) return
    var used = previousElements(root).reduce(function (sum, node) {
      return sum + elementHeight(node) + styleNum(node, 'marginTop') + styleNum(node, 'marginBottom')
    }, 0)
    root.style.setProperty('--bx-avail', Math.max(100, Math.floor(raw - used)) + 'px')
    root.setAttribute('data-compact', String(raw - used < 300))
  }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) }
  function starText(n) { return new Array(Math.max(0, Math.min(6, n)) + 1).join('★') }
  function sec(value) { var safe = isFinite(value) ? value : 0; return Math.max(-DELAY_LIMIT, Math.min(DELAY_LIMIT, safe)).toFixed(2) + 's' }
  function figureOf(data, got) {
    var catalog = Array.isArray(data.catalog) ? data.catalog : []
    var known = null
    for (var i = 0; i < catalog.length; i += 1) if (catalog[i] && catalog[i].key === got.key) { known = catalog[i]; break }
    var stars = Math.round(Number(got.stars))
    if (!(stars >= 3 && stars <= 6)) stars = known && Number(known.stars) ? Number(known.stars) : 3
    return {
      key: typeof got.key === 'string' ? got.key : 'unknown', emoji: known && known.emoji ? known.emoji : '❔',
      label: known && known.label ? known.label : '未知摆件', stars: stars, isNew: got.isNew === true,
      potential: num(got.potential), certs: num(got.certs),
    }
  }
  function cardAt(index) { return index * STEP }
  function endAt(count) { return count > 1 ? cardAt(count) : SINGLE_END }
  /** 十连任意时刻只属于一张卡；单抽永远从 0 开始。 */
  function cardNow(elapsed, count) {
    if (count < 2) return { index: 0, start: 0 }
    var index = Math.min(count - 1, Math.max(0, Math.floor((elapsed + 0.001) / STEP)))
    return { index: index, start: cardAt(index) }
  }
  /** 卡面在翻过中点后出现；1ms 容差只防浮点把恰好到点的重画挡回去。 */
  function crossed(local) { return local >= SHAKE + MID - 0.001 }
  /** 需要重画的两个点：翻过中点（建正面）、换下一张；最后是整轮播完。 */
  function phasePoints(count) {
    if (count < 2) return [SHAKE + MID, SINGLE_END]
    var points = []
    for (var i = 0; i < count; i += 1) { points.push(cardAt(i) + SHAKE + MID); if (i < count - 1) points.push(cardAt(i + 1)) }
    points.push(cardAt(count)); return points
  }
  function ensureStyle() {
    var previous = document.getElementById(STYLE_ID)
    if (previous) { if (previous.textContent !== CSS) previous.textContent = CSS; return }
    var style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS
    ;(document.head || document.body).appendChild(style)
  }
  function later(fn, ms) {
    var id = setTimeout(function () { drop(id); fn() }, ms)
    state.timers.push(id); return id
  }
  function drop(id) { var at = state.timers.indexOf(id); if (at >= 0) state.timers.splice(at, 1) }
  function cancel(id) {
    if (!id) return
    clearTimeout(id); drop(id)
  }
  function listen(target, type, fn) {
    target.addEventListener(type, fn); state.listeners.push([target, type, fn])
  }
  function connected(node) {
    if (!node) return false; if (typeof node.isConnected === 'boolean') return node.isConnected
    return typeof document.body.contains === 'function' ? document.body.contains(node) : true
  }
  /** 面板被换掉/扩展关掉：摘监听、清计时器、断开观察。重复调用无害。 */
  function dispose() {
    state.listeners.forEach(function (entry) { try { entry[0].removeEventListener(entry[1], entry[2]) } catch (error) { /* 老宿主没有这个元素也无所谓 */ } })
    state.listeners.length = 0
    state.timers.splice(0).forEach(function (id) { clearTimeout(id) })
    if (state.observer) {
      try { state.observer.disconnect() } catch (error) { /* 同上 */ }; state.observer = null
    }
    state.bound = false; state.root = null; state.bannerTimer = 0; state.phaseTimer = 0; state.hover = false
  }
  function onVisibility() {
    if (!state.root) return
    var hidden = document.hidden === true || document.visibilityState === 'hidden'
    state.root.setAttribute('data-asleep', String(hidden))
    if (hidden === state.asleep) return // 每次 bind 都会调进来：同一状态不能重复记暂停点/补偿
    state.asleep = hidden; if (hidden) {
      state.pausedAt = Date.now() // 真实挂起时刻；播放时钟从这里冻结
      cancel(state.phaseTimer); state.phaseTimer = 0
    } else {
      if (state.pausedAt !== null && state.startedId !== null) state.startedAt += Date.now() - state.pausedAt
      state.pausedAt = null; resumePhase()
    }
  }
  function bind(root) {
    state.root = root
    if (!state.bound) {
      state.bound = true; listen(document, 'visibilitychange', onVisibility)
      if (typeof window.MutationObserver === 'function') {
        try {
          state.observer = new window.MutationObserver(function () { if (state.root && !connected(state.root)) dispose() }); state.observer.observe(document.body, { childList: true, subtree: true })
        } catch (error) { state.observer = null }
      }
    }
    onVisibility()
  }
  function safeRerender(app) {
    if (app && typeof app.rerender === 'function') app.rerender()
  }
  function clearBusy() {
    if (!state.busy) return
    state.busy = false
    state.busyToken = null
  }
  /** Keep one draw in flight until its actual response, including slow hosts. */
  function startDraw(app, payload) {
    if (state.busy) return
    state.busy = true
    var token = state.busyToken = {}
    state.busyLast = app.data && app.data.last ? app.data.last.id : 0
    safeRerender(app)
    function finished() {
      if (state.busyToken !== token) return
      clearBusy()
      if (connected(state.root)) safeRerender(state.app)
    }
    try {
      var pending = app.send('open', payload)
      if (pending && typeof pending.then === 'function') pending.then(finished, finished)
    } catch (error) { finished() }
  }
  function leaveResult(app, last) {
    state.seenId = last.id
    state.startedId = null
    state.startedAt = 0
    delete state.skipped[last.id]
    cancel(state.phaseTimer); state.phaseTimer = 0
    clearBusy()
    safeRerender(app)
  }
  function replayResult(app, last) {
    state.startedId = last.id
    state.startedAt = nowMs()
    state.scrollTop = 0
    delete state.skipped[last.id]
    cancel(state.phaseTimer); state.phaseTimer = 0
    safeRerender(app)
  }
  function switchBanner(app, key) {
    if (!app || key === state.banner) return
    state.banner = key
    cancel(state.bannerTimer); state.bannerTimer = 0
    safeRerender(app)
  }
  function armBanner(app) {
    if (state.bannerTimer || state.hover || !app || !app.data || !Array.isArray(app.data.banners)) return
    var other = state.banner === 'limited' ? 'standard' : 'limited'
    if (!app.data.banners.some(function (b) { return b.key === other })) return
    state.bannerTimer = later(function () {
      state.bannerTimer = 0
      if (!state.app || state.hover) return
      state.banner = other
      safeRerender(state.app)
    }, 6000)
  }
  /** 只在「下一张要翻面」「本轮播完」这两个必要点重画；每次都按 elapsed 重算，不累加。 */
  /** 恢复可见：只把暂停时长补进 startedAt 并重挂相位计时器，不重画，避免 bind→render 递归。 */
  function resumePhase() {
    var app = state.app
    var last = app && app.data ? app.data.last : null
    if (!app || state.asleep || state.startedId === null || !last || last.id !== state.startedId) return
    if (state.skipped[last.id] === true || !Array.isArray(last.items) || last.items.length === 0) return
    var elapsed = Math.max(0, (nowMs() - state.startedAt) / 1000)
    if (elapsed >= endAt(last.items.length)) return
    schedulePhase(app, elapsed, phasePoints(last.items.length))
  }
  function schedulePhase(app, elapsed, points) {
    cancel(state.phaseTimer); state.phaseTimer = 0
    var next = null
    points.forEach(function (at) {
      if (at > elapsed && (next === null || at < next)) next = at
    })
    if (next === null) return
    state.phaseTimer = later(function () {
      state.phaseTimer = 0
      if (!connected(state.root)) return
      safeRerender(state.app || app)
    }, Math.max(16, Math.ceil((next - elapsed) * 1000) + 2))
  }
  function place(node, cfg) {
    if (cfg.x !== undefined) node.style.setProperty('--x', String(cfg.x))
    if (cfg.y !== undefined) node.style.setProperty('--y', String(cfg.y))
    if (cfg.z !== undefined) node.style.setProperty('--z', cfg.z + 'px')
    if (cfg.ry !== undefined) node.style.setProperty('--ry', cfg.ry + 'deg')
    if (cfg.sc !== undefined) node.style.setProperty('--sc', String(cfg.sc))
    if (cfg.t !== undefined) node.style.setProperty('--t', sec(cfg.t))
    return node
  }
  function frost(app, opacity) { var node = app.el('i', 'bx-frost'); if (opacity !== undefined) node.style.opacity = String(opacity); return node }
  function face(app, f) {
    var node = app.el('div', 'bx-face')
    node.appendChild(app.el('span', 'bx-em', f.emoji))
    node.appendChild(app.el('b', null, f.label))
    node.appendChild(app.el('span', 'bx-stars', starText(f.stars)))
    return node
  }
  /** 卡背：只有纸纹（CSS 画），DOM 里没有 emoji / 名字 / 星级。 */
  function backSide(app) {
    return app.el('div', 'bx-side bx-back')
  }
  /** 正面：过了 90 度中点才创建；前半圈 DOM 里只有卡背。 */
  function frontSide(app, f) {
    var node = app.el('div', 'bx-side bx-front')
    node.setAttribute('data-s', String(f.stars))
    node.setAttribute('data-lit', 'true')
    node.appendChild(app.el('span', 'bx-em', f.emoji))
    node.appendChild(app.el('b', null, f.label))
    node.appendChild(app.el('span', 'bx-stars', starText(f.stars)))
    return node
  }
  /** 一张会抖会翻的薄卡：外层定位，抖动层管左右，翻面层管 Y 轴；still 用静态角度代替动画。 */
  function flipCard(app, f, shakeDelay, flipDelay, showFront, still) {
    var shake = app.el('div', 'bx-shake')
    var flip = app.el('div', 'bx-flip')
    if (still) {
      shake.setAttribute('data-still', 'true')
      flip.setAttribute('data-still', 'true')
      flip.style.transform = showFront ? 'rotateY(180deg)' : 'rotateY(0deg)'
    } else {
      shake.style.setProperty('--ts', sec(shakeDelay))
      flip.style.setProperty('--tf', sec(flipDelay))
    }
    flip.appendChild(showFront ? frontSide(app, f) : backSide(app))
    shake.appendChild(flip)
    return shake
  }
  /** 队列里的两翼薄卡（卡池是磨砂卡背，揭晓只留无内容纸片），两边共用。 */
  function wings(app, rail, frosted) {
    WINGS.forEach(function (w) {
      var card = place(app.el('div', 'bx-card'), w)
      if (frosted !== false) card.appendChild(frost(app, w.frost))
      rail.appendChild(card)
    })
    return rail
  }
  function figureAt(data, list, index) {
    var got = list[index]
    return figureOf(data, got !== null && typeof got === 'object' ? got : {})
  }
  /** 揭晓舞台：播放时只建当前这一张（周围是无内容纸片），全部播完才换成总览网格。 */
  function revealStage(app, data, list, ten, settled, index, local, banner) {
    var stage = app.el('div', 'bx-stage')
    stage.setAttribute('data-b', banner === 'limited' ? 'limited' : 'standard')
    if (ten && settled) {
      var grid = app.el('div', 'bx-ten')
      list.forEach(function (_, i) {
        var cell = app.el('div', 'bx-tcard')
        cell.appendChild(flipCard(app, figureAt(data, list, i), 0, 0, true, false))
        grid.appendChild(cell)
      })
      stage.appendChild(grid)
      return stage
    }
    var rail = wings(app, app.el('div', 'bx-rail'), false)
    var main = place(app.el('div', 'bx-card bx-main bx-live'), {})
    var current = figureAt(data, list, index)
    main.appendChild(settled
      ? flipCard(app, current, 0, 0, true, false)
      : flipCard(app, current, -local, SHAKE - local, crossed(local), reduced()))
    rail.appendChild(main)
    stage.appendChild(rail)
    if (!settled && !reduced() && current.stars === 6 && crossed(local)) {
      SPARKS.forEach(function (spot, i) {
        var spark = app.el('i', 'bx-spark')
        spark.style.setProperty('--sx', spot[0] + '%')
        spark.style.setProperty('--sy', spot[1] + '%')
        spark.style.setProperty('--t', sec(SHAKE + 0.2 - local + i * 0.04))
        stage.appendChild(spark)
      })
    }
    return stage
  }
  function bannerOf(data, key) { var list = Array.isArray(data.banners) ? data.banners : []; return list.find(function (b) { return b && b.key === key }) || list[0] }
  function chips(app, data) {
    var row = app.el('div', 'bx-chips')
    row.appendChild(app.el('span', 'bx-chip', '🪙 ' + num(data.coins)))
    row.appendChild(app.el('span', 'bx-chip', '🎟 ×' + num(data.tickets)))
    row.appendChild(app.el('span', 'bx-chip', '📜 ' + num(data.certs)))
    return row
  }
  /** 卡池排队：两翼磨砂卡 → 两个 UP 五星 → 主角 UP 六星（清晰卡面，UP 角标）。 */
  function poolRail(app, data, b) {
    var rail = wings(app, app.el('div', 'bx-rail'))
    ;(b.up5 || []).slice(0, 2).forEach(function (key, i) {
      var f = figureOf(data, { key: key, stars: 5 })
      var card = place(app.el('div', 'bx-card'), { x: i === 0 ? -0.42 : 0.42, y: 0.04, z: 6, ry: i === 0 ? 22 : -22, sc: 0.9 })
      card.setAttribute('data-s', '5')
      card.appendChild(face(app, f))
      card.appendChild(frost(app, 0.42))
      rail.appendChild(card)
    })
    var main = place(app.el('div', 'bx-card bx-main'), { x: 0, y: -0.04, z: 34, sc: 1.08 })
    var top = figureOf(data, { key: (b.up6 || [])[0], stars: 6 })
    main.setAttribute('data-s', '6')
    main.setAttribute('data-lit', 'true')
    main.appendChild(face(app, top))
    main.appendChild(app.el('span', 'bx-upflag', 'UP'))
    var owned = (data.catalog || []).find(function (entry) { return entry && entry.key === top.key })
    if (owned && num(owned.potential) > 0) main.appendChild(app.el('span', 'bx-own', '已有'))
    rail.appendChild(main)
    return rail
  }
  function pityBar(app, b) {
    var since = Math.max(0, num(b.since))
    var box = app.el('div', 'bx-pity-box')
    var row = app.el('div', 'bx-pity')
    row.appendChild(app.el('span', null, since >= 50
      ? '六星概率已提升到 ' + Math.round(num(b.sixChance) * 100) + '%'
      : '六星 2% · 再抽 ' + num(b.pityLeft) + ' 次后每抽 +2%（第 99 抽必出）'))
    row.appendChild(app.el('b', null, since + '/99'))
    box.appendChild(row)
    var meter = app.el('div', 'bx-meter')
    var fill = app.el('i')
    fill.style.width = Math.min(100, since / 99 * 100) + '%'
    meter.appendChild(fill)
    box.appendChild(meter)
    return box
  }
  function drawButton(app, data, b, count) {
    var price = num(data.prices && (count === 10 ? data.prices.ten : data.prices.one))
    var poor = num(data.coins) < price
    var btn = app.button('bx-btn', { 'data-bx-draw': String(count) }, function () { startDraw(app, { banner: b.key, count: count }) })
    btn.appendChild(app.el('span', null, count === 10 ? '寻访 10 次' : '寻访 1 次'))
    btn.appendChild(app.el('small', null, state.busy ? '寻访中…' : poor ? '金币不够' : price + ' 🪙'))
    if (state.busy || poor) btn.disabled = true
    return btn
  }
  function ticketButton(app, data, b) {
    var btn = app.button('bx-btn ghost', { 'data-bx-ticket': '1' }, function () { startDraw(app, { banner: b.key, count: 1, ticket: true }) })
    btn.textContent = '🎟 用盲盒券寻访 1 次（有 ' + num(data.tickets) + ' 张）'
    if (state.busy) btn.disabled = true
    return btn
  }
  function renderPool(app, data) {
    var root = app.content
    var b = bannerOf(data, state.banner)
    state.banner = b.key
    root.appendChild(chips(app, data))
    var head = app.el('div', 'bx-head')
    var tabs = app.el('div', 'bx-tabs')
    ;(data.banners || []).forEach(function (entry) {
      if (!entry) return
      var tab = app.button('bx-tab', { 'data-bx-banner': entry.key, 'aria-pressed': String(entry.key === b.key) }, function () { switchBanner(app, entry.key) })
      tab.textContent = (entry.key === 'limited' ? '限时' : '常驻') + ' ' + (entry.emoji || '')
      tabs.appendChild(tab)
    })
    head.appendChild(tabs)
    if (app.mode === 'big') {
      var back = app.button('bx-mini', { 'data-bx-close': '1' }, function () { if (typeof app.closeBig === 'function') app.closeBig() })
      back.textContent = '回面板'
      head.appendChild(back)
    } else if (typeof app.openBig === 'function') {
      var big = app.button('bx-mini', { 'data-bx-big': '1' }, function () { app.openBig() })
      big.textContent = '大窗'
      head.appendChild(big)
    }
    root.appendChild(head)
    var name = app.el('div', 'bx-pool-name')
    name.setAttribute('data-b', b.key)
    name.appendChild(app.el('span', 'bx-ribbon', b.key === 'limited' ? '限时' : '常驻'))
    name.appendChild(app.el('b', null, String(b.label || '').replace(/^限时寻访 · /, '')))
    name.appendChild(app.el('span', 'bx-days', '剩 ' + num(b.daysLeft) + ' 天'))
    root.appendChild(name)
    var stage = app.el('div', 'bx-stage')
    stage.setAttribute('data-b', b.key)
    stage.appendChild(poolRail(app, data, b))
    stage.addEventListener('pointerenter', function (event) { if (event.pointerType === 'mouse') { state.hover = true; cancel(state.bannerTimer); state.bannerTimer = 0 } })
    stage.addEventListener('pointerleave', function (event) { if (event.pointerType === 'mouse') { state.hover = false; armBanner(app) } })
    var fromX = null
    stage.addEventListener('pointerdown', function (event) { fromX = event.clientX })
    stage.addEventListener('pointerup', function (event) {
      var start = fromX
      fromX = null
      if (start === null || Math.abs(event.clientX - start) <= 40) return
      var other = b.key === 'limited' ? 'standard' : 'limited'
      if ((data.banners || []).some(function (entry) { return entry.key === other })) switchBanner(app, other)
    })
    stage.addEventListener('pointercancel', function () { fromX = null })
    root.appendChild(stage)
    root.appendChild(pityBar(app, b))
    var acts = app.el('div', 'bx-acts')
    acts.appendChild(drawButton(app, data, b, 1))
    acts.appendChild(drawButton(app, data, b, 10))
    if (num(data.tickets) > 0) acts.appendChild(ticketButton(app, data, b))
    root.appendChild(acts)
    var foot = app.el('div', 'bx-foot')
    foot.appendChild(app.el('span', null, '已寻访 ' + num(data.pulls) + ' 次'))
    var link = app.button('bx-link', { 'data-bx-dex': 'figures' }, function () { if (typeof app.openDex === 'function') app.openDex('figures') })
    link.textContent = '图鉴 → 摆件'
    foot.appendChild(link)
    root.appendChild(foot)
    armBanner(app)
  }
  /** 刚寻访的那一次；返回是不是第一次画（画完要滚到最上面）。 */
  function renderReveal(app, data, last) {
    var list = last.items
    var ten = list.length > 1
    var end = endAt(list.length)
    var fresh = state.startedId !== last.id
    if (fresh) { state.startedId = last.id; state.startedAt = nowMs() }
    var skipped = state.skipped[last.id] === true
    var elapsed = skipped ? end : Math.max(0, (nowMs() - state.startedAt) / 1000)
    // 减少动态只关动效：十连仍按顺序停留；单抽没有「逐张」流程，可直接给正面。
    var settled = skipped || (reduced() && !ten) || elapsed >= end
    var at = cardNow(elapsed, list.length)
    var local = settled ? SHAKE + FLIP : elapsed - at.start
    var root = app.content
    var draw = app.el('div', 'bx-draw')
    draw.setAttribute('data-settled', String(settled))
    var bar = app.el('div', 'bx-bar')
    var back = app.button('bx-back-btn', { 'data-bx-back': '1', 'aria-label': '返回卡池' }, function () { leaveResult(app, last) })
    back.textContent = '‹'
    bar.appendChild(back)
    bar.appendChild(app.el('b', null, ten ? '十连寻访' : '盲盒寻访'))
    if (ten && !settled) bar.appendChild(app.el('span', 'bx-step', (at.index + 1) + ' / ' + list.length))
    if (!settled) {
      var skip = app.button('bx-skip', { 'data-bx-skip': '1' }, function () {
        state.skipped[last.id] = true
        cancel(state.phaseTimer); state.phaseTimer = 0
        safeRerender(app)
      })
      skip.textContent = '快进 ›'
      bar.appendChild(skip)
    }
    draw.appendChild(bar)
    draw.appendChild(revealStage(app, data, list, ten, settled, at.index, local, last.banner))
    var res = app.el('div', 'bx-res')
    draw.appendChild(res)
    if (settled && ten) {
      var items = list.map(function (_, i) { return figureAt(data, list, i) })
      var freshCount = items.filter(function (f) { return f.isNew }).length
      var certs = items.reduce(function (sum, f) { return sum + f.certs }, 0)
      var best = items.reduce(function (top, f) { return f.stars > top.stars ? f : top }, items[0])
      res.appendChild(app.el('div', 'bx-res-name', best.label))
      res.appendChild(app.el('div', 'bx-res-line bx-res-count', '十连寻访 · ' + items.length + ' 个摆件'))
      res.appendChild(app.el('div', 'bx-res-line', '新的 ' + freshCount + ' 个' + (certs > 0 ? ' · 凭证 +' + certs : '')))
      if (items.some(function (f) { return f.stars === 6 })) res.appendChild(app.el('div', 'bx-res-six', '✨ 六星！✨'))
    } else if (settled) {
      var f = figureAt(data, list, 0)
      res.appendChild(app.el('div', 'bx-res-name', f.label))
      res.appendChild(app.el('div', 'bx-res-line bx-res-stars', starText(f.stars)))
      res.appendChild(app.el('div', 'bx-res-line', f.isNew
        ? '首次获得'
        : '潜能 ' + (f.potential > 0 ? f.potential : 1) + (f.certs > 0 ? ' · 凭证 +' + f.certs : '')))
      if (f.stars === 6) res.appendChild(app.el('div', 'bx-res-six', '✨ 六星！✨'))
    }
    if (settled) {
      var acts = app.el('div', 'bx-res-acts')
      var replay = app.button('bx-btn ghost', { 'data-bx-replay': '1' }, function () { replayResult(app, last) })
      replay.textContent = ten ? '重播十连' : '重播'
      acts.appendChild(replay)
      var done = app.button('bx-btn', { 'data-bx-done': '1' }, function () { leaveResult(app, last) })
      done.textContent = '收下'
      acts.appendChild(done)
      res.appendChild(acts)
    } else {
      res.appendChild(app.el('div', 'bx-hint', ten ? '正在揭开…… ' + (at.index + 1) + ' / ' + list.length : '正在揭开……'))
    }
    root.appendChild(draw)
    if (settled || state.asleep) {
      cancel(state.phaseTimer); state.phaseTimer = 0
    } else {
      schedulePhase(app, elapsed, phasePoints(list.length))
    }
    state.fresh = fresh
    return fresh
  }
  function render(app) {
    ensureStyle()
    state.app = app; state.fresh = false
    if (state.root && !connected(state.root)) dispose()
    var data = app.data
    if (!data || !Array.isArray(data.banners) || data.banners.length === 0) {
      app.content.appendChild(app.el('div', 'dp-empty', '盲盒还在准备……'))
      return
    }
    if (state.seenId === null) state.seenId = data.last && data.last.id ? data.last.id : 0
    if (num(data.pendingCerts) > 0 && !state.synced) { state.synced = true; app.send('sync') }
    if (state.busy && data.last && data.last.id !== state.busyLast) clearBusy()
    var last = data.last
    var reveal = last !== null && typeof last === 'object' && last.id !== state.seenId && Array.isArray(last.items) && last.items.length > 0
    if (!reveal) {
      cancel(state.phaseTimer); state.phaseTimer = 0
    } else {
      cancel(state.bannerTimer); state.bannerTimer = 0
    }
    var outer = app.content
    var root = app.el('div', 'bx' + (app.mode === 'big' ? ' bx-big' : '') + (reveal ? ' bx-reveal' : ''))
    app.content = root
    if (reveal) renderReveal(app, data, last)
    else renderPool(app, data)
    app.content = outer
    outer.appendChild(root)
    if (app.mode !== 'big') fitPanel(root)
    if (reveal) {
      if (state.scrollId !== last.id) { state.scrollId = last.id; state.scrollTop = 0 }
      var stage = root.querySelector ? root.querySelector('.bx-stage') : null
      if (stage) {
        stage.scrollTop = state.scrollTop
        stage.addEventListener('scroll', function () { state.scrollTop = stage.scrollTop })
      }
    }
    bind(root)
    if (reveal && state.fresh) later(function () { if (state.root === root) outer.scrollTop = 0 }, 0)
  }
  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('blindbox', { render: render })
})()
