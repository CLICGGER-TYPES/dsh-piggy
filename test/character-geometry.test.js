import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BUBBLE_GAP, HAND_CONTACT, artFitSize, artPointToLayout, boxPoint, bubbleSlot, bubbleTailLeft,
  characterGeometry, feetPoint, framedArtBox, headTopPoint, layoutPointToArt,
} from '../src/client/character-geometry.js'
import { createMeasure, framedBox } from '../src/client/desktop/measure.js'
import { fitBubbleHorizontally, fitBubbleVertically } from '../src/client/desktop/bubble-geometry.js'
import { partAt } from '../src/client/pet-parts.js'
import { BUILTIN_FRAMING } from '../src/client/feedback-framing.js'
import { ART_BOUNDS } from '../src/client/art-framing.js'

const square = { x: 100, y: 60, width: 64, height: 64 }
const wide = { x: 37, y: 211, width: 73, height: 58 }
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`)

test('layout and artwork-normalized coordinates round-trip on offset, non-square boxes', () => {
  for (const box of [square, wide]) {
    assert.equal(artFitSize(box), Math.min(box.width, box.height))
    for (const point of [{ x: box.x, y: box.y }, { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      { x: box.x + box.width, y: box.y + box.height }]) {
      const normalized = layoutPointToArt(box, point)
      const back = artPointToLayout(box, normalized)
      close(back.x, point.x)
      close(back.y, point.y)
      assert.equal(boxPoint(box, point).inside, true)
    }
  }
  // 正方形画布按短边居中：宽盒子的左右留白不属于立绘。
  close(layoutPointToArt(wide, { x: wide.x, y: wide.y }).x, .5 - wide.width / 2 / wide.height)
  close(layoutPointToArt(wide, { x: wide.x + wide.width / 2, y: wide.y }).y, 0)
})

test('edge points are inside the hit box and a point just outside is rejected', () => {
  assert.equal(boxPoint(square, { x: square.x, y: square.y }).inside, true)
  assert.equal(boxPoint(square, { x: square.x + square.width, y: square.y + square.height }).inside, true)
  assert.equal(boxPoint(square, { x: square.x - .5, y: square.y + 10 }).inside, false)
  assert.equal(boxPoint(square, { x: square.x + 10, y: square.y + square.height + .5 }).inside, false)
  // 没有布局时也不能算出 NaN 或把点击算成图内。
  const empty = { x: 0, y: 0, width: 0, height: 0 }
  assert.deepEqual(boxPoint(empty, { x: 0, y: 0 }), { x: 0, y: 0, inside: false })
  assert.deepEqual(layoutPointToArt(empty, { x: 5, y: 5 }), { x: .5, y: .5 })
  const safe = characterGeometry(empty)
  assert.ok(Object.values(safe.feet).concat(Object.values(safe.headTop), Object.values(safe.contact)).every(Number.isFinite))
  assert.ok(Object.values(safe.visible).every(Number.isFinite))
})

test('framing with zoom, shift and mirror matches the reviewed desktop reserve math', () => {
  const path = 'pigs/forms/pig-fat/work.png'
  const [zoom, x, y] = BUILTIN_FRAMING[path]
  const bounds = ART_BOUNDS[path] ?? [0, 0, 1, 1]
  const box = { x: 100, y: 100, width: 100, height: 100 }
  const fit = Math.min(box.width, box.height)
  const plain = framedArtBox(box, { bounds, zoom, shiftX: x, shiftY: y })
  close(plain.x, box.x + box.width / 2 + (bounds[0] - .5) * fit * zoom + x * box.width / 100)
  close(plain.width, (bounds[2] - bounds[0]) * fit * zoom)
  close(plain.height, (bounds[3] - bounds[1]) * fit * zoom)
  close(plain.y + plain.height / 2,
    box.y + box.height / 2 + ((bounds[1] + bounds[3]) / 2 - .5) * fit * zoom + y * box.height / 100)
  // 翻面＝以盒子竖中线镜像；取景的横向偏移跟着反号，纵向不变。
  const mirrored = framedArtBox(box, { bounds, zoom, shiftX: x, shiftY: y, mirrored: true })
  close(mirrored.x + mirrored.width / 2, 2 * (box.x + box.width / 2) - (plain.x + plain.width / 2))
  close(mirrored.y, plain.y)
  close(mirrored.height, plain.height)
  // 桌面量框（measure.framedBox）走的是同一份算式。
  const node = {
    matches: () => true, getAttribute: () => '/dsh-piggy/art/' + path, closest: () => null,
    getBoundingClientRect: () => { throw new Error('静止量框不能读动画中的位置') },
    style: { getPropertyValue: key => String({ '--art-zoom': zoom, '--art-x': x + '%', '--art-y': y + '%' }[key]) },
  }
  assert.deepEqual(framedBox(node, box), plain)
})

test('feet, head-top and hand contact all come from one geometry, and mirroring reflects the hand', () => {
  const geometry = characterGeometry(wide)
  assert.deepEqual(geometry.feet, { x: wide.x + wide.width / 2, y: wide.y + wide.height })
  assert.deepEqual(geometry.headTop, { x: wide.x + wide.width / 2, y: wide.y })
  assert.deepEqual(feetPoint(wide), geometry.feet)
  assert.deepEqual(headTopPoint(wide), geometry.headTop)
  // 默认接触点＝画布归一化坐标映射到布局空间（正方形画布按短边居中）。
  close(geometry.contact.x, wide.x + wide.width / 2 + (HAND_CONTACT.x - .5) * wide.height)
  close(geometry.contact.y, wide.y + wide.height / 2 + (HAND_CONTACT.y - .5) * wide.height)
  const flipped = characterGeometry(wide, { mirrored: true })
  close(flipped.contact.x, 2 * (wide.x + wide.width / 2) - geometry.contact.x)
  close(flipped.contact.y, geometry.contact.y)
  assert.deepEqual(flipped.feet, geometry.feet, 'the desktop feet anchor does not move when the artwork flips')
  const { visible } = geometry
  for (const point of [geometry.feet, geometry.contact, geometry.headTop]) {
    assert.ok(point.x >= visible.x && point.x <= visible.x + visible.width)
  }
  assert.ok(geometry.feet.y >= visible.y && geometry.feet.y <= visible.y + visible.height)
})

test('visible box is the drawing envelope while the hit box stays the square layout box', () => {
  const art = { bounds: [-.5, -.25, 1.5, 1.25], zoom: 1, shiftX: 0, shiftY: 0 }
  const geometry = characterGeometry(square, art)
  assert.deepEqual(geometry.hit, square)
  assert.ok(geometry.visible.x < square.x && geometry.visible.width > square.width)
  assert.ok(geometry.visible.y < square.y && geometry.visible.height > square.height)
  assert.deepEqual(geometry.art, framedArtBox(square, art))
  // 未取景时可见范围就是布局盒。
  assert.deepEqual(characterGeometry(square).visible, square)
})

test('bubble slots sit one gap above the head and one gap below the feet', () => {
  const anchors = characterGeometry(wide)
  const size = { width: 268, height: 74 }
  const above = bubbleSlot(anchors, 'above', size)
  assert.equal(above.y + size.height, anchors.headTop.y - BUBBLE_GAP)
  assert.equal(above.x + size.width / 2, anchors.headTop.x)
  const below = bubbleSlot(anchors, 'below', size)
  assert.equal(below.y, anchors.feet.y + BUBBLE_GAP)
  assert.equal(below.x + size.width / 2, anchors.feet.x)
  // 尾巴跟着头顶中心，但夹在气泡圆角以内。
  assert.equal(bubbleTailLeft({ x: above.x, width: size.width }, anchors.headTop), size.width / 2 - 5)
  assert.equal(bubbleTailLeft({ x: 600, width: size.width }, anchors.headTop), 10)
  assert.equal(bubbleTailLeft({ x: -260, width: size.width }, anchors.headTop), 248)
})

test('bubble fitting keeps the head and feet anchors for offset and non-square pigs', () => {
  const anchors = characterGeometry(wide)
  const win = { x: 50, y: 20, width: 366, height: 400 }
  const area = { x: 50, y: 20, width: 912, height: 748 }
  const size = { width: 268, height: 74 }
  const above = bubbleSlot(anchors, 'above', size)
  const fitted = fitBubbleHorizontally({ x: above.x, width: size.width }, wide, win, area)
  // 尾巴对准头顶中心；宽盒子也按中心算，不按左边缘。
  assert.equal(fitted.tailLeft + fitted.x + 5, wide.x + wide.width / 2)
  assert.equal(fitBubbleHorizontally({ x: -172, width: size.width }, wide, win, area).x, 6)
  // 上方放不下就用脚底下方同一个间距。
  assert.deepEqual(fitBubbleVertically({ y: -30, height: size.height }, wide, win, area),
    { y: wide.y + wide.height + BUBBLE_GAP, side: 'below' })
  assert.deepEqual(fitBubbleVertically({ y: above.y, height: size.height }, wide, win, area),
    { y: above.y, side: 'above' })
  // 边界：气泡正好贴住可见区域的上下边时留在上方，不来回跳。
  assert.deepEqual(fitBubbleVertically({ y: 6, height: 108 }, wide, { x: 50, y: 20, width: 366, height: 120 }, area),
    { y: 6, side: 'above' })
})

test('pointer parts follow the artwork when the pig walks facing right', () => {
  const node = mirror => ({
    getAttribute: name => name === 'data-walk' && mirror ? 'right' : null,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 64, height: 64 }),
  })
  // 鼻尖朝左的图上点在左下＝鼻子；同一屏幕点点在翻面后的猪上＝肚子。
  const event = { clientX: 110, clientY: 50 + 0.7 * 64 }
  assert.equal(partAt(node(false), event), 'nose')
  assert.equal(partAt(node(true), event), 'belly')
  // 点在图外、量不到布局、没有猪时还是摸头。
  assert.equal(partAt(node(true), { clientX: 99, clientY: 60 }), 'head')
  assert.equal(partAt(null, event), 'head')
  assert.equal(partAt({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) }, event), 'head')
})

test('desktop measurement uses the same head-top and feet anchors for a mirrored wide pig', () => {
  const previousDocument = globalThis.document
  const previousStyle = globalThis.getComputedStyle
  const body = {}
  globalThis.document = { body }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: 'none' })

  const style = () => {
    const values = {}
    return {
      values,
      getPropertyValue: key => values[key] ?? '',
      setProperty: (key, value) => { values[key] = String(value) },
      removeProperty: key => { delete values[key] },
      get left() { return values.left ?? '' }, set left(value) { values.left = value },
      get right() { return values.right ?? '' }, set right(value) { values.right = value },
      get top() { return values.top ?? '' }, set top(value) { values.top = value },
      get bottom() { return values.bottom ?? '' }, set bottom(value) { values.bottom = value },
    }
  }
  // 一只 73×58 的猪：布局盒不是正方形，且正在朝右走（立绘翻面）。
  const makeNodes = (pigY = wide.y) => {
    const host = {
      offsetLeft: 0, offsetTop: 0, offsetWidth: 384, offsetHeight: 348, offsetParent: body,
      getAttribute: name => name === 'data-panel-side' ? 'right' : null, closest: () => null,
      style: { getPropertyValue: () => '1' },
    }
    const pig = {
      offsetLeft: wide.x, offsetTop: pigY, offsetWidth: wide.width, offsetHeight: wide.height,
      offsetParent: host, getAttribute: name => name === 'data-walk' ? 'right' : null,
      matches: () => false, closest: selector => selector === '.dp-pig' ? pig : null,
    }
    const attributes = {}
    const bubble = {
      offsetLeft: wide.x + wide.width - 272, offsetTop: pigY, offsetWidth: 272, offsetHeight: 40,
      offsetParent: host, matches: () => false, hidden: false, style: style(),
      closest: selector => selector === '.dp-bubble' ? bubble : null,
      getAttribute: name => attributes[name] ?? null,
      setAttribute: (name, value) => { attributes[name] = value },
      hasAttribute: name => name in attributes,
      removeAttribute: name => { delete attributes[name] },
    }
    host.querySelector = selector => selector === '.dp-pig' ? pig
      : selector === '.dp-bubble' ? bubble : null
    host.querySelectorAll = () => [pig, bubble]
    return { host, pig, bubble }
  }

  try {
    const anchors = characterGeometry({ ...wide })
    const windowBounds = { x: 0, y: 0, width: 384, height: 348 }
    const workArea = { x: 0, y: 60, width: 1280, height: 748 }
    const measure = createMeasure({ platform: 'linux', geometry: () => ({ window: windowBounds, workArea }) })
    const first = makeNodes()
    const measured = measure.boxes(first.host)
    assert.ok(measured.contentBox.top <= anchors.headTop.y)
    assert.ok(measured.contentBox.bottom >= anchors.feet.y + BUBBLE_GAP + 104)
    // 翻面不改变窗口尺寸：同一只猪不翻面时内容框一致。
    first.pig.getAttribute = () => null
    assert.deepEqual(measure.boxes(first.host).content, measured.content)
    // 气泡：上方放不下时贴到脚底下方，用的就是同一个脚底锚点。
    const nearTop = makeNodes(0)
    const shifted = characterGeometry({ ...wide, y: 0 })
    const short = { window: { x: 0, y: 0, width: 384, height: 348 }, workArea: { x: 0, y: 0, width: 1280, height: 348 } }
    const second = createMeasure({ platform: 'linux', geometry: () => short })
    second.fitBubble(nearTop.host, short)
    assert.equal(nearTop.bubble.getAttribute('data-bubble-side'), 'below')
    assert.equal(nearTop.bubble.style.top, shifted.feet.y + BUBBLE_GAP + 'px')
    // 上方放得下时不写 top，尾巴对准头顶中心（盒子横向偏移不影响锚点）。
    const third = makeNodes()
    const roomy = { window: { x: 0, y: 0, width: 384, height: 748 }, workArea: { x: 0, y: 0, width: 1280, height: 748 } }
    const above = createMeasure({ platform: 'linux', geometry: () => roomy })
    above.fitBubble(third.host, roomy)
    assert.equal(third.bubble.hasAttribute('data-bubble-side'), false)
    assert.equal(third.bubble.style.top, '')
  } finally {
    globalThis.document = previousDocument
    globalThis.getComputedStyle = previousStyle
  }
})
