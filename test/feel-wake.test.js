// @ts-check
// 拿起猪：发 core 的 touch（后台，不占 busy），并立刻停掉打盹小动作。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SNAPSHOT, findByClass, mount, sceneOf, settle } from './helpers/bundle.js'

test('drag start sends touch without blocking the click pet, and clears data-idle=nap', async () => {
  const { dom, calls } = await mount({ status: SNAPSHOT })
  const scene = sceneOf(dom)
  const pig = findByClass(scene, 'dp-pig')
  pig.setAttribute('data-idle', 'nap')
  scene.fire('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 })
  await settle()
  assert.equal(pig.getAttribute('data-idle'), null, '拿起时结束打盹小动作')
  const actions = calls.filter(call => call.method === 'POST' && call.body).map(call => JSON.parse(call.body).action)
  assert.ok(actions.includes('touch'), '拿起/戳一下要发 core 的 touch')
  scene.fire('pointerup', { clientX: 0, clientY: 0, pointerId: 1 })
  await settle()
  const after = calls.filter(call => call.method === 'POST' && call.body).map(call => JSON.parse(call.body).action)
  assert.ok(after.includes('pet'), 'touch 是后台动作，不能把紧接着的 pet 挡掉')
})
