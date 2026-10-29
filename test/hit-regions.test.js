import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collectHitRects, collectPigHitRects, hitsPig, hitsRects } from '../src/client/hit-regions.js'
import { measureCustomArt } from '../src/client/custom-art.js'
import { ART_BOUNDS } from '../src/client/art-framing.js'
import { createMeasure } from '../src/client/desktop/measure.js'
import { startHitTracking } from '../src/client/desktop/hit-tracking.js'
import { fakeDom } from './helpers/bundle.js'

const rect = (x, y, width, height) => ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height })
const point = (clientX, clientY, target) => ({ clientX, clientY, target })
let imageId = 0

function fixture(run) {
  const saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle, requestAnimationFrame: globalThis.requestAnimationFrame }
  const dom = fakeDom()
  const make = (className, box, parent = dom.body) => {
    const node = dom.document.createElement('div')
    node.className = className
    node.rect = box
    node.offsetWidth = box.width; node.offsetHeight = box.height
    node.offsetLeft = box.x; node.offsetTop = box.y; node.offsetParent = dom.body
    node.computed = {}
    parent.appendChild(node)
    return node
  }
  globalThis.document = dom.document
  globalThis.getComputedStyle = node => ({ display: 'block', visibility: 'visible', opacity: '1', transform: 'none', scale: 'none', animationName: 'none', ...node.computed })
  const host = make('', rect(0, 0, 800, 600))
  const pig = make('dp-pig', rect(100, 100, 128, 128), host)
  const image = (ink, options = {}) => {
    const node = make(options.sleep ? 'dp-pig-sleep' : 'dp-pig-img', options.box ?? rect(100, 100, 128, 128), pig)
    node.src = '/dsh-piggy/art/custom-hit-' + (++imageId)
    node.complete = true
    node.naturalWidth = options.width ?? 128; node.naturalHeight = options.height ?? 128
    const create = dom.document.createElement
    dom.document.createElement = tag => tag !== 'canvas' ? create(tag) : {
      width: 0, height: 0,
      getContext() {
        let draw
        return {
          drawImage(source, x, y, width, height) { draw = { x, y, width, height } },
          getImageData(x, y, width, height) {
            const data = new Uint8ClampedArray(width * height * 4)
            const left = draw.x + draw.width * ink[0], right = draw.x + draw.width * ink[2]
            const top = draw.y + draw.height * ink[1], bottom = draw.y + draw.height * ink[3]
            for (let py = Math.ceil(top); py < bottom; py++) for (let px = Math.ceil(left); px < right; px++) data[(py * width + px) * 4 + 3] = 255
            return { data }
          },
        }
      },
    }
    measureCustomArt(node, node.src, options.sleep)
    dom.document.createElement = create
    return node
  }
  try { run({ dom, host, pig, make, image }) } finally { Object.assign(globalThis, saved) }
}

function near(actual, expected) {
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(actual[key] - expected[key]) < .0001, `${key}: ${actual[key]} != ${expected[key]}`)
}

test('a small pig in a large transparent canvas excludes canvas, scene and drawing reserves', () => fixture(({ host, pig, image, make }) => {
  image([.375, .375, .625, .625])
  make('dp-pig-hold', rect(0, 0, 700, 500), pig)
  make('dp-pig-body', rect(0, 0, 700, 500), pig)
  make('dp-fx', rect(0, 0, 700, 500), host)
  const hitShape = collectHitRects(host)
  assert.deepEqual(hitShape, [{ x: 148, y: 148, width: 32, height: 32 }])
  assert.equal(hitsRects(hitShape, point(110, 110)), false)
  assert.equal(hitsPig(host, point(160, 160)), true)
  const measure = createMeasure({ platform: 'linux', geometry: () => null })
  host.querySelector = selector => selector === '.dp-pig' ? pig : null
  const measured = measure.boxes(host)
  assert.equal(hitsRects(measured.shape, point(110, 110)), true, '绘制空间不能因为收紧输入被裁掉')
  assert.equal(hitsRects(measured.hitShape, point(110, 110)), false)
  assert.equal(hitsRects(measured.hitShape, point(160, 160)), true)
}))

test('contain and current zoom/translation map the measured wide PNG exactly once', () => fixture(({ host, image }) => {
  const node = image([0, 0, 1, 1], { width: 256, height: 128, box: rect(50, 80, 256, 256) })
  node.offsetWidth = node.offsetHeight = 128
  node.computed.scale = '2'
  node.style.setProperty('--art-zoom', '2')
  near(collectPigHitRects(host)[0], { x: 50, y: 144, width: 256, height: 128 })
  assert.equal(hitsPig(host, point(70, 90)), false)
  assert.equal(hitsPig(host, point(70, 180)), true)
}))

test('asymmetric ink follows the rendered mirror, including a physical body flip', () => fixture(({ host, pig, image }) => {
  const node = image([0, .25, .25, .75])
  near(collectPigHitRects(host)[0], { x: 100, y: 132, width: 32, height: 64 })
  node.computed.transform = 'matrix(-1,0,0,1,0,0)'
  near(collectPigHitRects(host)[0], { x: 196, y: 132, width: 32, height: 64 })
  node.computed.transform = 'none'
  pig.computed.transform = 'matrix(-1,0,0,1,0,0)'
  near(collectPigHitRects(host)[0], { x: 196, y: 132, width: 32, height: 64 })
}))

test('rotated artwork transforms ink corners instead of cropping the rotated canvas box', () => fixture(({ host, pig, image }) => {
  const node = image([0, 0, .25, .5])
  node.rect = rect(100, 100, 128, 128)
  pig.computed.transform = 'matrix(0,1,-1,0,0,0)'
  near(collectPigHitRects(host)[0], { x: 164, y: 100, width: 64, height: 32 })
}))

test('sleep uses its own 1.2:1 contain box and ignores the hidden standing image', () => fixture(({ host, pig, image }) => {
  const standing = image([0, 0, 1, 1])
  standing.computed.visibility = 'hidden'
  const sleep = image([0, 0, 1, 1], { sleep: true, width: 256, height: 128, box: rect(80, 100, 192, 160) })
  pig.setAttribute('data-walk', 'right')
  near(collectPigHitRects(host)[0], { x: 80, y: 132, width: 192, height: 96 })
  sleep.computed.opacity = '0'
  assert.deepEqual(collectHitRects(host), [])
  sleep.computed.opacity = '1'; pig.hidden = true
  assert.deepEqual(collectHitRects(host), [])
}))

test('emoji and hats use their own visible text boxes while empty slots and old images do not hit', () => fixture(({ host, pig, image, make }) => {
  const old = image([0, 0, 1, 1]); old.hidden = true
  const emoji = make('dp-pig-emoji', rect(140, 145, 30, 25), pig); emoji.textContent = 'box'
  const hat = make('dp-slot', rect(145, 120, 20, 20), pig); hat.textContent = 'hat'
  make('dp-slot', rect(0, 0, 500, 500), pig)
  assert.equal(hitsPig(host, point(150, 130)), true)
  assert.equal(hitsPig(host, point(150, 150)), true)
  assert.equal(hitsPig(host, point(110, 110)), false)
  emoji.hidden = true; hat.computed.display = 'none'
  assert.deepEqual(collectHitRects(host), [])
}))

test('visible speech/gift controls remain input but take priority over overlapping pig ink', () => fixture(({ host, image, make }) => {
  image([0, 0, 1, 1])
  const bubble = make('dp-bubble', rect(140, 110, 60, 30), host)
  const reply = make('', rect(140, 110, 60, 30), bubble); reply.tagName = 'button'
  const gift = make('dp-daily', rect(100, 80, 40, 30), host); gift.tagName = 'button'
  assert.equal(hitsRects(collectHitRects(host), point(110, 90)), true)
  assert.equal(hitsPig(host, point(150, 120, reply)), false)
  assert.equal(hitsPig(host, point(110, 110, gift)), false)
  gift.hidden = true; bubble.hidden = true
  assert.equal(hitsRects(collectHitRects(host), point(110, 90)), false)
}))

test('input-only animation reports follow ink, deduplicate and pause during native capture', () => fixture(({ host, image }) => {
  const node = image([.375, .375, .625, .625])
  const frames = [], requests = [], inputs = []
  let blocked = false
  globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length }
  startHitTracking({ host: () => host, shell: { place: request => requests.push(request) }, blocked: () => blocked, onShape: shape => inputs.push(shape) })
  frames.shift()(0)
  assert.equal(requests.length, 1)
  assert.deepEqual(Object.keys(requests[0]), ['hitShape'])
  frames.shift()(32)
  assert.equal(requests.length, 1)
  node.rect = rect(110, 80, 128, 128)
  frames.shift()(64)
  assert.equal(requests[1].hitShape[0].x, 158)
  blocked = true; node.rect = rect(120, 80, 128, 128); frames.shift()(96)
  assert.equal(requests.length, 2)
  blocked = false; frames.shift()(128)
  assert.equal(requests[2].hitShape[0].x, 168)
  assert.deepEqual(inputs.at(-1), requests.at(-1).hitShape)
}))

test('built-in alpha bounds follow the displayed framing and mirror without counting it twice', () => fixture(({ host, pig, make }) => {
  const path = 'pigs/forms/pig-fat/work.png'
  const image = make('dp-pig-img', rect(50, 70, 192, 192), pig)
  image.src = '/dsh-piggy/art/' + path
  image.complete = true; image.naturalWidth = image.naturalHeight = 128
  image.offsetWidth = image.offsetHeight = 128
  image.computed.scale = '1.5'; image.computed.transform = 'matrix(-1,0,0,1,0,0)'
  image.style.setProperty('--art-zoom', '1.5')
  const [left, top, right, bottom] = ART_BOUNDS[path]
  near(collectPigHitRects(host)[0], { x: 50 + (1 - right) * 192, y: 70 + top * 192,
    width: (right - left) * 192, height: (bottom - top) * 192 })
}))
