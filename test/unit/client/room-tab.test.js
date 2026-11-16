// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fakeDom, findByAttr } from '../../helpers/bundle.js'
import { renderRoomTab } from '../../../src/client/tabs/room.js'

test('联机页：在没有房间时显示创建/加入，点击创建会带上小猪资料', async () => {
  const dom = fakeDom()
  const previousDocument = globalThis.document
  const previousWindow = globalThis.window
  const calls = { host: 0, profile: null, open: 0 }
  /** @type {any} */
  const room = {
    status: async () => ({ ok: true, inRoom: false }),
    host: async profile => {
      calls.host += 1
      calls.profile = profile
      return { ok: true, inRoom: true, hosting: true, code: '7K2M', selfId: 'p1', players: [{ id: 'p1', name: '猪猪', level: 60, host: true }],
        publicUrl: 'https://piggy.example.com', invite: 'https://piggy.example.com/#PIG-7K2M', localPort: 47824 }
    },
    join: async () => ({ ok: true }),
    open: async () => { calls.open += 1; return { ok: true } },
    leave: async () => ({ ok: true }),
    copy: async () => ({ ok: true }),
    onUpdate() {},
    onClosed() {},
  }
  globalThis.document = /** @type {any} */ (dom.document)
  globalThis.window = /** @type {any} */ ({ piggyShell: { room } })
  try {
    /** @type {any} */
    const ui = {
      content: dom.document.createElement('div'),
      tab: 'room',
      view: { pig: { name: '猪猪', level: { level: 60 }, stage: { key: 'middle', label: '成年猪', emoji: '🐖', size: 68, art: '' } } },
      renderContent() {},
    }
    renderRoomTab(ui)
    assert.match(ui.content.allText(), /创建房间/)
    assert.match(ui.content.allText(), /加入房间/)
    assert.match(ui.content.allText(), /局域网 \/ 公网服务器/)

    findByAttr(ui.content, 'data-room-create', 'true').fire('click')
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(calls.host, 1)
    assert.equal(calls.profile.name, '猪猪')
    assert.equal(calls.profile.level, 60)
    assert.equal(calls.profile.emoji, '🐖')
    assert.ok(Math.abs(calls.profile.size - 68 / 60) < 0.0001)
    assert.equal(calls.open, 0, '创建房间后不自动打开房间窗口')
  } finally {
    globalThis.document = previousDocument
    globalThis.window = previousWindow
  }
})

test('联机页：公网服务器展开后把对外地址传给主进程', async () => {
  const dom = fakeDom()
  const previousDocument = globalThis.document
  const previousWindow = globalThis.window
  const calls = { options: null }
  /** @type {any} */
  const room = {
    status: async () => ({ ok: true, inRoom: false }),
    host: async (profile, options) => {
      calls.options = options
      return { ok: true, inRoom: true, hosting: true, code: '7K2M', selfId: 'p1', players: [{ id: 'p1', name: '猪猪', level: 60, host: true }],
        publicUrl: 'https://piggy.example.com', invite: 'https://piggy.example.com/#PIG-7K2M', localPort: 47824 }
    },
    join: async () => ({ ok: true }),
    open: async () => ({ ok: true }),
    leave: async () => ({ ok: true }),
    copy: async () => ({ ok: true }),
    onUpdate() {},
    onClosed() {},
  }
  globalThis.document = /** @type {any} */ (dom.document)
  globalThis.window = /** @type {any} */ ({ piggyShell: { room } })
  try {
    /** @type {any} */
    const ui = {
      content: dom.document.createElement('div'),
      tab: 'room',
      view: { pig: { name: '猪猪', level: { level: 60 }, stage: { key: 'middle', label: '成年猪', emoji: '🐖', size: 60, art: '' } } },
      renderContent() {
        ui.content = dom.document.createElement('div')
        renderRoomTab(ui)
      },
    }
    renderRoomTab(ui)
    await new Promise(resolve => setTimeout(resolve, 20))
    findByAttr(ui.content, 'data-room-public-toggle', 'true').fire('click')

    const input = findByAttr(ui.content, 'data-room-public-input', 'true')
    input.value = 'https://piggy.example.com'
    input.fire('input')
    findByAttr(ui.content, 'data-room-create', 'true').fire('click')
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.deepEqual(calls.options, { publicUrl: 'https://piggy.example.com' })
    assert.match(ui.content.allText(), /邀请串/)
  } finally {
    globalThis.document = previousDocument
    globalThis.window = previousWindow
  }
})
