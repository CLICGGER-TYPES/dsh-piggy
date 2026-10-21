import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dragPigBounds, desktopViewportBounds } from '../lib/window-geometry.js'

const pig = { x: 240, y: 150, width: 86, height: 86 }
const bounds = { x: 250, y: 80, width: 392, height: 356 }
const startPig = { x: bounds.x + pig.x, y: bounds.y + pig.y }
const startCursor = { x: startPig.x + 43, y: startPig.y + 43 }

test('native window follows the pointer continuously through horizontal and vertical monitor seams', () => {
  for (const areas of [
    [{ x: 0, y: 16, width: 640, height: 384 }, { x: 640, y: 0, width: 640, height: 400 }],
    [{ x: -640, y: 0, width: 640, height: 400 }, { x: 0, y: 16, width: 640, height: 384 }],
    [{ x: 0, y: 0, width: 800, height: 600 }, { x: 0, y: 600, width: 800, height: 600 }],
  ]) {
    const vertical = areas[1].y === 600
    const seam = vertical ? 600 : areas[1].x
    let last
    for (let n = seam - 80; n <= seam + 80; n += 1) {
      const cursor = vertical ? { x: startCursor.x, y: n } : { x: n, y: startCursor.y }
      const wanted = dragPigBounds(bounds, pig, startPig, startCursor, cursor, areas)
      const held = desktopViewportBounds(wanted, areas)
      if (last) assert.ok(Math.abs(held[vertical ? 'y' : 'x'] - last[vertical ? 'y' : 'x']) <= 1, 'crossing a seam must not jump a whole window')
      last = held
    }
  }
})

test('single-monitor drags still clamp the native window to the outer work area', () => {
  const areas = [{ x: 0, y: 16, width: 640, height: 384 }]
  assert.deepEqual(desktopViewportBounds({ x: -100, y: 700, width: 392, height: 356 }, areas),
    { x: 0, y: 44, width: 392, height: 356 })
})
