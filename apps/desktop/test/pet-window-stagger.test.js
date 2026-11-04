// @ts-check
/** 新猪第一次摆放时避开已有宠物窗口的重叠位置。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { staggerPetBounds } from '../lib/window-geometry.js'

const area = { x: 0, y: 0, width: 1024, height: 640 }
const box = x => ({ x, y: 246, width: 364, height: 332 })

test('没有别的窗口时保持原位', () => {
  assert.deepEqual(staggerPetBounds(box(646), [], area), box(646))
})

test('和已有窗口重合时向左错开一步', () => {
  assert.deepEqual(staggerPetBounds(box(646), [box(646)], area), box(266))
})

test('连续重合时继续错开，直到不重叠或到工作区左缘', () => {
  assert.deepEqual(staggerPetBounds(box(646), [box(646), box(266)], area), box(0))
})

test('只是相近但没重合（超过 8px）不动', () => {
  assert.deepEqual(staggerPetBounds(box(646), [box(636)], area), box(646))
})
