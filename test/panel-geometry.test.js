/**
 * 桌面版面板窗口跟着猪（外壳 0.6.1，apps/desktop/lib/panel-geometry.js）。
 *
 * 用户 2026-10-07 录屏：开着面板拖猪，面板离猪越来越远。0.6.0 每帧「面板回读位置 + 猪挪了多少」，
 * Windows 上拖动中回读常落后一帧、分数缩放下还差 1px，每帧丢一点就攒起来。这里模拟
 * 「回读落后一帧 + 125% 取整」连拖 600 帧，要求面板和猪的相对位置一像素都不攒。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import * as panelGeometry from '../apps/desktop/lib/panel-geometry.js'
import * as constants from '../src/client/constants.js'

const { PANEL_FALLBACK, panelAnchorFor, panelBoundsFor, pigScreenBox } = panelGeometry

const AREA = { x: 0, y: 0, width: 1920, height: 1040 }
const PIG = { x: 40, y: 60, width: 56, height: 56 }

/** 125% 缩放：逻辑坐标 → 物理像素取整 → 再换回逻辑坐标（向下取整），回读值和请求值差 0~1px。 */
const scaled = at => ({ x: Math.floor(Math.round(at.x * 1.25) / 1.25), y: Math.floor(Math.round(at.y * 1.25) / 1.25) })

/**
 * 旧算法（0.6.0）对照：面板 = 面板回读 + (猪这帧请求 − 猪回读)。
 * 只要两个窗口的回读误差不完全一样（这里：猪窗口回读准、面板窗口按 125% 取整），每帧的差就攒下来。
 */
function oldFollow(path) {
  let pet = path[0]
  let panel = { x: path[0].x - 200, y: path[0].y - 300 }
  let worst = 0
  for (const next of path) {
    const delta = { x: next.x - pet.x, y: next.y - pet.y }
    const read = scaled(panel)
    panel = { x: read.x + delta.x, y: read.y + delta.y }
    pet = next
    worst = Math.max(worst, Math.abs(panel.x - next.x + 200), Math.abs(panel.y - next.y + 300))
  }
  return worst
}

const PATH = Array.from({ length: 600 }, (_, i) => ({ x: 900 + Math.round(300 * Math.sin(i / 37)), y: 600 + Math.round(120 * Math.cos(i / 23)) }))

test('拖 600 帧：面板和猪的相对位置不随回读落后、取整误差漂移', () => {
  // 对照：旧算法在同样的噪声下会被甩开好几十像素（测试本身没写错的证据）
  assert.ok(oldFollow(PATH) > 20, 'old drift ' + oldFollow(PATH))
  const start = pigScreenBox(PATH[0], scaled(PATH[0]), PIG, { dragging: true })
  const anchor = panelAnchorFor(start, AREA)
  const first = panelBoundsFor(start, anchor, { width: 292, height: 300 })
  const offset = { x: first.x - start.x, y: first.y - start.y }
  let drifted = 0
  // 来回绕圈拖，避开屏幕边（贴边时面板会被夹，那是另一件事）；回读永远落后一帧
  for (let i = 1; i < PATH.length; i += 1) {
    const pig = pigScreenBox(PATH[i], scaled(PATH[i - 1]), PIG, { dragging: true })
    const panel = panelBoundsFor(pig, anchor, { width: 292, height: 300 })
    drifted = Math.max(drifted, Math.abs(panel.x - pig.x - offset.x), Math.abs(panel.y - pig.y - offset.y))
  }
  assert.equal(drifted, 0)
})

test('系统没照办（回读和请求差得远）就信回读值', () => {
  const pig = pigScreenBox({ x: 1800, y: 100 }, { x: 1700, y: 100 }, PIG)
  assert.equal(pig.x, 1700 + PIG.x)
  const noisy = pigScreenBox({ x: 1800, y: 100 }, { x: 1801, y: 99 }, PIG)
  assert.equal(noisy.x, 1800 + PIG.x)
})

test('拖到屏幕边时猪在窗口里滑出去的那一截也算进猪的位置', () => {
  const pig = pigScreenBox({ x: 0, y: 500 }, { x: 0, y: 500 }, PIG, { slide: { x: -30, y: 0 } })
  assert.equal(pig.x, PIG.x - 30)
})

test('面板朝空间大的一边开，放不下右对齐就左对齐，并夹在工作区里', () => {
  const low = { x: 1000, y: 900, width: 56, height: 56 }
  const up = panelAnchorFor(low, AREA)
  assert.equal(up.vertical, 'above')
  const b = panelBoundsFor(low, up, { width: 292, height: 400 })
  assert.equal(b.y + b.height, low.y - panelGeometry.PANEL_GAP)
  assert.equal(b.x + b.width, low.x + low.width)

  const high = { x: 20, y: 30, width: 56, height: 56 }
  const down = panelAnchorFor(high, AREA)
  assert.equal(down.vertical, 'below')
  assert.equal(down.horizontal, 'left')
  const c = panelBoundsFor(high, down, null)
  assert.equal(c.y, high.y + high.height + panelGeometry.PANEL_GAP)
  assert.equal(c.x, high.x)
  assert.equal(c.width, PANEL_FALLBACK.width)
})

test('拖动中对齐边不变：贴到屏幕左边时面板停在边上，不横跳到猪另一边', () => {
  const anchor = panelAnchorFor({ x: 900, y: 800, width: 56, height: 56 }, AREA)
  assert.equal(anchor.horizontal, 'right')
  const near = panelBoundsFor({ x: 60, y: 800, width: 56, height: 56 }, anchor, { width: 292, height: 300 })
  assert.equal(near.x, panelGeometry.PANEL_MARGIN)
})

test('松手时原来那边还放得下就保持，不横跳', () => {
  const pig = { x: 900, y: 800, width: 56, height: 56 }
  assert.equal(panelAnchorFor(pig, AREA, 292, 'left').horizontal, 'left')
  assert.equal(panelAnchorFor({ ...pig, x: 1800 }, AREA, 292, 'left').horizontal, 'right')
})

test('外壳的面板尺寸常量和游戏包 constants.js 一致', () => {
  for (const name of ['PANEL_GAP', 'PANEL_MARGIN', 'PANEL_MAX_HEIGHT', 'PANEL_MIN_HEIGHT']) {
    assert.equal(panelGeometry[name], constants[name], name)
  }
  assert.equal(PANEL_FALLBACK.width, constants.PANEL_WIDTH)
})

test('main.js 不再在面板窗口回读位置上累加增量', () => {
  const main = readFileSync(new URL('../apps/desktop/main.js', import.meta.url), 'utf8')
  assert.doesNotMatch(main, /panelWin\.getBounds\(\)/)
})
