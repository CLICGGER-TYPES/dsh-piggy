// @ts-check
/**
 * 桌面版的页面逻辑（游戏包自带，外壳 0.3.0 起由 renderer/loader.js 调用）。
 *
 * 以前这些都在桌面程序里（renderer/shell.js + main.js），改一点就得让玩家重装桌面程序。
 * 现在桌面程序只提供基础动作（piggyShell.place / setHit / beginDrag …），量尺寸、钉位置、
 * 窗口摆哪、哪里可点都在这里，跟着游戏包热更新。
 */
import { sameBounds } from './geometry.js'
import { createMeasure, layoutBox } from './measure.js'
import { createPlacement } from './place.js'
import { installPanel, startPanel } from './panel-window.js'

/** 页面 ↔ 桌面程序的约定版本：以后桌面程序加新的基础动作时加一。
 * v3：外壳支持 piggyShell.logs.save（导出日志时弹系统「另存为」）。
 * v4：外壳 0.6.0 起猪和面板各一个窗口（piggyShell.role / panel / onStateChanged）。 */
export const DESKTOP_VERSION = 4

const FONT_STACK = 'Nunito,"Noto Sans SC",-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif'
/** 桌面版专用样式：内置 emoji 字体栈；投影不越出可见区域；面板底栏限高。 */
const DESKTOP_CSS = [
  `[data-dsh-pig][data-dsh-pig]{--ac-font:"Piggy Emoji",${FONT_STACK}}`,
  `[data-dsh-pig][data-dsh-pig][data-emoji="system"]{--ac-font:${FONT_STACK}}`,
  '[data-dsh-pig][data-open="false"] .dp-pig{filter:none!important}',
  '[data-dsh-pig] .dp-pig-img,[data-dsh-pig] .dp-pig-emoji{filter:none!important}',
  '[data-dsh-pig] .dp-card{box-shadow:inset 0 1px 2px rgba(61,52,40,.09)!important}',
  '[data-dsh-pig] .dp-panel-footer{max-height:270px!important}',
  // 收起时拖猪，窗口缩到只包住猪；头顶的签到/礼包小气泡会被窗口边裁成半块白色，拖的时候先藏起来。
  '[data-dsh-pig] .dp-scene[data-dragging="true"] .dp-daily,[data-dsh-pig] .dp-scene[data-dragging="true"] .dp-poke-hint{visibility:hidden!important}',
  // 猪窗口（外壳 0.6.0 起）：面板和名牌在另一个窗口里，这里永远只有猪。
  '[data-piggy-role="pet"] .dp-card,[data-piggy-role="pet"] .dp-hud{display:none!important}',
].join('\n')

/** 窗口差这么多以内就不改。取 2 而不是 0/1：Windows 分数缩放下读回来常差 1px，Electron 源码自己也说
 *  GetWindowBoundsInScreen 有约 1px 误差（native_window_views.cc）。贴着噪声改就会来回抖。 */
const TOLERANCE = 2

let bridge = /** @type {any} */ (null)
/** 这个页面在哪个窗口里：老外壳单窗口时是 null。 */
let role = /** @type {'pet'|'panel'|null} */ (null)
/** 拖动中窗口被夹在屏幕里时，猪在窗口里滑了多少（主进程推来的，见 main.js dragTick）。 */
let dragSlide = { x: 0, y: 0 }
let measure = /** @type {any} */ (null)
let placement = /** @type {any} */ (null)
let lastKey = null
let closedRoom = null
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

/** 猪在屏幕上的位置与四周可用空间：面板按这个决定朝哪边开。 */
function room() {
  const h = host()
  if (h !== null && h.getAttribute('data-open') === 'true' && closedRoom !== null) return closedRoom
  const info = geometry()
  if (info === null || h === null) return null
  const pigNode = h.querySelector('.dp-pig')
  if (pigNode === null) return null
  const box = layoutBox(pigNode)
  const left = info.window.x + box.x
  const top = info.window.y + box.y
  const result = {
    above: Math.round(top - info.workArea.y),
    below: Math.round(info.workArea.y + info.workArea.height - (top + box.height)),
    left: Math.round(left - info.workArea.x),
    right: Math.round(info.workArea.x + info.workArea.width - (left + box.width)),
    width: info.workArea.width,
    height: info.workArea.height,
  }
  if (h.getAttribute('data-open') === 'false') closedRoom = result
  return result
}

function updateHit(x, y) {
  mouse = { x, y }
  if (typeof bridge.setHit !== 'function') return
  let inside = dragging()
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
  const h = host()
  if (h === null) return
  const info = readGeometry()
  if (info !== null && info.window && layoutStale(info.window)) {
    // 等页面重排（resize 事件会再排一次 tick）；等太久就照常量，避免系统改不了尺寸时卡死。
    const at = typeof performance === 'object' ? performance.now() : Date.now()
    if (staleSince === null) staleSince = at
    if (at - staleSince < STALE_WAIT_MS) { lastKey = null; return }
  }
  staleSince = null
  let next = measure.boxes(h)
  if (next === null) return
  const side = measure.sides(h)
  const open = h.getAttribute('data-open') === 'true'
  // 面板开着不做「内容在窗口里挪」：那时放不下就是挪猪（收起后按家摆回去）。
  if (open) resetShift()
  measure.pin(h, side, next.hostBox, next.contentBox)
  next = measure.boxes(h)
  if (next === null) return

  hitRects = next.shape
  if (mouse.x >= 0) updateHit(mouse.x, mouse.y)

  // 还没拿到窗口在哪：先不摆（以前按 (0,0) 算，启动时会把窗口摆错一次）。几何一到会再量。
  if (info === null || !info.window) { lastKey = null; return }
  // 窗口还在动（X11 下 setBounds 是异步的，回读和页面的 screenX 一时对不上）：这一轮不摆，等它落定。
  if (Math.abs(window.screenX - info.window.x) > 1 || Math.abs(window.screenY - info.window.y) > 1) { lastKey = null; return }
  const bounds = info.window
  const areas = info.workAreas ?? [info.workArea]
  // 每一轮都按「家」重新算窗口（不看上一轮算了什么）：上一轮哪怕错了，这一轮按真实布局自己纠正。
  const grownX = side.horizontal === 'right' ? next.content.width - bounds.width : 0
  const grownY = side.vertical === 'bottom' ? next.content.height - bounds.height : 0
  const want = placement.decide({
    width: next.content.width, height: next.content.height, pig: next.pig,
    pigWindow: { x: next.pigBox.x + grownX, y: next.pigBox.y + grownY },
    pigNow: { x: next.pigBox.x, y: next.pigBox.y },
    shift: measure.state.shift,
    panelOpen: open,
  }, bounds, areas)
  placement.persist(areas)
  // want 是按「内容没挪过」的布局算的。收起时窗口被夹回工作区（猪贴着屏幕边，窗口的透明留白伸出去了）：
  // 窗口照夹，整块内容在窗口里反向挪同样多，猪的屏幕位置不变，只裁掉透明留白。
  // 以前是窗口连猪一起被推回来——拖到屏幕边上一松手猪就弹开 30～200 多像素（2026-10-06 虚拟机真拖复现）。
  const clamp = placement.clamp()
  const old = measure.state.shift
  const fresh = open ? { x: 0, y: 0 } : { x: -clamp.dx, y: -clamp.dy }
  if (fresh.x !== old.x || fresh.y !== old.y) {
    measure.state.shift = fresh
    measure.pin(h, side, next.hostBox, next.contentBox)
    const dx = fresh.x - old.x
    const dy = fresh.y - old.y
    next.shape = next.shape.map(rect => ({ ...rect, x: rect.x + dx, y: rect.y + dy }))
    hitRects = next.shape
  }
  const move = !sameBounds(want, bounds, TOLERANCE)
  const key = measure.keyOf(next)
  if (!move && key === lastKey) return
  lastKey = key
  const request = { shape: next.shape, bounds: move ? want : undefined, pig: undefined }
  // 拆窗口时顺带报猪在窗口里的框（内容可能刚在窗口里挪过）：外壳 0.6.1 起面板按它贴着猪。
  const pigNode = role === 'pet' ? h.querySelector('.dp-pig') : null
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

/** 窗口在哪块屏、那块屏什么缩放：Windows 分数缩放的问题只能靠这个在日志里看出来。 */
function displayNote(info) {
  const list = info?.displays
  if (!Array.isArray(list) || list.length === 0) return null
  const win = info.window
  const hit = list.find(display => win.x >= display.workArea.x && win.x < display.workArea.x + display.workArea.width
    && win.y >= display.workArea.y && win.y < display.workArea.y + display.workArea.height)
  const one = hit ?? list[0]
  return { id: one.id, scale: one.scaleFactor, count: list.length }
}

/** 同步回读真实窗口几何；外壳给不了就退回缓存（老外壳没有同步 place）。 */
function readGeometry() {
  if (typeof bridge.place === 'function') {
    const fresh = bridge.place({})
    if (fresh !== null && fresh !== undefined && fresh.window) return fresh
  }
  return geometry()
}

/** 内容回到贴着窗口锚边的正常位置（拖动、开面板时用；需要时下一轮会重新算）。 */
function resetShift() {
  if (measure.state.shift.x === 0 && measure.state.shift.y === 0) return
  measure.state.shift = { x: 0, y: 0 }
}

function schedule() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(function () {
    scheduled = false
    if (!dragging()) tick()
  })
}

/** loader.js 在挂载游戏之前调用：挂上 __dshPiggyShell，客户端挂载时就按桌面版走。 */
export function install(shell) {
  bridge = shell
  const split = shell.panel !== undefined && typeof shell.panel.toggle === 'function'
  role = split ? (shell.role === 'panel' ? 'panel' : 'pet') : null
  if (role === 'panel') {
    const style = document.createElement('style')
    style.setAttribute('data-piggy-desktop-style', '')
    style.textContent = DESKTOP_CSS
    document.head.appendChild(style)
    installPanel(shell)
    return
  }
  if (role === 'pet') document.documentElement.setAttribute('data-piggy-role', 'pet')
  // 外壳能力探测（2026-10-06）：几何逻辑在游戏包里、执行在外壳里，两边版本错配时
  // 以前完全看不出来（minShell 一直是 0.1.0，data-piggy-desktop 也没人读）。
  // 缺关键动作就明确说出来，并且不去做兑现不了的摆放。
  const missing = ['place', 'beginDrag', 'endDrag'].filter(name => typeof shell[name] !== 'function')
  if (missing.length > 0) {
    console.warn('[piggy-desktop] shell is too old, missing: ' + missing.join(', ') + '（请更新桌面程序）')
    ;/** @type {any} */ (window).__dshPiggyShellOutdated = true
  }
  placement = createPlacement({ platform: shell.platform || '' })
  measure = createMeasure({ platform: shell.platform || '', geometry, anchor: () => placement.homeTopLeft(), split: role === 'pet' })
  const style = document.createElement('style')
  style.setAttribute('data-piggy-desktop-style', '')
  style.textContent = DESKTOP_CSS
  document.head.appendChild(style)
  if (typeof shell.onGeometry === 'function') shell.onGeometry(function () { schedule() })
  if (role === 'pet' && typeof shell.onDragSlide === 'function') {
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
    // 外壳 0.6.0 起：面板在另一个窗口里，右键只是叫主进程把它开/关在猪旁边。
    ...(role === 'pet' ? {
      role: 'pet',
      split: true,
      onStateChanged: shell.onStateChanged,
      panel: {
        toggle: function (open) {
          const info = readGeometry()
          const pig = info && info.window ? pigInWindow(info.window) : null
          shell.panel.toggle(open, pig === null ? null : { x: pig.x, y: pig.y, width: pig.width, height: pig.height })
        },
        on: shell.panel.on,
        onFx: shell.panel.onFx,
      },
    } : {}),
    room,
    refreshRoom: function () { closedRoom = null },
    beginDrag: function () {
      const h = host()
      if (h !== null && h.getAttribute('data-open') === 'false') {
        // 收起时拖：不再把窗口缩成「只包住猪」。
        //
        // 以前这里缩一次（204 高）、松手再长回预留面板的大小（476 高、向上长 272px）。
        // 那是**跨进程的两次改动**：窗口已经在新的位置/尺寸了，页面还没重排完，
        // 中间那一两帧猪就画在错的地方 —— 用户看到「松手后猪瞬移到上面去再瞬移下来」
        // （2026-10-07 win11 虚拟机日志：drag end 之后 20ms 内 bounds place
        //  (226,120,324x476)，341ms 后又回到 (259,390,304x208)）。
        // 拖动期间保持窗口尺寸不变，松手就没有这一步，也就没有那一帧。
        resetShift()
      }
      // 告诉主进程猪在窗口里哪儿：刚缩完窗口页面多半还没重排，按家和窗口算，不量旧布局。
      const info = readGeometry()
      const pig = info && info.window ? pigInWindow(info.window) : null
      dragSlide = { x: 0, y: 0 }
      // slide：这个页面会接「猪在窗口里滑」（窗口被夹在屏幕里时），主进程才夹窗口
      shell.beginDrag(pig === null ? null : { x: pig.x, y: pig.y, width: pig.width, height: pig.height,
        slide: role === 'pet' && typeof shell.onDragSlide === 'function' })
    },
    dragHeartbeat: function () { if (typeof shell.dragHeartbeat === 'function') shell.dragHeartbeat() },
    endDrag: function () {
      shell.endDrag()
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
      // 滑动交还给常规摆放：同一轮里去掉 translate、按新家摆（贴边时由钉边偏移接手），中间不会画出一帧
      dragSlide = { x: 0, y: 0 }
      const h = host()
      if (h !== null) h.style.translate = ''
      lastKey = null
      tick()
    },
    syncGeometry: function () { tick() },
    // 桌面散步（G 批次）：用外壳本来就有的 moveBy 挪窗口，新位置由主进程推回来的几何记住。
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
  const h = host()
  if (h !== null && typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(h, { subtree: true, childList: true, attributes: true, characterData: true })
  }
  window.addEventListener('resize', schedule)
  window.addEventListener('pointerup', schedule)
  setInterval(function () { if (!dragging()) tick() }, 1000)
  tick()
}

export const desktop = { version: DESKTOP_VERSION, install, start }
