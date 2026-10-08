import assert from 'node:assert/strict'
import { test } from 'node:test'

import { pointerHitsShape } from '../lib/pointer-hit.js'

test('screen cursor reaches pig shape without a renderer mousemove', () => {
  const bounds = { x: 810, y: 230, width: 180, height: 180 }
  const shape = [{ x: 90, y: 60, width: 64, height: 64 }]
  assert.equal(pointerHitsShape({ x: 925, y: 323 }, bounds, shape), true)
  assert.equal(pointerHitsShape({ x: 899, y: 323 }, bounds, shape), false)
  assert.equal(pointerHitsShape({ x: 925, y: 323 }, bounds, []), false)
})

test('shape hit stays correct after a window move and at right/bottom edges', () => {
  const shape = [{ x: 15, y: 22, width: 56, height: 56 }]
  assert.equal(pointerHitsShape({ x: 170, y: 177 }, { x: 100, y: 100 }, shape), true)
  assert.equal(pointerHitsShape({ x: 171, y: 177 }, { x: 100, y: 100 }, shape), false)
  assert.equal(pointerHitsShape({ x: 170, y: 178 }, { x: 100, y: 100 }, shape), false)
  assert.equal(pointerHitsShape({ x: 270, y: 277 }, { x: 200, y: 200 }, shape), true)
})
