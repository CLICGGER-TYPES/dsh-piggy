// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createIo } from '../src/client/io.js'

function context() {
  const bound = []
  const ctx = {
    view: { ok: true, hatched: true, dead: false, pig: { name: 'fixture', coins: 500 }, pending: [], pomodoro: null },
    stopped: false,
    showBubble() {},
    render() { return true },
    fitPanel() {},
    pomoHint: { getAttribute() { return null } },
    content: { querySelector() { return null } },
    bindPresentationIdentity(value) { bound.push(value) },
  }
  return { ctx, bound, io: createIo(ctx) }
}

function browserGlobals(t, fetchImpl, extra = {}) {
  const previousWindow = globalThis.window, previousFetch = globalThis.fetch
  globalThis.window = {
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    ...extra,
  }
  globalThis.fetch = fetchImpl
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousFetch === undefined) delete globalThis.fetch
    else globalThis.fetch = previousFetch
  })
}

function stateResponse(headers) {
  return { ok: true, status: 200, headers: { get: key => headers[key] ?? null },
    json: async () => ({ ok: true, hatched: true, dead: false, pig: { name: 'fixture', coins: 500 }, pending: [], pomodoro: null }) }
}

test('state response binds owner identity headers to this live presentation only', async t => {
  browserGlobals(t, async () => stateResponse({ 'x-dsh-owner-id': 'owner-a', 'x-dsh-pig-id': 'pig-b' }))
  const { io, bound } = context()
  await io.refresh()
  assert.deepEqual(bound, [{ ownerId: 'owner-a', pigId: 'pig-b' }])
})

test('DSH owner responses mark owner mode so the flat cloud form can hide', async t => {
  browserGlobals(t, async () => stateResponse({ 'x-dsh-owner-id': 'owner-a', 'x-dsh-pig-id': 'pig-a' }),
    { __dshPiggyOwnerCloud: { ownerStatus() {} } })
  const { io } = context()
  await io.refresh()
  assert.equal(globalThis.window.__dshPiggyOwnerMode, true)
})

test('a self-expiring poll pause skips the next state request', async t => {
  let calls = 0
  browserGlobals(t, async () => { calls += 1; return stateResponse({}) },
    { __dshPiggyPollPauseUntil: Date.now() + 30_000 })
  const { io } = context()
  await io.refresh()
  assert.equal(calls, 0)
  globalThis.window.__dshPiggyPollPauseUntil = Date.now() - 1
  await io.refresh()
  assert.equal(calls, 1)
})

test('legacy responses stay unbound and a disposed instance ignores late identity metadata', async t => {
  let request = 0, release
  browserGlobals(t, () => request++ === 0
    ? Promise.resolve(stateResponse({}))
    : new Promise(resolve => { release = resolve }))
  const first = context()
  await first.io.refresh()
  assert.deepEqual(first.bound, [], 'legacy v15 response has no owner identity headers')

  const second = context()
  const pending = second.io.refresh()
  second.ctx.stopped = true
  release(stateResponse({ 'x-dsh-owner-id': 'owner-a', 'x-dsh-pig-id': 'pig-a' }))
  await pending
  assert.deepEqual(second.bound, [], 'a late response cannot bind a disposed presentation')
})
