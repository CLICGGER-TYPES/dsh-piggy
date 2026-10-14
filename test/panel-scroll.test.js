// 面板重绘保留具名内部滚动区域，防止买东西时按钮每次轮询都跳回裁切位置。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'

const source = readFileSync(new URL('../src/client/panel.js', import.meta.url), 'utf8')
const renderSource = source.slice(source.indexOf('function renderContent()'), source.indexOf('function paintContent()'))
function layer(key, top, left = 0) { return { getAttribute: () => key, scrollTop: top, scrollLeft: left } }

test('面板重绘保留购买框、商店列表和包袱横向滚动；不串到不同页签', () => {
  let nodes = [layer('farm-dialog:radish', 31), layer('farm-shop:seed', 90), layer('farm-stock:seeds', 0, 44)]
  const ctx = { content: { scrollTop: 10, querySelectorAll: () => nodes }, justBought: 'radish' }
  const paintContent = () => { nodes = [layer('farm-dialog:radish', 0), layer('farm-shop:tool', 0), layer('farm-stock:seeds', 0)] }
  // renderContent 顶部会问 renderHold 要不要挂起重绘（合并 main 的轮询丢点击修复后新增）；
  // 这里只验滚动保留，给它一个「不挂起」的桩。
  const render = runInNewContext('(' + renderSource + ')', { ctx, paintContent, renderHold: { defer: () => false } })
  render()
  assert.equal(nodes[0].scrollTop, 31)
  assert.equal(nodes[1].scrollTop, 0)
  assert.equal(nodes[2].scrollLeft, 44)
  assert.equal(ctx.content.scrollTop, 10)
})
