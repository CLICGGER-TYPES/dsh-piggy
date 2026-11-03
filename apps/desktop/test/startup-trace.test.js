import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStartupTrace } from '../lib/startup-trace.js'

test('startup trace is unopened until begin, deduplicates keys and stops after its short window', () => {
  let at = 100
  const rows = []
  const trace = createStartupTrace((...parts) => rows.push(parts), () => at)

  assert.equal(trace.record('before', 'before'), false)
  assert.equal(trace.begin(), true)
  assert.equal(trace.begin(), false)
  assert.equal(trace.record('mode:unknown:modern', 'mode', 'unknown', 'modern'), true)
  assert.equal(trace.record('mode:unknown:modern', 'mode', 'unknown', 'modern'), false)
  assert.equal(rows.length, 1)

  at += 20_000
  assert.equal(trace.record('late', 'late'), false)
  assert.equal(rows.length, 1)
})

test('startup trace caps distinct rows and a logging failure does not escape', () => {
  let at = 0
  const rows = []
  const trace = createStartupTrace((...parts) => rows.push(parts), () => at)
  trace.begin()
  for (let index = 0; index < 16; index += 1) {
    assert.equal(trace.record('event-' + index, 'event', index), true)
  }
  assert.equal(trace.record('event-over-cap', 'event', 16), false)
  assert.equal(rows.length, 16)

  const noisy = createStartupTrace(() => { throw new Error('log write failed') }, () => at)
  noisy.begin()
  assert.equal(noisy.record('safe', 'event'), true)
})
