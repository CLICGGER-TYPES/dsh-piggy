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
  const document = {
    activeElement: null,
    body: null,
    createElement(tag) { const node = new Node(tag); node.ownerDocument = document; return node },
    addEventListener() {},
    removeEventListener() {},
  }
  document.body = document.createElement('body')
  document.activeElement = document.body
  const content = document.createElement('main')
  document.body.appendChild(content)
  const ui = { content, view: { pig: {} }, messages: [], showBubble(text) { this.messages.push(text) }, renderContent() {} }
  ui.document = document
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
  render(dom.ui, (ui, title, note) => section(ui, title, note))
}

async function tick() { await new Promise(resolve => setImmediate(resolve)) }
async function settle() { await tick(); await tick(); await tick() }

async function withDsh(api, run) {
  const oldDocument = globalThis.document, oldWindow = globalThis.window
  const dom = fixture()
  globalThis.document = dom.document
  dom.document.documentElement = dom.document.createElement('html')
  dom.document.head = dom.document.createElement('head')
  globalThis.window = {
    __dshPiggyOwnerCloud: { version: 1, transport: 'dsh', restartAfterImport: false, ...api },
  }
  try {
    await run(dom)
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
  }
}

function moduleFor(name) {
  return import(`../../src/client/owner-cloud-save.js?dsh-owner-cloud-ui-${name}`)
}

test('DSH 没有 owner bridge 时整段隐藏', async () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window
  const dom = fixture()
  globalThis.document = dom.document
  dom.document.documentElement = dom.document.createElement('html')
  dom.document.head = dom.document.createElement('head')
  globalThis.window = {}
  try {
    const mod = await moduleFor('absent')
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.equal(dom.content.allText.includes('完整档云同步'), false, dom.content.allText)
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
  }
})

test('DSH 已配置但未恢复：只有恢复入口，没有上传按钮', async () => {
  let firstSyncCalls = 0
  const api = {
    async ownerStatus() { return { ok: true, available: true, enabled: true, ready: false, branch: 'main' } },
    async firstSync() { firstSyncCalls += 1; throw new Error('must not be called on paint') },
    async importFirstSync() { throw new Error('must not be called on paint') },
    async ownerHistory() { throw new Error('must not be called before ready') },
  }
  await withDsh(api, async dom => {
    const mod = await moduleFor('configured')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.match(dom.content.allText, /完整档云同步/)
    assert.match(dom.content.allText, /待从云端恢复/)
    assert.match(dom.content.allText, /分支 · main/)
    assert.ok(dom.content.querySelector('[data-owner-cloud-restore="true"]'), dom.content.allText)
    assert.equal(dom.content.querySelector('[data-owner-cloud-first-sync="local-to-cloud"]'), null)
    assert.equal(firstSyncCalls, 0)
  })
})

test('DSH status 403 只显示本机可用说明，没有按钮也不会自动重试', async () => {
  let firstSyncCalls = 0
  const api = {
    async ownerStatus() {
      return { ok: false, available: false, code: 'loopback-only', reason: '完整档云同步只在本机打开 DSH 时可用' }
    },
    async firstSync() { firstSyncCalls += 1; throw new Error('must not be called') },
    async importFirstSync() { throw new Error('must not be called') },
    async ownerHistory() { throw new Error('must not be called') },
  }
  await withDsh(api, async dom => {
    const mod = await moduleFor('loopback')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.match(dom.content.allText, /只在本机打开 DSH 时可用/)
    assert.match(dom.content.allText, /127\.0\.0\.1/)
    assert.equal(dom.content.querySelector('[data-owner-cloud-restore="true"]'), null)
    assert.equal(dom.content.querySelector('[data-owner-cloud-retry="true"]'), null)
    assert.equal(firstSyncCalls, 0)
  })
})

test('DSH status 404 显示版本不支持，没有按钮', async () => {
  const api = {
    async ownerStatus() {
      return { ok: false, available: false, code: 'owner-cloud-unsupported', reason: '当前 DSH 或插件版本没有完整档云能力' }
    },
    async firstSync() { throw new Error('must not be called') },
    async importFirstSync() { throw new Error('must not be called') },
    async ownerHistory() { throw new Error('must not be called') },
  }
  await withDsh(api, async dom => {
    const mod = await moduleFor('unsupported')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.match(dom.content.allText, /没有完整档云能力/)
    assert.equal(dom.content.querySelector('[data-owner-cloud-restore="true"]'), null)
    assert.equal(dom.content.querySelector('[data-owner-cloud-retry="true"]'), null)
  })
})

test('DSH 网络失败给一次手动重新检查，恢复后出现入口', async () => {
  let statusCalls = 0
  const api = {
    async ownerStatus() {
      statusCalls += 1
      return statusCalls === 1
        ? { ok: false, available: false, code: 'network', reason: '无法连接 DSH 后端' }
        : { ok: true, available: true, enabled: true, ready: false, branch: 'main' }
    },
    async firstSync() { throw new Error('must not be called') },
    async importFirstSync() { throw new Error('must not be called') },
    async ownerHistory() { throw new Error('must not be called') },
  }
  await withDsh(api, async dom => {
    const mod = await moduleFor('network')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.match(dom.content.allText, /无法连接 DSH 后端/)
    const retry = dom.content.querySelector('[data-owner-cloud-retry="true"]')
    assert.ok(retry, dom.content.allText)
    assert.equal(dom.content.querySelector('[data-owner-cloud-restore="true"]'), null)
    retry.click()
    await settle()
    assert.equal(statusCalls, 2)
    assert.ok(dom.content.querySelector('[data-owner-cloud-restore="true"]'), dom.content.allText)
  })
})

test('DSH 未启用 ownerCloud 时只给静态配置说明，不调用 firstSync', async () => {
  let firstSyncCalls = 0
  const api = {
    async ownerStatus() { return { ok: true, available: true, enabled: false, ready: false, branch: 'main' } },
    async firstSync() { firstSyncCalls += 1; throw new Error('must not be called') },
    async importFirstSync() { throw new Error('must not be called') },
    async ownerHistory() { throw new Error('must not be called') },
  }
  await withDsh(api, async dom => {
    const mod = await moduleFor('disabled')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.match(dom.content.allText, /未配置/)
    assert.match(dom.content.allText, /在 DSH 插件配置里启用 ownerCloud/)
    assert.equal(dom.content.querySelector('[data-owner-cloud-restore="true"]'), null)
    assert.equal(firstSyncCalls, 0)
  })
})

test('DSH 预览不重启应用，警告勾选在 4 秒重绘中保留，确认只传 token 和确认位', async () => {
  const firstSyncCalls = [], importCalls = []
  let refreshCalls = 0, historyCalls = 0
  const api = {
    async ownerStatus() { return { ok: true, available: true, enabled: true, ready: false, branch: 'main' } },
    async firstSync(direction) {
      firstSyncCalls.push(direction)
      return {
        ok: true,
        direction,
        token: 'dsh-token-1',
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
      return { ok: true, imported: true, switched: true }
    },
    async ownerHistory() { historyCalls += 1; return { ok: true, manual: null, auto: [] } },
  }
  await withDsh(api, async dom => {
    const mod = await moduleFor('restore')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    dom.ui.refresh = () => { refreshCalls += 1 }
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    dom.content.querySelector('[data-owner-cloud-restore="true"]').click()
    await settle()
    assert.deepEqual(firstSyncCalls, ['cloud-to-local'])
    assert.match(dom.content.allText, /云端完整档预览/)
    assert.match(dom.content.allText, /包含 1 只小猪/)
    assert.match(dom.content.allText, /金币 1,234/)
    assert.match(dom.content.allText, /DSH 不会重启/)
    assert.doesNotMatch(dom.content.allText, /应用会重启/)
    assert.equal(dom.content.querySelector('[data-owner-cloud-import="true"]').disabled, true)

    for (let index = 0; index < 3; index += 1) {
      paint(mod.renderOwnerCloudSaveSettings, dom)
      await tick()
    }
    assert.equal(firstSyncCalls.length, 1, 'timed repaints do not re-read the cloud')
    assert.equal(importCalls.length, 0, 'preview never imports by itself')

    const ack = dom.content.querySelector('[data-owner-cloud-warnings="true"]')
    ack.checked = true
    ack.fire('change')
    assert.equal(dom.content.querySelector('[data-owner-cloud-import="true"]').disabled, false)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await tick()
    assert.equal(dom.content.querySelector('[data-owner-cloud-warnings="true"]').checked, true)

    dom.content.querySelector('[data-owner-cloud-import="true"]').click()
    await settle()
    assert.deepEqual(importCalls, [{ token: 'dsh-token-1', options: { acceptWarnings: true } }])
    assert.match(dom.content.allText, /已切换到新副本，正在刷新/)
    assert.doesNotMatch(dom.content.allText, /应用会重启/)
    assert.doesNotMatch(dom.content.allText, /正在保存并切换/)
    assert.equal(refreshCalls, 1, 'DSH refreshes the panel instead of waiting for a restart')
    assert.equal(historyCalls, 1, 'a restored archive refreshes the read-only history')
    assert.match(dom.content.allText, /云端还没有可显示的存档历史/)
    assert.ok(dom.content.querySelector('[data-owner-cloud-restore="true"]'), 'a ready archive can be restored again')
    assert.equal(globalThis.window.__dshPiggyPollPauseUntil, undefined, 'the poll pause is cleared after import')

    dom.content.querySelector('[data-owner-cloud-restore="true"]').click()
    await settle()
    assert.equal(firstSyncCalls.length, 2, 'the second restore also previews first')
  })
})

test('DSH imported:true 失败说明副本保留但没有切换，并清掉预览', async () => {
  const api = {
    async ownerStatus() { return { ok: true, available: true, enabled: true, ready: false, branch: 'main' } },
    async firstSync() {
      return { ok: true, token: 'token-copy', summary: { pigCount: 1, pigs: [] }, warnings: [] }
    },
    async importFirstSync() {
      return { ok: false, imported: true, reason: 'Owner copy could not be activated; the new copy was kept' }
    },
    async ownerHistory() { throw new Error('must not be called before ready') },
  }
  await withDsh(api, async dom => {
    const mod = await moduleFor('imported')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    dom.content.querySelector('[data-owner-cloud-restore="true"]').click()
    await settle()
    dom.content.querySelector('[data-owner-cloud-import="true"]').click()
    await settle()
    assert.match(dom.content.allText, /副本已建立，但没有切换/)
    assert.match(dom.content.allText, /new copy was kept/)
    assert.equal(dom.content.querySelector('[data-owner-cloud-import="true"]'), null)
    assert.ok(dom.content.querySelector('[data-owner-cloud-restore="true"]'), 'the current archive can be retried with a new preview')
  })
})

test('DSH 结果未知不自动重试，清预览后只能重新检查', async () => {
  const importCalls = []
  let statusCalls = 0
  const api = {
    async ownerStatus() {
      statusCalls += 1
      return statusCalls === 1
        ? { ok: true, available: true, enabled: true, ready: false, branch: 'main' }
        : { ok: true, available: true, enabled: true, ready: true, branch: 'main' }
    },
    async firstSync() {
      return { ok: true, token: 'token-unknown', summary: { pigCount: 1, pigs: [] }, warnings: [] }
    },
    async importFirstSync(token) {
      importCalls.push(token)
      return { ok: false, code: 'unknown', unknown: true, reason: '恢复请求的结果未知；请检查当前完整档' }
    },
    async ownerHistory() { return { ok: true, manual: null, auto: [] } },
  }
  await withDsh(api, async dom => {
    const mod = await moduleFor('unknown')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    dom.content.querySelector('[data-owner-cloud-restore="true"]').click()
    await settle()
    dom.content.querySelector('[data-owner-cloud-import="true"]').click()
    await settle()
    assert.equal(importCalls.length, 1)
    assert.match(dom.content.allText, /结果未知/)
    assert.equal(dom.content.querySelector('[data-owner-cloud-import="true"]'), null)
    assert.equal(dom.content.querySelector('[data-owner-cloud-restore="true"]'), null)
    const check = dom.content.querySelector('[data-owner-cloud-check="true"]')
    assert.ok(check, dom.content.allText)
    await settle()
    assert.equal(importCalls.length, 1, 'nothing retries the consumed token')
    check.click()
    await settle()
    assert.equal(statusCalls, 2)
    assert.ok(dom.content.querySelector('[data-owner-cloud-restore="true"]'), dom.content.allText)
  })
})

test('DSH 已连接仍显示恢复入口，历史只读且没有覆盖操作', async () => {
  const api = {
    async ownerStatus() { return { ok: true, available: true, enabled: true, ready: true, branch: 'main' } },
    async firstSync() { throw new Error('must not be called before click') },
    async importFirstSync() { throw new Error('must not be called') },
    async ownerHistory() {
      return { ok: true, manual: { hash: 'abcdef1234567890', at: '2026-11-04T10:20:00.000Z', subject: '手动存档', manual: true }, auto: [
        { hash: '1234567abcdef', at: '2026-11-03T09:05:00.000Z', subject: '自动存档' },
      ] }
    },
  }
  await withDsh(api, async dom => {
    const mod = await moduleFor('ready')
    dom.ui.renderContent = () => paint(mod.renderOwnerCloudSaveSettings, dom)
    paint(mod.renderOwnerCloudSaveSettings, dom)
    await settle()
    assert.match(dom.content.allText, /已连接/)
    assert.ok(dom.content.querySelector('[data-owner-cloud-restore="true"]'), 'ready does not hide restore')
    assert.equal(dom.content.querySelector('[data-owner-cloud-first-sync="local-to-cloud"]'), null)
    assert.equal(dom.content.querySelectorAll('[data-owner-cloud-history="true"]').length, 2)
    assert.equal(dom.content.querySelectorAll('button').some(node => /恢复此版本|强制|覆盖/.test(node.textContent)), false)
  })
})

test('DSH owner 模式隐藏扁平云存档段，不请求不存在的 /cloud/settings', async () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window
  const dom = fixture()
  globalThis.document = dom.document
  dom.document.documentElement = dom.document.createElement('html')
  dom.document.head = dom.document.createElement('head')
  const calls = []
  globalThis.window = {
    __dshPiggyOwnerMode: true,
    __dshPiggyCloudSave: {
      get() { calls.push('get') },
      set() { calls.push('set') },
      test() { calls.push('test') },
    },
  }
  try {
    const mod = await import('../../src/client/tabs/cloud-save.js?dsh-flat-hidden')
    paint(mod.renderCloudSaveSettings, dom)
    await settle()
    assert.equal(dom.content.children.length, 0)
    assert.deepEqual(calls, [])
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
  }
})
