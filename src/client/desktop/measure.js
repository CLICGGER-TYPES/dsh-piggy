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
import { centeredBox, PAD, STEP } from './geometry.js'
import { ART_BOUNDS, artMarginFor } from '../art-framing.js'
import { customArtVisibleBox } from '../custom-art.js'
import { fixedMotionReserve, motionEnvelope, PIG_TRANSFORM_ORIGIN } from './motion-envelope.js'
import { bodyVisualBounds } from './visual-bounds.js'
import { fitBubbleHorizontally, fitBubbleVertically } from './bubble-geometry.js'
import { bubbleSlot, characterGeometry, framedArtBox } from '../character-geometry.js'
import { collectHitRects } from '../hit-regions.js'

/** Stable image bounds include framing, without measuring animated transforms. */
export function framedBox(node, box) {
  if (!node.matches?.('.dp-pig-img,.dp-pig-sleep')) return box
  // 自定义立绘：和显示同一份已量 ink + 取景（见 custom-art.js）；还没量到的图保持方形。
  const custom = customArtVisibleBox(node, box)
  if (custom !== null) return custom
  const path = (node.getAttribute('src') || '').split('/art/')[1]?.split('?')[0]
  const bounds = ART_BOUNDS[path]
  if (!bounds) return box
  // 取景换算在 character-geometry.js：立绘可见范围、接触锚点、气泡尾巴共用同一份映射。
  return framedArtBox(box, {
    bounds,
    zoom: Number(node.style.getPropertyValue('--art-zoom')) || 1,
    shiftX: parseFloat(node.style.getPropertyValue('--art-x')) || 0,
    shiftY: parseFloat(node.style.getPropertyValue('--art-y')) || 0,
    mirrored: node.closest('.dp-pig')?.getAttribute('data-walk') === 'right',
  })
}

/** 猪头上方预留的气泡区：冒气泡只改可点区域，不改窗口大小。 */
const BUBBLE_ZONE = { width: 272, height: 104 }
/** 面板打开时，气泡在折叠场景左侧：180px 最大宽 + 两侧各 6px 的场景/间距。 */
const OPEN_BUBBLE_LEFT = 180 + 6 + 6
/** 可点区域四周放宽几像素：礼包浮动、猪摇摆会越出布局盒一点；点位里的 emoji 墨迹
 * 也会越过 line-height:1 的行盒（自带字体量到最多 0.0688em，500% 的帽子是 5.2px），
 * 同样由这几像素吸收。 */
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

/**
 * 节点的稳定绘制盒：装扮点位（`.dp-slot`）自己用 `translate(-50%,-50%)` 居中在锚点上，
 * 布局盒要按那个已知的 translate 折算（见 geometry.js 的 centeredBox），否则 500% 时
 * 帽子上沿会落在原生 shape 之外被裁。其它节点照旧用布局盒。
 * @param {any} node
 */
function stableBox(node) {
  const box = layoutBox(node)
  return node.matches?.('.dp-slot') === true ? centeredBox(box) : box
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
  const state = { pinned: '', bubbleHeight: null, shift: { x: 0, y: 0 }, anchor: { x: 0, y: 0 } }
  const reserves = env.platform !== 'darwin'

  /** @param {any} host */
  function boxes(host) {
    const pigNode = host.querySelector('.dp-pig')
    const pigBox = pigNode === null ? { x: 0, y: 0, width: 0, height: 0 } : layoutBox(pigNode)
    // 头顶锚点、脚底锚点：气泡预留区和绘制范围都按它算（见 character-geometry.js）。
    const anchors = characterGeometry(pigBox)
    const pigInk = { x: pigBox.x, y: pigBox.y, r: pigBox.x + pigBox.width, b: pigBox.y + pigBox.height }
    const nodes = [host]
    const all = host.querySelectorAll('*')
    for (let a = 0; a < all.length; a += 1) {
      const candidate = all[a]
      const inCard = candidate.closest('.dp-card')
      if (candidate.closest('.dp-pet-snap') !== null) continue
      if ((inCard !== null && inCard !== candidate) || candidate.closest('.dp-fx') !== null) continue
      nodes.push(candidate)
    }
    const geometry = env.geometry()
    const speechScale = Number(host.style?.getPropertyValue?.('--bubble-scale')) || 1
    const bubbleSize = { width: BUBBLE_ZONE.width * speechScale, height: BUBBLE_ZONE.height * speechScale }
    let rects = []
    // 气泡只进可点/可见区域，不进窗口外框：它的位置已经由下面的气泡预留区留好了。
    // 以前气泡会撑大外框，面板朝下开时一冒气泡整块内容就要挪，Windows 上会画出一帧重影
    // （用户 2026-10-05 录屏：右键开面板时猪下面多一只半透明的猪，气泡消失时往上闪）。
    const bubbleRects = []
    for (const node of nodes) {
      if (node.closest('[hidden]') !== null || !visible(node)) continue
      const bubble = node.closest('.dp-bubble')
      const box = framedBox(node, stableBox(node))
      if (box.width < 1 || box.height < 1) continue
      const rect = { x: box.x, y: box.y, r: box.x + box.width, b: box.y + box.height }
      if (pigNode !== null && (node === pigNode || node.closest('.dp-pig') === pigNode)) {
        pigInk.x = Math.min(pigInk.x, rect.x); pigInk.y = Math.min(pigInk.y, rect.y)
        pigInk.r = Math.max(pigInk.r, rect.r); pigInk.b = Math.max(pigInk.b, rect.b)
      }
      if (bubble !== null) bubbleRects.push(rect)
      else rects.push(rect)
    }
    if (rects.length === 0) return null
    const hostBox = layoutBox(host)
    // 气泡预留区：收起、打开都留，气泡出现/消失不改外框。离屏幕顶边不够高就只留到顶边。
    let bubbleZone = null
    if (reserves && pigNode !== null) {
      const above = geometry === null ? bubbleSize.height : geometry.window.y + anchors.headTop.y - geometry.workArea.y - PAD
      // 滞回：预留区高度是「窗口当前在哪」的函数，而窗口位置又是「内容框（含这个预留区）」的函数，
      // 结构上是一个反馈环（量化到 4px 后可能变成极限环）。预留区只是「留多少位置」的估计，
      // 差不到两档就不改，环就断了。
      // 注意：2026-10-06 查的那 3~4px 抖动**不是**这条环造成的，是猪自己的待机动画（见 I-round.md），
      // 这里保留只是因为依赖方向确实成环，且代价为零。
      const want = Math.max(0, Math.min(bubbleSize.height, Math.round(above)))
      if (state.bubbleHeight === null || Math.abs(want - state.bubbleHeight) >= STEP * 2) state.bubbleHeight = want
      const height = state.bubbleHeight
      const zoneLeft = host.getAttribute('data-panel-side') === 'right' ? hostBox.x : hostBox.x + hostBox.width - bubbleSize.width
      if (height > 0) bubbleZone = { x: zoneLeft, y: anchors.headTop.y - height, r: zoneLeft + bubbleSize.width, b: anchors.headTop.y }
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
      // Reserve the widest reviewed sprite for every action: action changes never resize the window.
      const artMargin = artMarginFor(pigBox.width)
      // 饥饿云朵在右上方；始终预留，包括呼吸放大时的余量，显隐不改变窗口大小。
      outline.push({ x: pigBox.x + pigBox.width, y: pigBox.y - 48,
        r: pigBox.x + pigBox.width + 60, b: pigBox.y + 53 })
      // Reviewed frame union, including the hand: reserve even while idle.
      // The 512px canvas has transparent padding and must not itself resize the window.
      outline.push({ x: pigBox.x - pigBox.width * .18, y: pigBox.y - pigBox.height * .5,
        r: pigBox.x + pigBox.width * 1.1, b: anchors.feet.y })
      // On platforms with native shape support, also cover the open-panel
      // bubble, which extends left of the pig by up to 192px. The collapsed
      // 272px reserve is measured from pigRight, so it reaches only
      // 272 - pigWidth pixels left of the pig and fails for wider pigs.
      const openBubbleLeft = reserves ? pigBox.x - OPEN_BUBBLE_LEFT * speechScale : Infinity
      outline.push({ x: Math.min(pigBox.x + pigBox.width - bubbleSize.width, openBubbleLeft, pigBox.x - artMargin), y: anchors.headTop.y - bubbleSize.height - 24,
        r: pigBox.x + pigBox.width + artMargin, b: anchors.feet.y + bubbleSize.height + 10 })
      // Reserve the whole rotation once, independent of the active action. macOS
      // has no native shape, so keep its window footprint until passthrough is addressed.
      if (reserves) {
        const motion = fixedMotionReserve(pigBox)
        outline.push({ x: motion.x, y: motion.y, r: motion.x + motion.width, b: motion.y + motion.height })
      }
    }
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
    for (const o of outline) { left = Math.min(left, o.x); top = Math.min(top, o.y); right = Math.max(right, o.r); bottom = Math.max(bottom, o.b) }
    const content = { x: left - PAD, y: top - PAD,
      width: Math.ceil((right - left + PAD * 2) / STEP) * STEP, height: Math.ceil((bottom - top + PAD * 2) / STEP) * STEP }
    // 实测：给内容尺寸也加滞回并不能消掉那 3~4px（2026-10-06），所以没留——
    // 它影响面更大（会推迟真变化），没有证据就不该在代码里。
    const pig = { x: pigBox.x - content.x, y: pigBox.y - content.y, width: pigBox.width, height: pigBox.height }
    // Only the active animation gets its swept hit area. The idle window's
    // transparent motion reserve must remain click-through. Every animation
    // that moves the artwork contributes, because the Linux window shape also
    // clips *drawing* outside these rects (a tall hat at dp-feed-hop's peak).
    const animatedRects = []
    const hungerNode = host.querySelector('.dp-hunger-bubble')
    if (pigNode !== null && hungerNode !== null && visible(hungerNode)) {
      // Linux 原生窗口形状也会裁剪绘制；可见云朵使用与固定外框一致的余量。
      animatedRects.push({ x: pigBox.x + pigBox.width, y: pigBox.y - 48,
        r: pigBox.x + pigBox.width + 60, b: pigBox.y + 53 })
    }
    if (reserves && pigNode !== null) {
      const names = String(getComputedStyle(pigNode).animationName).split(',').map(name => name.trim()).filter(Boolean)
      const envelopes = names.map(name => motionEnvelope(name)).filter(envelope => envelope !== null)
      if (envelopes.length > 0) {
        const pivot = { x: pigBox.x + pigBox.width * PIG_TRANSFORM_ORIGIN.x, y: pigBox.y + pigBox.height * PIG_TRANSFORM_ORIGIN.y }
        for (const envelope of envelopes) {
          const animated = envelope({ x: pigInk.x, y: pigInk.y, width: pigInk.r - pigInk.x, height: pigInk.b - pigInk.y }, pivot)
          animatedRects.push({ x: animated.x, y: animated.y, r: animated.x + animated.width, b: animated.y + animated.height })
        }
      }
    }
    // 物理活跃/回稳时追加固定包络：倾斜、拉长、压扁都在这里面，回稳后移除。
    // 不是每帧重算 —— 包络只跟猪的布局盒有关。
    if (pigNode?.getAttribute('data-pet-snap') === 'true') {
      animatedRects.push({ x: pigBox.x - pigBox.width * .18, y: pigBox.y - pigBox.height * .5,
        r: pigBox.x + pigBox.width * 1.1, b: pigBox.y + pigBox.height })
    }
    const feelState = pigNode === null ? null : pigNode.getAttribute('data-feel')
    if (pigNode !== null && (feelState === 'active' || feelState === 'settle')) {
      const envelope = bodyVisualBounds(pigBox)
      animatedRects.push({ x: envelope.x, y: envelope.y, r: envelope.x + envelope.width, b: envelope.y + envelope.height })
    }
    const shape = rects.concat(bubbleRects, animatedRects).map(function (rect) {
      const x = Math.max(0, Math.floor(rect.x) - SHAPE_SLACK)
      const y = Math.max(0, Math.floor(rect.y) - SHAPE_SLACK)
      return { x, y, width: Math.ceil(rect.r) + SHAPE_SLACK - x, height: Math.ceil(rect.b) + SHAPE_SLACK - y }
    // A saved large size can initially lay out entirely above/left of the old
    // small window. Its empty intersection must not reject the resize itself.
    }).filter(rect => rect.width > 0 && rect.height > 0)
    // Particle visibility has its own lifetime, independent of the pig's motion.
    if (pigNode !== null && host.querySelector('.dp-fx') !== null) {
      const fx = { x: Math.max(0, Math.floor(pigBox.x - 36)), y: Math.max(0, Math.floor(pigBox.y - 84)) }
      shape.push({ x: fx.x, y: fx.y, width: Math.ceil(pigBox.x + pigBox.width + 36) - fx.x, height: Math.ceil(pigBox.y + 12) - fx.y })
    }
    return { content, shape, hitShape: collectHitRects(host), pig, hostBox, pigBox, contentBox: { left, top, right, bottom } }
  }

  /** 整块内容钉在窗口哪两条边（固定右下角）。 */
  function sides() { return SIDE }

  /** 让整块内容离窗口锚边正好 PAD。 @param {any} host */
  function pin(host, side, hostBox, contentBox) {
    const want = { left: 'auto', right: 'auto', top: 'auto', bottom: 'auto' }
    const shift = { x: state.shift.x + state.anchor.x, y: state.shift.y + state.anchor.y }
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
    return [...head, ...tail.map(n => Math.floor(n / STEP)), 'hit', ...next.hitShape.flatMap(rect => [rect.x, rect.y, rect.width, rect.height].map(Math.round))].join(',')
  }

  // 落地偏移只适用于交接时的窗口。体型/缩放改变外框后回到标准布局，
  // 新窗口仍由 placement 的屏幕脚底坐标定位，不能把旧锚点带进更小的外框。
  function fitWindow(content, win) {
    if (win && (content.width !== win.width || content.height !== win.height)) {
      state.anchor = { x: 0, y: 0 }
    }
  }

  /** Fit from the original CSS anchor every time; never accumulate a previous correction. */
  function fitBubble(host, geometry) {
    const bubble = host.querySelector('.dp-bubble')
    const pig = host.querySelector('.dp-pig')
    if (!bubble || !pig || !geometry?.window || !geometry?.workArea) return
    if (bubble.hidden) return
    const parent = bubble.offsetParent
    if (!parent) return
    const originalLeft = host.getAttribute('data-panel-side') === 'right' ? 6 : parent.clientWidth - 6 - bubble.offsetWidth
    const box = { ...layoutBox(bubble), x: layoutBox(parent).x + originalLeft }
    const fitted = fitBubbleHorizontally(box, layoutBox(pig), geometry.window, geometry.workArea)
    const clipped = Math.abs(fitted.x - box.x) >= 0.5
    const left = clipped ? (originalLeft + fitted.x - box.x) + 'px' : ''
    const right = clipped ? 'auto' : ''
    const tail = clipped ? fitted.tailLeft + 'px' : ''
    // MutationObserver schedules geometry on style changes; write only actual
    // differences so a stable fitted bubble does not create a measurement loop.
    if (bubble.style.left !== left) bubble.style.left = left
    if (bubble.style.right !== right) bubble.style.right = right
    if (bubble.style.getPropertyValue('--bubble-tail-left') !== tail) {
      if (tail) bubble.style.setProperty('--bubble-tail-left', tail)
      else bubble.style.removeProperty('--bubble-tail-left')
    }
    if (clipped && !bubble.hasAttribute('data-fitted')) bubble.setAttribute('data-fitted', 'true')
    else if (!clipped && bubble.hasAttribute('data-fitted')) bubble.removeAttribute('data-fitted')
    // Always recompute from the original head-top anchor, even if the current
    // bubble is below. Opening the panel must not reset its text or scroll.
    const pigBox = layoutBox(pig)
    const anchors = characterGeometry(pigBox)
    // 上方槽位＝头顶锚点 - 间距 - 气泡高；放不下由 fitBubbleVertically 改用脚底下方同一间距。
    const originalY = bubbleSlot(anchors, 'above', { width: bubble.offsetWidth, height: bubble.offsetHeight }).y
    const vertical = fitBubbleVertically({ y: originalY, height: bubble.offsetHeight }, pigBox, geometry.window, geometry.workArea)
    const below = vertical.side === 'below'
    const top = below ? (vertical.y - layoutBox(parent).y) + 'px' : ''
    const bottom = below ? 'auto' : ''
    if (bubble.style.top !== top) bubble.style.top = top
    if (bubble.style.bottom !== bottom) bubble.style.bottom = bottom
    if (below && bubble.getAttribute('data-bubble-side') !== 'below') bubble.setAttribute('data-bubble-side', 'below')
    else if (!below && bubble.hasAttribute('data-bubble-side')) bubble.removeAttribute('data-bubble-side')
  }

  return { boxes, sides, pin, keyOf, fitWindow, fitBubble, state }
}
