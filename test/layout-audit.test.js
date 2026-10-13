// 布局审计的失败夹具：证明脚本确实能抓重叠、遮挡、字体、裁切与空页面，不能只产出全零报告。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { AUDIT_EXPRESSION } from '../tools/layout-audit.mjs'

function node({ x = 0, y = 0, w = 40, h = 40, tag = 'BUTTON', classes = [], text = '', css = {}, hit = false } = {}) {
  const element = { tagName: tag, classList: classes, parentElement: null, attributes: [],
    textContent: text, childNodes: text ? [{ nodeType: 3, textContent: text }] : [], clientWidth: w, clientHeight: h, scrollWidth: w, scrollHeight: h,
    css: { display: 'block', visibility: 'visible', opacity: '1', overflowX: 'visible', overflowY: 'visible', fontSize: '12px', transform: 'none', zIndex: 'auto', zoom: '1', ...css },
    getBoundingClientRect: () => ({ x, y, width: w, height: h, right: x + w, bottom: y + h }),
    getAttribute() { return null },
    matches(selector) { return selector.split(',').some(s => s.trim().startsWith('.') ? classes.includes(s.trim().slice(1)) : s.trim().toUpperCase() === tag) },
    querySelector(selector) { return hit && selector === '.fm-hit' ? {} : null },
    contains(other) { for (let p = other; p; p = p.parentElement) if (p === element) return true; return false },
    closest(selector) { for (let p = element; p; p = p.parentElement) if (p.matches(selector)) return p; return null },
  }
  return element
}
function audit(elements, overrides = {}) {
  const root = node({ w: 1200, h: 800, tag: 'DIV', classes: ['fm'] })
  elements.forEach(e => { e.parentElement ||= root })
  const document = { title: 'audit fixture', fonts: { status: 'loaded' }, querySelectorAll: () => [root, ...elements],
    elementFromPoint(x,y) { return [...elements].reverse().find(e => { const r = e.getBoundingClientRect(); return e.tagName === 'BUTTON' && x >= r.x && x <= r.right && y >= r.y && y <= r.bottom }) || root }, ...overrides }
  return runInNewContext(AUDIT_EXPRESSION, { document, location: { href: 'fixture://layout' }, innerWidth: 1200, innerHeight: 800,
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
