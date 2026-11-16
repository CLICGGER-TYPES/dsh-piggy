// 大农场焦点属于同一应用；面板原生 blur 交给主进程统一判定。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { attachAutoCollapse } from '../../../src/client/auto-collapse.js'
import { createPanelInput } from '../../../apps/desktop/lib/panel-input.js'

test('面板焦点去大农场不发送外部失焦，去别的应用仍发送', () => {
  const emitted = []
  const extWin = {}
  const panelWin = {}
  const win = {}
  let focused = extWin
  const input = createPanelInput({
    getPanelWindow: () => panelWin,
    screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }) },
    platform: 'linux',
    BrowserWindow: { getFocusedWindow: () => focused },
    targetPet: () => win,
    extensionWindow: { current: () => extWin },
    scheduleTimeout: callback => callback(),
    setInterval: () => 1,
    clearInterval() {},
    traceSetIgnoreMouseEvents() {},
    sendBlur: () => emitted.push({ type: 'blur', toPet: false }),
    state: () => ({ open: true, fixed: false, anchor: null, size: null }),
    recentlyShown: () => false,
  })
  input.focusLeft()
  assert.equal(emitted.length, 0)
  focused = null
  input.focusLeft()
  assert.equal(emitted.length, 1)
})

test('拆分面板原生blur不抢先关闭，等主进程判断焦点归属', () => {
  const listeners = {}, closed = []
  globalThis.window = { __dshPiggyShell: { beginDrag() {}, role: 'panel' }, addEventListener: (name, fn) => { listeners[name] = fn }, removeEventListener() {} }
  globalThis.document = { activeElement: null, addEventListener() {}, removeEventListener() {} }
  const handle = attachAutoCollapse({ isOpen: () => true, isDragging: () => false, isFishing: () => false, isDesktop: () => true, setOpen: value => closed.push(value) })
  try { listeners.blur(); assert.deepEqual(closed, []) }
  finally { handle.dispose(); delete globalThis.window; delete globalThis.document }
})
