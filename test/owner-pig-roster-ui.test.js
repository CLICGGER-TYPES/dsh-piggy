// @ts-check
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

class Node {
  constructor(tag) {
    this.tagName = tag.toUpperCase()
    this.children = []
    this.parentNode = null
    this.attrs = {}
    this.listeners = {}
    this.style = {}
    this.disabled = false
    this.textContent = ''
  }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node }
  setAttribute(key, value) { this.attrs[key] = String(value) }
  getAttribute(key) { return this.attrs[key] ?? null }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn) }
  removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] ?? []).filter(item => item !== fn) }
  fire(name, event = {}) { for (const fn of this.listeners[name] || []) fn({ target: this, preventDefault() {}, stopPropagation() {}, ...event }) }
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
  document.documentElement = document.createElement('html')
  document.head = document.createElement('head')
  const content = document.createElement('main')
  document.body.appendChild(content)
  const ui = { content, view: { pig: {} }, messages: [], showBubble(text) { this.messages.push(text) } }
  return { document, content, ui }
}

function sectionFor(dom) {
  return (title, note) => {
    const box = dom.document.createElement('section'), head = dom.document.createElement('header')
    const label = dom.document.createElement('b')
    label.textContent = title
    head.appendChild(label)
    if (note) {
      const summary = dom.document.createElement('small')
      summary.textContent = note
      head.appendChild(summary)
    }
    box.appendChild(head)
    dom.ui.content.appendChild(box)
    return { box, head }
  }
}

async function tick() { await new Promise(resolve => setImmediate(resolve)) }
async function settle() { await tick(); await tick() }

let sequence = 0

/** Fresh module instances keep the roster cache per test, like a fresh page. */
async function load(api) {
  const dom = fixture()
  const oldDocument = globalThis.document, oldWindow = globalThis.window
  globalThis.document = dom.document
  globalThis.window = {}
  const suffix = `owner-pig-roster-ui-${sequence += 1}`
  const { installPanel } = await import(`../src/client/desktop/panel-window.js?${suffix}`)
  installPanel(api ? { ownerPigs: api } : {})
  const { renderOwnerPigSettings } = await import(`../src/client/owner-pigs.js?${suffix}`)
  const section = sectionFor(dom)
  dom.ui.renderContent = () => {
    dom.content.children = []
    renderOwnerPigSettings(dom.ui, section)
  }
  return { dom, render: () => renderOwnerPigSettings(dom.ui, section), restore: () => { globalThis.document = oldDocument; globalThis.window = oldWindow } }
}

test('the panel bridge forwards ownerPigs and the settings page places the roster before cloud save', async () => {
  const api = { status() {}, list() {} }
  const loaded = await load(api)
  try {
    assert.equal(globalThis.window.__dshPiggyShell.ownerPigs, api,
      'the panel adapter must expose the preload roster capability used by Settings')
    const source = readFileSync(new URL('../src/client/tabs/settings.js', import.meta.url), 'utf8')
    const transfer = source.indexOf('renderSaveTransferSettings(ui, section)')
    const roster = source.indexOf('renderOwnerPigSettings(ui, section)')
    const cloud = source.indexOf('renderCloudSaveSettings(ui, section)')
    assert.ok(transfer >= 0 && roster > transfer && cloud > roster, 'roster section sits between save transfer and cloud save')
  } finally { loaded.restore() }
})

test('desktop roster lists pigs, caches status/list across repaints, and stops polling once a switch restarts the host', async () => {
  let statusCalls = 0, listCalls = 0
  const switches = []
  const api = {
    async status() { statusCalls += 1; return { ok: true, available: true, mode: 'owner', activePigId: 'pig-b' } },
    async list() {
      listCalls += 1
      return { ok: true, pigs: [
        { pigId: 'pig-a', name: '花花', hatched: true, dead: false, stage: 'young' },
        { pigId: 'pig-b', name: '圆圆', hatched: true, dead: false, stage: 'middle', selected: true },
      ] }
    },
    async select(pigId) { switches.push(pigId); return { ok: true, restarting: true } },
    async addAndSelect() { throw new Error('add is not used in this test') },
  }
  const loaded = await load(api)
  try {
    loaded.render()
    await settle()
    assert.match(loaded.dom.content.allText, /花花/)
    assert.match(loaded.dom.content.allText, /圆圆/)
    assert.match(loaded.dom.content.allText, /青年猪/)
    assert.match(loaded.dom.content.allText, /成年猪/)
    assert.match(loaded.dom.content.allText, /当前/)
    assert.equal(loaded.dom.content.querySelector('[data-owner-pig-switch="pig-b"]'), null, 'the current pig has no switch button')
    assert.equal(loaded.dom.content.querySelector('[data-owner-pig-switch="pig-a"]').disabled, false)
    assert.ok(!loaded.dom.content.allText.includes('pig-a'), 'pigId is a local target, not an account shown to the user')

    loaded.render()
    await settle()
    assert.equal(statusCalls, 1, 'status is cached across the panel repaint')
    assert.equal(listCalls, 1, 'roster is cached across the panel repaint')

    loaded.dom.content.querySelector('[data-owner-pig-switch="pig-a"]').click()
    const pending = loaded.dom.content.querySelector('[data-owner-pig-switch="pig-a"]')
    assert.equal(pending.disabled, true, 'switching disables the roster while the host saves')
    assert.match(pending.textContent, /正在保存并切换/)
    assert.equal(loaded.dom.content.querySelector('[data-owner-pig-add="true"]').disabled, true)
    await settle()
    assert.deepEqual(switches, ['pig-a'])
    assert.match(loaded.dom.content.allText, /正在保存并切换/)
    assert.match(loaded.dom.content.allText, /自动重启/)
    assert.equal(loaded.dom.content.querySelector('[data-owner-pig-switch="pig-a"]'), null)

    loaded.render()
    await settle()
    assert.equal(statusCalls, 1, 'restarting must not poll the old host status')
    assert.equal(listCalls, 1, 'restarting must not poll the old roster')
  } finally { loaded.restore() }
})

test('adding a pig shows the restarting state and disables the roster buttons', async () => {
  let addCalls = 0
  const api = {
    async status() { return { ok: true, available: true, mode: 'owner' } },
    async list() { return { ok: true, pigs: [{ pigId: 'pig-a', name: '花花', hatched: true, dead: false, stage: 'piglet', selected: true }] } },
    async select() { throw new Error('switch is not used in this test') },
    async addAndSelect() { addCalls += 1; return { ok: true, pigId: 'pig-new', restarting: true } },
  }
  const loaded = await load(api)
  try {
    loaded.render()
    await settle()
    const add = loaded.dom.content.querySelector('[data-owner-pig-add="true"]')
    assert.equal(add.disabled, false)
    add.click()
    const pending = loaded.dom.content.querySelector('[data-owner-pig-add="true"]')
    assert.equal(pending.disabled, true)
    assert.match(pending.textContent, /正在保存并重启/)
    await settle()
    assert.equal(addCalls, 1)
    assert.match(loaded.dom.content.allText, /正在保存并重启/)
    assert.match(loaded.dom.content.allText, /自动重启/)
  } finally { loaded.restore() }
})

test('a failed switch keeps the reason visible and lets the user try again', async () => {
  let listCalls = 0
  const api = {
    async status() { return { ok: true, available: true, mode: 'owner' } },
    async list() {
      listCalls += 1
      return { ok: true, pigs: [
        { pigId: 'pig-a', name: '花花', hatched: true, dead: false, stage: 'piglet' },
        { pigId: 'pig-b', name: '圆圆', hatched: true, dead: false, stage: 'young', selected: true },
      ] }
    },
    async select() { return { ok: false, reason: '所选小猪不属于当前本机完整存档' } },
    async addAndSelect() { throw new Error('add is not used in this test') },
  }
  const loaded = await load(api)
  try {
    loaded.render()
    await settle()
    loaded.dom.content.querySelector('[data-owner-pig-switch="pig-a"]').click()
    await settle()
    assert.match(loaded.dom.content.allText, /所选小猪不属于当前本机完整存档/)
    const retrySwitch = loaded.dom.content.querySelector('[data-owner-pig-switch="pig-a"]')
    assert.equal(retrySwitch.disabled, false, 'failure re-enables switching')
    assert.equal(listCalls, 1, 'a failed switch reuses the cached roster')
  } finally { loaded.restore() }
})

test('an unavailable owner mode shows the reason without any dead switch buttons', async () => {
  let listCalls = 0
  const api = {
    async status() { return { ok: true, available: false, mode: 'owner', reason: '请先建立或选择一份本机完整存档' } },
    async list() { listCalls += 1; return { ok: true, pigs: [] } },
    async select() { throw new Error('unavailable mode must not switch') },
    async addAndSelect() { throw new Error('unavailable mode must not add') },
  }
  const loaded = await load(api)
  try {
    loaded.render()
    await settle()
    assert.match(loaded.dom.content.allText, /请先建立或选择一份本机完整存档/)
    assert.equal(loaded.dom.content.querySelector('[data-owner-pig-switch]'), null)
    assert.equal(loaded.dom.content.querySelector('[data-owner-pig-add="true"]'), null)
    assert.ok(loaded.dom.content.querySelector('[data-owner-pig-retry="true"]'), 'a live retry action is allowed')
    assert.equal(listCalls, 0, 'the roster is not requested when owner mode is unavailable')
  } finally { loaded.restore() }
})

test('a legacy single-pig save hides the roster instead of offering dead actions', async () => {
  const api = {
    async status() { return { ok: true, available: false, mode: 'legacy', reason: '当前游戏版本不支持本机多猪管理' } },
    async list() { throw new Error('legacy must not request the roster') },
    async select() { throw new Error('legacy must not switch') },
    async addAndSelect() { throw new Error('legacy must not add') },
  }
  const loaded = await load(api)
  try {
    loaded.render()
    await settle()
    assert.equal(loaded.dom.content.allText.trim(), '')
    assert.equal(loaded.dom.content.querySelector('[data-owner-pig-switch]'), null)
    assert.equal(loaded.dom.content.querySelector('[data-owner-pig-add="true"]'), null)
  } finally { loaded.restore() }
})

test('DSH without the ownerPigs bridge hides the section and never shows an error', async () => {
  const loaded = await load(null)
  try {
    loaded.render()
    await settle()
    assert.equal(loaded.dom.content.allText.trim(), '')
    assert.equal(loaded.dom.ui.messages.length, 0)
  } finally { loaded.restore() }
})
