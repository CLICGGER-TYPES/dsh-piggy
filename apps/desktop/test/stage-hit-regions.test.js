// @ts-check
/** 舞台绘制与输入分离：绘制包络保留，空白穿透，真实控件/猪和交互交接不受影响。 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createPresenter } from '../stage/present.js'
import { sanitizeReport } from '../stage/shape.js'
import { collectStageShape } from '../stage/overlay-shape.js'

const DRAWING = { x: 40, y: 20, width: 260, height: 230 }
const PIG = { x: 120, y: 90, width: 50, height: 65 }
const GIFT = { x: 180, y: 60, width: 24, height: 24 }

function fixture(platform, options = {}) {
  const content = options.content ?? { x: -300, y: -100, width: 800, height: 600 }
  let cursor = { x: content.x + 60, y: content.y + 60 }
  const mouse = []
  const shapes = []
  let ignored = false
  const win = {
    getContentBounds: () => content, getBounds: () => content,
    isVisible: () => true, isDestroyed: () => false,
    setShape: rects => { shapes.push(rects); ignored = false; if (options.failShape) throw new Error('native shape unavailable') },
    setIgnoreMouseEvents: (ignore, mode) => { ignored = ignore; mouse.push({ ignore, forward: mode?.forward }) },
  }
  const screen = {
    getCursorScreenPoint: () => cursor,
    ...(options.physical ? {
      dipToScreenPoint: point => point,
      dipToScreenRect: () => content,
    } : {}),
  }
  const presenter = createPresenter({ getWindow: () => win, platform, screen, log() {} })
  return { presenter, mouse, shapes, content, ignored: () => ignored, move: point => { cursor = point; presenter.refreshHit() } }
}

for (const platform of ['win32', 'darwin', 'linux']) {
  test(`${platform}: drawing whitespace passes through while pig and controls remain clickable`, () => {
    const env = fixture(platform)
    try {
      env.presenter.applyReport({ shape: [DRAWING], hitShape: [PIG, GIFT] })
      assert.equal(env.mouse.at(-1).ignore, true, 'drawing-only whitespace does not block desktop input')
      if (platform === 'linux') assert.deepEqual(env.shapes.at(-1), [DRAWING], 'native drawing is not clipped to input')
      env.move({ x: env.content.x + 130, y: env.content.y + 100 })
      assert.equal(env.mouse.at(-1).ignore, false)
      env.move({ x: env.content.x + 185, y: env.content.y + 65 })
      assert.equal(env.mouse.at(-1).ignore, false, 'real control remains clickable')
      env.presenter.applyReport({ shape: [DRAWING], hitShape: [PIG] })
      assert.equal(env.mouse.at(-1).ignore, true, 'control disappearing changes input even though drawing is unchanged')
      env.presenter.applyInteracting(true)
      assert.equal(env.mouse.at(-1).ignore, false, 'active dragging keeps capture beyond the pig')
      env.presenter.applyInteracting(false)
      env.presenter.applyReport({ shape: [DRAWING], hitShape: [PIG] })
      assert.equal(env.mouse.at(-1).ignore, true, 'landed report releases full-window input')
      if (platform === 'linux') assert.deepEqual(env.shapes.at(-1), [DRAWING], 'landing restores complete drawing envelope')
    } finally { env.presenter.dispose() }
  })
}

test('Linux drawing updates restore passthrough even when native setShape resets mouse input', () => {
  const options = { failShape: false }
  const env = fixture('linux', options)
  try {
    env.presenter.applyReport({ shape: [DRAWING], hitShape: [PIG] })
    assert.equal(env.ignored(), true)
    const expanded = { ...DRAWING, width: DRAWING.width + 20 }
    env.presenter.applyReport({ shape: [expanded], hitShape: [PIG] })
    assert.deepEqual(env.shapes.at(-1), [expanded])
    assert.equal(env.ignored(), true, 'unchanged pointer miss must be re-applied after a new native shape')
    options.failShape = true
    env.presenter.applyReport({ shape: [], hitShape: [] })
    assert.equal(env.ignored(), true, 'an empty drawing/input report must not leave the 1px native fallback clickable')
  } finally { env.presenter.dispose() }
})

test('old reports retain drawing-shape input, while explicitly empty input passes through', () => {
  const env = fixture('darwin')
  try {
    env.presenter.applyReport({ shape: [DRAWING] })
    assert.equal(env.mouse.at(-1).ignore, false)
    env.presenter.applyReport({ shape: [DRAWING], hitShape: [] })
    assert.equal(env.mouse.at(-1).ignore, true)
    env.presenter.applyReport({ shape: [DRAWING] })
    assert.equal(env.mouse.at(-1).ignore, false, 'new game rollback restores the old input contract')
  } finally { env.presenter.dispose() }
})

for (const dpr of [0.8, 1.25, 2]) {
  test(`Windows input preserves physical origin and effective page DPR ${dpr}`, () => {
    const env = fixture('win32', { physical: true, content: { x: -2400, y: -500, width: 3200, height: 1600 } })
    try {
      env.presenter.applyReport({ shape: [DRAWING], hitShape: [PIG], dpr,
        viewport: { width: env.content.width / dpr, height: env.content.height / dpr } })
      env.move({ x: env.content.x + 130 * dpr, y: env.content.y + 100 * dpr })
      assert.equal(env.mouse.at(-1).ignore, false, 'negative-origin physical cursor maps to visible pig')
      env.move({ x: env.content.x + 60 * dpr, y: env.content.y + 60 * dpr })
      assert.equal(env.mouse.at(-1).ignore, true, 'the surrounding drawing envelope is still pass-through after zoom')
    } finally { env.presenter.dispose() }
  })
}

test('input validation uses the same CSS viewport, rejects invalid rectangles and keeps omission distinct', () => {
  const bounds = { width: 100, height: 100 }
  const input = { x: 120, y: 20, width: 30, height: 40 }
  const report = sanitizeReport({ shape: [DRAWING], hitShape: [input, { ...input, width: NaN }],
    viewport: { width: 400, height: 300 } }, bounds)
  assert.deepEqual(report.hitShape, [input], 'zoomed-out viewport input is not clipped to content DIP')
  assert.deepEqual(sanitizeReport({ shape: [DRAWING], hitShape: null }, bounds).hitShape, [])
  assert.equal('hitShape' in sanitizeReport({ shape: [DRAWING] }, bounds), false)
})

test('stage collector keeps envelope/body/particles drawing-only and uses the game input hook', () => {
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const savedStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle')
  const body = {}
  const pig = {
    offsetLeft: 100, offsetTop: 100, offsetWidth: 80, offsetHeight: 80, offsetParent: body,
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 80, height: 80 }),
  }
  const host = { querySelector: selector => selector === '.dp-pig' ? pig : selector === '.dp-fx' ? {} : null }
  const doc = { body, querySelectorAll: () => [] }
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true })
  Object.defineProperty(globalThis, 'getComputedStyle', { value: () => ({ translate: '' }), configurable: true })
  try {
    let hits = [PIG, GIFT]
    const api = { drawingBounds: () => DRAWING, hitRegions: node => { assert.equal(node, host); return hits } }
    const report = collectStageShape(host, /** @type {any} */ (doc), api)
    assert.deepEqual(report.hitShape, [PIG, GIFT])
    assert.ok(report.shape.length >= 3, 'envelope, body and particles remain drawable')
    const drawing = report.shape
    hits = [PIG]
    const hidden = collectStageShape(host, /** @type {any} */ (doc), api)
    assert.deepEqual(hidden.shape, drawing)
    assert.deepEqual(hidden.hitShape, [PIG], 'hidden controls disappear from input independently')
    assert.equal('hitShape' in collectStageShape(host, /** @type {any} */ (doc)), false, 'old external game without hook keeps legacy input')
  } finally {
    if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument)
    else delete (/** @type {any} */ (globalThis)).document
    if (savedStyle) Object.defineProperty(globalThis, 'getComputedStyle', savedStyle)
    else delete (/** @type {any} */ (globalThis)).getComputedStyle
  }
})

test('external dialog paper is input but its full-screen backdrop is drawing-only', () => {
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const savedStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle')
  const paper = { x: 250, y: 180, width: 270, height: 200 }
  const visibleStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1' })
  const mask = {
    style: visibleStyle(), parentElement: null, closest: () => null,
    matches: selector => selector.split(',').includes('.dp-save-overlay'),
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
  }
  const dialog = {
    style: visibleStyle(), parentElement: mask, closest: () => null,
    matches: selector => selector.split(',').some(part => part === '[role="dialog"]' || part === '[aria-modal="true"]'),
    getBoundingClientRect: () => paper,
  }
  const doc = { body: {}, querySelectorAll: selector => [mask, dialog].filter(node => node.matches(selector)) }
  const host = { querySelector: () => null }
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true })
  Object.defineProperty(globalThis, 'getComputedStyle', { value: node => node.style, configurable: true })
  try {
    const api = { hitRegions: () => [] }
    const report = collectStageShape(host, /** @type {any} */ (doc), api)
    assert.deepEqual(report.hitShape, [paper], 'the real dialog remains interactive outside the host')
    assert.ok(report.shape.some(rect => rect.width >= 800 && rect.height >= 600), 'backdrop paint remains complete')
    mask.style.opacity = '0'
    assert.deepEqual(collectStageShape(host, /** @type {any} */ (doc), api).hitShape, [], 'a hidden parent removes the entire dialog from input')
  } finally {
    if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument)
    else delete (/** @type {any} */ (globalThis)).document
    if (savedStyle) Object.defineProperty(globalThis, 'getComputedStyle', savedStyle)
    else delete (/** @type {any} */ (globalThis)).getComputedStyle
  }
})
