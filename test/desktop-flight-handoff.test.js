import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFlightBridge } from '../src/client/desktop/flight-bridge.js'
import { commitSlide } from '../src/client/desktop/slide.js'
import { createMeasure } from '../src/client/desktop/measure.js'
import { createPlacement } from '../src/client/desktop/place.js'

const position = host => ({
  x: 800 - parseFloat(host.style.right) + (parseFloat(host.style.translate.split(' ')[0]) || 0),
  y: 600 - parseFloat(host.style.bottom) + (parseFloat(host.style.translate.split(' ')[1]) || 0),
})

test('flight landing and catch keep the rendered position while native geometry is still stale', () => {
  for (const slide of [{ x: 0, y: 111 }, { x: -117, y: -78 }, { x: 67, y: 32 }]) {
    const host = { style: { right: '214px', bottom: '99px', translate: `${slide.x}px ${slide.y}px` } }
    const state = { shift: { x: -125, y: 14 }, anchor: { x: 0, y: 0 }, pinned: '' }
    let flying = true
    let home
    const before = position(host)
    const bridge = createFlightBridge({
      shell: { flyMove() {} },
      readGeometry() { throw new Error('finish must use the final flight position') },
      pigInWindow() { return null },
      rehome(win, pig) { home = { x: win.x + pig.x, y: win.y + pig.y } },
      setFlying(on) { flying = on },
      isFlying() { return flying },
      clearSlide(value) { commitSlide(host, state, value) },
      forgetLayout() {},
      // Real tick may wait for X11 ConfigureNotify. The pig must stay put meanwhile.
      tick() {},
    })
    bridge.finish({ window: { x: 75, y: 44 }, pig: { x: 86, y: 159, width: 86, height: 86 }, slide, areas: [] })
    assert.deepEqual(position(host), before, 'handoff must not expose the unshifted location')
    assert.deepEqual(home, { x: 161 + slide.x, y: 203 + slide.y })
    assert.deepEqual(state.anchor, { x: -125 + slide.x, y: 14 + slide.y })
    assert.deepEqual(state.shift, { x: 0, y: 0 })
    assert.equal(flying, false)
    assert.equal(host.style.translate, '')
  }
})

test('zero-slide handoff preserves the existing drag clamp offset', () => {
  const host = { style: { right: '171px', bottom: '-12px', translate: '' } }
  const before = position(host)
  const state = { shift: { x: -83, y: 125 }, anchor: { x: 0, y: 0 }, pinned: '' }
  commitSlide(host, state, { x: 0, y: 0 })
  assert.deepEqual(state.anchor, { x: -83, y: 125 })
  assert.deepEqual(position(host), before)
})

test('landing retains the native window and its content anchor instead of moving both in separate frames', () => {
  const measure = createMeasure({ platform: 'linux', geometry: () => null })
  measure.state.shift = { x: -125, y: 14 }
  const host = { style: { right: '214px', bottom: '99px', translate: '0px 111px' } }
  commitSlide(host, measure.state, { x: 0, y: 111 })
  measure.pin(host, { horizontal: 'right', vertical: 'bottom' },
    { x: 86, y: 159, width: 92, height: 98 }, { right: 251, bottom: 354 })
  assert.equal(host.style.right, '214px')
  assert.equal(host.style.bottom, '-12px')
  const win = { x: 75, y: 44, width: 392, height: 356 }
  const pig = { x: 392 - parseFloat(host.style.right) - 92, y: 356 - parseFloat(host.style.bottom) - 98, width: 86, height: 86 }
  const areas = [{ x: 33, y: 16, width: 607, height: 384 }]
  const placement = createPlacement()
  placement.rehome(win, pig, areas)
  assert.deepEqual(placement.decide({ width: 392, height: 356, pig, pigWindow: pig, pigNow: pig, shift: measure.state.shift }, win, areas), win)
})

test('a changed window footprint rebases the landing anchor before pinning smaller artwork', () => {
  const measure = createMeasure({platform: 'linux', geometry: () => null})
  measure.state.anchor = {x: 122, y: 66}
  const before = {width: 376, height: 336}
  measure.fitWindow(before, before)
  assert.deepEqual(measure.state.anchor, {x: 122, y: 66}, 'normal landing retains its anchor')
  measure.fitWindow({width: 364, height: 308}, before)
  assert.deepEqual(measure.state.anchor, {x: 0, y: 0}, 'a smaller viewport must not inherit the old content bias')
})
