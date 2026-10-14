// @ts-check
// 菜园布局验收：只读 CDP/DOM，不点击、不派发事件、不修改页面或存档。真实操作另按 QA-SPEC 执行。
import { writeFileSync } from 'node:fs'
import { readAssetLayout } from './asset-layout.mjs'
import { IMAGE_AUDIT_FUNCTIONS, auditImageRatios, auditMaterialPadding } from './layout-image-audit.mjs'
import { SHAPE_AUDIT_FUNCTIONS, alphaOf, stylePaints, pseudoPaints, cornerRadii, polygonOf, pointInShape, pointInPolygon, readPseudoBox, subtreePaints } from './layout-audit-shapes.mjs'
import { pathToFileURL } from 'node:url'

/** @param {Element} element */
function rectOf(element) {
  const r = element.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }
}
/** @param {Element} element */
function identify(element) {
  const attr = Array.from(element.attributes).find(a => a.name.startsWith('data-farm-'))
  const name = attr ? `[${attr.name}="${attr.value}"]` : element.tagName.toLowerCase() + '.' + Array.from(element.classList).join('.')
  const owner = element.parentElement?.closest('.fm-plot,.fm-slot,.fm-pack-slot')
  return owner ? identify(owner) + ' ' + name : name
}
/** @param {any} a @param {any} b */
function intersection(a, b) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y)
  const width = Math.max(0, Math.min(a.right, b.right) - x), height = Math.max(0, Math.min(a.bottom, b.bottom) - y)
  return { x, y, width, height, right: x + width, bottom: y + height }
}
/**
 * 自身或祖先被隐藏（display:none / visibility:hidden / opacity:0 / inert / hidden 属性）——「折叠隐藏」也走这条。
 * 和「整条在视口外」区分开：这个只管「本该不显示」，视口外是另一类（见 auditOffViewport）。
 * @param {Element} element
 */
function hiddenByStyle(element) {
  for (let parent = element; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent)
    if (css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0) return true
    if (parent.closest('[inert]') || (typeof parent.hasAttribute === 'function' && parent.hasAttribute('hidden'))) return true
  }
  return false
}
/** @param {Element} element */
function visibleRect(element) {
  if (hiddenByStyle(element)) return null
  let r = intersection(rectOf(element), { x: 0, y: 0, right: innerWidth, bottom: innerHeight })
  for (let parent = element; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent)
    if (parent !== element && /(hidden|clip|auto|scroll)/.test(css.overflowX + css.overflowY)) r = intersection(r, rectOf(parent))
  }
  return r.width > .01 && r.height > .01 ? r : null
}
/** @param {Element} element */
function effectiveFont(element) {
  let scale = 1
  for (let parent = element; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent), matrix = new DOMMatrix(css.transform === 'none' ? undefined : css.transform)
    scale *= Math.min(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)) * (Number(css.zoom) || 1)
  }
  return parseFloat(getComputedStyle(element).fontSize) * scale
}
/** @param {Element} element */
function layerOf(element) {
  return element.closest('.fm-mask,.fm-pop,.fm-hover-card,.fm-b-bar,.fm-s-tools,.fm-s-header,.fm-s-acts,.fm-b-field,.fm-s-field') || element.parentElement
}
/** node 是不是 element 的祖先。@param {Element|null} node @param {Element} element */
function isAncestor(node, element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent === node) return true
  return false
}
/** @param {Element} element */
function scrollOwner(element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent)
    if (/(auto|scroll)/.test(css.overflowX + css.overflowY) && (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth)) return parent
  }
  return null
}
/** @param {Element} element */
function footprint(element) {
  const r = rectOf(element), css = getComputedStyle(element)
  const own = css.clipPath && css.clipPath !== 'none' ? polygonOf(css.clipPath) : null
  if (own) return own.map(p => [r.x + p[0] * r.width, r.y + p[1] * r.height])
  // 菱形地块的形状来自命中层 .fm-hit 的 clip-path，别再硬编码。
  const hit = element.matches('.fm-plot') ? element.querySelector('.fm-hit') : null
  if (hit) {
    const hitCss = getComputedStyle(hit), hitClip = hitCss && hitCss.clipPath && hitCss.clipPath !== 'none' ? polygonOf(hitCss.clipPath) : null
    if (hitClip) return hitClip.map(p => [r.x + p[0] * r.width, r.y + p[1] * r.height])
    return [[r.x + r.width / 2, r.y], [r.right, r.y + r.height / 2], [r.x + r.width / 2, r.bottom], [r.x, r.y + r.height / 2]]
  }
  return [[r.x, r.y], [r.right, r.y], [r.right, r.bottom], [r.x, r.bottom]]
}
/** 元素本体 + 画得出来的伪元素的轮廓（页面坐标）。@param {Element} element @returns {number[][][]} */
function shapesOf(element) {
  const shapes = [footprint(element)], rect = rectOf(element)
  for (const pseudo of ['::before', '::after']) {
    const box = readPseudoBox(element, pseudo, rect)
    if (!box) continue
    const css = getComputedStyle(element, pseudo)
    if (!css || !pseudoPaints(css)) continue
    const clip = css.clipPath && css.clipPath !== 'none' ? polygonOf(css.clipPath) : null
    shapes.push(clip ? clip.map(p => [box.x + p[0] * box.width, box.y + p[1] * box.height]) : [[box.x, box.y], [box.right, box.y], [box.right, box.bottom], [box.x, box.bottom]])
  }
  return shapes
}
/** @param {number[]} a @param {number[]} b @param {number[]} p */
function cross(a, b, p) { return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) }
/** @param {number[][]} subject @param {number[][]} boundary */
function polygonIntersection(subject, boundary) {
  for (let edge = 0; edge < boundary.length && subject.length; edge += 1) {
    const a = boundary[edge], b = boundary[(edge + 1) % boundary.length], out = []
    for (let i = 0; i < subject.length; i += 1) {
      const current = subject[i], previous = subject[(i + subject.length - 1) % subject.length]
      const cv = cross(a, b, current), pv = cross(a, b, previous)
      if ((cv >= 0) !== (pv >= 0)) {
        const t = pv / (pv - cv)
        out.push([previous[0] + t * (current[0] - previous[0]), previous[1] + t * (current[1] - previous[1])])
      }
      if (cv >= 0) out.push(current)
    }
    subject = out
  }
  return subject
}
/** @param {number[][]} points */
function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => { const next = points[(i + 1) % points.length]; return sum + p[0] * next[1] - next[0] * p[1] }, 0)) / 2
}
/** 两侧真实形状（含伪元素）的最大相交面积。@param {Element} a @param {Element} b */
function pairOverlapArea(a, b) {
  let best = 0
  for (const sa of shapesOf(a)) for (const sb of shapesOf(b)) best = Math.max(best, polygonArea(polygonIntersection(sa, sb)))
  return best
}
/**
 * 在重叠区中心用命中测试判谁真的画在上面。
 * 返回 { side, node, paints }；命中不到 a/b 任何一侧时返回 null。
 * @param {Element} a @param {Element} b @param {any} box
 */
function topSide(a, b, box) {
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  const stack = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)]
  for (const node of stack) {
    if (!node) continue
    if (node === a || a.contains(node)) return { side: 'a', node, paints: subtreePaints(node, a) }
    if (node === b || b.contains(node)) return { side: 'b', node, paints: subtreePaints(node, b) }
  }
  return null
}
/** 文字墨迹框（Range.getClientRects），拿不到就用元素框。@param {Element} element @returns {any[]} */
function inkRects(element) {
  if (typeof document.createRange === 'function') {
    const rects = []
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType !== 3 || !node.textContent?.trim()) continue
      const range = document.createRange(); range.selectNodeContents(node)
      rects.push(...Array.from(range.getClientRects()))
    }
    if (rects.length) return rects
  }
  if (typeof element.getClientRects === 'function') {
    const rects = Array.from(element.getClientRects())
    if (rects.length) return rects
  }
  return [element.getBoundingClientRect()]
}
/** 最近的「纯色上色、不是素材框」的底牌祖先。素材框交给 auditMaterialPadding。@param {Element} element */
function textPlate(element) {
  const scene = innerWidth * innerHeight * .6
  for (let plate = element.parentElement; plate && plate.closest('.fm'); plate = plate.parentElement) {
    if (plate.matches('.fm,.fm-big,.fm-b-scene,.fm-s-scene,.fm-b-field,.dp-card,.fm-tool-label,.fm-tooltip,.fm-n,.fm-lock')) continue
    const css = getComputedStyle(plate), r = rectOf(plate)
    if (r.width * r.height > scene) continue
    if (css.borderImageSource && css.borderImageSource !== 'none') continue
    if (css.backgroundImage && css.backgroundImage !== 'none' && css.backgroundSize !== '0px 0px') continue
    if (alphaOf(css.backgroundColor) <= .05 && parseFloat(css.borderTopWidth) <= 0) continue
    return plate
  }
  return null
}
/** 底牌 content box 减去同一行非文字兄弟占位，是文字真正可用的区域。@param {Element} element @param {Element} plate */
function availableTextArea(element, plate) {
  const css = getComputedStyle(plate), r = rectOf(plate), er = rectOf(element)
  let left = r.x + (parseFloat(css.borderLeftWidth) || 0) + (parseFloat(css.paddingLeft) || 0)
  let right = r.right - (parseFloat(css.borderRightWidth) || 0) - (parseFloat(css.paddingRight) || 0)
  const top = r.y + (parseFloat(css.borderTopWidth) || 0) + (parseFloat(css.paddingTop) || 0)
  const bottom = r.bottom - (parseFloat(css.borderBottomWidth) || 0) - (parseFloat(css.paddingBottom) || 0)
  for (const sibling of Array.from(plate.children || [])) {
    if (sibling === element || sibling.contains(element) || element.contains(sibling)) continue
    const sr = rectOf(sibling)
    if (sr.bottom <= er.y + 1 || sr.y >= er.bottom - 1) continue
    if (sr.right <= er.x + 1) left = Math.max(left, sr.right)
    else if (sr.x >= er.right - 1) right = Math.min(right, sr.x)
  }
  return { x: left, y: top, width: right - left, height: bottom - top, right, bottom }
}
/**
 * 某个滚动祖先滚一下能不能把这个操作项的中心送进视口。
 * 比 scrollOwner 只认「最近的滚动祖先」更准：面板 120px 时商店页签被弹层自己的滚动条压住，
 * 真正能救它的是更外层的面板滚动区。
 * @param {Element} element
 */
function scrollBringsIntoView(element) {
  const r = rectOf(element)
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const css = getComputedStyle(ancestor)
    if (!/(auto|scroll)/.test(css.overflowX + css.overflowY)) continue
    const maxTop = ancestor.scrollHeight - ancestor.clientHeight, maxLeft = ancestor.scrollWidth - ancestor.clientWidth
    if (maxTop <= 1 && maxLeft <= 1) continue
    const ar = rectOf(ancestor), boxX = ar.x + (ancestor.clientLeft || 0), boxY = ar.y + (ancestor.clientTop || 0)
    const scrollTop = ancestor.scrollTop || 0, scrollLeft = ancestor.scrollLeft || 0
    const topInContent = r.y - boxY + scrollTop, leftInContent = r.x - boxX + scrollLeft
    const targetTop = Math.min(Math.max(0, topInContent - (ancestor.clientHeight - r.height) / 2), Math.max(0, maxTop))
    const targetLeft = Math.min(Math.max(0, leftInContent - (ancestor.clientWidth - r.width) / 2), Math.max(0, maxLeft))
    const centerX = r.x - (targetLeft - scrollLeft) + r.width / 2, centerY = r.y - (targetTop - scrollTop) + r.height / 2
    if (centerX >= 0 && centerY >= 0 && centerX <= innerWidth && centerY <= innerHeight) return ancestor
  }
  return null
}
/** @param {Element[]} nodes @param {any} report */
function auditPairs(nodes, report) {
  for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
    const a = nodes[i], b = nodes[j]
    if (a.contains(b) || b.contains(a) || layerOf(a) !== layerOf(b)) continue
    const box = intersection(rectOf(a), rectOf(b)), boxArea = box.width * box.height
    if (boxArea <= .5) continue
    const area = pairOverlapArea(a, b)
    const detail = { a: identify(a), b: identify(b), boxAreaPx2: boxArea, areaPx2: area }
    if (area <= .5) { report.exceptions.push({ ...detail, reason: '菱形轴对齐框相交；实际地块与命中多边形只共边，没有内部相交。' }); continue }
    // 开垦牌（.fm-expand）是浮在地块上的宽木牌按钮，天然比自家菱形宽、会压到邻地。这是设计如此，不算重叠缺陷：
    // 真正的 E3 是「牌被地块压住、牌面点不到」，那由 auditControls 盯牌自己（blockedControls）。抬地块 z-index（65652cf）后
    // 牌回到上面，几何重叠面积不变，所以这里必须豁免，否则尺子对已修好的版本常红。
    if ((a.matches('.fm-expand') && b.matches('.fm-plot')) || (b.matches('.fm-expand') && a.matches('.fm-plot'))) {
      report.exceptions.push({ ...detail, reason: '开垦牌（.fm-expand）浮在地块上，与邻地的几何重叠是设计如此；只有牌被地块压住才算缺陷（由 blockedControls 盯牌自己）。' })
      continue
    }
    if (getComputedStyle(a).zIndex === getComputedStyle(b).zIndex) { report.overlaps.push(detail); continue }
    // z-index 不同不再当成「故意叠放」：用命中测试判谁真在上面，只在上面那侧上色时报（挡掉透明命中层噪声）。
    const top = topSide(a, b, box)
    if (!top) { report.exceptions.push({ ...detail, reason: '重叠区被第三方元素盖住，量不到 a/b 的层序。' }); continue }
    if (!top.paints) { report.exceptions.push({ ...detail, reason: '重叠区在上层的那侧是透明命中/占位层，没有画出可见像素。' }); continue }
    report.overlaps.push({ ...detail, onTop: top.side, topPaintTest: identify(top.node) })
  }
}
/** @param {Element[]} controls @param {any} report */
function auditControls(controls, report) {
  for (const element of controls) {
    const r = rectOf(element), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    const detail = { element: identify(element), label: element.getAttribute('aria-label') || element.textContent?.trim(), rect: r }
    const center = { x: Math.round((r.x + r.width / 2) * 100) / 100, y: Math.round((r.y + r.height / 2) * 100) / 100 }
    if (r.width < 31.99 || r.height < 31.99) report.smallTargets.push(detail)
    // 5×5 采样：只数落在控件自己形状内、且被「非祖先」元素抢走的点，量「命中不到自己」的面积占比。
    const ownShape = footprint(element)
    let total = 0, blocked = 0, sampleHit = null
    for (let iy = 0; iy < 5; iy += 1) for (let ix = 0; ix < 5; ix += 1) {
      const px = r.x + r.width * (ix + .5) / 5, py = r.y + r.height * (iy + .5) / 5
      if (px < 0 || py < 0 || px > innerWidth - 1 || py > innerHeight - 1) continue
      if (!pointInPolygon(px, py, ownShape)) continue
      total += 1
      const sample = document.elementFromPoint(px, py)
      if (isAncestor(sample, element)) continue
      if (!(sample === element || element.contains(sample))) { blocked += 1; sampleHit = sampleHit || sample }
    }
    const ratio = total ? blocked / total : 0
    const centerBlocked = !hit || !(element === hit || element.contains(hit))
    if (!centerBlocked && ratio <= .05) continue
    const overlay = (centerBlocked ? hit : sampleHit)?.closest('.fm-pop,.fm-mask')
    const scroll = scrollOwner(element)
    const scrolled = scrollBringsIntoView(element)
    if (overlay && !overlay.contains(element)) {
      report.exceptions.push({ ...detail, hit: hit ? identify(hit) : null, reason: '打开的弹层覆盖背景操作；背景操作不得穿过弹层。关闭后仍必须复测。' })
      // 不再静默：把这条豁免显式记进人工复核清单（元素/覆盖物/理由/中心/覆盖层高），不进 problemCount。
      report.blockedControlsExempt.push({ ...detail, center, overlay: identify(overlay), overlayHeight: Math.round(rectOf(overlay).height * 100) / 100, hit: hit ? identify(hit) : null, reason: '打开的弹层覆盖背景操作；背景操作不得穿过弹层。关闭后仍必须复测。' })
    } else if (sampleHit && sampleHit.matches('.fm-expand') && element.matches('.fm-plot')) {
      // 地块被开垦牌（浮在上面的宽木牌）盖住一小块：那是牌子本身可见的地方，不是被藏起来的控件。牌被地块压住才报（见上）。
      report.exceptions.push({ ...detail, reason: '开垦牌（.fm-expand）浮在这块地上面，被盖的采样点命中的是牌子本身；这不是地块点不到，牌被压住才算缺陷。' })
    } else if (scrolled || (scroll && (intersection(r, rectOf(scroll)).height < r.height - .5 || intersection(r, rectOf(scroll)).width < r.width - .5))) {
      report.exceptions.push({ ...detail, reason: '滚动列表边缘只露出部分商品；滚动后才能操作该商品中心。' })
      // 160px 高的弹层（面板 120px 时商店页签等）以前就是这样被豁免掉的：仍然不算违规，但要显式标记 + 需人工复核。
      const layer = element.closest('.fm-pop,.fm-mask') || scrolled || scroll
      report.blockedControlsExempt.push({ ...detail, center, overlay: layer ? identify(layer) : null, overlayHeight: layer ? Math.round(rectOf(layer).height * 100) / 100 : null, reason: '控件在弹层/滚动区里、整块或部分掉在视口外；滚动后才能操作到它的中心。关闭弹层或滚动后仍必须复测。' })
    } else report.blockedControls.push({ ...detail, hit: hit ? identify(hit) : null, blockedRatio: Math.round(ratio * 100) / 100, blockedPx2: Math.round(ratio * r.width * r.height), sampleHit: sampleHit ? identify(sampleHit) : null })
  }
}
/**
 * 可见但整条落在视口外的操作项：以前被 visibleRect 求交为空直接丢掉，现在显式记进 offViewportControls 供人工复核，不进 problemCount。
 * 只收「可见」的（display:none / visibility:hidden / opacity:0 / inert / hidden / 0×0 折叠隐藏的都不算），否则会把「本该隐藏的」也刷进来。
 * @param {Element[]} allElements @param {any} report
 * @returns {number} 被跳过（隐藏）的视口外操作项条数
 */
function auditOffViewport(allElements, report) {
  let hidden = 0
  for (const element of allElements) {
    if (!element.matches('button,input,textarea,select,a[href],[role="button"],.fm-plot')) continue
    const r = rectOf(element)
    if (r.width <= .01 || r.height <= .01) continue
    if (!(r.right <= 0 || r.bottom <= 0 || r.x >= innerWidth || r.y >= innerHeight)) continue
    if (hiddenByStyle(element)) { hidden += 1; continue }
    const scroll = scrollOwner(element)
    report.offViewportControls.push({ element: identify(element), label: element.getAttribute('aria-label') || element.textContent?.trim(), center: { x: Math.round((r.x + r.width / 2) * 100) / 100, y: Math.round((r.y + r.height / 2) * 100) / 100 }, scrollAncestor: scroll ? identify(scroll) : null, hidden: false })
  }
  return hidden
}
/** @param {Element} element @param {Element[]} controls @param {any} report */
function auditTextOcclusion(element, controls, report) {
  const range = typeof document.createRange === 'function' ? document.createRange() : null
  if (range) range.selectNodeContents(element)
  const glyphs = range ? Array.from(range.getClientRects()) : [rectOf(element)]
  for (const control of controls) {
    if (control.contains(element) || element.contains(control) || layerOf(control) !== layerOf(element)) continue
    if ((Number(getComputedStyle(control).zIndex) || 0) <= (Number(getComputedStyle(element).zIndex) || 0)) continue
    for (const glyph of glyphs) {
      const box = intersection(glyph, rectOf(control)), area = box.width * box.height
      if (area <= .5) continue
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      if (hit && (hit === control || control.contains(hit))) report.occludedText.push({ element: identify(element), text: element.textContent?.trim(), control: identify(control), areaPx2: area })
    }
  }
}
/** @param {Element} element @param {any} report */
function auditText(element, report) {
  if (!Array.from(element.childNodes).some(n => n.nodeType === 3 && n.textContent?.trim()) && !element.matches('input,textarea')) return
  const r = rectOf(element), visible = visibleRect(element), text = element.textContent?.trim().slice(0,120) || element.getAttribute('placeholder') || ''
  const detail = { element: identify(element), text, rect: r }, font = effectiveFont(element)
  if (element.tagName !== 'BUTTON' && element.closest('.fm-tab') && ((element.getClientRects().length > 1) || r.height > parseFloat(getComputedStyle(element).fontSize) * 2)) report.wrappedLabels.push({ ...detail, reason: '商店短页签文字折成多行' })
  if (font < 11.99) report.smallText.push({ ...detail, fontPx: font })
  if (element.clientWidth > 0 && element.scrollWidth > element.clientWidth + .5) report.clippedText.push({ ...detail, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })
  const parent = element.parentElement
  if (parent && !element.matches('.fm-tool-label,.fm-tooltip,.fm-toast,.fm-n,.fm-count')) {
    const plate = textPlate(element)
    if (plate) {
      const available = availableTextArea(element, plate)
      const overhang = inkRects(element).reduce((max, ink) => Math.max(max, available.x - ink.left, ink.right - available.right, available.y - ink.top, ink.bottom - available.bottom), -Infinity)
      if (overhang > .5) report.clippedText.push({ ...detail, reason: '文字墨迹戳出底牌可用区（底牌 content box 减同行非文字兄弟）', plate: identify(plate), overhangPx: Math.round(overhang * 100) / 100, available })
    } else if (r.width > rectOf(parent).width + .5) report.clippedText.push({ ...detail, reason: '文字宽度超过所属容器', parent: identify(parent) })
  }
  if (visible && (visible.width < r.width - .5 || visible.height < r.height - .5)) {
    if (scrollOwner(element)) report.exceptions.push({ ...detail, reason: '滚动容器的边缘裁切；完整文字应在滚动到该项时再核对。' })
    else report.clippedText.push({ ...detail, visible })
  }
}
/** @param {Element} element @param {any} report */
function auditAttachment(element, report) {
  const owner = element.parentElement?.closest('.fm-plot,.fm-slot,.fm-pack-slot,.fm-cropbtn,.fm-sign,.fm-b-helper')
  if (!owner) return
  const r = rectOf(element), o = rectOf(owner), x = r.x + r.width / 2, y = r.y + r.height / 2
  if (x >= o.x && x <= o.right && y >= o.y && y <= o.bottom) return
  const label = element.matches('.fm-tool-label') && Math.abs(x - (o.x + o.width / 2)) <= 1 && y >= o.bottom && y <= o.bottom + 24
  const badge = element.matches('.fm-n,.fm-lock') && x >= o.x && x <= o.right + 4 && y >= o.y - 16 && y <= o.y
  const tooltip = element.matches('.fm-tooltip') && y <= o.y && r.bottom <= o.y - 5
  const detail = { element: identify(element), owner: identify(owner), rect: r, ownerRect: o }
  if (label || badge || tooltip) report.exceptions.push({ ...detail, reason: label ? '工具文字固定在所属按钮正下方 3px，位于工具栏保留的文字行。' : badge ? '数量/锁角标固定在所属按钮上方 13px，工具栏为它保留了上边距。' : '悬停说明固定在所属按钮上方，非漂移；仍检查窗口裁切。' })
  else report.driftedAttachments.push(detail)
}
/** @param {Element[]} decorations @param {Element[]} controls @param {any} report */
function auditDecorations(decorations, controls, report) {
  for (const decoration of decorations) for (const control of controls) {
    const front = decoration.closest('.fm-pop,.fm-mask'), back = control.closest('.fm-pop,.fm-mask')
    if (control.contains(decoration) || (front !== back && (front || back))) continue
    const area = pairOverlapArea(decoration, control)
    if (area > .5) report.decorativeOcclusions.push({ decoration: identify(decoration), control: identify(control), areaPx2: area })
  }
}
/** @param {Element[]} elements @param {any} report */
function auditBounds(elements, report) {
  for (const element of elements) {
    const r = rectOf(element), visible = visibleRect(element)
    if (!visible || (visible.width >= r.width - .5 && visible.height >= r.height - .5)) continue
    const detail = { element: identify(element), rect: r, visible }
    if (scrollOwner(element)) report.exceptions.push({ ...detail, reason: '滚动列表边缘元素被裁切；滚动到完整可见后才能验收。' })
    else report.overflowingElements.push(detail)
  }
}
/**
 * 形状感知的裁切：元素自身形状的角/边取样点落进祖先的圆角矩形或 clip-path 之外，就是被切掉。
 * 不用命中测试（会被上层元素干扰），并让浏览器按实际值收窄圆角（min(半径,宽/2,高/2)、百分比换算）。
 * @param {Element[]} elements @param {any} report
 */
function auditCornerClip(elements, report) {
  for (const element of elements) {
    const r = rectOf(element), css = getComputedStyle(element)
    if (r.width * r.height < 400 || !stylePaints(css)) continue
    if (r.right < 0 || r.bottom < 0 || r.x > innerWidth || r.y > innerHeight) continue
    const radius = cornerRadii(css, r.width, r.height)
    const clippers = []
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const pcss = getComputedStyle(parent), pr = rectOf(parent)
      if (r.x < pr.x - .5 || r.y < pr.y - .5 || r.right > pr.right + .5 || r.bottom > pr.bottom + .5) continue
      if (pcss.clipPath && pcss.clipPath !== 'none') {
        const norm = polygonOf(pcss.clipPath)
        if (norm) clippers.push({ element: parent, rect: pr, radius: [0, 0, 0, 0], poly: norm.map(p => [pr.x + p[0] * pr.width, pr.y + p[1] * pr.height]), kind: 'clip-path' })
      } else if (/(hidden|clip)/.test(pcss.overflowX + pcss.overflowY)) {
        const clipRadius = cornerRadii(pcss, pr.width, pr.height)
        if (Math.max(...clipRadius) > 0) clippers.push({ element: parent, rect: pr, radius: clipRadius, poly: null, kind: 'radius+overflow' })
      }
    }
    if (!clippers.length) continue
    const corners = [[r.x, r.y, 0, 1, 1], [r.right, r.y, 1, -1, 1], [r.right, r.bottom, 2, -1, -1], [r.x, r.bottom, 3, 1, -1]]
    const cuts = []
    for (let c = 0; c < 4; c += 1) {
      const cx = corners[c][0], cy = corners[c][1], sx = corners[c][3], sy = corners[c][4], rad = radius[c]
      const applicable = clippers.filter(clip => clip.kind === 'clip-path' || clip.radius[c] > rad + .5)
      if (!applicable.length) continue
      const samples = []
      if (rad > 1) {
        for (let k = 0; k <= 18; k += 1) { const angle = Math.PI / 2 * k / 18; samples.push([cx + sx * (rad - (rad - .75) * Math.cos(angle)), cy + sy * (rad - (rad - .75) * Math.sin(angle))]) }
      } else {
        for (let d = 1; d <= 24; d += 1) { samples.push([cx + sx * d, cy + sy * 1.5]); samples.push([cx + sx * 1.5, cy + sy * d]) }
      }
      let misses = 0, culprit = null
      for (const point of samples) {
        if (point[0] < 0 || point[1] < 0 || point[0] > innerWidth - 1 || point[1] > innerHeight - 1) continue
        let cutBy = null
        for (const clip of applicable) if (!pointInShape(point[0], point[1], clip)) { cutBy = clip; break }
        if (!cutBy) continue
        misses += 1
        culprit = culprit || cutBy
      }
      const clippedPct = Math.round(misses / samples.length * 100)
      if (clippedPct < 15) continue
      cuts.push({ corner: ['TL', 'TR', 'BR', 'BL'][c], ownRadiusPx: Math.round(rad * 10) / 10, clippedPct, clipper: identify(culprit.element), clipKind: culprit.kind, clipperRadiusPx: Math.round(Math.max(...culprit.radius) * 10) / 10 })
    }
    if (cuts.length) report.cornerClip.push({ element: identify(element), cuts })
  }
}
const assetCatalog = readAssetLayout()
/** @returns {any} */
function auditProgress(elements, report) {
  for (const track of elements.filter(e => e.matches('.fm-card-progress,.fm-exp'))) {
    const fill = track.firstElementChild, fraction = parseFloat(fill?.style?.width || '') / 100
    if (!fill || !(fraction > 0)) continue
    const css = getComputedStyle(fill)
    if (['transparent', 'rgba(0, 0, 0, 0)'].includes(css.backgroundColor) && (!css.backgroundImage || css.backgroundImage === 'none')) report.pageErrors.push('进度条有数值却没有绘制填充：' + identify(track))
    const expected = track.clientWidth * fraction, actual = rectOf(fill).width
    if (Math.abs(actual - expected) > 2) report.driftedAttachments.push({ element: identify(fill), reason: '进度填充宽度与数值不一致', expected, actual })
  }
}
function auditPage() {
  const report = { identity: { title: document.title, url: location.href, width: innerWidth, height: innerHeight }, overlaps: [], cornerClip: [], overflowingElements: [], decorativeOcclusions: [], driftedAttachments: [], clippedText: [], occludedText: [], wrappedLabels: [], smallText: [], blockedControls: [], blockedControlsExempt: [], offViewportControls: [], smallTargets: [], smallIcons: [], missingImages: [], stretchedImages: [], framePaddingViolations: [], unknownAssetGeometry: [], pageErrors: [], exceptions: [], checked: {} }
  const allElements = Array.from(document.querySelectorAll('body *'))
  const visible = allElements.filter(e => visibleRect(e))
  const offViewportHidden = auditOffViewport(allElements, report)
  const controls = visible.filter(e => e.matches('button,input,textarea,select,a[href],[role="button"],.fm-plot'))
  const attached = visible.filter(e => e.matches('.fm-chip,.fm-prog,.fm-b-sign,.fm-bubble,.fm-n,.fm-count,.fm-lock,.fm-tool-label,.fm-tooltip'))
  if (!visible.some(e => e.matches('.fm'))) report.pageErrors.push('没有可见的菜园，不能把隐藏页面算成通过')
  for (const scene of visible.filter(e => e.matches('.fm-big'))) {
    const r = rectOf(scene)
    if (Math.abs(r.x) > .5 || Math.abs(r.y) > .5 || Math.abs(r.right - innerWidth) > .5 || Math.abs(r.bottom - innerHeight) > .5) report.pageErrors.push({ reason: '大场景未铺满窗口', rect: r, gapsPx: { left: r.x, top: r.y, right: innerWidth - r.right, bottom: innerHeight - r.bottom } })
  }
  if (!controls.length) report.pageErrors.push('菜园没有可见操作项，不能把空界面算成通过')
  const purchaseInfo = document.querySelector?.('.fm-buy-columns')
  if (purchaseInfo && purchaseInfo.clientHeight < 32) report.pageErrors.push('购买信息区被压成零高，滚动也无法查看商品资料')
  if (document.fonts.status !== 'loaded') report.pageErrors.push('字体尚未稳定，稍后重读')
  auditBounds([...new Set([...controls, ...attached])], report)
  auditCornerClip(visible.filter(e => e.closest('.fm')), report)
  auditControls(controls, report)
  auditPairs([...new Set([...controls, ...attached])], report)
  auditDecorations(visible.filter(e => e.matches('.fm-crop,.fm-pest,.fm-b-pig,.fm-s-pig,.fm-b-face,.fm-s-face,.fm-title')), controls, report)
  visible.forEach(e => { auditText(e, report); if (Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent?.trim())) auditTextOcclusion(e, controls, report) })
  attached.forEach(e => auditAttachment(e, report))
  auditProgress(visible, report)
  auditImageRatios(visible, report, assetCatalog)
  auditMaterialPadding(visible, report, assetCatalog)
  for (const element of visible.filter(e => e.matches('.fm img'))) {
    const r = rectOf(element)
    if (!(element instanceof HTMLImageElement) || !element.complete || !element.naturalWidth) report.missingImages.push({ element: identify(element), src: element.getAttribute('src') })
    if (element.matches('.fm-card-tail')) {
      const card = element.closest('.fm-hover-card'), target = card?.closest('.fm')?.querySelector('[data-farm-plot="' + card.getAttribute('data-farm-card') + '"]')
      if (card && target) {
        const frame = rectOf(card), plot = rectOf(target), border = card.clientLeft || 0
        const expected = Math.max(frame.x + border + 24, Math.min(frame.right - border - 24, plot.x + plot.width / 2))
        const error = Math.abs(r.x + r.width / 2 - expected)
        const info = assetCatalog[(card.getAttribute('data-farm-frame') || 'card-frame') + '.webp']
        const gap = info?.outer_insets?.[0] && info?.nine_slice?.insets?.[0] ? info.outer_insets[0] / info.nine_slice.insets[0] * (card.clientTop || border) : 0
        const overlap = card.getAttribute('data-farm-below') === 'true' ? r.bottom - frame.y - gap : frame.bottom - r.y
        if (error > 2 || Math.abs(overlap - 2) > 2) report.driftedAttachments.push({ element: identify(element), reason: '尾巴没有指向所属地块或脱离卡框', error, overlap, expected })
      }
      report.exceptions.push({ element: identify(element), reason: '悬停尾巴为24×12装饰；继续检查比例、所属地块中心和框沿连接。' })
    }
    else if (r.width < 23.99 || r.height < 23.99) report.smallIcons.push({ element: identify(element), src: element.getAttribute('src'), rect: r })
  }
  report.checked = { visibleElements: visible.length, controls: controls.length, attachments: attached.length, offViewport: report.offViewportControls.length, offViewportHidden }
  report.problemCount = ['overlaps','cornerClip','overflowingElements','decorativeOcclusions','driftedAttachments','clippedText','occludedText','wrappedLabels','smallText','blockedControls','smallTargets','smallIcons','missingImages','stretchedImages','framePaddingViolations','unknownAssetGeometry','pageErrors'].reduce((n,key) => n + report[key].length,0)
  // 两类「可疑但无法自动判」的标记：不进 problemCount，但必须在报告里有数字，否则 problemCount=0 会被当成「没问题」。
  report.humanReview = { blockedControlsExempt: report.blockedControlsExempt.length, offViewportControls: report.offViewportControls.length, needsManualReview: report.blockedControlsExempt.length + report.offViewportControls.length > 0, note: '两类都不进 problemCount：blockedControlsExempt=被弹层/滚动豁免的遮挡；offViewportControls=可见但整条在视口外的操作项。>0 即需人工复核。' }
  return report
}
const browserFunctions = [rectOf, identify, intersection, hiddenByStyle, visibleRect, effectiveFont, layerOf, isAncestor, scrollOwner, footprint, shapesOf, pairOverlapArea, topSide, inkRects, textPlate, availableTextArea, scrollBringsIntoView, cross, polygonIntersection, polygonArea, auditPairs, auditControls, auditOffViewport, auditTextOcclusion, auditText, auditAttachment, auditDecorations, auditBounds, auditCornerClip, auditProgress, auditPage]
/** @param {Record<string, any>} [catalog] */
export function buildAuditExpression(catalog = readAssetLayout()) {
  return '(function () {const assetCatalog=' + JSON.stringify(catalog) + ';' + [...SHAPE_AUDIT_FUNCTIONS, ...browserFunctions, ...IMAGE_AUDIT_FUNCTIONS].map(fn => fn.toString()).join('\n') + '\nreturn auditPage()\n})()'
}
export const AUDIT_EXPRESSION = buildAuditExpression()

/** @param {string} endpoint @param {string} expression */
async function readCdp(endpoint, expression) {
  const socket = new WebSocket(endpoint)
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP 只读请求超过 2500ms')), 2500)
      socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
      socket.onerror = () => { clearTimeout(timer); reject(new Error('CDP 连接失败')) }
      socket.onmessage = event => {
        const message = JSON.parse(String(event.data))
        if (message.id !== 1) return
        clearTimeout(timer)
        if (message.error || message.result?.exceptionDetails) reject(new Error(JSON.stringify(message.error || message.result.exceptionDetails)))
        else resolve(message.result?.result?.value)
      }
    })
  } finally { socket.close() }
}
/** @param {string[]} args */
async function run(args) {
  const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback
  const base = option('--cdp', 'http://127.0.0.1:9334'), target = option('--target', 'big')
  const response = await fetch(base + '/json/list', { signal: AbortSignal.timeout(2500) })
  const pages = (await response.json()).filter(page => page.type === 'page')
  const states = await Promise.all(pages.map(async page => ({ page, state: await readCdp(page.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, base.replace(/^http/,'ws')), '({farm:Array.from(document.querySelectorAll(".fm")).some(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0),big:!!document.querySelector(".fm-big")})') })))
  const chosen = states.find(entry => entry.state.farm && (target === 'big' ? entry.state.big : !entry.state.big))
  if (!chosen) throw new Error('没有找到可见的菜园 ' + target + ' 页面')
  const endpoint = chosen.page.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, base.replace(/^http/,'ws'))
  const result = await readCdp(endpoint, AUDIT_EXPRESSION)
  const json = JSON.stringify(result, null, 2) + '\n', output = option('--output', '')
  if (output) writeFileSync(output, json)
  process.stdout.write(json)
  // 报告里必须出现这两类标记的条数：problemCount 之外，单独打印「需人工复核」清单计数（走 stderr，不污染 stdout 的 JSON）。
  const review = result.humanReview || {}
  process.stderr.write('需人工复核（不进 problemCount）：blockedControlsExempt=' + (review.blockedControlsExempt || 0) + '，offViewportControls=' + (review.offViewportControls || 0) + (review.needsManualReview ? ' ← >0，需人工复核' : '') + '\n')
  if (result.problemCount) process.exitCode = 1
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch(error => { console.error('layout audit failed:', error.message); process.exitCode = 1 })
}
