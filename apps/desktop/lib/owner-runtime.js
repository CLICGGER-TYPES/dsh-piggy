// @ts-check
/** 游戏包是否声明 owner 能力、启动失败提示，以及跨进运行时前要剥掉的本地选择元数据。 */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Only this explicit marker permits the current game package to receive an OwnerDocument path. */
export async function hasOwnerArchiveRuntime(gameDir) {
  try {
    const runtime = await import(pathToFileURL(join(gameDir, 'runtime/index.js')).href)
    return runtime.OWNER_ARCHIVE_RUNTIME_API_VERSION === 1
  } catch { return false }
}

/** Only this explicit capability enables panel-local pig target management. */
export async function hasOwnerPigRuntime(gameDir) {
  try {
    const runtime = await import(pathToFileURL(join(gameDir, 'runtime/index.js')).href)
    return runtime.OWNER_PIG_RUNTIME_API_VERSION === 1
  } catch { return false }
}

/** Owner cloud transport uses complete owner archives and an explicit first-sync direction. */
export async function hasOwnerCloudRuntime(gameDir) {
  try {
    const runtime = await import(pathToFileURL(join(gameDir, 'runtime/index.js')).href)
    return runtime.OWNER_CLOUD_RUNTIME_API_VERSION === 1
  } catch { return false }
}

/** owner 私有 LAN 会话必须由面板显式启用。 */
export async function hasOwnerLanRuntime(gameDir) {
  try {
    const runtime = await import(pathToFileURL(join(gameDir, 'runtime/index.js')).href)
    return runtime.OWNER_LAN_RUNTIME_API_VERSION === 1
  } catch { return false }
}

/** Strip local selection metadata before crossing into the game runtime. */
export function runtimeOwnerConfig(config) {
  if (config === null) return null
  return {
    ownerDocumentPath: config.ownerDocumentPath,
    ...(typeof config.legacyStatePath === 'string' ? { legacyStatePath: config.legacyStatePath } : {}),
    ...(typeof config.ownerId === 'string' ? { ownerId: config.ownerId } : {}),
    pigId: config.pigId,
  }
}

/** Roll a pending owner switch back only after the attempted runtime has stopped writing. */
export async function notifyOwnerArchiveSwitchFailed(dialog) {
  await dialog.showMessageBox({
    type: 'info',
    title: '没有切换存档',
    message: '新存档副本没有启用。之前的存档选择已恢复，新副本仍保留在本机。',
    detail: '应用将重新启动；你可以稍后重试。',
  })
}
