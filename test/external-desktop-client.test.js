// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fakeDom, findByAttr, settle } from './helpers/bundle.js'
import { renderExternalDesktopSettings } from '../src/client/external-desktop.js'

function setup(api) {
  const old = globalThis.document
  const dom = fakeDom()
  globalThis.document = dom.document
  const content = dom.document.createElement('div')
  const section = (ui, title, note) => {
    const box = dom.document.createElement('div'), head = dom.document.createElement('div')
    head.textContent = title + note
    box.appendChild(head); content.appendChild(box)
    return { box, head }
  }
  const ui = { tab: 'settings', renderContent() { content.textContent = ''; renderExternalDesktopSettings(ui, section, api) } }
  ui.renderContent()
  return { content, ui, restore() { globalThis.document = old } }
}

test('旧外壳保留设置入口说明，不调用不存在的联动接口', () => {
  const s = setup(null)
  try {
    assert.match(s.content.allText(), /更新桌面外壳后可用/)
    assert.equal(findByAttr(s.content, 'data-external-allow', 'true'), undefined)
  } finally { s.restore() }
})

test('联动许可由外壳确认，切换未返回前禁用，异步失败不显示已开启', async () => {
  let finish, changes = 0
  const api = { get: async () => ({ ok: true, enabled: false, running: false }), set: () => { changes++; return new Promise(resolve => { finish = resolve }) } }
  const s = setup(api)
  try {
    await settle()
    findByAttr(s.content, 'data-external-allow', 'true').fire('click')
    assert.equal(changes, 1)
    assert.equal(findByAttr(s.content, 'data-external-allow', 'true').disabled, true)
    finish({ ok: false, enabled: false, running: false, error: 'private endpoint path' })
    await settle()
    assert.match(s.content.allText(), /未完成/)
    assert.doesNotMatch(s.content.allText(), /private endpoint path|已允许外部联动/)
    assert.equal(findByAttr(s.content, 'data-external-allow', 'true').disabled, false)
  } finally { s.restore() }
})

test('开启/关闭使用原开关组件，通知更新状态且离开设置后不重画其他页面', async () => {
  let notify, reads = 0
  const api = {
    get: async () => { reads++; return { ok: true, enabled: false, running: false } },
    set: async enabled => ({ ok: true, enabled, running: enabled }),
    onStatus(callback) { notify = callback },
  }
  const s = setup(api)
  try {
    await settle()
    findByAttr(s.content, 'data-external-allow', 'true').fire('click'); await settle()
    assert.match(s.content.allText(), /已允许外部联动/)
    assert.equal(findByAttr(s.content, 'data-external-allow', 'false').className, 'dp-switch')
    findByAttr(s.content, 'data-external-allow', 'false').fire('click'); await settle()
    assert.match(s.content.allText(), /当前关闭/)
    assert.equal(reads, 1)
    s.ui.tab = 'bag'
    notify({ ok: true, enabled: true, running: true })
    assert.match(s.content.allText(), /当前关闭/)
    s.ui.tab = 'settings'; s.ui.renderContent()
    assert.match(s.content.allText(), /已允许外部联动/)
  } finally { s.restore() }
})

test('实际split面板适配层保留联动接口，设置开关可调用原生桥', async () => {
  const { installPanel } = await import('../src/client/desktop/panel-window.js')
  const { desktopShell } = await import('../src/client/desktop-shell.js')
  const oldWindow = globalThis.window, oldDocument = globalThis.document
  const calls = []
  const api = { get: async () => ({ ok: true, enabled: false }),
    set: async enabled => { calls.push(enabled); return { ok: true, enabled, running: enabled } } }
  globalThis.window = {}
  globalThis.document = fakeDom().document
  globalThis.document.documentElement = globalThis.document.createElement('html')
  let s
  try {
    installPanel({ external: api, panel: {} })
    assert.equal(desktopShell().external, api)
    s = setup(desktopShell().external)
    await settle()
    findByAttr(s.content, 'data-external-allow', 'true').fire('click')
    await settle()
    assert.deepEqual(calls, [true])
    assert.match(s.content.allText(), /已允许外部联动/)
  } finally {
    s?.restore()
    if (oldWindow === undefined) delete globalThis.window
    else globalThis.window = oldWindow
    if (oldDocument === undefined) delete globalThis.document
    else globalThis.document = oldDocument
  }
})
