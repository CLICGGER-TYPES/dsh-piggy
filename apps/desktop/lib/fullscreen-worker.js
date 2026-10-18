// @ts-check
/** 只管理 Windows 全屏探测子进程，不加载游戏宿主或设备偏好。 */
import { parentPort, workerData } from 'node:worker_threads'
import { createWindowsProbe } from './fullscreen.js'

if (!parentPort) throw new Error('fullscreen probe requires a parent port')
const port = parentPort
const probe = createWindowsProbe({
  selfPid: workerData.selfPid,
  pigHwnd: workerData.pigHwnd,
  onProbe: value => port.postMessage({ kind: 'probe', value }),
  onStatus: value => port.postMessage({ kind: 'status', value }),
  log: (...parts) => port.postMessage({ kind: 'log', parts }),
})

port.on('message', async message => {
  if (message.kind !== 'stop') return
  try {
    await probe.stop()
    port.close()
  } catch (error) {
    port.postMessage({ kind: 'stop-error', error: error instanceof Error ? error.message : String(error) })
  }
})
probe.start()
