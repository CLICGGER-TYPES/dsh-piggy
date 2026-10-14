// @ts-check
// 浏览器端纯读取的形状工具：圆角/裁切多边形、伪元素盒子、上色判断。由布局脚本序列化进 CDP。
// 与 layout-image-audit.mjs 一样，函数体靠 toString() 注入页面，所以只能引用同样被注入的其它函数和浏览器全局。

/** @param {string} color */
function alphaOf(color) {
  const match = String(color).match(/rgba?\(([^)]+)\)/)
  if (!match) return 0
  const parts = match[1].split(',').map(parseFloat)
  return parts.length > 3 ? parts[3] : 1
}
/** @param {string|undefined} image @param {string|undefined} size */
function imagePaints(image, size) { return !!image && image !== 'none' && size !== '0px 0px' }
/** 元素自身的背景/边框会不会画出可见像素（不含伪元素）。@param {CSSStyleDeclaration} css */
function stylePaints(css) {
  return alphaOf(css.backgroundColor) > .05 || imagePaints(css.backgroundImage, css.backgroundSize) ||
    parseFloat(css.borderTopWidth) > 0 || !!(css.borderImageSource && css.borderImageSource !== 'none')
}
/** 伪元素的背景/边框会不会画出可见像素。@param {CSSStyleDeclaration} css */
function pseudoPaints(css) { return alphaOf(css.backgroundColor) > .05 || imagePaints(css.backgroundImage, css.backgroundSize) || parseFloat(css.borderTopWidth) > 0 }
/** 圆角按浏览器实际使用的值收窄（min(半径, 宽/2, 高/2)；百分比换算）。@param {CSSStyleDeclaration} css @param {number} w @param {number} h @returns {number[]} */
function cornerRadii(css, w, h) {
  return [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomRightRadius, css.borderBottomLeftRadius].map(value => {
    const n = parseFloat(value)
    if (!Number.isFinite(n)) return 0
    const scaled = /%$/.test(String(value)) ? n / 100 * Math.min(w, h) : n
    return Math.min(scaled, w / 2, h / 2)
  })
}
/** 解析 clip-path:polygon(...) 为归一化顶点；不是 polygon 就返回 null。@param {string} clip @returns {number[][]|null} */
function polygonOf(clip) {
  const match = String(clip).match(/polygon\(([^)]*)\)/)
  if (!match) return null
  return match[1].split(',').map(pair => {
    const parts = pair.trim().split(/\s+/).map(parseFloat)
    return [Number.isFinite(parts[0]) ? parts[0] / 100 : 0, Number.isFinite(parts[1]) ? parts[1] / 100 : 0]
  })
}
/** 把元素还原成「圆角矩形或 clip-path 多边形」；不支持的裁切返回 null。@param {Element} element @param {any} rect @returns {any} */
function shapeOfElement(element, rect) {
  const css = getComputedStyle(element)
  const shape = { rect, radius: cornerRadii(css, rect.width, rect.height), poly: null }
  if (css.clipPath && css.clipPath !== 'none') {
    const norm = polygonOf(css.clipPath)
    if (!norm) return null
    shape.poly = norm.map(p => [rect.x + p[0] * rect.width, rect.y + p[1] * rect.height])
    shape.radius = [0, 0, 0, 0]
  }
  return shape
}
/** 点是否在形状内（页面坐标）。@param {number} px @param {number} py @param {any} shape */
function pointInShape(px, py, shape) {
  const r = shape.rect, dx = px - r.x, dy = py - r.y
  if (shape.poly) {
    let inside = false
    for (let a = 0, b = shape.poly.length - 1; a < shape.poly.length; b = a++) {
      const xa = shape.poly[a][0], ya = shape.poly[a][1], xb = shape.poly[b][0], yb = shape.poly[b][1]
      if ((ya > dy) !== (yb > dy) && dx < (xb - xa) * (dy - ya) / (yb - ya) + xa) inside = !inside
    }
    return inside
  }
  if (dx < 0 || dy < 0 || dx > r.width || dy > r.height) return false
  const R = shape.radius
  if (R[0] > 0 && dx < R[0] && dy < R[0]) return (dx - R[0]) ** 2 + (dy - R[0]) ** 2 <= R[0] * R[0] + .01
  if (R[1] > 0 && dx > r.width - R[1] && dy < R[1]) return (dx - (r.width - R[1])) ** 2 + (dy - R[1]) ** 2 <= R[1] * R[1] + .01
  if (R[2] > 0 && dx > r.width - R[2] && dy > r.height - R[2]) return (dx - (r.width - R[2])) ** 2 + (dy - (r.height - R[2])) ** 2 <= R[2] * R[2] + .01
  if (R[3] > 0 && dx < R[3] && dy > r.height - R[3]) return (dx - R[3]) ** 2 + (dy - (r.height - R[3])) ** 2 <= R[3] * R[3] + .01
  return true
}
/**
 * 伪元素按 content/position/inset/width/height 还原成盒子（页面坐标）。
 * 无条件绘制（content:none）或非绝对定位的返回 null。
 * @param {Element} element @param {string} pseudo @param {any} rect @returns {any}
 */
function readPseudoBox(element, pseudo, rect) {
  const css = getComputedStyle(element, pseudo)
  if (!css || !css.content || css.content === 'none' || css.content === 'normal') return null
  if (css.position !== 'absolute' && css.position !== 'fixed') return null
  const width = parseFloat(css.width), height = parseFloat(css.height)
  const w = Number.isFinite(width) ? width : rect.width
  const h = Number.isFinite(height) ? height : rect.height
  const left = css.left !== 'auto' ? parseFloat(css.left) : css.right !== 'auto' ? rect.width - parseFloat(css.right) - w : 0
  const top = css.top !== 'auto' ? parseFloat(css.top) : css.bottom !== 'auto' ? rect.height - parseFloat(css.bottom) - h : 0
  return { x: rect.x + left, y: rect.y + top, width: w, height: h, right: rect.x + left + w, bottom: rect.y + top + h }
}
/** 元素本体或它的伪元素会不会画出可见像素。@param {Element} element */
function elementPaints(element) {
  if (element.tagName === 'IMG') return true
  if (stylePaints(getComputedStyle(element))) return true
  for (const pseudo of ['::before', '::after']) {
    const css = getComputedStyle(element, pseudo)
    if (css && css.content && css.content !== 'none' && css.content !== 'normal' && pseudoPaints(css)) return true
  }
  return false
}
/** 从 node 向上到 root：任一层（含伪元素）上色就算「这一侧真的画了」。@param {Element} node @param {Element} root */
function subtreePaints(node, root) {
  for (let element = node; element; element = element.parentElement) {
    if (elementPaints(element)) return true
    if (element === root) break
  }
  return false
}
/** 点是否在绝对坐标多边形内（射线法）。@param {number} px @param {number} py @param {number[][]} poly */
function pointInPolygon(px, py, poly) {
  let inside = false
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const xa = poly[a][0], ya = poly[a][1], xb = poly[b][0], yb = poly[b][1]
    if ((ya > py) !== (yb > py) && px < (xb - xa) * (py - ya) / (yb - ya) + xa) inside = !inside
  }
  return inside
}
export const SHAPE_AUDIT_FUNCTIONS = [alphaOf, imagePaints, stylePaints, pseudoPaints, cornerRadii, polygonOf, shapeOfElement, pointInShape, pointInPolygon, readPseudoBox, elementPaints, subtreePaints]

export { alphaOf, imagePaints, stylePaints, pseudoPaints, cornerRadii, polygonOf, shapeOfElement, pointInShape, pointInPolygon, readPseudoBox, elementPaints, subtreePaints }
