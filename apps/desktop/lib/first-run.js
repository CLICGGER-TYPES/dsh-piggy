// @ts-check
/**
 * 不带游戏的安装包（Gitee 的 Windows 包，2026-10-09 起）第一次启动：先弹个小窗口下载配套的游戏包，
 * 装好再开猪。下载失败就说原因，给「重试 / 打开下载页 / 退出」。
 * 安装包里只有 resources/game-pin.json（scripts/write-game-pin.mjs 写的版本、校验值、下载地址）。
 * @module dsh-piggy-desktop/first-run
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BrowserWindow, ipcMain, shell } from 'electron'

import { friendlyError } from './first-run-errors.js'

/** 安装包里那份游戏清单；开发时可以用 PIGGY_GAME_PIN 指一份来测。 */
export function gamePinPath(app, here) {
  return process.env.PIGGY_GAME_PIN || join(app.isPackaged ? process.resourcesPath : here, 'game-pin.json')
}

/**
 * @param {{ versions: any, pinPath: string, here: string, releasesPage: string, log: (...parts: any[]) => void }} c
 * @returns {Promise<BrowserWindow|null>} 装好了返回下载窗口（等猪窗口开出来再关，免得「最后一个窗口关了」直接退出）；用户退出返回 null
 */
export function downloadFirstGame(c) {
  let pin = null
  try { pin = JSON.parse(readFileSync(c.pinPath, 'utf8')) } catch { /* 下面报「清单坏了」 */ }
  const boot = new BrowserWindow({
    width: 380, height: 230, useContentSize: true, resizable: false, maximizable: false, fullscreenable: false, title: 'dsh-piggy',
    icon: join(c.here, 'build', 'icon.png'), backgroundColor: '#f8f8f0',
    webPreferences: { preload: join(c.here, 'first-run-preload.cjs'), contextIsolation: true, sandbox: true },
  })
  boot.setMenu(null)
  const send = status => { if (!boot.isDestroyed()) boot.webContents.send('piggy:first-run', status) }
  return new Promise(resolve => {
    let settled = false
    let busy = false
    const finish = value => {
      if (settled) return
      settled = true
      ipcMain.removeListener('piggy:first-run-act', onAct)
      resolve(value)
    }
    const attempt = async () => {
      if (busy || settled) return
      busy = true
      send({ state: 'downloading', fraction: 0, version: pin?.version ?? '' })
      try {
        if (pin === null) throw new Error('安装包里的游戏清单坏了，请重新下载安装包')
        await c.versions.installPinned(pin, fraction => send({ state: 'downloading', fraction, version: pin.version }))
        c.log('first-run', 'installed', pin.version)
        send({ state: 'done', version: pin.version })
        finish(boot)
      } catch (error) {
        c.log('first-run', 'failed', error?.message ?? String(error))
        send({ state: 'error', message: friendlyError(error?.message ?? String(error)) })
      } finally { busy = false }
    }
    function onAct(event, action) {
      if (event.sender !== boot.webContents) return
      // 页面量出内容多高，窗口跟着调（Win11 125% 下固定高度装不下，三个按钮被挤到滚动条下面）。
      if (typeof action === 'number') {
        if (Number.isFinite(action) && action > 0) boot.setContentSize(380, Math.min(480, Math.ceil(action)))
        return
      }
      if (action === 'retry') attempt()
      else if (action === 'page') shell.openExternal(c.releasesPage)
      else if (action === 'quit') { finish(null); boot.destroy() }
    }
    ipcMain.on('piggy:first-run-act', onAct)
    boot.on('closed', () => finish(null))
    boot.loadFile(join(c.here, 'renderer', 'first-run.html')).then(attempt, error => {
      c.log('first-run', 'page failed', error?.message ?? String(error))
      attempt()
    })
  })
}
