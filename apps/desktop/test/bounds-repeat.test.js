import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'

// 执行真实窗口设置入口；仅模拟已录得的 Windows 分数缩放回读误差。
const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
const start = source.indexOf('function applyBounds(next, why)')
const end = source.indexOf('\n/**', start)
const REQUEST = { x: 200, y: 100, width: 356, height: 284 }

function windowHarness(offset = { x: 0, y: 0, width: 1, height: 1 }) {
  const requested = [], effects = []
  const read = bounds => Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, value + (offset[key] ?? 0)]))
  let actual = read(REQUEST)
  const context = {
    BOUNDS_TOLERANCE: 2, petAsked: { ...REQUEST },
    win: { isDestroyed: () => false, getBounds: () => ({ ...actual }),
      setBounds(next) { requested.push({ ...next }); actual = read(next) } },
    followPig: () => effects.push('follow'), scheduleWindowStateSave: () => effects.push('save'),
    pushGeometry: () => effects.push('geometry'), log() {},
  }
  runInNewContext(source.slice(start, end), context)
  return { apply: (next, why = 'drag') => context.applyBounds({ ...next }, why), requested, effects,
    externalMove: (dx, dy) => { actual.x += dx; actual.y += dy } }
}

test('分数缩放回读大 1px 时，静止拖动不重复设置同一窗口', () => {
  const shell = windowHarness()
  for (let tick = 0; tick < 120; tick++) shell.apply(REQUEST)
  assert.equal(shell.requested.length, 0, '120 次静止采样不应重新设置已请求的窗口')
  assert.deepEqual(shell.effects, [])
})

test('新拖动目标即使只差 1px 仍被设置，随后静止不重复提交', () => {
  const shell = windowHarness()
  for (let x = REQUEST.x + 1; x <= REQUEST.x + 10; x++) {
    const next = { ...REQUEST, x }
    shell.apply(next)
    for (let tick = 0; tick < 5; tick++) shell.apply(next)
  }
  assert.deepEqual(shell.requested.map(bounds => bounds.x), Array.from({ length: 10 }, (_, index) => REQUEST.x + index + 1))
  assert.equal(shell.effects.filter(effect => effect === 'geometry').length, 10)
})

test('静止目标相同时，外部真实挪动超出回读容差仍纠正', () => {
  const shell = windowHarness()
  shell.externalMove(20, -8)
  assert.notEqual(shell.apply(REQUEST), null)
  assert.deepEqual(shell.requested, [REQUEST])
  shell.apply(REQUEST)
  assert.equal(shell.requested.length, 1)
})

test('位置与尺寸正负量化误差都只在相同请求上容忍', () => {
  for (const offset of [{ x: 1, y: -1, width: 1, height: 1 }, { x: -1, y: 1, width: -1, height: -1 }]) {
    const shell = windowHarness(offset)
    for (let tick = 0; tick < 10; tick++) shell.apply(REQUEST)
    assert.equal(shell.requested.length, 0)
    const next = { ...REQUEST, x: REQUEST.x + 2 }
    shell.apply(next)
    assert.deepEqual(shell.requested, [next])
  }
})

test('散步重复目标同样不反复设置，普通摆放保留原有 2px 容差', () => {
  const walking = windowHarness()
  for (let tick = 0; tick < 10; tick++) walking.apply(REQUEST, 'move')
  assert.equal(walking.requested.length, 0)
  const placing = windowHarness()
  placing.apply({ ...REQUEST, x: REQUEST.x + 1 }, 'place')
  assert.equal(placing.requested.length, 0)
})


test('每个新目标维度变化 1px 都不沿用静止请求容差', () => {
  for (const key of ['x', 'y', 'width', 'height']) {
    const shell = windowHarness({ width: 1, height: 1 })
    const next = { ...REQUEST, [key]: REQUEST[key] + 1 }
    shell.apply(next)
    assert.deepEqual(shell.requested, [next], key)
  }
})

test('同一请求恰好 2px 回读偏差可容忍，超过阈值仍纠正', () => {
  const shell = windowHarness({})
  shell.externalMove(2, -2)
  assert.equal(shell.apply(REQUEST), null)
  shell.externalMove(1, 0)
  assert.notEqual(shell.apply(REQUEST), null)
  assert.equal(shell.requested.length, 1)
})

test('异步回读尚未落定时仍纠正，落定后停止重复设置', () => {
  const shell = windowHarness()
  shell.externalMove(10, -10)
  shell.apply(REQUEST)
  // 模拟上一份 ConfigureNotify 再次到达，而最终请求尚未落定。
  shell.externalMove(10, -10)
  shell.apply(REQUEST)
  for (let tick = 0; tick < 10; tick++) shell.apply(REQUEST)
  assert.deepEqual(shell.requested, [REQUEST, REQUEST])
})
