// @ts-check
/** 面板上的两个瞬时开关：取消离开确认、重试 AI 行动。 */
export function createUiActions({ ui, rerender }) {
  return {
    cancelLeave() {
      ui.leaveConfirm = false
      rerender()
    },
    retryAi() {
      ui.aiKey = ''
      ui.aiError = false
      rerender()
    },
  }
}
