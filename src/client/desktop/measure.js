// @ts-check
/**
 * 桌面版猪窗口：量「猪 + 气泡」占多大、把整块内容钉在窗口锚边上（从桌面程序 renderer/shell.js 搬进游戏包）。
 *
 * 外壳 0.6.0 起面板在另一个窗口里（见 panel-window.js），这里只管猪窗口：一块只跟猪大小有关的
 * 固定框，冒气泡、飘爱心、出道具都不改窗口大小。以前单窗口时给面板预留位置、记面板朝向的那套
 * （2026-10-07 前）已删掉。
 *
 * 量框一律用布局盒（offsetLeft/offsetTop 累加），不用 getBoundingClientRect：呼吸、浮动动画只改
 * transform，rect 每帧都在抖。
 */
import { PAD, STEP } from './geometry.js'

/** 猪头上方预留的气泡区：冒气泡只改可点区域，不改窗口大小。 */
const BUBBLE_ZONE = { width: 272, height: 104 }
/** 可点区域四周放宽几像素：礼包浮动、猪摇摆会越出布局盒一点。 */
const SHAPE_SLACK = 6
/** 内容永远钉在窗口右下角（猪窗口里没有面板，不用挑边）。 */
const SIDE = Object.freeze({ vertical: 'bottom', horizontal: 'right' })

/** @param {any} node */
export function layoutBox(node) {
  let x = 0
  let y = 0
  let walk = node
  while (walk !== null && walk !== undefined && walk !== document.body) {
    x += walk.offsetLeft || 0
    y += walk.offsetTop || 0
    walk = walk.offsetParent
  }
  return { x, y, width: node.offsetWidth || 0, height: node.offsetHeight || 0 }
}

/** @param {any} node */
function visible(node) {
  const style = getComputedStyle(node)
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.01
}

/**
 * @param {{ platform: string, geometry: () => any }} env
 */
export function createMeasure(env) {
  /** shift：窗口被夹回工作区时，整块内容在窗口里反向挪多少（猪的屏幕位置不变，只裁掉透明留白）。 */
  const state = { pinned: '', bubbleHeight: null, shift: { x: 0, y: 0 } }
  const reserves = env.platform !== 'darwin'

  /** @param {any} host */
  function boxes(host) {
    const nodes = [host]
    const all = host.querySelectorAll('*')
    for (let a = 0; a < all.length; a += 1) {
      const candidate = all[a]
      const inCard = candidate.closest('.dp-card')
      if ((inCard !== null && inCard !== candidate) || candidate.closest('.dp-fx') !== null) continue
      nodes.push(candidate)
    }
    const geometry = env.geometry()
    let rects = []
    // 气泡只进可点/可见区域，不进窗口外框：它的位置已经由下面的气泡预留区留好了。
    // 以前气泡会撑大外框，面板朝下开时一冒气泡整块内容就要挪，Windows 上会画出一帧重影
    // （用户 2026-10-05 录屏：右键开面板时猪下面多一只半透明的猪，气泡消失时往上闪）。
    const bubbleRects = []
    for (const node of nodes) {
      if (node.closest('[hidden]') !== null || !visible(node)) continue
      const bubble = node.closest('.dp-bubble')
      const box = layoutBox(node)
      if (box.width < 1 || box.height < 1) continue
      const rect = { x: box.x, y: box.y, r: box.x + box.width, b: box.y + box.height }
      if (bubble !== null) bubbleRects.push(rect)
      else rects.push(rect)
    }
    if (rects.length === 0) return null
    const hostBox = layoutBox(host)
    const pigNode = host.querySelector('.dp-pig')
    const pigBox = pigNode === null ? { x: 0, y: 0, width: 0, height: 0 } : layoutBox(pigNode)
    // 气泡预留区：收起、打开都留，气泡出现/消失不改外框。离屏幕顶边不够高就只留到顶边。
    let bubbleZone = null
    if (reserves && pigNode !== null) {
      const above = geometry === null ? BUBBLE_ZONE.height : geometry.window.y + pigBox.y - geometry.workArea.y - PAD
      // 滞回：预留区高度是「窗口当前在哪」的函数，而窗口位置又是「内容框（含这个预留区）」的函数，
      // 结构上是一个反馈环（量化到 4px 后可能变成极限环）。预留区只是「留多少位置」的估计，
      // 差不到两档就不改，环就断了。
      // 注意：2026-10-06 查的那 3~4px 抖动**不是**这条环造成的，是猪自己的待机动画（见 I-round.md），
      // 这里保留只是因为依赖方向确实成环，且代价为零。
      const want = Math.max(0, Math.min(BUBBLE_ZONE.height, Math.round(above)))
      if (state.bubbleHeight === null || Math.abs(want - state.bubbleHeight) >= STEP * 2) state.bubbleHeight = want
      const height = state.bubbleHeight
      const zoneLeft = host.getAttribute('data-panel-side') === 'right' ? hostBox.x : hostBox.x + hostBox.width - BUBBLE_ZONE.width
      if (height > 0) bubbleZone = { x: zoneLeft, y: pigBox.y - height, r: zoneLeft + BUBBLE_ZONE.width, b: pigBox.y }
    }
    let merged = true
    while (merged) {
      merged = false
      for (let p = 0; p < rects.length && !merged; p += 1) {
        for (let q = p + 1; q < rects.length; q += 1) {
          const one = rects[p]
          const two = rects[q]
          if (one.x <= two.r && two.x <= one.r && one.y <= two.b && two.y <= one.b) {
            rects[p] = { x: Math.min(one.x, two.x), y: Math.min(one.y, two.y), r: Math.max(one.r, two.r), b: Math.max(one.b, two.b) }
            rects.splice(q, 1)
            merged = true
            break
          }
        }
      }
    }
    const outline = rects.concat(bubbleZone === null ? [] : [bubbleZone])
    // 猪窗口用一块**固定大小**的框：猪头上留气泡区、左边留签到小气泡和打工道具、两侧留摸猪时飘的爱心。
    // 框只跟猪的大小有关，冒气泡、飘爱心、出道具都不改窗口大小（改大小就有一帧画在旧位置，Windows 上最明显）。
    if (pigNode !== null) {
      outline.push({ x: pigBox.x + pigBox.width + 40 - BUBBLE_ZONE.width - 40, y: pigBox.y - BUBBLE_ZONE.height - 24,
        r: pigBox.x + pigBox.width + 40, b: pigBox.y + pigBox.height + 12 })
    }
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
    for (const o of outline) { left = Math.min(left, o.x); top = Math.min(top, o.y); right = Math.max(right, o.r); bottom = Math.max(bottom, o.b) }
    const content = { x: left - PAD, y: top - PAD,
      width: Math.ceil((right - left + PAD * 2) / STEP) * STEP, height: Math.ceil((bottom - top + PAD * 2) / STEP) * STEP }
    // 实测：给内容尺寸也加滞回并不能消掉那 3~4px（2026-10-06），所以没留——
    // 它影响面更大（会推迟真变化），没有证据就不该在代码里。
    const pig = { x: pigBox.x - content.x, y: pigBox.y - content.y, width: pigBox.width, height: pigBox.height }
    const shape = rects.concat(bubbleRects).map(function (rect) {
      const x = Math.max(0, Math.floor(rect.x) - SHAPE_SLACK)
      const y = Math.max(0, Math.floor(rect.y) - SHAPE_SLACK)
      return { x, y, width: Math.ceil(rect.r) + SHAPE_SLACK - x, height: Math.ceil(rect.b) + SHAPE_SLACK - y }
    })
    // 摸猪冒的爱心从猪头往上飘约 56px：飘的时候这块也可见，不然被切掉一半。
    if (pigNode !== null && host.querySelector('.dp-fx') !== null) {
      const fx = { x: Math.max(0, Math.floor(pigBox.x - 36)), y: Math.max(0, Math.floor(pigBox.y - 84)) }
      shape.push({ x: fx.x, y: fx.y, width: Math.ceil(pigBox.x + pigBox.width + 36) - fx.x, height: Math.ceil(pigBox.y + 12) - fx.y })
    }
    return { content, shape, pig, hostBox, pigBox, contentBox: { left, top, right, bottom } }
  }

  /** 整块内容钉在窗口哪两条边（固定右下角）。 */
  function sides() { return SIDE }

  /** 让整块内容离窗口锚边正好 PAD。 @param {any} host */
  function pin(host, side, hostBox, contentBox) {
    const want = { left: 'auto', right: 'auto', top: 'auto', bottom: 'auto' }
    const shift = state.shift
    if (side.horizontal === 'left') want.left = Math.round(hostBox.x - contentBox.left + PAD + shift.x) + 'px'
    else want.right = Math.round(contentBox.right - hostBox.x - hostBox.width + PAD - shift.x) + 'px'
    if (side.vertical === 'top') want.top = Math.round(hostBox.y - contentBox.top + PAD + shift.y) + 'px'
    else want.bottom = Math.round(contentBox.bottom - hostBox.y - hostBox.height + PAD - shift.y) + 'px'
    const key = [side.vertical, side.horizontal, want.left, want.right, want.top, want.bottom].join('|')
    if (key === state.pinned) return
    state.pinned = key
    host.style.left = want.left
    host.style.right = want.right
    host.style.top = want.top
    host.style.bottom = want.bottom
  }

  /** 变化判断用的 key：尺寸按 4px 一档，猪在窗口里的位置按 1px。 */
  function keyOf(next) {
    const head = [Math.floor(next.content.width / STEP), Math.floor(next.content.height / STEP),
      Math.floor(next.pig.x / STEP), Math.floor(next.pig.y / STEP), Math.floor(next.pigBox.x), Math.floor(next.pigBox.y)]
    const tail = []
    for (const s of next.shape) tail.push(s.x, s.y, s.width, s.height)
    return head.concat(tail.map(n => Math.floor(n / STEP))).join(',')
  }

  return { boxes, sides, pin, keyOf, state }
}
