// 大窗口让出置顶层的生命周期回归；隐藏状态不被恢复置顶操作改成显示。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createExtensionLayer } from '../lib/extension-layer.js'
import { createPanelController } from '../lib/panel-controller.js'
import { createFullscreenController } from '../lib/fullscreen-controller.js'
import { desktopLifecycleStateAdapter } from './helpers/desktop-lifecycle-adapter.js'

test('大扩展焦点、失焦、最小化、关闭及守卫重入统一置顶状态', () => {
  const pet = { top: true, visible: false, isDestroyed: () => false,
    isAlwaysOnTop() { return this.top }, setAlwaysOnTop(value) { this.top = value } }
  const panel = { ...pet, visible: true }
  let raised = 0
  let extension = { moveTop() { raised++ }, focused: true, minimized: false, visible: true, destroyed: false,
    isDestroyed() { return this.destroyed }, isVisible() { return this.visible },
    isMinimized() { return this.minimized }, isFocused() { return this.focused } }
  const layer = createExtensionLayer({ extension: () => extension, overlays: () => [pet, panel] })
  layer.sync()
  assert.equal(pet.top, false)
  assert.equal(panel.top, false)
  assert.equal(raised, 1)
  layer.sync()
  assert.equal(layer.isFocused(), true)
  assert.equal(pet.visible, false)
  for (const key of ['focused', 'minimized', 'visible', 'destroyed']) {
    const before = extension[key]
    extension[key] = !before
    layer.sync()
    assert.equal(pet.top, true, key)
    extension[key] = before
    layer.sync()
    assert.equal(pet.top, false)
  }
  extension = null
  layer.sync()
  assert.equal(pet.top, true)
  assert.equal(pet.visible, false)
})

test('反应消息、全屏恢复和3秒守卫都不能抬回获得焦点的大扩展之上', async () => {
  let moves = 0, tops = 0
  const win = { isDestroyed: () => false, isVisible: () => true, moveTop: () => moves++, setAlwaysOnTop: () => tops++,
    getBounds: () => ({ x: 0, y: 0, width: 132, height: 152 }), webContents: { send: () => {} } }
  let syncs = 0
  const pet = { window: win, pigId: 'pig-a', panelPig: null, panelSpeech: null, dragSession: null,
    petAsked: { x: 0, y: 0, width: 132, height: 152 }, lastDragSlide: { x: 0, y: 0 } }
  const panelController = createPanelController({
    panelWindow: { isReady: () => true, ensure: () => win, destroy() {}, forget() {} },
    getPanelWindow: () => win,
    screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }), getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }],
      getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 }),
      getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) },
    BrowserWindow: { getFocusedWindow: () => null },
    platform: 'linux',
    pets: { all: () => [pet] },
    primaryPet: () => pet,
    getPetWindow: () => win,
    extensionWindow: { current: () => null, owns: () => false },
    extensionLayer: { isFocused: () => true, sync() {} },
    ipcMain: { on() {} },
    petForEvent: () => null,
    fromPage: () => false,
    toPages() {},
    log() {},
    traceSetIgnoreMouseEvents() {},
    setTimeout: () => ({}),
    setInterval: () => ({ unref() {} }),
    clearInterval() {},
  })
  const fullscreen = createFullscreenController({
    app: { getPath: () => '/tmp' },
    screen: { getDisplayMatching: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 }) },
    pets: { all: () => [pet] },
    primaryPet: () => pet,
    getPetWindow: () => win,
    getPanelWindow: () => win,
    extensionLayer: { isFocused: () => true, sync() { syncs++ } },
    panel: panelController,
    isQuitting: () => false,
    platform: 'linux',
    pid: 1,
    log() {},
    setTimeout: () => ({}),
    setInterval: () => ({ unref() {} }),
  })
  panelController.raisePetAbovePanel()
  fullscreen.reassertTop('check')
  fullscreen.reassertTop('lost')
  fullscreen.reassertTop('fullscreen-ended')
  assert.equal(moves, 0)
  assert.equal(tops, 0)
  assert.equal(syncs, 3)
})
