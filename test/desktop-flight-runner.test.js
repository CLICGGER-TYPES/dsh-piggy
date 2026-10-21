import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFlightRunner } from '../src/client/feel/flight-run.js'

test('跨屏抛掷驱动移动原生窗口，落地使用副屏位置交接', () => {
  const oldRequest = globalThis.requestAnimationFrame
  const oldCancel = globalThis.cancelAnimationFrame
  let frame, final, now = performance.now()
  const moves = []
  globalThis.requestAnimationFrame = callback => { frame = callback; return 1 }
  globalThis.cancelAnimationFrame = () => {}
  try {
    const areas = [{x: 0, y: 0, width: 640, height: 400}, {x: 640, y: 0, width: 640, height: 400}]
    const pig = {x: 200, y: 180, width: 56, height: 56}
    const runner = createFlightRunner({
      getShell: () => ({flight: {supported: true,
        start: () => ({area: areas[0], areas, home: {x: 580, y: 280},
          pig, window: {x: 352, y: 44, width: 392, height: 356}}),
        move: (x, y, slide) => moves.push({x, y, slide}),
        finish: value => { final = value },
      }}), host: {style: {}}, onStart() {}, onImpact() {}, onDust() {},
      onTilt() {}, onSound() {}, onFinish() {},
    })
    assert.equal(runner.start(1200, -450), true)
    for (let i = 0; runner.isFlying() && i < 500; i++) frame(now += 1000 / 120)
    assert.ok(moves.some(move => move.x > 640 - 392), '窗口必须跨过主屏夹取边界')
    assert.ok(final.window.x + pig.x + pig.width / 2 + final.slide.x > 640, '在副屏交接')
    assert.equal(runner.isFlying(), false)
  } finally {
    globalThis.requestAnimationFrame = oldRequest
    globalThis.cancelAnimationFrame = oldCancel
  }
})
