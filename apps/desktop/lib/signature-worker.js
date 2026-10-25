// @ts-check
/** 沿用依赖原有证书判断；其中的同步 PowerShell 异常探测只占用本次短生命周期 Worker。 */
import { parentPort, workerData } from 'node:worker_threads'

// package-lock 固定的 electron-updater 6.7.3 内部入口；升级依赖时需显式复核此路径和契约。
import { verifySignature } from 'electron-updater/out/windowsExecutableCodeSignatureVerifier.js'

const log = (level, message) => parentPort.postMessage({ kind: 'log', level, message })

try {
  const value = await verifySignature(workerData.publisherNames, workerData.tempPath, {
    info: message => log('info', message),
    warn: message => log('warn', message),
    error: message => log('error', message),
  })
  parentPort.postMessage({ kind: 'result', value })
} catch (error) {
  parentPort.postMessage({ kind: 'error', error: error instanceof Error ? error : new Error(String(error)) })
} finally {
  parentPort.close()
}
