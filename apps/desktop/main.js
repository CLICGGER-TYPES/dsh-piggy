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
import { auxiliaryWindowOptions } from './lib/auxiliary-window.js'
import { spawn } from 'node:child_process'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BrowserWindow, Menu, Tray, app, dialog, ipcMain, nativeImage, net, protocol, screen, session, shell } from 'electron'
import updaterPackage from 'electron-updater'

import { startBackgroundHost } from './lib/background-host.js'
import { createDesktopRuntime } from './lib/desktop-runtime.js'
import { registerGameProtocol } from './lib/game-protocol.js'
import { configureDesktopData, bundledDesktopGame } from './lib/data-paths.js'
import { migrateDesktopData } from './lib/data-migration.js'
import { readOwnerDocumentConfig } from './lib/owner-document-config.js'
import { MIN_WINDOW, WINDOW_PADDING, contentBoundsForPig, dragPigBounds, desktopViewportBounds, moveAcrossDisplays, resizedPigScreenPoint } from './lib/window-geometry.js'
import { createProxy } from './lib/proxy.js'
import { RELEASES_PAGE } from './lib/versions.js'
import { startBackgroundVersions } from './lib/background-versions.js'
import { createShellUpdates, shellUpdateMode } from './lib/shell-update.js'
import { dragHeartbeatExpired } from './lib/drag-watchdog.js'
import { validDragOrigin } from './lib/drag-origin.js'
import { PANEL_FALLBACK } from './lib/panel-geometry.js'
import { pointerHitsShape } from './lib/pointer-hit.js'
import { createExtensionLayer } from './lib/extension-layer.js'
import { createExtensionWindow } from './lib/extension-window.js'
import { createPanelWindow } from './lib/panel-window.js'
import { createPanelController } from './lib/panel-controller.js'
import { createFullscreenController } from './lib/fullscreen-controller.js'
import { createDesktopServices } from './lib/desktop-services.js'
import { createDisplayWatch } from './lib/display-watch.js'
import { createMergeConfirm } from './lib/merge-confirm.js'
import { createPetRoster } from './lib/pet-roster.js'
import { createCaptureCheck } from './lib/capture-check.js'
import { createShellLaunch } from './lib/shell-launch.js'
import { hasOwnerArchiveRuntime, hasOwnerPigRuntime, hasOwnerCloudRuntime, hasOwnerLanRuntime, runtimeOwnerConfig, notifyOwnerArchiveSwitchFailed } from './lib/owner-runtime.js'
import { MAX_PIG_WINDOWS, createPetRegistry, createPetState } from './lib/pet-instance.js'
import { createExternalManager } from './lib/external.js'
import { downloadFirstGame, gamePinPath } from './first-run.js'
import { reportStartupFailure } from './lib/startup-failure.js'
import { createWindowManager } from './lib/window-manager.js'
import { createWindowSurface } from './lib/window-surface.js'
import { appendJournalSync, journalLine } from './lib/startup-journal.js'
import { createWindowState } from './lib/window-state.js'
import { createDesktopLifecycle } from './lib/desktop-lifecycle.js'
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
import { registerPanelIpc } from './lib/ipc/panel.js'
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

const { relaunch, ensureX11 } = createShellLaunch({
  app, spawnProcess: spawn, platform: process.platform, env: process.env, argv: process.argv, execPath: process.execPath,
})
const needsX11 = ensureX11()

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

function applyStoredOwnerSelection(selection) {
  ownerDocumentConfig = selection === null ? null : { ...selection, source: 'selection' }
}

async function restorePreviousOwnerSelectionAndRestart(cause) {
  if (!ownerArchiveSwitchPending) return false
  ownerArchiveSelectionStore.rollbackPending()
  ownerArchiveSwitchPending = false
  log('owner archive startup rolled back', cause instanceof Error ? cause.name : 'startup failed')
  await desktopLifecycle.requireSavedGame()
  await desktopLifecycle.closeShellResources()
  await notifyOwnerArchiveSwitchFailed(dialog)
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
/** 面板状态机；在 panelWindow / extensionLayer 之后装配。 */
let panel = null
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
  // 面板页面按 ?pig= 路由到对应 worker session；换猪时重建面板窗口。
  url: () => panel.url(),
  frameCap: FRAME_CAP,
  devTools: process.env.PIGGY_DEVTOOLS === '1',
  log,
  onCreated: () => panel?.viewCreated(),
  onReady: () => panel?.handleReady(),
  onRendererGone: () => panel?.close('crash'),
  onBlur: () => panel?.focusLeft(),
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
  isPanelOpen: () => panel?.isOpen() === true,
  fromPage: event => fromPage(event),
  fromExt: event => fromExt(event),
  log,
})
const extensionLayer = createExtensionLayer({ extension: () => extensionWindow.current(), overlays: () => [getPanelWindow(), ...pets.all().map(pet => pet.window)] })
panel = createPanelController({
  panelWindow, getPanelWindow, screen, BrowserWindow, platform: process.platform,
  pets, primaryPet, getPetWindow, extensionWindow, extensionLayer, ipcMain,
  petForEvent, fromPage, toPages, log, traceSetIgnoreMouseEvents,
})
/** 主进程关闭/退出状态统一由 lifecycle 持有；资源句柄在实际关闭时动态读取。 */
const desktopLifecycle = createDesktopLifecycle({
  app, dialog, log, stopDrag: () => stopDrag(), relaunch,
  isCapture: () => Boolean(process.env.PIGGY_CAPTURE),
  clearInterval, clearTimeout,
  getResources: () => ({ ...desktopRuntime.getShutdownResources(), shellUpdates, proxySettings, fullscreenWatch: fullscreen.watch(),
    externalManager, autostart, exportWrites, topGuardTimer: fullscreen.topGuardTimer(), displayWatchTimer, hitTimer: primaryPet()?.hitTimer ?? null,
    hitTimers: pets.all().map(pet => pet.hitTimer), stateTimer: panel.pendingStateTimer(), flushWindowState, flushLogs }),
  setExternalManager: manager => { externalManager = manager },
  setHitTimer: timer => { const pet = primaryPet(); if (pet !== null) pet.hitTimer = timer },
})
/** 全屏隐藏与置顶守护；状态在 lib/fullscreen-controller.js。 */
const fullscreen = createFullscreenController({
  app, screen, pets, primaryPet, getPetWindow, getPanelWindow, extensionLayer, panel,
  isQuitting: () => desktopLifecycle.quitting, platform: process.platform, pid: process.pid, log,
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
const { confirmMerge } = createMergeConfirm({ dialog, getPetWindow, log })

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
    onStateChanged: panel.announceStateChanged,
    sessions: pigSessions,
  })
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

/** 窗口几何与输入面；实现见 lib/window-surface.js。 */
const surface = createWindowSurface({
  screen, platform: process.platform, env: process.env, panel,
  scheduleWindowStateSave, log, startupInputTrace, traceSetIgnoreMouseEvents,
})
/** 猪窗口的生命周期；实现见 lib/window-manager.js。 */
const windows = createWindowManager({
  BrowserWindow, screen, pets, primaryPet, panel, panelWindow, getPanelWindow,
  desktopLifecycle, desktopRuntime, pigSessions, platform: process.platform, env: process.env,
  preloadPath: join(HERE, 'preload.cjs'), frameCap: FRAME_CAP, log, startupInputTrace,
  readWindowState, surface,
  stopDrag: pet => stopDrag(pet),
  confirmUpdateStartupIfReady,
  onRendererLoaded: () => { startupRendererLoaded = true },
  onPrimaryWindowShown: window => { startupWindowWasVisible = window.isVisible(); confirmUpdateStartupIfReady() },
  handleStartupFailure: error => handleStartupFailure(error),
  getCaptureCheck: () => captureForCheck,
})
const { createWindow, createPigWindow, closePetSession, rebuildLinuxViews, showPigWindow } = windows
const {
  applyBounds, applyFlightBounds, applyShape, refreshHit, setHit, setLegacyHit,
  setPassthroughMode, isMouseRect, isMouseShape, isPlaceRequest, shiftedShape,
  workAreaFor, pushGeometry, geometryOf, currentSeq, skipNativeShape: SKIP_NATIVE_SHAPE,
} = surface

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
    event.returnValue = { window: current, workArea: workAreaFor(current), seq: currentSeq() }
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
    panel.followPig(pet)
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
  panel.reanchorPanel(pet)
  // 页面紧接着要读几何重定家：把最后一帧 slide 一起同步返回，避免 send/sendSync 乱序。
  event.returnValue = geometryOf(pet.window?.getBounds() ?? { x: 0, y: 0, width: 0, height: 0 }, pet)
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
    event.returnValue = geometryOf(window.getBounds(), pet)
    return
  }
  // 动画可单独更新真实输入；不能因此结束尚未提交新画面的整窗绘制保护。
  if (request.bounds === undefined && request.shape === undefined && request.pig === undefined) {
    const slide = pet.flightShapeActive ? pet.flightSlide : pet.dragShapeActive ? pet.lastDragSlide : { x: 0, y: 0 }
    pet.placedHitShape = request.hitShape.slice(0, 64).map(rect => ({
      x: rect.x - slide.x, y: rect.y - slide.y, width: rect.width, height: rect.height,
    }))
    refreshHit(pet)
    event.returnValue = geometryOf(window.getBounds(), pet)
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
    if (speechChanged) panel.reanchorPanel(pet)
    else if (panelPigChanged) panel.followPig(pet)
  }
  event.returnValue = geometryOf(window.getBounds(), pet)
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
  if (pet.primary) panel.reanchorPanel(pet)
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

// 面板窗口：开关、贴猪几何、命中区域、z 序都在 lib/panel-controller.js，IPC 在 lib/ipc/panel.js。
registerPanelIpc({ ipcMain, fromPage, getPanelWindow, extensionWindow, panel })
const captureForCheck = createCaptureCheck({ app, getPetWindow, primaryPet })

/** 启动时的单猪/多猪计划；实现见 lib/pet-roster.js。 */
const petRoster = createPetRoster({
  getOwnerDocumentConfig: () => ownerDocumentConfig,
  isOwnerPigRuntimeSupported: () => ownerPigRuntimeSupported,
  getHost: () => desktopRuntime.getHost(),
  pets, primaryPetState, pigSessions,
  createWindow, createPigWindow, closePetSession, createPetState,
  maxPigWindows: MAX_PIG_WINDOWS,
  isQuitting: () => desktopLifecycle.quitting,
  isMultiPigActive: () => multiPigActive,
  setMultiPigActive: value => { multiPigActive = value },
  log,
})


/** 导入/备份/恢复与托盘；实现见 lib/desktop-services.js。 */
const services = createDesktopServices({
  app, dialog, Tray, Menu, nativeImage,
  iconPath: join(HERE, 'build', 'tray.png'),
  log, statePath, desktopLifecycle, getPetWindow, primaryPet, pets, screen,
  stopDrag, applyBounds, panel,
})
const { tray, autostart, recoverPig, backupSave } = services

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

registerFullscreenIpc({
  ipcMain, fromPage,
  getFullscreenWatch: () => fullscreen.watch(),
  applyMacSpaces: fullscreen.applyMacSpaces,
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
      await notifyOwnerArchiveSwitchFailed(dialog)
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
      onSnapshot: (view, session) => deliverSnapshot(view, session), onStateChanged: panel.announceStateChanged })
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
  await petRoster.createPetWindows()
  if (desktopLifecycle.quitting) return
  // 隐藏预加载，不调用 show/focus；首次右键不再等待创建窗口和加载客户端。
  panel.ensure()
  if (ownerDocumentConfig === null) {
    externalManager = createExternalManager({
      userData: app.getPath('userData'), host: desktopRuntime.getHost(), appVersion: app.getVersion(), log,
      onConfirm: plan => confirmMerge(plan),
    })
    try { await externalManager.init() } catch (error) { log('external manager init failed', String(error)) }
    if (desktopLifecycle.quitting) return
  }
  log('panel preloaded', JSON.stringify({ visible: getPanelWindow().isVisible(), focused: getPanelWindow().isFocused() }))
  await fullscreen.start()
  if (desktopLifecycle.quitting) return
  firstRun?.destroy()
  await services.tray.create(gameDir)
  if (desktopLifecycle.quitting) return
  // 用户机器上到底是什么显示器、什么缩放：以前日志里没有，Windows 的问题只能靠猜。
  log('displays', JSON.stringify(screen.getAllDisplays().map(display => ({ id: display.id, label: display.label,
    bounds: display.bounds, workArea: display.workArea, scale: display.scaleFactor, internal: display.internal }))))
  // The window follows its screen's work area when it changes (taskbar moved, resolution changed).
  // 显式告诉游戏包「显示器变了」：applyBounds 有 2px 死区，窗口不需要挪的时候它不会推几何，
  // 页面手里的 workAreas 就会一直用旧的那份（分辨率变了但窗口刚好没动 → 用的是旧工作区）。
  const displayWatch = createDisplayWatch({
    screen, pets, isQuitting: () => desktopLifecycle.quitting, rebuildLinuxViews,
    applyBounds, pushGeometry, log, platform: process.platform,
  })
  displayWatchTimer = displayWatch.start()
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
