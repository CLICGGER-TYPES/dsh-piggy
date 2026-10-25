// @ts-check
/**
 * 角色几何合同（P1-2）：脚底中心、头顶气泡锚点、小手接触点、可见范围、命中范围都从这一份映射算出来。
 *
 * 只处理两种空间之间的换算，不碰 DOM、动画和窗口：
 *   - 布局空间：`.dp-pig` 的布局盒（offsetLeft/offsetTop 累加出来的 CSS 像素），桌面版猪窗口和 DSH 页面都用它；
 *     呼吸、浮动、抛掷只改 transform，**不进这个盒子**，所以静止布局不读动画中的 getBoundingClientRect。
 *   - 立绘归一化空间：所有立绘都是同一块正方形画布（见 docs/guides/creating-skins.md），
 *     0–1 是画布坐标，`ART_BOUNDS`（feedback-framing.js）给出的可见范围也在这套坐标里。
 *
 * 朝向：`.dp-pig[data-walk="right"]` 用 `scaleX(-1)` 翻图，盒子不翻。所以「立绘自己的坐标」和
 * 「屏幕上的左右」是两套：`framing.mirrored` 只在换算时翻转 x（接触点、取景偏移一起翻），
 * 命中区仍是那个不动的正方形盒子。
 *
 * 气泡：头顶锚点上方留 BUBBLE_GAP 放气泡；上方放不下时改用脚底下方同一个间距（见 desktop/bubble-geometry.js）。
 * 这些数值是现有桌面版的行为，不在这里重新设计。
 * @module dsh-piggy/client/character-geometry
 */

/** 头顶气泡与猪的间距（上方用锚点减、下方用脚底加）。 */
export const BUBBLE_GAP = 10

/** 气泡尾巴离气泡左边缘的最小/最大内缩，别戳出圆角。 */
export const BUBBLE_TAIL_INSET = 5
export const BUBBLE_TAIL_MIN = 10
export const BUBBLE_TAIL_MAX = 20

/**
 * 默认（鼻尖朝左）立绘里小手的接触点，归一化画布坐标。
 * 自动估计只是自定义包的初始值；帽子、巨大透明边、非标准头型仍要按 skin-pack-format 校准。
 */
export const HAND_CONTACT = Object.freeze({ x: .3, y: .58 })

/** @typedef {{x:number,y:number,width:number,height:number}} Rect */
/** @typedef {{x:number,y:number}} Point */
/** @typedef {{bounds?:number[]|null, zoom?:number, shiftX?:number, shiftY?:number, mirrored?:boolean}} Framing */

const finite = (value, fallback) => Number.isFinite(value) ? Number(value) : fallback

/** 画布取景的正方形边长：猪的布局盒可能是 73×58 这种非正方形，立绘始终按短边居中放。 @param {Rect} box */
export function artFitSize(box) {
  return Math.min(finite(box.width, 0), finite(box.height, 0))
}

/**
 * 立绘画布在布局空间里的方框（不含取景偏移；framedArtBox 用它做基准）。
 * @param {Rect} box
 * @param {Framing} [framing]
 */
function frameOrigin(box, framing) {
  const fit = artFitSize(box)
  const zoom = finite(framing?.zoom, 0) > 0 ? finite(framing?.zoom, 1) : 1
  const shiftX = finite(framing?.shiftX, 0)
  const shiftY = finite(framing?.shiftY, 0)
  const mirrored = framing?.mirrored === true
  return {
    x: box.x + box.width / 2 + (mirrored ? -shiftX : shiftX) * box.width / 100,
    y: box.y + box.height / 2 + shiftY * box.height / 100,
    size: fit * zoom,
    mirrored,
  }
}

/** 两个矩形并集。 @param {Rect} a @param {Rect} b */
export function unionBox(a, b) {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const r = Math.max(a.x + a.width, b.x + b.width)
  const btm = Math.max(a.y + a.height, b.y + b.height)
  return { x, y, width: r - x, height: btm - y }
}

/**
 * 立绘可见范围（立绘画布 + 取景缩放/偏移 + 翻面）在布局空间里的矩形。
 * 以前这段换算写在 desktop/measure.js 的 framedBox 里，现在全项目只留这一份。
 * @param {Rect} box 猪的布局盒
 * @param {Framing} [framing] bounds 是归一化画布里的 [left, top, right, bottom]
 * @returns {Rect}
 */
export function framedArtBox(box, framing = {}) {
  const bounds = framing.bounds ?? [0, 0, 1, 1]
  const frame = frameOrigin(box, framing)
  const mirrored = frame.mirrored
  const left = mirrored ? 1 - bounds[2] : bounds[0]
  const right = mirrored ? 1 - bounds[0] : bounds[2]
  return {
    x: frame.x + (left - .5) * frame.size,
    y: frame.y + (bounds[1] - .5) * frame.size,
    width: (right - left) * frame.size,
    height: (bounds[3] - bounds[1]) * frame.size,
  }
}

/**
 * 归一化画布坐标 → 布局空间。取景、缩放、翻面与 framedArtBox 用的是同一份算式。
 * @param {Rect} box @param {Point} normalized @param {Framing} [framing]
 * @returns {Point}
 */
export function artPointToLayout(box, normalized, framing = {}) {
  const frame = frameOrigin(box, framing)
  const nx = frame.mirrored ? 1 - normalized.x : normalized.x
  return { x: frame.x + (nx - .5) * frame.size, y: frame.y + (normalized.y - .5) * frame.size }
}

/**
 * 布局空间点 → 立绘自己的归一化坐标（翻面时把 x 翻回去，摸猪分区才和图上部位一致）。
 * @param {Rect} box @param {Point} point @param {Framing} [framing]
 * @returns {Point}
 */
export function layoutPointToArt(box, point, framing = {}) {
  const frame = frameOrigin(box, framing)
  if (frame.size <= 0) return { x: .5, y: .5 }
  const dx = (finite(point.x, frame.x) - frame.x) / frame.size
  const dy = (finite(point.y, frame.y) - frame.y) / frame.size
  return { x: frame.mirrored ? 1 - (.5 + dx) : .5 + dx, y: .5 + dy }
}

/**
 * 布局盒里的相对位置（0–1）。命中判定用它，和立绘取景无关（盒子不随动画变）。
 * @param {Rect} box @param {Point} point
 * @returns {{x:number, y:number, inside:boolean}}
 */
export function boxPoint(box, point) {
  const width = finite(box.width, 0)
  const height = finite(box.height, 0)
  const x = width > 0 ? (finite(point.x, box.x) - box.x) / width : 0
  const y = height > 0 ? (finite(point.y, box.y) - box.y) / height : 0
  return { x, y, inside: width > 0 && height > 0 && x >= 0 && x <= 1 && y >= 0 && y <= 1 }
}

/** 脚底中心（桌面版「家」的锚点）：布局盒底边中点。 @param {Partial<Rect>} box @returns {Point} */
export function feetPoint(box) {
  return { x: finite(box.x, 0) + finite(box.width, 0) / 2, y: finite(box.y, 0) + finite(box.height, 0) }
}

/** 头顶中心：气泡主锚点（气泡底边在它上方 BUBBLE_GAP）。 @param {Partial<Rect>} box @returns {Point} */
export function headTopPoint(box) {
  return { x: finite(box.x, 0) + finite(box.width, 0) / 2, y: finite(box.y, 0) }
}

/**
 * 气泡槽位：上方放头顶之上，下方放脚底之下，间距都是 BUBBLE_GAP。
 * @param {{headTop:Point, feet:Point}} anchors
 * @param {'above'|'below'} side
 * @param {{width:number, height:number}} size
 * @returns {Point} 气泡左上角
 */
export function bubbleSlot(anchors, side, size) {
  const height = finite(size?.height, 0)
  const width = finite(size?.width, 0)
  if (side === 'below') return { x: anchors.feet.x - width / 2, y: anchors.feet.y + BUBBLE_GAP }
  return { x: anchors.headTop.x - width / 2, y: anchors.headTop.y - BUBBLE_GAP - height }
}

/**
 * 气泡尾巴离气泡左边缘的位置：对头顶中心，夹在圆角以内。
 * @param {{x:number, width:number}} bubble 已经摆好的气泡（布局空间）
 * @param {Point} head 头顶中心
 * @param {number} [inset]
 */
export function bubbleTailLeft(bubble, head, inset = BUBBLE_TAIL_INSET) {
  const width = finite(bubble.width, 0)
  return Math.max(BUBBLE_TAIL_MIN, Math.min(width - BUBBLE_TAIL_MAX, finite(head.x, 0) - finite(bubble.x, 0) - inset))
}

/**
 * 角色几何：同一次换算给出脚底、头顶、接触点、可见范围、命中范围。
 * 传入的盒子必须是布局盒（静止布局），不要传动画中的矩形。
 * @param {Rect} box 猪的布局盒
 * @param {Framing} [framing]
 */
export function characterGeometry(box, framing = {}) {
  const layout = { x: finite(box.x, 0), y: finite(box.y, 0), width: finite(box.width, 0), height: finite(box.height, 0) }
  const art = framedArtBox(layout, framing)
  return {
    box: layout,
    mirrored: framing.mirrored === true,
    art,
    /** 静止绘制范围：布局盒 ∪ 立绘可见范围（宽立绘会伸出正方形盒子）。 */
    visible: unionBox(layout, art),
    /** 可点范围：仍是那个正方形布局盒，和以前一致。 */
    hit: { ...layout },
    feet: feetPoint(layout),
    headTop: headTopPoint(layout),
    contact: artPointToLayout(layout, HAND_CONTACT, framing),
  }
}
