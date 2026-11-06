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
      return { ok: true, inRoom: true, code: '7K2M', selfId: 'p1', players: [{ id: 'p1', name: '猪猪', level: 60, host: true }] }
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
    assert.match(ui.content.allText(), /同一局域网/)

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
