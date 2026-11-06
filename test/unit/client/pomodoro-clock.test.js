// 番茄钟倒计时要一秒一秒走：以前只在每 4 秒一次的轮询里更新，看起来是一段一段跳的。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createPomodoroClock } from '../../../src/client/pomodoro-clock.js'

function fakeNode(attrs = {}) {
  return { textContent: '', getAttribute: key => attrs[key] ?? null }
}

test('the countdown ticks every second between polls, and asks for a refresh at zero', () => {
  let now = 1_000_000
  let tick = null
  const realNow = Date.now
  const realWindow = globalThis.window
  Date.now = () => now
  globalThis.window = { setInterval: fn => { tick = fn; return 1 }, clearInterval: () => { tick = null } }
  try {
    const pill = fakeNode({ 'data-pomo': 'on' })
    const clock = fakeNode()
    const content = { querySelector: sel => (sel === '.dp-pomo-clock' ? clock : null) }
    const view = { pomodoro: { active: true, secondsLeft: 3, breakSecondsLeft: 0 } }
    let refreshed = 0
    createPomodoroClock(() => view, pill, content, () => { refreshed += 1 }, () => false)
    const seen = []
    for (let i = 0; i <= 3; i += 1) {
      tick()
      seen.push(pill.textContent)
      now += 1000
    }
    assert.deepEqual(seen, ['🍅 0:03', '🍅 0:02', '🍅 0:01', '🍅 0:00'], 'one step per second, no jumps')
    assert.equal(clock.textContent, '0:00', 'the big clock in the App follows too')
    assert.equal(refreshed, 1, 'reaching zero asks the host to settle right away, once')
  } finally {
    Date.now = realNow
    globalThis.window = realWindow
  }
})

test('a poll that agrees within a second does not pull the clock back', () => {
  let now = 1_000_000
  let tick = null
  const realNow = Date.now
  const realWindow = globalThis.window
  Date.now = () => now
  globalThis.window = { setInterval: fn => { tick = fn; return 1 }, clearInterval: () => {} }
  try {
    const pill = fakeNode({ 'data-pomo': 'on' })
    let view = { pomodoro: { active: true, secondsLeft: 60, breakSecondsLeft: 0 } }
    createPomodoroClock(() => view, pill, { querySelector: () => null }, () => {}, () => false)
    tick()
    now += 1000
    tick()
    assert.equal(pill.textContent, '🍅 0:59')
    // The next poll arrives 0.6 s later and, rounded up, still says 59.
    now += 600
    view = { pomodoro: { active: true, secondsLeft: 59, breakSecondsLeft: 0 } }
    tick()
    now += 400
    tick()
    assert.equal(pill.textContent, '🍅 0:58', 'kept counting instead of repeating 59')
    // A real drift (the host says 30) is followed.
    view = { pomodoro: { active: true, secondsLeft: 30, breakSecondsLeft: 0 } }
    tick()
    assert.equal(pill.textContent, '🍅 0:30')
  } finally {
    Date.now = realNow
    globalThis.window = realWindow
  }
})

test('the clock stops itself once the pig is gone', () => {
  let tick = null
  let cleared = false
  const realWindow = globalThis.window
  globalThis.window = { setInterval: fn => { tick = fn; return 1 }, clearInterval: () => { cleared = true } }
  try {
    createPomodoroClock(() => ({ pomodoro: null }), fakeNode(), { querySelector: () => null }, () => {}, () => true)
    tick()
    assert.equal(cleared, true)
  } finally {
    globalThis.window = realWindow
  }
})
