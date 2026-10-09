// 第一次启动下载游戏的小窗口（first-run.js）只用这两个口子。
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('piggyFirstRun', {
  /** 主进程报进度：{ state: 'downloading'|'done'|'error', fraction?, version?, message? } */
  onStatus: callback => { ipcRenderer.on('piggy:first-run', (event, status) => callback(status)) },
  /** 'retry' | 'page' | 'quit' */
  act: action => ipcRenderer.send('piggy:first-run-act', String(action)),
  /** 内容的高度（CSS 像素），窗口按它调大小。 */
  fit: height => ipcRenderer.send('piggy:first-run-act', Number(height)),
})
