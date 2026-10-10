import assert from 'node:assert/strict'
import { test } from 'node:test'
import { framedBox } from '../src/client/desktop/measure.js'
import { BUILTIN_FRAMING, FRAME_HEIGHT } from '../src/client/feedback-framing.js'

test('胖猪电脑姿势的桌面区域覆盖宽图，不受待机动画影响', () => {
  const path = 'pigs/forms/pig-fat/work.png'
  const [zoom, x, y] = BUILTIN_FRAMING[path]
  const values = { '--art-zoom': zoom, '--art-x': x + '%', '--art-y': y + '%' }
  const node = {
    matches: () => true, getAttribute: () => '/dsh-piggy/art/' + path,
    closest: () => null, style: { getPropertyValue: key => String(values[key]) },
    getBoundingClientRect: () => { throw new Error('不能读取动画中的位置') },
  }
  const layout = { x: 100, y: 100, width: 100, height: 100 }
  const bounds = framedBox(node, layout)
  assert.ok(bounds.x < layout.x && bounds.x + bounds.width > layout.x + layout.width)
  assert.ok(Math.abs(bounds.height - FRAME_HEIGHT * 100) < .02)
  assert.ok(Math.abs(bounds.x + bounds.width / 2 - 150) < .02)
})
