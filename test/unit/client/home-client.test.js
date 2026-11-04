// H7：主菜单分页与末尾 App 顺序。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fakeDom, contentOf, findByAttr, mount, openPanel, settle } from '../../helpers/bundle.js'
import { orderHomeApps, renderHome } from '../../../src/client/tabs/home.js'

test('主菜单每页九格，圆点和滑动切页；打开 App 返回后仍在原页', async () => {
  const { dom, intervals } = await mount()
  openPanel(dom)
  const content = contentOf(dom)
  assert.equal(findByAttr(content, 'data-app', 'extensions'), undefined)
  assert.equal(findByAttr(content, 'data-home-page', '0').children.length, 9)
  assert.equal(findByAttr(content, 'data-home-page', '1').getAttribute('data-active'), 'false')
  findByAttr(content, 'data-home-dot', '1').fire('click')
  assert.equal(findByAttr(content, 'data-home-page', '1').getAttribute('data-active'), 'true')
  const swipe = findByAttr(content, 'data-home-swipe', 'true')
  swipe.fire('pointerdown', { clientX: 80 })
  swipe.fire('pointerup', { clientX: 140 })
  assert.equal(findByAttr(content, 'data-home-page', '0').getAttribute('data-active'), 'true')
  swipe.fire('wheel', { deltaY: 60, deltaX: 0 })
  assert.equal(findByAttr(content, 'data-home-page', '1').getAttribute('data-active'), 'true', '滚轮往下翻到下一页')
  swipe.fire('pointerdown', { clientX: 140, clientY: 50, pointerType: 'mouse', button: 0, pointerId: 1 })
  swipe.fire('pointermove', { clientX: 120, clientY: 50, pointerId: 1 })
  swipe.fire('pointerup', { clientX: 200, clientY: 50, pointerId: 1 })
  assert.equal(findByAttr(content, 'data-home-page', '0').getAttribute('data-active'), 'true', '左键按住往右拖回上一页')
  findByAttr(content, 'data-home-dot', '1').fire('click')
  findByAttr(content, 'data-app', 'settings').fire('click')
  findByAttr(contentOf(dom), 'data-home', 'true').fire('click')
  assert.equal(findByAttr(contentOf(dom), 'data-home-page', '1').getAttribute('data-active'), 'true')
  intervals.find(entry => entry.delay === 4000)?.fn()
  await settle()
  assert.equal(findByAttr(contentOf(dom), 'data-home-page', '1').getAttribute('data-active'), 'true')
  assert.ok(findByAttr(contentOf(dom), 'data-version', 'true'))
})

test('只有一页时不显示圆点，版本号仍在网格后', () => {
  const dom = fakeDom()
  globalThis.document = dom.document
  const content = dom.document.createElement('div')
  const ui = { content, view: { pig: { name: '猪猪', sex: null, level: { level: 1 }, coins: 10 }, version: '0.31.0' }, icons: {}, homePage: 0, select() {}, tapVersion() {} }
  renderHome(ui, [{ key: 'shop', label: '商店', emoji: '🛒' }])
  assert.equal(findByAttr(content, 'data-home-dot', '0'), undefined)
  assert.equal(findByAttr(content, 'data-home-page', '0').children.length, 1)
  assert.equal(content.children.at(-1).getAttribute('data-version'), 'true')
})

test('统一排序让新增 App 位于设置之前，末尾固定为设置、调试、退出', () => {
  const apps = ['settings', 'dev', 'future', 'ext:blindbox', 'quit', 'status'].map(key => ({ key }))
  assert.deepEqual(orderHomeApps(apps).map(app => app.key), ['future', 'status', 'ext:blindbox', 'settings', 'dev', 'quit'])
})
