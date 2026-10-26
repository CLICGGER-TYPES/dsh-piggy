/**
 * 自定义立绘的几何回归：桌面量框/命中形状、舞台可见范围必须和图片真实显示用同一份
 * 「已量 ink + 取景（zoom/x/y）」数据；内置立绘仍走原来的 ART_BOUNDS。
 *
 * 失败基线（2026-10-26 修前）：`desktop/measure.js` 的 framedBox 对 `custom-*` 没有
 * ART_BOUNDS，于是返回方形布局盒；Linux 原生 shape 只留方形，2:1 宽图左右被裁。
 * 这些断言在修前会直接失败，修后应全部通过。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { FRAME_HEIGHT, ART_BOUNDS } from '../src/client/art-framing.js'
import { BUILTIN_FRAMING } from '../src/client/feedback-framing.js'
import { framedArtBox, characterGeometry } from '../src/client/character-geometry.js'
import { frameCustomImage } from '../src/client/art.js'
import { framedBox, createMeasure, layoutBox } from '../src/client/desktop/measure.js'
import { pigEnvelope } from '../src/client/stage-dom.js'

function near(actual, expected, message, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} != ${expected}`)
}

/**
 * 假 canvas：drawImage 记下目标矩形；getImageData 按原图 alpha 墨迹映射到目标矩形。
 * specs: Map<src, {naturalWidth, naturalHeight, ink:[l,t,r,b]（原图像素）}>
 */
function drawingDocument(specs) {
  const canvases = []
  function createElement(tag) {
    if (tag !== 'canvas') return null
    const canvas = { tagName: 'canvas', width: 0, height: 0, style: { setProperty() {} }, draw: null }
    canvas.getContext = () => ({
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
  return {
    document: { body: {}, createElement, addEventListener() {}, removeEventListener() {} },
    canvases,
  }
}

function styleMap() {
  const values = new Map()
  return {
    values,
    getPropertyValue: key => values.get(key) ?? '',
    setProperty: (key, value) => { values.set(key, String(value)) },
    removeProperty: key => { values.delete(key) },
  }
}

function matchesKind(kind) {
  return selectors => String(selectors).split(',').map(part => part.trim()).includes(kind)
}

/** 一个已解码的自定义 <img>（真实浏览器里是 DOM 节点，测试里只要量图/几何用到的形状）。 */
function customImage(src, spec, style, kind = '.dp-pig-img') {
  return {
    tagName: 'IMG',
    src,
    complete: true,
    hidden: false,
    naturalWidth: spec.naturalWidth,
    naturalHeight: spec.naturalHeight,
    style,
    offsetLeft: 0,
    offsetTop: 0,
    offsetWidth: spec.layoutWidth ?? 100,
    offsetHeight: spec.layoutHeight ?? 100,
    offsetParent: null,
    getAttribute(name) { return name === 'src' ? this.src : null },
    matches: matchesKind(kind),
    closest(selector) { return selector === '.dp-pig' ? this.pig ?? null : null },
    addEventListener() {},
    removeAttribute() {},
  }
}

function restore(key, value) {
  if (value === undefined) delete globalThis[key]
  else globalThis[key] = value
}

test('desktop framedBox follows the measured custom ink and frame instead of returning the square box', async () => {
  const savedDocument = globalThis.document
  const spec = { naturalWidth: 256, naturalHeight: 128, ink: [0, 0, 256, 128] }
  const src = '/dsh-piggy/art/custom-wide-geo'
  const drawing = drawingDocument(new Map([[src, spec]]))
  globalThis.document = drawing.document
  try {
    const style = styleMap()
    const image = customImage(src, spec, style)
    const box = { x: 100, y: 100, width: 100, height: 100 }
    // 未加载/未量过的未知图：保持现有行为（方形布局盒）。
    assert.deepEqual(framedBox(image, box), box, '还没量到 ink 的图保持方形，不能猜一个巨大 shape')

    frameCustomImage(image, src)
    near(Number(style.getPropertyValue('--art-zoom')), 1.6875, '2:1 满画布图的取景')
    const bounds = framedBox(image, box)
    near(bounds.width, 1.6875 * 100, '宽图可见宽度是 1.6875 个猪盒')
    near(bounds.height, FRAME_HEIGHT * 100, '可见高度仍是 FRAME_HEIGHT')
    near(bounds.x, 100 + 50 - bounds.width / 2, '可见范围以猪盒中心对齐')
    near(bounds.y, 100 + 50 - bounds.height / 2, '可见范围垂直居中')
  } finally {
    restore('document', savedDocument)
  }
})

test('desktop shape and content cover the full measured wide custom art', async () => {
  const savedDocument = globalThis.document
  const savedStyle = globalThis.getComputedStyle
  const spec = { naturalWidth: 256, naturalHeight: 128, ink: [0, 0, 256, 128] }
  const src = '/dsh-piggy/art/custom-wide-shape'
  const drawing = drawingDocument(new Map([[src, spec]]))
  globalThis.document = drawing.document
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: 'none' })
  const body = drawing.document.body
  try {
    const width = 100
    // 真实桌面里 host 是 fixed + shrink-to-fit，盒子就是猪的盒子（面板绝对定位、不撑宽）。
    const host = { offsetLeft: 0, offsetTop: 0, offsetWidth: width, offsetHeight: width, offsetParent: body,
      getAttribute: () => null, closest: () => null, style: { getPropertyValue: () => '1' } }
    const pig = { offsetLeft: 100, offsetTop: 100, offsetWidth: width, offsetHeight: width, offsetParent: host,
      getAttribute: () => null, matches: () => false, closest: selector => selector === '.dp-pig' ? pig : null }
    const style = styleMap()
    const image = customImage(src, spec, style)
    image.offsetWidth = width
    image.offsetHeight = width
    image.offsetParent = pig
    image.pig = pig
    host.querySelector = selector => selector === '.dp-pig' ? pig : null
    host.querySelectorAll = () => [pig, image]
    const measure = createMeasure({ platform: 'linux', geometry: () => ({ window: { x: 0, y: 0, width: 384, height: 348 }, workArea: { x: 0, y: 0, width: 1280, height: 748 } }) })

    const before = measure.boxes(host)
    const art = { x: 100 + width / 2 - 1.6875 * width / 2, y: 100 + width / 2 - FRAME_HEIGHT * width / 2,
      width: 1.6875 * width, height: FRAME_HEIGHT * width }
    const misses = rect => rect === null || rect.x > art.x + .01 || rect.y > art.y + .01
      || rect.x + rect.width < art.x + art.width - .01 || rect.y + rect.height < art.y + art.height - .01
    assert.ok(before.shape.every(rect => misses(rect)), '加载前 shape 保持方形（现有行为），不能预先猜一个巨大形状')

    frameCustomImage(image, src)
    const after = measure.boxes(host)
    assert.ok(after.shape.some(rect => !misses(rect)), '加载量完后 shape 必须覆盖整张宽图')
    assert.ok(after.contentBox.left <= art.x && after.contentBox.right >= art.x + art.width,
      '固定窗口预留也要覆盖同一份可见宽度')
  } finally {
    restore('document', savedDocument)
    restore('getComputedStyle', savedStyle)
  }
})

test('after a custom image loads, the same measurement re-runs and the wide shape appears', async () => {
  const savedDocument = globalThis.document
  const spec = { naturalWidth: 256, naturalHeight: 128, ink: [0, 0, 256, 128] }
  const src = '/dsh-piggy/art/custom-load-geo'
  const drawing = drawingDocument(new Map([[src, spec]]))
  globalThis.document = drawing.document
  try {
    const style = styleMap()
    const image = customImage(src, spec, style)
    const box = { x: 10, y: 20, width: 100, height: 100 }
    assert.deepEqual(framedBox(image, box), box, 'load 之前还是方形')
    frameCustomImage(image, src)
    // 真实路径：量完 -> applyFrame 改 --art-zoom/--art-x/--art-y -> DOM MutationObserver 触发下一次 tick。
    assert.notEqual(style.getPropertyValue('--art-zoom'), '', '量完必须写出取景，桌面/舞台观察器才会重测')
    near(framedBox(image, box).width, 1.6875 * 100, '重测后读到同一份已量数据')
  } finally {
    restore('document', savedDocument)
  }
})

test('custom sleep art uses the 1.2:1 sleep element box and its own measured ink', async () => {
  const savedDocument = globalThis.document
  const spec = { naturalWidth: 256, naturalHeight: 128, ink: [0, 0, 256, 128] }
  const src = '/dsh-piggy/art/custom-sleep-geo-sleep'
  const drawing = drawingDocument(new Map([[src, spec]]))
  globalThis.document = drawing.document
  try {
    const style = styleMap()
    const image = customImage(src, spec, style, '.dp-pig-sleep')
    frameCustomImage(image, src, true)
    // 1.2:1 睡姿盒：w=120, h=100；256×128 图按 contain 放进 192×160 量图板。
    const bounds = framedBox(image, { x: 100, y: 100, width: 120, height: 100 })
    near(bounds.width, 1.2 * 1.40625 * 100, '睡姿宽图可见宽度按元素宽度缩放')
    near(bounds.height, FRAME_HEIGHT * 100, '睡姿可见高度仍统一到 FRAME_HEIGHT')
    near(bounds.x, 160 - bounds.width / 2, '以睡姿盒中心对齐')
    near(bounds.y, 150 - bounds.height / 2, '睡姿取景垂直居中')
  } finally {
    restore('document', savedDocument)
  }
})

test('a mirrored custom sprite keeps the same measured box while the art mapping flips', async () => {
  const savedDocument = globalThis.document
  const spec = { naturalWidth: 256, naturalHeight: 128, ink: [0, 0, 128, 128] }
  const src = '/dsh-piggy/art/custom-mirror-geo'
  const drawing = drawingDocument(new Map([[src, spec]]))
  globalThis.document = drawing.document
  try {
    const style = styleMap()
    const pig = { getAttribute: name => name === 'data-walk' ? 'right' : null }
    const image = customImage(src, spec, style)
    image.pig = pig
    frameCustomImage(image, src)
    const box = { x: 100, y: 100, width: 100, height: 100 }
    const mirrored = framedBox(image, box)
    pig.getAttribute = () => null
    const plain = framedBox(image, box)
    near(mirrored.width, plain.width, '镜像不改变可见包围盒宽度')
    near(mirrored.height, plain.height, '镜像不改变可见包围盒高度')
    near(mirrored.x, plain.x, '取景已把墨迹居中，镜像后的包围盒位置相同')
    const geometry = characterGeometry(box, { bounds: [0, .25, .5, .75], zoom: 1.6875, shiftX: 42.1875, shiftY: 0, mirrored: true })
    near(geometry.art.x + geometry.art.width / 2, 150, '镜像以猪盒中线翻转')
  } finally {
    restore('document', savedDocument)
  }
})

test('built-in artwork keeps using ART_BOUNDS and framedArtBox unchanged', () => {
  for (const path of ['pigs/base/piglet/sleep.png', 'pigs/forms/pig-fat/work.png']) {
    const frame = BUILTIN_FRAMING[path]
    const bounds = ART_BOUNDS[path] ?? [0, 0, 1, 1]
    const values = { '--art-zoom': frame[0], '--art-x': frame[1] + '%', '--art-y': frame[2] + '%' }
    const node = {
      matches: () => true,
      getAttribute: () => '/dsh-piggy/art/' + path,
      closest: () => ({ getAttribute: () => null }),
      style: { getPropertyValue: key => String(values[key]) },
      getBoundingClientRect: () => { throw new Error('静止量框不能读动画中的位置') },
    }
    const layout = { x: 100, y: 100, width: 100, height: 100 }
    assert.deepEqual(framedBox(node, layout), framedArtBox(layout, {
      bounds, zoom: frame[0], shiftX: frame[1], shiftY: frame[2], mirrored: false,
    }), path)
  }
})

test('stage envelope covers a measured wide custom sprite, not just the fixed art margin', async () => {
  const savedDocument = globalThis.document
  const savedStyle = globalThis.getComputedStyle
  // 4:1 满画布图：可见宽 3.375S；固定 artMargin 只按 1.947826 预留，会短 200px 以上。
  const spec = { naturalWidth: 256, naturalHeight: 64, ink: [0, 0, 256, 64] }
  const src = '/dsh-piggy/art/custom-stage-geo'
  const drawing = drawingDocument(new Map([[src, spec]]))
  globalThis.document = drawing.document
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: 'none' })
  const body = drawing.document.body
  try {
    const size = 200
    const style = styleMap()
    const pig = { offsetLeft: 100, offsetTop: 100, offsetWidth: size, offsetHeight: size, offsetParent: body,
      getAttribute: () => null, matches: () => false, closest: () => null }
    const image = customImage(src, spec, style)
    image.offsetWidth = size
    image.offsetHeight = size
    image.offsetParent = pig
    pig.querySelectorAll = () => [image]
    frameCustomImage(image, src)
    const art = { x: 100 + size / 2 - 3.375 * size / 2, y: 100 + size / 2 - FRAME_HEIGHT * size / 2,
      width: 3.375 * size, height: FRAME_HEIGHT * size }
    const envelope = pigEnvelope(pig)
    assert.ok(envelope !== null)
    assert.ok(envelope.x <= art.x && envelope.y <= art.y
      && envelope.x + envelope.width >= art.x + art.width
      && envelope.y + envelope.height >= art.y + art.height,
    `舞台可见范围 ${JSON.stringify(envelope)} 必须覆盖 ${JSON.stringify(art)}`)
  } finally {
    restore('document', savedDocument)
    restore('getComputedStyle', savedStyle)
  }
})

/** 桌面量框的假 host：host 是 shrink-to-fit 的猪盒，猪/图都在同一位置。 */
function desktopNodes(drawing, src, spec, style, size, sleep = false) {
  const body = drawing.document.body
  const pins = new Map()
  const host = { offsetLeft: 0, offsetTop: 0, offsetWidth: size, offsetHeight: size, offsetParent: body,
    getAttribute: () => null, closest: () => null }
  host.style = {
    getPropertyValue: name => name === '--bubble-scale' ? '1' : (pins.get(name) ?? ''),
    setProperty: (name, value) => { pins.set(name, String(value)) },
  }
  for (const side of ['left', 'right', 'top', 'bottom']) {
    Object.defineProperty(host.style, side, {
      get: () => pins.get(side) ?? '',
      set: value => { pins.set(side, String(value)) },
    })
  }
  // 真实页面里 pin() 写 right/bottom 后浏览器重排，host 的 offsetLeft/Top 随之改变。
  host.relayout = (width = 800, height = 800) => {
    if (pins.get('right') && pins.get('right') !== 'auto') host.offsetLeft = width - host.offsetWidth - parseFloat(pins.get('right'))
    else if (pins.get('left') && pins.get('left') !== 'auto') host.offsetLeft = parseFloat(pins.get('left'))
    if (pins.get('bottom') && pins.get('bottom') !== 'auto') host.offsetTop = height - host.offsetHeight - parseFloat(pins.get('bottom'))
    else if (pins.get('top') && pins.get('top') !== 'auto') host.offsetTop = parseFloat(pins.get('top'))
  }
  const pig = { offsetLeft: 100, offsetTop: 100, offsetWidth: size, offsetHeight: size, offsetParent: host,
    getAttribute: () => null, matches: () => false, closest: selector => selector === '.dp-pig' ? pig : null,
    querySelectorAll: () => [image] }
  const kind = sleep ? '.dp-pig-sleep' : '.dp-pig-img'
  const image = customImage(src, spec, style, kind)
  image.offsetWidth = sleep ? size * 1.2 : size
  image.offsetHeight = size
  image.offsetLeft = sleep ? -size * .1 : 0
  image.offsetParent = pig
  image.pig = pig
  host.querySelector = selector => selector === '.dp-pig' ? pig : null
  host.querySelectorAll = () => [pig, image]
  return { host, pig, image }
}

test('2:1 and vertical custom art stay complete at 100% / 200% / 500% in the fixed window reserve and shape', async () => {
  const savedDocument = globalThis.document
  const savedStyle = globalThis.getComputedStyle
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: 'none', translate: '' })
  try {
    const wide = { naturalWidth: 256, naturalHeight: 128, ink: [0, 0, 256, 128] }
    const tall = { naturalWidth: 128, naturalHeight: 256, ink: [0, 0, 128, 256] }
    for (const [name, spec, ratio] of [['wide', wide, 2], ['tall', tall, .5]]) {
      const src = `/dsh-piggy/art/custom-${name}-sizes`
      const drawing = drawingDocument(new Map([[src, spec]]))
      globalThis.document = drawing.document
      const style = styleMap()
      const probe = customImage(src, spec, style)
      frameCustomImage(probe, src)
      for (const size of [68, 136, 340]) {
        const { host, pig, image } = desktopNodes(drawing, src, spec, style, size)
        const measure = createMeasure({ platform: 'linux', geometry: () => ({ window: { x: 0, y: 0, width: 800, height: 800 }, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) })
        let next = measure.boxes(host)
        measure.pin(host, measure.sides(), next.hostBox, next.contentBox)
        host.relayout()
        next = measure.boxes(host)
        const art = framedBox(image, layoutBox(image))
        near(art.width, size * FRAME_HEIGHT * ratio, `${name} ${size}: 可见宽度`)
        near(art.height, size * FRAME_HEIGHT, `${name} ${size}: 可见高度`)
        const covered = rect => rect.x <= art.x + .01 && rect.y <= art.y + .01
          && rect.x + rect.width >= art.x + art.width - .01 && rect.y + rect.height >= art.y + art.height - .01
        assert.ok(next.shape.some(covered), `${name} ${size}: shape 覆盖整张立绘`)
        assert.ok(next.contentBox.left <= art.x && next.contentBox.right >= art.x + art.width
          && next.contentBox.top <= art.y && next.contentBox.bottom >= art.y + art.height,
        `${name} ${size}: 固定窗口内容盒覆盖整张立绘`)
      }
    }
  } finally {
    restore('document', savedDocument)
    restore('getComputedStyle', savedStyle)
  }
})

test('stage shape (drawingBounds callback) covers the measured custom art, not only the fixed envelope', async () => {
  const savedDocument = globalThis.document
  const savedStyle = globalThis.getComputedStyle
  const spec = { naturalWidth: 256, naturalHeight: 64, ink: [0, 0, 256, 64] }
  const src = '/dsh-piggy/art/custom-stage-shape'
  const drawing = drawingDocument(new Map([[src, spec]]))
  globalThis.document = drawing.document
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: 'none', translate: '' })
  try {
    const size = 200
    const style = styleMap()
    const { host, pig, image } = desktopNodes(drawing, src, spec, style, size)
    pig.getBoundingClientRect = () => ({ left: 100, top: 100, right: 300, bottom: 300, width: size, height: size })
    host.getBoundingClientRect = () => ({ left: 100, top: 100, right: 300, bottom: 300, width: size, height: size })
    frameCustomImage(image, src)
    const { collectStageShape } = await import('../apps/desktop/stage/overlay-shape.js')
    const { stageDrawingBounds } = await import('../src/client/stage-dom.js')
    const doc = { querySelectorAll: () => [] }
    const report = collectStageShape(host, doc, box => stageDrawingBounds(box, pig))
    const art = { x: 100 + size / 2 - 3.375 * size / 2, y: 100 + size / 2 - FRAME_HEIGHT * size / 2,
      width: 3.375 * size, height: FRAME_HEIGHT * size }
    const covered = rect => rect.x <= art.x + .01 && rect.y <= art.y + .01
      && rect.x + rect.width >= art.x + art.width - .01 && rect.y + rect.height >= art.y + art.height - .01
    assert.ok(report.shape.some(covered), '舞台 shape 必须包含同一份已量可见框')
  } finally {
    restore('document', savedDocument)
    restore('getComputedStyle', savedStyle)
  }
})

test('re-importing the same key synchronously drops the shared ink, and the new bytes measure again', async () => {
  const savedDocument = globalThis.document
  const { artSource } = await import('../src/client/art-path.js')
  const { customArtInk, refreshCustomArt } = await import('../src/client/custom-art.js')
  const art = 'custom-reimport-geo'
  const oldSrc = artSource(art)
  const spec = { naturalWidth: 256, naturalHeight: 128, ink: [0, 0, 256, 128] }
  const specs = new Map([[oldSrc, spec]])
  const drawing = drawingDocument(specs)
  globalThis.document = drawing.document
  try {
    const style = styleMap()
    const image = customImage(oldSrc, spec, style)
    frameCustomImage(image, oldSrc)
    assert.notEqual(customArtInk(oldSrc), null, '旧地址量过一次')
    near(framedBox(image, { x: 100, y: 100, width: 100, height: 100 }).width, 168.75, '旧图是宽图')

    assert.equal(refreshCustomArt(art), 1)
    assert.equal(customArtInk(oldSrc), null, '同 key 重导入后旧 ink 立刻作废（不等下一帧）')
    assert.deepEqual(framedBox(image, { x: 100, y: 100, width: 100, height: 100 }),
      { x: 100, y: 100, width: 100, height: 100 }, '新图量到之前保持方形，不拿旧数据顶')

    const newSrc = artSource(art)
    assert.equal(newSrc, oldSrc + '?v=1', '地址带新版本，img 会重新取图')
    const full = { naturalWidth: 256, naturalHeight: 256, ink: [0, 0, 256, 256] }
    specs.set(newSrc, full)
    const changed = customImage(newSrc, full, style)
    frameCustomImage(changed, newSrc)
    assert.notEqual(customArtInk(newSrc), null, '新字节重新量图')
    near(framedBox(changed, { x: 100, y: 100, width: 100, height: 100 }).width, 84.375, '新图按新 ink 取景')
  } finally {
    restore('document', savedDocument)
  }
})
