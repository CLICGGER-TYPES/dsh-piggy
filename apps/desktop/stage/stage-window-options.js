// @ts-check
/**
 * 舞台窗口的构造选项（纯函数，便于不启 Electron 直接验证平台分支）。
 *
 * Windows 必须 resizable:true 才能避开 Electron 对 resizable:false 的 DIP
 * min/max 换算；用户拖动缩放由 main.js 的 will-resize preventDefault 挡住。
 * Linux/macOS 仍是 resizable:false。页面 zoom 用 isolated 模式，扩展大窗也要
 * 先隔离，避免同 origin 的舞台 zoom 漏过去；老 Electron 没有该 API 时安全跳过。
 * @module dsh-piggy-desktop/stage/stage-window-options
 */

import { auxiliaryWindowOptions } from '../lib/auxiliary-window.js'

const ZOOM_MODE = 'isolated'

/**
 * @param {{bounds:{x:number,y:number,width:number,height:number}, platform:string, preload:string}} value
 */
export function stageWindowOptions(value) {
  return {
    ...value.bounds,
    transparent: true,
    frame: false,
    // 反了会让 Windows 不可缩放（触发 DIP min/max 夹窗）、Linux 可缩放。
    resizable: value.platform === 'win32',
    movable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    ...auxiliaryWindowOptions(value.platform),
    focusable: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: value.preload,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  }
}

/**
 * Linux construction can clamp an oversized fixed window to one monitor and
 * lock that clamped size into its min/max hints. Reapply the intended union
 * after construction, before any page geometry or native shape is measured.
 * @param {any} Window
 * @param {{bounds:{x:number,y:number,width:number,height:number}, platform:string, preload:string}} value
 */
export function createStageNativeWindow(Window, value) {
  const win = new Window(stageWindowOptions(value))
  if (value.platform === 'linux') win.setBounds(value.bounds)
  return win
}

/**
 * 只给当前 webContents 开 isolated 页面缩放。Electron 44 有 setZoomMode；
 * 宿主 43 等没有该方法的版本返回 false，调用方据此不缩放而不是漏到别的窗口。
 * @param {{setZoomMode?: (mode:string) => void}|null|undefined} contents
 */
export function enableIsolatedZoom(contents) {
  if (contents === null || contents === undefined || typeof contents.setZoomMode !== 'function') return false
  try {
    contents.setZoomMode(ZOOM_MODE)
    return true
  } catch {
    return false
  }
}
