// @ts-check
/**
 * launcher.js 选完入口、`import` 入口本身失败时的诊断。
 *
 * 这条路以前什么都没有：main.js 的 whenReady().catch 还没挂上，打包版又没有控制台，
 * 用户看到的就是「双击没反应」，piggy.log 里也没有任何一行。
 * 这里沿用 lib/startup-failure.js 的文案和启动日志格式：先把原始错误（带堆栈）落进
 * userData/piggy.log，再弹一次原生对话框，最后以 1 退出。不猜失败原因。
 *
 * electron 只在失败路径上动态加载：launcher 正常启动仍然不 import electron。
 * @module dsh-piggy-desktop/launcher-startup
 */
import { join } from 'node:path'

import { appendJournal, journalLine } from './startup-journal.js'
import { reportStartupFailure } from './startup-failure.js'

/**
 * 报告入口 import 失败。日志写不进去时把同一行打到 stderr，错误不消失。
 * @param {{ error?: unknown, loadElectron?: () => Promise<any>,
 *   stderr?: (text: string) => void, exit?: (code: number) => void }} options
 * @returns {Promise<{ dialog: boolean }>}
 */
export async function reportLauncherFailure({ error, loadElectron = () => import('electron'),
  stderr = text => { try { process.stderr.write(text) } catch { /* 没有 stderr 就算了 */ } },
  exit } = {}) {
  /** @type {any} */
  let electron = null
  try { electron = await loadElectron() } catch { /* 连 electron 都加载不了：只能走 stderr */ }
  const app = electron?.app ?? null
  const dialog = electron?.dialog ?? null

  /** userData 决定原启动日志在哪；不知道就不乱写文件。 */
  let userData = null
  let version = 'unknown'
  try { if (typeof app?.getPath === 'function') userData = app.getPath('userData') } catch { userData = null }
  try { if (typeof app?.getVersion === 'function') version = app.getVersion() } catch { /* 版本读不到就写 unknown */ }
  const known = typeof userData === 'string' && userData !== ''
  const logPath = known ? join(userData, 'piggy.log') : 'piggy.log'
  const platform = typeof process !== 'undefined' && typeof process.platform === 'string' ? process.platform : 'unknown'

  const log = async (...parts) => {
    const line = journalLine(parts)
    const written = known ? await appendJournal(logPath, line) : false
    // 原日志写不进去时至少留在 stderr，不能让这条错误消失。
    if (!written) stderr(line)
    return written
  }

  let shown = false
  if (dialog !== null && typeof dialog?.showMessageBoxSync === 'function') {
    // reportStartupFailure 先 await 这一行，再弹框：错误先落盘。
    await reportStartupFailure({
      dialog: { showMessageBoxSync: options => {
        // Entry imports can fail before ready; do not await ready from an ESM entry.
        const early = typeof app?.isReady === 'function' && !app.isReady()
        const value = early && typeof dialog.showErrorBox === 'function'
          ? dialog.showErrorBox(options.title, options.message + '\n\n' + options.detail)
          : dialog.showMessageBoxSync(options)
        shown = true
        return value
      } },
      log, error, logPath, version, platform,
    })
  } else {
    await log('startup failed (launcher)', error instanceof Error && error.stack ? error.stack : String(error))
  }

  if (typeof exit === 'function') exit(1)
  else if (typeof app?.exit === 'function') app.exit(1)
  else process.exitCode = 1
  return { dialog: shown }
}
