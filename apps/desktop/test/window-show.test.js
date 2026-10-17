import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { SHOW_FALLBACK_MS, createShowGate } from '../lib/window-show.js'

test('Windows/macOS 仍然在 ready-to-show 立刻显示', () => {
  for (const platform of ['win32', 'darwin']) {
    const gate = createShowGate({ platform, timeoutMs: 2000 })
    assert.equal(gate.readyToShow(0), true)
    assert.equal(gate.pending, false)
    assert.equal(gate.content(), false)
    assert.equal(gate.timeout(99999), false)
  }
})

test('Linux 等第一次 content 才显示，几何和形状先摆好', () => {
  const gate = createShowGate({ platform: 'linux', timeoutMs: 2000 })
  assert.equal(gate.readyToShow(0), false)
  assert.equal(gate.timeout(1999), false)
  assert.equal(gate.content(), true)
  assert.equal(gate.content(), false)
  assert.equal(gate.timeout(99999), false)
  assert.equal(gate.pending, false)
})

test('Linux 页面一直不报内容时超时兜底显示', () => {
  const gate = createShowGate({ platform: 'linux', timeoutMs: 2000 })
  assert.equal(gate.readyToShow(100), false)
  assert.equal(gate.timeout(2099), false)
  assert.equal(gate.timeout(2100), true)
  assert.equal(gate.content(), false)
  assert.equal(gate.timeout(99999), false)
})

test('content 早于 ready-to-show 时等 ready 再显示', () => {
  const gate = createShowGate({ platform: 'linux', timeoutMs: 2000 })
  assert.equal(gate.content(), false)
  assert.equal(gate.readyToShow(0), true)
  assert.equal(gate.pending, false)
})

test('content 早于 ready 且不是 Linux 时 ready 照常显示一次', () => {
  const gate = createShowGate({ platform: 'win32', timeoutMs: 2000 })
  assert.equal(gate.content(), false)
  assert.equal(gate.readyToShow(0), true)
  assert.equal(gate.readyToShow(1), false)
})

test('超时时间可以注入，默认 2 秒', () => {
  assert.equal(SHOW_FALLBACK_MS, 2000)
  let now = 0
  const gate = createShowGate({ platform: 'linux', timeoutMs: 500, now: () => now })
  assert.equal(gate.readyToShow(), false)
  now = 499
  assert.equal(gate.timeout(), false)
  now = 500
  assert.equal(gate.timeout(), true)
})

test('启动不再先设空形状再按兜底尺寸显示（避免 Xwayland resize 崩溃）', () => {
  const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  assert.ok(!/^\s*applyShape\(\[\]\)/m.test(source), 'main.js 不应在内容上报前设置空形状')
  assert.equal((source.match(/showGate\.content\(\)\) showPigWindow\(\)/g) || []).length, 2, 'place 和 content 两条启动路径都要经过显示门')
  assert.match(source, /showGate\.readyToShow\(\)\) showPigWindow\(\)/, 'ready-to-show 也要经过显示门')
})
