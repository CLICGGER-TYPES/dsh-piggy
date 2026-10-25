// @ts-check
/**
 * 整屏舞台输入接管/交还的回归（任务 input-release）。全部是纯逻辑：假时钟 + 假页面，
 * 不启 Electron、不跑浏览器。页面侧跑真实的 apps/desktop/stage/bootstrap.js（只换
 * window/document/定时器），主进程侧跑真实的 present.js + lease.js。
 * 设 PIGGY_STAGE_BOOTSTRAP 可让同一套场景复跑修前快照（交付目录 before/），用同一方法对比。
 * 修前缺陷：心跳无条件续租（漏 pointerup 即永久接管）；右键/中键也接管；释放不看还有几根
 * 指针；没有 visibilitychange 释放；飞行交接只靠客户端那一次回调。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { createInteractionHold, createInteractionLease, EVIDENCE_MS, GUARD_MS, HEARTBEAT_MS } from '../stage/lease.js'
import { createPresenter } from '../stage/present.js'

const HERE = resolve(import.meta.dirname, '..')
const BOOTSTRAP = process.env.PIGGY_STAGE_BOOTSTRAP ?? join(HERE, 'stage', 'bootstrap.js')
const STAGE_WINDOW = { x: 0, y: 0, width: 1280, height: 800 }
const PIG = { x: 302, y: 244, width: 86, height: 106 }
const LANDED_PIG = { x: 900, y: 600, width: 86, height: 106 }

/** 假时钟：setTimeout/setInterval 都由 advance 推进，测试里没有真实等待。 */
function fakeClock() {
  let time = 0
  let seq = 0
  const timers = new Map()
  const add = (fn, ms, every) => {
    const id = ++seq
    const delay = Math.max(0, Number(ms) || 0)
    timers.set(id, { at: time + delay, fn, every: every ? Math.max(1, delay) : 0 })
    return id
  }
  return {
    now: () => time,
    setTimeout: (fn, ms) => add(fn, ms, false),
    setInterval: (fn, ms) => add(fn, ms, true),
    clearTimeout: id => { timers.delete(id) },
    clearInterval: id => { timers.delete(id) },
    advance(ms) {
      const end = time + ms
      for (;;) {
        let next = null
        for (const [id, timer] of timers) {
          if (timer.at > end) continue
          if (next === null || timer.at < next.timer.at || (timer.at === next.timer.at && id < next.id)) next = { id, timer }
        }
        if (next === null) break
        time = next.timer.at
        if (next.timer.every) next.timer.at = time + next.timer.every
        else timers.delete(next.id)
        next.timer.fn()
      }
      time = end
    },
  }
}

function makeHold(clock, extra = {}) {
  /** @type {[number, boolean][]} */
  const sent = []
  const hold = createInteractionHold({
    send: active => { sent.push([clock.now(), active]) },
    now: () => clock.now(),
    setTimer: clock.setTimeout, clearTimer: clock.clearTimeout,
    setTick: clock.setInterval, clearTick: clock.clearInterval,
    ...extra,
  })
  return { hold, sent, last: () => (sent.length === 0 ? null : sent[sent.length - 1][1]), trues: () => sent.filter(e => e[1]).length }
}

test('hold: only the primary button takes over; a right-button press never claims', () => {
  const clock = fakeClock()
  const page = makeHold(clock)
  assert.equal(page.hold.pointerDown({ pointerId: 1, button: 2 }), false)
  clock.advance(HEARTBEAT_MS * 3)
  assert.deepEqual(page.sent, [])
  assert.equal(page.hold.pointerDown({ pointerId: 1, button: 0 }), true)
  page.hold.reset()
  assert.equal(page.last(), false)
})

test('hold: a lost pointerup is bounded by pointer evidence, not by heartbeats', () => {
  const clock = fakeClock()
  const page = makeHold(clock)
  page.hold.pointerDown({ pointerId: 1, button: 0 })
  clock.advance(EVIDENCE_MS - 1)
  assert.equal(page.last(), true)
  clock.advance(HEARTBEAT_MS)
  assert.equal(page.last(), false, 'no fresh pointer evidence means the press is over')
  assert.ok(page.trues() <= EVIDENCE_MS / HEARTBEAT_MS + 1)
  clock.advance(HEARTBEAT_MS * 30)
  assert.equal(page.last(), false)
})

test('hold: a move without buttons proves the pointerup was lost; two fingers release on the last one', () => {
  const clock = fakeClock()
  const page = makeHold(clock)
  page.hold.pointerDown({ pointerId: 1, button: 0 })
  page.hold.pointerDown({ pointerId: 2, button: 0 })
  page.hold.pointerUp({ pointerId: 1 })
  clock.advance(16)
  assert.equal(page.last(), true, 'the second finger is still dragging')
  page.hold.pointerUp({ pointerId: 2 })
  clock.advance(16)
  assert.equal(page.last(), false)
  page.hold.pointerDown({ pointerId: 1, button: 0 })
  page.hold.pointerMove({ pointerId: 1, buttons: 0 })
  assert.equal(page.last(), false, 'hovering after a lost pointerup hands the desktop back')
})

test('hold: hidden pages drop claims; flight claims are re-checked every heartbeat', () => {
  const clock = fakeClock()
  let hidden = false
  let flying = false
  const page = makeHold(clock, { isHidden: () => hidden, isFlying: () => flying })
  page.hold.pointerDown({ pointerId: 1, button: 0 })
  hidden = true
  clock.advance(HEARTBEAT_MS)
  assert.equal(page.last(), false)
  hidden = false
  flying = true
  page.hold.external(true)
  clock.advance(HEARTBEAT_MS * 4)
  assert.equal(page.last(), true, 'still flying: keep the full window painted')
  flying = false
  clock.advance(HEARTBEAT_MS)
  assert.equal(page.last(), false, 'landed without the client callback: hand back within one beat')
})

test('hold: a claim nobody can verify is capped by the existing page guard', () => {
  const clock = fakeClock()
  const page = makeHold(clock, { isFlying: () => null })
  page.hold.external(true)
  assert.equal(page.last(), true)
  clock.advance(GUARD_MS - HEARTBEAT_MS)
  assert.equal(page.last(), true)
  clock.advance(HEARTBEAT_MS * 2)
  assert.equal(page.last(), false)
})

/** 主进程侧的假窗口 + presenter/租约，按 main.js 的方式接起来。 */
function makePresenter(clock) {
  /** @type {any[][]} */
  const shapes = []
  const win = {
    getContentBounds: () => STAGE_WINDOW, getBounds: () => STAGE_WINDOW,
    isVisible: () => true, isDestroyed: () => false,
    setShape: rects => { shapes.push(rects) }, setIgnoreMouseEvents: () => {},
  }
  /** @type {any} */
  let presenter = null
  const lease = createInteractionLease({
    timeout: 3000, setTimer: clock.setTimeout, clearTimer: clock.clearTimeout,
    onChange: active => presenter.applyInteracting(active === true),
  })
  presenter = createPresenter({
    getWindow: () => win, platform: 'linux', log: () => {},
    screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }) },
    onInteraction: active => lease.request(active === true),
  })
  presenter.setShaped(true)
  return { presenter, lease, shapes }
}

/** presenter 自己用全局 setTimeout 做交接窗口，这里临时换成假时钟。 */
function withFakeTimers(clock, body) {
  const saved = ['setTimeout', 'clearTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  Object.defineProperty(globalThis, 'setTimeout', { value: clock.setTimeout, configurable: true, writable: true })
  Object.defineProperty(globalThis, 'clearTimeout', { value: clock.clearTimeout, configurable: true, writable: true })
  try { return body() } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (/** @type {any} */ (globalThis))[key]
    }
  }
}

test('presenter: keeps the full window until the landed frame arrives, then narrows', () => {
  const clock = fakeClock()
  withFakeTimers(clock, () => {
    const { presenter, shapes } = makePresenter(clock)
    presenter.applyReport({ shape: [PIG], visible: {}, interacting: false })
    assert.deepEqual(shapes.at(-1), [PIG], 'idle: the exact pig box is painted and clickable')
    presenter.applyReport({ shape: [PIG], visible: {}, interacting: true })
    assert.deepEqual(shapes.at(-1), [STAGE_WINDOW], 'press: full window so fast drags are not clipped')
    presenter.applyInteracting(false)
    assert.deepEqual(shapes.at(-1), [STAGE_WINDOW], 'release: hold the full window until the landed frame')
    presenter.applyReport({ shape: [LANDED_PIG], visible: {}, interacting: false })
    assert.deepEqual(shapes.at(-1), [LANDED_PIG], 'handover: narrow to the frame the page measured')
    presenter.dispose()
  })
})

test('presenter: a stalled renderer gives the desktop back after the lease', () => {
  const clock = fakeClock()
  withFakeTimers(clock, () => {
    const { presenter, lease, shapes } = makePresenter(clock)
    presenter.applyReport({ shape: [PIG], visible: {}, interacting: false })
    presenter.applyReport({ shape: [PIG], visible: {}, interacting: true })
    clock.advance(3000)
    assert.equal(lease.isActive(), false)
    assert.deepEqual(shapes.at(-1), [STAGE_WINDOW], 'the handover window is still painted')
    clock.advance(600)
    assert.deepEqual(shapes.at(-1), [PIG], 'no report at all: fall back to the last known shape')
    presenter.dispose()
    lease.dispose()
  })
})

const GLOBALS = ['window', 'document', 'getComputedStyle', 'MutationObserver', 'ResizeObserver',
  'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']

/** 装一份真实的 bootstrap.js，配假 window/document/时钟。 */
async function mountPage(label) {
  const clock = fakeClock()
  const sent = []
  const reports = []
  const state = { flying: false, hidden: false, focused: true }
  let mounted = null
  const listeners = () => {
    const map = new Map()
    return {
      add: (type, handler) => { const list = map.get(type) ?? []; list.push(handler); map.set(type, list) },
      remove: (type, handler) => { const list = map.get(type); if (list) { const i = list.indexOf(handler); if (i >= 0) list.splice(i, 1) } },
      fire: (type, init) => { for (const handler of [...(map.get(type) ?? [])]) handler({ type, ...init }) },
    }
  }
  const onWindow = listeners()
  const onDocument = listeners()
  const body = { tagName: 'body' }
  const pig = {
    offsetLeft: 10, offsetTop: 20, offsetWidth: 54, offsetHeight: 54, offsetParent: null, closest: () => null,
    getBoundingClientRect: () => ({ left: 110, top: 70, right: 164, bottom: 124, width: 54, height: 54 }),
  }
  const host = {
    offsetLeft: 100, offsetTop: 50, offsetParent: body, closest: () => null, getAttribute: () => null,
    querySelector: selector => (selector === '.dp-pig' ? pig : null),
  }
  pig.offsetParent = host
  const inside = () => ({ closest: selector => (selector === '[data-dsh-pig]' ? host : null) })
  const outside = () => ({ closest: () => null })
  const doc = {
    body, head: { appendChild() {} }, documentElement: { setAttribute() {} }, hasFocus: () => state.focused,
    addEventListener: onDocument.add, removeEventListener: onDocument.remove, createElement: () => ({ setAttribute() {}, textContent: '' }),
    querySelector: selector => (selector === '[data-dsh-pig]' ? host : null), querySelectorAll: () => [],
  }
  Object.defineProperty(doc, 'hidden', { get: () => state.hidden })
  Object.defineProperty(doc, 'visibilityState', { get: () => (state.hidden ? 'hidden' : 'visible') })
  const geometry = { window: STAGE_WINDOW, workAreas: [STAGE_WINDOW], displays: [], interacting: false, seq: 1 }
  const win = {
    innerWidth: STAGE_WINDOW.width, innerHeight: STAGE_WINDOW.height,
    stageShell: {
      role: 'stage',
      setInteracting: active => { sent.push([clock.now(), active === true]) },
      report: payload => { reports.push({ shape: payload.shape, interacting: payload.interacting }) },
      geometry: () => geometry, askGeometry: () => geometry, onGeometry: () => () => {},
      onInteractionOff: handler => { doc.interactionOff = handler; return () => { doc.interactionOff = null } },
    },
    piggyShell: {},
    piggyGame: { mount: options => { mounted = options; return () => { mounted = null } } },
    piggyStage: { isFlying: () => state.flying },
    addEventListener: onWindow.add, removeEventListener: onWindow.remove,
  }
  const saved = new Map(GLOBALS.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const savedNow = Object.getOwnPropertyDescriptor(Date, 'now')
  const globals = {
    window: win, document: doc,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', translate: '' }),
    MutationObserver: class { observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: fn => clock.setTimeout(() => fn(clock.now()), 16),
    cancelAnimationFrame: id => clock.clearTimeout(id),
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval, clearInterval: clock.clearInterval,
  }
  const restore = () => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete (/** @type {any} */ (globalThis))[key]
    }
    Object.defineProperty(Date, 'now', savedNow)
  }
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  // 页面里的 hold 用默认 Date.now 当"现在"，这里接到假时钟上。
  Object.defineProperty(Date, 'now', { value: () => clock.now(), configurable: true, writable: true })
  try {
    await import(pathToFileURL(BOOTSTRAP).href + '?case=' + encodeURIComponent(label))
  } catch (error) {
    restore()
    throw error
  }
  clock.advance(32)
  return {
    clock, sent, reports, state, restore, outside,
    mounted: () => mounted,
    last: () => (sent.length === 0 ? null : sent[sent.length - 1][1]),
    trues: () => sent.filter(entry => entry[1] === true).length,
    down: init => onWindow.fire('pointerdown', { target: inside(), pointerId: 1, button: 0, buttons: 1, ...init }),
    move: init => onWindow.fire('pointermove', { target: inside(), pointerId: 1, buttons: 1, ...init }),
    up: init => onWindow.fire('pointerup', { target: inside(), pointerId: 1, button: 0, buttons: 0, ...init }),
    hide: () => { state.hidden = true; onDocument.fire('visibilitychange', {}) },
  }
}

async function withPage(label, body) {
  const page = await mountPage(label)
  try { await body(page) } finally { page.restore() }
}

test('page: a button press whose pointerup was lost does not hold the whole stage', () => withPage('button-lost-up', page => {
  page.down({ target: page.outside() })
  assert.equal(page.last(), null, 'presses outside the pig host never claim the stage')
  // 点面板按钮（导出存档/日志会弹原生保存框）：接管开始，pointerup 没回到页面。
  page.down({ pointerId: 7 })
  page.clock.advance(32)
  assert.equal(page.last(), true)
  // 回到桌面继续用鼠标：整窗都在接鼠标事件，移动里 buttons 是 0。
  for (let step = 0; step < 60; step += 1) {
    page.clock.advance(500)
    page.move({ pointerId: 7, buttons: 0 })
    if (step === 1) assert.equal(page.last(), false, 'the first buttonless move proves the press is over')
  }
  assert.equal(page.last(), false, 'hovering with no buttons must not keep the desktop blocked')
}))

test('page: a silent lost pointerup hands the stage back within the evidence window', () => withPage('silent-lost-up', page => {
  page.down()
  page.clock.advance(32)
  assert.equal(page.last(), true)
  page.clock.advance(EVIDENCE_MS + 32)
  assert.equal(page.last(), false)
}))

test('page: a real drag keeps the whole window while the pointer stays down', () => withPage('drag-hold', page => {
  page.down()
  for (let step = 0; step < 40; step += 1) {
    page.clock.advance(120)
    page.move()
  }
  assert.equal(page.last(), true, 'a long drag must not lose the full-window paint')
  assert.ok(page.trues() >= 4, 'heartbeats keep the lease alive during a long drag')
  page.clock.advance(32)
  page.up()
  page.clock.advance(32)
  assert.equal(page.last(), false)
  const report = page.reports.at(-1)
  assert.equal(report.interacting, false)
  assert.ok(Array.isArray(report.shape) && report.shape.length > 0, 'the landed frame is reported')
}))

test('page: right-button presses never claim the stage', () => withPage('right-button', page => {
  page.down({ button: 2, buttons: 2 })
  page.clock.advance(32)
  page.move({ buttons: 0 })
  page.clock.advance(HEARTBEAT_MS * 2)
  assert.equal(page.trues(), 0, 'a native context menu steals the pointerup, so never claim')
}))

test('page: releasing one finger keeps the whole window for the one still dragging', () => withPage('two-fingers', page => {
  page.down({ pointerId: 1 })
  page.down({ pointerId: 2 })
  page.up({ pointerId: 1 })
  page.clock.advance(32)
  assert.equal(page.last(), true, 'the second finger is still dragging')
  page.up({ pointerId: 2 })
  page.clock.advance(32)
  assert.equal(page.last(), false)
}))

test('page: hiding the stage hands the stage back immediately', () => withPage('hidden', page => {
  page.down()
  page.clock.advance(32)
  page.hide()
  assert.equal(page.last(), false, 'visibilitychange must release immediately')
}))

test('page: landing a flight hands back even when the client callback is lost', () => withPage('flight-landing', page => {
  page.down()
  page.state.flying = true
  page.mounted().stage.setInteracting(true)
  page.up()
  page.clock.advance(32)
  assert.equal(page.last(), true, 'flying keeps the full window painted')
  page.state.flying = false
  page.clock.advance(HEARTBEAT_MS + 32)
  assert.equal(page.last(), false, 'landing hands back within one heartbeat')
}))
