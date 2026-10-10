// @ts-check
/**
 * dsh-piggy 桌面版的主进程（外壳）。整体结构和全部 IPC 消息见 docs/guides/desktop-architecture.md。
 *
 * - 两个透明置顶窗口（外壳 0.6.0 起）：猪窗口 win（固定大小，只装猪和气泡）和面板窗口 panelWin
 *   （贴在猪旁边，见文件后半「面板窗口」一节和 lib/panel-geometry.js）。同一份游戏包在两边各跑一份，
 *   按 piggyShell.role 各显示一半。
 * - 窗口摆哪、哪里可点由游戏包算（src/client/desktop/），这里只照做（piggy:place）；拖动由这里按
 *   鼠标位置算（dragTick），因为页面在拖动中拿不到可靠的屏幕坐标。
 * - 几何一律以「请求值」为准，不把 getBounds() 读回来再设回去：Windows 分数缩放下读回值有 1px 误差，
 *   读了再设就会一帧帧累加（2026-10-07 面板越跑越远就是这么来的，见 petAsked）。
 * - 宿主是插件自己的 store.js + routes.js（lib/host.js），经 piggy:// 协议访问，不开端口。
 * - 存档在 userData/dsh-piggy/state.json，跟 DSH 里那只各养各的；托盘里可以导入。
 */
import { spawn } from 'node:child_process'
import { appendFile, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BrowserWindow, Menu, Tray, app, dialog, ipcMain, nativeImage, net, protocol, screen, session, shell } from 'electron'
import updaterPackage from 'electron-updater'

import { startHost } from './lib/host.js'
import { MIN_WINDOW, WINDOW_PADDING, clampBounds, contentBoundsForPig, dragPigBounds, moveAcrossDisplays, resizedPigScreenPoint } from './lib/window-geometry.js'
import { createProxy } from './lib/proxy.js'
import { RELEASES_PAGE, createVersions } from './lib/versions.js'
import { createShellUpdates, shellUpdateMode } from './lib/shell-update.js'
import { dragHeartbeatExpired } from './lib/drag-watchdog.js'
import { PANEL_FALLBACK, panelAnchorFor, panelBoundsFor, pigScreenBox } from './lib/panel-geometry.js'
import { pointerHitsShape } from './lib/pointer-hit.js'
import { downloadFirstGame, gamePinPath } from './first-run.js'

const { autoUpdater } = updaterPackage

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * 帧率：**不设上限，跟显示器刷新率同步**（Chromium 默认就是 vsync）。
 *
 * 这里以前写死 30fps（163c040「修 Windows 上开着猪整机变卡」时定的，注释写「30fps 足够猪动」）。
 * 但拖动时窗口是按 60Hz setBounds 移动的：窗口在动、画面 30fps 才更新一次，猪就一跳一跳地跟，
 * 用户看到的就是抽帧。那次真正治住卡顿的是同一次提交里「窗口只框住猪那一小块」，
 * 30fps 是捎带的，现在它只跟「跟手」冲突，撤掉。
 * 要在弱机器上压帧率可以用 PIGGY_FPS 环境变量兜底（排查用）。
 */
const FRAME_CAP = Number(process.env.PIGGY_FPS) || 0
/** 非拖动时，窗口位置/大小差这么多以内就不改（见 applyBounds）。 */
const BOUNDS_TOLERANCE = 2

/** 页面还没报内容框之前的兜底尺寸：折叠的猪 + 留白。 */
const FALLBACK_CONTENT = { width: 132, height: 152 }

/** A small log next to the save, so a launch that shows nothing can still be diagnosed. */
function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(' ')}\n`
  if (process.env.PIGGY_CAPTURE) process.stdout.write(line)
  try {
    const file = join(app.getPath('userData'), 'piggy.log')
    mkdirSync(dirname(file), { recursive: true })
    appendFile(file, line, () => {})
  } catch { /* logging must never break the pig */ }
  // 同一句话也进游戏自己的日志：设置里导出的那一份要能看到窗口和更新出了什么事。
  try { hostJournal?.record('info', 'shell', parts.join(' ')) } catch { /* 日志不许反过来把猪弄挂 */ }
}

/** 游戏宿主的日志本；宿主起来之前是 null。 */
let hostJournal = null
/** 显示器兜底对账的定时器（见 app.whenReady 里的 displayWatchTimer）。 */
let displayWatchTimer = null
/** 拖动期间 tick 的统计（松手时写一行日志，用来判断跟不跟得上刷新率）。 */
let dragStats = null

/**
 * Start again with `args`. Inside an AppImage the running copy is a temporary
 * mount that vanishes with this process, so the AppImage file itself is relaunched.
 */
function relaunch(args = process.argv.slice(1)) {
  app.relaunch(process.env.APPIMAGE ? { execPath: process.env.APPIMAGE, args } : { args })
}

// Wayland does not let a window stay on top or cut its own shape; XWayland does.
// The platform is chosen before this file runs, so a Wayland start relaunches once under X11.
const X11_FLAG = '--ozone-platform=x11'
const needsX11 = process.platform === 'linux' && Boolean(process.env.WAYLAND_DISPLAY)
  && process.env.PIGGY_WAYLAND !== '1' && !process.argv.includes(X11_FLAG)
if (needsX11) {
  // app.relaunch only fires on a normal quit, which never comes this early; start the copy by hand.
  spawn(process.env.APPIMAGE ?? process.execPath, [...process.argv.slice(1), X11_FLAG], { detached: true, stdio: 'ignore' }).unref()
  app.exit(0)
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'piggy', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Testing: keep a throwaway save and settings away from the real ones.
if (process.env.PIGGY_USERDATA) app.setPath('userData', resolve(process.env.PIGGY_USERDATA))
if (!needsX11 && !app.requestSingleInstanceLock()) app.quit()

/** The game shipped inside the app; downloaded versions live under userData (lib/versions.js). */
function bundledGameDir() {
  // PIGGY_BUNDLED_GAME：开发时模拟「安装包不带游戏」（指一个不存在的目录）。
  if (process.env.PIGGY_BUNDLED_GAME) return resolve(process.env.PIGGY_BUNDLED_GAME)
  return app.isPackaged ? join(process.resourcesPath, 'game') : join(HERE, 'game')
}

const statePath = () => join(app.getPath('userData'), 'dsh-piggy', 'state.json')

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf' }

/** Serve a file from `root`, refusing anything that climbs out of it. */
function serveFile(root, rel) {
  const file = normalize(join(root, rel))
  if (!file.startsWith(normalize(root)) || !existsSync(file)) return new Response('not found', { status: 404 })
  const type = MIME[extname(file)] ?? 'application/octet-stream'
  // 立绘、字体让浏览器缓存：摸猪时立绘在「摸」和「平常」之间来回换，
  // 不缓存的话每次都要重新取一遍，Windows 上会空一帧（猪闪一下）。
  const cache = /^(image|font)\//.test(type) ? { 'cache-control': 'max-age=86400' } : {}
  return new Response(readFileSync(file), { headers: { 'content-type': type, ...cache } })
}

let host = null
/** @type {ReturnType<typeof createVersions> | null} */
let versions = null
/** @type {ReturnType<typeof createShellUpdates> | null} */
let shellUpdates = null
let win = null
/**
 * 最近一次请求给猪窗口的位置和大小。拖动和面板都按它算，不按 getBounds() 回读：
 * Windows 125%/150% 缩放下回读的尺寸常比设的大 1px，「读回来再设回去」每帧涨 1px，
 * 拖一次窗口能从 345 宽涨到 482，钉在窗口右下角的猪就被越推越远（2026-10-07 虚拟机 125% 录屏 + 日志）。
 */
let petAsked = null
/**
 * 面板窗口（外壳 0.6.0 起）：面板不再和猪挤在同一个窗口里。
 * 以前开面板、冒气泡、拖动都要改猪那个窗口的大小，再靠计算把猪补回原位，差一拍猪就跳
 * （2026-10-06～07 修了四轮）。网上的桌宠（Clawd、Shimeji、eSheep）都是猪一个固定大小的
 * 小窗口、菜单另开窗口：开面板时猪的窗口一动不动，拖动只挪窗口。见 docs/archive/tasks/I-round.md。
 * 只有新游戏包会叫它（piggyShell.panel.toggle）；老游戏包照旧单窗口。
 */
let panelWin = null
/** 正在退出/重启：关掉窗口前先置位，之后到达的页面消息一律不处理。 */
let quitting = false
/**
 * 消息是不是这扇窗口的页面发来的。窗口销毁后再读 win.webContents 会抛
 * 「Object has been destroyed」—— Windows 上在更新页切换版本时，旧页面的消息还在路上，
 * 主进程直接弹了错误框（用户 2026-10-05 实测）。所以先查 isDestroyed。
 */
function fromPage(event) {
  return fromPet(event) || (!quitting && panelWin !== null && !panelWin.isDestroyed() && event.sender === panelWin.webContents)
}
/** 只有猪窗口能挪猪、改形状（面板窗口的页面也装了同一套游戏包，不许它动猪窗口）。 */
function fromPet(event) {
  return !quitting && win !== null && !win.isDestroyed() && event.sender === win.webContents
}
/** 发给两个窗口的页面（下载进度、存档变了这类两边都要知道的事）。 */
function toPages(channel, ...args) {
  for (const target of [win, panelWin]) {
    if (target !== null && !target.isDestroyed()) target.webContents.send(channel, ...args)
  }
}
let tray = null

function registerProtocol(gameDir) {
  protocol.handle('piggy', async request => {
    const url = new URL(request.url)
    const path = decodeURIComponent(url.pathname)
    if (path.startsWith('/dsh-piggy/')) {
      const body = request.method === 'POST' ? await request.text() : undefined
      const out = await host.handle(request.method, path + url.search, body)
      // 存档变了（任一个窗口里做了动作）：告诉两个窗口马上刷新，别等 4 秒一次的轮询，
      // 不然面板里喂完食，猪要过几秒才有反应。
      if (request.method === 'POST') announceStateChanged()
      return new Response(out.body, { status: out.status, headers: out.headers })
    }
    if (path === '/client.js') return serveFile(gameDir, 'client.js')
    return serveFile(join(HERE, 'renderer'), path === '/' ? 'index.html' : path.slice(1))
  })
}

/** The screen the mouse is on when the pig starts: where you just double-clicked. */
function pigDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

/** 上次把猪停在哪儿（窗口位置），下次开机照旧。 */
function windowStatePath() {
  return join(app.getPath('userData'), 'window.json')
}

function readWindowState() {
  try {
    const saved = JSON.parse(readFileSync(windowStatePath(), 'utf8'))
    if (saved !== null && typeof saved === 'object' && Number.isFinite(saved.width) && Number.isFinite(saved.height)) return saved
  } catch { /* 第一次运行没有这个文件 */ }
  return null
}

/** 让窗口晚一点再写盘：拖动时 setBounds 会连发。 */
let windowStateTimer = null
function scheduleWindowStateSave() {
  if (win === null || win.isDestroyed()) return
  if (windowStateTimer !== null) clearTimeout(windowStateTimer)
  windowStateTimer = setTimeout(() => {
    windowStateTimer = null
    if (win === null || win.isDestroyed()) return
    try {
      mkdirSync(dirname(windowStatePath()), { recursive: true })
      const bounds = win.getBounds()
      // 连猪在屏幕上的位置一起存：下次启动按猪摆，而不是按窗口摆 —— 窗口大小每次启动
      // 可能不同（上次退出时面板开着、气泡区、版本升级），按窗口摆猪会一次漂几像素。
      const pig = lastPigWindow === null ? undefined : { x: bounds.x + lastPigWindow.x, y: bounds.y + lastPigWindow.y }
      writeFileSync(windowStatePath(), JSON.stringify({ ...bounds, pig }))
    } catch { /* 存不下就算了，下次用兜底位置 */ }
  }, 800)
}

/** 这块窗口落在哪块屏上，就用那块屏的工作区。 */
function workAreaFor(bounds) {
  return screen.getDisplayMatching(bounds).workArea
}

/** 把窗口几何推给页面：面板要朝屏幕里侧开。 */
let geometrySeq = 0
function pushGeometry() {
  if (win === null || win.isDestroyed()) return
  const bounds = win.getBounds()
  win.webContents.send('piggy:geometry', geometryOf(bounds, ++geometrySeq))
}

/** 窗口、它所在屏的工作区、所有屏的工作区：游戏包里的桌面逻辑按这些自己算窗口摆哪。 */
function geometryOf(bounds, seq) {
  const displays = screen.getAllDisplays()
  return {
    window: bounds,
    workArea: workAreaFor(bounds),
    workAreas: displays.map(display => display.workArea),
    // 显示器清单（含每块屏的缩放）：Windows 125%/150% 下的问题一直只能靠 2px 容差硬扛，
    // 把这些发给游戏包，日志里才能看出「是哪块屏、什么缩放」。
    displays: displays.map(display => ({ id: display.id, label: display.label,
      bounds: display.bounds, workArea: display.workArea, scaleFactor: display.scaleFactor, internal: display.internal })),
    dragSlide: lastDragSlide,
    seq,
  }
}

/**
 * 挪/改窗口。返回这次实际改了多少（没改返回 null），写进日志方便排查。
 * 除了拖动，差 2px 以内一律不动：Windows 125%/150% 缩放下 setBounds 设的尺寸和 getBounds
 * 读回来的常差 1px，精确比较会让每次内容上报都重新 setBounds，透明窗口就闪一下。
 */
function applyBounds(next, why) {
  if (win === null || win.isDestroyed()) return null
  const before = win.getBounds()
  const delta = { x: next.x - before.x, y: next.y - before.y, width: next.width - before.width, height: next.height - before.height }
  const tolerance = why === 'drag' || why === 'move' ? 0 : BOUNDS_TOLERANCE
  if (Math.abs(delta.x) <= tolerance && Math.abs(delta.y) <= tolerance
    && Math.abs(delta.width) <= tolerance && Math.abs(delta.height) <= tolerance) return null
  win.setBounds(next)
  petAsked = { ...next }
  followPig()
  // 拖动时每秒要挪几十次：别每次都写日志（Windows 上同步写盘会卡住主进程）。
  if (why !== 'drag' && why !== 'move') log('bounds', why, JSON.stringify(next))
  scheduleWindowStateSave()
  pushGeometry()
  return delta
}

/**
 * Windows 上不用 setShape，改用「鼠标穿透 + 页面判断鼠标在不在猪/面板上」：
 * setShape 在 Windows 上是 SetWindowRgn，开关面板时可点区域整块变化，透明分层窗口会闪一下白
 * （用户 2026-10-05：装了 0.2.5 右键开关菜单仍闪白屏）。穿透模式下窗口区域从不变化。
 * PIGGY_SHAPE=1 可退回旧做法，方便对比排查。
 */
const PASSTHROUGH = process.platform === 'win32' && process.env.PIGGY_SHAPE !== '1'
let passthroughHit = false
let hitTimer = null
function setHit(hit) {
  if (!PASSTHROUGH || win === null || win.isDestroyed() || hit === passthroughHit) return
  passthroughHit = hit
  win.setIgnoreMouseEvents(!hit, { forward: true })
}

/** Forwarded mousemove can be missed when crossing directly onto an ignored window.
 * Read the cursor in the main process so the first click already reaches the pig. */
function refreshHit() {
  if (!PASSTHROUGH || !hasPlacedShape || win === null || win.isDestroyed() || dragSession !== null) return
  setHit(pointerHitsShape(screen.getCursorScreenPoint(), win.getBounds(), placedShape))
}

/**
 * 只让窗口的一部分可点（其余点击落到桌面）。Electron 只在 Windows / Linux 支持；
 * macOS 上跳过 —— 窗口已经只有猪和面板那么大，四周 16px 的透明边会挡一下点击，影响不大。
 */
function applyShape(rects) {
  if (PASSTHROUGH || win === null || win.isDestroyed() || process.platform === 'darwin' || typeof win.setShape !== 'function') return
  win.setShape(rects)
}

/** 上次退出时猪的屏幕位置：启动后第一次收到内容上报时按它摆窗口。 */
let savedPigScreen = null

function createWindow() {
  const saved = readWindowState()
  savedPigScreen = saved !== null && Number.isFinite(saved.pig?.x) && Number.isFinite(saved.pig?.y) ? { x: saved.pig.x, y: saved.pig.y } : null
  if (savedPigScreen !== null) {
    // 显示器拔掉或换了分辨率：猪至少要整只留在某块屏上。
    const pigArea = screen.getDisplayNearestPoint(savedPigScreen).workArea
    const box = clampBounds({ ...savedPigScreen, width: MIN_WINDOW.width, height: MIN_WINDOW.height }, pigArea)
    savedPigScreen = { x: box.x, y: box.y }
  }
  const area = saved === null ? pigDisplay().workArea : screen.getDisplayMatching(saved).workArea
  const width = saved === null ? FALLBACK_CONTENT.width + WINDOW_PADDING * 2 : saved.width
  const height = saved === null ? FALLBACK_CONTENT.height + WINDOW_PADDING * 2 : saved.height
  const anchorRight = saved === null ? 18 : null
  const start = saved === null
    ? clampBounds({ x: area.x + area.width - width - anchorRight, y: area.y + area.height - height - anchorRight, width, height }, area)
    : clampBounds({ ...saved, width, height }, area)
  petAsked = { ...start }
  win = new BrowserWindow({
    ...start,
    transparent: true, frame: false, resizable: false, movable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: true, show: false,
    backgroundColor: '#00000000',
    // backgroundThrottling: 这个窗口从不获得焦点（showInactive + skipTaskbar），Chromium 默认
    // 会把「后台窗口」的 rAF/定时器降频；而页面测量、闭环核对、形状上报全走 rAF，
    // 被降频就会表现为「猪慢半拍 / 挪完窗口猪还在旧位置」。桌宠没有省电的必要，关掉。
    webPreferences: { preload: join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  })
  win.setAlwaysOnTop(true, 'floating')
  // 30fps：猪的动画够看，整窗合成的次数砍一半（D1 第 3 条）。
  if (FRAME_CAP > 0) win.webContents.setFrameRate(FRAME_CAP)
  // Until the page reports where the pig is, the window takes no clicks at all.
  applyShape([])
  if (PASSTHROUGH) { passthroughHit = true; setHit(false) }
  if (PASSTHROUGH) {
    hitTimer = setInterval(refreshHit, 16)
    hitTimer.unref?.()
  }
  win.loadURL('piggy://app/index.html')
  // 启动摆放最多管 3 秒：之后一律按猪当前位置算，免得哪次没对上就一直往回拽。
  win.once('ready-to-show', () => { setTimeout(() => { savedPigScreen = null }, 3000) })
  win.once('ready-to-show', () => { log('ready-to-show'); win.showInactive(); log('shown', JSON.stringify(win.getBounds()), win.isVisible()) })
  win.webContents.on('did-finish-load', () => log('page loaded'))
  // 面板开着时焦点离开猪窗口、也没进面板：当作点到别处（见 panelFocusLeft）
  win.on('blur', () => panelFocusLeft())
  win.webContents.on('render-process-gone', (e, d) => { stopDrag(); log('renderer gone', JSON.stringify(d)) })
  win.webContents.on('console-message', (e, level, message) => { if (level >= 2) log('page:', message) })
  if (process.env.PIGGY_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' })
  if (process.env.PIGGY_CAPTURE) win.webContents.once('did-finish-load', () => { captureForCheck(process.env.PIGGY_CAPTURE) })
}

let lastShape = []
/** 页面最近一次摆放时给的可点区域（拖动中猪在窗口里滑时要跟着挪，见 dragTick）。 */
let placedShape = []
let hasPlacedShape = false
/** Last renderer-reported local pig origin; always measured after pinPig. */
let lastPigWindow = null
let lastPigSize = { width: 56, height: 56 }
/** Original screen point to restore when an overlarge panel closes. */
let restingPigScreen = null
/** Last geometry report, used to skip idle reports. */
let lastContent = null

/**
 * The renderer reports the already-pinned pig and content in one frame.
 * Position and resize the window in one setBounds call around that pig point.
 */
ipcMain.on('piggy:content', (event, content) => {
  if (!fromPet(event)) {
    if (content?.immediate === true) event.returnValue = null
    return
  }
  const width = Number(content?.width)
  const height = Number(content?.height)
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    if (content?.immediate === true) event.returnValue = null
    return
  }
  const anchor = { vertical: content?.anchor?.vertical === 'top' ? 'top' : 'bottom', horizontal: content?.anchor?.horizontal === 'left' ? 'left' : 'right' }
  const bounds = win.getBounds()
  const pigWindow = { x: Number(content?.pigWindow?.x), y: Number(content?.pigWindow?.y) }
  const hasPigWindow = Number.isFinite(pigWindow.x) && Number.isFinite(pigWindow.y)
  const pigSize = Number(content?.pig?.width) > 0 && Number(content?.pig?.height) > 0
    ? { width: Number(content.pig.width), height: Number(content.pig.height) } : lastPigSize
  const sizeChanged = lastPigWindow !== null
    && (lastPigSize.width !== pigSize.width || lastPigSize.height !== pigSize.height)
  const panelOpen = content?.panelOpen === true
  const changed = lastContent === null
    || lastContent.width !== width || lastContent.height !== height
    || lastContent.anchor.vertical !== anchor.vertical || lastContent.anchor.horizontal !== anchor.horizontal
    || sizeChanged
    || (hasPigWindow && lastPigWindow !== null && (pigWindow.x !== lastPigWindow.x || pigWindow.y !== lastPigWindow.y))

  if (savedPigScreen !== null) {
    // 用「这次摆之前」的窗口 + 页面实际量到的猪位置判断：窗口已经不用再改、猪确实在存下的位置上。
    const pigNow = { x: Number(content?.pigNow?.x), y: Number(content?.pigNow?.y) }
    const settled = bounds.width === Math.max(MIN_WINDOW.width, Math.round(width))
      && bounds.height === Math.max(MIN_WINDOW.height, Math.round(height))
      && Math.abs(bounds.x + pigNow.x - savedPigScreen.x) <= 1 && Math.abs(bounds.y + pigNow.y - savedPigScreen.y) <= 1
    if (settled || panelOpen) savedPigScreen = null
  }

  // 开、关面板本身不挪窗口（收起时窗口按打开时的范围留着位置）。只在打开那一刻记下猪的原位，
  // 面板开着时内容变化要按它摆回。以前开关面板也算「内容变了」，Windows 缩放下差 1px 就会
  // 重新 setBounds 一次，整块内容往上闪一下（用户 2026-10-05）。
  if (panelOpen && lastContent?.panelOpen !== true && hasPigWindow) {
    const base = lastPigWindow ?? pigWindow
    restingPigScreen = savedPigScreen ?? { x: bounds.x + base.x, y: bounds.y + base.y }
  }
  let moved = null
  if (changed && hasPigWindow) {
    const pigNow = { x: Number(content?.pigNow?.x), y: Number(content?.pigNow?.y) }
    const before = lastPigWindow ?? (Number.isFinite(pigNow.x) && Number.isFinite(pigNow.y) ? pigNow : pigWindow)
    // 启动时以存下来的猪位置为准，直到页面量到的实际位置（pigNow，不是预测值）和它对上：
    // 启动那几次上报里窗口还在改大小，按预测值摆会让猪每次启动漂几像素。
    const pigBefore = savedPigScreen ?? { x: bounds.x + before.x, y: bounds.y + before.y }
    // 启动时页面先画占位的纸盒，拿到存档才换成真正的猪：这个尺寸变化不是「调了小猪大小」，
    // 不能按脚底中心挪，直接摆回存下的位置（存的就是真猪的左上角）。
    const target = savedPigScreen !== null ? savedPigScreen
      : sizeChanged
        ? resizedPigScreenPoint(restingPigScreen ?? pigBefore, lastPigSize, pigSize)
        : (restingPigScreen ?? pigBefore)
    if (sizeChanged && restingPigScreen !== null) restingPigScreen = target
    const area = screen.getDisplayNearestPoint(target).workArea
    moved = applyBounds(contentBoundsForPig({
      width, height, pigWindow: { ...pigWindow, ...pigSize }, panelOpen,
      allowPanelOverflow: sizeChanged,
    }, target, area), 'content')
  }
  if (!panelOpen) restingPigScreen = null

  lastContent = { width, height, anchor, panelOpen }
  if (hasPigWindow) lastPigWindow = pigWindow
  lastPigSize = pigSize
  // 记下「猪在屏幕上哪儿」：实机核对展开面板时它有没有动（日志里是 DIP 坐标）。
  const pigOnScreen = hasPigWindow ? { x: win.getBounds().x + pigWindow.x, y: win.getBounds().y + pigWindow.y } : null
  log('content', JSON.stringify({ window: win.getBounds(), anchor, panelOpen, pigOnScreen, target: restingPigScreen, moved }))
  const shape = Array.isArray(content.shape) ? content.shape : []
  applyShape(shape.slice(0, 64).map(r => ({
    x: Math.max(0, Math.round(Number(r.x) || 0)), y: Math.max(0, Math.round(Number(r.y) || 0)),
    width: Math.max(0, Math.round(Number(r.width) || 0)), height: Math.max(0, Math.round(Number(r.height) || 0)),
  })))
  lastShape = shape
  if (content?.immediate === true) {
    const current = win.getBounds()
    event.returnValue = { window: current, workArea: workAreaFor(current), seq: geometrySeq }
  }
})

/** Drag against a fixed cursor/window sample; only the pig is clamped. */
let dragSession = null
/** 最近一次拖动里猪在窗口里滑了多少：页面松手时同步读几何会带上它（异步推的那条可能晚到）。 */
let lastDragSlide = { x: 0, y: 0 }
let dragTimer = null
/** 这块屏的刷新率；拿不到就按 60。 */
function refreshRateAt(point) {
  const display = point === null || point === undefined ? screen.getPrimaryDisplay() : screen.getDisplayNearestPoint(point)
  const hz = Number(display?.displayFrequency)
  return Number.isFinite(hz) && hz >= 30 ? Math.min(240, Math.round(hz)) : 60
}

function dragTick() {
  if (win === null || win.isDestroyed() || dragSession === null) return
  if (dragStats !== null) {
    const now = Date.now()
    dragStats.ticks += 1
    dragStats.maxGap = Math.max(dragStats.maxGap, now - dragStats.last)
    dragStats.last = now
  }
  if (dragHeartbeatExpired(dragSession.lastHeartbeat, Date.now())) { stopDrag(); return }
  const cursor = screen.getCursorScreenPoint()
  // 夹取按「所有屏」算，不按鼠标当前在哪块屏：鼠标一过两块屏的缝就换夹取范围，
  // 会把猪整只弹回去（上下屏最明显）。见 lib/window-geometry.js 的 dragPigBounds。
  const areas = screen.getAllDisplays().map(display => display.workArea)
  // 按「猪」算，不按起始窗口算：拖动中窗口大小可能变（冒气泡、面板换页），
  // 用起始窗口的大小去 setBounds 会把窗口来回改大改小，猪就一抽一抽的。
  const pig = dragSession.pig ?? { ...(lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }), ...lastPigSize }
  // 窗口大小用请求值，不用回读值（见 petAsked 的说明）
  const wanted = dragPigBounds(petAsked ?? win.getBounds(), pig, dragSession.pigScreen, dragSession.cursor, cursor, areas)
  if (!dragSession.slide) { applyBounds(wanted, 'drag'); return }
  // 窗口不出屏幕，猪在窗口里滑过去（外壳 0.6.0 起，新游戏包要求时）：
  // GNOME 等窗口管理器不让程序把窗口摆到屏幕外，猪窗口四周又有透明留白（气泡区），
  // 拖到屏幕边上时窗口被卡住、猪就停在离边一大截的地方，松手才瞬移过去
  // （2026-10-07 虚拟机真拖录像逐帧看到的）。现在窗口夹在工作区里，超出去的那一截
  // 告诉页面，让它把猪在窗口里挪过去——猪一路跟着鼠标走到边上。
  const center = { x: Math.round(wanted.x + pig.x + pig.width / 2), y: Math.round(wanted.y + pig.y + pig.height / 2) }
  const held = clampBounds(wanted, screen.getDisplayNearestPoint(center).workArea)
  const slide = { x: wanted.x - held.x, y: wanted.y - held.y }
  applyBounds(held, 'drag')
  if (slide.x !== dragSession.lastSlide.x || slide.y !== dragSession.lastSlide.y) {
    dragSession.lastSlide = slide
    lastDragSlide = slide
    win.webContents.send('piggy:drag-slide', slide)
    followPig()
    // Linux 的窗口形状不只管点击、也裁画面：猪滑出原来那块形状就被裁没了（录像里拖到边上猪消失）。
    // 形状跟着滑同样多。
    applyShape(placedShape.map(r => ({ ...r, x: Math.max(0, r.x + slide.x), y: Math.max(0, r.y + slide.y) })))
  }
}
function stopDrag() {
  if (dragTimer !== null) clearInterval(dragTimer)
  dragTimer = null
  dragSession = null
  dragStats = null
}

/** 页面要几何：给它推一次（订阅晚于 did-finish-load 时靠这个）。 */
ipcMain.on('piggy:geometry:ask', (event) => {
  if (!fromPet(event)) return
  pushGeometry()
})

ipcMain.on('piggy:drag:start', (event, given) => {
  if (!fromPet(event)) return
  stopDrag()
  const bounds = win.getBounds()
  // 新游戏包会把猪在窗口里的位置和大小一起带过来（它自己量的，不再经过 piggy:content）。
  const pigFromPage = Number.isFinite(given?.x) && Number.isFinite(given?.y) && given?.width > 0 && given?.height > 0
    ? { x: given.x, y: given.y, width: given.width, height: given.height } : null
  const pig = pigFromPage ?? lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }
  dragSession = {
    cursor: screen.getCursorScreenPoint(),
    pigScreen: { x: bounds.x + pig.x, y: bounds.y + pig.y },
    pig: pigFromPage,
    lastHeartbeat: Date.now(),
    // 页面说它会接 piggy:drag-slide（猪在窗口里滑），主进程才把窗口夹在屏幕里
    slide: given?.slide === true,
    lastSlide: { x: 0, y: 0 },
  }
  lastDragSlide = { x: 0, y: 0 }
  // 猪被拖走了：面板打开时记下的「原位」作废，否则下一次内容变化（比如点商店）
  // 会把窗口拽回原位 —— 用户看到的「瞬移」「拖着拖着卡在原地」。
  restingPigScreen = null
  savedPigScreen = null
  // 拖动期间每一帧都不写日志（60Hz 会刷爆），但起止各记一行：出问题时能看出拖了多远、
  // 起始窗口和猪的位置对不对得上（2026-10-06 的偏移排查就是缺这一段）。
  log('drag start', JSON.stringify({ bounds, pigScreen: dragSession.pigScreen, pigFromPage: pigFromPage !== null }))
  // tick 频率跟显示器刷新率走，不再写死 60Hz：144Hz 屏上窗口 60Hz 地动、画面 144Hz 地刷，
  // 一样是抽帧（用户 2026-10-07：「帧数应该跟显示器同步」）。
  const hz = refreshRateAt(dragSession.cursor)
  dragTimer = setInterval(dragTick, 1000 / hz)
  dragStats = { hz, ticks: 0, last: Date.now(), maxGap: 0 }
})
ipcMain.on('piggy:drag:heartbeat', event => {
  if (!fromPet(event) || dragSession === null) return
  dragSession.lastHeartbeat = Date.now()
  // 页面每次 pointermove 都会发心跳，跟着屏幕刷新走；顺手挪一次窗口，
  // 比只靠主进程定时器（Windows 上计时精度约 15.6ms）更顺。
  dragTick()
})
ipcMain.on('piggy:drag:end', event => {
  if (!fromPet(event)) return
  dragTick()
  if (dragSession !== null) {
    const bounds = win === null || win.isDestroyed() ? null : win.getBounds()
    // 猪在窗口里的位置：页面给了就用它，没给就用上次量到的（和 dragTick 同一套兜底）。
    const pig = dragSession.pig ?? lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }
    const startWindow = { x: dragSession.pigScreen.x - pig.x, y: dragSession.pigScreen.y - pig.y }
    log('drag end', JSON.stringify({ bounds, from: startWindow, movedBy: bounds === null ? null
      : { x: bounds.x - startWindow.x, y: bounds.y - startWindow.y } }))
    // tick 是不是跟得上刷新率：maxGap 远大于 1000/hz 就说明主进程被别的活挡住了。
    if (dragStats !== null) log('drag ticks', JSON.stringify(dragStats))
  }
  stopDrag()
  restingPigScreen = null
  reanchorPanel()
})

/**
 * 新游戏包的桌面逻辑：窗口摆哪、多大、哪里可点，都由页面算好，主进程只照做。
 * 同步返回改完后的几何，页面同一轮里就能接着用。以后这类调整只发游戏包，不用再发桌面程序。
 */
ipcMain.on('piggy:place', (event, request) => {
  if (!fromPet(event)) { event.returnValue = null; return }
  const b = request?.bounds
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
    applyBounds({ x: Math.round(b.x), y: Math.round(b.y), width: Math.max(MIN_WINDOW.width, Math.round(b.width)), height: Math.max(MIN_WINDOW.height, Math.round(b.height)) }, 'place')
  }
  // setBounds 是异步的（X11 要等 ConfigureNotify 回来），紧跟其后的 getBounds() 可能还是旧值。
  // 页面拿这个旧值做闭环核对，就会算出假偏差、再照着它挪窗口 —— 用户看到的「越修越偏」。
  // 这里把「请求值 vs 立刻回读值」的差记下来，先把机制钉死。
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
    const after = win.getBounds()
    if (Math.abs(after.x - Math.round(b.x)) > 1 || Math.abs(after.y - Math.round(b.y)) > 1) {
      log('place-stale', JSON.stringify({ asked: { x: Math.round(b.x), y: Math.round(b.y) }, read: after }))
    }
  }
  if (Array.isArray(request?.shape)) {
    hasPlacedShape = true
    placedShape = request.shape.slice(0, 64).map(r => ({
      x: Math.max(0, Math.round(Number(r.x) || 0)), y: Math.max(0, Math.round(Number(r.y) || 0)),
      width: Math.max(0, Math.round(Number(r.width) || 0)), height: Math.max(0, Math.round(Number(r.height) || 0)),
    }))
    applyShape(placedShape)
    refreshHit()
  }
  // 游戏包 0.33.1 起顺带报猪在窗口里的框（贴屏幕边时内容在窗口里挪过）：面板按它贴猪。
  const pig = request?.pig
  if (pig && [pig.x, pig.y, pig.width, pig.height].every(Number.isFinite) && pig.width > 0 && pig.height > 0) {
    const changed = panelPig === null || panelPig.x !== pig.x || panelPig.y !== pig.y || panelPig.width !== pig.width || panelPig.height !== pig.height
    panelPig = { x: pig.x, y: pig.y, width: pig.width, height: pig.height }
    if (changed && dragSession === null) followPig()
  }
  event.returnValue = geometryOf(win.getBounds(), geometrySeq)
})

/** 页面判断鼠标在不在猪/面板上（只在 Windows 穿透模式下生效）。 */
ipcMain.on('piggy:hit', (event, hit) => {
  if (!fromPet(event)) return
  if (hasPlacedShape) return
  setHit(hit === true)
})

/** 旧游戏包（0.27.2 及以前）只会发鼠标增量：照旧支持，回退版本时拖动不坏。 */
ipcMain.on('piggy:move', (event, delta) => {
  if (!fromPet(event)) return
  const dx = Number(delta?.dx)
  const dy = Number(delta?.dy)
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return
  restingPigScreen = null
  applyBounds(moveAcrossDisplays(win.getBounds(), dx, dy, screen.getAllDisplays().map(display => display.workArea)), 'move')
  reanchorPanel()
})

ipcMain.on('piggy:shape', (event, rects) => {
  if (lastShape.length === 0 && Array.isArray(rects) && rects.length > 0) log('first shape', JSON.stringify(rects))
  if (!fromPet(event) || !Array.isArray(rects)) return
  lastShape = rects
  applyShape(rects.slice(0, 64).map(r => ({
    x: Math.round(Number(r.x) || 0), y: Math.round(Number(r.y) || 0),
    width: Math.max(0, Math.round(Number(r.width) || 0)), height: Math.max(0, Math.round(Number(r.height) || 0)),
  })))
})

// ---------------------------------------------------------------------------
// 面板窗口（外壳 0.6.0 起，见文件头 panelWin 的说明）
// ---------------------------------------------------------------------------

/** 面板现在开着没有（用户眼里的「开」，窗口可能还在等页面报尺寸）。 */
let panelOpen = false
/** 猪在猪窗口里的框（打开面板时猪页面报上来的）；面板按它贴在猪旁边。 */
let panelPig = null
/** 这次面板朝哪边开、最高多高：打开时定一次，拖动松手后重新定。 */
let panelAnchor = null
/** 面板页面最近报的尺寸。 */
let panelSize = null
/** 最近一次给面板窗口设的位置：没变就不再 setBounds。 */
let panelAsked = null
/** 面板页面加载好没有：没好之前的「打开」先记着，加载完再发。 */
let panelReady = false

let stateTimer = null
/** 存档变了：两个窗口都刷新（合并 30ms 内的多次，一次动作可能连发几个请求）。 */
function announceStateChanged() {
  if (stateTimer !== null) return
  stateTimer = setTimeout(() => { stateTimer = null; toPages('piggy:state-changed') }, 30)
}

/** 猪在屏幕上的框（拖到屏幕边时加上猪在窗口里滑出去的那一截）。 */
function pigOnScreen() {
  if (win === null || win.isDestroyed() || panelPig === null) return null
  return pigScreenBox(petAsked, win.getBounds(), panelPig, dragSession !== null ? { dragging: true, slide: lastDragSlide } : {})
}

/** 按猪现在的位置决定面板朝哪边开、最高多高。 */
function decidePanelAnchor() {
  const pig = pigOnScreen()
  if (pig === null) return null
  return panelAnchorFor(pig, screen.getDisplayNearestPoint({ x: Math.round(pig.x + pig.width / 2), y: Math.round(pig.y + pig.height / 2) }).workArea,
    panelSize?.width ?? PANEL_FALLBACK.width, panelAnchor?.horizontal)
}

/** 面板窗口该在哪：每次都从猪现在在哪直接算（见 lib/panel-geometry.js 文件头）。 */
function panelBounds() {
  const pig = pigOnScreen()
  if (pig === null || panelAnchor === null) return null
  return panelBoundsFor(pig, panelAnchor, panelSize)
}

function sendPanel(message) {
  if (panelWin !== null && !panelWin.isDestroyed() && panelReady) panelWin.webContents.send('piggy:panel', message)
}

/**
 * 把猪窗口抬到面板窗口上面（用户 2026-10-08 反馈）。
 * 两个窗口同为 floating 置顶，点面板时系统把面板抬到最上，猪的动作和气泡被盖住；
 * 所以面板转来反应（piggy:pig-fx）时抬一次。
 * 只改 z 序不改大小；猪窗口除猪本体外都穿透点击，压在上面不挡面板操作。
 */
function raisePetAbovePanel() {
  if (win === null || win.isDestroyed() || !win.isVisible()) return
  win.moveTop()
}

function ensurePanelWindow() {
  if (panelWin !== null && !panelWin.isDestroyed()) return panelWin
  panelReady = false
  panelAsked = null
  panelWin = new BrowserWindow({
    width: PANEL_FALLBACK.width, height: PANEL_FALLBACK.height, x: 0, y: 0,
    transparent: true, frame: false, resizable: false, movable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: true, show: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false,
      additionalArguments: ['--piggy-role=panel'] },
  })
  panelWin.setAlwaysOnTop(true, 'floating')
  if (FRAME_CAP > 0) panelWin.webContents.setFrameRate(FRAME_CAP)
  panelWin.loadURL('piggy://app/index.html')
  panelWin.webContents.on('did-finish-load', () => {
    panelReady = true
    log('panel page loaded')
    if (panelOpen && panelAnchor !== null) sendPanel({ type: 'open', vertical: panelAnchor.vertical, maxHeight: panelAnchor.maxHeight })
  })
  panelWin.webContents.on('console-message', (e, level, message) => { if (level >= 2) log('panel:', message) })
  panelWin.webContents.on('render-process-gone', (e, d) => { log('panel renderer gone', JSON.stringify(d)); panelWin = null; closePanel('crash') })
  // 点到别处（焦点离开面板、也没到猪身上）：告诉面板页面，它按「点外面自动收起」的设置决定收不收。
  panelWin.on('blur', panelFocusLeft)
  if (process.env.PIGGY_DEVTOOLS === '1') panelWin.webContents.openDevTools({ mode: 'detach' })
  return panelWin
}

/**
 * 焦点离开了猪窗口或面板窗口：如果也没落到另一个上，就是点到别处了。
 * 面板打开时不抢焦点（见 placePanel），焦点多半还在猪窗口上，所以两个窗口的失焦都要听。
 */
function panelFocusLeft() {
  if (!panelOpen) return
  setTimeout(() => {
    if (!panelOpen) return
    const focused = BrowserWindow.getFocusedWindow()
    if (focused !== null && (focused === win || focused === panelWin)) return
    sendPanel({ type: 'blur', toPet: false })
  }, 0)
}

/** 把面板窗口放到该在的地方；第一次有尺寸时才显示（免得先闪一个空窗口）。 */
function placePanel() {
  if (!panelOpen || panelWin === null || panelWin.isDestroyed()) return
  const next = panelBounds()
  if (next === null) return
  if (panelAsked === null || panelAsked.x !== next.x || panelAsked.y !== next.y
    || panelAsked.width !== next.width || panelAsked.height !== next.height) {
    panelWin.setBounds(next)
    panelAsked = next
  }
  if (panelSize !== null && !panelWin.isVisible()) {
    // 不抢焦点：GNOME 会把「抢焦点」变成一条「dsh-piggy is ready」的通知，每开一次面板弹一次
    //（2026-10-07 虚拟机录像里看到）。点进面板时它自然会拿到焦点。
    panelWin.showInactive()
    log('panel shown', JSON.stringify({ bounds: next, anchor: panelAnchor?.vertical }))
  }
}

function openPanel(pig) {
  if (Number.isFinite(pig?.x) && Number.isFinite(pig?.y) && pig?.width > 0 && pig?.height > 0) {
    panelPig = { x: pig.x, y: pig.y, width: pig.width, height: pig.height }
  }
  if (panelPig === null) return
  ensurePanelWindow()
  panelOpen = true
  // 每次打开都按默认规则重新挑对齐边（保持对齐只在拖完重定时用）
  panelAnchor = null
  panelAnchor = decidePanelAnchor()
  if (panelAnchor === null) return
  sendPanel({ type: 'open', vertical: panelAnchor.vertical, maxHeight: panelAnchor.maxHeight })
  placePanel()
}

function closePanel(why) {
  if (!panelOpen) return
  panelOpen = false
  if (panelWin !== null && !panelWin.isDestroyed()) panelWin.hide()
  sendPanel({ type: 'closed' })
  if (win !== null && !win.isDestroyed()) win.webContents.send('piggy:panel', { type: 'closed' })
  log('panel closed', why)
}

/** 猪窗口挪了（拖动、散步、贴边修正）：面板按猪的新位置重摆，不重新挑朝向（松手后再挑）。 */
function followPig() {
  if (!panelOpen || panelWin === null || panelWin.isDestroyed() || !panelWin.isVisible()) return
  placePanel()
}

/** 拖完 / 散步完：猪到了新地方，重新决定面板朝哪边开（放不下就换边）。 */
function reanchorPanel() {
  if (!panelOpen) return
  const next = decidePanelAnchor()
  if (next === null) return
  const changed = panelAnchor === null || next.vertical !== panelAnchor.vertical || next.maxHeight !== panelAnchor.maxHeight
  panelAnchor = next
  if (changed) sendPanel({ type: 'open', vertical: next.vertical, maxHeight: next.maxHeight })
  placePanel()
}

/** 猪页面：右键开/关面板（带上猪在窗口里的框）。 */
ipcMain.on('piggy:panel:toggle', (event, request) => {
  if (!fromPet(event)) return
  if (request?.open === true) openPanel(request.pig)
  else closePanel('pet')
})
/** 面板页面：内容量好了多大。 */
ipcMain.on('piggy:panel:size', (event, size) => {
  if (!fromPage(event) || event.sender !== panelWin?.webContents) return
  const width = Number(size?.width)
  const height = Number(size?.height)
  if (!(width > 0) || !(height > 0)) return
  panelSize = { width: Math.ceil(width), height: Math.ceil(height) }
  placePanel()
})
/** 任一页面：收起面板（面板里点了收起、点外面自动收起）。 */
ipcMain.on('piggy:panel:close', event => { if (fromPage(event)) closePanel('page') })
/** 面板页面里对猪的反应（喂食时猪的动作、冒气泡）：转给猪窗口去演。 */
// 猪窗口自己冒气泡（签到、点猪的反应）时也抬一次，跟面板转来的反应一样（用户 2026-10-10：气泡被面板盖住）。
ipcMain.on('piggy:pet-raise', event => {
  if (!fromPage(event) || event.sender !== win?.webContents) return
  raisePetAbovePanel()
})

ipcMain.on('piggy:pig-fx', (event, fx) => {
  if (!fromPage(event) || event.sender !== panelWin?.webContents) return
  if (win === null || win.isDestroyed() || typeof fx?.name !== 'string') return
  win.webContents.send('piggy:pig-fx', { name: fx.name, args: Array.isArray(fx.args) ? fx.args : [] })
  raisePetAbovePanel()
})

/** Where the DSH plugin keeps its pig (the folder moved from dsh-pig to dsh-piggy). */
function dshSavePath() {
  const home = process.env.DSH_HOME?.trim() ? resolve(process.env.DSH_HOME.trim()) : join(homedir(), '.dsh')
  for (const folder of ['dsh-piggy', 'dsh-pig']) {
    const file = join(home, folder, 'state.json')
    if (existsSync(file)) return file
  }
  return null
}

/** Copy DSH's pig over this one, keeping a copy of this one first. */
async function importFromDsh() {
  const source = dshSavePath()
  if (source === null) {
    await dialog.showMessageBox({ type: 'info', message: '没找到 DSH 里的猪', detail: '默认找 ~/.dsh/dsh-piggy/state.json（或 DSH_HOME 下面）。' })
    return
  }
  const { response } = await dialog.showMessageBox({
    type: 'question', buttons: ['导入', '算了'], defaultId: 0, cancelId: 1,
    message: '把 DSH 里的猪接过来？',
    detail: `从 ${source} 复制一份过来。桌面版现在这只会先备份，不会丢。`,
  })
  if (response !== 0) return
  quitting = true
  stopDrag()
  host.dispose()
  const target = statePath()
  mkdirSync(dirname(target), { recursive: true })
  if (existsSync(target)) copyFileSync(target, `${target}.before-import-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  copyFileSync(source, target)
  relaunch()
  app.exit(0)
}

/** Start with the system. Electron handles Windows; Linux gets an autostart entry. */
const autostartFile = join(homedir(), '.config', 'autostart', 'dsh-piggy.desktop')
function autostartOn() {
  return process.platform === 'linux' ? existsSync(autostartFile) : app.getLoginItemSettings().openAtLogin
}
function setAutostart(on) {
  if (process.platform !== 'linux') return app.setLoginItemSettings({ openAtLogin: on })
  if (!on) return rmSync(autostartFile, { force: true })
  const exec = process.env.APPIMAGE ?? process.execPath
  mkdirSync(dirname(autostartFile), { recursive: true })
  writeFileSync(autostartFile, `[Desktop Entry]\nType=Application\nName=dsh-piggy\nExec="${exec}"\nX-GNOME-Autostart-enabled=true\n`)
}

function createTray(gameDir) {
  const icon = nativeImage.createFromPath(join(HERE, 'build', 'tray.png'))
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('dsh-piggy')
  // Windows：单击托盘图标叫猪出来 / 藏起来（右键是菜单）
  tray.on('click', () => { if (win?.isVisible()) { closePanel('tray'); win.hide() } else win?.showInactive() })
  const menu = () => Menu.buildFromTemplate([
    { label: win?.isVisible() ? '藏起来' : '叫猪出来', click: () => { if (win?.isVisible()) { closePanel('tray'); win.hide() } else win?.showInactive(); tray?.setContextMenu(menu()) } },
    { label: '开机自启', type: 'checkbox', checked: autostartOn(), click: item => setAutostart(item.checked) },
    { label: '从 DSH 导入猪…', click: () => { importFromDsh() } },
    { type: 'separator' },
    { label: `游戏版本 ${readVersion(gameDir)}`, enabled: false },
    { label: '退出', click: () => app.quit() },
  ])
  tray.setContextMenu(menu())
}

function readVersion(gameDir) {
  try { return JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8')).version } catch { return '?' }
}

/** Keep a copy of the save before the game code under it changes. */
function backupSave(label) {
  const file = statePath()
  if (existsSync(file)) copyFileSync(file, `${file}.before-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
}

/** Load the new game: flush the save first, then start over. */
function restartGame() {
  quitting = true
  stopDrag()
  try { host?.dispose() } catch { /* best effort */ }
  // Testing runs one launch at a time; the next one is started by hand.
  if (process.env.PIGGY_CAPTURE) return app.exit(0)
  relaunch()
  app.exit(0)
}

// ---- 更新 App（页面里的 tabs/update.js）通过这几个口子调用 ----
let releases = []
ipcMain.handle('piggy:updates:current', event => (fromPage(event) ? versions?.current() : null))
ipcMain.handle('piggy:updates:list', async (event, fresh) => {
  if (!fromPage(event) || versions === null) return { ok: false, reason: '不在桌面版里' }
  try {
    releases = await versions.list({ fresh: fresh === true })
    return { ok: true, releases: releases.map(({ manifest, packUrl, ...rest }) => rest) }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
})
ipcMain.handle('piggy:updates:install', async (event, version) => {
  if (!fromPage(event) || versions === null) return { ok: false, reason: '不在桌面版里' }
  const target = releases.find(r => r.version === version)
  if (target === undefined) return { ok: false, reason: '先刷新一下版本列表' }
  if (target.blocked !== null) return { ok: false, reason: target.blocked === 'shell' ? '要先装新的安装包' : '存档太新，这个版本读不了' }
  try {
    backupSave('v' + target.version)
    await versions.install(target, fraction => toPages('piggy:progress', fraction))
    setTimeout(restartGame, 600)
    return { ok: true, version: target.version }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
})
ipcMain.handle('piggy:updates:rollback', event => {
  if (!fromPage(event) || versions === null) return { ok: false, reason: '不在桌面版里' }
  backupSave('rollback')
  const result = versions.rollback()
  if (result.ok) setTimeout(restartGame, 600)
  return result
})
ipcMain.handle('piggy:shell:status', event => (fromPage(event) ? shellUpdates?.status() : null))
ipcMain.handle('piggy:shell:download', async (event, version) => {
  if (!fromPage(event) || shellUpdates === null) return { ok: false, reason: '桌面外壳更新不可用' }
  // 预览版里的外壳也能下：只有在用预览版游戏的人，页面才会把它列出来。
  const target = releases.find(release => release.latestShell === version && release.shellUpdate)
  if (target === undefined) return { ok: false, reason: '版本列表过期了，点上面的「刷新」再试一次' }
  return shellUpdates.download(version, target.prerelease === true, target.tag)
})
ipcMain.handle('piggy:shell:install', event => {
  if (!fromPage(event) || shellUpdates === null || shellUpdates.status().readyVersion === null) return { ok: false, reason: '还没有下载好桌面外壳' }
  if (process.env.PIGGY_CAPTURE) return { ok: false, reason: '截图测试不会安装更新' }
  backupSave('shell-v' + shellUpdates.status().readyVersion)
  setTimeout(() => {
    try { shellUpdates?.install() } catch (error) { log('shell update install failed', String(error)) }
  }, 600)
  return { ok: true }
})
ipcMain.handle('piggy:quit', (event) => { if (fromPage(event)) app.quit() })
// 设置 → 日志 → 导出：弹系统「另存为」，把日志写到用户选的位置。
ipcMain.handle('piggy:save-log', async (event, payload) => {
  if (!fromPage(event)) return { ok: false, reason: '来源不对' }
  const name = typeof payload?.name === 'string' && payload.name.trim() !== '' ? payload.name.trim() : 'dsh-piggy-log.txt'
  const text = typeof payload?.text === 'string' ? payload.text : ''
  try {
    const picked = await dialog.showSaveDialog(win ?? undefined, {
      title: '导出日志',
      defaultPath: join(app.getPath('downloads'), name),
      filters: [{ name: '日志文本', extensions: ['txt'] }, { name: '全部文件', extensions: ['*'] }],
    })
    if (picked.canceled === true || typeof picked.filePath !== 'string' || picked.filePath === '') return { ok: false, canceled: true }
    writeFileSync(picked.filePath, text, 'utf8')
    log('log exported', picked.filePath, String(text.length))
    return { ok: true, path: picked.filePath }
  } catch (error) {
    log('log export failed', String(error))
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
})
ipcMain.handle('piggy:open', (event, url) => {
  // Only this repo's own pages: the release notes and installers.
  if (fromPage(event) && typeof url === 'string' && url.startsWith(RELEASES_PAGE.replace(/\/releases$/, '/'))) shell.openExternal(url)
})

let proxySettings = null
for (const action of ['get', 'set', 'clear', 'test']) {
  ipcMain.handle('piggy:proxy:' + action, async (event, value) => {
    if (!fromPage(event) || proxySettings === null) return { ok: false, reason: '代理设置不可用' }
    return proxySettings[action](value)
  })
}

app.whenReady().then(async () => {
  if (needsX11) return
  proxySettings = createProxy({ path: join(app.getPath('userData'), 'proxy.json'),
    sessions: [session.defaultSession, session.fromPartition('electron-updater', { cache: false })] })
  await proxySettings.init()
  log('start', app.getVersion(), process.platform, process.env.XDG_SESSION_TYPE ?? '')
  shellUpdates = createShellUpdates({
    mode: shellUpdateMode({ platform: process.platform, packaged: app.isPackaged,
      portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE), appImage: process.env.APPIMAGE }),
    currentVersion: app.getVersion(), updater: autoUpdater,
    onProgress: fraction => toPages('piggy:shell-progress', fraction),
  })
  versions = createVersions({
    userData: app.getPath('userData'), bundledDir: bundledGameDir(), shellVersion: app.getVersion(),
    statePath: statePath(), releasesUrl: process.env.PIGGY_RELEASES_URL || undefined,
    // Chromium's network stack: follows the system proxy, which plain fetch does not.
    fetch: /** @type {any} */ (net.fetch.bind(net)),
  })
  // Gitee 的 Windows 安装包不带游戏：第一次先下载（first-run.js）。
  let firstRun = null
  if (versions.needsGame()) {
    firstRun = await downloadFirstGame({ versions, pinPath: gamePinPath(app, HERE), here: HERE, releasesPage: RELEASES_PAGE, log })
    if (firstRun === null) { app.quit(); return }
  }
  const gameDir = versions.activeDir()
  host = await startHost(gameDir, statePath(), { fetch: net.fetch.bind(net), onSnapshot: view => toPages('piggy:state-changed', view) })
  hostJournal = /** @type {any} */ (host)?.store?.journal ?? null
  hostJournal?.record?.('info', 'shell', `桌面外壳 ${app.getVersion()} · 游戏包 ${gameDir}`)
  registerProtocol(gameDir)
  createWindow()
  firstRun?.destroy()
  createTray(gameDir)
  // 用户机器上到底是什么显示器、什么缩放：以前日志里没有，Windows 的问题只能靠猜。
  log('displays', JSON.stringify(screen.getAllDisplays().map(display => ({ id: display.id, label: display.label,
    bounds: display.bounds, workArea: display.workArea, scale: display.scaleFactor, internal: display.internal }))))
  // The window follows its screen's work area when it changes (taskbar moved, resolution changed).
  // 显式告诉游戏包「显示器变了」：applyBounds 有 2px 死区，窗口不需要挪的时候它不会推几何，
  // 页面手里的 workAreas 就会一直用旧的那份（分辨率变了但窗口刚好没动 → 用的是旧工作区）。
  const reclamp = (why, detail) => {
    if (win === null || win.isDestroyed()) return
    const bounds = win.getBounds()
    applyBounds(clampBounds(bounds, workAreaFor(bounds)), 'display')
    pushGeometry()
    log('display', why, JSON.stringify(detail ?? {}))
  }
  screen.on('display-metrics-changed', (event, display, changedMetrics) => {
    reclamp('metrics-changed', { id: display?.id, scale: display?.scaleFactor, workArea: display?.workArea, changed: changedMetrics })
  })
  screen.on('display-added', (event, display) => reclamp('added', { id: display?.id, bounds: display?.bounds, scale: display?.scaleFactor }))
  screen.on('display-removed', (event, display) => reclamp('removed', { id: display?.id, bounds: display?.bounds }))
  // 兜底对账：显示器事件在个别平台/驱动下会漏（Shimeji 干脆每 5 秒轮询一次，因为 AWT 没有事件）。
  // 我们订阅了事件，再每 10 秒比一次工作区列表，不一样就当作「显示器变了」处理一次。
  let lastDisplayKey = ''
  displayWatchTimer = setInterval(() => {
    if (win === null || win.isDestroyed()) return
    const key = JSON.stringify(screen.getAllDisplays().map(display =>
      [display.id, display.workArea.x, display.workArea.y, display.workArea.width, display.workArea.height, display.scaleFactor]))
    if (key === lastDisplayKey) return
    lastDisplayKey = key
    reclamp('reconcile', { displays: screen.getAllDisplays().length })
  }, 10000)
  displayWatchTimer.unref?.()
  win.webContents.on('did-finish-load', () => pushGeometry())
  pushGeometry()
})

/**
 * Testing: run a list of steps against the page and photograph it (with its
 * transparency), printing the clickable regions each time; then quit. Wayland
 * desktops cannot be screenshotted from here, so this is how the window is
 * checked. Steps (PIGGY_CAPTURE_STEPS, JSON): { js } runs code in the page,
 * { click } clicks a selector inside the pig, { wait } pauses, { shot } saves a PNG.
 */
async function captureForCheck(dir) {
  const wait = ms => new Promise(done => setTimeout(done, ms))
  const steps = process.env.PIGGY_CAPTURE_STEPS
    ? JSON.parse(process.env.PIGGY_CAPTURE_STEPS)
    : [{ shot: 'first' }, { js: "document.querySelector('[data-dsh-pig] .dp-scene').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))" }, { shot: 'toggled' }]
  mkdirSync(dir, { recursive: true })
  await wait(2500)
  for (const step of steps) {
    if (step.wait) await wait(step.wait)
    if (step.js) await win.webContents.executeJavaScript(step.js).catch(error => console.log('[capture] js failed', String(error)))
    if (step.click) {
      const ok = await win.webContents.executeJavaScript(`(() => { const n = document.querySelector('[data-dsh-pig] ${step.click.replace(/'/g, "\\'")}'); if (n) n.click(); return n !== null })()`)
      console.log('[capture] click', step.click, ok)
      await wait(400)
    }
    if (step.shot) {
      await wait(1200)
      const image = await win.webContents.capturePage()
      writeFileSync(join(dir, step.shot + '.png'), image.toPNG())
      console.log('[capture]', step.shot, JSON.stringify({ shape: lastShape }))
    }
  }
  app.quit()
}

// 兜底：主进程里漏网的异常只写日志，不弹「A JavaScript error occurred」那种错误框吓人。
process.on('uncaughtException', error => { log('uncaught', error?.stack ?? String(error)) })

app.on('second-instance', () => win?.showInactive())
app.on('before-quit', () => { quitting = true; stopDrag(); if (hitTimer !== null) clearInterval(hitTimer); try { host?.dispose() } catch { /* best effort */ } })
app.on('window-all-closed', () => app.quit())
