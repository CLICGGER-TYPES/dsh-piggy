// @ts-check
// 浏览器端纯读取：图片真实绘制比例、九宫格四角比例、文字到素材内边线的距离。由布局脚本序列化进CDP。

/** @param {Element} element */
function imageIdentify(element) {
  const mark = Array.from(element.attributes).find(attr => attr.name.startsWith('data-farm-'))
  return mark ? `[${mark.name}="${mark.value}"]` : element.tagName.toLowerCase() + '.' + Array.from(element.classList).join('.')
}
/** @param {string} value @returns {string|null} */
function assetFile(value) { return String(value || '').match(/([a-z0-9-]+\.(?:webp|png))(?:[?"')]|$)/)?.[1] || null }
/** @param {Element} element @param {CSSStyleDeclaration} css */
function frameAsset(element, css) {
  const mark = element.getAttribute('data-farm-frame')
  return mark ? mark + '.webp' : assetFile(css.borderImageSource) || assetFile(css.backgroundImage)
}
/** @param {Element} element */
function axisScale(element) {
  let x = 1, y = 1
  for (let node = element; node; node = node.parentElement) {
    const css = getComputedStyle(node), matrix = new DOMMatrix(css.transform === 'none' ? undefined : css.transform)
    x *= Math.hypot(matrix.a, matrix.b) * (Number(css.zoom) || 1)
    y *= Math.hypot(matrix.c, matrix.d) * (Number(css.zoom) || 1)
  }
  return { x, y }
}
/** @param {Element} element @param {CSSStyleDeclaration} css @param {number[]} natural @param {boolean} isImage */
function paintedImage(element, css, natural, isImage) {
  const r = element.getBoundingClientRect(), scale = axisScale(element)
  const width = r.width / scale.x, height = r.height / scale.y, ratio = natural[0] / natural[1]
  const fit = isImage ? css.objectFit : css.backgroundSize
  let w = width, h = height
  if (['contain', 'cover', 'scale-down'].includes(fit)) {
    let factor = (fit === 'cover' ? Math.max : Math.min)(width / natural[0], height / natural[1])
    if (fit === 'scale-down') factor = Math.min(1, factor)
    w = natural[0] * factor; h = natural[1] * factor
  } else if (fit === 'none' || (isImage && !fit)) { w = natural[0]; h = natural[1] }
  else if (!isImage) {
    const parts = fit.split(' ')
    const value = (part, base) => part?.endsWith('%') ? base * parseFloat(part) / 100 : part?.endsWith('px') ? parseFloat(part) : base
    w = value(parts[0], width); h = value(parts[1], height)
    if (parts[1] === 'auto') h = w / ratio
    if (parts[0] === 'auto') w = h * ratio
  }
  const position = (css.backgroundPosition || '50% 50%').split(' ')
  const offset = (part, space) => part?.endsWith('px') ? parseFloat(part) : part?.endsWith('%') ? space * parseFloat(part) / 100 : part === 'left' || part === 'top' ? 0 : part === 'right' || part === 'bottom' ? space : space / 2
  return { x: r.x + (isImage ? (r.width - w * scale.x) / 2 : offset(position[0], r.width - w * scale.x)), y: r.y + (isImage ? (r.height - h * scale.y) / 2 : offset(position[1], r.height - h * scale.y)), width: w * scale.x, height: h * scale.y }
}
/** @param {Element[]} elements @param {any} report @param {Record<string,any>} catalog */
function auditImageRatios(elements, report, catalog) {
  for (const element of elements) {
    if (!element.closest('.fm')) continue
    const css = getComputedStyle(element)
    if (element.tagName === 'IMG') {
      const image = /** @type {HTMLImageElement} */ (element)
      if (image.naturalWidth && image.naturalHeight) recordImageRatio(element, css, [image.naturalWidth, image.naturalHeight], true, report)
    }
    for (const pseudo of [null, '::before']) {
      const style = pseudo ? getComputedStyle(element, pseudo) : css, name = assetFile(style.backgroundImage)
      if (!name || style.backgroundSize === '0px 0px') continue
      if (!catalog[name]?.size) { report.unknownAssetGeometry.push({ element: imageIdentify(element), name }); continue }
      recordImageRatio(element, style, catalog[name].size, false, report, pseudo)
    }
    const frame = assetFile(css.borderImageSource)
    if (frame) auditNineSlice(element, css, catalog[frame], report)
    else if (element.matches('.fm-framed-art,.fm-frame')) report.unknownAssetGeometry.push({ element: imageIdentify(element), reason: '九宫格框材质未实际绘制' })
  }
}
/** @param {Element} element @param {CSSStyleDeclaration} css @param {number[]} natural @param {boolean} isImage @param {any} report @param {string|null} [pseudo] */
function recordImageRatio(element, css, natural, isImage, report, pseudo) {
  const painted = paintedImage(element, css, natural, isImage)
  if (!painted.width || !painted.height) return
  const distortionPercent = Math.abs(painted.width / painted.height / (natural[0] / natural[1]) - 1) * 100
  if (distortionPercent > 2.001) report.stretchedImages.push({ element: imageIdentify(element), pseudo, natural, painted, distortionPercent })
}
/** @param {Element} element @param {CSSStyleDeclaration} css @param {any} info @param {any} report */
function auditNineSlice(element, css, info, report) {
  if (!info?.nine_slice?.insets) { report.unknownAssetGeometry.push({ element: imageIdentify(element), reason: '九宫格没有manifest inset' }); return }
  const [top, right, bottom, left] = info.nine_slice.insets
  const borders = [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth].map(parseFloat)
  const parts = css.borderImageWidth?.split(' ') || []
  const values = [parts[0], parts[1] || parts[0], parts[2] || parts[0], parts[3] || parts[1] || parts[0]]
  const output = borders.map((n, i) => values.length === 4 && values[i]?.endsWith('px') ? parseFloat(values[i]) : n)
  const ratios = [[output[3] / left, output[0] / top], [output[1] / right, output[0] / top], [output[3] / left, output[2] / bottom], [output[1] / right, output[2] / bottom]]
  if (ratios.some(([x, y]) => x > 0 && y > 0 && Math.abs(x / y - 1) > .02001)) report.stretchedImages.push({ element: imageIdentify(element), reason: '九宫格四角缩放比例不一致', insets: info.nine_slice.insets, output })
}
/** @param {Element} element @returns {DOMRect[]} */
function textRects(element) {
  if (typeof document.createRange !== 'function') return [element.getBoundingClientRect()]
  const rects = []
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType !== 3 || !node.textContent?.trim()) continue
    const range = document.createRange(); range.selectNodeContents(node)
    rects.push(...Array.from(range.getClientRects())); range.detach()
  }
  return rects
}
/** @param {Element} frame @param {CSSStyleDeclaration} css @param {any} info */
function materialInnerRect(frame, css, info) {
  const r = frame.getBoundingClientRect(), natural = info.size, inset = info.inner_insets
  if (css.borderImageSource && css.borderImageSource !== 'none') {
    const slices = info.nine_slice.insets, parts = css.borderImageWidth?.split(' ') || []
    const values = [parts[0], parts[1] || parts[0], parts[2] || parts[0], parts[3] || parts[1] || parts[0]]
    const widths = [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth].map((n, i) => values.length === 4 && values[i]?.endsWith('px') ? parseFloat(values[i]) : parseFloat(n))
    const map = (value, side, axis, opposite) => value <= slices[side] ? value / slices[side] * widths[side] : widths[side] + (value - slices[side]) / (natural[axis] - slices[side] - slices[opposite]) * ((axis ? r.height : r.width) - widths[side] - widths[opposite])
    return { left: r.left + map(inset[3], 3, 0, 1), right: r.right - map(inset[1], 1, 0, 3), top: r.top + map(inset[0], 0, 1, 2), bottom: r.bottom - map(inset[2], 2, 1, 0) }
  }
  const painted = paintedImage(frame, css, natural, false)
  return { left: painted.x + inset[3] * painted.width / natural[0], right: painted.x + painted.width - inset[1] * painted.width / natural[0], top: painted.y + inset[0] * painted.height / natural[1], bottom: painted.y + painted.height - inset[2] * painted.height / natural[1] }
}
/** @param {Element[]} elements @param {any} report @param {Record<string,any>} catalog */
function auditMaterialPadding(elements, report, catalog) {
  const missing = new Set()
  for (const element of elements) {
    if (element.matches('.fm-chip:not(.fm-expand)')) { report.exceptions.push({ element: imageIdentify(element), reason: '收获/枯萎提示为自身CSS胶囊，不把后面的土块误作文字框；另查字号、裁切和归属。' }); continue }
    if (!element.closest('.fm') || element.matches('.fm-tool-label,.fm-tooltip,.fm-n,.fm-lock') || !Array.from(element.childNodes).some(n => n.nodeType === 3 && n.textContent?.trim())) continue
    let frame = element, name = null
    while (frame && frame.closest('.fm')) {
      name = frameAsset(frame, getComputedStyle(frame))
      if (name && !name.startsWith('bg-')) break
      frame = frame.parentElement
    }
    if (!frame || !name || name.startsWith('bg-')) continue
    const info = catalog[name]
    if (!info?.inner_insets || !info?.size) {
      if (!missing.has(name)) report.unknownAssetGeometry.push({ name, element: imageIdentify(frame), reason: '带文字框缺manifest真实inner_insets，不能按元素外边界假通过' })
      missing.add(name); continue
    }
    const inner = materialInnerRect(frame, getComputedStyle(frame), info), minimum = element.closest('.fm-big') ? 8 : 6
    for (const glyph of textRects(element)) {
      const gaps = { left: glyph.left - inner.left, right: inner.right - glyph.right, top: glyph.top - inner.top, bottom: inner.bottom - glyph.bottom }
      if (Object.values(gaps).some(gap => gap < minimum - .5)) report.framePaddingViolations.push({ element: imageIdentify(element), text: element.textContent?.trim(), name, minimum, gaps, inner })
    }
  }
}
export const IMAGE_AUDIT_FUNCTIONS = [imageIdentify, assetFile, frameAsset, axisScale, paintedImage, auditImageRatios, recordImageRatio, auditNineSlice, textRects, materialInnerRect, auditMaterialPadding]

export { auditImageRatios, auditMaterialPadding }
