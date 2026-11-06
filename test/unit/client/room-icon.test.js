// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fakeDom } from '../../helpers/bundle.js'
import { appIcon } from '../../../src/client/icon-style.js'

test('联机图标用前后两只猪的图片，其他 App 仍用 emoji', () => {
  const previous = globalThis.document
  globalThis.document = fakeDom().document
  try {
    const room = appIcon('room', '🐖', 'dp-tile-e')
    assert.equal(room.tagName, 'img')
    assert.equal(room.getAttribute('src'), '/dsh-piggy/art/ui-room.png')
    assert.equal(room.getAttribute('data-room-icon'), 'pair')
    assert.equal(room.getAttribute('aria-hidden'), 'true')

    const status = appIcon('status', '📋', 'dp-tile-e')
    assert.equal(status.tagName, 'span')
    assert.equal(status.textContent, '📋')
  } finally {
    globalThis.document = previous
  }
})
