// 普通猪微动作的假时钟验收：抢占、状态变化与取消都不能复活旧帧。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attachPigActions, pigActionArt, playPigPet, canPlayPigAction } from '../src/client/pig-actions.js'

/** 一个只记监听器的假节点：能注入事件，也能查监听挂在谁身上。 */
function listenerBag() {
  const handlers = {}
  return {
    handlers,
    addEventListener(type, fn) { (handlers[type] ||= []).push(fn) },
    removeEventListener(type, fn) { if (handlers[type]) handlers[type] = handlers[type].filter(item => item !== fn) },
    fire(type) { (handlers[type] || []).slice().forEach(fn => fn()) },
  }
}

async function fixture(random = () => 0) {
  const attrs = { 'data-art': 'piglet', 'data-mood': 'fine' }
  const scene = listenerBag()
  const pig = Object.assign(listenerBag(), {
    parentNode: scene,
    getAttribute: key => attrs[key] || null,
    setAttribute(key, value) { attrs[key] = value },
    removeAttribute(key) { delete attrs[key] },
  })
  let now = 0, sequence = 0, dragging = false
  const timers = new Map()
  const clock = {
    setTimeout(fn, ms) { const id = ++sequence; timers.set(id, { fn, at: now + ms }); return id },
    clearTimeout(id) { timers.delete(id) },
  }
  globalThis.document = Object.assign(listenerBag(), { hidden: false })
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
  return { pig, scene, attrs, player, advance, timers, drag: (value = true) => { dragging = value },
    visibility: () => globalThis.document.fire('visibilitychange') }
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
    flash() { f.attrs['data-react'] = 'pet' }, render() {}, react() {}, showBubble() {},
    petShy() { playPigPet(f.pig) } }
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
  assert.match(new URL(image.src, 'https://example.test').pathname, /piglet\/blink.png$/)
  f.attrs['data-mood'] = 'sick'; f.attrs['data-illness'] = 'skin:1'
  syncPigArt(f.pig, image, null); assert.match(new URL(image.src, 'https://example.test').pathname, /feedback\/allergy.png$/)
  f.advance(100); syncPigArt(f.pig, image, null)
  assert.match(new URL(image.src, 'https://example.test').pathname, /feedback\/allergy.png$/)
  f.player.dispose()
})

test('micro actions pause the current animation instead of resetting its transform', async () => {
  // 静态守住实机发现的呼吸跳位，取消时也必须恢复播放。
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(new URL('../src/client/css-base.js', import.meta.url), 'utf8')
  // 只暂停「没有反应动画」的元素：摸猪的压扁回弹（data-react="pet"）不能被一起冻住（F2）。
  assert.ok(source.includes('.dp-pig[data-micro-action]:not([data-react]){animation-play-state:paused!important}'))
  assert.ok(!source.includes('.dp-pig[data-micro-action]{animation:none'))
  const f = await fixture(); f.advance(8000)
  assert.equal(f.attrs['data-micro-action'], 'blink')
  f.player.cancel(); assert.equal(f.attrs['data-micro-action'], undefined)
  f.player.dispose()
})

test('pointercancel / lostpointercapture 挂在手势节点上，通知猪自己等于死代码（F4）', async () => {
  const f = await fixture()
  f.advance(8000)
  assert.equal(pigActionArt(f.pig), 'piglet-blink')
  assert.equal((f.pig.handlers.pointercancel || []).length, 0, '猪自己收不到指针捕获事件')
  assert.equal((f.scene.handlers.pointercancel || []).length, 1)
  assert.equal((f.scene.handlers.lostpointercapture || []).length, 1)
  f.scene.fire('pointercancel')
  assert.equal(pigActionArt(f.pig), null, '手势被打断要立刻收帧')
  f.player.dispose()
  assert.equal((f.scene.handlers.pointercancel || []).length, 0, 'dispose 要摘掉监听')
})

test('隐藏时收干净计时器，亮起来再排下一拍（F5 的边界）', async () => {
  const f = await fixture()
  f.advance(8000)
  assert.equal(pigActionArt(f.pig), 'piglet-blink')
  f.advance(100)
  assert.equal(f.timers.size, 1, '只挂着「下一次眨眼」')
  document.hidden = true
  f.visibility()
  assert.equal(f.timers.size, 0, '隐藏期间不排期、不追赶')
  f.advance(60000)
  assert.equal(pigActionArt(f.pig), null)
  document.hidden = false
  f.visibility()
  assert.equal(f.timers.size, 1, '亮起来自己排下一拍')
  f.player.dispose()
})

test('拖动受阻期间仍排下一次眨眼，恢复后不靠 observer 兜底（F5）', async () => {
  // Node 里没有 MutationObserver：这条路径只能靠计时器自己接回去。
  const savedObserver = globalThis.MutationObserver
  globalThis.MutationObserver = undefined
  try {
    const f = await fixture()
    f.advance(8000)
    assert.equal(pigActionArt(f.pig), 'piglet-blink')
    f.drag(true)
    f.advance(100)
    assert.equal(pigActionArt(f.pig), null)
    f.advance(60000)
    assert.equal(pigActionArt(f.pig), null, '受阻期间不播、也不堆积旧帧')
    f.drag(false)
    // 一拍一拍地走：不受阻后 8 秒内必有一拍眨眼，不需要任何属性变化来触发 observer。
    let blinked = false
    for (let i = 0; i < 170 && !blinked; i += 1) { f.advance(100); blinked = pigActionArt(f.pig) === 'piglet-blink' }
    assert.ok(blinked, '解开拖动后自己排上下一拍')
    f.player.dispose()
    assert.equal(f.timers.size, 0)
  } finally { globalThis.MutationObserver = savedObserver }
})
