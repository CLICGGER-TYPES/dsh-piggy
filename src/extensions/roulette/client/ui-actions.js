// @ts-check
/** 面板上的小开关：离开确认、AI 重试、右上角入口和设置条展开。 */
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
    toggleMenu() {
      ui.menu = !ui.menu
      rerender()
    },
    closeMenu() {
      if (!ui.menu) return
      ui.menu = false
      rerender()
    },
    toggleSettings() {
      ui.settingsOpen = !ui.settingsOpen
      rerender()
    },
  }
}
