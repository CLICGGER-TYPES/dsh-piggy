// @ts-check
/**
 * 桌面版的页面逻辑（游戏包自带，外壳 0.3.0 起由 renderer/loader.js 调用）。
 *
 * 以前这些都在桌面程序里（renderer/shell.js + main.js），改一点就得让玩家重装桌面程序。
 * 现在桌面程序只提供基础动作（piggyShell.place / setHit / beginDrag …），量尺寸、钉位置、
 * 窗口摆哪、哪里可点都在这里，跟着游戏包热更新。
 */
import { artMarginFor } from '../art-framing.js'
import { displayNote, sameBounds } from './geometry.js'
import { createMeasure, layoutBox } from './measure.js'
import { bodyVisualBounds } from './visual-bounds.js'
import { createPlacement } from './place.js'
import { createWindowClamp } from './window-clamp.js'
import { createFlightBridge } from './flight-bridge.js'
import { commitSlide } from './slide.js'
import { installPanel, startPanel } from './panel-window.js'
import { installExt } from './ext-window.js'
import { DESKTOP_CSS } from './css.js'

/** 页面 ↔ 桌面程序的约定版本：以后桌面程序加新的基础动作时加一。
 * v3：外壳支持 piggyShell.logs.save（导出日志时弹系统「另存为」）。
 * v4：外壳 0.6.0 起猪和面板各一个窗口（piggyShell.role / panel / onStateChanged）。
 * v5：外壳支持 piggyShell.saves.save（二进制存档另存为）。
 * v6：外壳支持 piggyShell.flyMove（A2 抛掷，窗口跟着飞）。 */
export const DESKTOP_VERSION = 6

/** 窗口差这么多以内就不改。取 2 而不是 0/1：Windows 分数缩放下读回来常差 1px，Electron 源码自己也说
 *  GetWindowBoundsInScreen 有约 1px 误差（native_window_views.cc）。贴着噪声改就会来回抖。 */
const TOLERANCE = 2

let bridge = /** @type {any} */ (null)
/** 这个页面在哪个窗口里（外壳 0.6.0 起猪和面板各一个窗口）。 */
let role = /** @type {'pet'|'panel'|'ext'|null} */ (null)
/** 拖动中窗口被夹在屏幕里时，猪在窗口里滑了多少（主进程推来的，见 main.js dragTick）。 */
let dragSlide = { x: 0, y: 0 }
/** 抛掷期间暂停常规摆放：窗口位置由 feel 每帧算好后直接发给主进程。 */
let flying = false
let measure = /** @type {any} */ (null)
let placement = /** @type {any} */ (null)
let lastKey = null
/** 窗口管理器连续拒绝同一个目标时，接受它的实际位置，避免 place→被夹→再 place 的死循环。 */
const windowClamp = createWindowClamp()
let clampNotice = null
let hitRects = []
let lastHit = null
let mouse = { x: -1, y: -1 }
let scheduled = false
/** 页面布局从什么时候开始和窗口尺寸对不上（见 layoutStale）。 */
let staleSince = /** @type {number|null} */ (null)
/** 布局迟迟跟不上窗口尺寸时最多等多久（系统不肯给这个尺寸、或分数缩放取整时，不能一直不量）。 */
const STALE_WAIT_MS = 500

function host() { return /** @type {any} */ (document.querySelector('[data-dsh-pig]')) }
function geometry() { return typeof bridge.geometry === 'function' ? bridge.geometry() : null }
function dragging() {
  const scene = document.querySelector('[data-dsh-pig] .dp-scene')
  return scene !== null && scene.getAttribute('data-dragging') === 'true'
}

function updateHit(x, y) {
  mouse = { x, y }
  if (typeof bridge.setHit !== 'function') return
  let inside = dragging() || flying
  for (let i = 0; !inside && i < hitRects.length; i += 1) {
    const r = hitRects[i]
    inside = x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
  }
  if (inside === lastHit) return
  lastHit = inside
  bridge.setHit(inside)
}

/**
 * 窗口已经改了尺寸、页面还没按新尺寸重排：这时量到的猪位置属于旧布局。
 * 主进程的同步回读（place({})）在 setBounds 之后立刻就是新尺寸，而页面要等 resize 才重排；
 * 拿「新窗口 + 旧布局」去算，猪的位置会差出整整一个尺寸变化量。用户 2026-10-06 的日志里
 * 每点一下猪就往左跑 20px（304↔324 宽），就是这一拍里算出了错的目标，核对又照着它把窗口挪了。
 * @param {{width:number,height:number}} win
 */
function layoutStale(win) {
  return Math.abs(window.innerWidth - win.width) > 1 || Math.abs(window.innerHeight - win.height) > 1
}

function tick() {
  // Direct callers (feel/size/menu hooks) must obey the same ownership rule
  // as schedule(). Native dragging alone decides bounds and its full shape.
  if (dragging() || flying) return
  const h = host()
  if (h === null) return
  const info = readGeometry()
  if (info !== null && info.window && layoutStale(info.window)) {
    // 等页面重排（resize 事件会再排一次 tick）；等太久就照常量，避免系统改不了尺寸时卡死。
    const at = typeof performance === 'object' ? performance.now() : Date.now()
    if (staleSince === null) staleSince = at
    if (at - staleSince < STALE_WAIT_MS) { lastKey = null; schedule(); return }
  }
  staleSince = null
  let next = measure.boxes(h)
  if (next === null) return
  measure.fitWindow(next.content, info?.window)
  const side = measure.sides()
  measure.pin(h, side, next.hostBox, next.contentBox)
  next = measure.boxes(h)
  if (next === null) return

  hitRects = next.shape
  if (mouse.x >= 0) updateHit(mouse.x, mouse.y)

  // 还没拿到窗口在哪：先不摆（以前按 (0,0) 算，启动时会把窗口摆错一次）。几何一到会再量。
  if (info === null || !info.window) { lastKey = null; return }
  // 窗口还在动（X11 下 setBounds 是异步的，回读和页面的 screenX 一时对不上）：这一轮不摆，等它落定。
  if (Math.abs(window.screenX - info.window.x) > 1 || Math.abs(window.screenY - info.window.y) > 1) { lastKey = null; schedule(); return }
  const bounds = info.window
  const areas = info.workAreas ?? [info.workArea]
  // 每一轮都按「家」重新算窗口（不看上一轮算了什么）：上一轮哪怕错了，这一轮按真实布局自己纠正。
  const grownX = side.horizontal === 'right' ? next.content.width - bounds.width : 0
  const grownY = side.vertical === 'bottom' ? next.content.height - bounds.height : 0
  const want = placement.decide({
    width: next.content.width, height: next.content.height, pig: next.pig, artMargin: artMarginFor(next.pig.width),
    visual: bodyVisualBounds(next.pig),
    pigWindow: { x: next.pigBox.x + grownX, y: next.pigBox.y + grownY },
    pigNow: { x: next.pigBox.x, y: next.pigBox.y },
    shift: measure.state.shift,
  }, bounds, areas)
  placement.persist(areas)
  // want 是按「内容没挪过」的布局算的。收起时窗口被夹回工作区（猪贴着屏幕边，窗口的透明留白伸出去了）：
  // 窗口照夹，整块内容在窗口里反向挪同样多，猪的屏幕位置不变，只裁掉透明留白。
  // 以前是窗口连猪一起被推回来——拖到屏幕边上一松手猪就弹开 30～200 多像素（2026-10-06 虚拟机真拖复现）。
  const clamp = placement.clamp()
  const old = measure.state.shift
  const fresh = { x: -clamp.dx, y: -clamp.dy }
  if (fresh.x !== old.x || fresh.y !== old.y) {
    measure.state.shift = fresh
    measure.pin(h, side, next.hostBox, next.contentBox)
    const dx = fresh.x - old.x
    const dy = fresh.y - old.y
    next.shape = next.shape.map(rect => ({ ...rect, x: rect.x + dx, y: rect.y + dy }))
    hitRects = next.shape
  }
  // A desktop-edge scene shift must not carry long speech outside the native
  // window. Re-measure after fitting so drawing and pointer shapes agree.
  measure.fitBubble(h, info)
  next = measure.boxes(h)
  if (next === null) return
  hitRects = next.shape
  const move = !sameBounds(want, bounds, TOLERANCE)
  // 同一个目标连续失败多次：以窗口管理器的实际位置为准重定家，只 place 一次实际位置。
  // 不能在第一帧就接受 —— X11 的 setBounds 是异步的，刚开始回读可能还是旧值。
  const clampState = windowClamp.observe(want, bounds)
  if (clampState === 'accept') {
    const pig = pigInWindow(bounds)
    if (pig !== null) {
      placement.acceptWindow(bounds, pig, areas)
      const notice = JSON.stringify({ want, actual: bounds })
      if (clampNotice !== notice) {
        clampNotice = notice
        console.warn('[piggy-desktop] wm clamp accepted ' + notice)
      }
      lastKey = null
      // 同步主进程的 petAsked：下一次拖动/摆放从实际位置起步，不会先跳回被拒绝的目标。
      bridge.place({ bounds: { ...bounds } })
      return
    }
  }
  const key = measure.keyOf(next)
  if (!move && key === lastKey) return
  lastKey = key
  const request = { shape: next.shape, bounds: move ? want : undefined, pig: undefined }
  // 拆窗口时顺带报猪在窗口里的框（内容可能刚在窗口里挪过）：外壳 0.6.1 起面板按它贴着猪。
  const pigNode = h.querySelector('.dp-pig')
  if (pigNode) request.pig = layoutBox(pigNode)
  // 每次要挪窗口都写进桌面程序日志（piggy.log）：平时开关面板、摸猪不会挪窗口，所以很少写；
  // 万一玩家看到「整块跳一下」，日志里就能看出是哪次、为什么挪。
  if (move) {
    console.warn('[piggy-desktop] move ' + JSON.stringify({ open: h.getAttribute('data-open'), side, from: bounds, to: want,
      home: placement.home(), shift: measure.state.shift,
      content: { w: next.content.width, h: next.content.height }, pigBox: next.pigBox, ghosts: h.querySelectorAll('[data-ghost]').length,
      display: displayNote(info) }))
  }
  bridge.place(request)
}

/** 猪在窗口里的框：页面已按当前窗口重排就量真实布局；还没重排（刚改完窗口）就按家和窗口算。 */
function pigInWindow(win) {
  const h = host()
  const pigNode = h?.querySelector('.dp-pig')
  const size = placement.pigSize()
  const homeTL = placement.homeTopLeft()
  if (pigNode && !layoutStale(win)) return layoutBox(pigNode)
  if (homeTL !== null) return { x: homeTL.x - win.x, y: homeTL.y - win.y, width: size.width, height: size.height }
  return pigNode ? layoutBox(pigNode) : null
}

/** 同步回读真实窗口几何；外壳给不了就退回缓存（老外壳没有同步 place）。 */
function readGeometry() {
  if (typeof bridge.place === 'function') {
    const fresh = bridge.place({})
    if (fresh !== null && fresh !== undefined && fresh.window) return fresh
  }
  return geometry()
}

function schedule() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(function () {
    scheduled = false
    if (!dragging() && !flying) tick()
  })
}

/** loader.js 在挂载游戏之前调用：挂上 __dshPiggyShell，客户端挂载时就按桌面版走。 */
export function install(shell) {
  bridge = shell
  const split = shell.panel !== undefined && typeof shell.panel.toggle === 'function'
  if (!split) {
    // 外壳 0.6.0 以前是单窗口（猪和面板挤一个窗口），这一版游戏包不再支持（manifest 的 minShell 拦着，
    // 正常走不到这里）。万一走到了，不挂桌面接口，页面按网页版跑：猪和面板都在这个窗口里，至少能用。
    console.warn('[piggy-desktop] shell has no split windows（请把桌面程序更新到 0.6.0 以上）')
    ;/** @type {any} */ (window).__dshPiggyShellOutdated = true
    return
  }
  role = shell.role === 'panel' ? 'panel' : shell.role === 'ext' ? 'ext' : 'pet'
  if (role === 'ext') {
    const style = document.createElement('style')
    style.setAttribute('data-piggy-desktop-style', '')
    style.textContent = DESKTOP_CSS
    document.head.appendChild(style)
    installExt(shell)
    return
  }
  if (role === 'panel') {
    const style = document.createElement('style')
    style.setAttribute('data-piggy-desktop-style', '')
    style.textContent = DESKTOP_CSS
    document.head.appendChild(style)
    installPanel(shell)
    return
  }
  document.documentElement.setAttribute('data-piggy-role', 'pet')
  // 外壳能力探测（2026-10-06）：几何逻辑在游戏包里、执行在外壳里，两边版本错配时
  // 以前完全看不出来（minShell 一直是 0.1.0，data-piggy-desktop 也没人读）。
  // 缺关键动作就明确说出来，并且不去做兑现不了的摆放。
  const missing = ['place', 'beginDrag', 'endDrag'].filter(name => typeof shell[name] !== 'function')
  if (missing.length > 0) {
    console.warn('[piggy-desktop] shell is too old, missing: ' + missing.join(', ') + '（请更新桌面程序）')
    ;/** @type {any} */ (window).__dshPiggyShellOutdated = true
  }
  placement = createPlacement()
  measure = createMeasure({ platform: shell.platform || '', geometry })
  const style = document.createElement('style')
  style.setAttribute('data-piggy-desktop-style', '')
  style.textContent = DESKTOP_CSS
  document.head.appendChild(style)
  if (typeof shell.onGeometry === 'function') shell.onGeometry(function () { schedule() })
  if (typeof shell.onDragSlide === 'function') {
    shell.onDragSlide(function (slide) {
      // 松手之后才到的那条不要（松手时已经从同步几何里拿到最终值了）
      if (!dragging()) return
      dragSlide = { x: Number(slide?.x) || 0, y: Number(slide?.y) || 0 }
      const h = host()
      if (h !== null) h.style.translate = dragSlide.x === 0 && dragSlide.y === 0 ? '' : dragSlide.x + 'px ' + dragSlide.y + 'px'
    })
  }
  if (typeof shell.askGeometry === 'function') shell.askGeometry()
  ;/** @type {any} */ (window).__dshPiggyShell = {
    // 面板在另一个窗口里，右键只是叫主进程把它开/关在猪旁边。
    role: 'pet',
    proxy: shell.proxy,
    saves: shell.saves,
    ext: shell.ext,
    fullscreen: shell.fullscreen,
    split: true,
    dragVisualBounds: shell.dragVisualBounds === true,
    onStateChanged: shell.onStateChanged,
    panel: {
      toggle: function (open) {
        const info = readGeometry()
        const pig = info && info.window ? pigInWindow(info.window) : null
        shell.panel.toggle(open, pig === null ? null : { x: pig.x, y: pig.y, width: pig.width, height: pig.height })
      },
      on: shell.panel.on,
      onFx: shell.panel.onFx,
      raisePet: shell.panel.raisePet,
    },
    /** @param {{x:number,y:number}|null} [origin] pointerdown 时的屏幕坐标：延迟到 4px 才开始拖动时，窗口不会落后手指。 */
    beginDrag: function (origin) {
      // 拖动不改变窗口尺寸或钉边偏移；right/bottom 和偏移记录必须保持同一套坐标。
      // 告诉主进程猪在当前窗口里的框，页面尚未重排时按家和窗口算。
      const info = readGeometry()
      const pig = info && info.window ? pigInWindow(info.window) : null
      dragSlide = { x: 0, y: 0 }
      // slide：这个页面会接「猪在窗口里滑」（窗口被夹在屏幕里时），主进程才夹窗口
      if (typeof shell.beginDrag !== 'function') return
      shell.beginDrag(pig === null ? null : { x: pig.x, y: pig.y, width: pig.width, height: pig.height,
        visual: bodyVisualBounds(pig),
        slide: typeof shell.onDragSlide === 'function',
        origin: origin !== null && origin !== undefined && Number.isFinite(origin.x) && Number.isFinite(origin.y)
          ? { x: origin.x, y: origin.y } : undefined })
    },
    dragHeartbeat: function () { if (typeof shell.dragHeartbeat === 'function') shell.dragHeartbeat() },
    endDrag: function (release) {
      if (typeof shell.endDrag !== 'function') return
      shell.endDrag(release ?? null)
      // 拖动结束和同步读几何按 IPC 顺序处理，读到的就是最后一帧之后的窗口。
      const info = readGeometry()
      if (info && info.window) {
        // 猪的新家 = 它此刻真实画在哪（窗口 + 猪在窗口里的框）。拖动是唯一由用户决定位置的事。
        if (info.dragSlide && Number.isFinite(info.dragSlide.x) && Number.isFinite(info.dragSlide.y)) dragSlide = info.dragSlide
        const inWindow = pigInWindow(info.window)
        // 猪真正画在哪 = 窗口 + 猪在窗口里的框 + 拖到屏幕边时在窗口里滑的那一截
        const pig = inWindow === null ? null : { ...inWindow, x: inWindow.x + dragSlide.x, y: inWindow.y + dragSlide.y }
        if (pig !== null) {
          placement.rehome(info.window, pig, info.workAreas ?? [info.workArea])
          // 这里**不再**重挑收起朝向。
          //
          // 每挑一次就可能换一块预留区（上下差 156~272px），窗口尺寸跟着变；模型虽然会把猪
          // 补偿回原位，但窗口是按新几何先画的、页面晚一拍才重排，中间那一两帧猪就画在错的地方
          // —— 用户看到的「松手偶尔瞬移一下」（2026-10-07 win11 日志：drag end 之后 18ms
          // 窗口从 476 高跳到 632 高）。
          // 朝向改由「面板真正打开时」决定（sides()），那时窗口本来就在变；收起态保持稳定。
        }
      }
      // 先在当前窗口内等位交接，避免「旧窗口 + 新布局」闪出错误位置。
      // 下一帧再常规摆放：本轮若紧接着抛出，飞行会接管，不插入一次多余的窗口挪动。
      commitSlide(host(), measure.state, dragSlide)
      dragSlide = { x: 0, y: 0 }
      lastKey = null
      schedule()
    },
    syncGeometry: function () { tick() },
    // 桌面散步（G 批次）：用外壳本来就有的 moveBy 挪窗口，新位置由主进程推回来的几何记住。
    // A2 抛掷：页面算好窗口位置，外壳只 setBounds；旧外壳没有 flyMove，supported=false，
    // 页面自动退回原地落地。具体实现见 flight-bridge.js。
    flight: createFlightBridge({
      shell: shell,
      readGeometry: readGeometry,
      pigInWindow: pigInWindow,
      rehome: function (win, pig, areas) { placement.rehome(win, pig, areas) },
      setFlying: function (on) { flying = on },
      isFlying: function () { return flying },
      clearSlide: function (slide) {
        dragSlide = { x: 0, y: 0 }
        const h = host()
        commitSlide(h, measure.state, slide)
      },
      forgetLayout: function () { lastKey = null },
      tick: tick,
    }),
    moveBy: typeof shell.moveBy === 'function' ? function (dx, dy) {
      shell.moveBy(dx, dy)
      // 散步是猪自己走：走完按窗口真实位置重定家（主进程可能在屏幕边上夹过）。
      const info = readGeometry()
      const pig = info && info.window ? pigInWindow(info.window) : null
      if (pig !== null) placement.rehome(info.window, pig, info.workAreas ?? [info.workArea])
    } : undefined,
  }
  // 系统原生的 title 小提示在 Windows 透明置顶窗口上会画坏：鼠标移上去时改成 aria-label。
  document.addEventListener('mouseover', function (event) {
    const target = /** @type {any} */ (event.target)
    const titled = target !== null && typeof target.closest === 'function' ? target.closest('[title]') : null
    if (titled === null) return
    if (!titled.getAttribute('aria-label')) titled.setAttribute('aria-label', titled.getAttribute('title'))
    titled.removeAttribute('title')
  }, true)
  document.addEventListener('mousemove', function (event) { updateHit(event.clientX, event.clientY) }, true)
  document.documentElement.addEventListener('mouseleave', function () {
    if (dragging()) return
    mouse = { x: -1, y: -1 }
    lastHit = false
    if (typeof shell.setHit === 'function') shell.setHit(false)
  })
}

/** 游戏挂载之后调用：只在内容真的变了时量（DOM 变化、窗口改大小、松手），另有 1 秒兜底。 */
export function start() {
  if (role === 'panel') { startPanel(); return }
  if (role === 'ext') return
  const h = host()
  if (h !== null && typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(h, { subtree: true, childList: true, attributes: true, characterData: true })
  }
  window.addEventListener('resize', schedule)
  window.addEventListener('pointerup', schedule)
  setInterval(function () { if (!dragging() && !flying) tick() }, 1000)
  tick()
}

export const desktop = { version: DESKTOP_VERSION, install, start }
