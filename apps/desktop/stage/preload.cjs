// 舞台页的桥。页面只能通过这两个对象说话，拿不到 node。
const { contextBridge, ipcRenderer } = require('electron')
const MAX_SAVE_BYTES = 128 * 1024 * 1024
// 舞台页报来的 dpr / CSS 视口只用于主进程挑选显示器，先在这里挡住坏数字。
const DPR_MIN = 0.25
const DPR_MAX = 8
const VIEWPORT_MAX = 20000

const argv = typeof process === 'undefined' ? [] : process.argv
const role = argv.includes('--piggy-role=ext') ? 'ext' : 'stage'
const extKey = role === 'ext' ? (argv.find(arg => arg.startsWith('--piggy-ext=')) || '').slice('--piggy-ext='.length) : null

function sanitizeDpr(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < DPR_MIN || value > DPR_MAX) return null
  return value
}

function sanitizeViewport(value) {
  if (value === null || typeof value !== 'object') return null
  if (typeof value.width !== 'number' || typeof value.height !== 'number') return null
  const width = Math.round(value.width)
  const height = Math.round(value.height)
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width < 1 || height < 1 || width > VIEWPORT_MAX || height > VIEWPORT_MAX) return null
  return { width, height }
}

/** 恢复事件只接受主屏 DIP 工作区；坏载荷不交给页面。 */
function recoveryWorkArea(value) {
  const area = value === null || typeof value !== 'object' ? null : value.workArea
  if (area === null || typeof area !== 'object') return null
  if (![area.x, area.y, area.width, area.height].every(Number.isFinite)) return null
  if (!(area.width > 0) || !(area.height > 0)) return null
  return { x: area.x, y: area.y, width: area.width, height: area.height }
}

let geometry = null
let geometrySeq = 0

function acceptGeometry(info) {
  const seq = Number(info?.seq) || 0
  if (seq < geometrySeq) return false
  geometrySeq = seq
  geometry = info
  return true
}

contextBridge.exposeInMainWorld('stageShell', {
  role,
  platform: typeof process === 'undefined' ? '' : process.platform,
  report: payload => {
    if (payload === null || typeof payload !== 'object') return
    ipcRenderer.send('stage:report', {
      shape: Array.isArray(payload.shape) ? payload.shape.slice(0, 64) : [],
      visible: payload.visible ?? null,
      dpr: sanitizeDpr(payload.dpr),
      viewport: sanitizeViewport(payload.viewport),
      interacting: payload.interacting === true,
    })
  },
  setInteracting: active => { ipcRenderer.send('stage:interaction', active === true) },
  geometry: () => geometry,
  askGeometry: () => {
    const next = ipcRenderer.sendSync('stage:geometry:ask')
    if (next && next.window) acceptGeometry(next)
    return next
  },
  onGeometry: callback => {
    if (typeof callback !== 'function') return () => {}
    const handler = (event, info) => { if (acceptGeometry(info)) callback(geometry) }
    ipcRenderer.on('stage:geometry', handler)
    return () => ipcRenderer.removeListener('stage:geometry', handler)
  },
  onBlur: callback => {
    if (typeof callback !== 'function') return () => {}
    const handler = () => callback()
    ipcRenderer.on('stage:blur', handler)
    return () => ipcRenderer.removeListener('stage:blur', handler)
  },
  onInteractionOff: callback => {
    if (typeof callback !== 'function') return () => {}
    const handler = () => callback()
    ipcRenderer.on('stage:interaction-off', handler)
    return () => ipcRenderer.removeListener('stage:interaction-off', handler)
  },
  /** 托盘「恢复小猪」（本版外壳）：只带主屏 DIP 工作区；返回取消订阅。 */
  onRecover: callback => {
    if (typeof callback !== 'function') return () => {}
    const handler = (event, payload) => {
      const workArea = recoveryWorkArea(payload)
      if (workArea !== null) callback({ workArea })
    }
    ipcRenderer.on('stage:recover', handler)
    return () => ipcRenderer.removeListener('stage:recover', handler)
  },
  ext: {
    open: key => { ipcRenderer.send('piggy:ext:open', String(key)) },
    close: () => { ipcRenderer.send('piggy:ext:close') },
  },
  saveArchive: async (name, bytes) => {
    const data = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null
    if (data === null || data.byteLength === 0 || data.byteLength > MAX_SAVE_BYTES) return { ok: false, reason: '存档数据格式不正确' }
    return ipcRenderer.invoke('stage:save-archive', { name: String(name), bytes: data })
  },
  quit: () => ipcRenderer.invoke('piggy:quit'),
})

contextBridge.exposeInMainWorld('piggyShell', {
  role,
  extKey,
  platform: typeof process === 'undefined' ? '' : process.platform,
  geometry: () => geometry,
  askGeometry: () => { ipcRenderer.send('stage:geometry:ask') },
  onGeometry: callback => {
    if (typeof callback !== 'function') return () => {}
    const handler = (event, info) => { if (acceptGeometry(info)) callback(geometry) }
    ipcRenderer.on('stage:geometry', handler)
    return () => ipcRenderer.removeListener('stage:geometry', handler)
  },
  updates: {
    current: () => ipcRenderer.invoke('piggy:updates:current'),
    list: fresh => ipcRenderer.invoke('piggy:updates:list', fresh === true),
    install: version => ipcRenderer.invoke('piggy:updates:install', String(version)),
    rollback: () => ipcRenderer.invoke('piggy:updates:rollback'),
    onProgress: callback => { if (typeof callback === 'function') ipcRenderer.on('piggy:progress', (event, fraction) => callback(fraction)) },
  },
  shellUpdates: {
    status: () => ipcRenderer.invoke('piggy:shell:status'),
    download: version => ipcRenderer.invoke('piggy:shell:download', String(version)),
    install: () => ipcRenderer.invoke('piggy:shell:install'),
    onProgress: callback => { if (typeof callback === 'function') ipcRenderer.on('piggy:shell-progress', (event, fraction) => callback(fraction)) },
  },
  proxy: {
    get: () => ipcRenderer.invoke('piggy:proxy:get'),
    set: preference => ipcRenderer.invoke('piggy:proxy:set', preference),
    clear: () => ipcRenderer.invoke('piggy:proxy:clear'),
    test: () => ipcRenderer.invoke('piggy:proxy:test'),
  },
  fullscreen: {
    get: () => ipcRenderer.invoke('piggy:fullscreen:get'),
    set: mode => ipcRenderer.invoke('piggy:fullscreen:set', String(mode)),
  },
  external: {
    get: () => ipcRenderer.invoke('piggy:external:get'),
    set: enabled => ipcRenderer.invoke('piggy:external:set', enabled === true),
    onStatus: callback => {
      if (typeof callback !== 'function') return () => {}
      const listener = (event, status) => callback(status)
      ipcRenderer.on('piggy:external', listener)
      return () => ipcRenderer.removeListener('piggy:external', listener)
    },
  },
  openPage: url => ipcRenderer.invoke('piggy:open', String(url)),
  logs: {
    save: (name, text) => ipcRenderer.invoke('piggy:save-log', { name: String(name), text: String(text) }),
  },
  saves: {
    save: (name, bytes) => {
      const data = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null
      if (data === null || data.byteLength === 0 || data.byteLength > MAX_SAVE_BYTES) return Promise.resolve({ ok: false, reason: '存档数据格式不正确' })
      return ipcRenderer.invoke('piggy:save-archive', { name: String(name), bytes: data })
    },
  },
  quit: () => ipcRenderer.invoke('piggy:quit'),
  ext: {
    open: key => { ipcRenderer.send('piggy:ext:open', String(key)) },
    close: () => { ipcRenderer.send('piggy:ext:close') },
  },
  panel: {
    on: callback => { if (typeof callback === 'function') ipcRenderer.on('piggy:panel', (event, message) => callback(message)) },
    onFx: callback => { if (typeof callback === 'function') ipcRenderer.on('piggy:pig-fx', (event, fx) => callback(fx)) },
    fx: (name, args) => { ipcRenderer.send('piggy:pig-fx', { name: String(name), args: Array.isArray(args) ? args : [] }) },
    toggle: () => {},
    size: () => {},
    close: () => {},
    raisePet: () => {},
  },
  onStateChanged: callback => {
    if (typeof callback === 'function') ipcRenderer.on('piggy:state-changed', (event, view) => callback(typeof view === 'string' ? JSON.parse(view) : view))
  },
})
