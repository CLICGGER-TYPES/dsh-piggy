// @ts-check
/**
 * 桌面版：量「猪 + 面板 + 气泡」占多大、把整块内容钉在窗口锚边上（从桌面程序 renderer/shell.js 搬进游戏包）。
 *
 * 量框一律用布局盒（offsetLeft/offsetTop 累加），不用 getBoundingClientRect：呼吸、浮动动画只改
 * transform，rect 每帧都在抖。面板（.dp-card）自己裁掉溢出，只量面板本身，不进去量几百个子节点。
 */
import { PAD, STEP } from './geometry.js'
import { PANEL_MAX_HEIGHT } from '../constants.js'

/** 收起时猪头上方预留的气泡区：冒气泡只改可点区域，不改窗口大小。 */
const BUBBLE_ZONE = { width: 272, height: 104 }
/** 可点区域四周放宽几像素：礼包浮动、猪摇摆会越出布局盒一点。 */
const SHAPE_SLACK = 6
/** 面板打开时整块内容相对猪的外框，按朝向和猪大小记在本机；收起时窗口仍按它留位置。
 *  v2（2026-10-06）：加存储版本 + 猪宽按 4px 量化——更新可能改立绘/字体/CSS 让猪宽差一两像素，
 *  旧实现用整数像素做 key，一差就整条记录作废，收起态不再预留面板，于是「更新后第一次右键」
 *  成了第一次真的改窗口（用户报的偏移就是这么显形的）。 */
const OPEN_BOX_KEY = 'dsh-piggy:desktop-open-box'
const OPEN_BOX_VERSION = 2
/** 面板上次朝哪边开：启动后第一次打开就按它留位置，不用先变一次窗口。 */
const SIDES_KEY = 'dsh-piggy:desktop-sides'

/** 收起时按需加回上次打开的面板范围；拖动时只保留本轮可见内容和气泡区。 */
export function reservedOutline(outline, saved, pigBox, compact) {
  if (compact || saved === undefined) return outline
  return outline.concat([{ x: pigBox.x + saved.l, y: pigBox.y + saved.t, r: pigBox.x + saved.r, b: pigBox.y + saved.b }])
}

/** 存放 key：朝向 + 猪宽（4px 一档，抖动不算变）。 */
export function openBoxKey(vertical, horizontal, pigBox) {
  return vertical + '|' + horizontal + '|' + Math.round(pigBox.width / 4)
}

/** 旧存档可能把另一朝向的范围写进当前 key；只读确实向该侧伸出的范围。 */
export function validOpenBox(openBoxes, vertical, horizontal, pigBox) {
  let saved = openBoxes[openBoxKey(vertical, horizontal, pigBox)]
  if (saved === undefined) {
    // 这一个方向的记录里，猪宽那一档对不上（启动时先画占位纸盒、换皮肤改了立绘宽度、
    // 更新换了素材……）：退回到同朝向的任意一条。预留区只是「留多少位置」的估计，
    // 差一两档可以接受；不退回的话第一轮就没预留，窗口先缩后长，玩家看到猪跳一下
    // （2026-10-07 win11 日志：shown 是 476 高 → 106ms 后缩到 204 → 再长回 476）。
    const prefix = vertical + '|' + horizontal + '|'
    const key = Object.keys(openBoxes).find(name => name.startsWith(prefix))
    saved = key === undefined ? undefined : openBoxes[key]
  }
  if (saved === null || saved === undefined || ![saved.l, saved.t, saved.r, saved.b].every(Number.isFinite)) return undefined
  if (saved.l >= saved.r || saved.t >= saved.b) return undefined
  if (vertical === 'bottom' && saved.t >= -pigBox.height) return undefined
  if (vertical === 'top' && saved.b <= pigBox.height * 2) return undefined
  return saved
}

/** 根据猪在工作区的位置选收起朝向；面板在上优先，两边都放不下就保留原朝向。 */
export function chooseCollapsedVertical(openBoxes, horizontal, width, height, pigTop, area, current) {
  if (area === null || area === undefined) return current
  const pigBox = { width, height }
  const above = validOpenBox(openBoxes, 'bottom', horizontal, pigBox)
  const below = validOpenBox(openBoxes, 'top', horizontal, pigBox)
  if (above !== undefined && pigTop + above.t - PAD >= area.y) return 'bottom'
  if (below !== undefined && pigTop + below.b + PAD <= area.y + area.height) return 'top'
  return current
}


/** 从卡片和猪的实际位置判断面板朝向，供量框和锚边共用。 */
function panelSide(cardBox, pigBox) {
  return {
    vertical: cardBox.y + cardBox.height / 2 < pigBox.y + pigBox.height / 2 ? 'bottom' : 'top',
    horizontal: cardBox.x + cardBox.width / 2 < pigBox.x + pigBox.width / 2 ? 'right' : 'left',
  }
}

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
 * @param {{ platform: string, geometry: () => any, anchor?: () => ({x:number,y:number}|null) }} env
 */
export function createMeasure(env) {
  let openBoxes = {}
  try {
    const raw = JSON.parse(localStorage.getItem(OPEN_BOX_KEY) || 'null')
    // v2：{ v: 2, boxes: {...} }；旧格式就是一个平铺的 map（键还是老算法），
    // 读进来照用（validOpenBox 会校验朝向），下次写入自动升级。
    openBoxes = raw !== null && typeof raw === 'object' && raw.v === OPEN_BOX_VERSION && typeof raw.boxes === 'object'
      ? raw.boxes ?? {} : (raw !== null && typeof raw === 'object' && raw.v === undefined ? raw : {})
    if (raw !== null && typeof raw === 'object' && raw.v !== undefined && raw.v !== OPEN_BOX_VERSION) openBoxes = {}
  } catch { openBoxes = {} }
  /** shift：收起时窗口被夹回工作区，整块内容在窗口里反向挪多少（猪的屏幕位置不变，只裁掉透明留白）。 */
  const state = { vertical: 'bottom', horizontal: 'right', pinned: '', compact: false, bubbleHeight: null, shift: { x: 0, y: 0 } }
  try {
    const sides = JSON.parse(localStorage.getItem(SIDES_KEY) || 'null')
    if (sides && (sides.vertical === 'top' || sides.vertical === 'bottom')) state.vertical = sides.vertical
    if (sides && (sides.horizontal === 'left' || sides.horizontal === 'right')) state.horizontal = sides.horizontal
  } catch { /* 用默认的右下角 */ }
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
    const open = host.getAttribute('data-open') === 'true'
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
    let zone = null
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
    // 面板打开时按它的最高高度留位置：切到内容少的 App 面板变矮，窗口不跟着缩。
    const card = /** @type {any} */ (host.querySelector('.dp-card'))
    const cardBox = card === null ? null : layoutBox(card)
    if (reserves && open && cardBox !== null && card.hidden !== true) {
      const maxHeight = Math.min(PANEL_MAX_HEIGHT, parseFloat(card.style.maxHeight) || 0)
      if (maxHeight > cardBox.height && cardBox.width > 0) {
        zone = cardBox.y > pigBox.y
          ? { x: cardBox.x, y: cardBox.y, r: cardBox.x + cardBox.width, b: cardBox.y + maxHeight }
          : { x: cardBox.x, y: cardBox.y + cardBox.height - maxHeight, r: cardBox.x + cardBox.width, b: cardBox.y + cardBox.height }
      }
    }
    let outline = rects.concat(zone === null ? [] : [zone], bubbleZone === null ? [] : [bubbleZone])
    if (reserves && pigNode !== null) {
      if (open && cardBox !== null && card.hidden !== true && cardBox.width > 0 && cardBox.height > 0) {
        const side = panelSide(cardBox, pigBox)
        const key = openBoxKey(side.vertical, side.horizontal, pigBox)
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
        for (const o of outline) { l = Math.min(l, o.x); t = Math.min(t, o.y); r = Math.max(r, o.r); b = Math.max(b, o.b) }
        const rel = { l: Math.round(l - pigBox.x), t: Math.round(t - pigBox.y), r: Math.round(r - pigBox.x), b: Math.round(b - pigBox.y) }
        const old = openBoxes[key]
        if (old === undefined || old.l !== rel.l || old.t !== rel.t || old.r !== rel.r || old.b !== rel.b) {
          openBoxes[key] = rel
          try { localStorage.setItem(OPEN_BOX_KEY, JSON.stringify({ v: OPEN_BOX_VERSION, boxes: openBoxes })) } catch { /* 存不下就每次启动重新量 */ }
        }
      } else if (!open && !state.compact) {
        // 收起态挂回上次的面板预留区，按**当前**朝向，不再每轮重新挑朝向。
        //
        // 以前这里每量一次就调 fittingOpenBox 重新判断「上/下哪个放得下」，放不下就翻转朝向。
        // 朝向决定挂哪块预留区（上下差 272px），一翻窗口就挪，挪完猪的屏幕位置变了，
        // 「放不放得下」的判断又翻回来 —— 自激振荡：窗口在两个几何之间反复横跳，用户看到的就是
        // 「猪瞬移到上面去再瞬移下来」（2026-10-07 在 win11 虚拟机上抓到：日志里
        // (258,392,304x204) 与 (226,120,324x476) 每 200ms 来回一次）。
        // 朝向该由**用户动作**决定：拖动松手时走 collapsedSide()，那里才允许改。
        const saved = validOpenBox(openBoxes, state.vertical, state.horizontal, pigBox)
        outline = reservedOutline(outline, saved, pigBox, state.compact)
      }
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

  /** 面板在猪哪一侧 → 整块内容钉在窗口哪两条边；收起时保持上一次。 @param {any} host */
  function sides(host) {
    const card = /** @type {any} */ (host.querySelector('.dp-card'))
    const pigNode = host.querySelector('.dp-pig')
    if (card === null || pigNode === null || card.hidden === true) return { vertical: state.vertical, horizontal: state.horizontal }
    const cardBox = layoutBox(card)
    const pigBox = layoutBox(pigNode)
    if (cardBox.width < 1 || cardBox.height < 1) return { vertical: state.vertical, horizontal: state.horizontal }
    const { vertical, horizontal } = panelSide(cardBox, pigBox)
    if (vertical !== state.vertical || horizontal !== state.horizontal) {
      try { localStorage.setItem(SIDES_KEY, JSON.stringify({ vertical, horizontal })) } catch { /* 下次启动从默认开始 */ }
    }
    state.vertical = vertical
    state.horizontal = horizontal
    return { vertical: state.vertical, horizontal: state.horizontal }
  }

  /** 松手时根据当前猪的位置更新收起朝向，下次打开面板沿这个方向。 */
  function collapsedSide(pigBox, info) {
    if (info === null || info.window === undefined || info.workArea === undefined) return
    const pigTop = info.window.y + pigBox.y
    const vertical = chooseCollapsedVertical(openBoxes, state.horizontal, pigBox.width, pigBox.height, pigTop, info.workArea, state.vertical)
    if (vertical === state.vertical) return
    state.vertical = vertical
    try { localStorage.setItem(SIDES_KEY, JSON.stringify({ vertical, horizontal: state.horizontal })) } catch { /* 下次启动从默认朝向恢复 */ }
  }

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

  return { boxes, sides, collapsedSide, pin, keyOf, state }
}
