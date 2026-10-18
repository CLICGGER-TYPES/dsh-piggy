import assert from 'node:assert/strict'
import { test } from 'node:test'

import { validDragOrigin } from '../lib/drag-origin.js'

const AREA = { x: 0, y: 32, width: 1280, height: 768 }

test('快速拖动时 pointerdown 离当前光标 100px 仍然接受', () => {
  assert.deepEqual(validDragOrigin({ x: 500, y: 300 }, { x: 600, y: 300 }, AREA), { x: 500, y: 300 })
})

test('太远、越界、非有限值的 origin 退回 null', () => {
  assert.equal(validDragOrigin({ x: 0, y: 300 }, { x: 700, y: 300 }, AREA), null, '超过 512px')
  assert.equal(validDragOrigin({ x: 1300, y: 300 }, { x: 1200, y: 300 }, AREA), null, '不在工作区')
  assert.equal(validDragOrigin({ x: Number.NaN, y: 300 }, { x: 300, y: 300 }, AREA), null)
  assert.equal(validDragOrigin(null, { x: 300, y: 300 }, AREA), null)
})
