// @ts-check
/** 下载扩展的面板接口：openShop 跳到它自己的货架，返回回到扩展页（用户 2026-10-09：菜园买种子）。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fakeDom } from './helpers/bundle.js'

test('openShop opens the extension shelf and the back button returns to the extension', async () => {
  const { document } = fakeDom()
  globalThis.document = document
  globalThis.window = /** @type {any} */ ({})
  const { renderDownloadedApp } = await import('../src/client/ext-apps.js')
  const selected = []
  const ui = {
    tab: 'ext:farm', drill: { shop: null, from: null }, content: document.createElement('div'),
    view: { extensions: [{ key: 'farm', version: '2.0.0' }], extViews: { farm: {} } },
    select(next) { selected.push(next); this.tab = next; this.drill.shop = null; this.drill.from = null },
    renderContent() {}, send() {},
  }
  let app = null
  renderDownloadedApp(ui, 'farm')
  ;/** @type {any} */ (globalThis.window).dshPiggyExtensions.register('farm', { render(given) { app = given } })
  renderDownloadedApp(ui, 'farm')
  assert.equal(typeof app.openShop, 'function')
  app.openShop()
  assert.equal(ui.tab, 'shop')
  assert.equal(ui.drill.shop, 'ext:farm')
  assert.equal(ui.drill.from, 'ext:farm', 'back from the shelf goes to the farm, not the shop front')
  delete globalThis.window
})
