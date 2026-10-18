// @ts-check
// 物理包络必须装在桌面固定预留区内：任何尺寸、任何最大形变都不能越界。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { FEEL } from '../src/client/feel/config.js'
import { feelEnvelope } from '../src/client/feel/envelope.js'
import { fixedMotionReserve } from '../src/client/desktop/motion-envelope.js'

const inside = (inner, outer) => inner.x >= outer.x && inner.y >= outer.y
  && inner.x + inner.width <= outer.x + outer.width
  && inner.y + inner.height <= outer.y + outer.height

test('物理包络在所有猪尺寸下都装在固定动作预留里', () => {
  for (const size of [54, 56, 60, 68, 95, 110, 136]) {
    const pigBox = { x: 0, y: 0, width: size, height: size }
    const envelope = feelEnvelope(pigBox)
    const reserve = fixedMotionReserve(pigBox)
    assert.ok(inside(envelope, reserve), `${size}px 的物理包络越出了动作预留`)
  }
})

test('最大压扁、拉长、左右倾斜的单个姿态也都不越界', () => {
  const pigBox = { x: 0, y: 0, width: 56, height: 56 }
  const reserve = fixedMotionReserve(pigBox)
  for (const squash of [FEEL.squashMax, 0, -FEEL.squashMax * 0.45]) {
    for (const hold of [0, FEEL.holdMax]) {
      for (const tilt of [-FEEL.tiltMaxFly, 0, FEEL.tiltMaxFly]) {
        const envelope = feelEnvelope(pigBox, { squash: squash, hold: hold, tilt: tilt, hop: 0 })
        assert.ok(inside(envelope, reserve), `squash=${squash} hold=${hold} tilt=${tilt} 越界`)
      }
    }
  }
})

test('包络随猪的布局盒缩放，且至少覆盖原图', () => {
  const pigBox = { x: 100, y: 50, width: 56, height: 56 }
  const envelope = feelEnvelope(pigBox)
  assert.ok(envelope.x <= pigBox.x && envelope.y <= pigBox.y)
  assert.ok(envelope.x + envelope.width >= pigBox.x + pigBox.width)
  assert.ok(envelope.y + envelope.height >= pigBox.y + pigBox.height)
  const doubled = feelEnvelope({ x: 100, y: 50, width: 112, height: 112 })
  assert.ok(doubled.width > envelope.width)
})
