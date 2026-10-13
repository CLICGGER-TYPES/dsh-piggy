// @ts-check
// 大扩展获得焦点期间统一让出置顶层；反应消息和置顶守卫也必须遵守同一个判断。
/** @param {{extension:()=>any, overlays:()=>any[]}} options */
export function createExtensionLayer(options) {
  function isFocused() {
    const extension = options.extension()
    return Boolean(extension && !extension.isDestroyed() && extension.isVisible()
      && !extension.isMinimized() && extension.isFocused())
  }
  function sync() {
    const shouldTop = !isFocused()
    for (const target of options.overlays()) {
      if (!target || target.isDestroyed()) continue
      if (target.isAlwaysOnTop() !== shouldTop) target.setAlwaysOnTop(shouldTop, 'floating')
    }
    // Linux 取消置顶只改变标记，原堆叠顺序仍在；同一次切换最后把正在操作的大窗口抬上来。
    if (!shouldTop) options.extension().moveTop()
  }
  return { isFocused, sync }
}
