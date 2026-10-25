// @ts-check
/** 版本缓存、JSON 解析、正常校验和游戏包落盘都由这个独立 Worker 执行。 */
import { parentPort, workerData } from 'node:worker_threads'

import { createVersions } from './versions.js'

const downloads = new Map()
let sequence = 0
let clock
let activePreparationRequest = null

function download(url, headers, destination, onBytes) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    downloads.set(id, { resolve, reject, onBytes })
    parentPort.postMessage({ kind: 'download', id, url, headers, destination, progress: Boolean(onBytes),
      preparation: onBytes ? activePreparationRequest : null })
  })
}

try {
  const versions = createVersions({ ...workerData, download, now: () => clock ?? Date.now() })
  const methods = new Set(['activeDir', 'needsGame', 'current', 'saveVersion', 'list', 'rollback', 'readPin', 'prepareInstall', 'preparePinned', 'commitInstall', 'discardPrepared', 'cancelPreparation'])
  parentPort.on('message', async message => {
    if (message.kind === 'download-result') {
      clock = message.now
      const task = downloads.get(message.id)
      if (!task) return
      downloads.delete(message.id)
      if (message.error) task.reject(new Error(message.error))
      else task.resolve(message.result)
    } else if (message.kind === 'download-progress') {
      downloads.get(message.id)?.onBytes?.(message.bytes)
    } else if (message.kind === 'request') {
      clock = message.now
      let ownsPreparation = false
      try {
        if (!methods.has(message.method)) throw new Error('未知版本管理请求')
        const args = [...message.args]
        if (message.method === 'prepareInstall' || message.method === 'preparePinned') {
          if (activePreparationRequest !== null) throw new Error('已有游戏包正在准备')
          activePreparationRequest = message.id
          ownsPreparation = true
          args.push(fraction => parentPort.postMessage({ kind: 'progress', id: message.id, fraction }))
        }
        const value = await versions[message.method](...args)
        parentPort.postMessage({ kind: 'response', id: message.id, value })
      } catch (error) {
        parentPort.postMessage({ kind: 'response', id: message.id, error: error instanceof Error ? error.message : String(error) })
      } finally {
        if (ownsPreparation) activePreparationRequest = null
      }
    }
  })
  parentPort.postMessage({ kind: 'ready' })
} catch (error) {
  parentPort.postMessage({ kind: 'startup-error', error: error instanceof Error ? error.message : String(error) })
}
