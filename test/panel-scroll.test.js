// 面板重绘保留具名内部滚动区域，防止买东西时按钮每次轮询都跳回裁切位置。
// 并且：没人滚过的时候一步都不写——写 scrollTop 会为刚重建的 DOM 强制一次同步布局。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'

const source = readFileSync(new URL('../src/client/panel.js', import.meta.url), 'utf8')
const renderSource = source.slice(source.indexOf('function renderContent()'), source.indexOf('function paintContent()'))
function layer(key, top, left = 0) { return { getAttribute: () => key, scrollTop: top, scrollLeft: left } }

test('面板重绘保留购买框、商店列表和种子袋横向滚动；不串到不同页签', () => {
  let nodes = [layer('farm-dialog:radish', 31), layer('farm-shop:seed', 90), layer('farm-stock:seeds', 0, 44)]
  const ctx = { content: { scrollTop: 10, querySelectorAll: () => nodes }, justBought: 'radish' }
  const paintContent = () => { nodes = [layer('farm-dialog:radish', 0), layer('farm-shop:tool', 0), layer('farm-stock:seeds', 0)] }
  // renderContent 顶部会问 renderHold 要不要挂起重绘（合并 main 的轮询丢点击修复后新增）；
  // 这里只验滚动保留，给它一个「不挂起」的桩；renderContent 尾部会调 restoreHover 补悬停态，也给个桩。
  const render = runInNewContext('(' + renderSource + ')', { ctx, paintContent, renderHold: { defer: () => false }, restoreHover: () => false })
  render()
  assert.equal(nodes[0].scrollTop, 31)
  assert.equal(nodes[1].scrollTop, 0)
  assert.equal(nodes[2].scrollLeft, 44)
  assert.equal(ctx.content.scrollTop, 10)
})

test('没滚过就不写 scrollTop：写一下就是一次同步布局', () => {
  const writes = []
  const content = {
    _top: 0,
    get scrollTop() { return this._top },
    set scrollTop(value) { writes.push(value); this._top = value },
    querySelectorAll: () => [layer('farm-shop:seed', 0), layer('farm-stock:seeds', 0, 0)],
  }
  const ctx = { content, justBought: null }
  const paintContent = () => {}
  const render = runInNewContext('(' + renderSource + ')', { ctx, paintContent, renderHold: { defer: () => false }, restoreHover: () => false })
  render()
  assert.deepEqual(writes, [], '没人滚过就一步都不写')
})
