// @ts-check
/**
 * 整屏舞台修正的回归（A2/A3/A4/A5/A9）：全部是纯函数/注入计时器，不启 Electron。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { fitSpeechPlacement } from '../../../src/client/bubble-fit.js'
import { constrainRectToAreas, legacyPigRect, pigBoxForPosition, positionForPig, savedPigTopLeft } from '../../../src/client/stage-position.js'
import {
  applyPigFx, forwardPigFx, openBigTarget, registerStageShell, stageShell, unregisterStageShell,
} from '../../../src/client/stage-shell.js'
import { createInteractionLease } from '../stage/lease.js'

const win = { x: 0, y: 0, width: 1280, height: 800 }

test('A2: a pig at the top of the screen puts its bubble below, same width and pig position', () => {
  const pig = { x: 600, y: 4, width: 56, height: 56 }
  const bubble = { x: pig.x + pig.width - 200, y: pig.y - 10 - 52, width: 200, height: 52 }
  const place = fitSpeechPlacement({ bubble, pig, window: win, workArea: win })
  assert.equal(place.side, 'below')
  assert.equal(place.y, pig.y + pig.height + 10)
  assert.equal(place.width, 200)
  assert.deepEqual({ x: pig.x, y: pig.y }, { x: 600, y: 4 })
})

test('A2: a bubble crossing the work-area edge is shifted in, width unchanged', () => {
  const pig = { x: 1240, y: 300, width: 56, height: 56 }
  const bubble = { x: pig.x + pig.width - 200, y: 240, width: 200, height: 52 }
  const place = fitSpeechPlacement({ bubble, pig, window: win, workArea: win })
  assert.equal(place.clipped, true)
  assert.equal(place.width, 200)
  assert.equal(place.x, win.width - 6 - 200)
  assert.ok(place.tailLeft >= 10 && place.tailLeft <= 200 - 20)
})

test('A2: an open menu under the bubble pushes it below when below fits', () => {
  const pig = { x: 600, y: 300, width: 56, height: 56 }
  const bubble = { x: pig.x + pig.width - 200, y: pig.y - 10 - 52, width: 200, height: 52 }
  const menu = { x: 400, y: 150, width: 292, height: 200 }
  const place = fitSpeechPlacement({ bubble, pig, window: win, workArea: win, menu })
  assert.equal(place.side, 'below')
  assert.equal(place.y, pig.y + pig.height + 10)
})

test('A3: right/bottom round-trips to the same pig box, including negative screen origins', () => {
  const hostBox = { x: 1000, y: 700, width: 320, height: 120 }
  const pigBox = { x: 1006, y: 724, width: 56, height: 56 }
  const position = positionForPig(pigBox, hostBox, win)
  assert.deepEqual(pigBoxForPosition(position, hostBox, pigBox, win), pigBox)
})

test('A3: desktop v3 home (screen feet) and window.json pig both migrate to a screen box', () => {
  const size = { width: 56, height: 56 }
  const v3 = savedPigTopLeft({ v: 3, area: { x: -1920, y: -200, width: 1920, height: 1080 }, x: 900, y: 600 }, size)
  assert.deepEqual(v3, { x: -1048, y: -200 + 600 - 56, width: 56, height: 56 })
  const legacy = legacyPigRect({ x: -1048, y: 344 }, size)
  assert.deepEqual(legacy, { x: -1048, y: 344, width: 56, height: 56 })
  assert.equal(legacyPigRect(null, size), null)
})

test('A3: a pig in a gap between mismatched screens is moved into a real work area', () => {
  const left = { x: -1920, y: 0, width: 1920, height: 1080 }
  const lower = { x: 0, y: 1200, width: 1000, height: 400 }
  const gap = { x: -300, y: 1600, width: 120, height: 120 }
  const moved = constrainRectToAreas(gap, [left, lower])
  assert.equal(moved.moved, true)
  assert.ok(moved.offset.x > 0 && moved.offset.y < 0)
  assert.deepEqual(constrainRectToAreas({ x: -1000, y: 10, width: 56, height: 56 }, [left, lower]), { offset: { x: 0, y: 0 }, moved: false })
})

test('A4: openBig prefers the desktop shell, then the stage adapter, then the page', () => {
  const stage = { ext: { open() {} } }
  const desktop = { ext: { open() {} } }
  assert.equal(openBigTarget(desktop, stage), 'desktop')
  assert.equal(openBigTarget(null, stage), 'stage')
  assert.equal(openBigTarget(null, null), 'page')
  // 第三方扩展没有 data-* 属性也走同一条路：只要求适配器有通用 ext.open。
  assert.equal(openBigTarget(null, { role: 'stage', ext: { open() {} } }), 'stage')
})

test('A9: forwarded reactions call the real ctx methods and ignore non-whitelisted names', () => {
  const calls = []
  const ctx = {
    showBubble: (text, ms) => calls.push(['showBubble', text, ms]),
    react: kind => calls.push(['react', kind]),
  }
  assert.equal(applyPigFx(ctx, { name: 'showBubble', args: ['我长大啦', 2600] }), true)
  assert.deepEqual(calls, [['showBubble', '我长大啦', 2600]])
  assert.equal(applyPigFx(ctx, { name: 'innerHTML', args: ['<b>x</b>'] }), false)
  assert.equal(applyPigFx(ctx, null), false)
  assert.equal(calls.length, 1)
})

test('A9: the ext window forwards whitelisted fx and restores ctx on dispose', () => {
  const sent = []
  const original = () => 'original'
  const ctx = { showBubble: original, react: () => {}, evil: () => {} }
  const restore = forwardPigFx(ctx, (name, args) => sent.push([name, args]))
  ctx.showBubble('hi', 1000)
  ctx.evil('x')
  assert.deepEqual(sent, [['showBubble', ['hi', 1000]]])
  restore()
  assert.equal(ctx.showBubble, original)
  assert.equal(ctx.evil('x'), undefined)
})

test('stage registration is scoped: a stale adapter cannot unregister the live one', () => {
  const first = { role: 'stage' }
  const second = { role: 'stage' }
  registerStageShell(first)
  assert.equal(stageShell(), first)
  unregisterStageShell(second)
  assert.equal(stageShell(), first)
  unregisterStageShell(first)
  assert.equal(stageShell(), null)
})

test('A5: interacting lease heartbeats, releases on timeout, blur and dispose', () => {
  /** @type {{fn:()=>void, ms:number, id:number, cleared:boolean}[]} */
  const timers = []
  let nextId = 1
  const changes = []
  const lease = createInteractionLease({
    timeout: 3000,
    onChange: (active, reason) => changes.push([active, reason]),
    setTimer: (fn, ms) => { const timer = { fn, ms, id: nextId++, cleared: false }; timers.push(timer); return timer },
    clearTimer: timer => { timer.cleared = true },
  })
  const fire = () => {
    const live = timers.filter(timer => !timer.cleared)
    const latest = live[live.length - 1]
    assert.ok(latest, 'expected a live lease timer')
    latest.cleared = true
    latest.fn()
  }

  lease.request(true)
  assert.deepEqual(changes, [[true, 'page']])
  lease.request(true) // heartbeat: no duplicate onChange, timer renewed
  assert.deepEqual(changes, [[true, 'page']])
  fire()
  assert.deepEqual(changes, [[true, 'page'], [false, 'lease']])

  lease.request(true)
  assert.equal(lease.release('blur'), true)
  assert.deepEqual(changes.at(-1), [false, 'blur'])
  assert.equal(lease.isActive(), false)

  lease.request(true)
  const stale = timers.filter(timer => !timer.cleared).at(-1)
  lease.dispose()
  assert.deepEqual(changes.at(-1), [false, 'dispose'])
  const count = changes.length
  stale.fn()
  assert.equal(changes.length, count)
  assert.equal(lease.request(true), false)
})


test('first stage start restores the real desktop home over a stale web default and keeps it on return', async () => {
  const { createStageBridge } = await import('../../../src/client/stage-bridge.js')
  const saved = new Map([
    ['dsh-piggy:position', JSON.stringify({ right: 18, bottom: 18 })],
    ['dsh-piggy:desktop-pig', JSON.stringify({ v: 3, area: { x: 67, y: 32, width: 1213, height: 768 }, x: 1091, y: 620 })],
  ])
  const originals = {}
  for (const key of ['window', 'document', 'getComputedStyle', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame']) originals[key] = Object.getOwnPropertyDescriptor(globalThis, key)
  let nextFrame = 0
  const frames = new Map()
  const host = { get offsetLeft() { return 1213 - parseFloat(this.style.right) - 100 }, get offsetTop() { return 768 - parseFloat(this.style.bottom) - 100 }, offsetWidth: 100, offsetHeight: 100, offsetParent: null,
    style: { right: '18px', bottom: '18px' }, getAttribute: () => 'false' }
  const pig = { offsetLeft: 10, offsetTop: 20, offsetWidth: 54, offsetHeight: 54, offsetParent: host }
  const geometry = { window: { x: 67, y: 32, width: 1213, height: 768 }, workAreas: [{ x: 67, y: 32, width: 1213, height: 768 }] }
  let bridge
  try {
    globalThis.window = { innerWidth: 1213, innerHeight: 768, localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }, addEventListener() {}, removeEventListener() {} }
    globalThis.document = { body: {}, activeElement: null }
    globalThis.getComputedStyle = node => node.style
    globalThis.MutationObserver = class { observe() {} disconnect() {} }
    globalThis.requestAnimationFrame = fn => { frames.set(++nextFrame, fn); return nextFrame }
    globalThis.cancelAnimationFrame = id => frames.delete(id)
    const make = ctx => createStageBridge({ options: { role: 'stage', geometry: () => geometry }, ctx, host, pig, bubble: { hidden: true }, card: { hidden: true }, setOpen() {}, clampPig() {}, fitPanel() {} })
    const ctx = { userRight: 18, userBottom: 18 }
    bridge = make(ctx)
    frames.values().next().value()
    assert.deepEqual(JSON.parse(saved.get('dsh-piggy:position')), { right: 59, bottom: 122 })
    assert.equal(ctx.userRight, 59)
    assert.equal(ctx.userBottom, 122)
    bridge.dispose()
    bridge = make({ userRight: 59, userBottom: 122 })
    bridge.setPosition(80, 100, false)
    assert.deepEqual(JSON.parse(saved.get('dsh-piggy:position')), { right: 80, bottom: 100 }, 'work-area corrections persist even without scheduling another settle')
    bridge.setPosition(123, 234)
    bridge.dispose()
    const again = { userRight: 123, userBottom: 234 }
    bridge = make(again)
    const latest = [...frames.values()].at(-1)
    latest()
    assert.deepEqual(JSON.parse(saved.get('dsh-piggy:position')), { right: 123, bottom: 234 }, 'later stage starts retain the staged position')
    const desktop = JSON.parse(saved.get('dsh-piggy:desktop-pig'))
    assert.equal(desktop.v, 3)
    assert.equal(desktop.x, 1027, 'return to split mode uses the current layout foot rather than the old desktop home')
    assert.equal(desktop.y, 508)
  } finally {
    bridge?.dispose()
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})


test('changing stage resolution rebases offsets around the same absolute screen foot', async () => {
  const { positionForScreenFoot } = await import('../../../src/client/stage-position.js')
  const geometry = { window: { x: 67, y: 32, width: 957, height: 736 } }
  const next = positionForScreenFoot({ x: 750, y: 383 }, { x: 400, y: 265, width: 54, height: 54 }, { x: 394, y: 199, width: 66, height: 132 }, geometry)
  assert.deepEqual(next, { right: 241, bottom: 373 })
  assert.equal(67 + 957 - next.right - 66 + 6 + 27, 750)
  assert.equal(32 + 736 - next.bottom - 132 + 66 + 54, 383)
})

test('a top-edge reply bubble moves the panel below it without moving the pig', async () => {
  const { fitPanelBelowSpeech } = await import('../../../src/client/bubble-fit.js')
  const pig = { x: 500, y: 70, width: 54, height: 54 }
  const panel = { x: 270, y: 144, width: 292, height: 520 }
  const bubble = { x: 259, y: 134, width: 302, height: 117.4375 }
  const before = { ...pig }
  const result = fitPanelBelowSpeech(panel, bubble, pig, { x: 0, y: 0, width: 1213, height: 768 })
  assert.deepEqual(result, { y: 260, maxHeight: 498 })
  assert.ok(result.y > bubble.y + bubble.height)
  assert.ok(result.y + result.maxHeight <= 758)
  assert.deepEqual(pig, before)
  assert.equal(fitPanelBelowSpeech({ ...panel, y: 300 }, bubble, pig, { x: 0, y: 0, width: 1213, height: 768 }), null)
})
