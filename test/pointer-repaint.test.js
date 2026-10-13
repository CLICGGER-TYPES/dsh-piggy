// 保护真实按压期间的 DOM，避免轮询在 mouseup 前丢掉按钮。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { attachPointerRepaint } from '../src/client/pointer-repaint.js'
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
test('按压期间仅保留最新快照，click完成后重绘；取消/销毁不会留挂起的监听', async () => {
  const root = new EventTarget(), events = new EventTarget(), guard = attachPointerRepaint(root, events)
  const calls = []
  root.dispatchEvent(new Event('pointerdown'))
  assert.equal(guard.defer(() => calls.push('旧')), true)
  assert.equal(guard.defer(() => calls.push('新')), true)
  await wait(20); assert.deepEqual(calls, [])
  events.dispatchEvent(new Event('pointerup'))
  await wait(20); assert.deepEqual(calls, [])
  await wait(160); assert.deepEqual(calls, ['新'])
  assert.equal(guard.defer(() => calls.push('立即')), false)
  root.dispatchEvent(new Event('pointerdown')); guard.defer(() => calls.push('取消'))
  events.dispatchEvent(new Event('pointercancel')); await wait(20)
  assert.deepEqual(calls, ['新', '取消'])
  root.dispatchEvent(new Event('pointerdown')); guard.defer(() => calls.push('已销毁'))
  guard.dispose(); events.dispatchEvent(new Event('pointerup')); await wait(160)
  assert.deepEqual(calls, ['新', '取消'])
})
