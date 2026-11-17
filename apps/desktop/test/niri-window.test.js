// @ts-check
/** niri 适配的纯逻辑：检测、socket、坐标换算、认窗口、合并移动、面板避让。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  PANEL_TITLE, PET_TITLE, chooseWindow, detectNiri, findSocket,
  niriWorkAreas, outputAtPoint, petWindowTitle, screenWindows,
} from '../lib/niri-window.js'
import { createNiriWindow } from '../lib/niri-client.js'
import { panelBoundsClearOfPig, pigVisibleBox } from '../lib/panel-geometry.js'
import { createWindowSurface } from '../lib/window-surface.js'
import { createPanelController } from '../lib/panel-controller.js'
import { createDragEngine } from '../lib/drag-engine.js'

const DISPLAYS = [
  { id: 1, internal: false, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
  { id: 2, internal: true, bounds: { x: 1920, y: 0, width: 2560, height: 1440 }, workArea: { x: 1920, y: 0, width: 2560, height: 1440 } },
]
const OUTPUTS = {
  'HDMI-A-1': { name: 'HDMI-A-1', logical: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } },
  'eDP-1': { name: 'eDP-1', logical: { x: 1920, y: 0, width: 1706, height: 960, scale: 1.5 } },
}
const WORKSPACES = [
  { id: 1, output: 'eDP-1' },
  { id: 2, output: 'HDMI-A-1' },
]

function rawWindow(overrides) {
  return {
    id: 10,
    title: PET_TITLE,
    app_id: 'dsh-piggy-desktop',
    workspace_id: 2,
    is_floating: true,
    layout: {
      tile_pos_in_workspace_view: [100, 50],
      window_size: [368, 344],
      tile_size: [368, 344],
    },
    ...overrides,
  }
}

test('niri 标题：主猪稳定，多猪带 pigId', () => {
  assert.equal(petWindowTitle(null, true), PET_TITLE)
  assert.equal(petWindowTitle('pig-a', true), PET_TITLE)
  assert.equal(petWindowTitle('pig-a', false), 'dsh-piggy-pet-pig-a')
  assert.equal(petWindowTitle('bad id/with space', false), 'dsh-piggy-pet-bad_id_with_space')
  assert.equal(PANEL_TITLE, 'dsh-piggy-panel')
})

test('detectNiri：只在 Linux + niri 会话且找得到 socket 时启用', () => {
  const io = {
    readdirSync: () => [{ name: 'niri.wayland-1.100.sock' }, { name: 'pipewire-0' }],
    statSync: () => ({ mtimeMs: 10 }),
    existsSync: () => true,
  }
  const base = { XDG_RUNTIME_DIR: '/run/user/1000' }
  assert.equal(detectNiri({ ...base, XDG_CURRENT_DESKTOP: 'niri' }, { platform: 'linux', io }).enabled, true)
  assert.equal(detectNiri({ ...base, XDG_CURRENT_DESKTOP: 'GNOME:ubuntu' }, { platform: 'linux', io }).enabled, false)
  assert.equal(detectNiri({ ...base, XDG_CURRENT_DESKTOP: 'GNOME', NIRI_SOCKET: '/run/user/1000/niri.sock' }, { platform: 'linux', io }).enabled, true)
  assert.equal(detectNiri({ ...base, XDG_CURRENT_DESKTOP: 'niri' }, { platform: 'darwin', io }).enabled, false)
  assert.equal(detectNiri({ ...base, XDG_CURRENT_DESKTOP: 'niri', PIGGY_NIRI: '0' }, { platform: 'linux', io }).enabled, false)
  assert.equal(detectNiri({ ...base, PIGGY_NIRI: '1' }, { platform: 'linux', io }).enabled, true)
  const missing = { readdirSync: () => [], statSync: () => ({ mtimeMs: 0 }), existsSync: () => false }
  const result = detectNiri({ ...base, XDG_CURRENT_DESKTOP: 'niri' }, { platform: 'linux', io: missing })
  assert.equal(result.enabled, false)
  assert.equal(result.reason, 'no-socket')
})

test('findSocket：NIRI_SOCKET 优先，否则扫 XDG_RUNTIME_DIR 取最新 socket', () => {
  const io = {
    existsSync: path => path === '/run/user/1000/niri.explicit.sock',
    readdirSync: () => [
      { name: 'niri.wayland-1.100.sock' },
      { name: 'niri.wayland-2.200.sock' },
      { name: 'niri.sock' },
      { name: 'not-a-socket' },
    ],
    statSync: path => ({ mtimeMs: path.endsWith('2.200.sock') ? 200 : 100 }),
  }
  assert.equal(findSocket({ NIRI_SOCKET: '/run/user/1000/niri.explicit.sock', XDG_RUNTIME_DIR: '/run/user/1000' }, io), '/run/user/1000/niri.explicit.sock')
  assert.equal(findSocket({ XDG_RUNTIME_DIR: '/run/user/1000' }, io), '/run/user/1000/niri.wayland-2.200.sock')
  assert.equal(findSocket({}, io), null)
})

test('screenWindows：niri 逻辑坐标直接作为 DIP，不再乘输出 scale', () => {
  const windows = screenWindows([
    rawWindow(),
    rawWindow({ id: 11, title: 'on-edp', workspace_id: 1, layout: { tile_pos_in_workspace_view: [871.3333333333334, 70], window_size: [835, 890] } }),
    rawWindow({ id: 12, title: 'tiled', layout: { tile_pos_in_workspace_view: null, window_size: [100, 100] } }),
    rawWindow({ id: 13, title: 'unknown-output', workspace_id: 99 }),
  ], OUTPUTS, WORKSPACES, DISPLAYS)
  assert.equal(windows.length, 2)
  assert.deepEqual(windows[0].rect, { x: 100, y: 50, width: 368, height: 344 })
  assert.equal(windows[0].scale, 1)
  assert.equal(windows[0].isFloating, true)
  assert.deepEqual(windows[1].rect, { x: 2791, y: 70, width: 835, height: 890 })
  assert.equal(windows[1].scale, 1.5)
  assert.equal(windows[1].output, 'eDP-1')
})

test('niriWorkAreas / outputAtPoint：输出逻辑矩形用于工作区和跨屏判定', () => {
  assert.deepEqual(niriWorkAreas(OUTPUTS, DISPLAYS), [
    { x: 0, y: 0, width: 1920, height: 1080 },
    { x: 1920, y: 0, width: 1706, height: 960 },
  ])
  assert.equal(outputAtPoint(OUTPUTS, DISPLAYS, { x: 100, y: 100 })?.name, 'HDMI-A-1')
  assert.equal(outputAtPoint(OUTPUTS, DISPLAYS, { x: 2000, y: 100 })?.name, 'eDP-1')
})

test('chooseWindow：title 优先，其次按物理尺寸兜底；app_id 必须匹配', () => {
  const list = screenWindows([
    rawWindow({ id: 20, title: PET_TITLE }),
    rawWindow({ id: 21, title: 'page-title-overrode', layout: { tile_pos_in_workspace_view: [10, 10], window_size: [292, 420] } }),
    rawWindow({ id: 22, title: 'other-app', app_id: 'other', layout: { tile_pos_in_workspace_view: [0, 0], window_size: [368, 344] } }),
    rawWindow({ id: 23, title: 'panel-duplicate', is_floating: true, layout: { tile_pos_in_workspace_view: [20, 20], window_size: [292, 420] } }),
  ], OUTPUTS, WORKSPACES, DISPLAYS)
  assert.equal(chooseWindow(list, { title: PET_TITLE, appId: 'dsh-piggy-desktop' })?.id, 20)
  assert.equal(chooseWindow(list, { title: 'missing', appId: 'dsh-piggy-desktop', width: 292, height: 420 })?.id, 23)
  assert.equal(chooseWindow(list, { title: 'missing', appId: 'other', width: 368, height: 344 })?.id, 22)
  assert.equal(chooseWindow(list, { title: 'missing', appId: 'dsh-piggy-desktop', width: 999, height: 999 }), null)
})

test('createNiriWindow：逻辑像素增量合并，正负参数格式正确', () => {
  const queries = {
    windows: [rawWindow({ id: 30, title: PANEL_TITLE, workspace_id: 1, layout: { tile_pos_in_workspace_view: [871.3333333333334, 70], window_size: [292, 420] } })],
    outputs: OUTPUTS,
    workspaces: WORKSPACES,
  }
  const writes = []
  const client = createNiriWindow({
    socket: '/run/user/1000/niri.test.sock',
    env: { XDG_RUNTIME_DIR: '/run/user/1000' },
    getDisplays: () => DISPLAYS,
    execFileSync(command, args) {
      if (args[0] === 'msg' && args[1] === 'action') { writes.push({ command, args }); return '' }
      return JSON.stringify(queries[args.at(-1)])
    },
    execFile() { throw new Error('flushSync should be used in this test') },
    setTimeout() { return 1 },
    clearTimeout() {},
  })
  const handle = client.watch({ title: PANEL_TITLE, appId: 'dsh-piggy-desktop', width: 292, height: 420 })
  const found = client.refresh(handle)
  assert.equal(found?.id, 30)
  assert.equal(handle.scale, 1.5)
  assert.deepEqual(handle.rect, { x: 2791, y: 70, width: 292, height: 420 })
  // 逻辑坐标 +30/+15 原样发给 niri，不再除 scale。
  client.moveTo(handle, { x: 2821, y: 85 })
  client.moveTo(handle, { x: 2824, y: 90 })
  assert.equal(client.pending(), 1)
  assert.equal(writes.length, 0)
  client.flushSync()
  assert.equal(writes.length, 1)
  assert.deepEqual(writes[0].args, ['msg', 'action', 'move-floating-window', '--id', '30', '-x', '+33', '-y', '+20'])
  client.moveTo(handle, { x: 2804, y: 85 })
  client.flushSync()
  assert.deepEqual(writes[1].args, ['msg', 'action', 'move-floating-window', '--id', '30', '-x=-20', '-y=-5'])
  client.close()
})

test('createNiriWindow：目标在另一块屏时先 move-window-to-monitor，再按新位置移动', () => {
  const state = { windows: [rawWindow({
    id: 40, title: PET_TITLE, workspace_id: 1,
    layout: { tile_pos_in_workspace_view: [871.3333333333334, 70], window_size: [364, 332] },
  })] }
  const actions = []
  const client = createNiriWindow({
    socket: '/run/user/1000/niri.test.sock',
    getDisplays: () => DISPLAYS,
    execFileSync(command, args) {
      if (args[0] === 'msg' && args[1] === 'action') {
        actions.push({ command, args })
        if (args[2] === 'move-window-to-monitor') {
          state.windows = [rawWindow({
            id: 40, title: PET_TITLE, workspace_id: 2,
            layout: { tile_pos_in_workspace_view: [100, 100], window_size: [364, 332] },
          })]
        }
        return ''
      }
      if (args.at(-1) === 'windows') return JSON.stringify(state.windows)
      if (args.at(-1) === 'outputs') return JSON.stringify(OUTPUTS)
      if (args.at(-1) === 'workspaces') return JSON.stringify(WORKSPACES)
      return ''
    },
    execFile() { throw new Error('not used') },
    setTimeout() { return 1 },
    clearTimeout() {},
  })
  const handle = client.watch({ title: PET_TITLE, appId: 'dsh-piggy-desktop', width: 364, height: 332 })
  assert.equal(client.refresh(handle)?.id, 40)
  assert.equal(handle.output, 'eDP-1')
  client.moveTo(handle, { x: 600, y: 400, width: 364, height: 332 })
  assert.deepEqual(actions[0].args, ['msg', 'action', 'move-window-to-monitor', '--id', '40', 'HDMI-A-1'])
  client.flushSync()
  assert.deepEqual(actions.at(-1).args, ['msg', 'action', 'move-floating-window', '--id', '40', '-x', '+500', '-y', '+300'])
  client.close()
})

test('pigVisibleBox：把耳朵/脚等越出布局盒的可见输入并入面板避让框', () => {
  const pig = { x: 100, y: 100, width: 54, height: 54 }
  assert.deepEqual(pigVisibleBox(pig, []), pig)
  const visible = pigVisibleBox(pig, [
    { x: 96, y: 92, width: 64, height: 70 },
    { x: 400, y: 400, width: 10, height: 10 },
  ])
  assert.deepEqual(visible, { x: 96, y: 92, width: 64, height: 70 })
})

test('panelBoundsClearOfPig：面板压住猪时换到上下左右，且保持 PANEL_GAP', () => {
  const pig = { x: 800, y: 500, width: 68, height: 68 }
  const area = { x: 0, y: 0, width: 1280, height: 768 }
  const overlapping = { x: 700, y: 530, width: 292, height: 370 }
  const clear = panelBoundsClearOfPig(overlapping, pig, area)
  assert.ok(clear.x + clear.width + 8 <= pig.x || pig.x + pig.width + 8 <= clear.x
    || clear.y + clear.height + 8 <= pig.y || pig.y + pig.height + 8 <= clear.y, JSON.stringify(clear))
  assert.ok(clear.x >= area.x + 10 && clear.x + clear.width <= area.x + area.width - 10)
  assert.ok(clear.y >= area.y && clear.y + clear.height <= area.y + area.height)

  const above = { x: 600, y: 500 - 8 - 370, width: 292, height: 370 }
  assert.deepEqual(panelBoundsClearOfPig(above, pig, area), above)
})

function fakeNiri(initialRect = { x: 200, y: 100, width: 368, height: 344 }, stateful = false) {
  const moves = []
  const handles = []
  let current = { ...initialRect }
  return {
    enabled: true,
    moves,
    handles,
    watch(query) {
      const handle = { ...query, id: null, rect: null, scale: 1, windowSize: null, output: null, isFloating: true }
      handles.push(handle)
      return handle
    },
    refresh(handle) {
      handle.id = 7
      handle.rect = { ...(stateful ? current : initialRect) }
      handle.scale = 1
      return { id: 7, title: handle.title, appId: 'dsh-piggy-desktop', rect: { ...handle.rect }, scale: 1,
        windowSize: { width: handle.rect.width, height: handle.rect.height }, output: 'HDMI-A-1', isFloating: true }
    },
    moveTo(handle, next) {
      if (handle.rect !== null && Math.abs(next.x - handle.rect.x) < 0.5 && Math.abs(next.y - handle.rect.y) < 0.5) return false
      moves.push({ ...next })
      handle.rect = { ...handle.rect, x: next.x, y: next.y }
      if (stateful) current = { ...handle.rect }
      return true
    },
    workAreas: () => [{ x: 0, y: 0, width: 1920, height: 1080 }],
    outputAt: () => 'HDMI-A-1',
    normalizeSaved: saved => saved,
    flush() { return Promise.resolve() },
    flushSync() {},
  }
}

function screenStub() {
  const display = { id: 1, label: '', internal: false, bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, displayFrequency: 60 }
  return {
    display,
    getAllDisplays: () => [display],
    getDisplayMatching: () => display,
    getDisplayNearestPoint: () => display,
    getPrimaryDisplay: () => display,
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
  }
}

test('window-surface：niri 下 applyBounds 用相对移动，不动 setBounds 位置，几何回读虚拟位置', () => {
  const screen = screenStub()
  const niri = fakeNiri()
  const sent = []
  const followed = []
  const win = {
    bounds: { x: 0, y: 0, width: 368, height: 344 },
    setBoundsCalls: [],
    isDestroyed: () => false,
    getBounds() { return { ...this.bounds } },
    setBounds(next) { this.setBoundsCalls.push({ ...next }); this.bounds = { ...this.bounds, width: next.width, height: next.height } },
    webContents: { send: (...args) => sent.push(args) },
    setOpacity() {},
  }
  const pet = { pigId: null, primary: true, window: win, niriTitle: PET_TITLE,
    petAsked: { x: 500, y: 400, width: 368, height: 344 }, lastDragSlide: { x: 0, y: 0 } }
  const surface = createWindowSurface({
    screen, platform: 'linux', env: {}, panel: { followPig: p => followed.push(p) },
    scheduleWindowStateSave() {}, log() {}, startupInputTrace: { record() {} },
    traceSetIgnoreMouseEvents(role, mode, source, ignore, forward, invoke) { invoke() },
    niri, setTimeout: () => 1, clearTimeout() {},
  })
  assert.equal(surface.niriEnabled, true)
  surface.attachNiri(pet)
  assert.deepEqual(niri.moves[0], { x: 500, y: 400, width: 368, height: 344 })
  assert.deepEqual(surface.readBounds(pet), { x: 500, y: 400, width: 368, height: 344 })
  assert.deepEqual(surface.geometryOf(win.getBounds(), pet).window, { x: 500, y: 400, width: 368, height: 344 })

  surface.applyBounds(pet, { x: 550, y: 420, width: 368, height: 344 }, 'drag')
  assert.deepEqual(niri.moves.at(-1), { x: 550, y: 420, width: 368, height: 344 })
  assert.equal(win.setBoundsCalls.length, 0, '纯移动不应 setBounds')
  assert.deepEqual(surface.readBounds(pet), { x: 550, y: 420, width: 368, height: 344 })
  assert.equal(followed.length, 1)
  assert.equal(sent.at(-1)[0], 'piggy:geometry')

  // 尺寸变化只给 niri 尺寸，位置仍由 moveTo 负责。
  surface.applyBounds(pet, { x: 550, y: 420, width: 400, height: 360 }, 'place')
  assert.deepEqual(win.setBoundsCalls, [{ x: 0, y: 0, width: 400, height: 360 }])
  assert.equal(niri.moves.length, 2, '尺寸变化但没有位移时不再发 move')

  pet.petAsked = { x: 10, y: 20, width: 400, height: 360 }
  surface.syncPetFromNiri(pet)
  assert.equal(pet.petAsked.x, 200)
  assert.equal(pet.petAsked.y, 100)
})

test('panel-controller：niri 下面板按真实猪位置贴边移动，不盖住猪', async () => {
  const screen = screenStub()
  const niri = fakeNiri({ x: 0, y: 0, width: 292, height: 420 })
  const panelWindow = {
    visible: false,
    opacity: 1,
    bounds: { x: 0, y: 0, width: 292, height: 420 },
    setBoundsCalls: [],
    isDestroyed: () => false,
    isVisible() { return this.visible },
    getBounds() { return { ...this.bounds } },
    setBounds(next) { this.setBoundsCalls.push({ ...next }); this.bounds = { ...this.bounds, width: next.width, height: next.height } },
    setOpacity(value) { this.opacity = value },
    showInactive() { this.visible = true },
    hide() { this.visible = false },
    focus() {},
    moveTop() {},
    setShape() {},
    setIgnoreMouseEvents() {},
    webContents: { send() {} },
  }
  const petWindow = { isDestroyed: () => false, isVisible: () => true, getBounds: () => ({ x: 0, y: 0, width: 368, height: 344 }),
    setIgnoreMouseEvents() {}, showInactive() {}, moveTop() {}, focus() {}, webContents: { send() {} } }
  const pet = { pigId: null, primary: true, window: petWindow, panelPig: { x: 222, y: 28, width: 68, height: 68 },
    panelSpeech: null,
    petAsked: { x: 500, y: 400, width: 368, height: 344 }, dragSession: null, lastDragSlide: { x: 0, y: 0 } }
  const pets = { all: () => [pet], primary: () => pet }
  const controller = createPanelController({
    panelWindow: { isReady: () => true, ensure: () => panelWindow, destroy() {}, forget() {} },
    getPanelWindow: () => panelWindow,
    screen, BrowserWindow: { getFocusedWindow: () => null }, platform: 'linux',
    pets, primaryPet: () => pet, getPetWindow: () => petWindow,
    extensionWindow: { current: () => null }, extensionLayer: { isFocused: () => false, sync() {} },
    ipcMain: { on() {} }, petForEvent: () => pet, fromPage: () => true, toPages() {}, log() {},
    traceSetIgnoreMouseEvents() {},
    niri, readBounds: p => p.petAsked, syncPet() {},
    setTimeout: (callback) => { callback(); return 1 }, clearTimeout() {},
    setInterval: () => 1, clearInterval() {},
  })
  controller.open({ x: 222, y: 28, width: 68, height: 68 }, pet)
  controller.setSize({ width: 292, height: 420, fixedViewport: true })
  await Promise.resolve()
  const target = niri.moves.at(-1)
  assert.ok(target, 'niri 必须收到面板移动')
  const pig = { x: 722, y: 428, width: 68, height: 68 }
  assert.ok(target.x + target.width + 8 <= pig.x || pig.x + pig.width + 8 <= target.x
    || target.y + target.height + 8 <= pig.y || pig.y + pig.height + 8 <= target.y,
  '面板不能盖住猪: ' + JSON.stringify(target))
  assert.equal(target.width, 292)
  assert.equal(panelWindow.opacity, 1, '移动后要恢复可见')
  assert.equal(panelWindow.visible, true)
})

test('panel-controller：同一击关闭后 350ms 内不再被猪页重新打开', () => {
  const screen = screenStub()
  const niri = fakeNiri({ x: 500, y: 400, width: 292, height: 420 })
  const panelWindow = {
    visible: false,
    bounds: { x: 0, y: 0, width: 292, height: 420 },
    isDestroyed: () => false,
    isVisible() { return this.visible },
    getBounds() { return { ...this.bounds } },
    setBounds() {}, setOpacity() {}, showInactive() { this.visible = true }, hide() { this.visible = false },
    focus() {}, moveTop() {}, setShape() {}, setIgnoreMouseEvents() {}, webContents: { send() {} },
  }
  const petWindow = { isDestroyed: () => false, isVisible: () => true, getBounds: () => ({ x: 500, y: 400, width: 368, height: 344 }),
    setIgnoreMouseEvents() {}, showInactive() {}, moveTop() {}, focus() {}, webContents: { send() {} } }
  const pet = { pigId: null, primary: true, window: petWindow, panelPig: { x: 222, y: 28, width: 68, height: 68 },
    panelSpeech: null, petAsked: { x: 500, y: 400, width: 368, height: 344 }, dragSession: null, lastDragSlide: { x: 0, y: 0 } }
  const logs = []
  let clock = 1000
  const controller = createPanelController({
    panelWindow: { isReady: () => true, ensure: () => panelWindow, destroy() {}, forget() {} },
    getPanelWindow: () => panelWindow,
    screen, BrowserWindow: { getFocusedWindow: () => null }, platform: 'linux',
    pets: { all: () => [pet], primary: () => pet }, primaryPet: () => pet, getPetWindow: () => petWindow,
    extensionWindow: { current: () => null }, extensionLayer: { isFocused: () => false, sync() {} },
    ipcMain: { on() {} }, petForEvent: () => pet, fromPage: () => true, toPages() {}, log: (...parts) => logs.push(parts.join(' ')),
    traceSetIgnoreMouseEvents() {}, niri, readBounds: p => p.petAsked, syncPet() {},
    setTimeout: callback => { callback(); return 1 }, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    now: () => clock,
  })
  const event = { sender: petWindow.webContents }
  controller.open({ x: 222, y: 28, width: 68, height: 68 }, pet)
  assert.equal(controller.isOpen(), true)
  clock = 1100
  controller.close('pet')
  assert.equal(controller.isOpen(), false)
  clock = 1300
  controller.toggle(event, { open: true, pig: { x: 222, y: 28, width: 68, height: 68 } })
  assert.equal(controller.isOpen(), false, '同一次点击的重新 open 要被忽略')
  clock = 1600
  controller.toggle(event, { open: true, pig: { x: 222, y: 28, width: 68, height: 68 } })
  assert.equal(controller.isOpen(), true, '超过 350ms 后正常打开')
  assert.ok(logs.some(line => line.includes('same-click')), logs.join('\n'))
})

test('drag-engine：niri 下从真实窗口位置起算，拖动增量走 move-floating-window', () => {
  const screen = screenStub()
  let cursor = { x: 600, y: 450 }
  screen.getCursorScreenPoint = () => ({ ...cursor })
  const niri = fakeNiri({ x: 500, y: 400, width: 368, height: 344 }, true)
  const win = {
    bounds: { x: 0, y: 0, width: 368, height: 344 },
    isDestroyed: () => false,
    getBounds() { return { ...this.bounds } },
    setBounds(next) { this.bounds = { ...this.bounds, width: next.width, height: next.height } },
    setShape() {},
    webContents: { send() {} },
  }
  const pet = {
    pigId: null, primary: true, window: win, niriTitle: PET_TITLE,
    petAsked: { x: 500, y: 400, width: 368, height: 344 },
    lastDragSlide: { x: 0, y: 0 }, placedHitShape: null, dragSession: null, dragShapeActive: false,
    dragTimer: null, resizeShape: null, restingPigScreen: null, savedPigScreen: null, lastPigWindow: { x: 222, y: 28 },
  }
  const surface = createWindowSurface({
    screen, platform: 'linux', env: {}, panel: { followPig() {} },
    scheduleWindowStateSave() {}, log() {}, startupInputTrace: { record() {} },
    traceSetIgnoreMouseEvents(role, mode, source, ignore, forward, invoke) { invoke() },
    niri, setTimeout: () => 1, clearTimeout() {},
  })
  surface.attachNiri(pet)
  const intervals = []
  const engine = createDragEngine({
    screen, pets: { all: () => [pet] }, petForEvent: () => pet,
    panel: { followPig() {}, reanchorPanel() {} }, log() {}, surface,
    setInterval: callback => { intervals.push(callback); return 1 }, clearInterval() {},
  })
  const event = { sender: win.webContents, returnValue: null }
  engine.startDrag(event, {
    x: 222, y: 28, width: 68, height: 68,
    // niri 页面报的是窗口局部坐标：100+500=600，50+400=450 正好是主进程光标。
    slide: true, origin: { x: 100, y: 50 },
  })
  assert.equal(pet.dragSession.cursor.x, 600)
  assert.equal(pet.dragSession.cursor.y, 450)
  assert.equal(pet.dragSession.pigScreen.x, 722)
  assert.equal(pet.dragSession.pigScreen.y, 428)
  cursor = { x: 630, y: 470 }
  engine.heartbeatDrag(event, { x: 130, y: 70 })
  assert.deepEqual(niri.moves.at(-1), { x: 530, y: 420, width: 368, height: 344 })
  assert.equal(surface.readBounds(pet).x, 530)
  engine.endDrag(event, { x: 130, y: 70 })
  assert.equal(pet.petAsked.x, 530, '松手后 petAsked 来自 niri 真实位置')
  assert.equal(event.returnValue.window.x, 530)
  assert.equal(intervals.length, 1)
})


