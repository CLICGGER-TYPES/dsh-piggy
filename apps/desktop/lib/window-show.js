// @ts-check
/**
 * 窗口什么时候显示。
 *
 * Linux 上“先按兜底尺寸显示、再 resize 到真实内容尺寸”会让共享 rootless Xwayland
 * 在第一次 `xwl_window_swap_pixmap()` 里把新尺寸的 damage 复制进旧尺寸的 wl_shm
 * 缓冲，越界读写落在 pixman_blt 里，整个 X 服务 SIGSEGV（2026-10-18，
 * 证据见 tasks/results/linux-pixman/REPORT.md）。
 *
 * 所以 Linux 等页面第一次报上来真实内容（此时 setBounds 和 setShape 都已经做完）
 * 再显示；其它平台照旧在 ready-to-show 显示。页面一直不报内容时超时兜底显示，
 * 不能永远不出现。
 */

/** 页面一直不报内容时，ready-to-show 之后等这么久就兜底显示。 */
export const SHOW_FALLBACK_MS = 2000

/**
 * @param {{platform?: string, timeoutMs?: number, now?: () => number}} [options]
 */
export function createShowGate({ platform, timeoutMs = SHOW_FALLBACK_MS, now = () => Date.now() } = {}) {
  const defer = platform === 'linux'
  let ready = false
  let contentReady = false
  let shown = false
  let deadline = null

  function claim() {
    if (shown) return false
    shown = true
    return true
  }

  return {
    /** ready-to-show 到了：非 Linux 立刻显示；Linux 等第一次 content。 */
    readyToShow(at = now()) {
      ready = true
      deadline = at + timeoutMs
      if (!defer) return claim()
      return contentReady ? claim() : false
    },
    /** 页面报了第一份内容（窗口几何和形状都已设好）：可以显示了。 */
    content() {
      contentReady = true
      if (!ready) return false
      return claim()
    },
    /** 页面一直没报内容：超时后仍然显示。 */
    timeout(at = now()) {
      if (!ready || shown || deadline === null || at < deadline) return false
      return claim()
    },
    /** 还没显示。 */
    get pending() {
      return !shown
    },
    /**
     * 诊断用快照：显示门现在在等哪一步（只读，不改显示状态）。
     * main.js 在页面加载完、显示兜底、渲染进程退出时把它写进启动日志。
     */
    status(at = now()) {
      let waiting = null
      if (!shown) {
        if (!ready) waiting = 'ready-to-show'
        else if (defer && !contentReady) waiting = deadline !== null && at >= deadline ? 'timeout-fallback' : 'content'
      }
      return { ready, content: contentReady, shown, pending: !shown, deferred: defer, deadline, waiting }
    },
  }
}
