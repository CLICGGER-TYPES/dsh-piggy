// @ts-check
/** 面板 BrowserWindow 与 renderer 就绪生命周期的唯一所有者。 */

/**
 * 创建一个面板窗口所有者；renderer 事件必须属于当前句柄才更新就绪状态。
 * @param {{
 *   BrowserWindow: new (options:any)=>any,
 *   options: any,
 *   url: string,
 *   frameCap?: number,
 *   devTools?: boolean,
 *   log: (...parts:any[])=>any,
 *   onCreated?: (window:any)=>void,
 *   onReady?: (window:any)=>void,
 *   onRendererGone?: (window:any, details:any)=>void,
 *   onBlur?: (...args:any[])=>void,
 * }} deps
 */
export function createPanelWindow(deps) {
  let current = null
  let ready = false

  function ensure() {
    if (current !== null && !current.isDestroyed()) return current
    ready = false
    const window = new deps.BrowserWindow(deps.options)
    current = window
    deps.onCreated?.(window)
    if ((deps.frameCap ?? 0) > 0) window.webContents.setFrameRate(deps.frameCap)
    window.loadURL(deps.url)
    window.webContents.on('did-finish-load', () => {
      if (current !== window) return
      ready = true
      deps.log('panel page loaded')
      deps.onReady?.(window)
    })
    window.webContents.on('console-message', (event, level, message) => {
      if (level >= 2) deps.log('panel:', message)
    })
    window.webContents.on('render-process-gone', (event, details) => {
      if (current !== window) return
      deps.log('panel renderer gone', JSON.stringify(details))
      current = null
      deps.onRendererGone?.(window, details)
    })
    window.on('blur', (...args) => { if (current === window) deps.onBlur?.(...args) })
    if (deps.devTools === true) window.webContents.openDevTools({ mode: 'detach' })
    return window
  }

  function forget(window = current) {
    if (current === window) current = null
  }

  function destroy(window = current) {
    if (window === null || window === undefined) return
    forget(window)
    if (!window.isDestroyed()) window.destroy()
  }

  return {
    current: () => current,
    isReady: () => ready,
    ensure,
    forget,
    destroy,
  }
}
