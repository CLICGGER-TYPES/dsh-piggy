// 布局审计的失败夹具：证明脚本确实能抓重叠、遮挡、字体、裁切与空页面，不能只产出全零报告。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { AUDIT_EXPRESSION, buildAuditExpression } from '../tools/layout-audit.mjs'

function node({ x = 0, y = 0, w = 40, h = 40, tag = 'BUTTON', classes = [], text = '', css = {}, hit = false } = {}) {
  const element = { tagName: tag, classList: classes, parentElement: null, attributes: [],
    textContent: text, childNodes: text ? [{ nodeType: 3, textContent: text }] : [], clientWidth: w, clientHeight: h, scrollWidth: w, scrollHeight: h,
    css: { display: 'block', visibility: 'visible', opacity: '1', overflowX: 'visible', overflowY: 'visible', fontSize: '12px', transform: 'none', zIndex: 'auto', zoom: '1', ...css },
    getBoundingClientRect: () => ({ x, y, width: w, height: h, right: x + w, bottom: y + h, left: x, top: y }),
    getAttribute() { return null },
    matches(selector) { return selector.split(',').some(s => s.trim().startsWith('.') ? classes.includes(s.trim().slice(1)) : s.trim().toUpperCase() === tag) },
    querySelector(selector) { return hit && selector === '.fm-hit' ? { css: { clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' } } : null },
    contains(other) { for (let p = other; p; p = p.parentElement) if (p === element) return true; return false },
    closest(selector) { for (let p = element; p; p = p.parentElement) if (p.matches(selector)) return p; return null },
  }
  return element
}
function audit(elements, overrides = {}, expression = AUDIT_EXPRESSION) {
  const root = node({ w: 1200, h: 800, tag: 'DIV', classes: ['fm'] })
  elements.forEach(e => { e.parentElement ||= root })
  const document = { title: 'audit fixture', fonts: { status: 'loaded' }, querySelectorAll: () => [root, ...elements],
    elementFromPoint(x,y) { return [...elements].reverse().find(e => { const r = e.getBoundingClientRect(); return e.tagName === 'BUTTON' && x >= r.x && x <= r.right && y >= r.y && y <= r.bottom }) || root }, ...overrides }
  return runInNewContext(expression, { document, location: { href: 'fixture://layout' }, innerWidth: 1200, innerHeight: 800,
    getComputedStyle: e => e.css, DOMMatrix: class { a = 1; b = 0; c = 0; d = 1 }, HTMLImageElement: class {} })
}

test('布局审计：分离的正常按钮通过；真实相交和遮挡均不能通过', () => {
  assert.equal(audit([node({ x: 10 }), node({ x: 60 })]).problemCount, 0)
  const result = audit([node({ x: 10 }), node({ x: 30 })])
  assert.equal(result.overlaps.length, 1)
  assert.equal(result.overlaps[0].areaPx2, 800)
  assert.equal(result.blockedControls.length, 1)
})
test('布局审计：菱形共边可解释轴对齐框相交，旧错距仍报真实重叠', () => {
  const common = { w: 211.2, h: 138.6, classes: ['fm-plot'], hit: true }
  const before = audit([node({ x: 100, y: 100, ...common }), node({ x: 205.6, y: 157.6, ...common })])
  assert.ok(before.overlaps[0].areaPx2 > 100)
  const after = audit([node({ x: 100, y: 100, ...common }), node({ x: 205.6, y: 169.3, ...common })])
  assert.equal(after.overlaps.length, 0)
  assert.ok(after.exceptions.some(e => e.reason.includes('菱形轴对齐框')))
})
test('布局审计：小字体、文字溢出和过小命中区会报错', () => {
  const small = node({ w: 20, h: 20, text: '太小', css: { fontSize: '9px' } })
  small.scrollWidth = 60
  const result = audit([small])
  assert.equal(result.smallText.length, 1)
  assert.equal(result.smallTargets.length, 1)
  assert.equal(result.clippedText.length, 1)
})
test('布局审计：没有可点内容的空页面不能产出假通过', () => {
  assert.ok(audit([]).pageErrors.length > 0)
})

test('布局审计：中心仍可点击的按钮伸出窗口也必须报错', () => {
  const result = audit([node({ x: 1170, w: 40 })])
  assert.equal(result.blockedControls.length, 0)
  assert.equal(result.overflowingElements.length, 1)
})

test('布局审计：商店页签短标签折成两行必须报错', () => {
  const tab = node({ classes: ['fm-tab'] })
  const label = node({ tag: 'SPAN', text: '工具' })
  label.parentElement = tab
  label.getClientRects = () => [{}, {}]
  const result = audit([tab, label])
  assert.equal(result.wrappedLabels.length, 1)
})

test('布局审计：位于文字前方的关闭按钮遮住文字必须报错', () => {
  const text = node({ x: 10, y: 10, tag: 'SPAN', text: '菜币 50000' })
  const close = node({ x: 30, y: 10, css: { zIndex: '2' } })
  const result = audit([text, close])
  assert.equal(result.occludedText.length, 1)
  assert.equal(result.occludedText[0].areaPx2, 800)
})

test('布局审计：大场景的宿主绿色边距不能算铺满', () => {
  const scene = node({ tag: 'DIV', classes: ['fm', 'fm-big'], x: 24, y: 24, w: 1152, h: 752 })
  const result = audit([scene, node({ x: 60 })])
  assert.ok(result.pageErrors.some(error => error.reason === '大场景未铺满窗口'))
  assert.equal(result.pageErrors.find(error => error.reason)?.gapsPx.left, 24)
})

test('布局审计8.8：fill压扁图片失败，contain保持原比通过', () => {
  const graphic = node({ tag: 'IMG', w: 100, h: 30, css: { objectFit: 'fill' } })
  Object.assign(graphic, { naturalWidth: 100, naturalHeight: 100, complete: true })
  const before = audit([graphic, node({ x: 200 })])
  assert.equal(before.stretchedImages?.length, 1)
  assert.equal(before.stretchedImages[0].distortionPercent, 233.33333333333334)
  graphic.css.objectFit = 'contain'
  assert.equal(audit([graphic, node({ x: 200 })]).stretchedImages.length, 0)
})

test('布局审计8.9：按素材内边线抓贴边文字，不能用框外边界假通过', () => {
  const frame = node({ tag: 'DIV', w: 200, h: 200, css: { borderImageSource: 'url("fixture-panel.webp")',
    borderTopWidth: '12px', borderRightWidth: '12px', borderBottomWidth: '12px', borderLeftWidth: '12px' } })
  const label = node({ tag: 'SPAN', text: '仓库', x: 16, y: 20, w: 24, h: 24 })
  label.parentElement = frame
  const catalog = { 'fixture-panel.webp': { size: [200, 200], nine_slice: { insets: [20, 20, 20, 20] }, inner_insets: [20, 20, 20, 20] } }
  const result = audit([frame, label, node({ x: 300 })], {}, buildAuditExpression(catalog))
  assert.equal(result.framePaddingViolations?.length, 1)
  assert.equal(result.framePaddingViolations[0].gaps.left, 4)
  assert.equal(result.stretchedImages.length, 0)
  delete catalog['fixture-panel.webp'].inner_insets
  assert.ok(audit([frame, label, node({ x: 300 })], {}, buildAuditExpression(catalog)).unknownAssetGeometry.some(error => error.reason?.includes('inner_insets')))
})

test('九宫格被CSS清空不能冒充通过；非对称切片按小数像素一致缩放', () => {
  const erased = node({ tag: 'DIV', classes: ['fm-framed-art'], css: { borderImageSource: 'none' } })
  assert.ok(audit([erased]).unknownAssetGeometry.some(e => e.reason?.includes('未实际绘制')))
  const frame = node({ tag: 'DIV', css: { borderImageSource: 'url("fixture.webp")', borderTopWidth: '5px', borderRightWidth: '8px', borderBottomWidth: '5px', borderLeftWidth: '8px', borderImageWidth: '4.875px 8px' } })
  const catalog = { 'fixture.webp': { size: [287, 80], nine_slice: { insets: [39, 64, 39, 64] } } }
  assert.equal(audit([frame], {}, buildAuditExpression(catalog)).stretchedImages.length, 0)
  frame.css.borderImageWidth = '4px 8px'
  assert.equal(audit([frame], {}, buildAuditExpression(catalog)).stretchedImages.length, 1)
})

test('有数值却透明的进度条不能通过，填充宽度必须对应数值', () => {
  const track = node({ tag: 'DIV', classes: ['fm-card-progress'], w: 40 })
  const fill = node({ tag: 'I', w: 20, css: { backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none' } })
  fill.style = { width: '50%' }; fill.parentElement = track; track.firstElementChild = fill
  assert.ok(audit([track, fill, node({ x: 300 })]).pageErrors.some(e => e.includes('没有绘制填充')))
  fill.css.backgroundColor = 'rgb(0, 128, 0)'
  assert.equal(audit([track, fill, node({ x: 300 })]).problemCount, 0)
  fill.getBoundingClientRect = () => ({ x: 0, y: 0, width: 30, height: 40, left: 0, top: 0, right: 30, bottom: 40 })
  assert.ok(audit([track, fill, node({ x: 300 })]).driftedAttachments.some(e => e.reason.includes('填充宽度')))
})

test('布局审计：上色子元素被祖先圆角溢出裁掉一角必须报 cornerClip', () => {
  const card = node({ tag: 'DIV', x: 0, y: 0, w: 200, h: 200,
    css: { overflowX: 'hidden', overflowY: 'hidden', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', borderBottomRightRadius: '20px', borderBottomLeftRadius: '20px' } })
  const fill = node({ tag: 'DIV', x: 0, y: 0, w: 200, h: 200, css: { backgroundColor: 'rgb(40, 80, 60)' } })
  fill.parentElement = card
  const result = audit([card, fill, node({ x: 300 })])
  assert.equal(result.cornerClip.length, 1)
  assert.ok(result.cornerClip[0].cuts.length >= 1)
  assert.equal(result.cornerClip[0].cuts[0].clipper, 'div.')
})

test('布局审计：圆角收窄到半宽后不再误报（圆形关闭按钮）', () => {
  const card = node({ tag: 'DIV', x: 0, y: 0, w: 200, h: 200,
    css: { overflowX: 'hidden', overflowY: 'hidden', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', borderBottomRightRadius: '20px', borderBottomLeftRadius: '20px' } })
  const round = node({ tag: 'DIV', x: 0, y: 0, w: 40, h: 40, css: { backgroundColor: 'rgb(40, 80, 60)', borderTopLeftRadius: '50px', borderTopRightRadius: '50px', borderBottomRightRadius: '50px', borderBottomLeftRadius: '50px' } })
  round.parentElement = card
  assert.equal(audit([card, round, node({ x: 300 })]).cornerClip.length, 0)
})

test('布局审计：纯色底牌上的文字墨迹戳出可用区必须报错', () => {
  const plate = node({ tag: 'DIV', x: 0, y: 0, w: 100, h: 34,
    css: { backgroundColor: 'rgb(247, 243, 223)', paddingLeft: '4px', paddingRight: '4px', paddingTop: '4px', paddingBottom: '4px', borderLeftWidth: '0px', borderRightWidth: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' } })
  const label = node({ tag: 'SPAN', x: 6, y: 6, w: 120, h: 16, text: '缺胡萝卜种子' })
  label.parentElement = plate
  plate.children = [label]
  const result = audit([plate, label, node({ x: 300 })])
  assert.ok(result.clippedText.some(e => e.reason?.includes('底牌可用区')))
  assert.equal(result.clippedText.find(e => e.reason?.includes('底牌可用区')).overhangPx, 30)
})

test('布局审计：纯色底牌也按内边距门槛查，不能因为没素材名就跳过', () => {
  const plate = node({ tag: 'DIV', x: 0, y: 0, w: 100, h: 34,
    css: { backgroundColor: 'rgb(247, 243, 223)', paddingLeft: '4px', paddingRight: '4px', paddingTop: '4px', paddingBottom: '4px', borderLeftWidth: '0px', borderRightWidth: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' } })
  const label = node({ tag: 'SPAN', x: 6, y: 6, w: 120, h: 16, text: '缺胡萝卜种子' })
  label.parentElement = plate
  plate.children = [label]
  const violation = audit([plate, label, node({ x: 300 })]).framePaddingViolations.find(e => e.solid)
  assert.ok(violation)
  assert.equal(violation.minimum, 6)
  assert.ok(violation.gaps.right < -0.5)
})

test('布局审计：不同 z-index 的误叠放按“谁真在上面”报重叠', () => {
  const chip = node({ x: 0, y: 0, w: 80, h: 30, classes: ['fm-chip'], css: { zIndex: '6', backgroundColor: 'rgb(246, 189, 110)' } })
  const plot = node({ x: 40, y: 0, w: 100, h: 100, classes: ['fm-plot'], hit: true, css: { zIndex: 'auto', backgroundColor: 'rgb(90, 60, 30)' } })
  const result = audit([chip, plot])
  assert.equal(result.overlaps.length, 1)
  assert.equal(result.overlaps[0].onTop, 'b')
})

test('布局审计：不同 z-index 但上层是透明命中层时不报重叠', () => {
  const plot = node({ x: 0, y: 0, w: 100, h: 100, classes: ['fm-plot'], hit: true, css: { zIndex: 'auto' } })
  const chip = node({ x: 0, y: 0, w: 80, h: 30, classes: ['fm-chip'], css: { zIndex: '6' } })
  const result = audit([plot, chip])
  assert.equal(result.overlaps.length, 0)
  assert.ok(result.exceptions.some(e => e.reason?.includes('透明')))
})

test('布局审计：中心能点到但大部分面积被盖住要按占比报错', () => {
  const cover = node({ tag: 'DIV', x: 0, y: 0, w: 100, h: 100 })
  const control = node({ x: 0, y: 0, w: 100, h: 100 })
  const result = audit([control], { elementFromPoint: (x, y) => (y > 60 ? cover : control) })
  assert.equal(result.blockedControls.length, 1)
  assert.ok(result.blockedControls[0].blockedRatio >= .3)
})

test('布局审计：视口外的操作项能被任一滚动祖先滚进来时给豁免而不是报点不到', () => {
  const panel = node({ tag: 'DIV', x: 0, y: 0, w: 300, h: 800, css: { overflowY: 'auto' } })
  panel.clientHeight = 700; panel.scrollHeight = 1000
  const popup = node({ tag: 'DIV', x: 15, y: 700, w: 254, h: 160, css: { overflowY: 'auto' } })
  popup.clientHeight = 160; popup.scrollHeight = 400
  popup.parentElement = panel
  const tab = node({ x: 120, y: 790, w: 80, h: 34 })
  tab.parentElement = popup
  const result = audit([panel, popup, tab], { elementFromPoint: (x, y) => (y > 800 ? null : tab) })
  assert.equal(result.blockedControls.length, 0)
  assert.ok(result.exceptions.some(e => e.reason?.includes('滚动')))
})
