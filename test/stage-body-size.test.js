// @ts-check
/**
 * 舞台：先按默认 --pig-size 采纳共享的家，之后立绘/身体尺寸（或宿主内边距）
 * 才变成实际值。host 锚在 right/bottom 上，猪自己的宽度一变，脚底就会横向漂移。
 *
 * 回归：
 *   - 变大、变小都要把物理脚底留在原处，共享家原样不动；
 *   - 用户拖过之后，新的位置归用户，尺寸变化不能把他拉回旧家；
 *   - 抛掷只挪 host，落地后不能被「家」钉回去；
 *   - 只有 transform 的手感动画不能触发锚点改写。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { createStageBridge } from '../src/client/stage-bridge.js'
import { layoutBox } from '../src/client/stage-dom.js'
import { physicalFootForPig, savedHomeFoot } from '../src/client/stage-position.js'

const HOME_KEY = 'dsh-piggy:desktop-pig'
const POSITION_KEY = 'dsh-piggy:position'
const HOME = { v: 3, area: { x: -1024, y: 0, width: 1024, height: 592 }, x: 658, y: 556 }
const SCALE = 1.25

/** 125% 屏、物理负原点：规范窗口 -1024..0，脚底物理 x = -457.5。 */
function negative125Geometry() {
  const display = {
    id: 2, scaleFactor: SCALE,
    dipWorkArea: { x: -1024, y: 0, width: 1024, height: 592 },
    physicalWorkArea: { x: -1280, y: 0, width: 1280, height: 740 },
  }
  const content = { ...display.physicalWorkArea }
  return {
    window: { x: content.x / SCALE, y: 0, width: content.width / SCALE, height: content.height / SCALE },
    workAreas: [{ x: content.x / SCALE, y: 0, width: content.width / SCALE, height: content.height / SCALE }],
    displays: [{ workArea: { ...display.dipWorkArea }, scaleFactor: display.scaleFactor }],
    space: { scale: SCALE, content, displays: [display] },
  }
}

function physicalFoot(pig, geometry) {
  return physicalFootForPig(layoutBox(pig), geometry)
}

function expectedPhysicalFoot(geometry) {
  const foot = savedHomeFoot(HOME, { width: 56, height: 56 }, geometry)
  return { x: foot.x * SCALE, y: foot.y * SCALE }
}

function assertNear(actual, expected, message) {
  assert.ok(Math.abs(actual.x - expected.x) <= 2, `${message}: x ${actual.x} vs ${expected.x}`)
  assert.ok(Math.abs(actual.y - expected.y) <= 2, `${message}: y ${actual.y} vs ${expected.y}`)
}

/** viewport / 全局假 DOM：可以主动推 MutationObserver / ResizeObserver。 */
function installPage(viewport, store = new Map()) {
  const originals = {}
  for (const key of ['window', 'document', 'getComputedStyle', 'MutationObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    originals[key] = Object.getOwnPropertyDescriptor(globalThis, key)
  }
  let frameId = 0
  const frames = new Map()
  const listeners = new Map()
  const writes = []
  const observers = []
  class FakeObserver {
    constructor(callback) { this.callback = callback; this.nodes = []; observers.push(this) }
    observe(node) { this.nodes.push(node) }
    disconnect() { this.nodes = [] }
  }
  globalThis.window = {
    get innerWidth() { return viewport.width },
    get innerHeight() { return viewport.height },
    get devicePixelRatio() { return viewport.dpr ?? 1 },
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { writes.push([key, value]); store.set(key, value) },
    },
    addEventListener(type, fn) { listeners.set(type, [...(listeners.get(type) ?? []), fn]) },
    removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) ?? []).filter(next => next !== fn)) },
  }
  globalThis.document = { body: {}, activeElement: null }
  globalThis.getComputedStyle = node => node.style
  globalThis.MutationObserver = FakeObserver
  globalThis.ResizeObserver = FakeObserver
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
  globalThis.cancelAnimationFrame = id => { frames.delete(id) }
  return {
    store,
    writes,
    notify() { for (const observer of observers) observer.callback([], observer) },
    flush() {
      for (let round = 0; round < 20 && frames.size > 0; round += 1) {
        const pending = [...frames.values()]
        frames.clear()
        for (const fn of pending) fn()
      }
      frames.clear()
    },
    restore() {
      for (const [key, descriptor] of Object.entries(originals)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    },
  }
}

function makeStyle() {
  const properties = new Map()
  return {
    right: '18px', bottom: '18px', left: 'auto', top: 'auto', translate: '',
    setProperty(name, value) {
      if (name.startsWith('--')) properties.set(name, String(value))
      else this[name] = String(value)
    },
    getPropertyValue(name) { return properties.get(name) ?? this[name] ?? '' },
    removeProperty(name) { properties.delete(name) },
  }
}

/** host 钉在 fixed right/bottom；猪在 scene 里右对齐，scene 宽 = 猪宽 + 左右 6px 内边距。 */
function makeNodes(viewport, pigSize = 56) {
  const host = {
    offsetParent: null,
    style: makeStyle(),
    get offsetWidth() { return this.pig.offsetWidth + 12 },
    get offsetHeight() { return this.pig.offsetHeight + 12 },
    get offsetLeft() {
      if (this.style.left !== 'auto') return Number.parseFloat(this.style.left)
      return viewport.width - Number.parseFloat(this.style.right) - this.offsetWidth
    },
    get offsetTop() {
      if (this.style.top !== 'auto') return Number.parseFloat(this.style.top)
      return viewport.height - Number.parseFloat(this.style.bottom) - this.offsetHeight
    },
    getAttribute: () => 'false',
    querySelector: () => null,
    getBoundingClientRect() {
      const left = this.offsetLeft
      const top = this.offsetTop
      return { left, top, x: left, y: top, right: left + this.offsetWidth, bottom: top + this.offsetHeight, width: this.offsetWidth, height: this.offsetHeight }
    },
  }
  const pig = {
    offsetParent: host,
    offsetWidth: pigSize,
    offsetHeight: pigSize,
    style: makeStyle(),
    get offsetLeft() { return host.offsetWidth - 6 - this.offsetWidth },
    get offsetTop() { return host.offsetHeight - 12 - this.offsetHeight },
  }
  host.pig = pig
  return { host, pig }
}

function mountStage(pigSize = 56) {
  const geometry = negative125Geometry()
  const viewport = { width: geometry.window.width, height: geometry.window.height, dpr: SCALE }
  const page = installPage(viewport)
  page.store.set(HOME_KEY, JSON.stringify(HOME))
  page.store.set(POSITION_KEY, JSON.stringify({ right: 18, bottom: 18 }))
  const nodes = makeNodes(viewport, pigSize)
  const ctx = { userRight: 18, userBottom: 18 }
  const bridge = createStageBridge({
    options: { role: 'stage', geometry: () => geometry },
    ctx, host: nodes.host, pig: nodes.pig, bubble: { hidden: true }, card: { hidden: true },
    setOpen() {}, clampPig() {}, fitPanel() {},
  })
  page.flush()
  return { page, nodes, ctx, bridge, geometry }
}

function resizePig(run, width, height = width, trigger = 'observer') {
  run.nodes.pig.offsetWidth = width
  run.nodes.pig.offsetHeight = height
  if (trigger === 'sync') run.bridge.syncGeometry()
  else run.page.notify()
  run.page.flush()
}

test('body grows after the default-size home is adopted: the reported 56 -> 66 shift keeps the foot and the home', () => {
  const run = mountStage(56)
  try {
    const expected = expectedPhysicalFoot(run.geometry)
    assertNear(physicalFoot(run.nodes.pig, run.geometry), expected, 'adopted at 56')
    assert.deepEqual(JSON.parse(run.page.store.get(HOME_KEY)), HOME, 'home adopted byte-for-byte')

    // 56 -> 66 moves the right-aligned centre 5 CSS px = 6.25 physical px left
    // when only right/bottom are kept.
    resizePig(run, 66)

    assertNear(physicalFoot(run.nodes.pig, run.geometry), expected, 'foot after growing to 66')
    assert.deepEqual(JSON.parse(run.page.store.get(HOME_KEY)), HOME, 'no home format migration on body growth')
    const homes = run.page.writes.filter(([key]) => key === HOME_KEY).map(([, value]) => JSON.parse(value))
    assert.ok(homes.every(home => JSON.stringify(home) === JSON.stringify(HOME)),
      'every home write stays the original v3 home')
  } finally {
    run.bridge.dispose()
    run.page.restore()
  }
})

test('body shrinks after a larger home is adopted: the foot does not slide the other way', () => {
  const run = mountStage(68)
  try {
    const expected = expectedPhysicalFoot(run.geometry)
    assertNear(physicalFoot(run.nodes.pig, run.geometry), expected, 'adopted at 68')

    resizePig(run, 56, 56, 'sync')

    assertNear(physicalFoot(run.nodes.pig, run.geometry), expected, 'foot after shrinking to 56')
    assert.deepEqual(JSON.parse(run.page.store.get(HOME_KEY)), HOME, 'home still untouched')
  } finally {
    run.bridge.dispose()
    run.page.restore()
  }
})

test('a real user reposition owns the new foot; a later body change keeps the dragged position, not the old home', () => {
  const run = mountStage(56)
  try {
    run.ctx.userRight = 400
    run.ctx.userBottom = 80
    run.bridge.setPosition(400, 80)
    run.page.flush()
    const dragged = physicalFoot(run.nodes.pig, run.geometry)
    const draggedHome = JSON.parse(run.page.store.get(HOME_KEY))
    assert.notDeepEqual(draggedHome, HOME, 'setPosition wrote the user’s new home')
    assert.ok(Math.abs(dragged.x - (-457.5)) > 50, 'the drag really changed the foot')

    resizePig(run, 68)

    assertNear(physicalFoot(run.nodes.pig, run.geometry), dragged, 'foot stays at the dragged position')
    assert.deepEqual(JSON.parse(run.page.store.get(HOME_KEY)), draggedHome, 'old home did not come back')
  } finally {
    run.bridge.dispose()
    run.page.restore()
  }
})

test('flight moves the host; landing keeps the new foot instead of snapping back to the saved home', () => {
  const run = mountStage(56)
  try {
    const flight = run.bridge.feelShell().flight
    const start = flight.start()
    assert.ok(start !== null)
    flight.move(-924, 100)
    run.page.flush()
    flight.finish({ window: { x: -924, y: 100, width: 68, height: 68 }, slide: { x: 0, y: 0 } })
    run.page.flush()

    const expected = { x: (-924 + 68 - 6 - 28) * SCALE, y: 156 * SCALE }
    assertNear(physicalFoot(run.nodes.pig, run.geometry), expected, 'landed foot')
    assert.ok(Math.abs(physicalFoot(run.nodes.pig, run.geometry).x - (-457.5)) > 100, 'not the old home foot')
    assert.deepEqual(JSON.parse(run.page.store.get(HOME_KEY)), {
      v: 3,
      area: { x: -1024, y: 0, width: 1024, height: 592 },
      x: 134,
      y: 156,
    }, 'landing saved the new foot, not the old home')
  } finally {
    run.bridge.dispose()
    run.page.restore()
  }
})

test('transform-only feel/breathing never rewrites the anchor', () => {
  const run = mountStage(56)
  try {
    const beforeWrites = run.page.writes.length
    const before = { right: run.ctx.userRight, bottom: run.ctx.userBottom }
    run.nodes.pig.style.transform = 'scale(1.04) translateY(-3px)'
    run.page.notify()
    run.page.flush()

    assert.deepEqual({ right: run.ctx.userRight, bottom: run.ctx.userBottom }, before)
    assert.equal(run.page.writes.length, beforeWrites, 'transform-only animation wrote nothing')
  } finally {
    run.bridge.dispose()
    run.page.restore()
  }
})
