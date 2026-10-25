import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fitBubbleHorizontally, fitBubbleVertically } from '../src/client/desktop/bubble-geometry.js'

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

test('speech clipped above the native window goes below without moving its pig or changing its dimensions', () => {
  const pig = { y: 25, height: 54 }
  const bubble = { y: -16.21875, height: 31.21875 }
  assert.deepEqual(fitBubbleVertically(bubble, pig, { y: 32, height: 384 }, { y: 32, height: 748 }), { y: 89, side: 'below' })
  assert.deepEqual(pig, { y: 25, height: 54 })
  assert.equal(bubble.height, 31.21875)
})

test('short and long speech return to the original upper anchor when space is available', () => {
  for (const height of [31, 74, 104]) {
    const bubble = { y: 160 - 10 - height, height }
    assert.deepEqual(fitBubbleVertically(bubble, { y: 160, height: 60 }, { y: 100, height: 400 }, { y: 32, height: 748 }), { y: bubble.y, side: 'above' })
  }
})

test('the upper screen boundary is respected even when a transparent native window starts off screen', () => {
  assert.deepEqual(fitBubbleVertically({ y: 20, height: 74 }, { y: 104, height: 60 },
    { y: -40, height: 400 }, { y: 32, height: 748 }), { y: 174, side: 'below' })
})

test('tail and lower position use the character anchors for offset and non-square pigs', () => {
  const pig = { x: 37, y: 211, width: 73, height: 58 }
  const bubble = { x: 20, width: 268 }
  const fitted = fitBubbleHorizontally(bubble, pig, { x: 50, y: 20, width: 366, height: 400 }, { x: 50, y: 20, width: 912, height: 748 })
  assert.equal(fitted.tailLeft + fitted.x + 5, pig.x + pig.width / 2)
  // 下方位置＝脚底 + 10，和桌面「家」的脚底锚点同一个点。
  assert.deepEqual(fitBubbleVertically({ y: -30, height: 74 }, pig,
    { x: 50, y: 20, width: 366, height: 400 }, { x: 50, y: 20, width: 912, height: 748 }),
  { y: pig.y + pig.height + 10, side: 'below' })
})

test('a bubble exactly at the visible left or right limit is not moved', () => {
  const win = { x: 50, width: 366 }
  const area = { x: 50, width: 912 }
  for (const x of [6, win.width - 6 - 268]) {
    assert.equal(fitBubbleHorizontally({ x, width: 268 }, { x: 240, width: 54 }, win, area).x, x)
  }
  assert.equal(fitBubbleHorizontally({ x: 5, width: 268 }, { x: 240, width: 54 }, win, area).x, 6)
})
