// 材料九宫格必须保留四角；没有切片元数据的图标不改变绘制方式。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyAssetFrame } from '../src/client/asset-background.js'

function graphic(kind = '') {
  return { style: { backgroundImage: 'url("/asset.webp")' },
    classList: { add(value) { this.value = value }, value: '' },
    matches(selector) { return selector.split(',').includes(kind) }, parentElement: null }
}
test('有有效manifest inset的文字框用repeat九宫格，图标保持contain', () => {
  const node = graphic()
  applyAssetFrame(node, { nine_slice: { insets: [16, 16, 16, 16] } })
  assert.equal(node.style.borderImageSource, 'url("/asset.webp")')
  assert.equal(node.style.borderImageSlice, '16 16 16 16 fill')
  assert.equal(node.style.borderImageRepeat, 'repeat')
  assert.equal(node.style.backgroundImage, 'none')
  for (const kind of ['.fm-slot', '.fm-packet', '.fm-exp', '.fm-card-progress']) {
    const icon = graphic(kind)
    applyAssetFrame(icon, { nine_slice: { insets: [16, 16, 16, 16] } })
    assert.equal(icon.style.backgroundImage, 'url("/asset.webp")')
  }
})
test('无效或缺失切片数据不生成失真的边框', () => {
  for (const insets of [null, [], [1, 2], [1, 2, 3, NaN], ['x', 2, 3, 4]]) {
    const node = graphic()
    applyAssetFrame(node, { nine_slice: { insets } })
    assert.equal(node.style.backgroundImage, 'url("/asset.webp")')
    assert.equal(node.style.borderImageSource, undefined)
  }
})

test('非对称切片角保持同一缩放系数，round材料保留完整周期', () => {
  const node = graphic()
  applyAssetFrame(node, { nine_slice: { insets: [39, 64, 39, 64], edge_mode: 'round' } })
  assert.equal(node.style.borderImageWidth, '4.875px 8px 4.875px 8px')
  assert.equal(node.style.borderImageRepeat, 'round')
})
