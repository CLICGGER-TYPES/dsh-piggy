// @ts-check
/** 冷启动与加载中复按不能取消还没显示的面板；显示后仍按原语义关闭。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { panelToggleAction } from '../lib/panel-toggle.js'

test('首次右键请求打开尚未创建的面板', () => {
  assert.equal(panelToggleAction({ requestedOpen: true, isOpen: false, isVisible: false }), 'open')
})
test('冷启动第二击保持尚未显示的打开请求', () => {
  assert.equal(panelToggleAction({ requestedOpen: false, isOpen: true, isVisible: false }), 'keep-open')
})
test('加载中多次复按都保持打开，显示后再次右键才关闭', () => {
  for (const requestedOpen of [false, true, false, false, true]) {
    assert.notEqual(panelToggleAction({ requestedOpen, isOpen: true, isVisible: false }), 'close')
  }
  assert.equal(panelToggleAction({ requestedOpen: false, isOpen: true, isVisible: true }), 'close')
  assert.equal(panelToggleAction({ requestedOpen: false, isOpen: false, isVisible: false }), 'close')
})
