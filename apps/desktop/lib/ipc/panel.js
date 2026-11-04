// @ts-check
/** 面板窗口的 IPC：开关、尺寸、收起，以及面板/猪气泡反应。 */

/**
 * @param {{
 *   ipcMain: { on: (channel: string, listener: (...args: any[]) => any) => any },
 *   fromPage: (event: any) => boolean,
 *   getPanelWindow: () => any,
 *   extensionWindow: any,
 *   panel: any,
 * }} deps
 */
export function registerPanelIpc(deps) {
  deps.ipcMain.on('piggy:panel:toggle', (event, request) => deps.panel.toggle(event, request))
  /** 面板页面：内容量好了多大。 */
  deps.ipcMain.on('piggy:panel:size', (event, size) => {
    if (!deps.fromPage(event) || event.sender !== deps.getPanelWindow()?.webContents) return
    deps.panel.setSize(size)
  })
  /** 任一页面：收起面板（面板里点了收起、点外面自动收起）。 */
  deps.ipcMain.on('piggy:panel:close', event => { if (deps.fromPage(event)) deps.panel.close('page') })
  /** 面板页面里对猪的反应（喂食时猪的动作、冒气泡）：转给面板当前服务的那只猪窗口去演。 */
  // 猪窗口自己冒气泡（签到、点猪的反应）时也抬一次，跟面板转来的反应一样（用户 2026-10-10：气泡被面板盖住）。
  deps.ipcMain.on('piggy:pet-raise', event => {
    const pet = deps.panel.targetPet()
    if (!deps.fromPage(event) || pet === null || event.sender !== pet.window?.webContents) return
    deps.panel.raisePetAbovePanel()
  })
  deps.ipcMain.on('piggy:pig-fx', (event, fx) => {
    if (!deps.fromPage(event) || (event.sender !== deps.getPanelWindow()?.webContents && !deps.extensionWindow.owns(event.sender))) return
    const pet = deps.panel.targetPet()
    if (pet === null || pet.window === null || pet.window.isDestroyed() || typeof fx?.name !== 'string') return
    pet.window.webContents.send('piggy:pig-fx', { name: fx.name, args: Array.isArray(fx.args) ? fx.args : [] })
    deps.panel.raisePetAbovePanel()
  })
}
