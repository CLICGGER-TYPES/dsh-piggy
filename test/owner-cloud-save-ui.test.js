// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

class Node {
  constructor(tag) {
    this.tagName = tag.toUpperCase()
    this.children = []
    this.parentNode = null
    this.attrs = {}
    this.listeners = {}
    this.style = { cssText: '' }
    this.className = ''
    this.disabled = false
    this.checked = false
    this.textContent = ''
  }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node }
  setAttribute(key, value) { this.attrs[key] = String(value) }
  getAttribute(key) { return this.attrs[key] ?? null }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn) }
  removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] ?? []).filter(item => item !== fn) }
  fire(name, event = {}) { for (const fn of this.listeners[name] || []) fn({ target: this, preventDefault() {}, stopPropagation() {}, ...event }) }
  focus() { this.ownerDocument.activeElement = this }
  click() { if (!this.disabled) this.fire('click') }
  contains(node) { for (let cur = node; cur; cur = cur.parentNode) if (cur === node) return true; return false }
  matches(selector) {
    const attr = selector.match(/^\[([\w-]+)="([^"]+)"\]$/)
    if (attr) return this.getAttribute(attr[1]) === attr[2]
    return selector.toUpperCase() === this.tagName
  }
  querySelectorAll(selector) { const out = []; const visit = node => { for (const child of node.children) { if (child.matches(selector)) out.push(child); visit(child) } }; visit(this); return out }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
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
  }
  document.body = document.createElement('body')
  document.activeElement = document.body
  const content = document.createElement('main')
  document.body.appendChild(content)
  const ui = { content, view: { pig: {} }, messages: [], showBubble(text) { this.messages.push(text) }, renderContent() {} }
  return { document, content, ui }
}

function section(ui, title, note) {
  const box = ui.document.createElement('section')
  const head = ui.document.createElement('header')
  const label = ui.document.createElement('b')
  label.textContent = title
  head.appendChild(label)
  if (note) { const summary = ui.document.createElement('small'); summary.textContent = note; head.appendChild(summary) }
  box.appendChild(head)
  ui.content.appendChild(box)
  return { box, head }
}

function paint(render, dom) {
  dom.content.children = []
  render(dom.ui, (ui, title, note) => section({ ...ui, document: dom.document }, title, note))
}

async function tick() { await new Promise(resolve => setImmediate(resolve)) }
async function settle() { await tick(); await tick(); await tick() }

async function withDesktop(api, run) {
  const oldDocument = globalThis.document, oldWindow = globalThis.window
  const dom = fixture()
  dom.ui.document = dom.document
  globalThis.document = dom.document
  dom.document.documentElement = dom.document.createElement('html')
  dom.document.head = dom.document.createElement('head')
  globalThis.window = {}
  try {
    const { installPanel } = await import('../src/client/desktop/panel-window.js?owner-cloud-save-ui-bridge')
    installPanel({ cloudSave: api })
    await run(dom)
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
  }
}

function moduleFor(name) {
  return import(`../src/client/owner-cloud-save.js?owner-cloud-save-ui-${name}`)
}

test('完整档云同步在没有 ownerStatus 的 DSH/旧外壳里整段隐藏', async () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window
  const dom = fixture()
  dom.ui.document = dom.document
  globalThis.document = dom.document
  dom.document.documentElement = dom.document.createElement('html')
  dom.document.head = dom.document.createElement('head')
  globalThis.window = {}
  try {
    const { installPanel } = await import('../src/client/desktop/panel-window.js?owner-cloud-save-ui-no-bridge')
    const mod = await moduleFor('no-bridge')
    installPanel({})
    paint(mod.renderOwnerCloudSaveSettings, dom)
    assert.equal(dom.content.allText.includes('完整档云同步'), false, dom.content.allText)

    // Legacy shell: cloudSave exists for the flat form, but it has no ownerStatus.
    installPanel({ cloudSave: { get() {}, set() {}, test() {} } })
    paint(mod.renderOwnerCloudSaveSettings, dom)
    assert.equal(dom.content.allText.includes('完整档云同步'), false, dom.content.allText)
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
  }
})

test('完整档云同步在 legacy/不可用状态隐藏，不显示死按钮', async () => {
  let statusCalls = 0
  const api = {
    async ownerStatus() { statusCalls += 1; return { available: false, ready: false, enabled: false, branch: 'main', reason: 'legacy' } },
    async firstSync() { throw new Error('must not be called') },
    async importFirstSync() { throw new Error('must not be called') },
    async ownerHistory() { throw new Error('must not be called') },
  }
  await withDesktop(api, async dom => {
    const mod = await moduleFor('unavailable')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.equal(dom.content.allText.includes('完整档云同步'), false, dom.content.allText)
    assert.equal(statusCalls, 1)
  })
})

test('已连接显示 branch，历史只读列出时间、短 hash 和 subject，轮询不重复 IPC', async () => {
  let statusCalls = 0, historyCalls = 0
  const api = {
    async ownerStatus() {
      statusCalls += 1
      return { available: true, ready: true, enabled: true, branch: 'release/2026' }
    },
    async firstSync() { throw new Error('must not be called') },
    async importFirstSync() { throw new Error('must not be called') },
    async ownerHistory(branch) {
      historyCalls += 1
      assert.equal(branch, 'release/2026')
      return { ok: true, manual: {
        hash: 'abcdef1234567890', at: '2026-11-04T10:20:00.000Z', subject: 'save-manual: 手动存档',
      }, auto: [
        { hash: '1234567abcdef', at: '2026-11-03T09:05:00.000Z', subject: 'save: 自动存档' },
      ] }
    },
  }
  await withDesktop(api, async dom => {
    const mod = await moduleFor('connected')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.match(dom.content.allText, /完整档云同步/)
    assert.match(dom.content.allText, /已连接/)
    assert.match(dom.content.allText, /分支 · release\/2026/)
    assert.match(dom.content.allText, /手动存档/)
    assert.match(dom.content.allText, /自动存档/)
    assert.match(dom.content.allText, /abcdef1/)
    assert.match(dom.content.allText, /1234567/)
    assert.equal(dom.content.querySelectorAll('[data-owner-cloud-history="true"]').length, 2)
    assert.equal(dom.content.querySelector('[data-owner-cloud-restore]'), null)
    assert.equal(dom.content.querySelectorAll('button').some(node => /恢复此版本|强制|覆盖/.test(node.textContent)), false)

    for (let index = 0; index < 4; index += 1) {
      paint(mod.renderOwnerCloudSaveSettings, dom)
      await tick()
    }
    assert.equal(statusCalls, 1, 'timed repaints reuse the cached status')
    assert.equal(historyCalls, 1, 'timed repaints reuse the cached history')
  })
})

test('本机完整档上传只在点击后执行，成功后变为已连接并读取历史', async () => {
  const firstSyncCalls = []
  let historyCalls = 0
  const api = {
    async ownerStatus() { return { available: true, ready: false, enabled: true, branch: 'main' } },
    async firstSync(direction) {
      firstSyncCalls.push(direction)
      return { ok: true, direction, created: true, remoteHead: 'a'.repeat(40) }
    },
    async importFirstSync() { throw new Error('must not be called') },
    async ownerHistory() { historyCalls += 1; return { ok: true, manual: null, auto: [] } },
  }
  await withDesktop(api, async dom => {
    const mod = await moduleFor('upload')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.match(dom.content.allText, /待首次同步/)
    assert.equal(firstSyncCalls.length, 0, 'first sync never runs on paint')

    const upload = dom.content.querySelector('[data-owner-cloud-first-sync="local-to-cloud"]')
    assert.ok(upload, dom.content.allText)
    assert.equal(upload.disabled, false)
    upload.click()
    await settle()
    assert.deepEqual(firstSyncCalls, ['local-to-cloud'])
    assert.match(dom.content.allText, /已连接/)
    assert.equal(dom.content.querySelector('[data-owner-cloud-first-sync="local-to-cloud"]'), null)
    assert.equal(historyCalls, 1)
    assert.match(dom.content.allText, /云端还没有可显示的存档历史/)
  })
})

test('从云端恢复先预览，警告必须勾选，确认参数正确且轮询不丢勾选', async () => {
  const firstSyncCalls = [], importCalls = []
  const api = {
    async ownerStatus() { return { available: true, ready: false, enabled: true, branch: 'main' } },
    async firstSync(direction) {
      firstSyncCalls.push(direction)
      return {
        ok: true,
        direction,
        token: 'cloud-token-1',
        summary: {
          pigCount: 1,
          pigs: [{ name: '团团', ageMs: 172_800_000, xp: 42, weightG: 320, wornCount: 1 }],
          shared: { coins: 1234, inventoryCount: 3, garden: { unlocked: 4, planted: 2 } },
        },
        warnings: ['云端存档来自另一台设备'],
      }
    },
    async importFirstSync(token, options) {
      importCalls.push({ token, options })
      return { ok: true, restarting: true }
    },
    async ownerHistory() { throw new Error('must not be called before first sync completes') },
  }
  await withDesktop(api, async dom => {
    const mod = await moduleFor('restore')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    dom.content.querySelector('[data-owner-cloud-first-sync="cloud-to-local"]').click()
    await settle()
    assert.deepEqual(firstSyncCalls, ['cloud-to-local'])
    assert.match(dom.content.allText, /云端完整档预览/)
    assert.match(dom.content.allText, /包含 1 只小猪/)
    assert.match(dom.content.allText, /团团/)
    assert.match(dom.content.allText, /金币 1,234/)
    assert.match(dom.content.allText, /3 件物品/)
    assert.match(dom.content.allText, /已开垦 4 块 · 种植中 2 块/)
    assert.match(dom.content.allText, /云端存档来自另一台设备/)
    assert.equal(dom.content.querySelector('[data-owner-cloud-import="true"]').disabled, true)

    for (let index = 0; index < 3; index += 1) {
      paint(mod.renderOwnerCloudSaveSettings, dom)
      await tick()
    }
    assert.equal(firstSyncCalls.length, 1, 'timed repaints do not re-read the cloud')
    assert.equal(importCalls.length, 0, 'preview never imports by itself')
    assert.equal(dom.content.querySelector('[data-owner-cloud-import="true"]').disabled, true)

    const ack = dom.content.querySelector('[data-owner-cloud-warnings="true"]')
    ack.checked = true
    ack.fire('change')
    assert.equal(dom.content.querySelector('[data-owner-cloud-import="true"]').disabled, false)

    paint(mod.renderOwnerCloudSaveSettings, dom)
    await tick()
    assert.equal(dom.content.querySelector('[data-owner-cloud-warnings="true"]').checked, true,
      'a timed repaint keeps the acknowledgement')
    assert.equal(dom.content.querySelector('[data-owner-cloud-import="true"]').disabled, false)

    dom.content.querySelector('[data-owner-cloud-import="true"]').click()
    await settle()
    assert.deepEqual(importCalls, [{ token: 'cloud-token-1', options: { acceptWarnings: true } }])
    assert.match(dom.content.allText, /正在保存并切换…/)
    assert.equal(dom.content.querySelector('[data-owner-cloud-import="true"]').disabled, true)
    assert.equal(firstSyncCalls.length, 1, 'import does not start another first sync')
  })
})

test('冲突错误显示原因且不提供强制覆盖按钮', async () => {
  let reason = 'remote-has-history'
  const api = {
    async ownerStatus() { return { available: true, ready: false, enabled: true, branch: 'main' } },
    async firstSync() { return { ok: false, reason } },
    async importFirstSync() { throw new Error('must not be called') },
    async ownerHistory() { throw new Error('must not be called') },
  }
  await withDesktop(api, async dom => {
    const mod = await moduleFor('conflicts')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    const codes = ['remote-has-history', 'remote-owner-mismatch', 'remote-branch-empty', 'remote-advanced', 'first-sync-required']
    for (const code of codes) {
      reason = code
      dom.content.querySelector('[data-owner-cloud-first-sync="local-to-cloud"]').click()
      await settle()
      const alert = dom.content.querySelector(`[data-owner-cloud-error="${code}"]`)
      assert.ok(alert, `${code}: ${dom.content.allText}`)
      assert.match(alert.className, /dp-alert/)
      assert.match(alert.className, /dp-legacy/)
      assert.notEqual(alert.allText.trim(), '')
      assert.equal(dom.content.querySelector('[data-owner-cloud-force]'), null)
      assert.equal(dom.content.querySelectorAll('button').some(node => /强制|覆盖/.test(node.textContent)), false,
        'conflicts never offer a force-overwrite action')
    }
  })
})

test('未启用云存档时首次同步方向可见但不可执行，并说明先启用', async () => {
  let firstSyncCalls = 0
  const api = {
    async ownerStatus() { return { available: true, ready: false, enabled: false, branch: 'main' } },
    async firstSync() { firstSyncCalls += 1; return { ok: false, reason: '请先启用并保存仓库地址' } },
    async importFirstSync() { throw new Error('must not be called') },
    async ownerHistory() { throw new Error('must not be called') },
  }
  await withDesktop(api, async dom => {
    const mod = await moduleFor('disabled')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.match(dom.content.allText, /未连接/)
    assert.match(dom.content.allText, /先在上面的「云存档」启用并填写仓库地址/)
    const upload = dom.content.querySelector('[data-owner-cloud-first-sync="local-to-cloud"]')
    const restore = dom.content.querySelector('[data-owner-cloud-first-sync="cloud-to-local"]')
    assert.ok(upload)
    assert.ok(restore)
    assert.equal(upload.disabled, true)
    assert.equal(restore.disabled, true)
    upload.click()
    restore.click()
    assert.equal(firstSyncCalls, 0)
  })
})
