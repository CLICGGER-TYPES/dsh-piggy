// @ts-check
/**
 * 气泡在猪上方、菜单也向上开时的回归：真实舞台量到的页面坐标（屏幕原点 67,32
 * 已减掉）里，菜单底边压住气泡 23.94px。修法只挪/缩菜单，气泡、猪和宽度都不动。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fitPanelAboveSpeech } from '../src/client/bubble-fit.js'
import { createStageSpeechPanel } from '../src/client/stage-speech-panel.js'

const MARGIN = 10

/** 菜单和气泡的相交面积（页面坐标）。 */
function overlap(a, b) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return width > 0 && height > 0 ? width * height : 0
}

/** 修后的菜单：底边钉在气泡上方，内容比 maxHeight 矮时保持自然高度；返回实际矩形。 */
function apply(panel, fit, bubble) {
  assert.notEqual(fit, null)
  const height = Math.min(panel.height, fit.maxHeight)
  const bottom = fit.y + fit.maxHeight
  const next = { ...panel, y: bottom - height, height }
  assert.equal(overlap(next, bubble), 0, 'menu must not cover the speech bubble')
  return next
}

const WORK_AREA = { x: 0, y: 0, width: 1213, height: 768 }

test('measured bottom menu collision: move the panel up, keep its height, leave the reply bubble alone', () => {
  // 2026-10-25 native stage case B, page coordinates: screen rect minus stage origin 67,32.
  const pig = { x: 1084, y: 664, width: 68, height: 68 }
  const bubble = { x: 884, y: 580.0625, width: 268, height: 73.9375 }
  const panel = { x: 866, y: 84, width: 292, height: 520 }
  const before = { pig: { ...pig }, bubble: { ...bubble }, panel: { ...panel } }

  assert.equal(overlap(panel, bubble), 6415.25, 'precondition: the captured 268x23.94 collision')

  const fit = fitPanelAboveSpeech(panel, bubble, pig, WORK_AREA)
  assert.deepEqual(fit, { y: 52, maxHeight: 520 })

  const next = apply(panel, fit, bubble)
  assert.equal(overlap(next, bubble), 0)
  assert.equal(bubble.y - (next.y + next.height), 8.0625, 'same 8.06px gap the top case already shows')
  assert.ok(next.y >= WORK_AREA.y + MARGIN, 'panel stays inside the top work-area margin')
  assert.equal(next.height, panel.height, 'moving up is enough, so the scroll height is preserved')
  assert.deepEqual({ pig, bubble, panel }, before, 'pig, bubble, width and the original panel inputs are untouched')
})

test('a repeated fit of the shifted panel is a no-op, and a taller reply re-fits from the measured panel', () => {
  const pig = { x: 1084, y: 664, width: 68, height: 68 }
  const bubble = { x: 884, y: 580.0625, width: 268, height: 73.9375 }
  const panel = { x: 866, y: 84, width: 292, height: 520 }
  const first = fitPanelAboveSpeech(panel, bubble, pig, WORK_AREA)
  assert.notEqual(first, null)
  const shifted = { ...panel, y: first.y, height: first.maxHeight }
  assert.equal(fitPanelAboveSpeech(shifted, bubble, pig, WORK_AREA), null,
    'the already shifted panel is clear, so a repeated frame must not move it again')

  // Bubble text grows upward (same pig); the panel is still the previously shifted rect.
  const taller = { ...bubble, y: bubble.y - 20, height: bubble.height + 20 }
  const second = fitPanelAboveSpeech(shifted, taller, pig, WORK_AREA)
  assert.deepEqual(second, { y: 32, maxHeight: 520 })
  const next = apply(shifted, second, taller)
  assert.equal(overlap(next, taller), 0)
  assert.equal(next.height, 520, 'taller speech still has room, so only the position changes')
  assert.equal(fitPanelAboveSpeech(next, taller, pig, WORK_AREA), null, 'converges after one fit')
})

test('a tall menu above tall speech shrinks only the scroll height that does not fit', () => {
  const pig = { x: 1100, y: 600, width: 68, height: 68 }
  const bubble = { x: 884, y: 430, width: 268, height: 150 }
  const panel = { x: 866, y: 60, width: 292, height: 520 }
  assert.equal(overlap(panel, bubble), 268 * 150, 'precondition: the whole bubble sits over the panel')

  const fit = fitPanelAboveSpeech(panel, bubble, pig, WORK_AREA)
  assert.deepEqual(fit, { y: 10, maxHeight: 412 })
  const next = apply(panel, fit, bubble)
  assert.equal(next.height, 412, 'shrinks from 520 to exactly the room above the bubble')
  assert.equal(bubble.y - (next.y + next.height), 8)
  assert.ok(next.y >= WORK_AREA.y + MARGIN)
})

test('a short viewport and a shifted work-area origin both keep the panel above the bubble', () => {
  const shortArea = { x: 0, y: 0, width: 900, height: 420 }
  const pig = { x: 600, y: 380, width: 68, height: 68 }
  const bubble = { x: 584, y: 300, width: 268, height: 80 }
  const panel = { x: 566, y: 20, width: 292, height: 300 }
  const fit = fitPanelAboveSpeech(panel, bubble, pig, shortArea)
  assert.deepEqual(fit, { y: 10, maxHeight: 282 })
  const next = apply(panel, fit, bubble)
  assert.equal(overlap(next, bubble), 0)
  assert.ok(next.y + next.height <= shortArea.y + shortArea.height, 'inside the short viewport')

  // A work area that does not start at the page origin must use its own top margin.
  const offsetArea = { x: 100, y: 50, width: 900, height: 500 }
  const offsetPig = { x: 400, y: 770, width: 68, height: 68 }
  const offsetBubble = { x: 220, y: 670, width: 268, height: 100 }
  const offsetPanel = { x: 200, y: 400, width: 292, height: 300 }
  const offsetFit = fitPanelAboveSpeech(offsetPanel, offsetBubble, offsetPig, offsetArea)
  assert.deepEqual(offsetFit, { y: 142, maxHeight: 520 })
  const offsetNext = apply(offsetPanel, offsetFit, offsetBubble)
  assert.equal(overlap(offsetNext, offsetBubble), 0)
  assert.equal(offsetNext.y, 362, 'a shorter panel keeps its natural height at the same bottom anchor')
  assert.equal(offsetNext.height, 300, 'room exists, so the panel height is preserved')
  assert.ok(offsetNext.y >= offsetArea.y + MARGIN, 'margin comes from the work area, not page 0')
})

test('corner: near the top edge the menu shrinks to the measured room and still clears the bubble', () => {
  const area = { x: 0, y: 0, width: 900, height: 300 }
  const pig = { x: 600, y: 150, width: 68, height: 68 }
  const bubble = { x: 700, y: 90, width: 180, height: 60 }
  const panel = { x: 690, y: 10, width: 292, height: 200 }
  const fit = fitPanelAboveSpeech(panel, bubble, pig, area)
  assert.deepEqual(fit, { y: 10, maxHeight: 72 })
  const next = apply(panel, fit, bubble)
  assert.equal(overlap(next, bubble), 0)
  assert.equal(next.y, area.y + MARGIN)
})

test('below-pig speech and a clear panel are left to the existing below/inside rules', () => {
  const pig = { x: 1084, y: 664, width: 68, height: 68 }
  const panel = { x: 866, y: 84, width: 292, height: 520 }
  const below = { x: 884, y: 674, width: 268, height: 74 }
  assert.equal(fitPanelAboveSpeech(panel, below, pig, WORK_AREA), null)
  const clear = { x: 884, y: 580.0625, width: 268, height: 73.9375 }
  assert.equal(fitPanelAboveSpeech({ ...panel, y: 52, height: 520 }, clear, pig, WORK_AREA), null)
  // No 32px worth of usable panel: report no fit instead of pretending a sliver works.
  const tight = fitPanelAboveSpeech(panel, { ...clear, y: 42 }, pig, WORK_AREA)
  assert.equal(tight, null)
})


test('stage menu anchor converges, resets on expiry, and restores before changing sides', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: {} } })
  try {
    const parent = { offsetWidth: 1213, offsetHeight: 768, offsetParent: null }
    const card = { offsetParent: parent, style: { top: '84px', bottom: 'auto', maxHeight: '520px' } }
    let resets = 0
    const fit = createStageSpeechPanel(card, () => { resets++; Object.assign(card.style, { top: '84px', bottom: 'auto', maxHeight: '520px' }) })
    const pig = { x: 1084, y: 664, width: 68, height: 68 }
    const bubble = { x: 884, y: 580.0625, width: 268, height: 73.9375, side: 'above' }
    const menu = { x: 866, y: 84, width: 292, height: 520 }
    fit(menu, bubble, pig, WORK_AREA)
    assert.deepEqual(card.style, { top: 'auto', bottom: '196px', maxHeight: '520px' })
    fit({ ...menu, y: 52 }, bubble, pig, WORK_AREA)
    assert.equal(resets, 0, 'an already clear menu keeps its anchor without oscillating')
    fit(menu, { ...bubble, side: 'below' }, pig, WORK_AREA)
    assert.equal(resets, 1, 'a side change restores normal layout before the next measured fit')
    fit(menu, bubble, pig, WORK_AREA)
    fit()
    assert.equal(resets, 2, 'speech expiry restores the default anchor')
    fit()
    assert.equal(resets, 2, 'repeated hidden-speech frames do not repaint')
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original)
    else delete globalThis.document
  }
})
