// @ts-check
/**
 * 面板开关去抖：niri 关闭面板后光标下面露出猪，同一次右键/松手可能再落到猪身上，
 * 把面板又打开。350ms 内同一次由猪页关闭后的重新打开视为同一击。
 */
export function createPanelToggleGuard(options = {}) {
  const now = options.now ?? Date.now
  const windowMs = Number.isFinite(options.windowMs) ? Number(options.windowMs) : 350
  const log = options.log ?? (() => {})
  /** @type {{ at: number, pet: any }} */
  let lastClose = { at: 0, pet: null }

  return {
    /** 猪页自己关掉面板时记一笔。 */
    closed(pet) {
      lastClose = { at: now(), pet }
    },
    /** 同一次关闭后的重新打开返回 true。 */
    ignoreOpen(pet) {
      if (lastClose.pet !== pet || lastClose.at <= 0 || now() - lastClose.at >= windowMs) return false
      log('panel open ignored after same-click close', JSON.stringify({ age: now() - lastClose.at, pigId: pet?.pigId ?? null }))
      lastClose = { at: 0, pet: null }
      return true
    },
    reset() { lastClose = { at: 0, pet: null } },
  }
}
