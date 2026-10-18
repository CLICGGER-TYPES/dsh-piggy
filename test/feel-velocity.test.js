// @ts-check
// 松手速度只认最后一小段：拖到位停住/减速再松手不能变成抛。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { recentVelocity } from '../src/client/feel/velocity.js'

const sample = (t, x, y = 0) => ({ t, x, y })

test('快速甩动后立刻松手：尾部速度超过抛出阈值', () => {
  const samples = [sample(0, 0), sample(16, 20), sample(32, 40), sample(48, 60), sample(64, 80)]
  const velocity = recentVelocity(samples, 64)
  assert.ok(velocity.vx > 180, JSON.stringify(velocity))
})

test('快速拖动后停住再松手：速度归零', () => {
  const samples = [sample(0, 0), sample(16, 200), sample(32, 400)]
  assert.deepEqual(recentVelocity(samples, 300), { vx: 0, vy: 0 })
})

test('最后一小段已经减速：不按之前的快速平均', () => {
  const samples = [sample(0, 0), sample(16, 200), sample(50, 400), sample(66, 402)]
  const velocity = recentVelocity(samples, 66)
  assert.ok(Math.abs(velocity.vx) < 180, JSON.stringify(velocity))
})

test('最后一次移动后停了 70ms：按放下处理', () => {
  const samples = [sample(0, 0), sample(16, 20)]
  assert.deepEqual(recentVelocity(samples, 86), { vx: 0, vy: 0 })
})

test('最后一次移动后 30ms 内松手：仍按甩动算', () => {
  const samples = [sample(0, 0), sample(16, 20)]
  assert.ok(recentVelocity(samples, 46).vx > 180)
})

test('只有一次移动采样时不猜速度', () => {
  assert.deepEqual(recentVelocity([sample(0, 0)], 10), { vx: 0, vy: 0 })
})
