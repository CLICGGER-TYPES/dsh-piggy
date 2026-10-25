import assert from 'node:assert/strict'
import { test } from 'node:test'
import blindbox from '../extensions/blindbox/server.js'
import { harness } from './helpers/blindbox-ui.js'

function pool() {
  return blindbox.view(blindbox.init(), { now: Date.UTC(2026, 9, 23), coins: () => 500, count: () => 0, wallet: { balance: () => 0 } })
}

test('reimporting an extension replaces its previous stylesheet in the live panel', () => {
  const ui = harness(pool())
  const style = ui.dom.head.children.find(node => node.id === 'dsh-piggy-blindbox4-style')
  style.textContent = '.bx-btn{background:black}'
  ui.rerender()
  assert.match(style.textContent, /background:var\(--ac-primary/)
  assert.equal(ui.dom.head.children.filter(node => node.id === style.id).length, 1)
})

test('a repaint just before the 90° midpoint still schedules the face switch', () => {
  const view = pool()
  const ui = harness(view)
  ui.show({ ...view, last: { id: 100, banner: 'standard', items: [{ key: 'unknown', stars: 3 }] } })
  ui.clock.t = 829
  ui.rerender()
  assert.ok([...ui.pending.values()].some(timer => timer.ms > 0 && timer.ms <= 20), '829ms must schedule the 830ms midpoint, rather than wait until the 1060ms end')
})

test('result-list scrolling survives polling, replay and a new draw reset it', () => {
  const view = pool(), ui = harness(view)
  const last = { id: 100, banner: 'standard', items: [{ key: 'unknown', stars: 3 }] }
  ui.show({ ...view, last })
  const stage = () => { let found; ui.dom.body.walk(node => { if (node.className === 'bx-stage') found = node }); return found }
  stage().scrollTop = 90; stage().fire('scroll'); ui.rerender()
  assert.equal(stage().scrollTop, 90)
  ui.clock.t = 2000; ui.rerender(); ui.click('data-bx-replay', '1')
  assert.equal(stage().scrollTop, 0)
  stage().scrollTop = 55; stage().fire('scroll')
  ui.show({ ...view, last: { ...last, id: 101 } })
  assert.equal(stage().scrollTop, 0)
})
