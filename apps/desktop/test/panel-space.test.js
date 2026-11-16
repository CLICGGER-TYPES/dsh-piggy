// @ts-check
/**
 * macOS 桌面空间：面板窗口是启动时预建的，系统把它绑在创建时的空间上。
 * 用户把猪拖到桌面 2 再右键，面板必须出现在桌面 2（2026-11-16 反馈），
 * 而不是它原来绑定的桌面 1。显示前加入所有空间、收起后还原。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createPanelController } from '../lib/panel-controller.js'

const AREA = { x: 0, y: 0, width: 1920, height: 1040 }

function harness(platform) {
  const calls = []
  let visible = false
  const panelWin = {
    isDestroyed: () => false,
    isVisible: () => visible,
    getBounds: () => ({ x: 0, y: 0, width: 292, height: 420 }),
    setBounds() {},
    setShape() {},
    setIgnoreMouseEvents() {},
    showInactive() { visible = true; calls.push({ type: 'show' }) },
    hide() { visible = false; calls.push({ type: 'hide' }) },
    moveTop() {},
    setVisibleOnAllWorkspaces(on, options) {
      calls.push({ type: 'workspaces', on, options })
    },
    webContents: { send() {} },
  }
  const petWin = {
    isDestroyed: () => false,
    isVisible: () => true,
    getBounds: () => ({ x: 900, y: 500, width: 192, height: 192 }),
    moveTop() {},
    webContents: { send() {} },
  }
  const primary = {
    window: petWin, pigId: 'pig-a', petAsked: { x: 900, y: 500, width: 132, height: 152 },
    panelPig: { x: 20, y: 20, width: 56, height: 56 }, panelSpeech: null, dragSession: null, lastDragSlide: { x: 0, y: 0 },
  }
  const controller = createPanelController({
    panelWindow: { isReady: () => true, ensure: () => panelWin, destroy() {}, forget() {} },
    getPanelWindow: () => panelWin,
    screen: {
      getCursorScreenPoint: () => ({ x: 0, y: 0 }),
      getAllDisplays: () => [{ workArea: AREA }],
      getDisplayMatching: () => ({ workArea: AREA, scaleFactor: 1 }),
      getDisplayNearestPoint: () => ({ workArea: AREA }),
    },
    BrowserWindow: { getFocusedWindow: () => null },
    platform,
    pets: { all: () => [primary] },
    primaryPet: () => primary,
    getPetWindow: () => petWin,
    extensionWindow: { current: () => null, owns: () => false },
    extensionLayer: { isFocused: () => false, sync() {} },
    ipcMain: { on() {} },
    petForEvent: () => null,
    fromPage: () => false,
    toPages() {},
    log() {},
    traceSetIgnoreMouseEvents() {},
    setTimeout: () => 0,
    setInterval: () => ({ unref() {} }),
    clearInterval() {},
  })
  controller.open({ x: 20, y: 20, width: 56, height: 56 }, primary)
  controller.setSize({ width: 292, height: 370 })
  return { controller, calls }
}

test('macOS：显示面板前加入所有空间，收起后还原', () => {
  const { controller, calls } = harness('darwin')
  const joinAt = calls.findIndex(call => call.type === 'workspaces' && call.on === true)
  const showAt = calls.findIndex(call => call.type === 'show')
  assert.ok(joinAt >= 0, '显示前要先加入所有空间')
  assert.ok(showAt > joinAt, '加入所有空间必须发生在显示之前')
  assert.deepEqual(calls[joinAt].options, { visibleOnFullScreen: true, skipTransformProcessType: true })

  controller.close('test')
  const last = calls.at(-1)
  assert.deepEqual({ type: last.type, on: last.on }, { type: 'workspaces', on: false }, '收起后要离开所有空间')
  assert.deepEqual(last.options, { visibleOnFullScreen: false, skipTransformProcessType: true })
})

test('其它平台不碰工作区行为', () => {
  const { calls } = harness('linux')
  assert.equal(calls.filter(call => call.type === 'workspaces').length, 0)
})
