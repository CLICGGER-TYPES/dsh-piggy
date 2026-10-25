// @ts-check
/**
 * 舞台启动失败可见性与第二次启动（和默认 split 外壳的启动诊断对齐）。
 *
 * split（../main.js）在 whenReady 失败、首次主框架加载失败、窗口显示前首次 renderer
 * 崩溃时，先把原始错误写进日志，再弹一次原生错误框，最后走自己的退出清理。舞台以前
 * 只有「一行日志 + app.exit(1)」：打包版没有控制台，用户看到的是「双击没反应」，
 * 而且 app.exit 会跳过 host.dispose（存档没结清）。
 *
 * 三类失败共用一个一次性闸门：谁先发生谁负责报告；报告还在等日志/弹框时，后来的事件
 * 等同一份报告，不会抢先 quit。之后的事件只记日志。不强制显示
 * 窗口、不加任意超时；ready 之前弹框沿用 launcher-startup.js 已修好的做法——用
 * showErrorBox，绝不在 ESM 入口里等 ready（showMessageBoxSync 会等，等就是死锁）。
 * @module dsh-piggy-desktop/stage/startup-lifecycle
 */
import { pageCrashReason, reportStartupFailure } from '../lib/startup-failure.js'
import { appendJournal, appendJournalSync, journalLine } from '../lib/startup-journal.js'

/**
 * 舞台日志串行写入与 flush。写入失败只返回 false，但 flush 会记住失败，不把后面的成功当成整条日志链成功。
 * @param {{ logPath: () => string, capture?: () => boolean, append?: typeof appendJournal }} deps
 */
export function createStageJournal({ logPath, capture = () => Boolean(process.env.PIGGY_CAPTURE), append = appendJournal }) {
  let writing = Promise.resolve(true)
  let failure = null
  function log(...parts) {
    const line = journalLine(parts)
    if (capture()) process.stdout.write(line)
    const next = writing.then(() => append(logPath(), line))
    writing = next.catch(error => { failure ??= error; return false }).then(wrote => {
      if (wrote !== true) failure ??= new Error(`stage 日志写入失败：${logPath()}`)
      return wrote === true
    })
    return writing
  }
  async function flush() {
    let current
    do { current = writing; await current } while (current !== writing)
    return failure === null
  }
  return { log, flush }
}

/**
 * 舞台退出：cleanup（含全屏 stop/flush、宿主保存）-> 代理 flush -> 日志 flush。
 * 返回的 saved 来自宿主 dispose，供安装/重启的保存门禁判断；没有宿主时视为无需保存。
 * @param {{
 *   app: any, cleanup: { dispose: () => Promise<any> }, log: (...parts:any[]) => any,
 *   flushLogs: () => Promise<boolean>, getProxy: () => any, getHost: () => any,
 *   getHostSaved: () => boolean, setQuitting: (value:boolean) => void,
 * }} deps
 */
export function createStageQuit(deps) {
  let closing = null
  let allowQuit = false
  function prepare() {
    if (closing !== null) return closing
    deps.setQuitting(true)
    closing = (async () => {
      let result
      try { result = await deps.cleanup.dispose() } catch (error) { deps.log('cleanup failed', String(error)); result = { ok: false } }
      try { await deps.getProxy()?.flush?.() } catch (error) { deps.log('proxy flush failed', String(error)) }
      const saved = deps.getHost() === null ? true : deps.getHostSaved() === true
      const summary = { ...result, saved }
      deps.log('cleanup done', JSON.stringify(summary))
      await deps.flushLogs()
      return summary
    })()
    return closing
  }
  function request(reason) {
    deps.log('quit requested', reason)
    void prepare().finally(() => { allowQuit = true; deps.app.quit() })
  }
  function watchBeforeQuit() {
    deps.app.on('before-quit', event => {
      if (allowQuit) return
      event.preventDefault()
      void prepare().finally(() => { allowQuit = true; deps.app.quit() })
    })
  }
  return { prepare, request, watchBeforeQuit }
}

/**
 * ready 之前只碰 Electron 允许的原生 API；ready 之后照常用带按钮的错误框。
 * @param {{ showMessageBoxSync?: (options:any) => any, showErrorBox?: (title:string, content:string) => void }} dialog
 * @param {() => boolean} isReady
 */
export function startupFailurePresenter(dialog, isReady) {
  return {
    showMessageBoxSync(options) {
      if (isReady() !== false) return dialog.showMessageBoxSync?.(options)
      dialog.showErrorBox?.(options.title, `${options.message}\n\n${options.detail}`)
      return undefined
    },
  }
}

/**
 * 第二次启动要不要把舞台叫回来。全屏探测主动藏起来、正在退出、已经可见都不动。
 * @param {{ alive?: boolean, visible?: boolean, quitting?: boolean, fullscreenHidden?: boolean }} state
 */
export function shouldShowSecondInstance(state) {
  return state.alive === true && state.visible !== true && state.quitting !== true && state.fullscreenHidden !== true
}

/**
 * @param {{
 *   app: any,
 *   dialog: any,
 *   log: (...parts:any[]) => any,
 *   logPath: () => string,
 *   getWindow: () => any,
 *   isQuitting: () => boolean,
 *   quit: (reason:string) => void,
 *   platform: string,
 * }} deps
 */
export function createStageStartup(deps) {
  let reported = false
  let reportInFlight = null
  let reportFinished = false
  let everShown = false
  let fullscreenHidden = false

  function stageWindow() {
    const win = deps.getWindow()
    return win !== null && win !== undefined && win.isDestroyed?.() !== true ? win : null
  }

  function isVisible() {
    const win = stageWindow()
    return win !== null && win.isVisible() === true
  }

  /**
   * isVisible() 只是「此刻可见」：正常运行的舞台被全屏看片或托盘藏起来后也是 false。
   * 首次启动失败只能看「有没有成功显示过」，所以 ready-to-show 通过时用 markShown() 记下来。
   */
  function wasShown() {
    return everShown || isVisible()
  }

  function reportOnce(error, reason) {
    // 报告正在进行：后来者等同一份报告，不能先 quit（那会把 host/window 从日志/弹框下面抽走）。
    if (reportFinished) return Promise.resolve(false)
    if (reportInFlight !== null) return reportInFlight
    if (deps.isQuitting()) return Promise.resolve(false)
    reported = true
    const version = typeof deps.app.getVersion === 'function' ? deps.app.getVersion() : 'unknown'
    // 先返回 promise 再开始跑：同步日志回调里再冒事件时也拿得到同一份 in-flight 报告。
    reportInFlight = Promise.resolve().then(async () => {
      try {
        await reportStartupFailure({
          dialog: startupFailurePresenter(deps.dialog, () => deps.app.isReady?.() === true),
          log: deps.log, error, logPath: deps.logPath(), version, platform: deps.platform,
        })
      } catch (reportError) {
        deps.log('startup failure report failed', String(reportError))
      } finally {
        reportFinished = true
        // 报告已经落盘并弹过：走外壳自己的退出清理（host.dispose），不用 app.exit 跳过保存。
        if (!deps.isQuitting()) deps.quit(reason)
      }
      return true
    })
    return reportInFlight
  }

  /** 第一次主框架加载失败；窗口已经显示过就只记日志，运行中不弹框。 */
  function pageFailed(details) {
    if (details?.mainFrame !== true) return Promise.resolve(false)
    if (!reportFinished && reportInFlight !== null) return reportInFlight
    if (wasShown()) return Promise.resolve(false)
    return reportOnce(new Error(`游戏页面加载失败：${details.errorDescription}（${details.errorCode}）`), 'page-failed')
  }

  /** 首次启动崩溃：窗口没显示过才报告；显示过交给 attach 的运行期崩溃路径。 */
  function rendererGone(details) {
    if (!reportFinished && reportInFlight !== null) return reportInFlight
    if (wasShown()) return Promise.resolve(false)
    return reportOnce(new Error(pageCrashReason(details)), 'renderer-gone')
  }

  return {
    get reported() { return reported },

    /** whenReady() 拒绝：不看窗口状态，必须让用户看见。 */
    startupFailed(error) { return reportOnce(error, 'startup-failed') },

    /**
     * ready-to-show 的闸门：失败报告已经开跑或正在退出就不再显示（否则错误框下面会冒出空舞台）。
     * 通过后由调用方 showInactive()，再用 markShown() 记下「成功显示过」。
     */
    readyToShow() { return !reported && !deps.isQuitting() },

    markShown() { everShown = true },

    pageFailed,
    rendererGone,

    /**
     * 第一扇窗的页面事件：先记原文（含地址/失败码、崩溃原因、此刻可见和是否显示过），
     * 再按显示状态决定要不要报告。渲染进程没了就退出，免得透明整屏窗口留在桌面上。
     */
    attach(webContents) {
      webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        deps.log('page failed', JSON.stringify({ errorCode, errorDescription, url: validatedURL, mainFrame: isMainFrame }))
        void pageFailed({ errorCode, errorDescription, mainFrame: isMainFrame })
      })
      webContents.on('render-process-gone', (event, details) => {
        deps.log('renderer gone', JSON.stringify(details), JSON.stringify({ visible: isVisible(), shown: wasShown() }))
        void rendererGone(details).then(reportedCrash => {
          if (!reportedCrash && !deps.isQuitting()) deps.quit('renderer-gone')
        })
      })
    },

    /** 第二次双击：日志写清第一扇窗的状态；全屏看片时被藏起来的舞台不强行叫回来。 */
    watchSecondInstance() {
      deps.app.on('second-instance', () => {
        const win = stageWindow()
        const visible = win !== null && win.isVisible() === true
        const quitting = deps.isQuitting()
        deps.log('second instance', JSON.stringify({ pid: process.pid, window: win !== null, visible,
          minimized: win !== null && win.isMinimized?.() === true, quitting, fullscreenHidden }))
        if (shouldShowSecondInstance({ alive: win !== null, visible, quitting, fullscreenHidden })) win.showInactive()
      })
    },

    /** 全屏探测的 onHide/onShow 各调一次；第二次启动据此判断该不该显示。 */
    markFullscreenHidden(hidden) { fullscreenHidden = hidden === true },

    /**
     * 第二个进程拿不到单实例锁：第一个进程可能还没 ready、second-instance 行不一定
     * 写得出来，所以同步留一行再让调用方退出（和 split 的 piggy.log 同一格式）。
     */
    acquireSingleInstance() {
      if (deps.app.requestSingleInstanceLock()) return true
      const version = typeof deps.app.getVersion === 'function' ? deps.app.getVersion() : 'unknown'
      appendJournalSync(deps.logPath(), journalLine(['second launch rejected', JSON.stringify({ pid: process.pid, version })]))
      return false
    },
  }
}
