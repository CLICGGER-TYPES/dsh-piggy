// @ts-check
/**
 * 多宠物窗口第一版：两只假 pet 窗口同时跑生产 main.js 的 content/place/drag/hit/关闭路径。
 *
 * 只替换 Electron / 时钟 / 显示器；窗口和 IPC 都走 main.js 里的真实函数。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createContext, runInContext } from 'node:vm'

import * as geometry from '../lib/window-geometry.js'
import { createResizeShape } from '../lib/resize-shape.js'
import { pointerHitsShape } from '../lib/pointer-hit.js'
import { dragHeartbeatExpired } from '../lib/drag-watchdog.js'
import { validDragOrigin } from '../lib/drag-origin.js'
import { SHOW_FALLBACK_MS, createShowGate } from '../lib/window-show.js'
import { auxiliaryWindowOptions } from '../lib/auxiliary-window.js'
import { panelAnchorFor, panelBoundsFor, panelContentRect, panelReferenceFor, panelViewportSize, pigScreenBox, PANEL_FALLBACK } from '../lib/panel-geometry.js'
import { panelToggleAction } from '../lib/panel-toggle.js'
import { createPetWindow } from '../lib/pet-window.js'
import { createPanelWindow } from '../lib/panel-window.js'
import { createPanelController } from '../lib/panel-controller.js'
import { createPetRoster } from '../lib/pet-roster.js'
import { registerPanelIpc } from '../lib/ipc/panel.js'
import { createPetRegistry, createPetState } from '../lib/pet-instance.js'
import { createStartupTrace } from '../lib/startup-trace.js'
import { desktopLifecycleStateAdapter } from './helpers/desktop-lifecycle-adapter.js'

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
const AREA = { x: 0, y: 0, width: 1920, height: 1040 }
const SHAPE = [{ x: 20, y: 20, width: 80, height: 80 }]
const PIG = { x: 20, y: 20, width: 56, height: 56 }

async function harness({ pigIds = ['pig-a', 'pig-b'], panel = false } = {}) {
  const windows = []
  const panelWindows = []
  const handlers = new Map()
  const intervals = []
  const sent = []
  const closeCalls = []
  const closedPanel = []
  let panelWindow = null
  let cursor = { x: 0, y: 0 }
  let nextId = 10

  class WindowStub {
    static getFocusedWindow() { return null }
    constructor(options) {
      this.id = windows.length + 1
      this.options = options
      this.bounds = { x: options.x, y: options.y, width: options.width, height: options.height }
      this.destroyed = false
      this.visible = true
      this.shape = []
      this.ignoresMouse = false
      this.events = new Map()
      this.sent = []
      this.webContents = {
        id: nextId++,
        on: (event, callback) => this.events.set('wc:' + event, callback),
        setFrameRate() {},
        openDevTools() {},
        send: (...args) => this.sent.push(args),
      }
      windows.push(this)
    }
    isDestroyed() { return this.destroyed }
    isVisible() { return this.visible }
    getBounds() { return { ...this.bounds } }
    setBounds(next) { this.bounds = { ...next } }
    setShape(rects) { this.shape = JSON.parse(JSON.stringify(rects)) }
    setIgnoreMouseEvents(ignore) { this.ignoresMouse = ignore }
    setAlwaysOnTop() {}
    loadURL(url) { this.url = url }
    once(event, callback) { this.events.set(event, callback) }
    on(event, callback) { this.events.set(event, callback) }
    showInactive() { this.visible = true }
    hide() { this.visible = false }
    moveTop() {}
    focus() {}
    close() { this.destroyed = true; this.events.get('closed')?.() }
  }

  class PanelWindowStub {
    constructor(options) {
      this.options = options
      this.bounds = { x: options.x ?? 0, y: options.y ?? 0, width: options.width ?? 292, height: options.height ?? 420 }
      this.destroyed = false
      this.visible = false
      this.shape = []
      this.ignoresMouse = false
      this.events = new Map()
      this.contentsEvents = new Map()
      this.sent = []
      this.webContents = {
        id: nextId++,
        on: (event, callback) => this.contentsEvents.set(event, callback),
        setFrameRate() {},
        openDevTools() {},
        send: (...args) => this.sent.push(args),
      }
      panelWindows.push(this)
    }
    isDestroyed() { return this.destroyed }
    isVisible() { return this.visible }
    getBounds() { return { ...this.bounds } }
    setBounds(next) { this.bounds = { ...next } }
    setShape(rects) { this.shape = JSON.parse(JSON.stringify(rects)) }
    setIgnoreMouseEvents(ignore) { this.ignoresMouse = ignore }
    setAlwaysOnTop() {}
    setVisibleOnAllWorkspaces() {}
    isAlwaysOnTop() { return true }
    isFocused() { return false }
    loadURL(url) { this.url = url; this.loaded = true }
    once(event, callback) { this.events.set(event, callback) }
    on(event, callback) { this.events.set(event, callback) }
    showInactive() { this.visible = true }
    hide() { this.visible = false }
    moveTop() {}
    focus() {}
    destroy() {
      this.destroyed = true
      this.visible = false
    }
    loadedPage() { this.contentsEvents.get('did-finish-load')?.() }
  }

  const display = { workArea: AREA, bounds: AREA, scaleFactor: 1, displayFrequency: 60, id: 1 }
  const pets = createPetRegistry()
  const states = pigIds.map((pigId, index) => createPetState({
    pigId, token: `token-${String.fromCharCode(97 + index)}`, primary: index === 0, multiPig: true,
  }))
  for (const pet of states) pets.add(pet)
  const primary = states[0]
  const second = states[1] ?? null

  const extensionWindow = { current: () => null, owns: () => false }
  const sandbox = {
    ...geometry, createResizeShape, pointerHitsShape, dragHeartbeatExpired, validDragOrigin,
    SHOW_FALLBACK_MS, createShowGate, auxiliaryWindowOptions, createPetWindow,
    process: { platform: 'linux', env: {} }, BrowserWindow: WindowStub, FRAME_CAP: 0, HERE: '.',
    pets, primaryPet: () => pets.primary(), getPetWindow: () => pets.primary()?.window ?? null,
    panel: { followPig() {}, reanchorPanel() {}, focusLeft() {}, close: why => closedPanel.push(why), ensure() {}, forgetTarget() {} },
    pigSessions: new Map(states.map(pet => [pet.pigId, pet.token])), quitting: false,
    BOUNDS_TOLERANCE: 2, FALLBACK_CONTENT: { width: 132, height: 152 },
    startupUpdateToken: null, startupSetupComplete: false, startupRendererLoaded: false, startupWindowWasVisible: false,
    readWindowState: async () => null, pigDisplay: () => display, join: (...parts) => parts.join('/'),
    screen: { getCursorScreenPoint: () => cursor, getAllDisplays: () => [display],
      getDisplayMatching: () => display, getDisplayNearestPoint: () => display, getPrimaryDisplay: () => display },
    setInterval: (callback, delay) => { const timer = { callback, delay, active: true }; intervals.push(timer); return timer },
    clearInterval: timer => { if (timer) timer.active = false },
    setTimeout() {},
    log() {},
    followPig() {}, reanchorPanel() {}, scheduleWindowStateSave() {},
    closePanel: why => closedPanel.push(why), ensurePanelWindow() {},
    ...(panel ? {
      createPanelWindow, panelContentRect, panelViewportSize, panelAnchorFor, panelBoundsFor,
      panelReferenceFor, panelToggleAction, pigScreenBox, PANEL_FALLBACK,
      panelWindow: null,
      getPanelWindow: () => panelWindow?.current() ?? null,
      fromPage: event => pets.bySender(event?.sender) !== null || panelWindow?.current()?.webContents === event?.sender,
      extensionWindow,
      extensionLayer: { isFocused: () => false, sync() {} },
      toPages() {},
    } : {}),
    startupInputTrace: createStartupTrace(() => {}),
    ipcMain: { on: (channel, callback) => handlers.set(channel, callback) },
    desktopRuntime: {
      getHost: () => ({ closePigSession: token => { closeCalls.push(token); return Promise.resolve({ ok: true }) } }),
    },
    sent,
  }
  sandbox.desktopLifecycle = desktopLifecycleStateAdapter(sandbox)
  const context = createContext(sandbox)

  const traceStart = source.indexOf('function startupApiErrorKind(error)')
  const traceEnd = source.indexOf('\nasync function flushLogs', traceStart)
  const fromPet = source.indexOf('function fromPet(event)')
  const fromPetEnd = source.indexOf('\n/** 发给所有窗口的页面', fromPet)
  const engineStart = source.indexOf('function workAreaFor(bounds)')
  const engineEnd = source.indexOf('\n// 面板窗口：', engineStart)
  assert.ok(traceStart > 0 && traceEnd > traceStart && fromPet > 0 && fromPetEnd > fromPet && engineStart > 0 && engineEnd > engineStart)
  runInContext(source.slice(traceStart, traceEnd), context)
  runInContext(source.slice(fromPet, fromPetEnd), context)
  runInContext(source.slice(engineStart, engineEnd), context)
  let panelController = null
  if (panel) {
    panelController = createPanelController({
      panelWindow: { isReady: () => panelWindow?.current()?.loaded === true, ensure: () => panelWindow.ensure(),
        destroy: () => panelWindow.destroy(), forget: () => panelWindow.forget() },
      getPanelWindow: () => panelWindow?.current() ?? null,
      screen: sandbox.screen,
      BrowserWindow: WindowStub,
      platform: 'linux',
      pets,
      primaryPet: () => pets.primary(),
      getPetWindow: () => pets.primary()?.window ?? null,
      extensionWindow,
      extensionLayer: { isFocused: () => false, sync() {} },
      ipcMain: sandbox.ipcMain,
      petForEvent: event => context.petForEvent(event),
      fromPage: event => context.fromPage(event),
      toPages() {},
      log() {},
      traceSetIgnoreMouseEvents() {},
      setTimeout() {},
      setInterval: sandbox.setInterval,
      clearInterval: sandbox.clearInterval,
    })
    registerPanelIpc({
      ipcMain: sandbox.ipcMain,
      fromPage: event => context.fromPage(event),
      getPanelWindow: () => panelWindow?.current() ?? null,
      extensionWindow,
      panel: panelController,
    })
    sandbox.panel = panelController
    panelWindow = createPanelWindow({
      BrowserWindow: PanelWindowStub,
      options: { x: 0, y: 0, width: PANEL_FALLBACK.width, height: PANEL_FALLBACK.height, show: false },
      url: () => panelController.url(),
      log() {},
      onCreated: () => panelController.viewCreated(),
    })
    sandbox.panelWindow = panelWindow
    panelController.ensure()
  }
  for (let index = 0; index < states.length; index += 1) {
    await runInContext(`createPigWindow(pets.all()[${index}])`, context)
  }

  const send = (window, channel, payload) => {
    const event = { sender: window.webContents, returnValue: undefined }
    handlers.get(channel)(event, payload)
    return event.returnValue
  }
  return {
    windows, panelWindows, pets, states, primary, second, closeCalls, closedPanel, context,
    panelUrl: () => panelController?.url() ?? null,
    panelWindow: () => panelWindow?.current() ?? null,
    panelOpen: () => panelController?.isOpen() === true,
    panelTargetId: () => panelController?.targetPet()?.pigId ?? null,
    send,
    place: (window, request) => send(window, 'piggy:place', request),
    content: (window, value) => send(window, 'piggy:content', value),
    dragStart: (window, pig) => send(window, 'piggy:drag:start', pig),
    dragHeartbeat: window => send(window, 'piggy:drag:heartbeat'),
    dragEnd: window => send(window, 'piggy:drag:end'),
    cursor(x, y) { cursor = { x, y } },
    poll() { for (const timer of intervals.filter(timer => timer.active && timer.delay === 16)) timer.callback() },
    snapshot(value, token) { return runInContext(`deliverSnapshot(${JSON.stringify(value)}, ${JSON.stringify(token)})`, context) },
  }
}

test('两只 pet 窗口的 content/place 各自算自己的窗口，互不覆盖', async () => {
  const shell = await harness()
  const [a, b] = shell.windows
  assert.notEqual(a, b)
  assert.match(a.url, /index\.html\?pig=pig-a$/)
  assert.match(b.url, /index\.html\?pig=pig-b$/)
  assert.equal(a.options.webPreferences.additionalArguments.includes('--piggy-primary=1'), true)
  assert.equal(b.options.webPreferences.additionalArguments.includes('--piggy-primary=1'), false)
  assert.ok(b.getBounds().x <= a.getBounds().x - 100, 'secondary pet window starts cascaded away from the primary')

  const bBefore = b.getBounds()
  shell.place(a, { bounds: { x: 100, y: 120, width: 320, height: 300 }, shape: SHAPE, pig: PIG })
  assert.deepEqual(a.getBounds(), { x: 100, y: 120, width: 320, height: 300 })
  assert.deepEqual(b.getBounds(), bBefore)

  const aAfterPlace = a.getBounds()
  shell.place(b, { bounds: { x: 600, y: 400, width: 300, height: 280 }, shape: SHAPE, pig: PIG })
  assert.deepEqual(b.getBounds(), { x: 600, y: 400, width: 300, height: 280 })
  assert.deepEqual(a.getBounds(), aAfterPlace)

  shell.content(a, { width: 220, height: 240, pigWindow: { x: 20, y: 20 }, pig: { width: 56, height: 56 }, pigNow: { x: 20, y: 20 } })
  assert.notDeepEqual(a.getBounds(), aAfterPlace)
  assert.deepEqual(b.getBounds(), { x: 600, y: 400, width: 300, height: 280 })
  // 快照状态也分开了：A 的内容不会写进 B 的 lastContent。
  assert.notDeepEqual(shell.primary.lastContent, shell.second.lastContent)
})

test('四只 pet 窗口按 roster 顺序 cascade 不重叠，content/place 各自独立', async () => {
  const shell = await harness({ pigIds: ['pig-a', 'pig-b', 'pig-c', 'pig-d'] })
  assert.equal(shell.windows.length, 4)
  const ids = ['pig-a', 'pig-b', 'pig-c', 'pig-d']
  for (const [index, window] of shell.windows.entries()) {
    assert.match(window.url, new RegExp(`index\\.html\\?pig=${ids[index]}$`))
    assert.equal(window.options.webPreferences.additionalArguments.includes('--piggy-primary=1'), index === 0)
  }
  // 首启空窗口两两不相交（cascade 步长要盖过兜底窗口尺寸）。
  for (let left = 0; left < shell.windows.length; left += 1) {
    for (let right = left + 1; right < shell.windows.length; right += 1) {
      const a = shell.windows[left].getBounds()
      const b = shell.windows[right].getBounds()
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      assert.ok(overlapX <= 0 || overlapY <= 0, `windows ${left}/${right} overlap: ${JSON.stringify([a, b])}`)
    }
  }

  const spots = [
    { x: 100, y: 120, width: 320, height: 300 },
    { x: 600, y: 120, width: 300, height: 280 },
    { x: 100, y: 600, width: 300, height: 280 },
    { x: 600, y: 600, width: 300, height: 280 },
  ]
  for (const [index, window] of shell.windows.entries()) {
    shell.place(window, { bounds: spots[index], shape: SHAPE, pig: PIG })
  }
  for (const [index, window] of shell.windows.entries()) assert.deepEqual(window.getBounds(), spots[index])

  // 第三只上报内容只改自己的窗口。
  const before = shell.windows.map(window => window.getBounds())
  shell.content(shell.windows[2], { width: 220, height: 240, pigWindow: { x: 20, y: 20 }, pig: { width: 56, height: 56 }, pigNow: { x: 20, y: 20 } })
  assert.notDeepEqual(shell.windows[2].getBounds(), before[2])
  for (const index of [0, 1, 3]) assert.deepEqual(shell.windows[index].getBounds(), before[index])
  for (const [index, pet] of shell.states.entries()) assert.equal(shell.pets.byPig(pet.pigId), pet, `registry keeps ${index}`)
})

test('四只猪的拖动与命中互不串，贴边只动自己', async () => {
  const shell = await harness({ pigIds: ['pig-a', 'pig-b', 'pig-c', 'pig-d'] })
  const [a, b, c, d] = shell.windows
  const spots = [
    { x: 100, y: 120, width: 320, height: 300 },
    { x: 600, y: 120, width: 300, height: 280 },
    { x: 100, y: 600, width: 300, height: 280 },
    { x: 600, y: 600, width: 300, height: 280 },
  ]
  for (const [index, window] of shell.windows.entries()) {
    shell.place(window, { bounds: spots[index], shape: SHAPE, hitShape: SHAPE, pig: PIG })
  }

  shell.cursor(120, 140)
  shell.poll()
  assert.deepEqual([a.ignoresMouse, b.ignoresMouse, c.ignoresMouse, d.ignoresMouse], [false, true, true, true])
  shell.cursor(620, 620)
  shell.poll()
  assert.deepEqual([a.ignoresMouse, b.ignoresMouse, c.ignoresMouse, d.ignoresMouse], [true, true, true, false])

  shell.cursor(120, 140)
  shell.dragStart(a, PIG)
  assert.notEqual(shell.primary.dragSession, null)
  for (const pet of [shell.second, shell.states[2], shell.states[3]]) assert.equal(pet.dragSession, null)

  const untouched = [b, c, d].map(window => window.getBounds())
  shell.cursor(160, 170)
  shell.dragHeartbeat(a)
  assert.deepEqual(a.getBounds(), { x: 140, y: 150, width: 320, height: 300 })
  assert.deepEqual([b, c, d].map(window => window.getBounds()), untouched)

  // 拖到屏幕外沿：只夹取 A，其它三只窗口和命中都不变。
  shell.cursor(-40, -30)
  shell.dragHeartbeat(a)
  assert.deepEqual([b, c, d].map(window => window.getBounds()), untouched)
  shell.dragEnd(a)
  assert.equal(shell.primary.dragSession, null)
  assert.deepEqual([b, c, d].map(window => window.getBounds()), untouched)
  shell.cursor(620, 620)
  shell.poll()
  assert.deepEqual([a.ignoresMouse, b.ignoresMouse, c.ignoresMouse, d.ignoresMouse], [true, true, true, false])
})

test('关闭第三只只释放自己的 session，主猪关闭不自动扶正其他猪', async () => {
  const shell = await harness({ pigIds: ['pig-a', 'pig-b', 'pig-c', 'pig-d'] })
  const [a, b, c, d] = shell.windows
  const untouched = [a, b, d].map(window => window.getBounds())
  c.close()
  assert.deepEqual(shell.closeCalls, ['token-c'])
  assert.equal(shell.pets.byPig('pig-c'), null)
  assert.equal(shell.pets.bySender(c.webContents), null)
  assert.equal(shell.pets.size(), 3)
  assert.deepEqual([a, b, d].map(window => window.getBounds()), untouched)
  assert.equal(shell.place(c, { bounds: { x: 10, y: 10, width: 100, height: 100 } }), null)

  a.close()
  assert.deepEqual(shell.closeCalls, ['token-c', 'token-a'])
  assert.equal(shell.pets.primary(), null, '第一版不把第二只自动升为主猪')
  assert.deepEqual(shell.closedPanel, ['pet-closed'])
  assert.deepEqual([b, d].map(window => window.getBounds()), [untouched[1], untouched[2]])
})


test('右键第二只把同一个面板改绑到它，切回主猪后恢复默认面板页', async () => {
  const shell = await harness({ pigIds: ['pig-a', 'pig-b', 'pig-c'], panel: true })
  const [a, b] = shell.windows
  assert.match(shell.panelUrl(), /index\.html\?pig=pig-a$/, '冷启动面板仍按主猪加载')

  shell.place(b, { bounds: { x: 600, y: 400, width: 300, height: 280 }, shape: SHAPE, pig: PIG })
  const aBefore = a.getBounds()
  a.sent.length = 0
  b.sent.length = 0
  shell.send(b, 'piggy:panel:toggle', { open: true, pig: { x: 20, y: 20, width: 56, height: 56 } })
  assert.equal(shell.panelOpen(), true)
  assert.equal(shell.panelTargetId(), 'pig-b')
  assert.match(shell.panelUrl(), /index\.html\?pig=pig-b$/, '面板页面必须按第二只猪的 session 重新加载')
  assert.equal(shell.panelWindows.length, 2, '旧主猪面板页被销毁，而不是只换位置')
  assert.equal(a.sent.some(([channel, message]) => channel === 'piggy:panel' && message.type === 'open'), false)
  assert.deepEqual(a.getBounds(), aBefore)

  const panel = shell.panelWindow()
  panel.loadedPage()
  shell.send(panel, 'piggy:panel:size', { width: 292, height: 370, fixedViewport: true })
  assert.equal(panel.visible, true)
  assert.equal(b.sent.some(([channel, message]) => channel === 'piggy:panel' && message.type === 'open'), true)
  const nearB = panel.getBounds()
  assert.ok(nearB.y >= 400 + 20 + 56 || nearB.y + nearB.height <= 400 + 20, `面板贴在第二只猪的上方或下方: ${JSON.stringify(nearB)}`)

  shell.place(b, { bounds: { x: 300, y: 100, width: 300, height: 280 }, shape: SHAPE, pig: PIG })
  assert.notDeepEqual(panel.getBounds(), nearB, '面板跟随它服务的那只猪')
  assert.deepEqual(a.getBounds(), aBefore, '主猪窗口不被第二只猪的面板拖动')

  a.sent.length = 0
  shell.send(a, 'piggy:panel:toggle', { open: true, pig: { x: 20, y: 20, width: 56, height: 56 } })
  assert.equal(shell.panelTargetId(), 'pig-a')
  assert.match(shell.panelUrl(), /index\.html\?pig=pig-a$/, '切回主猪按主猪 session 加载')
  assert.equal(shell.panelWindows.length, 3)
  const back = shell.panelWindow()
  back.loadedPage()
  shell.send(back, 'piggy:panel:size', { width: 292, height: 370, fixedViewport: true })
  assert.equal(back.visible, true)
  assert.equal(a.sent.some(([channel, message]) => channel === 'piggy:panel' && message.type === 'open'), true)
})

test('关掉面板服务的那只猪会收起面板，主猪和其他猪不受影响', async () => {
  const shell = await harness({ pigIds: ['pig-a', 'pig-b', 'pig-c'], panel: true })
  const [a, b, c] = shell.windows
  shell.place(b, { bounds: { x: 600, y: 400, width: 300, height: 280 }, shape: SHAPE, pig: PIG })
  shell.send(b, 'piggy:panel:toggle', { open: true, pig: { x: 20, y: 20, width: 56, height: 56 } })
  const panel = shell.panelWindow()
  panel.loadedPage()
  shell.send(panel, 'piggy:panel:size', { width: 292, height: 370, fixedViewport: true })
  assert.equal(panel.visible, true)

  const untouched = [a, c].map(window => window.getBounds())
  b.close()
  assert.equal(shell.panelOpen(), false)
  assert.equal(panel.visible, false)
  assert.equal(shell.panelTargetId(), 'pig-a', '目标关闭后回落到还活着的主猪')
  assert.deepEqual(shell.closeCalls, ['token-b'])
  assert.deepEqual([a, c].map(window => window.getBounds()), untouched)
})

test('主猪关闭会收起面板；第一版不把第二只自动升为主猪', async () => {
  const shell = await harness({ pigIds: ['pig-a', 'pig-b'], panel: true })
  const [a, b] = shell.windows
  shell.place(b, { bounds: { x: 600, y: 400, width: 300, height: 280 }, shape: SHAPE, pig: PIG })
  shell.send(b, 'piggy:panel:toggle', { open: true, pig: { x: 20, y: 20, width: 56, height: 56 } })
  const panel = shell.panelWindow()
  panel.loadedPage()
  shell.send(panel, 'piggy:panel:size', { width: 292, height: 370, fixedViewport: true })
  assert.equal(panel.visible, true)

  const bBefore = b.getBounds()
  a.close()
  assert.equal(shell.panelOpen(), false)
  assert.equal(panel.visible, false)
  assert.equal(shell.pets.primary(), null)
  assert.equal(shell.pets.byPig('pig-b'), shell.second)
  assert.deepEqual(b.getBounds(), bBefore)
})


test('一只猪拖动时，另一只的拖动会话和窗口都不动', async () => {
  const shell = await harness()
  const [a, b] = shell.windows
  shell.place(a, { bounds: { x: 100, y: 120, width: 320, height: 300 }, shape: SHAPE, pig: PIG })
  shell.place(b, { bounds: { x: 600, y: 400, width: 300, height: 280 }, shape: SHAPE, pig: PIG })

  shell.cursor(120, 140)
  shell.dragStart(a, PIG)
  assert.notEqual(shell.primary.dragSession, null)
  assert.equal(shell.second.dragSession, null)

  const bBefore = b.getBounds()
  shell.cursor(160, 170)
  shell.dragHeartbeat(a)
  assert.deepEqual(a.getBounds(), { x: 140, y: 150, width: 320, height: 300 })
  assert.deepEqual(b.getBounds(), bBefore)
  assert.equal(shell.second.dragSession, null)

  shell.dragEnd(a)
  assert.equal(shell.primary.dragSession, null)
  assert.equal(shell.second.dragSession, null)
  assert.deepEqual(b.getBounds(), bBefore)
})

test('两只猪的命中轮询互不串，关闭一只只影响自己', async () => {
  const shell = await harness()
  const [a, b] = shell.windows
  shell.place(a, { bounds: { x: 100, y: 120, width: 320, height: 300 }, shape: SHAPE, hitShape: SHAPE, pig: PIG })
  shell.place(b, { bounds: { x: 600, y: 400, width: 300, height: 280 }, shape: SHAPE, hitShape: SHAPE, pig: PIG })

  shell.cursor(120, 140)
  shell.poll()
  assert.equal(a.ignoresMouse, false)
  assert.equal(b.ignoresMouse, true)

  shell.cursor(620, 420)
  shell.poll()
  assert.equal(a.ignoresMouse, true)
  assert.equal(b.ignoresMouse, false)

  const aBefore = a.getBounds()
  b.close()
  assert.deepEqual(shell.closeCalls, ['token-b'])
  assert.equal(shell.pets.byPig('pig-b'), null)
  assert.equal(shell.pets.bySender(b.webContents), null)
  assert.equal(shell.pets.byPig('pig-a'), shell.primary)
  assert.deepEqual(a.getBounds(), aBefore)
  // 已关闭窗口的迟到消息被 registry 拒绝，不会改到主猪。
  assert.equal(shell.place(b, { bounds: { x: 10, y: 10, width: 100, height: 100 } }), null)
  assert.deepEqual(a.getBounds(), aBefore)
})

test('快照按 token 只发给对应猪；无 token 回主猪；未知 token 丢弃', async () => {
  const shell = await harness()
  const [a, b] = shell.windows
  a.sent.length = 0
  b.sent.length = 0

  assert.equal(shell.snapshot('{"pig":{"name":"乙"}}', 'token-b'), true)
  assert.deepEqual(b.sent.filter(([channel]) => channel === 'piggy:state-changed').map(([, value]) => value), ['{"pig":{"name":"乙"}}'])
  assert.equal(a.sent.some(([channel]) => channel === 'piggy:state-changed'), false)

  shell.snapshot('{"pig":{"name":"甲"}}', null)
  assert.deepEqual(a.sent.filter(([channel]) => channel === 'piggy:state-changed').map(([, value]) => value), ['{"pig":{"name":"甲"}}'])

  a.sent.length = 0
  b.sent.length = 0
  assert.equal(shell.snapshot('{"pig":{}}', 'token-missing'), false)
  assert.equal(a.sent.length, 0)
  assert.equal(b.sent.length, 0)
})

test('registry 映射按 pigId / webContents.id / token 三种键都能找到同一只猪', async () => {
  const shell = await harness()
  const [a, b] = shell.windows
  assert.equal(shell.pets.byPig('pig-a'), shell.primary)
  assert.equal(shell.pets.byPig('pig-b'), shell.second)
  assert.equal(shell.pets.byToken('token-a'), shell.primary)
  assert.equal(shell.pets.byToken('token-b'), shell.second)
  assert.equal(shell.pets.bySender(a.webContents), shell.primary)
  assert.equal(shell.pets.bySender(b.webContents), shell.second)
  assert.equal(shell.pets.primary(), shell.primary)
  assert.equal(shell.pets.size(), 2)
})

test('主猪先登记、后补 pigId 时再次 add 仍能建立 pigId 映射', () => {
  const registry = createPetRegistry()
  const pet = createPetState({ primary: true })
  registry.add(pet)
  assert.equal(registry.byPig('pig-late'), null)
  pet.pigId = 'pig-late'
  registry.add(pet)
  assert.equal(registry.byPig('pig-late'), pet)
  assert.equal(registry.primary(), pet)
  assert.equal(registry.size(), 1)
})

test('窗口重建后旧 webContents.id 的映射被移除，迟到消息不会落到新窗口', () => {
  const registry = createPetRegistry()
  const pet = createPetState({ pigId: 'pig-a', primary: true })
  pet.webContentsId = 41
  registry.add(pet)
  assert.equal(registry.bySender({ id: 41 }), pet)
  pet.webContentsId = 42
  registry.bindWindow(pet)
  assert.equal(registry.bySender({ id: 41 }), null)
  assert.equal(registry.bySender({ id: 42 }), pet)
  registry.remove(pet)
  assert.equal(registry.bySender({ id: 42 }), null)
})

/** 只跑 createPetWindows 的计划/回滚逻辑，窗口创建用桩。 */
function planHarness({ roster, failPig = null }) {
  const pets = createPetRegistry()
  const primary = createPetState({ primary: true })
  pets.add(primary)
  const pigSessions = new Map()
  const opened = []
  const closed = []
  const windows = []
  const logs = []
  const extensionWindow = { current: () => null, owns: () => false }
  const sandbox = {
    ownerDocumentConfig: { ownerId: 'owner-1', pigId: 'pig-c' },
    ownerPigRuntimeSupported: true,
    MAX_PIG_WINDOWS: 4,
    pets, primaryPetState: primary, pigSessions,
    multiPigActive: false,
    desktopRuntime: { getHost: () => ({
      async listOwnerPigs() { return { ownerId: 'owner-1', pigs: roster.map(pigId => ({ pigId })) } },
      async openPigSession(pigId) {
        if (pigId === failPig) throw new Error('session failed: ' + pigId)
        const token = 'token-' + pigId
        opened.push(pigId)
        return { pigId, token }
      },
      async closePigSession(token) { closed.push(token); return { ok: true } },
    }) },
    createPetState,
    createWindow: async () => { windows.push(primary.pigId ?? 'legacy') },
    createPigWindow: async pet => { windows.push(pet.pigId) },
    log: (...parts) => logs.push(parts),
    desktopLifecycle: { quitting: false },
  }
  const petRoster = createPetRoster({
    getOwnerDocumentConfig: () => sandbox.ownerDocumentConfig,
    isOwnerPigRuntimeSupported: () => sandbox.ownerPigRuntimeSupported,
    getHost: () => sandbox.desktopRuntime.getHost(),
    pets, primaryPetState: primary, pigSessions,
    createWindow: sandbox.createWindow,
    createPigWindow: sandbox.createPigWindow,
    closePetSession: pet => { if (pet.token !== null) closed.push(pet.token) },
    createPetState,
    maxPigWindows: sandbox.MAX_PIG_WINDOWS,
    isQuitting: () => false,
    isMultiPigActive: () => sandbox.multiPigActive,
    setMultiPigActive: value => { sandbox.multiPigActive = value },
    log: sandbox.log,
  })
  sandbox.createPetWindows = () => petRoster.createPetWindows()
  const context = createContext(sandbox)
  return { sandbox, pets, primary, pigSessions, opened, closed, windows, logs, context }
}

test('roster > 1 时最多开 4 只，主猪排第一，未开窗口的会话回滚', async () => {
  const shell = planHarness({ roster: ['pig-a', 'pig-b', 'pig-c', 'pig-d', 'pig-e'] })
  await runInContext('createPetWindows()', shell.context)
  assert.equal(shell.sandbox.multiPigActive, true)
  assert.deepEqual(shell.opened, ['pig-c', 'pig-a', 'pig-b', 'pig-d'])
  assert.deepEqual([...shell.pigSessions.keys()], ['pig-c', 'pig-a', 'pig-b', 'pig-d'])
  assert.deepEqual(shell.windows, ['pig-c', 'pig-a', 'pig-b', 'pig-d'])
  assert.equal(shell.pets.primary(), shell.primary)
  assert.equal(shell.primary.pigId, 'pig-c')
  assert.equal(shell.primary.token, 'token-pig-c')
  assert.equal(shell.pets.all().length, 4)
  assert.deepEqual(shell.closed, [])
})

test('任一 session 创建失败时关闭已开会话并退回单窗口', async () => {
  const shell = planHarness({ roster: ['pig-a', 'pig-b', 'pig-c'], failPig: 'pig-b' })
  await runInContext('createPetWindows()', shell.context)
  assert.equal(shell.sandbox.multiPigActive, false)
  assert.deepEqual(shell.opened, ['pig-c', 'pig-a'])
  // c、a 已开；b 失败后回滚 c、a，不再尝试后面的猪。
  assert.deepEqual(shell.closed, ['token-pig-c', 'token-pig-a'])
  assert.deepEqual([...shell.pigSessions.keys()], [])
  assert.deepEqual(shell.windows, ['legacy'])
  assert.equal(shell.pets.all().length, 1)
  assert.equal(shell.primary.pigId, null)
  assert.equal(shell.primary.token, null)
  assert.ok(shell.logs.some(parts => String(parts[0]).includes('falling back to one window')))
})
