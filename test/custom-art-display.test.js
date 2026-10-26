/**
 * 外观审计问题 1 / 2 的回归：非方形自定义图的量图与显示同一算则（contain），
 * 以及同一个 key 重新导入后主猪换图、取景缓存失效。
 *
 * 这里全部直接 import src（不经过构建产物），夹具自己模拟浏览器的 canvas：
 * `drawImage` 记下目标矩形，`getImageData` 按可见墨迹在该矩形里的位置生成 alpha，
 * 才能区分「等比（contain）」和「拉伸（fill）」两条量法。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CSS_BASE } from '../src/client/css-base.js'
import { CSS_SKINS } from '../src/client/css-skins.js'
import { FRAME_HEIGHT } from '../src/client/art-framing.js'
import { artSource } from '../src/client/art-path.js'
import { PET_CONTACT_HEIGHT } from '../src/client/skin-contact.js'

/** 容差比较（取景数字都是浮点乘除）。 */
function near(actual, expected, message, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${message}: ${actual} != ${expected}`)
}

/**
 * 假 canvas：drawImage 只记目标矩形；getImageData 按 specs 里的原图墨迹映射到目标矩形。
 * specs: Map<src, {naturalWidth, naturalHeight, ink:[l,t,r,b]（原图像素）}>
 */
function drawingDocument(specs) {
  const canvases = []
  function createElement(tag) {
    if (tag !== 'canvas') return null
    const canvas = { tagName: 'canvas', width: 0, height: 0, hidden: false, className: '',
      style: { setProperty() {} }, setAttribute() {}, remove() {}, draw: null, scales: [] }
    canvas.getContext = () => ({
      save() {}, restore() {}, setTransform() {}, translate() {}, rotate() {}, clearRect() {},
      scale(x, y) { canvas.scales.push([x, y]) },
      drawImage(image, dx, dy, dw, dh) { canvas.draw = { image, dx, dy, dw, dh } },
      getImageData(x, y, width, height) {
        const data = new Uint8ClampedArray(width * height * 4)
        const draw = canvas.draw
        const spec = draw === null ? undefined : specs.get(draw.image.getAttribute('src'))
        if (spec !== undefined) {
          const [l, t, r, b] = spec.ink
          const x0 = draw.dx + (l / spec.naturalWidth) * draw.dw
          const x1 = draw.dx + (r / spec.naturalWidth) * draw.dw
          const y0 = draw.dy + (t / spec.naturalHeight) * draw.dh
          const y1 = draw.dy + (b / spec.naturalHeight) * draw.dh
          for (let py = Math.max(0, Math.floor(y0)); py < Math.min(height, Math.ceil(y1)); py += 1) {
            for (let px = Math.max(0, Math.floor(x0)); px < Math.min(width, Math.ceil(x1)); px += 1) {
              data[(py * width + px) * 4 + 3] = 255
            }
          }
        }
        return { data }
      },
    })
    canvases.push(canvas)
    return canvas
  }
  return { document: { createElement, hidden: false, addEventListener() {}, removeEventListener() {} }, canvases }
}

test('a non-square custom PNG is measured by the same contain rule the CSS displays', async () => {
  const { containedInk, frameFromInk } = await import('../src/client/custom-art.js')
  const savedDocument = globalThis.document
  // 宽图 256×128，可见墨迹只在原图左上 3/4 宽、上半高：contain 后上下留透明。
  const wide = { naturalWidth: 256, naturalHeight: 128, ink: [32, 0, 224, 64] }
  const src = '/dsh-piggy/art/custom-wide-qa'
  const { document } = drawingDocument(new Map([[src, wide]]))
  globalThis.document = document
  try {
    const image = { naturalWidth: wide.naturalWidth, naturalHeight: wide.naturalHeight, getAttribute: () => src }
    const ink = containedInk(image)
    assert.deepEqual(ink, [0.125, 0.25, 0.875, 0.5], '等比装进方形画布后的可见边界')
    const frame = frameFromInk(ink)
    near(frame[0], FRAME_HEIGHT / 0.25, '可见高度统一到 FRAME_HEIGHT')
    assert.equal(frame[1], 0, '水平中心没偏')
    near(frame[2], 42.1875, '垂直按可见中心取景')
    near((ink[3] - ink[1]) * frame[0], FRAME_HEIGHT, 'contain 显示的可见高度就是目标高度')
    // 复现旧缺陷：如果显示按 fill 拉伸，同一张图会高出一倍（180 度的另一条合同）。
    near((wide.ink[3] / wide.naturalHeight) * frame[0], FRAME_HEIGHT * 2, 'fill 显示会比目标高一倍')

    // 竖图同样不拉伸：宽度保持 1:2，而不是被撑满方框。
    const tallSrc = '/dsh-piggy/art/custom-tall-qa'
    const tall = { naturalWidth: 128, naturalHeight: 256, ink: [0, 0, 128, 256] }
    globalThis.document = drawingDocument(new Map([[tallSrc, tall]])).document
    const tallInk = containedInk({ naturalWidth: 128, naturalHeight: 256, getAttribute: () => tallSrc })
    assert.deepEqual(tallInk, [0.25, 0, 0.75, 1], '竖图等比缩放，左右留透明')
    near((tallInk[2] - tallInk[0]) * frameFromInk(tallInk)[0], FRAME_HEIGHT / 2, '竖图可见宽度保持 1:2')
  } finally {
    if (savedDocument === undefined) delete globalThis.document
    else globalThis.document = savedDocument
  }
})

test('the pig sprite and the calibration pad both display custom art with object-fit:contain', () => {
  const sprite = CSS_BASE.match(/\.dp-pig-img\{width:var\(--pig-size\)[^}]*\}/)
  assert.ok(sprite, 'the sprite sizing rule survived')
  assert.match(sprite[0], /object-fit:contain/, '站立立绘不能再把非方形图拉伸成 fill')
  const sleep = CSS_BASE.match(/\.dp-pig-sleep\{[^}]*\}/)
  assert.match(sleep[0], /object-fit:contain/, '睡姿一直是 contain，别退回 fill')
  const pad = CSS_SKINS.match(/\.dp-contact-art\{[^}]*\}/)
  assert.match(pad[0], /object-fit:contain/, '校准方框和真实立绘用同一显示算则')
})

test('re-importing the same key drops the old frame and reloads the pig at a versioned URL', async () => {
  const { syncPigArt, artFrameFor } = await import('../src/client/art.js')
  const { onCustomArtChange, refreshCustomArt } = await import('../src/client/custom-art.js')
  const art = 'custom-reimport-qa'
  const oldSrc = artSource(art)
  assert.equal(oldSrc, '/dsh-piggy/art/' + art, '首次导入的地址没有查询串')
  const specs = new Map([[oldSrc, { naturalWidth: 256, naturalHeight: 128, ink: [32, 0, 224, 64] }]])
  const { document } = drawingDocument(specs)
  const savedDocument = globalThis.document
  globalThis.document = document
  try {
    const style = new Map()
    const attrs = { 'data-art': art, 'data-stage': 'piglet' }
    const image = {
      src: '', complete: true, hidden: false, naturalWidth: 256, naturalHeight: 128,
      style: { setProperty: (key, value) => style.set(key, String(value)), getPropertyValue: key => style.get(key) ?? '' },
      getAttribute(key) { return key === 'src' ? this.src : null },
      addEventListener() {},
    }
    const pig = {
      getAttribute: key => attrs[key] ?? null,
      setAttribute: (key, value) => { attrs[key] = value },
      removeAttribute: key => { delete attrs[key] },
    }

    syncPigArt(pig, image)
    assert.equal(image.src, oldSrc, '首次渲染指向原始地址')
    near(artFrameFor(oldSrc)[0], 3.375, '按 contain 量出的可见高度取景')
    near(Number(style.get('--art-y').replace('%', '')), 42.1875, '旧图的垂直取景')

    let notified = 0
    const off = onCustomArtChange(() => { notified += 1 })
    try {
      assert.equal(refreshCustomArt(art), 1, '重新导入把本机版本 +1')
      assert.equal(notified, 1, '本窗口立即收到刷新通知')
      assert.equal(artFrameFor(oldSrc), null, '旧地址的取景缓存必须作废')
      const newSrc = artSource(art)
      assert.equal(newSrc, oldSrc + '?v=1', '新地址带版本串，<img> 才会重新取图')
      // 服务器上同名文件的字节换成了满画布墨迹（例如作者重新导出）。
      specs.set(newSrc, { naturalWidth: 256, naturalHeight: 128, ink: [0, 0, 256, 128] })
      syncPigArt(pig, image)
      assert.equal(image.src, newSrc, '主猪换到新地址，无需整页刷新')
      near(artFrameFor(newSrc)[0], 1.6875, '新图重新量出新的取景')
      near(Number(style.get('--art-zoom')), 1.6875, 'DOM 上的取景也更新了')
      assert.equal(style.get('--art-y'), '0%', '新图垂直居中')
      assert.equal(artFrameFor(oldSrc), null, '旧地址保持作废，不会被旧缓存顶回去')
    } finally { off() }
  } finally {
    if (savedDocument === undefined) delete globalThis.document
    else globalThis.document = savedDocument
  }
})

test('a re-import announced by another window bumps this window too', async () => {
  const { onCustomArtChange, CUSTOM_ART_KEY } = await import('../src/client/custom-art.js')
  const art = 'custom-remote-qa'
  const savedWindow = globalThis.window
  const storage = new Map()
  const listeners = new Map()
  globalThis.window = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    addEventListener: (name, fn) => listeners.set(name, fn),
  }
  let changed = 0
  const off = onCustomArtChange(() => { changed += 1 })
  try {
    const value = JSON.stringify({ [art]: 4 })
    storage.set(CUSTOM_ART_KEY, value)
    assert.equal(typeof listeners.get('storage'), 'function', '换窗口后挂上 storage 监听')
    listeners.get('storage')({ key: CUSTOM_ART_KEY, newValue: value })
    assert.equal(changed, 1, '另一个窗口导入后本窗口也收到刷新')
    assert.equal(artSource(art), '/dsh-piggy/art/' + art + '?v=4', '版本跟着另一窗口的写入走')
  } finally {
    off()
    if (savedWindow === undefined) delete globalThis.window
    else globalThis.window = savedWindow
  }
})

test('the skins tab bumps the imported art version before it redraws', async () => {
  const { fakeDom, findByAttr } = await import('./helpers/bundle.js')
  const { renderSkinsTab } = await import('../src/client/tabs/skins.js')
  const { CUSTOM_ART_KEY } = await import('../src/client/custom-art.js')
  const art = 'custom-card-qa'
  const savedWindow = globalThis.window
  const savedDocument = globalThis.document
  const savedFetch = globalThis.fetch
  const store = new Map()
  globalThis.window = { localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) } }
  const dom = fakeDom()
  globalThis.document = dom.document
  const entry = { key: 'card-qa', label: '卡片猪', emoji: '🎨', art, description: '', author: '玩家',
    custom: true, current: true, unlocked: true, scenes: ['idle', 'eat', 'bathe', 'play', 'pet'] }
  const response = { ok: true, imported: entry.key, skins: { current: entry.key, entries: [entry] } }
  const content = dom.document.createElement('div')
  let renderedAt = null
  const ui = {
    content, drill: { skins: null }, view: { pig: { bodyWeight: null }, jobs: [], skins: { current: entry.key, entries: [entry] } },
    send() {}, showBubble() {}, renderContent() {},
    render() { renderedAt = artSource(art) },
  }
  renderSkinsTab(ui)
  const input = findByAttr(content, 'data-skin-import', 'zip')
  assert.notEqual(input, undefined)
  globalThis.fetch = async () => ({ json: async () => response })
  try {
    input.files = [{ arrayBuffer: async () => new ArrayBuffer(8) }]
    input.fire('change')
    for (let i = 0; i < 20 && renderedAt === null; i += 1) await new Promise(resolve => setImmediate(resolve))
    assert.equal(renderedAt, '/dsh-piggy/art/' + art + '?v=1', '重绘时已经换成新版本地址')
    assert.equal(JSON.parse(store.get(CUSTOM_ART_KEY))[art], 1, '版本写进本机，拆窗口的另一边也能读到')
  } finally {
    globalThis.fetch = savedFetch
    globalThis.document = savedDocument
    if (savedWindow === undefined) delete globalThis.window
    else globalThis.window = savedWindow
  }
})

test('the pet hand measures a wide custom PNG as contain, not as a stretched square', async () => {
  const { attachPetSnap, beginPetSnap } = await import('../src/client/pet-snap.js')
  const { syncPigArt } = await import('../src/client/art.js')
  const art = 'custom-petwide-qa'
  const src = artSource(art)
  const specs = new Map([[src, { naturalWidth: 256, naturalHeight: 128, ink: [0, 0, 256, 128] }]])
  const drawing = drawingDocument(specs)
  const saved = new Map(['window', 'document', 'Image', 'MutationObserver', 'performance',
    'requestAnimationFrame', 'cancelAnimationFrame', 'createImageBitmap'].map(key => [key, globalThis[key]]))
  const css = new Map()
  const body = { style: { setProperty: (key, value) => css.set(key, String(value)), removeProperty: key => css.delete(key) } }
  const parent = { appendChild() {} }
  const attrs = { 'data-art': art }
  const style = new Map()
  const image = {
    src: '', complete: true, hidden: false, naturalWidth: 256, naturalHeight: 128,
    style: { setProperty: (key, value) => style.set(key, String(value)), getPropertyValue: key => style.get(key) ?? '' },
    getAttribute(key) { return key === 'src' ? this.src : null },
    addEventListener() {},
  }
  const pig = {
    getAttribute: key => attrs[key] ?? null,
    setAttribute: (key, value) => { attrs[key] = value },
    removeAttribute: key => { delete attrs[key] },
    querySelector: key => (key === '.dp-pig-body' ? body : parent),
  }
  let time = 0, rafId = 0
  const rafs = new Map()
  globalThis.document = drawing.document
  globalThis.performance = { now: () => time }
  globalThis.requestAnimationFrame = fn => { rafs.set(++rafId, fn); return rafId }
  globalThis.cancelAnimationFrame = id => rafs.delete(id)
  globalThis.Image = class { decode() { return Promise.resolve() } }
  globalThis.createImageBitmap = async img => ({ src: img.src, close() {} })
  globalThis.MutationObserver = class { observe() {} disconnect() {} }
  globalThis.window = {
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  }
  let player = null
  try {
    syncPigArt(pig, image)
    near(Number(style.get('--art-zoom')), 1.6875, '宽图取景按 contain 量')
    player = attachPetSnap({ pig, pigArt: image, isStopped: () => false, isDragging: () => false,
      canPlay: () => true, cancelMicro() {}, render() {} })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(beginPetSnap(pig), true)
    // 可见墨迹：contain 把 256×128 放进 128 方框，y 占 32..96；取景后可见高度就是 FRAME_HEIGHT。
    const top = 0.5 + (0.25 - 0.5) * 1.6875
    const bottom = 0.5 + (0.75 - 0.5) * 1.6875
    near(bottom - top, FRAME_HEIGHT, '摸摸读数里的可见高度')
    assert.equal(css.get('--pet-origin-y'), String(bottom * 100) + '%', '手层锚在可见脚底')
    assert.equal(css.get('--pet-origin-x'), '50%', '宽图水平中心没被拉伸偏移')
    const ratio = (bottom - top) / PET_CONTACT_HEIGHT
    // 手层 canvas 是最后一个带 scale 的 canvas（探针不调 scale）。
    const hand = drawing.canvases.filter(canvas => canvas.scales.length > 0).at(-1)
    assert.notEqual(hand, undefined, '手真的画了一帧')
    near(hand.scales.at(-1)[0], 105 / 500 * ratio, '手的大小按可见高度换算')
    near(hand.scales.at(-1)[0], (105 / 500) * FRAME_HEIGHT / PET_CONTACT_HEIGHT, '与内置图同一基准')
    // 旧实现把图拉伸成 128×128（墨迹高度 1）→ 手会大一倍，落点也掉到方框之外。
    near((1 / PET_CONTACT_HEIGHT) * 1.6875, ratio * 2, 'fill 探针会把手放大一倍')
  } finally {
    player?.dispose()
    for (const [key, value] of saved) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})
