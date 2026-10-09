// @ts-check
/**
 * 桌面版拆成两个窗口后（外壳 0.6.0 起）两边页面的分工（src/client/split.js、pending.js）。
 *
 * 同一份游戏包两边都跑，分工错了的表现是「同一件事演两遍」或「谁都不演」，
 * 这类错单看一个窗口发现不了，所以按角色分别验证。
 */
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { PIG_FX, splitSetOpen, wireSplit } from '../src/client/split.js'
import { processPending } from '../src/client/pending.js'

/** 假外壳：记下页面发给主进程的每条消息，并能模拟主进程推回来的消息。 */
function fakeShell(role) {
  const sent = []
  const listeners = { panel: [], fx: [], state: [] }
  const shell = {
    role, split: true,
    beginDrag() {}, endDrag() {}, syncGeometry() { sent.push(['sync']) },
    setAnchor(anchor) { sent.push(['anchor', anchor]) },
    onStateChanged(fn) { listeners.state.push(fn) },
    panel: {
      toggle(open) { sent.push(['toggle', open]) },
      close() { sent.push(['close']) },
      fx(name, args) { sent.push(['fx', name, args]) },
      on(fn) { listeners.panel.push(fn) },
      onFx(fn) { listeners.fx.push(fn) },
    },
  }
  globalThis.window = /** @type {any} */ ({ __dshPiggyShell: shell })
  return { shell, sent, emit: (kind, message) => listeners[kind].forEach(fn => fn(message)) }
}

function fakeCtx() {
  const calls = []
  const node = () => ({ hidden: false, attrs: {}, setAttribute(name, value) { this.attrs[name] = value } })
  return {
    calls, isOpen: false, host: node(), card: node(), hud: node(),
    setOpen(next) { calls.push(['setOpen', next]); this.isOpen = next },
    fitPanel() { calls.push(['fitPanel']) },
    flash(...args) { calls.push(['flash', ...args]) },
    react(...args) { calls.push(['react', ...args]) },
    burst(...args) { calls.push(['burst', ...args]) },
    showBubble(...args) { calls.push(['showBubble', ...args]) },
    transform(...args) { calls.push(['transform', ...args]) },
    toast(text) { calls.push(['toast', text]) },
    lastPendingId: 0, lastPendingAt: 0,
  }
}

afterEach(() => { delete globalThis.window })

test('不是拆窗口（网页版、老外壳）时两个函数都不接手', () => {
  const ctx = fakeCtx()
  assert.equal(wireSplit(ctx, { refresh() {}, isFishing: () => false }), null)
  assert.equal(splitSetOpen(ctx, true), false)
})

test('猪窗口：开关只叫主进程，自己永远不显示面板；状态没变不发（挂载时那次关不能关掉别人刚开的面板）', () => {
  const { sent } = fakeShell('pet')
  const ctx = fakeCtx()
  assert.equal(splitSetOpen(ctx, false), true)
  assert.deepEqual(sent, [])
  splitSetOpen(ctx, true)
  assert.deepEqual(sent, [['toggle', true]])
  assert.equal(ctx.host.attrs['data-open'], 'false')
  assert.equal(ctx.card.hidden, true)
})

test('猪窗口：面板窗口转来的反应照演，名单外的不演', () => {
  const { emit } = fakeShell('pet')
  const ctx = fakeCtx()
  wireSplit(ctx, { refresh() {}, isFishing: () => false })
  emit('fx', { name: 'showBubble', args: ['好吃', 2000] })
  emit('fx', { name: 'setOpen', args: [true] })
  assert.deepEqual(ctx.calls, [['showBubble', '好吃', 2000]])
})

test('面板窗口：对猪的反应都转给猪窗口，主进程的开/关/失焦驱动面板', () => {
  const { sent, emit } = fakeShell('panel')
  const ctx = fakeCtx()
  wireSplit(ctx, { refresh() {}, isFishing: () => false })
  for (const name of PIG_FX) ctx[name]('x')
  assert.deepEqual(sent.filter(entry => entry[0] === 'fx').map(entry => entry[1]), PIG_FX)
  emit('panel', { type: 'open', vertical: 'below', maxHeight: 300 })
  assert.deepEqual(ctx.calls.at(-1), ['setOpen', true])
  assert.deepEqual(sent.find(entry => entry[0] === 'anchor'), ['anchor', { vertical: 'below', maxHeight: 300 }])
  emit('panel', { type: 'blur', toPet: true })
  assert.equal(ctx.isOpen, true, '焦点到了猪身上不收')
  emit('panel', { type: 'closed' })
  assert.equal(ctx.isOpen, false)
})

test('任一窗口收到「存档变了」都刷新', () => {
  for (const role of ['pet', 'panel']) {
    const { emit } = fakeShell(role)
    let refreshed = 0
    wireSplit(fakeCtx(), { refresh() { refreshed += 1 }, isFishing: () => false })
    emit('state', undefined)
    assert.equal(refreshed, 1, role)
  }
})

test('排队消息两边各管一半：猪的反应只在猪窗口演，提示条只在面板窗口出', () => {
  const pending = [
    { id: 1, at: 1, kind: 'line', text: '饿了' },
    { id: 2, at: 2, kind: 'levelup', text: '升级啦' },
  ]
  const run = role => {
    fakeShell(role)
    const ctx = Object.assign(fakeCtx(), { view: { pending, dialogue: { quiet: false } } })
    const lines = []
    processPending(ctx, event => lines.push(event.text))
    return { lines, kinds: ctx.calls.map(call => call[0]) }
  }
  const pet = run('pet')
  assert.deepEqual(pet.lines, ['饿了'])
  assert.ok(pet.kinds.includes('react'))
  assert.ok(!pet.kinds.includes('toast'))
  const panel = run('panel')
  assert.deepEqual(panel.lines, [])
  assert.deepEqual(panel.kinds, ['toast'])
})

test('drained snapshot messages reach both windows and duplicate events are ignored', () => {
  for (const role of ['pet', 'panel']) {
    const { emit } = fakeShell(role)
    const ctx = fakeCtx()
    const lines = []
    ctx.render = view => { ctx.view = view; processPending(ctx, event => lines.push(event.text)) }
    wireSplit(ctx, { refresh() { assert.fail('a consumed event cannot be refetched') }, isFishing: () => false })
    const view = { pending: [{ id: 123, at: 1000, kind: 'line', text: 'hello' }], dialogue: { quiet: false } }
    emit('state', view)
    ctx.render(view)
    assert.deepEqual(lines, role === 'pet' ? ['hello'] : [])
  }
})
