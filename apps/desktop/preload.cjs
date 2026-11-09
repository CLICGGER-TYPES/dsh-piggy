// 桌面版的页面桥：页面只能通过这几个口子跟主进程说话。
const { contextBridge, ipcRenderer } = require('electron')
const MAX_SAVE_BYTES = 128 * 1024 * 1024

/** 最近一次主进程报来的窗口与工作区（同步读，页面随时能用）。 */
let geometry = null
/** 这个页面在哪个窗口里：猪窗口（pet）还是面板窗口（panel，外壳 0.6.0 起）。 */
const argv = typeof process === 'undefined' ? [] : process.argv
const role = argv.includes('--piggy-role=panel') ? 'panel'
  : argv.includes('--piggy-role=ext') ? 'ext'
    : argv.includes('--piggy-role=room') ? 'room'
      : argv.includes('--piggy-role=visitor') ? 'visitor'
        : 'pet'
/** 扩展大窗口（role=ext，外壳 0.6.5 起）显示的是哪个扩展。 */
const extKey = role === 'ext' ? (argv.find(arg => arg.startsWith('--piggy-ext=')) || '').slice('--piggy-ext='.length) : null

/** 和 owner document 同一套 ID 白名单：字母数字开头，允许 ._:-，最多 128 个字符。 */
const PIG_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
function argumentValue(prefix) {
  const arg = argv.find(item => item.startsWith(prefix))
  return arg === undefined ? null : arg.slice(prefix.length)
}
/** 这个宠物窗口是哪只猪（多猪，外壳 MULTIPIGWIN02 起）；旧外壳不带参数就是 null。 */
const requestedPigId = argumentValue('--piggy-pig=')
const pigId = requestedPigId !== null && PIG_ID_PATTERN.test(requestedPigId) ? requestedPigId : null
/** 主猪（面板、舞台兼容都跟着它走）；只有 pigId 合法时才可能为 true。 */
const primary = pigId !== null && argv.includes('--piggy-primary=1')
/** 多猪窗口的默认摆放槽位（0–3）；新猪没有旧位置时按它错开。 */
const requestedSlot = argumentValue('--piggy-slot=')
const slot = pigId !== null && requestedSlot !== null && /^[0-3]$/.test(requestedSlot) ? Number(requestedSlot) : null

/** 房间只收外观摘要；主进程会再校验一次，这里先挡住超长字段。 */
function roomProfile(value) {
  const profile = value !== null && typeof value === 'object' ? value : {}
  return {
    name: typeof profile.name === 'string' ? profile.name.slice(0, 80) : '',
    level: Number(profile.level) || 0,
    stage: typeof profile.stage === 'string' ? profile.stage.slice(0, 40) : '',
    art: typeof profile.art === 'string' ? profile.art.slice(0, 240) : '',
    emoji: typeof profile.emoji === 'string' ? profile.emoji.slice(0, 8) : '',
    size: Number(profile.size) || 1,
    label: typeof profile.label === 'string' ? profile.label.slice(0, 40) : '',
    mood: typeof profile.mood === 'string' ? profile.mood.slice(0, 24) : '',
    moodLabel: typeof profile.moodLabel === 'string' ? profile.moodLabel.slice(0, 24) : '',
    care: Object.fromEntries(['satiety', 'cleanliness', 'happiness'].map(key => [
      key, Number.isFinite(Number(profile.care?.[key])) ? Number(profile.care[key]) : 60,
    ])),
    actions: profile.actions,
    status: profile.status,
    card: profile.card,
  }
}

/** 恢复事件只接受主屏 DIP 工作区；坏载荷不交给页面。 */
function recoveryWorkArea(value) {
  const area = value === null || typeof value !== 'object' ? null : value.workArea
  if (area === null || typeof area !== 'object') return null
  if (![area.x, area.y, area.width, area.height].every(Number.isFinite)) return null
  if (!(area.width > 0) || !(area.height > 0)) return null
  return { x: area.x, y: area.y, width: area.width, height: area.height }
}

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
  cloudSave: {
    get: () => ipcRenderer.invoke('piggy:cloud:get'),
    set: config => ipcRenderer.invoke('piggy:cloud:set', config),
    test: config => ipcRenderer.invoke('piggy:cloud:test', config),
    ownerStatus: () => ipcRenderer.invoke('piggy:cloud:owner-status'),
    firstSync: direction => ipcRenderer.invoke('piggy:cloud:first-sync', String(direction)),
    importFirstSync: (token, options) => ipcRenderer.invoke('piggy:cloud:import-first-sync', String(token), { acceptWarnings: options?.acceptWarnings === true }),
    ownerHistory: branch => ipcRenderer.invoke('piggy:cloud:owner-history', String(branch ?? '')),
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
  /** 设置 → 外部连接：只有面板窗口能调用；扩展大窗口会被主进程拒绝。 */
  external: {
    get: () => ipcRenderer.invoke('piggy:external:get'),
    set: enabled => ipcRenderer.invoke('piggy:external:set', enabled === true),
    onStatus: callback => { ipcRenderer.on('piggy:external', (event, status) => callback(status)) },
  },
  /** 设置 → 外部连接 → 最近投递：只读来源聚合；旧外壳没有这个口子。 */
  workEventSources: () => ipcRenderer.invoke('piggy:work-event-sources'),
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
  /** Complete owner archive; import is staged by the host and switched only after the current host saves. */
  ownerArchives: {
    status: () => ipcRenderer.invoke('piggy:owner-archive:status'),
    export: () => ipcRenderer.invoke('piggy:owner-archive:export'),
    preview: bytes => {
      if (!(bytes instanceof Uint8Array)) return Promise.resolve({ ok: false, reason: '存档数据格式不正确' })
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_SAVE_BYTES) return Promise.resolve({ ok: false, reason: '存档大小无效或超过 128 MiB' })
      return ipcRenderer.invoke('piggy:owner-archive:preview', bytes)
    },
    importAndSwitch: (token, options) => ipcRenderer.invoke('piggy:owner-archive:import-and-switch', String(token), { acceptWarnings: options?.acceptWarnings === true }),
  },
  /** Local roster for one explicit OwnerDocument. IDs label same-owner targets; the main process validates every switch. */
  ownerPigs: {
    status: () => ipcRenderer.invoke('piggy:owner-pigs:status'),
    list: () => ipcRenderer.invoke('piggy:owner-pigs:list'),
    select: pigId => {
      if (typeof pigId !== 'string' || pigId.length > 128) return Promise.resolve({ ok: false, reason: '小猪选择无效' })
      return ipcRenderer.invoke('piggy:owner-pigs:select', pigId)
    },
    addAndSelect: () => ipcRenderer.invoke('piggy:owner-pigs:add-and-select'),
  },
  /**
   * 面板专用的 owner 私有 LAN 会话；只有调用 start() 才启动服务。
   * 第一版加入侧只读：join 只接收一条 `piggy://IP:端口#邀请码` 字符串。
   */
  ownerNetwork: {
    status: () => ipcRenderer.invoke('piggy:owner-network:status'),
    addresses: () => ipcRenderer.invoke('piggy:owner-network:addresses'),
    start: options => ipcRenderer.invoke('piggy:owner-network:start', {
      listenAddress: typeof options?.listenAddress === 'string' ? options.listenAddress : '',
      advertisedHost: typeof options?.advertisedHost === 'string' ? options.advertisedHost : '',
    }),
    invite: pigId => ipcRenderer.invoke('piggy:owner-network:invite', typeof pigId === 'string' ? pigId : ''),
    stop: () => ipcRenderer.invoke('piggy:owner-network:stop'),
    join: link => ipcRenderer.invoke('piggy:owner-network:join', typeof link === 'string' ? link.slice(0, 512) : ''),
    joinStatus: () => ipcRenderer.invoke('piggy:owner-network:join-status'),
    leave: () => ipcRenderer.invoke('piggy:owner-network:join-leave'),
  },
  /**
   * 联机房间（外壳 0.6.8 起）：面板建房/加入，房间窗口移动/发表情。
   * 房间只同步外观和位置，不传存档。
   */
  room: {
    status: () => ipcRenderer.invoke('piggy:room:status'),
    host: profile => ipcRenderer.invoke('piggy:room:host', roomProfile(profile)),
    join: (input, profile) => ipcRenderer.invoke('piggy:room:join',
      typeof input === 'string' ? input.slice(0, 512) : '', roomProfile(profile)),
    open: () => ipcRenderer.invoke('piggy:room:open'),
    move: (x, y, facing) => ipcRenderer.invoke('piggy:room:move', Number(x) || 0, Number(y) || 0, Number(facing) < 0 ? -1 : 1),
    emote: (name, targetId, x, y, facing) => ipcRenderer.invoke('piggy:room:emote', String(name),
      typeof targetId === 'string' ? targetId.slice(0, 80) : '', Number(x) || 0, Number(y) || 0, Number(facing) < 0 ? -1 : 1),
    leave: () => ipcRenderer.invoke('piggy:room:leave'),
    copy: () => ipcRenderer.invoke('piggy:room:copy'),
    onUpdate: callback => { ipcRenderer.on('piggy:room:update', (event, snapshot) => callback(snapshot)) },
    onClosed: callback => { ipcRenderer.on('piggy:room:closed', (event, detail) => callback(detail)) },
  },
  /** 面板里的朋友猪：用自己背包照顾；只发意图，不写对方存档。 */
  friend: {
    care: (targetId, action, itemKey) => ipcRenderer.invoke('piggy:friend:care', String(targetId), String(action), String(itemKey)),
    onCareResult: callback => { ipcRenderer.on('piggy:friend:care-result', (event, result) => callback(result)) },
  },
  /** 桌面上的朋友猪：只读资料、摸摸和照顾入口；不碰游戏存档。 */
  visitor: {
    get: () => ipcRenderer.invoke('piggy:visitor:get'),
    onUpdate: callback => { ipcRenderer.on('piggy:visitor:update', (event, player) => callback(player)) },
    pat: () => ipcRenderer.invoke('piggy:visitor:pat'),
    view: rect => ipcRenderer.invoke('piggy:visitor:view', rect),
    items: () => ipcRenderer.invoke('piggy:visitor:items'),
    size: rect => ipcRenderer.send('piggy:visitor:size', rect),
    care: (action, itemKey) => ipcRenderer.invoke('piggy:visitor:care', String(action), String(itemKey)),
    onCareResult: callback => { ipcRenderer.on('piggy:visitor:care-result', (event, result) => callback(result)) },
    menu: () => ipcRenderer.send('piggy:visitor:menu'),
    expand: open => ipcRenderer.send('piggy:visitor:expand', open === true),
    dragStart: () => ipcRenderer.send('piggy:visitor:drag-start'),
    dragEnd: () => ipcRenderer.send('piggy:visitor:drag-end'),
    onMenuClose: callback => { ipcRenderer.on('piggy:visitor:menu-close', () => callback()) },
    close: () => ipcRenderer.send('piggy:visitor:close'),
  },
  /** 主屏「退出」：存好档再关。 */
  quit: () => ipcRenderer.invoke('piggy:quit'),
  /** 这个页面在哪个窗口里：'pet'、'panel'、扩展的大窗口 'ext'，或联机房间 'room'。 */
  role,
  extKey,
  /** 多猪（外壳 MULTIPIGWIN02 起）：这个宠物窗口的 pigId 与是否主猪；旧外壳是 null/false。 */
  pigId,
  primary,
  slot,
  /** 只有 pigId 合法时才暴露，旧外壳/无参数时页面按单猪处理。 */
  ...(pigId !== null ? { multiPig: true } : {}),
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
  onStateChanged: callback => {
    ipcRenderer.on('piggy:state-changed', (event, view) => callback(typeof view === 'string' ? JSON.parse(view) : view))
  },
  /** 托盘「恢复小猪」（本版外壳）：只带主屏 DIP 工作区；返回取消订阅。 */
  onRecover: callback => {
    if (typeof callback !== 'function') return () => {}
    const handler = (event, payload) => {
      const workArea = recoveryWorkArea(payload)
      if (workArea !== null) callback({ workArea })
    }
    ipcRenderer.on('piggy:recover', handler)
    return () => ipcRenderer.removeListener('piggy:recover', handler)
  },
})
