import assert from 'node:assert/strict'
import { test } from 'node:test'

import farm from '../extensions/farm/server.js'
import { api, establishedFarm, renderFarm } from './helpers/farm-ui.js'

test('farm purchase and clear dialogs take focus, trap Tab, preserve quantity focus, and restore their trigger', () => {
  const data = establishedFarm(), clock = api()
  farm.actions.buy(data, { item: 'radish', count: 2 }, clock)
  const ui = renderFarm(farm.view(data, clock), 'big')
  const key = (keyName, shiftKey = false) => ui.dom.documentListeners.keydown.forEach(fn => fn({ key: keyName, shiftKey, target: ui.dom.document.activeElement || { tagName: 'BODY' }, preventDefault() {} }))

  ui.find('data-farm-shop', 'shelf').fire('click')
  ui.find('data-farm-item', 'radish').fire('click')
  const quantity = () => ui.find('aria-label', '数量')
  assert.equal(ui.dom.document.activeElement, quantity(), '购买框打开后焦点应进入数量框')
  assert.equal(ui.find('role', 'dialog').getAttribute('aria-modal'), 'true')

  const close = ui.find('data-farm-close', 'true')
  ui.dom.document.activeElement = ui.dom.body
  key('Tab')
  assert.equal(ui.dom.document.activeElement, close, '焦点意外落到 dialog 外时，Tab 应拉回第一个控件')
  close.focus()
  key('Tab', true)
  assert.equal(ui.dom.document.activeElement.getAttribute('data-farm-cancel'), 'true', 'Shift+Tab 应从第一个控件环到最后一个')
  key('Tab')
  assert.equal(ui.dom.document.activeElement, close, 'Tab 应从最后一个控件环回第一个')

  quantity().value = '12'
  quantity().fire('input')
  quantity().focus()
  const oldQuantity = quantity()
  ui.app.rerender()
  assert.notEqual(ui.dom.document.activeElement, oldQuantity, '重绘后焦点应落到新建的输入节点')
  assert.equal(ui.dom.document.activeElement, quantity())
  assert.equal(quantity().value, '12')

  ui.find('data-farm-cancel', 'true').fire('click')
  assert.equal(ui.dom.document.activeElement.getAttribute('data-farm-item'), 'radish', '关闭购买框后焦点应回到商品按钮')

  ui.find('data-farm-tab', 'tool').fire('click')
  const tool = ui.all('data-farm-item')[0]
  const toolKey = tool.getAttribute('data-farm-item')
  tool.fire('click')
  assert.equal(ui.dom.document.activeElement.getAttribute('data-farm-close'), 'true', '不可调数量的工具购买应聚焦可用关闭按钮')
  ui.find('data-farm-close', 'true').fire('click')
  assert.equal(ui.dom.document.activeElement.getAttribute('data-farm-item'), toolKey)

  const clearData = establishedFarm()
  farm.actions.buy(clearData, { item: 'radish', count: 1 }, clock)
  farm.actions.plant(clearData, { plot: 0, item: 'radish' }, clock)
  const clearUi = renderFarm(farm.view(clearData, clock), 'big')
  clearUi.find('data-farm-tool', 'shovel').fire('click')
  clearUi.find('data-farm-plot', '0').fire('click')
  assert.equal(clearUi.dom.document.activeElement.getAttribute('data-farm-close'), 'true', '铲除确认打开后焦点应进入 dialog')
  clearUi.find('data-farm-close', 'true').fire('click')
  assert.equal(clearUi.dom.document.activeElement.getAttribute('data-farm-plot'), '0', '关闭铲除确认后焦点应回到原地块')
})
