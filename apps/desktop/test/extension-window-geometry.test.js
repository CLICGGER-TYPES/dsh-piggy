import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extensionWindowGeometry } from '../lib/extension-window-geometry.js'

test('高缩放小工作区不会被旧720×480最小尺寸撑出屏幕', () => {
  for (const scale of [1, 1.25, 2]) {
    const area = { width: Math.floor(1212 / scale), height: Math.floor(736 / scale) }
    const result = extensionWindowGeometry(area)
    assert.ok(result.width <= area.width)
    assert.ok(result.height <= area.height)
    assert.ok(result.minWidth <= result.width)
    assert.ok(result.minHeight <= result.height)
  }
  const small = extensionWindowGeometry({ width: 606, height: 368 })
  assert.ok(small.minWidth < 720 && small.minHeight < 480, '复现条件：固定最小尺寸会超过实际工作区')
})

test('大屏保留原来的默认尺寸上限与可缩小范围', () => {
  assert.deepEqual(extensionWindowGeometry({ width: 1920, height: 1080 }), { width: 1200, height: 800, minWidth: 720, minHeight: 480 })
})
