/**
 * 面板窗口的卡片高度：主进程给的 maxHeight 是「这一侧能放多高」，窗口实际可能更矮。
 * 高内容扩展（左轮/菜园）在面板里时，卡片不能按理论高度排，否则顶部返回键被裁到窗口外。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.document = { querySelector: () => null }
globalThis.requestAnimationFrame = () => 0
const { fitPanelWindow } = await import('../../../src/client/desktop/panel-window.js')

function mount(innerHeight, options = {}) {
  globalThis.window = { innerHeight }
  const host = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value } }
  const card = { style: {} }
  const hud = options.hud === null ? null : { hidden: false, offsetHeight: options.hud ?? 35 }
  fitPanelWindow({ host, card, hud })
  return { host, card }
}

test('卡片高度按实际窗口收口，不超出视口', () => {
  const { host, card } = mount(420)
  assert.equal(host.attrs['data-panel-vertical'], 'above')
  assert.equal(card.style.maxHeight, '379px', '420 窗口减去 35 名牌和 6px 间距，再留出顶部空间')
})

test('窗口比锚定上限高时仍按锚定上限', () => {
  const { card } = mount(800)
  assert.equal(card.style.maxHeight, '479px', '520 上限减 35 名牌和 6px 间距')
})

test('没有名牌时整段窗口都能用，且不低于最小高度', () => {
  assert.equal(mount(420, { hud: null }).card.style.maxHeight, '420px')
  assert.equal(mount(80).card.style.maxHeight, '120px')
})
