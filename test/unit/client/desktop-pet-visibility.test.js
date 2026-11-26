// 2026-11-26：桌面上看不到猪（pigBox.x = -100，窗口 x = 161）。
// 拖动/抛掷把 slide 叠在窗口夹取补偿上，内容被永久推偏；布局只信 pigBox 去摆窗口，
// 于是窗口越挪越右、猪留在窗口左边界外，之后 4 小时不回位。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createLayoutController } from '../../../src/client/desktop/layout-controller.js'

const AREAS = [
  { x: 0, y: 0, width: 1920, height: 1080 },
  { x: 1920, y: 0, width: 1920, height: 1080 },
]

/**
 * 一块 368x344 的猪窗口：host 是 position:fixed + right/bottom，猪在场景右下。
 * offsetLeft/offsetTop 跟着 style 变，才能像真实页面一样被 pin 推着走。
 */
function fixture() {
  const previousDocument = globalThis.document
  const previousStyle = globalThis.getComputedStyle
  const previousStorage = globalThis.localStorage
  const previousLog = console.log
  const previousWarn = console.warn
  console.log = () => {}
  console.warn = () => {}
  globalThis.localStorage = {
    getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0,
  }
  const body = {}
  const win = { width: 368, height: 344 }
  let placed = { x: 1577, y: 100, width: 368, height: 344 }
  const host = {
    style: { right: '0px', bottom: '0px', left: 'auto', top: 'auto', translate: '' },
    offsetWidth: 80, offsetHeight: 132, offsetParent: body,
    get offsetLeft() { return win.width - (parseFloat(this.style.right) || 0) - this.offsetWidth },
    get offsetTop() { return win.height - (parseFloat(this.style.bottom) || 0) - this.offsetHeight },
    getAttribute: () => 'false',
    closest: () => null,
    querySelector: selector => selector === '.dp-pig' ? pig : null,
    querySelectorAll: () => [pig],
  }
  const pig = {
    offsetLeft: 6, offsetTop: 52, offsetWidth: 68, offsetHeight: 68, offsetParent: host,
    matches: selector => selector === '.dp-pig',
    closest: selector => selector === '[hidden]' ? null : pig,
    getAttribute: () => null,
    style: { getPropertyValue: () => '' },
  }
  const documentObject = {
    body, querySelector: () => host, visibilityState: 'visible',
    documentElement: { setAttribute() {} }, addEventListener() {},
  }
  globalThis.document = documentObject
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: 'dp-bob' })
  const windowObject = {
    innerWidth: win.width, innerHeight: win.height, screenX: placed.x, screenY: placed.y,
    requestAnimationFrame: callback => { callback(0); return 0 }, addEventListener() {}, setInterval() {},
  }
  const shell = {
    platform: 'linux',
    place(request) {
      if (request && request.bounds) {
        placed = { ...request.bounds }
        windowObject.screenX = placed.x
        windowObject.screenY = placed.y
      }
      return { window: placed, workArea: AREAS[0], workAreas: AREAS }
    },
    geometry: () => ({ window: placed, workArea: AREAS[0], workAreas: AREAS }),
  }
  const layout = createLayoutController({
    shell, windowObject, getHost: () => host,
    isDragging: () => false, isFlying: () => false, setHitRects() {},
  })
  return {
    layout,
    windowObject,
    host,
    placed: () => placed,
    pig: () => layout.pigInWindow(placed),
    restore() {
      globalThis.document = previousDocument
      globalThis.getComputedStyle = previousStyle
      globalThis.localStorage = previousStorage
      console.log = previousLog
      console.warn = previousWarn
    },
  }
}

/** 屏幕上的脚底中心：窗口位置 + 猪在窗口里的位置。 */
function feet(win, pig) {
  return { x: win.x + pig.x + pig.width / 2, y: win.y + pig.y + pig.height }
}

test('a slide committed on top of an existing window clamp rebases the pet inside the surface', () => {
  const f = fixture()
  try {
    // 正常落在右屏：窗口 2374,736，猪在窗口内。
    f.layout.rehome({ x: 2374, y: 736, width: 368, height: 344 }, { x: 294, y: 240, width: 68, height: 68 }, AREAS)
    f.layout.tick()
    assert.ok(f.layout.pigInWindow(f.placed()).x > 0, 'normal layout keeps the pig in the window')

    // 拖到左屏底边：窗口想摆到 x=-161，被工作区夹到 0，内容反向挪 161（pigBox.x = 61）。
    f.layout.rehome({ x: 0, y: 736, width: 368, height: 344 }, { x: 61, y: 240, width: 68, height: 68 }, AREAS)
    f.layout.tick()
    const dropped = feet(f.placed(), f.pig())
    assert.equal(f.placed().x, 0)
    assert.equal(f.pig().x, 61)

    // 松手时 slide 再叠一次（发生过的真实序列：拖动落边 + 紧接着的抛掷落同一边）。
    f.layout.commit(f.host, { x: -161, y: 0 })
    f.layout.tick()

    const win = f.placed()
    const pig = f.pig()
    assert.ok(pig.x >= 0 && pig.x + pig.width <= win.width,
      `pig must stay inside the surface, got pigBox.x=${pig.x} in ${win.width}px window`)
    assert.deepEqual(feet(win, pig), dropped, 'recovery keeps the pet on its screen point')

    // 空闲心跳继续跑，不能又漂出去。
    f.layout.tick()
    f.layout.tick()
    assert.ok(f.layout.pigInWindow(f.placed()).x >= 0)
  } finally {
    f.restore()
  }
})

test('repeated handoffs on the same screen edge cannot accumulate the pet out of the surface', () => {
  const f = fixture()
  try {
    f.layout.rehome({ x: 0, y: 736, width: 368, height: 344 }, { x: 61, y: 240, width: 68, height: 68 }, AREAS)
    f.layout.tick()
    for (let index = 0; index < 4; index += 1) {
      f.layout.commit(f.host, { x: -161, y: 0 })
      f.layout.tick()
      const win = f.placed()
      const pig = f.pig()
      assert.ok(pig.x >= 0 && pig.x + pig.width <= win.width,
        `handoff ${index}: pigBox.x=${pig.x} must stay inside the ${win.width}px surface`)
    }
  } finally {
    f.restore()
  }
})
