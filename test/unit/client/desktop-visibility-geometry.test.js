// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { pigInsideWindow, pigVisibility, pigWindowIntersection } from '../../../src/client/desktop/visibility.js'

const WIN = { width: 368, height: 344 }

test('a pig drawn left of the surface is not inside, even if its box is a valid rectangle', () => {
  const pig = { x: -100, y: 241, width: 68, height: 68 }
  assert.equal(pigInsideWindow(pig, WIN), false)
  assert.equal(pigWindowIntersection(pig, WIN), 0)
  assert.deepEqual(pigVisibility(pig, WIN), { intersect: 0, inside: false, visible: false, shown: true })
})

test('a pig poking out of one edge is visible but not inside', () => {
  const pig = { x: -40, y: 241, width: 68, height: 68 }
  assert.equal(pigInsideWindow(pig, WIN), false)
  assert.equal(pigWindowIntersection(pig, WIN), 28 * 68)
  assert.deepEqual(pigVisibility(pig, WIN), { intersect: 28 * 68, inside: false, visible: true, shown: true })
})

test('a pig fully in the window is inside; rounding by one pixel is tolerated', () => {
  assert.equal(pigInsideWindow({ x: 61, y: 241, width: 68, height: 68 }, WIN), true)
  assert.equal(pigInsideWindow({ x: 301, y: 277, width: 68, height: 68 }, WIN), true)
  assert.equal(pigInsideWindow({ x: -1, y: -1, width: 68, height: 68 }, WIN), true)
})

test('unknown window geometry never reports the pet as hidden', () => {
  // Surface 还没量到（宽高 0）：按假坐标重摆只会把窗口挪飞，交回调用方等下一帧。
  assert.equal(pigInsideWindow({ x: -100, y: 241, width: 68, height: 68 }, { width: 0, height: 0 }), true)
})
