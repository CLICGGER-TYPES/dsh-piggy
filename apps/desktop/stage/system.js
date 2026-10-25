// @ts-check
/**
 * 舞台的系统集成：托盘、开机自启、从 DSH 导入、全屏探测、显示器对账。
 * 从 main.js 拆出来，主文件只留窗口/形状/生命周期。
 * @module dsh-piggy-desktop/stage/system
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import electron from 'electron'
import { createFullscreenWatch, shouldHide } from '../lib/fullscreen.js'
import { recoveryPayload } from '../lib/pig-recovery.js'
import { fallbackPigDisplayBounds } from './pig-display.js'

const { Menu, Tray, app, dialog, nativeImage, screen } = electron

export function createAutostart() {
  const file = join(homedir(), '.config', 'autostart', 'dsh-piggy.desktop')
  return {
    on() { return process.platform === 'linux' ? existsSync(file) : app.getLoginItemSettings().openAtLogin },
    set(on) {
      if (process.platform !== 'linux') return app.setLoginItemSettings({ openAtLogin: on })
      if (!on) return rmSync(file, { force: true })
      const exec = process.env.APPIMAGE ?? process.execPath
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, `[Desktop Entry]\nType=Application\nName=dsh-piggy\nExec="${exec}"\nX-GNOME-Autostart-enabled=true\n`)
    },
  }
}

/** @param {{statePath:string, prepareToQuit:() => Promise<any>, relaunch:() => void, isQuitting:() => boolean, log: (...parts:any[]) => void}} options */
export async function importFromDsh(options) {
  const home = process.env.DSH_HOME?.trim() ? resolve(process.env.DSH_HOME.trim()) : join(homedir(), '.dsh')
  let source = null
  for (const folder of ['dsh-piggy', 'dsh-pig']) {
    const file = join(home, folder, 'state.json')
    if (existsSync(file)) { source = file; break }
  }
  if (source === null) {
    await dialog.showMessageBox({ type: 'info', message: '没找到 DSH 里的猪', detail: '默认找 ~/.dsh/dsh-piggy/state.json（或 DSH_HOME 下面）。' })
    return
  }
  const { response } = await dialog.showMessageBox({ type: 'question', buttons: ['导入', '算了'], defaultId: 0, cancelId: 1,
    message: '把 DSH 里的猪接过来？', detail: `从 ${source} 复制一份过来。舞台现在这只会先备份。` })
  if (response !== 0 || options.isQuitting()) return
  await options.prepareToQuit()
  const target = options.statePath
  mkdirSync(dirname(target), { recursive: true })
  if (existsSync(target)) copyFileSync(target, `${target}.before-import-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  copyFileSync(source, target)
  options.relaunch()
  app.exit(0)
}

export function readVersion(gameDir) {
  try { return JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8')).version } catch { return '?' }
}

/**
 * 托盘恢复：先解除交互租约并让舞台重新可见/对账，再把主屏 DIP 工作区发给猪页。
 * 猪页自己把显示尺寸回到 100%，并按共享 v3 家（物理成对契约）重新落位。
 * @param {{getWindow:() => any, screen:any, isQuitting:() => boolean, release:() => void, recompute:() => void, log:(...parts:any[])=>void}} options
 */
export function recoverStage(options) {
  const target = options.getWindow()
  if (options.isQuitting() || target === null || target.isDestroyed()) return false
  const payload = recoveryPayload(options.screen.getPrimaryDisplay())
  if (payload === null) return false
  options.release()
  target.showInactive()
  options.recompute()
  target.webContents.send('stage:recover', payload)
  options.log('recover', JSON.stringify(payload))
  return true
}

/**
 * @param {{getWindow:() => any, gameDir:string, autostart:ReturnType<typeof createAutostart>, importSave:() => void, onRecover:() => void, log:(...parts:any[])=>void, trayIcon:string}} options
 */
export function createTray(options) {
  const icon = nativeImage.createFromPath(options.trayIcon)
  const tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('dsh-piggy stage')
  const win = () => options.getWindow()
  const toggle = () => {
    const target = win()
    if (target === null || target.isDestroyed()) return
    if (target.isVisible()) target.hide()
    else target.showInactive()
  }
  tray.on('click', toggle)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: win()?.isVisible() ? '藏起来' : '叫猪出来', click: toggle },
    { label: '恢复小猪', click: () => { options.onRecover() } },
    { label: '开机自启', type: 'checkbox', checked: options.autostart.on(), click: item => options.autostart.set(item.checked) },
    { label: '从 DSH 导入猪…', click: () => { options.importSave() } },
    { type: 'separator' },
    { label: `游戏版本 ${readVersion(options.gameDir)}`, enabled: false },
    { label: '退出', click: () => app.quit() },
  ]))
  return tray
}

/**
 * 偏好在 lib/fullscreen.js 里是异步读的：必须 await init() 之后再 start，
 * 否则探测用默认的 hide 跑起来，设置里选的「照常显示」每次重启都会丢。
 * @param {{
 *   getWindow:() => any, userData:string, log:(...parts:any[])=>void, onHide:() => void, onShow:() => void,
 *   getPigDisplayBounds?: () => ({x:number,y:number,width:number,height:number}|null),
 *   screen?: any, createWatch?: typeof createFullscreenWatch, isQuitting?: () => boolean,
 * }} options
 * @returns {Promise<ReturnType<typeof createFullscreenWatch>>}
 */
export async function watchFullscreen(options) {
  let hidden = false
  const activeScreen = options.screen ?? screen
  const createWatch = options.createWatch ?? createFullscreenWatch
  const injectedBounds = typeof options.getPigDisplayBounds === 'function' ? options.getPigDisplayBounds : null
  const watch = createWatch({
    path: join(options.userData, 'fullscreen.json'), platform: process.platform, selfPid: process.pid, log: options.log,
    pigHwnd: () => {
      try {
        const handle = options.getWindow()?.getNativeWindowHandle()
        if (!handle) return '0'
        return String(handle.length >= 8 ? handle.readBigUInt64LE(0) : handle.readUInt32LE(0))
      } catch { return '0' }
    },
    pigDisplayBounds: () => {
      const target = options.getWindow()
      if (target === null || target.isDestroyed()) return null
      if (injectedBounds !== null) return injectedBounds()
      return fallbackPigDisplayBounds(target, activeScreen)
    },
    // 只有舞台真的给了物理猪屏 getter 才启用 Windows 物理矩形比较；
    // main.js 的 split 路径没有这个 getter，继续用原来的 HWND 同屏判断。
    ...(injectedBounds === null ? {} : { windowsPigDisplayBounds: () => injectedBounds() }),
    onProbe: probe => {
      const target = options.getWindow()
      if (target === null || target.isDestroyed()) return
      if (shouldHide(watch.mode(), probe)) {
        if (!hidden && target.isVisible()) { hidden = true; options.onHide() }
        return
      }
      if (hidden) { hidden = false; options.onShow() }
    },
  })
  await watch.init()
  // init 是异步的，这期间可能已经开始退出（托盘退出、第二个实例、before-quit）。
  // 调用方这时还没拿到 watch 去 stop，已经退出就不要再拉起探测进程。
  if (typeof options.isQuitting === 'function' && options.isQuitting()) {
    await watch.stop()
    return watch
  }
  watch.start()
  return watch
}

/**
 * 显示器事件 + 10 秒兜底对账；每次都从显示器清单重算，不在上一次 bounds 上加。
 * @param {{getWindow:() => any, displays:() => any[], apply:(bounds:any, why:string) => void, log:(...parts:any[])=>void}} options
 */
export function watchDisplays(options) {
  let lastKey = JSON.stringify(options.displays().map(display => [display.id, display.workArea, display.scaleFactor]))
  const reconcile = why => {
    const target = options.getWindow()
    if (target === null || target.isDestroyed()) return
    const key = JSON.stringify(options.displays().map(display => [display.id, display.workArea, display.scaleFactor]))
    if (key === lastKey) return
    lastKey = key
    options.log('display', why)
    options.apply(null, why)
  }
  const onMetrics = () => reconcile('metrics-changed')
  const onAdded = () => reconcile('added')
  const onRemoved = () => reconcile('removed')
  screen.on('display-metrics-changed', onMetrics)
  screen.on('display-added', onAdded)
  screen.on('display-removed', onRemoved)
  const timer = setInterval(() => reconcile('reconcile'), 10000)
  timer.unref?.()
  return {
    stop() {
      screen.removeListener('display-metrics-changed', onMetrics)
      screen.removeListener('display-added', onAdded)
      screen.removeListener('display-removed', onRemoved)
      clearInterval(timer)
    },
  }
}
