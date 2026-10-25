// @ts-check
/**
 * 物理舞台的共享「猪的家」保存/读取/重定基（纯函数 + 最小假 DOM）。
 *
 * 回归三类真问题：
 *   - 125% 混合屏上 v3 DIP 工作区 + 相对脚底 与 规范 CSS 脚底 的往返；
 *   - 负原点 200% 屏上同样往返（偏移相对工作区，不是全局 0）；
 *   - 有效 DPR 变化时猪的物理脚底不能跟着 CSS 一起缩放。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { createStageBridge } from '../src/client/stage-bridge.js'
import { layoutBox } from '../src/client/stage-dom.js'
import { resolveStageHome } from '../src/client/stage-home.js'
import {
  desktopPositionForStage, legacyHomeFoot, legacyHomeRect, physicalFootForPig,
  rebaseGeometryFoot, savedHomeFoot, savedHomeRect, savedPigTopLeft,
} from '../src/client/stage-position.js'

const PIG = { width: 56, height: 56 }
const PRIMARY = {
  id: 1, scaleFactor: 1,
  dipWorkArea: { x: 0, y: 0, width: 1280, height: 800 },
  physicalWorkArea: { x: 0, y: 0, width: 1280, height: 800 },
}
const SECONDARY = {
  id: 2, scaleFactor: 1.25,
  dipWorkArea: { x: 1280, y: 0, width: 1024, height: 640 },
  physicalWorkArea: { x: 1280, y: 0, width: 1280, height: 800 },
}

/** 单渲染器 DPR=1、物理并集 2560x800 的 100%+125% 舞台。 */
function mixedGeometry() {
  return {
    window: { x: 0, y: 0, width: 2560, height: 800 },
    workAreas: [{ ...PRIMARY.physicalWorkArea }, { ...SECONDARY.physicalWorkArea }],
    displays: [
      { workArea: { ...PRIMARY.dipWorkArea }, scaleFactor: 1 },
      { workArea: { ...SECONDARY.dipWorkArea }, scaleFactor: 1.25 },
    ],
    space: {
      scale: 1,
      content: { x: 0, y: 0, width: 2560, height: 800 },
      displays: [{ ...PRIMARY }, { ...SECONDARY }],
    },
  }
}

/** 和原生回归同一套：主屏 100% 在右，125% 副屏在左（物理负原点），舞台跨两块。 */
function negativeMixedGeometry(scale) {
  const content = { x: -1280, y: 0, width: 2560, height: 752 }
  const displays = [
    { ...PRIMARY, dipWorkArea: { x: 0, y: 0, width: 1280, height: 752 }, physicalWorkArea: { x: 0, y: 0, width: 1280, height: 752 } },
    { ...SECONDARY, dipWorkArea: { x: -1024, y: 0, width: 1024, height: 592 }, physicalWorkArea: { x: -1280, y: 0, width: 1280, height: 740 } },
  ]
  const div = rect => ({ x: rect.x / scale, y: rect.y / scale, width: rect.width / scale, height: rect.height / scale })
  return {
    window: div(content),
    workAreas: displays.map(display => div(display.physicalWorkArea)),
    displays: displays.map(display => ({ workArea: { ...display.dipWorkArea }, scaleFactor: display.scaleFactor })),
    space: { scale, content, displays },
  }
}

const NATIVE_HOME = { v: 3, area: { x: -1024, y: 0, width: 1024, height: 592 }, x: 670, y: 532 }

test('mixed 125%: v3 save/load keeps the physical foot via the secondary DIP work area', () => {
  const geometry = mixedGeometry()
  // 物理脚底 (1405,625)：落在 125% 副屏，但渲染器 DPR 仍是 1。
  const pig = { x: 1405 - PIG.width / 2, y: 625 - PIG.height, ...PIG }
  const home = desktopPositionForStage(pig, geometry)
  assert.deepEqual(home, {
    v: 3,
    area: { x: 1280, y: 0, width: 1024, height: 640 },
    x: 100,
    y: 500,
  }, 'shared key keeps the original display DIP work area and relative DIP foot')

  assert.deepEqual(savedHomeFoot(home, PIG, geometry), { x: 1405, y: 625 })
  assert.deepEqual(savedHomeRect(home, PIG, geometry), {
    x: 1405 - PIG.width / 2, y: 625 - PIG.height, ...PIG,
  }, 'v3 is already a foot: current CSS pig width must not be treated as a DIP width')
})

test('negative 200%: v3 save/load uses the display work-area origin, not global zero', () => {
  const scale = 1.5
  const display = {
    id: 9, scaleFactor: 2,
    dipWorkArea: { x: -1280, y: 0, width: 1280, height: 800 },
    physicalWorkArea: { x: -2560, y: 0, width: 2560, height: 1600 },
  }
  const geometry = {
    window: { x: -2560 / scale, y: 0, width: 2560 / scale, height: 1600 / scale },
    workAreas: [{ x: -2560 / scale, y: 0, width: 2560 / scale, height: 1600 / scale }],
    displays: [{ workArea: { ...display.dipWorkArea }, scaleFactor: 2 }],
    space: { scale, content: { ...display.physicalWorkArea }, displays: [display] },
  }
  const canonicalFoot = { x: -100 / scale, y: 400 / scale }
  const pig = {
    x: canonicalFoot.x - geometry.window.x - PIG.width / 2,
    y: canonicalFoot.y - geometry.window.y - PIG.height,
    ...PIG,
  }
  const home = desktopPositionForStage(pig, geometry)
  assert.deepEqual(home.area, display.dipWorkArea)
  assert.equal(home.x, 1230, 'relative DIP x: -50 - (-1280)')
  assert.equal(home.y, 200)
  assert.deepEqual(savedHomeFoot(home, PIG, geometry), { x: -100 / scale, y: 400 / scale }, 'savedHomeFoot is the canonical foot; physical = canonical * effective DPR')
  assert.deepEqual({
    x: savedHomeFoot(home, PIG, geometry).x * scale,
    y: savedHomeFoot(home, PIG, geometry).y * scale,
  }, { x: -100, y: 400 })
})

test('old homes: plain geometry unchanged, v2/legacy DIP top-left uses current feet per display scale', () => {
  const plain = { window: { x: -1920, y: -200, width: 1920, height: 1080 } }
  const v3 = { v: 3, area: { x: -1920, y: -200, width: 1920, height: 1080 }, x: 900, y: 600 }
  assert.deepEqual(savedPigTopLeft(v3, PIG), { x: -1048, y: -200 + 600 - 56, width: PIG.width, height: PIG.height })

  const resolved = resolveStageHome({
    homeRaw: v3, pigSize: PIG,
    hostBox: { x: 0, y: 0, width: 320, height: 120 },
    pigBox: { x: 6, y: 24, width: 56, height: 56 },
    geometry: plain, current: null,
  })
  assert.equal(resolved.source, 'home')
  assert.deepEqual(resolved.position, { right: 734, bottom: 440 }, 'no-space resolution is byte-for-byte the old result')

  const geometry = mixedGeometry()
  const v2 = savedHomeFoot({ v: 2, x: 1300, y: 100 }, PIG, geometry)
  // 125% DIP top-left (1300,100) -> physical top-left (1305,125), pig 70x70 physical there.
  assert.deepEqual(v2, { x: 1340, y: 195 }, 'current pig feet are scaled by the display scaleFactor')
  assert.deepEqual(legacyHomeFoot({ x: 1300, y: 100 }, PIG, geometry), v2)
  assert.deepEqual(legacyHomeRect({ x: 1300, y: 100 }, PIG, geometry), {
    x: 1312, y: 139, ...PIG,
  }, 'the old window hint is an original-DIP top-left, converted before becoming a stage rect')
})

test('effective DPR rebase converts the pending foot through physical pixels', () => {
  const before = {
    window: { x: 0, y: 0, width: 1280, height: 800 },
    space: { scale: 1, content: { x: 0, y: 0, width: 1280, height: 800 }, displays: [{ ...PRIMARY }] },
  }
  const after = {
    window: { x: 0, y: 0, width: 1024, height: 640 },
    space: { scale: 1.25, content: { x: 0, y: 0, width: 1280, height: 800 }, displays: [{ ...PRIMARY }] },
  }
  const pig = { x: 1090, y: 620, width: 54, height: 54 }
  const physicalBefore = physicalFootForPig(pig, before)
  assert.deepEqual(physicalBefore, { x: 1117, y: 674 })
  const nextFoot = rebaseGeometryFoot(null, pig, before, after)
  assert.deepEqual(nextFoot, { x: 1117 / 1.25, y: 674 / 1.25 })
  assert.equal(nextFoot.x * 1.25, physicalBefore.x)
  assert.equal(nextFoot.y * 1.25, physicalBefore.y)
})

/** 最小页面环境：viewport 可动态变化，模拟窗口 / 页面缩放后的 innerWidth + DPR。 */
function installPage(viewport, store = new Map()) {
  const originals = {}
  for (const key of ['window', 'document', 'getComputedStyle', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    originals[key] = Object.getOwnPropertyDescriptor(globalThis, key)
  }
  let frameId = 0
  const frames = new Map()
  const listeners = new Map()
  const writes = []
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
  globalThis.MutationObserver = class { observe() {} disconnect() {} }
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
  globalThis.cancelAnimationFrame = id => { frames.delete(id) }
  return {
    store,
    writes,
    resize() { for (const fn of listeners.get('resize') ?? []) fn() },
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

function makeNodes(viewport, position) {
  const properties = new Map()
  const host = {
    get offsetLeft() { return viewport.width - parseFloat(this.style.right) - this.offsetWidth },
    get offsetTop() { return viewport.height - parseFloat(this.style.bottom) - this.offsetHeight },
    offsetWidth: 100, offsetHeight: 100, offsetParent: null,
    style: {
      right: position.right + 'px', bottom: position.bottom + 'px',
      getPropertyValue: key => properties.get(key) ?? '',
      setProperty: (key, value) => { properties.set(key, value) },
      removeProperty: key => { properties.delete(key) },
    },
    getAttribute: () => 'false',
    querySelector: () => null,
    getBoundingClientRect() {
      const left = viewport.width - parseFloat(this.style.right) - this.offsetWidth
      const top = viewport.height - parseFloat(this.style.bottom) - this.offsetHeight
      return { left, top, x: left, y: top, right: left + this.offsetWidth, bottom: top + this.offsetHeight, width: this.offsetWidth, height: this.offsetHeight }
    },
  }
  const pig = { offsetLeft: 10, offsetTop: 20, offsetWidth: 54, offsetHeight: 54, offsetParent: host }
  return { host, pig, properties }
}

test('space v3 home is adopted by the bridge and written back as the same original-DIP foot', () => {
  const viewport = { width: 2560, height: 800, dpr: 1 }
  const page = installPage(viewport)
  const savedHome = {
    v: 3,
    area: { x: 1280, y: 0, width: 1024, height: 640 },
    x: 100,
    y: 500,
  }
  page.store.set('dsh-piggy:desktop-pig', JSON.stringify(savedHome))
  page.store.set('dsh-piggy:position', JSON.stringify({ right: 18, bottom: 18 }))
  let bridge = null
  try {
    const nodes = makeNodes(viewport, { right: 18, bottom: 18 })
    const ctx = { userRight: 18, userBottom: 18 }
    bridge = createStageBridge({
      options: { role: 'stage', geometry: () => mixedGeometry() },
      ctx, host: nodes.host, pig: nodes.pig, bubble: { hidden: true }, card: { hidden: true },
      setOpen() {}, clampPig() {}, fitPanel() {},
    })
    page.flush()
    assert.deepEqual({ right: ctx.userRight, bottom: ctx.userBottom }, { right: 1092, bottom: 149 })
    assert.deepEqual(JSON.parse(page.store.get('dsh-piggy:desktop-pig')), savedHome)
  } finally {
    bridge?.dispose()
    page.restore()
  }
})

test('stage geometry change + DPR 1 -> 1.25 keeps the physical foot instead of scaling the CSS one', () => {
  const viewport = { width: 1280, height: 800, dpr: 1 }
  const page = installPage(viewport)
  let geometry = {
    window: { x: 0, y: 0, width: 1280, height: 800 },
    workAreas: [{ x: 0, y: 0, width: 1280, height: 800 }],
    displays: [{ workArea: { ...PRIMARY.dipWorkArea }, scaleFactor: 1 }],
    space: { scale: 1, content: { x: 0, y: 0, width: 1280, height: 800 }, displays: [{ ...PRIMARY }] },
  }
  let onGeometry = null
  let bridge = null
  try {
    const nodes = makeNodes(viewport, { right: 100, bottom: 100 })
    const ctx = { userRight: 100, userBottom: 100 }
    bridge = createStageBridge({
      options: { role: 'stage', geometry: () => geometry, onGeometry: fn => { onGeometry = fn; return () => {} } },
      ctx, host: nodes.host, pig: nodes.pig, bubble: { hidden: true }, card: { hidden: true },
      setOpen() {}, clampPig() {}, fitPanel() {},
    })
    page.flush()
    const before = physicalFootForPig(layoutBox(nodes.pig), geometry)
    assert.deepEqual(before, { x: 1117, y: 674 })

    viewport.width = 1024
    viewport.height = 640
    viewport.dpr = 1.25
    geometry = {
      window: { x: 0, y: 0, width: 1024, height: 640 },
      workAreas: [{ x: 0, y: 0, width: 1024, height: 640 }],
      displays: [{ workArea: { ...PRIMARY.dipWorkArea }, scaleFactor: 1 }],
      space: { scale: 1.25, content: { x: 0, y: 0, width: 1280, height: 800 }, displays: [{ ...PRIMARY }] },
    }
    onGeometry(geometry)
    page.flush()

    const after = physicalFootForPig(layoutBox(nodes.pig), geometry)
    assert.ok(Math.abs(after.x - before.x) <= 2, `physical x moved ${after.x - before.x}px`)
    assert.ok(Math.abs(after.y - before.y) <= 2, `physical y moved ${after.y - before.y}px`)
    assert.ok(Math.abs(after.x - before.x * 1.25) > 200, 'the old CSS-only path would have scaled the foot by the new DPR')
    const home = JSON.parse(page.store.get('dsh-piggy:desktop-pig'))
    assert.equal(home.v, 3)
    assert.equal(home.area.x, 0)
    assert.equal(home.area.y, 0)
  } finally {
    bridge?.dispose()
    page.restore()
  }
})


test('first geometry/zoom event before the first frame cannot save a default home', () => {
  const start = negativeMixedGeometry(1)
  const zoomed = negativeMixedGeometry(1.25)
  const viewport = { width: start.window.width, height: start.window.height, dpr: 1 }
  const page = installPage(viewport)
  page.store.set('dsh-piggy:desktop-pig', JSON.stringify(NATIVE_HOME))
  page.store.set('dsh-piggy:position', JSON.stringify({ right: 18, bottom: 18 }))
  let geometry = start
  let bridge = null
  try {
    const nodes = makeNodes(viewport, { right: 18, bottom: 18 })
    const ctx = { userRight: 18, userBottom: 18 }
    bridge = createStageBridge({
      options: {
        role: 'stage', geometry: () => geometry,
        onGeometry: () => () => {},
      },
      ctx, host: nodes.host, pig: nodes.pig, bubble: { hidden: true }, card: { hidden: true },
      setOpen() {}, clampPig() {}, fitPanel() {},
    })
    // 页面缩放先改 DPR，几何/视口还没重排：这一拍不能把旧布局算成用户的家。
    viewport.dpr = 1.25
    page.resize()
    page.flush()
    assert.deepEqual(JSON.parse(page.store.get('dsh-piggy:desktop-pig')), NATIVE_HOME,
      'the preferred home is still there before the page reflows')

    // 视口跟上缩放，舞台几何也换成 1.25 的规范窗口。
    geometry = zoomed
    viewport.width = zoomed.window.width
    viewport.height = zoomed.window.height
    page.resize()
    page.flush()

    assert.deepEqual(JSON.parse(page.store.get('dsh-piggy:desktop-pig')), NATIVE_HOME,
      'no default/canonical saveback replaced the preferred home while settling')
    const expected = savedHomeFoot(NATIVE_HOME, PIG, zoomed)
    const foot = physicalFootForPig(layoutBox(nodes.pig), zoomed)
    assert.ok(Math.abs(foot.x - expected.x * 1.25) <= 2, `physical x ${foot.x} vs ${expected.x * 1.25}`)
    assert.ok(Math.abs(foot.y - expected.y * 1.25) <= 2, `physical y ${foot.y} vs ${expected.y * 1.25}`)
    const homes = page.writes.filter(([key]) => key === 'dsh-piggy:desktop-pig').map(([, value]) => JSON.parse(value))
    assert.ok(homes.every(home => JSON.stringify(home) === JSON.stringify(NATIVE_HOME)),
      'every home write during mount must be the preferred home')
  } finally {
    bridge?.dispose()
    page.restore()
  }
})

test('pending geometry cannot land before the saved home and a measured pig box', () => {
  const start = negativeMixedGeometry(1)
  const zoomed = negativeMixedGeometry(1.25)
  const viewport = { width: start.window.width, height: start.window.height, dpr: 1 }
  const page = installPage(viewport)
  page.store.set('dsh-piggy:desktop-pig', JSON.stringify(NATIVE_HOME))
  page.store.set('dsh-piggy:position', JSON.stringify({ right: 18, bottom: 18 }))
  let geometry = start
  let bridge = null
  try {
    const nodes = makeNodes(viewport, { right: 18, bottom: 18 })
    nodes.pig.offsetWidth = 0
    nodes.pig.offsetHeight = 0
    const ctx = { userRight: 18, userBottom: 18 }
    bridge = createStageBridge({
      options: {
        role: 'stage', geometry: () => geometry,
        onGeometry: fn => { fn(geometry); return () => {} },
      },
      ctx, host: nodes.host, pig: nodes.pig, bubble: { hidden: true }, card: { hidden: true },
      setOpen() {}, clampPig() {}, fitPanel() {},
    })
    // 页面还没量到猪，缩放先把几何和视口推到 1.25。onResize 会生成一个默认脚底 pending。
    viewport.width = zoomed.window.width
    viewport.height = zoomed.window.height
    viewport.dpr = 1.25
    page.resize()
    page.flush()
    assert.deepEqual(JSON.parse(page.store.get('dsh-piggy:desktop-pig')), NATIVE_HOME,
      'an unmeasured first frame must not write the pending/default foot')

    // 猪盒可量之后，下一次布局才允许采纳共享家。
    nodes.pig.offsetWidth = 54
    nodes.pig.offsetHeight = 54
    page.resize()
    page.flush()

    assert.deepEqual(JSON.parse(page.store.get('dsh-piggy:desktop-pig')), NATIVE_HOME)
    const expected = savedHomeFoot(NATIVE_HOME, PIG, zoomed)
    const foot = physicalFootForPig(layoutBox(nodes.pig), zoomed)
    assert.ok(Math.abs(foot.x - expected.x * 1.25) <= 2, `physical x ${foot.x} vs ${expected.x * 1.25}`)
    assert.ok(Math.abs(foot.y - expected.y * 1.25) <= 2, `physical y ${foot.y} vs ${expected.y * 1.25}`)
    const homes = page.writes.filter(([key]) => key === 'dsh-piggy:desktop-pig').map(([, value]) => JSON.parse(value))
    assert.ok(homes.every(home => JSON.stringify(home) === JSON.stringify(NATIVE_HOME)),
      'pending/default geometry never becomes the saved home')
  } finally {
    bridge?.dispose()
    page.restore()
  }
})
