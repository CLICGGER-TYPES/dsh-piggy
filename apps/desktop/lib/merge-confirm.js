// @ts-check
/** DSH 内嵌猪合并确认：内容由桌面端自己算，窗口隐藏时先显示窗口。 */

/**
 * @param {{ dialog: any, getPetWindow: () => any, log: (...parts: any[]) => any }} deps
 */
export function createMergeConfirm(deps) {
  function planLine(label, summary) {
    if (summary === null || summary === undefined) return ''
    return `${label}：${summary.name ?? ''} · Lv.${summary.level ?? '?'} · 金币 ${summary.coins ?? 0}\n`
  }

  /** @param {any} plan */
  async function confirmMerge(plan) {
    try {
      if (deps.getPetWindow() === null || deps.getPetWindow().isDestroyed()) return false
      if (!deps.getPetWindow().isVisible()) deps.getPetWindow().show()
      deps.getPetWindow().focus()
      const result = typeof plan?.target === 'object'
        ? `合并前会分别备份两只猪。合并后内嵌猪会退役，不再长大。`
        : '合并前会分别备份两只猪。'
      const answer = await deps.dialog.showMessageBox(deps.getPetWindow(), {
        type: 'question', buttons: ['取消', '允许合并'], defaultId: 0, cancelId: 0, noLink: true,
        title: 'DSH 想把内嵌猪合并到这只猪',
        message: 'DSH 想把内嵌猪合并到这只猪',
        detail: `${planLine('桌宠', plan?.target)}${planLine('内嵌', plan?.source)}${planLine('合并后', plan?.result)}\n${result}`,
      })
      return answer.response === 1
    } catch (error) {
      deps.log('merge confirm failed', String(error))
      return false
    }
  }

  return { confirmMerge }
}
