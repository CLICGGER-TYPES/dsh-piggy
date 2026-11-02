// @ts-check
/** 猪窗口 BrowserWindow 的唯一所有者，隔离重建时旧窗口迟到的生命周期事件。 */

/**
 * 创建猪窗口；bounds、shape、drag 和 flight 均由主进程组合根计算与应用。
 * @param {{ BrowserWindow: new (options:any)=>any }} deps
 */
export function createPetWindow(deps) {
  let current = null

  /**
   * @param {{
   *   options:any,
   *   url:string,
   *   configure?:(window:any)=>void,
   *   afterLoad?:(window:any)=>void,
   *   onClosed?:(window:any)=>void,
   *   onReadyToShow?:(window:any,event:any)=>void,
   *   onDidFinishLoad?:(window:any,event:any)=>void,
   *   onDidFailLoad?:(window:any,...args:any[])=>void,
   *   onRendererGone?:(window:any,event:any,details:any)=>void,
   * }} input
   */
  function create(input) {
    const window = new deps.BrowserWindow(input.options)
    current = window
    input.configure?.(window)
    window.once('closed', () => {
      if (current !== window) return
      current = null
      input.onClosed?.(window)
    })
    window.loadURL(input.url)
    window.once('ready-to-show', event => {
      if (current === window) input.onReadyToShow?.(window, event)
    })
    window.webContents.on('did-finish-load', event => {
      if (current === window) input.onDidFinishLoad?.(window, event)
    })
    window.webContents.on('did-fail-load', (...args) => {
      if (current === window) input.onDidFailLoad?.(window, ...args)
    })
    window.webContents.on('render-process-gone', (event, details) => {
      if (current === window) input.onRendererGone?.(window, event, details)
    })
    input.afterLoad?.(window)
    return window
  }

  function destroy(window = current) {
    if (window === null || window === undefined) return
    if (current === window) current = null
    if (!window.isDestroyed()) window.destroy()
  }

  return { current: () => current, create, destroy }
}
