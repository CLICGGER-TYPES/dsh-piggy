// G 批次：对话与互动的客户端部分。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { partFor } from '../src/client/pet-parts.js'
import { SNAPSHOT, contentOf, findByAttr, findByClass, hostOf, mount, openPanel, sceneOf, settle } from './helpers/bundle.js'

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
  scene.fire('pointerdown', { button: 0, clientX: 35, clientY: 31 })
  scene.fire('pointerup', { clientX: 35, clientY: 31 })
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
  scene.fire('pointerdown', { button: 2, clientX: 35, clientY: 31 })
  scene.fire('pointerup', { button: 2, clientX: 35, clientY: 31 })
  scene.fire('contextmenu', { clientX: 35, clientY: 31, preventDefault() {} })
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

test('scene whitespace cannot wake, touch, pet, capture, drag or open the pig menu', async () => {
  const drag = []
  const shell = { beginDrag: () => drag.push('start'), endDrag: () => drag.push('end') }
  const { dom, calls } = await mount({ status: SNAPSHOT, windowExtra: { __dshPiggyShell: shell } })
  const scene = sceneOf(dom), pig = findByClass(scene, 'dp-pig')
  let captured = 0, prevented = false
  scene.setPointerCapture = () => { captured += 1 }
  pig.setAttribute('data-idle', 'nap')
  const before = calls.length, feelBefore = pig.getAttribute('data-feel')
  scene.fire('pointerdown', { button: 0, clientX: 900, clientY: 600, pointerId: 1 })
  scene.fire('pointermove', { clientX: 940, clientY: 620, pointerId: 1 })
  scene.fire('pointerup', { clientX: 940, clientY: 620, pointerId: 1 })
  scene.fire('contextmenu', { clientX: 900, clientY: 600, preventDefault() { prevented = true } })
  await settle()
  assert.equal(pig.getAttribute('data-idle'), 'nap')
  assert.equal(pig.getAttribute('data-feel'), feelBefore)
  assert.equal(scene.getAttribute('data-dragging'), null)
  assert.equal(captured, 0)
  assert.deepEqual(drag, [])
  assert.equal(calls.slice(before).some(call => call.method === 'POST'), false)
  assert.equal(hostOf(dom).getAttribute('data-open'), 'false')
  assert.equal(prevented, false)

  scene.fire('pointerdown', { button: 0, clientX: 35, clientY: 31, pointerId: 2 })
  assert.equal(captured, 1)
  assert.equal(pig.getAttribute('data-idle'), null)
  scene.fire('pointermove', { clientX: 50, clientY: 31, pointerId: 2 })
  scene.fire('pointerup', { clientX: 50, clientY: 31, pointerId: 2 })
  assert.deepEqual(drag, ['start', 'end'])
  scene.fire('contextmenu', { clientX: 35, clientY: 31 })
  assert.equal(hostOf(dom).getAttribute('data-open'), 'true')
})
