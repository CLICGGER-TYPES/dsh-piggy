import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEffects } from '../src/client/effects.js'
import { fakeDom } from './helpers/bundle.js'

function harness() {
  const dom = fakeDom(), events = new dom.FakeElement('window')
  const timers = new Map(), frames = new Map()
  let next = 0
  const environment = {
    setTimeout(fn, ms) { const id = ++next; timers.set(id, { fn, ms }); return id },
    clearTimeout(id) { timers.delete(id) },
    requestAnimationFrame(fn) { const id = ++next; frames.set(id, fn); return id },
    cancelAnimationFrame(id) { frames.delete(id) },
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args),
  }
  globalThis.document = dom.document
  globalThis.window = environment
  const bubble = new dom.FakeElement('div'), card = new dom.FakeElement('div')
  const fx = createEffects({ bubble, card, scene: card, pig: card, pigArt: card, pigEmoji: card, isStopped: () => false })
  const calls = []
  function show(text = '旧消息') {
    fx.showLine(text, ['回复'], index => calls.push(index))
    return bubble.children[1].children[0]
  }
  function down(button, pointerId = 1) { button.parentNode.fire('pointerdown', { button: 0, pointerId, target: button }) }
  function expire() { const [id, timer] = [...timers].find(([, t]) => t.ms === 6000); timers.delete(id); timer.fn(); return timer.fn }
  function frame() { const callbacks = [...frames.values()]; frames.clear(); for (const fn of callbacks) fn() }
  return { fx, bubble, calls, timers, frames, events, show, down, expire, frame }
}

test('到期时按住的真实回复保留到松手click，回调只执行一次', () => {
  const h = harness(), button = h.show()
  h.down(button); h.expire()
  assert.equal(h.bubble.hidden, false)
  h.events.fire('pointerup', { pointerId: 1 })
  assert.equal(h.bubble.hidden, false)
  button.fire('click'); h.frame(); button.fire('click')
  assert.deepEqual(h.calls, [0])
  assert.equal(h.bubble.hidden, true)
  assert.equal(h.frames.size, 0)
  h.fx.dispose()
})

test('没有按住的回复仍按原6000ms到期关闭', () => {
  const h = harness(); h.show(); h.expire()
  assert.equal(h.bubble.hidden, true)
  assert.deepEqual(h.calls, [])
  h.fx.dispose()
})

for (const release of ['pointercancel', 'blur']) test(`到期按住后${release}释放保护，不自动提交回复`, () => {
  const h = harness(), button = h.show(); h.down(button); h.expire()
  assert.equal(h.bubble.hidden, false)
  h.events.fire(release, { pointerId: 1 }); h.frame()
  assert.equal(h.bubble.hidden, true)
  assert.deepEqual(h.calls, [])
  h.fx.dispose()
})

test('新消息替换和dispose取消旧到期任务，旧回调不隐藏新消息', () => {
  const h = harness(), old = h.show(); h.down(old); const oldTimer = h.expire()
  h.events.fire('pointerup', { pointerId: 1 })
  h.fx.showBubble('新消息', 2600); oldTimer(); old.fire('click'); h.frame()
  assert.equal(h.bubble.hidden, false)
  assert.equal(h.bubble.children[0].textContent, '新消息')
  assert.deepEqual(h.calls, [])
  const newer = h.show('下一条'); h.down(newer); h.expire()
  h.events.fire('pointerup', { pointerId: 1 }); h.fx.dispose(); h.frame()
  assert.equal(h.frames.size, 0)
  assert.equal(h.timers.size, 0)
  for (const name of ['pointerup', 'pointercancel', 'blur']) assert.equal(h.events.listeners[name]?.length ?? 0, 0)
})
