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
import { createPetWindow } from '../lib/pet-window.js'
import { createPetRegistry, createPetState } from '../lib/pet-instance.js'
import { createStartupTrace } from '../lib/startup-trace.js'
import { desktopLifecycleStateAdapter } from './helpers/desktop-lifecycle-adapter.js'

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
const AREA = { x: 0, y: 0, width: 1920, height: 1040 }
const SHAPE = [{ x: 20, y: 20, width: 80, height: 80 }]
const PIG = { x: 20, y: 20, width: 56, height: 56 }

async function harness() {
  const windows = []
  const handlers = new Map()
  const intervals = []
  const sent = []
  const closeCalls = []
  const closedPanel = []
  let cursor = { x: 0, y: 0 }
  let nextId = 10

  class WindowStub {
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

  const display = { workArea: AREA, bounds: AREA, scaleFactor: 1, displayFrequency: 60, id: 1 }
  const pets = createPetRegistry()
  const primary = createPetState({ pigId: 'pig-a', token: 'token-a', primary: true, multiPig: true })
  const second = createPetState({ pigId: 'pig-b', token: 'token-b', multiPig: true })
  pets.add(primary)
  pets.add(second)

  const sandbox = {
    ...geometry, createResizeShape, pointerHitsShape, dragHeartbeatExpired, validDragOrigin,
    SHOW_FALLBACK_MS, createShowGate, auxiliaryWindowOptions, createPetWindow,
    process: { platform: 'linux', env: {} }, BrowserWindow: WindowStub, FRAME_CAP: 0, HERE: '.',
    pets, primaryPet: () => pets.primary(), getPetWindow: () => pets.primary()?.window ?? null,
    pigSessions: new Map([['pig-a', 'token-a'], ['pig-b', 'token-b']]), quitting: false,
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
    startupInputTrace: createStartupTrace(() => {}),
    ipcMain: { on: (channel, callback) => handlers.set(channel, callback) },
    desktopRuntime: {
      getHost: () => ({ closePigSession: token => { closeCalls.push(token); return Promise.resolve({ ok: true }) } }),
    },
    a: primary, b: second, sent,
  }
  sandbox.desktopLifecycle = desktopLifecycleStateAdapter(sandbox)
  const context = createContext(sandbox)

  const traceStart = source.indexOf('function startupApiErrorKind(error)')
  const traceEnd = source.indexOf('\nasync function flushLogs', traceStart)
  const fromPet = source.indexOf('function fromPet(event)')
  const fromPetEnd = source.indexOf('\n/** 发给所有窗口的页面', fromPet)
  const engineStart = source.indexOf('function workAreaFor(bounds)')
  const engineEnd = source.indexOf('\n// ---------------------------------------------------------------------------\n// 面板窗口', engineStart)
  assert.ok(traceStart > 0 && traceEnd > traceStart && fromPet > 0 && fromPetEnd > fromPet && engineStart > 0 && engineEnd > engineStart)
  runInContext(source.slice(traceStart, traceEnd), context)
  runInContext(source.slice(fromPet, fromPetEnd), context)
  runInContext(source.slice(engineStart, engineEnd), context)
  await runInContext('createPigWindow(a)', context)
  await runInContext('createPigWindow(b)', context)

  const send = (window, channel, payload) => {
    const event = { sender: window.webContents, returnValue: undefined }
    handlers.get(channel)(event, payload)
    return event.returnValue
  }
  return {
    windows, pets, primary, second, closeCalls, closedPanel, context,
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
  const context = createContext(sandbox)
  const start = source.indexOf('/** 和 owner document / preload 同一套 ID 白名单。 */')
  const end = source.indexOf('/** Refresh native pixel/DIP caches', start)
  assert.ok(start > 0 && end > start)
  runInContext(source.slice(start, end), context)
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
