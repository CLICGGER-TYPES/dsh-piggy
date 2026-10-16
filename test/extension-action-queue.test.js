import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createIo } from '../src/client/io.js'

function setup(t) {
  const requests = []
  const renders = []
  const bubbles = []
  const oldFetch = globalThis.fetch
  const oldWindow = globalThis.window
  globalThis.window = { setInterval() { return 1 }, clearInterval() {} }
  globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
    requests.push({ reject, body: JSON.parse(options.body), finish: (result = { ok: true }) => resolve({ json: async () => result }) })
  })
  t.after(() => { globalThis.fetch = oldFetch; globalThis.window = oldWindow })
  const ctx = { view: { pig: {} }, stopped: false, busy: false, flash() {}, render(view) { renders.push(view) }, showBubble(text) { bubbles.push(text) }, react() {}, content: {}, pomoHint: {} }
  return { ...createIo(ctx), ctx, requests, renders, bubbles }
}
const tick = () => new Promise(resolve => setImmediate(resolve))

test('rapid farm clicks reach the host once each, in order, with no concurrent writes', async t => {
  const { send, requests } = setup(t)
  const work = [0, 1, 2].map(plot => send('ext', { key: 'farm', op: 'harvest', data: { plot } }))
  await tick()
  assert.equal(requests.length, 1)
  requests[0].finish()
  await tick()
  assert.equal(requests.length, 2, 'second click must not disappear behind the busy guard')
  requests[1].finish()
  await tick()
  assert.equal(requests.length, 3)
  requests[2].finish()
  assert.deepEqual((await Promise.all(work)).map(x => x.ok), [true, true, true])
  assert.deepEqual(requests.map(x => x.body.data.plot), [0, 1, 2])
})

test('extension clicks wait for an existing host action and stopping cancels queued requests', async t => {
  const { send, ctx, requests } = setup(t)
  const chat = send('chat', { reason: 'time' })
  assert.equal(await send('pet'), null, 'busy non-extension request keeps the original action barrier')
  const first = send('ext', { key: 'farm', op: 'water', data: { plot: 0 } })
  const second = send('ext', { key: 'farm', op: 'water', data: { plot: 1 } })
  requests[0].finish({ ok: false, reason: 'silent' })
  await chat
  await tick()
  assert.equal(requests.length, 2)
  ctx.stopped = true
  requests[1].finish()
  assert.equal((await first).ok, true)
  assert.equal(await second, null)
  assert.equal(requests.length, 2, 'no writes after unmount')
})

test('a rejected extension operation does not discard the following operation', async t => {
  const { send, requests, ctx } = setup(t)
  const first = send('ext', { key: 'farm', op: 'harvest', data: { plot: 0 } })
  const second = send('ext', { key: 'farm', op: 'harvest', data: { plot: 1 } })
  await tick()
  requests[0].finish({ ok: false, reason: 'cooldown', wait: 1 })
  await first
  await tick()
  assert.equal(requests.length, 2)
  requests[1].finish()
  assert.equal((await second).ok, true)
  assert.equal(ctx.busy, false)
})

test('a network failure releases the barrier and the next extension click still reaches the host', async t => {
  const { send, requests, ctx, bubbles } = setup(t)
  const first = send('ext', { key: 'farm', op: 'water', data: { plot: 0 } })
  const second = send('ext', { key: 'farm', op: 'water', data: { plot: 1 } })
  await tick()
  requests[0].reject(new Error('temporary test network failure'))
  assert.equal(await first, null)
  await tick()
  assert.equal(requests.length, 2)
  requests[1].finish()
  assert.equal((await second).ok, true)
  assert.equal(ctx.busy, false)
  assert.deepEqual(bubbles, ['操作没送到宿主'])
})
