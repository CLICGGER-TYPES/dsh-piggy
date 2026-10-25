// @ts-check
/**
 * 托盘恢复：500% / 屏幕外的坏状态 -> 本机尺寸回 100%、家回主屏安全位置。
 * 纯几何 + 最小假 DOM；不启 Electron，也不改存档/玩法。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { createStageBridge } from '../src/client/stage-bridge.js'
import { layoutBox } from '../src/client/stage-dom.js'
import { bodyVisualBounds } from '../src/client/desktop/visual-bounds.js'
import { PAD } from '../src/client/desktop/geometry.js'
import { createPlacement } from '../src/client/desktop/place.js'
import { bindRecovery, defaultPigBox, recoveryHome } from '../src/client/recover.js'
import { physicalFootForPig, savedHomeFoot } from '../src/client/stage-position.js'

const HOME_KEY = 'dsh-piggy:desktop-pig'
const POSITION_KEY = 'dsh-piggy:position'
const AREA = { x: -1024, y: 0, width: 1280, height: 800 }

function installStorage(store) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const local = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, value) },
  }
  globalThis.window = { localStorage: local }
  globalThis.localStorage = local
  return function restore() {
    for (const [key, descriptor] of [['window', originalWindow], ['localStorage', originalLocal]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
}

test('recovery home keeps the wide drawing envelope inside the primary work area with the default margin', () => {
  const size = { width: 56, height: 56 }
  const home = recoveryHome({ pigSize: size, workArea: AREA })
  assert.equal(home.v, 3)
  assert.deepEqual(home.area, AREA)
  assert.ok(home.x > 0 && home.x < AREA.width, `relative x ${home.x}`)
  assert.ok(home.y > 0 && home.y < AREA.height, `relative y ${home.y}`)
  const visual = bodyVisualBounds({ x: 0, y: 0, ...size })
  const right = home.foot.x + (visual.x + visual.width - size.width / 2)
  const bottom = home.foot.y + (visual.y + visual.height - size.height)
  assert.ok(right <= AREA.x + AREA.width - PAD + 1, `drawing right ${right}`)
  assert.ok(bottom <= AREA.y + AREA.height - PAD + 1, `drawing bottom ${bottom}`)
  assert.ok(right >= AREA.x + AREA.width - PAD - 2, 'the safe spot uses the lower-right default margin')
  assert.ok(bottom >= AREA.y + AREA.height - PAD - 2)
})

test('a 500% broken local state is recovered once, while unrelated preferences stay untouched', () => {
  const store = new Map([
    ['dsh-piggy:pig-size', 'scale:5'],
    ['dsh-piggy:bubble-size', 'scale:2'],
    ['dsh-piggy:sound', '{"enabled":false}'],
    ['dsh-piggy:fullscreen', '"show"'],
    [POSITION_KEY, JSON.stringify({ right: 5200, bottom: 4300 })],
    [HOME_KEY, JSON.stringify({ v: 3, area: { ...AREA }, x: 99999, y: 99999 })],
  ])
  const restore = installStorage(store)
  const listeners = new Set()
  const applied = []
  const properties = new Map()
  const host = { style: { setProperty: (key, value) => properties.set(key, value) } }
  const pig = { offsetWidth: 280, offsetHeight: 280 }
  const shell = {
    onRecover(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  }
  try {
    const stop = bindRecovery({
      role: 'pet', shell, host, pig,
      getStageSize: () => ({ size: 56 }),
      apply: home => applied.push(home),
    })
    assert.equal(typeof stop, 'function')
    for (const callback of listeners) callback({ workArea: { ...AREA } })

    assert.equal(store.get('dsh-piggy:pig-size'), 'scale:1', 'the device-local display size returns to 100%')
    assert.equal(properties.get('--pig-size'), '56px')
    assert.equal(applied.length, 1)
    assert.equal(applied[0].area.x, AREA.x)
    assert.ok(applied[0].foot.x < AREA.x + AREA.width && applied[0].foot.y < AREA.y + AREA.height)
    assert.equal(store.get('dsh-piggy:bubble-size'), 'scale:2')
    assert.equal(store.get('dsh-piggy:sound'), '{"enabled":false}')
    assert.equal(store.get('dsh-piggy:fullscreen'), '"show"')
    assert.equal(store.get(POSITION_KEY), JSON.stringify({ right: 5200, bottom: 4300 }), 'split position is not a web-layout save')
    assert.equal(store.get(HOME_KEY), JSON.stringify({ v: 3, area: { ...AREA }, x: 99999, y: 99999 }), 'the adapter, not the helper, writes the recovered home')

    for (const callback of listeners) callback({ workArea: { x: 0, y: 0, width: 0, height: 800 } })
    assert.equal(applied.length, 1, 'an invalid work area never resets the pig')

    stop()
    for (const callback of listeners) callback({ workArea: { ...AREA } })
    assert.equal(applied.length, 1, 'dispose removes the recovery listener')
  } finally { restore() }
})

test('default 100% size is derived from the current scale and stage size', () => {
  assert.deepEqual(defaultPigBox({ width: 280, height: 280 }, 5, 56), { width: 56, height: 56 })
  assert.deepEqual(defaultPigBox({ width: 84, height: 84 }, 1.5, 0), { width: 56, height: 56 })
  assert.deepEqual(defaultPigBox({ width: 0, height: 0 }, 5, 0), { width: 56, height: 56 })
})

test('old shells and non-pet roles are a no-op: recovery is an optional new shell method', () => {
  const restore = installStorage(new Map())
  try {
    assert.doesNotThrow(() => bindRecovery({ role: 'pet', shell: {}, getStageSize: () => ({ size: 56 }) })())
    let called = false
    const shell = { onRecover() { called = true; return () => {} } }
    const stop = bindRecovery({ role: 'panel', shell })
    stop()
    assert.equal(called, false, 'panel and ext pages never bind recovery')
  } finally { restore() }
})

test('split placement accepts the recovered foot as the new home and persists the shared v3 home', () => {
  const store = new Map()
  const restore = installStorage(store)
  try {
    const home = recoveryHome({ pigSize: { width: 56, height: 56 }, workArea: AREA })
    const placement = createPlacement()
    placement.recover(home.foot, [AREA])
    assert.deepEqual(placement.home(), home.foot)
    assert.deepEqual(JSON.parse(store.get(HOME_KEY)), {
      v: 3, area: { ...AREA }, x: home.x, y: home.y,
    })
  } finally { restore() }
})

/** 125% 主屏、物理负原点的舞台几何（和物理家回归同一套）。 */
function negative125Geometry() {
  const scale = 1.25
  const display = {
    id: 2, scaleFactor: scale,
    dipWorkArea: { x: -1024, y: 0, width: 1024, height: 592 },
    physicalWorkArea: { x: -1280, y: 0, width: 1280, height: 740 },
  }
  return {
    window: { x: -1280 / scale, y: 0, width: 1280 / scale, height: 740 / scale },
    workAreas: [{ x: -1280 / scale, y: 0, width: 1280 / scale, height: 740 / scale }],
    displays: [{ workArea: { ...display.dipWorkArea }, scaleFactor: scale }],
    space: { scale, content: { ...display.physicalWorkArea }, displays: [display] },
  }
}

function makeStyle() {
  const properties = new Map()
  return {
    right: '18px', bottom: '18px', left: 'auto', top: 'auto', translate: '',
    setProperty(name, value) { properties.set(name, String(value)) },
    getPropertyValue(name) { return properties.get(name) ?? this[name] ?? '' },
    removeProperty(name) { properties.delete(name) },
  }
}

function makeNodes(viewport, pigSize = 56) {
  const host = {
    offsetParent: null,
    style: makeStyle(),
    get offsetWidth() { return this.pig.offsetWidth + 12 },
    get offsetHeight() { return this.pig.offsetHeight + 12 },
    get offsetLeft() { return viewport.width - Number.parseFloat(this.style.right) - this.offsetWidth },
    get offsetTop() { return viewport.height - Number.parseFloat(this.style.bottom) - this.offsetHeight },
    getAttribute: () => 'false',
    querySelector: () => null,
    getBoundingClientRect() {
      return { left: this.offsetLeft, top: this.offsetTop, right: this.offsetLeft + this.offsetWidth, bottom: this.offsetTop + this.offsetHeight,
        width: this.offsetWidth, height: this.offsetHeight }
    },
  }
  const pig = {
    offsetParent: host, offsetWidth: pigSize, offsetHeight: pigSize, style: makeStyle(),
    get offsetLeft() { return host.offsetWidth - 6 - this.offsetWidth },
    get offsetTop() { return host.offsetHeight - 12 - this.offsetHeight },
  }
  host.pig = pig
  return { host, pig }
}

function installPage(viewport, store) {
  const originals = {}
  for (const key of ['window', 'document', 'getComputedStyle', 'MutationObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    originals[key] = Object.getOwnPropertyDescriptor(globalThis, key)
  }
  let frameId = 0
  const frames = new Map()
  const writes = []
  globalThis.window = {
    get innerWidth() { return viewport.width },
    get innerHeight() { return viewport.height },
    get devicePixelRatio() { return viewport.dpr ?? 1 },
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { writes.push([key, value]); store.set(key, value) },
    },
    addEventListener() {}, removeEventListener() {},
  }
  globalThis.document = { body: {}, activeElement: null }
  globalThis.getComputedStyle = node => node.style
  globalThis.MutationObserver = class { observe() {} disconnect() {} }
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
  globalThis.cancelAnimationFrame = id => { frames.delete(id) }
  return {
    writes,
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

test('stage recovery respects the physical display pairs and clears stale flight anchors', () => {
  const geometry = negative125Geometry()
  const viewport = { width: geometry.window.width, height: geometry.window.height, dpr: 1.25 }
  const store = new Map([
    [HOME_KEY, JSON.stringify({ v: 3, area: { x: -1024, y: 0, width: 1024, height: 592 }, x: 9999, y: 9999 })],
    [POSITION_KEY, JSON.stringify({ right: 9999, bottom: 9999 })],
  ])
  const page = installPage(viewport, store)
  const nodes = makeNodes(viewport, 56)
  const ctx = { userRight: 9999, userBottom: 9999 }
  const bridge = createStageBridge({
    options: { role: 'stage', geometry: () => geometry },
    ctx, host: nodes.host, pig: nodes.pig, bubble: { hidden: true }, card: { hidden: true },
    setOpen() {}, clampPig() {}, fitPanel() {},
  })
  try {
    page.flush()
    bridge.feelShell().flight.start()
    assert.equal(bridge.isFlying(), true)
    nodes.host.style.translate = '8px 8px'

    const home = recoveryHome({ pigSize: { width: 56, height: 56 }, workArea: geometry.displays[0].workArea })
    bridge.recover(home)
    page.flush()

    const homeRecord = { v: 3, area: home.area, x: home.x, y: home.y }
    const canonical = savedHomeFoot(homeRecord, { width: 56, height: 56 }, geometry)
    const expected = { x: canonical.x * geometry.space.scale, y: canonical.y * geometry.space.scale }
    const actual = physicalFootForPig(layoutBox(nodes.pig), geometry)
    assert.ok(Math.abs(actual.x - expected.x) <= 2, `physical x ${actual.x} vs ${expected.x}`)
    assert.ok(Math.abs(actual.y - expected.y) <= 2, `physical y ${actual.y} vs ${expected.y}`)
    assert.equal(bridge.isFlying(), false, 'a stale flight can no longer pin the recovered pig')
    assert.equal(nodes.host.style.translate, '', 'teleport/slide translation is cleared')
    assert.deepEqual(JSON.parse(store.get(HOME_KEY)), homeRecord, 'the v3 DIP home is kept byte-for-byte')
    assert.notEqual(JSON.parse(store.get(POSITION_KEY)).right, 9999, 'right/bottom no longer point at the offscreen state')

    nodes.pig.offsetWidth = 66
    nodes.pig.offsetHeight = 66
    bridge.syncGeometry()
    page.flush()
    const afterResize = physicalFootForPig(layoutBox(nodes.pig), geometry)
    assert.ok(Math.abs(afterResize.x - expected.x) <= 2 && Math.abs(afterResize.y - expected.y) <= 2,
      'a later user resize keeps working and does not reset back to the recovery step')
    assert.deepEqual(JSON.parse(store.get(HOME_KEY)), homeRecord)
  } finally {
    bridge.dispose()
    page.restore()
  }
})
