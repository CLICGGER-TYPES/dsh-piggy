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

import { CSS } from '../src/client/styles.js'

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

test('fix5：面板里的弹层（包袱/化肥/仓库/购买框）不许高过面板可视底边', () => {
  const css = readFileSync(new URL('../extensions/farm/client.js', import.meta.url), 'utf8')
  const clamp = 'min(var(--ext-panel-height,100%),var(--fm-panel-avail,9999px))'
  assert.match(css, new RegExp('\\.fm-s-pop\\{[^}]*max-height:' + clamp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    '.fm-s-pop（包袱/化肥/仓库弹层）的高度要取 --ext-panel-height 和 --fm-panel-avail 的较小值')
  assert.match(css, /\.fm:not\(\.fm-big\)>\.fm-mask\{[^}]*height:min\(var\(--ext-panel-height,100%\),var\(--fm-panel-avail,9999px\)\)/,
    '面板形态的遮罩（购买/铲除框底下那层）也要一起钳到面板可视高度')
  assert.match(css, /\.fm-s-pop\{[^}]*grid-template-rows:max-content max-content max-content/,
    '弹层钳短后各行要按内容排（列表行被压成 0 就再也滚不出来了），溢出的部分靠 .fm-s-pop 自己滚')
})

test('fix5：弹层装不下内容时（data-farm-tight）只留弹层一层滚动条，列表跟着长开', () => {
  const css = readFileSync(new URL('../extensions/farm/client.js', import.meta.url), 'utf8')
  assert.ok(css.includes('.fm[data-farm-tight]'), '渲染时量出弹层装不下，要给它挂上 data-farm-tight')
  assert.match(css, /\[data-farm-tight\] \.fm-s-pop:not\(\.fm-shop\)>\.fm-stock\{overflow:visible;max-height:none\}/,
    '紧凑模式下列表不再自己滚（两层滚动条会让商品只露一条缝，中心点还点不到）')
  assert.match(css, /setAttribute\('data-farm-tight'/,
    '这条属性要在 renderSmall 量完 --fm-panel-avail 后按弹层真实溢出设置，不能写死')
})
