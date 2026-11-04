// @ts-check
/** 执行生产层级函数：菜单已有置顶标记仍要恢复真实顺序，且不能抢焦点。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createPanelController } from '../lib/panel-controller.js'

const AREA = { x: 0, y: 0, width: 1920, height: 1040 }

function fixture({ isPanelVisible = true, isExtensionFocused = false } = {}) {
  const calls = []
  const win = {
    isDestroyed: () => false, isVisible: () => true, isAlwaysOnTop: () => true,
    getBounds: () => ({ x: 10, y: 20, width: 132, height: 152 }),
    moveTop: () => calls.push('pet'), focus: () => calls.push('focus'),
    webContents: { send: () => calls.push('notify') },
  }
  const panelWin = {
    visible: isPanelVisible,
    isDestroyed: () => false, isAlwaysOnTop: () => true,
    isVisible() { return this.visible },
    moveTop: () => calls.push('panel'), focus: () => calls.push('focus'),
    setBounds: () => calls.push('bounds'),
    setShape: () => {},
    setIgnoreMouseEvents: () => {},
    showInactive() { this.visible = true; calls.push('show') },
    hide() {},
    webContents: { send: () => {} },
  }
  const pet = { primary: true, pigId: null, window: win, panelPig: { x: 0, y: 0, width: 56, height: 56 },
    panelSpeech: null, dragSession: null, petAsked: { x: 10, y: 20, width: 132, height: 152 }, lastDragSlide: { x: 0, y: 0 } }
  const controller = createPanelController({
    panelWindow: { isReady: () => true, ensure: () => panelWin, destroy() {}, forget() {} },
    getPanelWindow: () => panelWin,
    screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }), getAllDisplays: () => [{ workArea: AREA }],
      getDisplayMatching: () => ({ workArea: AREA, scaleFactor: 1 }),
      getDisplayNearestPoint: () => ({ workArea: AREA }) },
    BrowserWindow: { getFocusedWindow: () => null },
    platform: 'win32',
    pets: { all: () => [pet], primary: () => pet },
    primaryPet: () => pet,
    getPetWindow: () => win,
    extensionWindow: { current: () => null, owns: () => false },
    extensionLayer: { isFocused: () => isExtensionFocused, sync() {} },
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
  return { calls, controller, pet, panelWin }
}

test('菜单已有置顶标记时仍先抬菜单、再抬猪，不抢焦点', () => {
  const { calls, controller } = fixture()
  controller.raisePetAbovePanel()
  assert.deepEqual(calls, ['panel', 'pet'])
})

test('只抬猪时不显示或抬起隐藏的菜单', () => {
  const { calls, controller } = fixture({ isPanelVisible: false })
  controller.raisePetAbovePanel()
  assert.deepEqual(calls, ['pet'])
})

test('大扩展拥有焦点时不抬猪或菜单', () => {
  const { calls, controller } = fixture({ isExtensionFocused: true })
  controller.raisePetAbovePanel()
  assert.deepEqual(calls, [])
})

test('打开隐藏菜单后同步恢复整个窗口组的顺序', () => {
  const { calls, controller, pet } = fixture({ isPanelVisible: false })
  controller.setSize({ width: 292, height: 370 })
  controller.open({ x: 0, y: 0, width: 56, height: 56 }, pet)
  assert.deepEqual(calls, ['bounds', 'show', 'panel', 'pet', 'notify'])
})

test('大扩展拥有焦点时打开菜单不抢走层级', () => {
  const { calls, controller, pet } = fixture({ isPanelVisible: false, isExtensionFocused: true })
  controller.setSize({ width: 292, height: 370 })
  controller.open({ x: 0, y: 0, width: 56, height: 56 }, pet)
  assert.deepEqual(calls, ['bounds', 'show', 'notify'])
})
