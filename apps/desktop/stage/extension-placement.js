// @ts-check
/**
 * 舞台扩展大窗口的位置（纯函数）：在光标所在显示器的 workArea 里显式居中。
 *
 * 这里收到的 workArea 已经是 DIP，不再乘 scaleFactor；负原点和混合缩放都由
 * Electron 按 DIP 直接给。窗口用 useContentSize: true 时，构造参数 width/height
 * 是网页内容尺寸，x/y 却是外框左上角；标题栏/边框的实际厚度由平台主题决定，
 * 不能在模块里写死 16x39。所以 x/y 可以先按内容尺寸给一个名义位置，窗口建好后
 * 必须再按它自己的 getBounds()（真实外框）居中一次，且只改位置、不改尺寸。
 * split 主进程暂时仍用 Electron 的 center: true；本模块只服务 stage/main.js。
 */
import { extensionWindowGeometry } from '../lib/extension-window-geometry.js'

const NO_FRAME = Object.freeze({ width: 0, height: 0 })
const round = value => Math.round(Number(value) || 0)

/**
 * 扩展大窗口在目标工作区里的显式 x/y（DIP）。
 * @param {{x:number,y:number,width:number,height:number}} area 目标显示器工作区，已经是 DIP
 * @param {{width:number,height:number}} [content] 不传就用 extensionWindowGeometry(area) 的尺寸
 * @param {{width?:number,height?:number}} [frame] 仅显式测试用；生产路径用真实 getBounds
 * @returns {{x:number,y:number}}
 */
export function extensionWindowPlacement(area, content, frame = NO_FRAME) {
  const size = content ?? extensionWindowGeometry(area)
  const width = Math.max(1, round(size.width))
  const height = Math.max(1, round(size.height))
  const frameWidth = Math.max(0, round(frame?.width))
  const frameHeight = Math.max(0, round(frame?.height))
  const areaX = round(area.x)
  const areaY = round(area.y)
  const areaWidth = Math.max(1, round(area.width))
  const areaHeight = Math.max(1, round(area.height))
  // 外框比工作区还大时贴住左上；正常尺寸下外框完整落在工作区里。只定位，不改 width/height。
  const outerWidth = Math.min(areaWidth, width + frameWidth)
  const outerHeight = Math.min(areaHeight, height + frameHeight)
  return {
    x: areaX + Math.round((areaWidth - outerWidth) / 2),
    y: areaY + Math.round((areaHeight - outerHeight) / 2),
  }
}

/**
 * 窗口构造后、显示/导航前，用窗口自己的真实外框大小再居中一次。
 * @param {{getBounds:()=>{x:number,y:number,width:number,height:number}, setPosition:(x:number,y:number)=>void}} win
 * @param {{x:number,y:number,width:number,height:number}} area
 * @returns {{x:number,y:number}|null}
 */
export function centerExtensionWindow(win, area) {
  if (win === null || typeof win?.getBounds !== 'function' || typeof win?.setPosition !== 'function') return null
  let bounds = null
  try { bounds = win.getBounds() } catch { return null }
  if (bounds === null || typeof bounds !== 'object') return null
  const at = extensionWindowPlacement(area, bounds, NO_FRAME)
  win.setPosition(at.x, at.y)
  return at
}
