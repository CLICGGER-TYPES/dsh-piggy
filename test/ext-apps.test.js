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
  ui.view.wallets = [{ key: 'farm', label: '菜币', emoji: '', balance: 123, rate: 1, buyRate: 1.05 }]
  ui.view.extensions[0].version = '3.1.0'
  renderDownloadedApp(ui, 'farm')
  window.dshPiggyExtensions.register('farm', { render(given) { app = given } })
  ui.content.textContent = ''
  renderDownloadedApp(ui, 'farm')
  assert.equal(ui.content.children[0].getAttribute('data-wallet'), 'farm', 'classic farm retains its host wallet')
  ui.view.extensions[0].version = '4.0.10'
  renderDownloadedApp(ui, 'farm')
  window.dshPiggyExtensions.register('farm', { render(given) { app = given } })
  ui.content.textContent = ''
  renderDownloadedApp(ui, 'farm')
  assert.equal(ui.content.children.length, 0, 'modern farm supplies its own wallet, with no duplicate host bar')
  app.openShop()
  assert.equal(ui.tab, 'shop')
  assert.equal(ui.drill.shop, 'ext:farm')
  assert.equal(ui.drill.from, 'ext:farm', 'back from the shelf goes to the farm, not the shop front')
  delete globalThis.window
})

test('switching extension versions restores the matching implementation, including late script loads', async () => {
  const { document } = fakeDom()
  globalThis.document = document
  globalThis.window = /** @type {any} */ ({})
  const { renderDownloadedApp } = await import('../src/client/ext-apps.js?version-switch')
  const renders = []
  const ui = {
    tab: 'ext:farm', content: document.createElement('div'),
    view: { extensions: [{ key: 'farm', version: '4.0.10' }], extViews: { farm: {} } },
    renderContent() {}, send() {},
  }
  function show(version) {
    ui.view.extensions[0].version = version
    ui.content.textContent = ''
    renderDownloadedApp(ui, 'farm')
  }
  function register(version, label) {
    document.currentScript = document.createElement('script')
    document.currentScript.setAttribute('data-piggy-extension', 'farm@' + version)
    window.dshPiggyExtensions.register('farm', { render() { renders.push(label) } })
    document.currentScript = null
  }
  try {
    show('4.0.10'); register('4.0.10', 'modern'); show('4.0.10')
    assert.deepEqual(renders, ['modern'])
    show('3.1.0')
    assert.deepEqual(renders, ['modern'], 'do not render an old implementation while loading the new version')
    register('3.1.0', 'classic'); show('3.1.0'); show('4.0.10'); show('3.1.0')
    assert.deepEqual(renders, ['modern', 'classic', 'modern', 'classic'])
    register('4.0.10', 'modern'); show('3.1.0')
    assert.equal(renders.at(-1), 'classic', 'late loads cannot overwrite a different active version')
  } finally {
    delete globalThis.window
    delete globalThis.document
  }
})
