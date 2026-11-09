// @ts-check
/**
 * 朋友猪的独立面板窗口：一个朋友一只窗口，互不替换。
 *
 * 和本地面板一样是透明无框小窗：页面仍是正式面板（role=panel），只注入朋友数据；
 * 窗口贴着朋友猪摆，猪被拖动时跟着走。右键哪只猪就开它自己的那一扇，多只并存。
 */

import { auxiliaryWindowOptions } from './auxiliary-window.js'
import { PANEL_FALLBACK, panelAnchorFor, panelBoundsFor } from './panel-geometry.js'

/** 朋友面板固定外框高度：卡片在框内底部对齐，切页只换卡片，不挪原生窗口。 */
const VIEWPORT_MAX_HEIGHT = 420

/**
 * @param {{
 *   BrowserWindow: any,
 *   screen: any,
 *   preload: string,
 *   url: string,
 *   log?: (...parts:any[])=>void,
 * }} options
 */
export function createFriendPanels(options) {
  const log = options.log ?? (() => {})
  /** @type {Map<string, any>} */
  const windows = new Map()

  function areaFor(bounds) {
    try {
      return options.screen.getDisplayNearestPoint({
        x: Math.round(bounds.x + bounds.width / 2),
        y: Math.round(bounds.y + bounds.height / 2),
      }).workArea
    } catch {
      return options.screen.getPrimaryDisplay().workArea
    }
  }

  function send(win, message) {
    if (win === null || win.isDestroyed()) return
    win.webContents.send('piggy:panel', message)
  }

  function show(entry) {
    const win = entry.window
    if (win === null || win.isDestroyed() || entry.shown) return
    entry.shown = true
    win.showInactive()
    // Wayland/XWayland 下 showInactive 的窗口不进焦点链；用户刚右键过，补一次 focus 才能点。
    if (process.env.WAYLAND_DISPLAY) win.focus?.()
  }

  /** 透明外框里只有卡片可点：卡片外的空白交给桌面（和主面板的固定外框同思路）。 */
  function applyShape(entry) {
    const win = entry.window
    if (win === null || win.isDestroyed() || typeof win.setShape !== 'function' || entry.size === null) return
    const hidden = entry.anchor.vertical === 'above' ? Math.max(0, entry.viewportHeight - Math.ceil(entry.size.height)) : 0
    const width = Math.max(1, Math.min(Math.ceil(entry.size.width), Math.ceil(win.getBounds().width)))
    const height = Math.max(1, Math.min(Math.ceil(entry.size.height), entry.viewportHeight))
    try { win.setShape([{ x: 0, y: hidden, width, height }]) } catch { /* 旧外壳不支持形状 */ }
  }

  /** 固定外框：窗口位置只在打开/换屏时定，切页只改变可点区域，不动窗口位置。 */
  function place(entry) {
    const win = entry.window
    if (win === null || win.isDestroyed()) return
    const bounds = panelBoundsFor(entry.pig, entry.anchor, { width: PANEL_FALLBACK.width, height: entry.viewportHeight })
    win.setBounds(bounds)
    applyShape(entry)
  }

  function findEntry(sender) {
    for (const entry of windows.values()) {
      if (entry.window !== null && !entry.window.isDestroyed() && entry.window.webContents === sender) return entry
    }
    return null
  }

  function open(player, anchor) {
    const existing = windows.get(player.id)
    if (existing !== undefined && existing.window !== null && !existing.window.isDestroyed()) {
      // 和本地猪一样：右键是开关，不是只把面板抬到前面。
      if (existing.window.isVisible()) {
        windows.delete(player.id)
        existing.window.close()
        log('friend panel toggle closed', player.id)
        return null
      }
      existing.player = player
      existing.pig = anchor
      const area = areaFor(anchor)
      if (area.x !== existing.anchor.area.x || area.y !== existing.anchor.area.y
        || area.width !== existing.anchor.area.width || area.height !== existing.anchor.area.height) {
        existing.anchor = panelAnchorFor(existing.pig, area, existing.size?.width ?? PANEL_FALLBACK.width)
      }
      place(existing)
      send(existing.window, { type: 'friend', player, dedicated: true })
      existing.window.show()
      existing.window.focus()
      return existing.window
    }

    const pig = anchor
    const anchorInfo = panelAnchorFor(pig, areaFor(anchor), PANEL_FALLBACK.width)
    const viewportHeight = Math.max(120, Math.min(VIEWPORT_MAX_HEIGHT, anchorInfo.maxHeight))
    /** @type {any} */
    const entry = {
      window: null,
      player,
      pig,
      anchor: anchorInfo,
      viewportHeight,
      size: null,
      shown: false,
      fallbackTimer: null,
    }
    const win = new options.BrowserWindow({
      ...panelBoundsFor(pig, anchorInfo, { width: PANEL_FALLBACK.width, height: viewportHeight }),
      transparent: true,
      frame: false,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: true,
      show: false,
      ...auxiliaryWindowOptions(process.platform),
      backgroundColor: '#00000000',
      webPreferences: {
        preload: options.preload,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
        additionalArguments: ['--piggy-role=panel', '--piggy-friend=' + player.id],
      },
    })
    entry.window = win
    windows.set(player.id, entry)
    win.setAlwaysOnTop(true, 'floating')
    win.setMenuBarVisibility(false)
    win.setTitle('朋友 · ' + player.name)
    win.on('page-title-updated', event => {
      event.preventDefault()
      if (!win.isDestroyed()) win.setTitle('朋友 · ' + player.name)
    })
    win.webContents.on('console-message', (event, level, message) => {
      if (level >= 2) log('friend panel:', message)
    })
    win.webContents.on('did-finish-load', () => {
      send(win, {
        type: 'open',
        vertical: entry.anchor.vertical,
        maxHeight: entry.viewportHeight,
        dedicated: true,
      })
      send(win, { type: 'friend', player: entry.player, dedicated: true })
      show(entry)
      entry.fallbackTimer = setTimeout(() => show(entry), 400)
      entry.fallbackTimer.unref?.()
    })
    win.on('closed', () => {
      if (entry.fallbackTimer) clearTimeout(entry.fallbackTimer)
      if (windows.get(player.id) === entry) windows.delete(player.id)
      log('friend panel closed', player.id)
    })
    win.loadURL(options.url)
    log('friend panel open', player.id, player.name, JSON.stringify(panelBoundsFor(pig, anchorInfo, { width: PANEL_FALLBACK.width, height: viewportHeight })))
    return win
  }

  /** 面板页量好内容后按内容调整这扇窗口；只认这扇窗口自己的页面。 */
  function resize(sender, size) {
    const width = Math.ceil(Number(size?.width) || 0)
    const height = Math.ceil(Number(size?.height) || 0)
    if (width < 1 || height < 1) return
    const entry = findEntry(sender)
    if (entry === null) return
    entry.size = { width, height }
    place(entry)
    if (!entry.shown) show(entry)
  }

  /** 朋友猪被拖动：面板跟着猪走；换屏时重新决定朝哪边开。 */
  function reposition(id, bounds) {
    const entry = windows.get(id)
    if (entry === undefined || entry.window === null || entry.window.isDestroyed()) return
    entry.pig = bounds
    const area = areaFor(bounds)
    if (area.x !== entry.anchor.area.x || area.y !== entry.anchor.area.y
      || area.width !== entry.anchor.area.width || area.height !== entry.anchor.area.height) {
      entry.anchor = panelAnchorFor(entry.pig, area, entry.size?.width ?? PANEL_FALLBACK.width)
    }
    place(entry)
  }

  function sync(players, selfId) {
    const list = Array.isArray(players) ? players.filter(player => player && typeof player.id === 'string' && player.id !== selfId) : []
    const ids = new Set(list.map(player => player.id))
    for (const [id, entry] of windows) {
      if (ids.has(id)) continue
      windows.delete(id)
      if (!entry.window.isDestroyed()) entry.window.close()
    }
    for (const player of list) {
      const entry = windows.get(player.id)
      if (entry === undefined || entry.window === null || entry.window.isDestroyed()) continue
      entry.player = player
      send(entry.window, { type: 'friend', player, dedicated: true })
    }
  }

  function closeSender(sender) {
    const entry = findEntry(sender)
    if (entry === null) return false
    windows.delete(entry.player.id)
    if (!entry.window.isDestroyed()) entry.window.close()
    return true
  }

  function closeAll() {
    for (const entry of windows.values()) {
      if (entry.fallbackTimer) clearTimeout(entry.fallbackTimer)
      if (!entry.window.isDestroyed()) entry.window.close()
    }
    windows.clear()
  }

  function owns(sender) {
    for (const entry of windows.values()) {
      if (entry.window !== null && !entry.window.isDestroyed() && entry.window.webContents === sender) return true
    }
    return false
  }

  function count() { return windows.size }

  return Object.freeze({ open, sync, resize, reposition, closeSender, closeAll, owns, count })
}
