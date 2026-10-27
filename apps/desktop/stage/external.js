// @ts-check
/** 舞台的外部联动：与双窗口模式共用许可、发现和接口管理，只允许舞台页开关。 */
import { createExternalManager } from '../lib/external.js'

export async function confirmStageMerge({ dialog, getWindow, plan }) {
  const win = getWindow()
  if (win === null || win.isDestroyed()) return false
  const describe = (label, value) => `${label}：${value?.name ?? ''} · Lv.${value?.level ?? '?'} · 金币 ${value?.coins ?? 0}`
  if (!win.isVisible()) win.show()
  win.focus()
  try {
    const answer = await dialog.showMessageBox(win, {
      type: 'question', title: 'DSH 想把内嵌猪合并到这只猪', message: '允许合并这两只猪吗？',
      detail: [describe('桌宠', plan?.target), describe('内嵌', plan?.source), describe('合并后', plan?.result),
        '合并前会分别备份两只猪。合并后内嵌猪会退役，不再长大。'].join('\n'),
      buttons: ['取消', '允许合并'], defaultId: 0, cancelId: 0, noLink: true,
    })
    return answer.response === 1
  } catch { return false }
}

/** @param {{app:any, ipcMain:any, host:any, cleanup:{add:(fn:()=>Promise<void>|void)=>void}, fromStage:(event:any)=>boolean, toPages:(channel:string,value:any)=>void, log?:(message:string)=>void, homes?:string[]}} options */
export async function attachStageExternal({ app, ipcMain, host, cleanup, fromStage, toPages, log, homes }) {
  const manager = createExternalManager({ userData: app.getPath('userData'), host, appVersion: app.getVersion(), log, homes })
  const unavailable = () => ({ ok: false, enabled: false, running: false, error: 'unavailable' })
  ipcMain.handle('piggy:external:get', event => fromStage(event) ? manager.status() : unavailable())
  ipcMain.handle('piggy:external:set', async (event, enabled) => {
    if (!fromStage(event)) return unavailable()
    const result = await manager.setEnabled(enabled === true)
    toPages('piggy:external', result)
    return result
  })
  cleanup.add(async () => {
    ipcMain.removeHandler('piggy:external:get')
    ipcMain.removeHandler('piggy:external:set')
    await manager.close()
  })
  try { await manager.init() } catch { log('external manager init failed') }
  return manager
}
