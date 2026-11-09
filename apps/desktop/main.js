// @ts-check
/**
 * dsh-piggy 桌面版的主进程（外壳）。整体结构和全部 IPC 消息见 docs/guides/desktop-architecture.md。
 *
 * - 两个透明置顶窗口（外壳 0.6.0 起）：猪窗口（固定大小，只装猪和气泡）和面板窗口
 *   （贴在猪旁边，见文件后半「面板窗口」一节和 lib/panel-geometry.js）。同一份游戏包在两边各跑一份，
 *   按 piggyShell.role 各显示一半。
 * - 窗口摆哪、哪里可点由游戏包算（src/client/desktop/），主进程照做（lib/geometry-ipc.js 的 piggy:place）；
 *   拖动由 lib/drag-engine.js 按鼠标位置算（dragTick），因为页面在拖动中拿不到可靠的屏幕坐标。
 * - 几何一律以「请求值」为准，不把 getBounds() 读回来再设回去：Windows 分数缩放下读回值有 1px 误差，
 *   读了再设就会一帧帧累加（2026-10-07 面板越跑越远就是这么来的，见 petAsked）。
 * - 游戏运行时在后台单写者中执行，界面经 piggy:// 访问。
 * - 存档在 userData/state.json，默认数据目录名为 piggy，跟 DSH 里那只各养各的；托盘里可以导入。
 */
import { auxiliaryWindowOptions } from './lib/auxiliary-window.js'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BrowserWindow, Menu, Tray, app, clipboard, dialog, ipcMain, nativeImage, net, protocol, screen, session, shell } from 'electron'
import updaterPackage from 'electron-updater'

import { startBackgroundHost } from './lib/background-host.js'
import { createDesktopRuntime } from './lib/desktop-runtime.js'
import { registerGameProtocol } from './lib/game-protocol.js'
import { configureDesktopData, bundledDesktopGame } from './lib/data-paths.js'
import { migrateDesktopData } from './lib/data-migration.js'
import { readOwnerDocumentConfig } from './lib/owner-document-config.js'
import { createProxy } from './lib/proxy.js'
import { RELEASES_PAGE } from './lib/versions.js'
import { startBackgroundVersions } from './lib/background-versions.js'
import { createShellUpdates, shellUpdateMode } from './lib/shell-update.js'
import { PANEL_FALLBACK } from './lib/panel-geometry.js'
import { createExtensionLayer } from './lib/extension-layer.js'
import { createExtensionWindow } from './lib/extension-window.js'
import { createRoomWindow } from './lib/room-window.js'
import { createVisitorRoster } from './lib/visitor-window.js'
import { createFriendPanels } from './lib/friend-panels.js'
import { createRoomManager } from './lib/room-manager.js'
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
import { createDragEngine, registerDragIpc } from './lib/drag-engine.js'
import { registerGeometryIpc } from './lib/geometry-ipc.js'
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
import { registerRoomIpc } from './lib/ipc/room.js'
import { registerWorkSourcesIpc } from './lib/ipc/work-sources.js'
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
/** 拖动状态机；surface 装配后创建，实现见 lib/drag-engine.js。 */
let dragEngine = null
/** 停掉一只猪的拖动；不传 pet 时停全部（退出/显示器重建）。 */
function stopDrag(pet = null) {
  return dragEngine === null ? undefined : dragEngine.stopDrag(pet)
}

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
/** 联机房间：独立页面 + 内存中继；关闭窗口等同于离开房间。 */
const roomWindow = createRoomWindow({
  BrowserWindow,
  screen,
  preload: join(HERE, 'preload.cjs'),
  url: 'piggy://room/room.html',
  icon: join(HERE, 'build', 'icon.png'),
  log,
  onClose: () => { void roomManager.leave('window-closed') },
})
const visitorRoster = createVisitorRoster({
  BrowserWindow,
  screen,
  preload: join(HERE, 'preload.cjs'),
  url: 'piggy://app/visitor.html',
  icon: join(HERE, 'build', 'icon.png'),
  log,
  // 朋友猪被拖动时，它的面板跟着走。
  onMoved: (id, bounds) => friendPanels.reposition(id, bounds),
})
const friendPanels = createFriendPanels({
  BrowserWindow,
  screen,
  preload: join(HERE, 'preload.cjs'),
  url: 'piggy://app/index.html',
  log,
})

/** 联机照顾：目标侧去重、客人侧待确认（超时退款）。 */
const roomCareSeen = new Set()
const roomCarePending = new Map()

async function localHostAction(action, payload = {}) {
  const host = desktopRuntime.getHost()
  if (host === null || typeof host.handle !== 'function') return { ok: false, reason: '宿主还没准备好' }
  try {
    const pet = primaryPet()
    const token = pet !== null && typeof pet.pigId === 'string' ? pigSessions.get(pet.pigId) : undefined
    const out = await host.handle('POST', '/dsh-piggy/act', Buffer.from(JSON.stringify({ action, ...payload })), token)
    const body = typeof out?.body === 'string' ? JSON.parse(out.body) : out?.body
    return body !== null && typeof body === 'object' ? body : { ok: false, reason: '宿主没有返回结果' }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : '宿主动作失败' }
  }
}

async function localSnapshot() {
  const host = desktopRuntime.getHost()
  if (host === null || typeof host.handle !== 'function') return null
  try {
    const pet = primaryPet()
    const token = pet !== null && typeof pet.pigId === 'string' ? pigSessions.get(pet.pigId) : undefined
    const out = await host.handle('GET', '/dsh-piggy/state', undefined, token)
    const body = typeof out?.body === 'string' ? JSON.parse(out.body) : out?.body
    return body !== null && typeof body === 'object' ? body : null
  } catch {
    return null
  }
}

function notifyCareSender(pending, message) {
  const sender = pending?.sender
  if (sender === null || sender === undefined || sender.isDestroyed?.() === true) return
  try {
    sender.send('piggy:visitor:care-result', { ok: pending.ok === true, message })
    sender.send('piggy:friend:care-result', { ok: pending.ok === true, message })
  } catch { /* 窗口已经关了 */ }
}

async function refundCare(pending, message) {
  if (pending === null) return
  await localHostAction('refundCareItem', { op: pending.action, item: pending.itemKey })
  pending.ok = false
  notifyCareSender(pending, message)
}

async function handleRoomCare(snapshot) {
  const events = Array.isArray(snapshot?.careEvents) ? snapshot.careEvents : []
  for (const event of events) {
    if (event === null || typeof event !== 'object') continue
    if (event.targetId !== snapshot.selfId) continue
    const key = String(event.from) + ':' + String(event.nonce)
    if (roomCareSeen.has(key)) continue
    roomCareSeen.add(key)
    if (roomCareSeen.size > 256) roomCareSeen.delete(roomCareSeen.values().next().value)
    const result = await localHostAction('guestCare', { op: event.op, item: event.itemKey })
    await roomManager.careResult({
      targetId: snapshot.selfId, nonce: event.nonce,
      ok: result.ok === true,
      reason: typeof result.reason === 'string' ? result.reason : '',
      care: result.care ?? null,
    })
  }
}

async function handleRoomCareResults(snapshot) {
  const results = Array.isArray(snapshot?.careResults) ? snapshot.careResults : []
  for (const result of results) {
    if (result === null || typeof result !== 'object') continue
    const pending = roomCarePending.get(result.nonce)
    if (pending === undefined) continue
    if (result.targetId !== pending.targetId) continue
    roomCarePending.delete(result.nonce)
    if (pending.timer) clearTimeout(pending.timer)
    if (result.ok === true) {
      pending.ok = true
      notifyCareSender(pending, '照顾成功')
    } else {
      await refundCare(pending, '对方没有收到，东西已退回')
    }
  }
}
const roomManager = createRoomManager({
  log,
  onUpdate: snapshot => {
    roomWindow.send('piggy:room:update', snapshot)
    visitorRoster.sync(snapshot.players, snapshot.selfId)
    friendPanels.sync(snapshot.players, snapshot.selfId)
    void handleRoomCare(snapshot)
    void handleRoomCareResults(snapshot)
    const panelWin = getPanelWindow()
    if (panelWin !== null && !panelWin.isDestroyed()) panelWin.webContents.send('piggy:room:update', snapshot)
  },
  onClosed: detail => {
    roomWindow.close()
    visitorRoster.closeAll()
    friendPanels.closeAll()
    const panelWin = getPanelWindow()
    if (panelWin !== null && !panelWin.isDestroyed()) panelWin.webContents.send('piggy:room:closed', detail)
  },
})
/** 主进程关闭/退出状态统一由 lifecycle 持有；资源句柄在实际关闭时动态读取。 */
const desktopLifecycle = createDesktopLifecycle({
  app, dialog, log, stopDrag: () => stopDrag(), relaunch,
  isCapture: () => Boolean(process.env.PIGGY_CAPTURE),
  clearInterval, clearTimeout,
  getResources: () => ({ ...desktopRuntime.getShutdownResources(), shellUpdates, proxySettings, fullscreenWatch: fullscreen.watch(),
    externalManager, autostart, exportWrites, topGuardTimer: fullscreen.topGuardTimer(), displayWatchTimer, hitTimer: primaryPet()?.hitTimer ?? null,
    hitTimers: pets.all().map(pet => pet.hitTimer), stateTimer: panel.pendingStateTimer(), flushWindowState, flushLogs,
    roomManager, roomWindow }),
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
dragEngine = createDragEngine({
  screen, pets, petForEvent, panel, log, surface,
  setInterval, clearInterval,
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
const { applyBounds, pushGeometry } = surface

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

// 游戏包几何/输入面 IPC：实现见 lib/geometry-ipc.js；拖动 IPC 见 lib/drag-engine.js。
registerGeometryIpc({
  ipcMain, screen, pets, platform: process.platform, petForEvent, panel, log, showPigWindow, surface,
})
registerDragIpc({ ipcMain, engine: dragEngine })

// 面板窗口：开关、贴猪几何、命中区域、z 序都在 lib/panel-controller.js，IPC 在 lib/ipc/panel.js。
registerPanelIpc({ ipcMain, fromPage, getPanelWindow, extensionWindow, friendPanels, panel })
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
// 设置 → 外部连接 → 最近投递：只给面板窗口，只读来源聚合。
registerWorkSourcesIpc({ ipcMain, fromPanelOnly, getHost: () => desktopRuntime.getHost() })

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

registerRoomIpc({
  ipcMain, fromPanelOnly, manager: roomManager, roomWindow, clipboard,
  fromRoom: event => !desktopLifecycle.quitting && roomWindow.owns(event.sender),
})

ipcMain.handle('piggy:visitor:get', event => visitorRoster.playerForEvent(event))
ipcMain.handle('piggy:visitor:pat', event => {
  const player = visitorRoster.playerForEvent(event)
  if (player === null) return { ok: false, reason: '来源不对' }
  if (roomManager.status().inRoom === true) void roomManager.emote('pat', player.id, 0.5, 0.2, 1)
  return { ok: true }
})
ipcMain.handle('piggy:visitor:view', (event, rect) => {
  const player = visitorRoster.playerForEvent(event)
  if (player === null) return { ok: false, reason: '来源不对' }
  friendPanels.open(player, visitorRoster.pigRectForEvent(event, rect))
  return { ok: true }
})
ipcMain.handle('piggy:visitor:items', async event => {
  if (visitorRoster.playerForEvent(event) === null) return null
  const state = await localSnapshot()
  return state !== null && state.care !== null && typeof state.care === 'object' ? state.care : null
})
async function requestFriendCare(sender, targetId, action, itemKey) {
  if (roomManager.status().inRoom !== true) return { ok: false, reason: '先和朋友联机才能照顾' }
  const op = String(action)
  const item = String(itemKey)
  if (!['feed', 'bathe', 'play', 'medicine'].includes(op)) return { ok: false, reason: '照顾动作不对' }
  const spend = await localHostAction('takeCareItem', { op, item })
  if (spend.ok !== true) return { ok: false, reason: spend.reason === 'empty' ? '背包里没有了' : '这件物品用不了' }
  const nonce = randomUUID()
  const pending = { targetId: String(targetId), itemKey: item, action: op, nonce, sender, timer: null, ok: false }
  pending.timer = setTimeout(() => {
    if (!roomCarePending.has(nonce)) return
    roomCarePending.delete(nonce)
    void refundCare(pending, '对方没有回应，东西已退回')
  }, 8000)
  pending.timer.unref?.()
  roomCarePending.set(nonce, pending)
  const sent = await roomManager.care({ targetId: pending.targetId, itemKey: item, op, nonce })
  if (sent.ok !== true) {
    roomCarePending.delete(nonce)
    if (pending.timer) clearTimeout(pending.timer)
    await refundCare(pending, '照顾没发出去，东西已退回')
    return { ok: false, reason: sent.reason || '照顾没发出去' }
  }
  return { ok: true, message: '已经送过去了' }
}

ipcMain.handle('piggy:visitor:care', async (event, action, itemKey) => {
  const player = visitorRoster.playerForEvent(event)
  if (player === null) return { ok: false, reason: '来源不对' }
  return requestFriendCare(event.sender, player.id, action, itemKey)
})
ipcMain.handle('piggy:friend:care', async (event, targetId, action, itemKey) => {
  if (!fromPanelOnly(event) && !friendPanels.owns(event.sender)) return { ok: false, reason: '来源不对' }
  const status = roomManager.status()
  const target = Array.isArray(status.players) ? status.players.find(player => player.id === targetId) : null
  if (target === null || target === undefined) return { ok: false, reason: '朋友已经不在线了' }
  return requestFriendCare(event.sender, target.id, action, itemKey)
})
ipcMain.on('piggy:visitor:size', (event, rect) => { visitorRoster.setPigRect(event, rect) })
ipcMain.on('piggy:visitor:menu', event => {
  if (visitorRoster.playerForEvent(event) !== null) visitorRoster.closeMenusExcept(event.sender)
})
ipcMain.on('piggy:visitor:expand', (event, open) => {
  if (visitorRoster.playerForEvent(event) !== null) visitorRoster.setExpanded(event.sender, open === true)
})
ipcMain.on('piggy:visitor:drag-start', event => {
  if (visitorRoster.playerForEvent(event) !== null) visitorRoster.startDrag(event.sender)
})
ipcMain.on('piggy:visitor:drag-end', event => {
  if (visitorRoster.playerForEvent(event) !== null) visitorRoster.endDrag(event.sender)
})
ipcMain.on('piggy:visitor:close', event => { visitorRoster.closeForEvent(event) })

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
  if (process.env.PIGGY_VISITOR_DEMO === '1') {
    visitorRoster.demo(Number(process.env.PIGGY_VISITOR_DEMO_COUNT) || 1)
    // 演示实例自己的猪窗口收起来，只留朋友猪；否则会出现未拆的纸盒/重复猪。
    for (const pet of pets.all()) {
      try { if (pet.window !== null && !pet.window.isDestroyed()) pet.window.hide() } catch { /* 窗口还没建好 */ }
    }
  }
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
