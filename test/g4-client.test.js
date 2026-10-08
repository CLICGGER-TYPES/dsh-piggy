// G 批次：对话与互动的客户端部分。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { partFor } from '../src/client/pet-parts.js'
import { SNAPSHOT, contentOf, findByAttr, findByClass, mount, openPanel, sceneOf, settle } from './helpers/bundle.js'

test('the spot you pat on a left-facing pig maps to a body part', () => {
  assert.equal(partFor(0.5, 0.95), 'feet')
  assert.equal(partFor(0.9, 0.2), 'tail')
  assert.equal(partFor(0.2, 0.7), 'nose')
  assert.equal(partFor(0.3, 0.2), 'ears')
  assert.equal(partFor(0.45, 0.5), 'head')
  assert.equal(partFor(0.65, 0.7), 'belly')
  assert.equal(partFor(0.65, 0.4), 'back')
})

test('a left click on the pig sends a pat with the body part, and no canned client line', async () => {
  const { dom, calls } = await mount({ status: SNAPSHOT })
  const scene = sceneOf(dom)
  scene.fire('pointerdown', { button: 0, clientX: 0, clientY: 0 })
  scene.fire('pointerup', { clientX: 0, clientY: 0 })
  await settle()
  const body = JSON.parse(calls.at(-1).body)
  assert.equal(body.action, 'pet')
  assert.ok(['head', 'ears', 'nose', 'belly', 'back', 'tail', 'feet'].includes(body.part), body.part)
  const bubble = findByAttr(scene, 'data-bubble-shown', 'true')
  assert.ok(bubble === undefined || bubble.hidden === true || !/好舒服…/.test(bubble.allText()), 'the old client line is gone')
})

test('右键猪只开关面板，不摸猪', async () => {
  const { dom, calls } = await mount({ status: SNAPSHOT })
  const scene = sceneOf(dom)
  const pig = findByClass(scene, 'dp-pig')
  pig.removeAttribute('data-react')
  const before = calls.length
  scene.fire('pointerdown', { button: 2, clientX: 0, clientY: 0 })
  scene.fire('pointerup', { button: 2, clientX: 0, clientY: 0 })
  scene.fire('contextmenu', { preventDefault() {} })
  await settle()
  const pats = calls.slice(before).filter(call => call.body && JSON.parse(call.body).action === 'pet')
  assert.equal(pats.length, 0, '右键不发 pet')
  assert.equal(pig.getAttribute('data-react'), null, '右键不演摸猪动作')
})

test('desktop walking is a settings switch only on desktop, off by default', async () => {
  const web = await mount({ status: SNAPSHOT })
  openPanel(web.dom, 'settings')
  assert.equal(findByAttr(contentOf(web.dom), 'data-walk', 'true'), undefined, 'not on the web page')
})
