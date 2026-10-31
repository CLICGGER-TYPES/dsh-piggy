// @ts-check
/**
 * 托盘图标和菜单：单击叫猪出来/藏起来，右键菜单负责恢复、开机自启、从 DSH 导入、版本和退出。
 * 只做装配；窗口、自启存储和其它动作由主进程传进来。
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

async function readVersion(gameDir) {
  try { return JSON.parse(await readFile(join(gameDir, 'package.json'), 'utf8')).version } catch { return '?' }
}

/**
 * @param {{
 *   Tray: any,
 *   Menu: any,
 *   nativeImage: any,
 *   icon: string,
 *   pig: { visible: () => boolean, hide: () => void, show: () => void },
 *   autostart: {
 *     enabled: () => boolean|null,
 *     set: (on: boolean) => Promise<any>,
 *     refresh: () => Promise<boolean|null>,
 *   },
 *   recoverPig: () => void,
 *   importFromDsh: () => Promise<any>,
 *   quit: () => void,
 *   log: (...parts: any[]) => any,
 *   isQuitting: () => boolean,
 * }} options
 */
export function createDesktopTray(options) {
  let tray = null
  let version = '?'

  const togglePig = () => { if (options.pig.visible()) options.pig.hide(); else options.pig.show() }

  const menu = () => {
    const autostartEnabled = options.autostart.enabled()
    return options.Menu.buildFromTemplate([
      { label: options.pig.visible() ? '藏起来' : '叫猪出来', click: () => { togglePig(); tray?.setContextMenu(menu()) } },
      { label: '恢复小猪', click: () => { options.recoverPig(); tray?.setContextMenu(menu()) } },
      { label: '开机自启', type: 'checkbox', checked: autostartEnabled === true, enabled: autostartEnabled !== null,
        click: item => { void options.autostart.set(item.checked).then(() => tray?.setContextMenu(menu())) } },
      { label: '从 DSH 导入猪…', click: () => { void options.importFromDsh().catch(error => options.log('import failed', String(error))) } },
      { type: 'separator' },
      { label: `游戏版本 ${version}`, enabled: false },
      { label: '退出', click: () => options.quit() },
    ])
  }

  async function create(gameDir) {
    version = await readVersion(gameDir)
    await options.autostart.refresh()
    if (options.isQuitting()) return
    const icon = options.nativeImage.createFromPath(options.icon)
    tray = new options.Tray(icon.isEmpty() ? options.nativeImage.createEmpty() : icon)
    tray.setToolTip('dsh-piggy')
    // Windows：单击托盘图标叫猪出来 / 藏起来（右键是菜单）
    tray.on('click', togglePig)
    tray.setContextMenu(menu())
  }

  return { create }
}
