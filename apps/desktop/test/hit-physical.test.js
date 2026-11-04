// @ts-check
/**
 * 桌面壳混合 DPI 命中换算的纯函数回归。
 *
 * 左屏 100%、右屏 200%：光标 DIP 按光标所在屏解释，窗口 DIP 按窗口所在屏解释。
 * 夹具给出每块屏的 physicalBounds，等价于 Electron 的 dipToScreenPoint /
 * dipToScreenRect 在混合 DPI 下的结果；不启 Electron、不点真鼠标。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { cursorHitsWindow, dipToScreenPoint, dipToScreenRect, windowLocalCursor } from '../lib/hit-physical.js'
import { pointerHitsShape } from '../lib/pointer-hit.js'

const LEFT = {
  bounds: { x: 0, y: 0, width: 1280, height: 800 },
  physicalBounds: { x: 0, y: 0, width: 1280, height: 800 },
  scaleFactor: 1,
}
const RIGHT = {
  bounds: { x: 1280, y: 0, width: 1280, height: 800 },
  physicalBounds: { x: 1280, y: 0, width: 2560, height: 1600 },
  scaleFactor: 2,
}

test('DIP → 物理：光标用所在屏、窗口矩形用所在屏的 scaleFactor', () => {
  assert.deepEqual(dipToScreenPoint({ x: 1200, y: 100 }, LEFT), { x: 1200, y: 100 })
  assert.deepEqual(dipToScreenPoint({ x: 1290, y: 100 }, RIGHT), { x: 1300, y: 200 })
  const content = { x: 1400, y: 100, width: 200, height: 200 }
  assert.deepEqual(dipToScreenRect(null, content, LEFT), { x: 1400, y: 100, width: 200, height: 200 })
  assert.deepEqual(dipToScreenRect(null, content, RIGHT), { x: 1520, y: 200, width: 400, height: 400 })
})

test('光标在 200% 屏、窗口在 100% 屏：物理点折回窗口逻辑坐标，不是 DIP 相减', () => {
  const content = { x: 1000, y: 100, width: 400, height: 300 }
  const local = windowLocalCursor({
    cursor: { x: 1290, y: 150 }, content, cursorDisplay: RIGHT, windowDisplay: LEFT,
  })
  assert.deepEqual(local, { cursor: { x: 300, y: 200 }, problem: '', width: 400, height: 300 })
  // 旧的 DIP 相减给出 {290,50}：横向差 10、纵向差 150，命中判断会反。
  const oldBasis = { x: 1290 - content.x, y: 150 - content.y }
  assert.deepEqual(oldBasis, { x: 290, y: 50 })
  assert.equal(pointerHitsShape(oldBasis, { x: 0, y: 0, width: 400, height: 300 },
    [{ x: 285, y: 40, width: 20, height: 20 }]), true, '旧基准误命中透明预留')
  assert.equal(pointerHitsShape(local.cursor, { x: 0, y: 0, width: 400, height: 300 },
    [{ x: 285, y: 40, width: 20, height: 20 }]), false, '物理基准放行透明区')
  assert.equal(pointerHitsShape(local.cursor, { x: 0, y: 0, width: 400, height: 300 },
    [{ x: 285, y: 190, width: 20, height: 20 }]), true, '物理基准命中真实位置')
})

test('同屏 200% 对照：新旧基准折回同一个窗口内坐标', () => {
  const content = { x: 1400, y: 100, width: 200, height: 200 }
  const local = windowLocalCursor({
    cursor: { x: 1450, y: 150 }, content, cursorDisplay: RIGHT, windowDisplay: RIGHT,
  })
  assert.deepEqual(local.cursor, { x: 50, y: 50 })
  assert.deepEqual({ x: 1450 - content.x, y: 150 - content.y }, { x: 50, y: 50 })
})

test('跨屏缝边界：缝两侧各按所在屏的缩放换算', () => {
  assert.deepEqual(dipToScreenPoint({ x: 1279, y: 10 }, LEFT), { x: 1279, y: 10 })
  assert.deepEqual(dipToScreenPoint({ x: 1280, y: 10 }, RIGHT), { x: 1280, y: 20 })
  const content = { x: 1200, y: 0, width: 200, height: 200 }
  const atSeam = windowLocalCursor({ cursor: { x: 1280, y: 10 }, content, cursorDisplay: RIGHT, windowDisplay: LEFT })
  const beforeSeam = windowLocalCursor({ cursor: { x: 1279, y: 10 }, content, cursorDisplay: LEFT, windowDisplay: LEFT })
  assert.deepEqual(atSeam.cursor, { x: 80, y: 20 })
  assert.deepEqual(beforeSeam.cursor, { x: 79, y: 10 })
  assert.equal(pointerHitsShape(beforeSeam.cursor, { x: 0, y: 0, width: 200, height: 200 },
    [{ x: 78, y: 9, width: 2, height: 2 }]), true)
  assert.equal(pointerHitsShape(atSeam.cursor, { x: 0, y: 0, width: 200, height: 200 },
    [{ x: 78, y: 9, width: 2, height: 2 }]), false, '过缝后不能拿左边屏的 DIP 继续算')
})

test('坏换算返回问题原因，不给出看起来差不多的命中', () => {
  assert.equal(dipToScreenPoint({ x: NaN, y: 0 }, LEFT), null)
  assert.equal(dipToScreenRect(null, { x: 0, y: 0, width: NaN, height: 10 }, LEFT), null)
  assert.deepEqual(windowLocalCursor({
    cursor: { x: 0, y: 0 }, content: null, cursorDisplay: LEFT, windowDisplay: LEFT,
  }), { cursor: null, problem: 'invalid content rect', width: 0, height: 0 })
  assert.equal(windowLocalCursor({
    cursor: { x: NaN, y: 0 }, content: { x: 0, y: 0, width: 10, height: 10 },
    cursorDisplay: LEFT, windowDisplay: LEFT,
  }).problem, 'invalid cursor dip point')
})

test('没有原生换算时退回按两块屏的 scaleFactor 手算，结论一致', () => {
  const content = { x: 1000, y: 100, width: 400, height: 300 }
  const win = { getBounds: () => content, getContentBounds: () => content }
  const screen = {
    getCursorScreenPoint: () => ({ x: 1290, y: 150 }),
    getDisplayNearestPoint: () => RIGHT,
    getDisplayMatching: () => LEFT,
  }
  assert.deepEqual(cursorHitsWindow({
    platform: 'win32', screen, window: win, shape: [{ x: 285, y: 190, width: 20, height: 20 }],
  }), { hit: true, problem: '' })
})

test('cursorHitsWindow：Windows 用 screen 的原生换算，其它平台保持 DIP 相减', () => {
  const content = { x: 1000, y: 100, width: 400, height: 300 }
  const win = {
    getBounds: () => content,
    getContentBounds: () => content,
  }
  let conversions = 0
  const screen = {
    getCursorScreenPoint: () => ({ x: 1290, y: 150 }),
    dipToScreenPoint(point) {
      conversions += 1
      assert.equal(this, screen, '必须从 screen 上调用，保持绑定 receiver')
      return dipToScreenPoint(point, RIGHT)
    },
    dipToScreenRect(target, rect) {
      assert.equal(target, win)
      return dipToScreenRect(target, rect, LEFT)
    },
  }
  assert.deepEqual(cursorHitsWindow({
    platform: 'win32', screen, window: win, shape: [{ x: 285, y: 190, width: 20, height: 20 }],
  }), { hit: true, problem: '' })
  assert.deepEqual(cursorHitsWindow({
    platform: 'win32', screen, window: win, shape: [{ x: 285, y: 40, width: 20, height: 20 }],
  }), { hit: false, problem: '' })
  assert.equal(conversions, 2)

  const dipOnly = cursorHitsWindow({
    platform: 'darwin',
    screen: { getCursorScreenPoint: () => ({ x: 1290, y: 150 }) },
    window: win,
    shape: [{ x: 285, y: 190, width: 20, height: 20 }],
  })
  assert.deepEqual(dipOnly, { hit: false, problem: '' })
})
