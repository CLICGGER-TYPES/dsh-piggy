// @ts-check
/** 把飞行平移交回固定布局，同一轮改锚边并去掉 translate，屏幕位置不变。 */
export function commitSlide(host, state, slide) {
  const x = Number(slide?.x) || 0
  const y = Number(slide?.y) || 0
  if (host !== null && (x !== 0 || y !== 0)) {
    host.style.right = ((parseFloat(host.style.right) || 0) - x) + 'px'
    host.style.bottom = ((parseFloat(host.style.bottom) || 0) - y) + 'px'
  }
  if (host !== null) host.style.translate = ''
  // 已落定的内容偏移属于当前窗口锚点，不再当作下一轮要撤回的屏幕夹取补偿。
  state.anchor = { x: state.anchor.x + state.shift.x + x, y: state.anchor.y + state.shift.y + y }
  state.shift = { x: 0, y: 0 }
  state.pinned = ''
}
