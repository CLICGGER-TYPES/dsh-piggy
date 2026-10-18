/**
 * dsh-piggy · client — the floating pig.
 *
 * The pet and its app panel use raw DOM. Host values pass through normalize()
 * before rendering. Framework loaders call mountGame through their own adapter.
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
import { attachAutoCollapse } from './auto-collapse.js'
import { readPosition } from './position.js'
import { attachDevMode } from './dev-mode.js'
import { readStore, writeStore } from './storage.js'
import { attachUpdateNotice } from './update-notice.js'
import { updatesBridge } from './tabs/update.js'
import { arr, num, obj, str } from './values.js'
import { desktop } from './desktop/index.js'
import { attachLife } from './life.js'
import { playPigPet } from './pig-actions.js'
import { forceFeedbackArt, setArtSwapHook, syncPigArt } from './art.js'
import { attachGestures } from './gestures.js'
import { createFeel } from './feel/index.js'
import { configureSound } from './sound.js'
import { createBirthday } from './birthday.js'
import { attachSizePreference } from './pig-size.js'
export function mountGame() {
    var devMode = false

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
        progressWrap, progressFill, pokeHint, dailyHint, pomoHint, soul, pigArt, pigSleep, pigEmoji, pig, pigHold, pigBody, dressSlots, bar, content, footer } = parts

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
      var cardEdit = null, profileDraft = null

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
      // 物理层：A1 原地手感 + A2 抛出。装不上（测试环境/旧浏览器）时自己退回 off。
      var feel = createFeel({
        pig: pig, pigHold: pigHold, pigBody: pigBody, scene: scene, host: host,
        pigArt: pigArt, pigEmoji: pigEmoji, burst: /** @type {any} */ (burst),
        getShell: desktopShell,
        isQuiet: function () { return view.dialogue.quiet === true },
        onGeometry: function () { desktopShell()?.syncGeometry?.() },
      })
      configureSound({ isQuiet: function () { return view.dialogue.quiet === true } })
      setArtSwapHook(function (apply) { feel.coverSwap(apply) })
      fx.setFeel(feel)

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
        get cardEdit() { return cardEdit }, set cardEdit(next) { cardEdit = next }, get profileDraft() { return profileDraft }, set profileDraft(next) { profileDraft = next },
        get isOpen() { return isOpen }, set isOpen(next) { isOpen = next },
        get lastStage() { return lastStage }, set lastStage(next) { lastStage = next },
        get lastPendingAt() { return lastPendingAt }, set lastPendingAt(next) { lastPendingAt = next },
        get lastPendingId() { return lastPendingId }, set lastPendingId(next) { lastPendingId = next },
        get userRight() { return userRight }, set userRight(next) { userRight = next },
        get userBottom() { return userBottom }, set userBottom(next) { userBottom = next },
        get busy() { return busy }, set busy(next) { busy = next },
        justBought: null, homePage: 0,
        get stopped() { return stopped }, set stopped(next) { stopped = next },
        get feel() { return feel },
        get devMode() { return devMode },
      }
      var layout = createLayout(ctx)
      var panel = createPanel(ctx)
      ctx.select = panel.select
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
      ctx.petShy = function () { playPigPet(pig) } // 摸猪害羞：本窗口直接播；面板窗口里 attachLife 是 null，wireSplit 会换成转发（PIG_FX: petShy）
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

      // 手势：单击 / 来回摸 / 拖动 / 拎起 / 空中接住。窗口延迟到 4px 才开始动。
      var gestures = attachGestures({
        scene: scene, host: host, pig: pig, feel: feel,
        getView: function () { return view },
        send: send,
        pokeBox: pokeBox,
        getRight: function () { return userRight }, setRight: function (value) { userRight = value },
        getBottom: function () { return userBottom }, setBottom: function (value) { userBottom = value },
        clampPig: clampPig, fitPanel: fitPanel,
        desktopShell: desktopShell, isDesktop: deskShell !== null,
        writePosition: function () { writeStore(POSITION_KEY, JSON.stringify({ right: userRight, bottom: userBottom })) },
      })

      scene.addEventListener('contextmenu', function (event) {
        event.preventDefault()
        setOpen(!isOpen)
      })

      var autoCollapse = splitRole !== null ? { dispose: function () {} } : attachAutoCollapse({
        host: host, isOpen: function () { return isOpen }, setOpen: setOpen,
        isDragging: function () { return gestures.isDragging() },
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
      var life = splitRole === 'panel' || splitRole === 'ext' ? null : attachLife({
        send: send, isStopped: function () { return stopped }, isBusy: function () { return busy },
        isOpen: function () { return isOpen }, getView: function () { return view }, isDragging: function () { return gestures.isDragging() },
        pig: pig, pigArt: pigArt, pigEmoji: pigEmoji, burst: /** @type {any} */ (burst), showBubble: /** @type {any} */ (showBubble), desktopShell: desktopShell,
        feel: feel,
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
        panel.dispose()
        stopSizePreference()
        updateNotice.stop()
        stopResize()
        autoCollapse.dispose()
        gestures.dispose()
        panel.dispose()
        // #11: the console handle outlived the pig, so a reload could toggle a
        // panel that had already been disposed.
        dev.dispose()
        if (pollTimer !== null) window.clearInterval(pollTimer)
        life?.dispose()
        setArtSwapHook(null)
        fx.setFeel(null)
        feel.dispose()
        fx.dispose()
        pollTimer = null
        host.remove()
        style.remove()
        font.remove()
      }

      return dispose
    }

    installCapture()
    try { return mount() }
    catch (error) {
      console.warn('[dsh-piggy] 挂载失败，猪先退到一边', error)
      record('error', 'mount', '挂载失败：' + (error instanceof Error ? error.message : String(error)), { stack: error instanceof Error ? error.stack : '' })
      return () => {}
    }
}

export { desktop }

/** 保留原单文件插件的返回形状，宿主加载逻辑留在适配器中。 */
export function createClientPlugin() {
  const exports = { name: 'dsh-piggy', apply: mountGame, desktop }
  exports.desktop = desktop
  return exports
}
