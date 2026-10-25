// @ts-check
/**
 * 整屏舞台只读审计（qa-audit）三项可复现缺陷的回归，全部纯逻辑，不启 Electron：
 *
 *   F1 split -> stage 的位置偏好只单向同步（共享的猪的家每次挂载都对齐）
 *   F2 舞台气泡尺寸上限取整窗并集，而不是猪所在那块屏的工作区
 *   F5 舞台形状没给爆点粒子（.dp-fx）留绘制余量，Linux setShape 把粒子裁掉
 *
 * DOM 用最小假实现（和 desktop-stage-bridge.test.js 同一手法）；几何、气泡、
 * 效果数字都从现有模块/源码读，不另造一套常量。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { BUBBLE_SIZE_KEY, applyBubbleSize, limitBubbleSize, setStageAreaProvider } from '../../../src/client/bubble-size.js'
import { fitSpeechPlacement } from '../../../src/client/bubble-fit.js'
import { createStageBridge } from '../../../src/client/stage-bridge.js'
import { collectStageShape, FX_BOTTOM, FX_SIDE, FX_TOP, PIG_TOP, pigLayoutBox } from '../stage/overlay-shape.js'

const POSITION_KEY = 'dsh-piggy:position'
const HOME_KEY = 'dsh-piggy:desktop-pig'
const WIN = { x: 0, y: 0, width: 1280, height: 800 }
const PIG = 54

/** 最小页面环境：localStorage、假 DOM、可控的 rAF。 */
function installPage({ innerWidth = WIN.width, innerHeight = WIN.height, store = new Map() } = {}) {
  const originals = {}
  for (const key of ['window', 'document', 'getComputedStyle', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    originals[key] = Object.getOwnPropertyDescriptor(globalThis, key)
  }
  let frameId = 0
  const frames = new Map()
  globalThis.window = {
    innerWidth, innerHeight,
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, value) },
    },
    addEventListener() {}, removeEventListener() {},
  }
  globalThis.document = { body: {}, activeElement: null }
  globalThis.getComputedStyle = node => node.style
  globalThis.MutationObserver = class { observe() {} disconnect() {} }
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
  globalThis.cancelAnimationFrame = id => { frames.delete(id) }
  return {
    store,
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

/** 猪在 host 里的布局：pig 偏移 (10,20)、54x54，host 100x100 钉在 right/bottom；style 支持 CSS 变量。 */
function makeNodes(win, position) {
  const properties = new Map()
  const host = {
    get offsetLeft() { return win.width - Number.parseFloat(this.style.right) - this.offsetWidth },
    get offsetTop() { return win.height - Number.parseFloat(this.style.bottom) - this.offsetHeight },
    offsetWidth: 100,
    offsetHeight: 100,
    offsetParent: null,
    style: {
      right: position.right + 'px',
      bottom: position.bottom + 'px',
      getPropertyValue: key => properties.get(key) ?? '',
      setProperty: (key, value) => { properties.set(key, value) },
    },
    getAttribute: () => 'false',
    querySelector: () => null,
    getBoundingClientRect() {
      const left = win.width - Number.parseFloat(this.style.right) - this.offsetWidth
      const top = win.height - Number.parseFloat(this.style.bottom) - this.offsetHeight
      return { left, top, x: left, y: top, right: left + this.offsetWidth, bottom: top + this.offsetHeight, width: this.offsetWidth, height: this.offsetHeight }
    },
  }
  const pig = { offsetLeft: 10, offsetTop: 20, offsetWidth: PIG, offsetHeight: PIG, offsetParent: host }
  return { host, pig, properties }
}

function makeBridge(geometry, ctx, nodes) {
  return createStageBridge({
    options: { role: 'stage', geometry: () => geometry },
    ctx, host: nodes.host, pig: nodes.pig,
    bubble: { hidden: true }, card: { hidden: true },
    setOpen() {}, clampPig() {}, fitPanel() {},
  })
}

function stageGeometry(win = WIN, extra = {}) {
  return { window: { ...win }, workAreas: [{ ...win }], displays: [{ workArea: { ...win }, scaleFactor: 1 }], seq: 1, ...extra }
}

// ---------------------------------------------------------------- F1

test('F1: a pig moved in split is adopted by the next stage session, and a later stage write keeps that home', () => {
  const page = installPage()
  try {
    // ---- first stage session: web default position, then the user drags the pig
    page.store.set(POSITION_KEY, JSON.stringify({ right: 18, bottom: 18 }))
    const nodes1 = makeNodes(WIN, { right: 18, bottom: 18 })
    const ctx1 = { userRight: 18, userBottom: 18 }
    const bridge1 = makeBridge(stageGeometry(), ctx1, nodes1)
    page.flush()
    bridge1.setPosition(300, 200)
    page.flush()
    assert.deepEqual(JSON.parse(page.store.get(HOME_KEY)), {
      v: 3, area: { ...WIN }, x: 917, y: 574,
    }, 'the stage keeps the shared home in sync with its own position')
    bridge1.dispose()

    // ---- the same device later runs the default split entry and moves the pig there
    const splitHome = { v: 3, area: { ...WIN }, x: 100, y: 300 }
    page.store.set(HOME_KEY, JSON.stringify(splitHome))
    const splitFoot = { x: splitHome.area.x + splitHome.x, y: splitHome.area.y + splitHome.y }

    // ---- second stage session: same POSITION_KEY, newer shared home
    const restored = JSON.parse(page.store.get(POSITION_KEY))
    const nodes2 = makeNodes(WIN, restored)
    const ctx2 = { userRight: restored.right, userBottom: restored.bottom }
    const bridge2 = makeBridge(stageGeometry(), ctx2, nodes2)
    page.flush()
    assert.deepEqual({ right: ctx2.userRight, bottom: ctx2.userBottom }, { right: 1117, bottom: 474 },
      'the stage adopts the split home instead of the older stage position')
    const adopted = JSON.parse(page.store.get(HOME_KEY))
    assert.equal(adopted.area.x + adopted.x, splitFoot.x, 'adopting keeps the split foot')
    assert.equal(adopted.area.y + adopted.y, splitFoot.y)
    bridge2.dispose()

    // ---- third session (restart): same home, no drift, no bounce back
    const ctx3 = { userRight: ctx2.userRight, userBottom: ctx2.userBottom }
    const bridge3 = makeBridge(stageGeometry(), ctx3, makeNodes(WIN, { right: ctx3.userRight, bottom: ctx3.userBottom }))
    page.flush()
    assert.deepEqual({ right: ctx3.userRight, bottom: ctx3.userBottom }, { right: 1117, bottom: 474 },
      'a consistent home is not applied again (would drift by a pixel each start)')
    assert.deepEqual(JSON.parse(page.store.get(POSITION_KEY)), { right: 1117, bottom: 474 })
    bridge3.dispose()
  } finally { page.restore() }
})

test('F1: without a shared home the legacy window position is migrated once, not on every geometry update', () => {
  const page = installPage()
  try {
    const geometry = stageGeometry(WIN, { legacyPig: { x: 200, y: 200 } })
    page.store.set(POSITION_KEY, JSON.stringify({ right: 18, bottom: 18 }))
    const ctx1 = { userRight: 18, userBottom: 18 }
    const bridge1 = makeBridge(geometry, ctx1, makeNodes(WIN, { right: 18, bottom: 18 }))
    page.flush()
    assert.notDeepEqual({ right: ctx1.userRight, bottom: ctx1.userBottom }, { right: 18, bottom: 18 },
      'the legacy window position still migrates')
    const home = JSON.parse(page.store.get(HOME_KEY))
    assert.equal(home.area.x + home.x, 200 + PIG / 2, 'legacy is a pig top-left, so the home foot is 200,200 + half a pig')
    assert.equal(home.area.y + home.y, 200 + PIG)
    bridge1.setPosition(80, 100)
    page.flush()
    bridge1.dispose()

    // A stale legacy point must not be re-applied over the stage's own position.
    const stale = stageGeometry(WIN, { legacyPig: { x: 900, y: 700 } })
    const ctx2 = { userRight: 80, userBottom: 100 }
    const bridge2 = makeBridge(stale, ctx2, makeNodes(WIN, { right: 80, bottom: 100 }))
    page.flush()
    assert.deepEqual({ right: ctx2.userRight, bottom: ctx2.userBottom }, { right: 80, bottom: 100 },
      'the shared home wins over the legacy file')
    bridge2.dispose()
  } finally { page.restore() }
})

// ---------------------------------------------------------------- F2

const TOP = { x: 0, y: 0, width: 1920, height: 1040 }
const BOTTOM = { x: 0, y: 1040, width: 1920, height: 1040 }
/** Stacked displays: the stage window is the union, the pig stands on one display. */
const UNION = { x: 0, y: 0, width: 1920, height: 2080 }

test('F2: the stage caps speech size by the pig display, the same cap split uses', () => {
  const page = installPage({ innerWidth: UNION.width, innerHeight: UNION.height })
  try {
    page.store.set(BUBBLE_SIZE_KEY, '6')
    const geometry = { ...stageGeometry(UNION), workAreas: [{ ...TOP }, { ...BOTTOM }] }
    // right/bottom 100 put the pig (offset 10,20 in a 100x100 host) on the lower display.
    const nodes = makeNodes(UNION, { right: 100, bottom: 100 })
    const pigBox = { x: UNION.width - 100 - 100 + 10, y: UNION.height - 100 - 100 + 20, width: PIG, height: PIG }
    assert.ok(pigBox.y > BOTTOM.y, 'precondition: the pig stands on the lower display')
    const ctx = { userRight: 100, userBottom: 100 }
    const bridge = makeBridge(geometry, ctx, nodes)
    page.flush()

    const splitCap = limitBubbleSize(6, BOTTOM)
    const unionCap = limitBubbleSize(6, UNION)
    const applied = Number(nodes.properties.get('--bubble-scale'))
    assert.equal(applied, splitCap, 'stage cap equals the cap split computes from shell.geometry().workArea')
    assert.ok(unionCap > splitCap, 'precondition: the union really allows a bigger bubble')
    assert.ok(applied < unionCap)
    assert.equal(applyBubbleSize(nodes.host), splitCap, 're-measuring keeps the same cap')

    // The visible consequence at the old cap: a max-size bubble does not fit on the display.
    const bubbleAt = scale => ({ width: 268 * scale, height: 104 * scale })
    const pigOnTop = { x: 900, y: 400, width: PIG, height: PIG }
    const fitFor = scale => {
      const size = bubbleAt(scale)
      const place = fitSpeechPlacement({
        bubble: { x: pigOnTop.x + PIG - 6 - size.width, y: pigOnTop.y - 10 - size.height, ...size },
        pig: pigOnTop, window: UNION, workArea: TOP,
      })
      return { place, size, inside: place.y >= TOP.y + 6 && place.y + size.height <= TOP.y + TOP.height - 6 }
    }
    const atSplit = fitFor(splitCap)
    const atUnion = fitFor(unionCap)
    assert.equal(atSplit.inside, true, 'at the split cap the bubble is fully on the pig display')
    assert.equal(atUnion.inside, false, 'at the union cap it overflows the pig display')

    // Disposing the bridge must not leave the stage area behind for other modes.
    bridge.dispose()
    assert.equal(applyBubbleSize(nodes.host), unionCap, 'no provider left: the page falls back to its own viewport')
  } finally { page.restore() }
})

test('F2: an ordinary page (no desktop shell, no stage) still caps by its own viewport', () => {
  const page = installPage({ innerWidth: 1280, innerHeight: 800 })
  try {
    setStageAreaProvider(null)
    page.store.set(BUBBLE_SIZE_KEY, '6')
    const nodes = makeNodes(WIN, { right: 18, bottom: 18 })
    assert.equal(applyBubbleSize(nodes.host), limitBubbleSize(6, { width: 1280, height: 800 }))
    // A provider that cannot measure falls back instead of throwing.
    setStageAreaProvider(() => { throw new Error('no geometry yet') })
    assert.equal(applyBubbleSize(nodes.host), limitBubbleSize(6, { width: 1280, height: 800 }))
    setStageAreaProvider(() => null)
    assert.equal(applyBubbleSize(nodes.host), limitBubbleSize(6, { width: 1280, height: 800 }))
  } finally {
    setStageAreaProvider(null)
    page.restore()
  }
})

// ---------------------------------------------------------------- F5

const readSource = rel => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8')
const numberFrom = (source, pattern, label) => {
  const match = pattern.exec(source)
  if (match === null) throw new Error(`pattern not found: ${label}`)
  return Number(match[1])
}

test('F5: the stage particle band uses the same margins as the split measure rect', () => {
  const measure = readSource('src/client/desktop/measure.js')
  const fxBlock = measure.slice(measure.indexOf("querySelector('.dp-fx')"))
  assert.ok(fxBlock.length > 0, 'measure.js still has the .dp-fx drawing rect')
  const splitTop = numberFrom(fxBlock, /pigBox\.y - (\d+)/, 'split fx above')
  const splitSide = numberFrom(fxBlock, /pigBox\.x - (\d+)/, 'split fx side')
  const splitBottom = numberFrom(fxBlock, /pigBox\.y \+ (\d+)\) - fx\.y/, 'split fx below')
  assert.equal(FX_TOP, splitTop, 'stage band above the pig == split band above the pig')
  assert.equal(FX_SIDE, splitSide, 'stage band side == split band side')
  assert.equal(FX_BOTTOM, splitBottom, 'stage band below the pig top == split')

  // The rising path itself (anchor above the head + dp-rise travel) must be inside the band.
  const effects = readSource('src/client/effects.js')
  const css = readSource('src/client/css-tabs.js')
  const anchorAbove = numberFrom(effects, /y: p\.top - s\.top - (\d+)/, 'particle anchor')
  const rise = -numberFrom(css, /translate\(var\(--dx,0\),(-?\d+)px\)/, 'dp-rise travel')
  assert.ok(FX_TOP >= anchorAbove + rise, 'the particle travel stays inside the stage band')
  assert.ok(FX_TOP > PIG_TOP, 'the band is wider than the plain pig envelope (the reported clip)')
})

/** Minimal overlay-shape DOM: one pig node plus optional .dp-fx node. */
function installShapePage() {
  const page = installPage()
  const pig = {
    offsetLeft: 10, offsetTop: 20, offsetWidth: PIG, offsetHeight: PIG, offsetParent: null,
    style: { display: 'block', visibility: 'visible', opacity: '1', translate: 'none' },
    closest: () => null,
    getBoundingClientRect() { return { left: 10, top: 20, x: 10, y: 20, right: 10 + PIG, bottom: 20 + PIG, width: PIG, height: PIG } },
  }
  const host = {
    offsetLeft: 0, offsetTop: 0, offsetWidth: 200, offsetHeight: 200, offsetParent: null,
    style: { display: 'block', visibility: 'visible', opacity: '1', translate: 'none' },
    closest: () => null,
  }
  pig.offsetParent = host
  return { page, host, pig }
}

test('F5: the stage shape adds the particle band only while .dp-fx exists', () => {
  const { page, host, pig } = installShapePage()
  const doc = { querySelectorAll: () => [] }
  try {
    const makeHost = withFx => ({
      ...host,
      querySelector: selector => {
        if (selector === '.dp-pig') return pig
        if (selector === '.dp-fx') return withFx ? { style: {} } : null
        return null
      },
    })

    const plain = collectStageShape(makeHost(false), /** @type {any} */ (doc))
    assert.equal(plain.shape.length, 1, 'no particles: only the pig envelope')
    const withFx = collectStageShape(makeHost(true), /** @type {any} */ (doc))
    assert.equal(withFx.shape.length, 2, 'particles: pig envelope plus the fx drawing band')

    const pigBox = pigLayoutBox(makeHost(true))
    assert.deepEqual(pigBox, { x: 10, y: 20, width: PIG, height: PIG })
    assert.deepEqual(withFx.shape[1], {
      x: pigBox.x - FX_SIDE,
      y: pigBox.y - FX_TOP,
      width: FX_SIDE * 2 + pigBox.width,
      height: FX_TOP + FX_BOTTOM,
    })
    // The band has to reach further up than the pig envelope the stage used to report.
    assert.ok(withFx.shape[1].y < withFx.shape[0].y, 'the band starts above the pig envelope')
  } finally { page.restore() }
})

test('F5: split has exactly one extra drawing rect, and the stage shape covers it', () => {
  const measure = readSource('src/client/desktop/measure.js')
  const overlay = readSource('apps/desktop/stage/overlay-shape.js')
  // measure.js 先把通用可见节点 map 成形状，再额外 push 绘图矩形。现在只有 .dp-fx
  // 这一块；以后再添一块而舞台形状没跟上，就会重现 Linux 上「看不见」的问题。
  const extra = [...measure.matchAll(/shape\.push\(\{/g)].length
  assert.equal(extra, 1, 'split gained another special drawing rect: add it to collectStageShape as well')
  assert.match(measure, /querySelector\('\.dp-fx'\)/)
  assert.match(overlay, /querySelector\('\.dp-fx'\)/)
  assert.match(overlay, /fxBand\(/)
})
