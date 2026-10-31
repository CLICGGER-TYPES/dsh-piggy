import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.QAENV_CDP_PORT)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('QAENV_CDP_PORT invalid')
if (!process.env.QAENV_USER_DATA) throw new Error('QAENV_USER_DATA missing')
app.setPath('userData', process.env.QAENV_USER_DATA)
app.commandLine.appendSwitch('remote-debugging-port', String(port))
app.commandLine.appendSwitch('remote-allow-origins', '*')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('no-sandbox')

let windowRef = null
app.whenReady().then(async () => {
  windowRef = new BrowserWindow({
    x: 0,
    y: 0,
    width: 1600,
    height: 1000,
    useContentSize: true,
    frame: false,
    resizable: false,
    show: true,
    title: `QAENV fixture ${process.env.QAENV_RUN_ID || 'missing-run-id'}`,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  await windowRef.loadFile(path.join(here, 'basic.html'), { query: { runId: process.env.QAENV_RUN_ID || 'missing-run-id' } })
})
app.on('window-all-closed', () => app.quit())
