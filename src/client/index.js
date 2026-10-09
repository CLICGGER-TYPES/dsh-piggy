/**
 * dsh-piggy · client — the floating pig.
 *
 * The DSH loader receives the bundle built from src/client/. The pet and its
 * app panel use raw DOM. Host values pass through normalize() before rendering.
 */

import { createEffects } from './effects.js'
import { createIo } from './io.js'
import { installCapture, record } from './journal.js'
import { createLayout } from './layout.js'
import { createPanel } from './panel.js'
import { createScene } from './scene.js'
import { CSS } from './styles.js'
import { ACT_URL, ART_URL, BOX_POKES_TO_OPEN, BOX_POKE_LINES, CARE_LABEL, DEV_TAB, KIND_ORDER, KIND_TITLE, MOUNTED, MODES, NO_ITEM_LINE, OPEN_KEY, PANEL_GAP, PANEL_MARGIN, PANEL_MIN_HEIGHT, PANEL_WIDTH, PIG_PADDING_X, POLL_MS, POSITION_KEY, SCENE_RESERVE, STAGES, STATE_URL, TABS } from './constants.js'
import { button, el, meter } from './dom.js'
import { normalize } from './normalize.js'
import { desktopShell } from './desktop-shell.js'
import { wireSplit } from './split.js'
import { startDragHeartbeat } from './drag-heartbeat.js'
import { attachAutoCollapse } from './auto-collapse.js'
import { readPosition } from './position.js'
import { attachDevMode } from './dev-mode.js'
import { readStore, writeStore } from './storage.js'
import { attachUpdateNotice } from './update-notice.js'
import { updatesBridge } from './tabs/update.js'
import { arr, num, obj, str } from './values.js'
import { desktop } from './desktop/index.js'
import { attachLife } from './life.js'
import { forceFeedbackArt, syncPigArt } from './art.js'
import { createBirthday } from './birthday.js'
import { partAt } from './pet-parts.js'
import { attachSizePreference } from './pig-size.js'
/** @type {any} */ (window).__ModuleLoader__.load({
  id: 'dsh-piggy',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var devMode = false

    function apply(ctx) {
      // 先把浏览器这半边的日志抓起来：挂载失败也要留下现场（设置 → 日志 → 导出）。
      installCapture()
      // A client plugin that throws while activating can take the whole web boot
      // down with it, so the pig never lets an exception escape.
      try {
        return mount()
      } catch (error) {
        console.warn('[dsh-piggy] 挂载失败，猪先退到一边', error)
        record('error', 'mount', '挂载失败：' + (error instanceof Error ? error.message : String(error)), { stack: error instanceof Error ? error.stack : '' })
        return () => {}
      }
    }

    function mount() {
      if (document.querySelector('[' + MOUNTED + ']') !== null) {
        console.warn('[dsh-piggy] 已存在实例，跳过重复挂载')
        return () => {}
      }

      // Nunito + Noto Sans SC, per the design system's standalone recipe. The
      // request is non-blocking (`display=swap`) and the token font stack falls
      // back to system faces, so an offline or blocked load degrades quietly
      // instead of breaking the panel.
      var parts = createScene()
      var { font, style, host, card, scene, hud, hudName, hudCoins, hudHealth, bubble, work, prop,
        progressWrap, progressFill, pokeHint, dailyHint, pomoHint, soul, pigArt, pigSleep, pigEmoji, pig, dressSlots, bar, content, footer } = parts

      // 桌面版外壳：用时现取（外壳脚本比 client 先跑，但晚到也不能当网页版 —— 那样拖动
      // 只挪页面里的猪、窗口不跟）。
      var deskShell = desktopShell()
      var savedPos = deskShell === null ? readPosition(readStore(POSITION_KEY)) : null
      // The pig's position as the user set it, before any on-screen clamp.
      var userRight = savedPos === null ? 18 : savedPos.right
      var userBottom = savedPos === null ? 18 : savedPos.bottom
      // 桌面版位置归外壳管（它把猪钉在窗口的锚边上）。这里再写 right/bottom 会和外壳的
      // left/top 一起把 host 拉宽拉高，猪就被挤跑了 —— 实测面板一开猪会漂 207px。
      if (deskShell === null) {
        host.style.right = userRight + 'px'
        host.style.bottom = userBottom + 'px'
      } else {
        host.style.right = 'auto'
        host.style.bottom = 'auto'
      }

      // Keep the pig itself on screen — and nothing more. There used to be a
      // composer-avoidance floor here that forced the widget above the input box:
      // it existed because the wrapper swallowed clicks aimed at the send button.
      // `pointer-events:none` solves that properly now, so the clamp only ever
      // stopped the user from parking their pet where they wanted it.

      /**
       * Place the panel so it is fully on screen, wherever the pig has been
       * parked. The pig itself is never moved by this: the panel is absolutely
       * positioned, so it takes no space in the wrapper's box.
       */

      var icons = {}

      // ---- state ----
      var view = normalize(null)
      var stopSizePreference = attachSizePreference(host,
        () => view.hatched ? view.pig?.stage : view.boxStage,
        () => desktopShell()?.syncGeometry?.())
      // B9: the panel opens on the home screen of app tiles.
      var tab = 'home'
      var stage = 'primary'
      // 用户自己点过学段之后，轮询就不许再替他改（B1 的「默认学段」只在没选过时生效）。
      var stagePicked = false
      // B8: which category each tile tab is opened into (null = the top layer), and a picked tile inside it.
      var drill = { study: null, shop: null, bag: null, work: null, dex: null, skins: null, pick: null, from: null }
      // Which care action's item picker is open, if any.
      var picker = null
      // The owner-name draft while it is being edited on the status tab (null = not editing).
      var ownerEdit = null
      // 猪的名字草稿（同上：编辑期间轮询不许重绘，否则输入框会丢焦点）。
      var pigNameEdit = null
      // 居民卡: { field: 'catchphrase'|'motto', draft } while one is being edited.
      var cardEdit = null

      /** The tabs get an explicit context instead of closing over the shell locals. */
      // 桌面版启动总是收起（几何未到时按「开着」摆面板，窗口会连翻几次）；网页版照旧。
      var isOpen = desktopShell() === null && readStore(OPEN_KEY) === 'true'
      var lastStage = null
      var lastPendingAt = 0
      var lastPendingId = 0
      var pollTimer = null
      var fx = createEffects({
        scene: scene, pig: pig, pigArt: pigArt, pigEmoji: pigEmoji, card: card, bubble: bubble, pomoHint: pomoHint,
        isStopped: function () { return stopped },
      })
      var react = fx.react, burst = fx.burst, flash = fx.flash
      var showBubble = fx.showBubble, showLine = fx.showLine, toast = fx.toast
      var stopped = false
      var busy = false

      /** The shell hands the modules an explicit context instead of sharing a scope. */
      var ctx = {
        host: host,
        card: card,
        content: content,
        footer: footer,
        scene: scene,
        hud: hud,
        hudName: hudName,
        hudCoins: hudCoins,
        hudHealth: hudHealth,
        bubble: bubble,
        work: work,
        prop: prop,
        progressWrap: progressWrap,
        progressFill: progressFill,
        pokeHint: pokeHint,
        dailyHint: dailyHint,
        pomoHint: pomoHint,
        soul: soul,
        pigArt: pigArt,
        pigSleep: pigSleep,
        pigEmoji: pigEmoji,
        pig: pig,
        dressSlots: dressSlots,
        bar: bar,
        icons: icons,
        flash: flash,
        react: react,
        burst: burst,
        transform: fx.transform,
        showBubble: showBubble,
        showLine: showLine,
        toast: toast,
        get view() { return view }, set view(next) { view = next },
        get tab() { return tab }, set tab(next) { tab = next },
        get stage() { return stage }, set stage(next) { stage = next },
        get stagePicked() { return stagePicked }, set stagePicked(next) { stagePicked = next },
        get tapVersion() { return dev.tap },
        get devOff() { return function () { dev.set(false) } },
        get drill() { return drill },
        get picker() { return picker }, set picker(next) { picker = next },
        get ownerEdit() { return ownerEdit }, set ownerEdit(next) { ownerEdit = next },
        get pigNameEdit() { return pigNameEdit }, set pigNameEdit(next) { pigNameEdit = next },
        get cardEdit() { return cardEdit }, set cardEdit(next) { cardEdit = next },
        get isOpen() { return isOpen }, set isOpen(next) { isOpen = next },
        get lastStage() { return lastStage }, set lastStage(next) { lastStage = next },
        get lastPendingAt() { return lastPendingAt }, set lastPendingAt(next) { lastPendingAt = next },
        get lastPendingId() { return lastPendingId }, set lastPendingId(next) { lastPendingId = next },
        get userRight() { return userRight }, set userRight(next) { userRight = next },
        get userBottom() { return userBottom }, set userBottom(next) { userBottom = next },
        get busy() { return busy }, set busy(next) { busy = next },
        justBought: null, homePage: 0,
        get stopped() { return stopped }, set stopped(next) { stopped = next },
        get devMode() { return devMode },
      }
      var layout = createLayout(ctx)
      var panel = createPanel(ctx)
      ctx.select = panel.select
      ctx.setOpen = panel.setOpen
      ctx.fitPanel = layout.fitPanel
      ctx.paintBar = layout.paintBar
      ctx.buildIcon = layout.buildIcon
      ctx.clampPig = layout.clampPig
      var render = panel.render, renderContent = panel.renderContent
      var setOpen = panel.setOpen, select = panel.select
      var fitPanel = layout.fitPanel, clampPig = layout.clampPig
      var paintBar = layout.paintBar, buildIcon = layout.buildIcon
      for (var t = 0; t < TABS.length; t += 1) buildIcon(TABS[t])
      var io = createIo(ctx)
      var send = io.send, refresh = io.refresh
      ctx.send = send
      ctx.render = render
      ctx.renderContent = renderContent
      ctx.setOpen = setOpen
      ctx.fitPanel = fitPanel
      ctx.flash = flash

      var updateNotice = attachUpdateNotice(ctx, updatesBridge)
      // 调试页「立绘」：指定一张反馈图、做指定的小动作。桌面版面板窗口里 wireSplit 会把它们换成转给猪窗口。
      ctx.previewArt = function (name) { forceFeedbackArt(name); syncPigArt(pig, pigArt, pigEmoji) }
      ctx.idleNow = function (key) { if (ctx.life) ctx.life.idleNow(key) }
      ctx.walkNow = function () { if (ctx.life) ctx.life.walkNow() }
      var birthday = createBirthday({ ctx: ctx, pig: pig, pigArt: pigArt, pigEmoji: pigEmoji, burst: burst, render: function () { refresh() } })
      // 外壳 0.6.0 起猪和面板各一个窗口（split.js）；老外壳和网页版是 null。
      var splitRole = wireSplit(ctx, { refresh: function () { refresh() }, isFishing: function () { return tab === 'fishing' && view.fishing.pending?.phase === 'hooked' } })

      // 日常气泡（签到/礼包）的点击只在这里绑一次；它压在猪上面，事件不能冒泡给
      // 拖动和摸摸。
      ;['pointerdown', 'pointerup'].forEach(function (type) { dailyHint.addEventListener(type, function (event) { event.stopPropagation() }) }) // 松开也不能冒泡：会被当成摸猪（rc.1 的 bug）
      dailyHint.addEventListener('click', function (event) {
        event.stopPropagation()
        var action = dailyHint.getAttribute('data-action')
        if (action === 'cake') birthday.celebrate()
        else if (action !== null && action !== '') send(action)
      })

      /**
       * Developer tab. Drives the pig into any state so a change can be looked at
       * immediately instead of waiting days for it — and so the states that are
       * hard to reach by playing (dying, the last illness stage, an elder pig)
       * can be checked at all.
       */

      // ---- drag the pig; right-click it for the menu ----
      var drag = null
      var stopDragHeartbeat = function () {}
      scene.addEventListener('pointerdown', function (event) {
        if (event.button !== 0) return
        stopDragHeartbeat()
        drag = {
          x: event.clientX, y: event.clientY,
          startX: typeof event.screenX === 'number' ? event.screenX : event.clientX,
          startY: typeof event.screenY === 'number' ? event.screenY : event.clientY,
          lastX: typeof event.screenX === 'number' ? event.screenX : event.clientX,
          lastY: typeof event.screenY === 'number' ? event.screenY : event.clientY,
          right: parseFloat(getComputedStyle(host).right) || 18,
          bottom: parseFloat(getComputedStyle(host).bottom) || 18,
          moved: false,
        }
        scene.setAttribute('data-dragging', 'true')
        scene.setPointerCapture?.(event.pointerId)
        var shellAtStart = desktopShell()
        shellAtStart?.beginDrag?.()
        stopDragHeartbeat = startDragHeartbeat(shellAtStart, function () { return drag !== null })
      })
      scene.addEventListener('pointermove', function (event) {
        if (drag === null) return
        var dx = event.clientX - drag.x
        var dy = event.clientY - drag.y
        // Desktop samples the cursor in the main process; the page detects a pat.
        var shellNow = desktopShell()
        if (shellNow !== null) {
          shellNow.dragHeartbeat?.()
          var screenX = typeof event.screenX === 'number' ? event.screenX : event.clientX
          var screenY = typeof event.screenY === 'number' ? event.screenY : event.clientY
          if (Math.abs(screenX - drag.startX) > 3 || Math.abs(screenY - drag.startY) > 3) drag.moved = true
          if (typeof shellNow.beginDrag !== 'function') {
            var stepX = screenX - drag.lastX
            var stepY = screenY - drag.lastY
            drag.lastX = screenX
            drag.lastY = screenY
            if (stepX !== 0 || stepY !== 0) shellNow.moveBy(stepX, stepY)
          }
          return
        }
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true
        userRight = drag.right - dx
        userBottom = drag.bottom - dy
        clampPig()
        fitPanel()
      })
      function endDrag() {
        if (drag === null) return false
        var moved = drag.moved
        drag = null
        stopDragHeartbeat()
        stopDragHeartbeat = function () {}
        desktopShell()?.endDrag?.()
        scene.removeAttribute('data-dragging')
        clampPig()
        // 桌面版的位置归窗口管（主进程会存），页面不写自己的坐标。
        if (deskShell === null) writeStore(POSITION_KEY, JSON.stringify({ right: userRight, bottom: userBottom }))
        fitPanel()
        return moved
      }
      var boxPokes = 0
      /** Three pokes open the box. */
      function pokeBox() {
        boxPokes += 1
        react('poke', 560)
        if (boxPokes >= BOX_POKES_TO_OPEN) {
          boxPokes = 0
          host.removeAttribute('data-poke')
          showBubble('哇——！', 1200)
          burst(['✨', '🎉', '💨'], 6)
          send('hatch')
          return
        }
        host.setAttribute('data-poke', String(boxPokes))
        burst(['💨'], 2)
        showBubble(BOX_POKE_LINES[boxPokes - 1], 2200)
      }

      // Left click pats; context menu opens the panel.
      scene.addEventListener('pointerup', function (event) {
        // Right click has no drag session; it only opens the menu.
        if (drag === null) return
        if (endDrag()) return
        // An unhatched save is a box, whether or not one exists yet.
        if (view.hatched !== true) {
          pokeBox()
          return
        }
        // 点在猪身上就是摸它，按点的位置告诉核心摸的是哪儿（G 批次）。
        if (!view.dead) send('pet', { part: partAt(pig, event) })
      })
      scene.addEventListener('pointercancel', function () { endDrag() })
      scene.addEventListener('lostpointercapture', function () { endDrag() })
      scene.addEventListener('contextmenu', function (event) {
        event.preventDefault()
        setOpen(!isOpen)
      })

      var autoCollapse = splitRole !== null ? { dispose: function () {} } : attachAutoCollapse({
        host: host, isOpen: function () { return isOpen }, setOpen: setOpen,
        isDragging: function () { return drag !== null },
        isFishing: function () { return tab === 'fishing' && view.fishing.pending?.phase === 'hooked' },
        isDesktop: function () { return desktopShell() !== null },
      })

      // ---- life ----
      clampPig()
      setOpen(isOpen)
      render(view)
      refresh()
      pollTimer = window.setInterval(refresh, POLL_MS)

      // 打招呼、闲聊、按时间说话、自己找事做、桌面散步（G 批次）都在 life.js。
      var life = splitRole === 'panel' ? null : attachLife({
        send: send, isStopped: function () { return stopped }, isBusy: function () { return busy },
        isOpen: function () { return isOpen }, getView: function () { return view }, isDragging: function () { return drag !== null },
        pig: pig, pigArt: pigArt, pigEmoji: pigEmoji, burst: /** @type {any} */ (burst), showBubble: /** @type {any} */ (showBubble), desktopShell: desktopShell,
      })
      ctx.life = life // 调试页「散步一次」「做个小动作」用
      var stopResize = layout.attachResize()

      var dev = attachDevMode({
        setEnabled: function (next) { devMode = next }, host: host, paintBar: paintBar,
        setOpen: setOpen, select: select, showBubble: showBubble,
        getTab: function () { return tab },
      })
      devMode = false

      function dispose() {
        stopped = true
        stopSizePreference()
        stopDragHeartbeat()
        updateNotice.stop()
        stopResize()
        autoCollapse.dispose()
        // #11: the console handle outlived the pig, so a reload could toggle a
        // panel that had already been disposed.
        dev.dispose()
        if (pollTimer !== null) window.clearInterval(pollTimer)
        life?.dispose()
        fx.dispose()
        pollTimer = null
        host.remove()
        style.remove()
        font.remove()
      }

      return dispose
    }

    exports.name = 'dsh-piggy'
    exports.apply = apply; exports.desktop = desktop // 桌面程序 0.3.0 起用游戏包自带的桌面逻辑
    return module.exports
  },
})
