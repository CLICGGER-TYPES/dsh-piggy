import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hatchEgg, say, mood } from '../core.js'
import { createStore } from '../store.js'
import { createIo } from '../src/client/io.js'

test('store reply uses the host clock to refresh activity without a touch operation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-reply-wake-'))
  const now = 1800000000000, pig = hatchEgg(now - 31 * 60_000)
  pig.personality = 'peppy'
  say(pig, 'pigBirthday', now, () => 0)
  const id = pig.dialogue.open.id, pets = pig.stats.pets
  writeFileSync(join(dir, 'state.json'), JSON.stringify(pig))
  const store = createStore(join(dir, 'state.json'), { now: () => now, setTimer: () => 0, clearTimer() {} })
  try {
    assert.notEqual(mood(store.state, now).key, 'sleepy')
    assert.equal(store.reply(id, 0).ok, true)
    assert.equal(store.state.lastActiveAt, now)
    assert.notEqual(mood(store.state, now).key, 'sleepy')
    assert.equal(store.state.stats.pets, pets)
  } finally { store.dispose(); rmSync(dir, { recursive: true, force: true }) }
})

for (const result of [{ ok: true }, { ok: false, reason: 'stale-line' }, { ok: false, reason: 'dead' }]) {
  test('local nap cancellation follows the actual reply result: ' + JSON.stringify(result), async t => {
    const oldFetch = globalThis.fetch, oldWindow = globalThis.window
    t.after(() => { globalThis.fetch = oldFetch; globalThis.window = oldWindow })
    globalThis.window = { setInterval() { return 1 }, clearInterval() {} }
    globalThis.fetch = async () => ({ json: async () => result })
    let naps = 0
    const ctx = { view: { pig: {} }, stopped: false, busy: false, flash() {}, render() {}, showBubble() {}, react() {}, content: {}, pomoHint: {}, cancelNap() { naps++ } }
    await createIo(ctx).send('reply', { line: 1, index: 0 })
    assert.equal(naps, result.ok ? 1 : 0)
  })
}

test('waking a local nap cancels its ending timer and leaves other idle actions alone', async t => {
  const { fakeDom } = await import('./helpers/bundle.js')
  const { attachLife } = await import('../src/client/life.js')
  const oldWindow = globalThis.window, oldDocument = globalThis.document
  t.after(() => { globalThis.window = oldWindow; globalThis.document = oldDocument })
  const dom = fakeDom(), timers = new Map()
  let next = 0
  globalThis.document = dom.document
  globalThis.window = {
    setTimeout(fn, ms) { timers.set(++next, { fn, ms }); return next },
    clearTimeout(id) { timers.delete(id) },
    clearInterval(id) { timers.delete(id) },
  }
  const parent = document.createElement('div'), pig = document.createElement('div'), image = document.createElement('img')
  parent.appendChild(pig)
  pig.setAttribute('data-art', 'piglet')
  const life = attachLife({ pig, pigArt: image, pigEmoji: image, getView: () => ({ hatched: true, pig: {}, dead: false, activity: null, dialogue: { quiet: true } }), isStopped: () => false, isDragging: () => false, isOpen: () => false, isBusy: () => false, desktopShell: () => null, send() {}, burst() {}, showBubble() {} })
  try {
    life.idleNow('nap')
    const nap = [...timers].find(([, timer]) => timer.ms === 4000)?.[0]
    assert.ok(nap, 'the real nap has a scheduled ending')
    assert.equal(pig.getAttribute('data-idle'), 'nap')
    life.cancelNap()
    assert.equal(pig.getAttribute('data-idle'), null)
    assert.equal(timers.has(nap), false, 'the old nap cannot later end a newer action')
    life.idleNow('scratch')
    life.cancelNap()
    assert.equal(pig.getAttribute('data-idle'), 'scratch', 'waking sleep does not stop other idle actions')
  } finally { life.dispose() }
  assert.equal(timers.size, 0, 'unmount releases the idle timer too')
})
