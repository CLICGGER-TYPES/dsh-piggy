import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createInputController } from '../src/client/desktop/input-controller.js'
import { createPetController } from '../src/client/desktop/pet-controller.js'
import { install as installDesktop, start as startDesktop } from '../src/client/desktop/index.js'

function eventTarget() {
  const listeners = new Map()
  return {
    addEventListener(name, handler) {
      const rows = listeners.get(name) ?? []
      rows.push(handler)
      listeners.set(name, rows)
    },
    removeEventListener(name, handler) {
      listeners.set(name, (listeners.get(name) ?? []).filter(row => row !== handler))
    },
    listenerCount(name) { return (listeners.get(name) ?? []).length },
  }
}

function fakeWindow() {
  const target = eventTarget()
  const frames = []
  const canceled = []
  const intervals = []
  return {
    ...target,
    frames,
    canceled,
    intervals,
    innerWidth: 300,
    innerHeight: 220,
    screenX: 0,
    screenY: 0,
    requestAnimationFrame(callback) { frames.push(callback); return frames.length },
    cancelAnimationFrame(id) { canceled.push(id) },
    setInterval(callback, delay) { intervals.push({ callback, delay }); return intervals.length },
    clearInterval() {},
  }
}

function fakeDocument() {
  const target = eventTarget()
  return { ...target, documentElement: eventTarget() }
}

function fakeGlobalDocument() {
  const documentTarget = eventTarget()
  const documentElement = { ...eventTarget(), setAttribute() {} }
  let hasDesktopStyle = false
  const style = { setAttribute() {}, textContent: '' }
  return {
    ...documentTarget,
    documentElement,
    head: { appendChild() { hasDesktopStyle = true } },
    createElement() { return style },
    querySelector(selector) {
      return selector === '[data-piggy-desktop-style]' && hasDesktopStyle ? style : null
    },
  }
}

function fakeShell() {
  const calls = { onGeometry: 0, onDragSlide: 0, askGeometry: 0, hit: [], panelToggle: [] }
  return {
    calls,
    shell: {
      platform: 'linux',
      panel: { toggle(...args) { calls.panelToggle.push(args) }, on() {}, onFx() {}, raisePet() {} },
      geometry: () => null,
      onGeometry() { calls.onGeometry += 1 },
      onDragSlide() { calls.onDragSlide += 1 },
      askGeometry() { calls.askGeometry += 1 },
      setHit(value) { calls.hit.push(value) },
      place() {},
    },
  }
}

test('pet controllers keep shell and lifecycle state per renderer and start only once', () => {
  const docA = fakeDocument(), winA = fakeWindow(), a = fakeShell()
  const docB = fakeDocument(), winB = fakeWindow(), b = fakeShell()
  const ownerArchivesA = { status() { return 'panel-only bridge from preload' } }
  const ownerArchivesB = { status() { return 'second renderer bridge' } }
  a.shell.ownerArchives = ownerArchivesA
  b.shell.ownerArchives = ownerArchivesB
  let hostReadsA = 0, hostReadsB = 0
  const controllerA = createPetController({ shell: a.shell, documentObject: docA, windowObject: winA,
    getHost: () => { hostReadsA += 1; return null } })
  const controllerB = createPetController({ shell: b.shell, documentObject: docB, windowObject: winB,
    getHost: () => { hostReadsB += 1; return null } })

  controllerA.install(); controllerA.install()
  controllerB.install(); controllerB.install()
  controllerA.start(); controllerA.start()
  controllerB.start(); controllerB.start()

  assert.equal(a.calls.onGeometry, 1)
  assert.equal(a.calls.onDragSlide, 1)
  assert.equal(a.calls.askGeometry, 1)
  assert.equal(b.calls.onGeometry, 1)
  assert.equal(b.calls.onDragSlide, 1)
  assert.equal(b.calls.askGeometry, 1)
  assert.equal(docA.listenerCount('mousemove'), 1)
  assert.equal(docA.listenerCount('mouseover'), 1)
  assert.equal(docA.documentElement.listenerCount('mouseleave'), 1)
  assert.equal(winA.listenerCount('resize'), 1)
  assert.equal(winA.listenerCount('pointerup'), 1)
  assert.equal(winA.intervals.length, 1)
  assert.equal(winA.frames.length, 1)
  assert.equal(winB.frames.length, 1)
  assert.ok(hostReadsA > 0)
  assert.ok(hostReadsB > 0)
  assert.notEqual(winA.__dshPiggyShell, winB.__dshPiggyShell)
  assert.notEqual(winA.__dshPiggyShell.panel.toggle, winB.__dshPiggyShell.panel.toggle)
  assert.equal(winA.__dshPiggyShell.ownerArchives, ownerArchivesA, 'pet adapter preserves its renderer-specific preload bridge')
  assert.equal(winB.__dshPiggyShell.ownerArchives, ownerArchivesB, 'another pet adapter cannot reuse a stale bridge')
  winA.__dshPiggyShell.panel.toggle(true)
  winB.__dshPiggyShell.panel.toggle(false)
  assert.deepEqual(a.calls.panelToggle, [[true, null]])
  assert.deepEqual(b.calls.panelToggle, [[false, null]])
})

test('input hit rectangles and forwarding state are isolated per controller', () => {
  const docA = fakeDocument(), winA = fakeWindow(), a = fakeShell()
  const docB = fakeDocument(), winB = fakeWindow(), b = fakeShell()
  const inputA = createInputController({ shell: a.shell, documentObject: docA, windowObject: winA,
    getHost: () => null, blocked: () => false })
  const inputB = createInputController({ shell: b.shell, documentObject: docB, windowObject: winB,
    getHost: () => null, blocked: () => false })
  inputA.install(); inputB.install()
  inputA.setHitRects([{ x: 0, y: 0, width: 20, height: 20 }])
  inputB.setHitRects([{ x: 50, y: 50, width: 20, height: 20 }])

  inputA.updateHit(5, 5)
  inputB.updateHit(5, 5)
  assert.deepEqual(a.calls.hit, [true])
  assert.deepEqual(b.calls.hit, [false])
  inputA.updateHit(30, 30)
  assert.deepEqual(a.calls.hit, [true, false])
  assert.deepEqual(b.calls.hit, [false])

  inputA.startTracking(); inputA.startTracking()
  assert.equal(winA.frames.length, 1)
  inputA.dispose()
  assert.equal(docA.listenerCount('mousemove'), 0)
  assert.equal(docA.documentElement.listenerCount('mouseleave'), 0)
  assert.deepEqual(winA.canceled, [1])
})

test('facade install/start retry after transient initialization failure without duplicating completed work', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const doc = fakeGlobalDocument()
  const win = fakeWindow()
  const addWindowEvent = win.addEventListener
  let failPointerUpOnce = true
  win.addEventListener = function (name, handler) {
    if (name === 'pointerup' && failPointerUpOnce) {
      failPointerUpOnce = false
      throw new Error('transient pointerup registration failure')
    }
    return addWindowEvent.call(this, name, handler)
  }
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: doc })
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: win })
  try {
    let geometryAttempts = 0
    const counts = { dragSlide: 0, askGeometry: 0 }
    const shell = {
      platform: 'linux',
      panel: { toggle() {}, on() {}, onFx() {}, raisePet() {} },
      geometry: () => null,
      place() { return null },
      setHit() {},
      beginDrag() {}, endDrag() {},
      onGeometry() {
        geometryAttempts += 1
        if (geometryAttempts === 1) throw new Error('transient geometry registration failure')
      },
      onDragSlide() { counts.dragSlide += 1 },
      askGeometry() { counts.askGeometry += 1 },
    }

    assert.throws(() => installDesktop(shell), /transient geometry registration failure/)
    installDesktop(shell)
    installDesktop(shell)
    assert.equal(geometryAttempts, 2)
    assert.equal(counts.dragSlide, 1)
    assert.equal(counts.askGeometry, 1)

    assert.throws(() => startDesktop(), /transient pointerup registration failure/)
    startDesktop()
    startDesktop()
    assert.equal(win.listenerCount('resize'), 1)
    assert.equal(win.listenerCount('pointerup'), 1)
    assert.equal(win.intervals.length, 1)
    assert.equal(win.frames.length, 1)
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
    else delete globalThis.document
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else delete globalThis.window
  }
})

test('pet controller install can retry after a thrown host callback registration', () => {
  const doc = fakeDocument(), win = fakeWindow(), shell = fakeShell()
  const original = shell.shell.onGeometry
  let attempts = 0
  shell.shell.onGeometry = function (...args) {
    attempts += 1
    if (attempts === 1) throw new Error('temporary host callback failure')
    return original.apply(this, args)
  }
  const controller = createPetController({ shell: shell.shell, documentObject: doc, windowObject: win, getHost: () => null })
  assert.throws(() => controller.install(), /temporary host callback failure/)
  controller.install()
  controller.install()
  assert.equal(attempts, 2)
  assert.equal(shell.calls.onDragSlide, 1)
  assert.equal(shell.calls.askGeometry, 1)
  assert.equal(doc.listenerCount('mousemove'), 1)
})
