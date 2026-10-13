// @ts-check
// 有九宫格元数据的可变文字框按角/边铺绘；图标和种子插画始终保持完整原比。
/** @param {HTMLElement} node @param {any} info */
export function applyAssetFrame(node, info) {
  const slices = info?.nine_slice?.insets
  if (!Array.isArray(slices) || slices.length !== 4 || !slices.every(value => Number.isFinite(value) && value > 0)) return
  if (node.matches('.fm-slot,.fm-packet,.fm-exp,.fm-card-progress') || node.parentElement?.matches('.fm-exp,.fm-card-progress')) return
  node.classList.add('fm-framed-art')
  const scale = Math.min(.5, 8 / Math.max(...slices))
  node.style.borderWidth = slices.map(value => Math.ceil(value * scale) + 'px').join(' ')
  node.style.borderImageWidth = slices.map(value => value * scale + 'px').join(' ')
  node.style.borderImageSource = node.style.backgroundImage
  node.style.borderImageSlice = slices.join(' ') + ' fill'
  node.style.borderImageRepeat = info.nine_slice.edge_mode === 'round' ? 'round' : 'repeat'
  node.style.backgroundImage = 'none'
}

/** 共用弹层框：布局由扩展负责，材质切片与真实原图地址由宿主提供。
 * @param {HTMLElement} node @param {any} info @param {string} url */
export function applyModalAssetFrame(node, info, url) {
  const slices = info?.nine_slice?.insets
  if (!Array.isArray(slices) || slices.length !== 4 || !slices.every(value => Number.isFinite(value) && value > 0)) return node
  node.style.borderImageSource = 'url("' + url + '")'
  node.style.borderImageSlice = slices.join(' ') + ' fill'
  node.style.borderImageRepeat = info.nine_slice.edge_mode === 'round' ? 'round' : 'repeat'
  return node
}
