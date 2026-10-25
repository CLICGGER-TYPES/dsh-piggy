// @ts-check
/** 整屏透明舞台入口：一个置顶窗口覆盖所有工作区，里面跑游戏包单页。 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BrowserWindow, app, dialog, ipcMain, net, protocol, screen, session } from 'electron'
import updaterPackage from 'electron-updater'

import { startBackgroundHost } from '../lib/background-host.js'
import { extensionWindowGeometry } from '../lib/extension-window-geometry.js'
import { centerExtensionWindow, extensionWindowPlacement } from './extension-placement.js'
import { createProxy } from '../lib/proxy.js'
import { createShellUpdates, shellUpdateMode } from '../lib/shell-update.js'
import { RELEASES_PAGE, createVersions } from '../lib/versions.js'
import { downloadFirstGame, gamePinPath } from '../first-run.js'
import { saveArchive } from '../lib/save-export.js'
import { appendJournal, journalLine } from '../lib/startup-journal.js'
import { createCleanup } from './lifecycle.js'
import { createInteractionLease } from './lease.js'
import { createPresenter } from './present.js'
import { registerStageIpc } from './ipc.js'
import { applyPhysicalStageBounds, stageGeometryFor, stageWindowBounds } from './window-bounds.js'
import { createAutostart, createTray, importFromDsh, recoverStage, watchDisplays, watchFullscreen } from './system.js'
import { createStageStartup } from './startup-lifecycle.js'
import { createStageUiScale } from './ui-scale.js'
import { enableIsolatedZoom, stageWindowOptions } from './stage-window-options.js'

const { autoUpdater } = updaterPackage
const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(HERE, '..')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' }

protocol.registerSchemesAsPrivileged([
  { scheme: 'piggy', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const X11_FLAG = '--ozone-platform=x11'
const needsX11 = process.platform === 'linux' && Boolean(process.env.WAYLAND_DISPLAY)
  && process.env.PIGGY_WAYLAND !== '1' && !process.argv.includes(X11_FLAG)
if (needsX11) {
  const { spawn } = await import('node:child_process')
  spawn(process.env.APPIMAGE ?? process.execPath, [...process.argv.slice(1), X11_FLAG], { detached: true, stdio: 'ignore' }).unref()
  app.exit(0)
}
if (process.env.PIGGY_USERDATA) app.setPath('userData', resolve(process.env.PIGGY_USERDATA))

const statePath = () => join(app.getPath('userData'), 'dsh-piggy', 'state.json')
const logPath = () => join(app.getPath('userData'), 'stage.log')
function log(...parts) {
  const line = journalLine(parts)
  if (process.env.PIGGY_CAPTURE) process.stdout.write(line)
  try { hostJournal?.record?.('info', 'stage', parts.join(' ')) } catch { /* logging must not break the stage */ }
  return appendJournal(logPath(), line)
}

const startup = createStageStartup({ app, dialog, log, logPath, platform: process.platform,
  getWindow: () => stageWin, isQuitting: () => quitting, quit: requestQuit })
if (!needsX11 && !startup.acquireSingleInstance()) app.quit()

function bundledGameDir() {
  if (process.env.PIGGY_BUNDLED_GAME) return resolve(process.env.PIGGY_BUNDLED_GAME)
  return app.isPackaged ? join(process.resourcesPath, 'game') : join(APP_ROOT, 'game')
}

function serveFile(root, rel) {
  const file = normalize(join(root, rel))
  const base = normalize(root)
  // 前缀必须带分隔符：同级 stage-x/ 目录不能因为 startsWith('…/stage') 被当成舞台文件（A8）。
  if ((file !== base && !file.startsWith(base + sep)) || !existsSync(file)) return new Response('not found', { status: 404 })
  const type = MIME[extname(file)] ?? 'application/octet-stream'
  const cache = /^(image|font)\//.test(type) ? { 'cache-control': 'max-age=86400' } : {}
  return new Response(readFileSync(file), { headers: { 'content-type': type, ...cache } })
}

function relaunch() {
  app.relaunch(process.env.APPIMAGE ? { execPath: process.env.APPIMAGE, args: process.argv.slice(1) } : { args: process.argv.slice(1) })
}

const cleanup = createCleanup(log)
let host = null
let hostJournal = null
let versions = null
let shellUpdates = null
let proxy = null
let stageWin = null
let extWin = null
let uiScale = null
let extKey = null
let fullscreen = null
let quitting = false
let hostClosing = null
let allowQuit = false
let releases = []
let hitTimer = null
let topGuardTimer = null
let reassertingUntil = 0 // 同 split：自身重设置顶产生的事件不能再次排队。
let geometrySeq = 0
const presenter = createPresenter({
  getWindow: () => stageWin,
  platform: process.platform,
  screen,
  log,
  // 页面报来的交互状态也走租约：true 续期、false 立即释放。
  onInteraction: active => setInteracting(active),
})

const fromStage = event => !quitting && stageWin !== null && !stageWin.isDestroyed() && event.sender === stageWin.webContents
const fromExt = event => !quitting && extWin !== null && !extWin.isDestroyed() && event.sender === extWin.webContents
const fromPage = event => fromStage(event) || fromExt(event)

function toPages(channel, ...args) {
  for (const target of [stageWin, extWin]) {
    if (target !== null && !target.isDestroyed()) target.webContents.send(channel, ...args)
  }
}

function displaysNow() {
  return screen.getAllDisplays().map(display => ({
    id: display.id, label: display.label, bounds: display.bounds, workArea: display.workArea,
    scaleFactor: display.scaleFactor, internal: display.internal,
  }))
}

/** 桌面版旧 window.json 里猪的屏幕左上角：舞台第一次启动时迁移成本机位置偏好（A3）。 */
function legacyPigScreen() {
  try {
    const saved = JSON.parse(readFileSync(join(app.getPath('userData'), 'window.json'), 'utf8'))
    const point = saved?.pig
    if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) return { x: point.x, y: point.y }
  } catch { /* 没有旧窗口文件就是第一次用舞台 */ }
  return null
}

function stageGeometry() {
  if (stageWin === null || stageWin.isDestroyed()) return null
  return stageGeometryFor({ win: stageWin, platform: process.platform, displays: displaysNow(), screen, interacting: presenter.isInteracting(), seq: geometrySeq, legacyPig: legacyPigScreen() })
}

function pushGeometry() {
  const info = stageGeometry()
  if (info !== null && stageWin !== null && !stageWin.isDestroyed()) stageWin.webContents.send('stage:geometry', info)
}

/** 页面/租约都从这里进：true 续期，false 立即释放。 */
function setInteracting(active) {
  interactionLease.request(active === true)
}

function recomputeStageBounds(why) {
  if (stageWin === null || stageWin.isDestroyed()) return
  applyPhysicalStageBounds({
    win: stageWin, platform: process.platform, displays: displaysNow(), screen, why, log,
    onSettled: () => { presenter.applyShape(true); pushGeometry() },
  })
  geometrySeq += 1
  pushGeometry()
}

function extFocused() {
  return extWin !== null && !extWin.isDestroyed() && extWin.isVisible()
    && !extWin.isMinimized() && extWin.isFocused()
}

/** 扩展大窗获得焦点时让出置顶层；失去焦点后恢复，和现有 extension-layer 一致。 */
function syncExtensionLayer() {
  if (stageWin === null || stageWin.isDestroyed()) return
  const shouldTop = !extFocused()
  if (stageWin.isAlwaysOnTop() !== shouldTop) stageWin.setAlwaysOnTop(shouldTop, 'floating')
  if (!shouldTop) extWin?.moveTop()
}

function reassertTop(why) {
  if (stageWin === null || stageWin.isDestroyed() || extFocused()) return
  reassertingUntil = Date.now() + 1000
  stageWin.setAlwaysOnTop(false)
  stageWin.setAlwaysOnTop(true, 'floating')
  if (stageWin.isVisible()) stageWin.moveTop()
  if (extWin !== null && !extWin.isDestroyed()) extWin.moveTop()
  log('top reasserted', why)
}

const interactionLease = createInteractionLease({
  timeout: 3000,
  onChange: (active, reason) => {
    presenter.applyInteracting(active)
    // 租约到期/失焦释放后，页面那份本地状态也要关掉，否则它会继续发心跳。
    if (!active && (reason === 'lease' || reason === 'blur') && stageWin !== null && !stageWin.isDestroyed()) {
      stageWin.webContents.send('stage:interaction-off')
    }
  },
})
function createStageWindow() {
  const bounds = stageWindowBounds({ platform: process.platform, displays: displaysNow(), screen }) ?? screen.getPrimaryDisplay().workArea
  stageWin = new BrowserWindow(stageWindowOptions({ bounds, platform: process.platform, preload: join(HERE, 'preload.cjs') }))
  uiScale?.attach(stageWin)
  // resizable 只在 Windows 为 true（见 stageWindowOptions）；用户拖动缩放由 will-resize 拒绝。
  if (process.platform === 'win32') stageWin.on('will-resize', event => event.preventDefault())
  // 建窗后立刻按物理矩形校验一次：原生 min/max 或 WM_DPICHANGED 把窗口夹小的话，
  // 这里会纠正一次并记日志，不用等显示器事件。非 Windows 不跑这一步。
  if (process.platform === 'win32') recomputeStageBounds('startup')
  stageWin.setAlwaysOnTop(true, 'floating')
  const shaped = process.platform === 'linux' && typeof stageWin.setShape === 'function'
  presenter.setShaped(shaped)
  if (shaped) {
    try { stageWin.setShape([{ x: 0, y: 0, width: 1, height: 1 }]) } catch (error) { log('initial shape failed', String(error)) }
  } else {
    stageWin.setIgnoreMouseEvents(true, process.platform === 'win32' ? { forward: true } : undefined)
  }
  stageWin.loadURL('piggy://app/stage/index.html')
  // 显示只等第一帧；固定 3 秒强推空白整屏窗口会和启动失败诊断冲突（见 startup-lifecycle.js）。
  stageWin.once('ready-to-show', () => { if (!startup.readyToShow()) return; stageWin?.showInactive(); startup.markShown(); log('shown', JSON.stringify(stageWin?.getBounds())) })
  stageWin.webContents.on('did-finish-load', () => { pushGeometry(); log('page loaded') })
  startup.attach(stageWin.webContents)
  stageWin.webContents.on('console-message', (event, level, message) => { if (level >= 2) log('page:', message) })
  stageWin.on('resize', () => setTimeout(() => { presenter.applyShape(true); pushGeometry() }, 60))
  stageWin.on('blur', () => {
    interactionLease.release('blur')
    // 焦点去了别的程序：可按「点外面收起面板」收起；去的是扩展到的大窗口就不收。
    setTimeout(() => {
      if (quitting || stageWin === null || stageWin.isDestroyed() || extFocused()) return
      stageWin.webContents.send('stage:blur')
    }, 60)
  })
  stageWin.on('always-on-top-changed', (event, on) => { if (!on && !quitting && Date.now() > reassertingUntil) setTimeout(() => reassertTop('lost'), 200) })
  stageWin.on('closed', () => { stageWin = null })
  if (!shaped) {
    hitTimer = setInterval(() => presenter.refreshHit(), 16)
    hitTimer.unref?.()
    cleanup.add(() => { if (hitTimer !== null) clearInterval(hitTimer); hitTimer = null })
  }
  cleanup.add(() => { if (stageWin !== null && !stageWin.isDestroyed()) stageWin.destroy(); stageWin = null })
  cleanup.add(() => interactionLease.dispose())
  cleanup.add(() => presenter.dispose())
  cleanup.add(() => uiScale?.dispose())
}

function createExtWindow(key) {
  if (extWin !== null && !extWin.isDestroyed()) {
    if (extKey === key) { if (extWin.isMinimized()) extWin.restore(); extWin.show(); extWin.focus(); return }
    extWin.destroy()
  }
  extKey = key
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const { width, height, minWidth, minHeight } = extensionWindowGeometry(area)
  extWin = new BrowserWindow({
    width, height, useContentSize: true, minWidth, minHeight, ...extensionWindowPlacement(area, { width, height }), show: false,
    title: key === 'farm' ? '菜园 · 大农场' : '扩展', backgroundColor: '#7fae5a', autoHideMenuBar: true,
    icon: join(APP_ROOT, 'build', 'icon.png'),
    webPreferences: { preload: join(HERE, 'preload.cjs'), contextIsolation: true, sandbox: true,
      additionalArguments: ['--piggy-role=ext', '--piggy-ext=' + key] },
  })
  extWin.setMenuBarVisibility(false)
  // 构造参数里的 x/y 是按名义内容尺寸算的；这里用真实外框（标题栏/边框）居中一次。
  centerExtensionWindow(extWin, area)
  enableIsolatedZoom(extWin.webContents)
  extWin.loadURL('piggy://app/stage/index.html')
  for (const event of ['focus', 'blur', 'minimize', 'restore', 'hide', 'show']) extWin.on(/** @type {any} */ (event), () => syncExtensionLayer())
  extWin.once('ready-to-show', () => { extWin?.show(); extWin?.focus(); syncExtensionLayer() })
  extWin.on('page-title-updated', event => event.preventDefault())
  extWin.on('closed', () => { extWin = null; extKey = null; syncExtensionLayer(); if (stageWin !== null && !stageWin.isDestroyed()) stageWin.showInactive() })
  extWin.webContents.on('console-message', (event, level, message) => { if (level >= 2) log('ext:', message) })
  log('ext window', key, width + 'x' + height)
}

function prepareToQuit() {
  if (hostClosing !== null) return hostClosing
  quitting = true
  hostClosing = cleanup.dispose().then(result => { log('cleanup done', JSON.stringify(result)); return result })
    .catch(error => { log('cleanup failed', String(error)); return { ok: false } })
  return hostClosing
}

function requestQuit(reason) {
  log('quit requested', reason)
  void prepareToQuit().finally(() => { allowQuit = true; app.quit() })
}

async function restartGame() {
  if (quitting) return
  quitting = true
  await prepareToQuit()
  if (process.env.PIGGY_CAPTURE) return app.exit(0)
  relaunch()
  app.exit(0)
}

async function installShell(version) {
  if (version === null || shellUpdates === null || quitting) return
  quitting = true
  await prepareToQuit()
  try { shellUpdates.install() } catch (error) { log('shell install failed', String(error)) }
}

app.whenReady().then(async () => {
  if (needsX11) return
  log('start', app.getVersion(), process.platform, process.env.XDG_SESSION_TYPE ?? '')
  proxy = createProxy({ path: join(app.getPath('userData'), 'proxy.json'), sessions: [session.defaultSession, session.fromPartition('electron-updater', { cache: false })] })
  await proxy.init()
  shellUpdates = createShellUpdates({
    mode: shellUpdateMode({ platform: process.platform, packaged: app.isPackaged,
      portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE), appImage: process.env.APPIMAGE }),
    currentVersion: app.getVersion(), updater: autoUpdater,
    onProgress: fraction => toPages('piggy:shell-progress', fraction),
  })
  versions = createVersions({
    userData: app.getPath('userData'), bundledDir: bundledGameDir(), shellVersion: app.getVersion(),
    statePath: statePath(), releasesUrl: process.env.PIGGY_RELEASES_URL || undefined,
    fetch: /** @type {any} */ (net.fetch.bind(net)),
  })
  let firstRun = null
  if (versions.needsGame()) {
    firstRun = await downloadFirstGame({ versions, pinPath: gamePinPath(app, APP_ROOT), here: APP_ROOT, releasesPage: RELEASES_PAGE, log })
    if (firstRun === null) { app.quit(); return }
  }
  const gameDir = versions.activeDir()
  host = await startBackgroundHost(gameDir, statePath(), {
    fetch: net.fetch.bind(net),
    onSnapshot: view => toPages('piggy:state-changed', view),
    onStateChanged: () => toPages('piggy:state-changed'),
  })
  hostJournal = /** @type {any} */ (host)?.store?.journal ?? null
  hostJournal?.record?.('info', 'shell', `舞台外壳 ${app.getVersion()} · 游戏包 ${gameDir}`)
  cleanup.add(async () => {
    const result = await host?.dispose()
    log('host dispose', JSON.stringify(result))
  })

  protocol.handle('piggy', async request => {
    try {
      const url = new URL(request.url)
      const path = decodeURIComponent(url.pathname)
      if (path.startsWith('/dsh-piggy/')) {
        if (quitting) return new Response('game runtime closing', { status: 503 })
        const body = request.method === 'POST' ? Buffer.from(await request.arrayBuffer()) : undefined
        const out = await host.handle(request.method, path + url.search, body)
        if (request.method === 'POST') toPages('piggy:state-changed')
        return new Response(out.body, { status: out.status, headers: out.headers })
      }
      if (path === '/client.js') return serveFile(gameDir, 'client.js')
      if (path === '/stage/index.html' || path === '/stage/') return serveFile(HERE, 'index.html')
      if (path.startsWith('/stage/')) return serveFile(HERE, path.slice('/stage/'.length))
      return new Response('not found', { status: 404 })
    } catch (error) {
      return new Response(`stage error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 })
    }
  })

  registerStageIpc({
    fromPage, fromStage, fromExt, getStageWin: () => stageWin, getVersions: () => versions,
    getShellUpdates: () => shellUpdates, getProxy: () => proxy, getFullscreenWatch: () => fullscreen,
    getReleases: () => releases, setReleases: value => { releases = value },
    applyReport: payload => presenter.applyReport(payload), setInteracting, geometry: stageGeometry,
    saveArchive: payload => saveArchive({ dialog, parentWindow: stageWin ?? undefined, downloadsDir: app.getPath('downloads'), name: payload?.name, bytes: payload?.bytes }),
    openExt: key => createExtWindow(key), closeExt: () => extWin?.close(),
    forwardFx: fx => { if (stageWin !== null && !stageWin.isDestroyed()) stageWin.webContents.send('piggy:pig-fx', fx) },
    quit: () => app.quit(), restartGame: () => { void restartGame() },
    sendProgress: fraction => toPages('piggy:progress', fraction),
    downloadsDir: () => app.getPath('downloads'),
    installShell: version => { void installShell(version) }, log,
  })
  // 必须在 registerStageIpc 之后创建：presenter 的 stage:report 监听先处理旧帧，再落 zoom。
  uiScale = createStageUiScale({
    ipcMain, screen, platform: process.platform, getWindow: () => stageWin, log,
    onChange: () => { geometrySeq += 1; pushGeometry() },
  })

  createStageWindow()
  const autostart = createAutostart()
  fullscreen = watchFullscreen({
    getWindow: () => stageWin, userData: app.getPath('userData'), log, getPigDisplayBounds: () => presenter.getPigDisplayBounds(),
    onHide: () => { startup.markFullscreenHidden(true); stageWin?.hide(); log('fullscreen: stage hidden') },
    onShow: () => { startup.markFullscreenHidden(false); stageWin?.showInactive(); reassertTop('fullscreen-ended') },
  })
  cleanup.add(() => fullscreen.stop())
  const displayWatch = watchDisplays({ getWindow: () => stageWin, displays: displaysNow, apply: (bounds, why) => recomputeStageBounds(why), log })
  cleanup.add(() => displayWatch.stop())
  topGuardTimer = setInterval(() => {
    if (stageWin !== null && !stageWin.isDestroyed() && stageWin.isVisible() && !stageWin.isAlwaysOnTop() && !extFocused()) reassertTop('check')
  }, 3000)
  topGuardTimer.unref?.()
  cleanup.add(() => { if (topGuardTimer !== null) clearInterval(topGuardTimer); topGuardTimer = null })
  firstRun?.destroy()
  const tray = createTray({ getWindow: () => stageWin, gameDir, autostart, trayIcon: join(APP_ROOT, 'build', 'tray.png'), log,
    onRecover: () => recoverStage({ getWindow: () => stageWin, screen, isQuitting: () => quitting, release: () => interactionLease.release('recover'), recompute: () => recomputeStageBounds('recover'), log }),
    importSave: () => { void importFromDsh({ statePath: statePath(), prepareToQuit, relaunch, isQuitting: () => quitting, log }) } })
  cleanup.add(() => tray.destroy())
  pushGeometry()
  log('displays', JSON.stringify(displaysNow().map(display => ({ id: display.id, workArea: display.workArea, scale: display.scaleFactor }))))
}).catch(error => { void startup.startupFailed(error) })

startup.watchSecondInstance()
app.on('before-quit', event => {
  if (allowQuit) return
  event.preventDefault()
  void prepareToQuit().finally(() => { allowQuit = true; app.quit() })
})
app.on('window-all-closed', () => app.quit())
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => requestQuit(signal))
process.on('uncaughtException', error => { log('uncaught', error?.stack ?? String(error)) })
