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
 * - 游戏运行时在后台单写者中执行，界面经 piggy:// 访问。
 * - 存档在 userData/state.json，默认数据目录名为 piggy，跟 DSH 里那只各养各的；托盘里可以导入。
 */
import { panelViewportSize, panelContentRect } from './lib/panel-geometry.js'
import { createResizeShape } from './lib/resize-shape.js'
import { auxiliaryWindowOptions } from './lib/auxiliary-window.js'
import { createLinuxDisplayRebuild } from './lib/linux-display-rebuild.js'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { access, appendFile, copyFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { BrowserWindow, Menu, Tray, app, dialog, ipcMain, nativeImage, net, protocol, screen, session, shell } from 'electron'
import updaterPackage from 'electron-updater'

import { startBackgroundHost } from './lib/background-host.js'
import { configureDesktopData, bundledDesktopGame } from './lib/data-paths.js'
import { migrateDesktopData } from './lib/data-migration.js'
import { MIN_WINDOW, WINDOW_PADDING, clampBounds, contentBoundsForPig, dragPigBounds, desktopViewportBounds, moveAcrossDisplays, resizedPigScreenPoint } from './lib/window-geometry.js'
import { recoverBounds, recoveryPayload } from './lib/pig-recovery.js'
import { createProxy } from './lib/proxy.js'
import { RELEASES_PAGE } from './lib/versions.js'
import { startBackgroundVersions } from './lib/background-versions.js'
import { createShellUpdates, shellUpdateMode } from './lib/shell-update.js'
import { dragHeartbeatExpired } from './lib/drag-watchdog.js'
import { validDragOrigin } from './lib/drag-origin.js'
import { PANEL_FALLBACK, panelAnchorFor, panelBoundsFor, pigScreenBox, panelReferenceFor } from './lib/panel-geometry.js'
import { panelToggleAction } from './lib/panel-toggle.js'
import { pointerHitsShape } from './lib/pointer-hit.js'
import { createFullscreenWatch, shouldHide } from './lib/fullscreen.js'
import { createExtensionLayer } from './lib/extension-layer.js'
import { createExtensionWindow } from './lib/extension-window.js'
import { createExternalManager } from './lib/external.js'
import { SHOW_FALLBACK_MS, createShowGate } from './lib/window-show.js'
import { downloadFirstGame, gamePinPath } from './first-run.js'
import { reportStartupFailure, pageCrashReason } from './lib/startup-failure.js'
import { appendJournalSync, journalLine } from './lib/startup-journal.js'
import { readPostBody, saveArchive } from './lib/save-export.js'
import { createWindowState } from './lib/window-state.js'
import { createAutostart } from './lib/autostart.js'
import { createDesktopTray } from './lib/tray.js'

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

let logDirectoryReady = null
let logWriting = Promise.resolve()

/** 启动失败也能诊断；目录只准备一次，追加按调用顺序执行。 */
function log(...parts) {
  const line = journalLine(parts)
  if (process.env.PIGGY_CAPTURE) process.stdout.write(line)
  logWriting = logWriting.then(async () => {
    const file = join(app.getPath('userData'), 'piggy.log')
    logDirectoryReady ??= mkdir(dirname(file), { recursive: true })
    await logDirectoryReady
    await appendFile(file, line)
  }).catch(() => { logDirectoryReady = null })
  // 同一句话也进游戏自己的日志：设置里导出的那一份要能看到窗口和更新出了什么事。
  try { hostJournal?.record('info', 'shell', parts.join(' ')) } catch { /* 日志不许反过来把猪弄挂 */ }
  return logWriting
}

async function flushLogs() {
  let writing
  do { writing = logWriting; await writing } while (writing !== logWriting)
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
const dataPaths = configureDesktopData(app)
const gotLock = !needsX11 && app.requestSingleInstanceLock()
// 第二个进程拿不到单实例锁就马上退出：先同步留一行再退。第一个进程可能还没 ready、
// 甚至卡在启动里，它的 second-instance 行不一定写得出来；没有这一行，日志里就看不出
// 「用户又双击了一次」，只能看到第一次启动的痕迹。
if (!needsX11 && !gotLock) {
  try {
    appendJournalSync(join(app.getPath('userData'), 'piggy.log'),
      journalLine(['second launch rejected', JSON.stringify({ pid: process.pid, version: app.getVersion() })]))
  } catch { /* 日志不许挡住退出 */ }
  app.quit()
}

/** The game shipped inside the app; downloaded versions live under userData (lib/versions.js). */
const bundledGameDir = () => bundledDesktopGame(app, HERE)

const statePath = () => dataPaths.statePath

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf' }

/** Serve a file from `root`, refusing anything that climbs out of it. */
async function serveFile(root, rel) {
  const base = resolve(root)
  const file = resolve(base, rel)
  if (!file.startsWith(base + sep)) return new Response('not found', { status: 404 })
  const type = MIME[extname(file)] ?? 'application/octet-stream'
  // 立绘、字体让浏览器缓存：摸猪时立绘在「摸」和「平常」之间来回换，
  // 不缓存的话每次都要重新取一遍，Windows 上会空一帧（猪闪一下）。
  const cache = /^(image|font)\//.test(type) ? { 'cache-control': 'max-age=86400' } : {}
  try {
    // Chromium 的 file loader 支持 ASAR，字体也不必整块读进主进程再复制。
    const response = await net.fetch(pathToFileURL(file).href)
    if (!response.ok) {
      await response.body?.cancel()
      return new Response('not found', { status: 404 })
    }
    return new Response(response.body, { headers: { 'content-type': type, ...cache } })
  } catch { return new Response('not found', { status: 404 }) }
}

let host = null
let hostStarting = null
/** 外部连接开关（设置 → 外部连接）。 */
let externalManager = null
/** @type {Awaited<ReturnType<typeof startBackgroundVersions>> | null} */
let versions = null
let versionsStarting = null
/** @type {ReturnType<typeof createShellUpdates> | null} */
let shellUpdates = null
let win = null
/** 猪窗口什么时候显示（Linux 等第一次 content，见 lib/window-show.js）。 */
let showGate = null
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
/** 扩展的大窗口（role=ext）和它显示的扩展；一次只开一个。 */
const extensionWindow = createExtensionWindow({
  BrowserWindow, screen, ipcMain,
  icon: join(HERE, 'build', 'icon.png'),
  preload: join(HERE, 'preload.cjs'),
  url: 'piggy://app/index.html',
  getLayer: () => extensionLayer,
  getPanel: () => panelWin,
  isPanelOpen: () => panelOpen,
  fromPage: event => fromPage(event),
  fromExt: event => fromExt(event),
  log,
})
const extensionLayer = createExtensionLayer({ extension: () => extensionWindow.current(), overlays: () => [panelWin, win] })
/** 正在退出/重启：关掉窗口前先置位，之后到达的页面消息一律不处理。 */
let quitting = false
/** 导入与版本切换共用一次预约，直到重启/安装完成前不接受第二次切换。 */
let activeAction = null
let quitAfterAction = false
function reserveAction(kind, phase = 'commit') {
  if (quitting || activeAction !== null) return null
  activeAction = { kind, phase, cancelled: false }
  return activeAction
}
function releaseAction(action) {
  if (activeAction !== action) return
  activeAction = null
  if (quitAfterAction) { quitAfterAction = false; app.quit() }
}
/**
 * 消息是不是这扇窗口的页面发来的。窗口销毁后再读 win.webContents 会抛
 * 「Object has been destroyed」—— Windows 上在更新页切换版本时，旧页面的消息还在路上，
 * 主进程直接弹了错误框（用户 2026-10-05 实测）。所以先查 isDestroyed。
 */
function fromPage(event) {
  return fromPet(event) || (!quitting && panelWin !== null && !panelWin.isDestroyed() && event.sender === panelWin.webContents) || fromExt(event)
}
/** 扩展的大窗口（外壳 0.6.5 起，菜园的大农场）。 */
function fromExt(event) {
  return !quitting && extensionWindow.owns(event.sender)
}
/** 只有猪窗口能挪猪、改形状（面板窗口的页面也装了同一套游戏包，不许它动猪窗口）。 */
function fromPet(event) {
  return !quitting && win !== null && !win.isDestroyed() && event.sender === win.webContents
}
/** 发给两个窗口的页面（下载进度、存档变了这类两边都要知道的事）。 */
function toPages(channel, ...args) {
  for (const target of [win, panelWin, extensionWindow.current()]) {
    if (target !== null && !target.isDestroyed()) target.webContents.send(channel, ...args)
  }
}

/** 合并确认：内容由桌面端自己算；窗口隐藏时先显示窗口。 */
async function confirmMerge(plan) {
  try {
    if (win === null || win.isDestroyed()) return false
    if (!win.isVisible()) win.show()
    win.focus()
    const result = typeof plan?.target === 'object'
      ? `合并前会分别备份两只猪。合并后内嵌猪会退役，不再长大。`
      : '合并前会分别备份两只猪。'
    const answer = await dialog.showMessageBox(win, {
      type: 'question', buttons: ['取消', '允许合并'], defaultId: 0, cancelId: 0, noLink: true,
      title: 'DSH 想把内嵌猪合并到这只猪',
      message: 'DSH 想把内嵌猪合并到这只猪',
      detail: `${planLine('桌宠', plan?.target)}${planLine('内嵌', plan?.source)}${planLine('合并后', plan?.result)}\n${result}`,
    })
    return answer.response === 1
  } catch (error) {
    log('merge confirm failed', String(error))
    return false
  }
}

function planLine(label, summary) {
  if (summary === null || summary === undefined) return ''
  return `${label}：${summary.name ?? ''} · Lv.${summary.level ?? '?'} · 金币 ${summary.coins ?? 0}\n`
}

function fromPanelOnly(event) {
  return !quitting && panelWin !== null && !panelWin.isDestroyed() && event.sender === panelWin.webContents
}

function registerProtocol(gameDir) {
  protocol.handle('piggy', async request => {
    const url = new URL(request.url)
    const path = decodeURIComponent(url.pathname)
    if (path.startsWith('/dsh-piggy/')) {
      const body = request.method === 'POST' ? await readPostBody(request) : undefined
      if (quitting) return new Response('game runtime closing', { status: 503 })
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
const windowState = createWindowState({
  getWindow: () => win,
  getPigOffset: () => lastPigWindow,
  userDataDir: app.getPath('userData'),
})
const {
  read: readWindowState,
  flush: flushWindowState, schedule: scheduleWindowStateSave,
} = windowState

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
  // 分数缩放回读可能比请求大 1px；目标没变时不要每个拖动 tick 重设同一窗口。
  // 新目标仍用零容差，保证 1px 鼠标位移可达；真实外部偏移超出容差时继续纠正。
  const sameRequest = petAsked !== null && ['x', 'y', 'width', 'height'].every(key => petAsked[key] === next[key])
  const tolerance = (why === 'drag' || why === 'move') && !sameRequest ? 0 : BOUNDS_TOLERANCE
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
 * Windows 上不用 setShape，改用鼠标穿透：现代游戏由主进程轮询命中，旧游戏由页面上报。
 * setShape 在 Windows 上是 SetWindowRgn，开关面板时可点区域整块变化，透明分层窗口会闪一下白
 * （用户 2026-10-05：装了 0.2.5 右键开关菜单仍闪白屏）。穿透模式下窗口区域从不变化。
 * PIGGY_SHAPE=1 可退回旧做法，方便对比排查。
 */
const PASSTHROUGH = process.platform === 'win32' && process.env.PIGGY_SHAPE !== '1'
let passthroughHit = false
let passthroughForward = null
/** 未知能力不安装全局转发钩子；有效 place 确认现代能力后不再降级（2026-10-16）。 */
let passthroughMode = 'unknown'
let hitTimer = null
function setHit(hit) {
  if (!PASSTHROUGH || win === null || win.isDestroyed()) return
  const forward = passthroughMode === 'legacy'
  if (hit === passthroughHit && forward === passthroughForward) return
  passthroughHit = hit
  passthroughForward = forward
  win.setIgnoreMouseEvents(!hit, { forward })
}

function setLegacyHit(hit = passthroughHit) {
  if (passthroughMode === 'modern') return
  passthroughMode = 'legacy'
  setHit(hit)
}

/** 只把合法的窗口协议消息作为能力证据，不能让坏消息启用全局转发。 */
function isMouseRect(rect) {
  return rect != null && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    && rect.width >= 0 && rect.height >= 0
}
function isMouseShape(rects) {
  return Array.isArray(rects) && rects.every(isMouseRect)
}
function isPlaceRequest(request) {
  return request !== null && typeof request === 'object' && !Array.isArray(request)
    && [request.bounds, request.pig].every(rect => rect === undefined || (isMouseRect(rect) && rect.width > 0 && rect.height > 0))
    && (request.shape === undefined || isMouseShape(request.shape))
}

/** 穿透窗口可能收不到第一次 mousemove；主进程读取光标，保证首次点击就能命中猪。 */
function shiftedShape(rects, slide) {
  if (slide.x === 0 && slide.y === 0) return rects
  return rects.map(rect => ({
    x: Math.max(0, rect.x + slide.x),
    y: Math.max(0, rect.y + slide.y),
    width: rect.width,
    height: rect.height,
  }))
}

function refreshHit() {
  if (!PASSTHROUGH || !hasPlacedShape || win === null || win.isDestroyed() || dragSession !== null) return
  const bounds = win.getBounds()
  const shape = flightShapeActive || dragShapeActive
    ? [{ x: 0, y: 0, width: bounds.width, height: bounds.height }]
    : shiftedShape(placedShape, flightSlide)
  setHit(pointerHitsShape(screen.getCursorScreenPoint(), bounds, shape))
}

/** 抛掷只挪窗口，不重排、不 followPig、不推几何、不写 window.json（A2）。 */
function applyFlightBounds(x, y) {
  if (win === null || win.isDestroyed()) return
  const size = petAsked ?? win.getBounds()
  const next = { x: Math.round(x), y: Math.round(y), width: size.width, height: size.height }
  if (petAsked !== null && petAsked.x === next.x && petAsked.y === next.y
    && petAsked.width === next.width && petAsked.height === next.height) return
  win.setBounds(next)
  petAsked = { ...next }
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

/** 显示猪窗口（只显示一次；日志保留原来的 shown 行格式）。 */
function showPigWindow() {
  if (win === null || win.isDestroyed() || win.isVisible()) return
  win.showInactive()
  log('shown', JSON.stringify(win.getBounds()), win.isVisible())
}

async function createWindow(override = null) {
  const saved = override ?? await readWindowState()
  if (quitting) return
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
    ...auxiliaryWindowOptions(process.platform),
    backgroundColor: '#00000000',
    // backgroundThrottling: 这个窗口从不获得焦点（showInactive + skipTaskbar），Chromium 默认
    // 会把「后台窗口」的 rAF/定时器降频；而页面测量、闭环核对、形状上报全走 rAF，
    // 被降频就会表现为「猪慢半拍 / 挪完窗口猪还在旧位置」。桌宠没有省电的必要，关掉。
    webPreferences: { preload: join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  })
  const createdWindow = win
  win.setAlwaysOnTop(true, 'floating')
  // 30fps：猪的动画够看，整窗合成的次数砍一半（D1 第 3 条）。
  if (FRAME_CAP > 0) win.webContents.setFrameRate(FRAME_CAP)
  // Linux 先不显示：等页面报真实内容和形状后再显示（见 lib/window-show.js）。
  // 以前这里先 applyShape([]) 再按兜底尺寸显示、随后 resize，共享 rootless Xwayland
  // 会把新尺寸 damage 复制进旧尺寸缓冲，在 pixman_blt 里 SIGSEGV。
  showGate = createShowGate({ platform: process.platform })
  // 页面还没报猪在哪时完全穿透，也不启用未知游戏的鼠标转发。
  if (PASSTHROUGH) { passthroughMode = 'unknown'; passthroughForward = null; setHit(false) }
  if (PASSTHROUGH) {
    hitTimer = setInterval(refreshHit, 16)
    hitTimer.unref?.()
  }
  win.loadURL('piggy://app/index.html')
  // 启动摆放最多管 3 秒：之后一律按猪当前位置算，免得哪次没对上就一直往回拽。
  win.once('ready-to-show', () => { setTimeout(() => { if (win === createdWindow) savedPigScreen = null }, 3000) })
  win.once('ready-to-show', () => {
    if (win !== createdWindow) return
    log('ready-to-show')
    if (showGate !== null && showGate.readyToShow()) showPigWindow()
    // 页面一直不报内容：兜底显示，不能永远不出现。
    setTimeout(() => {
      if (win === createdWindow && showGate !== null && showGate.timeout()) {
        log('show fallback', JSON.stringify(showGate.status()))
        showPigWindow()
      }
    }, SHOW_FALLBACK_MS).unref?.()
  })
  win.webContents.on('did-finish-load', () => {
    const gate = showGate === null ? null : showGate.status()
    log('page loaded', JSON.stringify({ gate }))
    // 页面加载完、显示门还关着：日志要能区分「页面根本没加载」和「加载了但一直没来首帧/内容」。
    if (gate?.pending === true) log('page loaded before show gate opened', JSON.stringify({ waiting: gate.waiting }))
  })
  // 页面加载失败时显示门永远不会放行（Linux 等 content、其它平台等 ready-to-show）：
  // 日志里留下失败码和地址；窗口还没显示过就把失败也弹出来，不能只留一份看不见的日志。
  let startupPageFailureReported = false
  win.webContents.on('did-fail-load', async (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    log('page failed', JSON.stringify({ errorCode, errorDescription, url: validatedURL, mainFrame: isMainFrame }))
    if (isMainFrame !== true || quitting || startupPageFailureReported || win === null || win.isDestroyed() || win.isVisible() || showGate?.pending !== true) return
    startupPageFailureReported = true
    let logPath = 'piggy.log'
    try { logPath = join(app.getPath('userData'), 'piggy.log') } catch { /* 连 userData 都读不到时至少弹框 */ }
    await reportStartupFailure({
      dialog, log,
      error: new Error(`游戏页面加载失败：${errorDescription}（${errorCode}）`),
      logPath, version: app.getVersion(), platform: process.platform,
    })
    app.quit()
  })
  // 面板开着时焦点离开猪窗口、也没进面板：当作点到别处（见 panelFocusLeft）
  win.on('blur', () => panelFocusLeft())
  // 窗口卡住/恢复时只记日志（不弹框、不强推显示）：卡住往往就是「一直不显示」的那几秒。
  win.on('unresponsive', () => log('window unresponsive', JSON.stringify({ gate: showGate === null ? null : showGate.status() })))
  win.on('responsive', () => log('window responsive'))
  win.webContents.on('render-process-gone', (e, details) => {
    stopDrag()
    const gate = showGate === null ? null : showGate.status()
    log('renderer gone', JSON.stringify(details), JSON.stringify({ visible: win?.isVisible?.() === true, gate }))
    // 窗口还没显示过就崩（启动时最常见）：用户看到的是「双击没反应」，和页面加载失败一样
    // 先写日志、再弹一次，然后退出；已经显示过就只记日志，不在运行中弹框。
    void reportStartupCrash(details, gate)
  })
  async function reportStartupCrash(details, gate) {
    if (quitting || startupPageFailureReported || win === null || win.isDestroyed() || win.isVisible() || gate?.pending !== true) return
    startupPageFailureReported = true
    let logPath = 'piggy.log'
    try { logPath = join(app.getPath('userData'), 'piggy.log') } catch { /* 连 userData 都读不到时至少弹框 */ }
    await reportStartupFailure({ dialog, log, error: new Error(pageCrashReason(details)), logPath, version: app.getVersion(), platform: process.platform })
    app.quit()
  }
  win.webContents.on('console-message', (e, level, message) => { if (level >= 2) log('page:', message) })
  if (process.env.PIGGY_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' })
  if (process.env.PIGGY_CAPTURE) win.webContents.once('did-finish-load', () => { captureForCheck(process.env.PIGGY_CAPTURE) })
}

/** Refresh native pixel/DIP caches by using the already-tested cold view path. */
async function rebuildLinuxViews() {
  if (quitting || win === null || win.isDestroyed()) return
  const previous = win
  const previousPanel = panelWin
  const bounds = petAsked ?? previous.getBounds()
  const pig = lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }
  const saved = { ...bounds, pig: { x: bounds.x + pig.x, y: bounds.y + pig.y } }
  stopDrag()
  resizeShape.cancel()
  closePanel('display')
  previous.hide()
  lastContent = null
  lastPigWindow = null
  restingPigScreen = null
  lastShape = []
  placedShape = []
  hasPlacedShape = false
  await createWindow(saved)
  previous.removeAllListeners()
  previous.webContents.removeAllListeners()
  previous.destroy()
  if (previousPanel && !previousPanel.isDestroyed()) {
    previousPanel.removeAllListeners()
    previousPanel.webContents.removeAllListeners()
    previousPanel.destroy()
  }
  panelWin = null
  if (quitting) return
  ensurePanelWindow()
  pushGeometry()
  log('display views rebuilt', JSON.stringify({ bounds: win.getBounds() }))
}

let lastShape = []
/** 页面最近一次摆放时给的可点区域（拖动中猪在窗口里滑时要跟着挪，见 dragTick）。 */
let placedShape = []
let hasPlacedShape = false
/** A2 抛掷：窗口被夹在屏幕里时，可点/可见形状要跟着猪在窗口里滑。 */
let flightSlide = { x: 0, y: 0 }
let lastFlightShapeSlide = null
/** 抛掷期间用整窗形状：不每帧 setShape，也不会因为窗口被夹/内容滑动把猪裁掉。 */
let flightShapeActive = false
/** 拖动期间同理：整窗形状，避免贴边滑动时形状跟不上把猪裁掉。 */
let dragShapeActive = false
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
  const width = content?.width
  const height = content?.height
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
    || (content.shape !== undefined && !isMouseShape(content.shape))) {
    if (content?.immediate === true) event.returnValue = null
    return
  }
  setLegacyHit()
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
  if (showGate !== null && showGate.content()) showPigWindow()
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

function dragTick(cursorOverride) {
  if (win === null || win.isDestroyed() || dragSession === null) return
  if (dragStats !== null) {
    const now = Date.now()
    dragStats.ticks += 1
    dragStats.maxGap = Math.max(dragStats.maxGap, now - dragStats.last)
    dragStats.last = now
  }
  if (dragHeartbeatExpired(dragSession.lastHeartbeat, Date.now())) { stopDrag(); return }
  // 松手时页面把最后的屏幕坐标带过来：输入队列偶尔会把最后一次 move 排在 end 后面，
  // 只用主进程此刻读到的光标会少走一小段（贴边快速拖动时最明显）。
  const cursor = cursorOverride !== null && cursorOverride !== undefined
    && Number.isFinite(cursorOverride.x) && Number.isFinite(cursorOverride.y)
    ? { x: cursorOverride.x, y: cursorOverride.y } : screen.getCursorScreenPoint()
  // 夹取按「所有屏」算，不按鼠标当前在哪块屏：鼠标一过两块屏的缝就换夹取范围，
  // 会把猪整只弹回去（上下屏最明显）。见 lib/window-geometry.js 的 dragPigBounds。
  const areas = screen.getAllDisplays().map(display => display.workArea)
  // 按「猪」算，不按起始窗口算：拖动中窗口大小可能变（冒气泡、面板换页），
  // 用起始窗口的大小去 setBounds 会把窗口来回改大改小，猪就一抽一抽的。
  const pig = dragSession.pig ?? { ...(lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }), ...lastPigSize }
  // 窗口大小用请求值，不用回读值（见 petAsked 的说明）
  const wanted = dragPigBounds(petAsked ?? win.getBounds(), pig, dragSession.pigScreen, dragSession.cursor, cursor, areas, dragSession.visual)
  if (!dragShapeActive) {
    dragShapeActive = true
    if (!PASSTHROUGH) {
      const bounds = win.getBounds()
      applyShape([{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
    }
    refreshHit()
  }
  if (!dragSession.slide) { applyBounds(wanted, 'drag'); return }
  // 窗口只在整个桌面的外沿夹取，屏幕接缝允许跨过；猪在窗口里滑过外沿留白：
  // GNOME 等窗口管理器不让程序把窗口摆到屏幕外，猪窗口四周又有透明留白（气泡区），
  // 拖到屏幕边上时窗口被卡住、猪就停在离边一大截的地方，松手才瞬移过去
  // （2026-10-07 虚拟机真拖录像逐帧看到的）。现在窗口夹在工作区里，超出去的那一截
  // 告诉页面，让它把猪在窗口里挪过去——猪一路跟着鼠标走到边上。
  const held = desktopViewportBounds(wanted, areas)
  const slide = { x: wanted.x - held.x, y: wanted.y - held.y }
  applyBounds(held, 'drag')
  if (slide.x !== dragSession.lastSlide.x || slide.y !== dragSession.lastSlide.y) {
    dragSession.lastSlide = slide
    lastDragSlide = slide
    win.webContents.send('piggy:drag-slide', slide)
    followPig()
    // 拖动期间用整窗形状（drag:start 时设置）：窗口被夹住时猪在窗口里滑，
    // 逐帧改 setShape 既慢又容易在 X11 上把猪裁掉/刷空。松手后页面 place 恢复精确形状。
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
  // A1：页面可能延迟到移动 4px 才发 drag:start，带上 pointerdown 的屏幕坐标当起点。
  // 快速甩动时第一帧就可能离 pointerdown 上百像素，不能按 32px 拒绝；
  // 只拒绝非有限值、超出 512px 或不在当前屏工作区内的坏消息。
  const cursorNow = screen.getCursorScreenPoint()
  const rawOrigin = given?.origin
  const originValid = rawOrigin !== null && rawOrigin !== undefined
    && Number.isFinite(rawOrigin.x) && Number.isFinite(rawOrigin.y)
  const originArea = originValid ? screen.getDisplayNearestPoint(rawOrigin).workArea : null
  const acceptedOrigin = validDragOrigin(rawOrigin, cursorNow, originArea)
  const dragOrigin = acceptedOrigin ?? cursorNow
  // 新游戏包会把猪在窗口里的位置和大小一起带过来（它自己量的，不再经过 piggy:content）。
  const pigFromPage = Number.isFinite(given?.x) && Number.isFinite(given?.y) && given?.width > 0 && given?.height > 0
    ? { x: given.x, y: given.y, width: given.width, height: given.height } : null
  const pig = pigFromPage ?? lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }
  dragSession = {
    cursor: dragOrigin,
    pigScreen: { x: bounds.x + pig.x, y: bounds.y + pig.y },
    pig: pigFromPage,
    visual: pigFromPage !== null && isMouseRect(given?.visual) && given.visual.width > 0 && given.visual.height > 0
      && given.visual.x <= pigFromPage.x && given.visual.y <= pigFromPage.y
      && given.visual.x + given.visual.width >= pigFromPage.x + pigFromPage.width
      && given.visual.y + given.visual.height >= pigFromPage.y + pigFromPage.height
      ? { ...given.visual } : null,
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
  dragShapeActive = true
  if (!PASSTHROUGH) applyShape([{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
  refreshHit()
  resizeShape.cancel()
  log('drag start', JSON.stringify({ bounds, pigScreen: dragSession.pigScreen, pigFromPage: pigFromPage !== null,
    origin: acceptedOrigin }))
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
ipcMain.on('piggy:drag:end', (event, release) => {
  if (!fromPet(event)) return
  // 页面的 release 坐标可能比主进程此刻读到的光标旧（输入队列延迟）；
  // 主进程的光标是最新值，最后一帧用它算 slide。
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
  // 页面紧接着要读几何重定家：把最后一帧 slide 一起同步返回，避免 send/sendSync 乱序。
  event.returnValue = geometryOf(win?.getBounds() ?? { x: 0, y: 0, width: 0, height: 0 }, geometrySeq)
})

/**
 * 新游戏包的桌面逻辑：窗口摆哪、多大、哪里可点，都由页面算好，主进程只照做。
 * 同步返回改完后的几何，页面同一轮里就能接着用。以后这类调整只发游戏包，不用再发桌面程序。
 */
const resizeShape = createResizeShape(() => win, applyShape, () => screen.getDisplayMatching(win.getBounds()).scaleFactor)

ipcMain.on('piggy:place', (event, request) => {
  if (!fromPet(event) || !isPlaceRequest(request)) { event.returnValue = null; return }
  if (passthroughMode !== 'modern') {
    passthroughMode = 'modern'
    setHit(passthroughHit)
  }
  // place({}) is a synchronous geometry query, not a landing/placement commit.
  // During native dragging even old pages must not compete with dragTick by
  // moving the window or restoring a stale precise drawing shape.
  const reading = request.bounds === undefined && request.shape === undefined && request.pig === undefined
  if (reading || dragSession !== null) {
    event.returnValue = geometryOf(win.getBounds(), geometrySeq)
    return
  }
  const b = request?.bounds
  const motionHandoff = Array.isArray(request.shape) && (dragShapeActive || flightShapeActive)
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
    const next = { x: Math.round(b.x), y: Math.round(b.y), width: Math.max(MIN_WINDOW.width, Math.round(b.width)), height: Math.max(MIN_WINDOW.height, Math.round(b.height)) }
    if (process.platform === 'linux' && !PASSTHROUGH) resizeShape.begin(next, motionHandoff)
    applyBounds(next, 'place')
  } else if (motionHandoff && process.platform === 'linux' && !PASSTHROUGH) {
    // commitSlide transfers translate into layout without changing the window
    // size. Keep the old backing frame whole until the new layout is painted,
    // just as on resize; otherwise its new precise shape clips the old pig.
    resizeShape.begin(win.getBounds(), true)
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
  // 落地/接住后的正常摆放：抛掷滑动归零，形状回到未平移的版本。
  flightSlide = { x: 0, y: 0 }
  lastFlightShapeSlide = null
  flightShapeActive = false
  dragShapeActive = false
  if (Array.isArray(request?.shape)) {
    hasPlacedShape = true
    placedShape = request.shape.slice(0, 64).map(r => ({
      x: Math.max(0, Math.round(Number(r.x) || 0)), y: Math.max(0, Math.round(Number(r.y) || 0)),
      width: Math.max(0, Math.round(Number(r.width) || 0)), height: Math.max(0, Math.round(Number(r.height) || 0)),
    }))
    resizeShape.update(placedShape)
    refreshHit()
    // 新游戏包的第一次摆放就带真实尺寸和形状：窗口此前一直藏着，
    // 现在 setBounds + setShape 都做完了，可以显示了（Linux 防 Xwayland resize 崩溃）。
    if (showGate !== null && showGate.content()) showPigWindow()
  }
  // 游戏包 0.33.1 起顺带报猪在窗口里的框（贴屏幕边时内容在窗口里挪过）：面板按它贴猪。
  const pig = request?.pig
  let panelPigChanged = false
  if (pig && [pig.x, pig.y, pig.width, pig.height].every(Number.isFinite) && pig.width > 0 && pig.height > 0) {
    panelPigChanged = panelPig === null || panelPig.x !== pig.x || panelPig.y !== pig.y || panelPig.width !== pig.width || panelPig.height !== pig.height
    panelPig = { x: pig.x, y: pig.y, width: pig.width, height: pig.height }
  }
  let speechChanged = false
  if (Object.hasOwn(request, 'speech')) {
    const s = request.speech
    const next = s && [s.x, s.y, s.width, s.height].every(Number.isFinite) && s.width > 0 && s.height > 0
      ? { x: s.x, y: s.y, width: s.width, height: s.height } : null
    speechChanged = JSON.stringify(panelSpeech) !== JSON.stringify(next)
    panelSpeech = next
  }
  if (dragSession === null) {
    if (speechChanged) reanchorPanel()
    else if (panelPigChanged) followPig()
  }
  event.returnValue = geometryOf(win.getBounds(), geometrySeq)
})

/**
 * A2 抛掷：页面每帧算好窗口位置和 slide，主进程只挪窗口。
 * 和旧的 piggy:move（鼠标增量）是两条通道，payload 和语义都不同。
 */
ipcMain.on('piggy:flight:move', (event, frame) => {
  if (!fromPet(event)) return
  if (frame === null || typeof frame !== 'object') return
  if (!Number.isFinite(frame.x) || !Number.isFinite(frame.y)) return
  const slide = frame.slide !== null && frame.slide !== undefined && typeof frame.slide === 'object'
    ? { x: Number(frame.slide.x) || 0, y: Number(frame.slide.y) || 0 } : { x: 0, y: 0 }
  if (!Number.isFinite(slide.x) || !Number.isFinite(slide.y)) return
  if (passthroughMode !== 'modern') {
    passthroughMode = 'modern'
    setHit(passthroughHit)
  }
  resizeShape.cancel()
  applyFlightBounds(frame.x, frame.y)
  flightSlide = slide
  if (!flightShapeActive) {
    flightShapeActive = true
    // 整个窗口都算可见/可点：飞行中窗口每帧都在动，逐帧 setShape 会把透明窗口
    // 刷成空白（用户看到的「猪贴图消失」），而且窗口被夹时形状滑动容易裁到猪。
    // 落地/接住后页面会发 place，恢复精确形状。
    if (!PASSTHROUGH) {
      const bounds = win.getBounds()
      applyShape([{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
    }
    refreshHit()
  }
})

/** 页面判断鼠标在不在猪/面板上（只在 Windows 穿透模式下生效）。 */
ipcMain.on('piggy:hit', (event, hit) => {
  if (!fromPet(event) || typeof hit !== 'boolean') return
  if (hasPlacedShape) return
  setLegacyHit(hit)
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
  if (!fromPet(event) || !isMouseShape(rects)) return
  if (lastShape.length === 0 && rects.length > 0) log('first shape', JSON.stringify(rects))
  setLegacyHit()
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
/** Below-pig speech exclusion, separate from the real body/drag geometry. */
let panelSpeech = null
/** 这次面板朝哪边开、最高多高：打开时定一次，拖动松手后重新定。 */
let panelAnchor = null
/** 面板页面最近报的尺寸。 */
let panelSize = null
let panelFixedViewport = false
let panelHitTimer = null
let panelHit = null
let panelShapeKey = ''
let panelHasNativeShape = false
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
  const pig = panelReferenceOnScreen()
  if (pig === null) return null
  return panelAnchorFor(pig, screen.getDisplayNearestPoint({ x: Math.round(pig.x + pig.width / 2), y: Math.round(pig.y + pig.height / 2) }).workArea,
    panelSize?.width ?? PANEL_FALLBACK.width, panelAnchor?.horizontal)
}

/** 面板窗口该在哪：每次都从猪现在在哪直接算（见 lib/panel-geometry.js 文件头）。 */
function panelBounds() {
  const pig = panelReferenceOnScreen()
  if (pig === null || panelAnchor === null) return null
  return panelBoundsFor(pig, panelAnchor, panelViewportSize(panelAnchor, panelSize, panelFixedViewport),
    dragSession !== null ? screen.getAllDisplays().map(display => display.workArea) : null)
}

function panelReferenceOnScreen() {
  const pig = pigOnScreen()
  if (pig === null || panelSpeech === null) return pig
  const speech = pigScreenBox(petAsked, win.getBounds(), panelSpeech,
    dragSession !== null ? { dragging: true, slide: lastDragSlide } : {})
  return panelReferenceFor(pig, speech)
}

function sendPanel(message) {
  if (panelWin !== null && !panelWin.isDestroyed() && panelReady) panelWin.webContents.send('piggy:panel', message)
}

/** 固定外框只让实际卡片和名牌接收点击，透明预留区继续点到桌面。 */
function refreshPanelHit() {
  if (!panelFixedViewport || !panelOpen || !panelAnchor || !panelWin || panelWin.isDestroyed() || !panelWin.isVisible()) return
  const bounds = panelWin.getBounds()
  const hit = pointerHitsShape(screen.getCursorScreenPoint(), bounds, [panelContentRect(bounds, panelAnchor, panelSize)])
  if (hit === panelHit) return
  panelHit = hit
  panelWin.setIgnoreMouseEvents(!hit, { forward: true })
}

const panelShape = createResizeShape(() => panelWin, rects => {
  if (panelWin && !panelWin.isDestroyed() && process.platform !== 'darwin') panelWin.setShape(rects)
}, () => screen.getDisplayMatching(panelWin.getBounds()).scaleFactor)

function stopPanelHit() {
  if (panelHitTimer !== null) clearInterval(panelHitTimer)
  panelHitTimer = null
  panelHit = null
}

function startPanelHit() {
  if (process.platform !== 'darwin' || !panelFixedViewport || !panelOpen || panelHitTimer !== null) return
  refreshPanelHit()
  panelHitTimer = setInterval(refreshPanelHit, 16)
  panelHitTimer.unref?.()
}

/**
 * 把猪窗口抬到面板窗口上面（用户 2026-10-08 反馈）。
 * 两个窗口同为 floating 置顶，点面板时系统把面板抬到最上，猪的动作和气泡被盖住；
 * 所以面板转来反应（piggy:pig-fx）时抬一次。
 * 只改 z 序不改大小；猪窗口除猪本体外都穿透点击，压在上面不挡面板操作。
 */
function raisePetAbovePanel() {
  if (extensionLayer.isFocused()) return
  if (win === null || win.isDestroyed() || !win.isVisible()) return
  // 置顶标记仍为 true 时，菜单也可能被其他应用盖住；先抬菜单，再抬猪。
  if (panelWin !== null && !panelWin.isDestroyed() && panelWin.isVisible()) panelWin.moveTop()
  win.moveTop()
}

function ensurePanelWindow() {
  if (panelWin !== null && !panelWin.isDestroyed()) return panelWin
  panelReady = false
  panelAsked = null
  panelShapeKey = ''
  panelHasNativeShape = false
  panelWin = new BrowserWindow({
    width: PANEL_FALLBACK.width, height: PANEL_FALLBACK.height, x: 0, y: 0,
    transparent: true, frame: false, resizable: false, movable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: true, show: false,
    ...auxiliaryWindowOptions(process.platform),
    backgroundColor: '#00000000',
    webPreferences: { preload: join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false,
      additionalArguments: ['--piggy-role=panel'] },
  })
  extensionLayer.sync()
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
    if (focused !== null && (focused === win || focused === panelWin || focused === extensionWindow.current())) return
    // 原生窗口重新映射时焦点可能暂空，指针仍在真实面板内不能算外部点击。
    if (focused === null && panelAnchor && panelSize && panelWin && !panelWin.isDestroyed() && panelWin.isVisible()) {
      const bounds = panelWin.getBounds()
      if (pointerHitsShape(screen.getCursorScreenPoint(), bounds, [panelContentRect(bounds, panelAnchor, panelSize)])) return
    }
    sendPanel({ type: 'blur', toPet: false })
  }, 0)
}

/** 把面板窗口放到该在的地方；第一次有尺寸时才显示（免得先闪一个空窗口）。 */
function placePanel() {
  if (!panelOpen || panelWin === null || panelWin.isDestroyed()) return
  const next = panelBounds()
  if (next === null) return
  // 切页、拖动后换边及可用高度变化都从同一份内容框计算轮廓。
  if (process.platform !== 'darwin') {
    if (panelFixedViewport) {
      const rect = panelContentRect(next, panelAnchor, panelSize)
      const key = [next.width, next.height, rect.y, rect.width, rect.height].join(',')
      if (key !== panelShapeKey) {
        panelShape.begin(next, true)
        panelShape.update([rect])
        panelShapeKey = key
        panelHasNativeShape = true
      }
    } else if (panelHasNativeShape) {
      panelShape.cancel()
      panelWin.setShape([{x: 0, y: 0, width: next.width, height: next.height}])
      panelShapeKey = ''
      panelHasNativeShape = false
    }
  }
  if (panelAsked === null || panelAsked.x !== next.x || panelAsked.y !== next.y
    || panelAsked.width !== next.width || panelAsked.height !== next.height) {
    panelWin.setBounds(next)
    panelAsked = next
  }
  if (panelSize !== null && !panelWin.isVisible()) {
    // 不抢焦点：GNOME 会把「抢焦点」变成一条「dsh-piggy is ready」的通知，每开一次面板弹一次
    //（2026-10-07 虚拟机录像里看到）。点进面板时它自然会拿到焦点。
    panelWin.showInactive()
    raisePetAbovePanel()
    log('panel shown', JSON.stringify({ bounds: next, anchor: panelAnchor?.vertical }))
    if (win !== null && !win.isDestroyed()) win.webContents.send('piggy:panel', { type: 'open' })
  }
}

function openPanel(pig) {
  if (Number.isFinite(pig?.x) && Number.isFinite(pig?.y) && pig?.width > 0 && pig?.height > 0) {
    panelPig = { x: pig.x, y: pig.y, width: pig.width, height: pig.height }
  }
  if (panelPig === null) return
  ensurePanelWindow()
  panelOpen = true
  startPanelHit()
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
  panelShape.cancel()
  panelShapeKey = ''
  stopPanelHit()
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
  const action = panelToggleAction({ requestedOpen: request?.open === true, isOpen: panelOpen,
    isVisible: panelWin !== null && !panelWin.isDestroyed() && panelWin.isVisible() })
  if (action === 'open') openPanel(request.pig)
  else if (action === 'close') closePanel('pet')
  else {
    // 首次加载期间复按只保持打开意图；回传状态，免得猪页面误以为已经关闭。
    win.webContents.send('piggy:panel', { type: 'open' })
    log('panel loading click kept')
  }
})
/** 面板页面：内容量好了多大。 */
ipcMain.on('piggy:panel:size', (event, size) => {
  if (!fromPage(event) || event.sender !== panelWin?.webContents) return
  const width = Number(size?.width)
  const height = Number(size?.height)
  if (!(width > 0) || !(height > 0)) return
  panelSize = { width: Math.ceil(width), height: Math.ceil(height) }
  // 新 preload 透传第三个参数；旧游戏包/旧 preload 自动沿用可变外框。
  panelFixedViewport = size.fixedViewport === true
  if (panelFixedViewport) startPanelHit()
  else {
    stopPanelHit()
    panelWin.setIgnoreMouseEvents(false)
  }
  placePanel()
  if (process.platform === 'darwin') refreshPanelHit()
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
  if (!fromPage(event) || (event.sender !== panelWin?.webContents && !extensionWindow.owns(event.sender))) return
  if (win === null || win.isDestroyed() || typeof fx?.name !== 'string') return
  win.webContents.send('piggy:pig-fx', { name: fx.name, args: Array.isArray(fx.args) ? fx.args : [] })
  raisePetAbovePanel()
})

/** Where the DSH plugin keeps its pig (the folder moved from dsh-pig to dsh-piggy). */
async function dshSavePath() {
  const home = process.env.DSH_HOME?.trim() ? resolve(process.env.DSH_HOME.trim()) : join(homedir(), '.dsh')
  for (const folder of ['dsh-piggy', 'dsh-pig']) {
    const file = join(home, folder, 'state.json')
    try { await access(file); return file } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return null
}

/** Copy DSH's pig over this one, keeping a copy of this one first. */
async function importFromDsh() {
  const action = reserveAction('import', 'prepare')
  if (action === null) return
  try {
    const source = await dshSavePath()
    if (action.cancelled || quitting) return
    if (source === null) {
      await dialog.showMessageBox({ type: 'info', message: '没找到 DSH 里的猪', detail: '默认找 ~/.dsh/dsh-piggy/state.json（或 DSH_HOME 下面）。' })
      return
    }
    const { response } = await dialog.showMessageBox({
      type: 'question', buttons: ['导入', '算了'], defaultId: 0, cancelId: 1,
      message: '把 DSH 里的猪接过来？',
      detail: `从 ${source} 复制一份过来。桌面版现在这只会先备份，不会丢。`,
    })
    if (action.cancelled || quitting || response !== 0) return
    action.phase = 'commit'
    await requireSavedGame()
    const target = statePath()
    await mkdir(dirname(target), { recursive: true })
    await backupSave('import')
    await copyFile(source, target + '.importing')
    await rename(target + '.importing', target)
    await restartGame()
  } catch (error) {
    if (!action.cancelled) await recoverAction(error)
  } finally { releaseAction(action) }
}

/** 开机自启的持久化：Windows 走 Electron 登录项，Linux 写 autostart 条目（见 lib/autostart.js）。 */
const autostart = createAutostart({ app, log, isQuitting: () => quitting })

/** 托盘图标和菜单；窗口动作仍由主进程现有的入口处理。 */
const tray = createDesktopTray({
  Tray, Menu, nativeImage,
  icon: join(HERE, 'build', 'tray.png'),
  pig: {
    visible: () => win?.isVisible() === true,
    hide: () => { closePanel('tray'); win.hide() },
    show: () => win?.showInactive(),
  },
  autostart,
  recoverPig,
  importFromDsh,
  quit: () => app.quit(),
  log,
  isQuitting: () => quitting,
})

/** 托盘恢复：清掉陈旧拖动/抛掷锚点，先把窗口移到主屏可见处，再让猪页把尺寸和家复位。 */
function recoverPig() {
  if (quitting || win === null || win.isDestroyed()) return
  const payload = recoveryPayload(screen.getPrimaryDisplay())
  if (payload === null) return
  stopDrag()
  resizeShape.cancel()
  dragShapeActive = false
  flightShapeActive = false
  flightSlide = { x: 0, y: 0 }
  lastDragSlide = { x: 0, y: 0 }
  lastFlightShapeSlide = null
  savedPigScreen = null
  restingPigScreen = null
  win.showInactive()
  applyBounds(recoverBounds(win.getBounds(), payload.workArea), 'recover')
  win.webContents.send('piggy:recover', payload)
  log('recover', JSON.stringify(payload))
}

/** Keep a copy of the save before the game code under it changes. */
async function backupSave(label) {
  const file = statePath()
  try { await access(file) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  await copyFile(file, `${file}.before-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
}

async function requireSavedGame() {
  const result = await prepareToQuit()
  if (result.saved !== true) throw new Error('游戏未成功保存，已取消切换；未完成的工作记录保留在磁盘上')
}

/** 关闭后的备份或激活失败不能留下一个已没有游戏宿主的窗口。 */
async function recoverAction(error) {
  log('desktop action failed', String(error))
  try {
    await dialog.showMessageBox({ type: 'error', message: '操作未完成',
      detail: `${error instanceof Error ? error.message : String(error)}${hostClosed ? '\n将重新启动当前游戏。' : ''}` })
  } finally {
    if (hostClosed) await restartGame()
  }
}

/** Load the new game: flush the save first, then start over. */
async function restartGame() {
  quitting = true
  try { await prepareToQuit() } catch (error) { log('host shutdown failed', String(error)); return }
  await closeShellResources()
  if (quitAfterAction) return app.exit(0)
  // Testing runs one launch at a time; the next one is started by hand.
  if (process.env.PIGGY_CAPTURE) return app.exit(0)
  relaunch()
  app.exit(0)
}

// ---- 外部连接（设置 → 外部连接）：只允许面板窗口，扩展大窗口不行 ----
ipcMain.handle('piggy:external:get', event => (fromPanelOnly(event) && externalManager !== null ? externalManager.status() : { ok: false, enabled: false, running: false, error: 'unavailable' }))
ipcMain.handle('piggy:external:set', async (event, enabled) => {
  if (!fromPanelOnly(event) || externalManager === null) return { ok: false, enabled: false, running: false, error: 'unavailable' }
  const status = await externalManager.setEnabled(enabled === true)
  toPages('piggy:external', status)
  return status
})

// ---- 更新 App（页面里的 tabs/update.js）通过这几个口子调用 ----
let releases = []
let releasesRequest = 0
ipcMain.handle('piggy:updates:current', event => (fromPage(event) ? versions?.current() : null))
ipcMain.handle('piggy:updates:list', async (event, fresh) => {
  if (!fromPage(event) || versions === null) return { ok: false, reason: '不在桌面版里' }
  const request = ++releasesRequest
  try {
    const listed = await versions.list({ fresh: fresh === true })
    if (request === releasesRequest) releases = listed
    return { ok: true, releases: listed.map(({ manifest, packUrl, ...rest }) => rest) }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
})
ipcMain.handle('piggy:updates:install', async (event, version) => {
  if (!fromPage(event) || versions === null) return { ok: false, reason: '不在桌面版里' }
  const target = releases.find(r => r.version === version)
  if (target === undefined) return { ok: false, reason: '先刷新一下版本列表' }
  if (target.blocked !== null) return { ok: false, reason: target.blocked === 'shell' ? '要先装新的安装包' : '存档太新，这个版本读不了' }
  const action = reserveAction('game-install', 'prepare')
  if (action === null) return { ok: false, reason: '正在切换版本，请稍候' }
  let prepared = null
  let restarting = false
  try {
    // 下载、校验、解包不影响正在玩的版本；成功保存并备份最终存档后才激活。
    prepared = await versions.prepareInstall(target, fraction => toPages('piggy:progress', fraction))
    if (action.cancelled) throw new Error('已取消版本准备')
    action.phase = 'commit'
    await requireSavedGame()
    await backupSave('v' + target.version)
    await versions.commitInstall(prepared)
    prepared = null
    restarting = true
    setTimeout(restartGame, 600)
    return { ok: true, version: target.version }
  } catch (error) {
    if (prepared !== null) {
      try { await versions.discardPrepared(prepared) }
      catch (cleanupError) { if (!action.cancelled) log('prepared game cleanup failed', String(cleanupError)) }
    }
    if (!action.cancelled && hostClosed) await recoverAction(error)
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  } finally { if (!restarting) releaseAction(action) }
})
ipcMain.handle('piggy:updates:rollback', async event => {
  if (!fromPage(event) || versions === null) return { ok: false, reason: '不在桌面版里' }
  const action = reserveAction('game-rollback', 'prepare')
  if (action === null) return { ok: false, reason: '正在切换版本，请稍候' }
  let restarting = false
  try {
    const current = await versions.current()
    if (action.cancelled) throw new Error('已取消版本准备')
    if (current.previous === null) return { ok: false, reason: '没有上一个版本' }
    action.phase = 'commit'
    await requireSavedGame()
    await backupSave('rollback')
    const result = await versions.rollback()
    if (!result.ok) throw new Error(result.reason)
    restarting = true
    setTimeout(restartGame, 600)
    return result
  } catch (error) {
    if (!action.cancelled && hostClosed) await recoverAction(error)
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  } finally { if (!restarting) releaseAction(action) }
})
ipcMain.handle('piggy:shell:status', event => (fromPage(event) ? shellUpdates?.status() : null))
ipcMain.handle('piggy:shell:download', async (event, version) => {
  if (!fromPage(event) || shellUpdates === null) return { ok: false, reason: '桌面外壳更新不可用' }
  if (activeAction !== null) return { ok: false, reason: '正在切换版本，请稍候' }
  // 预览版里的外壳也能下：只有在用预览版游戏的人，页面才会把它列出来。
  const target = releases.find(release => release.latestShell === version && release.shellUpdate)
  if (target === undefined) return { ok: false, reason: '版本列表过期了，点上面的「刷新」再试一次' }
  return shellUpdates.download(version, target.prerelease === true, target.tag)
})
ipcMain.handle('piggy:shell:install', event => {
  if (!fromPage(event) || shellUpdates === null || shellUpdates.status().readyVersion === null) return { ok: false, reason: '还没有下载好桌面外壳' }
  if (process.env.PIGGY_CAPTURE) return { ok: false, reason: '截图测试不会安装更新' }
  const action = reserveAction('shell-install')
  if (action === null) return { ok: false, reason: '正在切换版本，请稍候' }
  const readyVersion = shellUpdates.status().readyVersion
  // 安装器会替换整个外壳：关掉后台写者、等存档落盘之后再启动安装器。
  setTimeout(async () => {
    try {
      await requireSavedGame()
      await backupSave('shell-v' + readyVersion)
      await closeShellResources({ keepShellUpdates: true })
      const result = shellUpdates.install()
      if (!result.ok) throw new Error(result.reason)
    } catch (error) {
      try { await recoverAction(error) } finally { releaseAction(action) }
    }
  }, 600)
  return { ok: true }
})
ipcMain.handle('piggy:quit', (event) => { if (fromPage(event)) app.quit() })
// 设置 → 日志 → 导出：弹系统「另存为」，把日志写到用户选的位置。
const exportWrites = new Set()
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
    if (quitting || picked.canceled === true || typeof picked.filePath !== 'string' || picked.filePath === '') return { ok: false, canceled: true }
    const writing = writeFile(picked.filePath, text, 'utf8')
    exportWrites.add(writing)
    try { await writing } finally { exportWrites.delete(writing) }
    log('log exported', picked.filePath, String(text.length))
    return { ok: true, path: picked.filePath }
  } catch (error) {
    log('log export failed', String(error))
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
})
// 设置 → 存档 → 导出：只接受安全 ZIP 文件名和有限大小的字节，不接受调用方路径。
ipcMain.handle('piggy:save-archive', async (event, payload) => {
  if (!fromPage(event)) return { ok: false, reason: '来源不对' }
  return saveArchive({
    dialog,
    parentWindow: win ?? undefined,
    downloadsDir: app.getPath('downloads'),
    name: payload?.name,
    bytes: payload?.bytes,
    isClosing: () => quitting,
    async writeFile(path, bytes) {
      const writing = writeFile(path, bytes)
      exportWrites.add(writing)
      try { await writing } finally { exportWrites.delete(writing) }
    },
  })
})
ipcMain.handle('piggy:open', (event, url) => {
  // Only this repo's own pages: the release notes and installers.
  if (fromPage(event) && typeof url === 'string' && url.startsWith(RELEASES_PAGE.replace(/\/releases$/, '/'))) shell.openExternal(url)
})

// ---- 全屏时隐藏 / 照常显示，以及置顶守护（外壳 0.6.5，见 lib/fullscreen.js） ----
/** @type {ReturnType<typeof createFullscreenWatch> | null} */
let fullscreenWatch = null
/** 是不是因为全屏才把猪藏起来的（托盘「藏起来」不算，全屏结束时不去动它）。 */
let hiddenForFullscreen = false
/** 上一次探测：猪所在的屏是不是有程序全屏。 */
let pigScreenFullscreen = false
let topGuardTimer = null
/** 重设置顶时会先关再开，自己会触发 always-on-top-changed(false)；这段时间里的事件不当作「被系统清掉」。 */
let reassertingUntil = 0

/**
 * 重新置顶。Windows 上别的程序全屏、退出时，系统有时把猪窗口的置顶清掉，之后猪就一直压在别的窗口下面；
 * 光调一次 setAlwaysOnTop(true) 在 Electron 里可能因为「状态没变」被跳过，所以先关再开。
 */
function reassertTop(why) {
  if (quitting) return
  if (extensionLayer.isFocused()) { extensionLayer.sync(); return }
  reassertingUntil = Date.now() + 1000
  for (const target of [panelWin, win]) {
    if (target === null || target.isDestroyed() || !target.isVisible()) continue
    target.setAlwaysOnTop(false)
    target.setAlwaysOnTop(true, 'floating')
  }
  if (win !== null && !win.isDestroyed() && win.isVisible()) win.moveTop()
  log('top reasserted', why)
}

/** macOS：「照常显示」时让猪跟进全屏程序的桌面空间；「隐藏」就留在原来的空间（系统默认）。 */
function applyMacSpaces() {
  if (process.platform !== 'darwin' || fullscreenWatch === null) return
  const show = fullscreenWatch.mode() === 'show'
  for (const target of [win, panelWin]) {
    if (target === null || target.isDestroyed()) continue
    target.setVisibleOnAllWorkspaces(show, { visibleOnFullScreen: show })
  }
}

/** @param {{fullscreen:boolean, samePigScreen:boolean} | null} probe */
function onFullscreenProbe(probe) {
  if (quitting || win === null || win.isDestroyed() || fullscreenWatch === null) return
  const covering = probe !== null && probe.fullscreen === true && probe.samePigScreen === true
  const ended = pigScreenFullscreen && !covering
  pigScreenFullscreen = covering
  if (shouldHide(fullscreenWatch.mode(), probe)) {
    if (!hiddenForFullscreen && win.isVisible() && dragSession === null) {
      hiddenForFullscreen = true
      closePanel('fullscreen')
      win.hide()
      log('fullscreen: pig hidden')
    }
    return
  }
  if (hiddenForFullscreen) {
    hiddenForFullscreen = false
    win.showInactive()
    log('fullscreen: pig back')
    reassertTop('fullscreen-ended')
    return
  }
  if (ended) reassertTop('fullscreen-ended')
  // 「照常显示」：全屏程序自己也是置顶窗口，每秒把猪抬回它上面一次。
  else if (covering && win.isVisible()) raisePetAbovePanel()
}

async function startFullscreenWatch() {
  fullscreenWatch = createFullscreenWatch({
    path: join(app.getPath('userData'), 'fullscreen.json'), platform: process.platform, selfPid: process.pid, log,
    pigHwnd: () => {
      try {
        const handle = win.getNativeWindowHandle()
        return String(handle.length >= 8 ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0))
      } catch { return '0' }
    },
    pigDisplayBounds: () => {
      if (win === null || win.isDestroyed()) return null
      const display = screen.getDisplayMatching(win.getBounds())
      const scale = display.scaleFactor || 1
      return { x: display.bounds.x * scale, y: display.bounds.y * scale, width: display.bounds.width * scale, height: display.bounds.height * scale }
    },
    onProbe: onFullscreenProbe,
  })
  await fullscreenWatch.init()
  if (quitting) return
  fullscreenWatch.start()
  applyMacSpaces()
  // 置顶守护：系统把置顶清掉时马上抢回来；有的情况下没有事件，再每 3 秒核对一次。
  win.on('always-on-top-changed', (event, on) => {
    if (!on && !quitting && Date.now() > reassertingUntil) setTimeout(() => reassertTop('lost'), 200)
  })
  topGuardTimer = setInterval(() => {
    if (win === null || win.isDestroyed() || !win.isVisible()) return
    if (!win.isAlwaysOnTop() || (panelWin !== null && !panelWin.isDestroyed() && panelWin.isVisible() && !panelWin.isAlwaysOnTop())) reassertTop('check')
  }, 3000)
  topGuardTimer.unref?.()
}

ipcMain.handle('piggy:fullscreen:get', async event => {
  if (!fromPage(event) || fullscreenWatch === null) return null
  await fullscreenWatch.init()
  return fullscreenWatch.get()
})
ipcMain.handle('piggy:fullscreen:set', async (event, mode) => {
  if (!fromPage(event) || fullscreenWatch === null) return { ok: false, reason: '这个外壳不支持' }
  const result = await fullscreenWatch.set(mode)
  applyMacSpaces()
  return result
})

let proxySettings = null
for (const action of ['get', 'set', 'clear', 'test']) {
  ipcMain.handle('piggy:proxy:' + action, async (event, value) => {
    if (!fromPage(event) || proxySettings === null) return { ok: false, reason: '代理设置不可用' }
    return proxySettings[action](value)
  })
}

app.whenReady().then(async () => {
  if (needsX11 || !gotLock || quitting) return
  migrateDesktopData(dataPaths)
  proxySettings = createProxy({ path: join(app.getPath('userData'), 'proxy.json'),
    sessions: [session.defaultSession, session.fromPartition('electron-updater', { cache: false })] })
  await proxySettings.init()
  if (quitting) return
  log('start', app.getVersion(), process.platform, process.env.XDG_SESSION_TYPE ?? '')
  shellUpdates = createShellUpdates({
    mode: shellUpdateMode({ platform: process.platform, packaged: app.isPackaged,
      portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE), appImage: process.env.APPIMAGE }),
    currentVersion: app.getVersion(), updater: autoUpdater,
    onProgress: fraction => toPages('piggy:shell-progress', fraction),
  })
  versionsStarting = startBackgroundVersions({
    userData: app.getPath('userData'), bundledDir: bundledGameDir(), shellVersion: app.getVersion(),
    statePath: statePath(), releasesUrl: process.env.PIGGY_RELEASES_URL || undefined, log,
    // Chromium's network stack: follows the system proxy, which plain fetch does not.
    fetch: /** @type {any} */ (net.fetch.bind(net)),
  })
  versions = await versionsStarting
  if (quitting) { await versions.close(); return }
  // Gitee 的 Windows 安装包不带游戏：第一次先下载（first-run.js）。
  let firstRun = null
  if (await versions.needsGame()) {
    firstRun = await downloadFirstGame({ versions, pinPath: gamePinPath(app, HERE), here: HERE, releasesPage: RELEASES_PAGE, log })
    if (firstRun === null) { app.quit(); return }
  }
  const gameDir = await versions.activeDir()
  if (quitting) return
  const workEventsDirectory = join(app.getPath('userData'), 'work-endpoint')
  hostStarting = startBackgroundHost(gameDir, statePath(), { fetch: net.fetch.bind(net), workEventsDirectory,
    optionalExtensionsDirectory: join(app.isPackaged ? process.resourcesPath : HERE, 'optional-extensions'),
    workEventsAutoStart: process.argv.includes('--work-events'),
    onConfirm: plan => confirmMerge(plan),
    onSnapshot: view => toPages('piggy:state-changed', view), onStateChanged: announceStateChanged })
  host = await hostStarting
  if (quitting) return
  hostJournal = /** @type {any} */ (host)?.store?.journal ?? null
  hostJournal?.record?.('info', 'shell', `桌面外壳 ${app.getVersion()} · 游戏包 ${gameDir}`)
  registerProtocol(gameDir)
  await createWindow()
  if (quitting) return
  // 隐藏预加载，不调用 show/focus；首次右键不再等待创建窗口和加载客户端。
  ensurePanelWindow()
  externalManager = createExternalManager({
    userData: app.getPath('userData'), host, appVersion: app.getVersion(), log,
    onConfirm: plan => confirmMerge(plan),
  })
  try { await externalManager.init() } catch (error) { log('external manager init failed', String(error)) }
  if (quitting) return
  log('panel preloaded', JSON.stringify({ visible: panelWin.isVisible(), focused: panelWin.isFocused() }))
  await startFullscreenWatch()
  if (quitting) return
  firstRun?.destroy()
  await tray.create(gameDir)
  if (quitting) return
  // 用户机器上到底是什么显示器、什么缩放：以前日志里没有，Windows 的问题只能靠猜。
  log('displays', JSON.stringify(screen.getAllDisplays().map(display => ({ id: display.id, label: display.label,
    bounds: display.bounds, workArea: display.workArea, scale: display.scaleFactor, internal: display.internal }))))
  // The window follows its screen's work area when it changes (taskbar moved, resolution changed).
  // 显式告诉游戏包「显示器变了」：applyBounds 有 2px 死区，窗口不需要挪的时候它不会推几何，
  // 页面手里的 workAreas 就会一直用旧的那份（分辨率变了但窗口刚好没动 → 用的是旧工作区）。
  const displayRebuild = createLinuxDisplayRebuild({
    platform: process.platform, displays: () => screen.getAllDisplays(), rebuild: rebuildLinuxViews,
    onError: error => log('display view rebuild failed', String(error)),
  })
  const reclamp = (why, detail) => {
    if (quitting || win === null || win.isDestroyed()) return
    if (displayRebuild.changed() || displayRebuild.busy()) return
    const bounds = win.getBounds()
    applyBounds(desktopViewportBounds(bounds, screen.getAllDisplays().map(display => display.workArea)), 'display')
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
}).catch(async error => {
  let logPath = 'piggy.log'
  try { logPath = join(app.getPath('userData'), 'piggy.log') } catch { /* 连 userData 都读不到时至少弹框 */ }
  await reportStartupFailure({ dialog, log, error, logPath, version: app.getVersion(), platform: process.platform })
  app.quit()
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

app.on('second-instance', () => {
  // 第二次双击没反应时，日志要能说明「第二次确实进来了」，以及第一扇窗当时的状态。
  // pid 和第二个进程的「second launch rejected」行对得上；host 说明第一次启动走到哪了。
  log('second instance', JSON.stringify({ pid: process.pid, host: host !== null, window: win !== null, visible: win?.isVisible?.() === true, showPending: showGate?.pending === true }))
  win?.showInactive()
})
let hostClosed = false
let hostClosing = null
let shellClosed = false
let shellClosing = null
let quitTask = null

/** 版本激活仍要用 worker；安装外壳时保留更新器，完成安装交接。 */
function closeShellResources({ keepShellUpdates = false } = {}) {
  if (shellClosing) return shellClosing
  const fullscreenStopping = fullscreenWatch?.stop()
  for (const timer of [topGuardTimer, displayWatchTimer, hitTimer]) if (timer !== null) clearInterval(timer)
  if (stateTimer !== null) clearTimeout(stateTimer)
  shellClosing = (async () => {
    await Promise.all([fullscreenStopping, keepShellUpdates ? undefined : shellUpdates?.close(), flushWindowState(), proxySettings?.flush(), fullscreenWatch?.flush(), autostart.flush(),
      Promise.allSettled([...exportWrites])])
    try { await versions?.close() } catch (error) { log('versions shutdown failed', String(error)) }
    await flushLogs()
    shellClosed = true
  })().catch(error => { shellClosing = null; throw error })
  return shellClosing
}

/** 退出与安装共用一次后台关闭；保存失败时允许重试，不提前停命中轮询。 */
function prepareToQuit() {
  if (hostClosing) return hostClosing
  quitting = true
  stopDrag()
  hostClosing = (async () => {
    // VM 生命周期测试只加载这段代码，没有外部开关变量；真实主进程里它始终存在。
    if (typeof externalManager !== 'undefined') {
      try { await externalManager?.close() } catch (error) { log('external shutdown failed', String(error)) }
      externalManager = null
    }
    return host ? host.dispose() : { saved: true }
  })().then(result => {
    hostClosed = true
    if (!result.saved) log('host worker exited; WAL retained; shutdown without save')
    if (hitTimer !== null) clearInterval(hitTimer)
    hitTimer = null
    return result
  }).catch(error => { hostClosing = null; quitting = false; throw error })
  return hostClosing
}
app.on('before-quit', event => {
  if (shellClosed) return
  event.preventDefault()
  if (activeAction !== null) {
    quitAfterAction = true
    if (activeAction.phase === 'prepare') {
      const action = activeAction
      action.cancelled = true
      quitting = true
      if (action.kind === 'import') releaseAction(action)
      else void versions.cancelPreparation().catch(error => log('versions cancellation failed', String(error)))
    }
    return
  }
  if (quitTask === null) {
    quitTask = (async () => {
      quitting = true
      // 只等正在创建的资源，不等首次下载窗口的用户选择；最终 quit 会正常关闭那个窗口。
      await Promise.allSettled([proxySettings?.init(), versionsStarting, hostStarting])
      if (!host) {
        try { await versions?.close() } catch (error) { log('versions shutdown failed', String(error)) }
      }
      await prepareToQuit()
      await closeShellResources()
      app.quit()
    })().catch(error => { quitTask = null; log('host shutdown failed', String(error)) })
  }
})
app.on('window-all-closed', () => app.quit())
