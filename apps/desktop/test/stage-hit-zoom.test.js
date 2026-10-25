// @ts-check
/**
 * 页面 zoom 后的形状/命中回归。
 *
 * zoom 后 CSS 视口 ≠ getContentBounds() 的 DIP：形状必须按报告视口裁，
 * Windows 命中必须用 (物理光标 - 物理内容 C) / 页面 dpr，不能再用 DIP 宽高比例。
 * 夹具同时给出 zoom 0.8（视口比内容 DIP 大，右侧不能裁掉）和 1.25（视口比内容 DIP 小）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { translatePhysicalCursorDpr } from '../stage/hit-physical.js'
import { createPresenter } from '../stage/present.js'
import { sanitizeReport } from '../stage/shape.js'

const PIG = { x: 2500, y: 500, width: 40, height: 100 }

test('payloads without metadata stay byte-for-byte the old report object', () => {
  const bounds = { width: 2048, height: 752 }
  const report = sanitizeReport({
    shape: [{ x: 10, y: 20, width: 30, height: 40 }],
    visible: { pig: { x: 10, y: 20, width: 30, height: 40 }, secret: 'nope' },
    interacting: true,
  }, bounds)
  assert.deepEqual(report, {
    shape: [{ x: 10, y: 20, width: 30, height: 40 }],
    visible: { pig: { x: 10, y: 20, width: 30, height: 40 }, bubble: null, menu: null, gift: null, hud: null, overlay: null },
    interacting: true,
  })
  assert.equal('dpr' in report, false)
  assert.equal('viewport' in report, false)
})

test('a valid CSS viewport keeps right-edge shapes instead of clipping to content DIP', () => {
  const contentDIP = { width: 2048, height: 752 }
  const viewport = { width: 2560, height: 940 }
  const old = sanitizeReport({ shape: [PIG], visible: { pig: PIG }, interacting: false }, contentDIP)
  assert.deepEqual(old.shape, [{ x: 2047, y: 500, width: 1, height: 100 }], 'precondition: DIP basis clips the right edge')

  const report = sanitizeReport({ shape: [PIG], visible: { pig: PIG }, dpr: 0.8, viewport, interacting: false }, contentDIP)
  assert.deepEqual(report.shape, [PIG], 'CSS viewport 2560 > content DIP 2048: no clipping')
  assert.deepEqual(report.visible.pig, PIG)
  assert.equal(report.dpr, 0.8)
  assert.deepEqual(report.viewport, viewport)
})

test('invalid metadata fields are dropped independently; no metadata keeps the old bounds', () => {
  const contentDIP = { width: 2048, height: 752 }
  const clipped = [{ x: 2047, y: 500, width: 1, height: 100 }]
  for (const dpr of [0, 9, Number.NaN]) {
    const report = sanitizeReport({ shape: [PIG], visible: { pig: PIG }, dpr, viewport: { width: 2560, height: 940 } }, contentDIP)
    assert.equal(report.dpr, undefined, 'bad dpr is not used for the hit basis')
    assert.deepEqual(report.viewport, { width: 2560, height: 940 }, 'a valid viewport still protects the right edge')
    assert.deepEqual(report.shape, [PIG])
  }
  for (const viewport of [{ width: 0, height: 940 }, { width: 20001, height: 940 }, null]) {
    const report = sanitizeReport({ shape: [PIG], visible: { pig: PIG }, dpr: 0.8, viewport }, contentDIP)
    assert.equal(report.viewport, undefined)
    assert.equal(report.dpr, 0.8, 'a valid dpr is still available')
    assert.deepEqual(report.shape, clipped, 'without a CSS viewport the old DIP clip remains')
  }
  assert.deepEqual(sanitizeReport({ shape: [], visible: null, dpr: 0.25, viewport: { width: 20000, height: 20000 } }, contentDIP), {
    shape: [], visible: null, interacting: false, dpr: 0.25, viewport: { width: 20000, height: 20000 },
  })
})

test('dpr conversion is (physical cursor - physical content) / dpr and rejects bad dpr', () => {
  const content = { x: -100, y: -50, width: 2048, height: 752 }
  assert.deepEqual(translatePhysicalCursorDpr({ x: 654, y: 450 }, content, 0.8), {
    cursor: { x: 942.5, y: 625 }, problem: '',
  })
  assert.deepEqual(translatePhysicalCursorDpr({ x: 0, y: 0 }, content, 0), {
    cursor: null, problem: 'invalid page dpr',
  })
})

function presenterWith(screen) {
  const content = screen.content
  /** @type {{ignore:boolean,forward:boolean|undefined}[]} */
  const mouse = []
  const win = {
    getContentBounds: () => content,
    getBounds: () => content,
    isVisible: () => true,
    isDestroyed: () => false,
    setShape() {},
    setIgnoreMouseEvents(ignore, options) { mouse.push({ ignore, forward: options?.forward }) },
  }
  const presenter = createPresenter({ getWindow: () => win, platform: 'win32', screen, log: () => {} })
  return { presenter, mouse }
}

function mixedScreen({ content, cursorPhysical }) {
  /** @type {any} */
  const screen = {
    content,
    getCursorScreenPoint() { assert.equal(this, screen); return { x: 1, y: 2 } },
    dipToScreenPoint(point) {
      assert.equal(this, screen, 'Electron converter keeps its screen receiver')
      assert.deepEqual(point, { x: 1, y: 2 })
      return cursorPhysical
    },
    dipToScreenRect(win, rect) {
      assert.equal(this, screen, 'Electron converter keeps its screen receiver')
      assert.deepEqual(rect, content)
      return content
    },
  }
  return screen
}

test('zoom 0.8: old DIP/CSS basis misses; reported dpr hits and the large viewport is not clipped', () => {
  // Window base DPR 1, page zoom 0.8 -> page dpr 0.8, CSS viewport 2048/0.8 = 2560x940.
  const content = { x: 0, y: 0, width: 2048, height: 752 }
  const screen = mixedScreen({ content, cursorPhysical: { x: 2010, y: 450 } })
  const { presenter, mouse } = presenterWith(screen)

  presenter.applyReport({ shape: [PIG], visible: { pig: PIG }, interacting: false })
  assert.deepEqual(mouse.at(-1), { ignore: true, forward: true }, 'before metadata: old basis + clipped shape miss')

  presenter.applyReport({ shape: [PIG], visible: { pig: PIG }, dpr: 0.8, viewport: { width: 2560, height: 940 }, interacting: false })
  assert.deepEqual(mouse.at(-1), { ignore: false, forward: true }, 'after metadata: CSS cursor 2512.5,562.5 is inside the pig')

  presenter.applyReport({ shape: [PIG], visible: { pig: PIG }, dpr: 0, viewport: { width: 2560, height: 940 }, interacting: false })
  assert.deepEqual(mouse.at(-1), { ignore: false, forward: true }, 'a valid viewport can still supply the physical/CSS ratio without dpr')

  presenter.applyReport({ shape: [PIG], visible: { pig: PIG }, dpr: 0, viewport: { width: 0, height: 0 }, interacting: false })
  assert.deepEqual(mouse.at(-1), { ignore: true, forward: true }, 'both metadata fields invalid: old miss/pass-through, never blocks the desktop')
  presenter.applyReport({ shape: [PIG], visible: { pig: PIG }, dpr: 0.8, viewport: { width: 2560, height: 940 }, interacting: false })
  assert.deepEqual(mouse.at(-1), { ignore: false, forward: true }, 'a later valid report recovers the hit; bad metadata is not sticky')
  presenter.dispose()
})

test('zoom 1.25: old physical/content ratio misses; dpr basis hits the same CSS pig', () => {
  // Window physical content 2560 = content DIP 2560, page zoom 1.25 -> dpr 1.25, CSS viewport 2048x601.6.
  const content = { x: 0, y: 0, width: 2560, height: 752 }
  const pig = { x: 2000, y: 400, width: 40, height: 100 }
  const screen = mixedScreen({ content, cursorPhysical: { x: 2512, y: 563 } })
  const { presenter, mouse } = presenterWith(screen)

  presenter.applyReport({ shape: [pig], visible: { pig }, interacting: false })
  assert.deepEqual(mouse.at(-1), { ignore: true, forward: true }, 'before metadata: cursor 2512 is outside the pig at x 2000..2040')

  presenter.applyReport({ shape: [pig], visible: { pig }, dpr: 1.25, viewport: { width: 2048, height: 601.6 }, interacting: false })
  assert.deepEqual(mouse.at(-1), { ignore: false, forward: true }, 'after metadata: CSS cursor 2009.6,450.4 is inside the pig')
  presenter.dispose()
})
