// @ts-check
/**
 * 扩展的大窗口（role=ext）的所有权：一次只开一个，负责尺寸、标题、生命周期、两条 IPC 和关闭后的焦点交回。
 * 页面还是同一份游戏包，只显示这个扩展的大界面；存档、动作和另外两扇窗口共用主进程里的同一份。
 */
import { extensionWindowGeometry } from './extension-window-geometry.js'

/** 扩展键对应的窗口标题；新扩展要在大窗口里显示时在这里登记。 */
export const EXT_TITLES = { farm: '菜园 · 大农场' }

/**
 * @param {{
 *   BrowserWindow: any,
 *   screen: any,
 *   ipcMain: any,
 *   icon: string,
 *   preload: string,
 *   url: string,
 *   getLayer: () => { sync: () => void },
 *   getPanel: () => any,
 *   isPanelOpen: () => boolean,
 *   fromPage: (event: any) => boolean,
 *   fromExt: (event: any) => boolean,
 *   log: (...parts: any[]) => any,
 * }} options
 */
export function createExtensionWindow(options) {
  let current = null
  let key = null

  /** 页面的 sender 是不是这扇扩展窗口（窗口销毁后读 webContents 会抛，所以先查）。 */
  function owns(sender) {
    return current !== null && !current.isDestroyed() && sender === current.webContents
  }

  function close() {
    if (current !== null && !current.isDestroyed()) current.close()
  }

  function open(nextKey) {
    if (current !== null && !current.isDestroyed()) {
      if (key === nextKey) {
        if (current.isMinimized()) current.restore()
        current.show()
        current.focus()
        return
      }
      current.destroy()
    }
    key = nextKey
    const area = options.screen.getDisplayNearestPoint(options.screen.getCursorScreenPoint()).workArea
    const { width, height, minWidth, minHeight } = extensionWindowGeometry(area)
    const created = new options.BrowserWindow({
      width, height, useContentSize: true, minWidth, minHeight, center: true, show: false,
      title: EXT_TITLES[nextKey] ?? '扩展', backgroundColor: '#7fae5a', autoHideMenuBar: true,
      icon: options.icon,
      webPreferences: { preload: options.preload, contextIsolation: true, sandbox: true,
        additionalArguments: ['--piggy-role=ext', '--piggy-ext=' + nextKey] },
    })
    current = created
    const sync = () => options.getLayer().sync()
    created.on('focus', sync)
    created.on('blur', sync)
    created.on('minimize', sync)
    created.on('restore', sync)
    created.on('hide', sync)
    created.setMenuBarVisibility(false)
    created.loadURL(options.url)
    // 被新窗口顶替后旧窗口的 ready-to-show 不能再显示别的窗口（旧代码读的是全局 extWin）。
    created.once('ready-to-show', () => { if (current === created) { created.show(); created.focus() } })
    created.on('page-title-updated', event => event.preventDefault())
    created.on('closed', () => {
      if (current === created) { current = null; key = null }
      options.getLayer().sync()
      const panel = options.getPanel()
      if (options.isPanelOpen() && panel && !panel.isDestroyed()) panel.focus()
    })
    created.webContents.on('console-message', (e, level, message) => { if (level >= 2) options.log('ext:', message) })
    options.log('ext window', nextKey, width + 'x' + height)
  }

  options.ipcMain.on('piggy:ext:open', (event, nextKey) => {
    if (!options.fromPage(event) || typeof nextKey !== 'string' || !/^[a-z0-9-]{1,40}$/.test(nextKey)) return
    open(nextKey)
  })
  options.ipcMain.on('piggy:ext:close', event => {
    if (!options.fromExt(event)) return
    close()
  })

  return { open, close, owns, current: () => current, key: () => key }
}
