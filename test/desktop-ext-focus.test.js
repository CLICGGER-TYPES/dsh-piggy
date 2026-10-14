// 大农场焦点属于同一应用；面板原生 blur 交给主进程统一判定。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { attachAutoCollapse } from '../src/client/auto-collapse.js'

const source = readFileSync(new URL('../apps/desktop/main.js', import.meta.url), 'utf8')
test('面板焦点去大农场不发送外部失焦，去别的应用仍发送', () => {
  const emitted = [], extWin = {}, panelWin = {}, win = {}
  let focused = extWin
  const body = source.slice(source.indexOf('function panelFocusLeft()'), source.indexOf('/** 把面板窗口放到该在的地方'))
  const check = runInNewContext(body + '\npanelFocusLeft', { panelOpen: true, win, panelWin, extWin,
    BrowserWindow: { getFocusedWindow: () => focused }, setTimeout: callback => callback(), sendPanel: message => emitted.push(message) })
  check()
  assert.equal(emitted.length, 0)
  focused = null
  check()
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
