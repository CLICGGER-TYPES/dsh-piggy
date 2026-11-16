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
   *   title?: string,
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
    // 稳定标题是 niri 认窗口的锚点：页面 <title> 不能把它改掉。
    if (typeof input.title === 'string' && input.title !== '' && typeof window.setTitle === 'function') {
      const title = input.title
      window.setTitle(title)
      window.on?.('page-title-updated', event => {
        event.preventDefault?.()
        if (typeof window.getTitle !== 'function' || window.getTitle() !== title) window.setTitle(title)
      })
    }
    input.configure?.(window)
    window.once('closed', () => {
      if (current !== window) return
      current = null
      input.onClosed?.(window)
    })
    // 先挂 ready-to-show 再加载：piggy:// 页面可能命中缓存，晚挂会错过首次绘制事件，
    // Linux 上窗口就一直停在 show:false（屏幕不显示、renderer 的 screenX 也一直是 0）。
    window.once('ready-to-show', event => {
      if (current === window) input.onReadyToShow?.(window, event)
    })
    window.loadURL(input.url)
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
