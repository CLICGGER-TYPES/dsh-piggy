import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fitBubbleHorizontally } from '../src/client/desktop/bubble-geometry.js'

const win = { x: 50, width: 366 }
const area = { x: 50, width: 912 }
test('long speech at the left desktop edge fits inside the unchanged native window', () => {
  const bubble = { x: -172, width: 268 }
  const pig = { x: 42, width: 54 }
  const next = fitBubbleHorizontally(bubble, pig, win, area)
  assert.equal(next.x, 6)
  assert.equal(next.tailLeft + next.x + 5, pig.x + pig.width / 2)
  assert.ok(next.x + bubble.width <= win.width - 6)
})
test('ordinary speech keeps its original head-top position', () => {
  for (const width of [80, 180, 268]) {
    const bubble = { x: 290 - width, width }
    assert.equal(fitBubbleHorizontally(bubble, { x: 240, width: 54 }, win, area).x, bubble.x)
  }
})
test('right overflow and a native window crossing a work-area boundary use the visible intersection', () => {
  const bubble = { x: 250, width: 268 }
  assert.equal(fitBubbleHorizontally(bubble, { x: 320, width: 54 }, win, area).x, 92)
  assert.equal(fitBubbleHorizontally({ x: 0, width: 268 }, { x: 90, width: 54 }, { x: -30, width: 384 }, area).x, 86)
})
