import test from 'node:test'
import assert from 'node:assert/strict'
import { attachPetSnap, beginPetSnap, releasePetSnap, cancelPetSnap, confirmPetSnap } from '../src/client/pet-snap.js'
import { setPetHandEnabled } from '../src/client/pet-hand-settings.js'
import { setFeelMode } from '../src/client/feel/settings.js'

async function fixture() {
  const saved = new Map(['window', 'document', 'Image', 'MutationObserver', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'createImageBitmap'].map(k => [k, globalThis[k]]))
  let time = 0, id = 0, valid = true, disposed = false
  const rafs = new Map(), attrs = new Map(), store = new Map(), draws = []
  const canvas = { hidden: true, style: { setProperty() {} }, setAttribute() {}, remove() {},
    getContext() { return { clearRect() { draws.length = 0 }, drawImage(image, ...coords) { draws.push({ src: image.src, coords }) } } } }
  const pig = { getAttribute: k => attrs.get(k) ?? null, setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k), querySelector: () => ({ appendChild() {} }) }
  globalThis.performance = { now: () => time }
  globalThis.requestAnimationFrame = fn => { rafs.set(++id, fn); return id }
  globalThis.cancelAnimationFrame = i => rafs.delete(i)
  globalThis.document = { hidden: false, createElement: () => canvas, addEventListener() {}, removeEventListener() {} }
  globalThis.window = { localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }
  globalThis.createImageBitmap = async (image, x) => ({ src: image.src + '#' + (x / 112), width: 112, height: 112, close() {} })
  globalThis.Image = class { decode() { return Promise.resolve() } }
  globalThis.MutationObserver = class { observe() {} disconnect() {} }
  const player = attachPetSnap({ pig, isStopped: () => disposed, isDragging: () => false, canPlay: () => valid, cancelMicro() {}, render() {} })
  await new Promise(resolve => setImmediate(resolve))
  function step(ms) { time += ms; const pending = [...rafs.values()]; rafs.clear(); pending.forEach(fn => fn(time)) }
  return { pig, canvas, attrs, draws, rafs, step, invalidate() { valid = false }, cleanup() {
    player.dispose(); disposed = true
    for (const [k, v] of saved) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v }
  } }
}

test('original GIF frames keep their exact sequence, timing and constant placement', async () => {
  const f = await fixture()
  try {
    assert.equal(f.rafs.size, 0)
    assert.equal(beginPetSnap(f.pig), true)
    for (let i = 1; i < 5; i += 1) {
      f.step(60)
      assert.match(f.draws[0].src, /reference\.webp/)
      assert.ok(f.draws[0].src.endsWith('#' + i))
      assert.deepEqual(f.draws[0].coords, [100, 76, 280, 280])
    }
    f.step(60)
    assert.ok(f.draws[0].src.endsWith('#0'), '300 ms starts a second original loop')
    assert.deepEqual(f.draws[0].coords, [100, 76, 280, 280])
    assert.equal(f.canvas.hidden, false)
    f.step(60); releasePetSnap(f.pig); f.step(239)
    assert.equal(f.canvas.hidden, false, 'release finishes the current rub')
    f.step(1)
    assert.equal(f.canvas.hidden, true)
    assert.equal(f.rafs.size, 0)
  } finally { f.cleanup() }
})

test('quick click takes exactly one 300 ms loop; panel actions can repeat', async () => {
  const f = await fixture()
  try {
    beginPetSnap(f.pig); releasePetSnap(f.pig)
    f.pig.setAttribute('data-react', 'pet')
    f.step(299); assert.equal(f.canvas.hidden, false)
    f.step(1); assert.equal(f.canvas.hidden, true)
    assert.equal(f.pig.getAttribute('data-react'), null, 'do not expose the old 420 ms pet pose after the 300 ms clip')
    assert.equal(confirmPetSnap(f.pig), true, 'a new panel action can start immediately')
    f.step(299); assert.equal(f.canvas.hidden, false)
    f.step(1); assert.equal(f.canvas.hidden, true)
  } finally { f.cleanup() }
})

test('repeated presses restart one loop and cancellation leaves no scheduled frames', async () => {
  const f = await fixture()
  try {
    beginPetSnap(f.pig); releasePetSnap(f.pig); f.step(120)
    beginPetSnap(f.pig); releasePetSnap(f.pig)
    assert.equal(f.rafs.size, 1)
    f.step(299); assert.equal(f.canvas.hidden, false)
    f.step(1); assert.equal(f.canvas.hidden, true)
    beginPetSnap(f.pig); cancelPetSnap(f.pig)
    assert.equal(f.rafs.size, 0)
    assert.equal(f.canvas.hidden, true)
  } finally { f.cleanup() }
})

test('long holds finish only the current cycle after release', async () => {
  const f = await fixture()
  try {
    beginPetSnap(f.pig); f.step(10100); releasePetSnap(f.pig)
    f.step(100)
    assert.equal(f.canvas.hidden, true)
    assert.equal(f.rafs.size, 0)
  } finally { f.cleanup() }
})

test('hand setting redraws only the hand; disabling motion cancels; skin changes and drag restore art', async () => {
  const f = await fixture()
  try {
    beginPetSnap(f.pig); f.step(300)
    assert.equal(f.draws.length, 1)
    assert.match(f.draws[0].src, /reference\.webp/)
    setPetHandEnabled(false)
    assert.equal(f.draws.length, 1)
    assert.match(f.draws[0].src, /piglet\/idle\.png$/)
    assert.deepEqual(f.draws[0].coords, [128, 128, 256, 256])
    f.step(120)
    assert.deepEqual(f.draws[0].coords, [128, 132, 256, 256])
    assert.equal(f.canvas.hidden, false)
    setFeelMode('off')
    assert.equal(f.canvas.hidden, true)
    assert.equal(beginPetSnap(f.pig), false)
    setFeelMode('full'); beginPetSnap(f.pig)
    cancelPetSnap(f.pig)
    assert.equal(f.attrs.has('data-pet-snap'), false)
    beginPetSnap(f.pig); f.invalidate(); f.step(50)
    assert.equal(f.canvas.hidden, true)
    assert.equal(f.rafs.size, 0)
  } finally { f.cleanup() }
})


test('a slow successful direct-pet response never replays, and the flag is not sent to the host', async () => {
  const { createIo } = await import('../src/client/io.js')
  const oldFetch = globalThis.fetch
  const f = await fixture()
  window.setInterval = () => 1
  window.clearInterval = () => {}
  let resolveResponse, body, animations = 0
  const ctx = { busy: false, stopped: false, view: { pig: {} }, flash() {}, render() {},
    petShy() { animations += 1 }, react() {}, showBubble() {} }
  const io = createIo(ctx)
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body)
    return new Promise(resolve => { resolveResponse = resolve })
  }
  try {
    beginPetSnap(f.pig); releasePetSnap(f.pig)
    const pending = io.send('pet', { part: 'head' }, { petAnimated: true })
    f.step(6000)
    assert.equal(f.canvas.hidden, true)
    assert.deepEqual(body, { action: 'pet', part: 'head' })
    resolveResponse({ json: async () => ({ ok: true }) })
    await pending
    assert.equal(animations, 0)
    const panel = io.send('pet')
    resolveResponse({ json: async () => ({ ok: true }) })
    await panel
    assert.equal(animations, 1)
  } finally { globalThis.fetch = oldFetch; f.cleanup() }
})
