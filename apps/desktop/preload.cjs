// 桌面版的页面桥：页面只能通过这几个口子跟主进程说话。
const { contextBridge, ipcRenderer } = require('electron')
const MAX_SAVE_BYTES = 128 * 1024 * 1024

/** 最近一次主进程报来的窗口与工作区（同步读，页面随时能用）。 */
let geometry = null
/** 这个页面在哪个窗口里：猪窗口（pet）还是面板窗口（panel，外壳 0.6.0 起）。 */
const argv = typeof process === 'undefined' ? [] : process.argv
const role = argv.includes('--piggy-role=panel') ? 'panel' : argv.includes('--piggy-role=ext') ? 'ext' : 'pet'
/** 扩展大窗口（role=ext，外壳 0.6.5 起）显示的是哪个扩展。 */
const extKey = role === 'ext' ? (argv.find(arg => arg.startsWith('--piggy-ext=')) || '').slice('--piggy-ext='.length) : null

/** A visible inner layer gets the first Escape; an empty desktop window can close on the next one. */
function hasVisibleEscapeLayer() {
  const layers = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-farm-overlay]')
  for (const layer of layers) {
    if (layer.getClientRects().length === 0) continue
    const { visibility } = document.defaultView.getComputedStyle(layer)
    if (visibility !== 'hidden' && visibility !== 'collapse') return true
  }
  return false
}

function isEditableTarget(target) {
  for (let node = target; node !== null && node !== undefined; node = node.parentElement) {
    const tag = String(node.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable === true) return true
    if (node.getAttribute?.('role') === 'textbox') return true
    const contentEditable = node.getAttribute?.('contenteditable')
    if (contentEditable === '' || contentEditable === 'true' || contentEditable === 'plaintext-only') return true
  }
  return false
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) return
    if (isEditableTarget(event.target) || isEditableTarget(document.activeElement) || hasVisibleEscapeLayer()) return

    let channel = null
    if (role === 'panel') channel = 'piggy:panel:close'
    else if (role === 'pet' && document.querySelector?.('[data-dsh-pig][data-panel-open="true"]') != null) channel = 'piggy:panel:close'
    else if (role === 'ext') channel = 'piggy:ext:close'
    if (channel === null) return

    event.preventDefault()
    event.stopImmediatePropagation()
    ipcRenderer.send(channel)
  }, true)
}

contextBridge.exposeInMainWorld('piggyShell', {
  /** 内容（猪 + 面板 + 气泡）的外接框：主进程据此把窗口调成那么大，并抠出可点区域。 */
  setContent: (content, immediate = false) => {
    if (!immediate) { ipcRenderer.send('piggy:content', content); return }
    const next = ipcRenderer.sendSync('piggy:content', { ...content, immediate: true })
    if (next && next.window && next.workArea) geometry = next
  },
  /** Windows 穿透模式：鼠标进出猪/面板时告诉主进程要不要接点击。 */
  setHit: hit => ipcRenderer.send('piggy:hit', hit === true),
  /** Which parts of the window the pig occupies; everything else lets clicks through. */
  setShape: rects => ipcRenderer.send('piggy:shape', rects),
  /** Main process samples the cursor at 60 Hz from this pointer-down origin. */
  beginDrag: pig => ipcRenderer.send('piggy:drag:start', pig ?? null),
  dragVisualBounds: true,
  /** 新游戏包：页面算好窗口位置大小和可点区域，主进程照做，同步返回新几何。 */
  place: request => {
    const next = ipcRenderer.sendSync('piggy:place', request)
    if (next && next.window && next.workArea) geometry = next
    return next
  },
  dragHeartbeat: () => ipcRenderer.send('piggy:drag:heartbeat'),
  /** 同步返回松手后的几何：最后一帧 slide 必须和页面重定家在同一拍算完。 */
  endDrag: release => {
    const next = ipcRenderer.sendSync('piggy:drag:end', release ?? null)
    if (next && next.window && next.workArea) geometry = next
    return next
  },
  /** A2 抛掷（外壳 0.6.8 起）：页面算好窗口位置，主进程只 setBounds；旧游戏包不会调用。 */
  flyMove: frame => ipcRenderer.send('piggy:flight:move', frame),
  /** 旧游戏包（0.27.2 及以前）的拖动：只发鼠标增量。 */
  moveBy: (dx, dy) => ipcRenderer.send('piggy:move', { dx: Number(dx) || 0, dy: Number(dy) || 0 }),
  /** 平台：macOS 没有 setShape，收起时不能预留透明区域（会挡住桌面点击）。 */
  platform: typeof process === 'undefined' ? '' : process.platform,
  /** 主进程推来的窗口/工作区几何：面板朝屏幕里侧开要用。 */
  geometry: () => geometry,
  /** 页面挂载完主动要一次几何（did-finish-load 可能早于订阅）。 */
  askGeometry: () => ipcRenderer.send('piggy:geometry:ask'),
  onGeometry: callback => {
    ipcRenderer.on('piggy:geometry', (event, info) => {
      if ((info?.seq ?? 0) < (geometry?.seq ?? 0)) return
      geometry = info
      callback(info)
    })
  },
  /** 更新 App: versions on GitHub, switching between them, and going back. */
  updates: {
    current: () => ipcRenderer.invoke('piggy:updates:current'),
    /** fresh：点了刷新，跳过外壳的本地缓存（lib/versions.js）。 */
    list: fresh => ipcRenderer.invoke('piggy:updates:list', fresh === true),
    install: version => ipcRenderer.invoke('piggy:updates:install', String(version)),
    rollback: () => ipcRenderer.invoke('piggy:updates:rollback'),
    onProgress: callback => { ipcRenderer.on('piggy:progress', (event, fraction) => callback(fraction)) },
  },
  proxy: {
    get: () => ipcRenderer.invoke('piggy:proxy:get'),
    set: preference => ipcRenderer.invoke('piggy:proxy:set', preference),
    clear: () => ipcRenderer.invoke('piggy:proxy:clear'),
    test: () => ipcRenderer.invoke('piggy:proxy:test'),
  },
  /** 全屏时小猪隐藏还是照常显示（外壳 0.6.5 起）：get → {mode, supported, checking, reason, platform}。 */
  fullscreen: {
    get: () => ipcRenderer.invoke('piggy:fullscreen:get'),
    set: mode => ipcRenderer.invoke('piggy:fullscreen:set', String(mode)),
  },
  shellUpdates: {
    status: () => ipcRenderer.invoke('piggy:shell:status'),
    download: version => ipcRenderer.invoke('piggy:shell:download', String(version)),
    install: () => ipcRenderer.invoke('piggy:shell:install'),
    onProgress: callback => { ipcRenderer.on('piggy:shell-progress', (event, fraction) => callback(fraction)) },
  },
  openPage: url => ipcRenderer.invoke('piggy:open', String(url)),
  /** 设置 → 日志 → 导出：主进程弹系统「另存为」，写盘。 */
  logs: {
    save: (name, text) => ipcRenderer.invoke('piggy:save-log', { name: String(name), text: String(text) }),
  },
  /** 设置 → 存档 → 导出：主进程弹系统「另存为」，只接收 ZIP 字节。 */
  saves: {
    save: (name, bytes) => {
      if (!(bytes instanceof Uint8Array)) return Promise.resolve({ ok: false, reason: '存档数据格式不正确' })
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_SAVE_BYTES) return Promise.resolve({ ok: false, reason: '存档大小无效或超过 128 MiB' })
      return ipcRenderer.invoke('piggy:save-archive', { name: String(name), bytes })
    },
  },
  /** 主屏「退出」：存好档再关。 */
  quit: () => ipcRenderer.invoke('piggy:quit'),
  /** 这个页面在哪个窗口里：'pet'、'panel'，或者扩展的大窗口 'ext'（外壳 0.6.5 起）。 */
  role,
  extKey,
  /** 扩展的大窗口（外壳 0.6.5 起）：open(key) 开（已开着就拿到前面），close() 只有大窗口自己能叫。 */
  ext: {
    open: key => ipcRenderer.send('piggy:ext:open', String(key)),
    close: () => ipcRenderer.send('piggy:ext:close'),
  },
  /**
   * 面板窗口（外壳 0.6.0 起）：面板不再和猪挤在一个窗口里，见 main.js 的 panelWin。
   * 猪页面用 toggle 开关；面板页面报尺寸、收起、把对猪的反应转过去。
   */
  panel: {
    toggle: (open, pig) => ipcRenderer.send('piggy:panel:toggle', { open: open === true, pig: pig ?? null }),
    size: (width, height, fixedViewport = false) => ipcRenderer.send('piggy:panel:size', { width: Number(width) || 0, height: Number(height) || 0, fixedViewport: fixedViewport === true }),
    close: () => ipcRenderer.send('piggy:panel:close'),
    fx: (name, args) => ipcRenderer.send('piggy:pig-fx', { name: String(name), args: Array.isArray(args) ? args : [] }),
    /** 主进程的面板消息：{type:'open', vertical, maxHeight} / {type:'closed'} / {type:'blur', toPet}。 */
    on: callback => { ipcRenderer.on('piggy:panel', (event, message) => callback(message)) },
    onFx: callback => { ipcRenderer.on('piggy:pig-fx', (event, fx) => callback(fx)) },
    /** 猪窗口自己冒气泡时把自己抬到面板上面（外壳 0.6.4 起），不然气泡被面板盖住。 */
    raisePet: () => ipcRenderer.send('piggy:pet-raise'),
  },
  /** 拖动中窗口被夹在屏幕里时，猪要在窗口里滑多少（外壳 0.6.0 起，见 main.js dragTick）。 */
  onDragSlide: callback => { ipcRenderer.on('piggy:drag-slide', (event, slide) => callback(slide)) },
  /** 存档变了（两个窗口任一个做了动作）：马上刷新，别等轮询。 */
  onStateChanged: callback => { ipcRenderer.on('piggy:state-changed', (event, view) => callback(view)) },
})
