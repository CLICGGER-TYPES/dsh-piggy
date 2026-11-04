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
    this.value = ''
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
async function settle() { await tick(); await tick(); await tick(); await tick() }

async function withDesktop(api, run) {
  const oldDocument = globalThis.document, oldWindow = globalThis.window
  const oldNow = Date.now
  const fakeNow = { value: 1_700_000_000_000 }
  Date.now = () => fakeNow.value
  const dom = fixture()
  dom.ui.document = dom.document
  globalThis.document = dom.document
  dom.document.documentElement = dom.document.createElement('html')
  dom.document.head = dom.document.createElement('head')
  globalThis.window = {}
  try {
    const { installPanel } = await import('../src/client/desktop/panel-window.js?owner-network-ui-bridge')
    installPanel({ ownerNetwork: api })
    await run(dom, fakeNow)
  } finally {
    Date.now = oldNow
    globalThis.document = oldDocument
    globalThis.window = oldWindow
  }
}

function moduleFor(name) {
  return import(`../src/client/owner-network.js?owner-network-ui-${name}`)
}

function fakeApi(overrides = {}) {
  const calls = { status: 0, addresses: 0, start: [], stop: 0, invite: 0, join: [], joinStatus: 0, leave: 0 }
  const api = {
    calls,
    running: false,
    async status() {
      calls.status += 1
      return this.running
        ? { ok: true, available: true, ownerId: 'owner-a', pigId: 'pig-a', running: true,
          host: '192.168.1.20', port: 53421, protocol: 'http', pairedClients: 0 }
        : { ok: true, available: true, ownerId: 'owner-a', pigId: 'pig-a', running: false, pairedClients: 0 }
    },
    async addresses() {
      calls.addresses += 1
      return { ok: true, addresses: [
        { address: '127.0.0.1', interface: 'lo', kind: 'loopback' },
        { address: '192.168.1.20', interface: 'Wi-Fi', kind: 'private' },
      ], lanAvailable: true }
    },
    async start(options) {
      calls.start.push(options)
      this.running = true
      return { ok: true, running: true, host: options.listenAddress, listenAddress: options.listenAddress,
        protocol: 'http', port: 53421, pairedClients: 0 }
    },
    async stop() { calls.stop += 1; this.running = false; return { ok: true, running: false, pairedClients: 0 } },
    async invite() {
      calls.invite += 1
      return { ok: true, invitation: 'b'.repeat(64), ownerId: 'owner-a', pigId: 'pig-a',
        expiresAt: Date.now() + 60_000, host: '192.168.1.20', protocol: 'http', port: 53421 }
    },
    async join(link) {
      calls.join.push(link)
      return { ok: true, peer: { ownerId: 'owner-b', pigId: 'pig-b', name: '乙', stage: 'middle', hatched: true },
        endpoint: { address: '192.168.1.31', port: 53421 } }
    },
    async joinStatus() { calls.joinStatus += 1; return { ok: true, joining: true, connected: true,
      peer: { ownerId: 'owner-b', pigId: 'pig-b', name: '乙', stage: 'middle', hatched: true } } },
    async leave() { calls.leave += 1; return { ok: true, joining: false } },
  }
  return Object.assign(api, overrides)
}

test('没有 ownerNetwork 能力时整段隐藏（DSH/旧外壳）', async () => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window
  const dom = fixture()
  dom.ui.document = dom.document
  globalThis.document = dom.document
  dom.document.documentElement = dom.document.createElement('html')
  dom.document.head = dom.document.createElement('head')
  globalThis.window = {}
  try {
    const { installPanel } = await import('../src/client/desktop/panel-window.js?owner-network-ui-no-bridge')
    installPanel({})
    const mod = await moduleFor('no-bridge')
    paint(mod.renderOwnerNetworkSettings, dom)
    await settle()
    assert.equal(dom.content.allText.trim(), '')
    assert.equal(mod.ownerNetworkDraftOpen(), false)
  } finally {
    globalThis.document = oldDocument
    globalThis.window = oldWindow
  }
})

test('不可用状态只显示一行原因，不给死按钮', async () => {
  const api = fakeApi({
    async status() { return { ok: true, available: false, reason: '请先建立或选择一份本机完整存档' } },
  })
  await withDesktop(api, async dom => {
    const mod = await moduleFor('unavailable')
    dom.ui.renderContent = () => paint(mod.renderOwnerNetworkSettings, dom)
    paint(mod.renderOwnerNetworkSettings, dom)
    await settle()
    assert.match(dom.content.allText, /局域网联机/)
    assert.match(dom.content.allText, /请先建立或选择一份本机完整存档/)
    assert.equal(dom.content.querySelector('[data-lan-start]'), null)
    assert.equal(dom.content.querySelector('[data-lan-join]'), null)
  })
})

test('未开启 → 选地址 → 开启 → 显示地址卡；轮询重绘不重复 IPC', async () => {
  const api = fakeApi()
  await withDesktop(api, async dom => {
    const mod = await moduleFor('start')
    dom.ui.renderContent = () => paint(mod.renderOwnerNetworkSettings, dom)
    paint(mod.renderOwnerNetworkSettings, dom)
    await settle()
    assert.match(dom.content.allText, /未开启/)
    assert.match(dom.content.allText, /开启联机/)
    const select = dom.content.querySelector('[data-lan-address="true"]')
    assert.ok(select, dom.content.allText)
    assert.equal(select.value, '192.168.1.20', '默认选第一个非回环私有地址')
    assert.equal(select.children.length, 2)

    for (let index = 0; index < 4; index += 1) {
      paint(mod.renderOwnerNetworkSettings, dom)
      await tick()
    }
    assert.equal(api.calls.status, 1, '定时重绘复用缓存状态')
    assert.equal(api.calls.addresses, 1, '定时重绘复用缓存地址')

    dom.content.querySelector('[data-lan-start="true"]').click()
    await settle()
    assert.deepEqual(api.calls.start, [{ listenAddress: '192.168.1.20' }])
    assert.match(dom.content.allText, /192\.168\.1\.20:53421/)
    assert.match(dom.content.allText, /HTTP · 已配对 0 台/)
    assert.ok(dom.content.querySelector('[data-lan-invite="true"]'))
    assert.ok(dom.content.querySelector('[data-lan-stop="true"]'))
    assert.equal(dom.content.querySelector('[data-lan-address="true"]'), null)
  })
})

test('开启过程中显示 starting 并禁用按钮；成功后进入运行中', async () => {
  let resolveStart = null
  const api = fakeApi({
    start(options) {
      api.calls.start.push(options)
      return new Promise(resolve => { resolveStart = resolve })
    },
  })
  await withDesktop(api, async dom => {
    const mod = await moduleFor('starting')
    dom.ui.renderContent = () => paint(mod.renderOwnerNetworkSettings, dom)
    paint(mod.renderOwnerNetworkSettings, dom)
    await settle()
    dom.content.querySelector('[data-lan-start="true"]').click()
    const starting = dom.content.querySelector('[data-lan-start="true"]')
    assert.equal(starting.textContent, '正在开启…')
    assert.equal(starting.disabled, true)

    resolveStart({ ok: true, running: true, host: '192.168.1.20', listenAddress: '192.168.1.20',
      protocol: 'http', port: 53421, pairedClients: 0 })
    api.running = true
    await settle()
    assert.match(dom.content.allText, /192\.168\.1\.20:53421/)
    assert.ok(dom.content.querySelector('[data-lan-stop="true"]'))
  })
})

test('邀请串包含地址和 64 位码，复制可用，61 秒后从 DOM 清空', async () => {
  const api = fakeApi()
  api.running = true
  const copied = []
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { async writeText(text) { copied.push(text) } } },
  })
  try {
    await withDesktop(api, async (dom, fakeNow) => {
      const mod = await moduleFor('invite')
      dom.ui.renderContent = () => paint(mod.renderOwnerNetworkSettings, dom)
      paint(mod.renderOwnerNetworkSettings, dom)
      await settle()
      dom.content.querySelector('[data-lan-invite="true"]').click()
      await settle()
      const link = `piggy://192.168.1.20:53421#${'b'.repeat(64)}`
      assert.equal(dom.content.querySelector('[data-lan-invite-code="true"]').textContent, link)
      assert.match(dom.content.allText, /60 秒后过期/)

      dom.content.querySelector('[data-lan-copy="true"]').click()
      await settle()
      assert.deepEqual(copied, [link])
      assert.match(dom.content.allText, /邀请串已复制/)

      fakeNow.value += 61_000
      paint(mod.renderOwnerNetworkSettings, dom)
      await settle()
      assert.equal(dom.content.querySelector('[data-lan-invite-code="true"]'), null)
      assert.equal(dom.content.allText.includes(link), false, '过期后邀请码不留在 DOM')
      assert.match(dom.content.allText, /生成邀请串/)
    })
  } finally {
    if (descriptor === undefined) delete globalThis.navigator
    else Object.defineProperty(globalThis, 'navigator', descriptor)
  }
})

test('加入成功只显示只读摘要，8 秒轮询一次且不会重复 IPC，过期后回到输入', async () => {
  const api = fakeApi()
  await withDesktop(api, async (dom, fakeNow) => {
    const mod = await moduleFor('join')
    dom.ui.renderContent = () => paint(mod.renderOwnerNetworkSettings, dom)
    paint(mod.renderOwnerNetworkSettings, dom)
    await settle()

    const input = dom.content.querySelector('[data-lan-join-input="true"]')
    assert.ok(input, dom.content.allText)
    const link = `piggy://192.168.1.31:53421#${'c'.repeat(64)}`
    const joinButton = dom.content.querySelector('[data-lan-join="true"]')
    assert.equal(joinButton.disabled, true)
    input.value = link
    input.fire('input')
    assert.equal(joinButton.disabled, false, '输入后按钮立即可用，且不触发整轮重绘')
    await tick()
    assert.equal(mod.ownerNetworkDraftOpen(), true)

    joinButton.click()
    await settle()
    assert.deepEqual(api.calls.join, [link])
    assert.match(dom.content.allText, /已连接 192\.168\.1\.31:53421/)
    assert.match(dom.content.allText, /目标「乙」/)
    assert.match(dom.content.allText, /成年猪/)
    assert.match(dom.content.allText, /只读/)
    assert.ok(dom.content.querySelector('[data-lan-leave="true"]'))
    assert.equal(dom.content.querySelector('[data-lan-join-input="true"]'), null)
    assert.equal(dom.content.querySelectorAll('button').some(node => /操作|命令|喂食|取名/.test(node.textContent)), false)
    assert.equal(mod.ownerNetworkDraftOpen(), false, '加入成功后草稿关闭')

    for (let index = 0; index < 4; index += 1) {
      paint(mod.renderOwnerNetworkSettings, dom)
      await tick()
    }
    assert.equal(api.calls.joinStatus, 0, '8 秒内不轮询对端')

    fakeNow.value += 9_000
    paint(mod.renderOwnerNetworkSettings, dom)
    await settle()
    assert.equal(api.calls.joinStatus, 1)
    fakeNow.value += 1_000
    paint(mod.renderOwnerNetworkSettings, dom)
    await tick()
    assert.equal(api.calls.joinStatus, 1, '下一次轮询前继续复用摘要')

    api.joinStatus = async () => {
      api.calls.joinStatus += 1
      return { ok: true, joining: false, reason: 'session-expired' }
    }
    fakeNow.value += 9_000
    paint(mod.renderOwnerNetworkSettings, dom)
    await settle()
    assert.match(dom.content.allText, /连接空闲过期/)
    assert.ok(dom.content.querySelector('[data-lan-join-input="true"]'))
    assert.match(dom.content.allText, /只读预览/)
  })
})

test('加入失败按错误码给可操作文案，并保留输入便于修改', async () => {
  const api = fakeApi({
    async join(link) { api.calls.join.push(link); return { ok: false, reason: 'invitation-invalid-or-expired' } },
  })
  await withDesktop(api, async dom => {
    const mod = await moduleFor('join-fail')
    dom.ui.renderContent = () => paint(mod.renderOwnerNetworkSettings, dom)
    paint(mod.renderOwnerNetworkSettings, dom)
    await settle()
    const input = dom.content.querySelector('[data-lan-join-input="true"]')
    const link = `piggy://192.168.1.31:53421#${'d'.repeat(64)}`
    input.value = link
    input.fire('input')
    await tick()
    dom.content.querySelector('[data-lan-join="true"]').click()
    await settle()
    assert.match(dom.content.allText, /邀请码无效或已过期/)
    assert.ok(dom.content.querySelector('[data-lan-error="true"]'))
    assert.equal(dom.content.querySelector('[data-lan-join-input="true"]').value, link)
    assert.equal(mod.ownerNetworkDraftOpen(), true)
  })
})

test('断开后回到输入，并且不把邀请串留在 DOM', async () => {
  const api = fakeApi()
  await withDesktop(api, async dom => {
    const mod = await moduleFor('leave')
    dom.ui.renderContent = () => paint(mod.renderOwnerNetworkSettings, dom)
    paint(mod.renderOwnerNetworkSettings, dom)
    await settle()
    const input = dom.content.querySelector('[data-lan-join-input="true"]')
    const link = `piggy://192.168.1.31:53421#${'e'.repeat(64)}`
    input.value = link
    input.fire('input')
    await tick()
    dom.content.querySelector('[data-lan-join="true"]').click()
    await settle()
    dom.content.querySelector('[data-lan-leave="true"]').click()
    await settle()
    assert.equal(api.calls.leave, 1)
    assert.match(dom.content.allText, /已在本机断开/)
    assert.ok(dom.content.querySelector('[data-lan-join-input="true"]'))
    assert.equal(dom.content.allText.includes('f'.repeat(64)), false)
  })
})
