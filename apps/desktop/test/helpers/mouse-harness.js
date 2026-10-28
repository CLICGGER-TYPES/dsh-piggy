// @ts-check
/** 执行生产窗口和 IPC，只替换 Electron、时钟、显示器与持久化外围。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import * as geometry from '../../lib/window-geometry.js'
import { createResizeShape } from '../../lib/resize-shape.js'
import { dragHeartbeatExpired } from '../../lib/drag-watchdog.js'
import { pointerHitsShape } from '../../lib/pointer-hit.js'
import { validDragOrigin } from '../../lib/drag-origin.js'
import { SHOW_FALLBACK_MS, createShowGate } from '../../lib/window-show.js'
import { auxiliaryWindowOptions } from '../../lib/auxiliary-window.js'

const source = readFileSync(new URL('../../main.js', import.meta.url), 'utf8')

export async function mouseHarness({ platform = 'win32', env = {}, frameSubscription = false, scaleFactor = 1, resetsInputOnShape = false } = {}) {
  const handlers = new Map(), intervals = [], mouse = [], shapes = [], sent = []
  const windowEvents = new Map(), pageEvents = new Map()
  const area = { x: 0, y: 0, width: 1920, height: 1040 }
  const display = { workArea: area, bounds: area, scaleFactor, displayFrequency: 60 }
  const state = { bounds: null, cursor: { x: 0, y: 0 }, destroyed: false, now: 1000, ignoresMouse: false }
  const frames = [], ended = []
  const webContents = { on: (event, callback) => pageEvents.set(event, callback), setFrameRate() {}, send: (...args) => sent.push(args),
    ...(frameSubscription ? { isDestroyed:()=>false, beginFrameSubscription:fn=>frames.push(fn), endFrameSubscription:()=>ended.push(true) } : {}) }
  class WindowStub {
    constructor(bounds) { state.bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } }
    webContents = webContents
    isDestroyed() { return state.destroyed }
    isVisible() { return true }
    getBounds() { return { ...state.bounds } }
    setBounds(bounds) { state.bounds = { ...bounds } }
    setIgnoreMouseEvents(ignore, options) { state.ignoresMouse = ignore; mouse.push({ ignore, forward: options.forward }) }
    setShape(rects) {
      shapes.push(JSON.parse(JSON.stringify(rects)))
      if (resetsInputOnShape) state.ignoresMouse = false
    }
    setAlwaysOnTop() {}
    loadURL() {}
    once(event, callback) { windowEvents.set(event, callback) }
    on(event, callback) { windowEvents.set(event, callback) }
  }
  const context = createContext({
    ...geometry, createResizeShape, pointerHitsShape, dragHeartbeatExpired, validDragOrigin, SHOW_FALLBACK_MS, createShowGate, auxiliaryWindowOptions,
    process: { platform, env }, BrowserWindow: WindowStub, FRAME_CAP: 0, HERE: '.',
    win: null, quitting: false, petAsked: null, panelPig: null, dragStats: null,
    BOUNDS_TOLERANCE: 2, FALLBACK_CONTENT: { width: 132, height: 152 },
    readWindowState: () => null, pigDisplay: () => display, join: (...parts) => parts.join('/'),
    screen: { getCursorScreenPoint: () => state.cursor, getAllDisplays: () => [display],
      getDisplayMatching: () => display, getDisplayNearestPoint: () => display, getPrimaryDisplay: () => display },
    setInterval: (callback, delay) => { const timer = { callback, delay, active: true }; intervals.push(timer); return timer },
    clearInterval: timer => { if (timer) timer.active = false },
    setTimeout() {}, log() {}, followPig() {}, scheduleWindowStateSave() {}, reanchorPanel() {},
    ipcMain: { on: (channel, callback) => handlers.set(channel, callback) },
    Date: { now: () => state.now },
  })
  const fromPet = source.indexOf('function fromPet(event)')
  runInContext(source.slice(fromPet, source.indexOf('\n/**', fromPet)), context)
  const start = source.indexOf('function workAreaFor(bounds)')
  const end = source.indexOf('\n// ---------------------------------------------------------------------------\n// 面板窗口', start)
  assert.ok(fromPet > 0 && start > 0 && end > start, '必须加载生产窗口和鼠标入口')
  runInContext(source.slice(start, end), context)
  await runInContext('createWindow()', context)
  return {
    mouse, shapes, sent, intervals, state,
    recreate: () => runInContext('createWindow()', context),
    send(channel, payload, sender = webContents) {
      const event = { sender, returnValue: undefined }
      handlers.get(channel)(event, payload)
      return event.returnValue
    },
    poll() { for (const timer of intervals.filter(timer => timer.active && timer.delay === 16)) timer.callback() },
    tickDrag() { runInContext('dragTick()', context) },
    point(x, y) { state.cursor = { x: state.bounds.x + x, y: state.bounds.y + y } },
    close() { state.destroyed = true; windowEvents.get('closed')() },
    crash() { pageEvents.get('render-process-gone')({}, { reason: 'crashed' }) },
    dragging: () => runInContext('dragSession !== null', context),
    ownership: () => JSON.parse(runInContext('JSON.stringify({dragShapeActive, flightShapeActive, flightSlide})', context)),
    frames, ended,
    present() { frames.at(-1)({getSize:()=>({width:state.bounds.width,height:state.bounds.height})}) },
  }
}
