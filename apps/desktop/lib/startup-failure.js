// @ts-check
/**
 * 启动失败时给用户看的话（../main.js）。
 *
 * 以前 whenReady().catch 只写 piggy.log 就退出：窗口还没开出来时，用户看到的就是
 * 「双击没反应」。这里把同一件事同时写进日志并弹一个原生错误框，框里带日志路径。
 * 纯函数 / 可注入 dialog，测试直接跑；不猜启动失败的原因。
 * @module dsh-piggy-desktop/startup-failure
 */

/** 把异常说成一行给对话框看的文字（不代替日志里的堆栈）。 */
function reasonOf(error) {
  if (error instanceof Error && typeof error.message === 'string' && error.message !== '') return error.message
  return String(error)
}

/**
 * 页面进程在窗口显示前就退出时给对话框看的说明。
 * reason/exitCode 是 Electron render-process-gone 的原文，方便对着文档排查。
 * @param {{ reason?: string, exitCode?: number }} [details]
 */
export function pageCrashReason(details) {
  const reason = typeof details?.reason === 'string' && details.reason !== '' ? details.reason : 'unknown'
  const code = Number.isFinite(details?.exitCode) ? `，退出码 ${details?.exitCode}` : ''
  return `游戏页面进程在窗口显示前退出了（${reason}${code}）`
}

/**
 * @param {{ error: unknown, logPath: string, version: string, platform: string, recoveredVersion?: string|null }} options
 */
export function startupFailureDialog({ error, logPath, version, platform, recoveredVersion = null }) {
  return {
    type: 'error',
    title: recoveredVersion === null ? 'dsh-piggy 没能启动' : 'dsh-piggy 正在恢复旧版本',
    message: recoveredVersion === null ? '启动时出错了，猪没能出来。'
      : `更新后的游戏版本没能启动，已恢复到 ${recoveredVersion}，关闭提示后会重新启动。`,
    detail: `${reasonOf(error)}\n\n日志：${logPath}\n版本：${version} · ${platform}`,
    buttons: ['关闭'],
    noLink: true,
  }
}

/**
 * 写日志并弹框。弹框本身失败（无显示器等）时只记日志，不让诊断把退出流程卡死。
 * @param {{ dialog: { showMessageBoxSync: (options: any) => any }, log: (...parts: any[]) => void,
 *   error: unknown, logPath: string, version: string, platform: string, recoveredVersion?: string|null }} options
 */
export async function reportStartupFailure({ dialog, log, error, logPath, version, platform, recoveredVersion = null }) {
  // Wait for the asynchronous journal before a modal dialog blocks the loop.
  await log('startup failed', error instanceof Error && error.stack ? error.stack : String(error))
  const options = startupFailureDialog({ error, logPath, version, platform, recoveredVersion })
  try {
    dialog.showMessageBoxSync(options)
    await log('startup failure shown', JSON.stringify({ dialog: 'shown' }))
  } catch (dialogError) {
    await log('startup failure dialog failed', String(dialogError))
  }
  return options
}
