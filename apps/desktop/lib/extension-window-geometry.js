// @ts-check
/** 扩展窗口的内容尺寸与最小尺寸都必须留在当前显示器工作区内。 */
/** @param {{width:number,height:number}} area */
export function extensionWindowGeometry(area) {
  const width = Math.max(1, Math.min(1200, Math.round(area.width * 0.9)))
  const height = Math.max(1, Math.min(800, Math.round(area.height * 0.9), Math.round(width * 2 / 3)))
  return { width, height, minWidth: Math.min(720, width), minHeight: Math.min(480, height) }
}
