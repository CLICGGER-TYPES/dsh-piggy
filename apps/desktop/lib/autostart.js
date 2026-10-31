// @ts-check
/**
 * 开机自启：Windows 交给 Electron 的登录项，Linux 写 ~/.config/autostart/dsh-piggy.desktop。
 * 写入串行；设备状态不可读时记 null，不据此显示为已开启，也不盲目覆盖。
 */
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Linux 的开机自启条目（Electron 在 Windows 上自己处理）。 */
export const AUTOSTART_FILE = join(homedir(), '.config', 'autostart', 'dsh-piggy.desktop')

/**
 * @param {{
 *   app: any,
 *   platform?: string,
 *   file?: string,
 *   log: (...parts: any[]) => any,
 *   isQuitting: () => boolean,
 * }} options
 */
export function createAutostart({ app, platform = process.platform, file = AUTOSTART_FILE, log, isQuitting }) {
  /** @type {boolean|null} null 表示设备状态不可读，不据此显示为已开启或尝试写入。 */
  let enabled = false
  let writing = Promise.resolve()

  async function read() {
    if (platform !== 'linux') return app.getLoginItemSettings().openAtLogin
    try { await access(file); return true } catch (error) {
      if (error?.code === 'ENOENT') return false
      log('autostart read failed', String(error))
      return null
    }
  }

  function set(on) {
    if (isQuitting() || enabled === null) return writing
    writing = writing.then(async () => {
      if (platform !== 'linux') app.setLoginItemSettings({ openAtLogin: on })
      else if (!on) await rm(file, { force: true })
      else {
        const exec = process.env.APPIMAGE ?? process.execPath
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file + '.tmp', `[Desktop Entry]\nType=Application\nName=dsh-piggy\nExec="${exec}"\nX-GNOME-Autostart-enabled=true\n`)
        await rename(file + '.tmp', file)
      }
      enabled = on
    }).catch(error => log('autostart save failed', String(error)))
    return writing
  }

  async function refresh() {
    enabled = await read()
    return enabled
  }

  return { refresh, set, flush: () => writing, enabled: () => enabled }
}
