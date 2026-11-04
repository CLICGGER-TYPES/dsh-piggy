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
import { createDragEngine, registerDragIpc } from '../../lib/drag-engine.js'
import { registerGeometryIpc } from '../../lib/geometry-ipc.js'
import { desktopLifecycleStateAdapter } from './desktop-lifecycle-adapter.js'

const source = readFileSync(new URL('../../main.js', import.meta.url), 'utf8')

export async function mouseHarness({ platform = 'win32', env = {}, frameSubscription = false, scaleFactor = 1, resetsInputOnShape = false, displays = null } = {}) {
  const handlers = new Map(), intervals = [], mouse = [], shapes = [], sent = []
  const windowEvents = new Map(), pageEvents = new Map()
  const area = { x: 0, y: 0, width: 1920, height: 1040 }
  // 默认单屏；显式传 displays 时用每块屏自己的 bounds/scaleFactor 模拟混合 DPI。
  const displayList = (displays ?? [{ bounds: area, workArea: area, scaleFactor }]).map((entry, index) => {
    const bounds = { ...(entry.bounds ?? area) }
    const factor = entry.scaleFactor ?? scaleFactor
    return {
      id: entry.id ?? index + 1,
      label: entry.label ?? `display-${index + 1}`,
      bounds,
      workArea: { ...(entry.workArea ?? bounds) },
      scaleFactor: factor,
      physicalBounds: { ...(entry.physicalBounds ?? {
        x: bounds.x * factor, y: bounds.y * factor, width: bounds.width * factor, height: bounds.height * factor,
      }) },
      displayFrequency: 60,
      internal: index === 0,
    }
  })
  const primaryDisplay = displayList[0]
  const insideDisplay = (display, point) => point.x >= display.bounds.x && point.x < display.bounds.x + display.bounds.width
    && point.y >= display.bounds.y && point.y < display.bounds.y + display.bounds.height
  const nearestDisplay = point => displayList.reduce((best, display) => {
    const distance = (a, b) => Math.abs(a - b)
    const cx = display.bounds.x + display.bounds.width / 2
    const cy = display.bounds.y + display.bounds.height / 2
    const bx = best.bounds.x + best.bounds.width / 2
    const by = best.bounds.y + best.bounds.height / 2
    return distance(point.x, cx) + distance(point.y, cy) < distance(point.x, bx) + distance(point.y, by) ? display : best
  })
  const displayAtPoint = point => displayList.find(display => insideDisplay(display, point)) ?? nearestDisplay(point)
  const displayForRect = rect => {
    let best = null
    let bestArea = 0
    for (const display of displayList) {
      const width = Math.min(rect.x + rect.width, display.bounds.x + display.bounds.width) - Math.max(rect.x, display.bounds.x)
      const height = Math.min(rect.y + rect.height, display.bounds.y + display.bounds.height) - Math.max(rect.y, display.bounds.y)
      const overlap = Math.max(0, width) * Math.max(0, height)
      if (overlap > bestArea) { bestArea = overlap; best = display }
    }
    return best ?? displayAtPoint({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
  }
  const dipPoint = (point, display) => ({
    x: display.physicalBounds.x + (point.x - display.bounds.x) * display.scaleFactor,
    y: display.physicalBounds.y + (point.y - display.bounds.y) * display.scaleFactor,
  })
  const dipRect = (rect, display) => {
    const origin = dipPoint(rect, display)
    return { x: origin.x, y: origin.y, width: rect.width * display.scaleFactor, height: rect.height * display.scaleFactor }
  }
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
    getContentBounds() { return { ...state.bounds } }
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
    readWindowState: () => null, pigDisplay: () => primaryDisplay, join: (...parts) => parts.join('/'),
    screen: {
      getCursorScreenPoint: () => state.cursor,
      getAllDisplays: () => displayList,
      getDisplayMatching: rect => displayForRect(rect),
      getDisplayNearestPoint: point => displayAtPoint(point),
      getPrimaryDisplay: () => primaryDisplay,
      // 和 Electron 同样的口径：光标按光标所在屏，矩形按窗口所在屏。
      dipToScreenPoint: point => dipPoint(point, displayAtPoint(point)),
      dipToScreenRect: (win, rect) => dipRect(rect, displayForRect(win?.getBounds?.() ?? rect)),
    },
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
  assert.ok(traceStart > 0 && traceEnd > traceStart && fromPet > 0 && fromPetEnd > fromPet, '必须加载生产诊断和发送者校验')
  runInContext(source.slice(traceStart, traceEnd), context)
  runInContext(source.slice(fromPet, fromPetEnd), context)
  const dragEngine = createDragEngine({
    screen: sandbox.screen, pets, petForEvent: event => context.petForEvent(event),
    panel: sandbox.panel, log: sandbox.log, surface,
    setInterval: sandbox.setInterval, clearInterval: sandbox.clearInterval,
    now: () => state.now,
  })
  sandbox.stopDrag = pet => dragEngine.stopDrag(pet)
  registerGeometryIpc({
    ipcMain: sandbox.ipcMain, screen: sandbox.screen, pets, platform,
    petForEvent: event => context.petForEvent(event), panel: sandbox.panel, log: sandbox.log,
    showPigWindow: pet => sandbox.showPigWindow(pet), surface,
  })
  registerDragIpc({ ipcMain: sandbox.ipcMain, engine: dragEngine })
  await manager.createWindow()
  return {
    mouse, shapes, sent, intervals, state, pets, primary, displays: displayList,
    recreate: () => manager.createWindow(),
    send(channel, payload, sender = webContents) {
      const event = { sender, returnValue: undefined }
      handlers.get(channel)(event, payload)
      return event.returnValue
    },
    poll() { for (const timer of intervals.filter(timer => timer.active && timer.delay === 16)) timer.callback() },
    tickDrag() { dragEngine.dragTick(primary) },
    point(x, y) { state.cursor = { x: state.bounds.x + x, y: state.bounds.y + y } },
    /** 光标按屏幕 DIP 直接给（跨屏测试用），不叠加窗口原点。 */
    cursorAt(x, y) { state.cursor = { x, y } },
    close() { state.destroyed = true; windowEvents.get('closed')() },
    crash() { pageEvents.get('render-process-gone')({}, { reason: 'crashed' }) },
    dragging: () => primary.dragSession !== null,
    ownership: () => ({ dragShapeActive: primary.dragShapeActive, flightShapeActive: primary.flightShapeActive, flightSlide: primary.flightSlide }),
    frames, ended,
    present() { frames.at(-1)({getSize:()=>({width:state.bounds.width,height:state.bounds.height})}) },
  }
}
