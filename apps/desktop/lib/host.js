// @ts-check
/** 桌面宿主只装配游戏运行时，不模拟 DSH 的服务上下文。 */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function startHost(gameDir, statePath, options = {}) {
  const { createGameRuntime } = await import(pathToFileURL(join(gameDir, 'runtime/index.js')).href)
  const { environmentNote } = await import(pathToFileURL(join(gameDir, 'environment.js')).href)
  const runtime = createGameRuntime({ ...options, statePath, journalHeader: environmentNote({
    运行形态: '桌面版', 存档路径: statePath, Node: process.version,
    ...(typeof process.versions.electron === 'string' ? { Electron: process.versions.electron } : {}),
  }) })
  return { ...runtime, store: { journal: { record: runtime.record } } }
}
