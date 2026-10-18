// @ts-check
// 弹簧收敛：用 Motion 的生成器验证默认参数确实是 2~3 次回弹并在 1 秒内收住。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { spring } from 'motion'

import { FEEL } from '../src/client/feel/config.js'

function response(options, target = 1) {
  const generator = spring({ keyframes: [0, target], stiffness: options.stiffness, damping: options.damping, mass: options.mass, velocity: 0 })
  let crossings = 0
  let settle = 0
  let previous = 0
  for (let t = 1; t <= 3000; t += 1) {
    const sample = generator.next(t)
    if (sample.done) break
    if (t > 2 && Math.sign(sample.value - target) !== Math.sign(previous - target)) crossings += 1
    if (Math.abs(sample.value - target) > 0.003) settle = t
    previous = sample.value
  }
  return { crossings, settle }
}

test('挤压弹簧回弹 2~3 下，约 0.9 秒内收住', () => {
  const result = response(FEEL.squash)
  assert.ok(result.crossings >= 2 && result.crossings <= 4, `回弹次数 ${result.crossings}`)
  assert.ok(result.settle >= 350 && result.settle <= 900, `收住时间 ${result.settle}ms`)
})

test('落地冲击与挤压同一手感', () => {
  assert.deepEqual(response(FEEL.impact), response(FEEL.squash))
})

test('拎起弹簧接近临界阻尼，不会上下晃', () => {
  const result = response(FEEL.hold)
  assert.ok(result.crossings <= 2, `拎起不应该来回弹：${result.crossings}`)
  assert.ok(result.settle <= 500, `拎起收住时间 ${result.settle}ms`)
})
