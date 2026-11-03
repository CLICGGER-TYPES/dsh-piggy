// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

class Node {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {}; this.listeners = {}; this.style = {}; this.disabled = false; this.checked = false; this.textContent = '' }
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

async function tick() { await new Promise(resolve => setImmediate(resolve)) }

test('owner archive UI keeps flat import disabled in owner mode and requires explicit warning acknowledgement', async () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window
  const dom = fixture()
  const calls = []
  const api = {
    async status() { return { ok: true, available: true, mode: 'owner', flatImportAllowed: false } },
    async export() { return { ok: true } },
    async preview(bytes) {
      calls.push({ method: 'preview', bytes: [...bytes] })
      return { ok: true, token: 'opaque-preview', summary: {
        pigs: [{ name: '小猪甲', ageMs: 172_800_000, xp: 42, weightG: 320, wornCount: 1 }],
        shared: { coins: 1234, inventoryCount: 3, garden: { unlocked: 4, planted: 2 } },
      }, warnings: ['有一项可选资源无法验证'] }
    },
    async importAndSwitch(token, options) { calls.push({ method: 'import', token, options }); return { ok: true, restarting: true } },
  }
  globalThis.document = dom.document
  globalThis.window = { __dshPiggyShell: { beginDrag() {}, ownerArchives: api } }
  try {
    const { renderSaveTransferSettings } = await import('../src/client/save-transfer.js?owner-archive-ui-test')
    const section = (ui, title, note) => {
      const box = document.createElement('section'), head = document.createElement('header')
      const label = document.createElement('b'); label.textContent = title; head.appendChild(label)
      if (note) { const summary = document.createElement('small'); summary.textContent = note; head.appendChild(summary) }
      box.appendChild(head); ui.content.appendChild(box); return { box, head }
    }
    dom.ui.renderContent = () => {
      dom.content.children = []
      renderSaveTransferSettings(dom.ui, section)
    }
    renderSaveTransferSettings(dom.ui, section)
    await tick(); await tick()
    assert.ok(dom.content.allText.includes('全部小猪与共享资产'), dom.content.allText)
    assert.equal(dom.content.querySelector('[data-save-trigger="import"]').disabled, true)

    dom.content.querySelector('[data-owner-archive-import="true"]').click()
    const picker = dom.content.querySelector('[data-owner-archive-file="true"]')
    assert.ok(picker)
    picker.files = [{ arrayBuffer: async () => Uint8Array.from([0x50, 0x4b]).buffer }]
    picker.fire('change')
    await tick(); await tick()
    assert.equal(calls[0].method, 'preview')
    assert.match(dom.content.allText, /小猪甲/)
    assert.match(dom.content.allText, /经验 42/)
    assert.match(dom.content.allText, /金币 1,234/)
    assert.match(dom.content.allText, /3 件物品/)
    assert.match(dom.content.allText, /已开垦 4 块 · 种植中 2 块/)
    assert.match(dom.content.allText, /本机显示与声音偏好保留/)
    assert.match(dom.content.allText, /当前存档保留/)
    assert.equal(dom.content.querySelector('[data-owner-archive-confirm="true"]').disabled, true)
    const ack = dom.content.querySelector('[data-owner-archive-warnings="true"]')
    ack.checked = true
    ack.fire('change')
    const confirm = dom.content.querySelector('[data-owner-archive-confirm="true"]')
    assert.equal(confirm.disabled, false)
    confirm.click()
    await tick()
    assert.deepEqual(calls.at(-1), { method: 'import', token: 'opaque-preview', options: { acceptWarnings: true } })
    assert.equal(dom.content.querySelector('[data-owner-archive-dialog="true"]'), null)
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
  }
})
