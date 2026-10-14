// @ts-check
/** 面板开关决策：区分已经显示的面板和仍在加载的打开请求。 */
/** @param {{requestedOpen: boolean, isOpen: boolean, isVisible: boolean}} state
 * @returns {'open'|'close'|'keep-open'} */
export function panelToggleAction(state) {
  if (state.requestedOpen) return 'open'
  return state.isOpen && !state.isVisible ? 'keep-open' : 'close'
}
