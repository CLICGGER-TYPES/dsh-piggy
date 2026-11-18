// @ts-check
/**
 * AI 回合自动行动。宿主 busy/断网时 app.send 会回 null 或 ok:false，
 * 按 900/1200/1800/2500ms 重试；全失败就停手，由牌桌给“重试”按钮，
 * 不能把状态永久卡在 stage=ai。
 */

const AI_DELAYS = [900, 1200, 1800, 2500]

/**
 * @param {{
 *   ui: any,
 *   later: (fn: () => void, ms: number) => any,
 *   send: (op: string) => any,
 *   rerender: () => void,
 * }} deps
 */
export function createAiRunner(deps) {
  const { ui, later, send, rerender } = deps

  function schedule(key, attempt) {
    const index = Math.min(attempt ?? 0, AI_DELAYS.length - 1)
    later(function () {
      if (ui.aiKey !== key) return
      const result = send('ai')
      function failed() {
        if (ui.aiKey !== key) return
        if ((attempt ?? 0) < AI_DELAYS.length - 1) {
          schedule(key, (attempt ?? 0) + 1)
          return
        }
        ui.aiError = true
        rerender()
      }
      if (result && typeof result.then === 'function') {
        result.then(function (next) {
          if (!next || next.ok === false) failed()
          else rerender()
        }, failed)
      } else {
        rerender()
      }
    }, AI_DELAYS[index])
  }

  return { schedule }
}
