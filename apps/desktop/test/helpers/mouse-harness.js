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
import { createPetRegistry, createPetState } from '../../lib/pet-instance.js'
import { createStartupTrace } from '../../lib/startup-trace.js'
import { createWindowManager } from '../../lib/window-manager.js'
import { createWindowSurface } from '../../lib/window-surface.js'
import { desktopLifecycleStateAdapter } from './desktop-lifecycle-adapter.js'

const source = readFileSync(new URL('../../main.js', import.meta.url), 'utf8')

export async function mouseHarness({ platform = 'win32', env = {}, frameSubscription = false, scaleFactor = 1, resetsInputOnShape = false } = {}) {
  const handlers = new Map(), intervals = [], mouse = [], shapes = [], sent = []
  const windowEvents = new Map(), pageEvents = new Map()
  const area = { x: 0, y: 0, width: 1920, height: 1040 }
  const display = { workArea: area, bounds: area, scaleFactor, displayFrequency: 60 }
  const state = { bounds: null, cursor: { x: 0, y: 0 }, destroyed: false, now: 1000, ignoresMouse: false }
  const frames = [], ended = []
  const webContents = { id: 1, on: (event, callback) => pageEvents.set(event, callback), setFrameRate() {}, send: (...args) => sent.push(args),
    ...(frameSubscription ? { isDestroyed:()=>false, beginFrameSubscription:fn=>frames.push(fn), endFrameSubscription:()=>ended.push(true) } : {}) }
  class WindowStub {
    constructor(options) {
      state.destroyed = false
      windowEvents.clear()
      pageEvents.clear()
      state.bounds = { x: options.x, y: options.y, width: options.width, height: options.height }
    }
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
  const pets = createPetRegistry()
  const primary = createPetState({ primary: true })
  pets.add(primary)
  const sandbox = {
    ...geometry, createResizeShape, pointerHitsShape, dragHeartbeatExpired, validDragOrigin, SHOW_FALLBACK_MS, createShowGate, auxiliaryWindowOptions,
    process: { platform, env }, BrowserWindow: WindowStub, FRAME_CAP: 0, HERE: '.',
    pets, primaryPet: () => pets.primary(), getPetWindow: () => pets.primary()?.window ?? null,
    panel: { followPig() {}, reanchorPanel() {}, focusLeft() {}, close() {}, ensure() {}, forgetTarget() {} },
    pigSessions: new Map(), quitting: false,
    startupUpdateToken: null, startupSetupComplete: false, startupRendererLoaded: false, startupWindowWasVisible: false,
    readWindowState: () => null, pigDisplay: () => display, join: (...parts) => parts.join('/'),
    screen: { getCursorScreenPoint: () => state.cursor, getAllDisplays: () => [display],
      getDisplayMatching: () => display, getDisplayNearestPoint: () => display, getPrimaryDisplay: () => display },
    setInterval: (callback, delay) => { const timer = { callback, delay, active: true }; intervals.push(timer); return timer },
    clearInterval: timer => { if (timer) timer.active = false },
    setTimeout() {}, log() {}, followPig() {}, scheduleWindowStateSave() {}, reanchorPanel() {}, closePanel() {}, ensurePanelWindow() {},
    startupInputTrace: createStartupTrace(() => {}, () => state.now),
    ipcMain: { on: (channel, callback) => handlers.set(channel, callback) },
    Date: { now: () => state.now },
  }
  sandbox.desktopLifecycle = desktopLifecycleStateAdapter(sandbox)
  const context = createContext(sandbox)
  const surface = createWindowSurface({
    screen: sandbox.screen, platform, env, panel: sandbox.panel,
    scheduleWindowStateSave: sandbox.scheduleWindowStateSave, log: sandbox.log,
    startupInputTrace: sandbox.startupInputTrace,
    traceSetIgnoreMouseEvents: (...args) => sandbox.traceSetIgnoreMouseEvents(...args),
  })
  const manager = createWindowManager({
    BrowserWindow: WindowStub, screen: sandbox.screen, pets, primaryPet: sandbox.primaryPet,
    panel: sandbox.panel, panelWindow: { destroy() {}, forget() {} }, getPanelWindow: () => null,
    desktopLifecycle: sandbox.desktopLifecycle, desktopRuntime: { getHost: () => null }, pigSessions: sandbox.pigSessions,
    platform, env, preloadPath: 'preload.cjs', frameCap: 0, log: sandbox.log,
    startupInputTrace: sandbox.startupInputTrace, readWindowState: sandbox.readWindowState, surface,
    setTimeout: sandbox.setTimeout, setInterval: sandbox.setInterval, clearInterval: sandbox.clearInterval,
    stopDrag: pet => sandbox.stopDrag(pet),
    confirmUpdateStartupIfReady() {},
    onRendererLoaded: () => { sandbox.startupRendererLoaded = true },
    onPrimaryWindowShown: window => { sandbox.startupWindowWasVisible = window.isVisible() },
    handleStartupFailure: async () => {},
    getCaptureCheck: () => async () => {},
  })
  Object.assign(sandbox, {
    createWindow: manager.createWindow, createPigWindow: manager.createPigWindow,
    closePetSession: manager.closePetSession, rebuildLinuxViews: manager.rebuildLinuxViews,
    showPigWindow: manager.showPigWindow,
    applyBounds: surface.applyBounds, applyFlightBounds: surface.applyFlightBounds,
    applyShape: surface.applyShape, refreshHit: surface.refreshHit,
    setHit: surface.setHit, setLegacyHit: surface.setLegacyHit, setPassthroughMode: surface.setPassthroughMode,
    isMouseRect: surface.isMouseRect, isMouseShape: surface.isMouseShape, isPlaceRequest: surface.isPlaceRequest,
    shiftedShape: surface.shiftedShape, workAreaFor: surface.workAreaFor, pushGeometry: surface.pushGeometry,
    geometryOf: surface.geometryOf, currentSeq: surface.currentSeq, SKIP_NATIVE_SHAPE: surface.skipNativeShape,
  })
  const traceStart = source.indexOf('function startupApiErrorKind(error)')
  const traceEnd = source.indexOf('\nasync function flushLogs', traceStart)
  const fromPet = source.indexOf('function fromPet(event)')
  const fromPetEnd = source.indexOf('\n/** 发给所有窗口的页面', fromPet)
  const start = source.indexOf("ipcMain.on('piggy:content'")
  const end = source.indexOf('\n// 面板窗口：', start)
  assert.ok(traceStart > 0 && traceEnd > traceStart && fromPet > 0 && fromPetEnd > fromPet && start > 0 && end > start, '必须加载生产诊断、窗口和鼠标入口')
  runInContext(source.slice(traceStart, traceEnd), context)
  runInContext(source.slice(fromPet, fromPetEnd), context)
  runInContext(source.slice(start, end), context)
  await manager.createWindow()
  return {
    mouse, shapes, sent, intervals, state, pets, primary,
    recreate: () => manager.createWindow(),
    send(channel, payload, sender = webContents) {
      const event = { sender, returnValue: undefined }
      handlers.get(channel)(event, payload)
      return event.returnValue
    },
    poll() { for (const timer of intervals.filter(timer => timer.active && timer.delay === 16)) timer.callback() },
    tickDrag() { runInContext('dragTick(primaryPet())', context) },
    point(x, y) { state.cursor = { x: state.bounds.x + x, y: state.bounds.y + y } },
    close() { state.destroyed = true; windowEvents.get('closed')() },
    crash() { pageEvents.get('render-process-gone')({}, { reason: 'crashed' }) },
    dragging: () => primary.dragSession !== null,
    ownership: () => ({ dragShapeActive: primary.dragShapeActive, flightShapeActive: primary.flightShapeActive, flightSlide: primary.flightSlide }),
    frames, ended,
    present() { frames.at(-1)({getSize:()=>({width:state.bounds.width,height:state.bounds.height})}) },
  }
}
