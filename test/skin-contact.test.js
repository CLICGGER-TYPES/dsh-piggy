// @ts-check
/**
 * A-2/A-3: 摸摸小手的接触点。
 *
 * 覆盖三层：纯几何（原图 → framed 布局坐标、取景换算、镜像）、本机偏好与皮肤包声明的优先级、
 * 以及真的用手势路径驱动 pet-snap，断言手层的绘制坐标确实平移到了新落点。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureSkins, registerCustomSkin, skinView } from '../core.js'
import { normalizeSkins } from '../src/client/normalize-skins.js'
import { petPose, framedPetBounds } from '../src/client/pet-snap-geometry.js'
import {
  autoSkinContact, cancelSkinContactPreview, clampSkinContact, clearSkinContact, effectiveSkinContact, endSkinContactPreview, framedSkinPoint,
  handScaleRatio, onPetSnapPreview, PET_CONTACT_HEIGHT, PET_PREVIEW_KEY, PET_PREVIEW_TTL_MS, readSkinContacts,
  setDeclaredSkinContact, setSkinContactOverride, skinContactShift, skinContactSource, startSkinContactPreview,
  syncDeclaredSkinContacts, unframedSkinPoint,
} from '../src/client/skin-contact.js'

/** pet-snap 用 localStorage 读本机偏好（storage.js 在浏览器里读 window.localStorage）。 */
function localStore() {
  const saved = globalThis.window
  const store = new Map()
  globalThis.window = { localStorage: {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  } }
  return {
    store,
    restore() { if (saved === undefined) delete globalThis.window; else globalThis.window = saved },
  }
}

test('contact only accepts two finite numbers inside the artwork box', async () => {
  const { normalizeSkinContact } = await import('../src/client/skin-contact.js')
  assert.deepEqual(normalizeSkinContact({ x: 0, y: 0 }), { x: 0, y: 0 })
  assert.deepEqual(normalizeSkinContact({ x: 1, y: 1 }), { x: 1, y: 1 })
  assert.deepEqual(normalizeSkinContact({ x: 0.5, y: 0.125 }), { x: 0.5, y: 0.125 })
  assert.deepEqual(normalizeSkinContact({ x: 0.12345678, y: 0.9 }), { x: 0.1235, y: 0.9 }, 'stored with 4 decimals')
  for (const bad of [null, undefined, 0.5, 'x', [], [0.5, 0.5], {}, { x: 0.5 }, { y: 0.5 },
    { x: NaN, y: 0.5 }, { x: Infinity, y: 0.5 }, { x: -0.01, y: 0.5 }, { x: 0.5, y: 1.01 },
    { x: '0.5', y: 0.5 }, { x: true, y: false }]) {
    assert.equal(normalizeSkinContact(bad), null, JSON.stringify(bad))
  }
})

test('framing maps the authored point into the layout box, and back', () => {
  assert.deepEqual(framedSkinPoint({ x: 0.5, y: 0.5 }), { x: 0.5, y: 0.5 })
  assert.deepEqual(framedSkinPoint({ x: 0.25, y: 0.5 }, 2, 0, 0), { x: 0, y: 0.5 }, 'zoom keeps the box centre')
  assert.deepEqual(framedSkinPoint({ x: 0.5, y: 0.5 }, 1, 12, -6), { x: 0.62, y: 0.44 }, 'framing offsets are percent')
  for (const [zoom, x, y] of [[1, 0, 0], [1.8, -12, 7], [2.4, 20, -15]]) {
    const point = { x: 0.31, y: 0.08 }
    const back = unframedSkinPoint(framedSkinPoint(point, zoom, x, y), zoom, x, y)
    assert.ok(Math.abs(back.x - point.x) < 1e-9 && Math.abs(back.y - point.y) < 1e-9)
  }
  assert.deepEqual(unframedSkinPoint({ x: 0.5, y: 0.5 }, 0, 0, 0), { x: 0.5, y: 0.5 }, 'a broken zoom is ignored')
  assert.deepEqual(clampSkinContact({ x: -0.2, y: 1.4 }), { x: 0, y: 1 })
})

test('a skin without a contact keeps the exact automatic estimate', () => {
  const bounds = { left: 0.08, top: 0.08, right: 0.92, bottom: 0.92 }
  assert.deepEqual(autoSkinContact(bounds), { x: 0.5, y: 0.08 }, 'ink centre + ink top line')
  assert.deepEqual(skinContactShift(bounds, null), { dx: 0, dy: 0 })
  assert.deepEqual(skinContactShift(bounds, undefined), { dx: 0, dy: 0 })
  assert.ok(Math.abs(handScaleRatio(bounds) - 0.84 / PET_CONTACT_HEIGHT) < 1e-12)
  // 接触点就是自动基准时同样是 0：再点一次不会把手挪开。
  assert.deepEqual(skinContactShift(bounds, autoSkinContact(bounds)), { dx: 0, dy: 0 })
})

test('a declared contact only shifts the hand by the gap from the automatic anchor', () => {
  const bounds = { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 }
  const shift = skinContactShift(bounds, { x: 0.35, y: 0.42 })
  assert.ok(Math.abs(shift.dx - -0.15) < 1e-12)
  assert.ok(Math.abs(shift.dy - 0.32) < 1e-12)
})

test('per-device calibration wins over the pack declaration and can be cleared', () => {
  const local = localStore()
  try {
    const art = 'custom-berry'
    assert.equal(effectiveSkinContact(art), null)
    assert.equal(skinContactSource(art), 'auto')
    assert.equal(effectiveSkinContact('piglet'), null, 'default pig is never calibrated')
    assert.equal(effectiveSkinContact('../evil'), null)

    setDeclaredSkinContact(art, { x: 0.5, y: 0.2 })
    assert.deepEqual(effectiveSkinContact(art), { x: 0.5, y: 0.2 })
    assert.equal(skinContactSource(art), 'pack')

    setSkinContactOverride(art, { x: 0.4, y: 0.3 })
    assert.deepEqual(effectiveSkinContact(art), { x: 0.4, y: 0.3 })
    assert.equal(skinContactSource(art), 'local')

    assert.equal(setSkinContactOverride(art, { x: 2, y: 0.3 }), false, 'a bad value is refused')
    assert.deepEqual(effectiveSkinContact(art), { x: 0.4, y: 0.3 }, 'the existing calibration is kept')
    assert.equal(setDeclaredSkinContact(art, { x: 0.5, y: 0.2 }), true, 're-import keeps the declaration')
    setSkinContactOverride(art, null)
    assert.equal(skinContactSource(art), 'pack', 'clearing the calibration keeps the pack declaration')

    clearSkinContact(art)
    assert.equal(effectiveSkinContact(art), null)
    assert.equal(skinContactSource(art), 'auto')
  } finally { local.restore() }
})

test('garbage or foreign local data falls back to the automatic estimate', () => {
  const local = localStore()
  try {
    local.store.set('dsh-piggy:skin-contacts', '{not json')
    assert.deepEqual(readSkinContacts(), { overrides: {}, declared: {}, auto: {} })
    local.store.set('dsh-piggy:skin-contacts', JSON.stringify({
      overrides: { 'custom-berry': { x: 9, y: 0 }, 'career-chef': { x: 0.5, y: 0.1 }, '../x': { x: 0.5, y: 0.5 } },
      declared: 'nope',
    }))
    assert.deepEqual(readSkinContacts().overrides, { 'career-chef': { x: 0.5, y: 0.1 } })
    assert.deepEqual(readSkinContacts().declared, {})
    assert.equal(effectiveSkinContact('custom-berry'), null)
  } finally { local.restore() }
})

test('the save keeps a valid pack contact and never drops the skin for a broken one', async () => {
  const { hatchEgg } = await import('../core.js')
  const now = 1_800_000_000_000
  const state = hatchEgg(now)
  const scenes = ['idle', 'eat', 'bathe', 'play', 'pet']
  assert.equal(registerCustomSkin(state, { key: 'berry', label: '莓果猪', scenes, contact: { x: 0.5, y: 0.12 } }, now).ok, true)
  assert.deepEqual(state.customSkins[0].contact, { x: 0.5, y: 0.12 })
  const entry = skinView(state).entries.find(skin => skin.key === 'berry')
  assert.deepEqual(entry.contact, { x: 0.5, y: 0.12 }, 'the snapshot exports the declared contact')

  // 旧存档/坏字段：皮肤还在，只是没有接触点（不需要提升存档版本）。
  state.customSkins[0].contact = { x: 'left', y: 0.5 }
  ensureSkins(state)
  assert.equal(state.customSkins[0].key, 'berry')
  assert.equal(state.customSkins[0].contact, undefined)
  assert.equal(skinView(state).entries.find(skin => skin.key === 'berry').contact, null)
  // 内置皮肤没有声明，一律 null。
  assert.equal(skinView(state).entries.find(skin => skin.key === 'default').contact, null)
  assert.equal(skinView(state).entries.find(skin => skin.key === 'mint').contact, null)
})

// ---------- 快照 → 本机声明缓存：换设备/载入同步存档也能拿回声明 ----------

test('normalizeSkins keeps a strictly valid contact and marks whether the host stated one', () => {
  const skins = normalizeSkins({ current: 'berry', entries: [
    { key: 'berry', label: '莓果猪', art: 'custom-berry', contact: { x: 0.5, y: 0.2 } },
    { key: 'mint', label: '薄荷猪', art: 'skin-mint', contact: { x: 2, y: 0.1 } },
    { key: 'legacy', label: '旧包', art: 'custom-legacy' },
    { key: 'builtin', label: '默认小猪', art: 'piglet', contact: null },
  ] })
  const byKey = key => skins.entries.find(entry => entry.key === key)
  assert.deepEqual(byKey('berry').contact, { x: 0.5, y: 0.2 }, 'a declared contact survives the client normalizer')
  assert.equal(byKey('mint').contact, null, 'an invalid contact is dropped, the skin stays')
  assert.equal(byKey('mint').art, 'skin-mint')
  assert.equal(byKey('legacy').contact, null)
  assert.equal(byKey('legacy').contactStated, false, 'old host never sent the field')
  assert.equal(byKey('builtin').contactStated, true, 'new host explicitly says null')
})

test('a snapshot declaration lands in the local cache and really moves the hand', async () => {
  const f = await handFixture()
  try {
    const skins = normalizeSkins({ entries: [{ key: 'berry', art: 'custom-berry', contact: { x: 0.5, y: 0.12 } }] })
    // 归一化快照就把声明落到本机（换设备/载入存档也能拿回）。
    assert.deepEqual(effectiveSkinContact('custom-berry'), { x: 0.5, y: 0.12 })
    assert.equal(syncDeclaredSkinContacts(skins), false, 'a repeat sync does not rewrite localStorage')

    assert.equal(f.begin(), true)
    const drawn = anchor(f)
    const auto = baseline(INK)
    near(drawn.x, auto.x, 'same x: the hand stays centred')
    near(drawn.y, auto.y + 0.04, 'the snapshot contact moves the real hand by (0.12 - 0.08)')
    f.release()
  } finally { f.cleanup() }
})

test('恢复自动 is an explicit local choice: poll snapshots cannot put the pack contact back', async () => {
  const f = await handFixture()
  try {
    const skins = normalizeSkins({ entries: [{ key: 'berry', art: 'custom-berry', contact: { x: 0.3, y: 0.2 } }] })
    syncDeclaredSkinContacts(skins)
    assert.equal(skinContactSource('custom-berry'), 'pack')

    clearSkinContact('custom-berry') // 用户点「恢复自动」
    assert.equal(skinContactSource('custom-berry'), 'auto')
    for (let i = 0; i < 3; i += 1) assert.equal(syncDeclaredSkinContacts(skins), false)
    assert.equal(effectiveSkinContact('custom-berry'), null, 'the pack declaration is not restored')

    // 面板重绘/轮询后再摸摸：手就是自动落点。
    assert.equal(f.begin(), true)
    const drawn = anchor(f)
    const auto = baseline(INK)
    near(drawn.x, auto.x, 'auto x after restore')
    near(drawn.y, auto.y, 'auto y after restore')

    // 之后用户手动校准仍然可以覆盖。
    setSkinContactOverride('custom-berry', { x: 0.5, y: 0.5 })
    assert.equal(skinContactSource('custom-berry'), 'local')
    near(anchor(f).y, auto.y + 0.42, 'manual calibration still takes over')
    f.release()
  } finally { f.cleanup() }
})

test('a new declaration replaces the old one; a legacy pack never wipes the cache', () => {
  const local = localStore()
  try {
    syncDeclaredSkinContacts({ entries: [{ art: 'custom-berry', contact: { x: 0.2, y: 0.3 }, contactStated: true }] })
    assert.deepEqual(effectiveSkinContact('custom-berry'), { x: 0.2, y: 0.3 })
    syncDeclaredSkinContacts({ entries: [{ art: 'custom-berry', contact: { x: 0.4, y: 0.1 }, contactStated: true }] })
    assert.deepEqual(effectiveSkinContact('custom-berry'), { x: 0.4, y: 0.1 }, 'the re-imported pack wins')

    assert.equal(syncDeclaredSkinContacts({ entries: [{ art: 'custom-berry', contact: null }] }), false, 'old host: no field, no touch')
    assert.deepEqual(effectiveSkinContact('custom-berry'), { x: 0.4, y: 0.1 })
    assert.equal(syncDeclaredSkinContacts({ entries: [{ art: 'custom-berry', contact: null, contactStated: true }] }), true, 'new host: explicit null clears a stale declaration')
    assert.equal(effectiveSkinContact('custom-berry'), null)
  } finally { local.restore() }
})

test('the old local format (no auto marker) still reads', () => {
  const local = localStore()
  try {
    local.store.set('dsh-piggy:skin-contacts', JSON.stringify({ overrides: { 'custom-berry': { x: 0.3, y: 0.2 } } }))
    assert.deepEqual(readSkinContacts().auto, {})
    assert.deepEqual(effectiveSkinContact('custom-berry'), { x: 0.3, y: 0.2 })
    assert.equal(skinContactSource('custom-berry'), 'local')
  } finally { local.restore() }
})

// ---------- 真手势路径：attachPetSnap 按接触点画手 ----------

async function handFixture(art = 'custom-berry') {
  const { attachPetSnap, beginPetSnap, releasePetSnap } = await import('../src/client/pet-snap.js')
  const { artSource } = await import('../src/client/art-path.js')
  const savedKeys = ['window', 'document', 'Image', 'MutationObserver', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'createImageBitmap']
  const saved = new Map(savedKeys.map(key => [key, /** @type {any} */ (globalThis)[key]]))
  let time = 0, id = 0
  const rafs = new Map(), attrs = new Map(), store = new Map(), translates = [], windowListeners = new Map()
  const css = new Map(), props = new Map()
  const body = { style: { setProperty(k, v) { css.set(k, v) }, removeProperty(k) { css.delete(k) } } }
  const parent = { appendChild() {} }
  const src = artSource(art)
  const image = {
    complete: true, naturalWidth: 256, naturalHeight: 256,
    getAttribute: () => src,
    style: { getPropertyValue: key => props.get(key) ?? '', setProperty: (key, value) => props.set(key, value) },
  }
  const canvas = {
    hidden: true, style: { setProperty() {} }, setAttribute() {}, remove() {},
    getContext() {
      return {
        save() {}, restore() {}, setTransform() {}, rotate() {}, scale() {}, clearRect() {},
        translate(x, y) { translates.push({ x, y }) },
        // pet-snap 的兜底探针读不到像素时退回通用锚点：这里故意不给 getImageData。
        drawImage() {},
      }
    },
  }
  const pig = {
    getAttribute: key => attrs.get(key) ?? null,
    setAttribute: (key, value) => attrs.set(key, value),
    removeAttribute: key => attrs.delete(key),
    querySelector: key => (key === '.dp-pig-body' ? body : parent),
  }
  attrs.set('data-art', art)
  const global = /** @type {any} */ (globalThis)
  global.performance = { now: () => time }
  global.requestAnimationFrame = fn => { rafs.set(++id, fn); return id }
  global.cancelAnimationFrame = index => rafs.delete(index)
  global.document = {
    hidden: false, createElement: () => canvas, addEventListener() {}, removeEventListener() {},
  }
  global.window = {
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    // 桌面版两个窗口靠真实 storage 事件：挂上监听，测试直接触发它。
    addEventListener(type, fn) { windowListeners.set(type, fn) },
    removeEventListener(type, fn) { if (windowListeners.get(type) === fn) windowListeners.delete(type) },
    dispatchEvent() {},
  }
  global.createImageBitmap = async (img, x) => ({ src: img.src + '#' + (x / 256), width: 256, height: 256, close() {} })
  global.Image = class { decode() { return Promise.resolve() } }
  global.MutationObserver = class { observe() {} disconnect() {} }
  const player = attachPetSnap({ pig, pigArt: image, isStopped: () => false, isDragging: () => false, canPlay: () => true, cancelMicro() {}, render() {} })
  await new Promise(resolve => setImmediate(resolve))
  return {
    pig, image, props, store, translates, window: global.window, document: global.document,
    begin: () => beginPetSnap(pig),
    release: () => releasePetSnap(pig),
    /** 真·另一个窗口的 storage 事件：写值 + 触发本窗口挂上的 storage 监听（不是本地回调）。 */
    remotePreview(art, action, at = Date.now(), id = 'panel') {
      const raw = JSON.stringify({ id, art, action, at })
      store.set(PET_PREVIEW_KEY, raw)
      windowListeners.get('storage')?.({ key: PET_PREVIEW_KEY, newValue: raw })
    },
    /** 坏载荷：也走同一条 storage 监听。 */
    firePreviewRaw(raw) {
      store.set(PET_PREVIEW_KEY, raw)
      windowListeners.get('storage')?.({ key: PET_PREVIEW_KEY, newValue: raw })
    },
    step(ms) { time += ms; const pending = [...rafs.values()]; rafs.clear(); pending.forEach(fn => fn(time)) },
    cleanup() {
      player.dispose()
      for (const [key, value] of saved) {
        if (value === undefined) delete (/** @type {any} */ (globalThis)[key])
        else (/** @type {any} */ (globalThis)[key] = value)
      }
    },
  }
}

/** 手层当前的锚点：draw 里 translate 的就是手的位置（每次 draw 记一次）。 */
function anchor(fixture) {
  const last = fixture.translates[fixture.translates.length - 1]
  fixture.translates.length = 0
  assert.ok(last !== undefined, 'the hand was drawn')
  return { x: last.x, y: last.y }
}

function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-12, message + ': ' + actual + ' vs ' + expected)
}

/** 接入前的手层落点（自动估计），含第 0 帧的姿态偏移；用来证明普通皮肤逐像素没变。 */
function baseline(bounds) {
  const ratio = handScaleRatio(bounds)
  return {
    x: (bounds.left + bounds.right) / 2 - 59 * ratio,
    y: bounds.bottom - 109.453125 * ratio + petPose(0).handY * ratio,
  }
}

const INK = framedPetBounds([.08, .08, .92, .92], 1, 0, 0)

test('an uncalibrated skin keeps the pre-existing hand anchor to the pixel', async () => {
  const f = await handFixture()
  try {
    assert.equal(f.begin(), true)
    const drawn = anchor(f)
    const want = baseline(INK)
    near(drawn.x, want.x, 'x is unchanged')
    near(drawn.y, want.y, 'y is unchanged')
    f.release()
  } finally { f.cleanup() }
})

test('a calibrated contact really moves the drawn hand, and live edits re-drop it', async () => {
  const f = await handFixture()
  try {
    setSkinContactOverride('custom-berry', { x: 0.5, y: 0.12 })
    assert.equal(f.begin(), true)
    const auto = baseline(INK)
    const first = anchor(f)
    near(first.x, auto.x, 'same x: the hand stays centred')
    near(first.y, auto.y + 0.04, 'y moves by (0.12 - 0.08) layout units')

    // 皮肤页拖动时：不松手、不重按，正在播的手立刻跟着新接触点走。
    setSkinContactOverride('custom-berry', { x: 0.3, y: 0.5 })
    const second = anchor(f)
    near(second.x, auto.x - 0.2, 'x follows the dragged point')
    near(second.y, auto.y + 0.42, 'y follows the dragged point')

    // 恢复自动：手回到原落点。
    clearSkinContact('custom-berry')
    const third = anchor(f)
    near(third.x, auto.x, 'auto x restored')
    near(third.y, auto.y, 'auto y restored')
    f.release()
  } finally { f.cleanup() }
})

test('framing zoom and offset are applied before the contact is used', async () => {
  const f = await handFixture()
  try {
    setSkinContactOverride('custom-berry', { x: 0.3, y: 0.2 })
    f.props.set('--art-zoom', '2')
    f.props.set('--art-x', '10')
    f.props.set('--art-y', '5')
    assert.equal(f.begin(), true)
    const bounds = framedPetBounds([.08, .08, .92, .92], 2, 10, 5)
    const contact = { x: 0.3, y: 0.2 }
    const ratio = handScaleRatio(bounds)
    // 同一个 normalized 点在取景后落到 framedSkinPoint(contact)，手跟着走到那里。
    const target = framedSkinPoint(contact, 2, 10, 5)
    const autoContact = autoSkinContact(bounds)
    const drawn = anchor(f)
    near(drawn.x, (bounds.left + bounds.right) / 2 - 59 * ratio + target.x - autoContact.x, 'framed x')
    near(drawn.y, bounds.bottom - 109.453125 * ratio + petPose(0).handY * ratio + target.y - autoContact.y, 'framed y')
    f.release()
  } finally { f.cleanup() }
})

test('walking to the right mirrors the artwork and the hand together', async () => {
  const f = await handFixture()
  try {
    setSkinContactOverride('custom-berry', { x: 0.3, y: 0.12 })
    f.pig.setAttribute('data-walk', 'right')
    assert.equal(f.begin(), true)
    const auto = baseline(INK)
    // 画布坐标仍是未镜像的布局坐标，镜像交给 CSS（.dp-pet-snap 与 .dp-pig-img 同步 scaleX(-1)），
    // 所以「小猪身上 30% 的位置」翻过来以后手也落到对称的那一侧。
    const drawn = anchor(f)
    near(drawn.x, auto.x - 0.2, 'the shift is authored in the unmirrored box')
    near(drawn.y, auto.y + 0.04, 'mirroring does not move the hand vertically')
    f.release()
  } finally { f.cleanup() }
})

// ---------- 跨窗口纯视觉预览：面板窗口按一下，猪窗口真的播 ----------

test('a preview event from the other window really presses the hand (real storage listener)', async () => {
  const f = await handFixture()
  try {
    // 模拟桌面版：面板窗口写 localStorage，猪窗口只收到 storage 事件（不是本地回调）。
    f.remotePreview('custom-berry', 'press', Date.now(), 'panel-1')
    assert.equal(f.pig.getAttribute('data-pet-snap'), 'true', 'the pig window starts the hand')
    const drawn = anchor(f)
    near(drawn.x, baseline(INK).x, 'the preview hand uses the same contact anchor')

    f.remotePreview('custom-berry', 'release', Date.now(), 'panel-2')
    for (let i = 0; i < 6; i += 1) f.step(60)
    assert.equal(f.pig.getAttribute('data-pet-snap'), null, 'a full 5×60ms cycle after release')
  } finally { f.cleanup() }
})

test('a preview press in the previous release tail restarts the cycle', async () => {
  const f = await handFixture()
  try {
    assert.equal(startSkinContactPreview('custom-berry'), true)
    f.step(100)
    endSkinContactPreview() // the first cycle would stop at t=300
    f.step(100) // t=200: release tail, active but no longer held
    assert.equal(f.pig.getAttribute('data-pet-snap'), 'true')

    assert.equal(startSkinContactPreview('custom-berry'), true)
    endSkinContactPreview()
    f.step(150) // t=350: a restarted cycle is still pressed
    assert.equal(f.pig.getAttribute('data-pet-snap'), 'true', 'the new press restarted the cycle')
    f.step(200) // t=550: the restarted 300 ms cycle has finished
    assert.equal(f.pig.getAttribute('data-pet-snap'), null)
  } finally {
    cancelSkinContactPreview()
    f.cleanup()
  }
})

test('a preview press cannot steal a genuine held press on the pig', async () => {
  const f = await handFixture()
  try {
    assert.equal(f.begin(), true, 'the player is really holding the pig')
    f.remotePreview('custom-berry', 'press')
    f.remotePreview('custom-berry', 'release')
    for (let i = 0; i < 10; i += 1) f.step(60)
    assert.equal(f.pig.getAttribute('data-pet-snap'), 'true', 'the real hold keeps the hand down past one cycle')

    f.release()
    for (let i = 0; i < 6; i += 1) f.step(60)
    assert.equal(f.pig.getAttribute('data-pet-snap'), null, 'the real release still finishes normally')
  } finally { f.cleanup() }
})

test('previews for another skin, stale notices and junk are refused', async () => {
  const f = await handFixture()
  try {
    f.remotePreview('skin-mint', 'press')
    assert.equal(f.pig.getAttribute('data-pet-snap'), null, 'another art never presses this pig')
    assert.equal(f.translates.length, 0, 'nothing was drawn')

    f.remotePreview('custom-berry', 'press', Date.now() - PET_PREVIEW_TTL_MS - 1)
    assert.equal(f.pig.getAttribute('data-pet-snap'), null, 'a stale notice is ignored')
    assert.equal(f.translates.length, 0)

    // 坏 JSON / 未知动作：走同一条 storage 监听，也不能播。
    f.firePreviewRaw('{oops')
    f.remotePreview('custom-berry', 'tap')
    assert.equal(f.pig.getAttribute('data-pet-snap'), null, 'an unknown action is refused')
  } finally { f.cleanup() }
})

test('a held preview is leased: renewal keeps it, a silent hold releases itself', async () => {
  const f = await handFixture()
  try {
    f.remotePreview('custom-berry', 'press')
    assert.equal(f.pig.getAttribute('data-pet-snap'), 'true')
    // pointermove 续约（实际发的也是 press）：每 2 秒一次，超过单个 lease 也不松。
    for (let i = 0; i < 12; i += 1) {
      f.step(500)
      if (i % 4 === 3) f.remotePreview('custom-berry', 'press', Date.now(), 'renew-' + i)
    }
    assert.equal(f.pig.getAttribute('data-pet-snap'), 'true', 'renewed holds stay pressed')

    // 不再续约：4 秒租约到期自己松手，之后完整播完这一轮。
    for (let i = 0; i < 20; i += 1) f.step(500)
    assert.equal(f.pig.getAttribute('data-pet-snap'), null, 'the lease auto-releases without renewals')
  } finally { f.cleanup() }
})

test('release and unmount clean the preview up; only a local preview key is written', async () => {
  const f = await handFixture()
  let cleaned = false
  try {
    // DSH 单窗口：同一窗口里本地补发（同窗口收不到自己的 storage 事件）。
    assert.equal(startSkinContactPreview('custom-berry'), true)
    assert.equal(f.pig.getAttribute('data-pet-snap'), 'true')
    anchor(f) // 按下的那一帧真的画了手，并把计数清零。
    assert.deepEqual([...f.store.keys()], [PET_PREVIEW_KEY], 'no game action, save or reward key is written')

    endSkinContactPreview()
    for (let i = 0; i < 6; i += 1) f.step(60)
    assert.equal(f.pig.getAttribute('data-pet-snap'), null, 'release plays the cycle out and stops')
    f.translates.length = 0
    for (let i = 0; i < 3; i += 1) f.step(60)
    assert.equal(f.translates.length, 0, 'no extra frames after the cycle')

    // 卸载（面板重新渲染/切页签）：面板那边一收，手里的预览也不能一直按着。
    startSkinContactPreview('custom-berry')
    assert.equal(f.pig.getAttribute('data-pet-snap'), 'true')
    // 页面隐藏：pet-snap 自己的 visibility 守卫直接收掉（不再继续画手）。
    f.document.hidden = true
    f.step(60)
    assert.equal(f.pig.getAttribute('data-pet-snap'), null, 'a hidden page drops the held preview')
    f.document.hidden = false

    startSkinContactPreview('custom-berry')
    f.cleanup()
    cleaned = true
    assert.equal(f.pig.getAttribute('data-pet-snap'), null, 'dispose releases the preview')
  } finally {
    if (!cleaned) f.cleanup()
    // 面板那边也不再“按着”了：清掉发送端的租约，不影响后面的用例。
    cancelSkinContactPreview()
  }
})

// ---------- 换肤页：只对当前的非默认皮肤显示校准卡，拖方框会写本机并同步落点 ----------

test('the skins tab shows a calibration pad for special looks and writes local values', async () => {
  const { fakeDom, findByAttr } = await import('./helpers/bundle.js')
  const { renderSkinsTab } = await import('../src/client/tabs/skins.js')
  const local = localStore()
  const dom = fakeDom()
  const savedDocument = globalThis.document
  globalThis.document = dom.document
  const sent = []
  const previews = []
  const offPreview = onPetSnapPreview(event => previews.push(event.action + ':' + event.art))
  try {
    const content = dom.document.createElement('div')
    const ui = {
      content, drill: { skins: null }, view: {
        pig: { bodyWeight: null },
        jobs: [],
        skins: { current: 'berry', entries: [
          { key: 'default', label: '默认小猪', emoji: '🐷', art: 'piglet', description: '', author: 'dsh-piggy', custom: false, current: false, unlocked: true, scenes: ['idle'] },
          { key: 'berry', label: '莓果猪', emoji: '🫐', art: 'custom-berry', description: '', author: '玩家', custom: true, current: true, unlocked: true, scenes: ['idle', 'eat', 'bathe', 'play', 'pet'] },
        ] },
      },
      send() {}, showBubble() {}, render() {}, renderContent() {},
    }
    ui.send = (...args) => sent.push(args)
    renderSkinsTab(ui)
    const pad = findByAttr(content, 'data-contact-pad', 'true')
    assert.ok(pad !== undefined && pad !== null, 'the calibration pad is on the skins page')
    pad.rect = { width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100 }

    pad.fire('pointerdown', { pointerId: 1, clientX: 30, clientY: 20 })
    assert.deepEqual(effectiveSkinContact('custom-berry'), { x: 0.3, y: 0.2 }, 'dragging writes the local point')
    assert.deepEqual(previews, ['press:custom-berry'], 'the pad starts one visual preview (no game action)')
    const dot = findByAttr(content, 'data-contact-dot', 'true')
    assert.equal(dot.style.left, '30%')
    assert.equal(dot.style.top, '20%')

    pad.fire('pointermove', { pointerId: 1, clientX: 55, clientY: 12 })
    assert.deepEqual(effectiveSkinContact('custom-berry'), { x: 0.55, y: 0.12 })
    pad.fire('pointerup', { pointerId: 1 })
    assert.deepEqual(previews, ['press:custom-berry', 'release:custom-berry'], 'letting go ends the preview')

    findByAttr(content, 'data-contact-try', 'true').fire('click')
    assert.deepEqual(previews.slice(2), ['press:custom-berry', 'release:custom-berry'], '试试手 plays one cycle')
    assert.deepEqual(sent, [], 'previewing the hand never sends a game action')

    findByAttr(content, 'data-contact-auto', 'true').fire('click')
    assert.equal(effectiveSkinContact('custom-berry'), null, '恢复自动 clears the local point')
    assert.match(findByAttr(content, 'data-contact-value', 'true').textContent, /自动估计/)

    // 默认猪没有校准卡：普通皮肤继续沿用自动估计，不改玩家已有造型。
    content.textContent = ''
    ui.view.skins.current = 'default'
    ui.view.skins.entries[0].current = true
    ui.view.skins.entries[1].current = false
    renderSkinsTab(ui)
    assert.equal(findByAttr(content, 'data-contact-pad', 'true'), undefined)
  } finally {
    offPreview()
    if (savedDocument === undefined) delete globalThis.document
    else globalThis.document = savedDocument
    local.restore()
  }
})

test('the calibration pad frames a built-in skin like the real pig even when img.src is absolute', async () => {
  const { fakeDom, findByAttr, findByClass } = await import('./helpers/bundle.js')
  const { renderSkinsTab } = await import('../src/client/tabs/skins.js')
  const { artFrameFor } = await import('../src/client/art.js')
  const { artSource } = await import('../src/client/art-path.js')
  const { normalizeSkinContact } = await import('../src/client/skin-contact.js')
  const local = localStore()
  const dom = fakeDom()
  const createElement = dom.document.createElement
  // 浏览器里 <img>.src 属性是绝对地址，只有 getAttribute('src') 留着相对路径。
  dom.document.createElement = tag => {
    const node = createElement(tag)
    if (tag !== 'img') return node
    Object.defineProperty(node, 'src', {
      get() {
        const value = node.getAttribute('src')
        return value ? new URL(value, 'https://localhost:3000').href : ''
      },
      set(value) { node.setAttribute('src', String(value)) },
    })
    return node
  }
  const savedDocument = globalThis.document
  globalThis.document = dom.document
  try {
    const art = 'skin-pirate'
    const src = artSource(art)
    const frame = artFrameFor(src)
    assert.ok(Array.isArray(frame), 'skin-pirate has a known built-in frame')
    assert.notEqual(frame[0], 1, 'the skin really needs a non-neutral framing')
    assert.equal(artFrameFor(new URL(src, 'https://localhost:3000').href), null, 'an absolute src is not a frame key')

    const content = dom.document.createElement('div')
    const ui = { content, drill: { skins: null }, view: {
      pig: { bodyWeight: null }, jobs: [],
      skins: { current: 'pirate', entries: [
        { key: 'pirate', label: '海盗猪', emoji: '🏴‍☠️', art, description: '', author: 'dsh-piggy', custom: false, current: true, unlocked: true, scenes: ['idle'] },
      ] },
    }, send() {}, showBubble() {}, render() {}, renderContent() {} }
    renderSkinsTab(ui)

    const img = findByClass(content, 'dp-contact-art')
    assert.ok(img !== undefined, 'the calibration pad shows the skin art')
    assert.equal(img.getAttribute('src'), src, 'the attribute keeps the stable relative artSource')
    assert.equal(img.src, new URL(src, 'https://localhost:3000').href, 'the realistic element reports an absolute src')
    assert.equal(img.style.getPropertyValue('--art-zoom'), String(frame[0]), 'the pad uses the same zoom as the real pig')
    assert.equal(img.style.getPropertyValue('--art-x'), frame[1] + '%', 'same x offset')
    assert.equal(img.style.getPropertyValue('--art-y'), frame[2] + '%', 'same y offset')

    const pad = findByAttr(content, 'data-contact-pad', 'true')
    pad.rect = { width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100 }
    const checkPoint = (clientX, clientY) => {
      const contact = normalizeSkinContact(clampSkinContact(unframedSkinPoint({ x: clientX / 100, y: clientY / 100 }, frame[0], frame[1], frame[2])))
      const dot = findByAttr(content, 'data-contact-dot', 'true')
      const placed = framedSkinPoint(contact, frame[0], frame[1], frame[2])
      assert.deepEqual(effectiveSkinContact(art), contact, 'the pointer maps back to the authored art point')
      assert.equal(dot.style.left, placed.x * 100 + '%', 'the dot is placed with the same framing')
      assert.equal(dot.style.top, placed.y * 100 + '%')
    }
    pad.fire('pointerdown', { pointerId: 1, clientX: 30, clientY: 20 })
    checkPoint(30, 20)
    pad.fire('pointermove', { pointerId: 1, clientX: 70, clientY: 60 })
    checkPoint(70, 60)
    pad.fire('pointerup', { pointerId: 1 })
  } finally {
    cancelSkinContactPreview()
    if (savedDocument === undefined) delete globalThis.document
    else globalThis.document = savedDocument
    local.restore()
  }
})

test('a custom PNG decoded after the pad renders uses the real measured frame for the dot and the pointer', async () => {
  const { fakeDom, findByAttr, findByClass } = await import('./helpers/bundle.js')
  const { renderSkinsTab } = await import('../src/client/tabs/skins.js')
  const { artFrameFor } = await import('../src/client/art.js')
  const { artSource } = await import('../src/client/art-path.js')
  const { FRAME_HEIGHT } = await import('../src/client/art-framing.js')
  const local = localStore()
  const dom = fakeDom()
  const createElement = dom.document.createElement
  const CANVAS = 128
  // 故意不居中、也不对称的可见墨迹：量出来的 zoom/offset 都不是中性值。
  const ink = { left: 10, right: 110, top: 18, bottom: 98 }
  const pixels = new Uint8ClampedArray(CANVAS * CANVAS * 4)
  for (let y = ink.top; y < ink.bottom; y += 1) {
    for (let x = ink.left; x < ink.right; x += 1) pixels[(y * CANVAS + x) * 4 + 3] = 255
  }
  dom.document.createElement = tag => {
    if (tag === 'canvas') {
      const canvas = createElement(tag)
      canvas.getContext = () => ({ drawImage() {}, getImageData: () => ({ data: pixels }) })
      return canvas
    }
    if (tag !== 'img') return createElement(tag)
    const node = createElement(tag)
    let loaded = false
    // 浏览器里 <img>.src 是绝对地址；取景/缓存只认 getAttribute 的相对路径。
    Object.defineProperty(node, 'src', {
      get() {
        const value = node.getAttribute('src')
        return value ? new URL(value, 'https://localhost:3000').href : ''
      },
      set(value) { node.setAttribute('src', String(value)) },
    })
    Object.defineProperty(node, 'complete', { get: () => loaded })
    Object.defineProperty(node, 'naturalWidth', { get: () => (loaded ? 256 : 0) })
    Object.defineProperty(node, 'naturalHeight', { get: () => (loaded ? 256 : 0) })
    node.decodeLoad = () => { loaded = true; node.fire('load') }
    return node
  }
  const savedDocument = globalThis.document
  globalThis.document = dom.document
  try {
    const art = 'custom-qa-contact'
    const src = artSource(art)
    const declared = { x: 0.5, y: 0.22 }
    setDeclaredSkinContact(art, declared)
    const content = dom.document.createElement('div')
    const ui = { content, drill: { skins: null }, view: {
      pig: { bodyWeight: null }, jobs: [],
      skins: { current: 'qa', entries: [
        { key: 'qa', label: 'QA 猪', emoji: '🧪', art, description: '', author: '玩家', custom: true, current: true, unlocked: true, scenes: ['idle'] },
      ] },
    }, send() {}, showBubble() {}, render() {}, renderContent() {} }
    renderSkinsTab(ui)

    const img = findByClass(content, 'dp-contact-art')
    const pad = findByAttr(content, 'data-contact-pad', 'true')
    const dot = findByAttr(content, 'data-contact-dot', 'true')
    assert.ok(img !== undefined && pad !== undefined && dot !== undefined)
    pad.rect = { width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100 }

    // 首次导入：真实小猪还没量过这张图，校准卡先按中性取景画（这就是出 bug 的起点）。
    assert.equal(artFrameFor(src), null, 'the first render starts with an empty frame cache')
    assert.equal(img.style.getPropertyValue('--art-zoom'), '1')
    const neutral = framedSkinPoint(declared, 1, 0, 0)
    assert.equal(dot.style.left, neutral.x * 100 + '%')
    assert.equal(dot.style.top, neutral.y * 100 + '%')
    assert.equal(findByAttr(content, 'data-contact-value', 'true').textContent, '皮肤包声明的落点 · 50% / 22%')

    // 图解码：同一个量法真正量出非中性取景，缓存和方框都要立刻更新。
    img.decodeLoad()
    const zoom = FRAME_HEIGHT / ((ink.bottom - ink.top) / CANVAS)
    const expected = [zoom,
      (0.5 - (ink.left + ink.right) / (2 * CANVAS)) * zoom * 100,
      (0.5 - (ink.top + ink.bottom) / (2 * CANVAS)) * zoom * 100]
    assert.deepEqual(artFrameFor(src), expected, 'the decoded PNG is measured once and shared')
    assert.equal(img.style.getPropertyValue('--art-zoom'), String(expected[0]))
    assert.equal(img.style.getPropertyValue('--art-x'), expected[1] + '%')
    assert.equal(img.style.getPropertyValue('--art-y'), expected[2] + '%')

    const placed = framedSkinPoint(declared, expected[0], expected[1], expected[2])
    assert.equal(dot.style.left, placed.x * 100 + '%', 'the dot uses the measured zoom/offset')
    assert.equal(dot.style.top, placed.y * 100 + '%')

    // 指针反解也换成量出来的取景；旧代码会拿中性取景反解，落到另一个点。
    pad.fire('pointerdown', { pointerId: 1, clientX: 30, clientY: 20 })
    const measuredInverse = clampSkinContact(unframedSkinPoint({ x: 0.3, y: 0.2 }, expected[0], expected[1], expected[2]))
    assert.deepEqual(effectiveSkinContact(art), measuredInverse)
    assert.notDeepEqual(measuredInverse, clampSkinContact(unframedSkinPoint({ x: 0.3, y: 0.2 }, 1, 0, 0)))
    pad.fire('pointerup', { pointerId: 1 })
  } finally {
    cancelSkinContactPreview()
    if (savedDocument === undefined) delete globalThis.document
    else globalThis.document = savedDocument
    local.restore()
  }
})
