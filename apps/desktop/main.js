// @ts-check
/**
 * dsh-piggy 桌面版的主进程（外壳）。整体结构和全部 IPC 消息见 docs/guides/desktop-architecture.md。
 *
 * - 两个透明置顶窗口（外壳 0.6.0 起）：猪窗口（固定大小，只装猪和气泡）和面板窗口
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
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { BrowserWindow, Menu, Tray, app, dialog, ipcMain, nativeImage, net, protocol, screen, session, shell } from 'electron'
import updaterPackage from 'electron-updater'

import { startBackgroundHost } from './lib/background-host.js'
import { createDesktopRuntime } from './lib/desktop-runtime.js'
import { registerGameProtocol } from './lib/game-protocol.js'
import { configureDesktopData, bundledDesktopGame } from './lib/data-paths.js'
import { migrateDesktopData } from './lib/data-migration.js'
import { readOwnerDocumentConfig } from './lib/owner-document-config.js'
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
import { createPanelWindow } from './lib/panel-window.js'
import { createPetWindow } from './lib/pet-window.js'
import { MAX_PIG_WINDOWS, createPetRegistry, createPetState } from './lib/pet-instance.js'
import { createExternalManager } from './lib/external.js'
import { SHOW_FALLBACK_MS, createShowGate } from './lib/window-show.js'
import { downloadFirstGame, gamePinPath } from './first-run.js'
import { reportStartupFailure, pageCrashReason } from './lib/startup-failure.js'
import { appendJournalSync, journalLine } from './lib/startup-journal.js'
import { createWindowState } from './lib/window-state.js'
import { createAutostart } from './lib/autostart.js'
import { createDesktopLifecycle } from './lib/desktop-lifecycle.js'
import { createDesktopTray } from './lib/tray.js'
import { createOwnerArchiveSelectionStore } from './lib/owner-archive-selection.js'
import { createOwnerArchiveManager } from './lib/owner-archive-manager.js'
import { createOwnerPigManager } from './lib/owner-pig-manager.js'
import { createOwnerCloudManager } from './lib/owner-cloud-manager.js'
import { createOwnerNetworkManager } from './lib/owner-network-manager.js'
import { registerExternalIpc, registerSystemActionsIpc, registerFullscreenIpc, registerProxyIpc } from './lib/ipc/system.js'
import { registerCloudSaveIpc } from './lib/ipc/cloud-save.js'
import { registerOwnerArchiveIpc } from './lib/ipc/owner-archive.js'
import { registerOwnerPigsIpc } from './lib/ipc/owner-pigs.js'
import { registerOwnerNetworkIpc } from './lib/ipc/owner-network.js'
import { createCloudSaveConfigStore } from './lib/cloud-save-config.js'
import { createOwnerCloudReadyStore } from './lib/owner-cloud-ready.js'
import { registerUpdatesIpc } from './lib/ipc/updates.js'
import { createStartupTrace } from './lib/startup-trace.js'

const { autoUpdater } = updaterPackage

const HERE = dirname(fileURLToPath(import.meta.url))
const taskOwnerDocumentConfig = readOwnerDocumentConfig()
let ownerDocumentConfig = taskOwnerDocumentConfig === null ? null : { ...taskOwnerDocumentConfig, source: 'task' }
let ownerArchiveSwitchPending = false
let ownerArchiveRuntimeSupported = false
let ownerPigRuntimeSupported = false
let ownerCloudRuntimeSupported = false
let ownerLanRuntimeSupported = false
let activeGameDirectory = null

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

const startupInputTrace = createStartupTrace((...parts) => { void log(...parts) })

function safeVersion(value) {
  return typeof value === 'string' && /^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$/.test(value) ? value : 'unknown'
}

function startupApiErrorKind(error) {
  if (error instanceof TypeError) return 'TypeError'
  if (error instanceof RangeError) return 'RangeError'
  return error instanceof Error ? 'Error' : 'UnknownError'
}

/** @param {'pet'|'panel'} role @param {string} mode @param {string} source @param {boolean} ignore @param {boolean|'omitted'} forward @param {() => void} invoke */
function traceSetIgnoreMouseEvents(role, mode, source, ignore, forward, invoke) {
  const detail = { role, mode, source, ignore, forward }
  const key = `mouse-api:${role}:${mode}:${source}:${ignore}:${forward}`
  try {
    invoke()
  } catch (error) {
    startupInputTrace.record(key + ':threw', 'startup mouse API', JSON.stringify({ ...detail, callResult: 'threw', errorClass: startupApiErrorKind(error) }))
    throw error
  }
  startupInputTrace.record(key + ':returned', 'startup mouse API', JSON.stringify({ ...detail, callResult: 'returned' }))
}

async function flushLogs() {
  let writing
  do { writing = logWriting; await writing } while (writing !== logWriting)
}

/** 游戏宿主的日志本；宿主起来之前是 null。 */
let hostJournal = null
/** 显示器兜底对账的定时器（见 app.whenReady 里的 displayWatchTimer）。 */
let displayWatchTimer = null

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
const cloudSaveSettings = createCloudSaveConfigStore(dataPaths.userData)
const ownerCloudReadyStore = createOwnerCloudReadyStore(dataPaths.userData)
const ownerNetworkDirectory = join(dataPaths.userData, 'owner-network')
const ownerArchiveSelectionStore = createOwnerArchiveSelectionStore(dataPaths.userData)
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

/** Only this explicit marker permits the current game package to receive an OwnerDocument path. */
async function hasOwnerArchiveRuntime(gameDir) {
  try {
    const runtime = await import(pathToFileURL(join(gameDir, 'runtime/index.js')).href)
    return runtime.OWNER_ARCHIVE_RUNTIME_API_VERSION === 1
  } catch { return false }
}

/** Only this explicit capability enables panel-local pig target management. */
async function hasOwnerPigRuntime(gameDir) {
  try {
    const runtime = await import(pathToFileURL(join(gameDir, 'runtime/index.js')).href)
    return runtime.OWNER_PIG_RUNTIME_API_VERSION === 1
  } catch { return false }
}

/** Owner cloud transport uses complete owner archives and an explicit first-sync direction. */
async function hasOwnerCloudRuntime(gameDir) {
  try {
    const runtime = await import(pathToFileURL(join(gameDir, 'runtime/index.js')).href)
    return runtime.OWNER_CLOUD_RUNTIME_API_VERSION === 1
  } catch { return false }
}

/** owner 私有 LAN 会话必须由面板显式启用。 */
async function hasOwnerLanRuntime(gameDir) {
  try {
    const runtime = await import(pathToFileURL(join(gameDir, 'runtime/index.js')).href)
    return runtime.OWNER_LAN_RUNTIME_API_VERSION === 1
  } catch { return false }
}

/** Strip local selection metadata before crossing into the game runtime. */
function runtimeOwnerConfig(config) {
  if (config === null) return null
  return {
    ownerDocumentPath: config.ownerDocumentPath,
    ...(typeof config.legacyStatePath === 'string' ? { legacyStatePath: config.legacyStatePath } : {}),
    ...(typeof config.ownerId === 'string' ? { ownerId: config.ownerId } : {}),
    pigId: config.pigId,
  }
}

function applyStoredOwnerSelection(selection) {
  ownerDocumentConfig = selection === null ? null : { ...selection, source: 'selection' }
}

/** Roll a pending owner switch back only after the attempted runtime has stopped writing. */
async function notifyOwnerArchiveSwitchFailed() {
  await dialog.showMessageBox({
    type: 'info',
    title: '没有切换存档',
    message: '新存档副本没有启用。之前的存档选择已恢复，新副本仍保留在本机。',
    detail: '应用将重新启动；你可以稍后重试。',
  })
}

async function restorePreviousOwnerSelectionAndRestart(cause) {
  if (!ownerArchiveSwitchPending) return false
  ownerArchiveSelectionStore.rollbackPending()
  ownerArchiveSwitchPending = false
  log('owner archive startup rolled back', cause instanceof Error ? cause.name : 'startup failed')
  await desktopLifecycle.requireSavedGame()
  await desktopLifecycle.closeShellResources()
  await notifyOwnerArchiveSwitchFailed()
  relaunch()
  app.exit(0)
  return true
}

/** Startup handles and their pending promises have one owner; composition order stays here. */
const desktopRuntime = createDesktopRuntime({
  startHostWorker: startBackgroundHost,
  startVersionsWorker: startBackgroundVersions,
})
let startupUpdateToken = null
let startupSetupComplete = false
let startupRendererLoaded = false
let startupWindowWasVisible = false
let startupFailureHandling = false
/** 外部连接开关（设置 → 外部连接）。 */
let externalManager = null
/** @type {ReturnType<typeof createShellUpdates> | null} */
let shellUpdates = null
/** 多猪：每只猪一份状态；主猪就是面板、托盘、全屏和恢复跟着走的那只。 */
const pets = createPetRegistry({ max: MAX_PIG_WINDOWS })
const primaryPetState = createPetState({ primary: true })
pets.add(primaryPetState)
/** 游戏协议按 ?pig=<pigId> 找到 worker session token；单猪/旧包时为空。 */
const pigSessions = new Map()
/** 这一版是否真的开了多猪窗口（能力 + roster > 1 + 至少两只会话成功）。 */
let multiPigActive = false
/** 主猪窗口：旧代码里 getPetWindow() 的唯一窗口概念，现在只指主猪。 */
function getPetWindow() {
  const pet = pets.primary()
  return pet === null ? null : pet.window
}
/** 主猪状态；主猪窗口关掉后返回 null，面板/托盘据此降级。 */
function primaryPet() {
  return pets.primary()
}
/**
 * 面板窗口（外壳 0.6.0 起）：面板不再和猪挤在同一个窗口里。
 * 以前开面板、冒气泡、拖动都要改猪那个窗口的大小，再靠计算把猪补回原位，差一拍猪就跳
 * （2026-10-06～07 修了四轮）。网上的桌宠（Clawd、Shimeji、eSheep）都是猪一个固定大小的
 * 小窗口、菜单另开窗口：开面板时猪的窗口一动不动，拖动只挪窗口。见 docs/archive/tasks/I-round.md。
 * 只有新游戏包会叫它（piggyShell.panel.toggle）；老游戏包照旧单窗口。
 */
const panelWindow = createPanelWindow({
  BrowserWindow,
  options: {
    width: PANEL_FALLBACK.width, height: PANEL_FALLBACK.height, x: 0, y: 0,
    transparent: true, frame: false, resizable: false, movable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: true, show: false,
    ...auxiliaryWindowOptions(process.platform),
    backgroundColor: '#00000000',
    webPreferences: { preload: join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false,
      additionalArguments: ['--piggy-role=panel'] },
  },
  url: 'piggy://app/index.html',
  frameCap: FRAME_CAP,
  devTools: process.env.PIGGY_DEVTOOLS === '1',
  log,
  onCreated: () => {
    panelAsked = null
    panelShapeKey = ''
    panelHasNativeShape = false
    extensionLayer.sync()
  },
  onReady: () => {
    if (panelOpen && panelAnchor !== null) sendPanel({ type: 'open', vertical: panelAnchor.vertical, maxHeight: panelAnchor.maxHeight })
  },
  onRendererGone: () => closePanel('crash'),
  onBlur: panelFocusLeft,
})
const getPanelWindow = panelWindow.current
/** 扩展的大窗口（role=ext）和它显示的扩展；一次只开一个。 */
const extensionWindow = createExtensionWindow({
  BrowserWindow, screen, ipcMain,
  icon: join(HERE, 'build', 'icon.png'),
  preload: join(HERE, 'preload.cjs'),
  url: 'piggy://app/index.html',
  getLayer: () => extensionLayer,
  getPanel: getPanelWindow,
  isPanelOpen: () => panelOpen,
  fromPage: event => fromPage(event),
  fromExt: event => fromExt(event),
  log,
})
const extensionLayer = createExtensionLayer({ extension: () => extensionWindow.current(), overlays: () => [getPanelWindow(), ...pets.all().map(pet => pet.window)] })
/** 主进程关闭/退出状态统一由 lifecycle 持有；资源句柄在实际关闭时动态读取。 */
const desktopLifecycle = createDesktopLifecycle({
  app, dialog, log, stopDrag: () => stopDrag(), relaunch,
  isCapture: () => Boolean(process.env.PIGGY_CAPTURE),
  clearInterval, clearTimeout,
  getResources: () => ({ ...desktopRuntime.getShutdownResources(), shellUpdates, proxySettings, fullscreenWatch,
    externalManager, autostart, exportWrites, topGuardTimer, displayWatchTimer, hitTimer: primaryPet()?.hitTimer ?? null,
    hitTimers: pets.all().map(pet => pet.hitTimer), stateTimer, flushWindowState, flushLogs }),
  setExternalManager: manager => { externalManager = manager },
  setHitTimer: timer => { const pet = primaryPet(); if (pet !== null) pet.hitTimer = timer },
})
/**
 * 消息是不是这扇窗口的页面发来的。窗口销毁后直接读 webContents 会抛
 * 「Object has been destroyed」—— Windows 上在更新页切换版本时，旧页面的消息还在路上，
 * 主进程直接弹了错误框（用户 2026-10-05 实测）。registry 只在窗口还活着时持有映射。
 */
function fromPage(event) {
  return fromPet(event) || (!desktopLifecycle.quitting && getPanelWindow() !== null && !getPanelWindow().isDestroyed() && event.sender === getPanelWindow().webContents) || fromExt(event)
}
/** 扩展的大窗口（外壳 0.6.5 起，菜园的大农场）。 */
function fromExt(event) {
  return !desktopLifecycle.quitting && extensionWindow.owns(event.sender)
}
/** 只有猪窗口能挪猪、改形状（面板窗口的页面也装了同一套游戏包，不许它动猪窗口）。 */
function fromPet(event) {
  return petForEvent(event) !== null
}
/**
 * 按发送者找到那只猪的窗口状态。多猪后不能再用「唯一猪窗口」判断；
 * 窗口销毁时 registry 已删掉映射，迟到的消息自然被拒绝。
 */
function petForEvent(event) {
  if (desktopLifecycle.quitting) return null
  const pet = pets.bySender(event?.sender)
  if (pet === null || pet.window === null || pet.window === undefined || pet.window.isDestroyed()) return null
  // 重建窗口后旧 webContents 的迟到消息不能落到新窗口上。
  return event?.sender === pet.window.webContents ? pet : null
}
/** 快照只回给产生它的那只猪；无 token（默认会话/面板动作）回主猪。 */
function petForToken(token) {
  if (token === null || token === undefined) return primaryPet()
  return pets.byToken(token)
}
/**
 * 定向快照：worker 已经在 snapshot 里带上产生 pending 的 session token。
 * 找不到对应窗口就丢弃，绝不能广播给别的猪。
 */
function deliverSnapshot(value, token) {
  const pet = petForToken(token)
  if (pet === null || pet.window === null || pet.window.isDestroyed()) return false
  pet.window.webContents.send('piggy:state-changed', value)
  return true
}
/** 发给所有窗口的页面（下载进度、存档变了这类两边都要知道的事）。 */
function toPages(channel, ...args) {
  for (const pet of pets.all()) {
    const target = pet.window
    if (target !== null && target !== undefined && !target.isDestroyed()) target.webContents.send(channel, ...args)
  }
  for (const target of [getPanelWindow(), extensionWindow.current()]) {
    if (target !== null && !target.isDestroyed()) target.webContents.send(channel, ...args)
  }
}

/** 合并确认：内容由桌面端自己算；窗口隐藏时先显示窗口。 */
async function confirmMerge(plan) {
  try {
    if (getPetWindow() === null || getPetWindow().isDestroyed()) return false
    if (!getPetWindow().isVisible()) getPetWindow().show()
    getPetWindow().focus()
    const result = typeof plan?.target === 'object'
      ? `合并前会分别备份两只猪。合并后内嵌猪会退役，不再长大。`
      : '合并前会分别备份两只猪。'
    const answer = await dialog.showMessageBox(getPetWindow(), {
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
  return !desktopLifecycle.quitting && getPanelWindow() !== null && !getPanelWindow().isDestroyed() && event.sender === getPanelWindow().webContents
}

function registerProtocol(gameDir) {
  registerGameProtocol({
    protocol,
    fetchFile: net.fetch.bind(net),
    rendererDir: join(HERE, 'renderer'),
    gameDir,
    getHost: () => desktopRuntime.getHost(),
    isQuitting: () => desktopLifecycle.quitting,
    onStateChanged: announceStateChanged,
    sessions: pigSessions,
  })
}

/** The screen the mouse is on when the pig starts: where you just double-clicked. */
function pigDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

/** 上次把猪停在哪儿（窗口位置），下次开机照旧。 */
const windowState = createWindowState({
  getWindow: () => getPetWindow(),
  getPigOffset: () => primaryPet()?.lastPigWindow,
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
function pushGeometry(pet) {
  const window = pet?.window
  if (window === null || window === undefined || window.isDestroyed()) return
  const bounds = window.getBounds()
  window.webContents.send('piggy:geometry', geometryOf(bounds, ++geometrySeq, pet))
}

/** 窗口、它所在屏的工作区、所有屏的工作区：游戏包里的桌面逻辑按这些自己算窗口摆哪。 */
function geometryOf(bounds, seq, pet = null) {
  const displays = screen.getAllDisplays()
  return {
    window: bounds,
    workArea: workAreaFor(bounds),
    workAreas: displays.map(display => display.workArea),
    // 显示器清单（含每块屏的缩放）：Windows 125%/150% 下的问题一直只能靠 2px 容差硬扛，
    // 把这些发给游戏包，日志里才能看出「是哪块屏、什么缩放」。
    displays: displays.map(display => ({ id: display.id, label: display.label,
      bounds: display.bounds, workArea: display.workArea, scaleFactor: display.scaleFactor, internal: display.internal })),
    dragSlide: pet?.lastDragSlide ?? { x: 0, y: 0 },
    seq,
  }
}

/**
 * 挪/改窗口。返回这次实际改了多少（没改返回 null），写进日志方便排查。
 * 除了拖动，差 2px 以内一律不动：Windows 125%/150% 缩放下 setBounds 设的尺寸和 getBounds
 * 读回来的常差 1px，精确比较会让每次内容上报都重新 setBounds，透明窗口就闪一下。
 */
function applyBounds(pet, next, why) {
  const window = pet?.window
  if (window === null || window === undefined || window.isDestroyed()) return null
  const before = window.getBounds()
  const delta = { x: next.x - before.x, y: next.y - before.y, width: next.width - before.width, height: next.height - before.height }
  // 分数缩放回读可能比请求大 1px；目标没变时不要每个拖动 tick 重设同一窗口。
  // 新目标仍用零容差，保证 1px 鼠标位移可达；真实外部偏移超出容差时继续纠正。
  const sameRequest = pet.petAsked !== null && ['x', 'y', 'width', 'height'].every(key => pet.petAsked[key] === next[key])
  const tolerance = (why === 'drag' || why === 'move') && !sameRequest ? 0 : BOUNDS_TOLERANCE
  if (Math.abs(delta.x) <= tolerance && Math.abs(delta.y) <= tolerance
    && Math.abs(delta.width) <= tolerance && Math.abs(delta.height) <= tolerance) return null
  window.setBounds(next)
  pet.petAsked = { ...next }
  followPig(pet)
  // 拖动时每秒要挪几十次：别每次都写日志（Windows 上同步写盘会卡住主进程）。
  if (why !== 'drag' && why !== 'move') log('bounds', why, pet.pigId ?? 'legacy', JSON.stringify(next))
  if (pet.primary) scheduleWindowStateSave()
  pushGeometry(pet)
  return delta
}

/**
 * Windows 上不用 setShape，改用鼠标穿透：现代游戏由主进程轮询命中，旧游戏由页面上报。
 * setShape 在 Windows 上是 SetWindowRgn，开关面板时可点区域整块变化，透明分层窗口会闪一下白
 * （用户 2026-10-05：装了 0.2.5 右键开关菜单仍闪白屏）。穿透模式下窗口区域从不变化。
 * PIGGY_SHAPE=1 可退回旧做法，方便对比排查。
 */
const SKIP_NATIVE_SHAPE = process.platform === 'win32' && process.env.PIGGY_SHAPE !== '1'
/** macOS 没有 setShape；独立输入区域也可叠加在 Linux 的保守绘制裁剪之上。 */
const MOUSE_PASSTHROUGH = SKIP_NATIVE_SHAPE || process.platform === 'darwin'
function setHit(pet, hit, source = 'hit-state') {
  const window = pet?.window
  if ((!MOUSE_PASSTHROUGH && pet.placedHitShape === null) || window === null || window === undefined || window.isDestroyed()) return
  const forward = pet.passthroughMode === 'legacy' && MOUSE_PASSTHROUGH
  if (hit === pet.passthroughHit && forward === pet.passthroughForward) return
  pet.passthroughHit = hit
  pet.passthroughForward = forward
  traceSetIgnoreMouseEvents('pet', pet.passthroughMode, source, !hit, forward,
    () => window.setIgnoreMouseEvents(!hit, { forward }))
}

function setPassthroughMode(pet, next, source) {
  if (next === pet.passthroughMode) return
  const previous = pet.passthroughMode
  pet.passthroughMode = next
  startupInputTrace.record(`mouse-mode:${previous}:${next}:${source}`, 'startup mouse mode', JSON.stringify({ from: previous, to: next, source, pigId: pet.pigId }))
}

function setLegacyHit(pet, hit = pet.passthroughHit, source = 'legacy') {
  if (pet.passthroughMode === 'modern') return
  setPassthroughMode(pet, 'legacy', source)
  setHit(pet, hit, source)
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
    && (request.hitShape === undefined || isMouseShape(request.hitShape))
}

/** 穿透窗口可能收不到第一次 mousemove；主进程读取光标，保证首次点击就能命中猪。 */
function shiftedShape(rects, slide) {
  if (slide.x === 0 && slide.y === 0) return rects
  return rects.map(rect => ({
    x: rect.x + slide.x,
    y: rect.y + slide.y,
    width: rect.width,
    height: rect.height,
  }))
}

function refreshHit(pet) {
  const window = pet?.window
  if (window === null || window === undefined || window.isDestroyed() || pet.dragSession !== null) return
  if (!pet.hasPlacedShape && pet.placedHitShape === null) return
  const bounds = window.getBounds()
  // 只有旧契约把动作整窗绘制区域也当输入；新契约不能让透明预留抢走桌面点击。
  const shape = pet.placedHitShape === null && (pet.flightShapeActive || pet.dragShapeActive)
    ? [{ x: 0, y: 0, width: bounds.width, height: bounds.height }]
    : shiftedShape(pet.placedHitShape ?? pet.placedShape, pet.flightShapeActive ? pet.flightSlide : pet.dragShapeActive ? pet.lastDragSlide : pet.flightSlide)
  setHit(pet, pointerHitsShape(screen.getCursorScreenPoint(), bounds, shape), 'cursor-hit-test')
}

/** 抛掷只挪窗口，不重排、不 followPig、不推几何、不写 window.json（A2）。 */
function applyFlightBounds(pet, x, y) {
  const window = pet?.window
  if (window === null || window === undefined || window.isDestroyed()) return
  const size = pet.petAsked ?? window.getBounds()
  const next = { x: Math.round(x), y: Math.round(y), width: size.width, height: size.height }
  if (pet.petAsked !== null && pet.petAsked.x === next.x && pet.petAsked.y === next.y
    && pet.petAsked.width === next.width && pet.petAsked.height === next.height) return
  window.setBounds(next)
  pet.petAsked = { ...next }
}

/** 原生 shape 仍负责绘制裁剪；不能用更小的输入区域裁掉动作和特效。 */
function applyShape(pet, rects) {
  const window = pet?.window
  if (SKIP_NATIVE_SHAPE || window === null || window === undefined || window.isDestroyed() || process.platform === 'darwin' || typeof window.setShape !== 'function') return
  window.setShape(rects)
  if (pet.placedHitShape !== null) {
    // 原生绘制提交后重新应用独立输入，不能仅凭上次的命中布尔值跳过。
    pet.passthroughForward = null
    if (pet.dragSession !== null) setHit(pet, true, 'shape-commit')
    else refreshHit(pet)
  }
}

/** 显示一只猪窗口（只显示一次；日志保留原来的 shown 行格式）。 */
function showPigWindow(pet) {
  const window = pet?.window
  if (window === null || window === undefined || window.isDestroyed() || window.isVisible()) return
  window.showInactive()
  log('shown', pet.pigId ?? 'legacy', JSON.stringify(window.getBounds()), window.isVisible())
  if (pet.primary) {
    startupWindowWasVisible = window.isVisible()
    confirmUpdateStartupIfReady()
  }
}

function confirmUpdateStartupIfReady() {
  if (startupUpdateToken === null || !startupSetupComplete || !startupRendererLoaded || !startupWindowWasVisible) return
  const token = startupUpdateToken
  startupUpdateToken = null
  const versions = desktopRuntime.getVersions()
  if (versions === null) return
  void versions.confirmStartup(token).then(result => {
    log('game update startup healthy', JSON.stringify({ confirmed: result.ok === true, version: result.version ?? null }))
  }).catch(() => { log('game update startup health confirmation failed') })
}

async function handleStartupFailure(error) {
  if (startupFailureHandling) return
  startupFailureHandling = true
  if (ownerArchiveSwitchPending) {
    try {
      await restorePreviousOwnerSelectionAndRestart(error)
      return
    } catch (rollbackError) {
      log('owner archive startup rollback failed', rollbackError instanceof Error ? rollbackError.message : 'rollback failed')
    }
  }
  let recoveredVersion = null
  const token = startupUpdateToken
  if (token !== null) {
    const versions = desktopRuntime.getVersions()
    if (versions !== null) {
      try {
        const result = await versions.failStartup(token)
        if (result.ok === true) recoveredVersion = result.version
        await log('game update startup recovery', JSON.stringify({ recovered: result.ok === true, version: result.version ?? null, reason: result.reason ?? null }))
      } catch {
        await log('game update startup recovery failed')
      }
    }
    startupUpdateToken = null
  }
  let logPath = 'piggy.log'
  try { logPath = join(app.getPath('userData'), 'piggy.log') } catch { /* 连 userData 都读不到时至少弹框 */ }
  await reportStartupFailure({ dialog, log, error, logPath, version: app.getVersion(), platform: process.platform, recoveredVersion })
  if (recoveredVersion !== null) relaunch()
  app.quit()
}

/** 主猪窗口入口：保留原来的调用方式（测试和窗口重建都走这里）。 */
async function createWindow(override = null) {
  return createPigWindow(pets.primary(), override)
}

/**
 * 给一只猪创建 pet window。多猪时每只窗口各有自己的 BrowserWindow、命中轮询和形状缓存；
 * window.json 仍只记主猪（第一版限制，见 docs/guides/desktop-architecture.md）。
 */
async function createPigWindow(pet, override = null) {
  if (pet === null || pet === undefined || desktopLifecycle.quitting) return
  const saved = override ?? (pet.primary ? await readWindowState() : null)
  if (desktopLifecycle.quitting) return
  pet.savedPigScreen = saved !== null && Number.isFinite(saved.pig?.x) && Number.isFinite(saved.pig?.y) ? { x: saved.pig.x, y: saved.pig.y } : null
  if (pet.savedPigScreen !== null) {
    // 显示器拔掉或换了分辨率：猪至少要整只留在某块屏上。
    const pigArea = screen.getDisplayNearestPoint(pet.savedPigScreen).workArea
    const box = clampBounds({ ...pet.savedPigScreen, width: MIN_WINDOW.width, height: MIN_WINDOW.height }, pigArea)
    pet.savedPigScreen = { x: box.x, y: box.y }
  }
  const area = saved === null ? pigDisplay().workArea : screen.getDisplayMatching(saved).workArea
  const width = saved === null ? FALLBACK_CONTENT.width + WINDOW_PADDING * 2 : saved.width
  const height = saved === null ? FALLBACK_CONTENT.height + WINDOW_PADDING * 2 : saved.height
  const anchorRight = saved === null ? 18 : null
  const stagger = pet.primary ? 0 : Math.max(0, pets.all().indexOf(pet)) * 28
  const start = saved === null
    ? clampBounds({ x: area.x + area.width - width - anchorRight - stagger, y: area.y + area.height - height - anchorRight - stagger, width, height }, area)
    : clampBounds({ ...saved, width, height }, area)
  pet.petAsked = { ...start }
  pet.resizeShape ??= createResizeShape(() => pet.window, rects => applyShape(pet, rects), () => screen.getDisplayMatching(pet.window.getBounds()).scaleFactor)
  pet.owner ??= createPetWindow({ BrowserWindow })
  let startupPageFailureReported = false
  const url = pet.pigId === null ? 'piggy://app/index.html' : `piggy://app/index.html?pig=${encodeURIComponent(pet.pigId)}`
  const pigArguments = pet.pigId === null ? []
    : ['--piggy-role=pet', `--piggy-pig=${pet.pigId}`, ...(pet.primary ? ['--piggy-primary=1'] : [])]
  pet.owner.create({
    options: {
      ...start,
      transparent: true, frame: false, resizable: false, movable: false, hasShadow: false,
      alwaysOnTop: true, skipTaskbar: true, focusable: true, show: false,
      ...auxiliaryWindowOptions(process.platform),
      backgroundColor: '#00000000',
      // 后台页也要维持 rAF 测量/形状上报频率，避免猪慢半拍或窗口移动后画面滞留。
      webPreferences: { preload: join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false,
        ...(pigArguments.length === 0 ? {} : { additionalArguments: pigArguments }) },
    },
    url,
    configure: window => {
      pet.window = window
      pet.webContentsId = Number.isInteger(window.webContents?.id) ? window.webContents.id : null
      pets.bindWindow(pet)
      window.setAlwaysOnTop(true, 'floating')
      if (FRAME_CAP > 0) window.webContents.setFrameRate(FRAME_CAP)
      // Linux 先等页面报真实内容和形状再显示，避免 rootless Xwayland 旧尺寸缓冲 SIGSEGV。
      pet.showGate = createShowGate({ platform: process.platform })
      startupInputTrace.begin()
      if (MOUSE_PASSTHROUGH) {
        setPassthroughMode(pet, 'unknown', 'pet-window-configure')
        pet.passthroughForward = null
        startupInputTrace.record('pet-window-configure', 'startup mouse configuration', JSON.stringify({ platform: process.platform, passthrough: MOUSE_PASSTHROUGH, mode: pet.passthroughMode, pigId: pet.pigId }))
        setHit(pet, false, 'pet-window-configure')
      } else {
        startupInputTrace.record('pet-window-configure', 'startup mouse configuration', JSON.stringify({ platform: process.platform, passthrough: MOUSE_PASSTHROUGH, mode: pet.passthroughMode, pigId: pet.pigId }))
      }
      clearInterval(pet.hitTimer)
      pet.hitTimer = setInterval(() => refreshHit(pet), 16)
      pet.hitTimer.unref?.()
    },
    onClosed: () => {
      stopDrag(pet)
      pet.resizeShape?.cancel()
      clearInterval(pet.hitTimer)
      pet.hitTimer = null
      handlePetWindowClosed(pet)
    },
    onReadyToShow: window => {
      // 启动摆放最多管 3 秒：之后一律按猪当前位置算，免得哪次没对上就一直往回拽。
      setTimeout(() => { if (pet.window === window) pet.savedPigScreen = null }, 3000)
      log('ready-to-show', pet.pigId ?? 'legacy')
      if (pet.showGate !== null && pet.showGate.readyToShow()) showPigWindow(pet)
      // 页面一直不报内容：兜底显示，不能永远不出现。
      setTimeout(() => {
        if (pet.window === window && pet.showGate !== null && pet.showGate.timeout()) {
          log('show fallback', JSON.stringify(pet.showGate.status()))
          showPigWindow(pet)
        }
      }, SHOW_FALLBACK_MS).unref?.()
    },
    onDidFinishLoad: () => {
      startupRendererLoaded = true
      const gate = pet.showGate === null ? null : pet.showGate.status()
      log('page loaded', JSON.stringify({ gate, pigId: pet.pigId }))
      if (gate?.pending === true) log('page loaded before show gate opened', JSON.stringify({ waiting: gate.waiting }))
      pushGeometry(pet)
      if (pet.primary) confirmUpdateStartupIfReady()
    },
    onDidFailLoad: async (window, event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      log('page failed', JSON.stringify({ errorCode, errorDescription, url: validatedURL, mainFrame: isMainFrame, pigId: pet.pigId }))
      if (isMainFrame !== true || desktopLifecycle.quitting || startupPageFailureReported || window.isDestroyed() || window.isVisible() || pet.showGate?.pending !== true) return
      startupPageFailureReported = true
      await handleStartupFailure(new Error(`游戏页面加载失败：${errorDescription}（${errorCode}）`))
    },
    onRendererGone: (window, event, details) => {
      stopDrag(pet)
      const gate = pet.showGate === null ? null : pet.showGate.status()
      log('renderer gone', JSON.stringify(details), JSON.stringify({ visible: window.isVisible(), gate, pigId: pet.pigId }))
      // 窗口还没显示过就崩：先留日志再提示；已显示的运行中故障只记日志。
      void reportStartupCrash(window, details, gate)
    },
    afterLoad: window => {
      window.on('blur', () => panelFocusLeft())
      window.on('unresponsive', () => log('window unresponsive', JSON.stringify({ gate: pet.showGate === null ? null : pet.showGate.status(), pigId: pet.pigId })))
      window.on('responsive', () => log('window responsive', pet.pigId ?? 'legacy'))
      window.webContents.on('console-message', (event, level, message) => { if (level >= 2) log('page:', message, pet.pigId ?? '') })
      if (process.env.PIGGY_DEVTOOLS === '1') window.webContents.openDevTools({ mode: 'detach' })
      if (process.env.PIGGY_CAPTURE && pet.primary) window.webContents.once('did-finish-load', () => { captureForCheck(process.env.PIGGY_CAPTURE) })
    },
  })
  async function reportStartupCrash(window, details, gate) {
    if (desktopLifecycle.quitting || startupPageFailureReported || window.isDestroyed() || window.isVisible() || gate?.pending !== true) return
    startupPageFailureReported = true
    await handleStartupFailure(new Error(pageCrashReason(details)))
  }
}

/**
 * 一只 pet window 真的关了（重建时的旧窗口不会走到这里，pet-window 只在 current 匹配时回调）。
 * 只销毁自己的映射和 session；全部关完后关闭面板，等待原有托盘/退出路径。
 */
function handlePetWindowClosed(pet) {
  pet.closing = true
  // 先按 webContents.id 从 registry 摘掉，再清字段：remove 需要旧的 id 才能删映射。
  pets.remove(pet)
  pet.window = null
  pet.webContentsId = null
  closePetSession(pet)
  if (pet.primary) {
    closePanel('pet-closed')
    log('primary pet window closed; panel unavailable until restart')
  }
  if (pets.all().length === 0) {
    closePanel('all-pets-closed')
    log('all pet windows closed')
  }
}

/** 关窗口时释放这只猪的 worker session；应用退出时 host 已经先释放，失败只记日志。 */
function closePetSession(pet) {
  if (pet.token === null) return
  const token = pet.token
  const pigId = pet.pigId
  pet.token = null
  if (pigId !== null) pigSessions.delete(pigId)
  const host = desktopRuntime.getHost()
  if (host === null || desktopLifecycle.quitting) return
  void Promise.resolve(host.closePigSession(token))
    .catch(error => log('pet session close failed', pigId ?? 'legacy', String(error)))
}

/** 和 owner document / preload 同一套 ID 白名单。 */
const PIG_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/** roster 只接受同一 owner 的合法 pigId，顺序保留。 */
function rosterPigIds(roster) {
  if (roster === null || typeof roster !== 'object') return []
  if (typeof ownerDocumentConfig?.ownerId === 'string' && roster.ownerId !== ownerDocumentConfig.ownerId) return []
  if (!Array.isArray(roster.pigs)) return []
  return [...new Set(roster.pigs
    .map(pig => pig?.pigId)
    .filter(pigId => typeof pigId === 'string' && PIG_ID_PATTERN.test(pigId)))]
}

/**
 * 启动时决定开一只还是多只：
 *   - 只有 OWNER_PIG_RUNTIME_API_VERSION === 1 且同一 owner 的 roster > 1 才多窗口；
 *   - 主猪（owner 选择的那只）必须在前 4 只里；
 *   - 只要有一只 session 开不出来，就回滚全部并退回原来的单窗口。
 */
async function createPetWindows() {
  const primaryId = typeof ownerDocumentConfig?.pigId === 'string' && PIG_ID_PATTERN.test(ownerDocumentConfig.pigId)
    ? ownerDocumentConfig.pigId : null
  let plan = []
  if (ownerPigRuntimeSupported && primaryId !== null) {
    try {
      const host = desktopRuntime.getHost()
      const roster = await host.listOwnerPigs()
      const pigIds = rosterPigIds(roster)
      if (pigIds.length > 1 && pigIds.includes(primaryId)) {
        plan = [primaryId, ...pigIds.filter(pigId => pigId !== primaryId)].slice(0, MAX_PIG_WINDOWS)
      }
    } catch (error) {
      log('multi-pig roster unavailable', String(error))
    }
  }
  if (plan.length > 1) {
    const opened = []
    try {
      for (const pigId of plan) {
        const session = await desktopRuntime.getHost().openPigSession(pigId)
        if (session === null || typeof session.token !== 'string' || session.token === '' || session.pigId !== pigId) {
          throw new Error(`pig session mismatch for ${pigId}`)
        }
        opened.push({ pigId, token: session.token })
      }
    } catch (error) {
      log('multi-pig session failed; falling back to one window', String(error))
      for (const item of opened) {
        try { await desktopRuntime.getHost().closePigSession(item.token) } catch { /* 回滚失败只影响下一次启动 */ }
      }
      plan = []
    }
    if (plan.length > 1) {
      multiPigActive = true
      for (const item of opened) {
        const pet = item.pigId === primaryId ? primaryPetState : createPetState({})
        pet.pigId = item.pigId
        pet.token = item.token
        pet.primary = item.pigId === primaryId
        pet.multiPig = true
        pigSessions.set(item.pigId, item.token)
        pets.add(pet)
      }
      log('multi-pig enabled', JSON.stringify({
        pigs: plan, max: MAX_PIG_WINDOWS, primary: primaryId,
        limits: ['panel:primary-only', 'tray:primary', 'fullscreen:primary-probe', 'recover:primary', 'second-instance:primary'],
      }))
    }
  }
  if (!multiPigActive) {
    log('multi-pig disabled', JSON.stringify({ supported: ownerPigRuntimeSupported, owner: ownerDocumentConfig !== null, pigId: primaryId }))
  }
  await createWindow()
  if (desktopLifecycle.quitting) return
  for (const pet of pets.all()) {
    if (pet === primaryPetState) continue
    try { await createPigWindow(pet) } catch (error) {
      log('pet window failed', pet.pigId ?? 'legacy', String(error))
      closePetSession(pet)
      pets.remove(pet)
    }
  }
}

/** Refresh native pixel/DIP caches by using the already-tested cold view path. */
async function rebuildLinuxViews() {
  const pet = primaryPet()
  if (desktopLifecycle.quitting || pet === null || pet.window === null || pet.window.isDestroyed()) return
  const previous = pet.window
  const previousPanel = getPanelWindow()
  const bounds = pet.petAsked ?? previous.getBounds()
  const pig = pet.lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }
  const saved = { ...bounds, pig: { x: bounds.x + pig.x, y: bounds.y + pig.y } }
  stopDrag(pet)
  pet.resizeShape?.cancel()
  closePanel('display')
  previous.hide()
  pet.lastContent = null
  pet.lastPigWindow = null
  pet.restingPigScreen = null
  pet.lastShape = []
  pet.placedShape = []
  pet.placedHitShape = null
  pet.hasPlacedShape = false
  await createWindow(saved)
  previous.removeAllListeners()
  previous.webContents.removeAllListeners()
  pet.owner?.destroy(previous)
  if (previousPanel && !previousPanel.isDestroyed()) {
    previousPanel.removeAllListeners()
    previousPanel.webContents.removeAllListeners()
    panelWindow.destroy(previousPanel)
  }
  panelWindow.forget(previousPanel)
  if (desktopLifecycle.quitting) return
  ensurePanelWindow()
  pushGeometry(pet)
  log('display views rebuilt', JSON.stringify({ bounds: pet.window.getBounds(), pigId: pet.pigId }))
}

/**
 * The renderer reports the already-pinned pig and content in one frame.
 * Position and resize the window in one setBounds call around that pig point.
 */
ipcMain.on('piggy:content', (event, content) => {
  const pet = petForEvent(event)
  if (pet === null) {
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
  const window = pet.window
  setLegacyHit(pet, undefined, 'piggy:content')
  const anchor = { vertical: content?.anchor?.vertical === 'top' ? 'top' : 'bottom', horizontal: content?.anchor?.horizontal === 'left' ? 'left' : 'right' }
  const bounds = window.getBounds()
  const pigWindow = { x: Number(content?.pigWindow?.x), y: Number(content?.pigWindow?.y) }
  const hasPigWindow = Number.isFinite(pigWindow.x) && Number.isFinite(pigWindow.y)
  const pigSize = Number(content?.pig?.width) > 0 && Number(content?.pig?.height) > 0
    ? { width: Number(content.pig.width), height: Number(content.pig.height) } : pet.lastPigSize
  const sizeChanged = pet.lastPigWindow !== null
    && (pet.lastPigSize.width !== pigSize.width || pet.lastPigSize.height !== pigSize.height)
  const panelOpen = content?.panelOpen === true
  const changed = pet.lastContent === null
    || pet.lastContent.width !== width || pet.lastContent.height !== height
    || pet.lastContent.anchor.vertical !== anchor.vertical || pet.lastContent.anchor.horizontal !== anchor.horizontal
    || sizeChanged
    || (hasPigWindow && pet.lastPigWindow !== null && (pigWindow.x !== pet.lastPigWindow.x || pigWindow.y !== pet.lastPigWindow.y))

  if (pet.savedPigScreen !== null) {
    // 用「这次摆之前」的窗口 + 页面实际量到的猪位置判断：窗口已经不用再改、猪确实在存下的位置上。
    const pigNow = { x: Number(content?.pigNow?.x), y: Number(content?.pigNow?.y) }
    const settled = bounds.width === Math.max(MIN_WINDOW.width, Math.round(width))
      && bounds.height === Math.max(MIN_WINDOW.height, Math.round(height))
      && Math.abs(bounds.x + pigNow.x - pet.savedPigScreen.x) <= 1 && Math.abs(bounds.y + pigNow.y - pet.savedPigScreen.y) <= 1
    if (settled || panelOpen) pet.savedPigScreen = null
  }

  // 开、关面板本身不挪窗口（收起时窗口按打开时的范围留着位置）。只在打开那一刻记下猪的原位，
  // 面板开着时内容变化要按它摆回。以前开关面板也算「内容变了」，Windows 缩放下差 1px 就会
  // 重新 setBounds 一次，整块内容往上闪一下（用户 2026-10-05）。
  if (panelOpen && pet.lastContent?.panelOpen !== true && hasPigWindow) {
    const base = pet.lastPigWindow ?? pigWindow
    pet.restingPigScreen = pet.savedPigScreen ?? { x: bounds.x + base.x, y: bounds.y + base.y }
  }
  let moved = null
  if (changed && hasPigWindow) {
    const pigNow = { x: Number(content?.pigNow?.x), y: Number(content?.pigNow?.y) }
    const before = pet.lastPigWindow ?? (Number.isFinite(pigNow.x) && Number.isFinite(pigNow.y) ? pigNow : pigWindow)
    // 启动时以存下来的猪位置为准，直到页面量到的实际位置（pigNow，不是预测值）和它对上：
    // 启动那几次上报里窗口还在改大小，按预测值摆会让猪每次启动漂几像素。
    const pigBefore = pet.savedPigScreen ?? { x: bounds.x + before.x, y: bounds.y + before.y }
    // 启动时页面先画占位的纸盒，拿到存档才换成真正的猪：这个尺寸变化不是「调了小猪大小」，
    // 不能按脚底中心挪，直接摆回存下的位置（存的就是真猪的左上角）。
    const target = pet.savedPigScreen !== null ? pet.savedPigScreen
      : sizeChanged
        ? resizedPigScreenPoint(pet.restingPigScreen ?? pigBefore, pet.lastPigSize, pigSize)
        : (pet.restingPigScreen ?? pigBefore)
    if (sizeChanged && pet.restingPigScreen !== null) pet.restingPigScreen = target
    const area = screen.getDisplayNearestPoint(target).workArea
    moved = applyBounds(pet, contentBoundsForPig({
      width, height, pigWindow: { ...pigWindow, ...pigSize }, panelOpen,
      allowPanelOverflow: sizeChanged,
    }, target, area), 'content')
  }
  if (!panelOpen) pet.restingPigScreen = null

  pet.lastContent = { width, height, anchor, panelOpen }
  if (hasPigWindow) pet.lastPigWindow = pigWindow
  pet.lastPigSize = pigSize
  // 记下「猪在屏幕上哪儿」：实机核对展开面板时它有没有动（日志里是 DIP 坐标）。
  const pigOnScreen = hasPigWindow ? { x: window.getBounds().x + pigWindow.x, y: window.getBounds().y + pigWindow.y } : null
  log('content', JSON.stringify({ pigId: pet.pigId, window: window.getBounds(), anchor, panelOpen, pigOnScreen, target: pet.restingPigScreen, moved }))
  const shape = Array.isArray(content.shape) ? content.shape : []
  applyShape(pet, shape.slice(0, 64).map(r => ({
    x: Math.max(0, Math.round(Number(r.x) || 0)), y: Math.max(0, Math.round(Number(r.y) || 0)),
    width: Math.max(0, Math.round(Number(r.width) || 0)), height: Math.max(0, Math.round(Number(r.height) || 0)),
  })))
  if (pet.showGate !== null && pet.showGate.content()) showPigWindow(pet)
  pet.lastShape = shape
  if (content?.immediate === true) {
    const current = window.getBounds()
    event.returnValue = { window: current, workArea: workAreaFor(current), seq: geometrySeq }
  }
})

/** 这块屏的刷新率；拿不到就按 60。 */
function refreshRateAt(point) {
  const display = point === null || point === undefined ? screen.getPrimaryDisplay() : screen.getDisplayNearestPoint(point)
  const hz = Number(display?.displayFrequency)
  return Number.isFinite(hz) && hz >= 30 ? Math.min(240, Math.round(hz)) : 60
}

function dragTick(pet, cursorOverride) {
  const window = pet?.window
  if (window === null || window === undefined || window.isDestroyed() || pet.dragSession === null) return
  if (pet.dragStats !== null) {
    const now = Date.now()
    pet.dragStats.ticks += 1
    pet.dragStats.maxGap = Math.max(pet.dragStats.maxGap, now - pet.dragStats.last)
    pet.dragStats.last = now
  }
  if (dragHeartbeatExpired(pet.dragSession.lastHeartbeat, Date.now())) { stopDrag(pet); return }
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
  const pig = pet.dragSession.pig ?? { ...(pet.lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }), ...pet.lastPigSize }
  // 窗口大小用请求值，不用回读值（见 petAsked 的说明）
  const wanted = dragPigBounds(pet.petAsked ?? window.getBounds(), pig, pet.dragSession.pigScreen, pet.dragSession.cursor, cursor, areas, pet.dragSession.visual)
  if (!pet.dragShapeActive) {
    pet.dragShapeActive = true
    if (!SKIP_NATIVE_SHAPE) {
      const bounds = window.getBounds()
      applyShape(pet, [{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
    }
    refreshHit(pet)
  }
  if (!pet.dragSession.slide) { applyBounds(pet, wanted, 'drag'); return }
  // 窗口只在整个桌面的外沿夹取，屏幕接缝允许跨过；猪在窗口里滑过外沿留白：
  // GNOME 等窗口管理器不让程序把窗口摆到屏幕外，猪窗口四周又有透明留白（气泡区），
  // 拖到屏幕边上时窗口被卡住、猪就停在离边一大截的地方，松手才瞬移过去
  // （2026-10-07 虚拟机真拖录像逐帧看到的）。现在窗口夹在工作区里，超出去的那一截
  // 告诉页面，让它把猪在窗口里挪过去——猪一路跟着鼠标走到边上。
  const held = desktopViewportBounds(wanted, areas)
  const slide = { x: wanted.x - held.x, y: wanted.y - held.y }
  applyBounds(pet, held, 'drag')
  if (slide.x !== pet.dragSession.lastSlide.x || slide.y !== pet.dragSession.lastSlide.y) {
    pet.dragSession.lastSlide = slide
    pet.lastDragSlide = slide
    window.webContents.send('piggy:drag-slide', slide)
    followPig(pet)
    // 拖动期间用整窗形状（drag:start 时设置）：窗口被夹住时猪在窗口里滑，
    // 逐帧改 setShape 既慢又容易在 X11 上把猪裁掉/刷空。松手后页面 place 恢复精确形状。
  }
}
/** 停掉一只猪的拖动；不传 pet 时停全部（退出/显示器重建）。 */
function stopDrag(pet = null) {
  const targets = pet === null ? pets.all() : [pet]
  for (const target of targets) {
    clearInterval(target.dragTimer)
    target.dragTimer = null
    target.dragSession = null
    target.dragStats = null
    refreshHit(target)
  }
}

/** 页面要几何：给它推一次（订阅晚于 did-finish-load 时靠这个）。 */
ipcMain.on('piggy:geometry:ask', (event) => {
  const pet = petForEvent(event)
  if (pet === null) return
  pushGeometry(pet)
})

ipcMain.on('piggy:drag:start', (event, given) => {
  const pet = petForEvent(event)
  if (pet === null) return
  if (given != null && (!isMouseRect(given) || given.width <= 0 || given.height <= 0)) return
  stopDrag(pet)
  const bounds = pet.window.getBounds()
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
  const pigFromPage = isMouseRect(given) && given.width > 0 && given.height > 0
    ? { x: given.x, y: given.y, width: given.width, height: given.height } : null
  // 延迟拖动的 origin 已由页面在 pointerdown 时验证；摸摸动画可能已改变当前墨迹，不能拿新帧否认旧命中。
  // 无合法 origin 的旧调用仍按当前输入判断，透明区域不能直接取得捕获。
  const inputSlide = pet.flightShapeActive ? pet.flightSlide : pet.dragShapeActive ? pet.lastDragSlide : { x: 0, y: 0 }
  if (pet.placedHitShape !== null && (pigFromPage === null
    || (acceptedOrigin === null && !pointerHitsShape(dragOrigin, bounds, shiftedShape(pet.placedHitShape, inputSlide))))) return
  const pig = pigFromPage ?? pet.lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }
  pet.dragSession = {
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
  pet.lastDragSlide = { x: 0, y: 0 }
  // 猪被拖走了：面板打开时记下的「原位」作废，否则下一次内容变化（比如点商店）
  // 会把窗口拽回原位 —— 用户看到的「瞬移」「拖着拖着卡在原地」。
  pet.restingPigScreen = null
  pet.savedPigScreen = null
  // 拖动期间每一帧都不写日志（60Hz 会刷爆），但起止各记一行：出问题时能看出拖了多远、
  // 起始窗口和猪的位置对不对得上（2026-10-06 的偏移排查就是缺这一段）。
  pet.dragShapeActive = true
  if (!SKIP_NATIVE_SHAPE) applyShape(pet, [{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
  setHit(pet, true, 'drag-start')
  pet.resizeShape?.cancel()
  log('drag start', JSON.stringify({ pigId: pet.pigId, bounds, pigScreen: pet.dragSession.pigScreen, pigFromPage: pigFromPage !== null,
    origin: acceptedOrigin }))
  // tick 频率跟显示器刷新率走，不再写死 60Hz：144Hz 屏上窗口 60Hz 地动、画面 144Hz 地刷，
  // 一样是抽帧（用户 2026-10-07：「帧数应该跟显示器同步」）。
  const hz = refreshRateAt(pet.dragSession.cursor)
  pet.dragTimer = setInterval(() => dragTick(pet), 1000 / hz)
  pet.dragStats = { hz, ticks: 0, last: Date.now(), maxGap: 0 }
})
ipcMain.on('piggy:drag:heartbeat', event => {
  const pet = petForEvent(event)
  if (pet === null || pet.dragSession === null) return
  pet.dragSession.lastHeartbeat = Date.now()
  // 页面每次 pointermove 都会发心跳，跟着屏幕刷新走；顺手挪一次窗口，
  // 比只靠主进程定时器（Windows 上计时精度约 15.6ms）更顺。
  dragTick(pet)
})
ipcMain.on('piggy:drag:end', (event, release) => {
  const pet = petForEvent(event)
  if (pet === null) return
  // 页面的 release 坐标可能比主进程此刻读到的光标旧（输入队列延迟）；
  // 主进程的光标是最新值，最后一帧用它算 slide。
  dragTick(pet)
  if (pet.dragSession !== null) {
    const bounds = pet.window === null || pet.window.isDestroyed() ? null : pet.window.getBounds()
    // 猪在窗口里的位置：页面给了就用它，没给就用上次量到的（和 dragTick 同一套兜底）。
    const pig = pet.dragSession.pig ?? pet.lastPigWindow ?? { x: WINDOW_PADDING, y: WINDOW_PADDING }
    const startWindow = { x: pet.dragSession.pigScreen.x - pig.x, y: pet.dragSession.pigScreen.y - pig.y }
    log('drag end', JSON.stringify({ pigId: pet.pigId, bounds, from: startWindow, movedBy: bounds === null ? null
      : { x: bounds.x - startWindow.x, y: bounds.y - startWindow.y } }))
    // tick 是不是跟得上刷新率：maxGap 远大于 1000/hz 就说明主进程被别的活挡住了。
    if (pet.dragStats !== null) log('drag ticks', JSON.stringify(pet.dragStats))
  }
  stopDrag(pet)
  pet.restingPigScreen = null
  reanchorPanel(pet)
  // 页面紧接着要读几何重定家：把最后一帧 slide 一起同步返回，避免 send/sendSync 乱序。
  event.returnValue = geometryOf(pet.window?.getBounds() ?? { x: 0, y: 0, width: 0, height: 0 }, geometrySeq, pet)
})

/**
 * 新游戏包的桌面逻辑：窗口摆哪、多大、哪里可点，都由页面算好，主进程只照做。
 * 同步返回改完后的几何，页面同一轮里就能接着用。以后这类调整只发游戏包，不用再发桌面程序。
 */
ipcMain.on('piggy:place', (event, request) => {
  const pet = petForEvent(event)
  if (pet === null || !isPlaceRequest(request)) { event.returnValue = null; return }
  const window = pet.window
  if (pet.passthroughMode !== 'modern') {
    setPassthroughMode(pet, 'modern', 'piggy:place')
    setHit(pet, pet.passthroughHit, 'piggy:place')
  }
  // place({}) is a synchronous geometry query, not a landing/placement commit.
  // During native dragging even old pages must not compete with dragTick by
  // moving the window or restoring a stale precise drawing shape.
  const reading = request.bounds === undefined && request.shape === undefined && request.hitShape === undefined && request.pig === undefined
  if (reading || pet.dragSession !== null) {
    event.returnValue = geometryOf(window.getBounds(), geometrySeq, pet)
    return
  }
  // 动画可单独更新真实输入；不能因此结束尚未提交新画面的整窗绘制保护。
  if (request.bounds === undefined && request.shape === undefined && request.pig === undefined) {
    const slide = pet.flightShapeActive ? pet.flightSlide : pet.dragShapeActive ? pet.lastDragSlide : { x: 0, y: 0 }
    pet.placedHitShape = request.hitShape.slice(0, 64).map(rect => ({
      x: rect.x - slide.x, y: rect.y - slide.y, width: rect.width, height: rect.height,
    }))
    refreshHit(pet)
    event.returnValue = geometryOf(window.getBounds(), geometrySeq, pet)
    return
  }
  const b = request?.bounds
  const motionHandoff = Array.isArray(request.shape) && (pet.dragShapeActive || pet.flightShapeActive)
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
    const next = { x: Math.round(b.x), y: Math.round(b.y), width: Math.max(MIN_WINDOW.width, Math.round(b.width)), height: Math.max(MIN_WINDOW.height, Math.round(b.height)) }
    if (process.platform === 'linux') pet.resizeShape?.begin(next, motionHandoff)
    applyBounds(pet, next, 'place')
  } else if (motionHandoff && process.platform === 'linux') {
    // commitSlide transfers translate into layout without changing the window
    // size. Keep the old backing frame whole until the new layout is painted,
    // just as on resize; otherwise its new precise shape clips the old pig.
    pet.resizeShape?.begin(window.getBounds(), true)
  }
  // setBounds 是异步的（X11 要等 ConfigureNotify 回来），紧跟其后的 getBounds() 可能还是旧值。
  // 页面拿这个旧值做闭环核对，就会算出假偏差、再照着它挪窗口 —— 用户看到的「越修越偏」。
  // 这里把「请求值 vs 立刻回读值」的差记下来，先把机制钉死。
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite)) {
    const after = window.getBounds()
    if (Math.abs(after.x - Math.round(b.x)) > 1 || Math.abs(after.y - Math.round(b.y)) > 1) {
      log('place-stale', JSON.stringify({ pigId: pet.pigId, asked: { x: Math.round(b.x), y: Math.round(b.y) }, read: after }))
    }
  }
  // 落地/接住后的正常摆放：抛掷滑动归零，形状回到未平移的版本。
  pet.flightSlide = { x: 0, y: 0 }
  pet.lastFlightShapeSlide = null
  pet.flightShapeActive = false
  pet.dragShapeActive = false
  if (Array.isArray(request.hitShape)) pet.placedHitShape = request.hitShape.slice(0, 64).map(rect => ({
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
  }))
  if (Array.isArray(request?.shape)) {
    pet.hasPlacedShape = true
    pet.placedShape = request.shape.slice(0, 64).map(r => ({
      x: Math.max(0, Math.round(Number(r.x) || 0)), y: Math.max(0, Math.round(Number(r.y) || 0)),
      width: Math.max(0, Math.round(Number(r.width) || 0)), height: Math.max(0, Math.round(Number(r.height) || 0)),
    }))
    pet.resizeShape?.update(pet.placedShape)
    // 新游戏包的第一次摆放就带真实尺寸和形状：窗口此前一直藏着，
    // 现在 setBounds + setShape 都做完了，可以显示了（Linux 防 Xwayland resize 崩溃）。
    if (pet.showGate !== null && pet.showGate.content()) showPigWindow(pet)
  }
  refreshHit(pet)
  // 游戏包 0.33.1 起顺带报猪在窗口里的框（贴屏幕边时内容在窗口里挪过）：面板按它贴猪。
  const pig = request?.pig
  let panelPigChanged = false
  if (pig && [pig.x, pig.y, pig.width, pig.height].every(Number.isFinite) && pig.width > 0 && pig.height > 0) {
    panelPigChanged = pet.panelPig === null || pet.panelPig.x !== pig.x || pet.panelPig.y !== pig.y || pet.panelPig.width !== pig.width || pet.panelPig.height !== pig.height
    pet.panelPig = { x: pig.x, y: pig.y, width: pig.width, height: pig.height }
  }
  let speechChanged = false
  if (Object.hasOwn(request, 'speech')) {
    const s = request.speech
    const next = s && [s.x, s.y, s.width, s.height].every(Number.isFinite) && s.width > 0 && s.height > 0
      ? { x: s.x, y: s.y, width: s.width, height: s.height } : null
    speechChanged = JSON.stringify(pet.panelSpeech) !== JSON.stringify(next)
    pet.panelSpeech = next
  }
  if (pet.dragSession === null && pet.primary) {
    if (speechChanged) reanchorPanel(pet)
    else if (panelPigChanged) followPig(pet)
  }
  event.returnValue = geometryOf(window.getBounds(), geometrySeq, pet)
})

/**
 * A2 抛掷：页面每帧算好窗口位置和 slide，主进程只挪窗口。
 * 和旧的 piggy:move（鼠标增量）是两条通道，payload 和语义都不同。
 */
ipcMain.on('piggy:flight:move', (event, frame) => {
  const pet = petForEvent(event)
  if (pet === null) return
  if (pet.dragSession !== null) return
  if (frame === null || typeof frame !== 'object') return
  if (!Number.isFinite(frame.x) || !Number.isFinite(frame.y)) return
  const slide = frame.slide === undefined ? { x: 0, y: 0 } : frame.slide
  if (slide === null || typeof slide !== 'object' || ![slide.x, slide.y].every(Number.isFinite)) return
  if (pet.passthroughMode !== 'modern') {
    setPassthroughMode(pet, 'modern', 'piggy:flight:move')
    setHit(pet, pet.passthroughHit, 'piggy:flight:move')
  }
  pet.resizeShape?.cancel()
  applyFlightBounds(pet, frame.x, frame.y)
  pet.flightSlide = slide
  if (!pet.flightShapeActive) {
    pet.flightShapeActive = true
    // 只扩大绘制：逐帧 setShape 会刷空透明窗口，输入仍跟随当前立绘区域。
    // 落地/接住后页面会发 place，恢复精确绘制形状。
    if (!SKIP_NATIVE_SHAPE) {
      const bounds = pet.window.getBounds()
      applyShape(pet, [{ x: 0, y: 0, width: bounds.width, height: bounds.height }])
    }
  }
  refreshHit(pet)
})

/** 旧游戏页面判断命中；现代游戏由主进程读取光标，不依赖穿透窗口收到 mousemove。 */
ipcMain.on('piggy:hit', (event, hit) => {
  const pet = petForEvent(event)
  if (pet === null || typeof hit !== 'boolean') return
  if (pet.hasPlacedShape) return
  setLegacyHit(pet, hit, 'piggy:hit')
})

/** 旧游戏包（0.27.2 及以前）只会发鼠标增量：照旧支持，回退版本时拖动不坏。 */
ipcMain.on('piggy:move', (event, delta) => {
  const pet = petForEvent(event)
  if (pet === null) return
  const dx = Number(delta?.dx)
  const dy = Number(delta?.dy)
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return
  pet.restingPigScreen = null
  applyBounds(pet, moveAcrossDisplays(pet.window.getBounds(), dx, dy, screen.getAllDisplays().map(display => display.workArea)), 'move')
  if (pet.primary) reanchorPanel(pet)
})

ipcMain.on('piggy:shape', (event, rects) => {
  const pet = petForEvent(event)
  if (pet === null || !isMouseShape(rects)) return
  if (pet.lastShape.length === 0 && rects.length > 0) log('first shape', pet.pigId ?? 'legacy', JSON.stringify(rects))
  setLegacyHit(pet, undefined, 'piggy:shape')
  pet.lastShape = rects
  applyShape(pet, rects.slice(0, 64).map(r => ({
    x: Math.round(Number(r.x) || 0), y: Math.round(Number(r.y) || 0),
    width: Math.max(0, Math.round(Number(r.width) || 0)), height: Math.max(0, Math.round(Number(r.height) || 0)),
  })))
})

// ---------------------------------------------------------------------------
// 面板窗口（外壳 0.6.0 起，窗口句柄与renderer就绪状态由 lib/panel-window.js 持有）
// ---------------------------------------------------------------------------

/** 面板现在开着没有（用户眼里的「开」，窗口可能还在等页面报尺寸）。 */
let panelOpen = false
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

let stateTimer = null
/** 存档变了：两个窗口都刷新（合并 30ms 内的多次，一次动作可能连发几个请求）。 */
function announceStateChanged() {
  if (stateTimer !== null) return
  stateTimer = setTimeout(() => { stateTimer = null; toPages('piggy:state-changed') }, 30)
}

/** 主猪在屏幕上的框（拖到屏幕边时加上猪在窗口里滑出去的那一截）。 */
function pigOnScreen() {
  const pet = primaryPet()
  if (pet === null || pet.window === null || pet.window.isDestroyed() || pet.panelPig === null) return null
  return pigScreenBox(pet.petAsked, pet.window.getBounds(), pet.panelPig, pet.dragSession !== null ? { dragging: true, slide: pet.lastDragSlide } : {})
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
  const pet = primaryPet()
  const pig = panelReferenceOnScreen()
  if (pig === null || panelAnchor === null) return null
  return panelBoundsFor(pig, panelAnchor, panelViewportSize(panelAnchor, panelSize, panelFixedViewport),
    pet?.dragSession !== null && pet?.dragSession !== undefined ? screen.getAllDisplays().map(display => display.workArea) : null)
}

function panelReferenceOnScreen() {
  const pet = primaryPet()
  const pig = pigOnScreen()
  if (pig === null || pet === null || pet.window === null || pet.window.isDestroyed() || pet.panelSpeech === null) return pig
  const speech = pigScreenBox(pet.petAsked, pet.window.getBounds(), pet.panelSpeech,
    pet.dragSession !== null ? { dragging: true, slide: pet.lastDragSlide } : {})
  return panelReferenceFor(pig, speech)
}

function sendPanel(message) {
  const target = getPanelWindow()
  if (target !== null && !target.isDestroyed() && panelWindow.isReady()) target.webContents.send('piggy:panel', message)
}

/** 固定外框只让实际卡片和名牌接收点击，透明预留区继续点到桌面。 */
function refreshPanelHit() {
  if (!panelFixedViewport || !panelOpen || !panelAnchor || !getPanelWindow() || getPanelWindow().isDestroyed() || !getPanelWindow().isVisible()) return
  const bounds = getPanelWindow().getBounds()
  const hit = pointerHitsShape(screen.getCursorScreenPoint(), bounds, [panelContentRect(bounds, panelAnchor, panelSize)])
  if (hit === panelHit) return
  panelHit = hit
  traceSetIgnoreMouseEvents('panel', 'panel', 'panel-hit', !hit, true,
    () => getPanelWindow().setIgnoreMouseEvents(!hit, { forward: true }))
}

const panelShape = createResizeShape(() => getPanelWindow(), rects => {
  if (getPanelWindow() && !getPanelWindow().isDestroyed() && process.platform !== 'darwin') getPanelWindow().setShape(rects)
}, () => screen.getDisplayMatching(getPanelWindow().getBounds()).scaleFactor)

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
  const pet = primaryPet()
  if (pet === null || pet.window === null || pet.window.isDestroyed() || !pet.window.isVisible()) return
  // 置顶标记仍为 true 时，菜单也可能被其他应用盖住；先抬菜单，再抬猪。
  if (getPanelWindow() !== null && !getPanelWindow().isDestroyed() && getPanelWindow().isVisible()) getPanelWindow().moveTop()
  pet.window.moveTop()
}

/** 第二只猪右键：第一版不弹独立面板，只把它叫到前面。 */
function focusPetWindow(pet) {
  const window = pet?.window
  if (window === null || window === undefined || window.isDestroyed()) return
  if (!window.isVisible()) window.showInactive()
  window.moveTop()
  window.focus?.()
}

function ensurePanelWindow() {
  return panelWindow.ensure()
}

/**
 * 焦点离开了主猪窗口或面板窗口：如果也没落到另一个上，就是点到别处了。
 * 面板打开时不抢焦点（见 placePanel），焦点多半还在猪窗口上，所以两个窗口的失焦都要听。
 * 第一版面板只服务主猪：焦点落到第二只猪也算「点到别处」。
 */
function panelFocusLeft() {
  if (!panelOpen) return
  setTimeout(() => {
    if (!panelOpen) return
    const focused = BrowserWindow.getFocusedWindow()
    if (focused !== null && (focused === getPetWindow() || focused === getPanelWindow() || focused === extensionWindow.current())) return
    // 原生窗口重新映射时焦点可能暂空，指针仍在真实面板内不能算外部点击。
    if (focused === null && panelAnchor && panelSize && getPanelWindow() && !getPanelWindow().isDestroyed() && getPanelWindow().isVisible()) {
      const bounds = getPanelWindow().getBounds()
      if (pointerHitsShape(screen.getCursorScreenPoint(), bounds, [panelContentRect(bounds, panelAnchor, panelSize)])) return
    }
    sendPanel({ type: 'blur', toPet: false })
  }, 0)
}

/** 把面板窗口放到该在的地方；第一次有尺寸时才显示（免得先闪一个空窗口）。 */
function placePanel() {
  if (!panelOpen || getPanelWindow() === null || getPanelWindow().isDestroyed()) return
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
      getPanelWindow().setShape([{x: 0, y: 0, width: next.width, height: next.height}])
      panelShapeKey = ''
      panelHasNativeShape = false
    }
  }
  if (panelAsked === null || panelAsked.x !== next.x || panelAsked.y !== next.y
    || panelAsked.width !== next.width || panelAsked.height !== next.height) {
    getPanelWindow().setBounds(next)
    panelAsked = next
  }
  if (panelSize !== null && !getPanelWindow().isVisible()) {
    // 不抢焦点：GNOME 会把「抢焦点」变成一条「dsh-piggy is ready」的通知，每开一次面板弹一次
    //（2026-10-07 虚拟机录像里看到）。点进面板时它自然会拿到焦点。
    getPanelWindow().showInactive()
    raisePetAbovePanel()
    log('panel shown', JSON.stringify({ bounds: next, anchor: panelAnchor?.vertical }))
    const pet = primaryPet()
    if (pet !== null && pet.window !== null && !pet.window.isDestroyed()) pet.window.webContents.send('piggy:panel', { type: 'open' })
  }
}

function openPanel(pig) {
  const pet = primaryPet()
  if (pet === null) return
  if (Number.isFinite(pig?.x) && Number.isFinite(pig?.y) && pig?.width > 0 && pig?.height > 0) {
    pet.panelPig = { x: pig.x, y: pig.y, width: pig.width, height: pig.height }
  }
  if (pet.panelPig === null) return
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
  if (getPanelWindow() !== null && !getPanelWindow().isDestroyed()) getPanelWindow().hide()
  sendPanel({ type: 'closed' })
  const pet = primaryPet()
  if (pet !== null && pet.window !== null && !pet.window.isDestroyed()) pet.window.webContents.send('piggy:panel', { type: 'closed' })
  log('panel closed', why)
}

/** 主猪窗口挪了（拖动、散步、贴边修正）：面板按猪的新位置重摆，不重新挑朝向（松手后再挑）。 */
function followPig(pet = primaryPet()) {
  if (pet === null || !pet.primary) return
  if (!panelOpen || getPanelWindow() === null || getPanelWindow().isDestroyed() || !getPanelWindow().isVisible()) return
  placePanel()
}

/** 拖完 / 散步完：猪到了新地方，重新决定面板朝哪边开（放不下就换边）。 */
function reanchorPanel(pet = primaryPet()) {
  if (pet === null || !pet.primary) return
  if (!panelOpen) return
  const next = decidePanelAnchor()
  if (next === null) return
  const changed = panelAnchor === null || next.vertical !== panelAnchor.vertical || next.maxHeight !== panelAnchor.maxHeight
  panelAnchor = next
  if (changed) sendPanel({ type: 'open', vertical: next.vertical, maxHeight: next.maxHeight })
  placePanel()
}

/** 猪页面：右键开/关面板（带上猪在窗口里的框）。第二只猪第一版只聚焦/置顶。 */
ipcMain.on('piggy:panel:toggle', (event, request) => {
  const pet = petForEvent(event)
  if (pet === null) return
  if (!pet.primary) {
    focusPetWindow(pet)
    log('panel toggle ignored for secondary pig', pet.pigId ?? 'legacy')
    return
  }
  const action = panelToggleAction({ requestedOpen: request?.open === true, isOpen: panelOpen,
    isVisible: getPanelWindow() !== null && !getPanelWindow().isDestroyed() && getPanelWindow().isVisible() })
  if (action === 'open') openPanel(request.pig)
  else if (action === 'close') closePanel('pet')
  else {
    // 首次加载期间复按只保持打开意图；回传状态，免得猪页面误以为已经关闭。
    pet.window.webContents.send('piggy:panel', { type: 'open' })
    log('panel loading click kept')
  }
})
/** 面板页面：内容量好了多大。 */
ipcMain.on('piggy:panel:size', (event, size) => {
  if (!fromPage(event) || event.sender !== getPanelWindow()?.webContents) return
  const width = Number(size?.width)
  const height = Number(size?.height)
  if (!(width > 0) || !(height > 0)) return
  panelSize = { width: Math.ceil(width), height: Math.ceil(height) }
  // 新 preload 透传第三个参数；旧游戏包/旧 preload 自动沿用可变外框。
  panelFixedViewport = size.fixedViewport === true
  if (panelFixedViewport) startPanelHit()
  else {
    stopPanelHit()
    traceSetIgnoreMouseEvents('panel', 'panel', 'panel-variable-viewport', false, 'omitted',
      () => getPanelWindow().setIgnoreMouseEvents(false))
  }
  placePanel()
  if (process.platform === 'darwin') refreshPanelHit()
})
/** 任一页面：收起面板（面板里点了收起、点外面自动收起）。 */
ipcMain.on('piggy:panel:close', event => { if (fromPage(event)) closePanel('page') })
/** 面板页面里对猪的反应（喂食时猪的动作、冒气泡）：转给主猪窗口去演。 */
// 猪窗口自己冒气泡（签到、点猪的反应）时也抬一次，跟面板转来的反应一样（用户 2026-10-10：气泡被面板盖住）。
ipcMain.on('piggy:pet-raise', event => {
  const pet = primaryPet()
  if (!fromPage(event) || pet === null || event.sender !== pet.window?.webContents) return
  raisePetAbovePanel()
})

ipcMain.on('piggy:pig-fx', (event, fx) => {
  if (!fromPage(event) || (event.sender !== getPanelWindow()?.webContents && !extensionWindow.owns(event.sender))) return
  const pet = primaryPet()
  if (pet === null || pet.window === null || pet.window.isDestroyed() || typeof fx?.name !== 'string') return
  pet.window.webContents.send('piggy:pig-fx', { name: fx.name, args: Array.isArray(fx.args) ? fx.args : [] })
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
  const action = desktopLifecycle.reserveAction('import', 'prepare')
  if (action === null) return
  try {
    const source = await dshSavePath()
    if (action.cancelled || desktopLifecycle.quitting) return
    if (source === null) {
      await dialog.showMessageBox({ type: 'info', message: '没找到 DSH 里的猪', detail: '默认找 ~/.dsh/dsh-piggy/state.json（或 DSH_HOME 下面）。' })
      return
    }
    const { response } = await dialog.showMessageBox({
      type: 'question', buttons: ['导入', '算了'], defaultId: 0, cancelId: 1,
      message: '把 DSH 里的猪接过来？',
      detail: `从 ${source} 复制一份过来。桌面版现在这只会先备份，不会丢。`,
    })
    if (action.cancelled || desktopLifecycle.quitting || response !== 0) return
    action.phase = 'commit'
    await desktopLifecycle.requireSavedGame()
    const target = statePath()
    await mkdir(dirname(target), { recursive: true })
    await backupSave('import')
    await copyFile(source, target + '.importing')
    await rename(target + '.importing', target)
    await desktopLifecycle.restartGame()
  } catch (error) {
    if (!action.cancelled) await desktopLifecycle.recoverAction(error)
  } finally { desktopLifecycle.releaseAction(action) }
}

/** 开机自启的持久化：Windows 走 Electron 登录项，Linux 写 autostart 条目（见 lib/autostart.js）。 */
const autostart = createAutostart({ app, log, isQuitting: () => desktopLifecycle.quitting })

/** 托盘图标和菜单；窗口动作仍由主进程现有的入口处理。 */
const tray = createDesktopTray({
  Tray, Menu, nativeImage,
  icon: join(HERE, 'build', 'tray.png'),
  pig: {
    visible: () => getPetWindow()?.isVisible() === true,
    hide: () => {
      closePanel('tray')
      for (const pet of pets.all()) { if (pet.window !== null && !pet.window.isDestroyed()) pet.window.hide() }
    },
    show: () => {
      for (const pet of pets.all()) {
        if (pet.window !== null && !pet.window.isDestroyed() && !pet.window.isVisible()) pet.window.showInactive()
      }
    },
  },
  autostart,
  recoverPig,
  importFromDsh,
  quit: () => app.quit(),
  log,
  isQuitting: () => desktopLifecycle.quitting,
})

/** 托盘恢复：清掉主猪陈旧的拖动/抛掷锚点，先把窗口移到主屏可见处，再让猪页把尺寸和家复位。 */
function recoverPig() {
  const pet = primaryPet()
  if (desktopLifecycle.quitting || pet === null || pet.window === null || pet.window.isDestroyed()) return
  const payload = recoveryPayload(screen.getPrimaryDisplay())
  if (payload === null) return
  stopDrag(pet)
  pet.resizeShape?.cancel()
  pet.dragShapeActive = false
  pet.flightShapeActive = false
  pet.flightSlide = { x: 0, y: 0 }
  pet.lastDragSlide = { x: 0, y: 0 }
  pet.lastFlightShapeSlide = null
  pet.savedPigScreen = null
  pet.restingPigScreen = null
  pet.window.showInactive()
  applyBounds(pet, recoverBounds(pet.window.getBounds(), payload.workArea), 'recover')
  pet.window.webContents.send('piggy:recover', payload)
  log('recover', JSON.stringify({ ...payload, pigId: pet.pigId }))
}

/** Keep a copy of the save before the game code under it changes. */
async function backupSave(label) {
  const file = statePath()
  try { await access(file) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  await copyFile(file, `${file}.before-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
}

// ---- 外部连接（设置 → 外部连接）：只允许面板窗口，扩展大窗口不行 ----
registerExternalIpc({
  ipcMain, fromPanelOnly,
  getExternalManager: () => externalManager,
  toPages,
})

// ---- 更新 App（页面里的 tabs/update.js）通过这几个口子调用 ----
registerUpdatesIpc({
  ipcMain, fromPage, toPages,
  getVersions: () => desktopRuntime.getVersions(),
  getShellUpdates: () => shellUpdates,
  isActionActive: () => desktopLifecycle.activeAction !== null,
  reserveAction: desktopLifecycle.reserveAction, releaseAction: desktopLifecycle.releaseAction,
  requireSavedGame: desktopLifecycle.requireSavedGame, backupSave,
  restartGame: desktopLifecycle.restartGame, closeShellResources: desktopLifecycle.closeShellResources,
  recoverAction: desktopLifecycle.recoverAction,
  isHostClosed: () => desktopLifecycle.hostClosed,
  isCapture: () => Boolean(process.env.PIGGY_CAPTURE),
  log,
})
// 设置 → 日志 → 导出：弹系统「另存为」，把日志写到用户选的位置。
const exportWrites = new Set()
registerSystemActionsIpc({
  ipcMain, app, dialog, shell, fromPage,
  getWin: () => getPetWindow(),
  isQuitting: () => desktopLifecycle.quitting,
  exportWrites,
  log,
})
const ownerArchiveManager = createOwnerArchiveManager({
  archiveRoot: ownerArchiveSelectionStore.archiveRoot,
  downloadsDir: app.getPath('downloads'),
  dialog,
  getWin: () => getPanelWindow(),
  getHost: () => desktopRuntime.getHost(),
  getGameDir: () => activeGameDirectory,
  getOwnerConfig: () => ownerDocumentConfig,
  isSupported: () => ownerArchiveRuntimeSupported,
  selectionStore: ownerArchiveSelectionStore,
  lifecycle: desktopLifecycle,
  async writeFile(path, bytes) {
    const writing = writeFile(path, bytes)
    exportWrites.add(writing)
    try { await writing } finally { exportWrites.delete(writing) }
  },
  isQuitting: () => desktopLifecycle.quitting,
  log,
})
registerOwnerArchiveIpc({ ipcMain, fromPanelOnly, manager: ownerArchiveManager })
const ownerPigManager = createOwnerPigManager({
  getHost: () => desktopRuntime.getHost(),
  getOwnerConfig: () => ownerDocumentConfig,
  isSupported: () => ownerPigRuntimeSupported,
  selectionStore: ownerArchiveSelectionStore,
  lifecycle: desktopLifecycle,
  isQuitting: () => desktopLifecycle.quitting,
  log,
})
registerOwnerPigsIpc({ ipcMain, fromPanelOnly, manager: ownerPigManager })
const ownerCloudManager = createOwnerCloudManager({
  getHost: () => desktopRuntime.getHost(),
  getOwnerConfig: () => ownerDocumentConfig,
  settings: cloudSaveSettings,
  readyStore: ownerCloudReadyStore,
  archiveManager: ownerArchiveManager,
  isSupported: () => ownerCloudRuntimeSupported,
  isQuitting: () => desktopLifecycle.quitting,
})
const ownerNetworkManager = createOwnerNetworkManager({
  getHost: () => desktopRuntime.getHost(),
  getOwnerConfig: () => ownerDocumentConfig,
  isSupported: () => ownerLanRuntimeSupported,
  selectionStore: ownerArchiveSelectionStore,
  isQuitting: () => desktopLifecycle.quitting,
  log,
})
registerOwnerNetworkIpc({ ipcMain, fromPanelOnly, manager: ownerNetworkManager })

// ---- 全屏时隐藏 / 照常显示，以及置顶守护（外壳 0.6.5，见 lib/fullscreen.js） ----
/** @type {ReturnType<typeof createFullscreenWatch> | null} */
let fullscreenWatch = null
/** 是不是因为全屏才把猪藏起来的（托盘「藏起来」不算，全屏结束时不去动它）。 */
let hiddenForFullscreen = false
/** 全屏隐藏时具体藏了哪些窗口；恢复时只把当时可见的放回来。 */
const hiddenPetsForFullscreen = new Set()
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
  if (desktopLifecycle.quitting) return
  if (extensionLayer.isFocused()) { extensionLayer.sync(); return }
  reassertingUntil = Date.now() + 1000
  for (const target of [getPanelWindow(), ...pets.all().map(pet => pet.window)]) {
    if (target === null || target === undefined || target.isDestroyed() || !target.isVisible()) continue
    target.setAlwaysOnTop(false)
    target.setAlwaysOnTop(true, 'floating')
  }
  const primary = getPetWindow()
  if (primary !== null && !primary.isDestroyed() && primary.isVisible()) primary.moveTop()
  log('top reasserted', why)
}

/** macOS：「照常显示」时让猪跟进全屏程序的桌面空间；「隐藏」就留在原来的空间（系统默认）。 */
function applyMacSpaces() {
  if (process.platform !== 'darwin' || fullscreenWatch === null) return
  const show = fullscreenWatch.mode() === 'show'
  for (const target of [getPanelWindow(), ...pets.all().map(pet => pet.window)]) {
    if (target === null || target === undefined || target.isDestroyed()) continue
    target.setVisibleOnAllWorkspaces(show, { visibleOnFullScreen: show })
  }
}

/**
 * @param {{fullscreen:boolean, samePigScreen:boolean} | null} probe
 * 第一版只按主猪所在屏幕判断；一旦要藏，就把所有可见猪窗口一起藏，恢复时也只恢复当时可见的。
 */
function onFullscreenProbe(probe) {
  if (desktopLifecycle.quitting || getPetWindow() === null || getPetWindow().isDestroyed() || fullscreenWatch === null) return
  const covering = probe !== null && probe.fullscreen === true && probe.samePigScreen === true
  const ended = pigScreenFullscreen && !covering
  pigScreenFullscreen = covering
  if (shouldHide(fullscreenWatch.mode(), probe)) {
    if (!hiddenForFullscreen && pets.all().some(pet => pet.window?.isVisible() === true) && !pets.all().some(pet => pet.dragSession !== null)) {
      hiddenForFullscreen = true
      hiddenPetsForFullscreen.clear()
      closePanel('fullscreen')
      for (const pet of pets.all()) {
        const window = pet.window
        if (window === null || window.isDestroyed() || !window.isVisible()) continue
        hiddenPetsForFullscreen.add(pet)
        window.hide()
      }
      log('fullscreen: pig hidden', JSON.stringify({ pigs: [...hiddenPetsForFullscreen].map(pet => pet.pigId) }))
    }
    return
  }
  if (hiddenForFullscreen) {
    hiddenForFullscreen = false
    for (const pet of hiddenPetsForFullscreen) {
      if (pet.window !== null && !pet.window.isDestroyed()) pet.window.showInactive()
    }
    hiddenPetsForFullscreen.clear()
    log('fullscreen: pig back')
    reassertTop('fullscreen-ended')
    return
  }
  if (ended) reassertTop('fullscreen-ended')
  // 「照常显示」：全屏程序自己也是置顶窗口，每秒把猪抬回它上面一次。
  else if (covering && getPetWindow().isVisible()) raisePetAbovePanel()
}

async function startFullscreenWatch() {
  fullscreenWatch = createFullscreenWatch({
    path: join(app.getPath('userData'), 'fullscreen.json'), platform: process.platform, selfPid: process.pid, log,
    pigHwnd: () => {
      try {
        const handle = getPetWindow().getNativeWindowHandle()
        return String(handle.length >= 8 ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0))
      } catch { return '0' }
    },
    pigDisplayBounds: () => {
      if (getPetWindow() === null || getPetWindow().isDestroyed()) return null
      const display = screen.getDisplayMatching(getPetWindow().getBounds())
      const scale = display.scaleFactor || 1
      return { x: display.bounds.x * scale, y: display.bounds.y * scale, width: display.bounds.width * scale, height: display.bounds.height * scale }
    },
    onProbe: onFullscreenProbe,
  })
  await fullscreenWatch.init()
  if (desktopLifecycle.quitting) return
  log('fullscreen probe starting', JSON.stringify({ platform: process.platform, mode: fullscreenWatch.mode() }))
  fullscreenWatch.start()
  applyMacSpaces()
  // 置顶守护：系统把置顶清掉时马上抢回来；有的情况下没有事件，再每 3 秒核对一次。
  getPetWindow().on('always-on-top-changed', (event, on) => {
    if (!on && !desktopLifecycle.quitting && Date.now() > reassertingUntil) setTimeout(() => reassertTop('lost'), 200)
  })
  topGuardTimer = setInterval(() => {
    if (getPetWindow() === null || getPetWindow().isDestroyed() || !getPetWindow().isVisible()) return
    if (!getPetWindow().isAlwaysOnTop() || (getPanelWindow() !== null && !getPanelWindow().isDestroyed() && getPanelWindow().isVisible() && !getPanelWindow().isAlwaysOnTop())) reassertTop('check')
  }, 3000)
  topGuardTimer.unref?.()
}

registerFullscreenIpc({
  ipcMain, fromPage,
  getFullscreenWatch: () => fullscreenWatch,
  applyMacSpaces,
})

let proxySettings = null
registerProxyIpc({
  ipcMain, fromPage,
  getProxySettings: () => proxySettings,
})
registerCloudSaveIpc({ ipcMain, fromPage, fromPanelOnly, getHost: () => desktopRuntime.getHost(), settings: cloudSaveSettings, ownerCloud: ownerCloudManager })

app.whenReady().then(async () => {
  if (needsX11 || !gotLock || desktopLifecycle.quitting) return
  migrateDesktopData(dataPaths)
  if (taskOwnerDocumentConfig === null) {
    const selected = ownerArchiveSelectionStore.read()
    ownerArchiveSwitchPending = selected.pending !== null
    applyStoredOwnerSelection(selected.pending?.next ?? selected.active)
  }
  proxySettings = createProxy({ path: join(app.getPath('userData'), 'proxy.json'),
    sessions: [session.defaultSession, session.fromPartition('electron-updater', { cache: false })] })
  await proxySettings.init()
  if (desktopLifecycle.quitting) return
  log('start', app.getVersion(), process.platform, process.env.XDG_SESSION_TYPE ?? '')
  shellUpdates = createShellUpdates({
    mode: shellUpdateMode({ platform: process.platform, packaged: app.isPackaged,
      portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE), appImage: process.env.APPIMAGE }),
    currentVersion: app.getVersion(), updater: autoUpdater,
    onProgress: fraction => toPages('piggy:shell-progress', fraction),
  })
  await desktopRuntime.startVersions({
    userData: app.getPath('userData'), bundledDir: bundledGameDir(), shellVersion: app.getVersion(),
    statePath: statePath(), releasesUrl: process.env.PIGGY_RELEASES_URL || undefined, log,
    // Chromium's network stack: follows the system proxy, which plain fetch does not.
    fetch: /** @type {any} */ (net.fetch.bind(net)),
  })
  if (desktopLifecycle.quitting) { await desktopRuntime.getVersions().close(); return }
  const startupCheck = await desktopRuntime.getVersions().beginStartupCheck()
  if (startupCheck.status === 'attempting') {
    startupUpdateToken = startupCheck.token
    log('game update startup check began', JSON.stringify({ version: startupCheck.version }))
  } else if (startupCheck.status === 'recovered') {
    log('interrupted game update startup recovered', JSON.stringify({ version: startupCheck.version }))
  } else if (startupCheck.status === 'recovery-unavailable') {
    log('interrupted game update recovery unavailable', startupCheck.reason)
  }
  // Gitee 的 Windows 安装包不带游戏：第一次先下载（first-run.js）。
  let firstRun = null
  if (await desktopRuntime.getVersions().needsGame()) {
    firstRun = await downloadFirstGame({ versions: desktopRuntime.getVersions(), pinPath: gamePinPath(app, HERE), here: HERE, releasesPage: RELEASES_PAGE, log })
    if (firstRun === null) { app.quit(); return }
  }
  const gameDir = await desktopRuntime.getVersions().activeDir()
  if (desktopLifecycle.quitting) return
  activeGameDirectory = gameDir
  ownerArchiveRuntimeSupported = await hasOwnerArchiveRuntime(gameDir)
  ownerPigRuntimeSupported = await hasOwnerPigRuntime(gameDir)
  ownerCloudRuntimeSupported = await hasOwnerCloudRuntime(gameDir)
  ownerLanRuntimeSupported = await hasOwnerLanRuntime(gameDir)
  if (ownerDocumentConfig !== null && !ownerArchiveRuntimeSupported) {
    if (ownerArchiveSwitchPending) {
      ownerArchiveSelectionStore.rollbackPending()
      ownerArchiveSwitchPending = false
      const previous = ownerArchiveSelectionStore.read()
      applyStoredOwnerSelection(previous.active)
      log('owner archive switch refused', 'active game package does not support owner archives; previous selection restored')
      await notifyOwnerArchiveSwitchFailed()
    }
    if (ownerDocumentConfig !== null) {
      throw new Error('当前游戏版本不支持已选择的完整存档；原存档选择已保留，请先恢复兼容的游戏版本')
    }
  }
  const versionsForIdentity = desktopRuntime.getVersions()
  const runtimeIdentity = current => JSON.stringify({
    shell: safeVersion(app.getVersion()),
    electron: safeVersion(process.versions.electron),
    game: safeVersion(current?.version),
    gameBundled: typeof current?.bundled === 'boolean' ? current.bundled : null,
  })
  void Promise.resolve().then(() => versionsForIdentity?.current?.())
    .then(current => log('runtime identity', runtimeIdentity(current)))
    .catch(() => log('runtime identity', runtimeIdentity(null)))
  const hostStatePath = ownerDocumentConfig?.ownerDocumentPath ?? statePath()
  const workEventsDirectory = ownerDocumentConfig
    ? `${ownerDocumentConfig.ownerDocumentPath}.work-events`
    : join(app.getPath('userData'), 'work-endpoint')
  const localCloudSettings = cloudSaveSettings.load()
  const ownerCloudReady = ownerDocumentConfig === null ? null : ownerCloudReadyStore.read()
  const ownerCloudReadyActive = ownerDocumentConfig !== null && localCloudSettings.ok &&
    ownerCloudReadyStore.matches(ownerDocumentConfig.ownerId, localCloudSettings.config)
  const cloudRuntimeConfig = localCloudSettings.ok
    ? { ...localCloudSettings.config, syncReady: ownerCloudReadyActive,
      ...(ownerCloudReadyActive && ownerCloudReady?.ok === true && ownerCloudReady.value !== null
        ? { cloudBaseHead: ownerCloudReady.value.baseHead } : {}) }
    : null
  try {
    await desktopRuntime.startHost(gameDir, hostStatePath, { fetch: net.fetch.bind(net), workEventsDirectory,
      ownerNetworkDirectory,
      cloudSave: ownerDocumentConfig !== null && !ownerCloudRuntimeSupported ? null : cloudRuntimeConfig,
      ...(ownerDocumentConfig === null ? {} : { ownerDocument: runtimeOwnerConfig(ownerDocumentConfig) }),
      optionalExtensionsDirectory: join(app.isPackaged ? process.resourcesPath : HERE, 'optional-extensions'),
      workEventsAutoStart: process.argv.includes('--work-events'),
      onConfirm: plan => confirmMerge(plan),
      onSnapshot: (view, session) => deliverSnapshot(view, session), onStateChanged: announceStateChanged })
  } catch (error) {
    if (ownerArchiveSwitchPending) {
      await restorePreviousOwnerSelectionAndRestart(error)
      return
    }
    throw error
  }
  if (desktopLifecycle.quitting) return
  hostJournal = /** @type {any} */ (desktopRuntime.getHost())?.store?.journal ?? null
  hostJournal?.record?.('info', 'shell', `桌面外壳 ${app.getVersion()} · 游戏包 ${gameDir}`)
  registerProtocol(gameDir)
  await createPetWindows()
  if (desktopLifecycle.quitting) return
  // 隐藏预加载，不调用 show/focus；首次右键不再等待创建窗口和加载客户端。
  ensurePanelWindow()
  if (ownerDocumentConfig === null) {
    externalManager = createExternalManager({
      userData: app.getPath('userData'), host: desktopRuntime.getHost(), appVersion: app.getVersion(), log,
      onConfirm: plan => confirmMerge(plan),
    })
    try { await externalManager.init() } catch (error) { log('external manager init failed', String(error)) }
    if (desktopLifecycle.quitting) return
  }
  log('panel preloaded', JSON.stringify({ visible: getPanelWindow().isVisible(), focused: getPanelWindow().isFocused() }))
  await startFullscreenWatch()
  if (desktopLifecycle.quitting) return
  firstRun?.destroy()
  await tray.create(gameDir)
  if (desktopLifecycle.quitting) return
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
    if (desktopLifecycle.quitting || pets.all().length === 0) return
    if (displayRebuild.changed() || displayRebuild.busy()) return
    const areas = screen.getAllDisplays().map(display => display.workArea)
    for (const pet of pets.all()) {
      const window = pet.window
      if (window === null || window.isDestroyed()) continue
      applyBounds(pet, desktopViewportBounds(window.getBounds(), areas), 'display')
      pushGeometry(pet)
    }
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
    if (pets.all().every(pet => pet.window === null || pet.window.isDestroyed())) return
    const key = JSON.stringify(screen.getAllDisplays().map(display =>
      [display.id, display.workArea.x, display.workArea.y, display.workArea.width, display.workArea.height, display.scaleFactor]))
    if (key === lastDisplayKey) return
    lastDisplayKey = key
    reclamp('reconcile', { displays: screen.getAllDisplays().length })
  }, 10000)
  displayWatchTimer.unref?.()
  for (const pet of pets.all()) pushGeometry(pet)
  if (ownerArchiveSwitchPending) {
    ownerArchiveSelectionStore.commitPending()
    ownerArchiveSwitchPending = false
    const selected = ownerArchiveSelectionStore.read()
    applyStoredOwnerSelection(selected.active)
    log('owner archive selection activated')
  }
  startupSetupComplete = true
  if (getPetWindow() !== null && !getPetWindow().isDestroyed()) startupWindowWasVisible = startupWindowWasVisible || getPetWindow().isVisible()
  confirmUpdateStartupIfReady()
}).catch(handleStartupFailure)

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
    if (step.js) await getPetWindow().webContents.executeJavaScript(step.js).catch(error => console.log('[capture] js failed', String(error)))
    if (step.click) {
      const ok = await getPetWindow().webContents.executeJavaScript(`(() => { const n = document.querySelector('[data-dsh-pig] ${step.click.replace(/'/g, "\\'")}'); if (n) n.click(); return n !== null })()`)
      console.log('[capture] click', step.click, ok)
      await wait(400)
    }
    if (step.shot) {
      await wait(1200)
      const image = await getPetWindow().webContents.capturePage()
      writeFileSync(join(dir, step.shot + '.png'), image.toPNG())
      console.log('[capture]', step.shot, JSON.stringify({ shape: primaryPet()?.lastShape ?? [] }))
    }
  }
  app.quit()
}

// 兜底：主进程里漏网的异常只写日志，不弹「A JavaScript error occurred」那种错误框吓人。
process.on('uncaughtException', error => { log('uncaught', error?.stack ?? String(error)) })

app.on('second-instance', () => {
  // 第二次双击没反应时，日志要能说明「第二次确实进来了」，以及第一扇窗当时的状态。
  // pid 和第二个进程的「second launch rejected」行对得上；host 说明第一次启动走到哪了。
  // 第一版只把主猪叫出来；第二只猪不在这里抢焦点。
  const pet = primaryPet()
  log('second instance', JSON.stringify({ pid: process.pid, host: desktopRuntime.getHost() !== null,
    window: pet?.window !== null && pet?.window !== undefined,
    visible: pet?.window?.isVisible?.() === true, showPending: pet?.showGate?.pending === true, multiPig: multiPigActive }))
  if (pet?.window !== null && pet?.window !== undefined && !pet.window.isDestroyed()) pet.window.showInactive()
})
desktopLifecycle.registerBeforeQuit()
app.on('window-all-closed', () => app.quit())
