// 盲盒扩展 2.1 · 面板部分：寻访页。
// 开盒：补给箱落下 → 缝里透出星级颜色的光 → 打开；10 连先排两行小箱子，再一个个翻开，可跳过。
// 动画时间都写成 CSS 延迟，面板每几秒重画一次也能接着播，不会从头开始。
;(function () {
  'use strict'
  var STYLE_ID = 'dsh-piggy-blindbox2-style'
  var STAR = { 3: '#aeb9c4', 4: '#b48cf2', 5: '#f2b632', 6: '#ff7a2f' }
  var CSS = [
    '.bx{--ink:var(--ac-text,#794f27);--soft:var(--ac-text-2,#9f927d);display:grid;gap:10px}',
    '.bx [data-s="3"],.bx[data-s="3"]{--c:' + STAR[3] + ';--cl:#eef2f5}.bx [data-s="4"],.bx[data-s="4"]{--c:' + STAR[4] + ';--cl:#f3ecff}.bx [data-s="5"],.bx[data-s="5"]{--c:' + STAR[5] + ';--cl:#fff4d6}.bx [data-s="6"],.bx[data-s="6"]{--c:' + STAR[6] + ';--cl:#ffe6d6}',
    '.bx-chips{display:flex;flex-wrap:nowrap;gap:5px}.bx-chips .bx-chip{white-space:nowrap}',
    '.bx-chip{padding:4px 10px;border-radius:50px;font-size:11px;font-weight:800;background:var(--ac-bg-input,#fffbe7);border:1.5px solid var(--ac-border-light,#e5dcc6);color:var(--ink)}',
    // 卡池和闪卡照原型，流光、浮动用独立动画。
    '.bx-banner{position:relative;overflow:hidden;border-radius:20px;padding:12px;color:var(--ink);background:var(--ac-bg-input,#fffbe7);border:2px solid var(--ac-border-light,#e5dcc6);box-shadow:0 3px 0 var(--ac-border-light,#e5dcc6);touch-action:pan-y}',
    '.bx-banner[data-b="limited"]{background:linear-gradient(170deg,#fff0f4,#fffbe7 60%);border-color:#f3c8d4;box-shadow:0 3px 0 #f3c8d4}.bx-track{display:grid}.bx-track .bx-banner{grid-area:1/1}.bx-track .bx-banner[data-active="false"]{visibility:hidden;pointer-events:none}',
    '.bx-banner[data-slide="left"]{animation:bx-slide-left .35s ease-out both}.bx-banner[data-slide="right"]{animation:bx-slide-right .35s ease-out both}',
    '.bx-btop{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:900}.bx-btop b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bx-days{flex:none;margin-left:auto;font-size:10px;font-weight:800;color:var(--soft);white-space:nowrap}',
    '.bx-recruit{width:38px;height:38px;flex:none;object-fit:contain;border-radius:10px;background:#fff;mix-blend-mode:multiply}',
    '.bx-ribbon{flex:none;white-space:nowrap;padding:2px 8px;border-radius:50px;background:#8fb9e8;color:#fff;font-size:10px;font-weight:900}.bx-banner[data-b="limited"] .bx-ribbon{background:#f38bab}',
    '.bx-ups{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:6px;align-items:end;margin:10px 0 8px}',
    '.bx-up{animation:bx-float 3s ease-in-out infinite;animation-delay:var(--phase);cursor:default}.bx-up[data-big="true"] .dp-holo-doll{font-size:44px}',
    '.bx-up .tag{position:absolute;top:7px;left:7px;padding:0 5px;border-radius:50px;background:var(--c);color:#fff;font-size:8.5px;font-weight:900;z-index:2}',
    '.bx-pity{font-size:10.5px;color:var(--soft);margin-bottom:5px}.bx-meter{height:8px;border-radius:50px;background:#efe6cf;overflow:hidden}.bx-meter i{display:block;height:100%;border-radius:50px;background:linear-gradient(90deg,#ffd27a,#ff8f5a)}',
    '.bx-dots{display:flex;justify-content:center;gap:10px}.bx-dot{width:10px;height:10px;padding:0;border-radius:50%;border:1.5px solid var(--ac-primary,#19c8b9);background:transparent;cursor:pointer}.bx-dot[aria-pressed="true"]{background:var(--ac-primary,#19c8b9)}',
    '.bx-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}',
    '.bx-btn{font:inherit;font-size:12px;font-weight:800;padding:8px 4px;border-radius:16px;border:0;cursor:pointer;color:#fff;background:var(--ac-primary,#19c8b9);box-shadow:0 3px 0 var(--ac-primary-active,#11a89b)}.bx-btn small{display:block;font-size:10px;font-weight:700}',
    '.bx-btn.tk{width:100%;background:var(--ac-bg-input,#fffbe7);color:#7a4a00;border:2px solid #dfb949;box-shadow:none}',
    '.bx-btn:active{transform:translateY(2px)}.bx-btn:disabled{opacity:.45;cursor:not-allowed}.bx-note{font-size:10px;color:var(--soft);text-align:center}.bx-note-link{border:0;background:none;color:var(--ac-primary,#19c8b9);font:inherit;font-weight:800;text-decoration:underline;cursor:pointer}',
    // 开盒舞台：夜空底，光一亮就知道几星。
    '.bx-stage{position:relative;overflow:hidden;border-radius:22px;padding:14px 10px 12px;background:radial-gradient(circle at 50% 20%,#3d4a78,#161c33 75%);color:#fff;display:grid;justify-items:center;gap:10px}',
    '.bx-stage canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',
    '.bx-skip{position:absolute;top:8px;right:10px;font:inherit;font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:50px;border:1.5px solid rgba(255,255,255,.5);background:transparent;color:#fff;cursor:pointer;z-index:3}',
    '.bx-slot{position:relative;display:grid;justify-items:center;align-content:end;width:100%;min-height:120px}',
    '.bx-slot{perspective:600px}.bx-crate{position:absolute;left:50%;bottom:26px;width:72px;height:98px;margin-left:-36px;border-radius:12px;background:radial-gradient(circle at 50% 46%,#ffd9de 0 13px,transparent 14px),repeating-linear-gradient(45deg,rgba(255,255,255,.18) 0 6px,transparent 6px 12px),linear-gradient(160deg,#f7a7b4,#e9798d);border:3px solid #fff6ea;box-shadow:0 6px 14px rgba(0,0,0,.35);transform-origin:50% 50%;animation:bx-drop .5s cubic-bezier(.3,1.4,.5,1) both,bx-shake .5s ease-in-out both,bx-flipout .22s ease-in both;animation-delay:var(--d0),var(--d1),var(--d3)}',
    '.bx-crate::before{content:"";position:absolute;inset:-4px;border-radius:14px;box-shadow:0 0 0 2px var(--c),0 0 18px 6px var(--c);opacity:0;animation:bx-leak .6s ease-out both;animation-delay:var(--d2)}',
    '.bx-crate::after{content:"🐽";position:absolute;inset:0;display:grid;place-items:center;font-size:22px;filter:saturate(.8)}',
    '.bx-beam{position:absolute;left:50%;bottom:40px;width:46px;height:160px;margin-left:-23px;background:linear-gradient(transparent,var(--c));filter:blur(6px);opacity:0;animation:bx-beam .9s ease-out both;animation-delay:var(--d3)}',
    '.bx-fig{position:relative;display:grid;justify-items:center;opacity:0;animation:bx-flipin .38s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--d3)}.bx-card{position:relative;display:grid;justify-items:center;align-content:center;width:84px;height:112px;padding:6px 4px;border-radius:13px;background:linear-gradient(145deg,var(--c),var(--cl));box-shadow:0 0 16px var(--c)}.bx-card-in{position:absolute;inset:4px;border-radius:10px;background:radial-gradient(circle at 50% 38%,#fff 0 34%,var(--cl) 100%);overflow:hidden}.bx-card-in::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 25%,rgba(255,140,210,.3) 40%,rgba(130,220,255,.32) 50%,rgba(255,240,150,.32) 60%,transparent 75%);background-size:260% 260%;animation:bx-sheen 2.4s linear infinite}',
    '.bx-fig .em{position:relative;font-size:46px;line-height:1.1;filter:drop-shadow(0 4px 3px rgba(80,60,40,.25))}',
    '.bx-ped{position:relative;width:48px;height:8px;margin-top:-4px;border-radius:50%;background:rgba(120,90,60,.18)}.bx-card b{position:relative;margin-top:3px;font-size:11.5px;font-weight:900;color:#6b4a2a}',
    '.bx-fig>b{display:none}',
    '.bx-stars{display:flex;gap:1px;font-size:12px;color:var(--c)}.bx-stars span{opacity:0;animation:bx-star .2s ease-out both}',
    '.bx-tag{margin-top:2px;font-size:9.5px;font-weight:800;color:#ffd7a8}',
    '.bx-new{position:absolute;top:-4px;right:-10px;padding:0 5px;border-radius:50px;background:#ff5d6c;color:#fff;font-size:8.5px;font-weight:900}',
    '.bx-ten{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;width:100%;margin-top:18px}',
    '.bx-ten .bx-slot{min-height:84px}',
    '.bx-ten .bx-crate{width:40px;height:56px;margin-left:-20px;bottom:30px;border-radius:8px;border-width:2px;background:radial-gradient(circle at 50% 46%,#ffd9de 0 8px,transparent 9px),repeating-linear-gradient(45deg,rgba(255,255,255,.18) 0 4px,transparent 4px 8px),linear-gradient(160deg,#f7a7b4,#e9798d)}',
    '.bx-ten .bx-crate::after{font-size:13px}.bx-ten .bx-card{width:100%;max-width:46px;height:62px;padding:3px 2px;border-radius:9px}.bx-ten .bx-card-in{inset:3px;border-radius:7px}',
    '.bx-ten .bx-crate::before{border-radius:10px;box-shadow:0 0 0 2px var(--c),0 0 10px 3px var(--c)}',
    '.bx-sum{font-size:11px;font-weight:800;color:#ffd7a8;text-align:center;opacity:0;animation:bx-fade .3s ease-out both;animation-delay:var(--dend)}',
    '.bx-ten .bx-beam{width:30px;height:90px;margin-left:-15px}',
    '.bx-ten .bx-fig{width:100%;min-width:0}.bx-ten .bx-slot{min-width:0}.bx-ten .bx-fig .em{font-size:22px}.bx-ten .bx-ped{width:28px;height:5px;margin-top:-3px}',
    '.bx-ten .bx-card b{font-size:8.5px;max-width:42px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bx-ten .bx-stars{font-size:7.5px}.bx-ten .bx-tag{font-size:8px;text-align:center}',
    '.bx-ten .bx-new{right:-6px}',
    '.bx-say{font-size:13px;font-weight:900;text-align:center;opacity:0;animation:bx-fade .3s ease-out both;animation-delay:var(--dend)}',
    '.bx-done{font:inherit;font-size:12px;font-weight:900;padding:7px 22px;border-radius:50px;border:0;background:#fff;color:#22304d;cursor:pointer;opacity:0;animation:bx-fade .3s ease-out both;animation-delay:var(--dend)}',
    '@keyframes bx-drop{0%{transform:translateY(-90px);opacity:0}100%{transform:translateY(0);opacity:1}}',
    '@keyframes bx-shake{0%,100%{rotate:0deg}25%{rotate:-7deg}50%{rotate:6deg}75%{rotate:-4deg}}',
    '@keyframes bx-leak{0%{opacity:0}100%{opacity:1}}',
    '@keyframes bx-gone{to{opacity:0;transform:scale(1.25)}}',
    '@keyframes bx-beam{0%{opacity:0}35%{opacity:.95}100%{opacity:0}}',
    '@keyframes bx-flipout{0%{transform:rotateY(0)}100%{transform:rotateY(90deg);opacity:0}}@keyframes bx-flipin{0%{opacity:0;transform:rotateY(-90deg) scale(.9)}100%{opacity:1;transform:none}}@keyframes bx-sheen{0%{background-position:100% 100%}100%{background-position:0 0}}',
    '@keyframes bx-pop{0%{opacity:0;transform:scale(.3) translateY(16px)}100%{opacity:1;transform:none}}',
    '@keyframes bx-star{0%{opacity:0;transform:scale(1.8)}100%{opacity:1;transform:none}}',
    '@keyframes bx-fade{to{opacity:1}}',
    '@keyframes bx-float{50%{transform:translateY(-3px)}}',
    '@keyframes bx-slide-left{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}@keyframes bx-slide-right{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion:reduce){.bx-stage *,.bx-up,.bx-banner{animation-duration:.01s!important;animation-delay:0s!important}}',
  ].join('\n')
  var seenId = null
  var startedId = null
  var startedAt = 0
  var skipped = {}
  var confettiDone = {}
  var activeBanner = 'standard'
  var bannerTimer = null
  var bannerHover = false
  var bannerRerender = null
  var bannerSlide = null
  function armBannerTimer() {
    clearTimeout(bannerTimer)
    bannerTimer = null
    if (bannerHover || !bannerRerender) return
    bannerTimer = setTimeout(function () { switchBanner(activeBanner === 'standard' ? 'limited' : 'standard', 'left') }, 6000)
  }
  function switchBanner(key, direction) {
    if (key === activeBanner) return
    activeBanner = key
    bannerSlide = direction
    armBannerTimer()
    if (bannerRerender) bannerRerender()
  }
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return
    var style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = CSS
    ;(document.head || document.body).appendChild(style)
  }
  var starText = function (n) { return new Array(n + 1).join('★') }
  var byKey = function (data, key) { return data.catalog.find(function (f) { return f.key === key }) }
  /** 撒彩纸（6★ 才撒）。 */
  function confetti(stage, delayMs) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setTimeout(function () {
      if (!stage.isConnected) return
      var canvas = document.createElement('canvas')
      stage.appendChild(canvas)
      var w = canvas.width = stage.clientWidth || 280
      var h = canvas.height = stage.clientHeight || 220
      var ctx = canvas.getContext && canvas.getContext('2d')
      if (!ctx) return
      var colors = ['#ff7a2f', '#ffd54a', '#ff9ad5', '#7ad7ff', '#ffffff', '#ffb347']
      var bits = []
      for (var i = 0; i < 90; i += 1) bits.push({ x: w / 2, y: h * 0.42, vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 9 - 3, r: Math.random() * 6, s: 4 + Math.random() * 4, c: colors[i % colors.length], spin: (Math.random() - 0.5) * 0.4 })
      var start = performance.now()
      ;(function frame(now) {
        var t = now - start
        ctx.clearRect(0, 0, w, h)
        bits.forEach(function (b) {
          b.vy += 0.28; b.x += b.vx; b.y += b.vy; b.r += b.spin
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.globalAlpha = Math.max(0, 1 - t / 1900)
          ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore()
        })
        if (t < 1900) requestAnimationFrame(frame); else canvas.remove()
      })(start)
    }, Math.max(0, delayMs))
  }
  /** 一个格子：箱子（落下、摇、漏光、消失）→ 光柱 → 摆件 + 星星。t 是各阶段相对现在的秒数。 */
  function slot(app, data, got, t) {
    var f = byKey(data, got.key)
    var box = app.el('div', 'bx-slot')
    box.setAttribute('data-s', String(got.stars))
    var set = function (node, name, sec) { node.style.setProperty(name, sec.toFixed(2) + 's') }
    var crate = app.el('i', 'bx-crate')
    set(crate, '--d0', t.drop); set(crate, '--d1', t.shake); set(crate, '--d2', t.leak); set(crate, '--d3', t.open)
    box.appendChild(crate)
    if (got.stars >= 5) {
      var beam = app.el('i', 'bx-beam')
      set(beam, '--d3', t.open)
      box.appendChild(beam)
    }
    var figure = app.el('div', 'bx-fig')
    set(figure, '--d3', t.open + 0.05)
    // 卡背翻过来就是一张闪卡：星级色边框、彩虹闪光，娃娃站在卡面上。
    var card = app.el('div', 'bx-card')
    card.appendChild(app.el('i', 'bx-card-in'))
    card.appendChild(app.el('span', 'em', f.emoji))
    card.appendChild(app.el('i', 'bx-ped'))
    card.appendChild(app.el('b', null, f.label))
    figure.appendChild(card)
    var stars = app.el('div', 'bx-stars')
    for (var i = 0; i < got.stars; i += 1) {
      var s = app.el('span', null, '★')
      s.style.animationDelay = (t.open + 0.25 + i * 0.1).toFixed(2) + 's'
      stars.appendChild(s)
    }
    figure.appendChild(stars)
    // NEW 的也留一行字，十连里各格子才对得齐。
    if (got.isNew) { figure.appendChild(app.el('span', 'bx-new', 'NEW')); figure.appendChild(app.el('span', 'bx-tag', '首次获得')) }
    else figure.appendChild(app.el('span', 'bx-tag', '潜能 ' + got.potential + (!t.ten && got.certs > 0 ? ' · 凭证 +' + got.certs : '')))
    box.appendChild(figure)
    return box
  }
  /** 刚寻访的那一次。返回是不是第一次画（要滚到最上面）。 */
  function renderReveal(app, data) {
    var last = data.last
    if (!last || last.id === seenId) return false
    var fresh = startedId !== last.id
    if (fresh) { startedId = last.id; startedAt = Date.now() }
    var elapsed = skipped[last.id] ? 99 : (Date.now() - startedAt) / 1000
    var ten = last.items.length > 1
    var stage = app.el('div', 'bx bx-stage')
    // 十连还没翻完才有「跳过」；翻完了它自己消失。
    var lastOpen = 1.2 + (last.items.length - 1) * 0.25
    if (ten && !skipped[last.id] && elapsed < lastOpen) {
      var skip = app.button('bx-skip', { 'data-bx-skip': '1' }, function () { skipped[last.id] = true; app.rerender && app.rerender() })
      skip.textContent = '跳过 ›'
      skip.style.animation = 'bx-gone .2s ease-in both'
      skip.style.animationDelay = (lastOpen - elapsed).toFixed(2) + 's'
      stage.appendChild(skip)
    }
    var holder = ten ? app.el('div', 'bx-ten') : stage
    var end = 0
    last.items.forEach(function (got, i) {
      // 单抽：0 落下、0.5 摇、0.8 漏光、1.4 打开；十连：箱子一起落下漏光，1.2 秒起每 0.25 秒翻开一个。
      var open = ten ? 1.2 + i * 0.25 : 1.4
      var t = { drop: ten ? i * 0.03 : 0, shake: ten ? 0.45 : 0.5, leak: ten ? 0.7 : 0.8, open: open }
      for (var k in t) t[k] -= elapsed
      t.ten = ten
      holder.appendChild(slot(app, data, got, t))
      end = Math.max(end, open + 0.4 + got.stars * 0.1)
      if (got.stars === 6 && !confettiDone[last.id + ':' + i] && !skipped[last.id]) {
        confettiDone[last.id + ':' + i] = true
        confetti(stage, (open - elapsed + 0.1) * 1000)
      }
    })
    if (ten) stage.appendChild(holder)
    stage.style.setProperty('--dend', (end - elapsed).toFixed(2) + 's')
    var six = last.items.some(function (got) { return got.stars === 6 })
    stage.appendChild(app.el('div', 'bx-say', six ? '✨ 六星！✨' : (ten ? '寻访完成' : '')))
    if (ten) {
      var fresh = last.items.filter(function (got) { return got.isNew }).length
      var certs = last.items.reduce(function (sum, got) { return sum + got.certs }, 0)
      stage.appendChild(app.el('div', 'bx-sum', '新的 ' + fresh + ' 个' + (certs > 0 ? ' · 资质凭证 +' + certs : '')))
    }
    var done = app.button('bx-done', { 'data-bx-done': '1' }, function () { seenId = last.id; app.rerender && app.rerender() })
    done.textContent = '收下'
    stage.appendChild(done)
    app.content.appendChild(stage)
    return fresh
  }
  function renderBanners(app, data) {
    bannerRerender = app.rerender
    if (!data.banners.some(function (b) { return b.key === activeBanner })) activeBanner = data.banners[0].key
    if (!bannerTimer && !bannerHover) armBannerTimer()
    var chips = app.el('div', 'bx-chips')
    chips.appendChild(app.el('span', 'bx-chip', '🪙 ' + data.coins))
    chips.appendChild(app.el('span', 'bx-chip', '🎟 ×' + data.tickets))
    chips.appendChild(app.el('span', 'bx-chip', '📜 ' + data.certs))
    app.content.appendChild(chips)
    var b = data.banners.find(function (entry) { return entry.key === activeBanner })
    if (!b) return
    var track = app.el('div', 'bx-track')
    data.banners.forEach(function (b) {
      var card = app.el('div', 'bx-banner')
      card.setAttribute('data-b', b.key)
      card.setAttribute('data-active', String(b.key === activeBanner))
      if (bannerSlide && b.key === activeBanner) card.setAttribute('data-slide', bannerSlide)
      card.addEventListener('pointerenter', function (event) { if (event.pointerType === 'mouse') { bannerHover = true; clearTimeout(bannerTimer); bannerTimer = null } })
      card.addEventListener('pointerleave', function (event) { if (event.pointerType === 'mouse') { bannerHover = false; armBannerTimer() } })
      var startX = null
      card.addEventListener('pointerdown', function (event) { startX = event.clientX })
      card.addEventListener('pointerup', function (event) {
        if (startX === null || Math.abs(event.clientX - startX) <= 40) return
        switchBanner(b.key === 'standard' ? 'limited' : 'standard', event.clientX < startX ? 'left' : 'right'); startX = null
      })
      card.addEventListener('pointercancel', function () { startX = null })
      var top = app.el('div', 'bx-btop')
      var recruit = document.createElement('img')
      recruit.className = 'bx-recruit'
      recruit.src = '/dsh-piggy/art/feedback/recruit.png'
      recruit.alt = ''
      top.appendChild(recruit)
      top.appendChild(app.el('span', 'bx-ribbon', b.key === 'limited' ? '限时' : '常驻')); top.appendChild(app.el('b', null, b.key === 'limited' ? b.label.replace(/^限时寻访 · /, '') : b.label))
      top.appendChild(app.el('span', 'bx-days', '还剩 ' + b.daysLeft + ' 天')); card.appendChild(top)
      var ups = app.el('div', 'bx bx-ups')
      b.up6.concat(b.up5).forEach(function (key, i) {
        var f = byKey(data, key)
        var up = app.el('div', 'dp-holo bx-up')
        up.setAttribute('data-s', String(f.stars)); up.setAttribute('data-big', String(i === 0)); up.style.setProperty('--phase', '-' + i + 's')
        var face = app.el('div', 'dp-holo-face')
        face.appendChild(app.el('span', 'dp-holo-doll', f.emoji)); face.appendChild(app.el('b', 'dp-holo-name', f.label))
        face.appendChild(app.el('i', 'dp-holo-stars', starText(f.stars))); up.appendChild(face)
        up.appendChild(app.el('span', 'tag', 'UP')); ups.appendChild(up)
      })
      card.appendChild(ups)
      card.appendChild(app.el('div', 'bx-pity', b.since < 50
        ? '六星 2% · 再抽 ' + b.pityLeft + ' 次后，每抽六星概率 +2%（第 99 抽必出）'
        : '六星概率已提升到 ' + Math.round(b.sixChance * 100) + '%'))
      var meter = app.el('div', 'bx-meter')
      var fill = app.el('i')
      fill.style.width = Math.min(100, b.since / 99 * 100) + '%'; meter.appendChild(fill)
      card.appendChild(meter); track.appendChild(card)
    })
    bannerSlide = null; app.content.appendChild(track)
      var dots = app.el('div', 'bx-dots')
      data.banners.forEach(function (entry) {
        var dot = app.button('bx-dot', { 'data-bx-banner': entry.key, 'aria-label': entry.label, 'aria-pressed': String(entry.key === b.key) }, function () { switchBanner(entry.key, entry.key === 'limited' ? 'left' : 'right') })
        dots.appendChild(dot)
      })
      app.content.appendChild(dots)
      var row = app.el('div', 'bx-row')
      var one = app.button('bx-btn', { 'data-bx-one': b.key }, function () { app.send('open', { banner: b.key, count: 1 }) })
      one.appendChild(app.el('span', null, '寻访 1 次')); one.appendChild(app.el('small', null, data.coins < data.prices.one ? '金币不够' : data.prices.one + ' 🪙'))
      one.disabled = data.coins < data.prices.one; row.appendChild(one)
      var ten = app.button('bx-btn', { 'data-bx-ten': b.key }, function () { app.send('open', { banner: b.key, count: 10 }) })
      ten.appendChild(app.el('span', null, '寻访 10 次')); ten.appendChild(app.el('small', null, data.coins < data.prices.ten ? '金币不够' : data.prices.ten + ' 🪙'))
      ten.disabled = data.coins < data.prices.ten; row.appendChild(ten); app.content.appendChild(row)
      if (data.tickets > 0) {
        var free = app.button('bx-btn tk', { 'data-bx-ticket': b.key }, function () { app.send('open', { banner: b.key, count: 1, ticket: true }) })
        free.textContent = '🎟 用盲盒券寻访 1 次（有 ' + data.tickets + ' 张）'; app.content.appendChild(free)
      }
      setTimeout(function () { var card = track.querySelector('[data-active="true"]'); if (card && card.isConnected && !card.matches(':hover') && bannerHover) { bannerHover = false; armBannerTimer() } }, 0)
  }
  function render(app) {
    ensureStyle()
    var data = app.data
    if (!data || !Array.isArray(data.banners)) { app.content.appendChild(app.el('div', 'dp-empty', '盲盒还在准备……')); return }
    if (seenId === null) seenId = data.last ? data.last.id : 0
    var outer = app.content
    var root = app.el('div', 'bx')
    app.content = root
    var fresh = renderReveal(app, data)
    renderBanners(app, data)
    var note = app.el('div', 'bx-note', '收集到的摆件在 ')
    var link = app.button('bx-note-link', { 'data-bx-dex': 'figures' }, function () { if (app.openDex) app.openDex('figures') })
    link.textContent = '图鉴 → 摆件'; note.appendChild(link); root.appendChild(note)
    app.content = outer
    outer.appendChild(root)
    // 面板重画后会把滚动位置放回去，所以等这一轮画完再滚到最上面看结果。
    if (fresh) setTimeout(function () { outer.scrollTop = 0 }, 0)
  }

  if (window.dshPiggyExtensions) window.dshPiggyExtensions.register('blindbox', { render: render })
})()
