// @ts-check
/**
 * 房间窗口所有权：一次只开一扇，独立页面（不加载游戏包），关闭即离开房间。
 * 窗口是普通的带标题栏窗口，和扩展大窗口一样可缩放、可最小化。
 */

const DEFAULT_WIDTH = 760
const DEFAULT_HEIGHT = 500
const MIN_WIDTH = 520
const MIN_HEIGHT = 360

/**
 * @param {{
 *   BrowserWindow: any,
 *   screen: any,
 *   preload: string,
 *   url: string,
 *   icon?: string,
 *   log?: (...parts:any[])=>void,
 *   onClose?: ()=>void,
 * }} options
 */
export function createRoomWindow(options) {
  const log = options.log ?? (() => {})
  /** @type {any} */
  let current = null
  let closing = false

  function owns(sender) {
    return current !== null && !current.isDestroyed() && sender === current.webContents
  }

  function send(channel, payload) {
    if (current === null || current.isDestroyed()) return false
    current.webContents.send(channel, payload)
    return true
  }

  function close() {
    if (current === null || current.isDestroyed()) return
    closing = true
    current.close()
  }

  function open() {
    if (current !== null && !current.isDestroyed()) {
      if (current.isMinimized()) current.restore()
      current.show()
      current.focus()
      return current
    }
    const area = options.screen.getDisplayNearestPoint(options.screen.getCursorScreenPoint()).workArea
    const width = Math.max(MIN_WIDTH, Math.min(DEFAULT_WIDTH, area.width - 80))
    const height = Math.max(MIN_HEIGHT, Math.min(DEFAULT_HEIGHT, area.height - 80))
    const created = new options.BrowserWindow({
      width, height, useContentSize: true, minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT,
      center: true, show: false, title: '联机 · 猪猪房间', backgroundColor: '#f7f3df',
      autoHideMenuBar: true, resizable: true, minimizable: true, maximizable: true, fullscreenable: false,
      icon: options.icon,
      webPreferences: {
        preload: options.preload,
        contextIsolation: true,
        sandbox: true,
        additionalArguments: ['--piggy-role=room'],
      },
    })
    current = created
    closing = false
    created.setMenuBarVisibility(false)
    void created.loadURL(options.url)
    created.once('ready-to-show', () => {
      if (current !== created) return
      created.show()
      created.focus()
    })
    created.on('page-title-updated', event => event.preventDefault())
    created.on('closed', () => {
      if (current !== created) return
      current = null
      const userClosed = !closing
      closing = false
      if (userClosed) options.onClose?.()
    })
    created.webContents.on('console-message', (event, level, message) => {
      if (level >= 2) log('room:', message)
    })
    log('room window', width + 'x' + height)
    return created
  }

  return Object.freeze({ open, close, send, owns, current: () => current })
}
