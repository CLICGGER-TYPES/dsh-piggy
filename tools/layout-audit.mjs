// @ts-check
// 菜园布局验收：只读 CDP/DOM，不点击、不派发事件、不修改页面或存档。真实操作另按 QA-SPEC 执行。
import { writeFileSync } from 'node:fs'
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
/** @param {Element} element */
function visibleRect(element) {
  let r = intersection(rectOf(element), { x: 0, y: 0, right: innerWidth, bottom: innerHeight })
  for (let parent = element; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent)
    if (css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0 || parent.closest('[inert]')) return null
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
  const r = rectOf(element)
  if (element.matches('.fm-plot') && element.querySelector('.fm-hit')) return [[r.x + r.width / 2, r.y], [r.right, r.y + r.height / 2], [r.x + r.width / 2, r.bottom], [r.x, r.y + r.height / 2]]
  return [[r.x, r.y], [r.right, r.y], [r.right, r.bottom], [r.x, r.bottom]]
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
/** @param {Element[]} nodes @param {any} report */
function auditPairs(nodes, report) {
  for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
    const a = nodes[i], b = nodes[j]
    if (a.contains(b) || b.contains(a) || layerOf(a) !== layerOf(b) || (!(a.matches('.fm-plot') && b.matches('.fm-plot')) && getComputedStyle(a).zIndex !== getComputedStyle(b).zIndex)) continue
    const box = intersection(rectOf(a), rectOf(b)), boxArea = box.width * box.height
    if (boxArea <= .5) continue
    const area = polygonArea(polygonIntersection(footprint(a), footprint(b)))
    const detail = { a: identify(a), b: identify(b), boxAreaPx2: boxArea, areaPx2: area }
    if (area > .5) report.overlaps.push(detail)
    else report.exceptions.push({ ...detail, reason: '菱形轴对齐框相交；实际地块与命中多边形只共边，没有内部相交。' })
  }
}
/** @param {Element[]} controls @param {any} report */
function auditControls(controls, report) {
  for (const element of controls) {
    const r = rectOf(element), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    const detail = { element: identify(element), label: element.getAttribute('aria-label') || element.textContent?.trim(), rect: r }
    if (r.width < 31.99 || r.height < 31.99) report.smallTargets.push(detail)
    if (!hit || !(element === hit || element.contains(hit))) {
      const overlay = hit?.closest('.fm-pop,.fm-mask'), scroll = scrollOwner(element)
      if (overlay && !overlay.contains(element)) report.exceptions.push({ ...detail, hit: identify(hit), reason: '打开的弹层覆盖背景操作；背景操作不得穿过弹层。关闭后仍必须复测。' })
      else if (scroll && (intersection(r, rectOf(scroll)).height < r.height - .5 || intersection(r, rectOf(scroll)).width < r.width - .5)) report.exceptions.push({ ...detail, reason: '滚动列表边缘只露出部分商品；滚动后才能操作该商品中心。' })
      else report.blockedControls.push({ ...detail, hit: hit ? identify(hit) : null })
    }
  }
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
  if (parent && !element.matches('.fm-tool-label,.fm-tooltip,.fm-toast,.fm-n,.fm-count') && r.width > rectOf(parent).width + .5) report.clippedText.push({ ...detail, reason: '文字宽度超过所属容器', parent: identify(parent) })
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
    if (control.contains(decoration) || (control.closest('.fm-pop,.fm-mask') && !decoration.closest('.fm-pop,.fm-mask'))) continue
    const area = polygonArea(polygonIntersection(footprint(decoration), footprint(control)))
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
/** @returns {any} */
function auditPage() {
  const report = { identity: { title: document.title, url: location.href, width: innerWidth, height: innerHeight }, overlaps: [], overflowingElements: [], decorativeOcclusions: [], driftedAttachments: [], clippedText: [], occludedText: [], wrappedLabels: [], smallText: [], blockedControls: [], smallTargets: [], smallIcons: [], missingImages: [], pageErrors: [], exceptions: [], checked: {} }
  const visible = Array.from(document.querySelectorAll('body *')).filter(e => visibleRect(e))
  const controls = visible.filter(e => e.matches('button,input,textarea,select,a[href],[role="button"],.fm-plot'))
  const attached = visible.filter(e => e.matches('.fm-chip,.fm-prog,.fm-b-sign,.fm-bubble,.fm-n,.fm-count,.fm-lock,.fm-tool-label,.fm-tooltip'))
  if (!visible.some(e => e.matches('.fm'))) report.pageErrors.push('没有可见的菜园，不能把隐藏页面算成通过')
  for (const scene of visible.filter(e => e.matches('.fm-big'))) {
    const r = rectOf(scene)
    if (Math.abs(r.x) > .5 || Math.abs(r.y) > .5 || Math.abs(r.right - innerWidth) > .5 || Math.abs(r.bottom - innerHeight) > .5) report.pageErrors.push({ reason: '大场景未铺满窗口', rect: r, gapsPx: { left: r.x, top: r.y, right: innerWidth - r.right, bottom: innerHeight - r.bottom } })
  }
  if (!controls.length) report.pageErrors.push('菜园没有可见操作项，不能把空界面算成通过')
  if (document.fonts.status !== 'loaded') report.pageErrors.push('字体尚未稳定，稍后重读')
  auditBounds([...new Set([...controls, ...attached])], report)
  auditControls(controls, report)
  auditPairs([...new Set([...controls, ...attached])], report)
  auditDecorations(visible.filter(e => e.matches('.fm-crop,.fm-pest,.fm-b-pig,.fm-s-pig,.fm-b-face,.fm-s-face')), controls, report)
  visible.forEach(e => { auditText(e, report); if (Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent?.trim())) auditTextOcclusion(e, controls, report) })
  attached.forEach(e => auditAttachment(e, report))
  for (const element of visible.filter(e => e.matches('.fm img'))) {
    const r = rectOf(element)
    if (!(element instanceof HTMLImageElement) || !element.complete || !element.naturalWidth) report.missingImages.push({ element: identify(element), src: element.getAttribute('src') })
    if (r.width < 23.99 || r.height < 23.99) report.smallIcons.push({ element: identify(element), src: element.getAttribute('src'), rect: r })
  }
  report.checked = { visibleElements: visible.length, controls: controls.length, attachments: attached.length }
  report.problemCount = ['overlaps','overflowingElements','decorativeOcclusions','driftedAttachments','clippedText','occludedText','wrappedLabels','smallText','blockedControls','smallTargets','smallIcons','missingImages','pageErrors'].reduce((n,key) => n + report[key].length,0)
  return report
}
const browserFunctions = [rectOf, identify, intersection, visibleRect, effectiveFont, layerOf, scrollOwner, footprint, cross, polygonIntersection, polygonArea, auditPairs, auditControls, auditTextOcclusion, auditText, auditAttachment, auditDecorations, auditBounds, auditPage]
export const AUDIT_EXPRESSION = '(function () {' + browserFunctions.map(fn => fn.toString()).join('\n') + '\nreturn auditPage()\n})()'

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
  if (result.problemCount) process.exitCode = 1
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch(error => { console.error('layout audit failed:', error.message); process.exitCode = 1 })
}
