// @ts-check
/**
 * 装扮点位（.dp-slot）的稳定布局几何：Linux 原生 setShape 只认矩形，而点位用
 * `transform:translate(-50%,-50%)` 把 emoji 居中在锚点上。transform 不进布局盒，所以
 * 按 offsetLeft/offsetTop 量出来的矩形停在锚点（帽心）上，比画出来的帽子低半个字号。
 * 同比例放大后帽子上沿落到「猪盒上沿 - 6px」之外被裁掉；prefers-reduced-motion 把待机
 * 动画关掉（没有 dp-bob 包络）时缺口最大。舞台（stage-dom.js 的 drawingBounds）用的是
 * 固定 44/18px 余量：上沿够 500% 的帽子，脚下不够 500% 的靴子。
 *
 * 断言只用布局几何：offsetLeft/offsetTop/offsetWidth/offsetHeight（和 measure.js 同一个来源）
 * 加上自带 emoji 字体量出来的墨迹比例，不读 getBoundingClientRect —— 呼吸/浮动只改 transform，
 * rect 每帧都在抖。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createMeasure } from '../src/client/desktop/measure.js'
import { pigEnvelope, stageDrawingBounds } from '../src/client/stage-dom.js'
import { collectStageShape } from '../apps/desktop/stage/overlay-shape.js'
import { LIFE_STAGES } from '../packages/pet-core/src/data/life.js'
import { WEIGHT_RULES } from '../packages/pet-core/src/data/weight.js'

const PIG_X = 400
const PIG_Y = 400
const SCALES = [1, 2, 5]

/**
 * css-base.js 的 `.dp-slot` 点位：left/top 是猪盒的百分比，字号基准 15px（头/脸/脖子/脚）
 * 与 19px（身子/背），再乘本机显示比例 `--pig-scale`。
 */
const SLOT = {
  head: { left: .5, top: .02, font: 15 },
  face: { left: .5, top: .32, font: 15 },
  neck: { left: .5, top: .6, font: 15 },
  body: { left: .5, top: .78, font: 19 },
  back: { left: .14, top: .42, font: 19 },
  feet: { left: .5, top: .99, font: 15 },
}

/**
 * 每个装扮 emoji 的墨迹，相对 `.dp-slot` 布局盒（line-height:1 的行盒）的 em 比例：
 * adv 行盒宽；top/bottom 墨迹上/下沿；left/right 墨迹左/右沿（从元素左沿算）。
 * 由自带字体 apps/desktop/renderer/piggy-emoji.ttf 的原生 strike（109ppem）量 alpha 墨迹，
 * 再按 Noto 的 hhea（ascent 1900 / descent 500 / upem 2048）放到 line-height:1 的行盒里得到。
 * 墨迹在 em 里的比例与字号无关，可以线性放大到 15/19px 的 1/2/5 倍。
 */
const INK = {
  '🎩': { slot: 'head', adv: 1.2451, top: 0.0596, bottom: 0.9771, left: 0.0734, right: 1.1835 },
  '👒': { slot: 'head', adv: 1.2451, top: 0.1239, bottom: 0.9862, left: 0.0917, right: 1.1835 },
  '🍒': { slot: 'head', adv: 1.2451, top: -0.0596, bottom: 1.0688, left: 0.1651, right: 1.055 },
  '💐': { slot: 'head', adv: 1.2451, top: -0.0688, bottom: 1.078, left: 0.1468, right: 1.1009 },
  '🕶': { slot: 'face', adv: 1.2451, top: 0.3073, bottom: 0.6927, left: 0.0734, right: 1.1743 },
  '🧣': { slot: 'neck', adv: 1.2451, top: -0.0596, bottom: 1.0596, left: 0.2202, right: 0.9908 },
  '🎀': { slot: 'neck', adv: 1.2451, top: 0.0229, bottom: 1.0229, left: 0.0642, right: 1.1835 },
  '📿': { slot: 'neck', adv: 1.2451, top: -0.0505, bottom: 1.0505, left: 0.0642, right: 1.1743 },
  '👖': { slot: 'body', adv: 1.2451, top: -0.0505, bottom: 1.0596, left: 0.3303, right: 0.9174 },
  '🧶': { slot: 'body', adv: 1.2451, top: -0.0596, bottom: 1.0505, left: 0.1284, right: 1.1376 },
  '🥾': { slot: 'feet', adv: 1.2451, top: 0.0413, bottom: 1.0413, left: 0.0734, right: 1.1743 },
  '🦸': { slot: 'back', adv: 1.2451, top: -0.0688, bottom: 1.0688, left: 0.2477, right: 1 },
  '🪽': { slot: 'back', adv: 1.2451, top: -0.0229, bottom: 1.0229, left: 0.0734, right: 1.1835 },
}

const HEAD = ['🎩', '👒', '🍒', '💐']
const EVERYTHING = Object.keys(INK)

/** 五个真实猪盒边长：三个学段 + 圆润/胖胖（weightStageView 把成年猪乘 1.18 / 1.5 再取整）。 */
const ADULT = LIFE_STAGES.find(stage => stage.key === 'middle')
const SIZES = [
  ...LIFE_STAGES.filter(stage => stage.box !== true).map(stage => stage.size),
  Math.round(ADULT.size * WEIGHT_RULES.roundSizeMultiplier),
  Math.round(ADULT.size * WEIGHT_RULES.fatSizeMultiplier),
]

const covers = (shape, rect) => shape.some(one => rect.x >= one.x && rect.y >= one.y
  && rect.x + rect.width <= one.x + one.width && rect.y + rect.height <= one.y + one.height)
const inside = (shape, point) => shape.some(one => point.x >= one.x && point.x <= one.x + one.width
  && point.y >= one.y && point.y <= one.y + one.height)
const shapeTop = shape => Math.min(...shape.map(one => one.y))

/** 点位画出来的盒子与墨迹盒子（页面坐标）。百分比 left/top 按浏览器取整后的 offset* 算。 */
function dressRects(emoji, size, scale) {
  const spot = SLOT[INK[emoji].slot]
  const font = spot.font * scale
  const width = Math.round(INK[emoji].adv * font)
  const height = font
  const nodeX = Math.round(spot.left * size)
  const nodeY = Math.round(spot.top * size)
  // translate(-50%,-50%)：百分比相对自身边框盒，画出来的盒子就是布局盒挪半格。
  const box = { x: PIG_X + nodeX - width / 2, y: PIG_Y + nodeY - height / 2, width, height }
  return {
    nodeX, nodeY, width, height, font, box,
    ink: {
      x: box.x + INK[emoji].left * font,
      y: box.y + INK[emoji].top * font,
      width: (INK[emoji].right - INK[emoji].left) * font,
      height: (INK[emoji].bottom - INK[emoji].top) * font,
    },
  }
}

/**
 * 最小桌面场景：猪盒 + `.dp-dress`（inset:0）+ 若干 `.dp-slot`。
 * `jitter` 给每个节点装一个「动画中」的 getBoundingClientRect：布局几何一旦改用它，
 * 量出来的形状就会跟着抖，测试会当场发现。
 */
function fixture({ size, scale, pieces, animation = 'none', jitter = 0, hidden = false }, run) {
  const previousDocument = globalThis.document
  const previousStyle = globalThis.getComputedStyle
  const body = {}
  globalThis.document = { body }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: animation })
  const node = (x, y, width, height) => {
    const box = {
      offsetLeft: x, offsetTop: y, offsetWidth: width, offsetHeight: height, offsetParent: body,
      matches: () => false, closest: () => null, getAttribute: () => null,
    }
    if (jitter !== 0) {
      box.getBoundingClientRect = () => ({ left: x + 3, top: y - jitter, width, height,
        right: x + 3 + width, bottom: y - jitter + height })
    }
    return box
  }
  const pig = node(PIG_X, PIG_Y, size, size)
  pig.closest = selector => selector === '.dp-pig' ? pig : null
  const dress = node(0, 0, size, size)
  dress.offsetParent = pig
  const drawn = new Map()
  const ink = new Map()
  const slots = pieces.map(emoji => {
    const rect = dressRects(emoji, size, scale)
    const slot = node(rect.nodeX, rect.nodeY, hidden ? 0 : rect.width, hidden ? 0 : rect.height)
    slot.offsetParent = dress
    slot.matches = selector => selector === '.dp-slot'
    drawn.set(emoji, rect.box)
    ink.set(emoji, rect.ink)
    return slot
  })
  const host = node(PIG_X, PIG_Y, size, size)
  host.querySelectorAll = () => [pig, dress, ...slots]
  host.querySelector = selector => selector === '.dp-pig' ? pig : null
  const measure = createMeasure({ platform: 'linux', geometry: () => null })
  try {
    return run({ measure: () => measure.boxes(host), drawn, ink, pig })
  } finally {
    globalThis.document = previousDocument
    globalThis.getComputedStyle = previousStyle
  }
}

test('the centred dress box and its ink are inside the native shape at every scale', () => {
  for (const base of SIZES) {
    for (const scale of SCALES) {
      for (const emoji of HEAD) {
        fixture({ size: base * scale, scale, pieces: [emoji] }, ({ measure, drawn, ink }) => {
          const shape = measure().shape
          const box = drawn.get(emoji)
          const label = `${emoji} ${base}px@${scale}x`
          assert.ok(covers(shape, box), `${label}: 点位画出来的盒子要在 shape 里`)
          assert.ok(covers(shape, ink.get(emoji)), `${label}: 墨迹要在 shape 里`)
          // 上沿必须是「画出来的盒子顶 - 6px（取整）」，不是靠一块超大 slack 盖住的。
          const gap = box.y - shapeTop(shape)
          assert.ok(gap >= 5 && gap <= 8, `${label}: shape 上沿留白 ${gap}px（应为取整后的 6px）`)
          assert.equal(inside(shape, { x: box.x + box.width / 2, y: box.y - 8 }), false,
            `${label}: 画出来的盒子顶上方 8px 外应该还是穿透区`)
        })
      }
    }
  }
})

test('every reviewed dress emoji keeps its measured ink inside the shape', () => {
  for (const base of [SIZES[0], SIZES[2], SIZES[4]]) {
    for (const scale of SCALES) {
      for (const emoji of EVERYTHING) {
        fixture({ size: base * scale, scale, pieces: [emoji] }, ({ measure, drawn, ink }) => {
          const shape = measure().shape
          const label = `${emoji} ${base}px@${scale}x`
          assert.ok(covers(shape, drawn.get(emoji)), `${label}: 点位画出来的盒子要在 shape 里`)
          assert.ok(covers(shape, ink.get(emoji)), `${label}: 墨迹要在 shape 里`)
        })
      }
    }
  }
})

test('the idle bob envelope keeps the same ink inside the shape', () => {
  for (const base of SIZES) {
    for (const scale of SCALES) {
      for (const emoji of HEAD) {
        fixture({ size: base * scale, scale, pieces: [emoji], animation: 'dp-bob' }, ({ measure, ink }) => {
          assert.ok(covers(measure().shape, ink.get(emoji)), `${emoji} ${base}px@${scale}x: 待机动画时墨迹也要在 shape 里`)
        })
      }
    }
  }
})

test('a dress that is not rendered adds no click-through area', () => {
  // display:none（反馈图/打盹/困了）时点位的 offsetWidth/offsetHeight 是 0：不能因为
  // 折算 translate 就给猪头上方凭空加回一块看不见的可点区域。
  fixture({ size: 340, scale: 5, pieces: ['🎩'], hidden: true }, ({ measure }) => {
    assert.equal(shapeTop(measure().shape), PIG_Y - 6, '隐藏的装扮不应撑出猪盒上方的区域')
  })
})

test('an animated getBoundingClientRect cannot move the measured shape', () => {
  const options = { size: 340, scale: 5, pieces: ['🎩', '🦸', '🥾'] }
  fixture(options, ({ measure: still }) => {
    fixture({ ...options, jitter: -7 }, ({ measure: bobbing }) => {
      assert.deepEqual(bobbing().shape, still().shape, '几何只能读布局盒，不能跟着动画 rect 抖')
    })
  })
})

test('wearing a dress never resizes the pig window frame', () => {
  fixture({ size: 340, scale: 5, pieces: [] }, ({ measure: bare }) => {
    const before = bare()
    for (const emoji of EVERYTHING) {
      fixture({ size: 340, scale: 5, pieces: [emoji] }, ({ measure }) => {
        const next = measure()
        assert.deepEqual(next.content, before.content, `${emoji}: 窗口外框不跟装扮变`)
        assert.deepEqual(next.pig, before.pig, `${emoji}: 猪在窗口里的位置不变`)
      })
    }
  })
})

/**
 * 舞台路径的最小页面：一个可见的 `.dp-slot`。舞台外壳用 collectStageShape 把
 * 固定余量（PIG_TOP/PIG_BOTTOM）和 drawingBounds（stage-dom.js 的 bodyVisualBounds，
 * 自带立绘边距）并成形状。这里确认它已经盖住同比例放大的装扮，不用另加点位矩形。
 */
function stageFixture({ size, scale, emoji }, run) {
  const previousDocument = globalThis.document
  const previousStyle = globalThis.getComputedStyle
  const body = {}
  globalThis.document = { body }
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1', animationName: 'none', translate: '' })
  const rect = dressRects(emoji, size, scale)
  const slot = {
    offsetLeft: rect.nodeX, offsetTop: rect.nodeY, offsetWidth: rect.width, offsetHeight: rect.height,
    offsetParent: body, matches: selector => selector === '.dp-slot', closest: () => null, getAttribute: () => null,
  }
  const pig = {
    offsetLeft: PIG_X, offsetTop: PIG_Y, offsetWidth: size, offsetHeight: size, offsetParent: body,
    matches: () => false, closest: () => null, getAttribute: () => null,
    querySelectorAll: selector => selector === '.dp-slot' ? [slot] : [],
    getBoundingClientRect: () => ({ left: PIG_X, top: PIG_Y, width: size, height: size,
      right: PIG_X + size, bottom: PIG_Y + size }),
  }
  const host = { querySelector: selector => selector === '.dp-pig' ? pig : null, getAttribute: () => null }
  try {
    return run({ pig, rect })
  } finally {
    globalThis.document = previousDocument
    globalThis.getComputedStyle = previousStyle
  }
}

test('the stage fixed band already covers the scaled hat', () => {
  for (const base of SIZES) {
    for (const scale of SCALES) {
      for (const emoji of HEAD) {
        stageFixture({ size: base * scale, scale, emoji }, ({ pig, rect }) => {
          const envelope = pigEnvelope(pig)
          assert.ok(envelope !== null)
          assert.ok(envelope.y <= rect.ink.y, `${emoji} ${base}px@${scale}x: 固定上沿要盖住帽顶`)
        })
      }
    }
  }
})

test('the stage shape already covers the same dress ink through its drawing bounds', () => {
  for (const base of SIZES) {
    for (const scale of SCALES) {
      for (const emoji of EVERYTHING) {
        stageFixture({ size: base * scale, scale, emoji }, ({ pig, rect }) => {
          const report = collectStageShape(
            { querySelector: selector => selector === '.dp-pig' ? pig : null, getAttribute: () => null },
            { querySelectorAll: () => [] },
            box => stageDrawingBounds(box, pig))
          assert.ok(report !== null)
          const label = `${emoji} ${base}px@${scale}x`
          assert.ok(covers(report.shape, rect.box), `${label}: 画出来的盒子要在舞台 shape 里`)
          assert.ok(covers(report.shape, rect.ink), `${label}: 墨迹要在舞台 shape 里`)
        })
      }
    }
  }
})
