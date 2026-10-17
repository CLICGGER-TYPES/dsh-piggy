import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../core.js'
import { createGameRuntime } from '../runtime/index.js'
import { createWorkObserver } from '../adapters/dsh/work-observer.js'

function timerSeam() {
  let callback = null, delay = null, cleared = 0
  return {
    setTimer(fn, ms) { callback = fn; delay = ms; return 1 },
    clearTimer(id) { if (id === 1) { callback = null; cleared += 1 } },
    fire() { const run = callback; callback = null; run?.() },
    get delay() { return delay }, get scheduled() { return callback !== null }, get cleared() { return cleared },
  }
}

test('503 retries preserve event IDs and order while a bounded queue drops only new overflow', () => {
  const clock = timerSeam(), calls = [], accepted = [], warnings = []
  let busy = true
  const observer = createWorkObserver({ source: 'dsh', producer: 'stable', now: () => 123,
    setTimer: clock.setTimer, clearTimer: clock.clearTimer, maxQueue: 2,
    warn: message => warnings.push(message), accept(event) {
      calls.push(event)
      if (busy) throw Object.assign(new Error('busy'), { status: 503 })
      accepted.push(event)
    } })

  assert.equal(observer.observe('turn'), true)
  assert.equal(observer.observe('message'), true)
  assert.equal(observer.observe('tool'), false)
  assert.equal(observer.pendingCount(), 2)
  assert.equal(clock.delay, 100)
  assert.equal(warnings.length, 1)
  busy = false
  clock.fire()

  assert.deepEqual(accepted.map(event => event.id), ['stable:1', 'stable:2'])
  assert.deepEqual(accepted.map(event => event.type), ['turn', 'message'])
  assert.deepEqual(accepted.map(event => event.at), [123, 123])
  assert.deepEqual(calls.map(event => event.id), ['stable:1', 'stable:1', 'stable:2'])
  assert.equal(observer.pendingCount(), 0)
  observer.dispose()
})

test('non-503 errors drop only that callback and never relabel the next event', () => {
  const accepted = [], warnings = []
  const observer = createWorkObserver({ producer: 'p', now: () => 10, warn: message => warnings.push(message), accept(event) {
    if (event.id === 'p:1') throw new Error('invalid host event')
    accepted.push(event)
  } })
  assert.equal(observer.observe('tool'), false)
  assert.equal(observer.observe('toolError'), true)
  assert.deepEqual(accepted.map(event => [event.id, event.type]), [['p:2', 'toolError']])
  assert.equal(warnings.length, 1)
  observer.dispose()
})

test('dispose cancels the observer retry and drops only its in-memory pending callbacks', () => {
  const clock = timerSeam(), accepted = []
  const observer = createWorkObserver({ producer: 'dispose', setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    accept() { throw Object.assign(new Error('busy'), { status: 503 }) } })
  observer.observe('turn')
  observer.observe('message')
  assert.equal(clock.scheduled, true)
  observer.dispose()
  assert.equal(observer.pendingCount(), 0)
  assert.equal(clock.scheduled, false)
  assert.equal(clock.cleared, 1)
  assert.equal(observer.observe('tool'), false)
  clock.fire()
  assert.deepEqual(accepted, [])
})

test('real runtime 503 during export freeze retries both DSH events with their original receipts', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'piggy-dsh-busy-'))
  const statePath = path.join(directory, 'state.json')
  mkdirSync(path.dirname(statePath), { recursive: true })
  writeFileSync(statePath, JSON.stringify(hatchEgg(Date.now())))
  const clock = timerSeam()
  let runtime, releaseFetch, fetchStarted = false
  const nowMs = Date.now()
  try {
    runtime = createGameRuntime({ statePath, now: () => nowMs,
      fetch: () => { fetchStarted = true; return new Promise(resolve => { releaseFetch = resolve }) } })
    const observer = createWorkObserver({ accept: event => runtime.acceptWorkEvent(event), source: 'dsh', producer: 'host-id',
      now: () => nowMs, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    const online = runtime.handle('GET', '/dsh-piggy/extensions/online?force=1')
    while (!fetchStarted) await new Promise(resolve => setImmediate(resolve))

    const exporting = runtime.handle('GET', '/dsh-piggy/save/export')
    assert.equal(observer.observe('turn'), true)
    assert.equal(observer.observe('message'), true)
    assert.equal(observer.pendingCount(), 2)
    assert.throws(() => runtime.dispatchCommand('hatch'), error => error.status === 503)
    assert.equal(clock.scheduled, true)

    releaseFetch({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ extensions: [] }) })
    const [onlineResult, exportResult] = await Promise.all([online, exporting])
    assert.equal(onlineResult.status, 200)
    assert.equal(exportResult.status, 200)
    clock.fire()

    const receipts = JSON.parse(readFileSync(`${statePath}.work-events/receipts.json`, 'utf8')).receipts
    assert.deepEqual(receipts.map(receipt => [receipt.id, receipt.type]), [
      ['host-id:1', 'turn'], ['host-id:2', 'message'],
    ])
    assert.equal(observer.pendingCount(), 0)
    observer.dispose()
  } finally {
    releaseFetch?.({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ extensions: [] }) })
    runtime?.dispose()
    rmSync(directory, { recursive: true, force: true })
  }
})
