// 普通猪微动作的假时钟验收：抢占、状态变化与取消都不能复活旧帧。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attachPigActions, pigActionArt, playPigPet, canPlayPigAction } from '../src/client/pig-actions.js'

async function fixture(random = () => 0) {
  const attrs = { 'data-art': 'piglet', 'data-mood': 'fine' }
  const pig = { getAttribute: key => attrs[key] || null, setAttribute(key, value) { attrs[key] = value }, removeAttribute(key) { delete attrs[key] }, addEventListener() {}, removeEventListener() {} }
  let now = 0, sequence = 0, dragging = false
  const timers = new Map()
  const clock = {
    setTimeout(fn, ms) { const id = ++sequence; timers.set(id, { fn, at: now + ms }); return id },
    clearTimeout(id) { timers.delete(id) },
  }
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
  const player = attachPigActions({ pig, clock, random, preload: async () => {},
    isStopped: () => false, isDragging: () => dragging, render() {} })
  await Promise.resolve()
  function advance(ms) {
    const end = now + ms
    for (;;) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      now = next[1].at; timers.delete(next[0]); next[1].fn()
    }
    now = end
  }
  return { pig, attrs, player, advance, timers, drag: () => { dragging = true } }
}

test('blink starts at 8 seconds, lasts 100ms; pet preempts without stale callback', async () => {
  const f = await fixture()
  f.advance(7999); assert.equal(pigActionArt(f.pig), null)
  f.advance(1); assert.equal(pigActionArt(f.pig), 'piglet-blink')
  f.advance(50); f.attrs['data-react'] = 'pet'; playPigPet(f.pig)
  assert.equal(pigActionArt(f.pig), 'piglet-shy-pet')
  f.advance(50); assert.equal(pigActionArt(f.pig), 'piglet-shy-pet')
  f.advance(370); assert.equal(pigActionArt(f.pig), null)
  f.player.dispose(); assert.equal(f.timers.size, 0)
})

test('skin, illness, sleep, activity and drag cancel frames and old endings', async () => {
  for (const [key, value] of [['data-art', 'skin-mint'], ['data-mood', 'sick'], ['data-idle', 'nap'], ['data-activity', 'work']]) {
    const f = await fixture(); f.advance(8000)
    f.attrs[key] = value
    assert.equal(pigActionArt(f.pig), null)
    assert.equal(canPlayPigAction(f.pig, 'blink'), false)
    f.advance(100); assert.equal(pigActionArt(f.pig), null)
    f.player.dispose()
  }
  const f = await fixture(); f.advance(8000); f.drag()
  assert.equal(pigActionArt(f.pig), null)
  f.player.dispose()
})

test('hidden pages cancel and do not catch up; repeated pet restarts 420ms', async () => {
  const f = await fixture(); f.attrs['data-react'] = 'pet'
  playPigPet(f.pig); f.advance(300); playPigPet(f.pig)
  f.advance(120); assert.equal(pigActionArt(f.pig), 'piglet-shy-pet')
  document.hidden = true; assert.equal(pigActionArt(f.pig), null)
  f.advance(20000); assert.equal(pigActionArt(f.pig), null)
  f.player.dispose()
})

test('full path framing reuses idle for both approved frames', async () => {
  const { BUILTIN_FRAMING } = await import('../src/client/feedback-framing.js')
  for (const action of ['blink', 'shy-pet']) {
    assert.deepEqual(BUILTIN_FRAMING['pigs/base/piglet/' + action + '.png'], BUILTIN_FRAMING['pigs/base/piglet/idle.png'])
  }
})

test('pet only starts after host accepts; rejected pet and purchases do not start shy', async () => {
  const { createIo } = await import('../src/client/io.js')
  const originalFetch = globalThis.fetch
  const f = await fixture()
  const ctx = { pig: f.pig, view: { pig: {} }, busy: false, stopped: false,
    flash() { f.attrs['data-react'] = 'pet' }, render() {}, react() {}, showBubble() {} }
  globalThis.window = { setInterval() { return 1 }, clearInterval() {} }
  const io = createIo(ctx)
  try {
    globalThis.fetch = async () => ({ json: async () => ({ ok: false, reason: 'silent' }) })
    await io.send('pet'); assert.equal(pigActionArt(f.pig), null)
    globalThis.fetch = async () => ({ json: async () => ({ ok: true }) })
    await io.send('buy'); assert.equal(pigActionArt(f.pig), null)
    await io.send('pet'); assert.equal(pigActionArt(f.pig), 'piglet-shy-pet')
  } finally { globalThis.fetch = originalFetch; f.player.dispose() }
})


test('upper random boundary schedules blink at 16 seconds', async () => {
  const f = await fixture(() => 1)
  f.advance(15999); assert.equal(pigActionArt(f.pig), null)
  f.advance(1); assert.equal(pigActionArt(f.pig), 'piglet-blink')
  f.advance(100); assert.equal(pigActionArt(f.pig), null)
  f.player.dispose()
})

test('shared web/desktop selection restores current illness instead of captured idle', async () => {
  const { syncPigArt } = await import('../src/client/art.js')
  const f = await fixture()
  const image = { src: '', hidden: false, getAttribute() { return this.src }, style: { setProperty() {} } }
  f.advance(8000); syncPigArt(f.pig, image, null)
  assert.match(image.src, /piglet\/blink.png$/)
  f.attrs['data-mood'] = 'sick'; f.attrs['data-illness'] = 'skin:1'
  syncPigArt(f.pig, image, null); assert.match(image.src, /feedback\/allergy.png$/)
  f.advance(100); syncPigArt(f.pig, image, null)
  assert.match(image.src, /feedback\/allergy.png$/)
  f.player.dispose()
})

test('micro actions pause the current animation instead of resetting its transform', async () => {
  // 静态守住实机发现的呼吸跳位，取消时也必须恢复播放。
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(new URL('../src/client/css-base.js', import.meta.url), 'utf8')
  assert.ok(source.includes('.dp-pig[data-micro-action]{animation-play-state:paused!important}'))
  assert.ok(!source.includes('.dp-pig[data-micro-action]{animation:none'))
  const f = await fixture(); f.advance(8000)
  assert.equal(f.attrs['data-micro-action'], 'blink')
  f.player.cancel(); assert.equal(f.attrs['data-micro-action'], undefined)
  f.player.dispose()
})
