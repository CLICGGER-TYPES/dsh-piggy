import assert from 'node:assert/strict'
import { test } from 'node:test'

class Node {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {}; this.listeners = {}; this.style = {}; this.disabled = false; this.value = ''; this.textContent = '' }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node }
  setAttribute(key, value) { this.attrs[key] = String(value) }
  getAttribute(key) { return this.attrs[key] ?? null }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn) }
  removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] ?? []).filter(item => item !== fn) }
  fire(name, event = {}) { for (const fn of this.listeners[name] || []) fn({ target: this, preventDefault() {}, stopPropagation() {}, ...event }) }
  focus() { this.ownerDocument.activeElement = this }
  click() { this.fire('click') }
  contains(node) { for (let cur = node; cur; cur = cur.parentNode) if (cur === this) return true; return false }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null }
  matches(selector) {
    const attr = selector.match(/^\[([\w-]+)="([^"]+)"\]$/)
    if (attr) return this.getAttribute(attr[1]) === attr[2]
    if (selector.includes(':not([disabled])')) return ['BUTTON', 'INPUT'].includes(this.tagName) && !this.disabled
    return selector.toUpperCase() === this.tagName
  }
  querySelectorAll(selector) { const out = []; const visit = node => { for (const child of node.children) { if (child.matches(selector)) out.push(child); visit(child) } }; visit(this); return out }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
  walk(fn) { fn(this); this.children.forEach(child => child.walk(fn)) }
  get allText() { return [this.textContent, ...this.children.map(child => child.allText)].join(' ') }
}

function fixture() {
  const listeners = {}
  const document = {
    activeElement: null,
    body: null,
    createElement(tag) { const node = new Node(tag); node.ownerDocument = document; return node },
    addEventListener(name, fn) { (listeners[name] ??= []).push(fn) },
    removeEventListener(name, fn) { listeners[name] = (listeners[name] || []).filter(item => item !== fn) },
    key(key, shiftKey = false) { for (const fn of listeners.keydown || []) fn({ key, shiftKey, preventDefault() { this.defaultPrevented = true } }) },
  }
  document.body = document.createElement('body')
  document.activeElement = document.body
  const content = document.createElement('main')
  document.body.appendChild(content)
  const ui = { content, view: { pig: {} }, messages: [], showBubble(text) { this.messages.push(text) }, renderContent() {} }
  return { document, content, ui }
}

async function tick() { await new Promise(resolve => setImmediate(resolve)) }

test('save transfer renders a modal, previews only a selected file, traps focus, preserves errors, and cancels without import', async () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldFetch = globalThis.fetch
  const dom = fixture()
  globalThis.document = dom.document
  globalThis.window = { setTimeout: () => 1, location: { reload() {} } }
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith('/preview')) return { ok: true, status: 200, async json() { return { ok: true, token: 'preview-token', summary: { name: '团团', level: 12, createdAt: '2026-10-17 20:30', gameVersion: '0.37.1', extensions: 2, skins: 1 }, warnings: ['有一个扩展需要重新安装'] } } }
    if (url.endsWith('/import')) return { ok: false, status: 503, async json() { return { error: '宿主正忙，请稍后再试' } } }
    return { ok: false, status: 500 }
  }
  try {
    const { renderSaveTransferSettings } = await import('../src/client/save-transfer.js?client-test')
    const section = (ui, title) => {
      const box = document.createElement('section'), head = document.createElement('header')
      box.appendChild(head); ui.content.appendChild(box); return { box, head }
    }
    dom.ui.renderContent = () => {
      dom.content.children.forEach(child => { child.parentNode = null })
      dom.content.children = []
      renderSaveTransferSettings(dom.ui, section)
    }
    renderSaveTransferSettings(dom.ui, section)
    const trigger = dom.content.querySelector('[data-save-trigger="import"]')
    trigger.click()
    assert.equal(dom.content.querySelector('[role="dialog"]').getAttribute('aria-modal'), 'true')
    assert.equal(calls.length, 0, 'opening the file picker must not preview without a selected file')
    let cancel = dom.content.querySelector('[data-save-cancel="true"]')
    const dialog = dom.content.querySelector('[data-save-dialog="true"]')
    cancel.focus()
    dom.document.key('Tab', true)
    assert.equal(dom.document.activeElement, cancel, 'focus remains inside the dialog when only Cancel is available')

    const picker = dom.content.querySelector('[data-save-file="true"]')
    picker.files = [{ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }]
    picker.fire('change')
    await tick()
    await tick()
    assert.equal(calls[0].url, '/dsh-piggy/save/preview')
    assert.equal(calls[0].options.headers['content-type'], 'application/octet-stream')
    assert.match(dom.content.allText, /团团 · Lv\.12/)
    assert.match(dom.content.allText, /有一个扩展需要重新安装/)
    assert.ok(dom.content.querySelector('[role="dialog"]'), 'preview survives another settings render')

    const confirm = dom.content.querySelector('[data-save-confirm="true"]')
    cancel = dom.content.querySelector('[data-save-cancel="true"]')
    cancel.focus()
    dom.document.key('Tab', true)
    assert.equal(dom.document.activeElement, confirm, 'Shift+Tab wraps from the first control to the last')
    dom.document.key('Tab')
    assert.equal(dom.document.activeElement, cancel, 'Tab wraps from the last control to the first')
    confirm.click()
    await tick()
    assert.equal(calls.at(-1).url, '/dsh-piggy/save/import')
    assert.deepEqual(JSON.parse(calls.at(-1).options.body), { token: 'preview-token' })
    assert.match(dom.content.allText, /宿主正忙，请稍后再试/)
    assert.ok(dom.content.querySelector('[role="dialog"]'), 'a failed import leaves the preview available')
    dom.document.key('Escape')
    assert.equal(dom.content.querySelector('[role="dialog"]'), null)
    assert.equal(dom.document.activeElement, dom.content.querySelector('[data-save-trigger="import"]'), 'Escape closes and restores focus to the import button')
    assert.equal(calls.filter(call => call.url.endsWith('/import')).length, 1, 'cancel does not commit')
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
    globalThis.fetch = oldFetch
  }
})

test('panel and extension window wrappers expose the real native save bridge to Settings', async () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldFetch = globalThis.fetch
  const { installPanel } = await import('../src/client/desktop/panel-window.js')
  const { installExt } = await import('../src/client/desktop/ext-window.js')
  const { renderSaveTransferSettings } = await import('../src/client/save-transfer.js?bridge-test')
  const bytes = Uint8Array.from([0x50, 0x4b, 0xff, 0x00, 0x81])
  const saves = []
  globalThis.fetch = async () => new Response(bytes, { headers: {
    'content-disposition': 'attachment; filename="piggy-save-20261017-2030.zip"',
  } })
  try {
    for (const install of [installPanel, installExt]) {
      const dom = fixture()
      dom.document.head = dom.document.createElement('head')
      dom.document.documentElement = dom.document.createElement('html')
      globalThis.document = dom.document
      globalThis.window = { setTimeout: () => 1 }
      install({ saves: { async save(name, data) { saves.push({ name, data }); return { canceled: true } } } })
      const section = (ui, _title) => {
        const box = document.createElement('section'); ui.content.appendChild(box)
        return { box, head: box }
      }
      renderSaveTransferSettings(dom.ui, section)
      dom.content.querySelector('[data-save-trigger="export"]').click()
      await tick()
      const saved = saves.at(-1)
      assert.equal(saved.name, 'piggy-save-20261017-2030.zip')
      assert.ok(saved.data instanceof Uint8Array)
      assert.deepEqual(saved.data, bytes)
      assert.deepEqual(dom.ui.messages, [], 'native cancellation must remain silent')
    }
    assert.equal(saves.length, 2)
  } finally { globalThis.document = oldDocument; globalThis.window = oldWindow; globalThis.fetch = oldFetch }
})

test('an older shell without native save downloads the same ZIP bytes', async t => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldFetch = globalThis.fetch
  const dom = fixture(), downloads = [], blobs = []
  const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0xff])
  const createElement = dom.document.createElement.bind(dom.document)
  dom.document.createElement = tag => {
    const node = createElement(tag)
    if (tag === 'a') node.click = () => downloads.push({ name: node.download, href: node.href })
    return node
  }
  globalThis.document = dom.document
  globalThis.window = { __dshPiggyShell: { beginDrag() {} }, setTimeout: () => 1 }
  globalThis.fetch = async () => new Response(bytes, { headers: {
    'content-disposition': 'attachment; filename="piggy-save-20261017-2030.zip"',
  } })
  t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return 'blob:isolated-backup' })
  try {
    const { renderSaveTransferSettings } = await import('../src/client/save-transfer.js?old-shell-test')
    renderSaveTransferSettings(dom.ui, ui => {
      const box = document.createElement('section'); ui.content.appendChild(box)
      return { box, head: box }
    })
    dom.content.querySelector('[data-save-trigger="export"]').click()
    await tick()
    assert.deepEqual(downloads, [{ name: 'piggy-save-20261017-2030.zip', href: 'blob:isolated-backup' }])
    assert.deepEqual(new Uint8Array(await blobs[0].arrayBuffer()), bytes)
    assert.deepEqual(dom.ui.messages, ['存档已下载'])
  } finally { globalThis.document = oldDocument; globalThis.window = oldWindow; globalThis.fetch = oldFetch }
})

test('保存选择器被权限策略挡住时回退到浏览器下载，不静默取消', async t => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldFetch = globalThis.fetch
  const dom = fixture(), downloads = [], blobs = []
  const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0xff])
  const createElement = dom.document.createElement.bind(dom.document)
  dom.document.createElement = tag => {
    const node = createElement(tag)
    if (tag === 'a') node.click = () => downloads.push({ name: node.download, href: node.href })
    return node
  }
  globalThis.document = dom.document
  globalThis.window = {
    showSaveFilePicker: async () => { throw Object.assign(new Error('blocked by permissions policy'), { name: 'NotAllowedError' }) },
    setTimeout: () => 1,
  }
  globalThis.fetch = async () => new Response(bytes, { headers: {
    'content-disposition': 'attachment; filename="piggy-save-20261017-2030.zip"',
  } })
  t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return 'blob:picker-fallback' })
  try {
    const { renderSaveTransferSettings } = await import('../src/client/save-transfer.js?picker-fallback-test')
    renderSaveTransferSettings(dom.ui, ui => {
      const box = document.createElement('section'); ui.content.appendChild(box)
      return { box, head: box }
    })
    dom.content.querySelector('[data-save-trigger="export"]').click()
    await tick()
    await tick()
    assert.deepEqual(downloads, [{ name: 'piggy-save-20261017-2030.zip', href: 'blob:picker-fallback' }])
    assert.deepEqual(new Uint8Array(await blobs[0].arrayBuffer()), bytes)
    assert.deepEqual(dom.ui.messages, ['存档已下载'])
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
    globalThis.fetch = oldFetch
  }
})

test('连续选择文件时，先到的旧预览响应不能覆盖后选的文件', async () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldFetch = globalThis.fetch
  const dom = fixture()
  let releaseFirst
  const summary = name => ({ name, level: name === '第一个' ? 1 : 2, createdAt: null, gameVersion: 'x', extensions: 0, skins: 0 })
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith('/preview')) {
      if (new Uint8Array(options.body)[0] === 1) {
        await new Promise(resolve => { releaseFirst = resolve })
        return { ok: true, status: 200, async json() { return { ok: true, token: 'first', summary: summary('第一个'), warnings: [] } } }
      }
      return { ok: true, status: 200, async json() { return { ok: true, token: 'second', summary: summary('第二个'), warnings: [] } } }
    }
    return { ok: false, status: 500, async json() { return null } }
  }
  globalThis.document = dom.document
  globalThis.window = { setTimeout: () => 1 }
  try {
    const { renderSaveTransferSettings } = await import('../src/client/save-transfer.js?stale-preview-test')
    dom.ui.renderContent = () => {
      dom.content.children.forEach(child => { child.parentNode = null })
      dom.content.children = []
      renderSaveTransferSettings(dom.ui, ui => {
        const box = document.createElement('section'); ui.content.appendChild(box)
        return { box, head: box }
      })
    }
    dom.ui.renderContent()
    dom.content.querySelector('[data-save-trigger="import"]').click()
    const picker = dom.content.querySelector('[data-save-file="true"]')
    picker.files = [{ arrayBuffer: async () => new Uint8Array([1]).buffer }]
    picker.fire('change')
    await tick()
    assert.equal(typeof releaseFirst, 'function', 'first preview request is in flight')
    picker.files = [{ arrayBuffer: async () => new Uint8Array([2]).buffer }]
    picker.fire('change')
    await tick()
    await tick()
    assert.match(dom.content.allText, /第二个/)
    releaseFirst()
    await tick()
    await tick()
    dom.ui.renderContent()
    assert.match(dom.content.allText, /第二个/)
    assert.doesNotMatch(dom.content.allText, /第一个/)
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
    globalThis.fetch = oldFetch
  }
})

test('网页保存选择器选中文件后写盘失败要报错，不能再偷偷下载一份', async t => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldFetch = globalThis.fetch
  const dom = fixture(), downloads = [], blobs = []
  const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0xff])
  const createElement = dom.document.createElement.bind(dom.document)
  dom.document.createElement = tag => {
    const node = createElement(tag)
    if (tag === 'a') node.click = () => downloads.push({ name: node.download, href: node.href })
    return node
  }
  globalThis.document = dom.document
  globalThis.window = {
    showSaveFilePicker: async () => ({
      createWritable: async () => ({ write: async () => { throw new Error('disk full') }, close: async () => {} }),
    }),
    setTimeout: () => 1,
  }
  globalThis.fetch = async () => new Response(bytes, { headers: {
    'content-disposition': 'attachment; filename="piggy-save-20261017-2030.zip"',
  } })
  t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return 'blob:unexpected-download' })
  try {
    const { renderSaveTransferSettings } = await import('../src/client/save-transfer.js?picker-write-failure-test')
    renderSaveTransferSettings(dom.ui, ui => {
      const box = document.createElement('section'); ui.content.appendChild(box)
      return { box, head: box }
    })
    dom.content.querySelector('[data-save-trigger="export"]').click()
    await tick()
    await tick()
    assert.deepEqual(downloads, [])
    assert.equal(blobs.length, 0)
    assert(dom.ui.messages.some(message => message.includes('disk full')), `expected write error, got ${JSON.stringify(dom.ui.messages)}`)
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
    globalThis.fetch = oldFetch
  }
})
