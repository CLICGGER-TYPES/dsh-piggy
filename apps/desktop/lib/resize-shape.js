// @ts-check
/** Linux 的 shape 同时裁剪绘制；尺寸变化后等新尺寸画面提交，才恢复精确轮廓。 */
export function createResizeShape(getWindow, applyShape, getScaleFactor = () => 1) {
  let pending = null
  let subscribed = null

  function cancel() {
    if (subscribed && !subscribed.isDestroyed()) subscribed.endFrameSubscription()
    subscribed = null
    pending = null
  }

  function begin(bounds, force = false) {
    const win = getWindow()
    if (!win || win.isDestroyed() || !win.isVisible()) return
    const old = win.getBounds()
    if (!force && old.width === bounds.width && old.height === bounds.height) {
      // WM 拒绝过目标尺寸、页面接受实际尺寸后，不再等待一个永远不会出现的画面。
      if (pending && (pending.width !== bounds.width || pending.height !== bounds.height)) cancel()
      return
    }
    cancel()
    const contents = win.webContents
    if (typeof contents.beginFrameSubscription !== 'function') return
    const ticket = { width: bounds.width, height: bounds.height, shape: null }
    pending = ticket
    // 旧缓冲画面在换尺寸的一拍里仍可能显示，不能先用新轮廓把它切碎。
    applyShape([{x: 0, y: 0, width: Math.max(old.width, bounds.width), height: Math.max(old.height, bounds.height)}])
    subscribed = contents
    contents.beginFrameSubscription(image => {
      if (pending !== ticket || subscribed !== contents || win.isDestroyed()) return
      const size = image.getSize()
      // Electron 44.5 的帧图片仍以 1x 图片封装物理像素；新版可能附带图片倍率。
      // 先还原物理像素，再按当前显示器倍率换回窗口 DIP，避免 200% 时一直订阅。
      const imageScale = image.getScaleFactors?.()[0] ?? 1
      const displayScale = getScaleFactor()
      const width = Math.round(size.width * imageScale / displayScale)
      const height = Math.round(size.height * imageScale / displayScale)
      if (width !== pending.width || height !== pending.height || pending.shape === null) return
      const shape = pending.shape
      cancel()
      applyShape(shape)
    })
  }

  function update(shape) {
    if (pending) pending.shape = shape
    else applyShape(shape)
  }

  return { begin, update, cancel }
}
