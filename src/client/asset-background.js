// @ts-check
// 有九宫格元数据的可变文字框按角/边铺绘；图标和种子插画始终保持完整原比。
/** @param {HTMLElement} node @param {any} info */
export function applyAssetFrame(node, info) {
  const slices = info?.nine_slice?.insets
  if (!Array.isArray(slices) || slices.length !== 4 || !slices.every(value => Number.isFinite(value) && value > 0)) return
  if (node.matches('.fm-slot,.fm-packet,.fm-exp,.fm-card-progress') || node.parentElement?.matches('.fm-exp,.fm-card-progress')) return
  node.classList.add('fm-framed-art')
  node.style.borderImageSource = node.style.backgroundImage
  node.style.borderImageSlice = slices.join(' ') + ' fill'
  node.style.borderImageRepeat = 'repeat'
  node.style.backgroundImage = 'none'
}
