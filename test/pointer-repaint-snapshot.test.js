import assert from 'node:assert/strict'
import { test } from 'node:test'
import { processPending } from '../src/client/pending.js'
import { attachPointerRepaint } from '../src/client/pointer-repaint.js'

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

function fixture(snapshotAware) {
  const previousWindow = globalThis.window
  globalThis.window = { __dshPiggyShell: { role: 'pet', beginDrag() {} } }
  const root = new EventTarget()
  const events = new EventTarget()
  const guard = attachPointerRepaint(root, events)
  const shown = []
  const ctx = {
    lastPendingAt: 0,
    lastPendingId: 0,
    showLine: text => shown.push(text),
    updateNotice: null,
  }
  function render(snapshot) {
    const deferred = snapshotAware
      ? guard.defer(render, snapshot)
      : guard.defer(() => render(snapshot))
    if (deferred) return true
    ctx.view = snapshot
    processPending(ctx, event => ctx.showLine(event.text, event.replies, () => {}))
    return false
  }
  return {
    root, events, guard, ctx, shown, render,
    restore() {
      guard.dispose()
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
    },
  }
}

function view(marker, pending = [], extra = {}) {
  return { ...extra, marker, dialogue: { quiet: false }, pending }
}

const line = (id, text) => ({ id, at: id, kind: 'line', text, replies: [] })

test('旧 callback-only defer 会让随空快照到达的 line 消失', async () => {
  const one = fixture(false)
  try {
    one.root.dispatchEvent(new Event('pointerdown'))
    one.render(view('action', [line(2, '我的头很圆')]))
    one.render(view('empty', []))
    one.events.dispatchEvent(new Event('pointerup'))
    await wait(175)
    assert.deepEqual(one.shown, [])
    assert.equal(one.ctx.view.marker, 'empty')
  } finally { one.restore() }
})

test('snapshot defer keeps pending line across a newer empty snapshot and existing id dedupe', async () => {
  const one = fixture(true)
  try {
    const pendingLine = line(2, '我的头很圆')
    one.root.dispatchEvent(new Event('pointerdown'))
    one.render(view('action', [pendingLine], { obsoleteResult: { ok: true, reward: 8 } }))
    one.render(view('snapshot-repeat', [pendingLine]))
    one.render(view('broadcast-empty', []))
    one.events.dispatchEvent(new Event('pointerup'))
    await wait(175)
    assert.deepEqual(one.shown, ['我的头很圆'])
    assert.equal(one.ctx.view.marker, 'broadcast-empty', '非 pending 字段仍采用最新快照')
    assert.equal(Object.hasOwn(one.ctx.view, 'obsoleteResult'), false, '字段已从最新快照消失时不得沿用旧结果')

    one.render(view('same-id-again', [pendingLine]))
    assert.deepEqual(one.shown, ['我的头很圆'], 'processPending 按 id 去重')
  } finally { one.restore() }
})

test('pointer hold 内两条新 line 按 id 顺序到达处理器', async () => {
  const one = fixture(true)
  try {
    one.root.dispatchEvent(new Event('pointerdown'))
    one.render(view('first', [line(2, '第一句')]))
    one.render(view('second', [line(3, '第二句')]))
    one.render(view('latest-empty', []))
    one.events.dispatchEvent(new Event('pointerup'))
    await wait(175)
    assert.deepEqual(one.shown, ['第一句', '第二句'])
    assert.equal(one.ctx.lastPendingId, 3)
    assert.equal(one.ctx.view.marker, 'latest-empty')
  } finally { one.restore() }
})

test('已排队快照遇到 readyAt 后抢先来的 render 会一起刷新，pointercancel 立即放行', async () => {
  const realNow = Date.now
  let now = realNow()
  Date.now = () => now
  const one = fixture(true)
  try {
    one.root.dispatchEvent(new Event('pointerdown'))
    one.render(view('action', [line(2, '抢先重绘')]))
    one.events.dispatchEvent(new Event('pointerup'))
    now += 150
    assert.equal(one.render(view('latest-empty', [])), true, '已有 timer 时将这次 render 并入队列')
    await wait(20)
    assert.deepEqual(one.shown, ['抢先重绘'])
    assert.equal(one.ctx.view.marker, 'latest-empty')

    for (const [eventName, text] of [['pointercancel', '取消释放'], ['blur', '失焦释放']]) {
      one.root.dispatchEvent(new Event('pointerdown'))
      one.render(view(eventName, [line(one.ctx.lastPendingId + 1, text)]))
      one.events.dispatchEvent(new Event(eventName))
      await wait(20)
      assert.equal(one.shown.at(-1), text)
    }
  } finally {
    Date.now = realNow
    one.restore()
  }
})

test('dispose 丢弃待执行的 snapshot，不在销毁后重画', async () => {
  const one = fixture(true)
  try {
    one.root.dispatchEvent(new Event('pointerdown'))
    one.render(view('pending', [line(2, '不可绘制')]))
    one.guard.dispose()
    one.events.dispatchEvent(new Event('pointerup'))
    await wait(175)
    assert.deepEqual(one.shown, [])
  } finally { one.restore() }
})
