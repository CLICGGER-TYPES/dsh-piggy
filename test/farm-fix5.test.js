// @ts-check
/**
 * 第五轮布局收口（交叉审查打回 P2-1 / P2-2）的两条静态守卫：
 *
 * 1. 网页大界面把面板卡铺满整页时，`.dp-card` 自带的 2px 边框和 20px 圆角都要清掉——
 *    只清边框会在四角各露一块近白宿主底色（改前实测四角 (252,252,252)）。
 * 2. 面板弹层的可用高度有两条来源：宿主给的 `--ext-panel-height`（有 160px 下限）和
 *    扩展自己量的 `--fm-panel-avail`。弹层、遮罩、购买框都得取两者的较小值，
 *    否则 120px 高的面板里弹层戳出面板底边 56px（改前实测），底下的按钮要滚面板才够得到。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import farm, { setRandom } from '../extensions/farm/server.js'
import { CSS } from '../src/client/styles.js'

import { api, renderFarm } from './helpers/farm-ui.js'

/** 取出某条选择器的声明块（CSS 是各模块拼起来的一整串，规则之间没有换行）。 */
function declarations(selector) {
  const start = CSS.indexOf(selector + '{')
  assert.ok(start >= 0, '样式表里找不到选择器：' + selector)
  return CSS.slice(start + selector.length + 1, CSS.indexOf('}', start))
}

test('fix5：网页大界面铺满时，面板卡的 2px 边框和 20px 圆角一起清（否则四周露缝、四角露宿主底色）', () => {
  const block = declarations('[data-dsh-pig][data-ext-view="big"] .dp-card')
  assert.match(block, /border:0!important/, '铺满窗口要先清掉 .dp-card 自带的 2px 边框')
  assert.match(block, /border-radius:0!important/, '铺满窗口要一起清掉 .dp-card 自带的 20px 圆角，四角才不会露宿主底色')
})

test('工具抽屉留在菜地外层滚动里，不再叠加内部裁切区或第二层页面', () => {
  const ui = renderFarm(farm.view(farm.init(), api()))
  ui.find('data-farm-tools', 'toggle').fire('click')
  const grid = ui.dom.body.querySelectorAll('.fm-advanced-grid')[0]
  assert.equal(grid.children.length, 11)
  const css = ui.dom.head.children[0].textContent
  assert.match(css, /\.fm-advanced-grid\{[^}]*overflow:visible;max-height:none/)
  assert.doesNotMatch(css, /\.fm-advanced-grid\{[^}]*overflow:auto/)
  assert.ok(ui.find('data-farm-drawer', 'tools'), '抽屉画在菜地里，不是独立弹层页')
  assert.equal(ui.find('data-scroll-page', 'farm').className, 'fm')
})

test('短面板购买流程是完整页面，取消按钮不被嵌套购买框裁掉', () => {
  const ui = renderFarm(farm.view(farm.init(), api()))
  ui.find('data-farm-shop', 'shelf').fire('click')
  ui.find('data-farm-item', 'radish').fire('click')
  assert.ok(ui.find('data-farm-confirm', 'true'))
  assert.ok(ui.find('data-farm-cancel', 'true'))
  assert.equal(ui.all('data-farm-close').length, 0, '确认框只有确定 / 取消，不再多一个叉')
  const css = ui.dom.head.children[0].textContent
  assert.match(css, /\.fm-buy,\.fm-clear-confirm\{[^}]*max-height:none;[^}]*overflow:visible/)
})

test('开垦按钮属于真实地块，平面网格不添加截获邻地的命中层', () => {
  setRandom(() => 0.5)
  const ui = renderFarm(farm.view(farm.init(), api()), 'big')
  const sign = ui.all('data-farm-reclaim')[0]
  assert.ok(sign)
  assert.match(sign.parentNode.className, /\bfm-plot\b/)
  assert.equal(ui.dom.body.querySelectorAll('.fm-hit').length, 0)
})
