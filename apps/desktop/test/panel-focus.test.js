// @ts-check
/** 执行面板控制器的失焦路径：焦点暂空时按指针判断是否真的点到外面。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createPanelController } from '../lib/panel-controller.js'

const AREA = { x: 0, y: 0, width: 1920, height: 1040 }

function harness(pointFor) {
  const sent = []
  const tasks = []
  let cursor = { x: 0, y: 0 }
  let panelBounds = { x: 0, y: 0, width: 292, height: 420 }
  const panelWin = {
    isDestroyed: () => false,
    isVisible: () => true,
    getBounds: () => ({ ...panelBounds }),
    setBounds(next) { panelBounds = { ...next } },
    setShape() {},
    setIgnoreMouseEvents() {},
    showInactive() {},
    hide() {},
    moveTop() {},
    webContents: { send: (channel, message) => { if (channel === 'piggy:panel') sent.push(message) } },
  }
  const petWin = { isDestroyed: () => false, getBounds: () => ({ x: 900, y: 500, width: 192, height: 192 }), webContents: { send: () => {} } }
  const primary = { window: petWin, pigId: 'pig-a', petAsked: { x: 900, y: 500, width: 132, height: 152 },
    panelPig: { x: 20, y: 20, width: 56, height: 56 }, panelSpeech: null, dragSession: null, lastDragSlide: { x: 0, y: 0 } }
  const panelController = createPanelController({
    panelWindow: { isReady: () => true, ensure: () => panelWin, destroy() {}, forget() {} },
    getPanelWindow: () => panelWin,
    screen: { getCursorScreenPoint: () => cursor, getAllDisplays: () => [{ workArea: AREA }],
      getDisplayMatching: () => ({ workArea: AREA, scaleFactor: 1 }),
      getDisplayNearestPoint: () => ({ workArea: AREA }) },
    BrowserWindow: { getFocusedWindow: () => null },
    platform: 'linux',
    pets: { all: () => [primary] },
    primaryPet: () => primary,
    getPetWindow: () => petWin,
    extensionWindow: { current: () => null, owns: () => false },
    extensionLayer: { isFocused: () => false, sync() {} },
    ipcMain: { on() {} },
    petForEvent: () => null,
    fromPage: () => false,
    toPages: message => sent.push(message),
    log() {},
    traceSetIgnoreMouseEvents() {},
    setTimeout: fn => tasks.push(fn),
    setInterval: () => ({ unref() {} }),
    clearInterval() {},
  })
  panelController.open({ x: 20, y: 20, width: 56, height: 56 }, primary)
  panelController.setSize({ width: 292, height: 370, fixedViewport: true })
  cursor = pointFor(panelBounds)
  panelController.focusLeft()
  tasks[0]()
  return sent
}

for (const [title, pointFor, close] of [
  ['面板内按下时焦点暂空，不触发收起', bounds => ({ x: bounds.x + 10, y: bounds.y + bounds.height - 10 }), false],
  ['透明预留区点到别处，仍会收起', bounds => ({ x: bounds.x + 10, y: bounds.y + 10 }), true],
  ['桌面外部点击仍会收起', () => ({ x: 10, y: 10 }), true],
]) {
  test(title, () => {
    const sent = harness(pointFor)
    assert.equal(sent.some(message => message.type === 'blur'), close)
  })
}
