// @ts-check
/**
 * 桌面上的朋友猪：一只朋友一只透明小窗口。
 *
 * 不加载游戏包，只显示公开资料和照顾状态；窗口位置由本机决定，不跟随朋友的屏幕坐标。
 * 联机会话只负责把玩家列表送进来，窗口生命周期都在这里。
 */

import { auxiliaryWindowOptions } from './auxiliary-window.js'

const WINDOW_WIDTH = 150
const WINDOW_HEIGHT = 160
const WINDOW_EXPANDED_HEIGHT = 160
const WINDOW_GAP = 12
/** 还没收到页面量好的猪框之前：150x160 窗口里猪按钮的默认位置。 */
const DEFAULT_PIG_RECT = Object.freeze({ x: 27, y: 30, width: 96, height: 100 })

/**
 * @param {{
 *   BrowserWindow: any,
 *   screen: any,
 *   preload: string,
 *   url: string,
 *   icon?: string,
 *   log?: (...parts:any[])=>void,
 *   onMoved?: (id: string, bounds: {x:number,y:number,width:number,height:number}) => void,
 * }} options
 */
export function createVisitorRoster(options) {
  const log = options.log ?? (() => {})
  /** @type {Map<string, any>} */
  const entries = new Map()
  /** @type {string[]} */
  let order = []

  function displayArea() {
    try {
      return options.screen.getDisplayNearestPoint(options.screen.getCursorScreenPoint()).workArea
    } catch {
      return options.screen.getPrimaryDisplay().workArea
    }
  }

  function slotBounds(slot) {
    const area = displayArea()
    const usable = Math.max(1, Math.floor((area.width - 48) / (WINDOW_WIDTH + WINDOW_GAP)))
    const col = slot % usable
    const row = Math.floor(slot / usable)
    const x = Math.max(area.x + 12, area.x + area.width - WINDOW_WIDTH - 12 - col * (WINDOW_WIDTH + WINDOW_GAP))
    const y = Math.max(area.y + 12, area.y + area.height - WINDOW_HEIGHT - 12 - row * 46)
    return { x, y, width: WINDOW_WIDTH, height: WINDOW_HEIGHT }
  }

  function send(entry) {
    const win = entry.window
    if (win === null || win.isDestroyed()) return
    win.webContents.send('piggy:visitor:update', entry.player)
  }

  function create(player, slot) {
    const bounds = slotBounds(slot)
    const win = new options.BrowserWindow({
      ...bounds,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
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
      icon: options.icon,
      webPreferences: {
        preload: options.preload,
        contextIsolation: true,
        sandbox: true,
        additionalArguments: ['--piggy-role=visitor', '--piggy-visitor=' + player.id],
      },
    })
    const entry = { window: win, player, slot }
    win.setAlwaysOnTop(true, 'floating')
    win.setMenuBarVisibility(false)
    win.once('ready-to-show', () => {
      if (!win.isDestroyed()) win.showInactive()
    })
    win.webContents.on('did-finish-load', () => send(entry))
    win.on('closed', () => {
      if (entries.get(player.id) === entry) entries.delete(player.id)
      order = order.filter(id => id !== player.id)
      log('visitor window closed', player.id)
    })
    win.loadURL(options.url)
    win.webContents.on('console-message', (event, level, message) => {
      if (level >= 2) log('visitor:', message)
    })
    entries.set(player.id, entry)
    log('visitor window open', player.id, player.name, JSON.stringify(bounds))
    return entry
  }

  function closeEntry(entry) {
    if (entry === undefined) return
    if (entry.dragTimer) clearInterval(entry.dragTimer)
    entry.dragTimer = null
    const win = entry.window
    entries.delete(entry.player.id)
    order = order.filter(id => id !== entry.player.id)
    if (win !== null && !win.isDestroyed()) win.close()
  }

  /**
   * 联机快照 → 桌面窗口。自己的猪不创建访客窗口。
   * @param {any[]} players
   * @param {string|null} selfId
   */
  function sync(players, selfId) {
    const list = Array.isArray(players) ? players.filter(player => player && typeof player.id === 'string' && player.id !== selfId) : []
    const nextIds = new Set(list.map(player => player.id))
    for (const id of [...entries.keys()]) {
      if (!nextIds.has(id)) closeEntry(entries.get(id))
    }
    order = list.map(player => player.id)
    for (let index = 0; index < list.length; index += 1) {
      const player = list[index]
      const entry = entries.get(player.id)
      if (entry === undefined) {
        create(player, index)
        continue
      }
      entry.player = player
      entry.slot = index
      send(entry)
    }
  }

  function demo(count = 1) {
    const now = Date.now()
    sync([
      {
        id: 'demo-mint', name: '薄荷', level: 18, stage: 'middle', label: '中年猪',
        art: 'pigs/skins/skin-mint/idle.png', emoji: '🐖', mood: 'happy', moodLabel: '很开心',
        care: { satiety: 74, cleanliness: 52, happiness: 86 },
      },
      {
        id: 'demo-detective', name: '小侦探', level: 26, stage: 'adult', label: '成年猪',
        art: 'pigs/skins/skin-detective/idle.png', emoji: '🐷', mood: 'calm', moodLabel: '很放松',
        care: { satiety: 38, cleanliness: 81, happiness: 63 },
      },
      {
        id: 'demo-chef', name: '大厨', level: 12, stage: 'middle', label: '中年猪',
        art: 'pigs/skins/career-chef/idle.png', emoji: '🐽', mood: 'hungry', moodLabel: '有点饿',
        care: { satiety: 22, cleanliness: 68, happiness: 44 },
      },
    ].slice(0, Math.max(1, Math.min(3, Number(count) || 1))), '__self__')
    log('visitor demo', String(now))
  }

  function closeAll() {
    for (const entry of [...entries.values()]) closeEntry(entry)
    entries.clear()
    order = []
  }

  function owns(sender) {
    for (const entry of entries.values()) {
      if (entry.window !== null && !entry.window.isDestroyed() && entry.window.webContents === sender) return true
    }
    return false
  }

  function playerForEvent(event) {
    for (const entry of entries.values()) {
      if (entry.window !== null && !entry.window.isDestroyed() && entry.window.webContents === event.sender) return entry.player
    }
    return null
  }

  /** 猪按钮在窗口里的框；页面报过就用真实的大小（朋友猪现在会跟着本机猪缩放）。 */
  function pigRectFor(entry, bounds = null) {
    const box = bounds ?? entry.window.getBounds()
    const rect = entry.pigRect ?? DEFAULT_PIG_RECT
    return {
      x: Math.round(box.x + rect.x),
      y: Math.round(box.y + rect.y),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    }
  }

  /** 朋友面板要贴猪：给的是猪按钮的屏幕框，不是整扇透明窗口。 */
  function boundsForEvent(event) {
    for (const entry of entries.values()) {
      if (entry.window !== null && !entry.window.isDestroyed() && entry.window.webContents === event.sender) {
        return pigRectFor(entry)
      }
    }
    return null
  }

  /** 右键打开面板时页面顺带把猪按钮的框带过来：不用等另一个 IPC，位置一次就对。 */
  function pigRectForEvent(event, rect = null) {
    for (const entry of entries.values()) {
      if (entry.window === null || entry.window.isDestroyed() || entry.window.webContents !== event.sender) continue
      const x = Number(rect?.x)
      const y = Number(rect?.y)
      const width = Number(rect?.width)
      const height = Number(rect?.height)
      if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
        entry.pigRect = { x, y, width, height }
      }
      return pigRectFor(entry)
    }
    return null
  }

  /** 页面量好猪按钮的实际框后报上来；换尺寸/换字体都会重新量。 */
  function setPigRect(sender, rect) {
    const x = Number(rect?.x)
    const y = Number(rect?.y)
    const width = Number(rect?.width)
    const height = Number(rect?.height)
    if (![x, y, width, height].every(Number.isFinite) || width < 1 || height < 1) return false
    for (const entry of entries.values()) {
      if (entry.window === null || entry.window.isDestroyed() || entry.window.webContents !== sender) continue
      entry.pigRect = { x, y, width, height }
      options.onMoved?.(entry.player.id, pigRectFor(entry))
      return true
    }
    return false
  }

  function closeForEvent(event) {
    for (const entry of entries.values()) {
      if (entry.window !== null && !entry.window.isDestroyed() && entry.window.webContents === event.sender) {
        closeEntry(entry)
        return true
      }
    }
    return false
  }

  function startDrag(sender) {
    for (const entry of entries.values()) {
      const win = entry.window
      if (win === null || win.isDestroyed() || win.webContents !== sender) continue
      if (entry.dragTimer) clearInterval(entry.dragTimer)
      const current = win.getBounds()
      const bottom = current.y + current.height
      if (current.height !== WINDOW_HEIGHT) {
        win.setBounds({ x: current.x, y: Math.max(8, bottom - WINDOW_HEIGHT), width: current.width, height: WINDOW_HEIGHT })
      }
      const start = win.getBounds()
      const cursor = options.screen.getCursorScreenPoint()
      entry.dragStart = { cursor, bounds: start }
      const tick = () => {
        if (entry.dragStart === null || win.isDestroyed()) return
        const point = options.screen.getCursorScreenPoint()
        const dx = point.x - entry.dragStart.cursor.x
        const dy = point.y - entry.dragStart.cursor.y
        const area = options.screen.getDisplayNearestPoint(point).workArea
        const x = Math.max(area.x, Math.min(area.x + area.width - start.width, start.x + dx))
        const y = Math.max(area.y, Math.min(area.y + area.height - start.height, start.y + dy))
        const now = win.getBounds()
        if (now.x !== Math.round(x) || now.y !== Math.round(y)) {
          win.setBounds({ x: Math.round(x), y: Math.round(y), width: start.width, height: start.height })
          options.onMoved?.(entry.player.id, pigRectFor(entry, { x: Math.round(x), y: Math.round(y), width: start.width, height: start.height }))
        }
      }
      entry.dragTimer = setInterval(tick, 16)
      entry.dragTimer.unref?.()
      tick()
      return
    }
  }

  function endDrag(sender) {
    for (const entry of entries.values()) {
      if (entry.window === null || entry.window.isDestroyed() || entry.window.webContents !== sender) continue
      if (entry.dragTimer) clearInterval(entry.dragTimer)
      entry.dragTimer = null
      entry.dragStart = null
      options.onMoved?.(entry.player.id, pigRectFor(entry))
      return
    }
  }

  function setExpanded(sender, expanded) {
    for (const entry of entries.values()) {
      const win = entry.window
      if (win === null || win.isDestroyed() || win.webContents !== sender) continue
      const bounds = win.getBounds()
      const height = expanded === true ? WINDOW_EXPANDED_HEIGHT : WINDOW_HEIGHT
      if (bounds.height === height) return
      const area = displayArea()
      const bottom = bounds.y + bounds.height
      const y = Math.max(area.y + 8, bottom - height)
      win.setBounds({ x: bounds.x, y, width: bounds.width, height })
      options.onMoved?.(entry.player.id, pigRectFor(entry, { x: bounds.x, y, width: bounds.width, height }))
      return
    }
  }

  function closeMenusExcept(sender) {
    for (const entry of entries.values()) {
      const win = entry.window
      if (win === null || win.isDestroyed() || win.webContents === sender) continue
      win.webContents.send('piggy:visitor:menu-close')
    }
  }

  function count() { return entries.size }
  function players() { return [...entries.values()].map(entry => entry.player) }

  return Object.freeze({ sync, demo, closeAll, owns, playerForEvent, boundsForEvent, pigRectForEvent, setPigRect, closeForEvent, startDrag, endDrag, setExpanded, closeMenusExcept, count, players })
}
